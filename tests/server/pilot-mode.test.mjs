import test from 'node:test';
import assert from 'node:assert/strict';
import { pilotMode } from '../../server/pilot-mode.ts';

test('el modo compartido requiere protección y una compilación compatible', () => {
  assert.deepEqual(pilotMode({}, {mode:'accounts',realPlaza:false}), {plazaEnabled:false,meetingsEnabled:false});
  const gate='0123456789abcdef0123456789abcdef';
  assert.deepEqual(pilotMode({ENTRE_STAGING_SHARED:'1',ENTRE_STAGING_PASSWORD:gate},{mode:'accounts',realPlaza:true}), {plazaEnabled:true,meetingsEnabled:true});
  assert.throws(()=>pilotMode({ENTRE_STAGING_SHARED:'1'},{mode:'accounts',realPlaza:true}),/requires staging protection/);
  assert.throws(()=>pilotMode({ENTRE_STAGING_SHARED:'1',ENTRE_STAGING_PASSWORD:gate},{mode:'accounts',realPlaza:false}),/build mismatch/);
  assert.throws(()=>pilotMode({ENTRE_STAGING_PASSWORD:gate},{mode:'accounts',realPlaza:true}),/build mismatch/);
  assert.throws(()=>pilotMode({ENTRE_STAGING_SHARED:'true',ENTRE_STAGING_PASSWORD:gate},{mode:'accounts',realPlaza:false}),/invalid staging mode/);
  assert.throws(()=>pilotMode({},{mode:'incorrect',realPlaza:false}),/build/);
});
