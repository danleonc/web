import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fixture } from './feature-fixture.mjs';
import { WebSocket } from 'ws';
import { once } from 'node:events';

test('API grupal interna protege origen, membresía, consentimiento y persistencia',async t=>{
 const f=await fixture(t,{plazaEnabled:true,groupReunionsEnabled:true,meetingsEnabled:true,enforceSchedule:false});
 const [a,b,c,d]=await Promise.all(['api_g_a','api_g_b','api_g_c','api_g_d'].map(n=>f.signup(n)));
 const room='90000000-0000-4000-8000-000000000010', db=new DatabaseSync(f.path);
 const activity=db.prepare('SELECT activity_id FROM offerings LIMIT 1').get().activity_id;
 db.prepare('INSERT INTO rooms(id,activity_id,session_json,revision,idle_at,archived_at,safety_json) VALUES(?,?,?,?,?,?,?)').run(room,activity,JSON.stringify({phase:'closed',sessionUntil:123}),1,Date.now(),Date.now(),'{}');
 for(const person of [a,b,c]) db.prepare('INSERT INTO memberships VALUES(?,?)').run(room,person.id); db.close();
 const data={roomId:room,invitees:[b.id,c.id],startsAt:Date.now()+86400000,requestId:'90000000-0000-4000-8000-000000000011'}, path='/api/group-reunions';
 assert.equal((await f.request(path,'POST',data,'')).status,401);
 assert.equal((await f.request(path,'POST',data,a.cookie,'http://hostile.test')).status,403);
 assert.notEqual((await f.request(path,'POST',{...data,invitees:[b.id,d.id]},a.cookie)).status,201);
 const created=await f.request(path,'POST',data,a.cookie); assert.equal(created.status,201); const id=created.body.reunion.id;
 const retry=await f.request(path,'POST',data,a.cookie);assert.equal(retry.status,201);assert.equal(retry.body.reunion.id,id);
 assert.notEqual((await f.request(path,'POST',{...data,startsAt:data.startsAt+60000},a.cookie)).status,201);
 assert.equal((await f.request('/api/plaza/notifications','GET',undefined,b.cookie)).body.items.some(n=>n.kind==='group_invitation' && n.targetId===id),true);
 assert.equal((await f.request('/api/plaza/notifications','GET',undefined,d.cookie)).body.items.some(n=>n.targetId===id),false);
 assert.equal((await f.request('/api/activities','GET',undefined,a.cookie)).body.activities.some(x=>x.id===id),false);
 assert.equal((await f.request(`${path}/${id}`,'GET',undefined,d.cookie)).status,404);
 assert.equal((await f.request(`${path}/${id}/decision`,'POST',{action:'accept'},d.cookie)).status,404);
 const decisions=await Promise.all([f.request(`${path}/${id}/decision`,'POST',{action:'accept'},b.cookie),f.request(`${path}/${id}/decision`,'POST',{action:'accept'},c.cookie)]);
 assert.deepEqual(decisions.map(x=>x.body.reunion.status).sort(),['confirmed','pending']);
 assert.equal((await f.request('/api/plaza/notifications','GET',undefined,a.cookie)).body.items.some(n=>n.kind==='group_confirmed' && n.targetId===id),true);
 const aMeetings=await f.request('/api/activities','GET',undefined,a.cookie);
 assert.equal(aMeetings.body.activities.some(x=>x.id===id && x.mine && x.privateReunion===true),true);
 assert.equal((await f.request('/api/activities','GET',undefined,d.cookie)).body.activities.some(x=>x.id===id),false);
 assert.equal((await f.request(`/api/reservations/${id}`,'POST',{},d.cookie)).status,404);
 await f.restart(); assert.equal((await f.request(`${path}/${id}`,'GET',undefined,a.cookie)).body.reunion.status,'confirmed');
 const health=await f.raw('/api/health',{}); const url=health.url.replace('http:','ws:').replace('/api/health',`/api/rooms/${id}`);
 const sockets=[a,c].map(person=>new WebSocket(url,{headers:{Origin:'http://localhost:4173',Cookie:person.cookie}}));
 await Promise.all(sockets.map(ws=>once(ws,'open')));
 const received=sockets.map(()=>[]);sockets.forEach((ws,i)=>ws.on('message',raw=>received[i].push(JSON.parse(raw.toString()))));
 const closed=sockets.map(ws=>once(ws,'close'));
 assert.equal((await f.request(`${path}/${id}/decision`,'POST',{action:'withdraw'},b.cookie)).body.reunion.status,'cancelled');
 assert.deepEqual((await Promise.all(closed)).map(([code])=>code),[4003,4003]);
 assert.ok(received.every(events=>events.some(event=>event.type==='reunion_cancelled')));
 assert.equal((await f.request('/api/plaza/notifications','GET',undefined,a.cookie)).body.items.some(n=>n.kind==='group_cancelled' && n.targetId===id),true);
 assert.equal((await f.request('/api/activities','GET',undefined,a.cookie)).body.activities.find(x=>x.id===id).cancelled,true);
});

