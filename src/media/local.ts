export { prepareImage } from "./prepare";
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
