import { useEffect, useState } from 'react';
import { ReportDialog } from '../safety/ReportDialog';

export function ConnectionPhoto({ id, person, onProfile }: { id:string; person:string; onProfile:() => void }) {
  const [status, setStatus] = useState<{mine:boolean;theirs:boolean;theirsId:string|null} | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [revision, setRevision] = useState(0);
  const [reportId, setReportId] = useState<string|null>(null); const [reported, setReported] = useState(false);
  const path = `/api/plaza/connections/${id}/profile-photo`;
  useEffect(() => {
    let cancelled=false; let timer:ReturnType<typeof setTimeout>;
    async function refresh() {
      try { const response=await fetch(path,{credentials:'same-origin',cache:'no-store'}); if (!response.ok) throw Error(); const data=await response.json(); if (!cancelled) setStatus(data); }
      catch { if (!cancelled) { setStatus(null); setError('No pudimos consultar el estado de las fotos.'); } }
      finally { if (!cancelled) timer=setTimeout(refresh,5000); }
    }
    void refresh(); return () => {cancelled=true;clearTimeout(timer);};
  },[path,revision]);
  async function change(action:'share'|'revoke') {
    if (busy) return;
    if (action === 'share' && !window.confirm(`¿Compartir tu foto de Conexiones con ${person}? Podrás dejar de compartirla después.`)) return;
    setBusy(true);setError('');
    try { const response=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})}); const body=await response.json(); if (!response.ok) throw Error(body.error === 'profile_photo_required' ? 'Agrega tu foto en tu perfil antes de compartirla.' : 'No pudimos actualizar tu foto.'); setRevision(v=>v+1); }
    catch(e) {setError(e instanceof Error ? e.message : 'No pudimos actualizar tu foto.');} finally {setBusy(false);}
  }
  return <section aria-label="Fotos de la conexión"><h3>Descubrir nuestras fotos</h3><p>Cada persona decide si comparte su foto en esta conversación. Puedes dejar de compartirla cuando quieras; eso no elimina copias que alguien ya haya guardado.</p>
    {status ? <><p>{status.mine ? `Compartes tu foto con ${person}.` : 'Tu foto aún es privada en esta conexión.'}</p><button type="button" className="button secondary" disabled={busy} onClick={() => void change(status.mine ? 'revoke' : 'share')}>{status.mine ? 'Dejar de compartir mi foto' : 'Compartir mi foto'}</button>
      {status.theirs ? <div><p>{person} compartió su foto contigo.</p><img src={`${path}/image?v=${revision}`} alt={`Foto compartida por ${person}`} style={{maxWidth:'12rem',maxHeight:'12rem',objectFit:'contain'}} /><p><button type="button" className="button text" onClick={() => setReportId(status.theirsId)}>Reportar foto</button></p></div> : <p>{person} aún no ha compartido su foto contigo.</p>}</> : <p role="status">Consultando fotos…</p>}
    {error && <p role="alert">{error}</p>}{error.startsWith('Agrega tu foto') && <button type="button" className="button text" onClick={onProfile}>Ir a mi perfil</button>}
    {reported && <p role="status">Tu reporte fue enviado para revisión.</p>}
    {reportId && <ReportDialog subject={`Foto compartida por ${person}`} onClose={() => setReportId(null)} onSubmit={async (reason,note) => { const response=await fetch('/api/plaza/reports',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'profile_photo',contentId:reportId,reason,note})}); if (!response.ok) throw Error('No pudimos enviar el reporte. La foto podría ya no estar disponible.'); setReported(true); }} />}
  </section>;
}
