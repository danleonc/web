import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Modal } from "../components";
import { conductReasons } from "./rules";
import type { ConductReason } from "./rules";
export function ReportDialog({
  subject,
  local = false,
  onClose,
  onSubmit,
}: {
  subject: string;
  local?: boolean;
  onClose: () => void;
  onSubmit: (reason: ConductReason, note: string) => Promise<void> | void;
}) {
  const [reason, setReason] = useState<ConductReason>("acoso");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  return (
    <Modal
      title={done ? "Reporte registrado." : "Reportar una conducta o contenido"}
      onClose={onClose}
    >
      <div className="modal-content safety-report">
        <p>
          <ShieldCheck size={17} /> {subject}
        </p>
        {done ? (
          <>
            <p>
              {local
                ? "Reporte de prueba guardado en este navegador. No se envió a un equipo de moderación."
                : "El reporte quedó en la cola de revisión. No produce un baneo automático ni garantiza atención inmediata."}
            </p>
            <button className="button primary" onClick={onClose}>
              Entendido
            </button>
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await onSubmit(reason, note.trim());
                setDone(true);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "No se pudo registrar.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>
              Describe una infracción concreta. Un desacuerdo o una diferencia
              de personalidad no son, por sí solos, motivo de sanción.
            </p>
            <label className="field-label" htmlFor="conduct-reason">
              Motivo
            </label>
            <select
              id="conduct-reason"
              className="text-input"
              value={reason}
              onChange={(e) => setReason(e.target.value as ConductReason)}
            >
              {conductReasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <label className="field-label" htmlFor="conduct-note">
              Qué ocurrió <span>(opcional, sin datos sensibles)</span>
            </label>
            <textarea
              id="conduct-note"
              className="text-input"
              maxLength={500}
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {error && (
              <p className="shared-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button className="button primary" disabled={busy}>
                {busy
                  ? "Guardando…"
                  : local
                    ? "Guardar reporte de prueba"
                    : "Registrar reporte"}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
