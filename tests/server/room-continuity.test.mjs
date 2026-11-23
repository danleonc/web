import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fixture } from './feature-fixture.mjs';

test('solicitud tras encuentro requiere participación, cierre y aceptación',async t=>{
 const f=await fixture(t,{plazaEnabled:true});const a=await f.signup('room_inv_a'),b=await f.signup('room_inv_b'),c=await f.signup('room_inv_c');
 const room='90000000-0000-4000-8000-000000000001';const db=new DatabaseSync(f.path);
 const activity=db.prepare('SELECT activity_id FROM offerings LIMIT 1').get().activity_id;
 db.prepare('INSERT INTO rooms(id,activity_id,session_json,revision,idle_at,archived_at,safety_json) VALUES(?,?,?,?,?,NULL,?)').run(room,activity,JSON.stringify({phase:'lobby'}),1,1,'{}');
 db.prepare('INSERT INTO memberships(room_id,user_id) VALUES(?,?)').run(room,a.id);db.prepare('INSERT INTO memberships(room_id,user_id) VALUES(?,?)').run(room,b.id);db.close();
 const path='/api/plaza/room-invitations', body={roomId:room,targetId:b.id,note:'Fue grato conversar',photoChallengeAccepted:true};
 assert.notEqual((await f.request(path,'POST',body,a.cookie)).status,201);
 const neverStarted=new DatabaseSync(f.path);neverStarted.prepare('UPDATE rooms SET session_json=? WHERE id=?').run(JSON.stringify({phase:'closed',sessionUntil:0}),room);neverStarted.close();
 assert.notEqual((await f.request(path,'POST',body,a.cookie)).status,201);
 const update=new DatabaseSync(f.path);update.prepare('UPDATE rooms SET session_json=? WHERE id=?').run(JSON.stringify({phase:'closed',sessionUntil:123}),room);update.close();
 assert.notEqual((await f.request(path,'POST',body,c.cookie)).status,201);
 assert.notEqual((await f.request(path,'POST',{...body,targetId:c.id},a.cookie)).status,201);
 const peers=await f.request(`/api/plaza/rooms/${room}/people`,'GET',undefined,a.cookie);assert.equal(peers.status,200);assert.deepEqual(peers.body.people.map(p=>p.id),[b.id]);
 assert.equal((await f.request(`/api/plaza/rooms/${room}/people`,'GET',undefined,c.cookie)).status,404);
 const invited=await f.request(path,'POST',body,a.cookie);assert.equal(invited.status,201);const id=invited.body.invitation.id;
 assert.equal((await f.request(`/api/plaza/connections/${id}/messages`,'GET',undefined,a.cookie)).status,404);
 assert.equal((await f.request(`/api/plaza/invitations/${id}/decision`,'POST',{action:'accept'},b.cookie)).status,200);
 assert.equal((await f.request(`/api/plaza/connections/${id}/messages`,'GET',undefined,a.cookie)).status,200);
 assert.equal((await f.request('/api/plaza/notifications','GET',undefined,b.cookie)).body.items.some(n=>n.kind==='invitation'),false);
 const dismissal=new DatabaseSync(f.path);dismissal.prepare('INSERT INTO room_history_dismissals(user_id,room_id,created_at) VALUES(?,?,?)').run(b.id,room,1);dismissal.close();
 assert.deepEqual((await f.request(`/api/plaza/rooms/${room}/people`,'GET',undefined,a.cookie)).body.people,[]);
 assert.notEqual((await f.request(path,'POST',body,a.cookie)).status,201);
 await f.request(`/api/plaza/connections/${id}/block`,'POST',{},b.cookie);
 assert.notEqual((await f.request(path,'POST',body,a.cookie)).status,201);
 assert.deepEqual((await f.request(`/api/plaza/rooms/${room}/people`,'GET',undefined,a.cookie)).body.people,[]);
});

test('invitación del encuentro respeta requisito de foto y acuerdo',async t=>{
 const f=await fixture(t,{plazaEnabled:true,requireConnectionPhoto:true});const a=await f.signup('room_photo_a'),b=await f.signup('room_photo_b');
 const room='90000000-0000-4000-8000-000000000002';const db=new DatabaseSync(f.path);const activity=db.prepare('SELECT activity_id FROM offerings LIMIT 1').get().activity_id;
 db.prepare('INSERT INTO rooms(id,activity_id,session_json,revision,idle_at,archived_at,safety_json) VALUES(?,?,?,?,?,NULL,?)').run(room,activity,JSON.stringify({phase:'closed',sessionUntil:123}),1,1,'{}');
 db.prepare('INSERT INTO memberships(room_id,user_id) VALUES(?,?)').run(room,a.id);db.prepare('INSERT INTO memberships(room_id,user_id) VALUES(?,?)').run(room,b.id);db.close();
 const result=await f.request('/api/plaza/room-invitations','POST',{roomId:room,targetId:b.id,note:'Hola',photoChallengeAccepted:true},a.cookie);
 assert.equal(result.status,403);assert.equal(result.body.error,'profile_photo_required');
 const photos=new DatabaseSync(f.path);
 for (const person of [a,b]) photos.prepare('INSERT INTO account_profile_photos(user_id,id,body,declared_at) VALUES(?,?,?,?)').run(person.id,`photo-${person.id}`,Buffer.from('fixture'),1);
 photos.close();
 const body={roomId:room,targetId:b.id,note:'Hola'};
 assert.notEqual((await f.request('/api/plaza/room-invitations','POST',body,a.cookie)).status,201);
 const [first,reverse]=await Promise.all([
  f.request('/api/plaza/room-invitations','POST',{...body,photoChallengeAccepted:true},a.cookie),
  f.request('/api/plaza/room-invitations','POST',{...body,targetId:a.id,photoChallengeAccepted:true},b.cookie),
 ]);
 assert.equal([first,reverse].filter(r=>r.status===201).length,1);
 assert.equal([first,reverse].find(r=>r.status!==201).body.error,'incoming_request_exists');
 const check=new DatabaseSync(f.path);
 assert.equal(check.prepare("SELECT COUNT(*) AS count FROM plaza_connections WHERE status='pending'").get().count,1);
 check.close();
});
