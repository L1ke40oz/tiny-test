import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { io as client, type Socket } from "socket.io-client";
import { createApp } from "../server/app.js";
import type { Reply, Snapshot } from "../shared/types.js";

const request = (
  socket: Socket,
  event: string,
  data: Record<string, unknown> = {},
) => socket.timeout(3000).emitWithAck(event, data) as Promise<Reply>;
const once = <T = void>(socket: Socket, event: string) =>
  new Promise<T>((resolve) => socket.once(event, resolve));

test(
  "six real socket clients share a room, enforce host actions, settle early and reconnect",
  { timeout: 15_000 },
  async (t) => {
    const { app, rooms } = await createApp();
    const address = await app.listen({ port: 0, host: "127.0.0.1" });
    const sockets: Socket[] = [];
    const states = new Map<Socket, Snapshot>();
    t.after(async () => {
      for (const socket of sockets) socket.disconnect();
      await app.close();
    });
    async function connect(token = randomUUID()) {
      const socket = client(address, {
        auth: { token },
        forceNew: true,
        reconnection: false,
        transports: ["websocket"],
      });
      sockets.push(socket);
      socket.on("room:snapshot", (state) => states.set(socket, state));
      await once(socket, "connect");
      return socket;
    }
    const hostToken = randomUUID();
    const host = await connect(hostToken);
    const created = await request(host, "room:create", { name: "房主" });
    assert.equal(created.ok, true);
    assert.match(created.code!, /^[A-F0-9]{12}$/);
    const code = created.code!;
    const players = [host];
    for (let i = 1; i < 6; i++) {
      const socket = await connect();
      players.push(socket);
      assert.equal(
        (await request(socket, "room:join", { code, name: `队员${i}` })).ok,
        true,
      );
    }
    const health = await app.inject("/api/health");
    assert.equal(health.statusCode, 200);
    assert.equal(
      (await request(players[1], "match:start", { seconds: 10 })).ok,
      false,
    );
    assert.equal(
      (await request(host, "match:start", { seconds: 10 })).ok,
      true,
    );
    const room = rooms.get(code)!;
    const q = room.deck[0];
    const firstId = states.get(host)!.meId;
    const matchId = states.get(host)!.matchId;
    assert.equal(states.get(host)!.players.length, 6);
    assert.equal(states.get(host)!.answer, null);
    const payload = { matchId, questionId: q.id, choice: q.answer };
    await request(host, "answer:submit", payload);
    assert.equal(states.get(players[1])!.myAnswer, null);
    assert.equal(states.get(players[1])!.answer, null);
    assert.equal(
      (
        await request(host, "answer:submit", {
          ...payload,
          choice: (q.answer + 1) % 4,
        })
      ).ok,
      true,
    );
    for (const socket of players.slice(1))
      assert.equal((await request(socket, "answer:submit", payload)).ok, true);
    assert.equal(states.get(host)!.phase, "reveal");
    assert.equal(states.get(host)!.answer, q.answer);
    for (const socket of players) {
      // Flush prior broadcasts on each independent connection before inspecting it.
      await request(socket, "room:join", { code, name: "ignored" });
      assert.equal(states.get(socket)!.bossHp, room.bossMaxHp - 70);
      assert.equal(
        states.get(socket)!.players.find((p) => p.id === firstId)!.damage,
        10,
      );
    }
    assert.equal((await request(players[1], "match:pause")).ok, false);
    assert.equal((await request(host, "match:pause")).ok, true);
    host.disconnect();
    const reconnected = await connect(hostToken);
    assert.equal(
      (await request(reconnected, "room:join", { code, name: "房主" })).ok,
      true,
    );
    assert.equal(states.get(reconnected)!.meId, firstId);
    assert.equal(states.get(reconnected)!.myAnswer, q.answer);
    assert.equal(states.get(reconnected)!.phase, "paused");
    assert.equal((await request(reconnected, "match:resume")).ok, true);

    const outsider = await connect();
    assert.equal((await request(outsider, "match:pause")).ok, false);
    assert.equal(
      (await request(outsider, "room:join", { code, name: "观众" })).ok,
      true,
    );
    assert.equal(states.get(outsider)!.players.at(-1)!.role, "spectator");
    assert.equal((await request(outsider, "answer:submit", payload)).ok, false);

    const replaced = once(reconnected, 'session:replaced');
    const disconnected = once(reconnected, 'disconnect');
    const newControl = await connect(hostToken);
    assert.equal((await request(newControl, 'room:join', { code, name: '房主' })).ok, true);
    await replaced; await disconnected;
    assert.equal(states.get(newControl)!.meId, firstId);
    assert.equal(states.get(newControl)!.players.find(p => p.id === firstId)!.online, true);
    assert.equal(states.get(newControl)!.players.length, 7);

    const outsiderId = states.get(outsider)!.meId;
    assert.equal((await request(outsider, 'room:leave')).ok, true);
    assert.equal(room.snapshot(hostToken).players.find(player => player.id === outsiderId)!.online, false);
    assert.equal((await request(outsider, 'match:pause')).ok, false);
    const nextRoom = await request(outsider, 'room:create', { name: '另一支队伍' });
    assert.equal(nextRoom.ok, true); assert.notEqual(nextRoom.code, code);
  },
);

test(
  "room isolation and invalid handshake identities",
  { timeout: 10_000 },
  async (t) => {
    const { app } = await createApp();
    const address = await app.listen({ port: 0, host: "127.0.0.1" });
    const sockets: Socket[] = [];
    t.after(async () => {
      sockets.forEach((s) => s.disconnect());
      await app.close();
    });
    async function connect(token: string) {
      const socket = client(address, {
        autoConnect: false,
        auth: { token },
        reconnection: false,
        forceNew: true,
      });
      sockets.push(socket);
      return socket;
    }
    const invalid = await connect("not-a-session");
    const rejection = once<Error>(invalid, "connect_error");
    invalid.connect();
    const error = await rejection;
    assert.match(error.message, /身份/);
    const a = await connect(randomUUID());
    const b = await connect(randomUUID());
    const aConnected = once(a, "connect");
    a.connect();
    await aConnected;
    const bConnected = once(b, "connect");
    b.connect();
    await bConnected;
    const roomA = await request(a, "room:create", { name: "A" });
    const roomB = await request(b, "room:create", { name: "B" });
    assert.notEqual(roomA.code, roomB.code);
    const bStates: Snapshot[] = [];
    b.on("room:snapshot", (state) => bStates.push(state));
    await request(a, "match:start", { seconds: 8 });
    await request(b, "room:join", { code: roomB.code, name: "B" });
    assert.ok(
      bStates.every((s) => s.code === roomB.code && s.phase === "lobby"),
    );
    assert.equal(
      (await request(b, "room:join", { code: roomA.code, name: "B" })).ok,
      false,
    );
  },
);
