import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,mkdir,readdir,rm,writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Storage} from '../../server/storage.ts';

test('el piloto protegido migra una copia v26 y habilita reencuentros solo con la opcion explicita',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nexafia-staging-rehearsal-')),path=join(dir,'data.sqlite');
 const gate='0123456789abcdef0123456789abcdef'; const people=Array.from({length:4},()=>({id:randomUUID(),token:randomBytes(32).toString('hex')}));
 const room=randomUUID(),created=Date.now(); let child;
 try {
  const old=new Storage(path);
  try {
   for(const [i,p] of people.entries()) {old.createAccount({id:p.id,username:`pilot${i}`,alias:`Piloto ${i}`,passwordHash:'synthetic',recoveryHash:'synthetic'},created);old.db.prepare('INSERT INTO account_emails(user_id,email,verified_at,adult_declared_at) VALUES(?,?,?,?)').run(p.id,`pilot${i}@example.test`,created,created);old.createSession(p.token,p.id,created+86400000);}
   old.offering('cafe',created-100000);old.db.prepare('INSERT INTO rooms(id,activity_id,session_json,revision,idle_at,archived_at,safety_json) VALUES(?,?,?,?,?,?,?)').run(room,'cafe',JSON.stringify({phase:'closed',sessionUntil:created-1000}),1,created,created,'{}');
   for(const p of people.slice(0,3))old.db.prepare('INSERT INTO memberships VALUES(?,?)').run(room,p.id);
   old.db.exec('DROP TABLE group_reunion_expirations; DROP TABLE private_meeting_members; DROP TABLE private_meetings; DROP TABLE group_reunion_members; DROP TABLE group_reunions; PRAGMA user_version=26');
  } finally {old.close();}
  await mkdir(join(dir,'dist-pilot'));await writeFile(join(dir,'dist-pilot','entre-build.json'),JSON.stringify({mode:'accounts',realPlaza:true}));
  const probe=createServer();await new Promise(ok=>probe.listen(0,'127.0.0.1',ok));const port=probe.address().port;await new Promise(ok=>probe.close(ok));
  const base=`http://127.0.0.1:${port}`, authorization='Basic '+Buffer.from(`nexafia:${gate}`).toString('base64');
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>! /^(ENTRE_|SMTP_|GOOGLE_|WEB_PUSH_|VAPID_)/i.test(key)));
  async function start(enabled) {
   child=spawn(process.execPath,[resolve('server/pilot.ts')],{cwd:dir,env:{...env,ENTRE_PUBLIC_ORIGIN:base,ENTRE_DATABASE_PATH:path,ENTRE_STAGING_SHARED:'1',ENTRE_STAGING_PASSWORD:gate,ENTRE_STAGING_GROUP_REUNIONS:enabled?'1':'0',PORT:String(port)}});
   let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
   const until=Date.now()+10000;while(Date.now()<until){if(child.exitCode!==null)throw Error(`pilot exited: ${output}`);try{if((await fetch(`${base}/api/health`)).ok)return;}catch{} await new Promise(ok=>setTimeout(ok,100));}throw Error(`pilot did not start: ${output}`);
  }
  async function stop(){const running=child;child=undefined;if(running.exitCode===null){const ended=once(running,'exit');running.kill();await ended;}}
  const call=(url,person,body)=>fetch(base+url,{method:body?'POST':'GET',headers:{Authorization:authorization,Cookie:`entre_session=${person.token}`,Origin:base,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  await start(false);
  assert.equal((await fetch(base+'/api/group-reunions')).status,401);
  assert.equal((await call('/api/group-reunions',people[0])).status,404);
  const backups=(await readdir(dir)).filter(name=>name.includes('pre-v29')&&name.endsWith('.sqlite'));assert.equal(backups.length,1);
  const backup=new DatabaseSync(join(dir,backups[0]),{readOnly:true});try{assert.equal(backup.prepare('PRAGMA user_version').get().user_version,26);assert.equal(backup.prepare('SELECT count(*) AS n FROM accounts').get().n,4);}finally{backup.close();}
  const live=new DatabaseSync(path,{readOnly:true});try{assert.equal(live.prepare('PRAGMA user_version').get().user_version,29);assert.equal(live.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{live.close();}
  await stop();await start(true);
  const proposed=await call('/api/group-reunions',people[0],{roomId:room,invitees:[people[1].id,people[2].id],startsAt:created+86400000});assert.equal(proposed.status,201);const id=(await proposed.json()).reunion.id;
  assert.equal((await call(`/api/group-reunions/${id}`,people[3])).status,404);
  assert.equal((await (await call(`/api/group-reunions/${id}/decision`,people[1],{action:'accept'})).json()).reunion.status,'pending');
  assert.equal((await (await call(`/api/group-reunions/${id}/decision`,people[2],{action:'accept'})).json()).reunion.status,'confirmed');
  assert.equal((await (await call('/api/activities',people[3])).json()).activities.some(a=>a.id===id),false);
  assert.equal((await (await call('/api/activities',people[0])).json()).activities.some(a=>a.id===id&&a.privateReunion),true);
  await stop();await start(true);
  assert.equal((await (await call(`/api/group-reunions/${id}`,people[0])).json()).reunion.status,'confirmed');
  assert.equal((await (await call(`/api/group-reunions/${id}/decision`,people[1],{action:'withdraw'})).json()).reunion.status,'cancelled');
  assert.equal((await (await call('/api/activities',people[0])).json()).activities.find(a=>a.id===id).cancelled,true);
  assert.equal((await (await call('/api/plaza/notifications',people[0])).json()).items.some(n=>n.kind==='group_cancelled'&&n.targetId===id),true);
 } finally {if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}await rm(dir,{recursive:true,force:true});}
});
