import * as THREE from 'three';
import { HALL } from './layout.js';
import { glowDot } from './romance.js';

function heartTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d3263a';
  ctx.font = '56px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♥', 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Raqs paytida ko‘tariladigan yurakchalar. */
export class Hearts {
  items = [];
  cursor = 0;

  constructor(scene) {
    const map = heartTexture();
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
      s.visible = false;
      scene.add(s);
      this.items.push({ s, life: 0 });
    }
  }

  emit(x, z) {
    const it = this.items[this.cursor++ % this.items.length];
    it.life = 1;
    it.s.visible = true;
    it.s.position.set(x + (Math.random() - 0.5) * 0.8, 1.5 + Math.random() * 0.5, z + (Math.random() - 0.5) * 0.8);
    it.drift = (Math.random() - 0.5) * 0.3;
  }

  update(dt) {
    for (const it of this.items) {
      if (it.life <= 0) continue;
      it.life -= dt / 1.7;
      it.s.position.y += dt * 0.75;
      it.s.position.x += dt * it.drift;
      it.s.material.opacity = Math.min(1, it.life * 2.2);
      it.s.scale.setScalar(0.16 + (1 - it.life) * 0.14);
      if (it.life <= 0) it.s.visible = false;
    }
  }
}

/** Oxirgi maktub ochilgach yog‘adigan atirgul barglari. */
export class Petals {
  active = false;
  count = 150;
  dummy = new THREE.Object3D();

  constructor(scene, length) {
    this.length = length;
    const geo = new THREE.PlaneGeometry(0.075, 0.06);
    const mat = new THREE.MeshBasicMaterial({ color: 0xc22a3f, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    const col = new THREE.Color();
    this.p = Array.from({ length: this.count }, (_, i) => {
      this.mesh.setColorAt(i, col.setHSL(0.97, 0.62, 0.34 + Math.random() * 0.2));
      return {
        x: (Math.random() - 0.5) * (HALL.width - 0.4),
        y: Math.random() * HALL.height,
        z: -Math.random() * length,
        speed: 0.28 + Math.random() * 0.3,
        spin: 0.6 + Math.random() * 1.4,
        seed: Math.random() * 6.28,
      };
    });
  }

  start() {
    this.active = this.mesh.visible = true;
  }

  update(dt, now) {
    if (!this.active) return;
    const t = now * 0.001;
    const d = this.dummy;
    this.p.forEach((p, i) => {
      p.y -= p.speed * dt;
      if (p.y < 0.02) p.y = HALL.height - 0.1;
      d.position.set(p.x + Math.sin(t * 0.8 + p.seed) * 0.25, p.y, p.z + Math.cos(t * 0.6 + p.seed) * 0.25);
      d.rotation.set(t * p.spin + p.seed, t * p.spin * 0.7, p.seed);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const BURSTS = 7;
const PER_BURST = 150;
const PALETTE = [[1, 0.35, 0.45], [1, 0.8, 0.35], [0.55, 0.75, 1], [1, 0.5, 0.85], [0.6, 1, 0.75], [1, 1, 0.92]];

/** Daryo ustida mushakbozlik: uchqunlar suvda ham aks etadi. */
export class Fireworks {
  time = 0;
  next = 0;
  cursor = 0;

  constructor(scene, cx, centerZ) {
    this.cx = cx;
    this.centerZ = centerZ;
    const total = BURSTS * PER_BURST;
    this.positions = new Float32Array(total * 3);
    this.colors = new Float32Array(total * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geo = geo;

    const map = glowDot();
    const material = (size, opacity) =>
      new THREE.PointsMaterial({
        size,
        map,
        vertexColors: true,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    this.sparks = new THREE.Points(geo, material(2.1, 1));
    this.mirror = new THREE.Points(geo, material(2.3, 0.3));
    this.mirror.scale.y = -1;
    for (const p of [this.sparks, this.mirror]) {
      p.frustumCulled = false;
      p.visible = false;
      scene.add(p);
    }
    this.bursts = Array.from({ length: BURSTS }, () => ({ life: 0 }));
  }

  start(seconds) {
    this.time = seconds;
    this.next = 0;
    this.sparks.visible = this.mirror.visible = true;
  }

  spawn() {
    const b = this.bursts[this.cursor++ % BURSTS];
    b.life = 1;
    b.age = 0;
    b.x = this.cx - 95 + Math.random() * 190;
    b.y = 26 + Math.random() * 30;
    b.z = this.centerZ - 205 - Math.random() * 25;
    b.color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    const heart = Math.random() < 0.3;
    b.dirs = Array.from({ length: PER_BURST }, (_, i) => {
      if (heart) {
        const t = (i / PER_BURST) * Math.PI * 2;
        return [(16 * Math.sin(t) ** 3) / 16, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16, 0, 15];
      }
      const a = Math.random() * Math.PI * 2;
      const y = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - y * y);
      return [Math.cos(a) * r, y, Math.sin(a) * r, 11 + Math.random() * 10];
    });
  }

  update(dt, sound) {
    if (!this.sparks.visible) return;
    if (this.time > 0) {
      this.time -= dt;
      this.next -= dt;
      if (this.next <= 0) {
        this.next = 0.55 + Math.random() * 0.9;
        this.spawn();
        setTimeout(() => sound.boom(), 500);
      }
    }
    let alive = this.time > 0;
    this.bursts.forEach((b, n) => {
      const offset = n * PER_BURST;
      if (b.life <= 0) {
        this.colors.fill(0, offset * 3, (offset + PER_BURST) * 3);
        return;
      }
      alive = true;
      b.age += dt;
      b.life -= dt / 2.7;
      const reach = 1 - Math.exp(-b.age * 2.2);
      const fade = Math.max(0, b.life) ** 1.3 * 1.6;
      b.dirs.forEach((d, i) => {
        const at = (offset + i) * 3;
        this.positions[at] = b.x + d[0] * d[3] * reach;
        this.positions[at + 1] = b.y + d[1] * d[3] * reach - 2.4 * b.age * b.age;
        this.positions[at + 2] = b.z + d[2] * d[3] * reach;
        this.colors[at] = b.color[0] * fade;
        this.colors[at + 1] = b.color[1] * fade;
        this.colors[at + 2] = b.color[2] * fade;
      });
    });
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    if (!alive) this.sparks.visible = this.mirror.visible = false;
  }
}
