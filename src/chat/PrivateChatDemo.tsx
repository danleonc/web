import { useEffect, useRef, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Modal } from "../components";
import { ChatComposer } from "./ChatComposer";
import { ChatMessageBubble } from "./ChatMessage";
import type { ChatMessage } from "./ChatMessage";
import type { StickerActions } from "./stickers";
export function PrivateChatDemo({
  alias,
  onClose,
  ...stickerActions
}: StickerActions & { alias: string; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
          {messages.map((message, i) => (
            <ChatMessageBubble key={i} message={message} />
          ))}
          <div ref={bottom} />
        </div>
        <ChatComposer
          {...stickerActions}
          onSendText={(text) =>
            setMessages((m) => [
              ...m,
              { type: "text", text, name: alias, own: true },
            ])
          }
          onSendSticker={(stickerId) =>
            setMessages((m) => [
              ...m,
              { type: "sticker", stickerId, name: alias, own: true },
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
