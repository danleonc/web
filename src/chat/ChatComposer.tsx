import { useId, useState } from "react";
import { ReplyDraft, ReplyHelp } from "./replies";
import type { ReplyInputRef, ReplyTarget } from "./replies";
import { ImagePicker } from "../media/ImagePicker";
import type { ImageRef } from "../media/types";
import { ImagePlus, Send, Sticker as StickerIcon } from "lucide-react";
import { StickerPicker } from "./StickerPicker";
import { getSticker } from "./stickers";
import type { StickerActions } from "./stickers";
export function ChatComposer({
  onSendText,
  onSendSticker,
  stickerPreferences,
  onToggleFavorite,
  onToggleFavoritePack,
  onStickerUsed,
  onTypingChange,
  onSendImage,
  disabled = false,
  replyTarget,
  onCancelReply,
  inputRef,
}: StickerActions & {
  onSendText: (text: string, replyTo?: string) => void | boolean;
  onTypingChange?: (active: boolean) => void;
  disabled?: boolean;
  onSendImage?: (image: ImageRef, blob: Blob, replyTo?: string) => Promise<boolean | void>;
  onSendSticker: (id: string, replyTo?: string) => void | boolean;
  replyTarget?: ReplyTarget;
  onCancelReply?: (id?: string) => void;
  inputRef?: ReplyInputRef;
}) {
  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputId = useId();
  const [imageOpen, setImageOpen] = useState(false);
  return (
    <>
      {replyTarget && <ReplyDraft target={replyTarget} onCancel={() => onCancelReply?.()} disabled={disabled} />}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled && draft.trim()) {
            if (onSendText(draft.trim(), replyTarget?.id) === false) return;
            setDraft("");
            if (replyTarget) onCancelReply?.(replyTarget.id);
            onTypingChange?.(false);
          }
        }}
      >
        <button
          type="button"
          className="sticker-trigger"
          aria-label="Abrir stickers"
          disabled={disabled}
          aria-haspopup="dialog"
          onClick={() => setPickerOpen(true)}
        >
          <StickerIcon size={22} />
          <span className="sr-only">Stickers</span>
        </button>
        {onSendImage && (
          <button
            type="button"
            className="sticker-trigger"
            aria-label="Adjuntar imagen"
            disabled={disabled}
            onClick={() => setImageOpen(true)}
          >
            <ImagePlus size={22} />
          </button>
        )}
        <label className="sr-only" htmlFor={inputId}>
          Tu mensaje de prueba
        </label>
        <input
          ref={inputRef}
          id={inputId}
          maxLength={1000}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onTypingChange?.(!!e.target.value.trim());
          }}
          onBlur={() => onTypingChange?.(false)}
          disabled={disabled}
          placeholder="Escribe un mensaje…"
          autoComplete="off"
        />
        <button
          type="submit"
          className="send-button"
          disabled={disabled || !draft.trim()}
          aria-label="Enviar mensaje de prueba"
        >
          <Send size={18} />
        </button>
      </form>
      <ReplyHelp />
      {imageOpen && onSendImage && (
        <ImagePicker
          onClose={() => setImageOpen(false)}
          onChoose={async (image, blob) => {
            if (disabled)
              throw Error("La sala no está disponible para enviar imágenes.");
            const result = await onSendImage(image, blob, replyTarget?.id);
            if (result === false) throw Error("No se pudo enviar la imagen. Conserva la respuesta e inténtalo de nuevo.");
            if (replyTarget) onCancelReply?.(replyTarget.id);
            return result;
          }}
        />
      )}
      {pickerOpen && (
        <StickerPicker
          preferences={stickerPreferences}
          onToggleFavorite={onToggleFavorite}
          onToggleFavoritePack={onToggleFavoritePack}
          onClose={() => setPickerOpen(false)}
          onSend={(id) => {
            if (!disabled && getSticker(id)) {
              if (onSendSticker(id, replyTarget?.id) === false) return;
              if (replyTarget) onCancelReply?.(replyTarget.id);
              onStickerUsed(id);
              onTypingChange?.(false);
              setPickerOpen(false);
            }
          }}
        />
      )}
    </>
  );
}
