import {S3Client,PutObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3';
import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {encryptedBackup} from './encrypted-backup.mjs';

export function validateR2Config({account,bucket,accessKey,secretKey}) {
 if(typeof account!=='string' || !/^[a-f0-9]{32}$/.test(account) || typeof bucket!=='string' || !/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(bucket) || typeof accessKey!=='string' || !/^[A-Za-z0-9]{16,128}$/.test(accessKey) || typeof secretKey!=='string' || !/^[A-Za-z0-9]{32,128}$/.test(secretKey)) throw Error('Invalid R2 backup configuration');
}
export async function encryptedR2Backup({source,key,bucket,client,timeoutMs=120_000}) {
 if(typeof bucket!=='string' || !/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(bucket)) throw Error('Invalid R2 bucket');
 const dir=await mkdtemp(join(tmpdir(),'nexafia-r2-backup-'));
 try {
  const file=join(dir,'backup.enc');await encryptedBackup(source,file,key);
  const {size}=await stat(file);if(size>1024*1024*1024) throw Error('Backup exceeds 1 GiB upload limit');
  const md5=createHash('md5'),sha=createHash('sha256');for await(const part of createReadStream(file)){md5.update(part);sha.update(part)}
  const expected=sha.digest('hex'),objectKey=`nexafia/backups/${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID()}.enc`;
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try {
  const uploadBody=createReadStream(file);
  try {await client.send(new PutObjectCommand({Bucket:bucket,Key:objectKey,Body:uploadBody,ContentLength:size,ContentType:'application/octet-stream',ContentMD5:md5.digest('base64'),IfNoneMatch:'*'}),{abortSignal:controller.signal});} finally {uploadBody.destroy();}
  const remote=await client.send(new GetObjectCommand({Bucket:bucket,Key:objectKey}),{abortSignal:controller.signal});if(!remote.Body || typeof remote.Body[Symbol.asyncIterator]!=='function') throw Error('Remote backup verification failed');
  const verified=createHash('sha256');let received=0;
  try {for await(const part of remote.Body){received+=part.length;if(received>size)throw Error('Remote backup verification failed');verified.update(part)}} finally {remote.Body.destroy?.();}
  if(received!==size || verified.digest('hex')!==expected)throw Error('Remote backup verification failed');
  return {key:objectKey,bytes:size};
  } finally {clearTimeout(timeout);}
 } finally {await rm(dir,{recursive:true,force:true});}
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const source=process.argv[2],raw=process.env.NEXAFIA_BACKUP_KEY;
 const config={account:process.env.NEXAFIA_R2_ACCOUNT_ID,bucket:process.env.NEXAFIA_R2_BUCKET,accessKey:process.env.NEXAFIA_R2_ACCESS_KEY_ID,secretKey:process.env.NEXAFIA_R2_SECRET_ACCESS_KEY};
 try {
  if(!source || !raw || !/^[a-fA-F0-9]{64}$/.test(raw))throw Error();validateR2Config(config);
  const key=Buffer.from(raw,'hex');const client=new S3Client({region:'auto',endpoint:`https://${config.account}.r2.cloudflarestorage.com`,forcePathStyle:true,credentials:{accessKeyId:config.accessKey,secretAccessKey:config.secretKey},requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED',maxAttempts:3});
  try {await encryptedR2Backup({source,key,bucket:config.bucket,client});console.log('Encrypted backup uploaded and read-back verified.');} finally {key.fill(0);client.destroy();}
 } catch {console.error('Encrypted backup failed. Check configuration and service logs without exposing credentials.');process.exitCode=1;}
}
