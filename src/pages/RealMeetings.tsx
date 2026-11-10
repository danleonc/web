import { useState } from "react";
import type { FormEvent } from "react";
import { featuredActivities } from "../data";
import { HeroPhoto } from "../HeroPhoto";
import { encountersHeroPhoto } from "../heroPhotos";
import { useAccount } from "../shared/accounts";
import type { Offering } from "../shared/accounts";
import "./RealPlaza.css";

const date = (value: string) => new Intl.DateTimeFormat("es-CL", { dateStyle: "full", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date(value));
export function RealMeetings({ onEnter, onAccess }: { onEnter: (meeting: Offering) => void; onAccess: () => void }) {
  const account = useAccount();
  const [theme, setTheme] = useState("cafe"); const [startsAt, setStartsAt] = useState(""); const [capacity, setCapacity] = useState(4);
  const [notice, setNotice] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  async function create(e: FormEvent) {
    e.preventDefault(); setNotice("");
    const start = new Date(startsAt).getTime();
    if (!Number.isFinite(start)) { setNotice("Indica una fecha y hora válidas."); return; }
    if (await account.request("/api/meetings", "POST", { themeId: theme, startsAt: start, capacity })) { setNotice("Convocatoria creada."); setStartsAt(""); }
  }
  return <div className="page-content plaza-page real-plaza">
    <section className="plaza-welcome plaza-photo-hero"><div className="plaza-welcome-copy"><h1>Encuentros para compartir de verdad.</h1><p>Elige una conversación en grupo y participa a tu ritmo.</p></div><HeroPhoto images={encountersHeroPhoto} alt="Personas compartiendo desde sus propios espacios" /></section>
    {!account.loaded ? <p role="status">Cargando tu sesión…</p> : !account.account?.canParticipate ? <section className="real-plaza-panel"><h2>Entra a tus encuentros</h2><p>Inicia sesión y confirma tu correo para reservar.</p><button className="button primary" onClick={onAccess}>Entrar a mi cuenta</button></section> : <>
      {account.account.moderator && <details className="real-plaza-panel"><summary>Programar un encuentro</summary><form className="real-plaza-form" onSubmit={(e) => void create(e)}>
        <label>Tema<select value={theme} onChange={(e) => setTheme(e.target.value)}>{featuredActivities.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label>Fecha y hora del encuentro<input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label><p>La fecha ingresada usa la zona horaria de tu dispositivo. Las convocatorias se muestran en horario de Santiago de Chile.</p>
        <label>Cupos<select value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}>{[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <button className="button primary" disabled={account.busy}>Crear convocatoria</button></form>{notice && <p role="status">{notice}</p>}</details>}
      {account.error && <p role="alert">{account.error}</p>}
      <section className="real-plaza-panel"><h2>Próximos encuentros</h2><p>Horarios de Santiago de Chile.</p>
        {account.activities.length === 0 ? <p>Por ahora no hay convocatorias programadas.</p> : account.activities.map((meeting) => <article className="real-plaza-post" key={meeting.id}><h3>{meeting.title}</h3><p>{date(meeting.startsAt)}</p><p>{meeting.reserved} de {meeting.maximum} plazas reservadas · mínimo {meeting.minimum} personas</p>
          {meeting.cancelled && <p role="status">Encuentro cancelado. {meeting.cancellationReason}</p>}
          <button className="button secondary" disabled={account.busy || (!meeting.mine && (!meeting.bookingOpen || meeting.reserved >= meeting.maximum))} onClick={() => void account.request(`/api/reservations/${meeting.id}`, meeting.mine ? "DELETE" : "POST")}>{meeting.cancelled ? "Quitar aviso" : meeting.mine ? "Cancelar reserva" : "Reservar encuentro"}</button>
          {meeting.mine && !meeting.cancelled && <><p>Reserva confirmada</p><button className="button primary" disabled={!meeting.accessible || meeting.ended} onClick={() => onEnter(meeting)}>Entrar al encuentro</button></>}
          {account.account?.moderator && !meeting.cancelled && !meeting.ended && <details><summary>Cancelar convocatoria</summary><form className="real-plaza-form" onSubmit={(e) => { e.preventDefault(); void account.request(`/api/meetings/${meeting.id}/cancel`, "POST", { reason: reasons[meeting.id] || "" }); }}><p>Las personas con reserva verán el aviso al entrar. Puedes cancelar hasta cinco minutos antes del comienzo.</p><label>Motivo de cancelación<textarea required minLength={5} maxLength={500} value={reasons[meeting.id] || ""} onChange={(e) => setReasons({ ...reasons, [meeting.id]: e.target.value })} /></label><button className="button secondary" disabled={account.busy}>Confirmar cancelación</button></form></details>}
        </article>)}
      </section>
    </>}
  </div>;
}
