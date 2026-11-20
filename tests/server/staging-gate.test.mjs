import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createRoomServer } from '../../server/app.ts';

test('detecta intentos reiterados con credenciales sin registrar sus datos ni bloquear el acceso', async t => {
  let clock = 1_000_000; const events=[]; const password='a'.repeat(32);
  const app=createRoomServer({stagingPassword:password,now:()=>clock,securityLog:event=>events.push(event)});
  app.server.listen(0,'127.0.0.1'); await once(app.server,'listening'); t.after(()=>app.close());
  const base=`http://127.0.0.1:${app.server.address().port}`;
  const bad={Authorization:'Basic '+Buffer.from('person:bad-password').toString('base64')};
  for(let i=0;i<12;i++) assert.equal((await fetch(base)).status,401);
  assert.equal(events.length,0);
  for(let i=0;i<12;i++) assert.equal((await fetch(base,{headers:bad})).status,401);
  assert.deepEqual(events,[{event:'staging_gate_suspicious',action:'authentication',status:401}]);
  assert.equal((await fetch(base,{headers:{Authorization:'Basic '+Buffer.from('nexafia:'+password).toString('base64')}})).status,404);
  clock+=60_000;
  for(let i=0;i<10;i++) await fetch(base,{headers:bad});
  assert.equal(events.length,2);
  assert.doesNotMatch(JSON.stringify(events),/person|bad-password|127\.0\.0\.1/);
});

test('la detección incluye WebSocket y un fallo al registrar no bloquea la puerta', async t => {
  let called=0; const app=createRoomServer({stagingPassword:'a'.repeat(32),securityLog:()=>{called++;throw Error('log failure')}});
  app.server.listen(0,'127.0.0.1'); await once(app.server,'listening'); t.after(()=>app.close());
  const base=`http://127.0.0.1:${app.server.address().port}`;
  const authorization='Basic '+Buffer.from('person:bad-password').toString('base64');
  for(let i=0;i<9;i++) assert.equal((await fetch(base,{headers:{authorization}})).status,401);
  const status=await new Promise(resolve=>{const ws=new WebSocket(base.replace('http:','ws:')+'/api/rooms/cafe',{headers:{authorization}});ws.on('error',()=>{});ws.on('unexpected-response',(_req,res)=>{res.resume();resolve(res.statusCode)});});
  assert.equal(status,401); assert.equal(called,1);
  assert.equal((await fetch(base,{headers:{authorization}})).status,401);
});

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
  const noAccount = await fetch(base + '/api/session', { headers: { Authorization: 'Basic ' + Buffer.from('nexafia:' + password).toString('base64') } });
  assert.equal(noAccount.status, 403); // No repetir el desafío Basic del navegador.
  assert.deepEqual(await noAccount.json(), { error: 'session_required' });
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

test('el diagnóstico no expone la contraseña configurada', () => {
  const secret = 'a'.repeat(31);
  assert.throws(() => createRoomServer({ stagingPassword: secret }), error => /length=31/.test(error.message) && !error.message.includes(secret));
});

test('admite el formato de 32 caracteres generado por el panel de Render', async t => {
  const password = '0123456789abcdef0123456789abcdef';
  const app = createRoomServer({stagingPassword:password}); app.server.listen(0,'127.0.0.1'); await once(app.server,'listening'); t.after(() => app.close());
  const response = await fetch(`http://127.0.0.1:${app.server.address().port}/api/health`);
  assert.equal(response.status,200);
});
