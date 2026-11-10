import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HALL } from './layout.js';

const ARCH_HALF = 1.75;

export function glowDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,240,205,1)');
  g.addColorStop(0.3, 'rgba(255,200,120,.8)');
  g.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Ship ostida devordan devorga tortilgan mitti chiroqlar. */
function fairyLights(scene, length) {
  const W = HALL.width;
  const H = HALL.height;
  const bulbs = [];
  const wire = [];
  const SEGMENTS = 20;
  for (let z = -1.4; z > -length + 0.5; z -= 2.4) {
    const point = (i) => {
      const u = i / SEGMENTS;
      const sag = 0.62 * (1 - (2 * u - 1) ** 2);
      return [-W / 2 + u * W, H - 0.06 - sag, z];
    };
    for (let i = 0; i < SEGMENTS; i++) {
      wire.push(...point(i), ...point(i + 1));
      if (i > 0) bulbs.push(...point(i));
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
  scene.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x3a2c1e })));

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(bulbs, 3));
  const mat = new THREE.PointsMaterial({
    map: glowDot(),
    size: 0.2,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  return mat;
}

function heartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0.25, 0.25);
  s.bezierCurveTo(0.25, 0.25, 0.2, 0, 0, 0);
  s.bezierCurveTo(-0.3, 0, -0.3, 0.35, -0.3, 0.35);
  s.bezierCurveTo(-0.3, 0.55, -0.1, 0.77, 0.25, 0.95);
  s.bezierCurveTo(0.6, 0.77, 0.8, 0.55, 0.8, 0.35);
  s.bezierCurveTo(0.8, 0.35, 0.8, 0, 0.5, 0);
  s.bezierCurveTo(0.35, 0, 0.25, 0.25, 0.25, 0.25);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false, curveSegments: 12 });
  geo.center();
  geo.rotateZ(Math.PI);
  return geo;
}

/** Shipdan osilib, sekin tebranib turgan yurakchalar. */
function hangingHearts(scene, length) {
  const items = [];
  const cords = [];
  for (let z = -3; z > -length + 2; z -= 2.2) {
    for (const x of [-3.5, 3.5]) {
      const drop = 0.7 + ((Math.abs(z * 7 + x) * 13) % 9) * 0.09;
      const y = HALL.height - drop;
      items.push({ x, y, z, seed: z + x });
      cords.push(x, HALL.height, z, x, y + 0.14, z);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(cords, 3));
  scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x8a6a3a })));

  const mesh = new THREE.InstancedMesh(heartGeometry(), new THREE.MeshLambertMaterial({ color: 0xffffff }), items.length);
  const color = new THREE.Color();
  items.forEach((_, i) => mesh.setColorAt(i, color.set(i % 3 === 0 ? 0xe8798f : 0xb5203a)));
  mesh.frustumCulled = false;
  scene.add(mesh);

  const d = new THREE.Object3D();
  const update = (now) => {
    items.forEach((it, i) => {
      d.position.set(it.x, it.y, it.z);
      d.rotation.set(0, Math.sin(now * 0.0007 + it.seed) * 0.8, Math.sin(now * 0.0011 + it.seed) * 0.08);
      d.scale.setScalar(0.3);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return update;
}

/** Ichma-ich gulbarglardan iborat kichik atirgul boshi. */
function roseGeometry() {
  const parts = [];
  const layers = [[6, 0.075, 0.0, 0.05], [5, 0.055, 0.03, 0.04], [3, 0.03, 0.055, 0.032]];
  layers.forEach(([n, ring, y, size], l) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + l * 0.6;
      const petal = new THREE.SphereGeometry(size, 7, 5);
      petal.scale(1, 0.7, 0.55);
      petal.rotateY(-a);
      petal.rotateX(0.35);
      petal.translate(Math.cos(a) * ring, y, Math.sin(a) * ring);
      parts.push(petal);
    }
  });
  return mergeGeometries(parts);
}

function roseHead(radius) {
  const g = new THREE.IcosahedronGeometry(radius, 1);
  g.scale(1, 0.82, 1);
  return g;
}

