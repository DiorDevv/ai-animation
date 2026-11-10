import * as THREE from 'three';
import { HALL, DOOR, TERRACE } from './layout.js';
import { bakeTerrace } from './bake.js';
import { glowDot } from './romance.js';
import { buildNight } from './night.js';
import { buildDinner } from './dinner.js';

const RAIL_HEIGHT = 0.98;

function facade(scene, length) {
  const H = HALL.height;
  const left = DOOR.x - DOOR.half;
  const right = DOOR.x + DOOR.half;
  const mat = new THREE.MeshLambertMaterial({ color: 0x4a3a31 });
  const piece = (x0, x1, y0, y1) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0, Math.ceil(x1 - x0), 2), mat);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, -length - 0.02);
    mesh.rotation.y = Math.PI;
    scene.add(mesh);
  };
  piece(TERRACE.minX, left, 0, H);
  piece(right, TERRACE.maxX, 0, H);
  piece(left, right, DOOR.height, H);

  const gold = new THREE.MeshLambertMaterial({ color: 0xc9a25a });
  const t = 0.1;
  const jamb = new THREE.BoxGeometry(t, DOOR.height + t, 0.3);
  for (const x of [left, right]) {
    const m = new THREE.Mesh(jamb, gold);
    m.position.set(x, (DOOR.height + t) / 2, -length);
    scene.add(m);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(DOOR.half * 2 + t, t, 0.3), gold);
  head.position.set(DOOR.x, DOOR.height + t / 2, -length);
  scene.add(head);
}

function doorSign(scene, length) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '400 92px "Great Vibes", serif';
  ctx.shadowColor = '#ffb56b';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#ffe9c9';
  ctx.fillText('Terrasa', 256, 66);
  ctx.fillText('Terrasa', 256, 66);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.375),
    new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }),
  );
  sign.position.set(DOOR.x, DOOR.height + 0.42, -length + 0.03);
  scene.add(sign);
}

function railing(scene, length) {
  const { minX, maxX, depth } = TERRACE;
  const far = -length - depth + 0.08;
  const near = -length;
  const stone = new THREE.MeshLambertMaterial({ color: 0xb9ab97 });
  const posts = [];
  for (let x = minX + 0.08; x <= maxX - 0.08; x += 0.34) posts.push([x, far]);
  for (let z = near - 0.35; z > far; z -= 0.34) posts.push([minX + 0.08, z], [maxX - 0.08, z]);

  const baluster = new THREE.LatheGeometry(
    [[0, 0], [0.055, 0], [0.04, 0.12], [0.075, 0.42], [0.035, 0.74], [0.05, RAIL_HEIGHT - 0.06], [0, RAIL_HEIGHT - 0.06]].map(
      ([r, y]) => new THREE.Vector2(r, y),
    ),
    8,
  );
  const mesh = new THREE.InstancedMesh(baluster, stone, posts.length);
  const m = new THREE.Matrix4();
  posts.forEach(([x, z], i) => mesh.setMatrixAt(i, m.makeTranslation(x, 0, z)));
  scene.add(mesh);

  const w = maxX - minX;
  const top = (sx, sz, x, z) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.08, sz), stone);
    b.position.set(x, RAIL_HEIGHT - 0.03, z);
    scene.add(b);
  };
  top(w, 0.2, (minX + maxX) / 2, far);
  top(0.2, depth, minX + 0.08, -length - depth / 2);
  top(0.2, depth, maxX - 0.08, -length - depth / 2);
}

/** Terrasa ustidagi ustunlar va mitti chiroqlar. */
function stringLights(scene, length) {
  const { minX, maxX, depth } = TERRACE;
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3b2c20 });
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.06, 3.7, 8);
  const inset = 0.45;
  const zs = [-length - inset, -length - depth / 2, -length - depth + inset];
  const bulbs = [];
  const wire = [];
  const SEGMENTS = 26;
  for (const z of zs) {
    for (const x of [minX + inset, maxX - inset]) {
      if (z === zs[0]) continue;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 1.85, z);
      scene.add(pole);
    }
    const y0 = z === zs[0] ? 3.3 : 3.65;
    for (let i = 0; i <= SEGMENTS; i++) {
      const u = i / SEGMENTS;
      const x = minX + inset + u * (maxX - minX - 2 * inset);
      const y = y0 - 0.75 * (1 - (2 * u - 1) ** 2);
      if (i < SEGMENTS) {
        const nu = (i + 1) / SEGMENTS;
        wire.push(x, y, z, minX + inset + nu * (maxX - minX - 2 * inset), y0 - 0.75 * (1 - (2 * nu - 1) ** 2), z);
      }
      if (i > 0 && i < SEGMENTS) bulbs.push(x, y, z);
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
  scene.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x2a2018 })));

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(bulbs, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ map: glowDot(), size: 0.13, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  points.frustumCulled = false;
  scene.add(points);
}

export function buildTerrace(scene, layout) {
  const L = layout.length;
  const { minX, maxX, depth } = TERRACE;
  const cx = (minX + maxX) / 2;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, depth, 16, 12), new THREE.MeshBasicMaterial({ map: bakeTerrace(layout) }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, -L - depth / 2);
  scene.add(floor);

  facade(scene, L);
  doorSign(scene, L);
  railing(scene, L);
  stringLights(scene, L);

  layout.extraVases = [
    [minX + 0.7, -L - depth + 0.75],
    [maxX - 0.7, -L - depth + 0.75],
    [minX + 0.7, -L - 0.7],
    [DOOR.x - DOOR.half - 0.55, -L - 0.55],
    [DOOR.x + DOOR.half + 0.55, -L - 0.55],
  ];

  layout.dinner = buildDinner(scene, layout);

  return buildNight(scene, cx, -L, Math.min(devicePixelRatio, 1.75), layout);
}
