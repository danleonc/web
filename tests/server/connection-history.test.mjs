import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fixture } from './feature-fixture.mjs';

test('historial privado paginado conserva orden y restringe el acceso', async t => {
 const f=await fixture(t,{plazaEnabled:true}); const a=await f.signup('history_page_a'), b=await f.signup('history_page_b'), outsider=await f.signup('history_page_other');
 const post=(await f.request('/api/plaza/posts','POST',{topic:'cultura',title:'Tema',body:'Hola'},b.cookie)).body.post;
 const id=(await f.request('/api/plaza/invitations','POST',{kind:'post',contentId:post.id,note:''},a.cookie)).body.invitation.id;
 await f.request(`/api/plaza/invitations/${id}/decision`,'POST',{action:'accept'},b.cookie);
 const db=new DatabaseSync(f.path); const add=db.prepare('INSERT INTO plaza_private_messages(id,connection_id,sender_id,client_id,body,created_at) VALUES(?,?,?,?,?,?)');
 for(let n=0;n<125;n++) add.run(`30000000-0000-4000-8000-${String(n).padStart(12,'0')}`,id,a.id,`msg-${n}`,`Mensaje ${n}`,1000); db.close();
 const path=`/api/plaza/connections/${id}/messages`;
 const first=await f.request(`${path}?page=1`,'GET',undefined,a.cookie); assert.equal(first.status,200); assert.equal(first.body.messages.length,50); assert.equal(first.body.messages.at(-1).body,'Mensaje 124');
 const second=await f.request(`${path}?cursor=${first.body.nextCursor}`,'GET',undefined,b.cookie); const third=await f.request(`${path}?cursor=${second.body.nextCursor}`,'GET',undefined,a.cookie);
 assert.equal(second.body.messages.length,50); assert.equal(third.body.messages.length,25); assert.equal(third.body.messages[0].body,'Mensaje 0'); assert.equal(third.body.nextCursor,null);
 assert.equal(new Set([...first.body.messages,...second.body.messages,...third.body.messages].map(x=>x.id)).size,125);
 assert.equal((await f.request(`${path}?page=1`,'GET',undefined,outsider.cookie)).status,404);
 assert.equal((await f.request(`${path}?cursor=abc`,'GET',undefined,a.cookie)).status,422);
 await f.request(`/api/plaza/connections/${id}/block`,'POST',{},b.cookie);
 assert.equal((await f.request(`${path}?cursor=${first.body.nextCursor}`,'GET',undefined,a.cookie)).status,404);
});

test('lista paginada muestra conexiones antiguas y excluye ajenas y retiradas', async t => {
 const f=await fixture(t,{plazaEnabled:true}); const a=await f.signup('list_pages_a'), b=await f.signup('list_pages_b'), c=await f.signup('list_pages_c');
 const db=new DatabaseSync(f.path); const add=db.prepare('INSERT INTO plaza_connections VALUES(?,?,?,?,?,?,?,?,?,?,?)');
 const [low,high]=[a.id,b.id].sort();
 for(let n=0;n<125;n++) add.run(`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`,a.id,b.id,low,high,'','post','test','closed',1000,1000+Math.floor(n/2));
 db.prepare('INSERT INTO connection_dismissals(user_id,connection_id,created_at) VALUES(?,?,?)').run(a.id,'40000000-0000-4000-8000-000000000124',1); db.close();
 const first=await f.request('/api/plaza/connections?page=1','GET',undefined,a.cookie); assert.equal(first.status,200); assert.equal(first.body.connections.length,50); assert.ok(first.body.nextCursor);
 const second=await f.request(`/api/plaza/connections?cursor=${first.body.nextCursor}`,'GET',undefined,a.cookie);
 const third=await f.request(`/api/plaza/connections?cursor=${second.body.nextCursor}`,'GET',undefined,a.cookie);
 assert.equal(second.body.connections.length,50); assert.equal(third.body.connections.length,24); assert.equal(third.body.nextCursor,null);
 assert.equal(new Set([...first.body.connections,...second.body.connections,...third.body.connections].map(x=>x.id)).size,124);
 assert.equal((await f.request('/api/plaza/connections?cursor=malformado','GET',undefined,a.cookie)).status,422);
 assert.equal((await f.request(`/api/plaza/connections?cursor=${first.body.nextCursor}`,'GET',undefined,c.cookie)).body.connections.length,0);
});
