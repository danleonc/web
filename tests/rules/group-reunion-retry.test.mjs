import test from 'node:test';
import assert from 'node:assert/strict';
import { retryId, clearRetry } from '../../src/room/reunionRetry.ts';

function storage(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),data};}
const proposal={accountId:'account-a',roomId:'room',invitees:['b','c'],startsAt:90000000};
test('un reintento tras recargar conserva la clave sin guardar datos de la propuesta',async()=>{
 const store=storage(); const id=await retryId(store,proposal,1000); const afterReload=await retryId(store,{...proposal,invitees:['c','b']},2000);
 assert.equal(afterReload,id);assert.doesNotMatch([...store.data.values()].join(''),/account-a|room|90000000/);
 await clearRetry(store,proposal);assert.notEqual(await retryId(store,proposal,3000),id);
});
test('cuentas y propuestas distintas se mantienen separadas y caducan',async()=>{
 const store=storage();const id=await retryId(store,proposal,1000);
 assert.notEqual(await retryId(store,{...proposal,accountId:'account-b'},1000),id);
 assert.notEqual(await retryId(store,{...proposal,startsAt:90000001},1000),id);
 assert.notEqual(await retryId(store,proposal,1000+8*86400000),id);
});
