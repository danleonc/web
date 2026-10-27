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
const expressionTags = [
  ["hola", "saludo", "bienvenida"],
  ["jaja", "jajaja", "risa", "humor"],
  ["abrazo", "amor", "cariño", "apoyo"],
  ["sorpresa", "asombro", "sorprendido"],
  ["dormir", "sueño", "siesta", "descanso"],
  ["estres", "agobio", "enojo", "frustracion", "confusion"],
];
export const stickers: Sticker[] = packs.flatMap((pack) =>
  pack.labels.map((label, i) => ({
    id: `${pack.id}-${i + 1}`,
    label,
    packId: pack.id,
    packName: pack.name,
    tags: [
      ...pack.tags,
      ...(pack.motif === "character" ? expressionTags[i] || [] : []),
    ],
    src: `${import.meta.env.BASE_URL}stickers/${pack.id}-${i + 1}.${"format" in pack ? pack.format : "svg"}`,
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
export type StickerPreferences = {
  favorites: string[];
  recent: string[];
  usage: Record<string, number>;
  favoritePacks: string[];
};
// Explicit pins always lead. Frequency is local and never inferred from chat text.
export function favoriteStickerIds(preferences: StickerPreferences): string[] {
  const rank = new Map(preferences.recent.map((id, index) => [id, index]));
  const frequent = Object.keys(preferences.usage)
    .filter((id) => getSticker(id) && preferences.usage[id] > 0)
    .sort(
      (a, b) =>
        preferences.usage[b] - preferences.usage[a] ||
        (rank.get(a) ?? 24) - (rank.get(b) ?? 24) ||
        a.localeCompare(b),
    );
  return [...new Set([...preferences.favorites, ...frequent.slice(0, 12)])];
}
export type StickerActions = {
  stickerPreferences: StickerPreferences;
  onToggleFavorite: (id: string) => void;
  onToggleFavoritePack: (id: string) => void;
  onStickerUsed: (id: string) => void;
};
