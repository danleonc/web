import { useState } from "react";
import { Users, LockKeyhole, Clock3, Leaf, MessageCircle } from "lucide-react";
import { activities } from "../data";
import type { LocalState } from "../store";
import { Avatar, Empty } from "../components";
import { PrivateChatDemo } from "../chat/PrivateChatDemo";
import type { StickerActions } from "../chat/stickers";

export function Connections({
  state,
  onDiscover,
  onWithdraw,
  onProfile,
  ...stickerActions
}: StickerActions & {
  state: LocalState;
  onProfile: () => void;
  onDiscover: () => void;
  onWithdraw: (activityId: string, name: string) => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const requests = state.feedback.flatMap((f) =>
    f.reconnect
      .filter((name) => !state.blocked.includes(`${f.activityId}:${name}`))
      .map((name) => ({
        name,
        activity: activities.find((a) => a.id === f.activityId)!,
      })),
  );
  return (
    <div className="page-content">
      <p className="eyebrow">LAS CONEXIONES PUEDEN CONTINUAR</p>
      <h1>Un encuentro puede ser un comienzo.</h1>
      <p className="page-description">
        Volver a conectar es una decisión de ambas personas. El silencio nunca
        cuenta como un sí.
      </p>
      <div className="inline-notice">
        <LockKeyhole size={18} /> Aquí solo se guardan tus decisiones de
        ejemplo. Nadie recibe solicitudes y no se simulan aceptaciones
        recíprocas.
      </div>
      {requests.length ? (
        <div className="connections-grid">
          {requests.map(({ name, activity }, i) => (
            <article
              className="connection-card panel"
              key={`${activity.id}-${name}`}
            >
              <Avatar name={name} index={i} />
              <span className="fiction-label">PERSONA FICTICIA</span>
              <h2>{name}</h2>
              <p>
                Compartieron el encuentro
                <br />
                <strong>{activity.title}</strong>
              </p>
              <span className="pending-pill">
                <Clock3 size={13} /> Tu interés está guardado
              </span>
              <p className="small-text muted">
                En el producto real, el contacto se habilitará solo con
                aceptación recíproca.
              </p>
              <button
                className="button secondary full"
                onClick={() => onWithdraw(activity.id, name)}
              >
                Retirar mi interés
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={<Users />}
          title="Las buenas conexiones llevan su tiempo"
          text="Después de una sala de prueba podrás elegir con quién te gustaría reencontrarte. No hay prisa ni obligación."
          action="Explorar un encuentro"
          onAction={onDiscover}
        />
      )}
      <section
        className="private-chat-card panel"
        aria-labelledby="private-chat-title"
      >
        <span className="note-icon">
          <MessageCircle size={23} />
        </span>
        <div>
          <p className="eyebrow">PRUEBA INDIVIDUAL · PERSONA FICTICIA</p>
          <h2 id="private-chat-title">
            También puedes decirlo con un sticker.
          </h2>
          <p>
            Explora texto y 144 stickers en un chat privado de demostración. No
            habilita contactos ni implica aceptación recíproca.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => (state.profile ? setChatOpen(true) : onProfile())}
        >
          {state.profile
            ? "Probar chat privado"
            : "Crear perfil para probar el chat"}
        </button>
      </section>
      {chatOpen && state.profile && (
        <PrivateChatDemo
          {...stickerActions}
          alias={state.profile.alias}
          onClose={() => setChatOpen(false)}
        />
      )}
      <div className="quiet-note">
        <Leaf size={20} />
        <span>
          Una conversación valiosa también cuenta, aunque no continúe.
        </span>
      </div>
    </div>
  );
}
