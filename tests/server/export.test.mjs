import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './feature-fixture.mjs';
import {DatabaseSync} from 'node:sqlite';

test('descarga de contenido propio exige sesión y no expone datos de otras cuentas ni credenciales',async t=>{
 const f=await fixture(t,{plazaEnabled:true}); const ana=await f.signup('export_ana'), bea=await f.signup('export_bea');
 await f.request('/api/plaza/posts','POST',{topic:'crear',title:'Publicación de Ana',body:'Contenido propio de Ana'},ana.cookie);
 await f.request('/api/plaza/posts','POST',{topic:'crear',title:'Publicación de Bea',body:'Contenido privado de Bea'},bea.cookie);
 assert.equal((await f.request('/api/account/export','GET')).status,401);
 const result=await f.request('/api/account/export','GET',undefined,ana.cookie);
 assert.equal(result.status,200); assert.equal(result.body.account.username,'export_ana');
 assert.equal(result.body.posts.items[0].title,'Publicación de Ana');
 assert.equal(result.body.posts.truncated,false);
 assert.equal(JSON.stringify(result.body).includes('Contenido privado de Bea'),false);
 for(const secret of ['password_hash','recovery_hash','code_hash','token_hash','subscription_json']) assert.equal(JSON.stringify(result.body).includes(secret),false);
 assert.equal(result.header,null);
 const raw=await f.raw('/api/account/export',{headers:{Cookie:ana.cookie}});
 assert.match(raw.headers.get('cache-control'),/no-store/);
 assert.match(raw.headers.get('content-disposition'),/attachment/);
});
test('descarga identifica cada sección truncada al superar mil registros',async t=>{
 const f=await fixture(t,{plazaEnabled:true}); const user=await f.signup('export_limit');
 const db=new DatabaseSync(f.path); try { const insert=db.prepare('INSERT INTO plaza_posts(id,author_id,topic,title,body,created_at) VALUES(?,?,?,?,?,?)'); db.exec('BEGIN'); for(let i=0;i<1001;i++)insert.run(`post-${i}`,user.id,'crear',`Título ${i}`,'Texto',i); db.exec('COMMIT'); } finally {db.close();}
 const result=await f.request('/api/account/export','GET',undefined,user.cookie);
 assert.equal(result.body.posts.items.length,1000); assert.equal(result.body.posts.truncated,true); assert.equal(result.body.replies.truncated,false);
 const next=await f.request('/api/account/export?page=2','GET',undefined,user.cookie);
 assert.equal(next.status,200); assert.equal(next.body.page,2); assert.equal(next.body.posts.items.length,1); assert.equal(next.body.posts.truncated,false);
 assert.equal((await f.request('/api/account/export?page=0','GET',undefined,user.cookie)).status,422);
 assert.equal((await f.request('/api/account/export?page=2x','GET',undefined,user.cookie)).status,422);
});
test('descarga incluye solicitudes, bloqueos y reportes propios sin incluir reportes ajenos',async t=>{
 const f=await fixture(t,{plazaEnabled:true}); const ana=await f.signup('action_ana'), bea=await f.signup('action_bea');
 const post=(await f.request('/api/plaza/posts','POST',{topic:'crear',title:'Tema',body:'Texto'},bea.cookie)).body.post;
 const invitation=(await f.request('/api/plaza/invitations','POST',{kind:'post',contentId:post.id,note:'Mi invitación'},ana.cookie)).body.invitation;
 await f.request('/api/plaza/reports','POST',{kind:'post',contentId:post.id,reason:'spam',note:'Mi observación'},ana.cookie);
 const own=(await f.request('/api/account/export','GET',undefined,ana.cookie)).body;
 const other=(await f.request('/api/account/export','GET',undefined,bea.cookie)).body;
 assert.equal(own.invitations.items[0].id,invitation.id); assert.equal(own.invitations.items[0].note,'Mi invitación');
 assert.equal(own.reports.items[0].note,'Mi observación'); assert.equal(other.reports.items.length,0);
 assert.equal(JSON.stringify(other).includes('Mi observación'),false);
 await f.request('/api/plaza/blocks','POST',{kind:'post',contentId:post.id},ana.cookie);
 assert.equal((await f.request('/api/account/export','GET',undefined,ana.cookie)).body.blocks.items[0].blockedId,bea.id);
});
