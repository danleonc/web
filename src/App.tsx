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
import { getSticker } from "./chat/stickers";
import type { StickerActions } from "./chat/stickers";
type Page = "discover" | "agenda" | "connections" | "profile" | "room";
const pages: Page[] = ["discover", "agenda", "connections", "profile", "room"];
const getPage = (): Page =>
  pages.includes(location.hash.slice(1) as Page)
    ? (location.hash.slice(1) as Page)
    : "discover";
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
    setPage(next);
    location.hash = next;
    setMobileMenu(false);
  }
  function reserve(activity: Activity) {
    setDetail(null);
    if (!state.profile) {
      setPendingBooking(activity);
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
      navigate("discover");
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
            { prototype: true, exportedAt: new Date().toISOString(), ...state },
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
    onStickerUsed: (id) => {
      if (!getSticker(id)) return;
      setState((s) => ({
        ...s,
        stickerRecent: [id, ...s.stickerRecent.filter((x) => x !== id)].slice(
          0,
          24,
        ),
      }));
    },
  };
  const links: { page: Page; label: string; icon: typeof Compass }[] = [
    { page: "discover", label: "Descubrir", icon: Compass },
    { page: "agenda", label: "Mi agenda", icon: CalendarDays },
    { page: "connections", label: "Mis conexiones", icon: Users },
    { page: "profile", label: "Mi perfil", icon: Settings2 },
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
          aria-label="Entre, ir a descubrir"
          onClick={() => navigate("discover")}
        >
          <Logo />
        </button>
        <p className="brand-caption">Un espacio para conectar</p>
        <div className="sidebar-label">TU ESPACIO</div>
        <nav aria-label="Navegación principal">
          {links.map(({ page: target, label, icon: Icon }) => (
            <button
              key={target}
              className={`nav-item ${page === target ? "active" : ""}`}
              aria-current={page === target ? "page" : undefined}
              onClick={() => navigate(target)}
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
          <h3>A tu ritmo, a tu manera.</h3>
          <p>
            No tienes que saber qué buscas para descubrir con quién conectar.
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
            onClick={() => navigate("profile")}
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
      <div className="app-shell" inert={isMobile && mobileMenu}>
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
              Tu próximo encuentro empieza aquí
            </span>
          </div>
          <div className="topbar-right">
            <span className="demo-badge">
              <span /> Prototipo interactivo
            </span>
            <button
              className="top-avatar"
              aria-label="Editar mi perfil"
              onClick={() => navigate("profile")}
            >
              <Avatar name={state.profile?.alias || "T"} />
            </button>
          </div>
        </header>
        <div className="demo-strip">
          <Sparkles size={14} />
          <span>
            Un espacio de prueba: todos los encuentros y participantes son
            ficticios.
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
          {page === "discover" && (
            <Discover
              profile={state.profile}
              reservations={state.reservations}
              onOpen={setDetail}
              onProfile={() => navigate("profile")}
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
                navigate("discover");
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
              onProfile={() => navigate("profile")}
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
              <strong>Entre</strong>. No crea cuentas ni conecta con personas
              reales. El nombre no ha sido validado como marca.
            </p>
            <ul className="privacy-list">
              <li>
                El perfil, límites, reservas, bloqueos, evaluaciones y stickers
                favoritos y recientes de prueba se guardan en este navegador.
              </li>
              <li>
                Los mensajes de las salas y de los chats privados de prueba se
                mantienen solo en memoria y se pierden al salir. No hay IA ni
                envío de mensajes, denuncias o invitaciones a terceros.
              </li>
              <li>
                No ingreses información sensible. Cualquier persona con acceso a
                este navegador podría ver tus datos de prueba.
              </li>
            </ul>
            <p className="small-text muted">
              La descarga incluye los datos locales de prueba. No incluye
              mensajes de sala, porque no se guardan.
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
              stickers favoritos y recientes y los bloqueos de este prototipo en
              este navegador. No podrás deshacerlo.
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
                  setState(emptyState);
                  setRoom(null);
                  setPendingBooking(null);
                  setResetConfirm(false);
                  navigate("discover");
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
