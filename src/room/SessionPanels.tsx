import type { Dispatch } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  Headphones,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Avatar } from "../components";
import type { Activity } from "../data";
import { formatTime, majority, presentPeople } from "./engine";
import type { Participant, Session, SessionEvent } from "./engine";
export const responseLabels: Record<Participant["status"], string> = {
  pending: "Puede responder",
  participated: "Compartió algo",
  ready: "Listo por ahora",
  pass: "Pasó esta pregunta",
  listen: "Solo escucha",
  "no-response": "Sin respuesta en esta ronda",
};
type PanelProps = {
  session: Session;
  dispatch: Dispatch<SessionEvent>;
  now: number;
};
export function Lobby({
  session,
  dispatch,
  now,
  activity,
  onLeave,
  onDiscover,
  onCancel,
}: PanelProps & {
  activity: Activity;
  onLeave: () => void;
  onDiscover: () => void;
  onCancel: () => void;
}) {
  const count = presentPeople(session).length;
  return (
    <section className="session-lobby panel" aria-labelledby="lobby-title">
      <div className="lobby-symbol">
        <Users size={30} />
      </div>
      <p className="eyebrow">
        RECEPCIÓN SIMULADA · LA GUÍA NO CUENTA EN EL QUÓRUM
      </p>
      <h2 id="lobby-title">Un grupo pequeño, espacio para cada persona.</h2>
      <p>
        Este encuentro necesita entre{" "}
        <strong>
          {session.minimum} y {session.maximum} personas
        </strong>
        . Tú estás presente; los demás asistentes son personajes que puedes
        añadir o retirar para probar las reglas.
      </p>
      <div className="quorum-count">
        <strong>{count}</strong>
        <span>
          presentes de ejemplo
          <br />
          mínimo {session.minimum} · máximo {session.maximum}
        </span>
        <span className="time-pill">
          <Clock3 size={15} />
          <span aria-label="Tiempo de recepción">
            {formatTime(session.lobbyUntil - now)}
          </span>
        </span>
      </div>
      <DemoControls session={session} dispatch={dispatch} now={now} expanded />
      <div className="lobby-rules">
        <span>
          <Check size={15} /> Con el mínimo, puede comenzar sin llenar todos los
          cupos.
        </span>
        <span>
          <Clock3 size={15} /> Espera máxima: 5 minutos. No hay traslados ni
          nuevas fechas automáticas.
        </span>
        <span>
          <ShieldCheck size={15} /> Después: 90 segundos por pregunta, una
          extensión de 30 segundos y conversación libre.
        </span>
      </div>
      <div className="session-actions">
        <button
          className="button primary"
          disabled={count < session.minimum}
          onClick={() => dispatch({ type: "start", now: Date.now() })}
        >
          Comenzar encuentro de prueba <ArrowRight size={16} />
        </button>
        <button
          className="button secondary"
          onClick={() => dispatch({ type: "finish-wait", now: Date.now() })}
        >
          Simular fin de espera
        </button>
        <button className="button text" onClick={onLeave}>
          Salir y conservar reserva
        </button>
      </div>
      <details className="session-details">
        <summary>Otras opciones de reserva</summary>
        <p>Tu reserva de {activity.title} solo cambia si tú lo decides.</p>
        <button className="button text" onClick={onDiscover}>
          Explorar otros encuentros
        </button>
        <button className="button text-danger" onClick={onCancel}>
          Cancelar mi reserva de prueba
        </button>
      </details>
    </section>
  );
}
export function SessionFallback({
  session,
  dispatch,
  onLeave,
  onDiscover,
  onCancel,
  onFeedback,
}: PanelProps & {
  onLeave: () => void;
  onDiscover: () => void;
  onCancel: () => void;
  onFeedback: () => void;
}) {
  const closed = session.phase === "closed";
  return (
    <section className="session-lobby panel" aria-labelledby="fallback-title">
      <div className="lobby-symbol">
        <Clock3 size={29} />
      </div>
      <p className="eyebrow">ESTADO DE LA SIMULACIÓN</p>
      <h2 id="fallback-title">
        {closed
          ? "Cerramos este momento compartido."
          : "Esta vez no alcanzamos el mínimo."}
      </h2>
      <p role="status">{session.notice}</p>
      <p className="muted small-text">
        No se cambia de formato, no se combina con otro grupo y no se modifica
        ninguna fecha automáticamente.
      </p>
      <div className="session-actions">
        {closed ? (
          <button className="button primary" onClick={onFeedback}>
            Evaluar este encuentro
          </button>
        ) : (
          <button
            className="button primary"
            onClick={() => dispatch({ type: "retry", now: Date.now() })}
          >
            Volver a probar la recepción
          </button>
        )}
        <button className="button secondary" onClick={onDiscover}>
          Ver otras opciones
        </button>
        <button className="button text" onClick={onLeave}>
          Salir y conservar reserva
        </button>
        {!closed && (
          <button className="button text-danger" onClick={onCancel}>
            Cancelar mi reserva de prueba
          </button>
        )}
      </div>
    </section>
  );
}
export function GuidePanel({
  session,
  dispatch,
  now,
  activity,
}: PanelProps & { activity: Activity }) {
  const own = session.participants.find((p) => p.own)!;
  if (session.phase === "paused")
    return (
      <div className="guide-panel paused-guide" role="status">
        <h2>Una pausa para recuperar el grupo.</h2>
        <p>{session.notice}</p>
        <span className="time-pill">
          <Clock3 size={15} />
          {formatTime(session.reconnectUntil - now)}
        </span>
      </div>
    );
  if (!session.guided)
    return (
      <div className="guide-off">
        <MessageCircle size={17} />
        <span>
          Conversación libre. La guía está desactivada; tus mensajes siguen
          disponibles.
        </span>
      </div>
    );
  return (
    <section className="guide-panel" aria-label="Guía del encuentro">
      <div className="guide-title">
        <span>
          <Sparkles size={16} /> Anfitrión · guion de ejemplo
        </span>
        <span className="time-pill">
          <Clock3 size={13} />
          {session.phase === "question" ? (
            <span aria-label="Tiempo de respuesta">
              {formatTime(session.roundUntil - now)}
            </span>
          ) : (
            "Conversación libre"
          )}
        </span>
      </div>
      {session.phase === "question" ? (
        <>
          <p className="guide-question">
            {activity.questions[session.question]}
          </p>
          <div className="round-controls">
            <button
              className={`button secondary ${own.status === "ready" ? "marked" : ""}`}
              aria-pressed={own.status === "ready"}
              onClick={() =>
                dispatch({
                  type: "response",
                  id: "self",
                  status: "ready",
                  now: Date.now(),
                })
              }
            >
              <Check size={14} /> Listo por ahora
            </button>
            <button
              className={`button secondary ${own.status === "pass" ? "marked" : ""}`}
              aria-pressed={own.status === "pass"}
              onClick={() =>
                dispatch({
                  type: "response",
                  id: "self",
                  status: "pass",
                  now: Date.now(),
                })
              }
            >
              Paso esta pregunta
            </button>
            <button
              className="button text"
              disabled={session.extended}
              onClick={() => dispatch({ type: "extend", now: Date.now() })}
            >
              {session.extended
                ? "Extensión ya utilizada"
                : "+30 s para responder"}
            </button>
          </div>
        </>
      ) : (
        <>
          <h2>Ahora hay espacio para conversar.</h2>
          <p className="guide-notice" role="status">
            {session.notice}
          </p>
          {session.question + 1 < session.questionCount ? (
            <div className="next-question">
              <button
                className="button secondary"
                disabled={session.votes.includes("self")}
                onClick={() =>
                  dispatch({ type: "vote", id: "self", now: Date.now() })
                }
              >
                {session.votes.includes("self")
                  ? "Tu voto está registrado"
                  : "Otra pregunta"}
              </button>
              <span role="status">
                {session.votes.length} de {majority(session)} votos necesarios.
                Sin mayoría, seguimos conversando.
              </span>
            </div>
          ) : (
            <p className="small-text muted">
              Completamos las {session.questionCount} preguntas previstas. No
              añadiremos más automáticamente.
            </p>
          )}
        </>
      )}
      <div className="listen-control">
        <button
          className="button text"
          aria-pressed={own.status === "listen"}
          onClick={() =>
            dispatch({
              type: "response",
              id: "self",
              status: own.status === "listen" ? "pending" : "listen",
              now: Date.now(),
            })
          }
        >
          <Headphones size={14} />
          {own.status === "listen" ? "Quiero participar" : "Solo escucho"}
        </button>
        <span>
          Preguntas {Math.max(0, session.question + 1)}/{session.questionCount}{" "}
          · no hay obligación de responder.
        </span>
      </div>
      <small className="guide-disclosure">
        No hay IA leyendo esta conversación. Las preguntas son un guion local y
        el teclado no decide cuándo avanzar.
      </small>
      {session.phase === "question" && (
        <p className="guide-notice" role="status">
          {session.notice}
        </p>
      )}
    </section>
  );
}
export function Participants({
  session,
  now,
}: Pick<PanelProps, "session" | "now">) {
  return (
    <div className="panel participants-panel">
      <h3>En este encuentro</h3>
      <p className="small-text muted">
        {presentPeople(session).length} presentes de ejemplo · mínimo{" "}
        {session.minimum}, máximo {session.maximum}. La guía no cuenta.
      </p>
      {presentPeople(session).map((p, i) => (
        <div className="participant" key={p.id}>
          <Avatar name={p.name} index={p.own ? 4 : i} />
          <span>
            {p.name}
            {p.own ? " · tú" : ""}
            <small>
              {p.typingUntil > now ? "Escribiendo…" : responseLabels[p.status]}
            </small>
          </span>
        </div>
      ))}
    </div>
  );
}
export function DemoControls({
  session,
  dispatch,
  expanded = false,
  unavailable = [],
}: PanelProps & { expanded?: boolean; unavailable?: string[] }) {
  const lobby = session.phase === "lobby";
  return (
    <details className="demo-people" open={expanded || undefined}>
      <summary>
        {lobby ? "Asistencia de ejemplo" : "Controles de simulación"}
      </summary>
      <p>
        Estas acciones representan a personajes ficticios. No son respuestas,
        presencia ni votos de personas reales.
      </p>
      {session.participants
        .filter((p) => !p.own)
        .map((p) => (
          <div className="demo-person" key={p.id}>
            <label>
              <input
                type="checkbox"
                checked={p.present}
                disabled={
                  unavailable.includes(p.name) ||
                  (!p.present &&
                    presentPeople(session).length >= session.maximum)
                }
                onChange={(e) =>
                  dispatch({
                    type: "presence",
                    id: p.id,
                    present: e.target.checked,
                    now: Date.now(),
                  })
                }
              />
              <span>{p.name}</span>
            </label>
            {p.present && !lobby && (
              <div className="demo-person-actions">
                {session.phase === "question" && (
                  <>
                    <button
                      onClick={() =>
                        dispatch({
                          type: "response",
                          id: p.id,
                          status: "ready",
                          now: Date.now(),
                        })
                      }
                      disabled={p.status === "ready"}
                    >
                      Listo: {p.name}
                    </button>
                    <button
                      onClick={() =>
                        dispatch({
                          type: "typing",
                          id: p.id,
                          active: true,
                          now: Date.now(),
                        })
                      }
                    >
                      Simular escritura: {p.name}
                    </button>
                  </>
                )}
                {session.phase === "conversation" &&
                  session.guided &&
                  session.question + 1 < session.questionCount && (
                    <button
                      disabled={session.votes.includes(p.id)}
                      onClick={() =>
                        dispatch({ type: "vote", id: p.id, now: Date.now() })
                      }
                    >
                      Votar otra pregunta: {p.name}
                    </button>
                  )}
              </div>
            )}
          </div>
        ))}
    </details>
  );
}
