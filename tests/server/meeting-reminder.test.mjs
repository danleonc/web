import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fixture } from './feature-fixture.mjs';

test('recordatorios de encuentros programados son optativos y privados', async t => {
  const f=await fixture(t,{meetingsEnabled:true,plazaEnabled:true});
  const [mod,a,b]=await Promise.all(['aviso_mod','aviso_a','aviso_b'].map(n=>f.signup(n)));
  const db=new DatabaseSync(f.path);db.prepare('INSERT INTO moderators(user_id) VALUES(?)').run(mod.id);db.close();
  const created=await f.request('/api/meetings','POST',{themeId:'cafe',startsAt:f.startsAt+7200_000,capacity:4},mod.cookie);
  assert.equal(created.status,201);const id=created.body.meeting.id;const path=`/api/reservations/${id}/reminder`;
  assert.equal((await f.request(path,'POST',{minutes:60},a.cookie)).status,404);
  assert.equal((await f.request(`/api/reservations/${id}`,'POST',undefined,a.cookie)).status,200);
  assert.equal((await f.request(path,'POST',{minutes:60},a.cookie,'http://hostile.test')).status,403);
  assert.equal((await f.request(path,'POST',{minutes:5},a.cookie)).status,422);
  assert.equal((await f.request(path,'POST',{minutes:60},a.cookie)).status,200);
  assert.equal((await f.request('/api/activities','GET',undefined,a.cookie)).body.activities.find(x=>x.id===id).reminderMinutes,60);
  assert.equal((await f.request('/api/plaza/notifications','GET',undefined,a.cookie)).body.items.some(n=>n.kind==='meeting_reminder'),false);
  f.advance(4310_000);
  const notice=(await f.request('/api/plaza/notifications','GET',undefined,a.cookie)).body.items.find(n=>n.kind==='meeting_reminder');assert.ok(notice);assert.equal(notice.readAt,null);
  assert.equal((await f.request('/api/plaza/notifications','GET',undefined,b.cookie)).body.items.some(n=>n.kind==='meeting_reminder'),false);
  assert.equal((await f.request(`/api/reservations/${id}`,'DELETE',undefined,a.cookie)).status,200);
  assert.equal((await f.request('/api/plaza/notifications','GET',undefined,a.cookie)).body.items.some(n=>n.kind==='meeting_reminder'),false);
  assert.equal((await f.request(`/api/reservations/${id}`,'POST',undefined,a.cookie)).status,200);
  assert.equal((await f.request('/api/activities','GET',undefined,a.cookie)).body.activities.find(x=>x.id===id).reminderMinutes,0);
  assert.equal((await f.request('/api/plaza/notifications','GET',undefined,a.cookie)).body.items.some(n=>n.kind==='meeting_reminder'),false);
});
