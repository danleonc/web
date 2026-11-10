import { useState } from "react";
import { safetyRequest } from "./ModerationDesk";

type Evidence = { title: string; body: string };
type Action = { reportId: string; evidence: Evidence; decisionReason: string; appealStatus: string | null };
type Appeal = { id: string; author: string; evidence: Evidence; note: string; status: string };
function MyCase({ action, reload }: { action: Action; reload: () => Promise<void> }) {
  const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <article className="moderation-case"><h3>{action.evidence.title}</h3><p>{action.evidence.body}</p><p>Motivo de la decisión: {action.decisionReason}</p>
    {action.appealStatus === "pending" ? <p>Apelación pendiente</p> : action.appealStatus === "restored" ? <p>Apelación aceptada. El contenido podría seguir oculto si existen otras decisiones vigentes.</p> : action.appealStatus === "upheld" ? <p>Retirada confirmada</p> : <form className="real-plaza-form" onSubmit={(e) => {
      e.preventDefault(); if (busy) return; setBusy(true); setError("");
      void safetyRequest("/api/plaza/appeals", { reportId: action.reportId, note }).then(reload).catch(() => setError("No pudimos enviar la apelación. Inténtalo de nuevo.")).finally(() => setBusy(false));
    }}><label>Por qué solicitas una revisión<textarea value={note} onChange={(e) => setNote(e.target.value)} minLength={5} maxLength={1000} required /></label>{error && <p role="alert">{error}</p>}<button className="button primary" disabled={busy || note.trim().length < 5}>Enviar apelación</button></form>}
  </article>;
}
export function MyPlazaAppeals() {
  const [actions, setActions] = useState<Action[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function load() { setLoading(true); setError(""); try { setActions((await safetyRequest("/api/plaza/my-moderation")).actions as Action[]); } catch { setError("No pudimos cargar tus contenidos retirados."); } finally { setLoading(false); } }
  return <details className="real-plaza-panel" onToggle={(e) => { if (e.currentTarget.open) void load(); }}><summary>Mis contenidos retirados</summary>
    <p>Puedes solicitar una revisión de una decisión de retirada.</p>{loading && <p role="status">Cargando…</p>}{error && <p role="alert">{error}</p>}
    {!loading && !error && actions.length === 0 && <p>No tienes contenidos retirados.</p>}{actions.map((action) => <MyCase key={action.reportId} action={action} reload={load} />)}
  </details>;
}
function AppealCase({ appeal, reload }: { appeal: Appeal; reload: () => Promise<void> }) {
  const [decision, setDecision] = useState("uphold"); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <article className="moderation-case"><h3>{appeal.evidence.title}</h3><p>Contenido de {appeal.author}</p><blockquote>{appeal.evidence.body}</blockquote><p>{appeal.note}</p>
    {appeal.status === "restored" ? <p>Apelación aceptada</p> : appeal.status === "upheld" ? <p>Retirada confirmada</p> : <form className="real-plaza-form" onSubmit={(e) => {
      e.preventDefault(); if (busy) return; setBusy(true); setError("");
      void safetyRequest("/api/plaza/moderation/appeals", { id: appeal.id, decision, note }).then(reload).catch(() => setError("No pudimos guardar la revisión. Debe revisarla otra persona moderadora y el contenido debe seguir disponible.")).finally(() => setBusy(false));
    }}><label>Resultado de la revisión<select value={decision} onChange={(e) => setDecision(e.target.value)}><option value="uphold">Mantener retirada</option><option value="restore">Aceptar apelación</option></select></label><label>Justificación de la revisión<textarea value={note} onChange={(e) => setNote(e.target.value)} minLength={5} maxLength={1000} required /></label>{error && <p role="alert">{error}</p>}<button className="button primary" disabled={busy || note.trim().length < 5}>Guardar revisión</button></form>}
  </article>;
}
export function PlazaAppealDesk() {
  const [appeals, setAppeals] = useState<Appeal[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function load() { setLoading(true); setError(""); try { setAppeals((await safetyRequest("/api/plaza/moderation/appeals")).appeals as Appeal[]); } catch { setError("No pudimos cargar las apelaciones."); } finally { setLoading(false); } }
  return <details className="real-plaza-panel" onToggle={(e) => { if (e.currentTarget.open) void load(); }}><summary>Apelaciones de Plaza · moderación</summary>
    <p>La revisión debe hacerla una persona moderadora distinta de quien tomó la decisión inicial.</p>{loading && <p role="status">Cargando…</p>}{error && <p role="alert">{error}</p>}
    {!loading && !error && appeals.length === 0 && <p>No hay apelaciones de Plaza.</p>}{appeals.map((appeal) => <AppealCase key={appeal.id} appeal={appeal} reload={load} />)}
  </details>;
}
