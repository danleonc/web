const RESOURCE='srv-dbr2npjl550s73c3mte0';
const UNAVAILABLE='No se pudo completar la revisión de incidentes de seguridad en Render.';

// Returns only generic messages. Credentials and raw log entries never leave this function.
export async function checkRenderSecurity({ownerId,apiKey,now=Date.now(),request=fetch}) {
 try {
  if(!/^tea-[a-z0-9]+$/i.test(ownerId)||typeof apiKey!=='string'||!apiKey.trim()||!Number.isFinite(now)) throw Error('Invalid configuration');
  const url=new URL('https://api.render.com/v1/logs');
  for(const [key,value] of Object.entries({ownerId,resource:RESOURCE,type:'app',text:'staging_gate_suspicious',startTime:new Date(now-36*3600_000).toISOString(),endTime:new Date(now).toISOString(),direction:'backward',limit:'100'})) url.searchParams.set(key,value);
  const response=await request(url.toString(),{headers:{Authorization:`Bearer ${apiKey}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(10_000)});
  if(!response.ok) throw Error('Request failed');
  const data=await response.json();
  if(!data||typeof data.hasMore!=='boolean'||!Array.isArray(data.logs)||data.logs.length>100) throw Error('Invalid response');
  const entries=data.logs.map(item=>{if(!item||typeof item.message!=='string') throw Error('Invalid log');try{return JSON.parse(item.message);}catch{throw Error('Unrecognized log');}});
  const alerts=[];
  if(entries.some(entry=>entry?.type==='security'&&entry.event==='staging_gate_suspicious')) alerts.push('Render registró intentos repetidos contra el acceso de pruebas de Nexafia.');
  if(data.hasMore) alerts.push('La revisión de incidentes de Render está incompleta y requiere revisión manual.');
  return alerts;
 } catch {return [UNAVAILABLE];}
}
