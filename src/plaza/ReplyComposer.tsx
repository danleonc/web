import { useEffect, useRef, useState } from "react";
import {
  ImagePlus,
  Maximize2,
  Send,
  Sticker as StickerIcon,
  X,
} from "lucide-react";
import { Modal } from "../components";
import { ImagePicker } from "../media/ImagePicker";
import { PhotoFrame } from "../media/PhotoFrame";
import type { ImageRef } from "../media/types";
import { StickerPicker } from "../chat/StickerPicker";
import type { StickerActions } from "../chat/stickers";

export type ReplyContent = {
  body: string;
  image?: ImageRef;
  stickerId?: string;
};
export function ReplyComposer({
  onReply,
  ...stickers
}: StickerActions & {
  onReply: (reply: ReplyContent, blob?: Blob) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<{
    image: ImageRef;
    blob: Blob;
  } | null>(null);
  const [src, setSrc] = useState("");
  const [imagePicker, setImagePicker] = useState(false);
  const [stickerPicker, setStickerPicker] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!attachment) {
      setSrc("");
      return;
    }
    const url = URL.createObjectURL(attachment.blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);

  async function send(stickerId?: string) {
    if (sending.current || (!stickerId && !text.trim() && !attachment)) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      await onReply(
        stickerId
          ? { body: "", stickerId }
          : {
              body: text.trim(),
              image: attachment?.image,
            },
        stickerId ? undefined : attachment?.blob,
      );
      if (stickerId) {
        stickers.onStickerUsed(stickerId);
        setStickerPicker(false);
      } else {
        setText("");
        setAttachment(null);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo guardar tu respuesta. Inténtalo de nuevo.",
      );
      setStickerPicker(false);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <form
        className="thread-reply-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        aria-busy={busy}
      >
        <label className="field-label" htmlFor="plaza-reply">
          Tu respuesta de prueba{" "}
          <span>(texto opcional si adjuntas una imagen)</span>
        </label>
        <textarea
          id="plaza-reply"
          className="text-input"
          rows={3}
          maxLength={700}
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          placeholder="Me quedé pensando en…"
        />
        {attachment && src && (
          <div className="reply-image-draft">
            <button
              type="button"
              className="image-thumbnail"
              aria-label="Ver foto completa de mi respuesta"
              onClick={() => setExpanded(true)}
            >
              <PhotoFrame
                src={src}
                alt={
                  attachment.image.description ||
                  "Vista previa de la imagen de tu respuesta"
                }
              />
              <span>
                <Maximize2 size={13} /> Ver completa
              </span>
            </button>
            <div>
              <span>
                Una imagen · {Math.ceil(attachment.blob.size / 1024)} KB · lista
                para publicar
              </span>
              <button
                type="button"
                className="button text"
                disabled={busy}
                onClick={() => setAttachment(null)}
              >
                <X size={14} /> Quitar imagen
              </button>
            </div>
          </div>
        )}
        <p className="small-text muted reply-local-note">
          No hay otras personas conectadas a esta conversación. Una imagen por
          respuesta.
        </p>
        {error && (
          <p className="shared-error" role="alert">
            {error}
          </p>
        )}
        <div className="reply-compose-actions">
          <button
            type="button"
            className="sticker-trigger"
            aria-label="Abrir stickers"
            aria-haspopup="dialog"
            disabled={busy}
            onClick={() => setStickerPicker(true)}
          >
            <StickerIcon size={22} />
          </button>
          <button
            type="button"
            className="button secondary"
            aria-haspopup="dialog"
            disabled={busy}
            onClick={() => setImagePicker(true)}
          >
            <ImagePlus size={17} />
            {attachment ? "Cambiar imagen" : "Añadir una imagen"}
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={busy || (!text.trim() && !attachment)}
          >
            {busy ? "Guardando…" : "Guardar respuesta"}
            <Send size={15} />
          </button>
        </div>
      </form>
      {imagePicker && (
        <ImagePicker
          label="Adjuntar a mi respuesta"
          onClose={() => setImagePicker(false)}
          onChoose={async (image, blob) => {
            setAttachment({ image, blob });
            setError("");
          }}
        />
      )}
      {expanded && attachment && src && (
        <Modal title="Tu foto completa" wide onClose={() => setExpanded(false)}>
          <div className="modal-content expanded-image">
            <img
              src={src}
              alt={
                attachment.image.description || "Tu foto completa, sin recorte"
              }
            />
          </div>
        </Modal>
      )}
      {stickerPicker && (
        <StickerPicker
          preferences={stickers.stickerPreferences}
          onToggleFavorite={stickers.onToggleFavorite}
          onToggleFavoritePack={stickers.onToggleFavoritePack}
          onClose={() => setStickerPicker(false)}
          onSend={(id) => void send(id)}
        />
      )}
    </>
  );
}
