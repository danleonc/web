import test from 'node:test';
import assert from 'node:assert/strict';
import {checkRenderSecurity} from '../../scripts/render-security-monitor.mjs';

test('consulta solo la señal de seguridad y no muestra datos del registro',async()=>{
 let url,options;
 const result=await checkRenderSecurity({ownerId:'tea-test123',apiKey:'test-key',now:Date.parse('2026-11-20T20:00:00Z'),request:async(u,o)=>{url=new URL(u);options=o;return {ok:true,json:async()=>({hasMore:false,logs:[{message:JSON.stringify({type:'security',event:'staging_gate_suspicious',extra:'private-data'})}]})}}});
 assert.equal(url.origin,'https://api.render.com');assert.equal(url.pathname,'/v1/logs');
 assert.equal(url.searchParams.get('resource'),'srv-dbr2npjl550s73c3mte0');
 assert.equal(url.searchParams.get('text'),'staging_gate_suspicious');
 assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);
 assert.match(result.join(' '),/intentos/i);assert.doesNotMatch(JSON.stringify(result),/private-data|test-key/);
});
test('no interpreta fallos o resultados incompletos como ausencia de incidentes',async()=>{
 const base={ownerId:'tea-test123',apiKey:'test-key',now:Date.now()};
 for(const request of [async()=>{throw Error('private-error')},async()=>({ok:false}),async()=>({ok:true,json:async()=>({hasMore:true,logs:[]})}),async()=>({ok:true,json:async()=>({logs:[]})}),async()=>({ok:true,json:async()=>({hasMore:false,logs:[{message:'invalid log'}]})})]) {
  const alerts=await checkRenderSecurity({...base,request}); assert.ok(alerts.length); assert.doesNotMatch(JSON.stringify(alerts),/private-error|test-key/);
 }
 assert.deepEqual(await checkRenderSecurity({...base,request:async()=>({ok:true,json:async()=>({hasMore:false,logs:[]})})}),[]);
});
