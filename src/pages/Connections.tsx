import { useState } from "react";
import {
  Users,
  LockKeyhole,
  Clock3,
  Leaf,
  MessageCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { activities } from "../data";
import type { LocalState } from "../store";
import { Avatar, Empty } from "../components";
import { PrivateChatDemo } from "../chat/PrivateChatDemo";
import type { StickerActions } from "../chat/stickers";
import { stickers } from "../chat/stickers";
import { plazaPeople, isPlazaPersonBlocked } from "../plaza/data";
import type { PlazaInvitation } from "../plaza/data";
import { InviteDialog } from "../plaza/InviteDialog";
import { invitationSource } from "../plaza/invitations";
import { InvitationContext } from "../plaza/InvitationContext";

export function Connections({
  state,
  onDiscover,
  onWithdraw,
  onProfile,
  onWithdrawGroup,
  onPlaza,
  onPlazaInvite,
  onPrepareInvitation,
  onWithdrawPlaza,
  onMeet,
  ...stickerActions
}: StickerActions & {
  state: LocalState;
  onProfile: () => void;
  onWithdrawGroup: (activityId: string) => void;
  onDiscover: () => void;
  onWithdraw: (activityId: string, name: string) => void;
  onPlaza: (postId?: string, commentId?: string) => void;
  onMeet: (activityId: string) => void;
  onPlazaInvite: (invitation: PlazaInvitation) => void;
  onPrepareInvitation: (source: Omit<PlazaInvitation, "note">) => void;
  onWithdrawPlaza: (personId: string) => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [tab, setTab] = useState<"affinities" | "pending">(() =>
    state.plaza.invitations.length ||
    state.feedback.some((f) => f.reconnect.length || f.repeatGroup)
      ? "pending"
      : "affinities",
  );
  const [invite, setInvite] = useState<string | null>(null);
  const availablePeople = plazaPeople.filter(
    (p) => !isPlazaPersonBlocked(p.name, state.blocked),
  );
  const requests = state.feedback.flatMap((f) =>
    f.reconnect
      .filter((name) => !state.blocked.includes(`${f.activityId}:${name}`))
      .map((name) => ({
        name,
        activity: activities.find((a) => a.id === f.activityId)!,
      })),
  );
  const groupRequests = state.feedback
    .filter((f) => f.repeatGroup)
    .flatMap((f) => activities.find((a) => a.id === f.activityId) || []);
  return (
    <div className="page-content connections-page">
      <section className="connections-hero">
        <div>
          <p className="eyebrow">Conexiones · Sin prisa, sin etiquetas</p>
          <h1>
            Algo en común.
            <br />
            <em>Un nuevo comienzo.</em>
          </h1>
          <p>
            Descubre afinidades y revisa tus invitaciones. Continuar siempre
            requiere que ambos quieran.
          </p>
          <button className="button primary" onClick={() => onPlaza()}>
            Encontrar una conversación <ArrowRight size={16} />
          </button>
        </div>
        <div className="connections-hero-art" aria-hidden="true">
          <span className="connection-orbit" />
          <span className="connection-flower">✳</span>
          {availablePeople.map((p, i) => (
            <span className={`orbit-person orbit-person-${i}`} key={p.id}>
              <Avatar name={p.name} index={i} />
              <small>{p.interests[0]}</small>
            </span>
          ))}
          <span className="orbit-caption">
            <Sparkles size={15} /> La afinidad se descubre compartiendo.
          </span>
        </div>
      </section>
      <div className="connections-tabs" aria-label="Explorar conexiones">
        <button
          aria-pressed={tab === "affinities"}
          className={tab === "affinities" ? "selected" : ""}
          onClick={() => setTab("affinities")}
        >
          Afinidades
        </button>
        <button
          aria-pressed={tab === "pending"}
          className={tab === "pending" ? "selected" : ""}
          onClick={() => setTab("pending")}
        >
          Tus invitaciones{" "}
          <span>
            {state.plaza.invitations.length +
              requests.length +
              groupRequests.length}
          </span>
        </button>
      </div>
      {tab === "affinities" ? (
        <section
          className="affinities-section"
          aria-labelledby="affinities-title"
        >
          <div className="section-heading">
            <div>
              <h2 id="affinities-title">Un punto de partida para conocerse.</h2>
              <p>
                {state.profile?.interests.length
                  ? "Coincidencias con los intereses que elegiste. No analizamos tus conversaciones privadas."
                  : "Explora intereses de ejemplo. Tu perfil puede ayudarte a encontrar puntos en común."}
              </p>
            </div>
            <span className="small-label">Personas ficticias</span>
          </div>
          <div className="affinity-grid">
            {[...availablePeople]
              .sort(
                (a, b) =>
                  b.interests.filter((i) =>
                    state.profile?.interests.includes(i),
                  ).length -
                  a.interests.filter((i) =>
                    state.profile?.interests.includes(i),
                  ).length,
              )
              .map((p, index) => {
                const common = p.interests.filter((i) =>
                  state.profile?.interests.includes(i),
                );
                const pending = state.plaza.invitations.some(
                  (i) => i.personId === p.id,
                );
                return (
                  <article
                    className={`affinity-card affinity-${p.topic}`}
                    key={p.id}
                    aria-label={`Afinidad de ejemplo: ${p.name}`}
                  >
                    <div className="affinity-cover">
                      <span className="affinity-decoration">
                        {index === 0 ? "✳" : index === 1 ? "✧" : "❋"}
                      </span>
                      <Avatar name={p.name} index={index} />
                    </div>
                    <div className="affinity-content">
                      <span className="small-label">Perfil de ejemplo</span>
                      <h3>{p.name}</h3>
                      <p>{p.description}</p>
                      <div className="affinity-interests">
                        {p.interests.map((i) => (
                          <span
                            className={common.includes(i) ? "in-common" : ""}
                            key={i}
                          >
                            {i}
                          </span>
                        ))}
                      </div>
                      <p className="affinity-reason">
                        <Sparkles size={14} />
                        {common.length
                          ? `En común: ${common.join(", ")}.`
                          : "Un tema para descubrir, sin promesas de compatibilidad."}
                      </p>
                      <button
                        className="button primary full"
                        onClick={() =>
                          pending ? setTab("pending") : setInvite(p.id)
                        }
                      >
                        {pending ? "Ver mi invitación" : "Invitar a conversar"}{" "}
                        <ArrowRight size={15} />
                      </button>
                      <button
                        className="button text full"
                        onClick={() => onPlaza(p.postId)}
                      >
                        Ver su conversación en La Plaza
                      </button>
                    </div>
                  </article>
                );
              })}
          </div>
          {!availablePeople.length && (
            <Empty
              icon={<Users />}
              title="Tu espacio también respeta tus límites."
              text="Los perfiles de ejemplo que bloqueaste no aparecen aquí. Puedes seguir compartiendo en La Plaza."
              action="Volver a La Plaza"
              onAction={() => onPlaza()}
            />
          )}
        </section>
      ) : (
        <>
          <div className="inline-notice">
            <LockKeyhole size={18} /> Aquí solo se guardan tus decisiones de
            ejemplo. Nadie recibe solicitudes y no se simulan aceptaciones
            recíprocas.
          </div>
          {state.plaza.invitations.length > 0 && (
            <section
              className="plaza-pending-section"
              aria-label="Invitaciones desde La Plaza"
            >
              <h2>Tus invitaciones desde La Plaza</h2>
              <div className="connections-grid">
                {state.plaza.invitations.map((i) => {
                  const p = plazaPeople.find((p) => p.id === i.personId)!;
                  const source = invitationSource(
                    i,
                    state.plaza.posts,
                    state.blocked,
                  );
                  return (
                    <article
                      className="connection-card panel"
                      key={i.personId}
                      aria-label={`Invitación para ${p.name}`}
                    >
                      <Avatar name={p.name} index={plazaPeople.indexOf(p)} />
                      <span className="fiction-label">Persona ficticia</span>
                      <h3>{p.name} · La Plaza</h3>
                      <span className="pending-pill">
                        <Clock3 size={13} /> Esperando aceptación · ejemplo
                      </span>
                      <p className="small-text muted">
                        Tu intención está guardada. Nadie recibió la invitación
                        y aún no hay un contacto habilitado.
                      </p>
                      <InvitationContext source={source} />
                      {i.note && (
                        <div className="invitation-note">
                          <span>Tu mensaje para empezar</span>
                          <blockquote>{i.note}</blockquote>
                        </div>
                      )}
                      <button
                        className="button primary full"
                        disabled={!source}
                        onClick={() => onPlaza(i.postId, i.commentId)}
                      >
                        {i.commentId
                          ? "Volver al comentario"
                          : "Volver a la conversación"}
                      </button>
                      {source && (
                        <button
                          type="button"
                          className="button secondary full"
                          onClick={() => onMeet(source.topic.activityId)}
                        >
                          Ver encuentro relacionado <ArrowRight size={15} />
                        </button>
                      )}
                      <button
                        className="button text full"
                        onClick={() => onWithdrawPlaza(i.personId)}
                      >
                        Retirar invitación para {p.name}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          {groupRequests.length > 0 && (
            <section className="group-continuity panel">
              <p className="eyebrow">Volver a compartir · Interés de prueba</p>
              <h2>Un próximo momento, si el grupo también quiere.</h2>
              {groupRequests.map((a) => (
                <div className="group-request" key={a.id}>
                  <div>
                    <strong>{a.title}</strong>
                    <p>
                      Te gustaría repetir con este grupo. Faltan la aceptación
                      de otras personas y acordar una fecha; no hay reserva
                      nueva.
                    </p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => onWithdrawGroup(a.id)}
                  >
                    Retirar interés grupal
                  </button>
                </div>
              ))}
            </section>
          )}
          {requests.length ? (
            <div className="connections-grid">
              {requests.map(({ name, activity }, i) => (
                <article
                  className="connection-card panel"
                  key={`${activity.id}-${name}`}
                >
                  <Avatar name={name} index={i} />
                  <span className="fiction-label">Persona ficticia</span>
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
          ) : groupRequests.length || state.plaza.invitations.length ? null : (
            <Empty
              icon={<Users />}
              title="Las buenas conexiones llevan su tiempo"
              text="Puedes empezar por una conversación en La Plaza o compartir un encuentro. No hay prisa ni obligación de continuar."
              action="Explorar La Plaza"
              onAction={() => onPlaza()}
            />
          )}
          {requests.length > 0 && (
            <button className="button text" onClick={onDiscover}>
              Explorar otro encuentro <ArrowRight size={15} />
            </button>
          )}
        </>
      )}
      <section
        className="private-chat-card panel"
        aria-labelledby="private-chat-title"
      >
        <span className="note-icon">
          <MessageCircle size={23} />
        </span>
        <div>
          <p className="eyebrow">Prueba individual · Persona ficticia</p>
          <h2 id="private-chat-title">
            También puedes decirlo con un sticker.
          </h2>
          <p>
            Explora texto y {stickers.length} stickers en un chat privado de
            demostración. No habilita contactos ni implica aceptación recíproca.
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
      {invite && (
        <InviteDialog
          personId={invite}
          postId={plazaPeople.find((p) => p.id === invite)!.postId}
          profile={state.profile}
          posts={state.plaza.posts}
          blocked={state.blocked}
          onMeet={onMeet}
          onProfile={() =>
            onPrepareInvitation({
              personId: invite,
              postId: plazaPeople.find((p) => p.id === invite)!.postId,
            })
          }
          onClose={() => setInvite(null)}
          onSave={(i) => {
            onPlazaInvite(i);
            setTab("pending");
          }}
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
