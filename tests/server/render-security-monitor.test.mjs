import test from 'node:test';
import assert from 'node:assert/strict';
import {checkRenderSecurity,runConfiguredSecurityCheck} from '../../scripts/render-security-monitor.mjs';

test('consulta solo la señal de seguridad y no muestra datos del registro',async()=>{
 let url,options;
 const result=await checkRenderSecurity({ownerId:'tea-test123',apiKey:'test-key',now:Date.parse('2026-11-20T20:00:00Z'),request:async(u,o)=>{url=new URL(u);options=o;return {ok:true,json:async()=>({hasMore:false,logs:[{message:JSON.stringify({type:'security',event:'staging_gate_suspicious',extra:'private-data'})}]})}}});
 assert.equal(url.origin,'https://api.render.com');assert.equal(url.pathname,'/v1/logs');
 assert.equal(url.searchParams.get('resource'),'srv-dbr2npjl550s73c3mte0');
 assert.equal(url.searchParams.get('text'),'staging_gate_suspicious');
 assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);
 assert.match(result.join(' '),/intentos/i);assert.doesNotMatch(JSON.stringify(result),/private-data|test-key/);
});

test('el monitor conectado muestra incidentes y falla visiblemente si falta configuración',async()=>{
 const safe={ownerId:'tea-test123',apiKey:'test-key'};
 assert.deepEqual(await runConfiguredSecurityCheck(safe,async()=>[]),[]);
 assert.match((await runConfiguredSecurityCheck(safe,async()=>['Incidente de seguridad']))[0],/Incidente/);
 assert.match((await runConfiguredSecurityCheck({},async()=>[]))[0],/configuración/i);
 assert.match((await runConfiguredSecurityCheck(safe,async()=>{throw Error('test-key')}))[0],/comprobar/i);
});
test('no interpreta fallos o resultados incompletos como ausencia de incidentes',async()=>{
 const base={ownerId:'tea-test123',apiKey:'test-key',now:Date.now()};
 for(const request of [async()=>{throw Error('private-error')},async()=>({ok:false}),async()=>({ok:true,json:async()=>({hasMore:true,logs:[]})}),async()=>({ok:true,json:async()=>({logs:[]})}),async()=>({ok:true,json:async()=>({hasMore:false,logs:[{message:'invalid log'}]})})]) {
  const alerts=await checkRenderSecurity({...base,request}); assert.ok(alerts.length); assert.doesNotMatch(JSON.stringify(alerts),/private-error|test-key/);
 }
 assert.deepEqual(await checkRenderSecurity({...base,request:async()=>({ok:true,json:async()=>({hasMore:false,logs:[]})})}),[]);
});

test('configura con clave protegida solo tras una consulta exitosa', {skip:process.platform!=='win32'},async t=>{
 const {mkdtemp,writeFile,readFile,rm}=await import('node:fs/promises');const {join,resolve}=await import('node:path');const {tmpdir}=await import('node:os');const {spawnSync}=await import('node:child_process');
 const dir=await mkdtemp(join(tmpdir(),'nex-render-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const check=join(dir,'check.mjs');await writeFile(check,'for await (const chunk of process.stdin) {}');
 const key=(await import('node:crypto')).randomUUID();
 const run=()=>spawnSync('powershell.exe',['-NoProfile','-File',resolve('scripts/configure-render-monitor.ps1'),'-NodePath',process.execPath,'-CheckScript',check,'-ConfigRoot',dir,'-OwnerId','tea-test123'],{input:key,encoding:'utf8'});
 assert.equal(run().status,0);const encrypted=await readFile(join(dir,'render-monitor-key.dpapi'));assert.ok(encrypted.length>0);assert.equal(encrypted.includes(Buffer.from(key)),false);
 assert.equal((await readFile(join(dir,'render-monitor-owner.txt'),'utf8')),'tea-test123');assert.equal(run().status,1);
});
