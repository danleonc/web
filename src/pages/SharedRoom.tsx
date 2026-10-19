import { useState, useEffect } from "react";
import { LockKeyhole, Radio, Users } from "lucide-react";
import { featuredActivities } from "../data";
import type { Profile } from "../store";
import type { StickerActions } from "../chat/stickers";
import { ChatComposer } from "../chat/ChatComposer";
import { ChatMessageBubble } from "../chat/ChatMessage";
import { useSharedRoom } from "../shared/useSharedRoom";
import { canChat, formatTime, presentPeople } from "../room/engine";
import { GuidePanel, responseLabels } from "../room/SessionPanels";
import { accountsEnabled } from "../shared/mode";
import { useAccount } from "../shared/accounts";
import { AccountPanel } from "../shared/AccountPanel";

export function SharedRoom({
  profile,
  onProfile,
  ...stickerActions
}: StickerActions & { profile: Profile | null; onProfile: () => void }) {
  const [activityId, setActivityId] = useState("cafe");
  const [active, setActive] = useState(false);
  const [aware, setAware] = useState(false);
  const account = useAccount();
  useEffect(() => {
    setActive(false);
  }, [account.account?.id]);
  const activity = featuredActivities.find((a) => a.id === activityId)!;
  const shared = useSharedRoom(
    activityId,
    account.account?.alias || profile?.alias || "Participante",
    active,
  );
  const { session, snapshot, status } = shared;
  const connected = status === "connected" && !!session;
  return (
    <div className="page-content shared-lab">
      <p className="eyebrow">
        {accountsEnabled
          ? "PILOTO · CUENTA Y ENCUENTROS"
          : "LABORATORIO LOCAL · CONEXIÓN ENTRE NAVEGADORES"}
      </p>
      <h1>Un mismo encuentro, un estado compartido.</h1>
      <p className="page-description">
        {accountsEnabled ? (
          "Tu cuenta conserva reservas, bloqueos y mensajes para volver desde otro dispositivo. Este piloto aún no tiene moderación humana operativa."
        ) : (
          <>
            Esta prueba usa conexiones reales con tu servidor local. No es el
            servicio público ni una cuenta con identidad verificada.
          </>
        )}
      </p>
      <div className="inline-notice">
        <LockKeyhole size={18} />
        <span>
          {accountsEnabled ? (
            "Los mensajes son visibles para tu grupo y se guardan en el servidor. Se conservan los últimos 50 por sala; los historiales archivados se eliminan a los 30 días. No utilices información sensible."
          ) : (
            <>
              Los mensajes se comparten con los navegadores conectados a esta
              sala. El servidor conserva hasta 50 en memoria; desaparecen al
              reiniciarlo o limpiar una sala inactiva. Usa solo alias y
              contenido de prueba. No hay moderación humana operativa.
            </>
          )}
        </span>
      </div>
      {accountsEnabled && (
        <AccountPanel
          state={account}
          active={active}
          onLogout={() => setActive(false)}
        />
      )}
      {accountsEnabled && !account.account ? null : !accountsEnabled &&
        !profile ? (
        <section className="panel shared-connect">
          <h2>Prepara primero un perfil de prueba.</h2>
          <p>
            La declaración de mayoría de edad permite usar el laboratorio; no
            verifica edad ni identidad.
          </p>
          <button className="button primary" onClick={onProfile}>
            Preparar perfil
          </button>
        </section>
      ) : (
        <section className="panel shared-connect">
          <label className="field-label" htmlFor="shared-topic">
            Temática compartida
          </label>
          <select
            id="shared-topic"
            className="text-input"
            disabled={active}
            value={activityId}
            onChange={(e) => setActivityId(e.target.value)}
          >
            {featuredActivities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
          {!active && (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={aware}
                onChange={(e) => setAware(e.target.checked)}
              />
              <span>
                Entiendo que esta prueba comparte mis mensajes con quienes se
                conecten a la sala.
              </span>
            </label>
          )}
          <div className="session-actions">
            {!active ? (
              <button
                className="button primary"
                disabled={
                  !aware ||
                  (accountsEnabled &&
                    (!account.activities.find((a) => a.id === activityId)
                      ?.mine ||
                      !account.activities.find((a) => a.id === activityId)
                        ?.accessible ||
                      !!account.activities.find((a) => a.id === activityId)
                        ?.ended))
                }
                onClick={() => setActive(true)}
              >
                <Radio size={16} /> Conectar con esta sala
              </button>
            ) : (
              <>
                <button
                  className="button secondary"
                  onClick={() => setActive(false)}
                >
                  Salir de la sala compartida
                </button>
                {status === "offline" && (
                  <button className="button primary" onClick={shared.reconnect}>
                    Intentar reconectar
                  </button>
                )}
              </>
            )}
            <span className="connection-state" role="status">
              {status === "idle"
                ? "Sin conexión"
                : status === "connecting"
                  ? "Conectando…"
                  : status === "connected"
                    ? "Conectado al servidor"
                    : status === "blocked"
                      ? "Saliste con un bloqueo registrado"
                      : "Sin conexión: envíos detenidos"}
            </span>
          </div>
          <p className="small-text muted">
            {accountsEnabled ? (
              "Reserva primero. La recepción abre cinco minutos antes del horario y puede esperar hasta cinco minutos después para reunir el mínimo. Varias pestañas de tu cuenta cuentan como una sola persona."
            ) : (
              <>
                Para representar personas distintas, usa perfiles de navegador o
                contextos separados. Varias pestañas con la misma sesión cuentan
                como una sola persona.
              </>
            )}
          </p>
        </section>
      )}
      {shared.error && (
        <p className="shared-error" role="alert">
          {shared.error}
        </p>
      )}
      {session && snapshot && (
        <div className="room-layout shared-layout">
          <section
            className="conversation panel"
            aria-label="Sala compartida de desarrollo"
          >
            <div className="room-top">
              <span>
                <Users size={15} />
                {presentPeople(session).length} personas conectadas · mínimo{" "}
                {session.minimum}, máximo {session.maximum}
              </span>
            </div>
            {!connected && (
              <p className="small-text shared-offline" role="status">
                Mostramos el último estado recibido. Las acciones están
                detenidas hasta reconectar; tu borrador se conserva en esta
                vista.
              </p>
            )}
            <fieldset
              className="shared-actions"
              disabled={!connected}
              aria-label="Controles del encuentro compartido"
            >
              {session.phase === "lobby" ? (
                <div className="guide-panel">
                  <h2>Esperamos al mínimo de personas conectadas.</h2>
                  <p>
                    Quedan {formatTime(session.lobbyUntil - shared.now)} de
                    recepción. La guía no cuenta y no se añaden personajes
                    ficticios.
                  </p>
                  <button
                    className="button primary"
                    disabled={presentPeople(session).length < session.minimum}
                    onClick={() => shared.dispatch({ type: "start", now: 0 })}
                  >
                    Iniciar encuentro compartido
                  </button>
                </div>
              ) : ["closed", "insufficient"].includes(session.phase) ? (
                <div className="guide-panel">
                  <h2>El encuentro compartido terminó.</h2>
                  <p>{session.notice}</p>
                  <p>
                    {accountsEnabled ? (
                      "Tu reserva guardada no se reprograma. Puedes salir sin aceptar otra fecha."
                    ) : (
                      <>
                        Tu reserva local no cambia. Puedes salir sin aceptar
                        otra fecha o formato.
                      </>
                    )}
                  </p>
                </div>
              ) : (
                <GuidePanel
                  session={session}
                  now={shared.now}
                  activity={activity}
                  dispatch={shared.dispatch}
                />
              )}
            </fieldset>
            <div className="messages" aria-label="Mensajes compartidos">
              {!snapshot.messages.length && (
                <p className="muted small-text">
                  Los mensajes aparecerán aquí cuando el grupo alcance quórum e
                  inicie el encuentro.
                </p>
              )}
              {snapshot.messages.map((message) => (
                <ChatMessageBubble
                  key={message.id}
                  simulated={false}
                  message={{
                    ...message,
                    own: message.senderId === snapshot.me,
                  }}
                />
              ))}
            </div>
            <ChatComposer
              {...stickerActions}
              disabled={
                !connected || !canChat(session) || shared.pending.length >= 20
              }
              onTypingChange={(typing) =>
                shared.dispatch({
                  type: "typing",
                  id: "self",
                  active: typing,
                  now: 0,
                })
              }
              onSendText={(text) => shared.sendMessage({ type: "text", text })}
              onSendSticker={(stickerId) =>
                shared.sendMessage({ type: "sticker", stickerId })
              }
            />
            <span className="composer-note">
              El servidor confirma el envío. Los mensajes son visibles para los
              participantes de esta sala.
            </span>
            {shared.pending.length > 0 && (
              <div className="pending-messages">
                <p>
                  {shared.pending.length} envíos sin confirmación. Se conservan
                  solo en esta vista.
                </p>
                {shared.pending.map((m) => (
                  <p key={m.clientId}>
                    {m.content.type === "text"
                      ? m.content.text
                      : "Sticker pendiente"}
                  </p>
                ))}
                <button
                  className="button secondary"
                  disabled={!connected || !canChat(session)}
                  onClick={shared.retryPending}
                >
                  Reintentar envíos pendientes
                </button>
                <button
                  className="button text-danger"
                  onClick={shared.discardPending}
                >
                  Descartar pendientes
                </button>
              </div>
            )}
          </section>
          <aside className="panel participants-panel">
            <h3>Personas de esta prueba</h3>
            <p className="small-text muted">
              {accountsEnabled
                ? "Cuentas conectadas. No hay verificación de identidad."
                : "Sesiones de desarrollo, sin verificación de identidad."}
            </p>
            {snapshot.session.participants.map((p) => (
              <div className="shared-participant" key={p.id}>
                <strong>
                  {p.name}
                  {p.id === snapshot.me ? " · tú" : ""}
                </strong>
                <span>
                  {!p.present
                    ? "Desconectado"
                    : p.typingUntil > shared.now
                      ? "Escribiendo…"
                      : responseLabels[p.status]}
                </span>
                {p.id !== snapshot.me && p.present && (
                  <button
                    className="button text-danger"
                    disabled={!connected}
                    onClick={() => {
                      if (
                        confirm(
                          accountsEnabled
                            ? "Bloquear guarda esta decisión en tu cuenta y te saca de la sala. ¿Continuar?"
                            : "Bloquear registra esta decisión en tu sesión de desarrollo y te saca de la sala. ¿Continuar?",
                        )
                      ) {
                        shared.send({ type: "block", participantId: p.id });
                        account.clearHistory();
                      }
                    }}
                  >
                    Bloquear y salir
                  </button>
                )}
              </div>
            ))}
          </aside>
        </div>
      )}
    </div>
  );
}
