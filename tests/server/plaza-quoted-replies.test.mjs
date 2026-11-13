import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './feature-fixture.mjs';

test('responder a un comentario conserva referencia y rechaza citas ajenas o bloqueadas', async t=>{
 const f=await fixture(t,{plazaEnabled:true});const a=await f.signup('cita_ana'), b=await f.signup('cita_bea'), c=await f.signup('cita_caro');
 const p=await f.request('/api/plaza/posts','POST',{topic:'cultura',title:'Café',body:'Hola'},a.cookie);
 const q=await f.request('/api/plaza/posts','POST',{topic:'crear',title:'Otro',body:'Hola'},c.cookie);
 const original=await f.request(`/api/plaza/posts/${p.body.post.id}/replies`,'POST',{body:'Me gusta leer'},b.cookie);
 const id=original.body.reply.id;
 const answer=await f.request(`/api/plaza/posts/${p.body.post.id}/replies`,'POST',{body:'A mí también',replyTo:id},a.cookie);
 assert.equal(answer.status,201);
 const cross=await f.request(`/api/plaza/posts/${q.body.post.id}/replies`,'POST',{body:'No corresponde',replyTo:id},a.cookie);assert.equal(cross.status,422);
 await f.restart(); let list=await f.request(`/api/plaza/posts/${p.body.post.id}/replies`,'GET',undefined,a.cookie);
 assert.equal(list.body.replies.find(x=>x.id===answer.body.reply.id).replyTo,id);
 await f.request('/api/plaza/blocks','POST',{kind:'reply',contentId:id},a.cookie);
 list=await f.request(`/api/plaza/posts/${p.body.post.id}/replies`,'GET',undefined,a.cookie);
 assert.equal(list.body.replies.find(x=>x.id===answer.body.reply.id).replyTo,null);
 assert.equal((await f.request(`/api/plaza/posts/${p.body.post.id}/replies`,'POST',{body:'No visible',replyTo:id},a.cookie)).status,422);
});