test('API limita solicitudes y rechaza carga no válida',async t=>{
 const f=await fixture(t,{plazaEnabled:true,groupReunionsEnabled:true}); const a=await f.signup('api_g_limit');
 const path='/api/group-reunions';
 const validShape={roomId:'90000000-0000-4000-8000-000000000001',invitees:['90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003'],startsAt:Date.now()+86400000};
 assert.equal((await f.request(path,'POST',{...validShape,extra:true},a.cookie)).status,422);
 for(let i=0;i<10;i++) assert.equal((await f.request(path,'POST',validShape,a.cookie)).status,422);
 assert.equal((await f.request(path,'POST',validShape,a.cookie)).status,429);
});

test('API grupal permanece desactivada por defecto',async t=>{
 const f=await fixture(t,{plazaEnabled:true});const a=await f.signup('api_g_disabled');
 assert.equal((await f.request('/api/group-reunions','GET',undefined,a.cookie)).status,404);
});

test('encuentro privado solo se lista y reserva por miembros autorizados',async t=>{
 const f=await fixture(t,{plazaEnabled:true,meetingsEnabled:true,enforceSchedule:false}); const [a,b]=await Promise.all(['priv_a','priv_b'].map(n=>f.signup(n)));
 const id='90000000-0000-4000-8000-000000000099', db=new DatabaseSync(f.path), starts=Date.now()+86400000;
 db.prepare('INSERT INTO offerings VALUES(?,?)').run(id,starts);
 db.prepare('INSERT INTO scheduled_meetings(id,theme_id,capacity,duration,created_at,created_by) VALUES(?,?,?,?,?,?)').run(id,'cafe',3,40,Date.now(),a.id);
 db.prepare('INSERT INTO private_meetings VALUES(?)').run(id);db.prepare('INSERT INTO private_meeting_members VALUES(?,?)').run(id,a.id); db.close();
 assert.equal((await f.request('/api/activities','GET',undefined,a.cookie)).body.activities.some(x=>x.id===id),true);
 assert.equal((await f.request('/api/activities','GET',undefined,b.cookie)).body.activities.some(x=>x.id===id),false);
 assert.equal((await f.request(`/api/reservations/${id}`,'POST',{},b.cookie)).status,404);
 assert.equal((await f.request(`/api/reservations/${id}`,'POST',{},a.cookie)).status,200);
 const extra=new DatabaseSync(f.path);extra.prepare('INSERT INTO reservations VALUES(?,?,?)').run(b.id,id,Date.now());extra.close();
 const health=await f.raw('/api/health',{});const url=health.url.replace('http:','ws:').replace('/api/health',`/api/rooms/${id}`);
 const status=await new Promise((resolve,reject)=>{const ws=new WebSocket(url,{headers:{Origin:'http://localhost:4173',Cookie:b.cookie}});ws.on('error',()=>{});ws.on('unexpected-response',(_req,res)=>{res.resume();ws.terminate();resolve(res.statusCode);});ws.on('open',()=>{ws.close();reject(Error('Acceso privado indebido'));});});
 assert.equal(status,404);
});

test('retirar historial confirmado revoca sala y oculta el aviso propio',async t=>{
 const f=await fixture(t,{plazaEnabled:true,groupReunionsEnabled:true,meetingsEnabled:true,enforceSchedule:false});
 const [a,b,c]=await Promise.all(['privacy_g_a','privacy_g_b','privacy_g_c'].map(n=>f.signup(n)));
 const room='90000000-0000-4000-8000-000000000020',db=new DatabaseSync(f.path);
 const activity=db.prepare('SELECT activity_id FROM offerings LIMIT 1').get().activity_id;
 db.prepare('INSERT INTO rooms(id,activity_id,session_json,revision,idle_at,archived_at,safety_json) VALUES(?,?,?,?,?,?,?)').run(room,activity,JSON.stringify({phase:'closed',sessionUntil:123}),1,Date.now(),Date.now(),'{}');
 for(const person of [a,b,c]) db.prepare('INSERT INTO memberships VALUES(?,?)').run(room,person.id);db.close();
 const created=await f.request('/api/group-reunions','POST',{roomId:room,invitees:[b.id,c.id],startsAt:Date.now()+86400000},a.cookie);
 assert.equal(created.status,201);const id=created.body.reunion.id;
 assert.equal((await f.request(`/api/group-reunions/${id}/decision`,'POST',{action:'accept'},b.cookie)).status,200);
 assert.equal((await f.request(`/api/group-reunions/${id}/decision`,'POST',{action:'accept'},c.cookie)).status,200);
 const health=await f.raw('/api/health',{}),url=health.url.replace('http:','ws:').replace('/api/health',`/api/rooms/${id}`);
 const ws=new WebSocket(url,{headers:{Origin:'http://localhost:4173',Cookie:a.cookie}});await once(ws,'open');const closed=once(ws,'close');
 assert.equal((await f.request(`/api/history/${room}`,'DELETE',undefined,b.cookie)).status,200);
 assert.equal((await closed)[0],4003);
 assert.equal((await f.request('/api/plaza/notifications','GET',undefined,b.cookie)).body.items.some(n=>n.targetId===id),false);
 assert.equal((await f.request('/api/plaza/notifications','GET',undefined,a.cookie)).body.items.some(n=>n.targetId===id&&n.kind==='group_cancelled'),true);
 assert.equal((await f.request(`/api/group-reunions/${id}`,'GET',undefined,b.cookie)).status,404);
});

