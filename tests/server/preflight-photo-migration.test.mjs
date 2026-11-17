import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Storage } from '../../server/storage.ts';
import { preflightPhotoMigration } from '../../server/preflight-photo-migration.ts';

test('antes de migrar crea copia verificada y ensaya v23 a v24 sin alterar la base activa', async () => {
 const dir=await mkdtemp(join(tmpdir(),'nexafia-preflight-')); const path=join(dir,'data.sqlite');
 try { const old=new Storage(path); old.createAccount({id:'a',username:'a',alias:'A',passwordHash:'x',recoveryHash:'x'},1); old.db.exec('DROP TABLE connection_photo_challenges; PRAGMA user_version=23'); old.close();
  const result=await preflightPhotoMigration(path); assert.ok(result.backup); assert.equal((await readdir(dir)).filter(x=>x.includes('pre-v26') && x.endsWith('.sqlite')).length,1);
  const backup=new (await import('node:sqlite')).DatabaseSync(result.backup,{readOnly:true}); try {assert.equal(backup.prepare('SELECT alias FROM accounts WHERE id=?').get('a').alias,'A'); assert.equal(backup.prepare('PRAGMA user_version').get().user_version,23);} finally {backup.close();}
  const before=new (await import('node:sqlite')).DatabaseSync(path,{readOnly:true}); try {assert.equal(before.prepare('PRAGMA user_version').get().user_version,23);} finally {before.close();}
  assert.equal((await readdir(dir)).some(x=>x.includes('rehearsal')),false);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('no hace copias cuando la base está nueva o ya migrada',async()=>{const dir=await mkdtemp(join(tmpdir(),'nexafia-preflight-'));try {const path=join(dir,'new.sqlite'); assert.equal(await preflightPhotoMigration(path),null); const db=new Storage(path);db.close();assert.equal(await preflightPhotoMigration(path),null);}finally{await rm(dir,{recursive:true,force:true});}});

test('si el ensayo falla, conserva el respaldo y deja intacta la base activa',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nexafia-preflight-fail-')); const path=join(dir,'data.sqlite');
 try {const db=new (await import('node:sqlite')).DatabaseSync(path);db.exec('CREATE TABLE unrelated(id INTEGER); PRAGMA user_version=23');db.close();
  await assert.rejects(preflightPhotoMigration(path));
  const original=new (await import('node:sqlite')).DatabaseSync(path,{readOnly:true});try{assert.equal(original.prepare('PRAGMA user_version').get().user_version,23);}finally{original.close();}
  assert.equal((await readdir(dir)).filter(x=>x.includes('pre-v26') && x.endsWith('.sqlite')).length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('el arranque real ensaya y respalda antes de migrar una base v23',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nexafia-pilot-start-')), path=join(dir,'data.sqlite');
 let child;
 try {
  const old=new Storage(path);old.createAccount({id:'a',username:'a',alias:'A',passwordHash:'x',recoveryHash:'x'},1);old.db.exec('DROP TABLE connection_photo_challenges; PRAGMA user_version=23');old.close();
  await mkdir(join(dir,'dist-pilot'));await writeFile(join(dir,'dist-pilot','entre-build.json'),JSON.stringify({mode:'accounts',realPlaza:false}));
  const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  child=spawn(process.execPath,[resolve('server/pilot.ts')],{cwd:dir,env:{...process.env,ENTRE_PUBLIC_ORIGIN:`http://127.0.0.1:${port}`,ENTRE_DATABASE_PATH:path,ENTRE_STAGING_SHARED:'0',PORT:String(port),ENTRE_STAGING_PASSWORD:undefined}});
  let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
  const until=Date.now()+10000; let ok=false; while(Date.now()<until){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok){ok=true;break;}}catch{} await new Promise(resolve=>setTimeout(resolve,100));}
  assert.equal(ok,true,output); const db=new (await import('node:sqlite')).DatabaseSync(path,{readOnly:true});try{assert.equal(db.prepare('PRAGMA user_version').get().user_version,26);assert.equal(db.prepare('SELECT alias FROM accounts WHERE id=?').get('a').alias,'A');}finally{db.close();}
  assert.equal((await readdir(dir)).filter(x=>x.includes('pre-v26') && x.endsWith('.sqlite')).length,1);
 }finally{if(child){child.kill();await new Promise(resolve=>child.once('exit',resolve));}await rm(dir,{recursive:true,force:true});}
});
test('el preensayo respalda y migra una copia de la base v24',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nexafia-preflight-v24-')),path=join(dir,'data.sqlite');
 try{const old=new Storage(path);for(const id of ['a','b']) old.createAccount({id,username:id,alias:id,passwordHash:'x',recoveryHash:'x'},1);old.db.prepare('INSERT INTO plaza_connections VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('c','a','b','a','b','','post','origin','accepted',1,1);old.db.prepare('INSERT INTO connection_photo_challenges(connection_id,sender_photo,recipient_photo,rounds,first_sender) VALUES(?,?,?,?,?)').run('c','pa','pb',4,'a');old.db.exec('ALTER TABLE connection_photo_challenges DROP COLUMN requested_by; PRAGMA user_version=24');old.close();const result=await preflightPhotoMigration(path);assert.ok(result.backup);const copy=new (await import('node:sqlite')).DatabaseSync(result.backup,{readOnly:true});try{assert.equal(copy.prepare('PRAGMA user_version').get().user_version,24);}finally{copy.close();}const live=new (await import('node:sqlite')).DatabaseSync(path,{readOnly:true});try{assert.equal(live.prepare('PRAGMA user_version').get().user_version,24);}finally{live.close();}}finally{await rm(dir,{recursive:true,force:true});}
});


test('ensaya la migración desde v25 antes de tocar la base activa',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nexafia-preflight-v25-')),path=join(dir,'data.sqlite');
 try { const old=new Storage(path); old.createAccount({id:'a',username:'a',alias:'A',passwordHash:'x',recoveryHash:'x'},1); old.db.exec('DROP TABLE room_history_dismissals; DROP TABLE connection_dismissals; PRAGMA user_version=25'); old.close();
 const result=await preflightPhotoMigration(path); assert.ok(result?.backup); const live=new (await import('node:sqlite')).DatabaseSync(path,{readOnly:true}); try {assert.equal(live.prepare('PRAGMA user_version').get().user_version,25); assert.equal(live.prepare('SELECT alias FROM accounts WHERE id=?').get('a').alias,'A');} finally {live.close();}
 const migrated=new Storage(path); try {assert.equal(migrated.db.prepare('PRAGMA user_version').get().user_version,26); assert.equal(migrated.db.prepare('SELECT alias FROM accounts WHERE id=?').get('a').alias,'A');} finally {migrated.close();}
 } finally {await rm(dir,{recursive:true,force:true});}
});
