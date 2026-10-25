import { useCallback, useEffect, useState } from "react";
import { ImageView } from "../media/ImageView";
import type { SharedMessage } from "../shared/protocol";
import { conductReasons } from "./rules";
export async function safetyRequest(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await response.json();
  if (!response.ok)
    throw Error(
      value.message ||
        (response.status === 403
          ? "No tienes acceso a esta acción."
          : "No se pudo completar la solicitud."),
    );
  return value;
}
type Report = {
  id: string;
  target: string;
  reason: string;
  note: string;
  status: string;
  resolution: string;
  evidence: SharedMessage | { kind: string };
  imageId: string | null;
  createdAt: number;
};
type Appeal = {
  id: string;
  name: string;
  note: string;
  status: string;
  originalKind: string;
  originalReason: string;
};
export function ModerationDesk() {
  const [reports, setReports] = useState<Report[]>([]),
    [appeals, setAppeals] = useState<Appeal[]>([]),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [action, setAction] = useState("dismiss"),
    [reason, setReason] = useState(""),
    [hours, setHours] = useState(24);
  const load = useCallback(async () => {
    try {
      const [r, a] = await Promise.all([
        safetyRequest("/api/moderation/reports"),
        safetyRequest("/api/moderation/appeals"),
      ]);
      setReports(r.reports);
      setAppeals(a.appeals);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const report = reports.find((r) => r.id === selected);
  async function decide(path: string, body: unknown) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await safetyRequest(path, body);
      setNotice("Decisión guardada con su justificación.");
      setReason("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="moderation-desk">
      <summary>Revisión de convivencia · moderación</summary>
      <p>
        Revisa el contexto antes de decidir. Una denuncia o una votación no
        prueban por sí solas una infracción. Solo se muestra la evidencia del
        reporte; no se analizan todos los chats.
      </p>
      <button className="button secondary" onClick={() => void load()}>
        Actualizar cola de revisión
      </button>
      {error && (
        <p className="shared-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <h3>Últimos reportes</h3>
      {!reports.length && <p>No hay reportes en la cola.</p>}
      <div className="moderation-list">
        {reports.map((r) => (
          <button
            className="button secondary"
            key={r.id}
            aria-pressed={selected === r.id}
            onClick={() => {
              setSelected(r.id);
              setReason("");
              setAction("dismiss");
            }}
          >
            {r.target} ·{" "}
            {conductReasons.find((c) => c.id === r.reason)?.label || r.reason} ·{" "}
            {r.status === "open" ? "pendiente" : "revisado"}
          </button>
        ))}
      </div>
      {report && (
        <article className="moderation-case">
          <h4>Reporte sobre {report.target}</h4>
          <p>{report.note || "Sin observaciones adicionales."}</p>
          {"type" in report.evidence &&
            (report.evidence.type === "text" ? (
              <blockquote>{report.evidence.text}</blockquote>
            ) : report.evidence.type === "image" ? (
              <ImageView image={report.evidence.image} shared />
            ) : (
              <p>Sticker señalado: {report.evidence.stickerId}</p>
            ))}
          {report.status === "open" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  confirm(
                    "¿Guardar esta decisión y su justificación? Las restricciones de cuenta afectan a todas sus sesiones.",
                  )
                )
                  void decide("/api/moderation/actions", {
                    reportId: report.id,
                    action,
                    reason,
                    hours,
                  });
              }}
            >
              <label className="field-label" htmlFor="moderation-action">
                Decisión
              </label>
              <select
                id="moderation-action"
                className="text-input"
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                <option value="dismiss">Cerrar sin sanción</option>
                {report.imageId && (
                  <option value="hide-image">Retirar esta imagen</option>
                )}
                <option value="remove-room">Retirar del encuentro</option>
                <option value="suspend">
                  Suspender temporalmente la cuenta
                </option>
                <option value="ban">
                  Banear la cuenta, con derecho a apelar
                </option>
              </select>
              {action === "suspend" && (
                <label className="field-label">
                  Duración en horas (1–168)
                  <input
                    className="text-input"
                    type="number"
                    min={1}
                    max={168}
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                  />
                </label>
              )}
              <label className="field-label" htmlFor="moderation-reason">
                Justificación de la decisión
              </label>
              <textarea
                id="moderation-reason"
                className="text-input"
                minLength={5}
                maxLength={500}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <button
                className="button primary"
                disabled={busy || reason.trim().length < 5}
              >
                Guardar decisión de moderación
              </button>
            </form>
          ) : (
            <p>Resolución: {report.resolution}</p>
          )}
        </article>
      )}
      <h3>Apelaciones pendientes</h3>
      {!appeals.some((a) => a.status === "pending") && (
        <p>No hay apelaciones pendientes.</p>
      )}
      {appeals
        .filter((a) => a.status === "pending")
        .map((a) => (
          <AppealReview
            key={a.id}
            appeal={a}
            busy={busy}
            onDecide={(decision, note) =>
              void decide("/api/moderation/appeals", {
                id: a.id,
                decision,
                note,
              })
            }
          />
        ))}
    </details>
  );
}
function AppealReview({
  appeal,
  busy,
  onDecide,
}: {
  appeal: Appeal;
  busy: boolean;
  onDecide: (decision: string, note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <form
      className="moderation-case"
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <h4>Apelación de {appeal.name}</h4>
      <p>
        Decisión original:{" "}
        {appeal.originalKind === "ban" ? "Baneo" : "Suspensión"}.{" "}
        {appeal.originalReason}
      </p>
      <p>{appeal.note}</p>
      <label className="field-label">
        Justificación de la revisión
        <textarea
          className="text-input"
          minLength={5}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className="session-actions">
        {[
          { id: "restore", label: "Levantar la restricción" },
          { id: "uphold", label: "Mantener la decisión" },
        ].map((d) => (
          <button
            type="button"
            className="button secondary"
            key={d.id}
            disabled={busy || note.trim().length < 5}
            onClick={() => {
              if (confirm(`¿${d.label}? La justificación quedará registrada.`))
                onDecide(d.id, note);
            }}
          >
            {d.label}
          </button>
        ))}
      </div>
    </form>
  );
}
export function AccountRestriction({
  restriction,
}: {
  restriction: {
    kind: string;
    reason: string;
    until: number | null;
    actionId: string;
  };
}) {
  const [note, setNote] = useState(""),
    [appeals, setAppeals] = useState<
      {
        id: string;
        actionId: string;
        status: string;
        note: string;
        reviewNote: string;
      }[]
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const v = await safetyRequest("/api/appeals");
      setAppeals(v.appeals);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, restriction.actionId]);
  return (
    <section className="restriction-notice" aria-label="Restricción de cuenta">
      <h3>
        {restriction.kind === "ban"
          ? "Tu cuenta está baneada."
          : "Tu cuenta está suspendida temporalmente."}
      </h3>
      <p>Motivo: {restriction.reason}</p>
      {restriction.until && (
        <p>Hasta {new Date(restriction.until).toLocaleString("es-CL")}.</p>
      )}
      <p>
        Puedes consultar y apelar la decisión desde aquí. El acceso a los
        encuentros está detenido.
      </p>
      {error && <p role="alert">{error}</p>}
      {!appeals.some((a) => a.actionId === restriction.actionId) && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await safetyRequest("/api/appeals", { note });
              setNote("");
              await load();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field-label" htmlFor="appeal-note">
            Explica tu apelación
          </label>
          <textarea
            id="appeal-note"
            className="text-input"
            required
            minLength={5}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            className="button secondary"
            disabled={busy || note.trim().length < 5}
          >
            Enviar apelación
          </button>
        </form>
      )}
      {appeals.map((a) => (
        <div key={a.id}>
          <strong>
            {a.status === "pending"
              ? "Apelación en revisión"
              : a.status === "restored"
                ? "Restricción levantada"
                : "Decisión mantenida"}
          </strong>
          <p>{a.reviewNote || "No hay respuesta todavía."}</p>
        </div>
      ))}
    </section>
  );
}
