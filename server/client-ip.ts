import {BlockList, isIP} from 'node:net';
import type {IncomingMessage} from 'node:http';

function normalize(value: string): string | null {
 const text=value.trim();
 if(isIP(text)===4) return text;
 if(isIP(text)!==6 || text.includes('%')) return null;
 const normalized=new URL(`http://[${text}]/`).hostname.slice(1,-1);
 const mapped=/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(normalized);
 if(mapped) {const a=parseInt(mapped[1],16),b=parseInt(mapped[2],16);return `${a>>8}.${a&255}.${b>>8}.${b&255}`;}
 return normalized;
}
export function createClientIpResolver(ranges: string[]) {
 const trusted=new BlockList();
 for(const range of ranges) {
  const parts=range.split('/'); if(parts.length>2 || !parts[0] || (parts.length===2 && !/^\d+$/.test(parts[1]))) throw Error('Invalid trusted proxy range');
  const ip=normalize(parts[0]);if(!ip) throw Error('Invalid trusted proxy range');
  const family=isIP(ip), max=family===4?32:128, prefix=parts.length===1?max:Number(parts[1]);
  if(!Number.isInteger(prefix)||prefix<1||prefix>max) throw Error('Invalid trusted proxy range');
  trusted.addSubnet(ip,prefix,family===4?'ipv4':'ipv6');
 }
 const isTrusted=(ip: string)=>trusted.check(ip,isIP(ip)===4?'ipv4':'ipv6');
 return (req: Pick<IncomingMessage,'socket'|'headers'>): string => {
  const peer=normalize(req.socket.remoteAddress || '') || 'unknown';
  if(peer==='unknown' || !isTrusted(peer)) return peer;
  const raw=req.headers['x-forwarded-for'];
  if(typeof raw!=='string'||raw.length>2048) return peer;
  const pieces=raw.split(',');if(pieces.length>10) return peer;
  const chain=pieces.map(normalize);if(chain.some(ip=>ip===null)) return peer;
  let address=peer;
  for(let i=chain.length-1;i>=0 && isTrusted(address);i--) address=chain[i]!;
  return address;
 };
}

const requestIps=new WeakMap<IncomingMessage,string>();
export function setClientIp(req: IncomingMessage, ip: string) { requestIps.set(req,ip); }
export function clientIp(req: IncomingMessage) {return requestIps.get(req) || normalize(req.socket.remoteAddress || '') || 'unknown';}
