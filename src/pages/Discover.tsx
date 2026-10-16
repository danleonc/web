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
import { activities, dateLabel, timeLabel } from "../data";
import type { Activity } from "../data";
import type { Profile } from "../store";
import { Avatar, Empty } from "../components";
import { Illustration } from "../Illustration";

export function Discover({
  profile,
  reservations,
  onOpen,
  onProfile,
}: {
  profile: Profile | null;
  reservations: string[];
  onOpen: (a: Activity) => void;
  onProfile: () => void;
}) {
  const [filter, setFilter] = useState("Todos");
  const [search, setSearch] = useState("");
  const [personalized, setPersonalized] = useState(false);
  const filtered = activities.filter(
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
          <p className="eyebrow">MENOS BUSCAR. MÁS COMPARTIR.</p>
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
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-label">
            <span className="status-dot" /> CONEXIONES QUE EMPIEZAN CON ALGO
            SIMPLE
          </span>
          <h2>
            No necesitas saber
            <br />
            qué buscas para
            <br />
            <em>encontrar con quién.</em>
          </h2>
          <p>
            Una conversación, una idea, un interés en común.
            <br className="desktop-break" /> A veces, eso es todo lo que hace
            falta para empezar.
          </p>
          <button
            className="button primary"
            onClick={() =>
              profile
                ? document
                    .getElementById("activities")
                    ?.scrollIntoView({ behavior: "smooth" })
                : onProfile()
            }
          >
            {profile ? "Explorar encuentros" : "Encuentra tu punto de partida"}
            <ArrowRight size={17} />
          </button>
          <span className="hero-footnote">
            <Users size={14} /> Grupos pequeños. Espacio para ser tú.
          </span>
        </div>
        <Illustration hero />
        <span className="hero-sticker">
          <Sparkles size={15} /> Las afinidades se descubren
        </span>
      </section>
      <section
        id="activities"
        className="activities-section"
        aria-labelledby="activities-title"
      >
        <div className="section-heading">
          <div>
            <div className="section-kicker">
              <span className="short-line" /> TU PRÓXIMO BUEN MOMENTO
            </div>
            <h2 id="activities-title">Un plan, una nueva conexión.</h2>
            <p>
              Experiencias sencillas para compartir con personas que aún no
              conoces.
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
      <section className="principles">
        <div className="principle-intro">
          <span className="eyebrow">AQUÍ, LO IMPORTANTE ERES TÚ</span>
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
        <div className="card-date">
          {dateLabel(a.startsAt)} <span>·</span> {timeLabel(a.startsAt)} h
        </div>
        <h3>
          <button onClick={onOpen}>{a.title}</button>
        </h3>
        <p>{a.subtitle}</p>
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
              {reserved
                ? "Tu lugar está reservado"
                : `${a.capacity - a.occupied} lugares de ejemplo`}
            </span>
          </div>
          <button
            className={`card-join ${reserved ? "is-reserved" : ""}`}
            aria-label={`${reserved ? "Ver reserva" : "Conocer encuentro"}: ${a.title}`}
            onClick={onOpen}
          >
            {reserved ? <Check size={19} /> : <ArrowRight size={19} />}
          </button>
        </div>
      </div>
    </article>
  );
}
