import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createRoomServer } from '../../server/app.ts';

test('la puerta de pruebas protege HTTP y WebSocket pero permite el chequeo de salud', async t => {
  const password = '0123456789abcdef0123456789abcdef0123456789abcdef';
  const app = createRoomServer({ stagingPassword: password });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  assert.equal((await fetch(base + '/api/health')).status, 200);
  assert.equal((await fetch(base + '/api/health', {method:'POST'})).status, 401);
  assert.equal((await fetch(base + '/')).status, 401);
  const denied = await fetch(base + '/api/session');
  assert.equal(denied.status, 401); assert.match(denied.headers.get('www-authenticate'), /^Basic /);
  assert.equal((await fetch(base + '/api/session', { headers: { Authorization: 'Basic ' + Buffer.from('nexafia:incorrecta').toString('base64') } })).status, 401);
  assert.equal((await fetch(base + '/', { headers: { Authorization: 'Basic ' + Buffer.from('nexafia:' + password).toString('base64') } })).status, 404);
  assert.equal((await fetch(base + '/api/session', { headers: { Authorization: 'Basic ' + Buffer.from('nexafia:' + password).toString('base64') } })).status, 401); // cuenta propia aún requerida
  const websocketStatus = (authorization) => new Promise(resolve => {
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/api/rooms/cafe', { headers: { Origin:'http://localhost:4173', ...(authorization ? { Authorization:authorization } : {}) } });
    ws.on('error', () => {}); ws.on('unexpected-response', (_req, res) => { res.resume(); resolve({status:res.statusCode, challenge:res.headers['www-authenticate']}); });
  });
  const noGate = await websocketStatus(); assert.equal(noGate.status,401); assert.match(noGate.challenge,/^Basic /);
  const passedGate = await websocketStatus('Basic ' + Buffer.from('nexafia:' + password).toString('base64'));
  assert.equal(passedGate.status,401); assert.equal(passedGate.challenge,undefined); // falta sesión de aplicación
});

test('una contraseña débil o vacía no desactiva silenciosamente la protección', () => {
  assert.throws(() => createRoomServer({ stagingPassword: '' }), /Invalid staging password/);
  assert.throws(() => createRoomServer({ stagingPassword: 'corta' }), /Invalid staging password/);
});
