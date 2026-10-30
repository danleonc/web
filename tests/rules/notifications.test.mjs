import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyNotifications, trackParticipation, toggleThread, receiveReply, visibleNotices, markThreadRead, loadNotificationScopes } from '../../src/notifications/model.ts';
const post={id:'p',topic:'cultura',title:'Mi publicación',body:'Texto',author:'Luz',personId:'self',own:true,tags:[]};
const reply={id:'r',postId:'p',author:'Ana',personId:'ana',own:false,body:'Respuesta'};
const plaza={posts:[post],comments:[],hidden:[],saved:[],invitations:[]};
const ctx=(extra={})=>({posts:[post],comments:[reply],hidden:[],blocked:[],...extra});
test('publicar/responder sigue el hilo sin activar avisos propios o históricos',()=>{
 const followed=trackParticipation(emptyNotifications,{...plaza,posts:[]},plaza,ctx());
 assert.deepEqual(followed.following,['p']);assert.deepEqual(followed.items,[]);
 const own={...reply,own:true};
 assert.deepEqual(receiveReply(followed,{commentId:'r',postId:'p',createdAt:1000,example:false},ctx({comments:[own]})).items,[]);
 const commented=trackParticipation(emptyNotifications,{...plaza,posts:[]},{...plaza,posts:[],comments:[own]},ctx());
 assert.deepEqual(commented.following,['p']);assert.deepEqual(commented.items,[]);
});
test('avisar una vez, leer el hilo, silenciar persiste al responder y reactivar no recupera avisos omitidos',()=>{
 let s=toggleThread(emptyNotifications,'p',ctx());
 const event={commentId:'r',postId:'p',createdAt:1000,example:false};
 s=receiveReply(s,event,ctx());assert.equal(s.items.length,1);assert.equal(s.items[0].read,false);
 assert.equal(receiveReply(s,event,ctx()).items.length,1);
 s=markThreadRead(s,'p');assert.equal(s.items[0].read,true);
 s=toggleThread(s,'p',ctx());assert.deepEqual(s.muted,['p']);
 const r2={...reply,id:'r2',body:'Otra'};
 assert.equal(receiveReply(s,{...event,commentId:'r2'},ctx({comments:[reply,r2]})).items.length,1);
 s=trackParticipation(s,plaza,{...plaza,comments:[{...r2,own:true}]},ctx());assert.deepEqual(s.muted,['p']);
 s=toggleThread(s,'p',ctx());assert.deepEqual(s.muted,[]);assert.equal(s.items.length,1);
});
test('bloqueos, ocultos, borrado y referencias cruzadas nunca muestran avisos o sus textos',()=>{
 let s=toggleThread(emptyNotifications,'p',ctx());s=receiveReply(s,{postId:'p',commentId:'r',createdAt:1000,example:true},ctx());
 assert.equal(visibleNotices(s,ctx()).length,1);
 for(const context of [ctx({blocked:['plaza:Ana']}),ctx({hidden:['p']}),ctx({posts:[]}),ctx({comments:[]}),ctx({comments:[{...reply,postId:'otro'}]})])assert.equal(visibleNotices(s,context).length,0);
 assert.deepEqual(receiveReply(emptyNotifications,{postId:'p',commentId:'r',createdAt:1000,example:false},ctx()).items,[]);
});
test('carga aislada por cuenta, límites y corrupción sin aceptar texto/campos/URL arbitrarios',()=>{
 const a=receiveReply(toggleThread(emptyNotifications,'p',ctx()),{postId:'p',commentId:'r',createdAt:1000,example:true},ctx());
 const loaded=loadNotificationScopes({'account:uno':a,'account:dos':emptyNotifications,prototype:{following:['p','p'],muted:['otro'],items:[{...a.items[0],body:'Secreto',url:'https://evil.test'}]},evil:a});
 assert.equal(loaded['account:uno'].items.length,1);assert.equal(loaded['account:dos'].items.length,0);
 assert.equal(loaded.evil,undefined);assert.deepEqual(loaded.prototype.following,['p']);assert.deepEqual(loaded.prototype.muted,[]);
 assert.equal('body' in loaded.prototype.items[0],false);assert.equal('url' in loaded.prototype.items[0],false);
 assert.deepEqual(loadNotificationScopes(null),{});
});
