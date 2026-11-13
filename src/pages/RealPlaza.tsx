import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { AccountView } from "../shared/accounts";
import { plazaTopics } from "../plaza/data";
import { HeroPhoto } from "../HeroPhoto";
import { plazaHeroPhoto } from "../heroPhotos";
import { ReportDialog } from "../safety/ReportDialog";
import { PlazaModerationDesk } from "../safety/PlazaModerationDesk";
import { MyPlazaAppeals, PlazaAppealDesk } from "../safety/PlazaAppeals";
import { Modal } from "../components";
import { useConversationNavigation } from "../shared/useConversationNavigation";
import "./RealPlaza.css";

type Post = { id: string; topic: string; title: string; body: string; authorId: string; author: string };
type Reply = { id: string; body: string; authorId: string; author: string };
type BlockedPerson = { id: string; alias: string };
async function request<T>(path: string, method = "GET", body?: object): Promise<T> {
  const response = await fetch(path, { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw Error(response.status === 401 || response.status === 403 ? "Revisa tu sesión y confirma tu correo para participar." : "No pudimos completar la acción. Inténtalo de nuevo.");
  return response.json() as Promise<T>;
}
export function RealPlaza({ account, loaded, onAccess }: { account: AccountView | null; loaded: boolean; onAccess: () => void }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [topic, setTopic] = useState("cultura");
  const [reply, setReply] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editingReply, setEditingReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState("");
  const [blocks, setBlocks] = useState<BlockedPerson[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [report, setReport] = useState<{ kind: "post" | "reply"; id: string; author: string } | null>(null);
  const [invitation, setInvitation] = useState<{ kind: "post" | "reply"; id: string; author: string } | null>(null);
  const [invitationNote, setInvitationNote] = useState("");
  const [notice, setNotice] = useState("");
  const threadRequest = useRef(0);
  const threadHeading = useRef<HTMLHeadingElement>(null);
  const navigation = useConversationNavigation("plaza", () => { threadRequest.current++; setActive(null); });
  useEffect(() => { if (active) { window.scrollTo(0, 0); threadHeading.current?.focus(); } }, [active]);
  const ready = !!account?.canParticipate;
  const refresh = useCallback(async () => {
    const result = await request<{ posts: Post[] }>("/api/plaza/posts");
    setPosts(result.posts);
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (!ready) { setPosts([]); setReplies([]); return; }
    setLoading(true);
    request<{ posts: Post[] }>("/api/plaza/posts").then((result) => { if (!cancelled) setPosts(result.posts); }).catch(() => { if (!cancelled) setError("No pudimos cargar las conversaciones. Actualiza la página para intentar de nuevo."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ready]);
  async function openPost(id: string) {
    navigation.enter();
    const current = ++threadRequest.current;
    setError(""); setActive(id); setReplies([]); setReply(""); setEditingReply(null); setThreadLoading(true);
    try { const result = await request<{ replies: Reply[] }>(`/api/plaza/posts/${id}/replies`); if (current === threadRequest.current) setReplies(result.replies); }
    catch { if (current === threadRequest.current) setError("No pudimos cargar las respuestas. Inténtalo de nuevo."); }
    finally { if (current === threadRequest.current) setThreadLoading(false); }
  }
  async function submitPost(e: FormEvent) {
    e.preventDefault(); if (!ready || busy) return; setBusy(true); setError("");
    try {
      await request(editing ? `/api/plaza/posts/${editing}` : "/api/plaza/posts", editing ? "PATCH" : "POST", { topic, title, body: content });
      setTitle(""); setContent(""); setEditing(null);
      try { await refresh(); } catch { setError("Tu publicación se guardó, pero no pudimos actualizar la lista. Recarga la página para verla."); }
    } catch (e) { setError(e instanceof Error ? e.message : "No pudimos publicar."); }
    finally { setBusy(false); }
  }
  async function submitReply(e: FormEvent) {
    e.preventDefault(); if (!active || busy) return; setBusy(true); setError("");
    try {
      await request(editingReply ? `/api/plaza/replies/${editingReply}` : `/api/plaza/posts/${active}/replies`, editingReply ? "PATCH" : "POST", { body: reply });
      setReply(""); setEditingReply(null);
      try { setReplies((await request<{ replies: Reply[] }>(`/api/plaza/posts/${active}/replies`)).replies); }
      catch { setError("Tu respuesta se guardó, pero no pudimos actualizar la conversación. Vuelve a abrirla para verla."); }
    } catch (e) { setError(e instanceof Error ? e.message : "No pudimos responder."); }
    finally { setBusy(false); }
  }
  async function remove(path: string, after: () => Promise<void>) {
    if (busy) return; setBusy(true); setError("");
    try { await request(path, "DELETE"); await after(); }
    catch (e) { setError(e instanceof Error ? e.message : "No pudimos eliminar el contenido."); }
    finally { setBusy(false); }
  }
  async function loadBlocks() {
    setBlocksLoading(true);
    try { setBlocks((await request<{ blocks: BlockedPerson[] }>("/api/plaza/blocks")).blocks); }
    catch { setError("No pudimos cargar las personas bloqueadas. Inténtalo de nuevo."); }
    finally { setBlocksLoading(false); }
  }
  async function blockPerson(kind: "post" | "reply", id: string, authorId: string) {
    if (busy || !window.confirm("¿Bloquear a esta persona? Dejarás de ver su contenido y saldrás de cualquier encuentro activo.")) return;
    setBusy(true); setError("");
    try {
      await request("/api/plaza/blocks", "POST", { kind, contentId: id });
      threadRequest.current++; setActive(null); setReplies([]);
      setPosts((previous) => previous.filter((post) => post.authorId !== authorId));
      try { await Promise.all([refresh(), loadBlocks()]); } catch { setError("La persona quedó bloqueada, pero no pudimos actualizar la lista. Recarga la página."); }
    } catch (e) { setError(e instanceof Error ? e.message : "No pudimos bloquear a esta persona."); }
    finally { setBusy(false); }
  }
  async function unblockPerson(id: string) {
    if (busy) return; setBusy(true); setError("");
    try {
      await request(`/api/plaza/blocks/${id}`, "DELETE");
      setBlocks((previous) => previous.filter((person) => person.id !== id));
      try { await refresh(); } catch { setError("La persona quedó desbloqueada, pero no pudimos actualizar la lista. Recarga la página."); }
    } catch (e) { setError(e instanceof Error ? e.message : "No pudimos desbloquear a esta persona."); }
    finally { setBusy(false); }
  }
  async function sendInvitation(e: FormEvent) {
    e.preventDefault(); if (!invitation || busy) return; setBusy(true); setError("");
    try {
      const result = await request<{ invitation: { status: string } }>("/api/plaza/invitations", "POST", { kind: invitation.kind, contentId: invitation.id, note: invitationNote });
      setNotice(result.invitation.status === "accepted" ? "Ya tienes una conexión aceptada con esta persona." : "Solicitud enviada. La otra persona decide si acepta.");
      setInvitation(null); setInvitationNote("");
    } catch (e) { setError(e instanceof Error ? e.message : "No pudimos enviar la solicitud."); }
    finally { setBusy(false); }
  }
  const selected = posts.find((post) => post.id === active);
  return <div className="page-content plaza-page real-plaza">
    {!active && <section className="plaza-welcome plaza-photo-hero" aria-labelledby="real-plaza-title">
      <div className="plaza-welcome-copy"><h1 id="real-plaza-title">Las buenas conexiones empiezan compartiendo.</h1><p>Un espacio para conversar a tu ritmo y descubrir ideas de otras personas.</p></div>
      <HeroPhoto images={plazaHeroPhoto} alt="Personas conectando desde sus propios espacios" />
    </section>}
    {!loaded ? <p role="status">Cargando tu sesión…</p> : !ready ? <section className="real-plaza-panel"><h2>Entra a La Plaza</h2><p>Inicia sesión y confirma tu correo para participar.</p><button className="button primary" onClick={onAccess}>Entrar a mi cuenta</button></section> : <>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className="real-plaza-list" hidden={!!active}>
      <section className="real-plaza-panel" aria-labelledby="compose-title"><h2 id="compose-title">Comparte una conversación</h2>
        <form onSubmit={(e) => void submitPost(e)} className="real-plaza-form">
          <label>Tema<select value={topic} onChange={(e) => setTopic(e.target.value)}>{plazaTopics.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
          <label>Título de la conversación<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required /></label>
          <label>Tu publicación<textarea value={content} onChange={(e) => setContent(e.target.value)} maxLength={5000} required /></label>
          <div><button className="button primary" disabled={busy}>{editing ? "Guardar cambios" : "Publicar"}</button>{editing && <button type="button" className="button text" onClick={() => { setEditing(null); setTitle(""); setContent(""); }}>Cancelar edición</button>}</div>
        </form>
      </section>
      <MyPlazaAppeals />
      <details className="real-plaza-panel" onToggle={(e) => { if (e.currentTarget.open) void loadBlocks(); }}>
        <summary>Personas bloqueadas</summary>
        <p>El bloqueo afecta las conversaciones y los encuentros compartidos.</p>
        {blocksLoading ? <p role="status">Cargando personas bloqueadas…</p> : blocks.length === 0 ? <p>No tienes personas bloqueadas.</p> : blocks.map((person) => <div key={person.id} className="real-plaza-reply"><span>{person.alias}</span><button className="button text" disabled={busy} onClick={() => void unblockPerson(person.id)} aria-label={`Desbloquear ${person.alias}`}>Desbloquear</button></div>)}
      </details>
      {account?.moderator && <PlazaModerationDesk />}
      {account?.moderator && <PlazaAppealDesk />}
      <section className="real-plaza-panel" aria-labelledby="conversations-title"><h2 id="conversations-title">Conversaciones</h2>
        {loading ? <p role="status">Cargando conversaciones…</p> : posts.length === 0 ? <p>Todavía no hay conversaciones. Puedes iniciar la primera.</p> : posts.map((post) => <article key={post.id} className="real-plaza-post">
          <p>{post.author} · {plazaTopics.find((t) => t.id === post.topic)?.short}</p><h3>{post.title}</h3><p>{post.body}</p>
          <button className="button secondary" disabled={busy} onClick={() => void openPost(post.id)}>Ver conversación</button>
          {post.authorId !== account?.id && <button className="button text" onClick={() => setReport({ kind: "post", id: post.id, author: post.author })}>Reportar publicación</button>}
          {post.authorId !== account?.id && <button className="button text" disabled={busy} onClick={() => { setNotice(""); setInvitationNote(""); setInvitation({ kind: "post", id: post.id, author: post.author }); }}>Seguir conversando</button>}
          {post.authorId !== account?.id && <button className="button text" disabled={busy} onClick={() => void blockPerson("post", post.id, post.authorId)}>Bloquear persona</button>}
          {post.authorId === account?.id && <><button className="button text" onClick={() => { setEditing(post.id); setTopic(post.topic); setTitle(post.title); setContent(post.body); }}>Editar publicación</button><button className="button text" disabled={busy} onClick={() => { if (window.confirm("¿Eliminar esta publicación y sus respuestas?")) void remove(`/api/plaza/posts/${post.id}`, async () => { if (active === post.id) setActive(null); await refresh(); }); }}>Eliminar publicación</button></>}
        </article>)}
      </section>
      </div>
      {selected && <section className="real-plaza-panel" aria-labelledby="thread-title"><button className="button text" disabled={busy} onClick={navigation.back}>← Volver a La Plaza</button><h2 id="thread-title" ref={threadHeading} tabIndex={-1}>{selected.title}</h2><p>{selected.author} · {plazaTopics.find((t) => t.id === selected.topic)?.short}</p><p>{selected.body}</p>
        {threadLoading ? <p role="status">Cargando respuestas…</p> : replies.length === 0 ? <p>Aún no hay respuestas.</p> : replies.map((item) => <article key={item.id} className="real-plaza-reply"><strong>{item.author}</strong><p>{item.body}</p>{item.authorId !== account?.id && <><button className="button text" onClick={() => setReport({ kind: "reply", id: item.id, author: item.author })}>Reportar respuesta</button><button className="button text" disabled={busy} onClick={() => { setNotice(""); setInvitationNote(""); setInvitation({ kind: "reply", id: item.id, author: item.author }); }}>Seguir conversando</button><button className="button text" disabled={busy} onClick={() => void blockPerson("reply", item.id, item.authorId)}>Bloquear persona</button></>}{item.authorId === account?.id && <><button className="button text" onClick={() => { setEditingReply(item.id); setReply(item.body); }}>Editar respuesta</button><button className="button text" disabled={busy} onClick={() => { if (window.confirm("¿Eliminar esta respuesta?")) void remove(`/api/plaza/replies/${item.id}`, async () => { setReplies((await request<{ replies: Reply[] }>(`/api/plaza/posts/${selected.id}/replies`)).replies); }); }}>Eliminar respuesta</button></>}</article>)}
        <form onSubmit={(e) => void submitReply(e)} className="real-plaza-form"><label>Tu respuesta<textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={5000} required /></label><div><button className="button primary" disabled={busy}>{editingReply ? "Guardar respuesta" : "Responder"}</button>{editingReply && <button type="button" className="button text" onClick={() => { setEditingReply(null); setReply(""); }}>Cancelar edición</button>}</div></form>
      </section>}
      {report && <ReportDialog subject={`Contenido de ${report.author}`} onClose={() => setReport(null)} onSubmit={async (reason, note) => { await request("/api/plaza/reports", "POST", { kind: report.kind, contentId: report.id, reason, note }); }} />}
      {invitation && <Modal title={`Seguir conversando con ${invitation.author}`} onClose={() => setInvitation(null)}><div className="modal-content"><p>La otra persona decide si acepta. El chat se abre solo después de su aceptación.</p><form className="real-plaza-form" onSubmit={(e) => void sendInvitation(e)}><label>Mensaje de invitación<textarea value={invitationNote} maxLength={500} onChange={(e) => setInvitationNote(e.target.value)} /></label>{error && <p role="alert">{error}</p>}<button className="button primary" disabled={busy}>Enviar solicitud</button></form></div></Modal>}
    </>}
  </div>;
}
