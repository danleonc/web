import type { Dispatch, SetStateAction } from "react";
import type { LocalState } from "../store";
import type { PlazaState } from "../plaza/data";
import { seedPosts, seedComments, isPlazaPersonBlocked } from "../plaza/data";
import { availablePost, emptyNotifications, markThreadRead, receiveReply, toggleThread, trackParticipation, visibleNotices } from "./model";
import type { NotificationScope } from "./model";
export function noticeContext(state: LocalState) {
  return { posts: [...state.plaza.posts, ...seedPosts], comments: [...seedComments, ...state.plaza.comments], hidden: state.plaza.hidden, blocked: state.blocked };
}
export function useNotices(state: LocalState, setState: Dispatch<SetStateAction<LocalState>>, owner: string | null) {
  const scopeOf = (s: LocalState) => owner ? s.notifications[owner] || emptyNotifications : emptyNotifications;
  const write = (s: LocalState, scope: NotificationScope): LocalState => owner ? { ...s, notifications: Object.fromEntries([...Object.entries(s.notifications).filter(([id]) => id !== owner), [owner, scope]].slice(-8)) } : s;
  const change = (reduce: (scope: NotificationScope, s: LocalState) => NotificationScope) => setState(s => write(s, reduce(scopeOf(s), s)));
  const scope = scopeOf(state), context = noticeContext(state);
  const visible = visibleNotices(scope, context);
  const watched = scope.following.flatMap(id => { const post = availablePost(id, context); return post ? [post] : []; });
  function candidate(s: LocalState, current: NotificationScope) {
    const ctx = noticeContext(s);
    return ctx.comments.find(c => !c.own && !isPlazaPersonBlocked(c.author, ctx.blocked) && availablePost(c.postId, ctx) && !current.muted.includes(c.postId) && !current.items.some(item => item.postId === c.postId && item.commentId === c.id));
  }
  return {
    scope, visible, watched,
    unread: visible.filter(({ item }) => !item.read).length,
    canExample: !!owner && !!candidate(state, scope),
    toggle: (id: string) => change((value, s) => toggleThread(value, id, noticeContext(s))),
    readThread: (id: string) => change(value => markThreadRead(value, id)),
    readAll: () => change(value => ({ ...value, items: value.items.map(item => ({ ...item, read: true })) })),
    clear: () => change(value => ({ ...value, items: [] })),
    example: () => change((value, s) => {
      const comment = candidate(s, value); if (!comment) return value;
      const followed = value.following.includes(comment.postId) ? value : toggleThread(value, comment.postId, noticeContext(s));
      return receiveReply(followed, { postId: comment.postId, commentId: comment.id, createdAt: Date.now(), example: true }, noticeContext(s));
    }),
    updatePlaza: (plaza: PlazaState) => setState(s => {
      const next = { ...s, plaza };
      return write(next, trackParticipation(scopeOf(s), s.plaza, plaza, noticeContext(next)));
    }),
  };
}
