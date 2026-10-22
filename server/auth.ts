import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { FastifyInstance, FastifyRequest } from "fastify";
import fastifyCookie from "@fastify/cookie";
import type { AppConfig } from "./config.js";

const deriveKey = promisify(scrypt);
export const HOST_COOKIE = "pbp_host";
const SESSION_MS = 8 * 60 * 60 * 1000;

export async function registerAuth(app: FastifyInstance, config: AppConfig) {
  await app.register(fastifyCookie, { secret: config.sessionSecret });
  const sessions = new Map<string, number>();
  const failures = new Map<string, { count: number; until: number }>();
  let globalAttempts = { count: 0, until: 0 };
  const required = Boolean(config.hostPasswordHash);
  function originAllowed(origin?: string) {
    if (config.publicOrigin) return origin === config.publicOrigin;
    if (!origin) return !config.production;
    try {
      const url = new URL(origin);
      return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    } catch {
      return false;
    }
  }
  function authenticated(cookie?: string) {
    if (!cookie) return false;
    try {
      const signed = app.parseCookie(cookie)[HOST_COOKIE];
      if (!signed) return false;
      const parsed = app.unsignCookie(signed);
      if (!parsed.valid || !parsed.value) return false;
      const expires = sessions.get(parsed.value);
      if (!expires || expires <= Date.now()) {
        sessions.delete(parsed.value);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
  const validMutation = (request: FastifyRequest) =>
    originAllowed(request.headers.origin);
  app.get("/api/session", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    return { required, authenticated: authenticated(request.headers.cookie) };
  });
  app.post<{ Body: { username?: unknown; password?: unknown } }>(
    "/api/host/login",
    { bodyLimit: 4096 },
    async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      if (!required)
        return reply.code(400).send({ error: "当前本地模式无需房主登录" });
      if (!validMutation(request))
        return reply.code(403).send({ error: "请从本站登录" });
      const now = Date.now();
      if (globalAttempts.until <= now)
        globalAttempts = { count: 0, until: now + 60_000 };
      // 单账号、小规模试运行：总量限制也约束并行密码计算。
      if (++globalAttempts.count > 12)
        return reply.code(429).send({ error: "登录尝试较多，请一分钟后再试" });
      const address = request.ip;
      for (const [key, value] of failures)
        if (value.until <= now) failures.delete(key);
      const attempts = failures.get(address) ?? {
        count: 0,
        until: now + 5 * 60_000,
      };
      if (attempts.count >= 8)
        return reply.code(429).send({ error: "登录尝试过多，请稍后再试" });
      attempts.count++;
      failures.set(address, attempts);
      const { username, password } = request.body ?? {};
      if (
        typeof password !== "string" ||
        password.length < 1 ||
        password.length > 256 ||
        typeof username !== "string" ||
        username.length > 64
      ) {
        return reply.code(401).send({ error: "账号或密码不正确" });
      }
      const [, salt, hash] = config.hostPasswordHash!.split("$");
      const key = (await deriveKey(
        password,
        Buffer.from(salt, "hex"),
        64,
      )) as Buffer;
      if (
        username !== config.hostUsername ||
        !timingSafeEqual(key, Buffer.from(hash, "hex"))
      ) {
        return reply.code(401).send({ error: "账号或密码不正确" });
      }
      failures.delete(address);
      for (const [id, expires] of sessions)
        if (expires <= now) sessions.delete(id);
      if (sessions.size >= 32) sessions.delete(sessions.keys().next().value!);
      const id = randomBytes(32).toString("hex");
      sessions.set(id, now + SESSION_MS);
      reply.setCookie(HOST_COOKIE, id, {
        signed: true,
        httpOnly: true,
        secure: config.publicOrigin?.startsWith("https://") ?? false,
        sameSite: "strict",
        path: "/",
        maxAge: SESSION_MS / 1000,
      });
      return { ok: true };
    },
  );
  app.post("/api/host/logout", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!validMutation(request))
      return reply.code(403).send({ error: "请从本站操作" });
    const signed = request.cookies[HOST_COOKIE];
    if (signed) {
      const parsed = app.unsignCookie(signed);
      if (parsed.valid && parsed.value) sessions.delete(parsed.value);
    }
    reply.clearCookie(HOST_COOKIE, {
      path: "/",
      secure: config.publicOrigin?.startsWith("https://") ?? false,
      sameSite: "strict",
    });
    return { ok: true };
  });
  return { required, authenticated, originAllowed };
}
