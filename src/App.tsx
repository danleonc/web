import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  CalendarDays,
  CheckCheck,
  Clock3,
  Compass,
  Leaf,
  LockKeyhole,
  MessageCircle,
  Menu,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { dateLabel, timeLabel } from "./data";
import type { Activity } from "./data";
import { emptyState, loadState, saveState } from "./store";
import type { Feedback, LocalState, Profile } from "./store";
import { Illustration } from "./Illustration";
import { Logo, Avatar, Modal, Empty } from "./components";
import { Discover } from "./pages/Discover";
import { ProfileForm } from "./pages/ProfileForm";
import { Agenda } from "./pages/Agenda";
import { Connections } from "./pages/Connections";
import { Room } from "./pages/Room";
import { SharedRoom } from "./pages/SharedRoom";
import { accountsEnabled, sharedEnabled } from "./shared/mode";
import { getSticker, stickerPacks } from "./chat/stickers";
import type { StickerActions } from "./chat/stickers";
import { clearImages } from "./media/local";
import { clearHiddenImages } from "./media/ImageView";
import { localReports, clearLocalReports } from "./safety/local";
import { Plaza, blankDraft } from "./pages/Plaza";
import { activities } from "./data";
import { plazaPeople } from "./plaza/data";
import type { PlazaInvitation } from "./plaza/data";
type Page =
  | "plaza"
  | "discover"
  | "agenda"
  | "connections"
  | "profile"
  | "room"
  | "shared";
const pages: Page[] = [
  "plaza",
  "discover",
  "agenda",
  "connections",
  "profile",
  "room",
  ...(sharedEnabled ? ["shared" as const] : []),
];
const getPage = (): Page =>
  pages.includes(location.hash.slice(1) as Page)
    ? (location.hash.slice(1) as Page)
    : "plaza";
