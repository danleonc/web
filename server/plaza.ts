import { randomUUID } from "node:crypto";
import type { Storage } from "./storage.ts";
import { Notifications } from "./notifications.ts";
import { validSticker } from "./stickers.ts";

type PostInput = { topic: string; title: string; body: string; stickerId?: string };
const topics = new Set(["cultura", "crear", "cotidiano"]);
function clean(value: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error("Contenido no válido");
  return value.trim();
}
function postValues(value: PostInput) {
  if (!value || !topics.has(value.topic)) throw new Error("Tema no válido");
  if (value.stickerId && !validSticker(value.stickerId)) throw new Error("Sticker no válido");
  return { topic: value.topic, title: clean(value.title, 160), body: value.stickerId && !value.body.trim() ? "" : clean(value.body, 5000), stickerId: value.stickerId || null };
}
export class PlazaStore {
  private storage: Storage;
  constructor(storage: Storage) { this.storage = storage; }
  private blocked(first: string, second: string) {
    return !!this.storage.db.prepare("SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=?) OR (user_id=? AND blocked_id=?)").get(first, second, second, first);
  }
  blockTarget(userId: string, kind: string, contentId: string) {
    if (!/^[a-f0-9-]{36}$/.test(contentId) || !["post", "reply"].includes(kind)) throw Error("invalid_target");
    const db = this.storage.db;
    const content = kind === "post"
      ? db.prepare("SELECT author_id AS authorId,author_id AS postAuthor FROM plaza_posts WHERE id=? AND hidden=0").get(contentId)
      : db.prepare("SELECT r.author_id AS authorId,p.author_id AS postAuthor FROM plaza_replies r JOIN plaza_posts p ON p.id=r.post_id WHERE r.id=? AND r.hidden=0 AND p.hidden=0").get(contentId);
    if (!content || content.authorId === userId || this.blocked(userId, String(content.authorId)) || this.blocked(userId, String(content.postAuthor))) throw Error("invalid_target");
    return String(content.authorId);
  }
  createPost(userId: string, value: PostInput, now: number) {
    const post = { id: randomUUID(), ...postValues(value) };
    this.storage.db.prepare("INSERT INTO plaza_posts(id,author_id,topic,title,body,created_at,sticker_id) VALUES(?,?,?,?,?,?,?)").run(post.id, userId, post.topic, post.title, post.body, now, post.stickerId);
    return post;
  }
  editPost(userId: string, id: string, value: PostInput) {
    const post = postValues(value);
    return this.storage.db.prepare("UPDATE plaza_posts SET topic=?, title=?, body=? WHERE id=? AND author_id=? AND hidden=0").run(post.topic, post.title, post.body, id, userId).changes === 1;
  }
  deletePost(userId: string, id: string) {
    return this.storage.db.prepare("DELETE FROM plaza_posts WHERE id=? AND author_id=?").run(id, userId).changes === 1;
  }
  createReply(userId: string, postId: string, value: string, now: number, stickerId = "") {
    if (stickerId && !validSticker(stickerId)) throw Error("invalid_sticker");
    const body = stickerId && !value.trim() ? "" : clean(value, 5000);
    const post = this.storage.db.prepare("SELECT author_id FROM plaza_posts WHERE id=? AND hidden=0").get(postId);
    if (!post || this.blocked(userId, String(post.author_id))) throw new Error("Publicación no disponible");
    const id = randomUUID();
    this.storage.transaction(() => {
      this.storage.db.prepare("INSERT INTO plaza_replies(id,post_id,author_id,body,created_at,sticker_id) VALUES(?,?,?,?,?,?)").run(id, postId, userId, body, now, stickerId || null);
      new Notifications(this.storage, () => now).reply(postId, id, userId);
    });
    return { id, postId, body };
  }
  deleteReply(userId: string, id: string) {
    return this.storage.db.prepare("DELETE FROM plaza_replies WHERE id=? AND author_id=?").run(id, userId).changes === 1;
  }
  editReply(userId: string, id: string, value: string) {
    return this.storage.db.prepare("UPDATE plaza_replies SET body=? WHERE id=? AND author_id=? AND hidden=0 AND EXISTS (SELECT 1 FROM plaza_posts p WHERE p.id=plaza_replies.post_id AND p.hidden=0)").run(clean(value, 5000), id, userId).changes === 1;
  }
  listPosts(userId: string) {
    return this.storage.db.prepare(`SELECT p.id,p.topic,p.title,p.body,p.sticker_id AS stickerId,(SELECT id FROM plaza_images i WHERE i.post_id=p.id) AS imageId,(SELECT description FROM plaza_images i WHERE i.post_id=p.id) AS imageDescription,p.author_id AS authorId,a.alias AS author,p.created_at AS createdAt
      FROM plaza_posts p JOIN accounts a ON a.id=p.author_id
      WHERE p.hidden=0 AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=p.author_id) OR (b.user_id=p.author_id AND b.blocked_id=?))
      ORDER BY p.created_at DESC,p.id DESC LIMIT 100`).all(userId, userId);
  }
  listReplies(userId: string, postId: string) {
    return this.storage.db.prepare(`SELECT r.id,r.post_id AS postId,r.body,r.sticker_id AS stickerId,(SELECT id FROM plaza_images i WHERE i.reply_id=r.id) AS imageId,(SELECT description FROM plaza_images i WHERE i.reply_id=r.id) AS imageDescription,r.author_id AS authorId,a.alias AS author,r.created_at AS createdAt
      FROM plaza_replies r JOIN plaza_posts p ON p.id=r.post_id JOIN accounts a ON a.id=r.author_id
      WHERE r.post_id=? AND p.hidden=0 AND r.hidden=0 AND NOT EXISTS (SELECT 1 FROM blocks b WHERE
        (b.user_id=? AND b.blocked_id IN (p.author_id,r.author_id)) OR
        (b.blocked_id=? AND b.user_id IN (p.author_id,r.author_id)))
      ORDER BY r.created_at,r.id LIMIT 100`).all(postId, userId, userId);
  }
}
