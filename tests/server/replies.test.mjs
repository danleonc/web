import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { fixture } from './feature-fixture.mjs';
async function group(t, count = 3) {
  const f = await fixture(t, { enforceSchedule: false }), users = [], clients = [];
  for (let i = 0; i < count; i++) {
    const u = await f.signup(); users.push(u);
    await f.request('/api/reservations/cafe', 'POST', undefined, u.cookie);
    clients.push(await f.socket(u));
  }
  clients[0].send({ type: 'start' });
  await clients[2].wait(c => c.snapshot.session.phase === 'question');
  return { f, users, clients, room: clients[0].snapshot.roomKey };
}
function command(content, clientId = randomUUID()) { return { type: 'message', clientId, content }; }

test('las respuestas guardan solo la referencia, validan metadatos y sobreviven al reinicio sin revelar bloqueados', async t => {
  const { f, users, clients: [a,b,c], room } = await group(t, 4);
  a.send(command({ type:'text', text:'Historia original que solo debe resolverse si es visible' }));
  await b.wait(x => x.snapshot.messages.length === 1);
  const original = b.snapshot.messages[0];
  b.send(command({ type:'sticker', stickerId:'moka-1', replyTo:original.id }));
  await c.wait(x => x.snapshot.messages.length === 2);
  const reply = c.snapshot.messages[1];
  assert.equal(reply.replyTo, original.id);
  assert.equal(reply.senderId, users[1].id);
  assert.deepEqual(Object.keys(reply).sort(), ['id','clientId','senderId','name','type','stickerId','replyTo'].sort());
  for (const replyTo of [null, {}, '', randomUUID(), 'x'.repeat(81)])
    b.send(command({ type:'text', text:'Referencia inválida', replyTo }));
  b.send(command({ type:'text', text:'Metadatos falsos', replyTo:original.id, quote:{name:'Suplantación', text:'Inventado'} }));
  await b.wait(x => x.events.filter(e=>e.type==='error').length===6);
  assert.equal(b.snapshot.messages.length,2);
  const closed = once(a.ws, 'close');
  a.send({type:'block',participantId:users[1].id});
  await closed;
  await f.restart();
  const h = await f.request(`/api/history/${room}`, 'GET', undefined, users[1].cookie);
  assert.equal(h.status,200); assert.equal(h.body.messages[0].replyTo,original.id);
  const hidden = await f.request(`/api/history/${room}`, 'GET', undefined, users[1].cookie);
  assert.equal(hidden.body.messages.length,1);
  assert.equal(hidden.body.messages[0].replyTo,original.id);
  assert.ok(!JSON.stringify(hidden.body).includes(original.text));
  const again=[];
  for(const user of users.slice(1)) again.push(await f.socket(user));
  await again.at(-1).wait(x=>x.snapshot.session.phase==='conversation');
  assert.ok(!again[0].snapshot.messages.some(m=>m.id===original.id));
  again[0].send(command({type:'text',text:'No debe revivir la cita tras reiniciar',replyTo:original.id}));
  await again[0].wait(x=>x.events.some(e=>e.code==='invalid_reply'));
});

test('un original fuera de los últimos 50 no admite nuevas respuestas; reintentar una ya enviada sigue siendo idempotente', async t => {
  const { clients:[a,b,c] } = await group(t);
  a.send(command({type:'text',text:'Original temporal'}));
  await b.wait(x=>x.snapshot.messages.length===1);
  const id=b.snapshot.messages[0].id, sent=command({type:'text',text:'Respuesta confirmada',replyTo:id});
  b.send(sent); await c.wait(x=>x.snapshot.messages.length===2);
  for(let n=0;n<51;n++) a.send(command({type:'text',text:`Mensaje ${n}`}));
  await c.wait(x=>x.snapshot.messages.at(-1)?.text==='Mensaje 50');
  assert.equal(c.snapshot.messages.length,50);
  assert.ok(!c.snapshot.messages.some(m=>m.id===id));
  b.send(sent); await b.wait(x=>x.events.filter(e=>e.type==='ack'&&e.clientId===sent.clientId).length===2);
  b.send(command({type:'text',text:'No se puede citar de nuevo',replyTo:id}));
  await b.wait(x=>x.events.some(e=>e.code==='invalid_reply'));
  assert.equal(b.snapshot.messages.length,50);
});
