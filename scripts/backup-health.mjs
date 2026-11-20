import {readFile,stat,statfs,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readRenderDisk,evaluateRenderDisk} from './render-disk-health.mjs';

export function evaluateBackupHealth({status,now,exists,freeBytes,backupBytes}) {
 const alerts=[];
 const m=/^OK (\S+) (nexafia-\d{8}T\d{6}Z-[a-f0-9]{8}\.enc)$/.exec((status||'').trim());
 const when=m?Date.parse(m[1]):NaN;
 if(!m || !Number.isFinite(when) || when>now+5*60_000) alerts.push('El último respaldo registró un error o no tiene un estado válido.');
 else if(now-when>36*3600_000) alerts.push('El último respaldo tiene más de 36 horas.');
 if(!exists) alerts.push('No se encontró la última copia guardada.');
 if(!Number.isFinite(freeBytes) || !Number.isFinite(backupBytes) || freeBytes<Math.max(1024**3,backupBytes*3)) alerts.push('Hay poco espacio disponible para los siguientes respaldos.');
 return alerts;
}

export async function checkBackupHealth(configRoot,now=Date.now(),remoteCheck=readRenderDisk) {
 const dir=join(configRoot,'copias');
 let status=''; try {status=await readFile(join(configRoot,'ultimo-estado.txt'),'utf8')} catch {}
 const m=/^OK \S+ (nexafia-\d{8}T\d{6}Z-[a-f0-9]{8}\.enc)$/.exec(status.trim());
 let exists=false,backupBytes=0,freeBytes=NaN;
 if(m) try {const f=await stat(join(dir,m[1])); exists=f.isFile(); backupBytes=f.size} catch {}
 try {const fs=await statfs(dir);freeBytes=Number(fs.bavail)*Number(fs.bsize)} catch {}
 const alerts=evaluateBackupHealth({status,now,exists,freeBytes,backupBytes});
 try {const identity=join(configRoot,'render_backup_ed25519'),hosts=join(configRoot,'known_hosts.render');await Promise.all([access(identity),access(hosts)]);const disk=await remoteCheck(identity,hosts);const warning=evaluateRenderDisk(disk);if(warning) alerts.push(warning);}
 catch {alerts.push('No se pudo comprobar el espacio del servidor de Nexafia en Render.');}
 return alerts;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 if(!process.argv[2]) throw Error('Ruta de configuración requerida');
 const alerts=await checkBackupHealth(process.argv[2]);
 if(alerts.length) {console.log(alerts.join('\n'));process.exitCode=1;} else console.log('Respaldo reciente y espacio disponible local y en Render.');
}
