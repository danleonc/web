import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, RefObject, ReactNode, Ref } from "react";
import { Reply, X } from "lucide-react";

export type ReplyTarget = { id: string; name: string; summary: string };

export function useReplyTarget<T extends HTMLInputElement | HTMLTextAreaElement>(
  targets: ReplyTarget[],
  scope: string,
  enabled = true,
) {
  const [selection, setSelection] = useState<{ id: string; scope: string } | null>(null);
  const inputRef = useRef<T>(null);
  const target = enabled && selection?.scope === scope
    ? targets.find((m) => m.id === selection.id)
    : undefined;
  useEffect(() => {
    if (!target) setSelection(null);
  }, [target?.id, scope, enabled]);
  return {
    target,
    inputRef,
    select: (id: string) => {
      if (!enabled || !targets.some((m) => m.id === id)) return;
      setSelection({ id, scope });
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.scrollIntoView({ block: "nearest" });
    },
    clear: (id?: string) => setSelection((current) => !id || current?.id === id ? null : current),
  };
}

export function jumpToOriginal(from: HTMLElement, id: string) {
  const list = from.closest(".messages, .private-messages, .plaza-replies");
  const original = [...(list?.querySelectorAll<HTMLElement>("[data-message-id]") || [])]
    .find((node) => node.dataset.messageId === id);
  if (!original) return;
  original.focus({ preventScroll: true });
  original.scrollIntoView({ block: "center", behavior: "auto" });
}

export function ReplyQuote({ target }: { target?: ReplyTarget }) {
  const descriptionId = useId();
  return target ? (
    <button type="button" className="reply-quote"
      aria-label={`Ver mensaje original de ${target.name}`}
      aria-describedby={descriptionId}
      onClick={(e) => jumpToOriginal(e.currentTarget, target.id)}>
      <strong>{target.name}</strong>
      <small id={descriptionId}>{target.summary}</small>
    </button>
  ) : <div className="reply-quote reply-unavailable">Mensaje original no disponible</div>;
}

export function ReplyDraft({ target, onCancel, disabled = false }: {
  target: ReplyTarget; onCancel: () => void; disabled?: boolean;
}) {
  return <div className="reply-draft" role="group" aria-label={`Respondiendo a ${target.name}`}>
    <div role="status"><strong>Respondiendo a {target.name}</strong><small>{target.summary}</small></div>
    <button type="button" aria-label="Cancelar respuesta citada" disabled={disabled} onClick={onCancel}><X size={18} /></button>
  </div>;
}

// Touch-only horizontal intent; vertical scrolling and browser-edge navigation win.
export function useSwipeReply(onReply?: () => void) {
  const start = useRef<{ id: number; x: number; y: number; dx: number; locked: boolean } | null>(null);
  const consumeClick = useRef(false);
  const [offset, setOffset] = useState(0);
  const reset = () => { start.current = null; setOffset(0); };
  return {
    style: { "--reply-drag": `${offset}px`, "--reply-progress": offset / 56 } as CSSProperties,
    handlers: {
      onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
        consumeClick.current = false;
        if (!e.isPrimary) { reset(); return; }
        const control = (e.target as HTMLElement).closest("button, input, textarea, a, summary");
        if (!onReply || e.pointerType === "mouse" || e.clientX < 24 ||
          (control && !control.matches(".image-thumbnail")) ||
          window.getSelection()?.toString()) return;
        start.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, locked: false };
      },
      onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
        const p = start.current;
        if (!p || p.id !== e.pointerId) return;
        const dx = e.clientX - p.x, dy = Math.abs(e.clientY - p.y);
        if (!p.locked) {
          if (dy > 8 && dy >= Math.abs(dx)) { reset(); return; }
          if (dx < -8) { reset(); return; }
          if (dx < 10 || dx < dy * 1.5) return;
          p.locked = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        p.dx = dy > Math.abs(dx) ? 0 : Math.max(0, dx);
        setOffset(Math.min(64, p.dx));
      },
      onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
        const p = start.current;
        const trigger = p?.id === e.pointerId && p.locked && p.dx >= 56;
        reset();
        if (trigger) { consumeClick.current = true; onReply?.(); }
      },
      onClickCapture: (e: React.MouseEvent<HTMLDivElement>) => {
        if (consumeClick.current && e.detail > 0) { e.preventDefault(); e.stopPropagation(); }
        consumeClick.current = false;
      },
      onPointerCancel: reset,
      onLostPointerCapture: (e: React.PointerEvent<HTMLDivElement>) => {
        // Touch starts with implicit capture on the paragraph/image. Its lost
        // event bubbles when capture moves to this container; keep that drag.
        if (e.target === e.currentTarget) reset();
      },
    },
  };
}

export function ReplyAction({ onReply }: { onReply: () => void }) {
  return <button type="button" className="message-reply-action" onClick={onReply}>
    <Reply size={16} /> Responder
  </button>;
}

export function SwipeReplyHint() {
  return <span className="swipe-reply-hint" aria-hidden="true"><Reply size={20} /></span>;
}

export function ReplyContainer({ id, label, className, onReply, originRef, children }: {
  id: string; label: string; className: string; onReply?: () => void;
  originRef?: Ref<HTMLDivElement>; children: ReactNode;
}) {
  const swipe = useSwipeReply(onReply);
  return <div {...swipe.handlers} style={swipe.style}
    className={`${className} replyable-message`} data-message-id={id}
    tabIndex={-1} role="group" aria-label={label} ref={originRef}>
    {onReply && <SwipeReplyHint />}{children}
  </div>;
}

export type ReplyInputRef = RefObject<HTMLInputElement | null>;

export function ReplyHelp() {
  return <p className="reply-help">Para citar un mensaje, toca Responder.<span> También puedes deslizarlo hacia la derecha.</span></p>;
}
