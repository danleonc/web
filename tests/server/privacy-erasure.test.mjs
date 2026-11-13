import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {fixture} from './feature-fixture.mjs';
import {Storage,digest} from '../../server/storage.ts';
import {eraseEmptyAccount} from '../../server/privacy-erasure.ts';
import {backupDatabase} from '../../scripts/backup-db.mjs';
import {join} from 'node:path';
import {mockGoogle} from './mock-google.mjs';
import sharp from 'sharp';

async function setup(t, extra={}) {
 const f=await fixture(t,{plazaEnabled:true,privacyErasureEnabled:true,...extra}); const person=await f.signup('erase_person'), operator=await f.signup('erase_operator'), other=await f.signup('erase_other');
 const db=new DatabaseSync(f.path); db.prepare('INSERT INTO privacy_operators(user_id) VALUES(?)').run(operator.id); db.close();
 const request=(await f.request('/api/privacy/request','POST',{action:'submit'},person.cookie)).body.request;
 await f.request('/api/privacy/ack','POST',{userId:person.id,version:request.version},operator.cookie);
 const version=(await f.request('/api/privacy/request','GET',undefined,person.cookie)).body.request.version;
 return {f,person,operator,other,version};
}
test('borrado interno limitado exige operador, solicitud recibida, origen y sesión reciente',async t=>{
 const {f,person,operator,other,version}=await setup(t); const body={userId:person.id,version,confirmation:'BORRAR CUENTA'};
 assert.equal((await f.request('/api/account/profile','PUT',{interests:['Lectura'],boundaries:['A mi ritmo'],availability:'Sin preferencia'},person.cookie)).status,200);
 const photo=await sharp({create:{width:40,height:40,channels:3,background:'#285d4c'}}).png().toBuffer();
 assert.equal((await f.raw('/api/account/profile/photo',{method:'POST',headers:{Origin:'http://localhost:4173',Cookie:person.cookie,'Content-Type':'image/png','X-Photo-Declaration':'yes'},body:photo})).status,201);
 assert.equal((await f.request('/api/privacy/erase-empty','POST',body,other.cookie)).status,403);
 assert.equal((await f.request('/api/privacy/erase-empty','POST',body,operator.cookie,'https://ajeno.example')).status,403);
 assert.equal((await f.request('/api/privacy/erase-empty','POST',{...body,version:version-1},operator.cookie)).status,409);
 assert.equal((await f.request('/api/privacy/erase-empty','POST',{...body,confirmation:'si'},operator.cookie)).status,422);
 f.advance(11*60_000); assert.equal((await f.request('/api/privacy/erase-empty','POST',body,operator.cookie)).status,403);
 const login=await f.request('/api/auth/login','POST',{username:operator.username,password:'Una frase larga para pruebas 123'}); assert.equal(login.status,200);
 const backupPath=join(f.directory,'before-erasure.sqlite'); await backupDatabase(f.path,backupPath);
 const result=await f.request('/api/privacy/erase-empty','POST',body,login.cookie); assert.equal(result.status,200); assert.ok(result.body.receiptId);
 const profileDb=new DatabaseSync(f.path,{readOnly:true}); try {assert.equal(profileDb.prepare('SELECT count(*) AS n FROM account_profiles WHERE user_id=?').get(person.id).n,0); assert.equal(profileDb.prepare('SELECT count(*) AS n FROM account_profile_photos WHERE user_id=?').get(person.id).n,0);} finally {profileDb.close();}
 assert.equal((await f.request('/api/session','GET',undefined,person.cookie)).status,401);
 assert.equal((await f.request('/api/session','GET',undefined,other.cookie)).status,200);
 const db=new DatabaseSync(f.path); try {assert.equal(db.prepare('SELECT count(*) AS n FROM accounts WHERE id=?').get(person.id).n,0); assert.equal(db.prepare('SELECT count(*) AS n FROM sessions WHERE user_id=?').get(person.id).n,0); assert.equal(db.prepare('SELECT count(*) AS n FROM account_emails WHERE user_id=?').get(person.id).n,0); assert.equal(db.prepare('SELECT count(*) AS n FROM privacy_requests WHERE user_id=?').get(person.id).n,0); const receipt=db.prepare('SELECT subject_hash,operator_id FROM privacy_erasure_receipts WHERE id=?').get(result.body.receiptId); assert.equal(receipt.subject_hash,digest(`privacy-erasure:${person.id}`)); assert.equal(receipt.operator_id,operator.id); const events=db.prepare('SELECT action,actor_id FROM privacy_erasure_events WHERE receipt_id=? ORDER BY version').all(result.body.receiptId); assert.deepEqual(events.map(e=>e.action),['submit','acknowledge']); assert.equal(events[0].actor_id,null); assert.equal(events[1].actor_id,operator.id);} finally {db.close();}
 const backup=new DatabaseSync(backupPath,{readOnly:true}); try {assert.equal(backup.prepare('SELECT count(*) AS n FROM accounts WHERE id=?').get(person.id).n,1);} finally {backup.close();}
});
test('borrado limitado rechaza actividad o referencias compartidas sin modificar datos',async t=>{
 const {f,person,operator,version}=await setup(t);
 await f.request('/api/plaza/posts','POST',{topic:'crear',title:'Mi publicación',body:'Contenido propio'},person.cookie);
 const result=await f.request('/api/privacy/erase-empty','POST',{userId:person.id,version,confirmation:'BORRAR CUENTA'},operator.cookie); assert.equal(result.status,409);
 assert.equal((await f.request('/api/session','GET',undefined,person.cookie)).status,200);
 assert.equal((await f.request('/api/plaza/posts','GET',undefined,person.cookie)).body.posts[0].title,'Mi publicación');
});
test('borrado limitado rechaza disparadores desconocidos sin modificar datos',async t=>{
 const {f,person,operator,version}=await setup(t); const db=new DatabaseSync(f.path); db.exec("CREATE TRIGGER fail_erasure BEFORE DELETE ON accounts BEGIN SELECT RAISE(ABORT,'test failure'); END;"); db.close();
 const result=await f.request('/api/privacy/erase-empty','POST',{userId:person.id,version,confirmation:'BORRAR CUENTA'},operator.cookie); assert.equal(result.status,409);
 assert.equal((await f.request('/api/session','GET',undefined,person.cookie)).status,200);
 assert.equal((await f.request('/api/privacy/request','GET',undefined,person.cookie)).body.request.status,'seen');
 const check=new DatabaseSync(f.path); try {assert.equal(check.prepare('SELECT count(*) AS n FROM privacy_erasure_receipts').get().n,0);} finally {check.close();}
});
test('una falla durante la transacción revierte cuenta, solicitud y comprobante',async t=>{
 const {f,person,operator,version}=await setup(t); const storage=new Storage(f.path);
 try {
  const token=operator.cookie.split('=')[1];
  assert.throws(()=>eraseEmptyAccount(storage,person.id,operator.id,version,digest(token),Date.now(),()=>{storage.db.exec("CREATE TEMP TRIGGER fail_after_check BEFORE DELETE ON accounts BEGIN SELECT RAISE(ABORT,'simulated failure'); END;"); return false;}));
  assert.equal(storage.db.prepare('SELECT count(*) AS n FROM accounts WHERE id=?').get(person.id).n,1);
  assert.equal(storage.db.prepare('SELECT count(*) AS n FROM privacy_requests WHERE user_id=?').get(person.id).n,1);
  assert.equal(storage.db.prepare('SELECT count(*) AS n FROM privacy_erasure_receipts').get().n,0);
 } finally {storage.close();}
});
test('borrado limitado se mantiene desactivado por defecto',async t=>{
 const {f,person,operator,version}=await setup(t,{privacyErasureEnabled:false});
 assert.equal((await f.request('/api/session','GET',undefined,operator.cookie)).body.privacyErasureAvailable,false);
 assert.equal((await f.request('/api/privacy/erase-empty','POST',{userId:person.id,version,confirmation:'BORRAR CUENTA'},operator.cookie)).status,404);
});
test('borrado limitado funciona tras migrar una base existente desde v16',async t=>{
 const {f,person,operator,version}=await setup(t); const db=new DatabaseSync(f.path);
 db.exec('ALTER TABLE plaza_private_messages DROP COLUMN reply_to; ALTER TABLE plaza_replies DROP COLUMN reply_to; DROP TABLE plaza_images; ALTER TABLE plaza_reports DROP COLUMN evidence_image; ALTER TABLE plaza_posts DROP COLUMN sticker_id; ALTER TABLE plaza_replies DROP COLUMN sticker_id; ALTER TABLE plaza_private_messages DROP COLUMN sticker_id; DROP TABLE notifications; DROP TABLE notification_mutes; DROP TABLE privacy_erasure_events; DROP TABLE privacy_erasure_receipts; DROP TABLE IF EXISTS profile_photo_shares; DROP TABLE IF EXISTS account_profile_photos; DROP TABLE IF EXISTS account_profiles; PRAGMA user_version=16'); db.close();
 await f.restart();
 const result=await f.request('/api/privacy/erase-empty','POST',{userId:person.id,version,confirmation:'BORRAR CUENTA'},operator.cookie);
 assert.equal(result.status,200);
 assert.equal((await f.request('/api/session','GET',undefined,person.cookie)).status,401);
});
test('borrado limitado falla cerrado ante una nueva relación de base de datos',async t=>{
 const {f,person,operator,version}=await setup(t); const db=new DatabaseSync(f.path);
 db.exec('CREATE TABLE future_reference(id TEXT PRIMARY KEY,owner_id TEXT REFERENCES accounts(id))'); db.prepare('INSERT INTO future_reference VALUES(?,?)').run('future',person.id); db.close();
 assert.equal((await f.request('/api/privacy/erase-empty','POST',{userId:person.id,version,confirmation:'BORRAR CUENTA'},operator.cookie)).status,409);
 assert.equal((await f.request('/api/session','GET',undefined,person.cookie)).status,200);
});
test('borrado limitado rechaza tablas desconocidas incluso si no declaran claves foráneas',async t=>{
 const {f,person,operator,version}=await setup(t); const db=new DatabaseSync(f.path); db.exec('CREATE TABLE future_unmapped(owner TEXT)'); db.close();
 assert.equal((await f.request('/api/privacy/erase-empty','POST',{userId:person.id,version,confirmation:'BORRAR CUENTA'},operator.cookie)).status,409);
 assert.equal((await f.request('/api/session','GET',undefined,person.cookie)).status,200);
});
test('borrado limitado rechaza columnas nuevas hasta revisar el esquema',async t=>{
 const {f,person,operator,version}=await setup(t); const db=new DatabaseSync(f.path); db.exec('ALTER TABLE plaza_posts ADD COLUMN new_references TEXT'); db.close();
 assert.equal((await f.request('/api/privacy/erase-empty','POST',{userId:person.id,version,confirmation:'BORRAR CUENTA'},operator.cookie)).status,409);
 assert.equal((await f.request('/api/session','GET',undefined,person.cookie)).status,200);
});
test('borrado limitado no elimina cuentas con Google ni referencias en contenido ajeno',async t=>{
 const {f,person,operator,other,version}=await setup(t); const db=new DatabaseSync(f.path);
 db.prepare('INSERT INTO account_google(user_id,subject,profile_complete,created_at) VALUES(?,?,1,?)').run(person.id,'google-subject',Date.now()); db.close();
 const body={userId:person.id,version,confirmation:'BORRAR CUENTA'};
 assert.equal((await f.request('/api/privacy/erase-empty','POST',body,operator.cookie)).status,409);
 const clear=new DatabaseSync(f.path); clear.prepare('DELETE FROM account_google WHERE user_id=?').run(person.id); clear.close();
 await f.request('/api/plaza/posts','POST',{topic:'crear',title:'Referencia',body:`Referencia a ${person.id}`},other.cookie);
 assert.equal((await f.request('/api/privacy/erase-empty','POST',body,operator.cookie)).status,409);
 assert.equal((await f.request('/api/session','GET',undefined,person.cookie)).status,200);
});
test('borrado limitado permanece cerrado si el servicio tiene Google habilitado',async t=>{
 const google=await mockGoogle('http://localhost:4173'); const {f,person,operator,version}=await setup(t,{google});
 assert.equal((await f.request('/api/session','GET',undefined,operator.cookie)).body.privacyErasureAvailable,false);
 assert.equal((await f.request('/api/privacy/erase-empty','POST',{userId:person.id,version,confirmation:'BORRAR CUENTA'},operator.cookie)).status,409);
 assert.equal((await f.request('/api/session','GET',undefined,person.cookie)).status,200);
});
test('borrado limitado espera si hay una operación autenticada en curso',async t=>{
 const codes=new Map(); let release; let startedResolve; const started=new Promise(resolve=>{startedResolve=resolve;});
 const f=await fixture(t,{plazaEnabled:true,privacyErasureEnabled:true,sendVerificationEmail:async(email,code)=>{codes.set(email,code); if(email==='pending@example.test'){startedResolve(); await new Promise(resolve=>{release=resolve;});}}});
 t.after(()=>{if(release)release();});
 async function signup(name,confirm=true){const r=await f.request('/api/auth/register','POST',{username:name,alias:name,adult:true,password:'Una frase larga para pruebas 123'}); const email=`${name}@example.test`; await f.request('/api/auth/email-code','POST',{email,adult:true},r.cookie); if(confirm)await f.request('/api/auth/confirm-email','POST',{code:codes.get(email)},r.cookie); return {...r.body,cookie:r.cookie};}
 const person=await signup('inflight_person',false), operator=await signup('inflight_operator');
 const db=new DatabaseSync(f.path); db.prepare('INSERT INTO privacy_operators(user_id) VALUES(?)').run(operator.id); db.close();
 const request=(await f.request('/api/privacy/request','POST',{action:'submit'},person.cookie)).body.request;
 await f.request('/api/privacy/ack','POST',{userId:person.id,version:request.version},operator.cookie);
 const version=(await f.request('/api/privacy/request','GET',undefined,person.cookie)).body.request.version;
 f.advance(61_000); const pending=f.request('/api/auth/email-code','POST',{email:'pending@example.test',adult:true},person.cookie);
 let timeout; try {await Promise.race([started,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('No comenzó la entrega de correo')),5000);})]);} finally {clearTimeout(timeout);}
 const body={userId:person.id,version,confirmation:'BORRAR CUENTA'};
 assert.equal((await f.request('/api/privacy/erase-empty','POST',body,operator.cookie)).status,409);
 release(); await pending;
 assert.equal((await f.request('/api/privacy/erase-empty','POST',body,operator.cookie)).status,200);
});
