// Read dimensions before decoding so a tiny compressed file cannot allocate a giant bitmap.
export function imageHeader(
  bytes: Uint8Array,
  mime: string,
  limits = { maxPixels: 16_000_000, maxDimension: 8192 },
) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, length: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length));
  let width = 0,
    height = 0,
    animated = false;
  if (
    mime === "image/png" &&
    bytes.length >= 24 &&
    bytes[0] === 137 &&
    text(1, 7) === "PNG\r\n\x1a\n"
  ) {
    width = view.getUint32(16);
    height = view.getUint32(20);
    for (let offset = 8; offset + 12 <= bytes.length; ) {
      const length = view.getUint32(offset);
      if (offset + 12 + length > bytes.length)
        throw Error("Imagen PNG incompleta.");
      if (text(offset + 4, 4) === "acTL") animated = true;
      offset += 12 + length;
    }
  } else if (
    mime === "image/webp" &&
    bytes.length >= 30 &&
    text(0, 4) === "RIFF" &&
    text(8, 4) === "WEBP"
  ) {
    for (let offset = 12; offset + 8 <= bytes.length; ) {
      const type = text(offset, 4),
        length = view.getUint32(offset + 4, true),
        data = offset + 8;
      if (data + length > bytes.length) throw Error("Imagen WebP incompleta.");
      if (type === "ANIM" || type === "ANMF") animated = true;
      if (type === "VP8X" && length >= 10) {
        animated ||= !!(bytes[data] & 2);
        width =
          1 +
          bytes[data + 4] +
          (bytes[data + 5] << 8) +
          (bytes[data + 6] << 16);
        height =
          1 +
          bytes[data + 7] +
          (bytes[data + 8] << 8) +
          (bytes[data + 9] << 16);
      }
      if (type === "VP8 " && length >= 10 && !width) {
        width = view.getUint16(data + 6, true) & 0x3fff;
        height = view.getUint16(data + 8, true) & 0x3fff;
      }
      if (type === "VP8L" && length >= 5 && !width) {
        const bits = view.getUint32(data + 1, true);
        width = 1 + (bits & 0x3fff);
        height = 1 + ((bits >>> 14) & 0x3fff);
      }
      offset = data + length + (length % 2);
    }
  } else if (mime === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216) {
    for (let offset = 2; offset + 4 <= bytes.length; ) {
      if (bytes[offset++] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const type = bytes[offset++];
      if (type === 0xda || type === 0xd9) break;
      if (type === 1 || (type >= 0xd0 && type <= 0xd8)) continue;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(type) &&
        length >= 7
      ) {
        height = view.getUint16(offset + 3);
        width = view.getUint16(offset + 5);
        break;
      }
      offset += length;
    }
  }
  if (animated) throw Error("Elige una imagen sin animación.");
  if (!width || !height)
    throw Error("No se reconoce una imagen JPG, PNG o WebP válida.");
  if (
    width * height > limits.maxPixels ||
    Math.max(width, height) > limits.maxDimension
  )
    throw Error(
      `Esta imagen supera los ${Math.round(limits.maxPixels / 1_000_000)} megapíxeles o ${limits.maxDimension} píxeles por lado admitidos.`,
    );
  return { width, height };
}
