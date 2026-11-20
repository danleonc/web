import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {Readable} from 'node:stream';
import {DatabaseSync} from 'node:sqlite';
import {saveLocalBackup, remoteSource} from '../../scripts/local-backup.mjs';
import {restoreEncryptedBackup} from '../../scripts/encrypted-backup.mjs';

test('cifra y verifica un respaldo recibido antes de publicarlo', async t => {
 const dir=await mkdtemp(join(tmpdir(),'nex-local-')); t.after(()=>rm(dir,{recursive:true,force:true}));
 const dbPath=join(dir,'source.sqlite'), destination=join(dir,'backup.enc'), restored=join(dir,'restore.sqlite'), key=randomBytes(32);
 const db=new DatabaseSync(dbPath); db.exec("CREATE TABLE t(v TEXT); INSERT INTO t VALUES('dato privado')"); db.close();
 await saveLocalBackup(Readable.from([await readFile(dbPath)]),Promise.resolve(),destination,key);
 assert.equal((await readFile(destination)).includes(Buffer.from('dato privado')),false);
 await restoreEncryptedBackup(destination,restored,key);
 const copy=new DatabaseSync(restored,{readOnly:true}); try {assert.equal(copy.prepare('SELECT v FROM t').get().v,'dato privado');} finally {copy.close();}
});

test('el comando remoto entrega una instantánea verificable y elimina su temporal', async t => {
 const {spawn}=await import('node:child_process');
 const dir=await mkdtemp(join(tmpdir(),'nex-remote-')); t.after(()=>rm(dir,{recursive:true,force:true}));
 const src=join(dir,'source.sqlite'), dest=join(dir,'backup.enc'), key=randomBytes(32);
 const db=new DatabaseSync(src); db.exec("CREATE TABLE t(v TEXT); INSERT INTO t VALUES('remote')"); db.close();
 const child=spawn(process.execPath,['--input-type=module','-e',`await import('data:text/javascript;base64,${Buffer.from(remoteSource).toString('base64')}')`],{env:{...process.env,ENTRE_DATABASE_PATH:src,TEMP:dir,TMP:dir},stdio:['ignore','pipe','pipe']});
 child.stderr.resume();
 const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',c=>c===0?resolve():reject(Error(`exit ${c}`)));});
 await saveLocalBackup(child.stdout,done,dest,key);
 assert.equal((await readdir(dir)).some(n=>n.startsWith('nexafia-transfer-')),false);
});

test('falla cerrada si se interrumpe la transferencia o la base es inválida', async t => {
 const dir=await mkdtemp(join(tmpdir(),'nex-local-')); t.after(()=>rm(dir,{recursive:true,force:true})); const key=randomBytes(32);
 await assert.rejects(saveLocalBackup(Readable.from(['basura']),Promise.resolve(),join(dir,'invalid.enc'),key));
 const dbPath=join(dir,'source.sqlite'); const db=new DatabaseSync(dbPath); db.exec('CREATE TABLE t(v TEXT)'); db.close();
 await assert.rejects(saveLocalBackup(Readable.from([await readFile(dbPath)]),Promise.reject(Error('falló ssh')),join(dir,'failed.enc'),key));
 assert.deepEqual((await readdir(dir)).sort(),['source.sqlite']);
});

test('no sobrescribe una copia existente y rechaza un destino SSH inesperado', async t => {
 const {writeFile}=await import('node:fs/promises'); const {startRenderSnapshot}=await import('../../scripts/local-backup.mjs');
 const dir=await mkdtemp(join(tmpdir(),'nex-local-')); t.after(()=>rm(dir,{recursive:true,force:true}));
 const src=join(dir,'source.sqlite'), dest=join(dir,'backup.enc');
 const db=new DatabaseSync(src); db.exec('CREATE TABLE t(v TEXT)'); db.close(); await writeFile(dest,'existing');
 await assert.rejects(saveLocalBackup(Readable.from([await readFile(src)]),Promise.resolve(),dest,randomBytes(32)),{code:'EEXIST'});
 assert.equal(await readFile(dest,'utf8'),'existing');
 assert.throws(()=>startRenderSnapshot({target:'attacker.example',identity:'id',knownHosts:'hosts'}),/Invalid/);
});
