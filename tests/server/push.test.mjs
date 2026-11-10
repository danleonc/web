import {test} from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import {fixture} from './feature-fixture.mjs';
import {pushFromEnv, validSubscription, PushDelivery} from '../../server/push.ts';
import {Storage} from '../../server/storage.ts';
import {DatabaseSync} from 'node:sqlite';
const keys=webpush.generateVAPIDKeys();
const config={...keys,subject:'mailto:pilot@example.test'};
const subscription=(suffix='one')=>({endpoint:`https://fcm.googleapis.com/fcm/send/test-${suffix}`,expirationTime:null,keys:{p256dh:keys.publicKey,auth:Buffer.alloc(16,2).toString('base64url')}});
test('push de cancelación persiste, reintenta y solo alcanza dispositivos de inscritos',async t=>{
 const sent=[]; let fail=true; let clock=Date.now();
 const f=await fixture(t,{meetingsEnabled:true,push:{...config,send:async()=>{}}});
 const mod=await f.signup('push_mod'), person=await f.signup('push_person'), other=await f.signup('push_other');
 let db=new DatabaseSync(f.path); db.prepare('INSERT INTO moderators(user_id) VALUES(?)').run(mod.id); db.close();
 await f.request('/api/push/subscribe','POST',{subscription:subscription('person')},person.cookie);
 await f.request('/api/push/subscribe','POST',{subscription:subscription('other')},other.cookie);
 const meeting=await f.request('/api/meetings','POST',{themeId:'cafe',startsAt:f.startsAt+3600_000,capacity:4},mod.cookie); const id=meeting.body.meeting.id;
 await f.request(`/api/reservations/${id}`,'POST',undefined,person.cookie);
 assert.equal((await f.request(`/api/meetings/${id}/cancel`,'POST',{reason:'Motivo privado del encuentro'},mod.cookie)).status,200);
 await f.restart(); clock=Date.now();
 const storage=new Storage(f.path);
 try {
  const delivery=new PushDelivery(storage,{...config,send:async(sub,payload)=>{sent.push({sub,payload});if(fail)throw Object.assign(new Error('unavailable'),{statusCode:503});}},()=>clock);
  await delivery.processQueue(); assert.equal(sent.length,1); assert.equal(sent[0].sub.endpoint,subscription('person').endpoint);
  assert.equal(sent[0].payload.includes('Motivo privado'),false); assert.equal(sent[0].payload.includes('push_person'),false);
  await delivery.processQueue(); assert.equal(sent.length,1);
  fail=false; clock+=120_000; await delivery.processQueue(); assert.equal(sent.length,2);
  await delivery.processQueue(); assert.equal(sent.length,2);
 } finally {storage.close();}
});
test('push de cancelación respeta la baja previa del dispositivo',async t=>{
 const sent=[]; const f=await fixture(t,{meetingsEnabled:true,push:{...config,send:async()=>{}}});
 const mod=await f.signup('unsub_mod'), person=await f.signup('unsub_person');
 const db=new DatabaseSync(f.path); db.prepare('INSERT INTO moderators(user_id) VALUES(?)').run(mod.id); db.close();
 await f.request('/api/push/subscribe','POST',{subscription:subscription('unsub')},person.cookie);
 const meeting=await f.request('/api/meetings','POST',{themeId:'cafe',startsAt:f.startsAt+3600_000,capacity:4},mod.cookie); const id=meeting.body.meeting.id;
 await f.request(`/api/reservations/${id}`,'POST',undefined,person.cookie);
 await f.request(`/api/meetings/${id}/cancel`,'POST',{reason:'Cambio de programa'},mod.cookie);
 await f.request('/api/push/unsubscribe','POST',{endpoint:subscription('unsub').endpoint},person.cookie);
 const storage=new Storage(f.path); try { await new PushDelivery(storage,{...config,send:async()=>sent.push(1)},Date.now).processQueue(); assert.deepEqual(sent,[]); assert.equal(storage.db.prepare('SELECT count(*) AS n FROM push_queue').get().n,0); } finally {storage.close();}
});
test('el servidor procesa automáticamente el aviso de una cancelación',async t=>{
 const sent=[]; const f=await fixture(t,{meetingsEnabled:true,push:{...config,send:async(sub,payload)=>sent.push({sub,payload})}});
 const mod=await f.signup('auto_mod'), person=await f.signup('auto_person');
 const db=new DatabaseSync(f.path); db.prepare('INSERT INTO moderators(user_id) VALUES(?)').run(mod.id); db.close();
 await f.request('/api/push/subscribe','POST',{subscription:subscription('auto')},person.cookie);
 const meeting=await f.request('/api/meetings','POST',{themeId:'cafe',startsAt:f.startsAt+3600_000,capacity:4},mod.cookie); const id=meeting.body.meeting.id;
 await f.request(`/api/reservations/${id}`,'POST',undefined,person.cookie);
 await f.request(`/api/meetings/${id}/cancel`,'POST',{reason:'Cambio de programa'},mod.cookie);
 const deadline=Date.now()+19000; while(!sent.length && Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,100));
 assert.equal(sent.length,1); assert.equal(sent[0].sub.endpoint,subscription('auto').endpoint);
});
test('push: configuración ausente/partial, claves emparejadas y destinos permitidos',()=>{
 assert.equal(pushFromEnv({}),undefined);assert.throws(()=>pushFromEnv({ENTRE_VAPID_PUBLIC_KEY:keys.publicKey}));
 assert.equal(pushFromEnv({ENTRE_VAPID_PUBLIC_KEY:keys.publicKey,ENTRE_VAPID_PRIVATE_KEY:keys.privateKey,ENTRE_VAPID_SUBJECT:config.subject}).publicKey,keys.publicKey);
 assert.throws(()=>pushFromEnv({ENTRE_VAPID_PUBLIC_KEY:keys.publicKey,ENTRE_VAPID_PRIVATE_KEY:webpush.generateVAPIDKeys().privateKey,ENTRE_VAPID_SUBJECT:config.subject}));
 assert.ok(validSubscription(subscription()));
 for(const endpoint of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.test/x','https://user:pass@fcm.googleapis.com/x','https://web.push.apple.com:444/x','https://example.test/x'])assert.equal(validSubscription({...subscription(),endpoint}),null);
 assert.equal(validSubscription({...subscription(),keys:{p256dh:'x',auth:'x'}}),null);
});
test('push: sin configurar no ofrece activación ni acepta suscripciones',async t=>{
 const f=await fixture(t);assert.deepEqual((await f.request('/api/push/options')).body,{available:false});
 const u=await f.signup();assert.equal((await f.request('/api/push/subscribe','POST',{subscription:subscription()},u.cookie)).status,503);
});
test('push: origen, sesión/correo, límites de campos, aislamiento y prueba al dispositivo propio',async t=>{
 const sent=[];const f=await fixture(t,{push:{...config,send:async(sub,payload)=>{sent.push({sub,payload});}}});
 const pub=await f.request('/api/push/options');assert.equal(pub.body.publicKey,keys.publicKey);assert.equal('privateKey' in pub.body,false);
 assert.equal((await f.request('/api/push/subscribe','POST',{subscription:subscription()})).status,401);
 const pending=await f.request('/api/auth/register','POST',{username:'push_pending',alias:'Pendiente',adult:true,password:'Una frase larga para pruebas 123'});
 assert.equal((await f.request('/api/push/subscribe','POST',{subscription:subscription()},pending.cookie)).status,403);
 const a=await f.signup('push_a'),b=await f.signup('push_b');
 assert.equal((await f.request('/api/push/subscribe','POST',{subscription:subscription()},a.cookie,'https://evil.test')).status,403);
 assert.equal((await f.request('/api/push/subscribe','POST',{subscription:{...subscription(),endpoint:'https://127.0.0.1/x'}},a.cookie)).status,422);
 assert.equal((await f.request('/api/push/subscribe','POST',{subscription:subscription(),userId:b.id},a.cookie)).status,422);
 assert.equal((await f.request('/api/push/subscribe','POST',{subscription:subscription()},a.cookie)).status,200);
 assert.equal((await f.request('/api/push/status','POST',{endpoint:subscription().endpoint},b.cookie)).body.enabled,false);
 assert.equal((await f.request('/api/push/subscribe','POST',{subscription:subscription()},b.cookie)).status,409);
 assert.equal((await f.request('/api/push/test','POST',{endpoint:subscription().endpoint},b.cookie)).status,404);assert.equal(sent.length,0);
 assert.equal((await f.request('/api/push/test','POST',{endpoint:subscription().endpoint,title:'Arbitrario'},a.cookie)).status,422);
 assert.equal((await f.request('/api/push/test','POST',{endpoint:subscription().endpoint},a.cookie)).status,200);
 assert.equal(sent.length,1);assert.equal(sent[0].payload.includes('push_a'),false);assert.match(sent[0].payload,/prueba/i);
 await f.request('/api/push/unsubscribe','POST',{endpoint:subscription().endpoint},b.cookie);
 assert.equal((await f.request('/api/push/status','POST',{endpoint:subscription().endpoint},a.cookie)).body.enabled,true);
 await f.restart();assert.equal((await f.request('/api/push/status','POST',{endpoint:subscription().endpoint},a.cookie)).body.enabled,true);
 await f.request('/api/auth/logout','POST',{},a.cookie);
 assert.equal((await f.request('/api/push/test','POST',{endpoint:subscription().endpoint},a.cookie)).status,401);
 const relog=await f.request('/api/auth/login','POST',{username:a.username,password:'Una frase larga para pruebas 123'});
 assert.equal((await f.request('/api/push/status','POST',{endpoint:subscription().endpoint},relog.cookie)).body.enabled,false);
});
test('push: baja propia, suscripción caducada, error de entrega y límite de pruebas',async t=>{
 let mode='ok';const f=await fixture(t,{push:{...config,send:async()=>{if(mode!=='ok')throw Object.assign(new Error('private provider detail'),{statusCode:mode==='gone'?410:500});}}});const u=await f.signup();
 const req=(path,body)=>f.request('/api/push/'+path,'POST',body,u.cookie);
 await req('subscribe',{subscription:subscription()});await req('unsubscribe',{endpoint:subscription().endpoint});assert.equal((await req('status',{endpoint:subscription().endpoint})).body.enabled,false);
 await req('subscribe',{subscription:subscription()});mode='gone';assert.equal((await req('test',{endpoint:subscription().endpoint})).status,410);assert.equal((await req('status',{endpoint:subscription().endpoint})).body.enabled,false);
 await req('subscribe',{subscription:subscription('two')});mode='fail';const failed=await req('test',{endpoint:subscription('two').endpoint});assert.equal(failed.status,503);assert.equal(JSON.stringify(failed.body).includes('private provider'),false);
 mode='ok';for(let i=0;i<3;i++)await req('test',{endpoint:subscription('two').endpoint});assert.equal((await req('test',{endpoint:subscription('two').endpoint})).status,429);
});
