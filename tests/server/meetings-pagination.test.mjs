import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fixture } from './feature-fixture.mjs';

test('la agenda permite recorrer más de 200 encuentros sin ocultar las convocatorias siguientes', async t => {
  const f = await fixture(t, { meetingsEnabled: true });
  const person = await f.signup('agenda_paginada');
  const db = new DatabaseSync(f.path);
  try {
    const offering = db.prepare('INSERT INTO offerings(activity_id,starts_at) VALUES(?,?)');
    const meeting = db.prepare('INSERT INTO scheduled_meetings(id,theme_id,capacity,duration,created_at,created_by) VALUES(?,?,?,?,?,?)');
    for (let i=0;i<205;i++) { const id=`page-${String(i).padStart(3,'0')}`; offering.run(id,f.startsAt+i*60000); meeting.run(id,'cafe',4,40,f.startsAt-600000,person.id); }
  } finally { db.close(); }
  const first = await f.request('/api/activities','GET',undefined,person.cookie);
  assert.equal(first.body.activities.length,200); assert.equal(first.body.nextOffset,200);
  const second = await f.request('/api/activities?offset=200','GET',undefined,person.cookie);
  assert.equal(second.body.activities.length,5); assert.equal(second.body.nextOffset,null);
  assert.equal(new Set([...first.body.activities,...second.body.activities].map(x=>x.id)).size,205);
  assert.equal((await f.request('/api/activities?offset=-1','GET',undefined,person.cookie)).status,400);
});
