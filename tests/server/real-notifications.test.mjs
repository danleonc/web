import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './feature-fixture.mjs';

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
