import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './feature-fixture.mjs';
import { DatabaseSync } from 'node:sqlite';

test('una cita visible conserva contexto aunque el original esté en otra página', async t=>{
 const f=await fixture(t,{plazaEnabled:true}); const a=await f.signup('quote_page_a'), b=await f.signup('quote_page_b');
 const post=(await f.request('/api/plaza/posts','POST',{topic:'cultura',title:'Historia',body:'Hola'},a.cookie)).body.post;
 const original=(await f.request(`/api/plaza/posts/${post.id}/replies`,'POST',{body:'Mensaje original'},b.cookie)).body.reply;
 const db=new DatabaseSync(f.path); const add=db.prepare('INSERT INTO plaza_replies(id,post_id,author_id,body,created_at) VALUES(?,?,?,?,?)');
 db.prepare('UPDATE plaza_replies SET created_at=1 WHERE id=?').run(original.id);
 for(let n=0;n<55;n++) add.run(`50000000-0000-4000-8000-${String(n).padStart(12,'0')}`,post.id,a.id,'Relleno',2+n); db.close();
 const answer=(await f.request(`/api/plaza/posts/${post.id}/replies`,'POST',{body:'Respuesta',replyTo:original.id},a.cookie)).body.reply;
 const latest=(await f.request(`/api/plaza/posts/${post.id}/replies?page=1`,'GET',undefined,a.cookie)).body.replies;
 assert.equal(latest.some(x=>x.id===original.id),false); assert.equal(latest.find(x=>x.id===answer.id).quote.summary,'Mensaje original');
 await f.request('/api/plaza/blocks','POST',{kind:'reply',contentId:original.id},a.cookie);
 const after=(await f.request(`/api/plaza/posts/${post.id}/replies?page=1`,'GET',undefined,a.cookie)).body.replies.find(x=>x.id===answer.id);
 assert.equal(after.replyTo,null); assert.equal(after.quote,null);
});

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
