// Deterministic prototype rules. A production server must own presence, votes and deadlines.
export type ResponseStatus =
  | "pending"
  | "participated"
  | "ready"
  | "pass"
  | "listen"
  | "no-response";
export type Participant = {
  id: string;
  name: string;
  own: boolean;
  present: boolean;
  status: ResponseStatus;
  typingUntil: number;
};
export type RoomPhase =
  | "lobby"
  | "question"
  | "conversation"
  | "paused"
  | "insufficient"
  | "closed";
export type Session = {
  phase: RoomPhase;
  participants: Participant[];
  minimum: number;
  maximum: number;
  lobbyUntil: number;
  sessionUntil: number;
  roundUntil: number;
  reconnectUntil: number;
  durationMs: number;
  question: number;
  questionCount: number;
  extended: boolean;
  guided: boolean;
  votes: string[];
  notice: string;
};
export type SessionEvent =
  | { type: "tick"; now: number }
  | {
      type: "start" | "finish-wait" | "retry" | "extend" | "close";
      now: number;
    }
  | { type: "presence"; id: string; present: boolean; now: number }
  | {
      type: "response";
      id: string;
      status: "ready" | "pass" | "listen" | "pending" | "participated";
      now: number;
    }
  | { type: "typing"; id: string; active: boolean; now: number }
  | { type: "vote"; id: string; now: number }
  | { type: "guide"; enabled: boolean; now: number };
export const roundMs = 90_000;
export const extensionMs = 30_000;
export const presentPeople = (s: Session) =>
  s.participants.filter((p) => p.present);
export const majority = (s: Session) =>
  Math.floor(presentPeople(s).length / 2) + 1;
export const canChat = (s: Session) =>
  s.phase === "question" || s.phase === "conversation";
