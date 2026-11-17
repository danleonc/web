import { useEffect, useState } from 'react';
import { ReportDialog } from '../safety/ReportDialog';
import { LockKeyhole, Sparkles } from 'lucide-react';

export function ConnectionPhoto({ id, person, onProfile }: { id:string; person:string; onProfile:() => void }) {
  const [challenge, setChallenge] = useState<{mine:boolean;theirs:boolean;ready:boolean;started:boolean;rounds:number;unlocked:boolean} | null>(null);
  const [status, setStatus] = useState<{mine:boolean;theirs:boolean;theirsId:string|null} | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [revision, setRevision] = useState(0);
  const [reportId, setReportId] = useState<string|null>(null); const [reported, setReported] = useState(false);
  const path = `/api/plaza/connections/${id}/profile-photo`;
  useEffect(() => {
    let cancelled=false; let timer:ReturnType<typeof setTimeout>;
    async function refresh() {
      try { const response=await fetch(path,{credentials:'same-origin',cache:'no-store'}); if (!response.ok) throw Error(); const data=await response.json(); const challengeResponse=await fetch(`/api/plaza/connections/${id}/photo-challenge`,{credentials:'same-origin',cache:'no-store'}); if (!challengeResponse.ok) throw Error(); const nextChallenge=await challengeResponse.json(); if (!cancelled) { setStatus(data); setChallenge(nextChallenge); setError(''); } }
      catch { if (!cancelled) { setStatus(null); setError('No pudimos consultar el estado de las fotos.'); } }
      finally { if (!cancelled) timer=setTimeout(refresh,5000); }
    }
    void refresh(); return () => {cancelled=true;clearTimeout(timer);};
  },[path,revision]);
  async function join() {
    if (busy) return;
    setBusy(true); setError('');
    try { const response=await fetch(`/api/plaza/connections/${id}/photo-challenge`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:challenge?.mine ? 'start' : 'join'})}); if (!response.ok) throw Error(response.status === 422 ? 'Agrega tu foto en tu perfil antes de empezar.' : 'No pudimos activar el desafío.'); setRevision(v=>v+1); }
    catch(e) {setError(e instanceof Error ? e.message : 'No pudimos activar el desafío.');} finally {setBusy(false);}
  }
  return <section className="connection-discovery" aria-label="Fotos de la conexión">
    <div className="connection-discovery-photo">
      {status?.theirs ? <img src={`${path}/image?v=${revision}`} alt={`Foto compartida por ${person}`} /> : <div className="connection-photo-locked" role="img" aria-label="Foto por descubrir"><LockKeyhole size={24} aria-hidden="true" /></div>}
    </div>
    <div className="connection-discovery-copy"><span className="connection-discovery-eyebrow"><Sparkles size={15} aria-hidden="true" /> Algo por descubrir</span>
      <h3>Diez vueltas para descubrirse</h3>
      {status && challenge ? <>
        {status.theirs ? <p>{person} compartió su foto contigo.</p> : challenge.unlocked && <p>La foto de {person} no está disponible en este momento.</p>}
        {!challenge.unlocked && (challenge.ready && challenge.started ? <><p>Cada vuelta los acerca a descubrir sus fotos.</p><progress max={10} value={challenge.rounds} aria-label="Progreso del desafío" /><p><strong>{challenge.rounds} de 10 vueltas</strong> · Una vuelta es un mensaje de cada persona.</p></> : challenge.mine && challenge.started ? <p>Esperando a {person} para empezar el desafío.</p> : <><p>Al completar 10 vueltas, descubrirán ambas fotos al mismo tiempo.</p><button type="button" className="button secondary" disabled={busy} onClick={() => void join()}>{challenge.started ? 'Aceptar desafío' : 'Solicitar descubrir fotos'}</button></>)}
        {status.theirs && <button type="button" className="button text" onClick={() => setReportId(status.theirsId)}>Reportar foto</button>}
      </> : <p role="status">Consultando fotos…</p>}
    </div>
    {error && <p role="alert">{error}</p>}{error.startsWith('Agrega tu foto') && <button type="button" className="button text" onClick={onProfile}>Ir a mi perfil</button>}
    {reported && <p role="status">Tu reporte fue enviado para revisión.</p>}
    {reportId && <ReportDialog subject={`Foto compartida por ${person}`} onClose={() => setReportId(null)} onSubmit={async (reason,note) => { const response=await fetch('/api/plaza/reports',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'profile_photo',contentId:reportId,reason,note})}); if (!response.ok) throw Error('No pudimos enviar el reporte. La foto podría ya no estar disponible.'); setReported(true); }} />}
  </section>;
}
