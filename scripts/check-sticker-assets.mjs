// Validate actual distributed art, not UI counts: full silhouettes, clear edges,
// expected transparency, matching content hashes, and no superseded files.
import sharp from "sharp";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { alphaComponents } from "./sticker-geometry.mjs";

const packs = JSON.parse(
  await readFile(
    new URL("../src/chat/sticker-packs.json", import.meta.url),
    "utf8",
  ),
);
const root = new URL("../public/stickers/", import.meta.url);
const expected = [];
for (const pack of packs) {
  if (!Array.isArray(pack.assets) || pack.assets.length !== pack.labels.length)
    throw Error(`Missing assets: ${pack.id}`);
  for (const [i, name] of pack.assets.entries()) {
    if (!new RegExp(`^${pack.id}-${i + 1}\\.[a-f0-9]{12}\\.webp$`).test(name))
      throw Error(`Unexpected asset filename: ${name}`);
    expected.push(name);
    const bytes = await readFile(new URL(name, root));
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
    if (!name.includes(`.${hash}.`)) throw Error(`Stale content hash: ${name}`);
    const { data, info } = await sharp(bytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.width !== 320 || info.height !== 320 || info.channels !== 4)
      throw Error(`Unexpected raster: ${name}`);
    for (let y = 0; y < 320; y++)
      for (let x = 0; x < 320; x++) {
        if (
          (x < 20 || y < 20 || x >= 300 || y >= 300) &&
          data[(y * 320 + x) * 4 + 3] !== 0
        )
          throw Error(`Visible fragment in safe margin: ${name} at ${x},${y}`);
      }
    const { components } = alphaComponents(data, 320, 320);
    if (!components.length || components[0].area < 10_000)
      throw Error(`Missing character: ${name}`);
    // A second substantial character/neighbor fragment must not be hidden inside the frame.
    if (components.slice(1).some((c) => c.area > components[0].area * 0.15))
      throw Error(`Unexpected second silhouette: ${name}`);
  }
}
const actual = (await readdir(root)).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected.sort()))
  throw Error("Unlisted or missing files in public/stickers.");
console.log(
  `${expected.length} sticker assets checked: 320×320, clean 20px margins, silhouettes and content hashes OK.`,
);
