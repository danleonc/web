import { isPlazaPersonBlocked } from "../plaza/data";
import { ConductGuide } from "../safety/ConductGuide";
import { useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Activity } from "../data";
import type { Profile, Feedback } from "../store";
import { Avatar, Modal } from "../components";
import { ChatComposer } from "../chat/ChatComposer";
import { ChatMessageBubble, chatReplyTarget } from "../chat/ChatMessage";
import type { ChatMessage } from "../chat/ChatMessage";
import { useReplyTarget } from "../chat/replies";
import type { StickerActions } from "../chat/stickers";
import { useSession } from "../room/useSession";
import { canChat, formatTime } from "../room/engine";
import {
  Lobby,
  SessionFallback,
  GuidePanel,
  Participants,
  DemoControls,
} from "../room/SessionPanels";

import {
  createSafety,
  resolveSafety,
  startRemoval,
  voteRemoval,
  safetyView,
} from "../safety/rules";
import { RemovalPanel } from "../safety/RemovalPanel";
import { ReportDialog } from "../safety/ReportDialog";
import { saveLocalReport } from "../safety/local";
import { saveImage, deleteImage } from "../media/local";

export function Room({
  activity,
  profile,
  blocked,
  onBlock,
  onFinish,
  onLeave,
  onDiscover,
  onCancelReservation,
  ...stickerActions
}: StickerActions & {
  activity: Activity;
  profile: Profile;
  blocked: string[];
  onBlock: (name: string) => void;
  onFinish: (f: Feedback) => void;
  onLeave: () => void;
  onDiscover: () => void;
  onCancelReservation: () => void;
}) {
  const [roomSafety, setRoomSafety] = useState(createSafety);
  const [report, setReport] = useState<string | null>(null);
  const [ballotError, setBallotError] = useState("");
  const imageIds = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const id of imageIds.current) void deleteImage(id).catch(() => {});
    },
    [],
  );
  const { session, dispatch, now } = useSession(
    activity,
    profile.alias,
    blocked,
    roomSafety.expelled,
  );
  const excluded = session.participants
    .filter((p) => roomSafety.expelled.includes(p.id))
    .map((p) => p.name);
  useEffect(() => {
    setRoomSafety((s) => resolveSafety(s, now));
  }, [now]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [exampleShown, setExampleShown] = useState(false);
  const [stage, setStage] = useState<"room" | "feedback">("room");
  const [safety, setSafety] = useState(false);
  const [reportName, setReportName] = useState(activity.people[0]);
  const [reportReason, setReportReason] = useState("Contacto no deseado");
  const [safetyResult, setSafetyResult] = useState("");
  const [comfort, setComfort] = useState(0);
  const [reconnect, setReconnect] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [repeatGroup, setRepeatGroup] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousPhase = useRef(session.phase);
  useEffect(() => {
    if (
      previousPhase.current !== session.phase &&
      (previousPhase.current === "lobby" ||
        ["lobby", "closed", "insufficient"].includes(session.phase))
    ) {
      headingRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    previousPhase.current = session.phase;
  }, [session.phase]);
  const visiblePeople = session.participants
    .filter(
      (p) => !p.own && p.present && !isPlazaPersonBlocked(p.name, blocked),
    )
    .map((p) => p.name);
  const visibleMessages = messages.filter((m) => m.own || !isPlazaPersonBlocked(m.name, blocked));
  const replyTargets = visibleMessages.map(chatReplyTarget);
  const reply = useReplyTarget<HTMLInputElement>(replyTargets, activity.id, canChat(session) && stage === "room");
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);
  function showExample() {
    const name = visiblePeople[0];
    if (!name || !canChat(session)) return;
    dispatch({
      type: "response",
      id: session.participants.find((p) => p.name === name && !p.own)!.id,
      status: "participated",
      now: Date.now(),
    });
    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        type: "text",
        name,
        text: "Una cosa que me alegró fue hacer tiempo para conversar sin apuro. ¿Y a ti? (Respuesta de ejemplo escrita de antemano)",
        own: false,
      },
    ]);
    setExampleShown(true);
  }
  if (stage === "feedback")
    return (
      <div className="page-content narrow-page">
        <p className="eyebrow">GRACIAS POR COMPARTIR ESTE MOMENTO</p>
        <h1>¿Cómo te sentiste?</h1>
        <p className="page-description">
          Tu experiencia importa. No hay respuestas correctas y no tienes que
          continuar ningún vínculo.
        </p>
        <form
          className="panel feedback-panel"
          onSubmit={(e) => {
            e.preventDefault();
            if (comfort)
              onFinish({
                activityId: activity.id,
                comfort,
                reconnect: reconnect.filter((n) => visiblePeople.includes(n)),
                note: note.trim(),
                repeatGroup,
              });
          }}
        >
          <fieldset>
            <legend>¿Qué tan cómodo te sentiste en esta prueba?</legend>
            <div className="rating-group">
              {[1, 2, 3, 4, 5].map((n) => (
                <label className={comfort === n ? "chosen" : ""} key={n}>
                  <input
                    type="radio"
                    name="comfort"
                    value={n}
                    required
                    checked={comfort === n}
                    onChange={() => setComfort(n)}
                  />
                  <span>{n}</span>
                </label>
              ))}
            </div>
            <div className="rating-labels">
              <span>Nada cómodo</span>
              <span>Muy cómodo</span>
            </div>
          </fieldset>
          <fieldset>
            <legend>
              ¿Con quién te gustaría volver a conversar? <span>(opcional)</span>
            </legend>
            <p className="muted small-text">
              Solo guardaremos tu interés local. Estas personas son ficticias y
              no responderán.
            </p>
            <div className="reconnect-people">
              {visiblePeople.map((name, i) => (
                <label key={name}>
                  <input
                    type="checkbox"
                    checked={reconnect.includes(name)}
                    onChange={() =>
                      setReconnect((s) =>
                        s.includes(name)
                          ? s.filter((n) => n !== name)
                          : [...s, name],
                      )
                    }
                  />
                  <Avatar name={name} index={i} />
                  <span>{name}</span>
                </label>
              ))}
            </div>
            {!visiblePeople.length && (
              <p className="muted">
                No hay participantes disponibles tras tus bloqueos de prueba.
              </p>
            )}
          </fieldset>
          <label className="checkbox-row group-interest">
            <input
              type="checkbox"
              checked={repeatGroup}
              onChange={(e) => setRepeatGroup(e.target.checked)}
            />
            <span>
              Me gustaría repetir una experiencia con este grupo.
              <small>
                Solo guardamos tu interés de prueba. No se agenda nada ni se
                interpreta como aceptación de los demás.
              </small>
            </span>
          </label>
          <label className="field-label" htmlFor="feedback-note">
            ¿Algo que quieras recordar? <span>(opcional)</span>
          </label>
          <textarea
            id="feedback-note"
            className="text-input"
            maxLength={500}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Evita datos íntimos: esta nota se guardará en el navegador."
          />
          <div className="form-actions">
            <button type="button" className="button text" onClick={onLeave}>
              Salir sin guardar evaluación
            </button>
            <button type="submit" className="button primary">
              Guardar y continuar <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </div>
    );
  return (
    <div className="page-content room-page">
      <button className="back-link" onClick={onLeave}>
        <ArrowLeft size={16} /> Salir a mi agenda
      </button>
      <div className="room-heading">
        <div>
          <p className="eyebrow">
            SALA DE PRUEBA · SIN CONEXIÓN CON OTRAS PERSONAS
          </p>
          <h1 ref={headingRef} tabIndex={-1}>
            {activity.title}
          </h1>
          <p className="muted">
            Puedes escuchar, compartir o terminar cuando quieras.
          </p>
        </div>
        {session.sessionUntil > 0 && (
          <button
            className="button secondary"
            onClick={() => {
              dispatch({ type: "close", now: Date.now() });
              setStage("feedback");
            }}
          >
            <LogOut size={16} /> Finalizar encuentro
          </button>
        )}
      </div>
      {session.phase === "lobby" ? (
        <Lobby
          session={session}
          dispatch={dispatch}
          now={now}
          activity={activity}
          onLeave={onLeave}
          onDiscover={onDiscover}
          onCancel={onCancelReservation}
        />
      ) : session.phase === "insufficient" || session.phase === "closed" ? (
        <SessionFallback
          session={session}
          dispatch={dispatch}
          now={now}
          onLeave={onLeave}
          onDiscover={onDiscover}
          onCancel={onCancelReservation}
          onFeedback={() => setStage("feedback")}
        />
      ) : (
        <div className="room-layout">
          <section
            className="conversation panel"
            aria-label="Conversación de prueba"
          >
            <div className="room-top">
              <span>
                <span className="status-dot" /> Simulación local
              </span>
              <button
                className="button text"
                onClick={() => {
                  setSafety(true);
                  setSafetyResult("");
                }}
              >
                <ShieldCheck size={16} /> Seguridad
              </button>
            </div>
            <GuidePanel
              session={session}
              dispatch={dispatch}
              now={now}
              activity={activity}
            />
            <div className="messages">
              <div className="welcome-message">
                <span className="welcome-icon">
                  <MessageCircle size={26} />
                </span>
                <h2>Un espacio para conversar.</h2>
                <p>
                  Escribe un mensaje o envía un sticker para probar el chat.
                  Solo tú puedes leerlo; no se envía ni se guarda al salir.
                </p>
              </div>
              {visibleMessages.map((m) => (
                  <ChatMessageBubble
                    key={m.id}
                    message={m}
                    replyTarget={replyTargets.find((target) => target.id === m.replyTo)}
                    onReply={canChat(session) ? () => reply.select(m.id) : undefined}
                    onReport={
                      !m.own
                        ? () =>
                            setReport(
                              `Mensaje de ${m.name} en ${activity.title}`,
                            )
                        : undefined
                    }
                  />
                ))}
              {!exampleShown && visiblePeople.length > 0 && (
                <button className="example-button" onClick={showExample}>
                  <Plus size={14} /> Mostrar una respuesta ficticia de ejemplo
                </button>
              )}
              <div ref={bottomRef} />
            </div>
            <ChatComposer
              {...stickerActions}
              disabled={!canChat(session)}
              inputRef={reply.inputRef}
              replyTarget={reply.target}
              onCancelReply={reply.clear}
              onTypingChange={(active) =>
                dispatch({
                  type: "typing",
                  id: "self",
                  active,
                  now: Date.now(),
                })
              }
              onSendImage={async (image, blob, replyTo) => {
                if (!canChat(session)) throw Error("La sala está en pausa.");
                await saveImage(image.id, blob);
                imageIds.current.push(image.id);
                setMessages((m) => [
                  ...m,
                  { id: crypto.randomUUID(), type: "image", image, name: profile.alias, own: true, replyTo },
                ]);
                dispatch({
                  type: "response",
                  id: "self",
                  status: "participated",
                  now: Date.now(),
                });
              }}
              onSendText={(text, replyTo) => {
                if (!canChat(session)) return false;
                setMessages((m) => [
                  ...m,
                  { id: crypto.randomUUID(), type: "text", text, name: profile.alias, own: true, replyTo },
                ]);
                dispatch({
                  type: "response",
                  id: "self",
                  status: "participated",
                  now: Date.now(),
                });
              }}
              onSendSticker={(stickerId, replyTo) => {
                if (!canChat(session)) return false;
                setMessages((m) => [
                  ...m,
                  {
                    id: crypto.randomUUID(),
                    replyTo,
                    type: "sticker",
                    stickerId,
                    name: profile.alias,
                    own: true,
                  },
                ]);
                dispatch({
                  type: "response",
                  id: "self",
                  status: "participated",
                  now: Date.now(),
                });
              }}
            />
            <span className="composer-note">
              <LockKeyhole size={11} /> Solo en esta sala local · No compartas
              datos sensibles
            </span>
          </section>
          <aside className="room-aside">
            <Participants session={session} now={now} />
            <ConductGuide />
            <RemovalPanel
              safety={safetyView(roomSafety, "self")}
              people={session.participants}
              me="self"
              now={now}
              canStart={canChat(session)}
              onStart={(id, reason) => {
                setBallotError("");
                setRoomSafety((s) => {
                  const next = startRemoval(
                    s,
                    "self",
                    id,
                    reason,
                    session.participants
                      .filter((p) => p.present)
                      .map((p) => p.id),
                    Date.now(),
                    crypto.randomUUID(),
                  );
                  if (next === s)
                    setBallotError(
                      "Espera dos minutos antes de abrir otra solicitud.",
                    );
                  return next;
                });
              }}
              onVote={(id, choice) =>
                setRoomSafety((s) =>
                  voteRemoval(
                    s,
                    "self",
                    id,
                    choice,
                    session.participants
                      .filter((p) => p.present)
                      .map((p) => p.id),
                    Date.now(),
                  ),
                )
              }
            />
            {ballotError && <p role="alert">{ballotError}</p>}
            {roomSafety.ballot && (
              <details className="demo-controls safety-demo">
                <summary>Simular votos de personajes ficticios</summary>
                <p>
                  Estos botones representan a otras personas solo en esta
                  maqueta. En el piloto cada cuenta emite su propio voto.
                </p>
                {roomSafety.ballot.eligible
                  .filter(
                    (id) => id !== "self" && !roomSafety.ballot!.votes[id],
                  )
                  .map((id) => (
                    <button
                      className="button secondary"
                      key={id}
                      onClick={() =>
                        setRoomSafety((s) =>
                          voteRemoval(
                            s,
                            id,
                            s.ballot!.id,
                            "remove",
                            session.participants
                              .filter((p) => p.present)
                              .map((p) => p.id),
                            Date.now(),
                          ),
                        )
                      }
                    >
                      Simular voto de{" "}
                      {session.participants.find((p) => p.id === id)?.name}
                    </button>
                  ))}
              </details>
            )}
            <div className="host-control panel">
              <span className="note-icon">
                <Sparkles size={21} />
              </span>
              <h3>Un empujoncito, solo si quieres.</h3>
              <p>
                Hasta tres preguntas de guion, con tiempos limitados. La guía no
                lee mensajes ni inventa respuestas. Tiempo del encuentro:{" "}
                {formatTime(session.sessionUntil - now)}.
              </p>
              <button
                className={`toggle-button ${session.guided ? "on" : ""}`}
                role="switch"
                aria-checked={session.guided}
                onClick={() =>
                  dispatch({
                    type: "guide",
                    enabled: !session.guided,
                    now: Date.now(),
                  })
                }
              >
                <span>
                  {session.guided ? "Guion activado" : "Guion desactivado"}
                </span>
                <span className="toggle-track">
                  <span />
                </span>
              </button>
            </div>
            <DemoControls
              session={session}
              dispatch={dispatch}
              now={now}
              unavailable={activity.people.filter(
                (name) =>
                  isPlazaPersonBlocked(name, blocked) ||
                  excluded.includes(name),
              )}
            />
            <p className="small-text muted room-boundaries">
              <ShieldCheck size={15} /> Tus límites:{" "}
              {profile.boundaries.length
                ? profile.boundaries.join(". ") + "."
                : "Puedes editarlos desde tu perfil."}{" "}
              En esta simulación no hay interacciones reales.
            </p>
          </aside>
        </div>
      )}
      {report && (
        <ReportDialog
          subject={report}
          local
          onClose={() => setReport(null)}
          onSubmit={(reason, note) => saveLocalReport(report, reason, note)}
        />
      )}
      {safety && (
        <Modal title="Tu seguridad va primero" onClose={() => setSafety(false)}>
          <div className="modal-content">
            <p>
              Prueba los controles sin enviar una denuncia real. Bloquear oculta
              los mensajes del personaje y lo excluye de tus reencuentros.
            </p>
            <label className="field-label" htmlFor="report-person">
              Participante ficticio
            </label>
            <select
              className="text-input"
              id="report-person"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
            >
              {activity.people.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
            <label className="field-label" htmlFor="report-reason">
              Motivo del ejemplo de denuncia
            </label>
            <select
              id="report-reason"
              className="text-input"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            >
              {[
                "Contacto no deseado",
                "Contenido inapropiado",
                "Suplantación",
                "Otro motivo",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <div className="safety-actions">
              <button
                className="button secondary"
                disabled={isPlazaPersonBlocked(reportName, blocked)}
                onClick={() => {
                  onBlock(reportName);
                  setReconnect((s) => s.filter((n) => n !== reportName));
                  setSafetyResult(
                    `${reportName}: bloqueo activado en esta prueba local.`,
                  );
                }}
              >
                Bloquear participante de prueba
              </button>
              <button
                className="button primary"
                onClick={() =>
                  setSafetyResult(
                    `Ejemplo: denuncia por «${reportReason}» de ${reportName}. No fue enviada ni guardada; no hay un equipo de moderación conectado.`,
                  )
                }
              >
                Simular denuncia
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  setSafety(false);
                  setReport(`Conducta de ${reportName} en ${activity.title}`);
                }}
              >
                Guardar reporte local
              </button>
            </div>
            {safetyResult && (
              <p className="inline-notice" role="status">
                {safetyResult}
              </p>
            )}
            <button
              className="button text-danger full"
              onClick={() => {
                setSafety(false);
                onLeave();
              }}
            >
              Salir ahora de la sala
            </button>
            <p className="small-text muted">
              Este prototipo no es un canal de ayuda ni un servicio de
              emergencias.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
