import { useEffect, useState } from 'react';
import { prepareImage } from '../media/prepare';

export function ProfilePhoto() {
  const [hasPhoto, setHasPhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Blob | null>(null);
  const [preview, setPreview] = useState('');
  const [declared, setDeclared] = useState(false);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/account/profile/photo', { credentials:'same-origin', cache:'no-store', signal:controller.signal }).then(r => { if (r.status !== 200 && r.status !== 404) throw Error(); setHasPhoto(r.ok); }).catch(() => { if (!controller.signal.aborted) setMessage('No pudimos consultar tu foto.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => { if (!draft) { setPreview(''); return; } const url = URL.createObjectURL(draft); setPreview(url); return () => URL.revokeObjectURL(url); }, [draft]);
  async function choose(file?: File) {
    if (!file) return; setBusy(true); setMessage(''); setDeclared(false); setDraft(null);
    try { setDraft((await prepareImage(file)).blob); } catch { setMessage('No pudimos abrir esa imagen. Elige otra foto.'); } finally { setBusy(false); }
  }
  async function save() {
    if (!draft || !declared || busy) return; setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/account/profile/photo', { method:'POST', credentials:'same-origin', headers:{ 'Content-Type':draft.type, 'X-Photo-Declaration':'yes' }, body:draft });
      if (!response.ok) throw Error(); setHasPhoto(true); setVersion(v => v + 1); setDraft(null); setDeclared(false); setMessage('Tu foto quedó guardada de forma privada.');
    } catch { setMessage('No pudimos guardar la foto. Inténtalo de nuevo.'); } finally { setBusy(false); }
  }
  async function remove() {
    if (busy || !window.confirm('¿Quieres quitar tu foto de Conexiones?')) return; setBusy(true); setMessage('');
    try { const response = await fetch('/api/account/profile/photo', { method:'DELETE', credentials:'same-origin' }); if (!response.ok) throw Error(); setHasPhoto(false); setDraft(null); setMessage('Quitaste tu foto de Conexiones.'); }
    catch { setMessage('No pudimos quitar la foto. Inténtalo de nuevo.'); } finally { setBusy(false); }
  }
  return <section className="panel" aria-labelledby="profile-photo-title">
    <h2 id="profile-photo-title">Tu foto de Conexiones</h2>
    <p>Elige una foto en la que aparezcas tú. La necesitarás para crear o aceptar nuevas conexiones. Tus conversaciones existentes seguirán disponibles.</p>
    <p>Tu foto permanece privada hasta que puedas decidir compartirla. Una foto declarada no verifica tu identidad.</p>
    {loading ? <p role="status">Cargando tu foto…</p> : hasPhoto && <><img src={`/api/account/profile/photo?v=${version}`} alt="Tu foto actual de Conexiones" style={{maxWidth:'12rem',maxHeight:'12rem',objectFit:'contain'}} /><p><button type="button" className="button text" onClick={() => void remove()} disabled={busy}>Quitar mi foto</button></p></>}
    <label className="image-file-label">Elegir foto de galería<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { void choose(e.currentTarget.files?.[0]); e.currentTarget.value=''; }} /></label>{' '}
    <label className="image-file-label">Tomar una selfie<input type="file" accept="image/*" capture="user" disabled={busy} onChange={e => { void choose(e.currentTarget.files?.[0]); e.currentTarget.value=''; }} /></label>
    {draft && <div><p>Vista previa</p><img src={preview} alt="Vista previa de tu foto" style={{maxWidth:'12rem',maxHeight:'12rem',objectFit:'contain'}} /><label className="checkbox-row"><input type="checkbox" checked={declared} onChange={e => setDeclared(e.target.checked)} /> Declaro que aparezco en esta foto.</label><button type="button" className="button primary" onClick={() => void save()} disabled={!declared || busy}>Guardar mi foto</button><button type="button" className="button text" onClick={() => {setDraft(null); setDeclared(false);}} disabled={busy}>Cancelar</button></div>}
    {busy && <p role="status">Preparando tu foto…</p>}{message && <p role="status">{message}</p>}
  </section>;
}
