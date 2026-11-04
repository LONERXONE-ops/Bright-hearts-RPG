// WebSocket client with auto-reconnect. Offline play works without it.
import { DEFAULT_SERVER } from './config.js';

export class Net {
  constructor() {
    this.ws = null;
    this.id = 0;
    this.handlers = {};
    this.connected = false;
    this.url = '';
    this.wantOnline = true;
    this.retry = 0;
    this.queue = [];
    this.helloMsg = null;
    this.room = null;
  }
  on(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); }
  off(t) { delete this.handlers[t]; }
  emit(t, m) { for (const fn of this.handlers[t] || []) { try { fn(m); } catch (e) { console.error(e); } } }

  connect(url) {
    this.url = (url || DEFAULT_SERVER || '').trim().replace(/^http/, 'ws');
    if (!this.url) return;
    this._open();
  }
  _open() {
    if (!this.wantOnline || !this.url) return;
    try { this.ws = new WebSocket(this.url); } catch (e) { this._retry(); return; }
    this.emit('status', 'connecting');
    const ws = this.ws;
    ws.onopen = () => {
      this.connected = true;
      this.retry = 0;
      this.emit('status', 'online');
      if (this.helloMsg) this.send(this.helloMsg);
      if (this.room) this.send({ t: 'join', room: this.room });
      for (const q of this.queue) this.send(q);
      this.queue = [];
    };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.t === 'welcome') this.id = m.id;
      this.emit(m.t, m);
    };
    ws.onclose = () => {
      const was = this.connected;
      this.connected = false;
      this.emit('status', 'offline');
      if (was) this.emit('disconnected');
      this._retry();
    };
    ws.onerror = () => { /* close follows */ };
  }
  _retry() {
    if (!this.wantOnline) return;
    this.retry++;
    const wait = Math.min(15000, 1500 * this.retry);
    clearTimeout(this._t);
    this._t = setTimeout(() => this._open(), wait);
  }
  hello(m) { this.helloMsg = { t: 'hello', ...m }; if (this.connected) this.send(this.helloMsg); }
  join(room) { this.room = room; if (this.connected) this.send({ t: 'join', room }); }
  send(m) {
    if (this.connected && this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(m));
      return true;
    }
    return false;
  }
  sendOrQueue(m) { if (!this.send(m)) this.queue.push(m); }
  ev(e, to) { return this.send(to ? { t: 'ev', e, to } : { t: 'ev', e }); }
}

export const net = new Net();
