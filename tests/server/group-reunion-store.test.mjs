import test from 'node:test';
import assert from 'node:assert/strict';
import { Storage } from '../../server/storage.ts';
import { GroupReunionStore, installGroupReunionSchema } from '../../server/group-reunion-store.ts';
import { Notifications } from '../../server/notifications.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function setup(path=':memory:') {
  const storage=new Storage(path);
  for (const id of ['a','b','c','d']) {
    storage.createAccount({id,username:id,alias:id,passwordHash:'x',recoveryHash:'x'},1);
    storage.db.prepare('INSERT INTO account_emails(user_id,email,verified_at,adult_declared_at) VALUES(?,?,?,?)').run(id,`${id}@example.test`,1,1);
  }
  storage.offering('cafe',1000);
  storage.db.prepare('INSERT INTO rooms(id,activity_id,session_json,revision,idle_at,archived_at) VALUES(?,?,?,?,?,?)').run('room','cafe',JSON.stringify({phase:'closed',sessionUntil:10}),1,1,1);
  for (const id of ['a','b','c']) storage.db.prepare('INSERT INTO memberships VALUES(?,?)').run('room',id);
  installGroupReunionSchema(storage.db);
  return {storage, store:new GroupReunionStore(storage,()=>10000)};
}

test('persistencia exige aceptación unánime y aísla personas ajenas',()=>{
 const {storage,store}=setup(); try {
  assert.throws(()=>store.create('a','room',['b','d'],1000000));
  const id=store.create('a','room',['b','c'],1000000);
  assert.equal(store.get(id,'d'),null);
  assert.throws(()=>store.decide(id,'d','accept'));
  assert.equal(store.decide(id,'b','accept').status,'pending');
  assert.equal(store.decide(id,'c','accept').status,'confirmed');
  assert.equal(storage.privateMeetingAccess(id,'a'),true);
  assert.equal(storage.privateMeetingAccess(id,'d'),false);
  assert.equal(storage.countReservations(id),3);
  assert.equal(store.get(id,'a').status,'confirmed');
  assert.throws(()=>store.decide(id,'c','accept'));
  assert.equal(store.decide(id,'b','withdraw').status,'cancelled');
  assert.notEqual(storage.db.prepare('SELECT cancelled_at FROM scheduled_meetings WHERE id=?').get(id).cancelled_at,null);
 } finally {storage.close();}
});

test('las respuestas sobreviven al cierre y reapertura de SQLite',()=>{
 const dir=mkdtempSync(join(tmpdir(),'nexafia-reunion-')); const path=join(dir,'test.sqlite');
 try {
  const {storage,store}=setup(path); const id=store.create('a','room',['b','c'],1000000);
  store.decide(id,'b','accept'); storage.close();
  const reopened=new Storage(path); try {
   const next=new GroupReunionStore(reopened,()=>10000);
   assert.equal(next.get(id,'c').responses.b,'accepted');
   assert.equal(next.decide(id,'c','accept').status,'confirmed');
  } finally {reopened.close();}
 } finally {rmSync(dir,{recursive:true,force:true});}
});

test('bloquear o retirar historial cancela solicitudes sin reactivarlas al revertir',()=>{
 const {storage,store}=setup(); try {
  const id=store.create('a','room',['b','c'],1000000);
  storage.block('a','b');
  const cancellation=new Notifications(storage,()=>10000).list('c').items.find(n=>n.kind==='group_cancelled');
  assert.equal(cancellation.actor,'c');
  storage.unblock('a','b');
  assert.equal(store.get(id,'a').status,'cancelled');
  assert.throws(()=>store.decide(id,'b','accept'));
  const second=store.create('a','room',['b','c'],1000000);
  assert.equal(storage.dismissHistory('c','room',10000),'ok');
  storage.db.prepare('DELETE FROM room_history_dismissals WHERE room_id=? AND user_id=?').run('room','c');
  assert.equal(store.get(second,'a').status,'cancelled');
 } finally {storage.close();}
});

test('no se confirma si otra persona queda restringida o dejó el historial',()=>{
 const {storage,store}=setup(); try {
  const first=store.create('a','room',['b','c'],1000000);
  storage.db.prepare("INSERT INTO restrictions(user_id,kind,reason,until_at,action_id) VALUES(?, 'ban', '', NULL, 'action')").run('c');
  assert.throws(()=>store.decide(first,'b','accept'));
  assert.equal(store.decide(first,'a','cancel').status,'cancelled');
  storage.db.prepare('DELETE FROM restrictions WHERE user_id=?').run('c');
  const second=store.create('a','room',['b','c'],1000000);
  storage.db.prepare('INSERT INTO room_history_dismissals(user_id,room_id,created_at) VALUES(?,?,?)').run('c','room',1);
  assert.throws(()=>store.decide(second,'b','accept'));
 } finally {storage.close();}
});

