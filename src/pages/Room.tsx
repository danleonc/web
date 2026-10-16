import { useState, useRef, useEffect } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Activity } from "../data";
import type { Profile, Feedback } from "../store";
import { Avatar, Modal } from "../components";

export function Room({
  activity,
  profile,
  blocked,
  onBlock,
  onFinish,
  onLeave,
}: {
  activity: Activity;
  profile: Profile;
  blocked: string[];
  onBlock: (name: string) => void;
  onFinish: (f: Feedback) => void;
  onLeave: () => void;
}) {
  const [facilitator, setFacilitator] = useState(true);
  const [messages, setMessages] = useState<
    { name: string; text: string; own: boolean }[]
  >([]);
  const [draft, setDraft] = useState("");
  const [exampleShown, setExampleShown] = useState(false);
  const [stage, setStage] = useState<"room" | "feedback">("room");
  const [safety, setSafety] = useState(false);
  const [reportName, setReportName] = useState(activity.people[0]);
  const [reportReason, setReportReason] = useState("Contacto no deseado");
  const [safetyResult, setSafetyResult] = useState("");
  const [comfort, setComfort] = useState(0);
  const [reconnect, setReconnect] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const visiblePeople = activity.people.filter(
    (n) => !blocked.includes(`${activity.id}:${n}`),
  );
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);
  function send(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setMessages((m) => [
      ...m,
      { name: profile.alias, text: draft.trim(), own: true },
    ]);
    setDraft("");
  }
  function showExample() {
    const name = visiblePeople[0];
    if (!name) return;
    setMessages((m) => [
      ...m,
      {
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
          <h1>{activity.title}</h1>
          <p className="muted">
            Puedes escuchar, compartir o terminar cuando quieras.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => setStage("feedback")}
        >
          <LogOut size={16} /> Finalizar encuentro
        </button>
      </div>
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
          <div className="messages">
            <div className="welcome-message">
              <span className="welcome-icon">
                <MessageCircle size={26} />
              </span>
              <h2>Un espacio para conversar.</h2>
              <p>
                Escribe un mensaje para probar el chat. Solo tú puedes leerlo;
                no se envía ni se guarda al salir.
              </p>
            </div>
            {facilitator && (
              <div className="host-message">
                <span>
                  <Sparkles size={16} /> Anfitrión · guion de ejemplo
                </span>
                <p>{activity.prompt}</p>
                <small>
                  Puedes omitir la pregunta. No hay IA leyendo esta
                  conversación.
                </small>
              </div>
            )}
            {messages
              .filter(
                (m) => m.own || !blocked.includes(`${activity.id}:${m.name}`),
              )
              .map((m, i) => (
                <div className={`message ${m.own ? "own" : ""}`} key={i}>
                  <Avatar name={m.name} index={m.own ? 4 : 0} small />
                  <div>
                    <span>{m.own ? "Tú" : `${m.name} · ficticia`}</span>
                    <p>{m.text}</p>
                  </div>
                </div>
              ))}
            {!exampleShown && visiblePeople.length > 0 && (
              <button className="example-button" onClick={showExample}>
                <Plus size={14} /> Mostrar una respuesta ficticia de ejemplo
              </button>
            )}
            <div ref={bottomRef} />
          </div>
          <form className="composer" onSubmit={send}>
            <label className="sr-only" htmlFor="message">
              Tu mensaje de prueba
            </label>
            <input
              id="message"
              maxLength={1000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Comparte algo, si te apetece…"
              autoComplete="off"
            />
            <button
              className="send-button"
              disabled={!draft.trim()}
              aria-label="Enviar mensaje de prueba"
            >
              <Send size={18} />
            </button>
          </form>
          <span className="composer-note">
            <LockKeyhole size={11} /> Solo en esta sala local · No compartas
            datos sensibles
          </span>
        </section>
        <aside className="room-aside">
          <div className="panel participants-panel">
            <h3>En este encuentro</h3>
            <p className="small-text muted">Todos son personajes ficticios.</p>
            <div className="participant">
              <Avatar name={profile.alias} index={4} />
              <span>
                {profile.alias}
                <small>Tú · en este navegador</small>
              </span>
            </div>
            {visiblePeople.map((name, i) => (
              <div className="participant" key={name}>
                <Avatar name={name} index={i} />
                <span>
                  {name}
                  <small>Participante de ejemplo</small>
                </span>
              </div>
            ))}
            {blocked.some((b) => b.startsWith(`${activity.id}:`)) && (
              <p className="small-text muted">
                Los participantes bloqueados están ocultos.
              </p>
            )}
          </div>
          <div className="host-control panel">
            <span className="note-icon">
              <Sparkles size={21} />
            </span>
            <h3>Un empujoncito, solo si quieres.</h3>
            <p>
              El anfitrión propone una pregunta inicial. Tú decides si
              participa.
            </p>
            <button
              className={`toggle-button ${facilitator ? "on" : ""}`}
              role="switch"
              aria-checked={facilitator}
              onClick={() => setFacilitator(!facilitator)}
            >
              <span>
                {facilitator ? "Guion activado" : "Guion desactivado"}
              </span>
              <span className="toggle-track">
                <span />
              </span>
            </button>
          </div>
          <p className="small-text muted room-boundaries">
            <ShieldCheck size={15} /> Tus límites:{" "}
            {profile.boundaries.length
              ? profile.boundaries.join(". ") + "."
              : "Puedes editarlos desde tu perfil."}{" "}
            En esta simulación no hay interacciones reales.
          </p>
        </aside>
      </div>
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
                disabled={blocked.includes(`${activity.id}:${reportName}`)}
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
