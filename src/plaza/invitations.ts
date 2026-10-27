import {
  isPlazaPersonBlocked,
  plazaPeople,
  plazaTopics,
  seedComments,
  seedPosts,
} from "./data";
import type { PlazaInvitation, PlazaPost } from "./data";

// Only explicit public sources identify an invitation; aliases are never identities.
export function normalizeInvitation(
  value: unknown,
  blocked: string[],
): PlazaInvitation | undefined {
  if (!value || typeof value !== "object") return;
  const v = value as Partial<PlazaInvitation>;
  const person = plazaPeople.find((p) => p.id === v.personId);
  if (
    !person ||
    isPlazaPersonBlocked(person.name, blocked) ||
    typeof v.postId !== "string" ||
    !v.postId.trim() ||
    v.postId.length > 80 ||
    typeof v.note !== "string" ||
    v.note.length > 180
  )
    return;
  if (
    v.commentId !== undefined &&
    !seedComments.some(
      (c) =>
        c.id === v.commentId &&
        !c.own &&
        c.personId === person.id &&
        c.postId === v.postId,
    )
  )
    return;
  return {
    personId: person.id,
    postId: v.postId,
    note: v.note.trim(),
    ...(v.commentId !== undefined ? { commentId: v.commentId } : {}),
  };
}

export function invitationSource(
  invitation: Pick<PlazaInvitation, "personId" | "postId" | "commentId">,
  posts: PlazaPost[] = [],
  blocked: string[] = [],
) {
  const post = [...posts, ...seedPosts].find(
    (p) =>
      p.id === invitation.postId &&
      (p.own || !isPlazaPersonBlocked(p.author, blocked)),
  );
  if (!post) return;
  const comment = invitation.commentId
    ? seedComments.find(
        (c) =>
          c.id === invitation.commentId &&
          c.postId === post.id &&
          c.personId === invitation.personId &&
          !c.own &&
          !isPlazaPersonBlocked(c.author, blocked),
      )
    : undefined;
  if (invitation.commentId && !comment) return;
  const topic = plazaTopics.find((t) => t.id === post.topic)!;
  return { post, comment, topic };
}
