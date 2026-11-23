import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './feature-fixture.mjs';
import { DatabaseSync } from 'node:sqlite';

test('marcar todos como leídos alcanza avisos antiguos sin afectar otras cuentas', async t => {
 const f=await fixture(t,{plazaEnabled:true});const a=await f.signup('all_notices_a'),b=await f.signup('all_notices_b');
 const post=(await f.request('/api/plaza/posts','POST',{topic:'cultura',title:'Avisos',body:'Hola'},a.cookie)).body.post;
 const db=new DatabaseSync(f.path);const reply=db.prepare('INSERT INTO plaza_replies(id,post_id,author_id,body,created_at) VALUES(?,?,?,?,?)');
 const notice=db.prepare("INSERT INTO notifications(id,recipient_id,actor_id,kind,target_id,event_id,created_at) VALUES(?,?,?,'reply',?,?,?)");
 for(let n=0;n<105;n++){const id=`70000000-0000-4000-8000-${String(n).padStart(12,'0')}`;reply.run(id,post.id,b.id,'Hola',n+1);notice.run(`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`,a.id,b.id,post.id,id,n+1);}
 db.close();
 const before=(await f.request('/api/plaza/notifications','GET',undefined,a.cookie)).body; assert.equal(before.unread,105);assert.equal(before.items.length,100);
 assert.equal((await f.request('/api/plaza/notifications/read-all','POST',{},b.cookie)).status,200);
 assert.equal((await f.request('/api/plaza/notifications','GET',undefined,a.cookie)).body.unread,105);
 assert.equal((await f.request('/api/plaza/notifications/read-all','POST',{extra:'x'},a.cookie)).status,422);
 assert.equal((await f.request('/api/plaza/notifications/read-all','POST',{},a.cookie)).status,200);
 const after=(await f.request('/api/plaza/notifications','GET',undefined,a.cookie)).body;assert.equal(after.unread,0);assert.ok(after.items.every(x=>x.readAt!==null));
});

test('respuestas generan avisos por cuenta, permiten silenciar y marcar leídos', async t => {
  const f = await fixture(t, { plazaEnabled: true });
  const ana = await f.signup('avisos_ana'); const bea = await f.signup('avisos_bea');
  const post = await f.request('/api/plaza/posts', 'POST', { topic: 'cultura', title: 'Una conversación', body: 'Hola' }, ana.cookie);
  const id = post.body.post.id;
  const response = await f.request(`/api/plaza/posts/${id}/replies`, 'POST', { body: 'Respuesta de prueba' }, bea.cookie);
  assert.equal(response.status, 201);
  let inbox = await f.request('/api/plaza/notifications', 'GET', undefined, ana.cookie);
  assert.equal(inbox.status, 200); assert.equal(inbox.body.unread, 1);
  assert.equal(inbox.body.items[0].kind, 'reply'); assert.equal(inbox.body.items[0].targetId, id);
  assert.equal((await f.request('/api/plaza/notifications', 'GET', undefined, bea.cookie)).body.unread, 0);
  assert.equal((await f.request('/api/plaza/notifications/read', 'POST', { id: inbox.body.items[0].id }, bea.cookie)).status, 404);
  assert.equal((await f.request('/api/plaza/notifications/read', 'POST', { id: inbox.body.items[0].id }, ana.cookie)).status, 200);
  assert.equal((await f.request('/api/plaza/notifications/mute', 'POST', { kind: 'post', targetId: id, muted: true }, ana.cookie)).status, 200);
  await f.request(`/api/plaza/posts/${id}/replies`, 'POST', { body: 'Respuesta silenciada' }, bea.cookie);
  inbox = await f.request('/api/plaza/notifications', 'GET', undefined, ana.cookie);
  assert.equal(inbox.body.unread, 0); assert.equal(inbox.body.items.length, 1);
});

test('mensajes privados generan avisos aislados y el silencio se puede revertir', async t => {
  const f = await fixture(t, { plazaEnabled: true });
  const ana = await f.signup('mensaje_ana'); const bea = await f.signup('mensaje_bea');
  const post = await f.request('/api/plaza/posts', 'POST', { topic: 'cultura', title: 'Conversemos', body: 'Hola' }, ana.cookie);
  const invite = await f.request('/api/plaza/invitations', 'POST', { kind: 'post', contentId: post.body.post.id, note: 'Hola' }, bea.cookie);
  const id = invite.body.invitation.id;
  assert.equal((await f.request(`/api/plaza/invitations/${id}/decision`, 'POST', { action: 'accept' }, ana.cookie)).status, 200);
  assert.equal((await f.request(`/api/plaza/connections/${id}/messages`, 'POST', { clientId: 'mensaje-0001', body: 'Hola Ana' }, bea.cookie)).status, 201);
  let inbox = await f.request('/api/plaza/notifications', 'GET', undefined, ana.cookie);
  assert.equal(inbox.body.unread, 1); assert.equal(inbox.body.items[0].kind, 'message'); assert.equal(inbox.body.items[0].targetId, id);
  await f.request('/api/plaza/notifications/read', 'POST', { id: inbox.body.items[0].id }, ana.cookie);
  await f.request('/api/plaza/notifications/mute', 'POST', { kind: 'connection', targetId: id, muted: true }, ana.cookie);
  await f.request(`/api/plaza/connections/${id}/messages`, 'POST', { clientId: 'mensaje-0002', body: 'Silenciado' }, bea.cookie);
  inbox = await f.request('/api/plaza/notifications', 'GET', undefined, ana.cookie);
  assert.equal(inbox.body.unread, 0); assert.equal(inbox.body.mutes[0].targetId, id);
  await f.request('/api/plaza/notifications/mute', 'POST', { kind: 'connection', targetId: id, muted: false }, ana.cookie);
  await f.request(`/api/plaza/connections/${id}/messages`, 'POST', { clientId: 'mensaje-0003', body: 'Reactivado' }, bea.cookie);
  inbox = await f.request('/api/plaza/notifications', 'GET', undefined, ana.cookie);
  assert.equal(inbox.body.unread, 1);
});

