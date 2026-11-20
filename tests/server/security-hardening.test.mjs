import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRoomServer} from '../../server/app.ts';

test('cabeceras de seguridad protegen respuestas y HSTS solo se anuncia en HTTPS configurado',async t=>{
 for (const secureCookies of [false,true]) {
  const app=createRoomServer({secureCookies,stagingPassword:'a'.repeat(32)});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>app.close());
  const base=`http://127.0.0.1:${app.server.address().port}`;
  for(const path of ['/','/api/health']) {const r=await fetch(base+path);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('x-frame-options'),'DENY');assert.equal(r.headers.get('referrer-policy'),'same-origin');assert.equal(r.headers.get('permissions-policy'),'camera=(self), microphone=(), geolocation=()');assert.equal(r.headers.get('strict-transport-security'),secureCookies?'max-age=31536000':null);}
 }
});

test('registra intentos sospechosos sin contraseñas, tokens ni identificadores de usuario',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'nexafia-security-'));const events=[];const origin='http://localhost:4173';
 const app=createRoomServer({databasePath:join(dir,'db.sqlite'),allowedOrigins:[origin],securityLog:event=>events.push(event)}); app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true})});const base=`http://127.0.0.1:${app.server.address().port}`;
 const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'private_user_01',password:'a-very-private-password'})});assert.equal(r.status,401);assert.equal(events.length,1);assert.equal(events[0].event,'auth_failed');assert.equal(events[0].status,401);assert.doesNotMatch(JSON.stringify(events),/private_user_01|very-private|127\.0\.0\.1/);
 for(let i=0;i<10;i++) await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'private_user_01',password:'a-very-private-password'})});
 assert.ok(events.some(event=>event.event==='auth_rate_limited' && event.status===429));
 assert.doesNotMatch(JSON.stringify(events),/private_user_01|very-private|127\.0\.0\.1/);
});

test('las mutaciones rechazan solicitudes cross-site incluso con origen aceptado y admiten clientes sin Fetch Metadata',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'nexafia-csrf-')); const origin='http://localhost:4173';
 const app=createRoomServer({databasePath:join(dir,'db.sqlite'),allowedOrigins:[origin]});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});}); const base=`http://127.0.0.1:${app.server.address().port}`;
 const payload=JSON.stringify({username:'security_test',password:'a-very-private-password'});const request=(site)=>fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(site?{'Sec-Fetch-Site':site}:{})},body:payload});
 assert.equal((await request('cross-site')).status,403);assert.equal((await request('same-origin')).status,401);assert.equal((await request()).status,401);
});

test('los tiempos de recepción y cabeceras están acotados',async t=>{
 const app=createRoomServer(); t.after(()=>app.close());
 assert.equal(app.server.headersTimeout,10000); assert.equal(app.server.requestTimeout,30000); assert.equal(app.server.maxHeadersCount,100);
});
