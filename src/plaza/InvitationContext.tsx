import { MessageCircle } from "lucide-react";
import { invitationSource } from "./invitations";
export function InvitationContext({
  source,
}: {
  source: ReturnType<typeof invitationSource>;
}) {
  if (!source)
    return (
      <p className="small-text muted">
        La conversación de origen ya no está disponible.
      </p>
    );
  return (
    <div className="invitation-context">
      <span>
        <MessageCircle size={14} />
        {source.comment
          ? `Desde un comentario de ${source.comment.author}`
          : "Desde una conversación de La Plaza"}
      </span>
      <strong>{source.post.title}</strong>
      {source.comment && <blockquote>{source.comment.body}</blockquote>}
      <small>{source.topic.label}</small>
    </div>
  );
}
