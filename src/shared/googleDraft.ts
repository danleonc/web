import type { blankDraft } from "../pages/Plaza";
import { validImageRef } from "../media/types";
const key = "afinia.google.return-draft.v1";
type Draft = typeof blankDraft;
export function saveGoogleDraft(draft: Draft, owner: string) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ draft, owner, until: Date.now() + 600_000 }),
    );
  } catch {
    /* Navigation still works when browser storage is unavailable. */
  }
}
export function restoreGoogleDraft(owner: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    sessionStorage.removeItem(key);
    const item = JSON.parse(raw);
    if (
      !item ||
      item.until < Date.now() ||
      !Number.isFinite(item.until) ||
      (item.owner !== "guest" && item.owner !== owner)
    )
      return null;
    const d = item.draft;
    if (
      !d ||
      typeof d.title !== "string" ||
      d.title.length > 200 ||
      typeof d.body !== "string" ||
      d.body.length > 5000 ||
      !["cultura", "crear", "cotidiano"].includes(d.topic)
    )
      return null;
    return {
      title: d.title,
      body: d.body,
      topic: d.topic,
      ...(typeof d.editingId === "string" && d.editingId.length <= 100
        ? { editingId: d.editingId }
        : {}),
      ...(validImageRef(d.image) ? { image: d.image } : {}),
    };
  } catch {
    return null;
  }
}
