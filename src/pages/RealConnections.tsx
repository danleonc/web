import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { AccountView } from "../shared/accounts";
import { HeroPhoto } from "../HeroPhoto";
import { connectionsHeroPhoto } from "../heroPhotos";
import { ReportDialog } from "../safety/ReportDialog";
import "./RealPlaza.css";

type Connection = { id: string; senderId: string; recipientId: string; person: string; note: string; status: string };
type Message = { id: string; senderId: string; body: string };
async function api<T>(path: string, data?: object): Promise<T> {
  const response = await fetch(path, { method: data ? "POST" : "GET", credentials: "same-origin", headers: data ? { "Content-Type": "application/json" } : undefined, body: data ? JSON.stringify(data) : undefined });
  if (!response.ok) throw Error("No pudimos completar la acción. Actualiza e inténtalo de nuevo.");
  return response.json() as Promise<T>;
}
export function RealConnections({ account, loaded, onAccess, onPlaza }: { account: AccountView | null; loaded: boolean; onAccess: () => void; onPlaza: () => void }) {
  const [connections, setConnections] = useState<Connection[]>([]); const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]); const [draft, setDraft] = useState("");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const pending = useRef<{ id: string; body: string; connection: string } | null>(null); const requestVersion = useRef(0);
  const ready = !!account?.canParticipate;
  const refresh = useCallback(async () => { setConnections((await api<{ connections: Connection[] }>("/api/plaza/connections")).connections); }, []);
  useEffect(() => { let cancelled = false; if (!ready) return; setLoading(true); api<{ connections: Connection[] }>("/api/plaza/connections").then((result) => { if (!cancelled) setConnections(result.connections); }).catch(() => { if (!cancelled) setError("No pudimos cargar tus conexiones."); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [ready]);
  useEffect(() => {
    if (!ready || busy) return;
    let cancelled = false; let timer: ReturnType<typeof setTimeout>;
    const update = async () => {
      if (document.visibilityState !== "visible") { timer = setTimeout(update, 4000); return; }
      const version = requestVersion.current;
      try {
        const result = await api<{ connections: Connection[] }>("/api/plaza/connections");
        if (cancelled || version !== requestVersion.current) return;
        setConnections(result.connections);
        if (selected && !result.connections.some((item) => item.id === selected && item.status === "accepted")) {
          requestVersion.current++; setSelected(null); setMessages([]); setReport(null); setNotice("Esta conexión ya no está disponible.");
        } else if (selected) {
          const current = await api<{ messages: Message[] }>(`/api/plaza/connections/${selected}/messages`);
          if (!cancelled && version === requestVersion.current) setMessages(current.messages);
        }
      } catch { /* La próxima actualización volverá a intentarlo. */ }
      finally { if (!cancelled) timer = setTimeout(update, 4000); }
    };
    timer = setTimeout(update, 4000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [ready, busy, selected, account?.id]);
  async function decision(id: string, action: string) { if (busy) return; setBusy(true); setError(""); try { await api(`/api/plaza/invitations/${id}/decision`, { action }); if (selected === id) { requestVersion.current++; setSelected(null); setMessages([]); } await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo actualizar."); } finally { setBusy(false); } }
  async function open(id: string) { const version = ++requestVersion.current; setSelected(id); setMessages([]); setDraft(""); setError(""); try { const result = await api<{ messages: Message[] }>(`/api/plaza/connections/${id}/messages`); if (version === requestVersion.current) setMessages(result.messages); } catch { if (version === requestVersion.current) setError("No pudimos cargar la conversación."); } }
  async function send(e: FormEvent) { e.preventDefault(); if (!selected || busy || !draft.trim()) return; requestVersion.current++; setBusy(true); setError(""); setNotice(""); const text = draft.trim();
    if (!pending.current || pending.current.body !== text || pending.current.connection !== selected) pending.current = { id: crypto.randomUUID(), body: text, connection: selected };
    try { await api(`/api/plaza/connections/${selected}/messages`, { clientId: pending.current.id, body: text }); pending.current = null; setDraft(""); try { setMessages((await api<{ messages: Message[] }>(`/api/plaza/connections/${selected}/messages`)).messages); } catch { setNotice("El mensaje se envió, pero no pudimos actualizar la conversación. Vuelve a abrirla."); } }
    catch (e) { setError(e instanceof Error ? e.message : "No pudimos enviar el mensaje."); } finally { setBusy(false); }
  }
  async function block(id: string) {
    if (busy || !window.confirm("¿Bloquear a esta persona? Se cerrará la conexión y saldrás de cualquier encuentro activo.")) return;
    setBusy(true); setError("");
    try { await api(`/api/plaza/connections/${id}/block`, {}); requestVersion.current++; setSelected(null); setMessages([]); setConnections((previous) => previous.filter((c) => c.id !== id)); setNotice("La persona quedó bloqueada y la conexión se cerró."); }
    catch (e) { setError(e instanceof Error ? e.message : "No pudimos bloquear a esta persona."); }
    finally { setBusy(false); }
  }
  const active = connections.find((c) => c.id === selected && c.status === "accepted");
  return <div className="page-content plaza-page real-plaza">
    <section className="plaza-welcome plaza-photo-hero"><div className="plaza-welcome-copy"><h1>Conexiones que siguen a tu ritmo.</h1><p>Revisa tus solicitudes y decide con quién continuar conversando.</p></div><HeroPhoto images={connectionsHeroPhoto} alt="Personas conversando desde sus propios espacios" /></section>
    {!loaded ? <p role="status">Cargando tu sesión…</p> : !ready ? <section className="real-plaza-panel"><h2>Entra a tus conexiones</h2><p>Inicia sesión y confirma tu correo para participar.</p><button className="button primary" onClick={onAccess}>Entrar a mi cuenta</button></section> : <>
      {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      <section className="real-plaza-panel"><h2>Tus solicitudes y conexiones</h2><button className="button secondary" disabled={busy} onClick={() => void refresh().catch(() => setError("No pudimos actualizar tus conexiones."))}>Actualizar conexiones</button>
        {loading ? <p role="status">Cargando conexiones…</p> : connections.length === 0 ? <><p>Aún no tienes conexiones. Puedes conocer conversaciones en La Plaza.</p><button className="button text" onClick={onPlaza}>Ir a La Plaza</button></> : connections.map((c) => <article className="real-plaza-post" key={c.id}><h3>{c.person}</h3><p>{c.note}</p>
          {c.status === "pending" && c.senderId === account?.id && <><p>Esperando respuesta</p><button className="button text" disabled={busy} onClick={() => void decision(c.id, "withdraw")}>Retirar solicitud</button></>}
          {c.status === "pending" && c.recipientId === account?.id && <><p>Solicitud recibida</p><button className="button primary" disabled={busy} onClick={() => void decision(c.id, "accept")}>Aceptar solicitud</button><button className="button text" disabled={busy} onClick={() => void decision(c.id, "decline")}>Rechazar solicitud</button></>}
          {c.status === "accepted" && <><p>Conexión aceptada</p><button className="button secondary" disabled={busy} onClick={() => void open(c.id)}>Abrir conversación</button><button className="button text" disabled={busy} onClick={() => { if (window.confirm("¿Cerrar esta conexión? La conversación dejará de estar disponible.")) void decision(c.id, "withdraw"); }}>Cerrar conexión</button></>}
          {c.status === "declined" && <p>Solicitud rechazada</p>}{c.status === "closed" && <p>Conexión cerrada</p>}
        </article>)}
      </section>
      {active && <section className="real-plaza-panel"><h2>Conversación con {active.person}</h2><p>Ambas personas aceptaron conversar. Puedes cerrar la conexión cuando quieras.</p><button className="button secondary" disabled={busy} onClick={() => void open(active.id)}>Actualizar conversación</button><button className="button text" disabled={busy} onClick={() => { requestVersion.current++; setSelected(null); setMessages([]); }}>Cerrar conversación</button><button className="button text" disabled={busy} onClick={() => void block(active.id)}>Bloquear persona</button>
        {messages.length === 0 ? <p>Aún no hay mensajes.</p> : messages.map((m) => <article className="real-plaza-reply" key={m.id}><strong>{m.senderId === account?.id ? "Tú" : active.person}</strong><p>{m.body}</p>{m.senderId !== account?.id && <button className="button text" onClick={() => setReport(m.id)}>Reportar mensaje</button>}</article>)}
        <form className="real-plaza-form" onSubmit={(e) => void send(e)}><label>Mensaje privado<textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} required /></label><button className="button primary" disabled={busy}>Enviar mensaje</button></form>
      </section>}
      {report && active && <ReportDialog subject={`Mensaje de ${active.person}`} onClose={() => setReport(null)} onSubmit={async (reason, note) => { await api("/api/plaza/reports", { kind: "private", contentId: report, reason, note }); }} />}
    </>}
  </div>;
}
