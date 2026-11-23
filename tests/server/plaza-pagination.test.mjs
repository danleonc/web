import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fixture } from './feature-fixture.mjs';

test('las respuestas recientes y anteriores se pueden recorrer sin duplicados ni bloqueados', async t => {
 const f=await fixture(t,{plazaEnabled:true}); const reader=await f.signup('reply_pages_reader'), author=await f.signup('reply_pages_author'), blocked=await f.signup('reply_pages_blocked');
 const post=(await f.request('/api/plaza/posts','POST',{topic:'cultura',title:'Conversación larga',body:'Hola'},author.cookie)).body.post;
 const db=new DatabaseSync(f.path); const add=db.prepare('INSERT INTO plaza_replies(id,post_id,author_id,body,created_at) VALUES(?,?,?,?,?)');
 for(let n=0;n<125;n++) add.run(`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`,post.id,author.id,`Respuesta ${n}`,1000+Math.floor(n/2));
 add.run('20000000-0000-4000-8000-999999999999',post.id,blocked.id,'Oculta',9999); db.prepare('INSERT INTO blocks(user_id,blocked_id) VALUES(?,?)').run(reader.id,blocked.id); db.close();
 const path=`/api/plaza/posts/${post.id}/replies`;
 const first=await f.request(`${path}?page=1`,'GET',undefined,reader.cookie); assert.equal(first.status,200); assert.equal(first.body.replies.length,50); assert.equal(first.body.replies.at(-1).body,'Respuesta 124'); assert.ok(first.body.nextCursor);
 const second=await f.request(`${path}?cursor=${first.body.nextCursor}`,'GET',undefined,reader.cookie); assert.equal(second.body.replies.length,50);
 const third=await f.request(`${path}?cursor=${second.body.nextCursor}`,'GET',undefined,reader.cookie); assert.equal(third.body.replies.length,25); assert.equal(third.body.nextCursor,null);
 assert.equal(new Set([...first.body.replies,...second.body.replies,...third.body.replies].map(x=>x.id)).size,125);
 assert.equal((await f.request(`${path}?cursor=malformado`,'GET',undefined,reader.cookie)).status,422);
 assert.equal((await f.request(`${path}?page=1&page=1`,'GET',undefined,reader.cookie)).status,422);
 assert.equal((await f.request(`${path}?page=1`,'GET')).status,401);
});

test('filtrado y páginas encuentran publicaciones antiguas sin mostrar bloqueos ni duplicados', async t => {
 const f=await fixture(t,{plazaEnabled:true}); const reader=await f.signup('pagination_reader'), author=await f.signup('pagination_author'), blocked=await f.signup('pagination_blocked');
 const db=new DatabaseSync(f.path); const add=db.prepare('INSERT INTO plaza_posts(id,author_id,topic,title,body,created_at) VALUES(?,?,?,?,?,?)');
 for(let n=0;n<130;n++) add.run(`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,author.id,n<65?'anime':'cocina',`Tema ${n}`,'Texto',1000+n);
 add.run('00000000-0000-4000-8000-999999999999',blocked.id,'anime','Bloqueado','Texto',9999); db.prepare('INSERT INTO blocks(user_id,blocked_id) VALUES(?,?)').run(reader.id,blocked.id); db.close();
 const first=await f.request('/api/plaza/posts?topic=anime','GET',undefined,reader.cookie); assert.equal(first.status,200); assert.equal(first.body.posts.length,50); assert.ok(first.body.nextCursor); assert.ok(first.body.posts.every(p=>p.topic==='anime' && p.title!=='Bloqueado'));
 const second=await f.request(`/api/plaza/posts?topic=anime&cursor=${encodeURIComponent(first.body.nextCursor)}`,'GET',undefined,reader.cookie); assert.equal(second.body.posts.length,15); assert.equal(second.body.nextCursor,null);
 assert.equal(new Set([...first.body.posts,...second.body.posts].map(p=>p.id)).size,65);
 assert.equal((await f.request('/api/plaza/posts?topic=invalido','GET',undefined,reader.cookie)).status,422);
 assert.equal((await f.request('/api/plaza/posts?cursor=malformado','GET',undefined,reader.cookie)).status,422);
 const old=await f.request('/api/plaza/posts/00000000-0000-4000-8000-000000000000','GET',undefined,reader.cookie); assert.equal(old.status,200); assert.equal(old.body.post.title,'Tema 0');
 assert.equal((await f.request('/api/plaza/posts/00000000-0000-4000-8000-999999999999','GET',undefined,reader.cookie)).status,404);
});

test('búsqueda por título y texto respeta temas, acentos y bloqueos', async t => {
 const f=await fixture(t,{plazaEnabled:true}); const reader=await f.signup('search_reader'), author=await f.signup('search_author'), blocked=await f.signup('search_blocked');
 const db=new DatabaseSync(f.path); const add=db.prepare('INSERT INTO plaza_posts(id,author_id,topic,title,body,created_at) VALUES(?,?,?,?,?,?)');
 add.run('10000000-0000-4000-8000-000000000001',author.id,'cocina','Recetas de MÉXICO','Pan casero',1);
 add.run('10000000-0000-4000-8000-000000000002',author.id,'anime','Una historia','Viajando por México',2);
 add.run('10000000-0000-4000-8000-000000000003',blocked.id,'anime','México privado','Texto',3);
 db.prepare('INSERT INTO blocks(user_id,blocked_id) VALUES(?,?)').run(reader.id,blocked.id); db.close();
 const all=await f.request('/api/plaza/posts?topic=todos&q=mexico','GET',undefined,reader.cookie); assert.equal(all.status,200); assert.equal(all.body.posts.length,2);
 const one=await f.request('/api/plaza/posts?topic=cocina&q=mexico','GET',undefined,reader.cookie); assert.equal(one.body.posts.length,1); assert.equal(one.body.posts[0].title,'Recetas de MÉXICO');
 assert.equal((await f.request('/api/plaza/posts?q='+ 'x'.repeat(101),'GET',undefined,reader.cookie)).status,422);
});
