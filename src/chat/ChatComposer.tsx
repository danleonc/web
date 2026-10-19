import { useId, useState } from "react";
import { Send, Sticker as StickerIcon } from "lucide-react";
import { StickerPicker } from "./StickerPicker";
import { getSticker } from "./stickers";
import type { StickerActions } from "./stickers";
export function ChatComposer({
  onSendText,
  onSendSticker,
  stickerPreferences,
  onToggleFavorite,
  onStickerUsed,
  onTypingChange,
  disabled = false,
}: StickerActions & {
  onSendText: (text: string) => void;
  onTypingChange?: (active: boolean) => void;
  disabled?: boolean;
  onSendSticker: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputId = useId();
  return (
    <>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled && draft.trim()) {
            onSendText(draft.trim());
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
      {pickerOpen && (
        <StickerPicker
          preferences={stickerPreferences}
          onToggleFavorite={onToggleFavorite}
          onClose={() => setPickerOpen(false)}
          onSend={(id) => {
            if (!disabled && getSticker(id)) {
              onSendSticker(id);
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
