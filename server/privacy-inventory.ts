import type { Storage } from "./storage.ts";

// Counts are an operational aid, never a legal determination or an erasure.
export function privacyInventory(storage: Storage, userId: string) {
  const db = storage.db;
  const queries: Record<string, string> = {
    accounts: "SELECT count(*) AS n FROM accounts WHERE id=?",
    emails: "SELECT count(*) AS n FROM account_emails WHERE user_id=?",
    googleLinks: "SELECT count(*) AS n FROM account_google WHERE user_id=?",
    googleFlows: "SELECT count(*) AS n FROM google_flows WHERE account_id=?",
    sessions: "SELECT count(*) AS n FROM sessions WHERE user_id=?",
    pushDevices: "SELECT count(*) AS n FROM push_subscriptions WHERE user_id=?",
    posts: "SELECT count(*) AS n FROM plaza_posts WHERE author_id=?",
    replies: "SELECT count(*) AS n FROM plaza_replies WHERE author_id=?",
    sentPrivateMessages: "SELECT count(*) AS n FROM plaza_private_messages WHERE sender_id=?",
    roomMessages: "SELECT count(*) AS n FROM messages WHERE sender_id=?",
    images: "SELECT count(*) AS n FROM media WHERE owner_id=?",
    reservations: "SELECT count(*) AS n FROM reservations WHERE user_id=?",
    memberships: "SELECT count(*) AS n FROM memberships WHERE user_id=?",
    roomsWithEmbeddedId: "SELECT count(*) AS n FROM rooms WHERE instr(session_json,?)>0 OR instr(safety_json,?)>0",
    roomMessagesWithEmbeddedId: "SELECT count(*) AS n FROM messages WHERE instr(payload,?)>0",
    plazaEvidenceWithEmbeddedId: "SELECT count(*) AS n FROM plaza_reports WHERE instr(evidence_json,?)>0",
    roomEvidenceWithEmbeddedId: "SELECT count(*) AS n FROM reports WHERE instr(evidence_json,?)>0",
    blocksMade: "SELECT count(*) AS n FROM blocks WHERE user_id=?",
    blocksReceived: "SELECT count(*) AS n FROM blocks WHERE blocked_id=?",
    connections: "SELECT count(*) AS n FROM plaza_connections WHERE sender_id=? OR recipient_id=?",
    reportsMade: "SELECT count(*) AS n FROM plaza_reports WHERE reporter_id=?",
    reportsReceived: "SELECT count(*) AS n FROM plaza_reports WHERE target_id=?",
    roomReportsMade: "SELECT count(*) AS n FROM reports WHERE reporter_id=?",
    roomReportsReceived: "SELECT count(*) AS n FROM reports WHERE target_id=?",
    appeals: "SELECT count(*) AS n FROM appeals WHERE user_id=?",
    plazaAppeals: "SELECT count(*) AS n FROM plaza_appeals WHERE user_id=?",
    moderationActions: "SELECT count(*) AS n FROM moderation_actions WHERE user_id=? OR moderator_id=?",
    plazaModerationActions: "SELECT count(*) AS n FROM plaza_moderation_actions WHERE moderator_id=?",
    plazaAppealActions: "SELECT count(*) AS n FROM plaza_appeal_actions WHERE moderator_id=?",
    restrictions: "SELECT count(*) AS n FROM restrictions WHERE user_id=?",
    plannedMeetings: "SELECT count(*) AS n FROM scheduled_meetings WHERE created_by=?",
    privacyRequests: "SELECT count(*) AS n FROM privacy_requests WHERE user_id=?",
    privacyEvents: "SELECT count(*) AS n FROM privacy_request_events WHERE user_id=? OR actor_id=?",
    privacyAcknowledgements: "SELECT count(*) AS n FROM privacy_requests WHERE seen_by=?",
    privacyOperatorRole: "SELECT count(*) AS n FROM privacy_operators WHERE user_id=?",
    moderationRole: "SELECT count(*) AS n FROM moderators WHERE user_id=?",
    notificationQueue: "SELECT count(*) AS n FROM push_queue WHERE user_id=?",
    privateNotificationQueue: "SELECT count(*) AS n FROM push_private_queue WHERE user_id=?",
    sentPrivateNotificationQueue: "SELECT count(*) AS n FROM push_private_queue q JOIN plaza_private_messages m ON m.id=q.message_id WHERE m.sender_id=?",
    createdMeetingNotificationQueue: "SELECT count(*) AS n FROM push_queue q JOIN scheduled_meetings m ON m.id=q.meeting_id WHERE m.created_by=?",
  };
  const counts: Record<string, number> = {};
  for (const [name, sql] of Object.entries(queries)) counts[name] = Number(db.prepare(sql).get(...(sql.includes(" OR ") ? [userId, userId] : [userId]))!.n);
  return { counts, limitations: ["No examina respaldos, archivos locales ni proveedores externos.", "No identifica todas las referencias incrustadas en estados de sala, evidencia, registros o contenidos de terceros.", "Los conteos cambian con el tiempo y no implican que los datos puedan borrarse automáticamente."] };
}
