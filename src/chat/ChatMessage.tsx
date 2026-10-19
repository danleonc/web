import { Avatar } from "../components";
import { getSticker } from "./stickers";
type Sender = { name: string; own: boolean };
export type ChatMessage = Sender &
  ({ type: "text"; text: string } | { type: "sticker"; stickerId: string });
export function ChatMessageBubble({
  message,
  simulated = true,
}: {
  message: ChatMessage;
  simulated?: boolean;
}) {
  const sticker =
    message.type === "sticker" ? getSticker(message.stickerId) : undefined;
  return (
    <div
      className={`message ${message.own ? "own" : ""} ${message.type === "sticker" ? "sticker-message" : ""}`}
    >
      <Avatar name={message.name} index={message.own ? 4 : 0} small />
      <div>
        <span>
          {message.own
            ? "Tú"
            : simulated
              ? `${message.name} · ficticia`
              : message.name}
        </span>
        {message.type === "text" ? (
          <p>{message.text}</p>
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
      </div>
    </div>
  );
}
