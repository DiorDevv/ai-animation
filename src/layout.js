import * as THREE from 'three';

export const HALL = { width: 11, height: 4.2 };
export const FRAME_Y = 1.72;
export const MAT = 0.11;
export const BORDER = 0.06;
// Zal oxiridagi eshik va uning ortidagi terrasa.
export const DOOR = { x: 4.4, half: 0.95, height: 2.6 };
export const TERRACE = { minX: -6, maxX: 7, depth: 9 };

const UP = new THREE.Vector3(0, 1, 0);
const GAP = 1.9;
const FIRST_OFFSET = 2.6;
const BENCH_FROM_WALL = 3.3;

function fit(aspect, boxW, boxH) {
  const w = Math.min(boxW, boxH * aspect);
  return { w, h: w / aspect };
}

function place(memory, size, pos, normal, wall) {
  const outerW = size.w + 2 * (MAT + BORDER);
  const outerH = size.h + 2 * (MAT + BORDER);
  const right = new THREE.Vector3().copy(normal).negate().cross(UP).normalize();
  return { memory, ...size, outerW, outerH, pos, normal, right, wall, yaw: Math.atan2(normal.x, normal.z) };
}

function benchFor(p) {
  const seat = p.pos.clone().addScaledVector(p.normal, BENCH_FROM_WALL).setY(0);
  const stand = seat.clone().addScaledVector(p.normal, -0.85);
  return { seat, stand, yaw: p.yaw, along: p.right.clone(), length: 2.1 };
}

/** Xotiralarni devorlarga joylaydi va zal uzunligini shunga qarab hisoblaydi. */
export function computeLayout(memories) {
  const half = HALL.width / 2;
  const onEnd = memories.length >= 4 ? memories.slice(-2) : [];
  const onSides = memories.slice(0, memories.length - onEnd.length);

  const cursor = { left: FIRST_OFFSET, right: FIRST_OFFSET };
  const placements = [];
  const benches = [];

  onSides.forEach((memory, i) => {
    const wall = i % 2 === 0 ? 'left' : 'right';
    const size = memory.big ? fit(memory.aspect, 3.4, 2.3) : fit(memory.aspect, 1.6, 2);
    const span = size.w + 2 * (MAT + BORDER);
    const z = -(cursor[wall] + span / 2);
    cursor[wall] += span + GAP;
    const x = wall === 'left' ? -half : half;
    const normal = new THREE.Vector3(wall === 'left' ? 1 : -1, 0, 0);
    const p = place(memory, size, new THREE.Vector3(x, FRAME_Y, z), normal, wall);
    placements.push(p);
    if (memory.big) benches.push(benchFor(p));
  });

  const length = Math.max(20, Math.max(cursor.left, cursor.right) + 4.5);

  const endSizes = onEnd.map((m) => fit(m.aspect, 2.1, 2.3));
  const endGap = 1;
  const totalEnd = endSizes.reduce((sum, s) => sum + s.w + 2 * (MAT + BORDER), 0) + endGap;
  let x = -totalEnd / 2;
  onEnd.forEach((memory, i) => {
    const span = endSizes[i].w + 2 * (MAT + BORDER);
    const pos = new THREE.Vector3(x + span / 2, FRAME_Y, -length);
    placements.push(place(memory, endSizes[i], pos, new THREE.Vector3(0, 0, 1), 'end'));
    x += span + endGap;
  });
  if (onEnd.length) {
    const facing = placements[placements.length - 1];
    benches.push({
      seat: new THREE.Vector3(0, 0, -length + 4.2),
      stand: new THREE.Vector3(0, 0, -length + 3.3),
      yaw: 0,
      along: facing.right.clone(),
      length: 2.6,
    });
  }

  // Yurak va final terrasada: eshikdan chiqib, osmon ostida tugaydi.
  const terraceX = (TERRACE.minX + TERRACE.maxX) / 2;
  const pedestal = new THREE.Vector3(terraceX, 0, -length - 3.4);
  benches.push({
    seat: new THREE.Vector3(terraceX, 0, -length - 6.4),
    stand: new THREE.Vector3(terraceX, 0, -length - 7.2),
    yaw: 0,
    along: new THREE.Vector3(1, 0, 0),
    length: 2.6,
  });
  const colliders = [
    ...benches.map((b) => {
      const alongX = Math.abs(b.along.x) > 0.5;
      const a = b.length / 2;
      const d = 0.28;
      return {
        minX: b.seat.x - (alongX ? a : d),
        maxX: b.seat.x + (alongX ? a : d),
        minZ: b.seat.z - (alongX ? d : a),
        maxZ: b.seat.z + (alongX ? d : a),
      };
    }),
    { minX: pedestal.x - 0.45, maxX: pedestal.x + 0.45, minZ: pedestal.z - 0.45, maxZ: pedestal.z + 0.45 },
  ];

  placements.sort((a, b) => a.memory.index - b.memory.index);
  return { length, placements, benches, pedestal, colliders, endSpan: onEnd.length ? totalEnd : 0 };
}
