import { HALL } from './layout.js';

export const EYE = 1.62;
const SIT_EYE = 1.14;
const RADIUS = 0.34;
const WALK = 3;
const RUN = 5;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function shortestAngle(from, to) {
  return ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

export class Player {
  mode = 'walk'; // walk | sit | view | fly
  x = 0;
  y = EYE;
  z = -1.1;
  yaw = 0;
  pitch = 0;
  vx = 0;
  vz = 0;
  bob = 0;
  tween = null;
  bench = null;

  constructor(camera, layout, reducedMotion) {
    this.camera = camera;
    this.layout = layout;
    this.reducedMotion = reducedMotion;
  }

  pose() {
    return { x: this.x, y: this.y, z: this.z, yaw: this.yaw, pitch: this.pitch };
  }

  look(dx, dy) {
    this.yaw += dx;
    this.pitch = clamp(this.pitch + dy, -1.15, 1.15);
  }

  flyTo(target, duration, next) {
    this.mode = 'fly';
    this.vx = this.vz = 0;
    this.tween = {
      from: this.pose(),
      target,
      t: 0,
      duration: this.reducedMotion ? 0.01 : duration,
      next,
    };
  }

  sit(bench) {
    this.bench = bench;
    this.flyTo({ x: bench.seat.x, y: SIT_EYE, z: bench.seat.z, yaw: bench.yaw, pitch: 0.04 }, 0.8, () => {
      this.mode = 'sit';
    });
  }

  stand() {
    const { stand } = this.bench;
    this.flyTo({ x: stand.x, y: EYE, z: stand.z, yaw: this.yaw, pitch: this.pitch }, 0.6, () => {
      this.mode = 'walk';
    });
  }

  collide() {
    const half = HALL.width / 2 - RADIUS;
    this.x = clamp(this.x, -half, half);
    this.z = clamp(this.z, -this.layout.length + RADIUS, -RADIUS);

    for (const c of this.layout.colliders) {
      const nx = clamp(this.x, c.minX, c.maxX);
      const nz = clamp(this.z, c.minZ, c.maxZ);
      const dx = this.x - nx;
      const dz = this.z - nz;
      const d = Math.hypot(dx, dz);
      if (d >= RADIUS) continue;
      if (d > 1e-5) {
        this.x = nx + (dx / d) * RADIUS;
        this.z = nz + (dz / d) * RADIUS;
      } else {
        const pushes = [
          [this.x - c.minX, c.minX - RADIUS, 'x'],
          [c.maxX - this.x, c.maxX + RADIUS, 'x'],
          [this.z - c.minZ, c.minZ - RADIUS, 'z'],
          [c.maxZ - this.z, c.maxZ + RADIUS, 'z'],
        ].sort((a, b) => a[0] - b[0]);
        this[pushes[0][2]] = pushes[0][1];
      }
    }
  }

  update(dt, input) {
    if (this.mode === 'fly') this.updateTween(dt);
    else if (this.mode === 'walk') this.updateWalk(dt, input);
    else if (this.mode === 'sit' && (input.strafe || input.forward)) this.stand();

    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.position.set(this.x, this.y, this.z);
  }

  updateTween(dt) {
    const tw = this.tween;
    tw.t = Math.min(1, tw.t + dt / tw.duration);
    const e = easeInOut(tw.t);
    this.x = tw.from.x + (tw.target.x - tw.from.x) * e;
    this.y = tw.from.y + (tw.target.y - tw.from.y) * e;
    this.z = tw.from.z + (tw.target.z - tw.from.z) * e;
    this.yaw = tw.from.yaw + shortestAngle(tw.from.yaw, tw.target.yaw) * e;
    this.pitch = tw.from.pitch + (tw.target.pitch - tw.from.pitch) * e;
    if (tw.t >= 1) {
      this.tween = null;
      tw.next();
    }
  }

  updateWalk(dt, input) {
    this.yaw += input.turn * dt * 1.9;
    const speed = input.run ? RUN : WALK;
    const len = Math.max(1, Math.hypot(input.strafe, input.forward));
    const s = input.strafe / len;
    const f = input.forward / len;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const tx = (s * cos - f * sin) * speed;
    const tz = (-s * sin - f * cos) * speed;

    const k = 1 - Math.exp(-dt * 11);
    this.vx += (tx - this.vx) * k;
    this.vz += (tz - this.vz) * k;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.collide();

    const moving = Math.hypot(this.vx, this.vz);
    this.bob += moving * dt * 2.6;
    const amount = this.reducedMotion ? 0 : Math.min(1, moving / WALK) * 0.014;
    this.y = EYE + Math.sin(this.bob) * amount;
  }
}
