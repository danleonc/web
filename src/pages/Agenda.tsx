import { useState } from "react";
import { ArrowRight, CalendarDays, Users, CheckCheck, Clock3, Check } from "lucide-react";
import { activities, dateLabel, timeLabel } from "../data";
import type { Activity } from "../data";
import type { LocalState } from "../store";
import { Empty, Modal } from "../components";
import { Illustration } from "../Illustration";

export function Agenda({
  state,
  onDiscover,
  onOpen,
  onEnter,
  onCancel,
}: {
  state: LocalState;
  onDiscover: () => void;
  onOpen: (a: Activity) => void;
  onEnter: (a: Activity) => void;
  onCancel: (id: string) => void;
}) {
  const [cancelId, setCancelId] = useState<string | null>(null);
  const reserved = activities.filter((a) => state.reservations.includes(a.id));
  return (
    <div className="page-content agenda-page">
      <p className="eyebrow">Mi agenda · Un espacio en tu día</p>
      <h1>Tu agenda, a tu ritmo.</h1>
      <p className="page-description">
        Revisa tus reservas y entra a la recepción cuando quieras probar el encuentro.
      </p>
      <div className="inline-notice">
        <CalendarDays size={18} /> Fechas y reservas de ejemplo. Puedes entrar a
        las salas de prueba en cualquier momento.
      </div>
      {reserved.length ? (
        <div className="agenda-list">
          {reserved.map((a) => (
            <article className="agenda-card panel" key={a.id}>
              <div className={`agenda-art ${a.color}`}>
                <Illustration scene={a.scene} />
              </div>
              <div className="agenda-content">
                <div className="agenda-card-status">
                  <span className="tag">{a.category}</span>
                  <span className="reservation-saved"><Check size={14} /> Reserva de prueba guardada</span>
                </div>
                <h2>{a.title}</h2>
                <p>
                  <CalendarDays size={16} />
                  {dateLabel(a.startsAt)} · {timeLabel(a.startsAt)} h · Santiago
                </p>
                <p>
                  <Users size={16} /> Entre {a.minimum} y {a.capacity}{" "}
                  participantes ficticios
                </p>
                <p><Clock3 size={16} /> {a.duration} minutos · guía opcional</p>
                <p className="agenda-next-step">Primero entras a la recepción. El encuentro puede comenzar con {a.minimum} personas, sin llenar los {a.capacity} cupos.</p>
                {state.feedback.some((f) => f.activityId === a.id) && (
                  <span className="completed-label">
                    <CheckCheck size={14} /> Ya completaste esta simulación
                  </span>
                )}
                <div className="agenda-actions">
                  <button className="button primary" onClick={() => onEnter(a)}>
                    Entrar a la sala de prueba <ArrowRight size={16} />
                  </button>
                  <button className="button text" onClick={() => onOpen(a)}>
                    Ver detalles
                  </button>
                  <button
                    className="button text-danger"
                    onClick={() => setCancelId(a.id)}
                  >
                    Cancelar reserva
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={<CalendarDays />}
          title="Todavía tienes espacio para un buen plan"
          text="Explora los encuentros y reserva un lugar de prueba. No se enviarán invitaciones ni recordatorios."
          action="Descubrir encuentros"
          onAction={onDiscover}
        />
      )}
      {cancelId && (
        <Modal
          title="¿Cancelar esta reserva de prueba?"
          onClose={() => setCancelId(null)}
        >
          <div className="modal-content">
            <p>
              Puedes volver a reservar cuando quieras. Tu perfil y evaluación se
              conservarán.
            </p>
            <div className="modal-actions">
              <button
                className="button secondary"
                onClick={() => setCancelId(null)}
              >
                Conservar reserva
              </button>
              <button
                className="button danger"
                onClick={() => {
                  onCancel(cancelId);
                  setCancelId(null);
                }}
              >
                Sí, cancelar reserva
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
