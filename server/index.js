/* =========================================================
   整活派对 · 服务端入口
   - 静态文件：public/（手机端 /，大屏端 /host）
   - WebSocket：/ws（房间、回合、进度同步）
   ========================================================= */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.resolve(here, '../.env'));

// ai.js 在加载时读取环境变量，所以必须在 .env 读完之后再导入
const { WebSocketServer } = await import('ws');
const { RoomManager } = await import('./rooms.js');
const { aiStatus } = await import('./ai.js');

const PUBLIC_DIR = path.resolve(here, '../public');
const PORT = Number(process.env.PORT) || 3000;
// 生产环境由 OpenResty 反代，只监听本机；局域网调试时设 HOST=0.0.0.0
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const ROUTES = { '/': 'index.html', '/host': 'host.html' };

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, ai: aiStatus() }));
    return;
  }

  const rel = ROUTES[url.pathname] || decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.resolve(PUBLIC_DIR, rel);
  // 防目录穿越：解析后的路径必须仍在 public/ 内
  if (!file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      // 黑客松期间频繁更新，统一不缓存，避免手机拿到旧代码
      'Cache-Control': 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
const rooms = new RoomManager();

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  rooms.attach(ws);
});

// 心跳：清理锁屏/断网后残留的连接
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 15000).unref();

server.listen(PORT, HOST, () => {
  console.log(`[party] http://${HOST}:${PORT}  (大屏: /host)  AI: ${aiStatus()}`);
});

/** 极简 .env 读取（KEY=VALUE，# 注释），不覆盖已存在的环境变量 */
function loadEnvFile(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}
