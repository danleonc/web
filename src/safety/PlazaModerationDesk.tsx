import { useState } from "react";
import { safetyRequest } from "./ModerationDesk";
import { conductReasons } from "./rules";
import { getSticker } from "../chat/stickers";

type Report = { id: string; target: string; kind: string; reason: string; note: string; status: string; hasImage: number; evidence: { title: string; body: string; stickerId?: string } };
function Case({ report, onUpdated }: { report: Report; onUpdated: () => Promise<void> }) {
  const [action, setAction] = useState("dismiss");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <article className="moderation-case">
    <h3>{report.evidence.title}</h3>
    <p>Contenido de {report.target} · {conductReasons.find((r) => r.id === report.reason)?.label || report.reason}</p>
    <blockquote>{report.evidence.body}</blockquote>
    {report.evidence.stickerId && getSticker(report.evidence.stickerId) && <img className="real-sticker" src={getSticker(report.evidence.stickerId)!.src} alt={`Sticker reportado: ${getSticker(report.evidence.stickerId)!.label}`} />}
    {!!report.hasImage && <img className="real-sticker" src={`/api/plaza/moderation/images/${report.id}`} alt="Imagen incluida en el reporte" />}
    <p>{report.note || "Sin observaciones adicionales."}</p>
    {report.status !== "open" ? <p>Revisado</p> : <form onSubmit={(e) => {
      e.preventDefault(); if (busy) return; setBusy(true); setError("");
      void safetyRequest("/api/plaza/moderation/actions", { reportId: report.id, action, reason }).then(async () => { await onUpdated(); }).catch(() => setError("No se pudo guardar la decisión. Vuelve a intentarlo." )).finally(() => setBusy(false));
    }} className="real-plaza-form">
      <label>Decisión de Plaza<select value={action} onChange={(e) => setAction(e.target.value)}><option value="dismiss">Cerrar sin retirar</option><option value="hide">Retirar contenido</option></select></label>
      <label>Justificación de Plaza<textarea value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} maxLength={500} required /></label>
      {error && <p role="alert">{error}</p>}<button className="button primary" disabled={busy || reason.trim().length < 5}>Guardar decisión de Plaza</button>
    </form>}
  </article>;
}
export function PlazaModerationDesk() {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true); setError("");
    try { setReports((await safetyRequest("/api/plaza/moderation/reports")).reports as Report[]); }
    catch { setError("No pudimos cargar los reportes de Plaza."); }
    finally { setLoading(false); }
  }
  return <details className="real-plaza-panel" onToggle={(e) => { if (e.currentTarget.open) void load(); }}>
    <summary>Revisión de Plaza · moderación</summary>
    <p>Un reporte requiere revisión; no implica una sanción automática.</p>
    <button className="button secondary" onClick={() => void load()}>Actualizar reportes de Plaza</button>
    {loading && <p role="status">Cargando reportes…</p>}{error && <p role="alert">{error}</p>}
    {!loading && !error && reports.length === 0 && <p>No hay reportes de Plaza.</p>}
    {reports.map((report) => <Case key={report.id} report={report} onUpdated={load} />)}
  </details>;
}
