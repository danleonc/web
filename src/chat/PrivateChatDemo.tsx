import { useEffect, useRef, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Modal } from "../components";
import { ChatComposer } from "./ChatComposer";
import { ChatMessageBubble, chatReplyTarget } from "./ChatMessage";
import type { ChatMessage } from "./ChatMessage";
import { useReplyTarget } from "./replies";
import type { StickerActions } from "./stickers";
export function PrivateChatDemo({
  alias,
  onClose,
  ...stickerActions
}: StickerActions & { alias: string; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const targets = messages.map(chatReplyTarget);
  const reply = useReplyTarget<HTMLInputElement>(targets, "private-demo");
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);
  return (
    <Modal title="Chat privado de prueba" wide onClose={onClose}>
      <div className="private-demo">
        <p className="inline-notice">
          <LockKeyhole size={17} /> Conversación individual simulada. No hay
          otra persona conectada, no se ha aceptado ninguna solicitud y nadie
          recibirá estos mensajes.
        </p>
        <div
          className="private-messages"
          aria-label="Mensajes del chat privado de prueba"
        >
          {!messages.length && (
            <div className="welcome-message">
              <h3>También hay cosas que se dicen con un sticker.</h3>
              <p>
                Prueba texto y stickers. Los mensajes desaparecen al cerrar este
                chat; tus favoritos y recientes quedan guardados en el
                navegador.
              </p>
            </div>
          )}
          {messages.map((message) => (
            <ChatMessageBubble key={message.id} message={message}
              onReply={() => reply.select(message.id)}
              replyTarget={targets.find((target) => target.id === message.replyTo)} />
          ))}
          <div ref={bottom} />
        </div>
        <ChatComposer
          {...stickerActions}
          inputRef={reply.inputRef}
          replyTarget={reply.target}
          onCancelReply={reply.clear}
          onSendText={(text, replyTo) =>
            setMessages((m) => [
              ...m,
              { id: crypto.randomUUID(), type: "text", text, name: alias, own: true, replyTo },
            ])
          }
          onSendSticker={(stickerId, replyTo) =>
            setMessages((m) => [
              ...m,
              { id: crypto.randomUUID(), type: "sticker", stickerId, name: alias, own: true, replyTo },
            ])
          }
        />
        <span className="composer-note">
          <LockKeyhole size={11} /> Prueba local · Sin envío ni guardado del
          contenido de la conversación
        </span>
      </div>
    </Modal>
  );
}
