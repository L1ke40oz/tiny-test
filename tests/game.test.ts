import test from "node:test";
import assert from "node:assert/strict";
import { Room } from "../server/game.js";

const started = () => {
  const room = new Room("TESTROOM", "host", "房主");
  room.join("friend", "队友");
  room.start("host", 10, 1000);
  return room;
};
const answer = (room: Room, token: string, correct = true, now = 1100) => {
  const q = room.deck[room.round - 1];
  room.submit(
    token,
    room.matchId,
    q.id,
    correct ? q.answer : (q.answer + 1) % 4,
    now,
  );
};

test("answers, other players’ selections and identity secrets stay private until settlement", () => {
  const room = started();
  answer(room, "host");
  const publicState = room.snapshot("friend", 1100);
  assert.equal(publicState.answer, null);
  assert.equal(publicState.explanation, null);
  assert.deepEqual(publicState.results, []);
  assert.equal(publicState.myAnswer, null);
  assert.equal(publicState.players[0].submitted, true);
  assert.ok(!("answer" in publicState.question!));
  assert.ok(
    publicState.players.every((p) => !("token" in p) && !("weakStreak" in p)),
  );
});

test("all submitted resolves early exactly once, with a shared team bonus", () => {
  const room = started();
  const hp = room.bossHp;
  answer(room, "host");
  answer(room, "friend");
  assert.equal(room.phase, "reveal");
  assert.equal(room.deadline, 3100);
  assert.equal(room.bossHp, hp - 30);
  assert.equal(room.snapshot("host").players[0].damage, 10);
  room.tick(1200);
  room.tick(1300);
  assert.equal(room.bossHp, hp - 30);
  assert.equal(room.snapshot("host").players[0].attempted, 1);
});

test("duplicate submissions preserve the first choice and cannot deal extra damage", () => {
  const room = started();
  answer(room, "host", false);
  answer(room, "host", true);
  answer(room, "friend", true);
  const host = room.snapshot("host").players[0];
  assert.equal(host.correct, 0);
  assert.equal(host.hp, 2);
  assert.equal(host.damage, 0);
});

test("server cutoff rejects a late answer and counts a timeout", () => {
  const room = started();
  answer(room, "host", true, 10_999);
  assert.throws(() => answer(room, "friend", true, 11_000), /截止/);
  room.tick(11_000);
  const friend = room.snapshot("friend").players[1];
  assert.equal(friend.hp, 2);
  assert.equal(friend.attempted, 1);
  assert.equal(room.teamDamage, 0);
});

test("old match and question identifiers never apply to the current question", () => {
  const room = started();
  const oldQuestion = room.deck[0].id;
  answer(room, "host");
  answer(room, "friend");
  room.tick(3100);
  assert.equal(room.round, 2);
  assert.throws(
    () => room.submit("host", room.matchId, oldQuestion, 0, 3200),
    /结束/,
  );
  assert.throws(
    () => room.submit("host", "previous-match", room.deck[1].id, 0, 3200),
    /结束/,
  );
  assert.equal(room.answers.size, 0);
});

test("host authorization, spectator submissions and invalid choices are enforced on the server", () => {
  const room = started();
  room.join("watcher", "观众");
  assert.throws(() => room.pause("friend", 1100), /房主/);
  assert.throws(() => room.start("friend", 10, 1100), /房主/);
  assert.throws(() => answer(room, "watcher"), /观战/);
  assert.throws(
    () => room.submit("host", room.matchId, room.deck[0].id, 9, 1100),
    /无效选项/,
  );
  assert.throws(() => room.setRole("friend", "spectator"), /下一局/);
});

test("pause freezes remaining time, rejects answers and resumes without losing the round", () => {
  const room = started();
  answer(room, "host", true, 2000);
  room.pause("host", 4000);
  room.tick(50_000);
  assert.equal(room.phase, "paused");
  assert.equal(room.round, 1);
  assert.equal(room.snapshot("friend").answer, null);
  assert.throws(() => answer(room, "friend", true, 50_000), /作答/);
  room.resume("host", 60_000);
  assert.equal(room.deadline, 67_000);
  answer(room, "friend", true, 60_100);
  assert.equal(room.phase, "reveal");
});

