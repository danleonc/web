import { useCallback, useEffect, useState } from "react";
import { safetyRequest } from "../safety/ModerationDesk";

type RequestState = { status: "pending" | "seen" | "cancelled"; version: number };
type QueueItem = RequestState & { userId: string; alias: string };
type Inventory = { counts: Record<string, number>; limitations: string[] };
const inventoryLabels: Record<string, string> = {
  accounts: "Cuentas", emails: "Correos", googleLinks: "Vínculos de Google", googleFlows: "Procesos de Google", sessions: "Sesiones", pushDevices: "Dispositivos de avisos", posts: "Publicaciones", replies: "Respuestas", sentPrivateMessages: "Mensajes privados enviados", roomMessages: "Mensajes en encuentros", images: "Imágenes", reservations: "Reservas", memberships: "Membresías de sala", blocksMade: "Bloqueos iniciados", blocksReceived: "Bloqueos recibidos", connections: "Conexiones", reportsMade: "Reportes enviados en Plaza", reportsReceived: "Reportes recibidos en Plaza", roomReportsMade: "Reportes enviados en encuentros", roomReportsReceived: "Reportes recibidos en encuentros", appeals: "Apelaciones de cuenta", plazaAppeals: "Apelaciones de contenido", moderationActions: "Acciones de moderación relacionadas", plazaModerationActions: "Acciones de Plaza realizadas", plazaAppealActions: "Revisiones de Plaza realizadas", restrictions: "Restricciones", plannedMeetings: "Encuentros programados", privacyRequests: "Solicitudes de privacidad", privacyEvents: "Eventos de privacidad relacionados", privacyAcknowledgements: "Acuses realizados", privacyOperatorRole: "Roles de privacidad", moderationRole: "Roles de moderación", notificationQueue: "Avisos de encuentros pendientes", privateNotificationQueue: "Avisos privados pendientes",
};
function InventoryView({ userId }: { userId: string }) {
  const [data, setData] = useState<Inventory | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [open, setOpen] = useState(false);
  async function load() { if (busy) return; setBusy(true); setError(""); try { const result = await safetyRequest(`/api/privacy/inventory/${userId}`); setData(result); setOpen(true); } catch { setData(null); setError("No pudimos consultar el inventario. La solicitud podría haber cambiado."); } finally { setBusy(false); } }
  return <div><button className="button text" disabled={busy} onClick={() => open ? setOpen(false) : void load()}>{open ? "Cerrar inventario" : "Ver inventario de datos"}</button>{busy && <p role="status">Consultando inventario…</p>}{error && <p role="alert">{error}</p>}{open && data && <div><p>Conteos orientativos de la base activa, sin contenido. No realizan eliminación.</p><ul>{Object.entries(data.counts).map(([name, count]) => <li key={name}>{inventoryLabels[name] || name}: {count}</li>)}</ul>{data.limitations.map((item) => <p key={item}>{item}</p>)}</div>}</div>;
}
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
  const [page, setPage] = useState(1); const [more, setMore] = useState(false);
  const load = useCallback(async (target: number) => { setBusy(true); try { const data = await safetyRequest(`/api/privacy/queue?page=${target}`); setItems(data.requests); setPage(data.page); setMore(data.hasMore); setError(""); setLoaded(true); } catch { setLoaded(false); setError("No pudimos cargar la cola de privacidad."); } finally { setBusy(false); } }, []);
  useEffect(() => { void load(1); }, [load]);
  async function acknowledge(item: QueueItem) { if (busy) return; setBusy(true); setError(""); try { await safetyRequest("/api/privacy/ack", { userId: item.userId, version: item.version }); await load(page); } catch { setError("La solicitud cambió o no se pudo actualizar. Vuelve a cargar la cola."); } finally { setBusy(false); } }
  return <details className="account-history"><summary>Cola de privacidad</summary>
    <p>Solo registra la recepción; no elimina cuentas ni datos. La operación y el procedimiento de eliminación siguen pendientes. La cola puede cambiar entre páginas.</p>
    <button className="button secondary" disabled={busy} onClick={() => void load(page)}>Actualizar cola de privacidad</button>{error && <p role="alert">{error}</p>}
    {loaded && (!items.length ? <p>No hay solicitudes para revisión.</p> : items.map((item) => <article className="account-offering" key={item.userId}><h3>{item.alias}</h3><p>{item.status === "pending" ? "Pendiente de recepción" : "Recibida para revisión"}</p>{item.userId !== accountId && <InventoryView userId={item.userId} />}{item.status === "pending" && (item.userId === accountId ? <p>Otra persona de privacidad debe acusar recibo de tu solicitud.</p> : <button className="button secondary" disabled={busy} onClick={() => void acknowledge(item)}>Acusar recibo</button>)}</article>))}
    {loaded && <div className="session-actions"><span>Página {page}</span>{page > 1 && <button className="button secondary" disabled={busy} onClick={() => void load(page - 1)}>Página anterior</button>}{more && <button className="button secondary" disabled={busy} onClick={() => void load(page + 1)}>Página siguiente</button>}</div>}
  </details>;
}
