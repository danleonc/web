import { useCallback, useEffect, useState } from "react";
import { safetyRequest } from "../safety/ModerationDesk";

type RequestState = { status: "pending" | "seen" | "cancelled"; version: number };
type QueueItem = RequestState & { userId: string; alias: string };
type Inventory = { counts: Record<string, number>; limitations: string[] };
const inventoryLabels: Record<string, string> = {
  roomsWithEmbeddedId: "Salas con el identificador en su estado", roomMessagesWithEmbeddedId: "Mensajes con el identificador en sus datos", plazaEvidenceWithEmbeddedId: "Evidencias de Plaza con el identificador", roomEvidenceWithEmbeddedId: "Evidencias de encuentros con el identificador", sentPrivateNotificationQueue: "Avisos de mensajes enviados pendientes", createdMeetingNotificationQueue: "Avisos de encuentros programados pendientes", privacyErasureReceipts: "Comprobantes de borrado realizados", privacyErasureEvents: "Eventos de borrado relacionados",
  accounts: "Cuentas", emails: "Correos", googleLinks: "Vínculos de Google", googleFlows: "Procesos de Google", sessions: "Sesiones", pushDevices: "Dispositivos de avisos", posts: "Publicaciones", replies: "Respuestas", sentPrivateMessages: "Mensajes privados enviados", roomMessages: "Mensajes en encuentros", images: "Imágenes", reservations: "Reservas", memberships: "Membresías de sala", blocksMade: "Bloqueos iniciados", blocksReceived: "Bloqueos recibidos", connections: "Conexiones", reportsMade: "Reportes enviados en Plaza", reportsReceived: "Reportes recibidos en Plaza", roomReportsMade: "Reportes enviados en encuentros", roomReportsReceived: "Reportes recibidos en encuentros", appeals: "Apelaciones de cuenta", plazaAppeals: "Apelaciones de contenido", moderationActions: "Acciones de moderación relacionadas", plazaModerationActions: "Acciones de Plaza realizadas", plazaAppealActions: "Revisiones de Plaza realizadas", restrictions: "Restricciones", plannedMeetings: "Encuentros programados", privacyRequests: "Solicitudes de privacidad", privacyEvents: "Eventos de privacidad relacionados", privacyAcknowledgements: "Acuses realizados", privacyOperatorRole: "Roles de privacidad", moderationRole: "Roles de moderación", notificationQueue: "Avisos de encuentros pendientes", privateNotificationQueue: "Avisos privados pendientes",
};
function InventoryView({ userId }: { userId: string }) {
  const [data, setData] = useState<Inventory | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [open, setOpen] = useState(false);
  async function load() { if (busy) return; setBusy(true); setError(""); try { const result = await safetyRequest(`/api/privacy/inventory/${userId}`); setData(result); setOpen(true); } catch { setData(null); setError("No pudimos consultar el inventario. La solicitud podría haber cambiado."); } finally { setBusy(false); } }
  return <div><button className="button text" disabled={busy} onClick={() => open ? setOpen(false) : void load()}>{open ? "Cerrar inventario" : "Ver inventario de datos"}</button>{busy && <p role="status">Consultando inventario…</p>}{error && <p role="alert">{error}</p>}{open && data && <div><p>Conteos orientativos de la base activa, sin contenido. No realizan eliminación.</p><ul>{Object.entries(data.counts).map(([name, count]) => <li key={name}>{inventoryLabels[name] || name}: {count}</li>)}</ul>{data.limitations.map((item) => <p key={item}>{item}</p>)}</div>}</div>;
}
function EmptyAccountErasure({ item, onComplete }: { item: QueueItem; onComplete: (receiptId: string) => Promise<void> }) {
  const [confirmation, setConfirmation] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function erase() {
    if (busy || confirmation !== "BORRAR CUENTA" || !window.confirm("¿Retirar esta cuenta de la base activa? Esta acción no se puede deshacer.")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/privacy/erase-empty", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: item.userId, version: item.version, confirmation }) });
      const result = await response.json() as { error?: string; receiptId?: string };
      if (!response.ok || !result.receiptId) {
        if (result.error === "recent_auth_required") throw Error("Vuelve a iniciar sesión antes de intentar el borrado.");
        if (response.status === 409) throw Error("La solicitud cambió o la cuenta requiere revisión manual; no se borró.");
        throw Error("No se pudo confirmar el borrado. Revisa el estado antes de reintentar.");
      }
      await onComplete(result.receiptId);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo confirmar el borrado."); }
    finally { setBusy(false); }
  }
  return <details><summary>Borrado limitado de cuenta</summary><p>Solo para pruebas internas y cuentas sin actividad compartida. Retira la cuenta de la base activa y revoca sus sesiones; no elimina respaldos, registros externos ni garantiza eliminación física. Conserva un comprobante seudónimo y el historial mínimo. La operación es irreversible.</p><p>Requiere una sesión del operador iniciada hace menos de diez minutos. Las cuentas con Google o referencias no tratadas requieren revisión manual. Un aviso ya enviado puede llegar después y el nombre podría registrarse nuevamente.</p><div className="account-form"><label>Confirmación de borrado <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" /></label><button className="button secondary" disabled={busy || confirmation !== "BORRAR CUENTA"} onClick={() => void erase()}>Borrar cuenta de base activa</button></div>{error && <p role="alert">{error}</p>}</details>;
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
export function PrivacyDesk({ accountId, canErase }: { accountId: string; canErase: boolean }) {
  const [items, setItems] = useState<QueueItem[]>([]); const [loaded, setLoaded] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1); const [more, setMore] = useState(false);
  const load = useCallback(async (target: number) => { setBusy(true); try { const data = await safetyRequest(`/api/privacy/queue?page=${target}`); setItems(data.requests); setPage(data.page); setMore(data.hasMore); setError(""); setLoaded(true); } catch { setLoaded(false); setError("No pudimos cargar la cola de privacidad."); } finally { setBusy(false); } }, []);
  useEffect(() => { void load(1); }, [load]);
  async function acknowledge(item: QueueItem) { if (busy) return; setBusy(true); setError(""); try { await safetyRequest("/api/privacy/ack", { userId: item.userId, version: item.version }); await load(page); } catch { setError("La solicitud cambió o no se pudo actualizar. Vuelve a cargar la cola."); } finally { setBusy(false); } }
  return <details className="account-history"><summary>Cola de privacidad</summary>
    <p>{canErase ? "El acuse no elimina datos. El borrado limitado solo está disponible para pruebas y no cubre todos los datos ni las copias." : "Solo registra la recepción; no elimina cuentas ni datos. La operación y el procedimiento de eliminación siguen pendientes."} La cola puede cambiar entre páginas.</p>
    <button className="button secondary" disabled={busy} onClick={() => void load(page)}>Actualizar cola de privacidad</button>{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {loaded && (!items.length ? <p>No hay solicitudes para revisión.</p> : items.map((item) => <article className="account-offering" key={item.userId}><h3>{item.alias}</h3><p>{item.status === "pending" ? "Pendiente de recepción" : "Recibida para revisión"}</p>{item.userId !== accountId && <InventoryView userId={item.userId} />}{item.status === "pending" && (item.userId === accountId ? <p>Otra persona de privacidad debe acusar recibo de tu solicitud.</p> : <button className="button secondary" disabled={busy} onClick={() => void acknowledge(item)}>Acusar recibo</button>)}{canErase && item.status === "seen" && item.userId !== accountId && <EmptyAccountErasure item={item} onComplete={async (receiptId) => { setNotice(`Cuenta retirada de la base activa. Comprobante: ${receiptId}. No incluye respaldos ni proveedores externos.`); await load(page); }} />}</article>))}
    {loaded && <div className="session-actions"><span>Página {page}</span>{page > 1 && <button className="button secondary" disabled={busy} onClick={() => void load(page - 1)}>Página anterior</button>}{more && <button className="button secondary" disabled={busy} onClick={() => void load(page + 1)}>Página siguiente</button>}</div>}
  </details>;
}
