import * as THREE from 'three';
import { HALL, MAT, BORDER } from './layout.js';
import { bakeWall, bakeFloor, bakeCeilingTile, bakePlaque, drawDedication, toTexture } from './bake.js';
import { SITE } from './config.js';

const basic = (map) => new THREE.MeshBasicMaterial({ map });

function addWall(scene, { center, length, rotY, map }) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(length, HALL.height), basic(map));
  mesh.position.copy(center).setY(HALL.height / 2);
  mesh.rotation.y = rotY;
  scene.add(mesh);
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
  addWall(scene, {
    center: endC,
    length: W,
    rotY: 0,
    map: bakeWall({ length: W, items: wallItems(placements, 'end', endC), panel: layout.endSpan ? layout.endSpan + 1.6 : 0 }),
  });
  addWall(scene, {
    center: startC,
    length: W,
    rotY: Math.PI,
    map: bakeWall({ length: W, items: [], draw: drawDedication(SITE.title, SITE.dedication) }),
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), basic(bakeFloor(layout)));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -L / 2);
  scene.add(floor);

  const tile = bakeCeilingTile();
  tile.repeat.set(W / 2.75, L / 2.75);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, L), basic(tile));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, H, -L / 2);
  scene.add(ceiling);

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
}

function buildFrames(scene, placements, maxAniso) {
  const frameMat = new THREE.MeshBasicMaterial({ color: 0x17171a });
  const matMat = new THREE.MeshBasicMaterial({ color: 0xf8f6f1 });
  const hit = [];

  for (const p of placements) {
    const group = new THREE.Group();
    group.position.copy(p.pos);
    group.rotation.y = p.yaw;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(p.outerW, p.outerH, 0.05), frameMat);
    frame.position.z = 0.025;
    frame.userData.placement = p;
    group.add(frame);
    hit.push(frame);

    const mat = new THREE.Mesh(new THREE.PlaneGeometry(p.w + 2 * MAT, p.h + 2 * MAT), matMat);
    mat.position.z = 0.053;
    group.add(mat);

    const photo = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), basic(toTexture(p.memory.canvas, maxAniso)));
    photo.position.z = 0.056;
    group.add(photo);

    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.23), basic(bakePlaque(p.memory)));
    plaque.position.set(p.outerW / 2 + 0.38, -0.5, 0.006);
    group.add(plaque);

    scene.add(group);
  }
  return hit;
}

function buildBenches(scene, benches) {
  const seatMat = new THREE.MeshLambertMaterial({ color: 0xd9c8a6 });
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

function buildHeart(scene, at) {
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.05, 0.8), new THREE.MeshLambertMaterial({ color: 0xf1eee7 }));
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
  const heart = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xb01f2e, roughness: 0.32, metalness: 0.15 }));
  heart.scale.setScalar(0.42);
  heart.position.copy(at).setY(1.42);
  scene.add(heart);
  return heart;
}

export function buildWorld(layout, maxAniso) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202124);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc7b8, 2.1));
  const sun = new THREE.DirectionalLight(0xfff2de, 1.5);
  sun.position.set(2, 6, 3);
  scene.add(sun);

  buildRoom(scene, layout);
  const frames = buildFrames(scene, layout.placements, maxAniso);
  buildBenches(scene, layout.benches);
  const heart = buildHeart(scene, layout.pedestal);

  return { scene, frames, heart };
}

export const FRAME_DEPTH = MAT + BORDER;
