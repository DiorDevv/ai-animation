// Saytni tarqatadi va ikki mehmonning harakatini bir-biriga uzatadi.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sirv from 'sirv';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 8787;
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const STATES = new Set(['stand', 'sit', 'dance']);
const GENDERS = new Set(['female', 'male']);

const serve = sirv(DIST, { etag: true, dev: false });
const server = http.createServer((req, res) =>
  serve(req, res, () => {
    res.statusCode = 404;
    res.end('Not found');
  }),
);

const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
const slots = [null, null];

server.on('upgrade', (req, socket, head) => {
  if (!req.url.split('?')[0].endsWith('/ws')) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
});

const send = (ws, msg) => {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
};

function cleanState(m) {
  const nums = [m.x, m.z, m.h, m.s];
  if (!nums.every(Number.isFinite) || !STATES.has(m.st)) return null;
  return { t: 's', x: m.x, z: m.z, h: m.h, s: m.s, st: m.st };
}

wss.on('connection', (ws) => {
  const slot = slots.indexOf(null);
  if (slot < 0) {
    send(ws, { t: 'full' });
    ws.close();
    return;
  }

  slots[slot] = ws;
  ws.alive = true;
  ws.on('pong', () => {
    ws.alive = true;
  });

  const other = () => slots[1 - slot];
  send(ws, { t: 'welcome', slot });
  if (other()?.hello) send(ws, other().hello);

  ws.on('message', (raw) => {
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (m?.t === 'hello' && typeof m.name === 'string' && GENDERS.has(m.gender)) {
      ws.hello = { t: 'hello', name: m.name.slice(0, 20), gender: m.gender };
      send(other(), ws.hello);
    } else if (m?.t === 's') {
      const state = cleanState(m);
      if (state) send(other(), state);
    }
  });

  ws.on('close', () => {
    if (slots[slot] !== ws) return;
    slots[slot] = null;
    if (ws.hello) send(other(), { t: 'left' });
  });
  ws.on('error', () => {});
});

// Uzilib qolgan ulanishlar joyni band qilib turmasin.
setInterval(() => {
  for (const ws of slots) {
    if (!ws) continue;
    if (!ws.alive) {
      ws.terminate();
      continue;
    }
    ws.alive = false;
    ws.ping();
  }
}, 15000);

server.listen(PORT, () => console.log(`Museum server: http://localhost:${PORT}`));
