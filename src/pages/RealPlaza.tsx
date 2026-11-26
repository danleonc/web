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
import { ImagePicker } from "../media/ImagePicker";
import { ImageView } from "../media/ImageView";
import { StickerPicker } from "../chat/StickerPicker";
import { ImagePlus, Sticker, Send } from "lucide-react";
import { ReplyDraft, ReplyQuote } from "../chat/replies";
import { getSticker } from "../chat/stickers";
import type { StickerActions } from "../chat/stickers";
import { ConversationMute, useRealNotices } from "../notifications/RealNoticeCenter";

type Post = { imageId?: string | null; imageDescription?: string | null; stickerId?: string | null; id: string; topic: string; title: string; body: string; authorId: string; author: string };
type Reply = { replyTo?: string | null; quote?: {id:string;name:string;summary:string} | null; imageId?: string | null; imageDescription?: string | null; stickerId?: string | null; id: string; body: string; authorId: string; author: string };
type BlockedPerson = { id: string; alias: string };
async function request<T>(path: string, method = "GET", body?: object): Promise<T> {
  const response = await fetch(path, { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) { const detail = await response.json().catch(() => ({})); throw Error(detail.error === 'profile_photo_required' ? 'Agrega tu foto de Conexiones para enviar una solicitud nueva.' : response.status === 401 || response.status === 403 ? "Revisa tu sesión y confirma tu correo para participar." : "No pudimos completar la acción. Inténtalo de nuevo."); }
  return response.json() as Promise<T>;
}
export function RealPlaza({ account, loaded, onAccess, onProfile, noticeTarget, notices, ...stickers }: { account: AccountView | null; loaded: boolean; onAccess: () => void; onProfile: () => void; notices: ReturnType<typeof useRealNotices>; noticeTarget?: { id: string; serial: number } | null } & StickerActions) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [topicFilter, setTopicFilter] = useState('todos');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedList, setExpandedList] = useState(false);
  const [newPosts, setNewPosts] = useState(false);
  const listRequest = useRef(0);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyCursor, setReplyCursor] = useState<string | null>(null);
  const [olderReplies, setOlderReplies] = useState<string | null>(null);
  const [replyPageLoading, setReplyPageLoading] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [topic, setTopic] = useState("cultura");
  const [reply, setReply] = useState("");
  const [picker, setPicker] = useState<"post" | "reply" | null>(null);
  const [postSticker, setPostSticker] = useState("");
  const [postImage, setPostImage] = useState<{ blob: Blob; description: string } | null>(null);
  const [postImagePreview, setPostImagePreview] = useState("");
  const [postImagePicker, setPostImagePicker] = useState(false);
  const [pendingPost, setPendingPost] = useState<string | null>(null);
  useEffect(() => { if (!postImage) { setPostImagePreview(""); return; } const url = URL.createObjectURL(postImage.blob); setPostImagePreview(url); return () => URL.revokeObjectURL(url); }, [postImage]);
  const [imageTarget, setImageTarget] = useState<{kind: "post" | "reply"; id: string} | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const replyInput = useRef<HTMLTextAreaElement>(null);
  const pendingImage = useRef<{postId: string; id: string} | null>(null);
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
  const [invitationAgreement, setInvitationAgreement] = useState(false);
  const [notice, setNotice] = useState("");
  const threadRequest = useRef(0);
  const threadHeading = useRef<HTMLHeadingElement>(null);
  const navigation = useConversationNavigation("plaza", () => { threadRequest.current++; setActive(null); });
  useEffect(() => { if (active) { window.scrollTo(0, 0); threadHeading.current?.focus(); } }, [active]);
  const ready = !!account?.canParticipate;
  const refresh = useCallback(async () => {
    const current = ++listRequest.current;
    try {
      const result = await request<{ posts: Post[]; nextCursor: string | null }>(`/api/plaza/posts?page=1&topic=${encodeURIComponent(topicFilter)}&q=${encodeURIComponent(search)}`);
      if (current !== listRequest.current) return;
      setPosts(previous => active && !result.posts.some(p => p.id === active) ? [...result.posts, ...previous.filter(p => p.id === active)] : result.posts);
      setNextCursor(result.nextCursor);
      setExpandedList(false); setNewPosts(false);
    } finally { if (current === listRequest.current) setLoading(false); }
  }, [topicFilter, search, active]);
  useEffect(() => {
    let cancelled = false; const current = ++listRequest.current;
    setExpandedList(false); setNewPosts(false);
    if (!ready) { setPosts([]); setReplies([]); setNextCursor(null); return; }
    setLoading(true);
    request<{ posts: Post[]; nextCursor: string | null }>(`/api/plaza/posts?page=1&topic=${encodeURIComponent(topicFilter)}&q=${encodeURIComponent(search)}`).then((result) => { if (!cancelled && current === listRequest.current) { setPosts(result.posts); setNextCursor(result.nextCursor); } }).catch(() => { if (!cancelled && current === listRequest.current) setError("No pudimos cargar las conversaciones. Actualiza la página para intentar de nuevo."); }).finally(() => { if (!cancelled && current === listRequest.current) setLoading(false); });
    return () => { cancelled = true; };
  }, [ready, topicFilter, search]);
  useEffect(() => {
    if (!ready || active || busy || loading || loadingMore || editing) return;
    let cancelled=false; let timer:ReturnType<typeof setTimeout>;
    const update=async()=>{
      if(document.visibilityState==='visible') {
        const current=listRequest.current;
        try {
          const result=await request<{posts:Post[];nextCursor:string|null}>(`/api/plaza/posts?page=1&topic=${encodeURIComponent(topicFilter)}&q=${encodeURIComponent(search)}`);
          if(!cancelled && current===listRequest.current) {
            if(expandedList) setNewPosts(result.posts.some(post=>!posts.some(existing=>existing.id===post.id)));
            else {setPosts(result.posts);setNextCursor(result.nextCursor);}
          }
        } catch { /* Preserve the current list and retry on the next interval. */ }
      }
      if(!cancelled) timer=setTimeout(update,4000);
    };
    timer=setTimeout(update,4000);
    return()=>{cancelled=true;clearTimeout(timer);};
  }, [ready,active,busy,loading,loadingMore,editing,topicFilter,search,expandedList,posts]);
  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const current = ++listRequest.current; setLoadingMore(true); setError('');
    try { const result=await request<{posts:Post[];nextCursor:string|null}>(`/api/plaza/posts?topic=${encodeURIComponent(topicFilter)}&q=${encodeURIComponent(search)}&cursor=${encodeURIComponent(nextCursor)}`); if (current !== listRequest.current) return; setPosts(previous => [...previous, ...result.posts.filter(p => !previous.some(existing => existing.id === p.id))]); setNextCursor(result.nextCursor); setExpandedList(true); }
    catch { if (current === listRequest.current) setError('No pudimos cargar más conversaciones. Inténtalo nuevamente.'); }
    finally { setLoadingMore(false); }
  }
  async function openPost(id: string) {
    navigation.enter();
    const current = ++threadRequest.current;
    setError(""); setActive(id); setReplies([]); setReplyCursor(null); setOlderReplies(null); setReplyPageLoading(false); setReply(""); setQuoteId(null); pendingImage.current = null; setEditingReply(null); setThreadLoading(true);
    try { const result = await request<{ replies: Reply[]; nextCursor: string | null }>(`/api/plaza/posts/${id}/replies?page=1`); if (current === threadRequest.current) { setReplies(result.replies); setOlderReplies(result.nextCursor); } }
    catch { if (current === threadRequest.current) setError("No pudimos cargar las respuestas. Inténtalo de nuevo."); }
    finally { if (current === threadRequest.current) setThreadLoading(false); }
  }
  async function showReplyPage(id: string, cursor: string | null) {
    const current = ++threadRequest.current; setReplyPageLoading(true); setError("");
    try {
      const result = await request<{ replies: Reply[]; nextCursor: string | null }>(`/api/plaza/posts/${id}/replies?${cursor ? `cursor=${encodeURIComponent(cursor)}` : 'page=1'}`);
      if (current === threadRequest.current) { setReplies(result.replies); setReplyCursor(cursor); setOlderReplies(result.nextCursor); }
    } catch { if (current === threadRequest.current) setError("No pudimos cargar las respuestas. Inténtalo nuevamente."); }
    finally { if (current === threadRequest.current) setReplyPageLoading(false); }
  }
  useEffect(() => {
    if (!ready || !active || busy || threadLoading || replyCursor || replyPageLoading) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const update = async () => {
      if (document.visibilityState === "visible") {
        const current = threadRequest.current;
        try {
          const result = await request<{ replies: Reply[]; nextCursor: string | null }>(`/api/plaza/posts/${active}/replies?page=1`);
          if (!cancelled && current === threadRequest.current) { setReplies(result.replies); setOlderReplies(result.nextCursor); }
        } catch { /* Se intentará nuevamente sin interrumpir el borrador. */ }
      }
      if (!cancelled) timer = setTimeout(update, 4000);
    };
    timer = setTimeout(update, 4000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [ready, active, busy, threadLoading, replyCursor, replyPageLoading]);
  const openedNotice = useRef<number | null>(null);
  useEffect(() => {
    if (!ready || !noticeTarget || openedNotice.current === noticeTarget.serial) return;
    openedNotice.current = noticeTarget.serial; let cancelled = false;
    void request<{post:Post}>(`/api/plaza/posts/${noticeTarget.id}`).then(({post}) => { if (cancelled) return; setPosts(previous => previous.some(p => p.id === post.id) ? previous : [...previous,post]); void openPost(post.id); }).catch(() => { if (!cancelled) setError('Esta conversación ya no está disponible.'); });
    return () => {cancelled = true;};
  }, [ready, noticeTarget?.serial]);
  async function submitPost(e: FormEvent) {
    e.preventDefault(); if (!ready || busy) return; setBusy(true); setError("");
    try {
      const result = await request<{post?: {id: string}}>(editing ? `/api/plaza/posts/${editing}` : "/api/plaza/posts", editing ? "PATCH" : "POST", { topic, title, body: content, ...(!editing && postSticker ? { stickerId: postSticker } : {}) });
      if (!editing && postImage && result.post) { setPendingPost(result.post.id); await uploadPostImage(result.post.id); }
      else await finishPost();
    } catch (e) { setError(e instanceof Error ? e.message : "No pudimos publicar."); }
    finally { setBusy(false); }
  }
  async function finishPost() {
    setPendingPost(null); setTitle(""); setContent(""); setPostSticker(""); setPostImage(null); setEditing(null);
    try { await refresh(); } catch { setError("Tu publicación se guardó, pero no pudimos actualizar la lista. Recarga la página para verla."); }
  }
  async function uploadPostImage(id: string) {
    if (!postImage) return;
    try {
      const response = await fetch(`/api/plaza/images/post/${id}?description=${encodeURIComponent(postImage.description)}`, { method:"POST", credentials:"same-origin", headers:{"Content-Type":postImage.blob.type}, body:postImage.blob });
      if (!response.ok) throw Error();
      await finishPost();
    } catch {
      try { const current = await request<{posts:Post[]}>("/api/plaza/posts"); if (current.posts.find(p => p.id === id)?.imageId) { await finishPost(); return; } } catch { /* La subida se puede reintentar. */ }
      setError("Tu publicación se guardó, pero no pudimos agregar la imagen. Reintenta la imagen o continúa sin ella.");
    }
  }
  async function submitReply(e: FormEvent) {
    e.preventDefault(); if (!active || busy) return; setBusy(true); setError("");
    try {
      await request(editingReply ? `/api/plaza/replies/${editingReply}` : `/api/plaza/posts/${active}/replies`, editingReply ? "PATCH" : "POST", { body: reply, ...(!editingReply && quoteId ? { replyTo: quoteId } : {}) });
      setReply(""); setEditingReply(null); setQuoteId(null);
      try { await showReplyPage(active, null); }
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
      const result = await request<{ invitation: { status: string } }>("/api/plaza/invitations", "POST", { kind: invitation.kind, contentId: invitation.id, note: invitationNote, photoChallengeAccepted: true });
      setNotice(result.invitation.status === "accepted" ? "Ya tienes una conexión aceptada con esta persona." : "Solicitud enviada. La otra persona decide si acepta.");
      setInvitation(null); setInvitationNote(""); setInvitationAgreement(false);
    } catch (e) { setError(e instanceof Error ? e.message : "No pudimos enviar la solicitud."); }
    finally { setBusy(false); }
  }
  const selected = posts.find((post) => post.id === active);
  const filteredPosts = topicFilter === 'todos' ? posts : posts.filter(post => post.topic === topicFilter);
  const quote = replies.find(item => item.id === quoteId);
  const asTarget = (item: Reply) => ({ id: item.id, name: item.author, summary: item.body.slice(0, 160) || (item.imageId ? "Imagen" : "Sticker") });
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
          <label>Tema<select value={topic} disabled={!!pendingPost} onChange={(e) => setTopic(e.target.value)}>{plazaTopics.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
          <label>Título de la conversación<input value={title} disabled={!!pendingPost} onChange={(e) => setTitle(e.target.value)} maxLength={160} required /></label>
          <label>Tu publicación<textarea value={content} disabled={!!pendingPost} onChange={(e) => setContent(e.target.value)} maxLength={5000} required={!postSticker} /></label>
          {!editing && <div className="real-compose-actions"><button type="button" className="sticker-trigger" aria-label="Elegir sticker" title="Elegir sticker" disabled={busy || !!pendingPost} onClick={() => setPicker("post")}><Sticker size={22} aria-hidden="true" /></button><button type="button" className="sticker-trigger" aria-label="Adjuntar imagen" title="Adjuntar imagen" disabled={busy || !!pendingPost} onClick={() => setPostImagePicker(true)}><ImagePlus size={22} aria-hidden="true" /></button></div>}
          {postImage && <div><p>Imagen lista para publicar</p><img src={postImagePreview} alt="Vista previa de la imagen adjunta" style={{maxWidth:'12rem',maxHeight:'12rem',objectFit:'contain'}} /><button type="button" className="button text" disabled={busy || !!pendingPost} onClick={() => setPostImage(null)}>Quitar imagen</button></div>}
          {postSticker && <div><StickerImage id={postSticker}/><button type="button" className="button text" disabled={busy || !!pendingPost} onClick={() => setPostSticker("")}>Quitar sticker</button></div>}
          <div>{pendingPost ? <><button type="button" className="button primary" disabled={busy} onClick={() => { setBusy(true); setError(""); void uploadPostImage(pendingPost).finally(() => setBusy(false)); }}>Reintentar imagen</button><button type="button" className="button text" disabled={busy} onClick={() => { setError(""); void finishPost(); }}>Continuar sin imagen</button></> : <button className="button primary" disabled={busy}>{editing ? "Guardar cambios" : "Publicar"}</button>}{editing && <button type="button" className="button text" onClick={() => { setEditing(null); setTitle(""); setContent(""); }}>Cancelar edición</button>}</div>
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
        <form className="real-plaza-search" onSubmit={e => { e.preventDefault(); setSearch(searchDraft.trim()); }}><label className="field-label" htmlFor="real-plaza-search">Buscar conversaciones</label><input id="real-plaza-search" className="text-input" type="search" maxLength={100} value={searchDraft} onChange={e => setSearchDraft(e.target.value)} placeholder="Busca por título o contenido"/><button type="submit" className="button secondary">Buscar</button>{search && <button type="button" className="button text" onClick={() => { setSearchDraft(''); setSearch(''); }}>Limpiar búsqueda</button>}</form>
        <label className="field-label" htmlFor="real-plaza-topic-filter">Filtrar conversaciones por tema</label><select id="real-plaza-topic-filter" className="text-input" value={topicFilter} onChange={e => setTopicFilter(e.target.value)}><option value="todos">Todos los temas</option>{plazaTopics.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
        {newPosts && <div><p role="status">Hay conversaciones nuevas. Al actualizar volverás a las más recientes.</p><button type="button" className="button secondary" disabled={loading || loadingMore || busy} onClick={() => {setLoading(true);void refresh().catch(()=>setError('No pudimos actualizar las conversaciones. Inténtalo nuevamente.'));}}>Actualizar conversaciones</button></div>}
        {loading ? <p role="status">Cargando conversaciones…</p> : filteredPosts.length === 0 ? <p>{search ? 'No encontramos conversaciones para esa búsqueda. Prueba con otras palabras.' : topicFilter === 'todos' ? 'Todavía no hay conversaciones. Puedes iniciar la primera.' : 'Aún no hay conversaciones de este tema. Prueba otro o inicia una.'}</p> : filteredPosts.map((post) => <article key={post.id} className="real-plaza-post">
          <p>{post.author} · {plazaTopics.find((t) => t.id === post.topic)?.short}</p><h3>{post.title}</h3><p>{post.body}</p>{post.stickerId && <StickerImage id={post.stickerId}/>}
          {post.imageId && <ImageView plaza image={{id:post.imageId,description:post.imageDescription || ""}} />}
          {post.authorId === account?.id && !post.imageId && <button className="button text" disabled={busy} onClick={() => setImageTarget({kind:"post",id:post.id})}><ImagePlus size={16} aria-hidden="true" /> Agregar imagen</button>}
          <button className="button secondary" disabled={busy} onClick={() => void openPost(post.id)}>Ver conversación</button>
          {post.authorId !== account?.id && <button className="button text" onClick={() => setReport({ kind: "post", id: post.id, author: post.author })}>Reportar publicación</button>}
          {post.authorId !== account?.id && <button className="button text" disabled={busy} onClick={() => { setNotice(""); setInvitationNote(""); setInvitation({ kind: "post", id: post.id, author: post.author }); }}>Seguir conversando</button>}
          {post.authorId !== account?.id && <button className="button text" disabled={busy} onClick={() => void blockPerson("post", post.id, post.authorId)}>Bloquear persona</button>}
          {post.authorId === account?.id && <>{post.body && <button className="button text" disabled={busy || !!pendingPost} onClick={() => { setEditing(post.id); setTopic(post.topic); setTitle(post.title); setContent(post.body); setPostSticker(""); setPostImage(null); }}>Editar publicación</button>}<button className="button text" disabled={busy || !!pendingPost} onClick={() => { if (window.confirm("¿Eliminar esta publicación y sus respuestas?")) void remove(`/api/plaza/posts/${post.id}`, async () => { if (active === post.id) setActive(null); await refresh(); }); }}>Eliminar publicación</button></>}
        </article>)}
        {nextCursor && !loading && <button type="button" className="button secondary" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Cargando…' : 'Cargar más conversaciones'}</button>}
      </section>
      </div>
      {selected && <section className="real-plaza-panel" aria-labelledby="thread-title"><button className="button text" disabled={busy} onClick={navigation.back}>← Volver a La Plaza</button><h2 id="thread-title" ref={threadHeading} tabIndex={-1}>{selected.title}</h2><ConversationMute key={selected.id} notices={notices} kind="post" id={selected.id}/><p>{selected.author} · {plazaTopics.find((t) => t.id === selected.topic)?.short}</p><p>{selected.body}</p>{selected.stickerId && <StickerImage id={selected.stickerId}/>}
        {selected.imageId && <ImageView plaza image={{id:selected.imageId,description:selected.imageDescription || ""}} />}
        {(olderReplies || replyCursor) && <nav aria-label="Páginas de respuestas">{olderReplies && <button type="button" className="button secondary" disabled={busy || replyPageLoading} onClick={() => void showReplyPage(selected.id, olderReplies)}>Ver respuestas anteriores</button>}{replyCursor && <button type="button" className="button text" disabled={busy || replyPageLoading} onClick={() => void showReplyPage(selected.id, null)}>Ver respuestas recientes</button>}</nav>}
        {threadLoading || replyPageLoading ? <p role="status">Cargando respuestas…</p> : replies.length === 0 ? <p>Aún no hay respuestas.</p> : <div className="plaza-replies">{replies.map((item) => <article key={item.id} className="real-plaza-reply" data-message-id={item.id} tabIndex={-1}><strong>{item.author}</strong>{item.replyTo && <ReplyQuote target={item.quote || (replies.find(original => original.id === item.replyTo) ? asTarget(replies.find(original => original.id === item.replyTo)!) : undefined)} available={replies.some(original => original.id === item.replyTo)} />}<p>{item.body}</p>{item.stickerId && <StickerImage id={item.stickerId}/>}
        {item.imageId && <ImageView plaza image={{id:item.imageId,description:item.imageDescription || ""}} />}
        <button className="button text" disabled={busy} onClick={() => { setEditingReply(null); setQuoteId(item.id); replyInput.current?.focus(); }}>Responder a este comentario</button>
        {item.authorId === account?.id && !item.imageId && <button className="button text" disabled={busy} onClick={() => setImageTarget({kind:"reply",id:item.id})}><ImagePlus size={16} aria-hidden="true" /> Agregar imagen</button>}{item.authorId !== account?.id && <><button className="button text" onClick={() => setReport({ kind: "reply", id: item.id, author: item.author })}>Reportar respuesta</button><button className="button text" disabled={busy} onClick={() => { setNotice(""); setInvitationNote(""); setInvitation({ kind: "reply", id: item.id, author: item.author }); }}>Seguir conversando</button><button className="button text" disabled={busy} onClick={() => void blockPerson("reply", item.id, item.authorId)}>Bloquear persona</button></>}{item.authorId === account?.id && <>{item.body && <button className="button text" onClick={() => { setEditingReply(item.id); setReply(item.body); }}>Editar respuesta</button>}<button className="button text" disabled={busy} onClick={() => { if (window.confirm("¿Eliminar esta respuesta?")) void remove(`/api/plaza/replies/${item.id}`, async () => { await showReplyPage(selected.id, replyCursor); }); }}>Eliminar respuesta</button></>}</article>)}</div>}
        {quote && !editingReply && <ReplyDraft target={asTarget(quote)} onCancel={() => setQuoteId(null)} disabled={busy} />}
        <form onSubmit={(e) => void submitReply(e)} className="real-plaza-form"><label>Tu respuesta<textarea ref={replyInput} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={5000} required /></label><div className="real-compose-actions"><button type="button" className="sticker-trigger" aria-label="Enviar sticker" title="Enviar sticker" disabled={busy || !!editingReply} onClick={() => setPicker("reply")}><Sticker size={22} aria-hidden="true" /></button><button type="button" className="sticker-trigger" aria-label="Adjuntar imagen" title="Adjuntar imagen" disabled={busy || !!editingReply} onClick={() => setImageTarget({kind:"reply",id:"new"})}><ImagePlus size={22} aria-hidden="true" /></button><button className="send-button" aria-label={editingReply ? "Guardar respuesta" : "Responder"} disabled={busy}><Send size={18} aria-hidden="true" /></button>{editingReply && <button type="button" className="button text" onClick={() => { setEditingReply(null); setReply(""); }}>Cancelar edición</button>}</div></form>
      </section>}
      {postImagePicker && <ImagePicker label="Adjuntar imagen" onClose={() => setPostImagePicker(false)} onChoose={async (image, blob) => { setPostImage({blob, description:image.description}); }} />}
      {imageTarget && <ImagePicker onClose={() => setImageTarget(null)} onChoose={async (image, blob) => {
        let targetId = imageTarget.id;
        if (imageTarget.kind === "reply" && targetId === "new") {
          if (!active) throw Error("La conversación ya no está disponible.");
          if (!pendingImage.current || pendingImage.current.postId !== active) {
            const created = await request<{ reply: {id:string} }>(`/api/plaza/posts/${active}/replies`, "POST", {body: "Imagen compartida", ...(quoteId ? {replyTo: quoteId} : {})});
            pendingImage.current = {postId: active, id: created.reply.id};
          }
          targetId = pendingImage.current.id;
        }
        const result = await fetch(`/api/plaza/images/${imageTarget.kind}/${targetId}?description=${encodeURIComponent(image.description)}`, {method:"POST",credentials:"same-origin",headers:{"Content-Type":blob.type},body:blob});
        if (!result.ok) throw Error("No pudimos agregar la imagen. Comprueba que el contenido siga disponible e inténtalo nuevamente.");
        pendingImage.current = null; setQuoteId(null);
        await refresh(); if (active) await showReplyPage(active, null);
      }} />}
      {picker && <StickerPicker preferences={stickers.stickerPreferences} onToggleFavorite={stickers.onToggleFavorite} onToggleFavoritePack={stickers.onToggleFavoritePack} onClose={() => setPicker(null)} onSend={(id) => { if (picker === "post") { setPostSticker(id); setPicker(null); } else if (active && !busy) { setBusy(true); void request(`/api/plaza/posts/${active}/replies`, "POST", { body: "", stickerId: id, ...(quoteId ? {replyTo: quoteId} : {}) }).then(async () => { setQuoteId(null); stickers.onStickerUsed(id); setPicker(null); await showReplyPage(active, null); }).catch(() => setError("No pudimos enviar el sticker. Inténtalo de nuevo.")).finally(() => setBusy(false)); } }} />}
      {report && <ReportDialog subject={`Contenido de ${report.author}`} onClose={() => setReport(null)} onSubmit={async (reason, note) => { await request("/api/plaza/reports", "POST", { kind: report.kind, contentId: report.id, reason, note }); }} />}
      {invitation && <Modal title={`Seguir conversando con ${invitation.author}`} onClose={() => setInvitation(null)}><div className="modal-content"><p>La otra persona decide si acepta. El chat se abre solo después de su aceptación.</p><form className="real-plaza-form" onSubmit={(e) => void sendInvitation(e)}><label>Mensaje de invitación<textarea value={invitationNote} maxLength={500} onChange={(e) => setInvitationNote(e.target.value)} /></label>{error && <p role="alert">{error}</p>}{error.startsWith('Agrega tu foto de Conexiones') && <button type="button" className="button secondary" onClick={onProfile}>Ir a mi perfil</button>}<label className="checkbox-row"><input type="checkbox" checked={invitationAgreement} onChange={e => setInvitationAgreement(e.target.checked)} /> Acepto que nuestras fotos se compartan automáticamente después de 10 vueltas de conversación.</label><button className="button primary" disabled={busy || !invitationAgreement}>Enviar solicitud</button></form></div></Modal>}
    </>}
  </div>;
}

function StickerImage({ id }: { id: string }) { const sticker = getSticker(id); return sticker ? <img className="real-sticker" src={sticker.src} alt={`Sticker: ${sticker.label}`} /> : null; }
