const TAP_MOVE = 10;
const TAP_TIME = 400;
const STICK_RADIUS = 46;

/** Klaviatura, sichqoncha va sensor kiritishni bitta holatga yig‘adi. */
export class Input {
  strafe = 0;
  forward = 0;
  turn = 0;
  run = false;
  touch = matchMedia('(pointer: coarse)').matches;

  keys = new Set();
  stickX = 0;
  stickY = 0;
  lookId = null;

  constructor(canvas, stick, knob, { onLook, onTap, onHover, onKey }) {
    Object.assign(this, { canvas, stick, knob, onLook, onTap, onHover, onKey });
    this.bindKeys();
    this.bindCanvas();
    if (this.touch) this.bindStick();
  }

  bindKeys() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.onKey(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  bindCanvas() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (this.lookId !== null) return;
      this.lookId = e.pointerId;
      this.px = this.startX = e.clientX;
      this.py = this.startY = e.clientY;
      this.startT = performance.now();
      this.moved = 0;
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookId) {
        if (e.pointerType === 'mouse') this.onHover(e.clientX, e.clientY);
        return;
      }
      const dx = e.clientX - this.px;
      const dy = e.clientY - this.py;
      this.px = e.clientX;
      this.py = e.clientY;
      this.moved = Math.max(this.moved, Math.hypot(e.clientX - this.startX, e.clientY - this.startY));
      if (this.moved >= TAP_MOVE) {
        const s = e.pointerType === 'mouse' ? 0.0034 : 0.0048;
        this.onLook(dx * s, dy * s);
      }
    });
    const end = (e) => {
      if (e.pointerId !== this.lookId) return;
      this.lookId = null;
      if (e.type === 'pointerup' && this.moved < TAP_MOVE && performance.now() - this.startT < TAP_TIME) {
        this.onTap(e.clientX, e.clientY);
      }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  bindStick() {
    const { stick, knob } = this;
    stick.hidden = false;
    let id = null;
    let cx = 0;
    let cy = 0;
    const move = (e) => {
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > STICK_RADIUS) {
        dx *= STICK_RADIUS / d;
        dy *= STICK_RADIUS / d;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.stickX = dx / STICK_RADIUS;
      this.stickY = dy / STICK_RADIUS;
    };
    stick.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId;
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      stick.setPointerCapture(id);
      move(e);
    });
    stick.addEventListener('pointermove', (e) => {
      if (e.pointerId === id) move(e);
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.stickX = this.stickY = 0;
      knob.style.transform = '';
    };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
  }

  poll() {
    const k = this.keys;
    const axis = (plus, minus) => (plus ? 1 : 0) - (minus ? 1 : 0);
    this.strafe = axis(k.has('KeyD'), k.has('KeyA')) + this.stickX;
    this.forward = axis(k.has('KeyW') || k.has('ArrowUp'), k.has('KeyS') || k.has('ArrowDown')) - this.stickY;
    if (Math.abs(this.strafe) < 0.08) this.strafe = 0;
    if (Math.abs(this.forward) < 0.08) this.forward = 0;
    this.turn = axis(k.has('ArrowLeft'), k.has('ArrowRight'));
    this.run = k.has('ShiftLeft') || k.has('ShiftRight');
  }
}
