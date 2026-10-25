import { useEffect, useRef, useId } from "react";
import type { ReactNode } from "react";
import { ArrowRight, X } from "lucide-react";
export function Logo() {
  return (
    <span className="brand">
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path
          d="M20 20C3 20 2 4 12 4c7 0 8 9 8 16Zm0 0c0-17 16-18 16-8 0 7-9 8-16 8Zm0 0c17 0 18 16 8 16-7 0-8-9-8-16Zm0 0c0 17-16 18-16 8 0-7 9-8 16-8Z"
          fill="currentColor"
        />
        <circle cx="20" cy="20" r="4" fill="#F7E8D0" />
      </svg>
      afinia<span className="brand-dot">.</span>
    </span>
  );
}
export function Avatar({
  name,
  index = 0,
  small = false,
}: {
  name: string;
  index?: number;
  small?: boolean;
}) {
  return (
    <span
      className={`avatar tone-${index % 5} ${small ? "small" : ""}`}
      aria-label={name}
    >
      {name.slice(0, 1)}
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  initialFocus,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  initialFocus?: string;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previousFocus = document.activeElement;
    dialog.showModal();
    if (initialFocus)
      dialog
        .querySelector<HTMLElement>(initialFocus)
        ?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby={titleId}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Cerrar ventana"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Empty({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="button primary" onClick={onAction}>
        {action}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
