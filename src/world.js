import * as THREE from 'three';
import { HALL, MAT, BORDER, DOOR } from './layout.js';
import { bakeWall, bakeFloor, bakeCeilingTile, bakePlaque, drawDedication, toTexture } from './bake.js';
import { SITE } from './config.js';
import { buildRomance } from './romance.js';
import { buildTerrace } from './terrace.js';

const basic = (map) => new THREE.MeshBasicMaterial({ map });
const room = { dim: [], ceiling: null, lamps: null };

function addWall(scene, { center, length, rotY, map }) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(length, HALL.height, Math.ceil(length), 4), basic(map));
  mesh.position.copy(center).setY(HALL.height / 2);
  mesh.rotation.y = rotY;
  scene.add(mesh);
  room.dim.push(mesh.material);
}

/** Terrasaga chiqish eshigi ochilgan oxirgi devor. */
function addEndWall(scene, L, map) {
  const W = HALL.width;
  const H = HALL.height;
  const material = basic(map);
  room.dim.push(material);
  const piece = (x0, x1, y0, y1) => {
    const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0, Math.ceil(x1 - x0), 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      g.attributes.uv.setXY(i, (pos.getX(i) + (x0 + x1) / 2 + W / 2) / W, (pos.getY(i) + (y0 + y1) / 2) / H);
    }
    const mesh = new THREE.Mesh(g, material);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, -L);
    scene.add(mesh);
  };
  piece(-W / 2, DOOR.x - DOOR.half, 0, H);
  piece(DOOR.x + DOOR.half, W / 2, 0, H);
  piece(DOOR.x - DOOR.half, DOOR.x + DOOR.half, DOOR.height, H);
}

function wallItems(placements, wall, center) {
  return placements
    .filter((p) => p.wall === wall)
    .map((p) => ({ along: p.pos.clone().sub(center).dot(p.right), outerW: p.outerW, outerH: p.outerH }));
}

