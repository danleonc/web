import { useState, useId } from "react";
import type { useAccount } from "./accounts";
type State = ReturnType<typeof useAccount>;
export function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.89 46.98 24.55Z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
      />
    </svg>
  );
}
export function GoogleAccess({
  state,
  link = false,
  disabled = false,
}: {
  state: State;
  link?: boolean;
  disabled?: boolean;
}) {
  if (!state.googleAvailable)
    return !link ? (
      <p className="small-text muted">
        El acceso directo con Google aún no está habilitado en este piloto.
      </p>
    ) : null;
  return (
    <div className="google-access">
      <button
        type="button"
        className="google-button"
        disabled={state.busy || disabled || state.activeRoom}
        onClick={() => void state.startGoogle(link ? "link" : "login")}
      >
        <GoogleMark />
        <span>
          {state.busy
            ? "Un momento…"
            : link
              ? "Vincular cuenta de Google"
              : "Continuar con Google"}
        </span>
      </button>
      <p>
        {link
          ? "Usa Google con el mismo correo confirmado. Conservarás tu cuenta y tus datos."
          : "Se abrirá Google y volverás a este espacio. Solo solicitamos tu dirección de correo, sin acceder a mensajes ni contactos."}
      </p>
      {(disabled || state.activeRoom) && (
        <p>Sal del encuentro para continuar con Google.</p>
      )}
    </div>
  );
}
export function GoogleProfile({ state }: { state: State }) {
  const id = useId(),
    [alias, setAlias] = useState(""),
    [adult, setAdult] = useState(false);
  return (
    <section className="google-profile" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>Elige cómo te conocerán.</h3>
      <p>
        Has entrado con Google. Elige un alias público y declara tu mayoría de
        edad para continuar. No usamos tu nombre ni foto de Google como perfil.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await state.request("/api/auth/google-complete", "POST", {
            alias,
            adult,
          });
        }}
      >
        <label htmlFor={`${id}-alias`}>Tu alias público</label>
        <input
          id={`${id}-alias`}
          autoComplete="nickname"
          maxLength={30}
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          required
        />
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={adult}
            onChange={(e) => setAdult(e.target.checked)}
            required
          />
          <span>
            Declaro que soy mayor de 18 años. Google no verifica mi edad ni mi
            identidad civil.
          </span>
        </label>
        <button className="button primary" disabled={state.busy}>
          Guardar alias y continuar
        </button>
      </form>
    </section>
  );
}
