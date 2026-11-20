import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateBackupHealth,checkBackupHealth} from '../../scripts/backup-health.mjs';
import {checkPublicHealth} from '../../scripts/public-health.mjs';

const now=Date.parse('2026-11-20T12:00:00Z');
const ok={status:'OK 2026-11-20T11:00:00.0000000Z nexafia-20261120T110000Z-aaaaaaaa.enc', now, exists:true, freeBytes:3*1024**3, backupBytes:100*1024**2};
test('revisa salud pública y puerta sin seguir redirecciones ni exponer credenciales',async()=>{
 const seen=[];
 const good=async(url,options)=>{seen.push([url,options.redirect,options.signal instanceof AbortSignal]);return {status:url.endsWith('/api/health')?200:401,headers:new Headers({'www-authenticate':'Basic realm="Nexafia pruebas"'})}};
 assert.deepEqual(await checkPublicHealth(good),[]);
 assert.equal(seen.length,2);assert.ok(seen.every(([url,redirect,signal])=>url.startsWith('https://nexafia.com/')&&redirect==='manual'&&signal));
 assert.ok((await checkPublicHealth(async()=>({status:200,headers:new Headers()}))).some(x=>/protección/i.test(x)));
 assert.ok((await checkPublicHealth(async()=>({status:302,headers:new Headers()}))).length);
 assert.ok((await checkPublicHealth(async()=>{throw Error('network')})).length);
});
test('avisa cuando falla el respaldo, es antiguo, falta o queda poco espacio',()=>{
 assert.deepEqual(evaluateBackupHealth(ok),[]);
 assert.ok(evaluateBackupHealth({...ok,status:'ERROR 2026-11-20T11:00:00Z conexión'}).length);
 assert.ok(evaluateBackupHealth({...ok,now:now+48*3600000}).length);
 assert.ok(evaluateBackupHealth({...ok,exists:false}).length);
 assert.ok(evaluateBackupHealth({...ok,freeBytes:100}).length);
 assert.ok(evaluateBackupHealth({...ok,status:'OK basura'}).length);
});

test('el monitor combina avisos del disco remoto con el respaldo local y falla de forma visible',async t=>{
 const {mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises'); const {join}=await import('node:path'); const {tmpdir}=await import('node:os');
 const dir=await mkdtemp(join(tmpdir(),'nex-health-')); t.after(()=>rm(dir,{recursive:true,force:true}));
 await mkdir(join(dir,'copias'));await writeFile(join(dir,'render_backup_ed25519'),'fixture');await writeFile(join(dir,'known_hosts.render'),'fixture');
 const file='nexafia-20261120T110000Z-aaaaaaaa.enc';await writeFile(join(dir,'copias',file),'fixture');await writeFile(join(dir,'ultimo-estado.txt'),`OK 2026-11-20T11:00:00Z ${file}`);
 assert.ok((await checkBackupHealth(dir,now,async()=>({total:1000,available:100}),async()=>[])).some(x=>/crítico/i.test(x)));
 assert.ok((await checkBackupHealth(dir,now,async()=>{throw Error('offline')},async()=>[])).some(x=>/No se pudo comprobar el espacio del servidor/i.test(x)));
 assert.ok((await checkBackupHealth(dir,now,async()=>({total:1000,available:900}),async()=>['puerta de prueba'])).includes('puerta de prueba'));
});

test('el aviso detecta configuración inexistente y sale con error', {skip:process.platform!=='win32'}, async t=>{
 const {spawnSync}=await import('node:child_process'); const {mkdtemp,rm}=await import('node:fs/promises');
 const {join,resolve}=await import('node:path'); const {tmpdir}=await import('node:os');
 const dir=await mkdtemp(join(tmpdir(),'nex-health-')); t.after(()=>rm(dir,{recursive:true,force:true}));
 const r=spawnSync('powershell.exe',['-NoProfile','-File',resolve('scripts/notify-backup-health.ps1'),'-NodePath',process.execPath,'-HealthScript',resolve('scripts/backup-health.mjs'),'-ConfigRoot',dir,'-TestNoPopup'],{encoding:'utf8'});
 assert.equal(r.status,1); assert.match(r.stdout,/respaldo/i);
});
