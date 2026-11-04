// Bright Hearts RPG multiplayer server
// Zero dependencies: plain Node http + a tiny WebSocket implementation.
// Rooms: "village", "castle", and one "dg:CODE" room per dungeon party.
// The party host simulates enemies; the server relays events.

const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 8787;
const MAX_MSG = 64 * 1024;

/* ---------------- tiny websocket ---------------- */

function acceptKey(key) {
  return crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
}

function frame(data, opcode = 1) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x80 | opcode;
  return Buffer.concat([header, payload]);
}

class Conn {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.frags = [];
    this.alive = true;
    this.open = true;
    this.onmessage = null;
    this.onclose = null;
    socket.setNoDelay(true);
    socket.on('data', (d) => this._data(d));
    socket.on('close', () => this._closed());
    socket.on('error', () => this._closed());
  }
  send(obj) {
    if (!this.open) return;
    try { this.socket.write(frame(JSON.stringify(obj))); } catch (e) { this._closed(); }
  }
  ping() {
    if (!this.open) return;
    try { this.socket.write(frame(Buffer.alloc(0), 9)); } catch (e) { this._closed(); }
  }
  close() {
    if (!this.open) return;
    try { this.socket.write(frame(Buffer.alloc(0), 8)); this.socket.end(); } catch (e) { /* ignore */ }
    this._closed();
  }
  _closed() {
    if (!this.open) return;
    this.open = false;
    try { this.socket.destroy(); } catch (e) { /* ignore */ }
    if (this.onclose) this.onclose();
  }
  _data(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    if (this.buf.length > MAX_MSG * 4) return this.close();
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0;
      const op = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) {
        if (this.buf.length < 4) return;
        len = this.buf.readUInt16BE(2); off = 4;
      } else if (len === 127) {
        if (this.buf.length < 10) return;
        len = Number(this.buf.readBigUInt64BE(2)); off = 10;
      }
      if (len > MAX_MSG) return this.close();
      const maskOff = off;
      if (masked) off += 4;
      if (this.buf.length < off + len) return;
      let payload = this.buf.subarray(off, off + len);
      if (masked) {
        const mask = this.buf.subarray(maskOff, maskOff + 4);
        const out = Buffer.alloc(len);
        for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3];
        payload = out;
      } else {
        payload = Buffer.from(payload);
      }
      this.buf = this.buf.subarray(off + len);

      if (op === 8) { this.close(); return; }
      if (op === 9) { try { this.socket.write(frame(payload, 10)); } catch (e) { /* ignore */ } continue; }
      if (op === 10) { this.alive = true; continue; }
      if (op === 1 || op === 0 || op === 2) {
        this.frags.push(payload);
        if (fin) {
          const msg = Buffer.concat(this.frags).toString('utf8');
          this.frags = [];
          this.alive = true;
          if (this.onmessage) this.onmessage(msg);
        }
      }
    }
  }
}

/* ---------------- game rooms ---------------- */

let nextId = 1;
const players = new Map();   // id -> player
const rooms = new Map();     // name -> Set(id)
const parties = new Map();   // code -> {code, host, members:Set, started, dungeon, diff, seed}

function roomSet(name) {
  if (!rooms.has(name)) rooms.set(name, new Set());
  return rooms.get(name);
}

function pub(p) {
  return { id: p.id, name: p.name, cls: p.cls, lvl: p.lvl, look: p.look, s: p.s, crown: p.crown || 0 };
}

function broadcast(room, msg, exceptId) {
  const set = rooms.get(room);
  if (!set) return;
  for (const id of set) {
    if (id === exceptId) continue;
    const p = players.get(id);
    if (p) p.conn.send(msg);
  }
}

function leaveRoom(p) {
  if (!p.room) return;
  const set = rooms.get(p.room);
  if (set) {
    set.delete(p.id);
    if (set.size === 0) rooms.delete(p.room);
  }
  broadcast(p.room, { t: 'pl', id: p.id });
  p.room = null;
}

function joinRoom(p, room) {
  if (p.room === room) return;
  leaveRoom(p);
  p.room = room;
  const set = roomSet(room);
  const others = [];
  for (const id of set) {
    const o = players.get(id);
    if (o) others.push(pub(o));
  }
  set.add(p.id);
  p.conn.send({ t: 'roster', room, players: others });
  broadcast(room, { t: 'pj', p: pub(p) }, p.id);
}

function partyInfo(party) {
  return {
    t: 'party',
    code: party.code,
    host: party.host,
    started: party.started,
    members: [...party.members].map((id) => players.get(id)).filter(Boolean).map(pub),
  };
}

function sendParty(party) {
  const info = partyInfo(party);
  for (const id of party.members) {
    const p = players.get(id);
    if (p) p.conn.send(info);
  }
}

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do {
    c = '';
    for (let i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)];
  } while (parties.has(c));
  return c;
}

