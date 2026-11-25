import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { decideGroupReunion, type GroupReunion } from '../src/room/groupReunion.ts';
import type { Storage } from './storage.ts';
import { featuredActivities } from '../src/data.ts';
import { Notifications } from './notifications.ts';

// Installed only by an explicit migration, not on an existing database at import time.
export function installGroupReunionSchema(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS group_reunions (
    id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    organizer_id TEXT NOT NULL REFERENCES accounts(id), starts_at INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending','confirmed','cancelled')),
    created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS group_reunion_members (
    reunion_id TEXT NOT NULL REFERENCES group_reunions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES accounts(id), response TEXT NOT NULL CHECK(response IN ('pending','accepted')),
    PRIMARY KEY(reunion_id,user_id));
  CREATE INDEX IF NOT EXISTS group_reunion_members_user ON group_reunion_members(user_id,reunion_id);`);
}

type ReunionRow = { id:string; roomId:string; organizer:string; startsAt:number; status:GroupReunion['status'] };
export class GroupReunionStore {
  private storage:Storage;
  private now:()=>number;
  constructor(storage:Storage, now:()=>number) { this.storage=storage; this.now=now; }
  get(id:string,actor:string) {
    const db=this.storage.db;
    const row=db.prepare(`SELECT id,room_id AS roomId,organizer_id AS organizer,starts_at AS startsAt,status FROM group_reunions r WHERE r.id=? AND EXISTS (SELECT 1 FROM group_reunion_members m WHERE m.reunion_id=r.id AND m.user_id=?)`).get(id,actor) as ReunionRow|undefined;
    if (!row) return null;
    if (!db.prepare('SELECT 1 FROM memberships WHERE room_id=? AND user_id=?').get(row.roomId,actor) || db.prepare('SELECT 1 FROM room_history_dismissals WHERE room_id=? AND user_id=?').get(row.roomId,actor)) return null;
    if (db.prepare(`SELECT 1 FROM group_reunion_members m JOIN blocks b ON (b.user_id=? AND b.blocked_id=m.user_id) OR (b.blocked_id=? AND b.user_id=m.user_id) WHERE m.reunion_id=? LIMIT 1`).get(actor,actor,id)) return null;
    const members=db.prepare('SELECT m.user_id AS id,m.response,a.alias AS name FROM group_reunion_members m JOIN accounts a ON a.id=m.user_id WHERE m.reunion_id=? ORDER BY a.alias,a.id').all(id) as {id:string;name:string;response:'pending'|'accepted'}[];
    return { ...row, members, responses:Object.fromEntries(members.map(m=>[m.id,m.response])) as GroupReunion['responses'] };
  }
  create(actor:string, roomId:string, invitees:string[], startsAt:number, requestId?:string) {
    const db=this.storage.db, now=this.now();
    if (!Array.isArray(invitees) || invitees.length<2 || invitees.length>5 || invitees.some(id=>typeof id!=='string' || !id || id===actor) || new Set(invitees).size!==invitees.length || !Number.isSafeInteger(startsAt) || startsAt<now+300000 || startsAt>now+366*86400000) throw Error('invalid_reunion');
    return this.storage.transaction(()=>{
      if (requestId) {
        const existing=db.prepare('SELECT organizer_id AS organizer,room_id AS roomId,starts_at AS startsAt FROM group_reunions WHERE id=?').get(requestId);
        if (existing) {
          const members=db.prepare('SELECT user_id FROM group_reunion_members WHERE reunion_id=? AND user_id<>? ORDER BY user_id').all(requestId,actor).map(row=>String(row.user_id));
          if (existing.organizer!==actor || existing.roomId!==roomId || existing.startsAt!==startsAt || JSON.stringify(members)!==JSON.stringify([...invitees].sort())) throw Error('invalid_reunion');
          return requestId;
        }
      }
      const row=db.prepare('SELECT session_json FROM rooms WHERE id=?').get(roomId);
      let session:{phase?:unknown;sessionUntil?:unknown};
      try { session=JSON.parse(String(row?.session_json)); } catch { throw Error('invalid_reunion'); }
      if (session.phase!=='closed' || typeof session.sessionUntil!=='number' || !Number.isFinite(session.sessionUntil) || session.sessionUntil<=0) throw Error('invalid_reunion');
      const ids=[actor,...invitees];
      for(const id of ids) {
        if (!this.storage.canParticipate(id) || !db.prepare('SELECT 1 FROM memberships WHERE room_id=? AND user_id=?').get(roomId,id) || db.prepare('SELECT 1 FROM room_history_dismissals WHERE room_id=? AND user_id=?').get(roomId,id) || db.prepare("SELECT 1 FROM restrictions WHERE user_id=? AND (kind='ban' OR until_at>?)").get(id,now)) throw Error('invalid_reunion');
      }
      for(const a of ids) for(const b of ids) if(a!==b && db.prepare('SELECT 1 FROM blocks WHERE user_id=? AND blocked_id=?').get(a,b)) throw Error('invalid_reunion');
      const id=requestId || randomUUID(); db.prepare("INSERT INTO group_reunions VALUES(?,?,?,?, 'pending',?)").run(id,roomId,actor,startsAt,now);
      const insert=db.prepare('INSERT INTO group_reunion_members VALUES(?,?,?)');
      for(const person of ids) insert.run(id,person,person===actor?'accepted':'pending');
      new Notifications(this.storage,this.now).groupEvent(id,actor,'group_invitation');
      return id;
    });
  }
  decide(id:string,actor:string,action:'accept'|'decline'|'cancel'|'withdraw') {
    return this.storage.transaction(()=>{
      const current=this.get(id,actor); if(!current) throw Error('invalid_decision');
      const db=this.storage.db;
      if (action==='accept' && current.startsAt<=this.now()) throw Error('invalid_decision');
      const blocked=db.prepare(`SELECT 1 FROM group_reunion_members a JOIN group_reunion_members b ON b.reunion_id=a.reunion_id JOIN blocks x ON x.user_id=a.user_id AND x.blocked_id=b.user_id WHERE a.reunion_id=? LIMIT 1`).get(id);
      const missing=db.prepare('SELECT 1 FROM group_reunion_members m WHERE m.reunion_id=? AND (NOT EXISTS (SELECT 1 FROM memberships p WHERE p.room_id=? AND p.user_id=m.user_id) OR EXISTS (SELECT 1 FROM room_history_dismissals d WHERE d.room_id=? AND d.user_id=m.user_id))').get(id,current.roomId,current.roomId);
      if (action==='accept') {
        if(blocked || missing) throw Error('invalid_decision');
        for (const member of Object.keys(current.responses)) {
          if (!this.storage.canParticipate(member) || db.prepare("SELECT 1 FROM restrictions WHERE user_id=? AND (kind='ban' OR until_at>?)").get(member,this.now())) throw Error('invalid_decision');
        }
      }
      const result=decideGroupReunion(current,actor,action);
      if (result.status==='cancelled' && current.status==='confirmed') this.storage.cancelPrivateMeeting(id,this.now());
      if (current.status==='pending' && result.status==='confirmed') {
        const source=db.prepare('SELECT COALESCE(m.theme_id,r.activity_id) AS theme FROM rooms r LEFT JOIN scheduled_meetings m ON m.id=r.activity_id WHERE r.id=?').get(current.roomId);
        const theme=featuredActivities.find(activity=>activity.id===source?.theme);
        if (!theme || current.startsAt<this.now()+300000) throw Error('invalid_decision');
        const members=Object.keys(result.responses);
        for(const member of members) if(db.prepare('SELECT 1 FROM reservations r JOIN offerings a ON a.activity_id=r.activity_id LEFT JOIN scheduled_meetings m ON m.id=r.activity_id WHERE r.user_id=? AND a.starts_at<? AND a.starts_at+COALESCE(m.duration,40)*60000>?').get(member,current.startsAt+theme.duration*60000,current.startsAt)) throw Error('reservation_conflict');
        db.prepare('INSERT INTO offerings VALUES(?,?)').run(id,current.startsAt);
        db.prepare('INSERT INTO scheduled_meetings(id,theme_id,capacity,duration,created_at,created_by) VALUES(?,?,?,?,?,?)').run(id,theme.id,members.length,theme.duration,this.now(),current.organizer);
        db.prepare('INSERT INTO private_meetings(meeting_id) VALUES(?)').run(id);
        const addMember=db.prepare('INSERT INTO private_meeting_members VALUES(?,?)');
        const addReservation=db.prepare('INSERT INTO reservations VALUES(?,?,?)');
        for(const member of members){addMember.run(id,member);addReservation.run(member,id,this.now());}
        new Notifications(this.storage,this.now).groupEvent(id,actor,'group_confirmed');
      }
      db.prepare('UPDATE group_reunions SET status=? WHERE id=?').run(result.status,id);
      db.prepare('UPDATE group_reunion_members SET response=? WHERE reunion_id=? AND user_id=?').run(result.responses[actor],id,actor);
      if (result.status==='cancelled') new Notifications(this.storage,this.now).groupCancelled(id);
      return this.get(id,actor)!;
    });
  }
}
