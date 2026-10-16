import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Plus,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { interests, boundaryOptions } from "../data";
import type { Profile } from "../store";
import { Illustration } from "../Illustration";

export function ProfileForm({
  profile,
  pending,
  onSave,
  onCancel,
  onPrivacy,
}: {
  profile: Profile | null;
  pending: boolean;
  onSave: (p: Profile) => void;
  onCancel: () => void;
  onPrivacy: () => void;
}) {
  const [step, setStep] = useState(0);
  const [alias, setAlias] = useState(profile?.alias || "");
  const [selected, setSelected] = useState(profile?.interests || []);
  const [boundaries, setBoundaries] = useState(profile?.boundaries || []);
  const [availability, setAvailability] = useState(
    profile?.availability || "Sin preferencia",
  );
  const [adult, setAdult] = useState(profile?.adult || false);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (step === 0) setStep(1);
    else if (adult)
      onSave({
        alias: alias.trim() || "Explorador",
        interests: selected,
        boundaries,
        availability,
        adult,
      });
  }
  const toggle = (values: string[], v: string) =>
    values.includes(v) ? values.filter((x) => x !== v) : [...values, v];
  return (
    <div className="page-content narrow-page">
      <button className="back-link" onClick={onCancel}>
        <ArrowLeft size={16} /> Volver a descubrir
      </button>
      <p className="eyebrow">UN POCO DE TI. SOLO LO QUE QUIERAS.</p>
      <h1>
        {profile
          ? "Tu perfil puede cambiar contigo."
          : "Empecemos por lo que disfrutas."}
      </h1>
      <p className="page-description">
        No tienes que definir qué vínculo buscas. Un interés compartido es un
        buen comienzo.
      </p>
      {pending && (
        <p className="inline-notice">
          <CalendarDays size={17} /> Al terminar guardaremos tu reserva de
          ejemplo.
        </p>
      )}
      <div className="profile-layout">
        <form className="profile-form panel" onSubmit={submit}>
          <div className="step-indicator">
            <span className="current">
              1 <span>Lo que disfrutas</span>
            </span>
            <span className="step-line" />
            <span className={step === 1 ? "current" : ""}>
              2 <span>A tu manera</span>
            </span>
          </div>
          {step === 0 ? (
            <>
              <h2>¿Qué te gustaría compartir?</h2>
              <p className="muted">
                Selecciona lo que te dé curiosidad. Puedes omitirlo y cambiarlo
                después.
              </p>
              <label className="field-label" htmlFor="alias">
                ¿Cómo te llamamos? <span>(opcional)</span>
              </label>
              <input
                className="text-input"
                id="alias"
                maxLength={30}
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="Un nombre o alias de prueba"
                autoComplete="off"
              />
              <fieldset className="interest-fieldset">
                <legend>
                  Mis intereses <span>(opcionales)</span>
                </legend>
                <div className="interest-grid">
                  {interests.map((i) => (
                    <button
                      type="button"
                      key={i}
                      className={`interest-chip ${selected.includes(i) ? "chosen" : ""}`}
                      aria-pressed={selected.includes(i)}
                      onClick={() => setSelected(toggle(selected, i))}
                    >
                      {selected.includes(i) ? (
                        <Check size={16} />
                      ) : (
                        <Plus size={16} />
                      )}{" "}
                      {i}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="field-label" htmlFor="availability">
                ¿Cuándo te acomoda participar?
              </label>
              <select
                id="availability"
                className="text-input"
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
              >
                {[
                  "Sin preferencia",
                  "Durante la semana",
                  "Fines de semana",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
              <p className="small-text muted">
                La disponibilidad se guarda como preferencia; no filtra
                automáticamente este catálogo de ejemplo.
              </p>
              <div className="form-actions">
                <button
                  type="button"
                  className="button text"
                  onClick={() => {
                    setSelected([]);
                    setStep(1);
                  }}
                >
                  Omitir intereses
                </button>
                <button className="button primary" type="submit">
                  Continuar <ArrowRight size={16} />
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>Tu comodidad va primero.</h2>
              <p className="muted">
                Estos límites son privados. En una plataforma real deberían
                respetarse en cada interacción.
              </p>
              <fieldset className="boundary-fieldset">
                <legend>
                  Mis límites <span>(opcionales)</span>
                </legend>
                {boundaryOptions.map((b) => (
                  <label className="checkbox-row" key={b}>
                    <input
                      type="checkbox"
                      checked={boundaries.includes(b)}
                      onChange={() => setBoundaries(toggle(boundaries, b))}
                    />
                    <span>{b}</span>
                  </label>
                ))}
              </fieldset>
              <div className="guideline">
                <LockKeyhole size={21} />
                <div>
                  <strong>No hay IA analizando tus respuestas.</strong>
                  <p>
                    La facilitación de este prototipo usa un guion fijo. No se
                    envía tu información a un modelo ni a otras personas.
                  </p>
                </div>
              </div>
              <label className="checkbox-row adult-check">
                <input
                  type="checkbox"
                  required
                  checked={adult}
                  onChange={(e) => setAdult(e.target.checked)}
                />
                <span>
                  Declaro que soy mayor de 18 años y entiendo que es una prueba
                  con personas ficticias.
                </span>
              </label>
              <p className="small-text muted">
                Esta declaración no verifica tu edad ni identidad. El piloto
                real necesitará controles adicionales.
              </p>
              <div className="form-actions">
                <button
                  type="button"
                  className="button text"
                  onClick={() => setStep(0)}
                >
                  <ArrowLeft size={16} /> Atrás
                </button>
                <button type="submit" className="button primary">
                  {pending ? "Guardar perfil y reservar" : "Guardar mi perfil"}
                  <Check size={17} />
                </button>
              </div>
            </>
          )}
        </form>
        <aside className="profile-aside">
          <div className="profile-aside-art">
            <Illustration scene="walk" />
          </div>
          <h3>No eres una etiqueta.</h3>
          <p>
            Los intereses cambian. Las conexiones sorprenden. Puedes explorar
            sin saber exactamente qué buscas.
          </p>
          <button className="privacy-link" onClick={onPrivacy}>
            <ShieldCheck size={16} /> ¿Qué se guarda sobre mí?
          </button>
        </aside>
      </div>
    </div>
  );
}
