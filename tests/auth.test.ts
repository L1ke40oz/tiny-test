import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, scryptSync } from "node:crypto";
import { io as client, type Socket } from "socket.io-client";
import { createApp } from "../server/app.js";
import { readConfig, type AppConfig } from "../server/config.js";
import type { Reply } from "../shared/types.js";

const password = "test-only-password-2026";
const salt = "00112233445566778899aabbccddeeff";
const passwordHash = `scrypt$${salt}$${scryptSync(password, Buffer.from(salt, "hex"), 64).toString("hex")}`;
const origin = "https://game.example.test";
const config: AppConfig = {
  production: true,
  publicOrigin: origin,
  hostUsername: "host",
  hostPasswordHash: passwordHash,
  sessionSecret: "test-only-signing-secret-".repeat(3),
};
const cookieOf = (headers: { [key: string]: unknown }) => {
  const value = headers["set-cookie"];
  return String(Array.isArray(value) ? value[0] : value).split(";")[0];
};

test("production refuses missing credentials, insecure origin and malformed hashes", () => {
  assert.throws(() => readConfig({ NODE_ENV: "production" }), /HTTPS/);
  assert.throws(
    () => readConfig({ NODE_ENV: "production", PUBLIC_ORIGIN: origin }),
    /密码哈希/,
  );
  assert.throws(() => readConfig({ HOST_PASSWORD_HASH: "plaintext" }), /格式/);
  assert.throws(() => readConfig({ SESSION_SECRET: "short" }), /32/);
  assert.equal(readConfig({}).production, false);
});

test("host login requires correct credentials and origin; logout invalidates existing cookies", async (t) => {
  const { app } = await createApp(config);
  t.after(() => app.close());
  assert.deepEqual((await app.inject("/api/session")).json(), {
    required: true,
    authenticated: false,
  });
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/host/login",
        headers: { origin: "https://evil.example" },
        payload: { username: "host", password },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/host/login",
        headers: { origin },
        payload: { username: "host", password: "wrong" },
      })
    ).statusCode,
    401,
  );
  const loggedIn = await app.inject({
    method: "POST",
    url: "/api/host/login",
    headers: { origin },
    payload: { username: "host", password },
  });
  assert.equal(loggedIn.statusCode, 200);
  const cookie = cookieOf(loggedIn.headers);
  assert.match(String(loggedIn.headers["set-cookie"]), /HttpOnly/);
  assert.match(String(loggedIn.headers["set-cookie"]), /Secure/);
  assert.match(String(loggedIn.headers["set-cookie"]), /SameSite=Strict/);
  assert.equal(
    (await app.inject({ url: "/api/session", headers: { cookie } })).json()
      .authenticated,
    true,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/session",
        headers: { cookie: cookie + "tampered" },
      })
    ).json().authenticated,
    false,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/host/logout",
        headers: { cookie, origin: "https://evil.example" },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/host/logout",
        headers: { cookie, origin },
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ url: "/api/session", headers: { cookie } })).json()
      .authenticated,
    false,
  );
});

test("repeated login guesses are limited", async (t) => {
  const { app } = await createApp(config);
  t.after(() => app.close());
  for (let i = 0; i < 8; i++)
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/host/login",
          headers: { origin },
          payload: { username: "host", password: "incorrect" },
        })
      ).statusCode,
      401,
    );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/host/login",
        headers: { origin },
        payload: { username: "host", password },
      })
    ).statusCode,
    429,
  );
});

test(
  "public guests can join and answer; only logged-in hosts can create and manage rooms",
  { timeout: 10_000 },
  async (t) => {
    const { app, rooms } = await createApp(config);
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    const sockets: Socket[] = [];
    t.after(async () => {
      sockets.forEach((socket) => socket.disconnect());
      await app.close();
    });
    async function connect(cookie?: string, requestOrigin = origin) {
      const socket = client(address, {
        autoConnect: false,
        forceNew: true,
        reconnection: false,
        transports: ["websocket"],
        auth: { token: randomUUID() },
        extraHeaders: {
          Origin: requestOrigin,
          ...(cookie ? { Cookie: cookie } : {}),
        },
      });
      sockets.push(socket);
      const connected = new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
      });
      socket.connect();
      await connected;
      return socket;
    }
    const request = (socket: Socket, event: string, data = {}) =>
      socket.timeout(2000).emitWithAck(event, data) as Promise<Reply>;
    const guest = await connect();
    assert.equal(
      (await request(guest, "room:create", { name: "游客" })).ok,
      false,
    );
    await assert.rejects(() => connect(undefined, "https://evil.example"));
    const login = await app.inject({
      method: "POST",
      url: "/api/host/login",
      headers: { origin },
      payload: { username: "host", password },
    });
    const cookie = cookieOf(login.headers);
    const host = await connect(cookie);
    const created = await request(host, "room:create", { name: "房主" });
    assert.equal(created.ok, true);
    assert.equal(
      (await request(guest, "room:join", { code: created.code, name: "队友" }))
        .ok,
      true,
    );
    assert.equal(
      (await request(host, "match:start", { seconds: 10 })).ok,
      true,
    );
    const room = rooms.get(created.code!)!;
    const question = room.deck[0];
    assert.equal(
      (
        await request(guest, "answer:submit", {
          matchId: room.matchId,
          questionId: question.id,
          choice: question.answer,
        })
      ).ok,
      true,
    );
    await app.inject({
      method: "POST",
      url: "/api/host/logout",
      headers: { cookie, origin },
    });
    assert.equal((await request(host, "match:pause")).ok, false);
  },
);
