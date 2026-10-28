import {
  createContext,
  createElement,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { accountsEnabled } from "./mode";
import type { SharedMessage } from "./protocol";
export type AccountView = {
  id: string;
  alias: string;
  email?: string;
  emailConfirmed?: boolean;
  adultDeclared?: boolean;
  canParticipate?: boolean;
  emailDeliveryAvailable?: boolean;
  googleLinked?: boolean;
  needsGoogleProfile?: boolean;
  passwordEnabled?: boolean;
  moderator?: boolean;
  imagesEnabled?: boolean;
  restriction?: {
    kind: "suspend" | "ban";
    reason: string;
    until: number | null;
    actionId: string;
  } | null;
};
export type Offering = {
  id: string;
  title: string;
  startsAt: string;
  minimum: number;
  maximum: number;
  reserved: number;
  mine: boolean;
  accessible: boolean;
  bookingOpen: boolean;
  ended: boolean;
};
export type HistoryRoom = { id: string; activityId: string; phase: string };
const errors: Record<string, string> = {
  google_unavailable: "El acceso con Google aún no está configurado.",
  google_link_requires_access:
    "Inicia sesión y confirma tu correo antes de vincular Google.",
  google_logout_first:
    "Cierra la sesión actual para entrar con otra cuenta de Google.",
  google_profile_unavailable:
    "No se pudo completar este perfil. Actualiza tu sesión.",
  google_email_mismatch:
    "Usa el correo de la cuenta de Google con la que entraste.",
  invalid_google_request: "No se pudo preparar el acceso con Google.",
  email_confirmation_required: "Confirma tu correo para participar.",
  account_restricted:
    "Tu cuenta tiene una restricción. Revisa el motivo y la apelación.",
  invalid_email_declaration:
    "Indica un correo válido y declara tu mayoría de edad.",
  email_unavailable:
    "El envío de correos aún no está habilitado. Puedes seguir explorando.",
  email_delivery_failed:
    "No se pudo enviar el código. Espera un minuto e inténtalo de nuevo.",
  email_unavailable_for_account:
    "No se puede usar este correo para esta cuenta.",
  email_already_confirmed: "Tu correo ya está confirmado.",
  email_rate_limited: "Espera antes de volver a solicitar o probar un código.",
  invalid_confirmation_code:
    "Código incorrecto, caducado o sin intentos disponibles. Solicita uno nuevo.",
  invalid_credentials:
    "El usuario, la contraseña o la clave de recuperación no coinciden.",
  invalid_credentials_format:
    "Usa un usuario de 3–30 letras, números o guiones bajos y una contraseña de 12–128 caracteres.",
  invalid_profile:
    "Indica un nombre de hasta 30 caracteres y declara tu mayoría de edad.",
  username_unavailable:
    "Ese nombre de usuario ya está ocupado. Prueba con otro.",
  too_many_attempts:
    "Hay demasiados intentos. Espera 15 minutos antes de volver a intentarlo.",
  try_later: "El servicio está ocupado. Vuelve a intentarlo en un momento.",
  reservation_full: "Se ocuparon las seis plazas. Puedes elegir otra temática.",
  reservation_conflict:
    "Ya reservaste otro encuentro a la misma hora. Cancélalo antes de cambiar.",
  reservation_closed: "La recepción de reservas para este encuentro terminó.",
  leave_room_first: "Sal de la sala antes de cancelar la reserva.",
  session_required: "Tu sesión terminó. Vuelve a iniciar sesión.",
};
function useAccountState() {
  const [account, setAccount] = useState<AccountView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [googleResult, setGoogleResult] = useState("");
  const [activeRoom, setActiveRoom] = useState(false);
  const [activities, setActivities] = useState<Offering[]>([]);
  const [rooms, setRooms] = useState<HistoryRoom[]>([]);
  const [messages, setMessages] = useState<SharedMessage[]>([]);
  const [selectedHistory, setSelectedHistory] = useState("");
  const [recovery, setRecovery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const historyVersion = useRef(0);
  const busyRef = useRef(false);
  const refresh = useCallback(async () => {
    if (!accountsEnabled) return;
    const current = generation.current;
    try {
      const response = await fetch("/api/session", {
        credentials: "same-origin",
      });
      if (current !== generation.current) return;
      if (response.status === 401) {
        setAccount(null);
        setActivities([]);
        setRooms([]);
        setMessages([]);
        setLoaded(true);
        return;
      }
      if (!response.ok) throw Error("El servidor no pudo consultar tu sesión.");
      const user = (await response.json()) as AccountView;
      setAccount(user);
      if (user.restriction || !user.canParticipate) {
        setActivities([]);
        setRooms([]);
        setMessages([]);
        setLoaded(true);
        return;
      }
      const [offers, history] = await Promise.all([
        fetch("/api/activities"),
        fetch("/api/history"),
      ]);
      if (!offers.ok || !history.ok)
        throw Error("No se pudieron actualizar tus encuentros.");
      const [offerData, historyData] = await Promise.all([
        offers.json(),
        history.json(),
      ]);
      if (current !== generation.current) return;
      setAccount(user);
      setActivities(offerData.activities);
      setRooms(historyData.rooms);
      setLoaded(true);
    } catch (e) {
      if (current === generation.current) {
        setError(e instanceof Error ? e.message : "No se pudo conectar.");
        setLoaded(true);
      }
    }
  }, []);
  useEffect(() => {
    if (!accountsEnabled) return;
    let alive = true;
    void fetch("/api/auth/options")
      .then(async (r) => {
        if (r.ok) {
          const v = await r.json();
          if (alive) setGoogleAvailable(v.google === true);
        }
      })
      .catch(() => {});
    const url = new URL(location.href),
      result = url.searchParams.get("google");
    if (result) {
      const messages: Record<string, string> = {
        cancelled:
          "Cancelaste el acceso con Google. Puedes volver a intentarlo o usar tu usuario.",
        expired:
          "El acceso con Google caducó o ya se utilizó. Vuelve a intentarlo.",
        failed:
          "No se pudo completar el acceso con Google. Inténtalo de nuevo.",
        invalid:
          "La respuesta de Google no se pudo validar. Vuelve a intentarlo.",
        account_exists:
          "Este correo ya tiene una cuenta. Entra con tu usuario y vincula Google desde tu cuenta.",
        link_expired:
          "La sesión para vincular Google terminó. Inicia sesión e inténtalo de nuevo.",
        link_conflict:
          "No se pudo vincular. Usa una cuenta de Google con el mismo correo confirmado y que no esté asociada a otra cuenta.",
        email_changed:
          "El correo de Google cambió. Usa tu acceso anterior si lo tienes y solicita ayuda antes de vincular otra dirección.",
      };
      if (["success", "linked", ...Object.keys(messages)].includes(result)) {
        setGoogleResult(result);
        if (messages[result]) setError(messages[result]);
      }
      url.searchParams.delete("google");
      window.history.replaceState(
        null,
        "",
        url.pathname + url.search + url.hash,
      );
    }
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!accountsEnabled) return;
    void refresh();
    const timer = setInterval(() => {
      if (!busyRef.current) void refresh();
    }, 5000);
    return () => {
      generation.current++;
      clearInterval(timer);
    };
  }, [refresh]);
  async function request(path: string, method: string, body?: unknown) {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    generation.current++;
    setError("");
    try {
      const response = await fetch(path, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const value = await response.json();
      if (!response.ok)
        throw Error(
          value.message ||
            errors[value.error] ||
            "No se pudo completar la acción. Inténtalo de nuevo.",
        );
      if (path.endsWith("/logout")) {
        setAccount(null);
        setActivities([]);
        setRooms([]);
        setMessages([]);
        setSelectedHistory("");
        setRecovery("");
      } else if (value.id) {
        setAccount({ id: value.id, alias: value.alias });
        setRecovery(value.recoveryCode || "");
      }
      await refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar.");
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function startGoogle(intent: "login" | "link") {
    if (busyRef.current) return;
    if (activeRoom || location.hash === "#room") {
      setError(
        "Sal del encuentro antes de continuar con Google para conservar la conversación del grupo.",
      );
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const returnTo = [
        "#plaza",
        "#discover",
        "#connections",
        "#agenda",
        "#profile",
        "#shared",
      ].includes(location.hash)
        ? location.hash
        : "#plaza";
      const r = await fetch("/api/auth/google-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, returnTo }),
      });
      const value = await r.json();
      if (!r.ok)
        throw Error(
          errors[value.error] || "No se pudo abrir Google. Inténtalo de nuevo.",
        );
      const url = new URL(value.authorizationUrl);
      if (
        url.origin !== "https://accounts.google.com" ||
        url.pathname !== "/o/oauth2/v2/auth"
      )
        throw Error("La dirección de acceso no es válida.");
      window.dispatchEvent(
        new CustomEvent("afinia:before-google", {
          detail: { accountId: account?.id || "guest" },
        }),
      );
      window.location.assign(url.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir Google.");
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function history(id: string) {
    const current = generation.current;
    const version = ++historyVersion.current;
    setError("");
    setMessages([]);
    setSelectedHistory(id);
    try {
      const response = await fetch(`/api/history/${id}`);
      if (!response.ok) throw Error("No puedes consultar ese historial.");
      const result = await response.json();
      if (current === generation.current && version === historyVersion.current)
        setMessages(result.messages);
    } catch (e) {
      if (current === generation.current && version === historyVersion.current)
        setError(
          e instanceof Error ? e.message : "No se pudo consultar el historial.",
        );
    }
  }
  return {
    account,
    loaded,
    googleAvailable,
    googleResult,
    clearGoogleResult: () => setGoogleResult(""),
    activeRoom,
    setActiveRoom,
    startGoogle,
    activities,
    rooms,
    messages,
    selectedHistory,
    recovery,
    busy,
    error,
    request,
    history,
    refresh,
    clearHistory: () => {
      historyVersion.current++;
      setMessages([]);
      setSelectedHistory("");
    },
    dismissRecovery: () => setRecovery(""),
  };
}

const AccountContext = createContext<ReturnType<typeof useAccountState> | null>(
  null,
);
export function AccountProvider({ children }: { children: ReactNode }) {
  const state = useAccountState();
  return createElement(AccountContext.Provider, { value: state }, children);
}
export function useAccount() {
  const state = useContext(AccountContext);
  if (!state) throw Error("AccountProvider is required");
  return state;
}
