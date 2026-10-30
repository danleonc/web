import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, MessageCircle, Users } from "lucide-react";
import { Avatar, Modal } from "../components";

const visitKey = "nexafia.tour.v1";
export function useProductTour() {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const [invitation, setInvitation] = useState(() => {
    try { return localStorage.getItem(visitKey) !== "seen"; }
    catch { return true; }
  });
  function dismiss() {
    setInvitation(false);
    try { localStorage.setItem(visitKey, "seen"); } catch { /* Optional preference. */ }
  }
  return {
    open, invitation, dismiss,
    start: () => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dismiss();
      setOpen(true);
    },
    close: () => {
      setOpen(false);
      requestAnimationFrame(() => {
        const target = opener.current?.isConnected ? opener.current : document.getElementById("main-content");
        target?.focus({ preventScroll: true });
      });
    },
  };
}
const steps = [
  {
    name: "La Plaza", icon: MessageCircle,
    title: "Algo en común empieza con algo que compartes.",
    description: "Comparte una idea, un gusto o una pregunta. Lee y responde a tu ritmo, sin tener que coincidir en horario.",
    connection: "Una respuesta puede ser el comienzo de una conexión.",
  },
  {
    name: "Conexiones", icon: Users,
    title: "Dale continuidad a una buena conversación.",
    description: "Si algo de lo que otra persona comparte te interesa, invítala a seguir conversando. Aquí puedes volver al contexto que los acercó.",
    connection: "Enviar una invitación no implica aceptación: seguir es una decisión de ambos.",
  },
  {
    name: "Encuentros", icon: CalendarDays,
    title: "Conoce a otras personas en un grupo pequeño.",
    description: "Elige una temática y un horario para conversar en un grupo de 3 a 6 personas, con una guía opcional para romper el hielo.",
    connection: "Después puedes expresar con quién te gustaría seguir en contacto, sin compromiso.",
  },
];
function Preview({ step }: { step: number }) {
  return (
    <div className={`tour-preview tour-preview-${step}`} aria-label={`Vista de ejemplo de ${steps[step].name}`}>
      <p className="tour-example-label">Vista de ejemplo</p>
      {step === 0 ? <>
        <div className="tour-person"><Avatar name="Participante de ejemplo" small /><span>Alguien de la comunidad</span><span className="tour-topic">Cultura</span></div>
        <h4>¿Qué película te dejó pensando?</h4>
        <p>Hay historias que dan ganas de conversar mucho después de los créditos.</p>
        <div className="tour-response"><MessageCircle size={17} aria-hidden="true" /><span>«A mí me pasa con las historias sobre el futuro».</span></div>
      </> : step === 1 ? <>
        <div className="tour-person"><Avatar name="Participante de ejemplo" small /><strong>Una invitación con algo en común</strong></div>
        <blockquote>«A mí me pasa con las historias sobre el futuro».</blockquote>
        <p>Desde la conversación sobre películas en La Plaza.</p>
        <span className="tour-pending">Esperando aceptación · ejemplo</span>
      </> : <>
        <div className="tour-person"><CalendarDays size={22} aria-hidden="true" /><span className="tour-topic">Cultura</span></div>
        <h4>Historias y cultura</h4>
        <p>Películas, libros y esas historias que te gustaría compartir.</p>
        <div className="tour-response"><Users size={19} aria-hidden="true" /><span>De 3 a 6 personas · Con horario · Guía opcional</span></div>
      </>}
    </div>
  );
}
export function ProductTour({ onClose, onExplore }: {
  onClose: () => void;
  onExplore: (page: "plaza" | "discover") => void;
}) {
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.closest("dialog")?.scrollTo({ top: 0, behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
  }, [step]);
  const current = steps[step];
  const Icon = current.icon;
  return (
    <Modal title="Conoce Nexafia" wide onClose={onClose} initialFocus="[data-tour-heading]">
      <div className="tour-content">
        <ol className="tour-progress" aria-label="Espacios del recorrido">
          {steps.map((item, index) => <li key={item.name} aria-current={step === index ? "step" : undefined}>
            <span aria-hidden="true">{index + 1}</span>{item.name}
          </li>)}
        </ol>
        <section className="tour-step">
          <p className="tour-step-number">Paso {step + 1} de 3 · A tu ritmo</p>
          <h3 ref={heading} tabIndex={-1} data-tour-heading><Icon size={23} aria-hidden="true" />{current.name}</h3>
          <p className="tour-lead">{current.title}</p>
          <p className="tour-description">{current.description}</p>
          <Preview step={step} />
          <p className="tour-connection">{current.connection}</p>
        </section>
        <div className="tour-controls">
          {step > 0 && <button className="button secondary" onClick={() => setStep(step - 1)}><ArrowLeft size={16} aria-hidden="true" />Anterior</button>}
          {step < 2 ? <button className="button primary" onClick={() => setStep(step + 1)}>Siguiente<ArrowRight size={16} aria-hidden="true" /></button> : <div className="tour-destinations">
            <button className="button primary" onClick={() => onExplore("plaza")}>Explorar La Plaza</button>
            <button className="button secondary" onClick={() => onExplore("discover")}>Ver encuentros</button>
          </div>}
        </div>
        <div className="tour-footnote"><p>Los ejemplos no envían invitaciones ni reservan encuentros.</p><button className="button text" onClick={onClose}>Salir del recorrido</button></div>
      </div>
    </Modal>
  );
}
