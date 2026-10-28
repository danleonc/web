import { GoogleAccess, GoogleProfile } from "./GoogleAccess";
import { EmailConfirmationForm } from "./EmailConfirmationForm";
import { AccountRestriction, ModerationDesk } from "../safety/ModerationDesk";
import { useState, useId } from "react";
import type { useAccount } from "./accounts";
import { featuredActivities } from "../data";
import { ChatMessageBubble, chatReplyTarget } from "../chat/ChatMessage";
type State = ReturnType<typeof useAccount>;
const date = (value: string) =>
  new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Santiago",
  }).format(new Date(value));
export function AccountPanel({
  state,
  active,
  onLogout,
  compact = false,
}: {
  state: State;
  compact?: boolean;
  active: boolean;
  onLogout: () => void;
}) {
  const recoveryId = useId();
  const [mode, setMode] = useState<"login" | "register" | "recover">("login");
  const [username, setUsername] = useState("");
  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");
  const [adult, setAdult] = useState(false);
  const [code, setCode] = useState("");
  function saveRecovery() {
    const blob = new Blob(
      [
        `Afinia · clave de recuperación\n\n${state.recovery}\n\nGuárdala fuera de este navegador. Permite cambiar tu contraseña. No la compartas.\n`,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "entre-clave-de-recuperacion.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (!state.loaded)
    return (
      <section className="panel account-panel" role="status">
        Consultando tu sesión…
      </section>
    );
  return (
    <section className="panel account-panel" aria-label="Cuenta y reservas">
      {state.error && (
        <p className="shared-error" role="alert">
          {state.error}
        </p>
      )}
      {!state.account ? (
        <>
          <h2>
            {mode === "login"
              ? "Vuelve a tu espacio."
              : mode === "register"
                ? "Crea tu cuenta."
                : "Recupera tu cuenta."}
          </h2>
          <p className="account-access-explainer">
            Puedes explorar sin cuenta. Para participar necesitas iniciar
            sesión, confirmar tu correo y declarar que eres mayor de 18 años.
            Usarás un alias público; no solicitamos cédula ni biometría.
          </p>
          <GoogleAccess state={state} />
          <p>
            Tu usuario permite volver desde otro dispositivo. El nombre que
            elijas para la sala será visible para el grupo.
          </p>
          <div className="session-actions" aria-label="Opciones de cuenta">
            {(["login", "register", "recover"] as const).map((m) => (
              <button
                className="button secondary"
                aria-pressed={mode === m}
                disabled={state.busy}
                key={m}
                onClick={() => {
                  setMode(m);
                  setPassword("");
                  setCode("");
                }}
              >
                {m === "login"
                  ? "Iniciar sesión"
                  : m === "register"
                    ? "Crear cuenta"
                    : "Recuperar acceso"}
              </button>
            ))}
          </div>
          <form
            className="account-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await state.request(`/api/auth/${mode}`, "POST", {
                username,
                password,
                ...(mode === "register" ? { alias, adult } : {}),
                ...(mode === "recover" ? { recoveryCode: code } : {}),
              });
              if (ok) {
                setPassword("");
                setCode("");
              }
            }}
          >
            <label>
              Usuario
              <input
                required
                autoComplete="username"
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9_]+"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            {mode === "register" && (
              <label>
                Nombre en la sala
                <input
                  required
                  autoComplete="nickname"
                  maxLength={30}
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                />
              </label>
            )}
            <label>
              {mode === "recover" ? "Nueva contraseña" : "Contraseña"}
              <input
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <p className="small-text muted">
              Usa de 12 a 128 caracteres. Puedes pegar una contraseña de tu
              gestor.
            </p>
            {mode === "recover" && (
              <label>
                Clave de recuperación
                <input
                  required
                  autoComplete="off"
                  maxLength={128}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
            )}
            {mode === "register" && (
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  required
                  checked={adult}
                  onChange={(e) => setAdult(e.target.checked)}
                />
                <span>
                  Declaro que soy mayor de 18 años. Esta declaración no verifica
                  mi identidad.
                </span>
              </label>
            )}
            {mode === "recover" && (
              <p>
                Usa la clave que guardaste al crear la cuenta. No hay
                recuperación por correo; si pierdes la contraseña y la clave, no
                podrás recuperar el acceso.
              </p>
            )}
            <button className="button primary" disabled={state.busy}>
              {state.busy
                ? "Un momento…"
                : mode === "login"
                  ? "Entrar a mi cuenta"
                  : mode === "register"
                    ? "Guardar mi cuenta"
                    : "Cambiar contraseña y entrar"}
            </button>
          </form>
        </>
      ) : (
        <>
          <div className="account-heading">
            <h2>Tu cuenta: {state.account.alias}</h2>
            <button
              className="button secondary"
              disabled={state.busy}
              onClick={async () => {
                onLogout();
                if (await state.request("/api/auth/logout", "POST", {})) {
                  setMode("login");
                  setPassword("");
                  setCode("");
                }
              }}
            >
              Cerrar sesión
            </button>
          </div>
          <p>
            La sesión dura cuatro horas. Tus reservas, bloqueos e historial
            permanecen guardados al salir.
          </p>
          {state.recovery && (
            <div className="recovery-notice">
              <h3>Guarda tu clave de recuperación.</h3>
              <p>
                Solo se muestra ahora. Quien tenga esta clave puede cambiar tu
                contraseña. Guarda una copia fuera de este navegador.
              </p>
              <label htmlFor={recoveryId}>Tu clave de recuperación</label>
              <textarea
                id={recoveryId}
                readOnly
                value={state.recovery}
                onFocus={(e) => e.target.select()}
              />
              <div className="session-actions">
                <button className="button secondary" onClick={saveRecovery}>
                  Descargar clave
                </button>
                <button className="button text" onClick={state.dismissRecovery}>
                  Ya guardé mi clave
                </button>
              </div>
            </div>
          )}
          {state.account.needsGoogleProfile ? (
            <GoogleProfile key={state.account.id} state={state} />
          ) : (
            <EmailConfirmationForm key={state.account.id} state={state} />
          )}
          {state.account.googleLinked ? (
            <p className="google-linked" role="status">
              Cuenta de Google vinculada.
              {state.account.passwordEnabled === false
                ? " Puedes volver a entrar con Google; no se ha creado una contraseña local."
                : " También conservas tu acceso con usuario y contraseña."}
            </p>
          ) : (
            state.account.canParticipate && (
              <GoogleAccess state={state} link disabled={active} />
            )
          )}
          {state.account.restriction && (
            <AccountRestriction
              key={state.account.id}
              restriction={state.account.restriction}
            />
          )}
          {!compact &&
            state.account.canParticipate &&
            state.account.moderator &&
            !state.account.restriction && (
              <ModerationDesk key={state.account.id} />
            )}
          {!compact &&
            state.account.canParticipate &&
            !state.account.restriction && (
              <h3>Encuentros y reservas de tu cuenta</h3>
            )}
          {!compact && state.account.canParticipate && (
            <p className="small-text muted">
              Horarios en Santiago de Chile. Puedes elegir un encuentro por
              horario; las plazas se comparten entre todas las cuentas.
            </p>
          )}
          {!compact && state.account.canParticipate && (
            <div className="account-offerings">
              {state.activities.map((a) => (
                <article className="account-offering" key={a.id}>
                  <h4>{a.title}</h4>
                  <p>{date(a.startsAt)}</p>
                  <p>
                    {a.reserved} de {a.maximum} plazas reservadas · mínimo{" "}
                    {a.minimum} conectados
                  </p>
                  <button
                    className="button secondary"
                    disabled={
                      state.busy ||
                      active ||
                      (!a.mine && (!a.bookingOpen || a.reserved >= a.maximum))
                    }
                    onClick={() =>
                      void state.request(
                        `/api/reservations/${a.id}`,
                        a.mine ? "DELETE" : "POST",
                      )
                    }
                  >
                    {a.mine
                      ? `Cancelar reserva de ${a.title}`
                      : a.bookingOpen
                        ? `Reservar ${a.title}`
                        : "Reservas cerradas"}
                  </button>
                  {a.mine && (
                    <span className="small-text">
                      Tu reserva está guardada.
                    </span>
                  )}
                </article>
              ))}
            </div>
          )}
          {!compact &&
            state.account.canParticipate &&
            state.rooms.length > 0 && (
              <details className="account-history">
                <summary>Historial de mis salas</summary>
                <p>
                  Se conservan los últimos 50 mensajes de cada sala. El
                  historial archivado se elimina a los 30 días.
                </p>
                {state.rooms.map((r) => (
                  <button
                    className="button text"
                    key={r.id}
                    onClick={() => void state.history(r.id)}
                  >
                    Ver mensajes de{" "}
                    {featuredActivities.find((a) => a.id === r.activityId)
                      ?.title || "encuentro"}
                  </button>
                ))}
                {state.selectedHistory && (
                  <div className="messages" aria-label="Historial guardado">
                    {!state.messages.length && (
                      <p>No hay mensajes disponibles en esta sala.</p>
                    )}
                    {state.messages.map((m) => (
                      <ChatMessageBubble
                        key={m.id}
                        replyTarget={
                          state.messages
                            .filter((source) => source.id === m.replyTo)
                            .map((source) =>
                              chatReplyTarget({
                                ...source,
                                own: source.senderId === state.account!.id,
                              }),
                            )[0]
                        }
                        simulated={false}
                        shared
                        message={{
                          ...m,
                          own: m.senderId === state.account!.id,
                        }}
                      />
                    ))}
                  </div>
                )}
              </details>
            )}
        </>
      )}
    </section>
  );
}
