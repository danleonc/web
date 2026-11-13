import test from 'node:test'; import assert from 'node:assert/strict'; import { fixture } from './feature-fixture.mjs';
test('Conexiones permite citar un mensaje visible solo dentro de la misma conversación',async t=>{
 const f=await fixture(t,{plazaEnabled:true});const a=await f.signup('priv_quote_a'),b=await f.signup('priv_quote_b'),c=await f.signup('priv_quote_c');
 const p=await f.request('/api/plaza/posts','POST',{topic:'crear',title:'Conectar',body:'Hola'},a.cookie);
 const inv=await f.request('/api/plaza/invitations','POST',{kind:'post',contentId:p.body.post.id,note:''},b.cookie);const id=inv.body.invitation.id;
 await f.request(`/api/plaza/invitations/${id}/decision`,'POST',{action:'accept'},a.cookie);
 const first=await f.request(`/api/plaza/connections/${id}/messages`,'POST',{clientId:'quoted-00001',body:'Mensaje original'},b.cookie);const target=first.body.message.id;
 const sent=await f.request(`/api/plaza/connections/${id}/messages`,'POST',{clientId:'quoted-00002',body:'Respuesta',replyTo:target},a.cookie);assert.equal(sent.status,201);
 await f.restart(); const list=await f.request(`/api/plaza/connections/${id}/messages`,'GET',undefined,b.cookie);assert.equal(list.body.messages.find(x=>x.id===sent.body.message.id).replyTo,target);
 const sticker=await f.request(`/api/plaza/connections/${id}/messages`,'POST',{clientId:'quoted-00004',body:'',stickerId:'moka-1',replyTo:target},a.cookie);assert.equal(sticker.status,201);
 const image=await f.request(`/api/plaza/connections/${id}/messages`,'POST',{clientId:'quoted-00005',body:'Imagen compartida',replyTo:target},a.cookie);assert.equal(image.status,201);
 const types=await f.request(`/api/plaza/connections/${id}/messages`,'GET',undefined,b.cookie);assert.equal(types.body.messages.find(x=>x.id===sticker.body.message.id).replyTo,target);assert.equal(types.body.messages.find(x=>x.id===image.body.message.id).replyTo,target);
 assert.equal((await f.request(`/api/plaza/connections/${id}/messages`,'GET',undefined,c.cookie)).status,404);
 await f.request(`/api/plaza/connections/${id}/messages/${target}`,'DELETE',undefined,b.cookie);
 const after=await f.request(`/api/plaza/connections/${id}/messages`,'GET',undefined,a.cookie);assert.equal(after.body.messages.find(x=>x.id===sent.body.message.id).replyTo,null);
 assert.equal((await f.request(`/api/plaza/connections/${id}/messages`,'POST',{clientId:'quoted-00003',body:'Fallará',replyTo:target},a.cookie)).status,422);
});
