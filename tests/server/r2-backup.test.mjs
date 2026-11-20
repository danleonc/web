import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {encryptedR2Backup,validateR2Config} from '../../scripts/r2-backup.mjs';
import {restoreEncryptedBackup} from '../../scripts/encrypted-backup.mjs';

test('solo envía datos cifrados y verifica la copia descargada',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'nexafia-r2-'));t.after(()=>rm(dir,{recursive:true,force:true}));const src=join(dir,'source.sqlite'),backup=join(dir,'download.enc'),out=join(dir,'restored.sqlite'),key=randomBytes(32);const db=new DatabaseSync(src);db.exec("CREATE TABLE t(v TEXT); INSERT INTO t VALUES('dato privado de ejemplo')");db.close();let stored,objectKey;
 const client={send:async command=>{const v=command.input;if(command.constructor.name==='PutObjectCommand'){let chunks=[];for await(const c of v.Body)chunks.push(c);stored=Buffer.concat(chunks);objectKey=v.Key;assert.equal(v.IfNoneMatch,'*');assert.equal(v.ContentMD5,createHash('md5').update(stored).digest('base64'));assert.equal(stored.includes(Buffer.from('dato privado de ejemplo')),false);return {};}if(command.constructor.name==='GetObjectCommand'){assert.equal(v.Key,objectKey);return {Body:Readable.from([stored])}}throw Error('unexpected');}};
 const result=await encryptedR2Backup({source:src,key,bucket:'nexafia-backups',client});assert.match(result.key,/^nexafia\/backups\//);await writeFile(backup,stored);await restoreEncryptedBackup(backup,out,key);const restored=new DatabaseSync(out,{readOnly:true});try{assert.equal(restored.prepare('SELECT v FROM t').get().v,'dato privado de ejemplo')}finally{restored.close()}
});

test('rechaza copia remota distinta y no informa éxito',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'nexafia-r2-'));t.after(()=>rm(dir,{recursive:true,force:true}));const src=join(dir,'s.sqlite'),db=new DatabaseSync(src);db.exec('CREATE TABLE t(id INTEGER)');db.close();const client={send:async c=>c.constructor.name==='PutObjectCommand'?{}:{Body:Readable.from([Buffer.from('different')])}};await assert.rejects(encryptedR2Backup({source:src,key:randomBytes(32),bucket:'nexafia-backups',client}),/verification/i);
});

test('valida configuración estricta y evita destinos no autorizados',()=>{
 const valid={account:'a'.repeat(32),bucket:'nexafia-backups',accessKey:'x'.repeat(32),secretKey:'y'.repeat(64)};assert.doesNotThrow(()=>validateR2Config(valid));for(const value of [{...valid,account:'evil.example.com'},{...valid,bucket:'../private'},{...valid,secretKey:''}])assert.throws(()=>validateR2Config(value));
});

test('el SDK firma peticiones de subida y lectura sin una conexión externa',async t=>{
 const {S3Client}=await import('@aws-sdk/client-s3');const dir=await mkdtemp(join(tmpdir(),'nexafia-r2-sdk-'));t.after(()=>rm(dir,{recursive:true,force:true}));const src=join(dir,'s.sqlite'),db=new DatabaseSync(src);db.exec('CREATE TABLE t(id INTEGER)');db.close();let object,seen=[];
 const handler={handle:async req=>{seen.push(req.method);assert.equal(req.hostname,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com');assert.match(req.headers.authorization,/^AWS4-HMAC-SHA256 /);if(req.method==='PUT'){const parts=[];for await(const chunk of req.body)parts.push(Buffer.from(chunk));object=Buffer.concat(parts);return {response:{statusCode:200,headers:{etag:'"test"'},body:Readable.from([])}}}return {response:{statusCode:200,headers:{'content-length':String(object.length)},body:Readable.from([object])}}},destroy(){}};
 const client=new S3Client({region:'auto',endpoint:'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.r2.cloudflarestorage.com',forcePathStyle:true,credentials:{accessKeyId:'testaccesskey00000000',secretAccessKey:'testsecretkey0000000000000000000000'},requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED',requestHandler:handler});t.after(()=>client.destroy());await encryptedR2Backup({source:src,key:randomBytes(32),bucket:'nexafia-backups',client});assert.deepEqual(seen,['PUT','GET']);
});

test('cancela un transporte que no responde sin marcarlo como correcto',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'nexafia-r2-timeout-'));t.after(()=>rm(dir,{recursive:true,force:true}));const src=join(dir,'s.sqlite'),db=new DatabaseSync(src);db.exec('CREATE TABLE t(id INTEGER)');db.close();const client={send:async (_command,{abortSignal})=>new Promise((_resolve,reject)=>abortSignal.addEventListener('abort',()=>reject(Error('timeout-test-aborted')),{once:true}))};await assert.rejects(encryptedR2Backup({source:src,key:randomBytes(32),bucket:'nexafia-backups',client,timeoutMs:25}),/timeout-test-aborted/);
});
