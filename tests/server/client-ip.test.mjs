import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClientIpResolver} from '../../server/client-ip.ts';

const request=(peer,xff)=>({socket:{remoteAddress:peer},headers:xff===undefined?{}:{'x-forwarded-for':xff}});
test('ignora cabeceras manipuladas cuando no existe un proxy confiable',()=>{
 const resolve=createClientIpResolver([]);
 assert.equal(resolve(request('203.0.113.8','198.51.100.4')),'203.0.113.8');
});
test('recorre la cadena de derecha a izquierda y no confía en valores anteriores al cliente',()=>{
 const resolve=createClientIpResolver(['10.0.0.0/8','192.0.2.2']);
 assert.equal(resolve(request('10.1.2.3','203.0.113.99, 198.51.100.10, 192.0.2.2')),'198.51.100.10');
 assert.equal(resolve(request('203.0.113.8','198.51.100.4')),'203.0.113.8');
});
test('rechaza cadenas inválidas, excesivas y configuraciones inseguras',()=>{
 const resolve=createClientIpResolver(['10.0.0.0/8']);
 for(const header of ['bad, 198.51.100.1','198.51.100.1,',Array(12).fill('198.51.100.1').join(',')]) assert.equal(resolve(request('10.1.2.3',header)),'10.1.2.3');
 for(const range of ['0.0.0.0/0','::/0','not-a-proxy','10.0.0.1/99']) assert.throws(()=>createClientIpResolver([range]));
});
test('normaliza variantes IPv6 y direcciones IPv4 mapeadas',()=>{
 const resolve=createClientIpResolver(['10.0.0.0/8','2001:db8::/32']);
 assert.equal(resolve(request('::ffff:10.0.0.1','::ffff:192.0.2.1')),'192.0.2.1');
 assert.equal(resolve(request('2001:db8::1','2001:0db9:0000:0000:0000:0000:0000:0002')),'2001:db9::2');
});

test('la API utiliza la dirección resuelta para límites sin confiar en cabeceras por defecto',async t=>{
 const {createRoomServer}=await import('../../server/app.ts'); const {digest}=await import('../../server/storage.ts');
 const {mkdtemp,rm}=await import('node:fs/promises');const {join}=await import('node:path');const {tmpdir}=await import('node:os');
 const {once}=await import('node:events');const {DatabaseSync}=await import('node:sqlite');
 const dir=await mkdtemp(join(tmpdir(),'nex-ip-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 for(const [name,proxies,expected] of [['direct',[],'127.0.0.1'],['trusted',['127.0.0.1'],'198.51.100.5']]) {
  const path=join(dir,`${name}.sqlite`),app=createRoomServer({databasePath:path,trustedProxies:proxies,allowedOrigins:['http://localhost:4173'],securityLog:()=>{}});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  try {
   const res=await fetch(`http://127.0.0.1:${app.server.address().port}/api/auth/login`,{method:'POST',headers:{origin:'http://localhost:4173','content-type':'application/json','x-forwarded-for':'198.51.100.5'},body:JSON.stringify({username:'missing_user',password:randomUUID()})});
   assert.equal(res.status,401);
  } finally {await app.close();}
  const db=new DatabaseSync(path,{readOnly:true});try {assert.ok(db.prepare('SELECT 1 FROM auth_limits WHERE key=?').get(digest(`ip:${expected}`)));} finally {db.close();}
 }
});
