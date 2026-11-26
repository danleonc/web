import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { createRoomServer } from '../../server/app.ts';
import { backupDatabase } from '../../scripts/backup-db.mjs';
import { encryptedBackup, restoreEncryptedBackup } from '../../scripts/encrypted-backup.mjs';
import { fixture } from './feature-fixture.mjs';

for (const encrypted of [false,true]) test(`una copia sintética ${encrypted?'cifrada':'sin cifrar'} recupera Plaza, conexión y reserva conservando aislamiento`, async t => {
  const f=await fixture(t,{plazaEnabled:true,meetingsEnabled:true});
  const [mod,a,b,other]=await Promise.all(['restore_mod','restore_a','restore_b','restore_other'].map(name=>f.signup(name)));
  const db=new DatabaseSync(f.path);db.prepare('INSERT INTO moderators(user_id) VALUES(?)').run(mod.id);db.close();
  const createdPost=await f.request('/api/plaza/posts','POST',{topic:'crear',title:'Plan compartido',body:'Una idea'},b.cookie);
  assert.equal(createdPost.status,201);const post=createdPost.body.post;
  const invitation=await f.request('/api/plaza/invitations','POST',{kind:'post',contentId:post.id,note:'Sigamos conversando'},a.cookie);
  assert.equal(invitation.status,201);const connection=invitation.body.invitation.id;
  assert.equal((await f.request(`/api/plaza/invitations/${connection}/decision`,'POST',{action:'accept'},b.cookie)).status,200);
  assert.equal((await f.request(`/api/plaza/connections/${connection}/messages`,'POST',{clientId:'restore-test-0001',body:'Mensaje privado sintético'},a.cookie)).status,201);
  const createdMeeting=await f.request('/api/meetings','POST',{themeId:'cafe',startsAt:f.startsAt+7200_000,capacity:4},mod.cookie);
  assert.equal(createdMeeting.status,201);const meeting=createdMeeting.body.meeting.id;
  assert.equal((await f.request(`/api/reservations/${meeting}`,'POST',undefined,a.cookie)).status,200);
  assert.equal((await f.request(`/api/reservations/${meeting}/reminder`,'POST',{minutes:60},a.cookie)).status,200);

  const copy=join(f.directory,'restored-synthetic.sqlite');
  if(encrypted) {
    const archive=join(f.directory,'synthetic.enc'),wrong=join(f.directory,'wrong-key.sqlite');
    const key=randomBytes(32),wrongKey=randomBytes(32);
    try {
      await encryptedBackup(f.path,archive,key);
      assert.equal((await readFile(archive)).includes(Buffer.from('Mensaje privado sintético')),false);
      await assert.rejects(restoreEncryptedBackup(archive,wrong,wrongKey));
      await assert.rejects(access(wrong),error=>error.code==='ENOENT');
      await restoreEncryptedBackup(archive,copy,key);
    } finally {key.fill(0);wrongKey.fill(0);}
  } else await backupDatabase(f.path,copy);
  const restored=createRoomServer({databasePath:copy,plazaEnabled:true,meetingsEnabled:true,allowedOrigins:['http://localhost:4173'],now:()=>f.startsAt-600000});
  restored.server.listen(0,'127.0.0.1');await once(restored.server,'listening');
  try {
    const base=`http://127.0.0.1:${restored.server.address().port}`;
    async function get(path,cookie){const r=await fetch(base+path,{headers:{Origin:'http://localhost:4173',Cookie:cookie}});return {status:r.status,body:await r.json()};}
    const posts=await get('/api/plaza/posts',a.cookie);assert.equal(posts.status,200);assert.ok(posts.body.posts.some(p=>p.id===post.id));
    const messages=await get(`/api/plaza/connections/${connection}/messages`,b.cookie);assert.equal(messages.status,200);assert.equal(messages.body.messages[0].body,'Mensaje privado sintético');
    assert.equal((await get(`/api/plaza/connections/${connection}/messages`,other.cookie)).status,404);
    const activities=await get('/api/activities',a.cookie);const item=activities.body.activities.find(x=>x.id===meeting);assert.equal(item.mine,true);assert.equal(item.reminderMinutes,60);
    const foreign=await get('/api/activities',other.cookie);assert.equal(foreign.body.activities.find(x=>x.id===meeting).mine,false);
    const changed=await fetch(base+`/api/reservations/${meeting}`,{method:'DELETE',headers:{Origin:'http://localhost:4173',Cookie:a.cookie}});assert.equal(changed.status,200);
    assert.equal((await get('/api/activities',a.cookie)).body.activities.find(x=>x.id===meeting).mine,false);
    assert.equal((await f.request('/api/activities','GET',undefined,a.cookie)).body.activities.find(x=>x.id===meeting).mine,true);
  } finally {await restored.close();}
});