test("role changes take effect on the next question and preserve accumulated scores and HP", () => {
  const room = started();
  room.setRole("host", "spectator");
  assert.equal(room.snapshot("host").players[0].role, "player");
  answer(room, "host", false);
  answer(room, "friend");
  room.tick(3100);
  const host = room.snapshot("host").players[0];
  assert.equal(host.role, "spectator");
  assert.equal(host.hp, 2);
  assert.equal(host.attempted, 1);
  assert.throws(() => answer(room, "host", true, 3200), /观战/);
  room.setRole("host", "player");
  answer(room, "friend", true, 3200);
  room.tick(5200);
  assert.equal(room.snapshot("host").players[0].hp, 2);
  assert.equal(room.snapshot("host").players[0].role, "player");
});

test("a disconnected player cannot hold up settlement, fake a team bonus or escape a timeout", () => {
  const room = started();
  room.online("friend", false);
  answer(room, "host");
  assert.equal(room.phase, "reveal");
  assert.equal(room.teamDamage, 0);
  const friend = room.snapshot("friend").players[1];
  assert.equal(friend.attempted, 1);
  assert.equal(friend.hp, 2);
  room.online("friend", true);
  assert.equal(room.snapshot("friend").players[1].hp, 2);
});

test("all offline pauses the game; reconnect restores stable identity and submission", () => {
  const room = started();
  const id = room.snapshot("host").meId;
  answer(room, "host");
  room.online("host", false);
  room.online("friend", false);
  room.tick(1200);
  assert.equal(room.phase, "paused");
  room.join("host", "不同昵称");
  const state = room.snapshot("host");
  assert.equal(state.meId, id);
  assert.equal(state.myAnswer, room.deck[0].answer);
  assert.equal(state.players[0].name, "房主");
});

test("eliminated players only watch and do not block, attack or accrue more attempted questions", () => {
  const room = started();
  for (let index = 0; index < 3; index++) {
    const now = 1100 + index * 2100;
    if (index === 2) room.setRole("host", "player");
    answer(room, "host", false, now);
    answer(room, "friend", true, now);
    room.tick(now + 2000);
  }
  assert.equal(room.phase, "question");
  assert.deepEqual(room.eligible, ["friend"]);
  assert.equal(room.snapshot("host").players[0].hp, 0);
  assert.throws(() => answer(room, "host", true, 7400), /已倒下/);
  assert.throws(() => room.setRole("host", "player"), /已倒下/);
  room.online("host", false);
  room.join("host", "房主");
  assert.equal(room.snapshot("host").players[0].hp, 0);
  room.setRole("host", "spectator");
  answer(room, "friend", true, 7400);
  assert.equal(room.phase, "reveal");
  assert.equal(room.results.length, 1);
  assert.equal(room.teamDamage, 0);
  room.tick(9400);
  const host = room.snapshot("host").players[0];
  assert.equal(host.hp, 0);
  assert.equal(host.damage, 0);
  assert.equal(host.attempted, 3);
  assert.equal(host.role, "spectator");
  assert.throws(() => room.setRole("host", "player"), /已倒下/);
});

test("all participants eliminated ends the match despite healthy spectators; replay restores HP", () => {
  const room = new Room("WIPE", "host", "房主");
  room.join("friend", "队友");
  room.join("watcher", "观众");
  room.setRole("watcher", "spectator");
  room.start("host", 10, 1000);
  const previousMatch = room.matchId;
  for (let index = 0; index < 3; index++) {
    const now = 1100 + index * 2100;
    answer(room, "host", false, now);
    answer(room, "friend", false, now);
    room.tick(now + 2000);
  }
  assert.equal(room.phase, "finished");
  assert.equal(room.outcome, "defeat");
  assert.equal(room.round, 3);
  assert.equal(room.snapshot("watcher").players[2].hp, 3);
  room.start("host", 10, 8000);
  assert.notEqual(room.matchId, previousMatch);
  assert.ok(room.snapshot("host").players.every((player) => player.hp === 3));
  assert.equal(room.snapshot("host").players[0].attempted, 0);
  answer(room, "host", true, 8100);
});

