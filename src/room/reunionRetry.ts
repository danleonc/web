type Proposal = {accountId:string;roomId:string;invitees:string[];startsAt:number};
type Retry = {key:string;id:string;createdAt:number};
type RetryStorage = Pick<Storage,'getItem'|'setItem'>;
const storageKey='nexafia.group-reunion-retries.v1';
const lifetime=7*86400000;

async function fingerprint(proposal:Proposal) {
  const input=JSON.stringify([proposal.accountId,proposal.roomId,[...proposal.invitees].sort(),proposal.startsAt]);
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
}
function read(storage:RetryStorage,now:number):Retry[] {
  try {
    const data:unknown=JSON.parse(storage.getItem(storageKey) || '[]');
    return Array.isArray(data)?data.filter((r):r is Retry=>!!r && typeof r.key==='string' && /^[a-f0-9]{64}$/.test(r.key) && typeof r.id==='string' && /^[a-f0-9-]{36}$/.test(r.id) && typeof r.createdAt==='number' && r.createdAt<=now && r.createdAt>now-lifetime).slice(-10):[];
  } catch {return [];}
}
export async function retryId(storage:RetryStorage,proposal:Proposal,now=Date.now()) {
  const key=await fingerprint(proposal), entries=read(storage,now), found=entries.find(item=>item.key===key);
  if(found) return found.id;
  const id=crypto.randomUUID();
  storage.setItem(storageKey,JSON.stringify([...entries.slice(-9),{key,id,createdAt:now}]));
  return id;
}
export async function clearRetry(storage:RetryStorage,proposal:Proposal,now=Date.now()) {
  const key=await fingerprint(proposal);
  storage.setItem(storageKey,JSON.stringify(read(storage,now).filter(item=>item.key!==key)));
}
