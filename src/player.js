import * as THREE from 'three';
import { HALL, DOOR, TERRACE } from './layout.js';

const RADIUS = 0.34;
const WALK = 1.25;
const RUN = 3.2;
const AIM_Y = 2.05; // personaj ekranning pastroq qismida turishi uchun
const SEAT_OFFSET = 0.27;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function shortestAngle(from, to) {
  return ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

function collide(c, layout) {
  const L = layout.length;
  const throughDoor = Math.abs(c.x - DOOR.x) < DOOR.half - RADIUS;
  if (c.z > -L) {
    const half = HALL.width / 2 - RADIUS;
    c.x = clamp(c.x, -half, half);
    c.z = Math.min(c.z, -RADIUS);
    if (!throughDoor) c.z = Math.max(c.z, -L + RADIUS);
  } else {
    c.x = clamp(c.x, TERRACE.minX + RADIUS, TERRACE.maxX - RADIUS);
    c.z = Math.max(c.z, -L - TERRACE.depth + RADIUS);
    if (!throughDoor) c.z = Math.min(c.z, -L - RADIUS);
  }

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
  waveTime = 0;
  camOutside = false;
  camBlend = 0;
  trail = []; // mehmon yurgan yo‘l: sherik to‘siqqa tiqilmasdan shu izdan boradi
  companionWave = 0;
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

    // Kamera qahramon turgan joydan (zal yoki terrasa) chiqib ketmaydi.
    const L = this.layout.length;
    const outside = this.focusZ < -L;
    const half = HALL.width / 2 - 0.25;
    const x = outside
      ? clamp(this.focusX - fx * D, TERRACE.minX + 0.3, TERRACE.maxX - 0.3)
      : clamp(this.focusX - fx * D, -half, half);
    const y = clamp(AIM_Y - fy * D, 0.4, HALL.height - 0.2);
    const z = outside
      ? clamp(this.focusZ - fz * D, -L - TERRACE.depth + 0.3, -L - 0.3)
      : clamp(this.focusZ - fz * D, -L + 0.25, -0.25);

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

  slideTo(c, x, z, heading, duration, then) {
    c.slide = { fx: c.x, fz: c.z, fh: c.heading, x, z, heading, t: 0, duration, then };
  }

  greet() {
    if (this.mode !== 'walk' || this.me.slide || this.me.shot) return;
    this.me.state = 'wave';
    this.waveTime = 3;
  }

  greetCompanion() {
    this.them.state = 'wave';
    this.companionWave = 3;
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
      const sx = bench.seat.x + bench.along.x * SEAT_OFFSET * side;
      const sz = bench.seat.z + bench.along.z * SEAT_OFFSET * side;
      const a = c.shots.sitdown.approach;
      // Avval skameyka oldiga yetib kelib, keyin o‘tirish animatsiyasi boshlanadi.
      c.state = 'stand';
      this.slideTo(c, sx + Math.sin(heading) * a, sz + Math.cos(heading) * a, heading, 0.85, () => {
        c.x = sx;
        c.z = sz;
        c.state = 'sit';
      });
    }
    this.orbitGoal = bench.yaw;
  }

  stand() {
    if (this.mode !== 'sit' || this.me.shot || this.me.slide) return;
    this.mode = 'walk';
    this.focusAt = null;
    for (const [c] of this.seated()) c.state = 'stand';
  }

  /** Terrasadagi stolga ikkalasi o‘tiradi. */
  sitDinner(dinner) {
    this.bench = dinner;
    this.mode = 'sit';
    this.vx = this.vz = 0;
    this.focusAt = dinner.center;
    this.orbitGoal = 0;
    this.orbitPitch = -0.2;
    for (const [c, side] of this.seated()) {
      const seat = dinner.seats[side === 1 ? 0 : 1];
      const [ox, oz] = c.shots.tdown.start;
      const co = Math.cos(seat.heading);
      const si = Math.sin(seat.heading);
      c.state = 'stand';
      this.slideTo(c, seat.x + ox * co + oz * si, seat.z - ox * si + oz * co, seat.heading, 1, () => {
        c.x = seat.x;
        c.z = seat.z;
        c.heading = seat.heading;
        c.state = 'table';
      });
    }
    this.me.glass = dinner.glasses[this.side === 1 ? 0 : 1];
    this.them.glass = dinner.glasses[this.side === 1 ? 1 : 0];
  }

  canKiss() {
    if (this.mode !== 'walk' || this.me.slide || this.me.shot || this.them.shot || this.them.state === 'sit' || this.them.state === 'table') return false;
    return Math.hypot(this.me.x - this.them.x, this.me.z - this.them.z) < 2.4;
  }

  /** `initiator` joyida qoladi, ikkinchisi uning ro‘parasiga keladi. */
  startKiss(initiated) {
    const { me, them } = this;
    this.mode = 'kiss';
    this.vx = this.vz = 0;
    this.kissTime = 8;
    const dx = them.x - me.x;
    const dz = them.z - me.z;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    const gap = 0.33;

    if (initiated) {
      this.slideTo(me, me.x, me.z, Math.atan2(ux, uz), 0.5);
      if (!this.remote) this.slideTo(them, me.x + ux * gap, me.z + uz * gap, Math.atan2(-ux, -uz), 0.9);
    } else {
      this.slideTo(me, them.x - ux * gap, them.z - uz * gap, Math.atan2(ux, uz), 0.9);
    }
    me.state = 'kiss';
    if (!this.remote) them.state = 'kiss';

    // Kamera ikkalasini yon tomondan yaqin oladi.
    const midX = initiated ? me.x + ux * gap * 0.5 : them.x - ux * gap * 0.5;
    const midZ = initiated ? me.z + uz * gap * 0.5 : them.z - uz * gap * 0.5;
    const L = this.layout.length;
    const inside = (x, z) =>
      z < -L ? x > TERRACE.minX + 0.4 && x < TERRACE.maxX - 0.4 && z > -L - TERRACE.depth + 0.4 && z < -L - 0.4 : Math.abs(x) < HALL.width / 2 - 0.4 && z < -0.4 && z > -L + 0.4;
    const clear = (x, z) =>
      inside(x, z) && !this.layout.colliders.some((b) => x > b.minX - 0.7 && x < b.maxX + 0.7 && z > b.minZ - 0.7 && z < b.maxZ + 0.7);
    // Iloji bo'lsa kamera shahar manzarasi tomonga qaraydi.
    let side = ux >= 0 ? 1 : -1;
    if (!clear(midX - uz * 1.9 * side, midZ + ux * 1.9 * side)) side = -side;
    const cx = midX - uz * 1.9 * side;
    const cz = midZ + ux * 1.9 * side;
    const yaw = Math.atan2(-(midX - cx), -(midZ - cz));
    this.flyTo({ x: cx, y: 1.6, z: cz, yaw, pitch: 0.02 }, 1.2, () => {
      this.mode = 'kiss';
    });
    this.mode = 'kiss';
  }

  endKiss() {
    this.me.state = 'stand';
    if (!this.remote) this.them.state = 'stand';
    this.flyTo(() => this.followPose(), 1.1, () => {
      this.mode = 'walk';
    });
  }

  /** Quchoqlashib sekin raqs. */
  startSlow(initiated) {
    const { me, them } = this;
    this.mode = 'slow';
    this.vx = this.vz = 0;
    this.slowTime = 0;
    const dx = them.x - me.x;
    const dz = them.z - me.z;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    const gap = 0.3;
    if (initiated) {
      this.slideTo(me, me.x, me.z, Math.atan2(ux, uz), 0.5);
      if (!this.remote) this.slideTo(them, me.x + ux * gap, me.z + uz * gap, Math.atan2(-ux, -uz), 0.9);
      this.slowCenter = { x: me.x + ux * gap * 0.5, z: me.z + uz * gap * 0.5 };
    } else {
      this.slideTo(me, them.x - ux * gap, them.z - uz * gap, Math.atan2(ux, uz), 0.9);
      this.slowCenter = { x: them.x - ux * gap * 0.5, z: them.z - uz * gap * 0.5 };
    }
    this.slowAngle = Math.atan2(uz, ux);
    this.focusAt = this.slowCenter;
    me.state = 'slow';
    if (!this.remote) them.state = 'slow';
  }

  stopSlow() {
    if (this.mode !== 'slow') return;
    this.mode = 'walk';
    this.focusAt = null;
    this.me.state = 'stand';
    if (!this.remote) this.them.state = 'stand';
  }

  updateSlow(dt, moved, now) {
    const { me, them } = this;
    if (this.mode === 'slow') {
      this.slowTime += dt;
      if (moved && this.slowTime > 0.6) this.stopSlow();
      else if (this.remote && this.slowTime > 2 && them.state !== 'slow') this.stopSlow();
      else if (!this.remote && !me.slide && !them.slide) {
        // Juftlik o'z o'qi atrofida sekin aylanadi.
        this.slowAngle += dt * 0.28;
        const c = this.slowCenter;
        const ux = Math.cos(this.slowAngle);
        const uz = Math.sin(this.slowAngle);
        me.x = c.x - ux * 0.15;
        me.z = c.z - uz * 0.15;
        them.x = c.x + ux * 0.15;
        them.z = c.z + uz * 0.15;
        me.heading = Math.atan2(ux, uz);
        them.heading = Math.atan2(-ux, -uz);
      }
    }
    const active = me.state === 'slow' && them.state === 'slow' && !me.slide && !them.slide;
    const w = (me.slowWeight += ((active ? 1 : 0) - me.slowWeight) * (1 - Math.exp(-dt * 3)));
    if (w > 0.002) {
      const t = now * 0.001;
      me.slowPose(them, w, t, 1);
      them.slowPose(me, w, t, -1);
    }
  }

  /** Yonma-yon yurganda qo'l ushlashadi. */
  updateHands(dt) {
    const { me, them } = this;
    const d = Math.hypot(me.x - them.x, me.z - them.z);
    const facing = Math.cos(shortestAngle(me.heading, them.heading));
    const free = (c) => c.state === 'stand' && !c.slide && !c.shot && c.speed < 2.3;
    const near = free(me) && free(them) && d > 0.3 && d < 1.05 && facing > 0.55 && this.avatarsVisible;
    const w = (me.holdWeight += ((near ? 1 : 0) - me.holdWeight) * (1 - Math.exp(-dt * 5)));
    if (w > 0.01) {
      me.holdHand(them, w);
      them.holdHand(me, w);
    }
  }

  /** Skameykada bittasi boshini yelkaga qo'yadi, ikkinchisi qo'lini oshiradi. */
  updateRest(dt) {
    const { me, them } = this;
    const near = Math.hypot(me.x - them.x, me.z - them.z) < 0.8;
    const on = me.state === 'sit' && them.state === 'sit' && !me.shot && !them.shot && !me.slide && !them.slide && near;
    const w = (me.restWeight += ((on ? 1 : 0) - me.restWeight) * (1 - Math.exp(-dt * 1.6)));
    if (w > 0.002) {
      const [leaner, holder] = them.gender === 'female' && me.gender !== 'female' ? [them, me] : [me, them];
      leaner.restOn(holder, w);
      holder.armAround(leaner, w);
    }
  }

  /** Stolda atirgul uzatadi, keyin sovg'a qutisi ochiladi. */
  giveGift(initiated) {
    const dinner = this.bench;
    if (this.gift || !dinner?.rose || this.me.state !== 'table' || this.them.state !== 'table') return false;
    this.gift = { t: 0, giver: initiated ? this.me : this.them, taker: initiated ? this.them : this.me, opened: false, dinner };
    return true;
  }

  updateGift(dt) {
    const g = this.gift;
    if (!g) return;
    g.t = Math.min(1, g.t + dt / 6.5);
    const s = g.t;
    const { rose, lid, center } = g.dinner;
    const smooth = THREE.MathUtils.smoothstep;
    const mid = new THREE.Vector3(center.x, 1.02, center.z + 0.02);
    const hand = g.giver.reachRight(mid, smooth(s, 0, 0.2) * (1 - smooth(s, 0.5, 0.68)));
    const other = g.taker.reachRight(mid, smooth(s, 0.2, 0.36) * (1 - smooth(s, 0.62, 0.8)));
    rose.visible = s < 0.72;
    if (s < 0.4) rose.position.copy(hand);
    else if (s < 0.72) rose.position.copy(other);
    lid.rotation.x = -2 * smooth(s, 0.62, 0.86);
    if (!g.opened && s > 0.7) {
      g.opened = true;
      this.onGift?.();
    }
    if (s >= 1) this.gift = null;
  }

  updateKiss(dt, moved) {
    const { me, them } = this;
    const active = me.state === 'kiss' && them.state === 'kiss' && !me.slide && !them.slide;
    const k = 1 - Math.exp(-dt * 3.2);
    const w = (me.kissWeight += ((active ? 1 : 0) - me.kissWeight) * k);
    if (w > 0.002) {
      me.kissPose(them, w, 1);
      them.kissPose(me, w, -1);
    }
    if (this.mode === 'kiss') {
      this.kissTime -= dt;
      if (this.kissTime <= 0 || (moved && this.kissTime < 7)) this.endKiss();
    }
  }

  toggleDance() {
    if (this.mode === 'slow') {
      this.stopSlow();
    } else if (this.mode === 'dance') {
      this.stopDance();
    } else if (this.canKiss()) {
      this.onSlowStart?.();
      this.startSlow(true);
    } else if (this.mode === 'walk' && !this.me.slide && !this.me.shot) {
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
    if (me.slide || me.shot) {
      if (me.shot) me.speed = 0;
      return;
    }

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

    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(me.x - last.x, me.z - last.z) > 0.25) {
      this.trail.push({ x: me.x, z: me.z });
      if (this.trail.length > 60) this.trail.shift();
    }

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
    if (them.slide || them.shot || them.state === 'wave' || this.mode === 'sit' || this.mode === 'dance' || this.mode === 'kiss' || this.mode === 'slow') {
      them.speed = 0;
      return;
    }

    const sin = Math.sin(me.heading);
    const cos = Math.cos(me.heading);
    let goalX = me.x - sin * 0.12 + cos * 0.6;
    let goalZ = me.z - cos * 0.12 - sin * 0.6;
    if (Math.hypot(me.x - them.x, me.z - them.z) > 1.9) {
      for (let i = this.trail.length - 1; i >= 0; i--) {
        const p = this.trail[i];
        if (Math.hypot(p.x - me.x, p.z - me.z) >= 1.1) {
          goalX = p.x;
          goalZ = p.z;
          break;
        }
      }
    }
    const dx = goalX - them.x;
    const dz = goalZ - them.z;
    const d = Math.hypot(dx, dz);

    if (d > 9) {
      them.x = goalX;
      them.z = goalZ;
      return;
    }

    // Sherik yonma-yon sayr qiladi, juda orqada qolsagina yuguradi.
    const want = d > 0.22 ? Math.min(d > 3.5 || me.speed > 2 ? RUN : WALK + 0.15, d * 3) : 0;
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
    if (s.t >= 1) {
      c.slide = null;
      c.speed = 0;
      s.then?.();
    }
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
    if (this.waveTime > 0) {
      this.waveTime -= dt;
      if ((this.waveTime <= 0 || moved) && this.me.state === 'wave') {
        this.waveTime = 0;
        this.me.state = 'stand';
      }
    }
    if (this.companionWave > 0) {
      this.companionWave -= dt;
      if (this.companionWave <= 0 && !this.remote && this.them.state === 'wave') this.them.state = 'stand';
    }
    this.moveThem(dt);
    this.applySlide(this.me, dt);
    this.applySlide(this.them, dt);

    this.aimHead(this.me, this.them);
    this.aimHead(this.them, this.me);
    this.me.update(dt);
    this.them.update(dt);
    this.updateHands(dt);
    this.updateRest(dt);
    this.updateKiss(dt, moved);
    this.updateSlow(dt, moved, performance.now());
    this.updateGift(dt);
    this.me.updateSip(dt, this.me.glass);
    this.them.updateSip(dt, this.them.glass);

    if (this.orbitGoal !== null) {
      const delta = shortestAngle(this.orbitYaw, this.orbitGoal);
      this.orbitYaw += delta * (1 - Math.exp(-dt * 3.5));
      if (Math.abs(delta) < 0.01) this.orbitGoal = null;
    }

    const k = 1 - Math.exp(-dt * 8);
    this.focusX += ((this.focusAt?.x ?? this.me.x) - this.focusX) * k;
    this.focusZ += ((this.focusAt?.z ?? this.me.z) - this.focusZ) * k;

    if (this.tween) this.updateTween(dt);
    else if (this.mode !== 'view' && this.mode !== 'kiss') this.followCamera(dt);

    this.camera.rotation.set(this.cam.pitch, this.cam.yaw, 0, 'YXZ');
    this.camera.position.set(this.cam.x, this.cam.y, this.cam.z);
    this.me.root.visible = this.them.root.visible = this.avatarsVisible;
  }

  followCamera(dt) {
    const target = this.followPose();
    const outside = this.focusZ < -this.layout.length;
    if (outside !== this.camOutside) {
      this.camOutside = outside;
      this.camBlend = 0.9;
    }
    if (this.camBlend > 0) {
      // Eshikdan o‘tganda kamera sakramaydi.
      this.camBlend -= dt;
      const k = 1 - Math.exp(-dt * 5);
      this.cam = {
        x: this.cam.x + (target.x - this.cam.x) * k,
        y: this.cam.y + (target.y - this.cam.y) * k,
        z: this.cam.z + (target.z - this.cam.z) * k,
        yaw: this.cam.yaw + shortestAngle(this.cam.yaw, target.yaw) * k,
        pitch: this.cam.pitch + (target.pitch - this.cam.pitch) * k,
      };
    } else {
      this.cam = target;
    }
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
