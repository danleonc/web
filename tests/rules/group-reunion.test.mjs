import test from 'node:test';
import assert from 'node:assert/strict';
import { decideGroupReunion } from '../../src/room/groupReunion.ts';

test('un reencuentro requiere la aceptación de cada persona invitada', () => {
  const proposal = { status: 'pending', organizer: 'a', responses: { a: 'accepted', b: 'pending', c: 'pending' } };
  const first = decideGroupReunion(proposal, 'b', 'accept');
  assert.equal(first.status, 'pending');
  assert.equal(decideGroupReunion(first, 'c', 'accept').status, 'confirmed');
  assert.deepEqual(proposal.responses, { a: 'accepted', b: 'pending', c: 'pending' });
});

test('rechazar o retirar cancela sin permitir respuestas de terceros ni reactivar', () => {
  const proposal = { status: 'pending', organizer: 'a', responses: { a: 'accepted', b: 'pending', c: 'pending' } };
  assert.throws(() => decideGroupReunion(proposal, 'outsider', 'accept'));
  assert.throws(() => decideGroupReunion(proposal, 'b', 'cancel'));
  assert.equal(decideGroupReunion(proposal, 'b', 'decline').status, 'cancelled');
  assert.equal(decideGroupReunion(proposal, 'a', 'cancel').status, 'cancelled');
  const confirmed = decideGroupReunion(decideGroupReunion(proposal, 'b', 'accept'), 'c', 'accept');
  assert.equal(decideGroupReunion(confirmed, 'b', 'withdraw').status, 'cancelled');
  assert.throws(() => decideGroupReunion(decideGroupReunion(proposal, 'b', 'decline'), 'c', 'accept'));
});
