import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

export interface AppConfig {
  production: boolean;
  publicOrigin?: string;
  hostUsername: string;
  hostPasswordHash?: string;
  sessionSecret: string;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const secret = (name: string) =>
    env[`${name}_FILE`]
      ? readFileSync(env[`${name}_FILE`]!, "utf8").trim()
      : env[name]?.trim();
  const production = env.NODE_ENV === "production";
  const publicOrigin = env.PUBLIC_ORIGIN
    ? new URL(env.PUBLIC_ORIGIN).origin
    : undefined;
  const hostPasswordHash = secret("HOST_PASSWORD_HASH");
  const sessionSecret = secret("SESSION_SECRET");
  if (production && (!publicOrigin || !publicOrigin.startsWith("https://"))) {
    throw new Error("生产部署必须设置 HTTPS PUBLIC_ORIGIN");
  }
  if (production && (!hostPasswordHash || !sessionSecret)) {
    throw new Error("生产部署必须配置房主密码哈希与会话密钥");
  }
  if (
    hostPasswordHash &&
    !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(hostPasswordHash)
  ) {
    throw new Error("HOST_PASSWORD_HASH 格式不正确");
  }
  if (sessionSecret && sessionSecret.length < 32)
    throw new Error("SESSION_SECRET 至少需要 32 个字符");
  return {
    production,
    publicOrigin,
    hostUsername: env.HOST_USERNAME?.trim() || "host",
    hostPasswordHash,
    sessionSecret: sessionSecret || randomBytes(32).toString("hex"),
  };
}
