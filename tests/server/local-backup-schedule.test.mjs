import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('programación conserva 14 respaldos y nunca borra otros archivos; falla sin podar', {skip:process.platform!=='win32'}, async t=>{
 const root=await mkdtemp(join(tmpdir(),'nex-schedule-')); t.after(()=>rm(root,{recursive:true,force:true}));
 const config=join(root,'NexafiaBackup'), backups=join(root,'backups'); await mkdir(config); await mkdir(backups);
 const env={...process.env,LOCALAPPDATA:root};
 const makeKey="Add-Type -AssemblyName System.Security; $k=New-Object byte[] 32; $v=[Security.Cryptography.ProtectedData]::Protect($k,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [IO.File]::WriteAllBytes((Join-Path $env:LOCALAPPDATA 'NexafiaBackup\\backup-key.dpapi'),$v)";
 let r=spawnSync('powershell.exe',['-NoProfile','-Command',makeKey],{env,encoding:'utf8'}); assert.equal(r.status,0,r.stderr);
 const stub=join(root,'stub.mjs'); await writeFile(stub,"import {writeFileSync} from 'node:fs'; if(process.env.BACKUP_TEST_FAIL) process.exit(5); writeFileSync(process.argv.at(-1),'test');");
 for(let i=1;i<=15;i++) await writeFile(join(backups,`nexafia-202601${String(i).padStart(2,'0')}T010101Z-aaaaaaaa.enc`),'old');
 await writeFile(join(backups,'no-tocar.txt'),'keep');
 const args=['-NoProfile','-File',resolve('scripts/run-local-backup.ps1'),'-NodePath',process.execPath,'-ScriptPath',stub,'-BackupRoot',backups];
 r=spawnSync('powershell.exe',args,{env,encoding:'utf8'}); assert.equal(r.status,0,r.stderr);
 let entries=await readdir(backups); assert.equal(entries.filter(x=>x.endsWith('.enc')).length,14); assert.ok(entries.includes('no-tocar.txt'));
 const before=entries.sort(); r=spawnSync('powershell.exe',args,{env:{...env,BACKUP_TEST_FAIL:'1'},encoding:'utf8'}); assert.notEqual(r.status,0);
 assert.deepEqual((await readdir(backups)).sort(),before); assert.match(await readFile(join(config,'ultimo-estado.txt'),'utf8'),/^ERROR /);
});
