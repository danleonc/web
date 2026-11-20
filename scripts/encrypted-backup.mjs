import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {createReadStream,constants} from 'node:fs';
import {open,mkdtemp,rm,mkdir,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {backupDatabase} from './backup-db.mjs';

// Versioned file format: magic (8 bytes), nonce (12), encrypted SQLite bytes, tag (16).
const magic=Buffer.from('NEXBK001');
const headerSize=20, tagSize=16;
function checkKey(key) { if (!Buffer.isBuffer(key) || key.length!==32) throw Error('Backup key must contain exactly 32 random bytes'); }
async function scratch(work) {
 const dir=await mkdtemp(join(tmpdir(),'nexafia-secure-backup-'));
 try { return await work(join(dir,'snapshot.sqlite')); }
 finally { await rm(dir,{recursive:true,force:true}); }
}
function validateDatabase(path) {
 const db=new DatabaseSync(path,{readOnly:true});
 try {
  const result=db.prepare('PRAGMA integrity_check').all();
  if(result.length!==1 || Object.values(result[0])[0]!=='ok' || !db.prepare('PRAGMA foreign_key_check').iterate().next().done) throw Error('Backup validation failed');
 } finally { db.close(); }
}
export async function encryptedBackup(source,destination,key) {
 checkKey(key);
 if(resolve(source)===resolve(destination)) throw Error('Backup destination must differ from source');
 return scratch(async snapshot=>{
  await backupDatabase(source,snapshot);
  await mkdir(dirname(destination),{recursive:true,mode:0o700});
  const out=await open(destination,'wx',0o600);let success=false;
  try {
   const header=Buffer.concat([magic,randomBytes(12)]);const cipher=createCipheriv('aes-256-gcm',key,header.subarray(8));cipher.setAAD(header);
   await out.writeFile(header);
   for await (const chunk of createReadStream(snapshot)) await out.writeFile(cipher.update(chunk));
   await out.writeFile(cipher.final());await out.writeFile(cipher.getAuthTag());await out.sync();success=true;
  } finally {try {await out.close();} finally {if(!success) await rm(destination,{force:true});}}
 });
}
export async function restoreEncryptedBackup(source,destination,key) {
 checkKey(key);
 if(resolve(source)===resolve(destination)) throw Error('Restore destination must differ from source');
 return scratch(async snapshot=>{
  const input=await open(source,'r');
  try {
   const {size}=await input.stat();if(size<=headerSize+tagSize) throw Error('Invalid encrypted backup');
   const header=Buffer.alloc(headerSize), tag=Buffer.alloc(tagSize);
   if((await input.read(header,0,headerSize,0)).bytesRead!==headerSize || !header.subarray(0,8).equals(magic) || (await input.read(tag,0,tagSize,size-tagSize)).bytesRead!==tagSize) throw Error('Invalid encrypted backup');
   const decipher=createDecipheriv('aes-256-gcm',key,header.subarray(8));decipher.setAAD(header);decipher.setAuthTag(tag);
   const output=await open(snapshot,'wx',0o600);
   try {for await (const chunk of createReadStream(source,{start:headerSize,end:size-tagSize-1})) await output.writeFile(decipher.update(chunk));await output.writeFile(decipher.final());await output.sync();} finally {await output.close();}
  } finally {await input.close();}
  validateDatabase(snapshot);
  await mkdir(dirname(destination),{recursive:true,mode:0o700});
  await copyFile(snapshot,destination,constants.COPYFILE_EXCL);
 });
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 const [, , action,source,destination]=process.argv;const raw=process.env.NEXAFIA_BACKUP_KEY;
 if(!['backup','restore'].includes(action) || !source || !destination || !raw || !/^[a-fA-F0-9]{64}$/.test(raw)) throw Error('Use backup|restore SOURCE DESTINATION and NEXAFIA_BACKUP_KEY (64 hex characters)');
 const key=Buffer.from(raw,'hex');
 try { if(action==='backup') await encryptedBackup(source,destination,key); else await restoreEncryptedBackup(source,destination,key); console.log(action==='backup'?'Encrypted backup created.':'Backup authenticated and restored to a new file.'); } finally {key.fill(0);}
}
