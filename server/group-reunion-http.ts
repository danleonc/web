import type { IncomingMessage, ServerResponse } from 'node:http';
import { GroupReunionStore } from './group-reunion-store.ts';
import { digest, type Storage } from './storage.ts';

export async function handleGroupReunions(storage:Storage, now:()=>number, validOrigin:(req:IncomingMessage)=>boolean, req:IncomingMessage, res:ServerResponse, path:string, actor:{id:string}|null) {
  const json=(status:number,value:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
  if(!actor) { req.resume(); json(401,{error:'session_required'}); return; }
  const item=path.match(/^\/api\/group-reunions\/([a-f0-9-]{36})$/);
  const decision=path.match(/^\/api\/group-reunions\/([a-f0-9-]{36})\/decision$/);
  const store=new GroupReunionStore(storage,now);
  if(req.method==='GET') {
    if(path==='/api/group-reunions') { const rows=storage.db.prepare('SELECT reunion_id AS id FROM group_reunion_members WHERE user_id=? ORDER BY rowid DESC LIMIT 100').all(actor.id); json(200,{reunions:rows.flatMap(row=>{const value=store.get(String(row.id),actor.id);return value?[value]:[];})}); return; }
    if(item) { const value=store.get(item[1],actor.id); json(value?200:404,value?{reunion:value}:{error:'not_found'}); return; }
    json(404,{error:'not_found'}); return;
  }
  if(!validOrigin(req)) {req.resume();json(403,{error:'origin_rejected'});return;}
  try {
    if(req.method!=='POST' || (!decision && path!=='/api/group-reunions')) {req.resume();json(404,{error:'not_found'});return;}
    if(!req.headers['content-type']?.startsWith('application/json')) throw Error('invalid_body');
    const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4096) throw Error('invalid_body');chunks.push(chunk);}
    const data:unknown=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!data || typeof data!=='object' || Array.isArray(data)) throw Error('invalid_body');
    const value=data as Record<string,unknown>;
    if(decision) {
      if(Object.keys(value).length!==1 || typeof value.action!=='string' || !['accept','decline','cancel','withdraw'].includes(value.action)) throw Error('invalid_body');
      if(!store.get(decision[1],actor.id)) {json(404,{error:'not_found'});return;}
      const reunion=store.decide(decision[1],actor.id,value.action as 'accept'|'decline'|'cancel'|'withdraw');json(200,{reunion});return;
    }
    if((Object.keys(value).length!==3 && Object.keys(value).length!==4) || Object.keys(value).some(key=>!['roomId','invitees','startsAt','requestId'].includes(key)) || typeof value.roomId!=='string' || !/^[a-f0-9-]{36}$/.test(value.roomId) || !Array.isArray(value.invitees) || value.invitees.some(id=>typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id)) || typeof value.startsAt!=='number' || (value.requestId!==undefined && (typeof value.requestId!=='string' || !/^[a-f0-9-]{36}$/.test(value.requestId)))) throw Error('invalid_body');
    if(!storage.takeLimit(digest(`group-reunion:${actor.id}`),10,3600000,now())) {json(429,{error:'rate_limited'});return;}
    const id=store.create(actor.id,value.roomId,value.invitees as string[],value.startsAt,value.requestId as string|undefined);const reunion=store.get(id,actor.id);if(!reunion){json(404,{error:'not_found'});return;}json(201,{reunion});
  } catch {req.resume();json(422,{error:'invalid_request'});}
}
