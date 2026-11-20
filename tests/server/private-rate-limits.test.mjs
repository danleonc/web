import test from 'node:test';
import assert from 'node:assert/strict';
import {Storage,digest} from '../../server/storage.ts';

test('los límites de notificaciones ocultan la clave y preservan el límite anterior',()=>{
 const s=new Storage(':memory:');
 try {
  const raw='push-sub-ip:198.51.100.25',hashed=digest(raw),now=1000;
  s.db.prepare('INSERT INTO auth_limits VALUES(?,?,?)').run(raw,2,now+10000);
  assert.equal(s.takePrivateLimit(raw,3,10000,now),true);
  assert.equal(s.takePrivateLimit(raw,3,10000,now),false);
  assert.equal(s.db.prepare('SELECT count FROM auth_limits WHERE key=?').get(hashed).count,3);
  assert.equal(s.db.prepare('SELECT key FROM auth_limits WHERE key=?').get(raw),undefined);
 } finally {s.close();}
});
test('la transición conserva ambos contadores activos sin reducir límites',()=>{
 const s=new Storage(':memory:');
 try {
  const raw='push-test:user-123',hashed=digest(raw),now=1000;
  s.db.prepare('INSERT INTO auth_limits VALUES(?,?,?)').run(raw,2,5000);
  s.db.prepare('INSERT INTO auth_limits VALUES(?,?,?)').run(hashed,3,6000);
  assert.equal(s.takePrivateLimit(raw,5,10000,now),false);
  const row=s.db.prepare('SELECT count,until_at FROM auth_limits WHERE key=?').get(hashed);
  assert.equal(row.count,5); assert.equal(row.until_at,6000);
  assert.equal(s.db.prepare('SELECT key FROM auth_limits WHERE key=?').get(raw),undefined);
 } finally {s.close();}
});
