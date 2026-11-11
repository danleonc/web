import { useCallback, useEffect, useState } from "react";
import { safetyRequest } from "../safety/ModerationDesk";

type RequestState = { status: "pending" | "seen" | "cancelled"; version: number };
type QueueItem = RequestState & { userId: string; alias: string };
export function PrivacyRequest() {
  const [request, setRequest] = useState<RequestState | null>(null); const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async () => { try { const data = await safetyRequest("/api/privacy/request"); setRequest(data.request); setError(""); } catch { setError("No pudimos consultar la solicitud."); } finally { setLoaded(true); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function change(action: "submit" | "cancel") { if (busy) return; setBusy(true); setError(""); try { const data = await safetyRequest("/api/privacy/request", { action }); setRequest(data.request); } catch { setError("No pudimos actualizar la solicitud."); } finally { setBusy(false); } }
  return <details className="account-history"><summary>Solicitud de eliminación de cuenta</summary>
    <p>Función en pruebas internas: registra una solicitud para revisión. No elimina la cuenta ni envía un aviso automático; todavía no hay un servicio de atención activo.</p>
    {!loaded ? <p role="status">Consultando solicitud…</p> : !request ? <p>No hay una solicitud registrada.</p> : request.status === "pending" ? <p role="status">Solicitud registrada para revisión. La cuenta aún no se ha eliminado.</p> : request.status === "seen" ? <p role="status">Recibida para revisión. La cuenta aún no se ha eliminado.</p> : <p role="status">Solicitud cancelada. La cuenta sigue activa.</p>}
    {error && <p role="alert">{error}</p>}
    {loaded && <div className="session-actions"><button className="button secondary" disabled={busy} onClick={() => void load()}>Actualizar estado de solicitud</button>{!request || request.status === "cancelled" ? <button className="button secondary" disabled={busy} onClick={() => void change("submit")}>Registrar solicitud</button> : <button className="button text" disabled={busy} onClick={() => void change("cancel")}>Cancelar solicitud</button>}</div>}
  </details>;
}
export function PrivacyDesk({ accountId }: { accountId: string }) {
  const [items, setItems] = useState<QueueItem[]>([]); const [loaded, setLoaded] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { const data = await safetyRequest("/api/privacy/queue"); setItems(data.requests); setError(""); setLoaded(true); } catch { setLoaded(false); setError("No pudimos cargar la cola de privacidad."); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function acknowledge(item: QueueItem) { if (busy) return; setBusy(true); setError(""); try { await safetyRequest("/api/privacy/ack", { userId: item.userId, version: item.version }); await load(); } catch { setError("La solicitud cambió o no se pudo actualizar. Vuelve a cargar la cola."); } finally { setBusy(false); } }
  return <details className="account-history"><summary>Cola de privacidad</summary>
    <p>Solo registra la recepción; no elimina cuentas ni datos. La operación y el procedimiento de eliminación siguen pendientes. Se muestran hasta 100 solicitudes.</p>
    <button className="button secondary" disabled={busy} onClick={() => void load()}>Actualizar cola de privacidad</button>{error && <p role="alert">{error}</p>}
    {loaded && (!items.length ? <p>No hay solicitudes para revisión.</p> : items.map((item) => <article className="account-offering" key={item.userId}><h3>{item.alias}</h3><p>{item.status === "pending" ? "Pendiente de recepción" : "Recibida para revisión"}</p>{item.status === "pending" && (item.userId === accountId ? <p>Otra persona de privacidad debe acusar recibo de tu solicitud.</p> : <button className="button secondary" disabled={busy} onClick={() => void acknowledge(item)}>Acusar recibo</button>)}</article>))}
  </details>;
}
