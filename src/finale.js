import * as THREE from 'three';

const SKY_RADIUS = 62;
const NAME_DISTANCE = 34;
const NAME_POINTS = 1000;

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

function domePoint(centerZ) {
  const a = Math.random() * Math.PI * 2;
  const up = 0.12 + Math.random() * 0.88;
  const flat = Math.sqrt(1 - up * up);
  return [Math.cos(a) * flat * SKY_RADIUS, up * SKY_RADIUS, centerZ + Math.sin(a) * flat * SKY_RADIUS];
}

function textPoints(text) {
  const c = document.createElement('canvas');
  c.width = 1400;
  c.height = 460;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  let size = 260;
  const font = () => `400 ${size}px "Great Vibes", serif`;
  ctx.font = font();
  while (ctx.measureText(text).width > 1300 && size > 60) {
    size -= 6;
    ctx.font = font();
  }
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 700, 230);
  const { data } = ctx.getImageData(0, 0, 1400, 460);
  const found = [];
  for (let y = 0; y < 460; y += 2) {
    for (let x = 0; x < 1400; x += 2) {
      if (data[(y * 1400 + x) * 4 + 3] > 120) found.push([x / 1400 - 0.5, 0.5 - y / 460]);
    }
  }
  const out = [];
  for (let i = 0; i < NAME_POINTS; i++) out.push(found[Math.floor(Math.random() * found.length)]);
  return out;
}

const easeOut = (t) => 1 - (1 - t) ** 3;
const clamp01 = (t) => Math.min(1, Math.max(0, t));

/** Chiroqlar so‘nadi, ship eriydi, yulduzlar yig‘ilib ismni yozadi. */
export class Sky {
  running = false;
  t = 0;

  constructor(scene, room, pixelRatio, reducedMotion, centerZ) {
    Object.assign(this, { scene, room, reducedMotion, centerZ });
    const map = dotTexture();
    const material = (size, color) =>
      new THREE.PointsMaterial({
        map,
        size: size * pixelRatio,
        sizeAttenuation: false,
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });


    this.nameGeo = new THREE.BufferGeometry();
    this.namePos = new Float32Array(NAME_POINTS * 3);
    this.nameGeo.setAttribute('position', new THREE.BufferAttribute(this.namePos, 3));
    this.name = new THREE.Points(this.nameGeo, material(3.1, 0xffe3b0));
    this.name.visible = false;
    this.name.frustumCulled = false;
    scene.add(this.name);
  }

  start({ origin, dir, right, up, width }, text, onDone) {
    this.onDone = onDone;
    this.running = true;
    this.t = 0;
    const center = origin.clone().addScaledVector(dir, NAME_DISTANCE);
    const height = width * (460 / 1400);
    const points = textPoints(text);
    const p = new THREE.Vector3();
    this.items = points.map(([u, v]) => {
      p.copy(center).addScaledVector(right, u * width).addScaledVector(up, v * height);
      return { from: domePoint(this.centerZ), to: [p.x, p.y, p.z], delay: Math.random() * 1.1 };
    });
    this.items.forEach((it, i) => this.namePos.set(it.from, i * 3));
    this.nameGeo.attributes.position.needsUpdate = true;
    this.name.visible = true;
  }

  update(dt) {
    if (!this.running) return;
    this.t += dt * (this.reducedMotion ? 20 : 1);
    const { t, room } = this;

    room.setDim(1 - 0.5 * clamp01(t / 1.6));
    room.setCeiling(1 - clamp01((t - 0.3) / 1.7));
    const glow = clamp01((t - 1) / 1.6);
    this.name.material.opacity = glow;

    if (t > 2 && t < 5.2) {
      this.items.forEach((it, i) => {
        const e = easeOut(clamp01((t - 2 - it.delay) / 1.8));
        for (let a = 0; a < 3; a++) this.namePos[i * 3 + a] = it.from[a] + (it.to[a] - it.from[a]) * e;
      });
      this.nameGeo.attributes.position.needsUpdate = true;
    }

    if (t > 7) {
      this.running = false;
      this.onDone();
    }
  }
}

export { NAME_DISTANCE };
