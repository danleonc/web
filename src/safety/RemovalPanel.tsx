import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { SafetyView, ConductReason, Choice } from "./rules";
import { conductReasons } from "./rules";
import { formatTime } from "../room/engine";
export function RemovalPanel({
  safety,
  people,
  me,
  now,
  canStart,
  onStart,
  onVote,
}: {
  safety: SafetyView;
  people: { id: string; name: string; present: boolean }[];
  me: string;
  now: number;
  canStart: boolean;
  onStart: (targetId: string, reason: ConductReason) => void;
  onVote: (id: string, choice: Choice) => void;
}) {
  const options = people.filter(
    (p) => p.id !== me && p.present && !safety.expelled.includes(p.id),
  );
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState<ConductReason>("acoso");
  const id = options.some((p) => p.id === target)
    ? target
    : options[0]?.id || "";
  const ballot = safety.ballot;
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (ballot) setExpanded(true);
  }, [ballot?.id]);
  return (
    <section
      className="removal-panel panel"
      aria-label="Convivencia del encuentro"
    >
      <details
        open={expanded}
        onToggle={(e) => setExpanded(e.currentTarget.open)}
      >
        <summary>
          <ShieldCheck size={18} /> Cuidar este encuentro
        </summary>
        <p>
          Bloquear o reportar es una decisión personal. La expulsión afecta solo
          a esta sala; un baneo de cuenta requiere revisión.
        </p>
        {safety.notice && (
          <p className="safety-notice" role="status">
            {safety.notice}
          </p>
        )}
        {ballot ? (
          <div className="removal-ballot">
            <strong>
              Votación sobre{" "}
              {people.find((p) => p.id === ballot.targetId)?.name ||
                "un participante"}
            </strong>
            <p>
              Motivo:{" "}
              {conductReasons.find((r) => r.id === ballot.reason)?.label}.
              Quedan {formatTime(ballot.until - now)}.
            </p>
            <p>
              {ballot.castCount} de {ballot.eligibleCount} votos registrados. Se
              requieren {ballot.threshold} a favor. Los votos individuales son
              privados.
            </p>
            {ballot.canVote ? (
              <div className="session-actions">
                <button
                  className="button secondary"
                  onClick={() => onVote(ballot.id, "remove")}
                >
                  A favor de retirar
                </button>
                <button
                  className="button secondary"
                  onClick={() => onVote(ballot.id, "keep")}
                >
                  En contra de retirar
                </button>
              </div>
            ) : (
              <p>
                {ballot.yourVote
                  ? "Tu voto quedó registrado. No se puede cambiar."
                  : "No estás habilitado para votar en esta solicitud."}
              </p>
            )}
          </div>
        ) : (
          <>
            <label className="field-label" htmlFor="removal-person">
              Participante
            </label>
            <select
              id="removal-person"
              className="text-input"
              value={id}
              onChange={(e) => setTarget(e.target.value)}
              disabled={!canStart}
            >
              {options.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="field-label" htmlFor="removal-reason">
              Conducta que infringe las normas
            </label>
            <select
              id="removal-reason"
              className="text-input"
              value={reason}
              onChange={(e) => setReason(e.target.value as ConductReason)}
              disabled={!canStart}
            >
              {conductReasons.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <button
              className="button secondary full"
              disabled={!canStart || options.length < 2 || !id}
              onClick={() => onStart(id, reason)}
            >
              Solicitar expulsión por votación
            </button>
            <p className="small-text muted">
              Un minuto para votar, mínimo dos votos y mayoría de los demás
              presentes al abrir la solicitud. Se inicia con tu voto a favor. El
              silencio no cuenta. Hay dos minutos entre solicitudes.
            </p>
          </>
        )}
      </details>
    </section>
  );
}