/** Devorlar yonidagi guldonlar: butun zal uchun ikki chizish chaqiruvi. */
function vases(scene, layout) {
  const spots = [];
  const half = HALL.width / 2 - 0.42;
  for (let z = -5; z > -layout.length + 1; z -= 5.1) {
    for (const x of [-half, half]) {
      // Ramka tagiga tushib qolmasin
      const free = !layout.placements.some((p) => p.wall !== 'end' && Math.sign(p.pos.x) === Math.sign(x) && Math.abs(p.pos.z - z) < p.outerW / 2 + 0.45);
      if (free) spots.push([x, z]);
    }
  }
  spots.push([-half, -layout.length + 0.8], ...(layout.extraVases ?? []));

  const profile = [[0, 0], [0.13, 0], [0.17, 0.12], [0.15, 0.32], [0.08, 0.52], [0.1, 0.6]].map(([r, y]) => new THREE.Vector2(r, y));
  const vaseGeo = new THREE.LatheGeometry(profile, 18);
  const vaseMesh = new THREE.InstancedMesh(vaseGeo, new THREE.MeshLambertMaterial({ color: 0xd8c39a }), spots.length);

  const parts = [];
  const placesInBouquet = [[0, 0.98, 0], [0.13, 0.88, 0.04], [-0.12, 0.9, 0.06], [0.03, 0.87, -0.14], [-0.05, 0.84, 0.15], [0.17, 0.8, -0.1], [-0.17, 0.78, -0.08]];
  for (const [x, y, z] of placesInBouquet) parts.push(roseHead(0.09).translate(x, y, z));
  const roses = new THREE.InstancedMesh(mergeGeometries(parts), new THREE.MeshLambertMaterial({ color: 0xa8152f }), spots.length);

  const leaves = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    leaves.push(new THREE.IcosahedronGeometry(0.07, 0).scale(1.4, 0.5, 1).translate(Math.cos(a) * 0.17, 0.68, Math.sin(a) * 0.17));
  }
  const leafMesh = new THREE.InstancedMesh(mergeGeometries(leaves), new THREE.MeshLambertMaterial({ color: 0x3f7a4c }), spots.length);

  const m = new THREE.Matrix4();
  spots.forEach(([x, z], i) => {
    m.makeTranslation(x, 0, z);
    vaseMesh.setMatrixAt(i, m);
    roses.setMatrixAt(i, m);
    leafMesh.setMatrixAt(i, m);
  });
  scene.add(vaseMesh, roses, leafMesh);
}

function archZ(layout) {
  let z = -layout.length * 0.68;
  for (let i = 0; i < 12; i++) {
    const clash =
      layout.benches.some((b) => Math.abs(b.seat.z - z) < 2.1) || Math.abs(layout.pedestal.z - z) < 1.6;
    if (!clash) return z;
    z += 0.9;
  }
  return z;
}

/** Gilam ustidagi atirgul arkasi va uning ostidagi yozuv. Odamlar tagidan o‘tadi. */
function arch(scene, layout, text) {
  const z = archZ(layout);
  const CENTER_Y = 1.75;
  const path = [];
  for (let y = 0.12; y < CENTER_Y; y += 0.17) {
    path.push([-ARCH_HALF, y], [ARCH_HALF, y]);
  }
  for (let a = 0; a <= Math.PI + 0.001; a += Math.PI / 30) {
    path.push([Math.cos(a) * ARCH_HALF, CENTER_Y + Math.sin(a) * ARCH_HALF]);
  }

  const heads = [];
  const rnd = (i, k) => (Math.sin(i * 91.7 + k * 13.1) * 43758.5) % 1;
  path.forEach(([x, y], i) => {
    for (let k = 0; k < 4; k++) {
      heads.push([x + rnd(i, k) * 0.2, y + rnd(i, k + 3) * 0.2, z + rnd(i, k + 7) * 0.26]);
    }
  });
  const mesh = new THREE.InstancedMesh(roseGeometry(), new THREE.MeshLambertMaterial({ color: 0xffffff }), heads.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  const palette = [0x9c1230, 0xb01a38, 0xa8152f, 0xc22242, 0x8c0f2a, 0xb01d39, 0xc94a66, 0x2f5f3b];
  const color = new THREE.Color();
  heads.forEach(([x, y, zz], i) => {
    e.set(rnd(i, 21) * 3, rnd(i, 22) * 3, rnd(i, 23) * 3);
    m.compose(p3.set(x, y, zz), q.setFromEuler(e), s3.setScalar(0.85 + Math.abs(rnd(i, 24)) * 0.4));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, color.set(palette[Math.abs(Math.floor(rnd(i, 11) * 10)) % palette.length]));
  });
  scene.add(mesh);

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '400 150px "Great Vibes", serif';
  ctx.shadowColor = '#ff4a7d';
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#ffe3ec';
  ctx.fillText(text, 512, 132);
  ctx.fillText(text, 512, 132);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Ikki tomondan ham to‘g‘ri o‘qiladi.
  for (const turn of [0, Math.PI]) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.65),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    sign.position.set(0, 2.72, z);
    sign.rotation.y = turn;
    scene.add(sign);
  }

  for (const x of [-ARCH_HALF, ARCH_HALF]) {
    layout.colliders.push({ minX: x - 0.24, maxX: x + 0.24, minZ: z - 0.24, maxZ: z + 0.24 });
  }
}

export function buildRomance(scene, layout, signText) {
  const lights = fairyLights(scene, layout.length);
  const swing = hangingHearts(scene, layout.length);
  vases(scene, layout);
  arch(scene, layout, signText);
  return (now) => {
    swing(now);
    lights.opacity = 0.85 + Math.sin(now * 0.0023) * 0.15;
  };
}
