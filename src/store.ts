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
};
export type LocalState = {
  profile: Profile | null;
  reservations: string[];
  feedback: Feedback[];
  blocked: string[];
};
export const storageKey = "entre.prototype.v1";
export const emptyState: LocalState = {
  profile: null,
  reservations: [],
  feedback: [],
  blocked: [],
};
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
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
          typeof f.note === "string",
      )
    )
      return emptyState;
    return {
      profile,
      reservations: v.reservations,
      feedback: v.feedback,
      blocked: v.blocked,
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
