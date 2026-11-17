export type PhotoChallengeProgress = { rounds: number; first: string | null; unlocked: boolean };

/** A round is one message from each person. Consecutive messages count only once. */
export function advancePhotoChallenge(state: PhotoChallengeProgress, sender: string, participantA: string, participantB: string): PhotoChallengeProgress {
  if (state.unlocked || participantA === participantB || (sender !== participantA && sender !== participantB)) return state;
  if (state.first === null) return { ...state, first: sender };
  if (state.first === sender) return state;
  const rounds = Math.min(10, state.rounds + 1);
  return { rounds, first: null, unlocked: rounds === 10 };
}
