// Asset preparation only: no remote images or runtime generation.
// Pass five reviewed transparent 4-column x 3-row sheets, in this order.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
sharp.concurrency(1);

const sheets = [
  [
    ["moka", [0, 1, 2, 3, 4, 5]],
    ["pipo", [6, 7, 8, 9, 10, 11]],
  ],
  [
    ["tuerca", [0, 1, 2, 3, 4, 5]],
    ["orbita", [6, 7, 8, 9, 10, 11]],
  ],
  [
    ["lila", [0, 1, 2, 3, 4, 5]],
    ["gota", [6, 7, 10, 9, 8, 11]],
  ],
  [
    ["michi-rosa", [0, 1, 2, 3, 4, 5]],
    ["nico", [8, 9, 6, 7, 10, 11]],
  ],
  [
    ["flama", [0, 1, 2, 3, 4, 5]],
    ["babu", [6, 7, 8, 9, 10, 11]],
  ],
];
const paths = process.argv.slice(2);
if (paths.length !== sheets.length) {
  throw Error(
    "Expected five PNG sheet paths: Moka/Pipo, Tuerca/Órbita, Lila/Gota, Michi/Nico, Flama/Babú.",
  );
}
const output = new URL("../public/stickers/", import.meta.url);
await mkdir(output, { recursive: true });
let count = 0;
for (const [sheetIndex, characters] of sheets.entries()) {
  const path = paths[sheetIndex];
  const { width, height, hasAlpha } = await sharp(path).metadata();
  if (
    !width ||
    !height ||
    !hasAlpha ||
    Math.abs(width / height - 4 / 3) > 0.02
  ) {
    throw Error(`Expected transparent 4:3 sheet: ${path}`);
  }
  for (const [id, positions] of characters) {
    for (const [pose, cell] of positions.entries()) {
      const column = cell % 4;
      const row = Math.floor(cell / 4);
      const left = Math.round((column * width) / 4);
      const top = Math.round((row * height) / 3);
      await sharp(path)
        .extract({
          left,
          top,
          width: Math.round(((column + 1) * width) / 4) - left,
          height: Math.round(((row + 1) * height) / 3) - top,
        })
        .resize(296, 296, { fit: "contain", background: "#00000000" })
        .extend({
          top: 12,
          bottom: 12,
          left: 12,
          right: 12,
          background: "#00000000",
        })
        .webp({ quality: 86, alphaQuality: 90, effort: 3 })
        .toFile(new URL(`${id}-${pose + 1}.webp`, output).pathname);
      count++;
    }
  }
}
console.log(`${count} character stickers prepared at 320 × 320.`);
