import { useId, useState } from "react";
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
}: StickerActions & {
  onSendText: (text: string) => void | boolean;
  onTypingChange?: (active: boolean) => void;
  disabled?: boolean;
  onSendImage?: (image: ImageRef, blob: Blob) => Promise<boolean | void>;
  onSendSticker: (id: string) => void | boolean;
}) {
  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputId = useId();
  const [imageOpen, setImageOpen] = useState(false);
  return (
    <>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled && draft.trim()) {
            if (onSendText(draft.trim()) === false) return;
            setDraft("");
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
          id={inputId}
          maxLength={1000}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onTypingChange?.(!!e.target.value.trim());
          }}
          onBlur={() => onTypingChange?.(false)}
          disabled={disabled}
          placeholder="Un mensaje o un sticker, como prefieras…"
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
      {imageOpen && onSendImage && (
        <ImagePicker
          onClose={() => setImageOpen(false)}
          onChoose={async (image, blob) => {
            if (disabled)
              throw Error("La sala no está disponible para enviar imágenes.");
            return onSendImage(image, blob);
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
              if (onSendSticker(id) === false) return;
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