function buildRoom(scene, layout) {
  const { width: W, height: H } = HALL;
  const L = layout.length;
  const { placements } = layout;

  const leftC = new THREE.Vector3(-W / 2, 0, -L / 2);
  const rightC = new THREE.Vector3(W / 2, 0, -L / 2);
  const endC = new THREE.Vector3(0, 0, -L);
  const startC = new THREE.Vector3(0, 0, 0);

  addWall(scene, { center: leftC, length: L, rotY: Math.PI / 2, map: bakeWall({ length: L, items: wallItems(placements, 'left', leftC) }) });
  addWall(scene, { center: rightC, length: L, rotY: -Math.PI / 2, map: bakeWall({ length: L, items: wallItems(placements, 'right', rightC) }) });
  addEndWall(scene, L, bakeWall({ length: W, items: wallItems(placements, 'end', endC), panel: layout.endSpan ? layout.endSpan + 0.8 : 0 }));
  addWall(scene, {
    center: startC,
    length: W,
    rotY: Math.PI,
    map: bakeWall({ length: W, items: [], draw: drawDedication(SITE.title, SITE.dedication) }),
  });

  // Katta sirtlar bo‘laklanadi: kamera yaqin kelganda uchburchaklar buzilib chizilmasin.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L, 12, 28), basic(bakeFloor(layout)));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -L / 2);
  scene.add(floor);
  room.dim.push(floor.material);

  const tile = bakeCeilingTile();
  tile.repeat.set(W / 2.75, L / 2.75);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, L, 12, 28), basic(tile));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, H, -L / 2);
  scene.add(ceiling);
  room.ceiling = ceiling;

  // Har ramka ustidagi chiroq
  const lampGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.2, 14);
  const lamps = new THREE.InstancedMesh(
    lampGeo,
    [
      new THREE.MeshBasicMaterial({ color: 0x141416 }),
      new THREE.MeshBasicMaterial({ color: 0x141416 }),
      new THREE.MeshBasicMaterial({ color: 0xfff1d6 }),
    ],
    placements.length,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const down = new THREE.Vector3(0, -1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  placements.forEach((p, i) => {
    const at = p.pos.clone().addScaledVector(p.normal, 1.3).setY(H - 0.16);
    q.setFromUnitVectors(down, p.pos.clone().sub(at).normalize());
    lamps.setMatrixAt(i, m.compose(at, q, one));
  });
  scene.add(lamps);
  room.lamps = lamps;
}

function glassTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, 'rgba(255,240,215,.22)');
  g.addColorStop(0.32, 'rgba(255,240,215,.03)');
  g.addColorStop(0.46, 'rgba(255,240,215,.1)');
  g.addColorStop(0.58, 'rgba(255,240,215,0)');
  g.addColorStop(1, 'rgba(255,240,215,.05)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function matTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efe6d4';
  ctx.fillRect(0, 0, 256, 256);
  const edge = (x0, y0, x1, y1) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(40,26,12,.34)');
    g.addColorStop(1, 'rgba(40,26,12,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  };
  edge(0, 0, 0, 16);
  edge(0, 256, 0, 240);
  edge(0, 0, 16, 0);
  edge(256, 0, 240, 0);
  return toTexture(c);
}

function buildFrames(scene, placements, maxAniso) {
  const backMat = new THREE.MeshBasicMaterial({ color: 0x1a120a });
  const gold = new THREE.MeshLambertMaterial({ color: 0xc9a25a });
  const matMat = new THREE.MeshBasicMaterial({ map: matTexture() });
  const cutMat = new THREE.MeshBasicMaterial({ color: 0x8a7a60 });
  const glass = new THREE.MeshBasicMaterial({
    map: glassTexture(),
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const hit = [];
  const DEPTH = 0.08;

  for (const p of placements) {
    const group = new THREE.Group();
    group.position.copy(p.pos);
    group.rotation.y = p.yaw;

    const back = new THREE.Mesh(new THREE.BoxGeometry(p.outerW, p.outerH, 0.05), backMat);
    back.position.z = 0.025;
    back.userData.placement = p;
    group.add(back);
    hit.push(back);

    // Oltin yog‘och ramka: to‘rt alohida qirra
    const horizontal = new THREE.BoxGeometry(p.outerW, BORDER, DEPTH);
    const vertical = new THREE.BoxGeometry(BORDER, p.outerH - 2 * BORDER, DEPTH);
    for (const sign of [-1, 1]) {
      const h = new THREE.Mesh(horizontal, gold);
      h.position.set(0, (sign * (p.outerH - BORDER)) / 2, DEPTH / 2);
      const v = new THREE.Mesh(vertical, gold);
      v.position.set((sign * (p.outerW - BORDER)) / 2, 0, DEPTH / 2);
      group.add(h, v);
    }

    const mat = new THREE.Mesh(new THREE.PlaneGeometry(p.w + 2 * MAT, p.h + 2 * MAT), matMat);
    mat.position.z = 0.053;
    group.add(mat);

    const cut = new THREE.Mesh(new THREE.PlaneGeometry(p.w + 0.014, p.h + 0.014), cutMat);
    cut.position.z = 0.055;
    group.add(cut);

    const photo = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), basic(toTexture(p.memory.canvas, maxAniso)));
    photo.position.z = 0.057;
    group.add(photo);

    const sheen = new THREE.Mesh(new THREE.PlaneGeometry(p.w + 2 * MAT, p.h + 2 * MAT), glass);
    sheen.position.z = 0.062;
    group.add(sheen);

    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.23), basic(bakePlaque(p.memory)));
    plaque.position.set(p.outerW / 2 + 0.38, -0.5, 0.006);
    group.add(plaque);

    scene.add(group);
  }
  return hit;
}

function buildBenches(scene, benches) {
  const seatMat = new THREE.MeshLambertMaterial({ color: 0x6b4a32 });
  const legMat = new THREE.MeshLambertMaterial({ color: 0x24242a });
  for (const b of benches) {
    const group = new THREE.Group();
    group.position.copy(b.seat);
    group.rotation.y = Math.atan2(-b.along.z, b.along.x);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(b.length, 0.08, 0.5), seatMat);
    seat.position.y = 0.46;
    group.add(seat);

    const offset = b.length / 2 - 0.22;
    for (const x of [-offset, offset]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.42), legMat);
      leg.position.set(x, 0.21, 0);
      group.add(leg);
    }
    scene.add(group);
  }
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,240,200,1)');
  g.addColorStop(0.25, 'rgba(255,180,90,.75)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const glowSprite = (map, size) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  return s;
};

function buildCandles(scene, layout) {
  const map = glowTexture();
  const wax = new THREE.MeshBasicMaterial({ color: 0xe9dcc3 });
  const flames = [];
  const spots = [];
  for (const p of layout.placements) {
    for (const side of [-1, 1]) {
      spots.push(p.pos.clone().addScaledVector(p.normal, 0.42).addScaledVector(p.right, side * (p.outerW / 2 - 0.05)).setY(0));
    }
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    spots.push(layout.pedestal.clone().add(new THREE.Vector3(Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85)));
  }
  spots.forEach((at, i) => {
    const h = 0.14 + ((i * 7) % 5) * 0.035;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, h, 10), wax);
    candle.position.copy(at).setY(h / 2);
    scene.add(candle);
    const flame = glowSprite(map, 0.3);
    flame.position.copy(at).setY(h + 0.07);
    scene.add(flame);
    flames.push({ flame, seed: i * 1.7 });
  });
  return flames;
}