test('solicitudes y aceptaciones generan avisos privados y respetan su estado', async t => {
  const f = await fixture(t, { plazaEnabled: true });
  const ana = await f.signup('solicitud_ana'), bea = await f.signup('solicitud_bea'), otra = await f.signup('solicitud_otra');
  const post = await f.request('/api/plaza/posts', 'POST', { topic:'cultura', title:'Avisos de solicitud', body:'Hola' }, ana.cookie);
  const body = { kind:'post', contentId:post.body.post.id, note:'Hola' };
  const invite = await f.request('/api/plaza/invitations','POST',body,bea.cookie); const id=invite.body.invitation.id;
  await f.request('/api/plaza/invitations','POST',body,bea.cookie);
  let inbox = (await f.request('/api/plaza/notifications','GET',undefined,ana.cookie)).body;
  assert.equal(inbox.unread,1); assert.equal(inbox.items[0].kind,'invitation'); assert.equal(inbox.items[0].targetId,id);
  assert.equal((await f.request('/api/plaza/notifications','GET',undefined,otra.cookie)).body.unread,0);
  assert.equal((await f.request(`/api/plaza/connections/${id}`,'GET',undefined,ana.cookie)).body.connection.id,id);
  assert.equal((await f.request(`/api/plaza/connections/${id}`,'GET',undefined,otra.cookie)).status,404);
  assert.equal((await f.request(`/api/plaza/invitations/${id}/decision`,'POST',{action:'accept'},ana.cookie)).status,200);
  inbox = (await f.request('/api/plaza/notifications','GET',undefined,ana.cookie)).body; assert.equal(inbox.unread,0);
  inbox = (await f.request('/api/plaza/notifications','GET',undefined,bea.cookie)).body;
  assert.equal(inbox.unread,1); assert.equal(inbox.items[0].kind,'acceptance'); assert.equal(inbox.items[0].targetId,id);
  assert.equal((await f.request('/api/plaza/notifications/read','POST',{id:inbox.items[0].id},ana.cookie)).status,404);
  await f.request('/api/plaza/notifications/read','POST',{id:inbox.items[0].id},bea.cookie);
  assert.equal((await f.request('/api/plaza/notifications','GET',undefined,bea.cookie)).body.unread,0);
  await f.request(`/api/plaza/invitations/${id}/decision`,'POST',{action:'withdraw'},bea.cookie);
  assert.equal((await f.request('/api/plaza/notifications','GET',undefined,bea.cookie)).body.items.length,0);
});

test('avisos de solicitudes desaparecen si se retiran, rechazan o bloquean', async t => {
  const f=await fixture(t,{plazaEnabled:true}); const ana=await f.signup('retirada_ana'), bea=await f.signup('retirada_bea');
  const post=await f.request('/api/plaza/posts','POST',{topic:'cultura',title:'Contacto',body:'Hola'},ana.cookie);
  const body={kind:'post',contentId:post.body.post.id,note:''};
  let id=(await f.request('/api/plaza/invitations','POST',body,bea.cookie)).body.invitation.id;
  await f.request(`/api/plaza/invitations/${id}/decision`,'POST',{action:'withdraw'},bea.cookie);
  assert.equal((await f.request('/api/plaza/notifications','GET',undefined,ana.cookie)).body.unread,0);
  id=(await f.request('/api/plaza/invitations','POST',body,bea.cookie)).body.invitation.id;
  await f.request(`/api/plaza/invitations/${id}/decision`,'POST',{action:'decline'},ana.cookie);
  assert.equal((await f.request('/api/plaza/notifications','GET',undefined,ana.cookie)).body.unread,0);
  id=(await f.request('/api/plaza/invitations','POST',body,bea.cookie)).body.invitation.id;
  assert.equal((await f.request('/api/plaza/notifications','GET',undefined,ana.cookie)).body.unread,1);
  assert.equal((await f.request('/api/plaza/blocks','POST',{kind:'post',contentId:post.body.post.id},bea.cookie)).status,200);
  assert.equal((await f.request('/api/plaza/notifications','GET',undefined,ana.cookie)).body.unread,0);
  assert.equal((await f.request(`/api/plaza/connections/${id}`,'GET',undefined,ana.cookie)).status,404);
});
