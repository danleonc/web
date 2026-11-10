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
test('lista solo imágenes propias disponibles y respeta acceso por membresía y moderación',async t=>{
 const f=await fixture(t); const ana=await f.signup('media_ana'), bea=await f.signup('media_bea');
 const db=new DatabaseSync(f.path); const room='11111111-1111-4111-8111-111111111111', own='22222222-2222-4222-8222-222222222222', hidden='33333333-3333-4333-8333-333333333333', other='44444444-4444-4444-8444-444444444444';
 try { db.prepare('INSERT INTO rooms(id,activity_id,session_json,revision,idle_at) VALUES(?,?,?,?,?)').run(room,'cafe','{}',1,0); db.prepare('INSERT INTO memberships VALUES(?,?)').run(room,ana.id); db.prepare('INSERT INTO memberships VALUES(?,?)').run(room,bea.id); const insert=db.prepare('INSERT INTO media(id,room_id,owner_id,client_id,body,created_at,hidden) VALUES(?,?,?,?,?,?,?)'); insert.run(own,room,ana.id,'a',Buffer.from('imagen-propia'),1,0); insert.run(hidden,room,ana.id,'b',Buffer.from('oculta'),2,1); insert.run(other,room,bea.id,'c',Buffer.from('otra'),3,0); } finally {db.close();}
 assert.equal((await f.request('/api/account/media')).status,401);
 const list=await f.request('/api/account/media','GET',undefined,ana.cookie); assert.equal(list.status,200); assert.deepEqual(list.body.images.map(x=>x.id),[own]);
 assert.equal((await f.raw(`/api/media/${own}`,{headers:{Cookie:ana.cookie}})).status,200);
 assert.equal((await f.raw(`/api/media/${hidden}`,{headers:{Cookie:ana.cookie}})).status,404);
 assert.equal((await f.request('/api/account/media','GET',undefined,bea.cookie)).body.images.some(x=>x.id===own),false);
 const remove=new DatabaseSync(f.path); remove.prepare('DELETE FROM memberships WHERE room_id=? AND user_id=?').run(room,ana.id); remove.close();
 assert.equal((await f.request('/api/account/media','GET',undefined,ana.cookie)).body.images.length,0);
 assert.equal((await f.raw(`/api/media/${own}`,{headers:{Cookie:ana.cookie}})).status,404);
});
test('lista de imágenes ofrece páginas acotadas',async t=>{
 const f=await fixture(t); const user=await f.signup('media_pages'); const db=new DatabaseSync(f.path); const room='55555555-5555-4555-8555-555555555555';
 try { db.prepare('INSERT INTO rooms(id,activity_id,session_json,revision,idle_at) VALUES(?,?,?,?,?)').run(room,'cafe','{}',1,0); db.prepare('INSERT INTO memberships VALUES(?,?)').run(room,user.id); const insert=db.prepare('INSERT INTO media(id,room_id,owner_id,client_id,body,created_at) VALUES(?,?,?,?,?,?)'); db.exec('BEGIN'); for(let i=0;i<51;i++)insert.run(`media-${i}`,room,user.id,`client-${i}`,Buffer.from('x'),i); db.exec('COMMIT'); } finally {db.close();}
 const first=await f.request('/api/account/media?page=1','GET',undefined,user.cookie), next=await f.request('/api/account/media?page=2','GET',undefined,user.cookie);
 assert.equal(first.body.images.length,50); assert.equal(first.body.hasMore,true); assert.equal(next.body.images.length,1); assert.equal(next.body.hasMore,false);
 assert.equal((await f.request('/api/account/media?page=0','GET',undefined,user.cookie)).status,422);
});
