import sharp from "sharp";
import type { IncomingMessage } from "node:http";
import { imageHeader } from "../src/media/header.ts";
import { maxImageBytes, compressionSizes } from "../src/media/types.ts";
sharp.cache({ memory: 16, files: 0, items: 20 });
sharp.concurrency(1);
let jobs = 0;
export async function normalizeUpload(req: IncomingMessage) {
  if (jobs >= 2) throw Error("El servicio está ocupado. Vuelve a intentarlo.");
  if (Number(req.headers["content-length"] || 0) > 2 * 1024 * 1024) {
    req.resume();
    throw Error("La imagen supera 2 MB.");
  }
  jobs++;
  req.setTimeout(15_000, () => req.destroy(Error("La carga tardó demasiado.")));
  try {
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) throw Error("La imagen supera 2 MB.");
      chunks.push(chunk);
    }
    const input = Buffer.concat(chunks);
    const type =
      input[0] === 0xff && input[1] === 0xd8
        ? "image/jpeg"
        : input
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? "image/png"
          : input.subarray(0, 4).toString() === "RIFF" &&
              input.subarray(8, 12).toString() === "WEBP"
            ? "image/webp"
            : "";
    if (!type || req.headers["content-type"] !== type)
      throw Error("Solo se admiten JPG, PNG y WebP válidos.");
    imageHeader(input, type);
    const metadata = await sharp(input, {
      limitInputPixels: 16_000_000,
    }).metadata();
    if (
      (metadata.pages || 1) > 1 ||
      (metadata.width || 0) > 8192 ||
      (metadata.height || 0) > 8192
    )
      throw Error("Elige una imagen sin animación y de hasta 16 megapíxeles.");
    for (const edge of compressionSizes) {
      for (const quality of [78, 62, 45]) {
        const output = await sharp(input, { limitInputPixels: 16_000_000 })
          .timeout({ seconds: 10 })
          .rotate()
          .resize({
            width: edge,
            height: edge,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality, effort: 3 })
          .toBuffer();
        if (output.length <= maxImageBytes) return output;
      }
    }
    throw Error("No se pudo reducir la imagen al tamaño permitido.");
  } finally {
    req.setTimeout(0);
    jobs--;
  }
}
