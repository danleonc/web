import test from "node:test";
import assert from "node:assert/strict";
import {
  createSession,
  sessionReducer,
  presentPeople,
  majority,
  roundMs,
} from "../../src/room/engine.ts";
const now = 1_000_000;
const initial = () =>
  createSession(
    ["Ana", "Bruno", "Cata", "Dani", "Eva", "Fran", "Gabi"],
    "Yo",
    3,
    6,
    40,
    3,
    now,
  );
const apply = (s, type, extra = {}) =>
  sessionReducer(s, { type, now, ...extra });
const running = () => apply(initial(), "start");
test("minimum is mandatory; host is not counted and capacity is never exceeded", () => {
  let s = initial();
  for (const p of s.participants.filter((p) => !p.own))
    s = apply(s, "presence", { id: p.id, present: false });
  assert.equal(presentPeople(s).length, 1);
  assert.equal(apply(s, "start").phase, "lobby");
  s = apply(s, "presence", { id: "peer-0", present: true });
  assert.equal(apply(s, "start").phase, "lobby");
  s = apply(s, "presence", { id: "peer-1", present: true });
  assert.equal(apply(s, "start").phase, "question");
  for (const p of s.participants.filter((p) => !p.own))
    s = apply(s, "presence", { id: p.id, present: true });
  assert.equal(presentPeople(s).length, 6);
});
test("lobby expires without moving or starting an undersized group", () => {
  let s = initial();
  for (const p of s.participants.filter((p) => !p.own))
    s = apply(s, "presence", { id: p.id, present: false });
  s = apply(s, "tick", { now: now + 300_001 });
  assert.equal(s.phase, "insufficient");
  assert.equal(s.sessionUntil, 0);
});
test("lobby with quorum starts on the deadline without needing a full room", () => {
  const s = apply(initial(), "tick", { now: now + 300_001 });
  assert.equal(s.phase, "question");
  assert.equal(presentPeople(s).length, 4);
});
test("one shared extension per round, even with repeated requests", () => {
  let s = running();
  const deadline = s.roundUntil;
  s = apply(s, "extend");
  assert.equal(s.roundUntil, deadline + 30_000);
  s = apply(s, "extend");
  assert.equal(s.roundUntil, deadline + 30_000);
});
test("typing expires visually and cannot extend time or count as a response", () => {
  let s = running();
  const deadline = s.roundUntil;
  s = apply(s, "typing", { id: "peer-0", active: true });
  assert.equal(s.participants[1].status, "pending");
  assert.equal(s.roundUntil, deadline);
  assert.ok(s.participants[1].typingUntil < now + 5000);
  s = apply(s, "tick", { now: deadline });
  assert.equal(s.phase, "conversation");
  assert.equal(s.participants[1].status, "no-response");
});
test("everyone explicitly ready, passing or listening ends a round early", () => {
  let s = running();
  s = apply(s, "response", { id: "self", status: "pass" });
  s = apply(s, "response", { id: "peer-0", status: "listen" });
  s = apply(s, "response", { id: "peer-1", status: "ready" });
  assert.equal(s.phase, "question");
  s = apply(s, "response", { id: "peer-2", status: "ready" });
  assert.equal(s.phase, "conversation");
  assert.equal(presentPeople(s).length, 4);
});
test("contributing does not automatically mean being ready; listening is not revoked by stickers", () => {
  let s = running();
  s = apply(s, "response", { id: "self", status: "participated" });
  assert.equal(s.participants[0].status, "participated");
  assert.equal(s.phase, "question");
  s = apply(s, "response", { id: "self", status: "listen" });
  s = apply(s, "response", { id: "self", status: "participated" });
  assert.equal(s.participants[0].status, "listen");
});
test("a strict majority of present people, with unique votes, starts another question", () => {
  let s = apply(running(), "tick", { now: now + roundMs });
  assert.equal(majority(s), 3);
  s = apply(s, "vote", { id: "self", now: now + roundMs });
  s = apply(s, "vote", { id: "self", now: now + roundMs });
  s = apply(s, "vote", { id: "peer-6", now: now + roundMs });
  assert.equal(s.votes.length, 1);
  s = apply(s, "vote", { id: "peer-0", now: now + roundMs });
  assert.equal(s.phase, "conversation");
  s = apply(s, "vote", { id: "peer-1", now: now + roundMs });
  assert.equal(s.phase, "question");
  assert.equal(s.question, 1);
});
test("guide off leaves chat free and enabling it does not inject a question", () => {
  let s = apply(running(), "guide", { enabled: false });
  assert.equal(s.phase, "conversation");
  s = apply(s, "guide", { enabled: true });
  assert.equal(s.phase, "conversation");
  assert.equal(s.question, 0);
});
test("questions are limited; silence never fabricates votes or adds prompts", () => {
  let s = apply(running(), "tick", { now: now + roundMs });
  s = apply(s, "tick", { now: now + 5 * 60_000 });
  assert.equal(s.phase, "conversation");
  assert.equal(s.question, 0);
  assert.deepEqual(s.votes, []);
  s = { ...s, question: 2 };
  for (const id of ["self", "peer-0", "peer-1"])
    s = apply(s, "vote", { id, now: now + 5 * 60_000 });
  assert.equal(s.question, 2);
  assert.equal(s.phase, "conversation");
});
test("loss of quorum pauses; recovery resumes without imposing another prompt", () => {
  let s = running();
  s = apply(s, "presence", { id: "peer-1", present: false });
  s = apply(s, "presence", { id: "peer-2", present: false });
  assert.equal(s.phase, "paused");
  s = apply(s, "presence", { id: "peer-1", present: true, now: now + 20_000 });
  assert.equal(s.phase, "conversation");
  assert.equal(s.question, 0);
});
test("missing quorum after reconnect deadline closes, and session has a hard duration cap", () => {
  let s = running();
  s = apply(s, "presence", { id: "peer-1", present: false });
  s = apply(s, "presence", { id: "peer-2", present: false });
  s = apply(s, "tick", { now: now + 60_001 });
  assert.equal(s.phase, "insufficient");
  assert.equal(
    apply(running(), "tick", { now: now + 40 * 60_000 }).phase,
    "closed",
  );
});
test("returning to a suspended tab cannot restart an expired meeting from the current time", () => {
  const s = apply(initial(), "tick", { now: now + 300_000 + 40 * 60_000 + 1 });
  assert.equal(s.phase, "closed");
});
