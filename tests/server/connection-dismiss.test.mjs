import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './feature-fixture.mjs';

test('cada persona puede quitar de su lista una conexión cerrada sin afectar a la otra',async t=>{
 const f=await fixture(t,{plazaEnabled:true});const a=await f.signup('dismiss_a'),b=await f.signup('dismiss_b'),c=await f.signup('dismiss_c');
 const post=(await f.request('/api/plaza/posts','POST',{topic:'cultura',title:'Hola',body:'Hola'},a.cookie)).body.post;
 const inv=(await f.request('/api/plaza/invitations','POST',{kind:'post',contentId:post.id,note:''},b.cookie)).body.invitation;
 const url=`/api/plaza/connections/${inv.id}/dismiss`;
 assert.equal((await f.request(url,'POST',{},c.cookie)).status,404);
 assert.equal((await f.request(url,'POST',{},a.cookie)).status,409);
 assert.equal((await f.request(`/api/plaza/invitations/${inv.id}/decision`,'POST',{action:'accept'},a.cookie)).status,200);
 assert.equal((await f.request(url,'POST',{},a.cookie)).status,409);
 assert.equal((await f.request(`/api/plaza/invitations/${inv.id}/decision`,'POST',{action:'withdraw'},a.cookie)).status,200);
 assert.equal((await f.request(url,'POST',{},a.cookie)).status,200);
 assert.equal((await f.request('/api/plaza/connections','GET',undefined,a.cookie)).body.connections.some(x=>x.id===inv.id),false);
 assert.equal((await f.request('/api/plaza/connections','GET',undefined,b.cookie)).body.connections.some(x=>x.id===inv.id),true);
 await f.restart(); assert.equal((await f.request('/api/plaza/connections','GET',undefined,a.cookie)).body.connections.some(x=>x.id===inv.id),false);
});

test('quitar historial de sala archivada afecta solo a la persona y deniega acceso posterior',async t=>{
 const f=await fixture(t,{plazaEnabled:true});const a=await f.signup('history_hide_a'),b=await f.signup('history_hide_b'),c=await f.signup('history_hide_c');
 const {DatabaseSync}=await import('node:sqlite'); const db=new DatabaseSync(f.path);db.exec('PRAGMA foreign_keys=ON');
 const id='00000000-0000-4000-8000-123456789012'; db.prepare('INSERT OR IGNORE INTO offerings(activity_id,starts_at) VALUES(?,?)').run('history-fixture',1);db.prepare('INSERT INTO rooms(id,activity_id,session_json,revision,idle_at,archived_at) VALUES(?,?,?,?,?,?)').run(id,'history-fixture',JSON.stringify({phase:'closed'}),0,1,1);for(const p of [a,b]) db.prepare('INSERT INTO memberships(room_id,user_id) VALUES(?,?)').run(id,p.id);db.close();
 const url=`/api/history/${id}`;assert.equal((await f.request(url,'DELETE',undefined,c.cookie)).status,404);assert.equal((await f.request(url,'DELETE',undefined,a.cookie)).status,200);assert.equal((await f.request(url,'GET',undefined,a.cookie)).status,404);assert.equal((await f.request(url,'GET',undefined,b.cookie)).status,200);assert.equal((await f.request('/api/history','GET',undefined,a.cookie)).body.rooms.some(r=>r.id===id),false);assert.equal((await f.request('/api/history','GET',undefined,b.cookie)).body.rooms.some(r=>r.id===id),true);
});
