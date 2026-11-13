import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './feature-fixture.mjs';

test('el perfil pertenece a la cuenta y persiste al reiniciar', async t => {
  const f = await fixture(t, { plazaEnabled: true });
  const a = await f.signup('perfil_a'), b = await f.signup('perfil_b');
  const profile = { interests: ['Cultura'], boundaries: ['Conversar a mi ritmo'], availability: 'Sin preferencia' };
  assert.equal((await f.request('/api/account/profile')).status, 401);
  assert.deepEqual((await f.request('/api/account/profile', 'GET', undefined, b.cookie)).body.profile, null);
  assert.equal((await f.request('/api/account/profile', 'PUT', profile, a.cookie, 'https://otro.test')).status, 403);
  assert.equal((await f.request('/api/account/profile', 'PUT', { ...profile, boundaries: ['x'.repeat(101)] }, a.cookie)).status, 422);
  assert.equal((await f.request('/api/account/profile', 'PUT', profile, a.cookie)).status, 200);
  assert.deepEqual((await f.request('/api/account/profile', 'GET', undefined, b.cookie)).body.profile, null);
  await f.restart();
  assert.deepEqual((await f.request('/api/account/profile', 'GET', undefined, a.cookie)).body.profile, profile);
  assert.deepEqual((await f.request('/api/account/export', 'GET', undefined, a.cookie)).body.profile, profile);
});