test('una persona bloqueada no puede consultar la lista del grupo',()=>{
 const {storage,store}=setup(); try {
  const id=store.create('a','room',['b','c'],1000000);
  storage.block('a','b');
  assert.equal(store.get(id,'a'),null);
  assert.equal(store.get(id,'b'),null);
 } finally {storage.close();}
});

test('la retirada del historial impide consultar la propuesta',()=>{
 const {storage,store}=setup(); try {
  const id=store.create('a','room',['b','c'],1000000);
  assert.equal(storage.dismissHistory('b','room',10000),'ok');
  assert.equal(store.get(id,'b'),null);
  assert.equal(new Notifications(storage,()=>10000).list('b').items.some(n=>n.targetId===id),false);
  assert.equal(store.get(id,'a').status,'cancelled');
 } finally {storage.close();}
});

test('la autorización privada sobrevive a la eliminación del encuentro original',()=>{
 const {storage}=setup(); try {
  storage.offering('private',1000000);
  storage.db.prepare('INSERT INTO scheduled_meetings(id,theme_id,capacity,duration,created_at,created_by) VALUES(?,?,?,?,?,?)').run('private','cafe',3,40,1,'a');
  storage.db.prepare('INSERT INTO private_meetings(meeting_id) VALUES(?)').run('private');
  for(const person of ['a','b','c']) storage.db.prepare('INSERT INTO private_meeting_members(meeting_id,user_id) VALUES(?,?)').run('private',person);
  storage.db.prepare('DELETE FROM rooms WHERE id=?').run('room');
  assert.equal(storage.privateMeetingAccess('private','a'),true);
  assert.equal(storage.privateMeetingAccess('private','d'),false);
  assert.equal(storage.privateMeetingAccess('unknown','d'),null);
 } finally {storage.close();}
});

test('al caducar el historial se cancela la propuesta pendiente y queda un aviso privado temporal',()=>{
 const {storage,store}=setup(); try {
  const id=store.create('a','room',['b','c'],1000000);
  const expiry=30*24*60*60_000+2;
  storage.prune(expiry);
  assert.equal(store.get(id,'a'),null);
  const notices=new Notifications(storage,()=>expiry);
  assert.equal(notices.list('a').items.some(n=>n.targetId===id&&n.kind==='group_expired'),true);
  assert.equal(notices.list('b').items.some(n=>n.targetId===id&&n.kind==='group_expired'),true);
  assert.equal(notices.list('d').items.some(n=>n.targetId===id),false);
  storage.prune(expiry+30*24*60*60_000+1);
  assert.equal(notices.list('a').items.some(n=>n.targetId===id),false);
 } finally {storage.close();}
});

test('un bloqueo posterior cancela el encuentro aunque el origen haya caducado',()=>{
 const {storage,store}=setup(); try {
  const id=store.create('a','room',['b','c'],1000000);
  store.decide(id,'b','accept');store.decide(id,'c','accept');
  storage.db.prepare('DELETE FROM rooms WHERE id=?').run('room');
  storage.block('a','b',10000);storage.unblock('a','b');
  assert.equal(storage.db.prepare('SELECT cancelled_at FROM scheduled_meetings WHERE id=?').get(id).cancelled_at,10000);
  assert.equal(storage.privateMeetingAccess(id,'d'),false);
 } finally {storage.close();}
});

test('un conflicto de agenda impide confirmar y no crea reservas parciales',()=>{
 const {storage,store}=setup(); try {
  const id=store.create('a','room',['b','c'],1000000);
  storage.offering('overlap',1000000);
  storage.db.prepare('INSERT INTO reservations VALUES(?,?,?)').run('c','overlap',1);
  store.decide(id,'b','accept');
  assert.throws(()=>store.decide(id,'c','accept'),/reservation_conflict/);
  assert.equal(store.get(id,'a').status,'pending');
  assert.equal(store.get(id,'a').responses.c,'pending');
  assert.equal(storage.db.prepare('SELECT count(*) AS n FROM reservations WHERE activity_id=?').get(id).n,0);
  assert.equal(storage.privateMeetingAccess(id,'a'),null);
 } finally {storage.close();}
});