export function createSession(
  names: string[],
  ownName: string,
  minimum: number,
  maximum: number,
  minutes: number,
  questions: number,
  now: number,
): Session {
  return {
    phase: "lobby",
    participants: [
      {
        id: "self",
        name: ownName,
        own: true,
        present: true,
        status: "pending",
        typingUntil: 0,
      },
      ...names.map((name, i) => ({
        id: `peer-${i}`,
        name,
        own: false,
        present: i < Math.min(3, maximum - 1),
        status: "pending" as const,
        typingUntil: 0,
      })),
    ],
    minimum,
    maximum,
    lobbyUntil: now + 300_000,
    sessionUntil: 0,
    roundUntil: 0,
    reconnectUntil: 0,
    durationMs: minutes * 60_000,
    question: -1,
    questionCount: questions,
    extended: false,
    guided: true,
    votes: [],
    notice:
      "Recepción de ejemplo: cinco minutos para reunir el mínimo. La guía no cuenta como participante.",
  };
}
function beginQuestion(s: Session, now: number): Session {
  if (s.question + 1 >= s.questionCount)
    return {
      ...s,
      phase: "conversation",
      votes: [],
      notice:
        "Ya usamos las preguntas previstas. Pueden seguir conversando libremente.",
    };
  return {
    ...s,
    phase: "question",
    question: s.question + 1,
    roundUntil: Math.min(now + roundMs, s.sessionUntil),
    extended: false,
    votes: [],
    notice:
      "Puedes responder, pasar o escuchar. El plazo organiza la dinámica y no limita tus mensajes.",
    participants: s.participants.map((p) => ({
      ...p,
      status: p.status === "listen" ? "listen" : "pending",
      typingUntil: 0,
    })),
  };
}
function begin(s: Session, now: number): Session {
  if (presentPeople(s).length < s.minimum) return s;
  const next = { ...s, sessionUntil: now + s.durationMs };
  return s.guided
    ? beginQuestion(next, now)
    : {
        ...next,
        phase: "conversation",
        notice: "Conversación libre. La guía está desactivada.",
      };
}
function finishRound(s: Session, timeout: boolean): Session {
  return {
    ...s,
    phase: "conversation",
    roundUntil: 0,
    votes: [],
    notice: timeout
      ? "Cerramos el tiempo de esta ronda. Puedes compartir tu respuesta después si quieres."
      : "La ronda terminó. Hay espacio para conversar; otra pregunta requiere una decisión del grupo.",
    participants: s.participants.map((p) => ({
      ...p,
      status:
        timeout && p.present && p.status === "pending"
          ? "no-response"
          : p.status,
    })),
  };
}
function settle(s: Session, now: number): Session {
  if (s.phase === "closed" || s.phase === "insufficient") return s;
  if (s.sessionUntil && now >= s.sessionUntil)
    return {
      ...s,
      phase: "closed",
      roundUntil: 0,
      notice:
        "Terminó el tiempo del encuentro. Puedes evaluar o salir sin guardar.",
    };
  if (s.phase === "lobby" && now >= s.lobbyUntil)
    return presentPeople(s).length >= s.minimum
      ? settle(begin(s, s.lobbyUntil), now)
      : {
          ...s,
          phase: "insufficient",
          notice:
            "Terminó la espera sin alcanzar el mínimo. No cambiamos tu reserva ni te trasladamos a otra sala.",
        };
  if (s.phase === "paused") {
    if (now >= s.reconnectUntil)
      return {
        ...s,
        phase: "insufficient",
        notice:
          "No recuperamos el mínimo durante el minuto de reconexión. Cerramos la simulación sin cambiar de formato.",
      };
    if (presentPeople(s).length >= s.minimum)
      return {
        ...s,
        phase: "conversation",
        votes: [],
        notice:
          "Recuperamos el mínimo. Retomamos con conversación libre, sin imponer una nueva pregunta.",
      };
  }
  if (canChat(s) && presentPeople(s).length < s.minimum)
    return {
      ...s,
      phase: "paused",
      reconnectUntil: now + 60_000,
      roundUntil: 0,
      votes: [],
      notice:
        "Faltan participantes para mantener el formato. Hay un minuto para reconectar; puedes salir cuando quieras.",
    };
  if (s.phase === "question") {
    if (now >= s.roundUntil) return finishRound(s, true);
    if (
      presentPeople(s).every((p) =>
        ["ready", "pass", "listen"].includes(p.status),
      )
    )
      return finishRound(s, false);
  }
  return s;
}
export function sessionReducer(
  previous: Session,
  event: SessionEvent,
): Session {
  const s = settle(previous, event.now);
  if (event.type === "retry")
    return s.phase === "insufficient"
      ? {
          ...s,
          phase: "lobby",
          lobbyUntil: event.now + 300_000,
          sessionUntil: 0,
          roundUntil: 0,
          question: -1,
          votes: [],
          notice:
            "Nueva recepción de prueba. Las reservas reales no se han reprogramado.",
        }
      : s;
  if (event.type === "close")
    return {
      ...s,
      phase: "closed",
      notice: "Has finalizado este encuentro de prueba.",
    };
  if (s.phase === "closed" || s.phase === "insufficient") return s;
  if (event.type === "tick") return s;
  if (event.type === "presence") {
    const person = s.participants.find((p) => p.id === event.id);
    if (
      !person ||
      person.own ||
      (event.present && !person.present && presentPeople(s).length >= s.maximum)
    )
      return s;
    return settle(
      {
        ...s,
        votes: s.votes.filter((id) => id !== event.id),
        participants: s.participants.map((p) =>
          p.id === event.id
            ? { ...p, present: event.present, typingUntil: 0 }
            : p,
        ),
      },
      event.now,
    );
  }
  if (event.type === "start" || event.type === "finish-wait") {
    if (s.phase !== "lobby") return s;
    if (event.type === "finish-wait" && presentPeople(s).length < s.minimum)
      return {
        ...s,
        phase: "insufficient",
        notice:
          "La prueba de cierre no alcanzó el mínimo. Tu reserva se conserva hasta que decidas qué hacer.",
      };
    return begin(s, event.now);
  }
  if (event.type === "guide") {
    const changed = { ...s, guided: event.enabled, votes: [] };
    return !event.enabled && s.phase === "question"
      ? {
          ...finishRound(changed, false),
          notice: "Guía desactivada. Pueden conversar sin preguntas.",
        }
      : changed;
  }
  if (event.type === "extend") {
    if (s.phase !== "question" || s.extended || s.roundUntil >= s.sessionUntil)
      return s;
    return {
      ...s,
      extended: true,
      roundUntil: Math.min(s.roundUntil + extensionMs, s.sessionUntil),
      notice:
        "Añadimos 30 segundos compartidos. Hay una sola extensión por ronda.",
    };
  }
  if (event.type === "vote") {
    if (
      s.phase !== "conversation" ||
      !s.guided ||
      s.question + 1 >= s.questionCount ||
      !s.participants.some((p) => p.id === event.id && p.present)
    )
      return s;
    const votes = [...new Set([...s.votes, event.id])].filter((id) =>
      s.participants.some((p) => p.id === id && p.present),
    );
    const next = { ...s, votes };
    return votes.length >= majority(next)
      ? beginQuestion(next, event.now)
      : next;
  }
  if (event.type === "typing") {
    if (!canChat(s)) return s;
    return {
      ...s,
      participants: s.participants.map((p) =>
        p.id === event.id && p.present
          ? { ...p, typingUntil: event.active ? event.now + 4000 : 0 }
          : p,
      ),
    };
  }
  if (event.type === "response") {
    if (
      !canChat(s) ||
      (s.phase !== "question" &&
        event.status !== "listen" &&
        event.status !== "pending")
    )
      return s;
    return settle(
      {
        ...s,
        participants: s.participants.map((p) =>
          p.id === event.id && p.present
            ? {
                ...p,
                status:
                  event.status === "participated" && p.status !== "pending"
                    ? p.status
                    : event.status,
                typingUntil: 0,
              }
            : p,
        ),
      },
      event.now,
    );
  }
  return s;
}
export function formatTime(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