test("the last surviving host cannot leave only eliminated teammates in battle", () => {
  const room = started();
  for (let index = 0; index < 3; index++) {
    const now = 1100 + index * 2100;
    answer(room, "host", true, now);
    answer(room, "friend", false, now);
    room.tick(now + 2000);
  }
  assert.throws(() => room.setRole("host", "spectator"), /存活/);
});

test("capacity, zero-player start and the last active player are guarded", () => {
  const room = new Room("CAPACITY", "host", "房主");
  room.setRole("host", "spectator");
  assert.throws(() => room.start("host", 10, 1000), /至少/);
  room.setRole("host", "player");
  for (let i = 0; i < 7; i++) room.join(`p${i}`, `队员${i}`);
  assert.equal(
    room.snapshot("host").players.filter((p) => p.role === "player").length,
    6,
  );
  assert.throws(() => room.join("overflow", "更多人"), /房间已满/);
  assert.throws(() => room.setRole("p6", "player"), /席位/);
  const solo = new Room("SOLO", "host", "房主");
  solo.start("host", 10, 1000);
  assert.throws(() => solo.setRole("host", "spectator"), /至少/);
});

test("final attacks are credited equally, and replay resets match state", () => {
  const room = started();
  room.bossHp = 1;
  answer(room, "host");
  answer(room, "friend");
  room.tick(3100);
  assert.equal(room.outcome, "victory");
  assert.equal(
    room.snapshot("host").players[0].damage,
    room.snapshot("host").players[1].damage,
  );
  const oldMatch = room.matchId;
  room.start("host", 8, 4000);
  assert.notEqual(room.matchId, oldMatch);
  assert.equal(room.round, 1);
  assert.equal(room.results.length, 0);
  assert.equal(room.snapshot("host").players[0].damage, 0);
});

test("a surviving team still loses at the 15-question limit if the Boss remains", () => {
  const room = started();
  room.bossHp = 10_000;
  const seen = new Set<string>();
  for (let index = 0; index < 15; index++) {
    seen.add(room.deck[room.round - 1].id);
    const now = 1100 + index * 2100;
    answer(room, "host", true, now);
    answer(room, "friend", true, now);
    room.tick(now + 2000);
  }
  assert.equal(room.phase, "finished");
  assert.equal(room.outcome, "defeat");
  assert.equal(seen.size, 15);
  assert.equal(room.snapshot("host").players[0].attempted, 15);
});

test("host history reveals only settled questions and remains available on later rounds", () => {
  const room = started();
  answer(room, "host");
  assert.equal(room.snapshot("host").history.length, 0);
  assert.ok(
    room
      .snapshot("host")
      .activities.some((activity) => activity.text.includes("已提交")),
  );
  answer(room, "friend");
  assert.equal(room.snapshot("host").history[0].results.length, 2);
  assert.equal(room.snapshot("friend").history.length, 0);
  assert.equal(room.snapshot("friend").activities.length, 0);
  room.tick(3100);
  const nextRound = room.snapshot("host");
  assert.equal(nextRound.answer, null);
  assert.equal(nextRound.history.length, 1);
  assert.equal(nextRound.history[0].round, 1);
});

test("third correct answer gains a combo bonus, and a wrong answer breaks the combo", () => {
  const room = started();
  for (let index = 0; index < 3; index++) {
    const now = 1100 + index * 2100;
    answer(room, "host", true, now);
    answer(room, "friend", false, now);
    room.tick(now + 2000);
  }
  assert.equal(room.snapshot("host").players[0].damage, 35);
  answer(room, "host", false, 7400);
  room.tick(9400);
  answer(room, "host", true, 9500);
  assert.equal(room.snapshot("host").players[0].damage, 45);
});