test('una persona puede retirar su consentimiento después de la hora de inicio',()=>{
 const {storage,store}=setup(); try {
  const id=store.create('a','room',['b','c'],1000000);
  store.decide(id,'b','accept');store.decide(id,'c','accept');
  const later=new GroupReunionStore(storage,()=>1000001);
  assert.equal(later.decide(id,'b','withdraw').status,'cancelled');
  assert.equal(storage.db.prepare('SELECT cancelled_at FROM scheduled_meetings WHERE id=?').get(id).cancelled_at,1000001);
 } finally {storage.close();}
});

test('una propuesta pendiente caduca antes de la hora y no afecta encuentros confirmados',()=>{
 const {storage,store}=setup(); try {
  const pending=store.create('a','room',['b','c'],1000000);
  storage.prune(700000);
  assert.equal(store.get(pending,'a').status,'cancelled');
  assert.equal(new Notifications(storage,()=>700000).list('b').items.some(n=>n.targetId===pending&&n.kind==='group_expired'),true);
  assert.throws(()=>store.decide(pending,'b','accept'));
 } finally {storage.close();}
});

test('un encuentro confirmado permanece privado cuando se elimina la sala de origen',()=>{
 const {storage,store}=setup(); try {
  const id=store.create('a','room',['b','c'],1000000);
  store.decide(id,'b','accept');store.decide(id,'c','accept');
  storage.prune(30*24*60*60_000+2);
  assert.equal(storage.privateMeetingAccess(id,'a'),true);
  assert.equal(storage.privateMeetingAccess(id,'d'),false);
  assert.equal(storage.db.prepare('SELECT cancelled_at FROM scheduled_meetings WHERE id=?').get(id).cancelled_at,null);
  assert.equal(new Notifications(storage,()=>1).list('a').items.some(n=>n.targetId===id&&n.kind==='group_expired'),false);
 } finally {storage.close();}
});

test('el aviso de caducidad no se muestra a quien retiro el historial',()=>{
 const {storage,store}=setup(); try {
  const id=store.create('a','room',['b','c'],1000000);
  storage.prune(700000);
  assert.equal(new Notifications(storage,()=>700000).list('b').items.some(n=>n.targetId===id&&n.kind==='group_expired'),true);
  storage.dismissHistory('b','room',700001);
  assert.equal(new Notifications(storage,()=>700001).list('b').items.some(n=>n.targetId===id),false);
  storage.prune(30*24*60*60_000+2);
  assert.equal(new Notifications(storage,()=>700001).list('b').items.some(n=>n.targetId===id),false);
 } finally {storage.close();}
});

test('retirar el historial de un encuentro confirmado no vuelve a mostrar avisos propios',()=>{
 const {storage,store}=setup();try {
  const id=store.create('a','room',['b','c'],1000000);
  store.decide(id,'b','accept');store.decide(id,'c','accept');
  assert.equal(storage.dismissHistory('b','room',10000),'ok');
  assert.equal(new Notifications(storage,()=>10000).list('b').items.some(n=>n.targetId===id),false);
  assert.equal(new Notifications(storage,()=>10000).list('a').items.some(n=>n.targetId===id&&n.kind==='group_cancelled'),true);
  storage.prune(30*24*60*60_000+2);
  storage.cancel('a',id,30*24*60*60_000+3);
  assert.equal(new Notifications(storage,()=>10000).list('b').items.some(n=>n.targetId===id),false);
 }finally{storage.close();}
});

test('recordatorio privado conserva permisos tras caducar la sala original',()=>{
 const {storage,store}=setup();try {
  const id=store.create('a','room',['b','c'],1000000);store.decide(id,'b','accept');store.decide(id,'c','accept');
  storage.db.prepare('DELETE FROM rooms WHERE id=?').run('room');
  const early=new Notifications(storage,()=>10000);assert.equal(early.setReunionReminder('a',id,15),'ok');assert.equal(early.setReunionReminder('d',id,15),'not_found');
  early.readAll('a');assert.equal(early.list('a').items.some(n=>n.kind==='meeting_reminder'),false);
  const due=new Notifications(storage,()=>100001);assert.equal(due.list('a').items.some(n=>n.kind==='meeting_reminder'&&n.readAt===null),true);
  storage.block('a','b',100002);assert.equal(due.list('a').items.some(n=>n.kind==='meeting_reminder'),false);
  storage.prune(100003);assert.equal(storage.db.prepare("SELECT count(*) AS n FROM notifications WHERE kind='meeting_reminder' AND target_id=?").get(id).n,0);
 }finally{storage.close();}
});
