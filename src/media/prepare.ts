import { imageHeader } from "./header";
import {
  compressionSizes,
  maxImageBytes,
  maxOriginalImageBytes,
  maxOriginalImageMB,
  originalImageLimits,
} from "./types";
import type { ImageRef } from "./types";

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

function photoType(bytes: Uint8Array) {
  if (bytes[0] === 255 && bytes[1] === 216) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    return "image/png";
  if (
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  )
    return "image/webp";
  throw Error(
    "Elige una foto JPG, PNG o WebP. No se admiten archivos animados ni SVG.",
  );
}

// Use the display orientation when asking the decoder to downsample a camera JPEG.
function jpegOrientation(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 2; offset + 4 <= bytes.length; ) {
    if (bytes[offset++] !== 255) break;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9 || offset + 2 > bytes.length) break;
    if (marker === 1 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    const length = view.getUint16(offset),
      end = offset + length;
    if (length < 2 || end > bytes.length) break;
    if (
      marker === 0xe1 &&
      length >= 16 &&
      String.fromCharCode(...bytes.subarray(offset + 2, offset + 8)) ===
        "Exif\0\0"
    ) {
      const tiff = offset + 8,
        order = view.getUint16(tiff),
        little = order === 0x4949;
      if (
        (!little && order !== 0x4d4d) ||
        view.getUint16(tiff + 2, little) !== 42
      )
        return 1;
      const directory = tiff + view.getUint32(tiff + 4, little);
      if (directory < tiff + 8 || directory + 2 > end) return 1;
      const count = view.getUint16(directory, little);
      for (
        let item = directory + 2;
        item + 12 <= end && item < directory + 2 + count * 12;
        item += 12
      ) {
        if (
          view.getUint16(item, little) === 0x112 &&
          view.getUint16(item + 2, little) === 3 &&
          view.getUint32(item + 4, little) === 1
        ) {
          const orientation = view.getUint16(item + 8, little);
          return orientation >= 1 && orientation <= 8 ? orientation : 1;
        }
      }
    }
    offset = end;
  }
  return 1;
}

async function decodePhoto(
  blob: Blob,
  width: number,
  height: number,
): Promise<DecodedImage> {
  const scale = Math.min(1, compressionSizes[0] / Math.max(width, height));
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob, {
        imageOrientation: "from-image",
        resizeWidth: Math.max(1, Math.round(width * scale)),
        resizeHeight: Math.max(1, Math.round(height * scale)),
        resizeQuality: "high",
      });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      /* Older mobile decoders can still open the photo as an ordinary image. */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob),
      image = new Image();
    const close = () => {
      image.onload = null;
      image.onerror = null;
      image.src = "";
      URL.revokeObjectURL(url);
    };
    const timer = setTimeout(() => {
      close();
      reject(
        Error("La foto tardó demasiado en abrirse. Vuelve a seleccionarla."),
      );
    }, 30_000);
    image.decoding = "async";
    image.onload = () => {
      clearTimeout(timer);
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        close,
      });
    };
    image.onerror = () => {
      clearTimeout(timer);
      close();
      reject(
        Error(
          "No se pudo abrir esta foto. Comprueba que sea una imagen JPG, PNG o WebP válida.",
        ),
      );
    };
    image.src = url;
  });
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob(resolve, type, quality);
    } catch {
      resolve(null);
    }
  });
}

export async function prepareImage(
  file: File,
): Promise<{ image: ImageRef; blob: Blob }> {
  if (file.size > maxOriginalImageBytes)
    throw Error(
      `Esta foto supera los ${maxOriginalImageMB} MB. Puedes elegir fotos de hasta ${maxOriginalImageMB} MB; Afinia las reduce automáticamente.`,
    );
  const bytes = new Uint8Array(await file.arrayBuffer()),
    type = photoType(bytes);
  const header = imageHeader(bytes, type, originalImageLimits);
  const swapped = type === "image/jpeg" && jpegOrientation(bytes) >= 5;
  const decoded = await decodePhoto(
    new Blob([bytes], { type }),
    swapped ? header.height : header.width,
    swapped ? header.width : header.height,
  );
  const canvas = document.createElement("canvas");
  try {
    if (
      !decoded.width ||
      !decoded.height ||
      decoded.width * decoded.height > originalImageLimits.maxPixels ||
      Math.max(decoded.width, decoded.height) > originalImageLimits.maxDimension
    )
      throw Error("No se pudieron leer las dimensiones de esta foto.");
    // Unsupported canvas formats may return PNG instead, or no blob at all.
    // Prefer WebP, then JPEG, and finally the universally available PNG encoder.
    for (const outputType of ["image/webp", "image/jpeg", "image/png"]) {
      let supported = true;
      for (const edge of compressionSizes) {
        const scale = Math.min(
          1,
          edge / Math.max(decoded.width, decoded.height),
        );
        canvas.width = Math.max(1, Math.round(decoded.width * scale));
        canvas.height = Math.max(1, Math.round(decoded.height * scale));
        const context = canvas.getContext("2d");
        if (!context)
          throw Error(
            "El navegador no pudo preparar la foto. Vuelve a intentarlo.",
          );
        if (outputType === "image/jpeg") {
          context.fillStyle = "#fff";
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
        context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
        for (const quality of outputType === "image/png"
          ? [1]
          : [0.82, 0.65, 0.48]) {
          const blob = await encode(canvas, outputType, quality);
          if (!blob || blob.type !== outputType) {
            supported = false;
            break;
          }
          if (blob.size > 0 && blob.size <= maxImageBytes)
            return {
              image: { id: crypto.randomUUID(), description: "" },
              blob,
            };
        }
        if (!supported) break;
      }
    }
    throw Error(
      "El navegador no pudo preparar esta foto. Vuelve a seleccionarla o prueba actualizando el navegador.",
    );
  } finally {
    decoded.close();
    canvas.width = canvas.height = 1;
  }
}
