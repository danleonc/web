export type GroupReunion = {
  status: 'pending' | 'confirmed' | 'cancelled';
  organizer: string;
  responses: Record<string, 'pending' | 'accepted'>;
};

/** Pure state transition. Authorization and persistence must be enforced by the caller. */
export function decideGroupReunion(proposal: GroupReunion, actor: string, action: 'accept' | 'decline' | 'cancel' | 'withdraw'): GroupReunion {
  if (!Object.hasOwn(proposal.responses, actor) || proposal.status === 'cancelled') throw Error('invalid_decision');
  if (action === 'cancel') {
    if (actor !== proposal.organizer || proposal.status !== 'pending') throw Error('invalid_decision');
    return { ...proposal, status: 'cancelled' };
  }
  if (action === 'withdraw') {
    if (proposal.responses[actor] !== 'accepted') throw Error('invalid_decision');
    return { ...proposal, status: 'cancelled' };
  }
  if (proposal.status !== 'pending' || proposal.responses[actor] !== 'pending') throw Error('invalid_decision');
  if (action === 'decline') return { ...proposal, status: 'cancelled' };
  if (action !== 'accept') throw Error('invalid_decision');
  const responses = { ...proposal.responses, [actor]: 'accepted' as const };
  return { ...proposal, responses, status: Object.values(responses).every(value => value === 'accepted') ? 'confirmed' : 'pending' };
}
