import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';
function worker(windows=[]) {
 const handlers={},shown=[],opened=[],messages=[];
 const self={registration:{scope:'https://example.test/web/',showNotification:async(title,options)=>shown.push({title,options})},clients:{claim:async()=>{},matchAll:async()=>windows,openWindow:async url=>opened.push(url)},skipWaiting:()=>{},addEventListener:(name,handler)=>handlers[name]=handler};
 runInNewContext(readFileSync(new URL('../../public/sw.js',import.meta.url),'utf8'),{self,URL});
 return {handlers,shown,opened,messages};
}
test('worker: push visible y acotado, sin caché de la app ni URL externa desde payload',async()=>{
 const w=worker();let promise;w.handlers.push({data:{json:()=>({title:'Nexafia',body:'x'.repeat(500),url:'https://evil.test',tag:'nexafia-test'})},waitUntil:p=>promise=p});await promise;
 assert.equal(w.shown[0].options.body.length,180);assert.equal(w.shown[0].options.icon,'https://example.test/web/icons/icon-192.png');assert.equal(w.handlers.fetch,undefined);
 w.handlers.notificationclick({notification:{close:()=>{},data:{url:'https://evil.test'}},waitUntil:p=>promise=p});await promise;
 assert.equal(w.opened.length,1);const target=new URL(w.opened[0]);assert.equal(target.origin,'https://example.test');assert.equal(target.pathname,'/web/');assert.equal(target.searchParams.get('openNotifications'),'1');
});
test('worker: enfoca la ventana actual y pide abrir el centro sin abandonar una sala',async()=>{
 const messages=[];let focused=0;const client={url:'https://example.test/web/#room',focus:async()=>focused++,postMessage:value=>messages.push(value)};
 const w=worker([client]);let promise;w.handlers.notificationclick({notification:{close:()=>{}},waitUntil:p=>promise=p});await promise;
 assert.equal(focused,1);assert.equal(w.opened.length,0);assert.equal(messages[0].type,'nexafia-open-notifications');assert.equal(client.url,'https://example.test/web/#room');
});
