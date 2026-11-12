import { randomUUID } from "node:crypto";
import { featuredActivities } from "../src/data.ts";
import type { Activity } from "../src/data.ts";
import type { Storage } from "./storage.ts";

export function meetingActivity(storage: Storage, id: string): (Activity & { themeId: string; cancelled: boolean; cancellationReason: string | null }) | undefined {
  const row = storage.db.prepare("SELECT m.id,m.theme_id AS themeId,m.capacity,m.duration,m.cancelled_at,m.cancellation_reason,o.starts_at AS startsAt FROM scheduled_meetings m JOIN offerings o ON o.activity_id=m.id WHERE m.id=?").get(id);
  if (!row) return undefined;
  const theme = featuredActivities.find((a) => a.id === row.themeId);
  return theme ? { ...theme, id: String(row.id), themeId: String(row.themeId), capacity: Number(row.capacity), duration: Number(row.duration), startsAt: new Date(Number(row.startsAt)).toISOString(), occupied: 0, people: [], cancelled: row.cancelled_at !== null, cancellationReason: row.cancellation_reason === null ? null : String(row.cancellation_reason) } : undefined;
}
export function listMeetings(storage: Storage, now: number, userId: string, offset = 0) {
  const rows = storage.db.prepare("SELECT m.id FROM scheduled_meetings m JOIN offerings o ON o.activity_id=m.id WHERE (m.cancelled_at IS NULL AND o.starts_at + m.duration*60000 + 300000 > ?) OR (m.cancelled_at IS NOT NULL AND EXISTS (SELECT 1 FROM reservations r WHERE r.activity_id=m.id AND r.user_id=?)) ORDER BY o.starts_at,m.id LIMIT 201 OFFSET ?").all(now, userId, offset);
  return rows.flatMap((row) => { const meeting = meetingActivity(storage, String(row.id)); return meeting ? [meeting] : []; });
}
export function scheduleMeeting(storage: Storage, userId: string, value: Record<string, unknown>, now: number) {
  if (Object.keys(value).length !== 3 || typeof value.themeId !== "string" || !featuredActivities.some((a) => a.id === value.themeId) || !Number.isSafeInteger(value.startsAt) || Number(value.startsAt) < now + 300_000 || Number(value.startsAt) > now + 366 * 86400_000 || !Number.isInteger(value.capacity) || Number(value.capacity) < 3 || Number(value.capacity) > 6) throw Error("invalid_meeting");
  const id = randomUUID();
  const theme = featuredActivities.find((activity) => activity.id === value.themeId)!;
  storage.transaction(() => {
    if (storage.db.prepare("SELECT 1 FROM scheduled_meetings m JOIN offerings o ON o.activity_id=m.id WHERE m.theme_id=? AND o.starts_at=?").get(String(value.themeId), Number(value.startsAt))) throw Error("duplicate_meeting");
    storage.db.prepare("INSERT INTO offerings VALUES(?,?)").run(id, Number(value.startsAt));
    storage.db.prepare("INSERT INTO scheduled_meetings(id,theme_id,capacity,duration,created_at,created_by) VALUES(?,?,?,?,?,?)").run(id, String(value.themeId), Number(value.capacity), theme.duration, now, userId);
  });
  return meetingActivity(storage, id)!;
}
export function cancelMeeting(storage: Storage, id: string, value: Record<string, unknown>, now: number) {
  if (Object.keys(value).length !== 1 || typeof value.reason !== "string" || value.reason.trim().length < 5 || value.reason.trim().length > 500) throw Error("invalid_reason");
  const reason = value.reason.trim();
  storage.transaction(() => {
    const result = storage.db.prepare("UPDATE scheduled_meetings SET cancelled_at=?, cancellation_reason=? WHERE id=? AND cancelled_at IS NULL AND (SELECT starts_at FROM offerings WHERE activity_id=?) > ?").run(now, reason, id, id, now + 300_000);
    if (!result.changes) throw Error("cannot_cancel");
    storage.db.prepare("INSERT INTO push_queue(meeting_id,endpoint_hash,user_id,created_at,next_at) SELECT ?,s.endpoint_hash,s.user_id,?,? FROM push_subscriptions s JOIN reservations r ON r.user_id=s.user_id WHERE r.activity_id=?").run(id, now, now, id);
  });
}
