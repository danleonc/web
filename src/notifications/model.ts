import { isPlazaPersonBlocked } from "../plaza/data.ts";
import type { PlazaPost, PlazaComment, PlazaState } from "../plaza/data";
export type Notice = { postId: string; commentId: string; createdAt: number; read: boolean; example: boolean };
export type NotificationScope = { following: string[]; muted: string[]; items: Notice[] };
export type NoticeContext = { posts: PlazaPost[]; comments: PlazaComment[]; hidden: string[]; blocked: string[] };
export const emptyNotifications: NotificationScope = { following: [], muted: [], items: [] };
const reference = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 80 && !/[\u0000-\u001f]/.test(v);
const ids = (v: unknown) => Array.isArray(v) ? [...new Set(v.filter(reference))].slice(-100) : [];
export function loadNotificationScopes(value: unknown): Record<string, NotificationScope> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([owner]) => owner === "prototype" || /^account:[\w-]{1,100}$/.test(owner)).slice(-8).flatMap(([owner, raw]) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const v = raw as Partial<NotificationScope>;
    const following = ids(v.following), muted = ids(v.muted).filter(id => following.includes(id));
    const seen = new Set<string>();
    const items: Notice[] = (Array.isArray(v.items) ? v.items : []).flatMap(item => {
      if (!item || !reference(item.postId) || !reference(item.commentId) || !following.includes(item.postId) || !Number.isSafeInteger(item.createdAt) || item.createdAt <= 0 || typeof item.read !== "boolean" || typeof item.example !== "boolean") return [];
      const key = `${item.postId}/${item.commentId}`;
      if (seen.has(key)) return []; seen.add(key);
      return [{ postId: item.postId, commentId: item.commentId, createdAt: item.createdAt, read: item.read || muted.includes(item.postId), example: item.example }];
    }).slice(0, 50);
    return [[owner, { following, muted, items }]];
  }));
}
export function availablePost(id: string, context: NoticeContext) {
  return context.posts.find(post => post.id === id && !context.hidden.includes(id) && (post.own || !isPlazaPersonBlocked(post.author, context.blocked)));
}
export function visibleNotices(state: NotificationScope, context: NoticeContext) {
  return state.items.flatMap(item => {
    const post = availablePost(item.postId, context);
    const comment = context.comments.find(c => c.id === item.commentId && c.postId === item.postId && !c.own && !isPlazaPersonBlocked(c.author, context.blocked));
    return post && comment && state.following.includes(post.id) ? [{ item: { ...item, read: item.read || state.muted.includes(post.id) }, post, comment }] : [];
  });
}
export function markThreadRead(state: NotificationScope, postId: string): NotificationScope {
  return { ...state, items: state.items.map(item => item.postId === postId ? { ...item, read: true } : item) };
}
export function toggleThread(state: NotificationScope, postId: string, context: NoticeContext): NotificationScope {
  if (!availablePost(postId, context)) return state;
  if (!state.following.includes(postId)) return { ...state, following: [...state.following, postId].slice(-100) };
  if (state.muted.includes(postId)) return { ...state, muted: state.muted.filter(id => id !== postId) };
  return { ...markThreadRead(state, postId), muted: [...state.muted, postId].slice(-100) };
}
export function trackParticipation(state: NotificationScope, before: PlazaState, after: PlazaState, context: NoticeContext): NotificationScope {
  const previousPosts = new Set(before.posts.map(post => post.id)), previousComments = new Set(before.comments.map(c => c.id));
  const additions = [...after.posts.filter(post => post.own && !previousPosts.has(post.id)).map(post => post.id), ...after.comments.filter(c => c.own && !previousComments.has(c.id)).map(c => c.postId)].filter(id => availablePost(id, context));
  const existing = new Set(context.posts.map(post => post.id));
  const following = [...new Set([...state.following, ...additions])].filter(id => existing.has(id)).slice(-100);
  return { following, muted: state.muted.filter(id => following.includes(id)), items: state.items.filter(item => following.includes(item.postId) && context.comments.some(c => c.id === item.commentId && c.postId === item.postId)) };
}
export function receiveReply(state: NotificationScope, event: Omit<Notice, "read">, context: NoticeContext): NotificationScope {
  if (typeof event.example !== "boolean" || !reference(event.postId) || !reference(event.commentId) || !Number.isSafeInteger(event.createdAt) || event.createdAt <= 0 || !state.following.includes(event.postId) || state.muted.includes(event.postId) || !availablePost(event.postId, context)) return state;
  const comment = context.comments.find(c => c.id === event.commentId && c.postId === event.postId && !c.own && !isPlazaPersonBlocked(c.author, context.blocked));
  if (!comment || state.items.some(item => item.postId === event.postId && item.commentId === event.commentId)) return state;
  return { ...state, items: [{ postId: event.postId, commentId: event.commentId, createdAt: event.createdAt, example: event.example, read: false }, ...state.items].slice(0, 50) };
}
