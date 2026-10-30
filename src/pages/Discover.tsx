import { useState } from "react";
import {
  ArrowRight,
  MapPin,
  Users,
  Video,
  Search,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
  Leaf,
  Heart,
  MessageCircle,
  Clock3,
  Check,
} from "lucide-react";
import { featuredActivities, dateLabel, timeLabel } from "../data";
import type { Activity } from "../data";
import type { Profile } from "../store";
import { Avatar, Empty } from "../components";
import { Illustration } from "../Illustration";
import { HeroPhoto } from "../HeroPhoto";
import { encountersHeroPhoto } from "../heroPhotos";

export function Discover({
  profile,
  reservations,
  onOpen,
  onProfile,
  onPlaza,
}: {
  profile: Profile | null;
  reservations: string[];
  onOpen: (a: Activity) => void;
  onProfile: () => void;
  onPlaza: () => void;
}) {
  const [filter, setFilter] = useState("Todos");
  const [search, setSearch] = useState("");
  const [personalized, setPersonalized] = useState(false);
  const filtered = featuredActivities.filter(
    (a) =>
      (filter === "Todos" || a.category === filter) &&
      (!personalized || profile?.interests.some((i) => a.tags.includes(i))) &&
      `${a.title} ${a.subtitle} ${a.tags.join(" ")}`
        .toLocaleLowerCase("es")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .includes(
          search
            .toLocaleLowerCase("es")
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, ""),
        ),
  );
  return (
    <div className="discover page-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            Encuentros · Compartir tiempo
          </p>
          <h1>
            {profile
              ? `Qué bueno verte, ${profile.alias}.`
              : "Hay mucho por compartir."}
          </h1>
          <p>
            Conoce personas a través de lo que disfrutas. Sin etiquetas, sin
            apuro.
          </p>
        </div>
        <span className="location">
          <MapPin size={15} /> Desde donde estés{" "}
        </span>
      </div>
      <section className="hero renewed-hero encounter-photo-hero">
        <div className="hero-copy">
          <span className="hero-label">
            <span className="status-dot" /> Un grupo pequeño. Algo por compartir.
          </span>
          <h2>
            Conoce personas <em>compartiendo.</em>
          </h2>
          <p>
            Elige un tema y comparte una conversación, sin presión.
          </p>
          <div className="hero-actions">
            <button
              className="button primary"
              onClick={() =>
                document
                  .getElementById("activities")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Explorar encuentros <ArrowRight size={17} />
            </button>
            <button className="button hero-secondary" onClick={onProfile}>
              {profile ? "Editar mi perfil de prueba" : "Preparar mi perfil"}
            </button>
          </div>
          <span className="hero-footnote">
            <Users size={14} /> Entre 3 y 6 personas · guía opcional · a tu
            ritmo
          </span>
        </div>
        <HeroPhoto
          className="encounter-hero-photo"
          images={encountersHeroPhoto}
          alt="Tres personas adultas usando sus portátiles desde espacios distintos, en una escena ilustrativa de conexión online."
        />
      </section>
      <section
        id="activities"
        className="activities-section"
        aria-labelledby="activities-title"
      >
        <div className="section-heading">
          <div>
            <div className="section-kicker">
              <span className="short-line" /> Temas amplios para coincidir.
            </div>
            <h2 id="activities-title">Tres maneras de empezar.</h2>
            <p>
              Elige una temática. Los intereses específicos surgen al conversar.
            </p>
          </div>
          <span className="virtual-label">
            <Video size={16} /> Todos los encuentros son virtuales
          </span>
        </div>
        <div className="filter-bar">
          <div
            className="filter-tabs"
            aria-label="Filtrar encuentros por categoría"
          >
            {["Todos", "Conversaciones", "Creatividad", "Bienestar"].map(
              (f) => (
                <button
                  key={f}
                  className={filter === f ? "selected" : ""}
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ),
            )}
          </div>
          <div className="search-controls">
            <label className="search-field">
              <Search size={17} />
              <span className="sr-only">Buscar encuentros</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Busca algo que te guste"
              />
            </label>
            <button
              className={`icon-button filter-button ${personalized ? "enabled" : ""}`}
              aria-label={
                personalized
                  ? "Mostrar todos los intereses"
                  : "Filtrar por mis intereses"
              }
              aria-pressed={personalized}
              onClick={() => {
                if (!profile || !profile.interests.length) {
                  onProfile();
                } else setPersonalized(!personalized);
              }}
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>
        </div>
        {personalized && (
          <p className="filter-notice">
            <Sparkles size={15} /> Mostrando intereses que declaraste.{" "}
            <button onClick={() => setPersonalized(false)}>Ver todos</button>
          </p>
        )}
        <p className="sr-only" role="status">
          {filtered.length} encuentros encontrados
        </p>
        {filtered.length ? (
          <div className="activity-grid">
            {filtered.map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                reserved={reservations.includes(a.id)}
                profile={profile}
                onOpen={() => onOpen(a)}
              />
            ))}
          </div>
        ) : (
          <Empty
            icon={<Search />}
            title="Todavía no hay un plan con esa búsqueda"
            text="Prueba con otro interés o vuelve a explorar todos los encuentros de ejemplo."
            action="Ver todos los encuentros"
            onAction={() => {
              setFilter("Todos");
              setSearch("");
              setPersonalized(false);
            }}
          />
        )}
      </section>
      <section
        className="experience-method"
        aria-label="Cómo es la experiencia"
      >
        <div>
          <span>01</span>
          <h3>Comparte un punto de partida</h3>
          <p>Una temática abierta y una dinámica para romper el hielo.</p>
        </div>
        <div>
          <span>02</span>
          <h3>Encuentra tu forma de participar</h3>
          <p>Conversar, pasar, escuchar o enviar un sticker. Tú eliges.</p>
        </div>
        <div>
          <span>03</span>
          <h3>Decide si quieres volver</h3>
          <p>Continuar es opcional y necesita interés recíproco.</p>
        </div>
      </section>
      <div className="encounters-open-door">
        <span>
          <MessageCircle size={19} />
        </span>
        <div>
          <strong>La conversación no tiene que esperar.</strong>
          <p>
            Mientras llega un encuentro, pasa por La Plaza. Puedes compartir
            algo y volver cuando te acomode.
          </p>
        </div>
        <button className="button secondary" onClick={onPlaza}>
          Visitar La Plaza <ArrowRight size={16} />
        </button>
      </div>
      <section className="principles">
        <div className="principle-intro">
          <span className="eyebrow">Aquí, lo importante eres tú</span>
          <h2>
            Conectar se siente mejor
            <br />
            cuando puedes ser tú.
          </h2>
        </div>
        <div className="principle">
          <ShieldCheck size={24} />
          <h3>Tú pones los límites</h3>
          <p>
            Comparte solo lo que quieras.
            <br />
            Tu comodidad va primero.
          </p>
        </div>
        <div className="principle">
          <Leaf size={24} />
          <h3>Sin expectativas impuestas</h3>
          <p>
            No necesitas definir qué vínculo
            <br />
            puede surgir de un encuentro.
          </p>
        </div>
        <div className="principle">
          <Heart size={24} />
          <h3>Pequeños encuentros, más espacio</h3>
          <p>
            Conversaciones con tiempo
            <br />
            para escuchar y participar.
          </p>
        </div>
      </section>
    </div>
  );
}
function ActivityCard({
  activity: a,
  reserved,
  profile,
  onOpen,
}: {
  activity: Activity;
  reserved: boolean;
  profile: Profile | null;
  onOpen: () => void;
}) {
  const shared = profile?.interests.filter((i) => a.tags.includes(i)) || [];
  return (
    <article className="activity-card">
      <button
        className={`card-art ${a.color}`}
        onClick={onOpen}
        data-tour="encounter-detail"
        aria-label={`Ver encuentro: ${a.title}`}
      >
        <span className="card-category">
          {a.category === "Conversaciones" ? (
            <MessageCircle size={13} />
          ) : a.category === "Creatividad" ? (
            <Sparkles size={13} />
          ) : (
            <Leaf size={13} />
          )}{" "}
          {a.category}
        </span>
        <Illustration scene={a.scene} />
        <span className="duration">
          <Clock3 size={12} />
          {a.duration} min
        </span>
      </button>
      <div className="card-content">
        {reserved && (
          <span className="encounter-reserved">
            <Check size={14} /> Tu lugar está reservado
          </span>
        )}
        <div className="card-date">
          {dateLabel(a.startsAt)} <span>·</span> {timeLabel(a.startsAt)} h
        </div>
        <span className="card-timezone">Horario de Santiago · ejemplo</span>
        <h3>
          <button onClick={onOpen}>{a.title}</button>
        </h3>
        <p>{a.subtitle}</p>
        <span className="card-format">
          Una dinámica breve + conversación libre
        </span>
        {shared.length > 0 && (
          <span className="affinity">
            <Sparkles size={12} /> Coincide con tu interés en{" "}
            {shared[0].toLowerCase()}
          </span>
        )}
        <div className="card-bottom">
          <div className="attendees">
            <span className="avatar-stack">
              {a.people.slice(0, 3).map((n, i) => (
                <Avatar key={n} name={n} index={i} small />
              ))}
            </span>
            <span>
              {a.minimum}–{a.capacity} personas · simulación
            </span>
          </div>
          <button
            className={`card-join ${reserved ? "is-reserved" : ""}`}
            aria-label={`${reserved ? "Ver reserva" : "Conocer encuentro"}: ${a.title}`}
            onClick={onOpen}
          >
            {reserved ? "Ver reserva" : "Conocer encuentro"}
            {reserved ? <Check size={17} /> : <ArrowRight size={17} />}
          </button>
        </div>
      </div>
    </article>
  );
}
