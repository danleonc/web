import { imageHeader } from "./header";
import type { ImageRef } from "./types";
import { maxImageBytes } from "./types";
type Asset = { id: string; blob: Blob; size: number };
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("afinia.images.v1", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("images", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(Error("El navegador no permite guardar imágenes."));
  });
}
export async function getImage(id: string): Promise<Blob | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction("images").objectStore("images").get(id);
      r.onsuccess = () => resolve((r.result as Asset | undefined)?.blob);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function saveImage(id: string, blob: Blob) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("images", "readwrite");
      const store = tx.objectStore("images");
      const r = store.getAll();
      r.onsuccess = () => {
        const assets = r.result as Asset[];
        if (
          assets.filter((a) => a.id !== id).reduce((n, a) => n + a.size, 0) +
            blob.size >
          10 * 1024 * 1024
        ) {
          tx.abort();
          return;
        }
        store.put({ id, blob, size: blob.size });
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(
          Error(
            "No hay espacio para otra imagen de prueba. Elimina alguna publicación o imagen antes de continuar.",
          ),
        );
      tx.onerror = () => reject(Error("No se pudo guardar la imagen."));
    });
  } finally {
    db.close();
  }
}
export async function deleteImage(id: string) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("images", "readwrite");
      tx.objectStore("images").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function clearImages() {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("images", "readwrite");
      tx.objectStore("images").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function prepareImage(
  file: File,
): Promise<{ image: ImageRef; blob: Blob }> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw Error(
      "Elige una imagen JPG, PNG o WebP de hasta 5 MB. No se admiten archivos animados ni SVG.",
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  imageHeader(bytes, file.type);
  const bitmap = await createImageBitmap(file);
  try {
    if (
      bitmap.width * bitmap.height > 16_000_000 ||
      bitmap.width > 8192 ||
      bitmap.height > 8192
    )
      throw Error(
        "La imagen es demasiado grande. Elige una de hasta 16 megapíxeles.",
      );
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.78, 0.62, 0.45]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", quality),
      );
      if (blob && blob.type === "image/webp" && blob.size <= maxImageBytes)
        return { image: { id: crypto.randomUUID(), description: "" }, blob };
    }
    throw Error(
      "No se pudo comprimir esta imagen. Prueba con otra más pequeña.",
    );
  } finally {
    bitmap.close();
  }
}
