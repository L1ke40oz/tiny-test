import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { Server, type Socket } from "socket.io";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GameError, Room } from "./game.js";
import type { Reply, Role } from "../shared/types.js";

export async function createApp() {
  const app = Fastify({ logger: false });
  const rooms = new Map<string, Room>();
  const io = new Server(app.server, { maxHttpBufferSize: 4096 });
  app.get("/api/health", async () => ({
    ok: true,
    mode: "local-prototype",
    rooms: rooms.size,
  }));
  const dist = fileURLToPath(new URL("../dist/", import.meta.url));
  if (existsSync(dist)) await app.register(fastifyStatic, { root: dist });

  const broadcast = (room: Room) => {
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.roomCode === room.code) {
        socket.emit("room:snapshot", room.snapshot(socket.data.token));
      }
    }
  };
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || !/^[a-f0-9-]{36}$/i.test(token))
      return next(new Error("无效玩家身份"));
    socket.data.token = token;
    next();
  });
  io.on("connection", (socket) => {
    let requests = 0;
    let windowStart = Date.now();
    const bind = (
      event: string,
      handler: (data: Record<string, unknown>) => Room,
    ) => {
      socket.on(event, (raw: unknown, ack?: (reply: Reply) => void) => {
        try {
          if (Date.now() - windowStart > 10_000) {
            requests = 0;
            windowStart = Date.now();
          }
          if (++requests > 50) throw new GameError("操作太快，请稍等");
          if (!raw || typeof raw !== "object" || Array.isArray(raw))
            throw new GameError("无效请求");
          const room = handler(raw as Record<string, unknown>);
          broadcast(room);
          if (typeof ack === "function") ack({ ok: true, code: room.code });
        } catch (error) {
          if (!(error instanceof GameError)) app.log.error(error);
          if (typeof ack === "function")
            ack({
              ok: false,
              error:
                error instanceof GameError
                  ? error.message
                  : "服务暂时忙，请重试",
            });
        }
      });
    };
    const current = () => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) throw new GameError("请先加入房间");
      return room;
    };
    const attach = (room: Room) => {
      if (socket.data.roomCode && socket.data.roomCode !== room.code)
        throw new GameError("请在新标签页加入其他房间");
      socket.data.roomCode = room.code;
      void socket.join(room.code);
      // 同一身份保留一个控制端，旧窗口不再接收状态或提交操作。
      for (const other of io.sockets.sockets.values()) {
        if (
          other.id !== socket.id &&
          other.data.roomCode === room.code &&
          other.data.token === socket.data.token
        ) {
          other.emit("session:replaced");
          other.disconnect(true);
        }
      }
    };
    bind("room:create", (data) => {
      if (socket.data.roomCode) throw new GameError("你已经在一个房间内");
      if (rooms.size >= 100) throw new GameError("房间较多，请稍后再试");
      const owned = [...rooms.values()].find(
        (r) => r.hostToken === socket.data.token,
      );
      if (owned) {
        owned.online(socket.data.token, true);
        attach(owned);
        return owned;
      }
      let code: string;
      do {
        code = randomBytes(6).toString("hex").toUpperCase();
      } while (rooms.has(code));
      const room = new Room(code, socket.data.token, data.name as string);
      rooms.set(code, room);
      attach(room);
      return room;
    });
    bind("room:join", (data) => {
      const code =
        typeof data.code === "string" ? data.code.trim().toUpperCase() : "";
      const room = rooms.get(code);
      if (!room) throw new GameError("房间不存在或已失效");
      if (socket.data.roomCode && socket.data.roomCode !== code)
        throw new GameError("请在新标签页加入其他房间");
      room.join(socket.data.token, data.name as string);
      attach(room);
      return room;
    });
    bind("room:leave", () => {
      const room = current();
      delete socket.data.roomCode;
      void socket.leave(room.code);
      room.online(socket.data.token, false);
      room.tick();
      return room;
    });
    bind("player:set-role", (data) => {
      const room = current();
      room.setRole(socket.data.token, data.role as Role);
      return room;
    });
    bind("match:start", (data) => {
      const room = current();
      room.start(socket.data.token, data.seconds as number);
      return room;
    });
    bind("answer:submit", (data) => {
      const room = current();
      room.submit(
        socket.data.token,
        data.matchId as string,
        data.questionId as string,
        data.choice as number,
      );
      return room;
    });
    bind("match:pause", () => {
      const room = current();
      room.pause(socket.data.token);
      return room;
    });
    bind("match:resume", () => {
      const room = current();
      room.resume(socket.data.token);
      return room;
    });
    socket.on("disconnect", () => markOffline(socket));
  });
  function markOffline(socket: Socket) {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const other = [...io.sockets.sockets.values()].some(
      (s) =>
        s.id !== socket.id &&
        s.data.roomCode === room.code &&
        s.data.token === socket.data.token,
    );
    if (!other) {
      room.online(socket.data.token, false);
      room.tick();
      broadcast(room);
    }
  }
  const timer = setInterval(() => {
    for (const [code, room] of rooms) {
      if (
        [...room.players.values()].every((p) => !p.online) &&
        Date.now() - room.lastActivity > 2 * 60 * 60 * 1000
      ) {
        rooms.delete(code);
        continue;
      }
      const version = room.version;
      room.tick();
      if (room.version !== version) broadcast(room);
    }
  }, 100);
  timer.unref();
  app.addHook("onClose", async () => {
    clearInterval(timer);
    io.disconnectSockets(true);
    io.engine?.close();
  });
  return { app, io, rooms };
}
