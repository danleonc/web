import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Modal } from "../components";
import { ConductGuide } from "../safety/ConductGuide";
import { Participants } from "./SessionPanels";
import type { Participant, Session } from "./engine";

export function useMutedParticipants(scope: string) {
  const [muted, setMuted] = useState<string[]>([]);
  useEffect(() => setMuted([]), [scope]);
  return {
    muted,
    toggleMute: (id: string) =>
      setMuted((ids) =>
        ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id],
      ),
  };
}

export function RoomCare({
  session,
  now,
  simulated,
  mutedIds,
  onToggleMute,
  actions,
  onClose,
  children,
}: {
  session: Session;
  now: number;
  simulated: boolean;
  mutedIds: string[];
  onToggleMute: (id: string) => void;
  actions?: (person: Participant) => ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const peopleRef = useRef<HTMLDivElement>(null);
  const careRef = useRef<HTMLElement>(null);
  function showSection(section: HTMLElement | null) {
    section?.focus({ preventScroll: true });
    section?.scrollIntoView({ block: "start", behavior: "instant" });
  }
  return (
    <Modal title="Personas y seguridad" onClose={onClose}>
      <div className="room-care">
        {session.phase === "paused" && (
          <p className="inline-notice" role="status">
            La sala está en pausa para recuperar el mínimo. Los envíos están
            detenidos.
          </p>
        )}
        <button
          className="button secondary full"
          onClick={() => showSection(careRef.current)}
        >
          Ir a normas y acciones de seguridad
        </button>
        <div ref={peopleRef} tabIndex={-1}>
          <Participants
            session={session}
            now={now}
            simulated={simulated}
            mutedIds={mutedIds}
            onToggleMute={onToggleMute}
            actions={actions}
          />
        </div>
        <p className="care-mute-note">
          Silenciar oculta sus mensajes solo en esta vista hasta salir de la
          sala. No bloquea a la persona, no le avisa y no cambia el quórum ni
          sus votos.
        </p>
        <section
          ref={careRef}
          tabIndex={-1}
          aria-label="Normas y acciones de seguridad"
        >
          <ConductGuide />
          {children}
          <button
            className="button text full"
            onClick={() => showSection(peopleRef.current)}
          >
            Volver a participantes
          </button>
        </section>
      </div>
    </Modal>
  );
}

export function RoomTyping({
  session,
  now,
}: {
  session: Session;
  now: number;
}) {
  const names = session.participants
    .filter((p) => !p.own && p.present && p.typingUntil > now)
    .map((p) => p.name);
  return (
    <div className="room-typing" role="status">
      {names.length > 0
        ? `${names.join(", ")} ${names.length === 1 ? "está" : "están"} escribiendo…`
        : ""}
    </div>
  );
}
