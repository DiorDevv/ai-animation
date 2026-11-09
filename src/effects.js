import * as THREE from 'three';
import { HALL } from './layout.js';

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
