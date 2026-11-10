import * as THREE from 'three';
import { glowDot } from './romance.js';

/** Terrasadagi ikki kishilik kechki ovqat: stol, stullar, taomlar va shamlar. */
export function buildDinner(scene, layout) {
  const L = layout.length;
  const center = new THREE.Vector3(-3.4, 0, -L - 3.4);
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(center.x + x, y, center.z + z);
    scene.add(m);
    return m;
  };
  const lathe = (points, segments = 28) => new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);

  const cloth = new THREE.MeshLambertMaterial({ color: 0xf1e9dc });
  const wood = new THREE.MeshLambertMaterial({ color: 0x4a2f1e });
  const china = new THREE.MeshLambertMaterial({ color: 0xf6f2ea });
  const gold = new THREE.MeshLambertMaterial({ color: 0xc9a25a });

  // Stol: yerga tushib turgan oq dasturxon
  add(lathe([[0, 0.76], [0.56, 0.76], [0.6, 0.72], [0.66, 0.42], [0.7, 0.02], [0, 0.02]], 40), cloth, 0, 0, 0);
  const runner = add(new THREE.BoxGeometry(1.1, 0.006, 0.28), new THREE.MeshLambertMaterial({ color: 0x7c1630 }), 0, 0.764, 0);
  runner.rotation.y = 0.04;

  // Stullar
  const seats = [
    { x: center.x - 0.95, z: center.z, heading: Math.PI / 2 },
    { x: center.x + 0.95, z: center.z, heading: -Math.PI / 2 },
  ];
  for (const sign of [-1, 1]) {
    add(new THREE.BoxGeometry(0.46, 0.05, 0.46), wood, sign * 0.95, 0.46, 0);
    add(new THREE.BoxGeometry(0.05, 0.56, 0.42), wood, sign * 1.17, 0.74, 0);
    for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
      add(new THREE.CylinderGeometry(0.022, 0.018, 0.46, 8), wood, sign * 0.95 + lx, 0.23, lz);
    }
  }

  const glasses = [];
  const glassMat = new THREE.MeshLambertMaterial({ color: 0xe8eef2, transparent: true, opacity: 0.45 });
  const wineMat = new THREE.MeshLambertMaterial({ color: 0x6b1020 });
  for (const sign of [-1, 1]) {
    // Likopcha va taom
    add(lathe([[0, 0.766], [0.1, 0.766], [0.135, 0.782], [0, 0.782]]), china, sign * 0.36, 0, 0);
    const food = add(new THREE.SphereGeometry(0.065, 14, 10), new THREE.MeshLambertMaterial({ color: 0x6a3a1c }), sign * 0.36, 0.8, 0);
    food.scale.set(1.25, 0.45, 0.95);
    add(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshLambertMaterial({ color: 0x3f7a3e }), sign * 0.33, 0.815, 0.05);
    for (const dz of [-0.17, 0.17]) add(new THREE.BoxGeometry(0.17, 0.006, 0.014), gold, sign * 0.36, 0.77, dz);

    // Bokal
    const glass = new THREE.Group();
    const stem = new THREE.Mesh(lathe([[0.034, 0], [0.006, 0.012], [0.006, 0.09], [0.038, 0.13], [0.04, 0.19], [0, 0.19]], 14), glassMat);
    const wine = new THREE.Mesh(lathe([[0, 0.1], [0.032, 0.125], [0.035, 0.155], [0, 0.155]], 14), wineMat);
    glass.add(stem, wine);
    const rest = new THREE.Vector3(center.x + sign * 0.33, 0.77, center.z - 0.21 * sign);
    glass.position.copy(rest);
    scene.add(glass);
    glasses.push({ mesh: glass, rest });
  }

  // Shamlar va atirgullar
  const glow = glowDot();
  for (const dz of [-0.13, 0.13]) {
    add(new THREE.CylinderGeometry(0.018, 0.022, 0.24, 10), new THREE.MeshLambertMaterial({ color: 0xefe4cd }), 0, 0.89, dz);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    flame.scale.setScalar(0.17);
    flame.position.set(center.x, 1.05, center.z + dz);
    scene.add(flame);
  }
  add(lathe([[0.05, 0.765], [0.06, 0.8], [0.04, 0.86], [0, 0.86]], 12), gold, 0.0, 0, 0);
  for (const [x, z] of [[0, 0], [0.04, 0.03], [-0.04, 0.02], [0.01, -0.04]]) {
    add(new THREE.IcosahedronGeometry(0.04, 1), new THREE.MeshLambertMaterial({ color: 0xa8152f }), x, 0.9, z);
  }

  // Uzatiladigan atirgul (avval yigitning stuli yonida kutadi)
  const rose = new THREE.Group();
  const stemGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.3, 6);
  stemGeo.translate(0, -0.13, 0);
  rose.add(new THREE.Mesh(stemGeo, new THREE.MeshLambertMaterial({ color: 0x356b3f })));
  const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 1), new THREE.MeshLambertMaterial({ color: 0xb01530 }));
  bloom.position.y = 0.04;
  rose.add(bloom);
  rose.visible = false;
  scene.add(rose);

  // Sovg'a qutisi: qopqog'i orqa qirrasidan ochiladi
  const boxMat = new THREE.MeshLambertMaterial({ color: 0xa8152f });
  add(new THREE.BoxGeometry(0.13, 0.08, 0.13), boxMat, 0, 0.806, 0.34);
  const lid = new THREE.Group();
  lid.position.set(center.x, 0.846, center.z + 0.275);
  const lidTop = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.02, 0.145), boxMat);
  lidTop.position.set(0, 0.01, 0.065);
  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.024, 0.15), gold);
  ribbon.position.set(0, 0.012, 0.065);
  lid.add(lidTop, ribbon);
  scene.add(lid);

  layout.colliders.push({ minX: center.x - 1.2, maxX: center.x + 1.2, minZ: center.z - 0.72, maxZ: center.z + 0.72 });
  return { center, seats, glasses, rose, lid };
}
