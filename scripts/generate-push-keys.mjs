// Run explicitly on the chosen server. Never print the private key.
import { writeFileSync } from 'node:fs';
import webpush from 'web-push';
const destination=process.argv[2] || 'deploy/.env.push';
if(!/(^|\/)\.env\.[\w-]+$/.test(destination))throw Error('Choose a private .env.* destination.');
const keys=webpush.generateVAPIDKeys();
writeFileSync(destination,`ENTRE_VAPID_PUBLIC_KEY=${keys.publicKey}\nENTRE_VAPID_PRIVATE_KEY=${keys.privateKey}\n# Complete the contact before starting the pilot.\nENTRE_VAPID_SUBJECT=\n`,{mode:0o600,flag:'wx'});
console.log('Created private VAPID configuration at '+destination+'. Complete its contact and keep it out of Git.');
