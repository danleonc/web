import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRenderDisk,readRenderDisk} from '../../scripts/render-disk-health.mjs';

test('advierte cuando queda poco espacio y rechaza datos imposibles',()=>{
 assert.equal(evaluateRenderDisk({total:1000,available:400}),null);
 assert.match(evaluateRenderDisk({total:1000,available:199}),/espacio/i);
 assert.match(evaluateRenderDisk({total:1000,available:99}),/crítico/i);
 for(const bad of [{total:0,available:0},{total:1,available:2},{total:1,available:-1},{total:1,available:'1'}]) assert.throws(()=>evaluateRenderDisk(bad));
});
test('error de conexión o respuesta inválida nunca se informa como estado correcto',async()=>{
 assert.deepEqual(await readRenderDisk('identity','hosts',async()=>'{"total":1000,"available":400}'),{total:1000,available:400});
 await assert.rejects(readRenderDisk('identity','hosts',async()=>'{"total":0,"available":0}'));
 await assert.rejects(readRenderDisk('identity','hosts',async()=>{throw Error('SSH failed')}));
});
