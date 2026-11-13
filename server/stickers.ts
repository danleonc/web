import { createRequire } from "node:module";
const packs = createRequire(import.meta.url)("../src/chat/sticker-packs.json") as { id: string; assets: string[] }[];
const allowed = new Set(packs.flatMap(pack => pack.assets.map((_, index) => `${pack.id}-${index + 1}`)));
export function validSticker(id: string) { return allowed.has(id); }