function leaveParty(p) {
  if (!p.party) return;
  const party = parties.get(p.party);
  p.party = null;
  if (!party) return;
  party.members.delete(p.id);
  if (party.members.size === 0) {
    parties.delete(party.code);
    return;
  }
  if (party.host === p.id) {
    party.host = [...party.members][0];
  }
  sendParty(party);
}

function clean(str, n) {
  return String(str || '').replace(/[\u0000-\u001f<>]/g, '').slice(0, n).trim();
}

function handle(p, raw) {
  let m;
  try { m = JSON.parse(raw); } catch (e) { return; }
  if (!m || typeof m.t !== 'string') return;

  switch (m.t) {
    case 'hello': {
      p.name = clean(m.name, 16) || 'Hero';
      p.cls = clean(m.cls, 12) || 'warrior';
      p.lvl = Math.max(1, Math.min(30, m.lvl | 0));
      p.look = m.look && typeof m.look === 'object' ? m.look : {};
      p.conn.send({ t: 'welcome', id: p.id, online: players.size });
      break;
    }
    case 'join': {
      const room = m.room === 'castle' ? 'castle' : 'village';
      joinRoom(p, room);
      break;
    }
    case 'st': {
      p.s = m.s;
      if (p.room) broadcast(p.room, { t: 'st', id: p.id, s: m.s }, p.id);
      break;
    }
    case 'chat': {
      const text = clean(m.m, 120);
      if (!text || !p.room) return;
      const now = Date.now();
      if (now - (p.lastChat || 0) < 600) return;
      p.lastChat = now;
      broadcast(p.room, { t: 'chat', id: p.id, name: p.name, m: text });
      break;
    }
    case 'pcreate': {
      leaveParty(p);
      const code = makeCode();
      const party = { code, host: p.id, members: new Set([p.id]), started: false };
      parties.set(code, party);
      p.party = code;
      sendParty(party);
      break;
    }
    case 'pjoin': {
      const code = clean(m.code, 4).toUpperCase();
      const party = parties.get(code);
      if (!party) return p.conn.send({ t: 'perr', m: 'No party with code ' + code });
      if (party.members.size >= 10) return p.conn.send({ t: 'perr', m: 'Party is full (10/10)' });
      if (party.started) return p.conn.send({ t: 'perr', m: 'That party is already inside a dungeon' });
      leaveParty(p);
      party.members.add(p.id);
      p.party = code;
      sendParty(party);
      break;
    }
    case 'pleave': {
      leaveParty(p);
      p.conn.send({ t: 'party', code: null });
      break;
    }
    case 'pstart': {
      const party = parties.get(p.party);
      if (!party || party.host !== p.id) return;
      party.started = true;
      const start = {
        t: 'pstart',
        dungeon: clean(m.dungeon, 16),
        diff: clean(m.diff, 12),
        seed: m.seed | 0,
        size: party.members.size,
        host: party.host,
      };
      for (const id of party.members) {
        const o = players.get(id);
        if (o) o.conn.send(start);
      }
      break;
    }
    case 'pend': {
      const party = parties.get(p.party);
      if (party && party.host === p.id) {
        party.started = false;
        sendParty(party);
      }
      break;
    }
    case 'enter': {
      // enter the dungeon room of your party
      const party = parties.get(p.party);
      if (!party) return;
      joinRoom(p, 'dg:' + party.code);
      break;
    }
    case 'ev': {
      // party event relay (enemy sync, hits, revives, drops...)
      if (!p.room || !p.room.startsWith('dg:')) return;
      const out = { t: 'ev', from: p.id, e: m.e };
      if (m.to) {
        const o = players.get(m.to | 0);
        if (o && o.room === p.room) o.conn.send(out);
      } else {
        broadcast(p.room, out, p.id);
      }
      break;
    }
    case 'ping': {
      p.conn.send({ t: 'pong', c: m.c });
      break;
    }
    default:
      break;
  }
}

/* ---------------- http + upgrade ---------------- */

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify({ game: 'Bright Hearts RPG', ok: true, online: players.size, parties: parties.size }));
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') {
    socket.destroy();
    return;
  }
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + acceptKey(key) + '\r\n\r\n'
  );
  const conn = new Conn(socket);
  const p = { id: nextId++, conn, name: 'Hero', cls: 'warrior', lvl: 1, look: {}, room: null, party: null, s: null };
  players.set(p.id, p);
  conn.onmessage = (msg) => handle(p, msg);
  conn.onclose = () => {
    leaveParty(p);
    leaveRoom(p);
    players.delete(p.id);
  };
});

setInterval(() => {
  for (const p of players.values()) {
    if (!p.conn.alive) { p.conn.close(); continue; }
    p.conn.alive = false;
    p.conn.ping();
  }
}, 25000);

server.listen(PORT, () => {
  console.log('Bright Hearts server listening on ' + PORT);
});