test('recordatorio de reencuentro es optativo, privado y respeta la cancelacion',async t=>{
 const f=await fixture(t,{plazaEnabled:true,groupReunionsEnabled:true,meetingsEnabled:true});
 const [a,b,c,d]=await Promise.all(['reminder_a','reminder_b','reminder_c','reminder_d'].map(n=>f.signup(n)));
 const room='90000000-0000-4000-8000-000000000031',db=new DatabaseSync(f.path);const activity=db.prepare('SELECT activity_id FROM offerings LIMIT 1').get().activity_id;
 db.prepare('INSERT INTO rooms(id,activity_id,session_json,revision,idle_at,archived_at,safety_json) VALUES(?,?,?,?,?,?,?)').run(room,activity,JSON.stringify({phase:'closed',sessionUntil:123}),1,Date.now(),Date.now(),'{}');for(const user of [a,b,c])db.prepare('INSERT INTO memberships VALUES(?,?)').run(room,user.id);db.close();
 const made=await f.request('/api/group-reunions','POST',{roomId:room,invitees:[b.id,c.id],startsAt:Date.now()+7200000},a.cookie);assert.equal(made.status,201);const id=made.body.reunion.id;
 await f.request(`/api/group-reunions/${id}/decision`,'POST',{action:'accept'},b.cookie);await f.request(`/api/group-reunions/${id}/decision`,'POST',{action:'accept'},c.cookie);
 const path=`/api/group-reunions/${id}/reminder`;
 assert.equal((await f.request(path,'POST',{minutes:60},d.cookie)).status,404);
 assert.equal((await f.request(path,'POST',{minutes:17},a.cookie)).status,422);
 assert.equal((await f.request(path,'POST',{minutes:60},a.cookie,'https://ajeno.example')).status,403);
 assert.equal((await f.request(path,'POST',{minutes:60},a.cookie)).status,200);
 assert.equal((await f.request(path,'POST',{minutes:15},b.cookie)).status,200);
 await f.restart();
 assert.equal((await f.request('/api/activities','GET',undefined,a.cookie)).body.activities.find(x=>x.id===id).reminderMinutes,60);
 assert.equal((await f.request('/api/plaza/notifications','GET',undefined,a.cookie)).body.items.some(x=>x.kind==='meeting_reminder'),false);
 await f.request('/api/plaza/notifications/read-all','POST',{},a.cookie);
 f.advance(3610000);
 const notices=(await f.request('/api/plaza/notifications','GET',undefined,a.cookie)).body;
 const notice=notices.items.find(x=>x.kind==='meeting_reminder'&&x.targetId===id);assert.equal(notice?.readAt,null);
 assert.equal((await f.request(path,'POST',{minutes:15},a.cookie)).status,200);
 assert.equal((await f.request('/api/plaza/notifications/read','POST',{id:notice.id},a.cookie)).status,404);
 assert.equal((await f.request('/api/plaza/notifications','GET',undefined,b.cookie)).body.items.some(x=>x.kind==='meeting_reminder'),false);
 assert.equal((await f.request(path,'POST',{minutes:0},a.cookie)).status,200);
 assert.equal((await f.request('/api/plaza/notifications','GET',undefined,a.cookie)).body.items.some(x=>x.kind==='meeting_reminder'),false);
 assert.equal((await f.request('/api/activities','GET',undefined,b.cookie)).body.activities.find(x=>x.id===id).reminderMinutes,15);
 assert.equal((await f.request(path,'POST',{minutes:15},a.cookie)).status,200);
 await f.request(`/api/group-reunions/${id}/decision`,'POST',{action:'withdraw'},b.cookie);
 f.advance(3600000);
 assert.equal((await f.request('/api/plaza/notifications','GET',undefined,a.cookie)).body.items.some(x=>x.kind==='meeting_reminder'),false);
});
