import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { retryId, clearRetry } from '../room/reunionRetry';

type Person={id:string;name:string;response:'pending'|'accepted'};
type Reunion={id:string;organizer:string;startsAt:number;status:'pending'|'confirmed'|'cancelled';members:Person[];responses:Record<string,'pending'|'accepted'>};
async function request<T>(path:string,body?:object):Promise<T> {
  let response:Response;
  try {response=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});}
  catch {throw Error('No pudimos conectar. Revisa tus propuestas antes de volver a intentarlo.');}
  if(!response.ok) throw Error(response.status===429?'Espera antes de enviar otra solicitud.':'No pudimos completar la acción. Comprueba que el encuentro y las personas sigan disponibles.');
  return response.json() as Promise<T>;
}
const time=(value:number)=>new Intl.DateTimeFormat('es-CL',{dateStyle:'full',timeStyle:'short',timeZone:'America/Santiago'}).format(value);

export function ProposeGroupReunion({accountId,roomId,people}:{accountId:string;roomId:string;people:{id:string;name:string}[]}) {
  const [chosen,setChosen]=useState<string[]>([]);const [start,setStart]=useState('');const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const [error,setError]=useState('');
  const pending=useRef<{signature:string;id:string}|null>(null);
  async function submit(event:FormEvent) {
    event.preventDefault();if(busy)return;setError('');setNotice('');
    const startsAt=new Date(start).getTime();if(!Number.isFinite(startsAt)||chosen.length<2){setError('Elige al menos dos participantes y una fecha válida.');return;}
    const proposal={accountId,roomId,invitees:chosen,startsAt};
    const signature=JSON.stringify([accountId,roomId,[...chosen].sort(),startsAt]);
    setBusy(true);try {
      if(pending.current?.signature!==signature) {
        let id:string;try {id=await retryId(window.sessionStorage,proposal);} catch {id=crypto.randomUUID();}
        pending.current={signature,id};
      }
      await request('/api/group-reunions',{roomId,invitees:chosen,startsAt,requestId:pending.current.id});
      try {await clearRetry(window.sessionStorage,proposal);} catch {}setNotice('Solicitud enviada. El reencuentro se confirma cuando todas las personas acepten.');setChosen([]);setStart('');pending.current=null;} catch(e){setError(e instanceof Error?e.message:'No pudimos enviar la solicitud.');} finally{setBusy(false);}
  }
  return <details><summary>Proponer un reencuentro grupal</summary><form className="real-plaza-form" onSubmit={e=>void submit(e)}><p>Elige a las personas y propón una hora. Si todas aceptan, se reservará una plaza para cada una; nadie queda inscrito antes.</p>
    <fieldset><legend>Participantes</legend>{people.map(person=><label key={person.id} className="checkbox-row"><input type="checkbox" checked={chosen.includes(person.id)} onChange={e=>setChosen(previous=>e.target.checked?[...previous,person.id]:previous.filter(id=>id!==person.id))}/>{person.name}</label>)}</fieldset>
    {people.length<2 && <p>Se necesitan al menos otras dos personas disponibles.</p>}
    <label>Fecha y hora propuestas<input type="datetime-local" required value={start} onChange={e=>setStart(e.target.value)}/></label><p>Usa la zona horaria de tu dispositivo. Verás la convocatoria en horario de Santiago.</p>
    <button className="button primary" disabled={busy||chosen.length<2}>Enviar propuesta</button>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </form></details>;
}

export function GroupReunionInbox({accountId,onChanged}:{accountId:string;onChanged:()=>Promise<void>}) {
  const [items,setItems]=useState<Reunion[]>([]);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const statusElements=useRef(new Map<string,HTMLParagraphElement>());const focusAfterRefresh=useRef<string|null>(null);
  const refresh=useCallback(async(focusId?:string)=>{const result=await request<{reunions:Reunion[]}>('/api/group-reunions');if(focusId)focusAfterRefresh.current=focusId;setItems(result.reunions);setError('');setLoading(false);},[]);
  useEffect(()=>{const id=focusAfterRefresh.current;if(id){focusAfterRefresh.current=null;statusElements.current.get(id)?.focus();}},[items]);
  useEffect(()=>{let active=true;const update=()=>{if(active&&document.visibilityState==='visible')void refresh().catch(()=>{if(active){setLoading(false);setError('No pudimos cargar las propuestas.');}});};update();const timer=window.setInterval(update,10000);return()=>{active=false;window.clearInterval(timer);};},[accountId,refresh]);
  async function decide(id:string,action:string){if(busy)return;if((action==='withdraw'||action==='cancel')&&!window.confirm('¿Retirar tu participación? La propuesta o el reencuentro se cancelará para todo el grupo.'))return;setBusy(true);setError('');try{await request(`/api/group-reunions/${id}/decision`,{action});await Promise.all([refresh(id),onChanged()]);}catch(e){setError(e instanceof Error?e.message:'No pudimos guardar tu respuesta.');}finally{setBusy(false);}}
  return <section className="real-plaza-panel" aria-label="Reencuentros grupales"><h2>Reencuentros grupales</h2><p>Si todas las personas aceptan, se reservará una plaza para cada una.</p>{error&&<p role="alert">{error}</p>}{loading?<p role="status">Cargando propuestas…</p>:items.length===0?<p>Aún no tienes propuestas.</p>:items.map(item=><article className="real-plaza-post" key={item.id}><h3>Propuesta de reencuentro</h3><p>{time(item.startsAt)}</p><p>{item.members.map(person=>person.name).join(', ')}</p><p role="status" tabIndex={-1} ref={node=>{if(node)statusElements.current.set(item.id,node);else statusElements.current.delete(item.id);}}>{item.status==='confirmed'?'Reencuentro confirmado. Puedes entrar desde Próximos encuentros.':item.status==='cancelled'?'Propuesta cancelada.':item.organizer!==accountId&&item.responses[accountId]==='accepted'?'Ya aceptaste. Esperando la respuesta de las demás personas.':'Esperando la respuesta de todas las personas.'}</p>
    {item.status==='pending'&&item.responses[accountId]==='pending'&&<div className="session-actions"><button className="button primary" disabled={busy} onClick={()=>void decide(item.id,'accept')}>Aceptar reencuentro</button><button className="button text" disabled={busy} onClick={()=>void decide(item.id,'decline')}>Rechazar reencuentro</button></div>}
    {item.status==='pending'&&item.organizer===accountId&&<button className="button text" disabled={busy} onClick={()=>void decide(item.id,'cancel')}>Cancelar propuesta</button>}
    {item.status!=='cancelled'&&item.responses[accountId]==='accepted'&&item.organizer!==accountId&&<button className="button text" disabled={busy} onClick={()=>void decide(item.id,'withdraw')}>Retirar mi participación</button>}
    {item.status==='confirmed'&&item.organizer===accountId&&<button className="button text" disabled={busy} onClick={()=>void decide(item.id,'withdraw')}>Retirar mi participación</button>}
  </article>)}</section>;
}
