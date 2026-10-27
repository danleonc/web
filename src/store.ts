import { validStickerIds, stickerPacks, getSticker } from "./chat/stickers";
import { emptyPlaza, plazaTopics } from "./plaza/data";
import { validImageRef } from "./media/types";
import type { PlazaState } from "./plaza/data";
import { normalizeInvitation } from "./plaza/invitations";
export type Profile = {
  alias: string;
  interests: string[];
  boundaries: string[];
  availability: string;
  adult: boolean;
};
export type Feedback = {
  activityId: string;
  comfort: number;
  reconnect: string[];
  note: string;
  repeatGroup?: boolean;
};
export type LocalState = {
  profile: Profile | null;
  reservations: string[];
  feedback: Feedback[];
  blocked: string[];
  stickerFavorites: string[];
  stickerRecent: string[];
  stickerUsage: Record<string, number>;
  stickerFavoritePacks: string[];
  plaza: PlazaState;
};
export const storageKey = "entre.prototype.v1";
export const emptyState: LocalState = {
  profile: null,
  reservations: [],
  feedback: [],
  blocked: [],
  stickerFavorites: [],
  stickerRecent: [],
  stickerUsage: {},
  stickerFavoritePacks: [],
  plaza: emptyPlaza,
};
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
function loadPlaza(value: unknown, blocked: string[]): PlazaState {
  if (!value || typeof value !== "object") return emptyPlaza;
  const v = value as Partial<PlazaState>;
  const short = (s: unknown, max: number) =>
    typeof s === "string" && s.trim().length > 0 && s.length <= max;
  return {
    posts: Array.isArray(v.posts)
      ? v.posts
          .filter(
            (p) =>
              p &&
              short(p.id, 80) &&
              p.own === true &&
              plazaTopics.some((t) => t.id === p.topic) &&
              short(p.title, 100) &&
              short(p.body, 1000) &&
              short(p.author, 30),
          )
          .slice(0, 30)
          .map((p) => ({
            ...p,
            personId: "self",
            art: undefined,
            tags: [],
            image: validImageRef(p.image)
              ? { id: p.image.id, description: p.image.description }
              : undefined,
          }))
      : [],
    comments: Array.isArray(v.comments)
      ? v.comments
          .filter(
            (c) =>
              c &&
              short(c.id, 80) &&
              short(c.postId, 80) &&
              c.own === true &&
              typeof c.body === "string" &&
              c.body.length <= 700 &&
              (short(c.body, 700) ||
                validImageRef(c.image) ||
                (typeof c.stickerId === "string" &&
                  !!getSticker(c.stickerId))) &&
              (c.stickerId === undefined ||
                (typeof c.stickerId === "string" &&
                  !!getSticker(c.stickerId))) &&
              (c.image === undefined ||
                (validImageRef(c.image) && c.stickerId === undefined)) &&
              short(c.author, 30),
          )
          .slice(-100)
          .map((c) => ({
            id: c.id,
            postId: c.postId,
            body: c.body,
            author: c.author,
            own: true,
            stickerId: c.stickerId,
            image: validImageRef(c.image)
              ? { id: c.image.id, description: c.image.description }
              : undefined,
          }))
      : [],
    saved: strings(v.saved) ? v.saved.slice(0, 50) : [],
    hidden: strings(v.hidden) ? v.hidden.slice(0, 50) : [],
    invitations: Array.isArray(v.invitations)
      ? [
          ...new Map(
            v.invitations.flatMap((i) => {
              const valid = normalizeInvitation(i, blocked);
              return valid ? [[valid.personId, valid] as const] : [];
            }),
          ).values(),
        ].slice(0, 3)
      : [],
  };
}
export function loadState(): LocalState {
  try {
    const v = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (
      !v ||
      !strings(v.reservations) ||
      !strings(v.blocked) ||
      !Array.isArray(v.feedback)
    )
      return emptyState;
    const profile = v.profile;
    if (
      profile !== null &&
      (!profile ||
        typeof profile.alias !== "string" ||
        !strings(profile.interests) ||
        !strings(profile.boundaries) ||
        typeof profile.availability !== "string" ||
        profile.adult !== true)
    )
      return emptyState;
    if (
      !v.feedback.every(
        (f: Feedback) =>
          f &&
          typeof f.activityId === "string" &&
          Number.isInteger(f.comfort) &&
          f.comfort >= 1 &&
          f.comfort <= 5 &&
          strings(f.reconnect) &&
          typeof f.note === "string" &&
          (f.repeatGroup === undefined || typeof f.repeatGroup === "boolean"),
      )
    )
      return emptyState;
    return {
      profile,
      reservations: v.reservations,
      feedback: v.feedback,
      blocked: v.blocked,
      stickerFavorites: validStickerIds(
        strings(v.stickerFavorites) ? v.stickerFavorites : [],
      ),
      stickerRecent: validStickerIds(
        strings(v.stickerRecent) ? v.stickerRecent : [],
      ).slice(0, 24),
      stickerUsage: Object.fromEntries(
        Object.entries(
          v.stickerUsage && typeof v.stickerUsage === "object"
            ? v.stickerUsage
            : {},
        )
          .filter(
            ([id, count]) =>
              getSticker(id) &&
              typeof count === "number" &&
              Number.isSafeInteger(count) &&
              count > 0,
          )
          .map(([id, count]) => [id, Math.min(count as number, 1_000_000)]),
      ),
      stickerFavoritePacks: [
        ...new Set<string>(
          strings(v.stickerFavoritePacks) ? v.stickerFavoritePacks : [],
        ),
      ].filter((id) => stickerPacks.some((p) => p.id === id)),
      plaza: loadPlaza(v.plaza, v.blocked),
    };
  } catch {
    return emptyState;
  }
}
export function saveState(state: LocalState): boolean {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
