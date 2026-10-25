import { validReason } from "./rules";
import type { ConductReason } from "./rules";
const key = "afinia.reports.v1";
type LocalReport = {
  id: string;
  subject: string;
  reason: ConductReason;
  note: string;
  createdAt: string;
};
export function localReports(): LocalReport[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value)
      ? value
          .filter(
            (v) =>
              v &&
              typeof v.id === "string" &&
              typeof v.subject === "string" &&
              validReason(v.reason) &&
              typeof v.note === "string" &&
              typeof v.createdAt === "string",
          )
          .slice(-50)
      : [];
  } catch {
    return [];
  }
}
export function saveLocalReport(
  subject: string,
  reason: ConductReason,
  note: string,
) {
  localStorage.setItem(
    key,
    JSON.stringify(
      [
        ...localReports(),
        {
          id: crypto.randomUUID(),
          subject: subject.slice(0, 200),
          reason,
          note: note.slice(0, 500),
          createdAt: new Date().toISOString(),
        },
      ].slice(-50),
    ),
  );
}
export function clearLocalReports() {
  localStorage.removeItem(key);
}
