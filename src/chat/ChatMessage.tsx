import { ImageView } from "../media/ImageView";
import type { ImageRef } from "../media/types";
import { Avatar } from "../components";
import { getSticker } from "./stickers";
import { ReplyQuote, ReplyAction, SwipeReplyHint, useSwipeReply } from "./replies";
import type { ReplyTarget } from "./replies";
type Sender = { id: string; name: string; own: boolean; replyTo?: string };
export type ChatMessage = Sender &
  (
    | { type: "text"; text: string }
    | { type: "sticker"; stickerId: string }
    | { type: "image"; image: ImageRef }
  );
export function chatReplyTarget(message: ChatMessage): ReplyTarget {
  return {
    id: message.id,
    name: message.name,
    summary: message.type === "text" ? message.text.slice(0, 160)
      : message.type === "image" ? "Imagen"
      : `Sticker: ${getSticker(message.stickerId)?.label || "no disponible"}`,
  };
}
export function ChatMessageBubble({
  message,
  simulated = true,
  shared = false,
  removed = false,
  onReport,
  onReply,
  replyTarget,
}: {
  message: ChatMessage;
  simulated?: boolean;
  shared?: boolean;
  removed?: boolean;
  onReport?: () => void;
  onReply?: () => void;
  replyTarget?: ReplyTarget;
}) {
  const swipe = useSwipeReply(onReply);
  const sticker =
    message.type === "sticker" ? getSticker(message.stickerId) : undefined;
  return (
    <div
      {...swipe.handlers}
      style={swipe.style}
      className={`message replyable-message ${message.own ? "own" : ""} ${message.type === "sticker" ? "sticker-message" : ""}`}
      data-message-id={message.id}
      tabIndex={-1}
      role="group"
      aria-label={`Mensaje de ${message.own ? "ti" : message.name}`}
    >
      {onReply && <SwipeReplyHint />}
      <Avatar name={message.name} index={message.own ? 4 : 0} small />
      <div>
        <span>
          {message.own
            ? "Tú"
            : simulated
              ? `${message.name} · ficticia`
              : message.name}
        </span>
        {message.replyTo && <ReplyQuote target={replyTarget} />}
        {message.type === "text" ? (
          <p>{message.text}</p>
        ) : message.type === "image" ? (
          <ImageView
            image={message.image}
            shared={shared}
            removed={removed}
            onReport={onReport}
          />
        ) : sticker ? (
          <img
            className="sent-sticker"
            src={sticker.src}
            alt={`Sticker: ${sticker.label}`}
            width="150"
            height="143"
          />
        ) : (
          <p>Sticker no disponible</p>
        )}
        {onReply && <ReplyAction onReply={onReply} />}
        {onReport && message.type !== "image" && (
          <button className="message-report" onClick={onReport}>
            Reportar mensaje
          </button>
        )}
      </div>
    </div>
  );
}
