import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const remote=`const fs=require('node:fs');const mount='/var/data';if(!fs.readFileSync('/proc/self/mountinfo','utf8').split('\\n').some(x=>x.split(' ')[4]===mount))throw Error('Expected disk is not mounted');const s=fs.statfsSync(mount);console.log(JSON.stringify({total:s.blocks*s.bsize,available:s.bavail*s.bsize}));`;
const remoteCommand=`node -e "eval(Buffer.from('${Buffer.from(remote).toString('base64')}','base64').toString())"`;
const ssh=promisify(execFile);

export function evaluateRenderDisk(disk) {
 if(!disk || !Number.isSafeInteger(disk.total) || !Number.isSafeInteger(disk.available) || disk.total<=0 || disk.available<0 || disk.available>disk.total) throw Error('Invalid disk data');
 const remaining=disk.available/disk.total;
 if(remaining<=0.1) return 'Espacio crítico en el disco de Nexafia en Render: queda 10 % o menos.';
 if(remaining<=0.2) return 'Poco espacio en el disco de Nexafia en Render: queda 20 % o menos.';
 return null;
}
export async function readRenderDisk(identity,knownHosts,run) {
 if(!identity || !knownHosts) throw Error('Missing SSH configuration');
 const execute=run || (async()=>{
  const {stdout}=await ssh('ssh',['-T','-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=10','-o',`UserKnownHostsFile=${knownHosts}`,'-i',identity,'srv-dbr2npjl550s73c3mte0@ssh.oregon.render.com',remoteCommand],{timeout:20000,maxBuffer:2048,windowsHide:true});
  return stdout;
 });
 const output=await execute();
 if(typeof output!=='string'||output.length>2048) throw Error('Invalid disk response');
 const data=JSON.parse(output.trim());evaluateRenderDisk(data);return {total:data.total,available:data.available};
}
