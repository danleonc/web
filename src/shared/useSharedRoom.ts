import { useCallback, useEffect, useRef, useState } from "react";
import type { SharedCommand, SharedEvent, SharedSnapshot } from "./protocol";
import type { SessionEvent } from "../room/engine";
type Outgoing = Extract<SharedCommand, { type: "message" }>;
export function useSharedRoom(
  activityId: string,
  alias: string,
  active: boolean,
) {
  const [snapshot, setSnapshot] = useState<SharedSnapshot | null>(null);
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "offline" | "blocked"
  >("idle");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Outgoing[]>([]);
  const [version, setVersion] = useState(0);
  const [clock, setClock] = useState({
    now: Date.now(),
    received: performance.now(),
  });
  const [now, setNow] = useState(Date.now());
  const socketRef = useRef<WebSocket | null>(null);
  const roomKeyRef = useRef<string | null>(null);
  const typingAt = useRef(0);
  useEffect(() => {
    const timer = setInterval(
      () => setNow(clock.now + performance.now() - clock.received),
      500,
    );
    return () => clearInterval(timer);
  }, [clock]);
  useEffect(() => {
    if (!active) {
      setStatus("idle");
      setSnapshot(null);
      setPending([]);
      setError("");
      roomKeyRef.current = null;
      return;
    }
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let ws: WebSocket | undefined;
    const controller = new AbortController();
    setStatus("connecting");
    setError("");
    async function connect() {
      if (cancelled) return;
      setStatus("connecting");
      try {
        const response = await fetch("/api/session", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alias, adult: true }),
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            response.status === 429
              ? "Hay demasiados intentos de acceso. Espera un minuto."
              : "No se pudo crear la sesión de desarrollo. Comprueba que el servidor local esté iniciado.",
          );
        if (cancelled) return;
        ws = new WebSocket(
          `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/rooms/${activityId}`,
        );
        socketRef.current = ws;
        ws.onopen = () => {
          if (!cancelled) {
            setStatus("connected");
            setError("");
          }
        };
        ws.onmessage = (event) => {
          if (cancelled) return;
          try {
            const value = JSON.parse(event.data) as SharedEvent;
            if (value.type === "snapshot") {
              if (roomKeyRef.current && roomKeyRef.current !== value.roomKey) {
                setPending([]);
                setError(
                  "La sala anterior terminó. Sus envíos pendientes no se reenviarán al nuevo grupo.",
                );
              }
              roomKeyRef.current = value.roomKey;
              setSnapshot((previous) =>
                previous?.roomKey === value.roomKey &&
                previous.revision > value.revision
                  ? previous
                  : value,
              );
              setClock({ now: value.now, received: performance.now() });
              setNow(value.now);
            } else if (value.type === "error") setError(value.message);
            else if (value.type === "ack")
              setPending((p) => p.filter((m) => m.clientId !== value.clientId));
          } catch {
            setError("No se pudo interpretar una actualización del servidor.");
          }
        };
        ws.onerror = () => {
          if (!cancelled)
            setError(
              "No se pudo conectar: la sala puede estar llena, iniciada, cerrada o no estar disponible para esta sesión.",
            );
        };
        ws.onclose = (event) => {
          if (cancelled) return;
          if (event.code === 4003) {
            setStatus("blocked");
            setSnapshot(null);
            setPending([]);
            setError(
              "El bloqueo quedó registrado y saliste de la sala. No podrás coincidir con esa persona durante esta sesión de desarrollo.",
            );
            return;
          }
          if (event.code === 4001) {
            setStatus("offline");
            setError(
              "La sesión de prueba venció. Vuelve a entrar desde una sesión nueva de navegador.",
            );
            return;
          }
          setStatus("offline");
          if (event.code !== 1000 && attempts < 3) {
            retryTimer = setTimeout(
              () => {
                void connect();
              },
              1000 * 2 ** attempts++,
            );
          } else
            setError(
              "Conexión cerrada. No se enviarán mensajes mientras estés fuera. Puedes intentar reconectar.",
            );
        };
      } catch (e) {
        if (!cancelled) {
          setStatus("offline");
          setError(e instanceof Error ? e.message : "No se pudo conectar.");
        }
      }
    }
    void connect();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(retryTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      socketRef.current = null;
    };
  }, [active, activityId, alias, version]);
  const send = useCallback((command: SharedCommand) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError("No hay conexión. Conserva tu mensaje e intenta reconectar.");
      return false;
    }
    ws.send(JSON.stringify(command));
    return true;
  }, []);
  function sendMessage(content: Outgoing["content"]) {
    if (pending.length >= 20) {
      setError(
        "Hay envíos pendientes. Confírmalos o descártalos antes de seguir.",
      );
      return false;
    }
    const command: Outgoing = {
      type: "message",
      clientId: crypto.randomUUID(),
      content,
    };
    if (!send(command)) return false;
    setPending((p) => [...p, command]);
    return true;
  }
  const dispatch = (event: SessionEvent) => {
    if (event.type === "start" || event.type === "extend")
      send({ type: event.type });
    else if (event.type === "vote") send({ type: "next-question" });
    else if (event.type === "response" && event.status !== "participated")
      send({ type: "respond", status: event.status });
    else if (event.type === "typing") {
      const time = performance.now();
      if (!event.active || time - typingAt.current > 800) {
        typingAt.current = time;
        send({ type: "typing", active: event.active });
      }
    }
  };
  const session = snapshot
    ? {
        ...snapshot.session,
        participants: snapshot.session.participants.map((p) => ({
          ...p,
          id: p.id === snapshot.me ? "self" : p.id,
          own: p.id === snapshot.me,
        })),
        votes: snapshot.session.votes.map((id) =>
          id === snapshot.me ? "self" : id,
        ),
      }
    : null;
  return {
    snapshot,
    session,
    status,
    error,
    now,
    pending,
    dispatch,
    send,
    sendMessage,
    reconnect: () => setVersion((v) => v + 1),
    retryPending: () => {
      for (const command of pending) send(command);
    },
    discardPending: () => setPending([]),
  };
}
