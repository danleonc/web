import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { accountsEnabled } from "../shared/mode";
import { PushFailure, activePushWorker, prepareServiceWorker, pushRequest, rememberPushOwner, unsubscribeBrowserPush, vapidBytes } from "./pushClient";
export function DevicePush({ owner, canParticipate }: { owner: string | null; canParticipate: boolean }) {
  const [available, setAvailable] = useState(false), [publicKey, setPublicKey] = useState("");
  const [loaded, setLoaded] = useState(false), [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const permission = () => "Notification" in window ? Notification.permission : "default";
  const [permit, setPermit] = useState<NotificationPermission>(permission);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { const refresh = () => setPermit(permission()); window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh); }, []);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed = matchMedia("(display-mode: standalone)").matches || !!(navigator as Navigator & { standalone?: boolean }).standalone;
  const supported = window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  useEffect(() => {
    let current = true;
    if (!accountsEnabled || !owner || !canParticipate || !supported || (ios && !installed)) { setLoaded(true); return; }
    void (async () => {
      try {
        const options = await pushRequest("options");
        if (!current) return;
        setAvailable(options.available === true); setPublicKey(typeof options.publicKey === "string" ? options.publicKey : "");
        const registration = await navigator.serviceWorker.getRegistration();
        const sub = await registration?.pushManager.getSubscription();
        if (options.available && sub) { const state = await pushRequest("status", { endpoint: sub.endpoint }); if (current) setEnabled(state.enabled === true); }
      } catch { if (current) setError("No se pudo consultar la configuración del dispositivo. Cierra y vuelve a abrir este panel."); }
      finally { if (current) setLoaded(true); }
    })();
    return () => { current = false; };
  }, [owner, canParticipate, supported, ios, installed]);
  async function action(kind: "enable" | "disable" | "test") {
    if (lock.current) return; lock.current = true; setBusy(true); setError(""); setMessage("");
    try {
      if (kind === "enable") {
        // Permission must be requested directly from this explicit gesture.
        const granted = await Notification.requestPermission(); setPermit(granted);
        if (granted !== "granted" || !alive.current) return;
        const registration = await activePushWorker(await prepareServiceWorker());
        if (!alive.current) return;
        let sub = await registration.pushManager.getSubscription();
        if (sub) {
          const bound = await pushRequest("status", { endpoint: sub.endpoint });
          if (!bound.enabled) { await sub.unsubscribe(); sub = null; }
        }
        if (!sub) sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidBytes(publicKey) });
        if (!alive.current) return;
        await pushRequest("subscribe", { subscription: sub.toJSON() });
        if (owner) rememberPushOwner(owner); setEnabled(true); setMessage("Este dispositivo quedó activado.");
      } else {
        const registration = await navigator.serviceWorker.getRegistration();
        const sub = await registration?.pushManager.getSubscription();
        if (kind === "disable") {
          const results = await Promise.allSettled([sub ? pushRequest("unsubscribe", { endpoint: sub.endpoint }) : Promise.resolve(), unsubscribeBrowserPush()]);
          if (results.every(result => result.status === "rejected")) throw Error("No se pudo completar la baja. Puedes bloquear los avisos desde los ajustes del navegador e intentarlo de nuevo.");
          setEnabled(false); setMessage("Avisos desactivados en este dispositivo.");
        } else {
          if (!sub) throw Error("Vuelve a activar este dispositivo antes de probar.");
          await pushRequest("test", { endpoint: sub.endpoint }); setMessage("Prueba enviada al servicio. Revisa los avisos de tu dispositivo.");
        }
      }
    } catch (e) {
      if (e instanceof PushFailure && e.code === "device_expired" && alive.current) { setEnabled(false); await unsubscribeBrowserPush().catch(() => {}); }
      setError(e instanceof Error ? e.message : "No se pudo configurar este dispositivo.");
    }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="device-push" aria-label="Avisos en tu teléfono"><h3><Smartphone size={20} />En tu teléfono</h3>
    <p>Actívalos solo si quieres recibir avisos con Nexafia cerrada. El contenido de las publicaciones no se muestra en la pantalla bloqueada.</p>
    {!accountsEnabled ? <p className="notice-scope">La demo pública no envía avisos al teléfono. La integración está preparada para un piloto con backend HTTPS; todavía falta conectar las interacciones reales de La Plaza.</p> : !owner || !canParticipate ? <p>Inicia sesión y confirma tu correo para configurar los avisos del dispositivo.</p> : ios && !installed ? null : !supported ? <p>Este navegador no ofrece los requisitos necesarios. Usa un navegador compatible en HTTPS.</p> : !loaded ? <p role="status">Consultando este dispositivo…</p> : !available ? <p>Los avisos al teléfono todavía no están configurados en este piloto.</p> : <>
      <p>{permit === "denied" ? "El permiso está bloqueado. Puedes cambiarlo desde los ajustes del navegador o de la aplicación instalada." : enabled ? "Avisos activados en este dispositivo." : "El permiso se pedirá cuando pulses Activar."}</p>
      <div className="device-push-actions">{!enabled && permit !== "denied" && <button className="button primary" disabled={busy || !publicKey} onClick={() => void action("enable")}><Bell size={16} />Activar avisos en este dispositivo</button>}{enabled && <><button className="button secondary" disabled={busy || permit !== "granted"} onClick={() => void action("test")}>Enviar prueba a mi dispositivo</button><button className="button text" disabled={busy} onClick={() => void action("disable")}><BellOff size={16} />Desactivar este dispositivo</button></>}</div>
      <p className="small-text muted">La prueba confirma la preparación del dispositivo; los avisos de interacciones necesitan el backend compartido de La Plaza y sus preferencias.</p>
    </>}
    {ios && <p className="device-install">En iPhone o iPad: usa Compartir → Añadir a pantalla de inicio y abre Nexafia desde ese icono. Se requiere iOS/iPadOS 16.4 o posterior.</p>}
    {error && <p className="shared-error" role="alert">{error}</p>}{message && <p className="device-push-result" role="status">{message}</p>}
  </section>;
}
