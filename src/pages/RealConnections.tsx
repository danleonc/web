import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { AccountView } from "../shared/accounts";
import { HeroPhoto } from "../HeroPhoto";
import { connectionsHeroPhoto } from "../heroPhotos";
import { ReportDialog } from "../safety/ReportDialog";
import { useConversationNavigation } from "../shared/useConversationNavigation";
import "./RealPlaza.css";
import { ImagePicker } from "../media/ImagePicker";
import { ImageView } from "../media/ImageView";
import { StickerPicker } from "../chat/StickerPicker";
import { ReplyDraft, ReplyQuote } from "../chat/replies";
import { ImagePlus, Sticker, Send } from "lucide-react";
import { getSticker } from "../chat/stickers";
import type { StickerActions } from "../chat/stickers";
import { ConnectionPhoto } from './ConnectionPhoto';

type Connection = { id: string; senderId: string; recipientId: string; person: string; note: string; status: string };
type Message = { replyTo?: string | null; imageId?: string | null; imageDescription?: string | null; stickerId?: string | null; id: string; senderId: string; body: string };
async function api<T>(path: string, data?: object): Promise<T> {
  const response = await fetch(path, { method: data ? "POST" : "GET", credentials: "same-origin", headers: data ? { "Content-Type": "application/json" } : undefined, body: data ? JSON.stringify(data) : undefined });
  if (!response.ok) { const detail = await response.json().catch(() => ({})); throw Error(detail.error === 'profile_photo_required' ? 'Agrega tu foto de Conexiones para continuar.' : "No pudimos completar la acción. Actualiza e inténtalo de nuevo."); }
  return response.json() as Promise<T>;
}
export function RealConnections({ account, loaded, onAccess, onPlaza, onProfile, noticeTarget, ...stickers }: { account: AccountView | null; loaded: boolean; onAccess: () => void; onPlaza: () => void; onProfile: () => void; noticeTarget?: { kind: "reply" | "message" | "invitation" | "acceptance"; id: string; serial: number } | null } & StickerActions) {
  const [connections, setConnections] = useState<Connection[]>([]); const [selected, setSelected] = useState<string | null>(null);
  const [connectionCursor, setConnectionCursor] = useState<string | null>(null); const [olderConnections, setOlderConnections] = useState<string | null>(null);
  const [agreements, setAgreements] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Message[]>([]); const [draft, setDraft] = useState("");
  const [messageCursor, setMessageCursor] = useState<string | null>(null); const [olderMessages, setOlderMessages] = useState<string | null>(null); const [messagePageLoading, setMessagePageLoading] = useState(false);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [imageTarget, setImageTarget] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingImage = useRef<{connection: string; clientId: string; messageId?: string; replyTo?: string} | null>(null);
  const pending = useRef<{ id: string; body: string; connection: string; replyTo: string } | null>(null); const requestVersion = useRef(0); const seenKey = useRef("");
  const chatHeading = useRef<HTMLHeadingElement>(null);
  const connectionRefs = useRef(new Map<string, HTMLElement>());
  const navigation = useConversationNavigation("connections", () => { requestVersion.current++; setSelected(null); setMessages([]); });
  useEffect(() => { if (selected) { window.scrollTo(0, 0); chatHeading.current?.focus(); } }, [selected]);
  const ready = !!account?.canParticipate;
  async function markSeen(id: string, list: Message[]) {
    if (document.visibilityState !== "visible" || !account?.id) return;
    const last = [...list].reverse().find((message) => message.senderId !== account.id);
    if (!last) return;
    const key = `${id}:${last.id}`; if (seenKey.current === key) return;
    seenKey.current = key;
    try { await api(`/api/plaza/connections/${id}/seen`, { messageId: last.id }); }
    catch { if (seenKey.current === key) seenKey.current = ""; }
  }
  const connectionPath = `/api/plaza/connections?${connectionCursor ? `cursor=${encodeURIComponent(connectionCursor)}` : 'page=1'}`;
  const refresh = useCallback(async () => { const result = await api<{ connections: Connection[]; nextCursor: string | null }>(connectionPath); setConnections(result.connections); setOlderConnections(result.nextCursor); }, [connectionPath]);
  useEffect(() => { let cancelled = false; if (!ready) return; setLoading(true); api<{ connections: Connection[]; nextCursor: string | null }>(connectionPath).then((result) => { if (!cancelled) { setConnections(result.connections); setOlderConnections(result.nextCursor); } }).catch(() => { if (!cancelled) setError("No pudimos cargar tus conexiones."); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [ready, connectionPath]);
  useEffect(() => {
    if (!ready || busy) return;
    let cancelled = false; let timer: ReturnType<typeof setTimeout>;
    const update = async () => {
      if (document.visibilityState !== "visible") { timer = setTimeout(update, 4000); return; }
      const version = requestVersion.current;
      try {
        const result = await api<{ connections: Connection[]; nextCursor: string | null }>(connectionPath);
        if (cancelled || version !== requestVersion.current) return;
        if (selected && !result.connections.some((item) => item.id === selected && item.status === "accepted")) {
          const response = await fetch(`/api/plaza/connections/${selected}`, { credentials: "same-origin" });
          if (!response.ok && response.status !== 404) throw Error("connection_unavailable");
          const target = response.ok ? await response.json() as { connection: Connection } : null;
          if (cancelled || version !== requestVersion.current) return;
          if (target?.connection.status === "accepted") result.connections.push(target.connection);
        }
        setConnections(result.connections); setOlderConnections(result.nextCursor);
        if (selected && !result.connections.some((item) => item.id === selected && item.status === "accepted")) {
          requestVersion.current++; setSelected(null); setMessages([]); setReport(null); setNotice("Esta conexión ya no está disponible.");
        } else if (selected && !messageCursor && !messagePageLoading) {
          const current = await api<{ messages: Message[]; nextCursor: string | null }>(`/api/plaza/connections/${selected}/messages?page=1`);
          if (!cancelled && version === requestVersion.current) { setMessages(current.messages); setOlderMessages(current.nextCursor); void markSeen(selected, current.messages); }
        }
      } catch { /* La próxima actualización volverá a intentarlo. */ }
      finally { if (!cancelled) timer = setTimeout(update, 4000); }
    };
    timer = setTimeout(update, 4000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [ready, busy, selected, account?.id, messageCursor, messagePageLoading, connectionPath]);
  async function decision(id: string, action: string) { if (busy) return; setBusy(true); setError(""); try { await api(`/api/plaza/invitations/${id}/decision`, { action, ...(action === "accept" ? { photoChallengeAccepted: true } : {}) }); if (selected === id) { requestVersion.current++; setSelected(null); setMessages([]); } await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo actualizar."); } finally { setBusy(false); } }
  async function dismissConnection(id: string) {
    if (busy || !window.confirm("¿Quitar esta conexión cerrada de tu lista? Esto no elimina los datos compartidos de la otra persona.")) return;
    setBusy(true); setError("");
    try { await api(`/api/plaza/connections/${id}/dismiss`, {}); setConnections(previous => previous.filter(item => item.id !== id)); setNotice("Conexión quitada de tu lista."); }
    catch { setError("No pudimos quitar la conexión. Inténtalo nuevamente."); }
    finally { setBusy(false); }
  }
  async function loadMessagePage(id: string, cursor: string | null) {
    const version = ++requestVersion.current; setMessagePageLoading(true); setError("");
    try {
      const result = await api<{ messages: Message[]; nextCursor: string | null }>(`/api/plaza/connections/${id}/messages?${cursor ? `cursor=${encodeURIComponent(cursor)}` : 'page=1'}`);
      if (version === requestVersion.current) { setMessages(result.messages); setMessageCursor(cursor); setOlderMessages(result.nextCursor); if (!cursor) void markSeen(id, result.messages); }
    } catch { if (version === requestVersion.current) setError("No pudimos cargar los mensajes. Inténtalo nuevamente."); }
    finally { if (version === requestVersion.current) setMessagePageLoading(false); }
  }
  async function open(id: string) { navigation.enter(); setSelected(id); setMessages([]); setMessageCursor(null); setOlderMessages(null); setDraft(""); setQuoteId(null); await loadMessagePage(id, null); }
  const openedNotice = useRef<number | null>(null);
  const fetchingNotice = useRef<number | null>(null);
  useEffect(() => {
    if (!ready || !noticeTarget || openedNotice.current === noticeTarget.serial) return;
    const target = connections.find(c => c.id === noticeTarget.id);
    if (!target) {
      if (fetchingNotice.current === noticeTarget.serial) return;
      const serial = noticeTarget.serial; fetchingNotice.current = serial;
      void api<{connection: Connection}>(`/api/plaza/connections/${noticeTarget.id}`).then(({connection}) => {
        if (fetchingNotice.current !== serial) return;
        setConnections(previous => previous.some(c => c.id === connection.id) ? previous : [connection,...previous]);
      }).catch(() => { if (fetchingNotice.current === serial) { openedNotice.current = serial; setNotice("Esta conexión ya no está disponible."); } });
      return;
    }
    if (noticeTarget.kind === "invitation" && target.status === "pending") {
      openedNotice.current = noticeTarget.serial;
      const element = connectionRefs.current.get(target.id);
      element?.scrollIntoView({ block: "center" }); element?.focus({ preventScroll: true });
    } else if (target.status === "accepted") { openedNotice.current = noticeTarget.serial; void open(target.id); }
  }, [ready, noticeTarget?.serial, connections]);
  async function send(e: FormEvent) { e.preventDefault(); if (!selected || busy || !draft.trim()) return; requestVersion.current++; setBusy(true); setError(""); setNotice(""); const text = draft.trim();
    if (!pending.current || pending.current.body !== text || pending.current.connection !== selected || pending.current.replyTo !== (quoteId || "")) pending.current = { id: crypto.randomUUID(), body: text, connection: selected, replyTo: quoteId || "" };
    try { await api(`/api/plaza/connections/${selected}/messages`, { clientId: pending.current.id, body: text, ...(quoteId ? {replyTo: quoteId} : {}) }); pending.current = null; setDraft(""); setQuoteId(null); await loadMessagePage(selected, null); }
    catch (e) { setError(e instanceof Error ? e.message : "No pudimos enviar el mensaje."); } finally { setBusy(false); }
  }
  async function block(id: string) {
    if (busy || !window.confirm("¿Bloquear a esta persona? Se cerrará la conexión y saldrás de cualquier encuentro activo.")) return;
    setBusy(true); setError("");
    try { await api(`/api/plaza/connections/${id}/block`, {}); requestVersion.current++; setSelected(null); setMessages([]); setConnections((previous) => previous.filter((c) => c.id !== id)); setNotice("La persona quedó bloqueada y la conexión se cerró."); }
    catch (e) { setError(e instanceof Error ? e.message : "No pudimos bloquear a esta persona."); }
    finally { setBusy(false); }
  }
  async function remove(messageId: string) {
    if (!selected || busy || !window.confirm("¿Retirar este mensaje de la conversación? Si fue reportado, puede conservarse una copia para revisión.")) return;
    requestVersion.current++; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/plaza/connections/${selected}/messages/${messageId}`, { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) throw Error("No pudimos retirar el mensaje. Inténtalo de nuevo.");
      setMessages((current) => current.filter((message) => message.id !== messageId)); setNotice("Mensaje retirado de la conversación.");
    } catch (e) { setError(e instanceof Error ? e.message : "No pudimos retirar el mensaje."); }
    finally { setBusy(false); }
  }
  const active = connections.find((c) => c.id === selected && c.status === "accepted");
  const quote = messages.find(m => m.id === quoteId);
  const asTarget = (m: Message) => ({id:m.id, name:m.senderId === account?.id ? "Tú" : active?.person || "Persona", summary:m.body.slice(0,160) || (m.imageId ? "Imagen" : "Sticker")});
  return <div className="page-content plaza-page real-plaza">
    {!selected && <section className="plaza-welcome plaza-photo-hero"><div className="plaza-welcome-copy"><h1>Conexiones que siguen a tu ritmo.</h1><p>Revisa tus solicitudes y decide con quién continuar conversando.</p></div><HeroPhoto images={connectionsHeroPhoto} alt="Personas conversando desde sus propios espacios" /></section>}
    {!loaded ? <p role="status">Cargando tu sesión…</p> : !ready ? <section className="real-plaza-panel"><h2>Entra a tus conexiones</h2><p>Inicia sesión y confirma tu correo para participar.</p><button className="button primary" onClick={onAccess}>Entrar a mi cuenta</button></section> : <>
      {error && <p role="alert">{error}</p>}{error.startsWith('Agrega tu foto de Conexiones') && <button className="button secondary" onClick={onProfile}>Ir a mi perfil</button>}{notice && <p role="status">{notice}</p>}
      <section className="real-plaza-panel" hidden={!!selected}><h2>Tus solicitudes y conexiones</h2><button className="button secondary" disabled={busy} onClick={() => void refresh().catch(() => setError("No pudimos actualizar tus conexiones."))}>Actualizar conexiones</button>
        {loading ? <p role="status">Cargando conexiones…</p> : connections.length === 0 ? <><p>Aún no tienes conexiones. Puedes conocer conversaciones en La Plaza.</p><button className="button text" onClick={onPlaza}>Ir a La Plaza</button></> : connections.map((c) => <article className="real-plaza-post" key={c.id} tabIndex={-1} ref={element => { if (element) connectionRefs.current.set(c.id, element); else connectionRefs.current.delete(c.id); }}><h3>{c.person}</h3><p>{c.note}</p>
          {c.status === "pending" && c.senderId === account?.id && <><p>Esperando respuesta</p><button className="button text" disabled={busy} onClick={() => void decision(c.id, "withdraw")}>Retirar solicitud</button></>}
          {c.status === "pending" && c.recipientId === account?.id && <><p>Solicitud recibida</p><label className="checkbox-row"><input type="checkbox" checked={!!agreements[c.id]} onChange={e => setAgreements(previous => ({...previous,[c.id]:e.target.checked}))} /> Acepto que nuestras fotos se compartan automáticamente después de 10 vueltas de conversación.</label><button className="button primary" disabled={busy || !agreements[c.id]} onClick={() => void decision(c.id, "accept")}>Aceptar solicitud</button><button className="button text" disabled={busy} onClick={() => void decision(c.id, "decline")}>Rechazar solicitud</button></>}
          {c.status === "accepted" && <><p>Conexión aceptada</p><button className="button secondary" disabled={busy} onClick={() => void open(c.id)}>Abrir conversación</button><button className="button text" disabled={busy} onClick={() => { if (window.confirm("¿Cerrar esta conexión? La conversación dejará de estar disponible.")) void decision(c.id, "withdraw"); }}>Cerrar conexión</button></>}
          {c.status === "declined" && <p>Solicitud rechazada</p>}{c.status === "closed" && <p>Conexión cerrada</p>}{(c.status === "declined" || c.status === "closed") && <button className="button text" disabled={busy} onClick={() => void dismissConnection(c.id)}>Quitar de mi lista</button>}
        </article>)}
        {(olderConnections || connectionCursor) && <nav aria-label="Páginas de conexiones">{olderConnections && <button type="button" className="button secondary" disabled={busy || loading} onClick={() => { requestVersion.current++; setConnectionCursor(olderConnections); }}>Ver conexiones anteriores</button>}{connectionCursor && <button type="button" className="button text" disabled={busy || loading} onClick={() => { requestVersion.current++; setConnectionCursor(null); }}>Ver conexiones recientes</button>}</nav>}
      </section>
      {active && <section className="real-plaza-panel connection-chat"><button className="button text" disabled={busy} onClick={navigation.back}>← Volver a Conexiones</button><h2 ref={chatHeading} tabIndex={-1}>Conversación con {active.person}</h2><p className="connection-chat-subtitle">Un espacio para conocerse, a su ritmo.</p><button className="button secondary" disabled={busy || messagePageLoading} onClick={() => void loadMessagePage(active.id, null)}>Actualizar conversación</button><button className="button text" disabled={busy} onClick={() => void block(active.id)}>Bloquear persona</button><ConnectionPhoto key={active.id} id={active.id} person={active.person} onProfile={onProfile} />
        {(olderMessages || messageCursor) && <nav aria-label="Páginas de mensajes">{olderMessages && <button type="button" className="button secondary" disabled={busy || messagePageLoading} onClick={() => void loadMessagePage(active.id, olderMessages)}>Ver mensajes anteriores</button>}{messageCursor && <button type="button" className="button text" disabled={busy || messagePageLoading} onClick={() => void loadMessagePage(active.id, null)}>Ver mensajes recientes</button>}</nav>}
        {messagePageLoading ? <p role="status">Cargando mensajes…</p> : messages.length === 0 ? <div className="connection-chat-empty"><strong>Todo comienza con un hola.</strong><p>Cuéntale algo que te entusiasme o hazle una pregunta.</p></div> : <div className="private-messages">{messages.map((m) => <article className={`real-plaza-reply connection-bubble ${m.senderId === account?.id ? "connection-bubble-own" : "connection-bubble-other"}`} key={m.id} data-message-id={m.id} tabIndex={-1}><strong>{m.senderId === account?.id ? "Tú" : active.person}</strong>{m.replyTo && <ReplyQuote target={messages.find(item => item.id === m.replyTo) ? asTarget(messages.find(item => item.id === m.replyTo)!) : undefined}/>}<p>{m.body}</p>{m.stickerId && getSticker(m.stickerId) && <img className="real-sticker" src={getSticker(m.stickerId)!.src} alt={`Sticker: ${getSticker(m.stickerId)!.label}`} />}{m.imageId && <ImageView plaza image={{id:m.imageId,description:m.imageDescription || ""}} />}
          <button className="button text" disabled={busy} onClick={() => { setQuoteId(m.id); inputRef.current?.focus(); }}>Responder a este mensaje</button>
          {m.senderId === account?.id && !m.imageId && <button className="button text" disabled={busy} onClick={() => setImageTarget(m.id)}><ImagePlus size={16} aria-hidden="true" /> Agregar imagen</button>}
          {m.senderId !== account?.id ? <button className="button text" onClick={() => setReport(m.id)}>Reportar mensaje</button> : <button className="button text" disabled={busy} onClick={() => void remove(m.id)}>Retirar mensaje</button>}</article>)}</div>}
        {quote && <ReplyDraft target={asTarget(quote)} disabled={busy} onCancel={() => setQuoteId(null)} />}
        <form className="real-plaza-form connection-composer" onSubmit={(e) => void send(e)}><label>Mensaje privado<textarea placeholder="Escribe algo para comenzar…" ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} required /></label><div className="real-compose-actions"><button type="button" className="sticker-trigger" aria-label="Enviar sticker" title="Enviar sticker" disabled={busy} onClick={() => setPicker(true)}><Sticker size={22} aria-hidden="true" /></button><button type="button" className="sticker-trigger" aria-label="Adjuntar imagen" title="Adjuntar imagen" disabled={busy} onClick={() => setImageTarget("new")}><ImagePlus size={22} aria-hidden="true" /></button><button className="send-button" aria-label="Enviar mensaje" disabled={busy}><Send size={18} aria-hidden="true" /></button></div></form>
      </section>}
      {imageTarget && active && <ImagePicker onClose={() => setImageTarget(null)} onChoose={async (image, blob) => {
        let targetId = imageTarget;
        if (targetId === "new") {
          if (!pendingImage.current || pendingImage.current.connection !== active.id) pendingImage.current = {connection:active.id,clientId:crypto.randomUUID(),replyTo:quoteId || undefined};
          if (!pendingImage.current.messageId) {
            const sent = await api<{message:{id:string}}>(`/api/plaza/connections/${active.id}/messages`, {clientId:pendingImage.current.clientId,body:"Imagen compartida",...(pendingImage.current.replyTo ? {replyTo:pendingImage.current.replyTo} : {})});
            pendingImage.current.messageId = sent.message.id;
          }
          targetId = pendingImage.current.messageId;
        }
        const result = await fetch(`/api/plaza/images/private/${targetId}?description=${encodeURIComponent(image.description)}`, {method:"POST",credentials:"same-origin",headers:{"Content-Type":blob.type},body:blob});
        if (!result.ok) throw Error("No pudimos agregar la imagen. Comprueba que la conversación siga disponible e inténtalo nuevamente.");
        pendingImage.current = null; setQuoteId(null);
        await loadMessagePage(active.id, null);
      }} />}
      {picker && active && <StickerPicker preferences={stickers.stickerPreferences} onToggleFavorite={stickers.onToggleFavorite} onToggleFavoritePack={stickers.onToggleFavoritePack} onClose={() => setPicker(false)} onSend={(id) => { if (busy) return; setBusy(true); const clientId = crypto.randomUUID(); void api(`/api/plaza/connections/${active.id}/messages`, { clientId, body: "", stickerId: id, ...(quoteId ? {replyTo: quoteId} : {}) }).then(async () => { setQuoteId(null); stickers.onStickerUsed(id); setPicker(false); await loadMessagePage(active.id, null); }).catch(() => setError("No pudimos enviar el sticker. Inténtalo de nuevo.")).finally(() => setBusy(false)); }} />}
      {report && active && <ReportDialog subject={`Mensaje de ${active.person}`} onClose={() => setReport(null)} onSubmit={async (reason, note) => { await api("/api/plaza/reports", { kind: "private", contentId: report, reason, note }); }} />}
    </>}
  </div>;
}
