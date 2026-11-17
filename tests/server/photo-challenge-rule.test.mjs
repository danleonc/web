import test from 'node:test';
import assert from 'node:assert/strict';
import { advancePhotoChallenge } from '../../server/photo-challenge.ts';

const initial = () => ({ rounds: 0, first: null, unlocked: false });
test('una vuelta necesita mensajes alternados de ambas personas y no se desbloquea antes de diez', () => {
 let state=initial();
 for(let i=0;i<30;i++) state=advancePhotoChallenge(state,'a','a','b');
 assert.deepEqual(state,{rounds:0,first:'a',unlocked:false});
 for(let i=0;i<9;i++) { state=advancePhotoChallenge(state,'b','a','b'); if(i<8) state=advancePhotoChallenge(state,'a','a','b'); }
 assert.equal(state.rounds,9); assert.equal(state.unlocked,false);
 state=advancePhotoChallenge(state,'a','a','b'); state=advancePhotoChallenge(state,'b','a','b');
 assert.equal(state.rounds,10); assert.equal(state.unlocked,true);
});
test('la otra persona puede comenzar, terceros no avanzan y desbloqueo permanece', () => {
 let state=initial(); state=advancePhotoChallenge(state,'x','a','b'); assert.deepEqual(state,initial());
 for(let i=0;i<10;i++) { state=advancePhotoChallenge(state,'b','a','b'); state=advancePhotoChallenge(state,'a','a','b'); }
 assert.equal(state.rounds,10); assert.equal(state.unlocked,true);
 assert.deepEqual(advancePhotoChallenge(state,'b','a','b'),state);
});
