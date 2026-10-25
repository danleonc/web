import type { Session } from "../room/engine.ts";
export const conductReasons = [
  { id: "acoso", label: "Acoso o intimidación" },
  { id: "amenazas", label: "Amenazas o riesgo inmediato" },
  { id: "discriminacion", label: "Discriminación o ataques personales" },
  { id: "spam", label: "Spam o interrupción reiterada" },
  { id: "limites", label: "Insistencia después de un límite" },
  { id: "contenido", label: "Imagen o contenido no permitido" },
] as const;
export type ConductReason = (typeof conductReasons)[number]["id"];
export const validReason = (v: unknown): v is ConductReason =>
  conductReasons.some((r) => r.id === v);
export type Choice = "remove" | "keep";
export type RemovalBallot = {
  id: string;
  targetId: string;
  reason: ConductReason;
  eligible: string[];
  votes: Record<string, Choice>;
  until: number;
  threshold: number;
};
export type RoomSafety = {
  ballot: RemovalBallot | null;
  expelled: string[];
  cooldownUntil: number;
  notice: string;
};
export type SafetyView = {
  ballot: null | {
    id: string;
    targetId: string;
    reason: ConductReason;
    until: number;
    threshold: number;
    eligibleCount: number;
    castCount: number;
    canVote: boolean;
    yourVote: Choice | null;
  };
  expelled: string[];
  notice: string;
};
export const createSafety = (): RoomSafety => ({
  ballot: null,
  expelled: [],
  cooldownUntil: 0,
  notice: "",
});
export function resolveSafety(previous: RoomSafety, now: number): RoomSafety {
  const ballot = previous.ballot;
  if (!ballot) return previous;
  const yes = Object.values(ballot.votes).filter((v) => v === "remove").length;
  if (yes >= ballot.threshold)
    return {
      ...previous,
      ballot: null,
      expelled: [...new Set([...previous.expelled, ballot.targetId])],
      notice:
        "Se alcanzó la mayoría para retirar a una persona de este encuentro. Su cuenta no queda baneada.",
    };
  if (
    now >= ballot.until ||
    Object.keys(ballot.votes).length === ballot.eligible.length
  )
    return {
      ...previous,
      ballot: null,
      notice:
        "La votación terminó sin la mayoría requerida. El silencio no se cuenta a favor. Puedes bloquear, denunciar o salir.",
    };
  return previous;
}
export function startRemoval(
  previous: RoomSafety,
  actorId: string,
  targetId: string,
  reason: ConductReason,
  present: string[],
  now: number,
  id: string,
): RoomSafety {
  const s = resolveSafety(previous, now);
  const eligible = [...new Set(present)].filter(
    (p) => p !== targetId && !s.expelled.includes(p),
  );
  if (
    !validReason(reason) ||
    s.ballot ||
    now < s.cooldownUntil ||
    actorId === targetId ||
    !present.includes(targetId) ||
    !eligible.includes(actorId) ||
    eligible.length < 2 ||
    s.expelled.includes(targetId)
  )
    return s;
  return {
    ...s,
    ballot: {
      id,
      targetId,
      reason,
      eligible,
      votes: { [actorId]: "remove" },
      until: now + 60_000,
      threshold: Math.max(2, Math.floor(eligible.length / 2) + 1),
    },
    cooldownUntil: now + 120_000,
    notice:
      "Votación privada abierta durante un minuto. El umbral queda fijado; no cambia si alguien se desconecta.",
  };
}
export function voteRemoval(
  previous: RoomSafety,
  actorId: string,
  ballotId: string,
  choice: Choice,
  present: string[],
  now: number,
): RoomSafety {
  const s = resolveSafety(previous, now);
  const b = s.ballot;
  if (
    !b ||
    b.id !== ballotId ||
    !b.eligible.includes(actorId) ||
    !present.includes(actorId) ||
    b.votes[actorId] ||
    !["remove", "keep"].includes(choice)
  )
    return s;
  return resolveSafety(
    { ...s, ballot: { ...b, votes: { ...b.votes, [actorId]: choice } } },
    now,
  );
}
export function removeByModerator(s: RoomSafety, targetId: string): RoomSafety {
  return {
    ...s,
    ballot: s.ballot?.targetId === targetId ? null : s.ballot,
    expelled: [...new Set([...s.expelled, targetId])],
    notice:
      "Una persona moderadora retiró al participante de este encuentro. La decisión de cuenta se revisa por separado.",
  };
}
export function safetyView(s: RoomSafety, actorId: string): SafetyView {
  const b = s.ballot;
  return {
    expelled: s.expelled,
    notice: s.notice,
    ballot: b
      ? {
          id: b.id,
          targetId: b.targetId,
          reason: b.reason,
          until: b.until,
          threshold: b.threshold,
          eligibleCount: b.eligible.length,
          castCount: Object.keys(b.votes).length,
          canVote: b.eligible.includes(actorId) && !b.votes[actorId],
          yourVote: b.votes[actorId] || null,
        }
      : null,
  };
}
export function applyExpulsions(session: Session, s: RoomSafety): Session {
  if (!session.participants.some((p) => p.present && s.expelled.includes(p.id)))
    return session;
  return {
    ...session,
    participants: session.participants.map((p) =>
      s.expelled.includes(p.id) ? { ...p, present: false, typingUntil: 0 } : p,
    ),
    votes: session.votes.filter((id) => !s.expelled.includes(id)),
  };
}
