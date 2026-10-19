import { useCallback, useEffect, useRef, useState } from "react";
import { accountsEnabled } from "./mode";
import type { SharedMessage } from "./protocol";
export type AccountView = { id: string; alias: string };
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
export function useAccount() {
  const [account, setAccount] = useState<AccountView | null>(null);
  const [loaded, setLoaded] = useState(false);
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
    activities,
    rooms,
    messages,
    selectedHistory,
    recovery,
    busy,
    error,
    request,
    history,
    clearHistory: () => {
      historyVersion.current++;
      setMessages([]);
      setSelectedHistory("");
    },
    dismissRecovery: () => setRecovery(""),
  };
}
