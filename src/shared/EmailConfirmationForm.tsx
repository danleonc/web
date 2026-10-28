import { useId, useState } from "react";
import type { useAccount } from "./accounts";
export function EmailConfirmationForm({
  state,
}: {
  state: ReturnType<typeof useAccount>;
}) {
  const id = useId();
  const [email, setEmail] = useState(state.account?.email || "");
  const [adult, setAdult] = useState(false);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  if (!state.account) return null;
  if (state.account.emailConfirmed)
    return (
      <div className="email-confirmation confirmed" role="status">
        <strong>Correo confirmado</strong>
        <p>{state.account.email}</p>
        <p>
          La mayoría de edad es declarada. El correo confirmado no acredita
          identidad ni edad.
        </p>
      </div>
    );
  return (
    <section className="email-confirmation" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>Confirma tu correo para participar.</h3>
      <p>
        Puedes seguir explorando. Publicar, reservar y conversar requiere correo
        confirmado y declaración de mayoría de edad. No pedimos documentos ni
        biometría.
      </p>
      {!state.account.emailDeliveryAvailable && (
        <p role="status">
          El envío de correos aún no está habilitado en este piloto. La
          participación permanecerá pendiente.
        </p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await state.request("/api/auth/email-code", "POST", {
              email,
              adult,
            })
          ) {
            setSent(true);
            setCode("");
            setResendAt(Date.now() + 60_000);
          }
        }}
      >
        <label htmlFor={`${id}-email`}>Correo para confirmar</label>
        <input
          id={`${id}-email`}
          type="email"
          readOnly={state.account.googleLinked}
          autoComplete="email"
          maxLength={254}
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setSent(false);
          }}
          disabled={state.busy}
        />
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={adult}
            onChange={(e) => setAdult(e.target.checked)}
            required
          />
          <span>
            Confirmo que soy mayor de 18 años. Es una declaración, no una
            verificación de edad.
          </span>
        </label>
        <button
          className="button secondary"
          disabled={
            state.busy ||
            !state.account.emailDeliveryAvailable ||
            Date.now() < resendAt
          }
        >
          {sent ? "Volver a enviar código" : "Enviar código de confirmación"}
        </button>
      </form>
      {sent && (
        <p role="status">
          Código enviado a {state.account.email || email}. Revisa también spam.
          Caduca en 10 minutos. Puedes reenviarlo después de un minuto.
        </p>
      )}
      {(sent || !!state.account.email) && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await state.request("/api/auth/confirm-email", "POST", { code })
            ) {
              setCode("");
              setSent(false);
            }
          }}
        >
          <label htmlFor={`${id}-code`}>Código de confirmación</label>
          <input
            id={`${id}-code`}
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{8}"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={state.busy}
          />
          <button
            className="button primary"
            disabled={state.busy || !/^\d{8}$/.test(code)}
          >
            Confirmar correo
          </button>
        </form>
      )}
      <p className="small-text muted">
        El código solo se usa una vez. Tu correo no se muestra a otros
        participantes.
      </p>
    </section>
  );
}
