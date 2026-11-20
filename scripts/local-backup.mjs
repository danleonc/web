import {createCipheriv, randomBytes} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {open, mkdir, mkdtemp, rm, link} from 'node:fs/promises';
import {join, dirname, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {restoreEncryptedBackup} from './encrypted-backup.mjs';

// Encrypt directly from SSH output. Publish only after SSH succeeds and a full
// authenticated restore and SQLite checks have succeeded on a temporary copy.
export async function saveLocalBackup(stream, completion, destination, key) {
 if (!Buffer.isBuffer(key) || key.length !== 32) throw Error('Invalid backup key');
 const outcome=Promise.resolve(completion).then(()=>null,e=>e);
 const directory=dirname(resolve(destination)); await mkdir(directory,{recursive:true});
 const temp=await mkdtemp(join(directory,'.nexafia-pending-'));
 let scratch; const pending=join(temp,'backup.enc'); let out;
 try {
  scratch=await mkdtemp(join(tmpdir(),'nexafia-check-'));
  out=await open(pending,'wx',0o600);
  const header=Buffer.concat([Buffer.from('NEXBK001'),randomBytes(12)]);
  const cipher=createCipheriv('aes-256-gcm',key,header.subarray(8)); cipher.setAAD(header);
  await out.writeFile(header);
  for await (const chunk of stream) await out.writeFile(cipher.update(chunk));
  const error=await outcome; if(error) throw error;
  await out.writeFile(cipher.final()); await out.writeFile(cipher.getAuthTag()); await out.sync();
  await out.close(); out=null;
  await restoreEncryptedBackup(pending,join(scratch,'verified.sqlite'),key);
  await link(pending,destination); // atomic, fails if destination already exists
 } finally {
  if(out) await out.close();
  await rm(temp,{recursive:true,force:true}); if(scratch) await rm(scratch,{recursive:true,force:true});
 }
}

// This code executes on the existing Render instance, where the database and
// backup-db.mjs already exist. The snapshot is transient and never logged.
export const remoteSource = `
const {mkdtemp,rm}=await import('node:fs/promises');
const {createReadStream}=await import('node:fs');
const {tmpdir}=await import('node:os');
const {join}=await import('node:path');
const {pipeline}=await import('node:stream/promises');
const {pathToFileURL}=await import('node:url');
const {resolve}=await import('node:path');
const {backupDatabase}=await import(pathToFileURL(resolve('scripts/backup-db.mjs')).href);
const dir=await mkdtemp(join(tmpdir(),'nexafia-transfer-'));
try { if (!process.env.ENTRE_DATABASE_PATH) throw Error('Missing database path'); const p=join(dir,'snapshot.sqlite'); await backupDatabase(process.env.ENTRE_DATABASE_PATH,p); await pipeline(createReadStream(p),process.stdout); }
finally { await rm(dir,{recursive:true,force:true}); }
`;

export function startRenderSnapshot({target, identity, knownHosts}) {
 if(!/^srv-[a-z0-9]+@ssh\.[a-z0-9-]+\.render\.com$/.test(target)) throw Error('Invalid Render SSH target');
 if(!identity || !knownHosts) throw Error('SSH identity and verified known-hosts file required');
 const encoded=Buffer.from(remoteSource).toString('base64');
 const command=`node --input-type=module -e "await import('data:text/javascript;base64,${encoded}')"`;
 const child=spawn('ssh',['-T','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o',`UserKnownHostsFile=${knownHosts}`,'-i',identity,target,command],{stdio:['ignore','pipe','pipe']});
 child.stderr.resume();
 const timer=setTimeout(()=>child.kill(),180_000); timer.unref();
 const completion=new Promise((resolveDone,reject)=>{child.once('error',reject);child.once('close',code=>code===0?resolveDone():reject(Error(`SSH snapshot failed (exit ${code})`)));}).finally(()=>clearTimeout(timer));
 return {stream:child.stdout, completion, stop:()=>child.kill()};
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 const [,,target,identity,knownHosts,destination]=process.argv;
 const raw=process.env.NEXAFIA_BACKUP_KEY;
 if(!target || !identity || !knownHosts || !destination || !raw || !/^[a-fA-F0-9]{64}$/.test(raw)) throw Error('Usage: local-backup.mjs SSH_TARGET IDENTITY KNOWN_HOSTS DESTINATION; NEXAFIA_BACKUP_KEY required');
 const key=Buffer.from(raw,'hex');
 try {const remote=startRenderSnapshot({target,identity,knownHosts}); try {await saveLocalBackup(remote.stream,remote.completion,destination,key);} finally {remote.stop();} console.log('Encrypted backup verified and saved.');} finally {key.fill(0);}
}
