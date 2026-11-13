import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Bell, BellOff } from "lucide-react";
import { Modal } from "../components";

type Notice = { id: string; kind: "reply" | "message"; targetId: string; title: string; actor: string; readAt: number | null };
type Mute = { kind: "post" | "connection"; targetId: string };
export function useRealNotices(accountId: string | null) {
  const currentAccount = useRef(accountId); currentAccount.current = accountId;
  const [items, setItems] = useState<Notice[]>([]); const [unread, setUnread] = useState(0); const [mutes, setMutes] = useState<Mute[]>([]); const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!accountId) return;
    const r = await fetch("/api/plaza/notifications", { credentials: "same-origin" });
    if (!r.ok) throw Error("No pudimos actualizar las notificaciones.");
    const result = await r.json(); if (currentAccount.current !== accountId) return; setItems(result.items); setUnread(result.unread); setMutes(result.mutes); setError("");
  }, [accountId]);
  useEffect(() => {
    let stopped = false; setItems([]); setUnread(0); setMutes([]);
    if (!accountId) return;
    const update = () => { if (!stopped && document.visibilityState === "visible") void refresh().catch(() => { if (!stopped) setError("No pudimos actualizar las notificaciones."); }); };
    update(); const timer = window.setInterval(update, 10000); document.addEventListener("visibilitychange", update);
    return () => { stopped = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, [accountId, refresh]);
  const post = async (path: string, body: object) => { const r = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (!r.ok) throw Error("No pudimos guardar el cambio."); await refresh(); };
  return { items, unread, mutes, error, refresh, read: (id: string) => post("/api/plaza/notifications/read", { id }), mute: (kind: Mute["kind"], targetId: string, muted: boolean) => post("/api/plaza/notifications/mute", { kind, targetId, muted }) };
}
export function RealNoticeCenter({ notices, signedIn, onClose, onAccess, onOpen, children }: { children?: ReactNode; notices: ReturnType<typeof useRealNotices>; signedIn: boolean; onClose: () => void; onAccess: () => void; onOpen: (kind: Notice["kind"], id: string) => void }) {
  const [error, setError] = useState("");
  return <Modal title="Notificaciones" wide onClose={onClose}><div className="notice-center">
    {!signedIn ? <div className="notice-empty"><p>Entra a tu cuenta para ver tus avisos.</p><button className="button primary" onClick={onAccess}>Entrar</button></div> : <>
      <p className="notice-scope">Aquí aparecen respuestas a tus conversaciones y mensajes privados.</p>
      {(error || notices.error) && <p role="alert">{error || notices.error}</p>}
      {notices.items.length ? <ul className="notice-list">{notices.items.map(item => { const kind = item.kind === "reply" ? "post" : "connection"; const muted = notices.mutes.some(m => m.kind === kind && m.targetId === item.targetId); return <li key={item.id} className={item.readAt ? "" : "notice-unread"}>
        <button className="notice-open" onClick={() => { void notices.read(item.id).then(() => onOpen(item.kind, item.targetId)).catch(() => setError("No pudimos abrir el aviso. Inténtalo de nuevo.")); }}><span className="notice-kind">{item.kind === "reply" ? "Nueva respuesta" : "Nuevo mensaje"}{!item.readAt && <span className="notice-dot" aria-label="Sin leer" />}</span><strong>{item.title}</strong><span>{item.actor} {item.kind === "reply" ? "respondió una conversación" : "te envió un mensaje"}.</span><span className="notice-link">Ver conversación →</span></button>
        <button className="button text" onClick={() => void notices.mute(kind, item.targetId, !muted).catch(() => setError("No pudimos guardar tu preferencia."))}>{muted ? <Bell size={15} /> : <BellOff size={15} />}{muted ? "Reactivar" : "Silenciar"}</button>
      </li>; })}</ul> : <div className="notice-empty"><Bell size={25}/><p>Aún no tienes avisos.</p></div>}
    </>}
    {children}
  </div></Modal>;
}
