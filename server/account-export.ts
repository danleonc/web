import type { Storage } from "./storage.ts";

// This is a bounded copy of the user's own authored content, not a complete rights response.
export function exportOwnContent(storage: Storage, userId: string, now: number, page: number) {
  const db = storage.db, limit = 1000;
  const section = (sql: string) => {
    const rows = db.prepare(sql).all(userId, limit + 1, (page - 1) * limit);
    return { items: rows.slice(0, limit), truncated: rows.length > limit };
  };
  const account = db.prepare("SELECT a.id,a.username,a.alias,a.created_at AS createdAt,e.email,e.verified_at AS emailVerifiedAt,e.adult_declared_at AS adultDeclaredAt FROM accounts a LEFT JOIN account_emails e ON e.user_id=a.id WHERE a.id=?").get(userId);
  const posts = section("SELECT id,topic,title,body,created_at AS createdAt,hidden FROM plaza_posts WHERE author_id=? ORDER BY created_at,id LIMIT ? OFFSET ?");
  const replies = section("SELECT id,post_id AS postId,body,created_at AS createdAt,hidden FROM plaza_replies WHERE author_id=? ORDER BY created_at,id LIMIT ? OFFSET ?");
  const privateMessages = section("SELECT id,connection_id AS connectionId,body,created_at AS createdAt,hidden FROM plaza_private_messages WHERE sender_id=? AND body<>'' ORDER BY created_at,id LIMIT ? OFFSET ?");
  const roomMessages = section("SELECT id,room_id AS roomId,payload FROM messages WHERE sender_id=? ORDER BY rowid LIMIT ? OFFSET ?");
  const reservations = section("SELECT activity_id AS activityId,created_at AS createdAt FROM reservations WHERE user_id=? ORDER BY created_at,activity_id LIMIT ? OFFSET ?");
  const blocks = section("SELECT blocked_id AS blockedId FROM blocks WHERE user_id=? ORDER BY blocked_id LIMIT ? OFFSET ?");
  const invitations = section("SELECT id,note,status,origin_kind AS originKind,origin_id AS originId,created_at AS createdAt,updated_at AS updatedAt FROM plaza_connections WHERE sender_id=? ORDER BY created_at,id LIMIT ? OFFSET ?");
  const reports = section("SELECT id,kind,content_id AS contentId,reason,note,status,created_at AS createdAt FROM plaza_reports WHERE reporter_id=? ORDER BY created_at,id LIMIT ? OFFSET ?");
  const roomReports = section("SELECT id,room_id AS roomId,reason,note,status,created_at AS createdAt FROM reports WHERE reporter_id=? ORDER BY created_at,id LIMIT ? OFFSET ?");
  return { format: "nexafia-own-content-v1", page, generatedAt: new Date(now).toISOString(), scope: "Copia parcial del contenido propio conservado en el servidor.", omissions: ["Mensajes y datos de otras personas", "Archivos de imagen", "Decisiones internas y evidencia de moderación", "Datos guardados solo en este navegador", "Credenciales y suscripciones de dispositivos"], account, posts, replies, privateMessages, roomMessages, reservations, blocks, invitations, reports, roomReports };
}
