const MAX_BACKOFF = 30000;

/** Ikkinchi mehmon bilan bog‘lanish. Server bo‘lmasa, sayt yakka rejimda ishlayveradi. */
export class Net {
  ws = null;
  slot = 0;
  backoff = 1500;
  peer = false;

  constructor(hello, handlers) {
    this.hello = { t: 'hello', ...hello };
    this.handlers = handlers;
    this.connect();
  }

  connect() {
    const url = new URL('ws', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    url.search = '';
    url.hash = '';

    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.backoff = 1500;
      ws.send(JSON.stringify(this.hello));
    };
    ws.onmessage = (e) => this.receive(e.data);
    ws.onclose = () => {
      this.dropPeer();
      setTimeout(() => this.connect(), this.backoff);
      this.backoff = Math.min(MAX_BACKOFF, this.backoff * 2);
    };
    ws.onerror = () => {};
  }

  dropPeer() {
    if (!this.peer) return;
    this.peer = false;
    this.handlers.onLeft();
  }

  receive(data) {
    const m = JSON.parse(data);
    if (m.t === 'welcome') {
      this.slot = m.slot;
      this.handlers.onSlot(m.slot);
    } else if (m.t === 'full') {
      this.backoff = MAX_BACKOFF;
    } else if (m.t === 'hello') {
      const first = !this.peer;
      this.peer = true;
      this.handlers.onPeer(m, first);
    } else if (m.t === 'left') {
      this.dropPeer();
    } else if (m.t === 's' && this.peer) {
      this.handlers.onState(m);
    } else if (m.t === 'f' && this.peer) {
      this.handlers.onFinale();
    } else if (m.t === 'k' && this.peer) {
      this.handlers.onKiss();
    } else if (m.t === 'd' && this.peer) {
      this.handlers.onSlow();
    } else if (m.t === 'g' && this.peer) {
      this.handlers.onGift();
    }
  }

  sendKiss() {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'k' }));
  }

  sendEvent(t) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t }));
  }

  sendFinale() {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'f' }));
  }

  sendState(state) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 's', ...state }));
  }
}
