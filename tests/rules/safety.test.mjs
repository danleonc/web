import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSafety,
  startRemoval,
  voteRemoval,
  resolveSafety,
  safetyView,
  applyExpulsions,
} from "../../src/safety/rules.ts";
import { createSession, sessionReducer } from "../../src/room/engine.ts";
const open = (people, target = "b") =>
  startRemoval(createSafety(), "a", target, "acoso", people, 1000, "ballot");
test("expulsión: mayoría fija y al menos dos votos de otras personas, incluso en grupos pequeños", () => {
  assert.equal(open(["a", "b"]).ballot, null);
  for (const [count, threshold] of [
    [3, 2],
    [4, 2],
    [5, 3],
    [6, 3],
  ]) {
    const people = "abcdef".slice(0, count).split(""),
      s = open(people);
    assert.equal(s.ballot.threshold, threshold);
    assert.equal(s.ballot.votes.a, "remove");
    assert.equal(s.ballot.eligible.includes("b"), false);
  }
});
test("expulsión: votos privados, una decisión por cuenta y sin suplantar al resto ni votar por uno mismo", () => {
  const s = open(["a", "b", "c", "d"]);
  const view = safetyView(s, "d");
  assert.equal(view.ballot.canVote, true);
  assert.equal("votes" in view.ballot, false);
  assert.equal("eligible" in view.ballot, false);
  assert.equal(safetyView(s, "a").ballot.yourVote, "remove");
  assert.equal(safetyView(s, "b").ballot.canVote, false);
  for (const [id, ballot] of [
    ["b", "ballot"],
    ["unknown", "ballot"],
    ["a", "ballot"],
    ["c", "forged"],
  ])
    assert.equal(
      voteRemoval(s, id, ballot, "remove", ["a", "b", "c", "d"], 1100),
      s,
    );
  assert.equal(
    voteRemoval(s, "c", "ballot", "remove", ["a", "b", "d"], 1100),
    s,
  );
  const no = voteRemoval(s, "c", "ballot", "keep", ["a", "b", "c", "d"], 1100);
  assert.equal(
    voteRemoval(no, "c", "ballot", "remove", ["a", "b", "c", "d"], 1200),
    no,
  );
});
test("expulsión: desconectarse no baja el umbral, silencio no suma y un voto tardío no produce expulsión", () => {
  const s = open(["a", "b", "c", "d", "e", "f"]);
  const partial = voteRemoval(
    s,
    "c",
    "ballot",
    "remove",
    ["a", "b", "c"],
    1100,
  );
  assert.equal(partial.ballot.threshold, 3);
  assert.deepEqual(partial.expelled, []);
  const late = voteRemoval(
    partial,
    "d",
    "ballot",
    "remove",
    ["a", "b", "d"],
    61000,
  );
  assert.equal(late.ballot, null);
  assert.deepEqual(late.expelled, []);
  assert.match(late.notice, /silencio/);
  assert.equal(
    startRemoval(late, "a", "b", "acoso", ["a", "b", "c"], 62000, "new"),
    late,
  );
  assert.ok(
    startRemoval(late, "a", "b", "acoso", ["a", "b", "c"], 122000, "new")
      .ballot,
  );
});
test("expulsión: resultado solo del encuentro, retira presencia y recalcula quórum sin banear una cuenta", () => {
  const s = voteRemoval(
    open(["a", "b", "c"]),
    "c",
    "ballot",
    "remove",
    ["a", "b", "c"],
    1100,
  );
  assert.deepEqual(s.expelled, ["b"]);
  assert.equal(s.ballot, null);
  let session = createSession(["B", "C"], "A", 3, 6, 40, 3, 1000);
  session = {
    ...session,
    participants: session.participants.map((p, i) => ({
      ...p,
      id: "abc"[i],
      present: true,
    })),
  };
  session = sessionReducer(session, { type: "start", now: 1000 });
  const paused = sessionReducer(applyExpulsions(session, s), {
    type: "tick",
    now: 1100,
  });
  assert.equal(paused.phase, "paused");
  assert.equal(paused.participants.find((p) => p.id === "b").present, false);
  assert.equal("restriction" in s, false);
  assert.equal(resolveSafety(s, 999999), s);
});