/** Zal bo‘ylab suzib turgan yashirin xatchalar. */
function buildNotes(scene, layout, count) {
  const map = glowTexture();
  const paper = new THREE.MeshBasicMaterial({ color: 0xf1e4c9 });
  const seal = new THREE.MeshBasicMaterial({ color: 0xb01f2e });
  const L = layout.length;
  const blocked = (x, z) =>
    layout.colliders.some((c) => x > c.minX - 0.9 && x < c.maxX + 0.9 && z > c.minZ - 0.9 && z < c.maxZ + 0.9);

  return Array.from({ length: count }, (_, i) => {
    const sign = i % 2 ? 1 : -1;
    let x = sign * (1.3 + ((i * 37) % 28) / 10);
    const z = -(3 + (i * (L - 7)) / Math.max(1, count - 1));
    for (let tries = 0; tries < 4 && blocked(x, z); tries++) x -= sign * 1.1;

    const group = new THREE.Group();
    group.position.set(x, 1.15, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.17, 0.012), paper);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), seal);
    dot.position.z = 0.008;
    const dotBack = dot.clone();
    dotBack.position.z = -0.008;
    dotBack.rotation.y = Math.PI;
    const halo = glowSprite(map, 0.75);
    halo.material.opacity = 0.55;
    group.add(body, dot, dotBack, halo);
    scene.add(group);
    return { group, x, z, index: i, found: false, seed: i * 1.3 };
  });
}

function buildCounter(scene, layout) {
  if (!layout.endSpan) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 120;
  const tex = toTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 0.48),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.position.set(0, 3.6, -layout.length + 0.02);
  scene.add(mesh);
  const ctx = canvas.getContext('2d');
  return (text) => {
    ctx.clearRect(0, 0, 1400, 120);
    ctx.fillStyle = '#e6c88a';
    ctx.font = '500 66px "Cormorant Garamond", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 700, 62);
    tex.needsUpdate = true;
  };
}

function buildHeart(scene, at) {
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.05, 0.8), new THREE.MeshLambertMaterial({ color: 0x8f8474 }));
  pedestal.position.copy(at).setY(0.525);
  scene.add(pedestal);

  const s = new THREE.Shape();
  s.moveTo(0.25, 0.25);
  s.bezierCurveTo(0.25, 0.25, 0.2, 0, 0, 0);
  s.bezierCurveTo(-0.3, 0, -0.3, 0.35, -0.3, 0.35);
  s.bezierCurveTo(-0.3, 0.55, -0.1, 0.77, 0.25, 0.95);
  s.bezierCurveTo(0.6, 0.77, 0.8, 0.55, 0.8, 0.35);
  s.bezierCurveTo(0.8, 0.35, 0.8, 0, 0.5, 0);
  s.bezierCurveTo(0.35, 0, 0.25, 0.25, 0.25, 0.25);

  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 5, curveSegments: 24 });
  geo.center();
  geo.rotateZ(Math.PI);
  const heart = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xb01f2e }));
  heart.scale.setScalar(0.42);
  heart.position.copy(at).setY(1.42);
  scene.add(heart);
  return heart;
}

export function buildWorld(layout, maxAniso, noteCount) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060d);
  scene.add(new THREE.HemisphereLight(0xffdfbd, 0x2a1f18, 0.95));
  const sun = new THREE.DirectionalLight(0xffd29a, 1.15);
  sun.position.set(2, 6, 3);
  scene.add(sun);

  buildRoom(scene, layout);
  const frames = buildFrames(scene, layout.placements, maxAniso);
  buildBenches(scene, layout.benches);
  const heart = buildHeart(scene, layout.pedestal);
  const flames = buildCandles(scene, layout);
  const night = buildTerrace(scene, layout);
  const romance = buildRomance(scene, layout, SITE.sign);
  const notes = buildNotes(scene, layout, noteCount);
  const counter = buildCounter(scene, layout);

  room.setDim = (v) => room.dim.forEach((m) => m.color.setScalar(v));
  room.setCeiling = (v) => {
    room.ceiling.material.transparent = v < 1;
    room.ceiling.material.opacity = v;
    room.ceiling.visible = v > 0.01;
    room.lamps.visible = v > 0.4;
  };

  return { scene, frames, heart, flames, notes, counter, room, romance, night };
}

export const FRAME_DEPTH = MAT + BORDER;
