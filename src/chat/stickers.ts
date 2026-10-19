import packs from "./sticker-packs.json";
export type Sticker = {
  id: string;
  label: string;
  packId: string;
  packName: string;
  tags: string[];
  src: string;
};
export const stickerPacks = packs;
export const stickers: Sticker[] = packs.flatMap((pack) =>
  pack.labels.map((label, i) => ({
    id: `${pack.id}-${i + 1}`,
    label,
    packId: pack.id,
    packName: pack.name,
    tags: pack.tags,
    src: `${import.meta.env.BASE_URL}stickers/${pack.id}-${i + 1}.svg`,
  })),
);
const byId = new Map(stickers.map((s) => [s.id, s]));
export const getSticker = (id: string) => byId.get(id);
export const validStickerIds = (ids: string[]) =>
  [...new Set(ids)].filter((id) => byId.has(id));
export const normalizeSearch = (value: string) =>
  value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
export type StickerPreferences = { favorites: string[]; recent: string[] };
export type StickerActions = {
  stickerPreferences: StickerPreferences;
  onToggleFavorite: (id: string) => void;
  onStickerUsed: (id: string) => void;
};
