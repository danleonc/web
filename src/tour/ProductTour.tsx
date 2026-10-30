import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

const visitKey = "nexafia.tour.v1";
export function useProductTour() {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const [invitation, setInvitation] = useState(() => {
    try { return localStorage.getItem(visitKey) !== "seen"; }
    catch { return true; }
  });
  function dismiss() {
    setInvitation(false);
    try { localStorage.setItem(visitKey, "seen"); } catch { /* Optional preference. */ }
  }
  return {
    open, invitation, dismiss,
    start: () => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dismiss();
      setOpen(true);
    },
    close: () => {
      setOpen(false);
      requestAnimationFrame(() => {
        const source = opener.current;
        const visible = source?.isConnected && !source.closest("[inert]") && source.getBoundingClientRect().right > 0 && source.getClientRects().length > 0;
        const target = visible ? source : document.getElementById("main-content");
        target?.focus({ preventScroll: true });
      });
    },
  };
}
type TourPage = "plaza" | "connections" | "discover";
const steps: { target: string; page: TourPage; title: string; description: string }[] = [
  { target: "nav-plaza", page: "plaza", title: "La Plaza, tu punto de partida", description: "Pulsa La Plaza para entrar al espacio donde compartir ideas y responder a tu ritmo." },
  { target: "plaza-connections", page: "plaza", title: "De conversar a conectar", description: "Este acceso te lleva a Conexiones. Púlsalo para descubrir afinidades y dar continuidad a una conversación." },
  { target: "connections-invitations", page: "connections", title: "Tus invitaciones, con contexto", description: "Abre esta pestaña para revisar tus invitaciones. Continuar una conversación siempre requiere que ambos quieran." },
  { target: "nav-discover", page: "connections", title: "Vive algo en grupo", description: "Pulsa Encuentros para descubrir experiencias con horario, grupos pequeños y una guía opcional." },
  { target: "encounter-detail", page: "discover", title: "Mira una experiencia por dentro", description: "Pulsa esta convocatoria para ver su tema, horario y cupos. Abrir el detalle no reserva una plaza." },
];
type Spot = { x: number; y: number; width: number; height: number; left: number; top: number; vw: number; vh: number };
export function ProductTour({ onClose, onComplete, onNavigate }: {
  onClose: () => void;
  onComplete: () => void;
  onNavigate: (page: TourPage) => void;
}) {
  const [step, setStep] = useState(0);
  const [spot, setSpot] = useState<Spot | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLElement | null>(null);
  const callbacks = useRef({ onClose, onComplete });
  callbacks.current = { onClose, onComplete };
  const descriptionId = useId();
  useEffect(() => {
    let frame = 0;
    let current: HTMLElement | null = null;
    const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(n, high));
    const release = () => {
      if (!current) return;
      current.classList.remove("tour-highlighted");
      const remaining = (current.getAttribute("aria-describedby") || "").split(/\s+/).filter(id => id && id !== descriptionId).join(" ");
      if (remaining) current.setAttribute("aria-describedby", remaining);
      else current.removeAttribute("aria-describedby");
      observer.unobserve(current);
    };
    const measure = () => {
      const next = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${steps[step].target}"]`)).find(el => {
        const r = el.getBoundingClientRect();
        return !el.closest("[inert]") && r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
      });
      if (!next) { setSpot(null); return; }
      if (next !== current) {
        release();
        current = next;
        target.current = next;
        next.classList.add("tour-highlighted");
        next.setAttribute("aria-describedby", `${next.getAttribute("aria-describedby") || ""} ${descriptionId}`.trim());
        observer.observe(next);
        if (!next.closest(".sidebar, .mobile-spaces")) next.scrollIntoView({ block: "start", behavior: "instant" });
        next.focus({ preventScroll: true });
      }
      const r = next.getBoundingClientRect();
      const vw = innerWidth, vh = innerHeight;
      const pw = panel.current?.getBoundingClientRect().width || Math.min(340, vw - 24);
      const ph = panel.current?.getBoundingClientRect().height || 280;
      let left: number, top: number;
      if (r.right + 16 + pw <= vw - 12) { left = r.right + 16; top = clamp(r.top, 12, vh - ph - 12); }
      else if (r.left - 16 - pw >= 12) { left = r.left - 16 - pw; top = clamp(r.top, 12, vh - ph - 12); }
      else if (r.bottom + 16 + ph <= vh - 12) { left = clamp(r.left, 12, vw - pw - 12); top = r.bottom + 16; }
      else { left = clamp(r.left, 12, vw - pw - 12); top = clamp(r.top - ph - 16, 12, vh - ph - 12); }
      const x = clamp(r.left - 6, 0, vw), y = clamp(r.top - 6, 0, vh);
      setSpot({ x, y, width: Math.max(0, Math.min(vw, r.right + 6) - x), height: Math.max(0, Math.min(vh, r.bottom + 6) - y), left, top, vw, vh });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    if (panel.current) observer.observe(panel.current);
    const mutations = new MutationObserver(schedule);
    const main = document.getElementById("main-content");
    if (main) mutations.observe(main, { childList: true, subtree: true });
    const allowed = (node: EventTarget | null) => node instanceof Node && (current?.contains(node) || panel.current?.contains(node));
    const pointer = (event: PointerEvent) => { if (!allowed(event.target)) { event.preventDefault(); event.stopPropagation(); } };
    const click = (event: MouseEvent) => {
      if (!allowed(event.target)) { event.preventDefault(); event.stopPropagation(); return; }
      if (event.target instanceof Node && current?.contains(event.target)) {
        if (step === steps.length - 1) callbacks.current.onComplete();
        else setStep(step + 1);
      }
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); callbacks.current.onClose(); }
      if (event.key === "Tab") {
        const items = [current, ...Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") || [])].filter((el): el is HTMLElement => !!el);
        if (!items.length) return;
        event.preventDefault(); event.stopPropagation();
        const index = items.indexOf(document.activeElement as HTMLElement);
        items[(index + (event.shiftKey ? -1 : 1) + items.length) % items.length].focus({ preventScroll: true });
      }
    };
    schedule();
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      cancelAnimationFrame(frame); release(); target.current = null;
      observer.disconnect(); mutations.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, true);
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", keyboard, true);
    };
  }, [step, descriptionId]);
  const current = steps[step];
  return createPortal(<>
    {spot ? <>
      <div className="tour-shade" aria-hidden="true" style={{ left: 0, top: 0, width: spot.vw, height: spot.y }} />
      <div className="tour-shade" aria-hidden="true" style={{ left: 0, top: spot.y, width: spot.x, height: spot.height }} />
      <div className="tour-shade" aria-hidden="true" style={{ left: spot.x + spot.width, top: spot.y, width: spot.vw - spot.x - spot.width, height: spot.height }} />
      <div className="tour-shade" aria-hidden="true" style={{ left: 0, top: spot.y + spot.height, width: spot.vw, height: spot.vh - spot.y - spot.height }} />
      <div className="tour-spotlight" aria-hidden="true" style={{ left: spot.x, top: spot.y, width: spot.width, height: spot.height }} />
    </> : <div className="tour-shade tour-shade-full" aria-hidden="true" />}
    <div ref={panel} className="tour-coach" role="dialog" aria-modal="false" aria-label="Conoce Nexafia" style={spot ? { left: spot.left, top: spot.top } : { left: 12, top: 12 }}>
      <div className="tour-coach-header"><span>Conoce Nexafia</span><button className="icon-button" aria-label="Cerrar recorrido" onClick={onClose}><X size={20} /></button></div>
      <p className="tour-step-number">Paso {step + 1} de {steps.length}</p>
      <h2>{current.title}</h2>
      <p id={descriptionId} className="tour-description">{current.description}</p>
      {!spot && <p role="status" className="tour-unavailable">Buscando este acceso. Puedes volver al paso anterior o salir.</p>}
      <div className="tour-controls">
        <button className="button secondary" disabled={step === 0} onClick={() => { const previous = step - 1; setStep(previous); onNavigate(steps[previous].page); }}><ArrowLeft size={15} aria-hidden="true" />Anterior</button>
        <button className="button primary" disabled={!spot} onClick={() => target.current?.click()}>{step === steps.length - 1 ? "Ver detalle" : "Siguiente"}<ArrowRight size={15} aria-hidden="true" /></button>
      </div>
      <div className="tour-coach-footer"><button className="button text" onClick={onClose}>Salir del recorrido</button>{step === steps.length - 1 && <button className="button text" onClick={onComplete}>Terminar</button>}</div>
    </div>
  </>, document.body);
}
