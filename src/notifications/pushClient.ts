const ownerKey = "nexafia.push.owner.v1";
let pending: Promise<ServiceWorkerRegistration> | null = null;
export function prepareServiceWorker() {
  if (!window.isSecureContext || !("serviceWorker" in navigator)) return Promise.reject(Error("Este navegador necesita HTTPS y soporte de notificaciones."));
  if (!pending) pending = navigator.serviceWorker.register(new URL("sw.js", document.baseURI), { scope: new URL("./", document.baseURI).pathname, updateViaCache: "none" }).catch(error => { pending = null; throw error; });
  return pending;
}
export class PushFailure extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}
export async function pushRequest(path: string, body?: unknown) {
  const response = await fetch(`/api/push/${path}`, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) {
    const messages: Record<string, string> = { push_unavailable: "El servidor todavía no tiene configurados los avisos al teléfono.", device_expired: "La suscripción caducó. Vuelve a activar este dispositivo.", device_conflict: "Esta suscripción pertenece a otra cuenta. Desactívala y vuelve a activar el dispositivo.", device_limit: "Tu cuenta ya tiene cinco dispositivos. Desactiva uno antes de añadir otro.", rate_limited: "Has hecho varias pruebas. Espera antes de volver a intentarlo.", push_delivery_failed: "El servicio no pudo aceptar la prueba. Inténtalo más tarde.", session_required: "Inicia sesión de nuevo para configurar este dispositivo.", email_confirmation_required: "Confirma tu correo antes de activar los avisos.", account_restricted: "Tu cuenta está restringida. No se pueden activar avisos." };
    const code = typeof data?.error === "string" ? data.error : "unknown";
    throw new PushFailure(code, messages[code] || "No se pudo configurar este dispositivo. Inténtalo de nuevo.");
  }
  return data as { available?: boolean; publicKey?: string; enabled?: boolean; ok?: boolean };
}
export function rememberPushOwner(owner: string) { try { localStorage.setItem(ownerKey, owner); } catch { /* Optional preference. */ } }
export async function unsubscribeBrowserPush() {
  try { localStorage.removeItem(ownerKey); } catch { /* Storage can be disabled. */ }
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const sub = await registration?.pushManager?.getSubscription();
  if (sub) await sub.unsubscribe();
}
export async function syncPushIdentity(owner: string) {
  let previous: string | null = null;
  try { previous = localStorage.getItem(ownerKey); } catch { return; }
  if (!previous) return;
  if (previous !== owner) { await unsubscribeBrowserPush(); return; }
  if (!("Notification" in window) || Notification.permission !== "granted" || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const sub = await registration?.pushManager?.getSubscription();
  let stillOwner = false;
  try { stillOwner = localStorage.getItem(ownerKey) === owner; } catch { return; }
  if (sub && stillOwner) await pushRequest("subscribe", { subscription: sub.toJSON() });
}
export async function activePushWorker(registration: ServiceWorkerRegistration) {
  if (registration.active) return registration;
  let timeout: number | undefined;
  try { await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => { timeout = window.setTimeout(() => reject(Error("No se pudo preparar el dispositivo. Vuelve a intentarlo.")), 8000); })]); }
  finally { window.clearTimeout(timeout); }
  return registration;
}
export function vapidBytes(value: string) {
  const decoded = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(decoded, char => char.charCodeAt(0));
}
