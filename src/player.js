import { HALL } from './layout.js';

const RADIUS = 0.34;
const WALK = 1.8;
const RUN = 3.4;
const AIM_Y = 2.05; // personaj ekranning pastroq qismida turishi uchun
const SEAT_OFFSET = 0.38;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function shortestAngle(from, to) {
  return ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

function collide(c, layout) {
  const half = HALL.width / 2 - RADIUS;
  c.x = clamp(c.x, -half, half);
  c.z = clamp(c.z, -layout.length + RADIUS, -RADIUS);

  for (const box of layout.colliders) {
    const nx = clamp(c.x, box.minX, box.maxX);
    const nz = clamp(c.z, box.minZ, box.maxZ);
    const dx = c.x - nx;
    const dz = c.z - nz;
    const d = Math.hypot(dx, dz);
    if (d >= RADIUS) continue;
    if (d > 1e-5) {
      c.x = nx + (dx / d) * RADIUS;
      c.z = nz + (dz / d) * RADIUS;
    } else {
      const pushes = [
        [c.x - box.minX, box.minX - RADIUS, 'x'],
        [box.maxX - c.x, box.maxX + RADIUS, 'x'],
        [c.z - box.minZ, box.minZ - RADIUS, 'z'],
        [box.maxZ - c.z, box.maxZ + RADIUS, 'z'],
      ].sort((a, b) => a[0] - b[0]);
      c[pushes[0][2]] = pushes[0][1];
    }
  }
}

/** Yo‘lda to‘siq bo‘lsa, yo‘nalishni uning yonidan aylanib o‘tadigan qiladi. */
function steerAround(c, dirX, dirZ, layout) {
  for (const box of layout.colliders) {
    const dx = c.x - clamp(c.x, box.minX, box.maxX);
    const dz = c.z - clamp(c.z, box.minZ, box.maxZ);
    const d = Math.hypot(dx, dz);
    if (d > 0.8 || d < 1e-5 || dx * dirX + dz * dirZ >= 0) continue;
    let tx = -dz / d;
    let tz = dx / d;
    if (tx * dirX + tz * dirZ < 0) {
      tx = -tx;
      tz = -tz;
    }
    return [tx, tz];
  }
  return [dirX, dirZ];
}

/** Ikki personaj va ularning orqasidan ergashuvchi kamera. */
export class Player {
  mode = 'fly'; // walk | sit | dance | view | fly
  orbitYaw = 0;
  orbitPitch = -0.13;
  orbitGoal = null;
  vx = 0;
  vz = 0;
  tween = null;
  bench = null;
  avatarsVisible = true;
  remote = null; // ikkinchi mehmonning oxirgi holati
  side = 1; // skameykadagi joyi

  constructor(camera, layout, me, them, reducedMotion) {
    Object.assign(this, { camera, layout, me, them, reducedMotion });
    me.x = -0.45;
    me.z = -4;
    them.x = 0.55;
    them.z = -3.7;
    this.focusX = me.x;
    this.focusZ = me.z;
    this.cam = this.followPose();
  }

  followPose() {
    const D = this.camera.aspect < 1 ? 3.7 : 4.5;
    const cp = Math.cos(this.orbitPitch);
    const fx = -Math.sin(this.orbitYaw) * cp;
    const fy = Math.sin(this.orbitPitch);
    const fz = -Math.cos(this.orbitYaw) * cp;

    const half = HALL.width / 2 - 0.25;
    const x = clamp(this.focusX - fx * D, -half, half);
    const y = clamp(AIM_Y - fy * D, 0.4, HALL.height - 0.2);
    const z = clamp(this.focusZ - fz * D, -this.layout.length + 0.25, -0.25);

    const ax = this.focusX - x;
    const ay = AIM_Y - y;
    const az = this.focusZ - z;
    return { x, y, z, yaw: Math.atan2(-ax, -az), pitch: Math.atan2(ay, Math.hypot(ax, az)) };
  }

  look(dx, dy) {
    this.orbitGoal = null;
    this.orbitYaw += dx;
    this.orbitPitch = clamp(this.orbitPitch + dy, -0.62, 0.18);
  }

  flyTo(target, duration, next, showAvatars = true) {
    this.mode = 'fly';
    this.vx = this.vz = 0;
    this.tween = { from: { ...this.cam }, target, t: 0, duration: this.reducedMotion ? 0.01 : duration, next, showAvatars };
  }

  slideTo(c, x, z, heading, duration) {
    c.slide = { fx: c.x, fz: c.z, fh: c.heading, x, z, heading, t: 0, duration };
  }

  /** Jonli sherik o‘zini o‘zi boshqaradi, yakka rejimda esa birga o‘tiradi. */
  seated() {
    return this.remote ? [[this.me, this.side]] : [[this.me, 1], [this.them, -1]];
  }

  sit(bench) {
    this.bench = bench;
    this.mode = 'sit';
    this.vx = this.vz = 0;
    const heading = bench.yaw + Math.PI;
    for (const [c, side] of this.seated()) {
      c.state = 'sit';
      this.slideTo(c, bench.seat.x + bench.along.x * SEAT_OFFSET * side, bench.seat.z + bench.along.z * SEAT_OFFSET * side, heading, 0.85);
    }
    this.orbitGoal = bench.yaw;
  }

  stand() {
    if (this.mode !== 'sit') return;
    this.mode = 'walk';
    const b = this.bench;
    for (const [c, side] of this.seated()) {
      c.state = 'stand';
      this.slideTo(c, b.stand.x + b.along.x * SEAT_OFFSET * side, b.stand.z + b.along.z * SEAT_OFFSET * side, c.heading, 0.65);
    }
  }

  toggleDance() {
    if (this.mode === 'dance') {
      this.stopDance();
    } else if (this.mode === 'walk' && !this.me.slide) {
      this.mode = 'dance';
      this.vx = this.vz = 0;
      const dx = this.me.x - this.them.x;
      const dz = this.me.z - this.them.z;
      this.me.heading = Math.atan2(-dx, -dz);
      this.me.state = 'dance';
      if (!this.remote) {
        this.them.heading = Math.atan2(dx, dz);
        this.them.state = 'dance';
      }
    }
  }

  stopDance() {
    this.mode = 'walk';
    this.me.state = 'stand';
    if (!this.remote) this.them.state = 'stand';
  }

  moveMe(dt, input) {
    const me = this.me;
    this.orbitYaw += input.turn * dt * 1.9;
    if (me.slide) return;

    const top = input.run ? RUN : WALK;
    const len = Math.max(1, Math.hypot(input.strafe, input.forward));
    const s = input.strafe / len;
    const f = input.forward / len;
    const sin = Math.sin(this.orbitYaw);
    const cos = Math.cos(this.orbitYaw);
    const tx = (s * cos - f * sin) * top;
    const tz = (-s * sin - f * cos) * top;

    const k = 1 - Math.exp(-dt * 9);
    this.vx += (tx - this.vx) * k;
    this.vz += (tz - this.vz) * k;
    me.x += this.vx * dt;
    me.z += this.vz * dt;
    collide(me, this.layout);

    me.speed = Math.hypot(this.vx, this.vz);
    if (me.speed > 0.25) {
      const goal = Math.atan2(this.vx, this.vz);
      me.heading += shortestAngle(me.heading, goal) * (1 - Math.exp(-dt * 11));
    }
  }

  followRemote(dt) {
    const { them, remote: r } = this;
    them.slide = null;
    const d = Math.hypot(r.x - them.x, r.z - them.z);
    const k = d > 4 ? 1 : 1 - Math.exp(-dt * 12);
    them.x += (r.x - them.x) * k;
    them.z += (r.z - them.z) * k;
    them.heading += shortestAngle(them.heading, r.h) * (1 - Math.exp(-dt * 12));
    them.speed = r.s;
    them.state = r.st;
  }

  moveThem(dt) {
    const { me, them } = this;
    if (this.remote) {
      this.followRemote(dt);
      return;
    }
    if (them.slide || this.mode === 'sit' || this.mode === 'dance') {
      them.speed = 0;
      return;
    }

    const sin = Math.sin(me.heading);
    const cos = Math.cos(me.heading);
    const goalX = me.x - sin * 0.45 + cos * 0.8;
    const goalZ = me.z - cos * 0.45 - sin * 0.8;
    const dx = goalX - them.x;
    const dz = goalZ - them.z;
    const d = Math.hypot(dx, dz);

    if (d > 9) {
      them.x = goalX;
      them.z = goalZ;
      return;
    }

    const want = d > 0.22 ? Math.min(RUN, d * 3) : 0;
    them.speed += (want - them.speed) * (1 - Math.exp(-dt * 8));
    if (them.speed > 0.05 && d > 1e-3) {
      const [ux, uz] = steerAround(them, dx / d, dz / d, this.layout);
      them.x += ux * them.speed * dt;
      them.z += uz * them.speed * dt;
      collide(them, this.layout);
    }
    const goal = them.speed > 0.3 ? Math.atan2(dx, dz) : me.heading;
    them.heading += shortestAngle(them.heading, goal) * (1 - Math.exp(-dt * 7));
  }

  applySlide(c, dt) {
    const s = c.slide;
    if (!s) return;
    s.t = Math.min(1, s.t + dt / s.duration);
    const e = easeInOut(s.t);
    c.x = s.fx + (s.x - s.fx) * e;
    c.z = s.fz + (s.z - s.fz) * e;
    c.heading = s.fh + shortestAngle(s.fh, s.heading) * e;
    c.speed = s.t < 1 && c.state === 'stand' ? 1.4 : 0;
    if (s.t >= 1) c.slide = null;
  }

  /** Bosh eng yaqin suratga, surat bo‘lmasa sherigiga buriladi. */
  aimHead(c, other) {
    let bx = other.x;
    let bz = other.z;
    let bd = 4.5;
    for (const p of this.layout.placements) {
      const d = Math.hypot(p.pos.x - c.x, p.pos.z - c.z);
      if (d < bd) {
        bd = d;
        bx = p.pos.x;
        bz = p.pos.z;
      }
    }
    c.headTarget = clamp(shortestAngle(c.heading, Math.atan2(bx - c.x, bz - c.z)), -0.85, 0.85);
    if (Math.abs(shortestAngle(c.heading, Math.atan2(bx - c.x, bz - c.z))) > 1.9) c.headTarget = 0;
  }

  update(dt, input) {
    const moved = input.strafe || input.forward;
    if (this.mode === 'walk') this.moveMe(dt, input);
    else {
      this.me.speed = 0;
      if (this.mode === 'sit' && moved && !this.me.slide) this.stand();
      else if (this.mode === 'dance' && moved) this.stopDance();
    }
    this.moveThem(dt);
    this.applySlide(this.me, dt);
    this.applySlide(this.them, dt);

    this.aimHead(this.me, this.them);
    this.aimHead(this.them, this.me);
    this.me.update(dt);
    this.them.update(dt);

    if (this.orbitGoal !== null) {
      const delta = shortestAngle(this.orbitYaw, this.orbitGoal);
      this.orbitYaw += delta * (1 - Math.exp(-dt * 3.5));
      if (Math.abs(delta) < 0.01) this.orbitGoal = null;
    }

    const k = 1 - Math.exp(-dt * 8);
    this.focusX += (this.me.x - this.focusX) * k;
    this.focusZ += (this.me.z - this.focusZ) * k;

    if (this.tween) this.updateTween(dt);
    else this.cam = this.followPose();

    this.camera.rotation.set(this.cam.pitch, this.cam.yaw, 0, 'YXZ');
    this.camera.position.set(this.cam.x, this.cam.y, this.cam.z);
    this.me.root.visible = this.them.root.visible = this.avatarsVisible;
  }

  updateTween(dt) {
    const tw = this.tween;
    tw.t = Math.min(1, tw.t + dt / tw.duration);
    const e = easeInOut(tw.t);
    const target = typeof tw.target === 'function' ? tw.target() : tw.target;
    this.cam = {
      x: tw.from.x + (target.x - tw.from.x) * e,
      y: tw.from.y + (target.y - tw.from.y) * e,
      z: tw.from.z + (target.z - tw.from.z) * e,
      yaw: tw.from.yaw + shortestAngle(tw.from.yaw, target.yaw) * e,
      pitch: tw.from.pitch + (target.pitch - tw.from.pitch) * e,
    };
    if (tw.t > 0.45) this.avatarsVisible = tw.showAvatars;
    if (tw.t >= 1) {
      this.tween = null;
      tw.next();
    }
  }
}
