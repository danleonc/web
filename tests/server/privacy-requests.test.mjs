import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {fixture} from './feature-fixture.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);

test('solicitud interna de eliminación es privada, reversible y no elimina la cuenta',async t=>{
 const f=await fixture(t,{plazaEnabled:true}); const ana=await f.signup('delete_ana'), bea=await f.signup('delete_bea'), operator=await f.signup('privacy_operator');
 assert.equal((await f.request('/api/privacy/request')).status,401);
 assert.equal((await f.request('/api/privacy/request','POST',{action:'submit'},ana.cookie,'https://ajeno.example')).status,403);
 assert.equal((await f.request('/api/privacy/queue','GET',undefined,bea.cookie)).status,403);
 const empty=await f.request('/api/privacy/request','GET',undefined,ana.cookie); assert.equal(empty.body.request,null);
 const submitted=await f.request('/api/privacy/request','POST',{action:'submit'},ana.cookie); assert.equal(submitted.status,200); assert.equal(submitted.body.request.status,'pending');
 assert.equal((await f.request('/api/account/export','GET',undefined,ana.cookie)).body.privacyRequest.status,'pending');
 assert.equal((await f.request('/api/account/export','GET',undefined,bea.cookie)).body.privacyRequest,null);
 assert.equal((await f.request('/api/privacy/request','POST',{action:'submit',userId:bea.id},ana.cookie)).status,422);
 const repeated=await f.request('/api/privacy/request','POST',{action:'submit'},ana.cookie); assert.equal(repeated.body.request.version,submitted.body.request.version);
 assert.equal((await f.request('/api/privacy/request','GET',undefined,bea.cookie)).body.request,null);
 const db=new DatabaseSync(f.path); db.prepare('INSERT INTO moderators(user_id) VALUES(?)').run(bea.id); db.prepare('INSERT INTO privacy_operators(user_id) VALUES(?)').run(operator.id); db.close();
 assert.equal((await f.request('/api/privacy/queue','GET',undefined,bea.cookie)).status,403);
 const queue=await f.request('/api/privacy/queue','GET',undefined,operator.cookie); assert.equal(queue.body.requests.length,1); assert.equal(queue.body.requests[0].userId,ana.id);
 assert.equal((await f.request('/api/privacy/ack','POST',{userId:ana.id,version:submitted.body.request.version},bea.cookie)).status,403);
 const ack=await f.request('/api/privacy/ack','POST',{userId:ana.id,version:submitted.body.request.version},operator.cookie); assert.equal(ack.status,200);
 assert.equal((await f.request('/api/privacy/request','GET',undefined,ana.cookie)).body.request.status,'seen');
 const cancelled=await f.request('/api/privacy/request','POST',{action:'cancel'},ana.cookie); assert.equal(cancelled.body.request.status,'cancelled');
 assert.equal((await f.request('/api/privacy/ack','POST',{userId:ana.id,version:submitted.body.request.version},operator.cookie)).status,409);
 const reopened=await f.request('/api/privacy/request','POST',{action:'submit'},ana.cookie); assert.equal(reopened.body.request.status,'pending'); assert.ok(reopened.body.request.version>cancelled.body.request.version);
 assert.equal((await f.request('/api/privacy/ack','POST',{userId:ana.id,version:submitted.body.request.version},operator.cookie)).status,409);
 await f.request('/api/privacy/request','POST',{action:'cancel'},ana.cookie);
 await f.restart(); assert.equal((await f.request('/api/privacy/request','GET',undefined,ana.cookie)).body.request.status,'cancelled');
 const historyDb=new DatabaseSync(f.path); try { const events=historyDb.prepare('SELECT action,version FROM privacy_request_events WHERE user_id=? ORDER BY version').all(ana.id); assert.deepEqual(events.map(e=>e.action),['submit','acknowledge','cancel','submit','cancel']); assert.deepEqual(events.map(e=>e.version),[1,2,3,4,5]); } finally { historyDb.close(); }
 const exported=(await f.request('/api/account/export','GET',undefined,ana.cookie)).body;
 assert.deepEqual(exported.privacyRequestEvents.items.map(e=>e.action),['submit','acknowledge','cancel','submit','cancel']);
 assert.equal(JSON.stringify(exported.privacyRequestEvents).includes(operator.id),false);
 assert.equal((await f.request('/api/session','GET',undefined,ana.cookie)).status,200);
});
test('solicitudes de privacidad están desactivadas por defecto',async t=>{
 const f=await fixture(t); const user=await f.signup('privacy_disabled'); assert.equal((await f.request('/api/privacy/request','GET',undefined,user.cookie)).status,404);
});
test('un operador sin correo confirmado no puede ver solicitudes',async t=>{
 const f=await fixture(t,{plazaEnabled:true});
 const pending=await f.request('/api/auth/register','POST',{username:'privacy_pending',alias:'Pendiente',adult:true,password:'Una frase larga para pruebas 123'});
 const db=new DatabaseSync(f.path); db.prepare('INSERT INTO privacy_operators(user_id) VALUES(?)').run(pending.body.id); db.close();
 assert.equal((await f.request('/api/privacy/queue','GET',undefined,pending.cookie)).status,403);
});
test('cuentas restringidas mantienen acceso a registrar y cancelar su solicitud',async t=>{
 const f=await fixture(t,{plazaEnabled:true}); const user=await f.signup('privacy_restricted');
 const db=new DatabaseSync(f.path); db.prepare("INSERT INTO restrictions(user_id,kind,reason,until_at,action_id) VALUES(?,'ban','Prueba',NULL,'action-test')").run(user.id); db.close();
 assert.equal((await f.request('/api/privacy/request','POST',{action:'submit'},user.cookie)).body.request.status,'pending');
 assert.equal((await f.request('/api/privacy/request','POST',{action:'cancel'},user.cookie)).body.request.status,'cancelled');
});
test('el permiso de privacidad se concede y revoca solo con herramienta administrativa local',async t=>{
 const f=await fixture(t,{plazaEnabled:true}); const user=await f.signup('privacy_cli');
 assert.equal((await f.request('/api/privacy/queue','GET',undefined,user.cookie)).status,403);
 await run(process.execPath,['scripts/privacy-operator.mjs','grant',user.username,f.path]);
 assert.equal((await f.request('/api/privacy/queue','GET',undefined,user.cookie)).status,200);
 await run(process.execPath,['scripts/privacy-operator.mjs','revoke',user.username,f.path]);
 assert.equal((await f.request('/api/privacy/queue','GET',undefined,user.cookie)).status,403);
 await assert.rejects(run(process.execPath,['scripts/privacy-operator.mjs','grant','cuenta_inexistente',f.path]));
});
test('inventario de solicitud muestra solo conteos al operador y deja de estar disponible al cancelar',async t=>{
 const f=await fixture(t,{plazaEnabled:true}); const person=await f.signup('inventory_person'), other=await f.signup('inventory_other'), operator=await f.signup('inventory_operator');
 await f.request('/api/plaza/posts','POST',{topic:'crear',title:'Texto propio privado',body:'Contenido reservado'},person.cookie);
 await f.request('/api/plaza/posts','POST',{topic:'crear',title:'De otra persona',body:'No corresponde'},other.cookie);
 await f.request('/api/privacy/request','POST',{action:'submit'},person.cookie);
 const db=new DatabaseSync(f.path); db.prepare('INSERT INTO privacy_operators(user_id) VALUES(?)').run(operator.id); db.close();
 const path=`/api/privacy/inventory/${person.id}`;
 assert.equal((await f.request(path)).status,401);
 assert.equal((await f.request(path,'GET',undefined,other.cookie)).status,403);
 assert.equal((await f.request(path,'GET',undefined,person.cookie)).status,403);
 const result=await f.request(path,'GET',undefined,operator.cookie); assert.equal(result.status,200);
 assert.equal((await f.request(`/api/privacy/inventory/${other.id}`,'GET',undefined,operator.cookie)).status,404);
 assert.equal((await f.request(`/api/privacy/inventory/${operator.id}`,'GET',undefined,operator.cookie)).status,404);
 assert.equal(result.body.counts.posts,1); assert.equal(result.body.counts.accounts,1); assert.equal(result.body.counts.emails,1);
 assert.equal(JSON.stringify(result.body).includes('Contenido reservado'),false); assert.equal(JSON.stringify(result.body).includes('No corresponde'),false);
 assert.match(result.body.limitations.join(' '),/respaldo/i);
 await f.request('/api/privacy/request','POST',{action:'cancel'},person.cookie);
 assert.equal((await f.request(path,'GET',undefined,operator.cookie)).status,404);
});
test('inventario detecta referencias del identificador en estados y evidencias sin revelar su contenido',async t=>{
 const f=await fixture(t,{plazaEnabled:true}); const person=await f.signup('embedded_person'), operator=await f.signup('embedded_operator');
 await f.request('/api/privacy/request','POST',{action:'submit'},person.cookie);
 const db=new DatabaseSync(f.path);
 try { db.prepare('INSERT INTO privacy_operators(user_id) VALUES(?)').run(operator.id); db.prepare('INSERT INTO rooms(id,activity_id,session_json,revision,idle_at) VALUES(?,?,?,?,?)').run('embedded-room','cafe',JSON.stringify({person:person.id,private:'contenido secreto'}),1,0); } finally {db.close();}
 const result=await f.request(`/api/privacy/inventory/${person.id}`,'GET',undefined,operator.cookie);
 assert.equal(result.status,200); assert.equal(result.body.counts.roomsWithEmbeddedId,1); assert.equal(JSON.stringify(result.body).includes('contenido secreto'),false);
});
test('fallo al registrar un evento revierte la solicitud y no deja de responder',async t=>{
 const f=await fixture(t,{plazaEnabled:true}); const user=await f.signup('privacy_rollback');
 const db=new DatabaseSync(f.path); db.exec("CREATE TRIGGER fail_privacy_event BEFORE INSERT ON privacy_request_events BEGIN SELECT RAISE(ABORT,'test failure'); END;"); db.close();
 const result=await f.request('/api/privacy/request','POST',{action:'submit'},user.cookie);
 assert.equal(result.status,503); assert.equal((await f.request('/api/privacy/request','GET',undefined,user.cookie)).body.request,null);
});
test('fallo al registrar un acuse no cambia el estado de la solicitud',async t=>{
 const f=await fixture(t,{plazaEnabled:true}); const user=await f.signup('privacy_ack_person'), operator=await f.signup('privacy_ack_operator');
 const db=new DatabaseSync(f.path); db.prepare('INSERT INTO privacy_operators(user_id) VALUES(?)').run(operator.id); db.exec("CREATE TRIGGER fail_privacy_ack BEFORE INSERT ON privacy_request_events WHEN NEW.action='acknowledge' BEGIN SELECT RAISE(ABORT,'test failure'); END;"); db.close();
 const request=(await f.request('/api/privacy/request','POST',{action:'submit'},user.cookie)).body.request;
 const result=await f.request('/api/privacy/ack','POST',{userId:user.id,version:request.version},operator.cookie);
 assert.equal(result.status,503); const after=(await f.request('/api/privacy/request','GET',undefined,user.cookie)).body.request; assert.equal(after.status,'pending'); assert.equal(after.version,request.version);
});
test('cola de privacidad permite recorrer más de 100 solicitudes sin exponerla a terceros',async t=>{
 const f=await fixture(t,{plazaEnabled:true}); const operator=await f.signup('privacy_pages'); const db=new DatabaseSync(f.path);
 try {db.prepare('INSERT INTO privacy_operators(user_id) VALUES(?)').run(operator.id); const account=db.prepare('INSERT INTO accounts(id,username,alias,password_hash,recovery_hash,created_at) VALUES(?,?,?,?,?,?)'); const request=db.prepare("INSERT INTO privacy_requests(user_id,status,created_at,updated_at,version) VALUES(?,'pending',?,?,1)"); db.exec('BEGIN'); for(let i=0;i<101;i++){const id=`queue-${i}`;account.run(id,id,id,'hash','hash',i); request.run(id,i,i);} db.exec('COMMIT');} finally {db.close();}
 const first=await f.request('/api/privacy/queue?page=1','GET',undefined,operator.cookie), last=await f.request('/api/privacy/queue?page=3','GET',undefined,operator.cookie);
 assert.equal(first.body.requests.length,50); assert.equal(first.body.hasMore,true); assert.equal(last.body.requests.length,1); assert.equal(last.body.hasMore,false);
 assert.equal((await f.request('/api/privacy/queue?page=0','GET',undefined,operator.cookie)).status,422);
});
