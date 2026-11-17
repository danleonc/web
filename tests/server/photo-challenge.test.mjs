import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { fixture } from './feature-fixture.mjs';

test('el desafío requiere acuerdo de ambos y diez vueltas antes de revelar fotos', async t => {
 const f=await fixture(t,{plazaEnabled:true}); const a=await f.signup('challenge_a'),b=await f.signup('challenge_b'),c=await f.signup('challenge_c');
 const png=await sharp({create:{width:40,height:40,channels:3,background:'#285d4c'}}).png().toBuffer();
 for(const p of [a,b]) assert.equal((await f.raw('/api/account/profile/photo',{method:'POST',headers:{Origin:'http://localhost:4173',Cookie:p.cookie,'Content-Type':'image/png','X-Photo-Declaration':'yes'},body:png})).status,201);
 const post=(await f.request('/api/plaza/posts','POST',{topic:'cultura',title:'Conversemos',body:'Hola'},a.cookie)).body.post;
 const invite=(await f.request('/api/plaza/invitations','POST',{kind:'post',contentId:post.id,note:''},b.cookie)).body.invitation;
 await f.request(`/api/plaza/invitations/${invite.id}/decision`,'POST',{action:'accept'},a.cookie);
 const path=`/api/plaza/connections/${invite.id}/photo-challenge`, image=`/api/plaza/connections/${invite.id}/profile-photo/image`;
 assert.equal((await f.request(path,'POST',{action:'join'},c.cookie)).status,404);
 assert.equal((await f.request(path,'POST',{action:'join'},a.cookie)).status,200);
 assert.equal((await f.request(`/api/plaza/connections/${invite.id}/messages`,'POST',{clientId:'challenge-early-message',body:'Antes del acuerdo'},a.cookie)).status,201);
 assert.equal((await f.request(path,'GET',undefined,a.cookie)).body.rounds,0);
 assert.equal((await f.request(`/api/plaza/connections/${invite.id}/profile-photo`,'POST',{action:'share'},a.cookie)).status,403);
 assert.equal((await f.raw(image,{headers:{Cookie:b.cookie}})).status,404);
 assert.equal((await f.request(path,'POST',{action:'join'},b.cookie)).status,200);
 let state=(await f.request(path,'GET',undefined,a.cookie)).body; assert.equal(state.rounds,0); assert.equal(state.ready,true);
 for(let n=0;n<10;n++) {
  for(const [p,side] of [[a,'a'],[b,'b']]) assert.equal((await f.request(`/api/plaza/connections/${invite.id}/messages`,'POST',{clientId:`challenge-${side}-${n}-unique`,body:'Hola'},p.cookie)).status,201);
  state=(await f.request(path,'GET',undefined,a.cookie)).body; assert.equal(state.rounds,n+1);
  if(n===0) { assert.equal((await f.request(`/api/plaza/connections/${invite.id}/messages`,'POST',{clientId:'challenge-a-0-unique',body:'Hola'},a.cookie)).status,201); assert.equal((await f.request(path,'GET',undefined,a.cookie)).body.rounds,1); }
  if(n<9) assert.equal((await f.raw(image,{headers:{Cookie:b.cookie}})).status,404);
 }
 assert.equal(state.unlocked,true); assert.equal((await f.raw(image,{headers:{Cookie:b.cookie}})).status,200);
 assert.equal((await f.raw(image,{headers:{Cookie:c.cookie}})).status,404);
 await f.restart(); assert.equal((await f.request(path,'GET',undefined,b.cookie)).body.unlocked,true);
 assert.equal((await f.raw('/api/account/profile/photo',{method:'POST',headers:{Origin:'http://localhost:4173',Cookie:a.cookie,'Content-Type':'image/png','X-Photo-Declaration':'yes'},body:png})).status,201);
 assert.equal((await f.raw(image,{headers:{Cookie:b.cookie}})).status,404);
 assert.equal((await f.request(path,'GET',undefined,b.cookie)).body.ready,false);
 assert.equal((await f.request(`/api/plaza/connections/${invite.id}/block`,'POST',{},a.cookie)).status,200);
 assert.equal((await f.request(path,'GET',undefined,b.cookie)).status,404);
 assert.equal((await f.raw(image,{headers:{Cookie:b.cookie}})).status,404);
});

test('nuevas conexiones requieren acuerdo explícito de ambos antes de contar', async t => {
 const f=await fixture(t,{plazaEnabled:true,requireConnectionPhoto:true}); const a=await f.signup('challenge_new_a'), b=await f.signup('challenge_new_b');
 const png=await sharp({create:{width:40,height:40,channels:3,background:'#284d3c'}}).png().toBuffer();
 for(const p of [a,b]) assert.equal((await f.raw('/api/account/profile/photo',{method:'POST',headers:{Origin:'http://localhost:4173',Cookie:p.cookie,'Content-Type':'image/png','X-Photo-Declaration':'yes'},body:png})).status,201);
 const post=(await f.request('/api/plaza/posts','POST',{topic:'cultura',title:'Conversemos',body:'Hola'},a.cookie)).body.post;
 const body={kind:'post',contentId:post.id,note:''};
 assert.equal((await f.request('/api/plaza/invitations','POST',body,b.cookie)).status,422);
 const inv=await f.request('/api/plaza/invitations','POST',{...body,photoChallengeAccepted:true},b.cookie); assert.equal(inv.status,201);
 const id=inv.body.invitation.id;
 assert.equal((await f.request(`/api/plaza/invitations/${id}/decision`,'POST',{action:'accept'},a.cookie)).status,422);
 assert.equal((await f.request(`/api/plaza/invitations/${id}/decision`,'POST',{action:'accept',photoChallengeAccepted:true},a.cookie)).status,200);
 const state=(await f.request(`/api/plaza/connections/${id}/photo-challenge`,'GET',undefined,a.cookie)).body; assert.equal(state.ready,true);
});

test('el acuerdo nuevo también se registra al reenviar una solicitud pendiente anterior', async t => {
 const options={plazaEnabled:true,requireConnectionPhoto:false}; const f=await fixture(t,options); const a=await f.signup('challenge_legacy_a'),b=await f.signup('challenge_legacy_b');
 const png=await sharp({create:{width:40,height:40,channels:3,background:'#284d3c'}}).png().toBuffer();
 for(const p of [a,b]) assert.equal((await f.raw('/api/account/profile/photo',{method:'POST',headers:{Origin:'http://localhost:4173',Cookie:p.cookie,'Content-Type':'image/png','X-Photo-Declaration':'yes'},body:png})).status,201);
 const post=(await f.request('/api/plaza/posts','POST',{topic:'cultura',title:'Hola',body:'Hola'},a.cookie)).body.post;
 const body={kind:'post',contentId:post.id,note:''}; const first=(await f.request('/api/plaza/invitations','POST',body,b.cookie)).body.invitation;
 options.requireConnectionPhoto=true; await f.restart();
 const resent=await f.request('/api/plaza/invitations','POST',{...body,photoChallengeAccepted:true},b.cookie); assert.equal(resent.body.invitation.id,first.id);
 assert.equal((await f.request(`/api/plaza/invitations/${first.id}/decision`,'POST',{action:'accept',photoChallengeAccepted:true},a.cookie)).status,200);
 assert.equal((await f.request(`/api/plaza/connections/${first.id}/photo-challenge`,'GET',undefined,a.cookie)).body.ready,true);
});
