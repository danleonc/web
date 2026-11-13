import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './feature-fixture.mjs';

test('una respuesta de Plaza comparte un sticker válido y persiste tras reiniciar', async t => {
  const f = await fixture(t, { plazaEnabled: true });
  const ana = await f.signup('sticker_ana'); const bea = await f.signup('sticker_bea');
  const post = await f.request('/api/plaza/posts', 'POST', {topic:'cultura',title:'Conversar',body:'Hola'}, ana.cookie);
  const id = post.body.post.id;
  const sent = await f.request(`/api/plaza/posts/${id}/replies`, 'POST', {body:'',stickerId:'moka-1'}, bea.cookie);
  assert.equal(sent.status, 201);
  await f.restart();
  const replies = await f.request(`/api/plaza/posts/${id}/replies`, 'GET', undefined, ana.cookie);
  assert.equal(replies.body.replies[0].stickerId, 'moka-1');
  assert.equal((await f.request(`/api/plaza/posts/${id}/replies`, 'POST', {body:'',stickerId:'desconocido-1'}, bea.cookie)).status, 422);
});

test('un sticker privado solo llega a la conexión aceptada y no duplica reintentos', async t => {
  const f = await fixture(t, { plazaEnabled: true });
  const a = await f.signup('stick_msg_a'), b = await f.signup('stick_msg_b'), c = await f.signup('stick_msg_c');
  const post = await f.request('/api/plaza/posts','POST',{topic:'cultura',title:'Hola',body:'Hola'},a.cookie);
  const invite = await f.request('/api/plaza/invitations','POST',{kind:'post',contentId:post.body.post.id,note:''},b.cookie);
  const id = invite.body.invitation.id;
  await f.request(`/api/plaza/invitations/${id}/decision`,'POST',{action:'accept'},a.cookie);
  const data = {clientId:'sticker-00001',body:'',stickerId:'moka-2'};
  assert.equal((await f.request(`/api/plaza/connections/${id}/messages`,'POST',data,b.cookie)).status,201);
  assert.equal((await f.request(`/api/plaza/connections/${id}/messages`,'POST',data,b.cookie)).status,201);
  const messages = await f.request(`/api/plaza/connections/${id}/messages`,'GET',undefined,a.cookie);
  assert.equal(messages.body.messages.length,1); assert.equal(messages.body.messages[0].stickerId,'moka-2');
  assert.equal((await f.request(`/api/plaza/connections/${id}/messages`,'GET',undefined,c.cookie)).status,404);
  assert.equal((await f.request(`/api/plaza/connections/${id}/messages`,'POST',{...data,clientId:'sticker-00002',stickerId:'fake-1'},b.cookie)).status,422);
});

test('una publicación admite sticker junto con su contenido', async t => {
  const f = await fixture(t,{plazaEnabled:true}); const a=await f.signup('stick_post_a'); const b=await f.signup('stick_post_b');
  const result=await f.request('/api/plaza/posts','POST',{topic:'crear',title:'Mira',body:'',stickerId:'moka-3'},a.cookie);
  assert.equal(result.status,201);
  const posts=await f.request('/api/plaza/posts','GET',undefined,b.cookie);
  assert.equal(posts.body.posts[0].stickerId,'moka-3');
});

test('un reporte conserva el identificador del sticker aunque se retire la respuesta', async t => {
 const f=await fixture(t,{plazaEnabled:true}); const a=await f.signup('stick_rep_a'), b=await f.signup('stick_rep_b');
 const p=await f.request('/api/plaza/posts','POST',{topic:'cultura',title:'Hola',body:'Hola'},a.cookie);
 const x=await f.request(`/api/plaza/posts/${p.body.post.id}/replies`,'POST',{body:'',stickerId:'moka-1'},b.cookie);
 const report=await f.request('/api/plaza/reports','POST',{kind:'reply',contentId:x.body.reply.id,reason:'spam',note:''},a.cookie);
 assert.equal(report.status,201);
 const { DatabaseSync } = await import('node:sqlite'); const db=new DatabaseSync(f.path,{readOnly:true});
 const evidence=JSON.parse(db.prepare('SELECT evidence_json FROM plaza_reports WHERE id=?').get(report.body.id).evidence_json); db.close();
 assert.equal(evidence.stickerId,'moka-1');
});
