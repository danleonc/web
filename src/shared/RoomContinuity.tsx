import { useEffect, useState } from 'react';

export function ContinueAfterMeeting({ roomId, people, onProfile }: {roomId:string; people:{id:string;name:string}[]; onProfile:()=>void}) {
  const [target,setTarget] = useState<{id:string;name:string}|null>(null);
  const [agreement,setAgreement] = useState(false); const [busy,setBusy] = useState(false); const [notice,setNotice] = useState(''); const [error,setError] = useState('');
  async function send() {
    if (!target || !agreement || busy) return; setBusy(true); setError(''); setNotice('');
    try {
      const response=await fetch('/api/plaza/room-invitations',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomId,targetId:target.id,note:'Nos conocimos en un encuentro de Nexafia.',photoChallengeAccepted:true})});
      const result=await response.json();
      if (!response.ok) throw Error(result.error==='profile_photo_required' ? 'Agrega tu foto de Conexiones para enviar una solicitud. Luego puedes volver desde el historial de salas.' : 'No pudimos enviar la solicitud. Comprueba que el encuentro y la conexión sigan disponibles.');
      setNotice(result.invitation.status==='accepted' ? `Ya tienes una conexión con ${target.name}.` : `Solicitud enviada a ${target.name}. Esa persona decide si acepta.`); setTarget(null); setAgreement(false);
    } catch(e) { setError(e instanceof Error ? e.message : 'No pudimos enviar la solicitud.'); }
    finally {setBusy(false);}
  }
  return <section aria-label="Seguir conversando"><h3>¿Seguimos conversando?</h3><p>Elige a alguien del encuentro para enviarle una solicitud privada.</p>
    {people.length ? people.map(person=><button key={person.id} type="button" className="button secondary" disabled={busy} onClick={()=>{setTarget(person);setAgreement(false);setError('');setNotice('');}}>Conectar con {person.name}</button>) : <p>No hay otras personas disponibles en este encuentro.</p>}
    {target && <div><p>Enviar solicitud a {target.name}. La otra persona decide si acepta.</p><label className="checkbox-row"><input type="checkbox" checked={agreement} onChange={e=>setAgreement(e.target.checked)}/> Acepto que nuestras fotos se compartan automáticamente después de 10 vueltas de conversación.</label><button type="button" className="button primary" disabled={!agreement || busy} onClick={()=>void send()}>Enviar solicitud</button><button type="button" className="button text" disabled={busy} onClick={()=>setTarget(null)}>Cancelar</button></div>}
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}{error.startsWith('Agrega tu foto') && <button type="button" className="button text" onClick={onProfile}>Ir a mi perfil</button>}
  </section>;
}

export function HistoryContinuity({roomId,onProfile}:{roomId:string;onProfile:()=>void}) {
  const [open,setOpen]=useState(false); const [people,setPeople]=useState<{id:string;name:string}[]|null>(null); const [error,setError]=useState('');
  useEffect(()=>{ if(!open) return; let cancelled=false; setPeople(null); setError(''); fetch(`/api/plaza/rooms/${roomId}/people`,{credentials:'same-origin'}).then(async r=>{if(!r.ok) throw Error(); return r.json();}).then(result=>{if(!cancelled) setPeople(result.people);}).catch(()=>{if(!cancelled) setError('No pudimos cargar las personas de este encuentro.');}); return ()=>{cancelled=true;}; },[open,roomId]);
  return <details onToggle={e=>setOpen(e.currentTarget.open)}><summary>Seguir conversando con participantes</summary>{error && <p role="alert">{error}</p>}{open && people===null && !error && <p role="status">Cargando participantes…</p>}{open && people && <ContinueAfterMeeting roomId={roomId} people={people} onProfile={onProfile}/>}</details>;
}
