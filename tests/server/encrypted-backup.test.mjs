import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {encryptedBackup,restoreEncryptedBackup} from '../../scripts/encrypted-backup.mjs';

test('copia cifrada restaura datos coherentes sin exponer texto en el archivo',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'nexafia-encrypted-'));t.after(()=>rm(dir,{recursive:true,force:true}));const src=join(dir,'source.sqlite'),enc=join(dir,'backup.enc'),out=join(dir,'restored.sqlite');const key=randomBytes(32);
 const db=new DatabaseSync(src);db.exec("CREATE TABLE items(value TEXT); INSERT INTO items VALUES('contenido privado de prueba')");db.close();
 await encryptedBackup(src,enc,key);assert.equal((await readFile(enc)).includes(Buffer.from('contenido privado de prueba')),false);await restoreEncryptedBackup(enc,out,key);const result=new DatabaseSync(out,{readOnly:true});try {assert.equal(result.prepare('SELECT value FROM items').get().value,'contenido privado de prueba');} finally {result.close();}
});

test('rechaza clave errónea, archivos alterados o truncados sin generar restauración',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'nexafia-encrypted-'));t.after(()=>rm(dir,{recursive:true,force:true}));const src=join(dir,'source.sqlite'),enc=join(dir,'backup.enc'),out=join(dir,'restored.sqlite');const key=randomBytes(32);const db=new DatabaseSync(src);db.exec('CREATE TABLE t(id INTEGER)');db.close();await encryptedBackup(src,enc,key);
 await assert.rejects(restoreEncryptedBackup(enc,out,randomBytes(32)));await assert.rejects(stat(out),{code:'ENOENT'});
 const original=await readFile(enc);const changed=Buffer.from(original);changed[changed.length-17]^=1;await writeFile(enc,changed);await assert.rejects(restoreEncryptedBackup(enc,out,key));await assert.rejects(stat(out),{code:'ENOENT'});
 await writeFile(enc,original.subarray(0,15));await assert.rejects(restoreEncryptedBackup(enc,out,key));await assert.rejects(stat(out),{code:'ENOENT'});
});

test('no sobrescribe destinos ni acepta claves de tamaño incorrecto',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'nexafia-encrypted-'));t.after(()=>rm(dir,{recursive:true,force:true}));const src=join(dir,'source.sqlite'),enc=join(dir,'backup.enc'),out=join(dir,'existing');const key=randomBytes(32);const db=new DatabaseSync(src);db.exec('CREATE TABLE t(id INTEGER)');db.close();await writeFile(out,'existing');
 await assert.rejects(encryptedBackup(src,enc,Buffer.alloc(16)));await encryptedBackup(src,enc,key);await assert.rejects(encryptedBackup(src,enc,key),{code:'EEXIST'});await assert.rejects(restoreEncryptedBackup(enc,out,key),{code:'EEXIST'});assert.equal(await readFile(out,'utf8'),'existing');
});

test('rechaza contenido autenticado que no es una base SQLite válida',async t=>{
 const {createCipheriv}=await import('node:crypto');const dir=await mkdtemp(join(tmpdir(),'nexafia-encrypted-'));t.after(()=>rm(dir,{recursive:true,force:true}));const enc=join(dir,'bad.enc'),out=join(dir,'restored.sqlite'),key=randomBytes(32),header=Buffer.concat([Buffer.from('NEXBK001'),randomBytes(12)]);const cipher=createCipheriv('aes-256-gcm',key,header.subarray(8));cipher.setAAD(header);await writeFile(enc,Buffer.concat([header,cipher.update(Buffer.from('esto no es una base de datos')),cipher.final(),cipher.getAuthTag()]));await assert.rejects(restoreEncryptedBackup(enc,out,key));await assert.rejects(stat(out),{code:'ENOENT'});
});

test('la herramienta de línea de comandos crea y restaura sin imprimir la clave',async t=>{
 const {spawnSync}=await import('node:child_process');const {resolve}=await import('node:path');const dir=await mkdtemp(join(tmpdir(),'nexafia-encrypted-cli-'));t.after(()=>rm(dir,{recursive:true,force:true}));const src=join(dir,'source.sqlite'),enc=join(dir,'backup.enc'),out=join(dir,'restore.sqlite');const key=randomBytes(32).toString('hex');const db=new DatabaseSync(src);db.exec("CREATE TABLE t(id INTEGER); INSERT INTO t VALUES(42)");db.close();const script=resolve('scripts/encrypted-backup.mjs');
 for(const args of [['backup',src,enc],['restore',enc,out]]) {const r=spawnSync(process.execPath,[script,...args],{env:{...process.env,NEXAFIA_BACKUP_KEY:key},encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.doesNotMatch(r.stdout+r.stderr,new RegExp(key));}
 const restored=new DatabaseSync(out,{readOnly:true});try {assert.equal(restored.prepare('SELECT id FROM t').get().id,42)} finally {restored.close();}
});
