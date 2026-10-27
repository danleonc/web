import { ConductGuide } from "../safety/ConductGuide";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Compass,
  Feather,
  Leaf,
  MessageCircle,
  Plus,
  Search,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { getSticker } from "../chat/stickers";
import { ReplyComposer } from "../plaza/ReplyComposer";
import type { ReplyContent } from "../plaza/ReplyComposer";
import type { StickerActions } from "../chat/stickers";
import { Avatar, Empty, Modal } from "../components";
import { featuredActivities, dateLabel, timeLabel } from "../data";
import type { Profile } from "../store";
import { PlazaArt } from "../plaza/Art";
import { InviteDialog } from "../plaza/InviteDialog";
import {
  emptyPlaza,
  normalizeSearch,
  plazaTopics,
  seedPosts,
  seedComments,
  isPlazaPersonBlocked,
  plazaPeople,
} from "../plaza/data";
import type {
  PlazaInvitation,
  PlazaPost,
  PlazaState,
  TopicId,
} from "../plaza/data";
import { ImagePicker } from "../media/ImagePicker";
import { ImageView } from "../media/ImageView";
import { saveImage, deleteImage } from "../media/local";
import type { ImageRef } from "../media/types";
import { ReportDialog } from "../safety/ReportDialog";
import { saveLocalReport } from "../safety/local";
type Draft = {
  image?: ImageRef;
  title: string;
  body: string;
  topic: TopicId;
  editingId?: string;
};
export const blankDraft: Draft = { title: "", body: "", topic: "cultura" };
type Props = StickerActions & {
  profile: Profile | null;
  blocked: string[];
  state: PlazaState;
  draft: Draft;
  onDraft: (draft: Draft) => void;
  onChange: (state: PlazaState) => void;
  onProfile: () => void;
  onConnections: () => void;
  onEncounters: () => void;
  onMeet: (id: string) => void;
  activePost: string | null;
  focusComment?: string | null;
  onOpenPost: (id: string | null) => void;
  onInvite: (i: PlazaInvitation) => void;
  onPrepareInvitation: (source: Omit<PlazaInvitation, "note">) => void;
  onNotice: (message: string) => void;
  onBlock: (name: string) => void;
};
export function Plaza({
  profile,
  blocked,
  state = emptyPlaza,
  draft,
  onDraft,
  onChange,
  onProfile,
  onConnections,
  onEncounters,
  onMeet,
  activePost,
  focusComment,
  onOpenPost,
  onInvite,
  onPrepareInvitation,
  onNotice,
  onBlock,
  ...stickerActions
}: Props) {
  const [topic, setTopic] = useState("todos");
  const [search, setSearch] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [composer, setComposer] = useState(false);
  const editing = draft.editingId || null;
  const [imagePicker, setImagePicker] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PlazaPost | null>(null);
  const [composeError, setComposeError] = useState("");
  const [prepare, setPrepare] = useState(false);
  const latestState = useRef(state);
  latestState.current = state;
  const [invite, setInvite] = useState<Omit<PlazaInvitation, "note"> | null>(
    null,
  );
  const originRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activePost || !focusComment) return;
    const frame = requestAnimationFrame(() => {
      originRef.current?.scrollIntoView({ block: "center" });
      originRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [activePost, focusComment]);
  const listRef = useRef<HTMLElement>(null);
  const allPosts = [...state.posts, ...seedPosts].filter(
    (p) => p.own || !isPlazaPersonBlocked(p.author, blocked),
  );
  const visible = allPosts.filter(
    (p) =>
      !state.hidden.includes(p.id) &&
      (topic === "todos" || p.topic === topic) &&
      (!savedOnly || state.saved.includes(p.id)) &&
      normalizeSearch(`${p.title} ${p.body} ${p.tags.join(" ")}`).includes(
        normalizeSearch(search),
      ),
  );
  const active = allPosts.find((p) => p.id === activePost);
  const current = Math.min(
    page,
    Math.max(0, Math.ceil(visible.length / 4) - 1),
  );
  const posts = visible.slice(current * 4, current * 4 + 4);
  const replies = (id: string) =>
    [...seedComments, ...state.comments].filter(
      (c) =>
        c.postId === id && (c.own || !isPlazaPersonBlocked(c.author, blocked)),
    );
  const saved = (p: PlazaPost) => state.saved.includes(p.id);
  function save(p: PlazaPost) {
    onChange({
      ...state,
      saved: saved(p)
        ? state.saved.filter((id) => id !== p.id)
        : [...state.saved, p.id],
    });
  }
  function startSharing() {
    setComposeError("");
    if (profile) setComposer(true);
    else setPrepare(true);
  }
  function openPost(id: string) {
    onOpenPost(id);
  }
  function changePage(next: number) {
    setPage(next);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function publish() {
    if (
      !profile ||
      draft.title.trim().length < 3 ||
      draft.body.trim().length < 5
    )
      return;
    if (!editing && state.posts.length >= 30) {
      setComposeError(
        "Esta maqueta guarda hasta 30 publicaciones. Puedes eliminar una de las tuyas para compartir otra.",
      );
      return;
    }
    const post: PlazaPost = {
      id: editing || crypto.randomUUID(),
      topic: draft.topic,
      title: draft.title.trim(),
      body: draft.body.trim(),
      author: profile.alias,
      personId: "self",
      own: true,
      tags: [],
      image: draft.image,
    };
    onChange({
      ...state,
      posts: editing
        ? state.posts.map((p) => (p.id === editing ? post : p))
        : [post, ...state.posts],
    });
    const oldImage = state.posts.find((p) => p.id === editing)?.image;
    if (oldImage && oldImage.id !== draft.image?.id)
      void deleteImage(oldImage.id).catch(() => {});
    onDraft(blankDraft);
    setComposer(false);
    setTopic("todos");
    setSavedOnly(false);
    setSearch("");
    setPage(0);
    onNotice(
      editing
        ? "Publicación actualizada en este navegador."
        : "Tu publicación de prueba quedó guardada solo en este navegador.",
    );
  }
  function releaseImages(images: (ImageRef | undefined)[], next: PlazaState) {
    const kept = new Set(
      [...next.posts, ...next.comments].flatMap((item) =>
        item.image ? [item.image.id] : [],
      ),
    );
    for (const id of new Set(
      images.flatMap((image) => (image ? [image.id] : [])),
    )) {
      if (!kept.has(id)) void deleteImage(id).catch(() => {});
    }
  }
  async function appendReply(
    postId: string,
    content: ReplyContent,
    blob?: Blob,
  ) {
    if (!profile) throw Error("Prepara tu perfil para responder.");
    if (content.image && blob) await saveImage(content.image.id, blob);
    const current = latestState.current;
    if (
      !seedPosts.some((p) => p.id === postId) &&
      !current.posts.some((p) => p.id === postId)
    ) {
      releaseImages([content.image], current);
      throw Error("Esta publicación ya no está disponible.");
    }
    const comments = [
      ...current.comments,
      {
        ...content,
        id: crypto.randomUUID(),
        postId,
        author: profile.alias,
        own: true,
      },
    ].slice(-100);
    const next = { ...current, comments };
    latestState.current = next;
    onChange(next);
    const kept = new Set(comments.map((c) => c.id));
    releaseImages(
      current.comments.filter((c) => !kept.has(c.id)).map((c) => c.image),
      next,
    );
    onNotice(
      content.image
        ? "Respuesta con imagen guardada solo en este navegador."
        : content.stickerId
          ? "Sticker guardado en esta conversación de prueba, solo en tu navegador."
          : "Respuesta guardada en este navegador. No se ha contactado a nadie.",
    );
  }
  const culture = featuredActivities[0];
  return (
    <div className="page-content plaza-page">
      <section className="plaza-welcome" aria-labelledby="plaza-title">
        <div className="plaza-welcome-copy">
          <p className="eyebrow">
            <span className="little-spark">✳</span> LA PLAZA · A TU RITMO
          </p>
          <h1 id="plaza-title">
            Las buenas conexiones
            <br />
            empiezan <em>compartiendo.</em>
          </h1>
          <p>
            {profile ? `Qué gusto verte, ${profile.alias}. ` : ""}Una pregunta,
            una historia, algo que te mueve. Aquí siempre puedes dejar un punto
            de partida y volver después.
          </p>
          <div className="hero-actions">
            <button className="button primary" onClick={startSharing}>
              <Plus size={17} /> Compartir algo
            </button>
            <button className="button secondary" onClick={onEncounters}>
              Explorar encuentros <ArrowRight size={16} />
            </button>
          </div>
          <span className="plaza-welcome-note">
            <Leaf size={14} /> No necesitas coincidir en horario para
            participar.
          </span>
        </div>
        <div className="plaza-welcome-picture">
          <PlazaArt />
          <span className="illustration-caption">
            <span /> Lo cotidiano también nos conecta.
          </span>
        </div>
      </section>
      <div className="ecosystem-paths" aria-label="Tres formas de conectar">
        <span>
          <MessageCircle size={18} />
          <strong>Comparte a tu ritmo</strong>
          <small>La Plaza</small>
        </span>
        <button onClick={onConnections}>
          <Users size={18} />
          <strong>Descubre afinidades</strong>
          <small>
            Conexiones <ArrowRight size={13} />
          </small>
        </button>
        <button onClick={onEncounters}>
          <Coffee size={18} />
          <strong>Vive algo en grupo</strong>
          <small>
            Encuentros <ArrowRight size={13} />
          </small>
        </button>
      </div>
      <div className="plaza-layout">
        <section
          className="plaza-conversations"
          ref={listRef}
          aria-labelledby="plaza-conversations-title"
        >
          <div className="plaza-section-head">
            <div>
              <p className="eyebrow">ALGO EN COMÚN, ALGO POR DESCUBRIR</p>
              <h2 id="plaza-conversations-title">¿De qué conversamos?</h2>
            </div>
            <button
              className={`quiet-save ${savedOnly ? "selected" : ""}`}
              aria-pressed={savedOnly}
              onClick={() => {
                setSavedOnly(!savedOnly);
                setPage(0);
              }}
            >
              <Bookmark size={16} />
              {savedOnly ? "Ver todas" : "Guardadas"}
            </button>
          </div>
          <div className="plaza-controls">
            <div
              className="plaza-topic-tabs"
              aria-label="Temáticas de La Plaza"
            >
              {[{ id: "todos", short: "Todo" }, ...plazaTopics].map((t) => (
                <button
                  key={t.id}
                  className={topic === t.id ? "selected" : ""}
                  aria-pressed={topic === t.id}
                  onClick={() => {
                    setTopic(t.id);
                    setPage(0);
                  }}
                >
                  {t.short}
                </button>
              ))}
            </div>
            <label className="plaza-search">
              <Search size={16} />
              <span className="sr-only">Buscar conversaciones</span>
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Una idea, un interés…"
              />
            </label>
          </div>
          <button className="plaza-composer-prompt" onClick={startSharing}>
            <Avatar name={profile?.alias || "Tú"} index={4} />
            <span>¿Qué te gustaría compartir hoy?</span>
            <Plus size={18} />
          </button>
          <p className="sr-only" role="status">
            {visible.length} conversaciones {savedOnly ? "guardadas" : ""}
          </p>
          {posts.length ? (
            <div className="plaza-post-grid">
              {posts.map((p) => {
                const t = plazaTopics.find((t) => t.id === p.topic)!;
                return (
                  <article
                    className={`plaza-post ${t.color}`}
                    key={p.id}
                    aria-labelledby={`post-title-${p.id}`}
                  >
                    <div className="plaza-post-person">
                      <Avatar name={p.author} index={plazaTopics.indexOf(t)} />
                      <div>
                        <strong>{p.own ? "Tú" : p.author}</strong>
                        <span>
                          {p.own
                            ? "Solo en tu navegador"
                            : "Publicación de ejemplo"}
                        </span>
                      </div>
                      <button
                        className={`save-post ${saved(p) ? "selected" : ""}`}
                        aria-label={`${saved(p) ? "Quitar de guardadas" : "Guardar conversación"}: ${p.title}`}
                        aria-pressed={saved(p)}
                        onClick={() => save(p)}
                      >
                        <Bookmark
                          size={18}
                          fill={saved(p) ? "currentColor" : "none"}
                        />
                      </button>
                    </div>
                    {p.image && (
                      <ImageView
                        image={p.image}
                        onReport={() =>
                          setReport(`Imagen de ${p.author}: ${p.title}`)
                        }
                      />
                    )}
                    {p.art && !p.image && (
                      <button
                        className="post-art-button"
                        aria-label={`Abrir conversación: ${p.title}`}
                        onClick={() => openPost(p.id)}
                        tabIndex={-1}
                      >
                        <PlazaArt scene={p.art} />
                      </button>
                    )}
                    <div className="plaza-post-content">
                      <span className={`plaza-topic ${t.color}`}>
                        <span />
                        {t.label}
                      </span>
                      <h3 id={`post-title-${p.id}`}>
                        <button onClick={() => openPost(p.id)}>
                          {p.title}
                        </button>
                      </h3>
                      <p>{p.body}</p>
                      <div className="post-tags">
                        {p.tags.map((tag) => (
                          <span key={tag}>
                            #{tag.toLocaleLowerCase("es").replaceAll(" ", "")}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="plaza-post-actions">
                      <button onClick={() => openPost(p.id)}>
                        <MessageCircle size={16} />
                        {replies(p.id).length
                          ? `${replies(p.id).length} ${replies(p.id).length === 1 ? "respuesta" : "respuestas"}`
                          : "Abrir conversación"}
                      </button>
                      <button
                        className="post-join"
                        onClick={() => openPost(p.id)}
                      >
                        Sumarme <ArrowRight size={14} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <Empty
              icon={savedOnly ? <Bookmark /> : <Search />}
              title={
                savedOnly
                  ? "Tus conversaciones favoritas tienen un lugar."
                  : "Todavía no hay una conversación con esa búsqueda."
              }
              text={
                savedOnly
                  ? "Guarda una conversación para volver a ella cuando quieras. Solo tú ves tus guardadas."
                  : "Prueba otro interés o abre tú una nueva conversación de ejemplo."
              }
              action="Explorar conversaciones"
              onAction={() => {
                setSavedOnly(false);
                setTopic("todos");
                setSearch("");
                setPage(0);
              }}
            />
          )}
          {visible.length > 0 && (
            <div className="plaza-pagination">
              <button
                className="button secondary"
                disabled={current === 0}
                onClick={() => changePage(current - 1)}
                aria-label="Conversaciones anteriores"
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                Página {current + 1} de {Math.ceil(visible.length / 4)}
                <small>
                  Un espacio para conversar, sin desplazamiento infinito.
                </small>
              </span>
              <button
                className="button secondary"
                disabled={(current + 1) * 4 >= visible.length}
                onClick={() => changePage(current + 1)}
                aria-label="Más conversaciones"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          {state.hidden.length > 0 && (
            <button
              className="button text restore-hidden"
              onClick={() => onChange({ ...state, hidden: [] })}
            >
              Restaurar conversaciones ocultas ({state.hidden.length})
            </button>
          )}
        </section>
        <aside className="plaza-aside" aria-label="Para seguir conectando">
          <section className="plaza-plan">
            <p className="eyebrow">DE CONVERSAR A COMPARTIR</p>
            <PlazaArt scene="books" />
            <span className="small-label">ENCUENTRO DE EJEMPLO</span>
            <h2>
              Una historia.
              <br />
              Un café.
              <br />
              <em>Un buen comienzo.</em>
            </h2>
            <p>
              {dateLabel(culture.startsAt)} · {timeLabel(culture.startsAt)} h
              <br />
              3–6 personas · 40 minutos
            </p>
            <button
              className="button primary full"
              onClick={() => onMeet("cafe")}
            >
              Conocer el encuentro <ArrowRight size={15} />
            </button>
          </section>
          <section className="plaza-tip">
            <span className="note-icon">
              <Feather size={20} />
            </span>
            <h3>No hace falta tener una gran historia.</h3>
            <p>
              Un pequeño descubrimiento también puede abrir una conversación.
            </p>
            <button
              onClick={() => {
                onDraft({
                  ...blankDraft,
                  title: "Algo pequeño que me dio curiosidad…",
                });
                startSharing();
              }}
            >
              Probar con una idea <ArrowRight size={14} />
            </button>
          </section>
          <ConductGuide />
          <div className="plaza-principles">
            <span>
              <Check size={15} /> Sin rankings de personas
            </span>
            <span>
              <Check size={15} /> Guardadas solo para ti
            </span>
            <span>
              <Check size={15} /> Continuar es una elección
            </span>
          </div>
        </aside>
      </div>
      {prepare && (
        <Modal
          title="Un poco de ti para empezar."
          onClose={() => setPrepare(false)}
        >
          <div className="modal-content">
            <div className="note-icon">
              <Sparkles size={22} />
            </div>
            <p>
              Explora libremente. Para compartir o responder, prepara un perfil
              de prueba con un alias y declara tu mayoría de edad.
            </p>
            <p className="muted small-text">
              Las publicaciones de esta maqueta se guardan solo en este
              navegador. No se envían a una comunidad real.
            </p>
            <div className="modal-actions">
              <button
                className="button secondary"
                onClick={() => setPrepare(false)}
              >
                Seguir explorando
              </button>
              <button
                className="button primary"
                onClick={() => {
                  setPrepare(false);
                  onProfile();
                }}
              >
                Preparar mi perfil <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </Modal>
      )}
      {composer && (
        <Modal
          title={
            editing
              ? "Tu conversación puede cambiar contigo."
              : "Un punto de partida para conversar."
          }
          initialFocus="#post-title"
          wide
          onClose={() => setComposer(false)}
        >
          <form
            className="modal-content plaza-compose-form"
            onSubmit={(e) => {
              e.preventDefault();
              publish();
            }}
          >
            {composeError && (
              <p className="shared-error" role="alert">
                {composeError}
              </p>
            )}
            <p>
              Comparte algo que te interese. Puede ser una pregunta, una
              recomendación o una pequeña historia.
            </p>
            <fieldset>
              <legend>¿Dónde encaja tu conversación?</legend>
              <div className="compose-topics">
                {plazaTopics.map((t) => (
                  <label
                    key={t.id}
                    className={draft.topic === t.id ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name="post-topic"
                      checked={draft.topic === t.id}
                      value={t.id}
                      onChange={() => onDraft({ ...draft, topic: t.id })}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="field-label" htmlFor="post-title">
              Un título para tu conversación
            </label>
            <input
              id="post-title"
              className="text-input"
              required
              minLength={3}
              maxLength={100}
              value={draft.title}
              onChange={(e) => onDraft({ ...draft, title: e.target.value })}
              placeholder="¿Qué te dio curiosidad hoy?"
            />
            <label className="field-label" htmlFor="post-body">
              ¿Qué te gustaría compartir?
            </label>
            <textarea
              id="post-body"
              className="text-input"
              required
              minLength={5}
              maxLength={1000}
              rows={5}
              value={draft.body}
              onChange={(e) => onDraft({ ...draft, body: e.target.value })}
              placeholder="No hace falta escribir mucho. Un pequeño comienzo está bien."
            />
            <div className="post-image-compose">
              {draft.image && (
                <>
                  <ImageView image={draft.image} />
                  <button
                    className="button text-danger"
                    type="button"
                    onClick={() => {
                      const id = draft.image!.id;
                      if (!state.posts.some((p) => p.image?.id === id))
                        void deleteImage(id).catch(() => {});
                      onDraft({ ...draft, image: undefined });
                    }}
                  >
                    Quitar imagen adjunta
                  </button>
                </>
              )}
              <button
                className="button secondary"
                type="button"
                onClick={() => setImagePicker(true)}
              >
                {draft.image ? "Cambiar imagen" : "Añadir una imagen"}
              </button>
              <p className="small-text muted">
                Una imagen por publicación. Su función es abrir una
                conversación; evita datos personales de terceros.
              </p>
            </div>
            <div className="compose-footnote">
              <span>Visible solo en este navegador de prueba.</span>
              <span>{draft.body.length}/1000</span>
            </div>
            <div className="modal-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => setComposer(false)}
              >
                Volver sin publicar
              </button>
              <button
                className="button primary"
                type="submit"
                disabled={
                  draft.title.trim().length < 3 || draft.body.trim().length < 5
                }
              >
                {editing ? "Guardar cambios" : "Publicar en la maqueta"}{" "}
                <Send size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {active && (
        <Modal title={active.title} wide onClose={() => onOpenPost(null)}>
          <div className="modal-content plaza-thread">
            <div className="thread-person">
              <Avatar name={active.author} />
              <div>
                <strong>{active.own ? "Tú" : active.author}</strong>
                <span>
                  {active.own
                    ? "Tu publicación de prueba"
                    : "Persona y conversación de ejemplo"}
                </span>
              </div>
              <button
                className={`quiet-save ${saved(active) ? "selected" : ""}`}
                aria-pressed={saved(active)}
                onClick={() => save(active)}
              >
                <Bookmark size={16} />
                {saved(active) ? "Guardada" : "Guardar"}
              </button>
            </div>
            <span className="plaza-topic">
              {plazaTopics.find((t) => t.id === active.topic)!.label}
            </span>
            {active.image && (
              <ImageView
                image={active.image}
                onReport={() =>
                  setReport(`Imagen de ${active.author}: ${active.title}`)
                }
              />
            )}
            <p className="thread-body">{active.body}</p>
            <div className="thread-bridge">
              <div>
                <span className="small-label">¿ENCONTRARON ALGO EN COMÚN?</span>
                <p>Pueden dar el siguiente paso, si ambos quieren.</p>
              </div>
              {!active.own && (
                <button
                  className="button secondary"
                  onClick={() => {
                    state.invitations.some(
                      (i) => i.personId === active.personId,
                    )
                      ? onConnections()
                      : setInvite({
                          personId: active.personId,
                          postId: active.id,
                        });
                  }}
                >
                  {state.invitations.some((i) => i.personId === active.personId)
                    ? "Ver mi invitación"
                    : "Invitar a conversar"}{" "}
                  <ArrowRight size={15} />
                </button>
              )}
              <button
                className="button text"
                onClick={() => {
                  onOpenPost(null);
                  onMeet(
                    plazaTopics.find((t) => t.id === active.topic)!.activityId,
                  );
                }}
              >
                Ver encuentro relacionado
              </button>
            </div>
            <h3 className="thread-replies-title">
              <MessageCircle size={18} /> Respuestas a esta conversación
            </h3>
            <div className="plaza-replies">
              {replies(active.id).length ? (
                replies(active.id).map((c) => (
                  <div
                    className={`plaza-reply ${focusComment === c.id ? "invitation-origin" : ""}`}
                    key={c.id}
                    ref={focusComment === c.id ? originRef : undefined}
                    tabIndex={focusComment === c.id ? -1 : undefined}
                    role="group"
                    aria-label={`Respuesta de ${c.own ? "ti" : c.author}`}
                  >
                    <Avatar name={c.author} index={c.own ? 4 : 1} small />
                    <div>
                      <strong>
                        {c.own ? "Tú" : c.author}{" "}
                        <span>
                          ·{" "}
                          {c.own
                            ? "solo en este navegador"
                            : "respuesta de ejemplo"}
                        </span>
                      </strong>
                      {c.body && <p>{c.body}</p>}
                      {c.stickerId && getSticker(c.stickerId) && (
                        <img
                          className="sent-sticker"
                          src={getSticker(c.stickerId)!.src}
                          alt={`Sticker: ${getSticker(c.stickerId)!.label}`}
                          width="150"
                          height="150"
                          loading="lazy"
                        />
                      )}
                      {c.image && (
                        <ImageView
                          image={c.image}
                          onReport={() =>
                            setReport(
                              `Imagen en respuesta de ${c.author}: ${c.image!.description || active.title}`,
                            )
                          }
                        />
                      )}
                      {c.own && (
                        <button
                          type="button"
                          className="message-report"
                          onClick={() => {
                            const next = {
                              ...state,
                              comments: state.comments.filter(
                                (reply) => reply.id !== c.id,
                              ),
                            };
                            onChange(next);
                            releaseImages([c.image], next);
                          }}
                        >
                          Eliminar mi respuesta
                        </button>
                      )}
                      {!c.own && (
                        <div className="reply-continuation-actions">
                          {c.personId &&
                            plazaPeople.some(
                              (p) =>
                                p.id === c.personId &&
                                !isPlazaPersonBlocked(p.name, blocked),
                            ) && (
                              <button
                                type="button"
                                className="button text"
                                onClick={() => {
                                  if (
                                    state.invitations.some(
                                      (i) => i.personId === c.personId,
                                    )
                                  )
                                    onConnections();
                                  else
                                    setInvite({
                                      personId: c.personId!,
                                      postId: active.id,
                                      commentId: c.id,
                                    });
                                }}
                              >
                                {state.invitations.some(
                                  (i) => i.personId === c.personId,
                                )
                                  ? "Ver mi invitación"
                                  : "Seguir conversando"}
                                <ArrowRight size={14} />
                              </button>
                            )}
                          <button
                            className="message-report"
                            onClick={() =>
                              setReport(
                                `Respuesta de ${c.author}: ${c.body.slice(0, 120)}`,
                              )
                            }
                          >
                            Reportar respuesta
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted small-text">
                  Puedes abrir la conversación con una primera respuesta de
                  prueba.
                </p>
              )}
            </div>
            {profile ? (
              <ReplyComposer
                key={active.id}
                {...stickerActions}
                onReply={(content, blob) =>
                  appendReply(active.id, content, blob)
                }
              />
            ) : (
              <button
                className="button primary"
                onClick={() => {
                  onOpenPost(null);
                  onProfile();
                }}
              >
                Preparar perfil para responder <ArrowRight size={15} />
              </button>
            )}
            <div className="thread-bottom-actions">
              <button
                className="button text"
                onClick={() =>
                  setReport(`Publicación de ${active.author}: ${active.title}`)
                }
              >
                Reportar publicación
              </button>
              {!active.own && (
                <button
                  className="button text-danger"
                  onClick={() => {
                    if (
                      confirm(
                        `¿Bloquear a ${active.author} en esta maqueta? Ocultará sus publicaciones y respuestas y retirará tus invitaciones pendientes.`,
                      )
                    ) {
                      onBlock(active.author);
                      onOpenPost(null);
                    }
                  }}
                >
                  Bloquear a {active.author}
                </button>
              )}
              {active.own && (
                <>
                  <button
                    className="button text"
                    onClick={() => {
                      onDraft({
                        title: active.title,
                        body: active.body,
                        topic: active.topic,
                        editingId: active.id,
                        image: active.image,
                      });
                      setComposeError("");
                      onOpenPost(null);
                      setComposer(true);
                    }}
                  >
                    Editar publicación
                  </button>
                  <button
                    className="button text-danger"
                    onClick={() => {
                      onOpenPost(null);
                      setDeleting(active);
                    }}
                  >
                    Eliminar publicación
                  </button>
                </>
              )}
              <button
                className="button text"
                onClick={() => {
                  onChange({ ...state, hidden: [...state.hidden, active.id] });
                  onOpenPost(null);
                  onNotice(
                    "Conversación oculta. Puedes restaurarla desde el final de La Plaza.",
                  );
                }}
              >
                <X size={14} /> Ocultar conversación
              </button>
              <button
                className="button text"
                onClick={() => {
                  onOpenPost(null);
                  onConnections();
                }}
              >
                <Compass size={14} /> Explorar conexiones
              </button>
            </div>
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="¿Eliminar tu publicación de prueba?"
          onClose={() => setDeleting(null)}
        >
          <div className="modal-content">
            <p>
              Se eliminarán «{deleting.title}» y sus respuestas de este
              navegador. No se puede deshacer.
            </p>
            <div className="modal-actions">
              <button
                className="button secondary"
                onClick={() => setDeleting(null)}
              >
                Conservar publicación
              </button>
              <button
                className="button danger"
                onClick={() => {
                  const next = {
                    ...state,
                    posts: state.posts.filter((p) => p.id !== deleting.id),
                    comments: state.comments.filter(
                      (c) => c.postId !== deleting.id,
                    ),
                    saved: state.saved.filter((id) => id !== deleting.id),
                    hidden: state.hidden.filter((id) => id !== deleting.id),
                  };
                  onChange(next);
                  releaseImages(
                    [
                      deleting.image,
                      ...state.comments
                        .filter((c) => c.postId === deleting.id)
                        .map((c) => c.image),
                      ...(draft.editingId === deleting.id ? [draft.image] : []),
                    ],
                    next,
                  );
                  if (draft.editingId === deleting.id) onDraft(blankDraft);
                  setDeleting(null);
                  onNotice(
                    "Publicación de prueba eliminada de este navegador.",
                  );
                }}
              >
                Sí, eliminar publicación
              </button>
            </div>
          </div>
        </Modal>
      )}
      {imagePicker && (
        <ImagePicker
          label="Adjuntar a mi publicación"
          onClose={() => setImagePicker(false)}
          onChoose={async (image, blob) => {
            await saveImage(image.id, blob);
            const old = draft.image;
            if (old && !state.posts.some((p) => p.image?.id === old.id))
              await deleteImage(old.id);
            onDraft({ ...draft, image });
          }}
        />
      )}
      {report && (
        <ReportDialog
          subject={report}
          local
          onClose={() => setReport(null)}
          onSubmit={(reason, note) => saveLocalReport(report, reason, note)}
        />
      )}
      {invite && (
        <InviteDialog
          personId={invite.personId}
          postId={invite.postId}
          commentId={invite.commentId}
          posts={state.posts}
          blocked={blocked}
          onMeet={onMeet}
          profile={profile}
          onProfile={() => onPrepareInvitation(invite)}
          onClose={() => setInvite(null)}
          onSave={(i) => {
            onInvite(i);
            onConnections();
          }}
        />
      )}
    </div>
  );
}
