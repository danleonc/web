import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { fixture } from './feature-fixture.mjs';

test('imagen privada: solo participantes de la conexión, con acceso revocado al cerrarla', async t => {
 const f=await fixture(t,{plazaEnabled:true}); const a=await f.signup('image_priv_a'), b=await f.signup('image_priv_b'), c=await f.signup('image_priv_c');
 const post=await f.request('/api/plaza/posts','POST',{topic:'crear',title:'Fotos',body:'Hola'},a.cookie);
 const inv=await f.request('/api/plaza/invitations','POST',{kind:'post',contentId:post.body.post.id,note:''},b.cookie); const id=inv.body.invitation.id;
 await f.request(`/api/plaza/invitations/${id}/decision`,'POST',{action:'accept'},a.cookie);
 const msg=await f.request(`/api/plaza/connections/${id}/messages`,'POST',{clientId:'image-test-001',body:'Una imagen'},b.cookie);
 const bytes=await sharp({create:{width:40,height:40,channels:3,background:'#285d4c'}}).png().toBuffer();
 const upload=await f.raw(`/api/plaza/images/private/${msg.body.message.id}`,{method:'POST',headers:{Origin:'http://localhost:4173',Cookie:b.cookie,'Content-Type':'image/png'},body:bytes});
 assert.equal(upload.status,201); const {id:image}=await upload.json();
 assert.equal((await f.raw(`/api/plaza/images/${image}`,{headers:{Cookie:a.cookie}})).status,200);
 assert.equal((await f.raw(`/api/plaza/images/${image}`,{headers:{Cookie:c.cookie}})).status,404);
 await f.request(`/api/plaza/invitations/${id}/decision`,'POST',{action:'withdraw'},a.cookie);
 assert.equal((await f.raw(`/api/plaza/images/${image}`,{headers:{Cookie:b.cookie}})).status,404);
});

test('una imagen reportada conserva evidencia si se elimina la publicación', async t => {
 const f=await fixture(t,{plazaEnabled:true}); const a=await f.signup('image_rep_a'), b=await f.signup('image_rep_b');
 const post=await f.request('/api/plaza/posts','POST',{topic:'crear',title:'Fotos',body:'Una imagen'},a.cookie);
 const bytes=await sharp({create:{width:40,height:40,channels:3,background:'#a46743'}}).png().toBuffer();
 const upload=await f.raw(`/api/plaza/images/post/${post.body.post.id}`,{method:'POST',headers:{Origin:'http://localhost:4173',Cookie:a.cookie,'Content-Type':'image/png'},body:bytes}); assert.equal(upload.status,201);
 const report=await f.request('/api/plaza/reports','POST',{kind:'post',contentId:post.body.post.id,reason:'spam',note:''},b.cookie); assert.equal(report.status,201);
 await f.request(`/api/plaza/posts/${post.body.post.id}`,'DELETE',undefined,a.cookie);
 const { DatabaseSync }=await import('node:sqlite'); const db=new DatabaseSync(f.path,{readOnly:true}); const row=db.prepare('SELECT length(evidence_image) AS size FROM plaza_reports WHERE id=?').get(report.body.id); db.close();
 assert.ok(row.size > 0);
});

test('la imagen de Plaza respeta autoría, bloqueos y validación de archivo', async t => {
 const f=await fixture(t,{plazaEnabled:true}); const a=await f.signup('image_open_a'), b=await f.signup('image_open_b');
 const p=await f.request('/api/plaza/posts','POST',{topic:'crear',title:'Foto',body:'Naturaleza'},a.cookie); const id=p.body.post.id;
 const good=await sharp({create:{width:40,height:40,channels:3,background:'#123456'}}).png().toBuffer();
 const upload=(cookie,body,origin='http://localhost:4173')=>f.raw(`/api/plaza/images/post/${id}`,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'image/png'},body});
 assert.equal((await upload(b.cookie,good)).status,422); assert.equal((await upload(a.cookie,Buffer.from('no es imagen'))).status,422); assert.equal((await upload(a.cookie,good,'https://otro.test')).status,403);
 const result=await upload(a.cookie,good); assert.equal(result.status,201); const image=(await result.json()).id;
 const listing=await f.request('/api/plaza/posts','GET',undefined,b.cookie); assert.equal(listing.body.posts[0].imageId,image);
 assert.equal((await f.raw(`/api/plaza/images/${image}`,{headers:{Cookie:b.cookie}})).status,200);
 await f.request('/api/plaza/blocks','POST',{kind:'post',contentId:id},b.cookie);
 assert.equal((await f.raw(`/api/plaza/images/${image}`,{headers:{Cookie:b.cookie}})).status,404);
});
