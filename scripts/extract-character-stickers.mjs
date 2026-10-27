// Pass five reviewed transparent 4-column × 3-row sheets, in this order.
// Chopped characters and ambiguous components are rejected before publishing assets.
import sharp from "sharp";
import { isolateSticker } from "./sticker-geometry.mjs";
import { createHash } from "node:crypto";
import {
  readFile,
  writeFile,
  mkdir,
  mkdtemp,
  copyFile,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
const catalogPath = new URL("../src/chat/sticker-packs.json", import.meta.url);
const output = new URL("../public/stickers/", import.meta.url);
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const previous = catalog.flatMap(
  (p) => p.assets || p.labels.map((_, i) => `${p.id}-${i + 1}.webp`),
);
const staging = await mkdtemp(join(tmpdir(), "afinia-sticker-extraction-"));
const next = [];
try {
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
      const pack = catalog.find((p) => p.id === id);
      if (!pack || pack.labels.length !== positions.length)
        throw Error(`Invalid catalog mapping: ${id}`);
      pack.assets = [];
      for (const [pose, cell] of positions.entries()) {
        const column = cell % 4,
          row = Math.floor(cell / 4);
        const left = Math.round((column * width) / 4),
          top = Math.round((row * height) / 3);
        const cellWidth = Math.round(((column + 1) * width) / 4) - left;
        const cellHeight = Math.round(((row + 1) * height) / 3) - top;
        const { data, info } = await sharp(path)
          .extract({ left, top, width: cellWidth, height: cellHeight })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const isolated = isolateSticker(
          data,
          cellWidth,
          cellHeight,
          `${id}-${pose + 1}`,
        );
        const buffer = await sharp(isolated.pixels, {
          raw: {
            width: cellWidth,
            height: cellHeight,
            channels: info.channels,
          },
        })
          .extract(isolated.bounds)
          .resize(280, 280, { fit: "contain", background: "#00000000" })
          .extend({
            top: 20,
            bottom: 20,
            left: 20,
            right: 20,
            background: "#00000000",
          })
          .webp({ quality: 90, alphaQuality: 90, effort: 3 })
          .toBuffer();
        const hash = createHash("sha256")
          .update(buffer)
          .digest("hex")
          .slice(0, 12);
        const file = `${id}-${pose + 1}.${hash}.webp`;
        await writeFile(join(staging, file), buffer);
        pack.assets.push(file);
        next.push(file);
      }
    }
  }
  await mkdir(output, { recursive: true });
  for (const file of next)
    await copyFile(join(staging, file), new URL(file, output));
  await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
  // Only remove this catalog's superseded, named files; never clean the whole folder.
  for (const file of previous)
    if (!next.includes(file)) await rm(new URL(file, output), { force: true });
  console.log(
    `${next.length} checked character stickers prepared at 320 × 320, with 20px safe margins and content-hashed URLs.`,
  );
} finally {
  await rm(staging, { recursive: true, force: true });
}
