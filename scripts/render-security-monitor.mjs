const RESOURCE='srv-dbr2npjl550s73c3mte0';
const UNAVAILABLE='No se pudo completar la revisión de incidentes de seguridad en Render.';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

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

export async function runConfiguredSecurityCheck(config,check=checkRenderSecurity) {
 if(!config || !/^tea-[a-z0-9]+$/i.test(config.ownerId||'') || typeof config.apiKey!=='string'||!config.apiKey.trim()) return ['La configuración del monitor de seguridad de Render está incompleta.'];
 try {return await check(config);} catch {return ['No se pudo comprobar la seguridad de Nexafia en Render.'];}
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 let config, input='', alerts;
 try {
  for await(const part of process.stdin) {input+=part;if(input.length>4096) throw Error('Input too long');}
  config=JSON.parse(input);
  alerts=await runConfiguredSecurityCheck(config);
 } catch {alerts=['La configuración del monitor de seguridad de Render está incompleta.'];}
 input=''; if(config) config.apiKey='';
 if(alerts.length) {console.log(alerts.join('\n'));process.exitCode=1;}
 else console.log('Revisión de seguridad de Render completada.');
}