function App() {
  const [state, setState] = useState<LocalState>(loadState);
  const [page, setPage] = useState<Page>(getPage);
  const [detail, setDetail] = useState<Activity | null>(null);
  const [room, setRoom] = useState<Activity | null>(null);
  const [pendingBooking, setPendingBooking] = useState<Activity | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [toast, setToast] = useState("");
  const [profileReturn, setProfileReturn] = useState<Page>("plaza");
  const [plazaDraft, setPlazaDraft] = useState(blankDraft);
  const [plazaThread, setPlazaThread] = useState<string | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => matchMedia("(max-width: 700px)").matches,
  );
  const sidebarRef = useRef<HTMLElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const menuWasOpen = useRef(false);
  useEffect(() => {
    const query = matchMedia("(max-width: 700px)");
    const update = () => {
      setIsMobile(query.matches);
      setMobileMenu(false);
    };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (isMobile && mobileMenu)
      sidebarRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    else if (isMobile && menuWasOpen.current) menuToggleRef.current?.focus();
    menuWasOpen.current = mobileMenu;
  }, [isMobile, mobileMenu]);
  function closeMenu() {
    setMobileMenu(false);
  }

  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!saveState(state)) setStorageWarning(true);
  }, [state]);
  useEffect(() => {
    const listener = () => setPage(getPage());
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    mainRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [page]);
  function navigate(next: Page) {
    setPlazaThread(null);
    setPage(next);
    location.hash = next;
    setMobileMenu(false);
  }
  function prepareProfile(returnTo: Page) {
    setProfileReturn(returnTo);
    navigate("profile");
  }
  function openPlaza(postId?: string) {
    navigate("plaza");
    setPlazaThread(postId || null);
  }
  function saveInvitation(invitation: PlazaInvitation) {
    setState((s) => ({
      ...s,
      plaza: {
        ...s.plaza,
        invitations: [
          ...s.plaza.invitations.filter(
            (i) => i.personId !== invitation.personId,
          ),
          invitation,
        ],
      },
    }));
    setToast(
      "Invitación de prueba guardada. Nadie la recibe ni acepta automáticamente.",
    );
  }
  function reserve(activity: Activity) {
    setDetail(null);
    if (!state.profile) {
      setPendingBooking(activity);
      setProfileReturn(page);
      navigate("profile");
      return;
    }
    setState((s) => ({
      ...s,
      reservations: [...new Set([...s.reservations, activity.id])],
    }));
    navigate("agenda");
    setToast("Reserva de ejemplo guardada. No se ha contactado a nadie.");
  }
  function saveProfile(profile: Profile) {
    setState((s) => ({
      ...s,
      profile,
      reservations: pendingBooking
        ? [...new Set([...s.reservations, pendingBooking.id])]
        : s.reservations,
    }));
    if (pendingBooking) {
      setPendingBooking(null);
      navigate("agenda");
      setToast("Perfil y reserva de ejemplo guardados.");
    } else {
      navigate(profileReturn);
      setToast(
        "Tu perfil de prueba está listo. Puedes editarlo cuando quieras.",
      );
    }
  }
  function enterRoom(activity: Activity) {
    setRoom(activity);
    setDetail(null);
    navigate("room");
  }
  function finish(feedback: Feedback) {
    setState((s) => ({
      ...s,
      feedback: [
        ...s.feedback.filter((f) => f.activityId !== feedback.activityId),
        feedback,
      ],
    }));
    setRoom(null);
    navigate("connections");
    setToast("Evaluación guardada solo en este navegador.");
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              prototype: true,
              exportedAt: new Date().toISOString(),
              ...state,
              reports: localReports(),
              imagesNote:
                "Este JSON incluye referencias de imágenes, no sus archivos. Descarga cada imagen desde su vista ampliada.",
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "entre-datos-de-prueba.json";
    link.click();
    URL.revokeObjectURL(url);
  }
  const stickerActions: StickerActions = {
    stickerPreferences: {
      favorites: state.stickerFavorites,
      recent: state.stickerRecent,
      usage: state.stickerUsage,
      favoritePacks: state.stickerFavoritePacks,
    },
    onToggleFavorite: (id) => {
      if (!getSticker(id)) return;
      setState((s) => ({
        ...s,
        stickerFavorites: s.stickerFavorites.includes(id)
          ? s.stickerFavorites.filter((x) => x !== id)
          : [...s.stickerFavorites, id],
      }));
    },
    onToggleFavoritePack: (id) => {
      if (!stickerPacks.some((p) => p.id === id)) return;
      setState((s) => ({
        ...s,
        stickerFavoritePacks: s.stickerFavoritePacks.includes(id)
          ? s.stickerFavoritePacks.filter((p) => p !== id)
          : [...s.stickerFavoritePacks, id],
      }));
    },
    onStickerUsed: (id) => {
      if (!getSticker(id)) return;
      setState((s) => ({
        ...s,
        stickerUsage: {
          ...s.stickerUsage,
          [id]: Math.min(1_000_000, (s.stickerUsage[id] || 0) + 1),
        },
        stickerRecent: [id, ...s.stickerRecent.filter((x) => x !== id)].slice(
          0,
          24,
        ),
      }));
    },
  };
  const links: { page: Page; label: string; icon: typeof Compass }[] = [
    { page: "plaza", label: "La Plaza", icon: MessageCircle },
    { page: "connections", label: "Conexiones", icon: Users },
    { page: "discover", label: "Encuentros", icon: CalendarDays },
    { page: "agenda", label: "Mi agenda", icon: CheckCheck },
    { page: "profile", label: "Mi perfil", icon: Settings2 },
    ...(sharedEnabled
      ? [
          {
            page: "shared" as const,
            label: accountsEnabled
              ? "Mi cuenta y encuentros"
              : "Laboratorio local",
            icon: Users,
          },
        ]
      : []),
  ];
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Ir al contenido
      </a>
      <aside
        ref={sidebarRef}
        id="main-navigation"
        inert={isMobile && !mobileMenu}
        className={`sidebar ${mobileMenu ? "is-open" : ""}`}
        role={isMobile && mobileMenu ? "dialog" : undefined}
        aria-modal={isMobile && mobileMenu ? true : undefined}
        aria-label="Menú de navegación"
        onKeyDown={(e) => {
          if (!isMobile || !mobileMenu) return;
          if (e.key === "Escape") {
            closeMenu();
            return;
          }
          if (e.key !== "Tab") return;
          const items = sidebarRef.current?.querySelectorAll<HTMLButtonElement>(
            "button:not([disabled])",
          );
          if (!items?.length) return;
          const first = items[0],
            last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        {isMobile && (
          <button
            className="icon-button sidebar-close"
            aria-label="Cerrar menú de navegación"
            onClick={closeMenu}
          >
            <X size={21} />
          </button>
        )}
        <button
          className="logo-button"
          aria-label="Afinia, ir a La Plaza"
          onClick={() => navigate("plaza")}
        >
          <Logo />
        </button>
        <p className="brand-caption">Algo en común. Algo por descubrir.</p>
        <div className="sidebar-label">TU LUGAR PARA CONECTAR</div>
        <nav aria-label="Navegación principal">
          {links.map(({ page: target, label, icon: Icon }) => (
            <button
              key={target}
              className={`nav-item ${page === target ? "active" : ""} ${target === "agenda" ? "secondary-start" : ""}`}
              aria-current={page === target ? "page" : undefined}
              onClick={() =>
                target === "profile"
                  ? prepareProfile("plaza")
                  : navigate(target)
              }
            >
              <Icon size={20} />
              <span>{label}</span>
              {target === "agenda" && state.reservations.length > 0 && (
                <span className="nav-count">{state.reservations.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-icon">
            <Leaf size={20} />
          </span>
          <h3>
            Una conversación
            <br />
            puede cambiar tu día.
          </h3>
          <p>
            Pasa por La Plaza, comparte algo pequeño y descubre qué viene
            después.
          </p>
          <span className="tiny-spark">✳</span>
        </div>
        <div className="sidebar-bottom">
          <button className="privacy-link" onClick={() => setShowPrivacy(true)}>
            <ShieldCheck size={17} /> Tu privacidad importa{" "}
            <ArrowRight size={15} />
          </button>
          <button
            className="profile-shortcut"
            onClick={() => prepareProfile("plaza")}
          >
            <Avatar name={state.profile?.alias || "Tú"} />
            <span>
              <strong>{state.profile?.alias || "Tu espacio"}</strong>
              <small>
                {state.profile ? "Perfil de prueba" : "Vamos a conocerte"}
              </small>
            </span>
            <Settings2 size={17} />
          </button>
        </div>
      </aside>
      {mobileMenu && (
        <button
          className="menu-backdrop"
          tabIndex={-1}
          aria-label="Cerrar menú"
          onClick={closeMenu}
        />
      )}
      <div className="app-shell ecosystem-shell" inert={isMobile && mobileMenu}>
        <header className="topbar">
          <div className="mobile-header">
            <button
              ref={menuToggleRef}
              className="icon-button mobile-toggle"
              aria-controls="main-navigation"
              aria-label="Abrir menú"
              aria-expanded={mobileMenu}
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              <span>Afinia</span>
              <span className="breadcrumb-divider">/</span>
              <strong>
                {page === "plaza"
                  ? "La Plaza"
                  : page === "discover"
                    ? "Encuentros"
                    : page === "connections"
                      ? "Conexiones"
                      : page === "agenda"
                        ? "Mi agenda"
                        : page === "profile"
                          ? "Mi perfil"
                          : page === "shared"
                            ? "Cuenta y pruebas"
                            : "Encuentro de prueba"}
              </strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="demo-badge">
              <span /> Prototipo interactivo
            </span>
            <button
              className="top-avatar"
              aria-label="Editar mi perfil"
              onClick={() => prepareProfile("plaza")}
            >
              <Avatar name={state.profile?.alias || "T"} />
            </button>
          </div>
        </header>
        <div className="demo-strip" role="region" aria-label="Aviso de maqueta">
          <Sparkles size={14} />
          <span>
            {page === "shared"
              ? accountsEnabled
                ? "Piloto: tus reservas y mensajes se guardan en el servidor."
                : "Laboratorio local: los mensajes se comparten con los navegadores que entren a la sala."
              : "Maqueta interactiva · Personas y conversaciones de ejemplo. Lo que compartes se guarda solo en este navegador."}
          </span>
          <button onClick={() => setShowPrivacy(true)}>
            Cómo funciona <ArrowRight size={13} />
          </button>
        </div>
        {storageWarning && (
          <p className="storage-warning" role="alert">
            El navegador no permite guardar datos. El recorrido funciona, pero
            los cambios se perderán al recargar.
          </p>
        )}
        <main id="main-content" ref={mainRef} tabIndex={-1}>
          {page === "plaza" && (
            <Plaza
              {...stickerActions}
              profile={state.profile}
              blocked={state.blocked}
              state={state.plaza}
              draft={plazaDraft}
              onDraft={setPlazaDraft}
              onChange={(plaza) => setState((s) => ({ ...s, plaza }))}
              onProfile={() => prepareProfile("plaza")}
              onConnections={() => navigate("connections")}
              onEncounters={() => navigate("discover")}
              onMeet={(id) =>
                setDetail(activities.find((a) => a.id === id) || null)
              }
              activePost={plazaThread}
              onOpenPost={setPlazaThread}
              onInvite={saveInvitation}
              onBlock={(name) => {
                setState((s) => ({
                  ...s,
                  blocked: [...new Set([...s.blocked, `plaza:${name}`])],
                  plaza: {
                    ...s.plaza,
                    invitations: s.plaza.invitations.filter(
                      (i) =>
                        plazaPeople.find((p) => p.id === i.personId)?.name !==
                        name,
                    ),
                  },
                }));
                setToast("Bloqueo guardado en este navegador.");
              }}
              onNotice={setToast}
            />
          )}
          {sharedEnabled && page === "shared" && (
            <SharedRoom
              {...stickerActions}
              profile={state.profile}
              onProfile={() => prepareProfile("shared")}
            />
          )}
          {page === "discover" && (
            <Discover
              profile={state.profile}
              reservations={state.reservations}
              onOpen={setDetail}
              onProfile={() => prepareProfile("discover")}
              onPlaza={() => navigate("plaza")}
            />
          )}
          {page === "profile" && (
            <ProfileForm
              key={state.profile ? "edit" : "new"}
              profile={state.profile}
              pending={!!pendingBooking}
              onSave={saveProfile}
              onCancel={() => {
                setPendingBooking(null);
                navigate(profileReturn);
              }}
              onPrivacy={() => setShowPrivacy(true)}
            />
          )}
          {page === "agenda" && (
            <Agenda
              state={state}
              onDiscover={() => navigate("discover")}
              onOpen={setDetail}
              onEnter={enterRoom}
              onCancel={(id) => {
                setState((s) => ({
                  ...s,
                  reservations: s.reservations.filter((x) => x !== id),
                }));
                setToast("Reserva cancelada en este navegador.");
              }}
            />
          )}
          {page === "connections" && (
            <Connections
              {...stickerActions}
              onProfile={() => prepareProfile("connections")}
              onPlaza={openPlaza}
              onPlazaInvite={saveInvitation}
              onWithdrawPlaza={(personId) =>
                setState((s) => ({
                  ...s,
                  plaza: {
                    ...s.plaza,
                    invitations: s.plaza.invitations.filter(
                      (i) => i.personId !== personId,
                    ),
                  },
                }))
              }
              state={state}
              onDiscover={() => navigate("discover")}
              onWithdrawGroup={(activityId) =>
                setState((s) => ({
                  ...s,
                  feedback: s.feedback.map((f) =>
                    f.activityId === activityId
                      ? { ...f, repeatGroup: false }
                      : f,
                  ),
                }))
              }
              onWithdraw={(activityId, name) =>
                setState((s) => ({
                  ...s,
                  feedback: s.feedback.map((f) =>
                    f.activityId === activityId
                      ? {
                          ...f,
                          reconnect: f.reconnect.filter((n) => n !== name),
                        }
                      : f,
                  ),
                }))
              }
            />
          )}
          {page === "room" &&
            (room && state.reservations.includes(room.id) && state.profile ? (
              <Room
                {...stickerActions}
                key={room.id}
                activity={room}
                profile={state.profile}
                blocked={state.blocked}
                onBlock={(name) =>
                  setState((s) => ({
                    ...s,
                    blocked: [...new Set([...s.blocked, `${room.id}:${name}`])],
                    plaza: {
                      ...s.plaza,
                      invitations: s.plaza.invitations.filter(
                        (i) =>
                          plazaPeople.find((p) => p.id === i.personId)?.name !==
                          name,
                      ),
                    },
                    feedback: s.feedback.map((f) =>
                      f.activityId === room.id
                        ? {
                            ...f,
                            reconnect: f.reconnect.filter((n) => n !== name),
                          }
                        : f,
                    ),
                  }))
                }
                onFinish={finish}
                onDiscover={() => navigate("discover")}
                onCancelReservation={() => {
                  setState((s) => ({
                    ...s,
                    reservations: s.reservations.filter((id) => id !== room.id),
                  }));
                  setRoom(null);
                  navigate("agenda");
                  setToast(
                    "Reserva cancelada por tu decisión. No se ha reprogramado.",
                  );
                }}
                onLeave={() => navigate("agenda")}
              />
            ) : (
              <Empty
                icon={<LockKeyhole />}
                title="Esta sala es parte de una reserva de prueba"
                text="Ve a tu agenda para entrar a un encuentro. Las salas no se recuperan al recargar: su conversación no se guarda."
                action="Ir a mi agenda"
                onAction={() => navigate("agenda")}
              />
            ))}
        </main>
        <footer className="footer">
          <span>
            <Logo /> <span>Conectar empieza por compartir.</span>
          </span>
          <span>
            Hecho para ir a tu ritmo <span className="footer-flower">✳</span>
          </span>
        </footer>
        <nav className="mobile-spaces" aria-label="Espacios de Afinia">
          {links.slice(0, 3).map(({ page: target, label, icon: Icon }) => (
            <button
              key={target}
              aria-current={page === target ? "page" : undefined}
              className={page === target ? "selected" : ""}
              onClick={() => navigate(target)}
            >
              <Icon size={21} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
      {detail && (
        <Modal
          title="Tu próximo encuentro"
          wide
          onClose={() => setDetail(null)}
        >
          <div className={`detail-art ${detail.color}`}>
            <Illustration scene={detail.scene} />
            <span className="tag overlay-tag">{detail.category}</span>
          </div>
          <div className="detail-body">
            <p className="eyebrow">ENCUENTRO VIRTUAL · DATOS FICTICIOS</p>
            <h3>{detail.title}</h3>
            <p className="detail-description">{detail.description}</p>
            <div className="detail-meta">
              <span>
                <CalendarDays size={17} />
                {dateLabel(detail.startsAt)}
              </span>
              <span>
                <Clock3 size={17} />
                {timeLabel(detail.startsAt)} · {detail.duration} min
              </span>
              <span>
                <Users size={17} />
                Entre {detail.minimum} y {detail.capacity} personas
              </span>
            </div>
            <p className="muted small-text">
              Horario de Santiago de Chile. Fechas de ejemplo; no se realizará
              un evento real.
            </p>
            <div className="guideline">
              <ShieldCheck size={21} />
              <div>
                <strong>Participar también es poder elegir.</strong>
                <p>
                  Puedes escuchar, omitir preguntas o salir cuando quieras. No
                  se requiere cámara ni compartir datos de contacto.
                </p>
              </div>
            </div>
            <h4>Una pregunta para empezar</h4>
            <blockquote>{detail.prompt}</blockquote>
            <div className="modal-actions">
              <button
                className="button secondary"
                onClick={() => setDetail(null)}
              >
                Ahora no
              </button>
              <button
                className="button primary"
                onClick={() =>
                  state.reservations.includes(detail.id)
                    ? enterRoom(detail)
                    : reserve(detail)
                }
              >
                {state.reservations.includes(detail.id)
                  ? "Entrar a la sala de prueba"
                  : state.profile
                    ? "Reservar mi lugar de prueba"
                    : "Preparar perfil y reservar"}
                <ArrowRight size={17} />
              </button>
            </div>
          </div>
        </Modal>
      )}
      {showPrivacy && (
        <Modal
          title="Tu espacio, tus decisiones"
          onClose={() => setShowPrivacy(false)}
        >
          <div className="modal-content">
            <div className="privacy-illustration">
              <ShieldCheck size={32} />
            </div>
            <p>
              Este es un prototipo local llamado provisionalmente{" "}
              <strong>Afinia</strong>. La maqueta pública no crea cuentas ni
              conecta con personas reales. El nombre no ha sido validado como
              marca.
            </p>
            <ul className="privacy-list">
              {sharedEnabled && (
                <li>
                  {accountsEnabled
                    ? "La sección Mi cuenta y encuentros guarda tu cuenta, reservas, bloqueos y los últimos 50 mensajes de cada sala en el servidor. Cerrar sesión o borrar los datos locales no elimina esos registros. El historial de salas archivadas se elimina a los 30 días."
                    : "El laboratorio local de desarrollo es una prueba separada:"}
                  {!accountsEnabled && (
                    <>
                      comparte mensajes con otros navegadores conectados y
                      conserva hasta 50 en memoria del servidor. No utilices
                      datos personales reales.
                    </>
                  )}
                </li>
              )}
              <li>
                El perfil, límites, reservas, bloqueos, evaluaciones y stickers
                favoritos y recientes de prueba se guardan en este navegador.
                También las publicaciones, respuestas, conversaciones guardadas
                e invitaciones de La Plaza. No se publican en una comunidad
                real.
              </li>
              <li>
                Los mensajes de las salas simuladas y de los chats privados de
                prueba se mantienen solo en memoria y se pierden al salir. No
                hay IA ni envío de mensajes, denuncias o invitaciones a
                terceros.
              </li>
              <li>
                No ingreses información sensible. Cualquier persona con acceso a
                este navegador podría ver tus datos de prueba.
              </li>
            </ul>
            <p className="small-text muted">
              La descarga incluye los datos locales y reportes de prueba, junto
              con referencias de imágenes. Descarga cada archivo desde su vista
              ampliada. Los mensajes de sala y borradores sin publicar no se
              exportan. Borrar estos datos solo reinicia este navegador.
            </p>
            <button className="button secondary full" onClick={exportData}>
              <ArrowDownToLine size={17} /> Descargar mis datos de prueba
            </button>
            <button
              className="button text-danger full"
              onClick={() => {
                setShowPrivacy(false);
                setResetConfirm(true);
              }}
            >
              Borrar todos mis datos de prueba
            </button>
          </div>
        </Modal>
      )}
      {resetConfirm && (
        <Modal
          title="¿Empezamos de nuevo?"
          onClose={() => setResetConfirm(false)}
        >
          <div className="modal-content">
            <p>
              Se borrarán el perfil, las reservas, las evaluaciones, los
              stickers favoritos y recientes, publicaciones, respuestas e
              invitaciones de La Plaza y los bloqueos de este prototipo en este
              navegador, junto con las imágenes y los reportes locales. No
              podrás deshacerlo.
            </p>
            <div className="modal-actions">
              <button
                className="button secondary"
                onClick={() => setResetConfirm(false)}
              >
                Conservar datos
              </button>
              <button
                className="button danger"
                onClick={() => {
                  void clearImages().catch(() =>
                    setToast(
                      "No se pudo borrar el archivo local de imágenes; revisa el almacenamiento del navegador.",
                    ),
                  );
                  clearHiddenImages();
                  clearLocalReports();
                  setState(emptyState);
                  setRoom(null);
                  setPendingBooking(null);
                  setPlazaDraft(blankDraft);
                  setResetConfirm(false);
                  navigate("plaza");
                  setToast("Datos locales borrados. Puedes empezar de nuevo.");
                }}
              >
                Sí, borrar datos
              </button>
            </div>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={20} />
          {toast}
          <button
            className="icon-button"
            aria-label="Cerrar aviso"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}

export default App;
