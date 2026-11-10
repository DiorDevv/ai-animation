import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

// Animatsiyalar yozib olingan tezlik (m/s): oyoqlar polda sirpanmasligi uchun.
const CLIP_SPEED = { female: { walk: 0.926, run: 2.269 }, male: { walk: 1.01, run: 2.411 } };
// O‘tirish va turish yozuvlari: `approach`/`forward` — animatsiya davomida odam qancha siljishi (m).
export const SHOTS = {
  female: {
    sitdown: { rate: 1.6, approach: 0.453 },
    standup: { rate: 1.3, forward: 0.401 },
    tdown: { rate: 1.6, start: [0.378, -0.565] },
    tup: { rate: 1.3, end: [-0.63, 0.103] },
  },
  male: {
    sitdown: { rate: 1.1, approach: 0.461 },
    standup: { rate: 1, forward: 0.423 },
    tdown: { rate: 1.05, start: [0.126, -0.672] },
    tup: { rate: 1.05, end: [-0.514, 0.164] },
  },
};

const pQ = new THREE.Quaternion();
const q1 = new THREE.Quaternion();
const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const vC = new THREE.Vector3();
const vD = new THREE.Vector3();
const vE = new THREE.Vector3();
const vF = new THREE.Vector3();

/** Suyakni dunyo koordinatalarida aylantiradi. */
function rotateWorld(bone, q) {
  bone.parent.getWorldQuaternion(pQ);
  q1.copy(pQ).invert().multiply(q).multiply(pQ);
  bone.quaternion.premultiply(q1);
  bone.updateWorldMatrix(false, true);
}

/** Barmoqlarni berilgan nuqta tomon buradi: qo'l tanani o'rab turadi. */
function aimHand(hand, finger, point, weight) {
  if (!finger) return;
  const wrist = hand.getWorldPosition(new THREE.Vector3());
  const tip = finger.getWorldPosition(new THREE.Vector3());
  const q = new THREE.Quaternion().setFromUnitVectors(tip.sub(wrist).normalize(), point.clone().sub(wrist).normalize());
  rotateWorld(hand, new THREE.Quaternion().slerp(q, weight));
}

/** Ikki bo‘g‘inli qo‘l: qo‘l panjasini nishonga yetkazadi. */
function reachArm(upper, fore, hand, target, weight) {
  upper.getWorldPosition(vA);
  fore.getWorldPosition(vB);
  hand.getWorldPosition(vC);
  vD.copy(vC).lerp(target, weight);

  const ab = vA.distanceTo(vB);
  const bc = vB.distanceTo(vC);
  const at = Math.min(ab + bc - 0.004, Math.max(0.06, vA.distanceTo(vD)));
  vE.copy(vA).sub(vB).normalize();
  vF.copy(vC).sub(vB).normalize();
  const current = vE.angleTo(vF);
  const wanted = Math.acos(THREE.MathUtils.clamp((ab * ab + bc * bc - at * at) / (2 * ab * bc), -1, 1));
  const axisB = new THREE.Vector3().crossVectors(vE, vF);
  if (axisB.lengthSq() > 1e-8) {
    rotateWorld(fore, new THREE.Quaternion().setFromAxisAngle(axisB.normalize(), wanted - current));
  }
  hand.getWorldPosition(vC);
  rotateWorld(upper, new THREE.Quaternion().setFromUnitVectors(vE.copy(vC).sub(vA).normalize(), vF.copy(vD).sub(vA).normalize()));
}
const RUN_ABOVE = 2.5;
const FADE = 0.28;

export async function loadAvatars(onProgress) {
  const loader = new GLTFLoader();
  const genders = ['female', 'male'];
  const loaded = genders.map(() => 0);
  const gltfs = await Promise.all(
    genders.map(async (gender, i) => {
      const base = `${import.meta.env.BASE_URL}avatars/`;
      const [gltf, extra] = await Promise.all([
        loader.loadAsync(`${base}${gender}.glb`, (e) => {
          if (e.total) loaded[i] = e.loaded / e.total;
          onProgress((loaded[0] + loaded[1]) / 2);
        }),
        fetch(`${base}extra-${gender}.json`).then((r) => r.json()),
      ]);
      gltf.animations.push(...extra.map((json) => THREE.AnimationClip.parse(json)));
      return gltf;
    }),
  );
  return { female: gltfs[0], male: gltfs[1] };
}

function nameSprite(text) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = '500 44px "Manrope", sans-serif';
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(text).width) + 56;
  canvas.width = width;
  canvas.height = 84;
  ctx.font = font;
  ctx.fillStyle = 'rgba(20,20,24,.74)';
  ctx.beginPath();
  ctx.roundRect(0, 0, width, 84, 42);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, 44);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, sizeAttenuation: false }));
  sprite.scale.set(0.036 * (width / 84), 0.036, 1); // masofadan qat’i nazar bir xil o‘lchamda
  return sprite;
}

function blobMesh() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(30,24,18,.5)');
  g.addColorStop(0.5, 'rgba(30,24,18,.2)');
  g.addColorStop(1, 'rgba(30,24,18,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  return mesh;
}

const UP = new THREE.Vector3(0, 1, 0);
const parentQ = new THREE.Quaternion();
const turnQ = new THREE.Quaternion();
const axis = new THREE.Vector3();

export class Character {
  x = 0;
  z = 0;
  heading = Math.PI;
  speed = 0;
  state = 'stand'; // stand | sit | dance
  headTarget = 0;
  headAngle = 0;
  slide = null;
  current = null;

  constructor(gltf, gender, name, phaseOffset = 0) {
    this.speeds = CLIP_SPEED[gender];
    this.shots = SHOTS[gender];
    this.shot = null;
    this.lastState = 'stand';
    this.lastStep = 0;
    this.root = new THREE.Group();
    const model = clone(gltf.scene);
    model.traverse((n) => {
      if (n.isMesh) n.frustumCulled = false;
    });
    this.root.add(model, blobMesh());
    this.head = model.getObjectByName('Bip01_Head');
    const bone = (name) => model.getObjectByName(`Bip01_${name}`);
    this.bones = {
      spine: bone('Spine2'),
      neck: bone('Neck'),
      pelvis: bone('Pelvis'),
      lUpper: bone('L_UpperArm'),
      lFore: bone('L_Forearm'),
      lHand: bone('L_Hand'),
      rUpper: bone('R_UpperArm'),
      rFore: bone('R_Forearm'),
      rHand: bone('R_Hand'),
      lFinger: bone('L_Finger2'),
      rFinger: bone('R_Finger2'),
    };
    this.gender = gender;
    this.kissWeight = 0;
    this.slowWeight = 0;
    this.holdWeight = 0;
    this.restWeight = 0;
    this.tableClip = 'table';
    this.tableTimer = 4;
    this.meal = null;
    this.mealTimer = 2 + Math.random() * 3;
    this.mealStep = -1;
    this.chew = 0;
    this.sipping = false;
    this.kissAmount = 0;
    this.blinkTimer = 1 + Math.random() * 3;
    this.blinkLeft = 0;
    this.face = { blink: 0, smile: 0, jaw: 0, pucker: 0 };
    model.traverse((n) => {
      if (n.isMesh && n.morphTargetDictionary) this.morph = n;
    });

    this.standTagY = gender === 'male' ? 2.05 : 1.96;
    this.nameTag = nameSprite(name);
    this.nameTag.position.y = this.standTagY;
    this.root.add(this.nameTag);

    this.mixer = new THREE.AnimationMixer(model);
    this.actions = Object.fromEntries(gltf.animations.map((clip) => [clip.name, this.mixer.clipAction(clip)]));
    for (const action of Object.values(this.actions)) action.time = phaseOffset;
    for (const name of ['sitdown', 'standup', 'tdown', 'tup']) {
      this.actions[name].setLoop(THREE.LoopOnce);
      this.actions[name].clampWhenFinished = true;
      this.actions[name].timeScale = this.shots[name].rate;
    }
    this.mixer.addEventListener('finished', () => {
      this.shotFinished = true;
    });
    this.play('idle', 0);
  }

  play(name, fade = FADE) {
    if (this.current === name) return;
    const next = this.actions[name];
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.reset().play();
    if (this.current && fade) next.crossFadeFrom(this.actions[this.current], fade, true);
    else if (this.current) this.actions[this.current].stop();
    this.current = name;
  }

  chooseClip() {
    if (this.shot) return this.shot;
    if (this.state === 'sit') return 'sit';
    if (this.state === 'table') return this.tableClip;
    if (this.state === 'kiss' || this.state === 'slow') return 'idle';
    if (this.state === 'wave') return 'wave';
    if (this.state === 'dance') return 'dance';
    if (this.speed < 0.14) return 'idle';
    return this.speed > RUN_ABOVE ? 'run' : 'walk';
  }

  /** Yurish halqasida ikki marta qadam tovushi chiqadi. */
  countSteps(clip) {
    if (clip !== 'walk' && clip !== 'run') return;
    const a = this.actions[clip];
    const phase = ((a.time / a.getClip().duration) * 2) % 1;
    if (phase < this.lastStep) this.onStep?.();
    this.lastStep = phase;
  }

  update(dt) {
    if (this.state !== this.lastState) {
      if (this.state === 'sit') this.shot = 'sitdown';
      else if (this.state === 'table') this.shot = 'tdown';
      else if (this.lastState === 'sit') this.shot = 'standup';
      else if (this.lastState === 'table') this.shot = 'tup';
      this.lastState = this.state;
    }
    if (this.state === 'table' && !this.shot) {
      this.tableTimer -= dt;
      if (this.tableTimer <= 0) {
        this.tableClip = this.tableClip === 'table' ? 'talk2' : 'table';
        this.tableTimer = 7 + Math.random() * 6;
      }
    }
    const clip = this.chooseClip();
    this.play(clip);
    if (clip === 'walk' || clip === 'run') {
      this.actions[clip].timeScale = Math.max(0.55, this.speed / this.speeds[clip]);
    }
    this.mixer.update(dt);
    this.countSteps(clip);

    if (this.shotFinished) {
      this.shotFinished = false;
      if (this.shot === 'standup' || this.shot === 'tup') {
        // Animatsiya odamni siljitgan: joyini shunga moslab, tik turishga o‘tamiz.
        const [sx, sz] = this.shot === 'tup' ? this.shots.tup.end : [0, this.shots.standup.forward];
        const c = Math.cos(this.heading);
        const s = Math.sin(this.heading);
        this.x += sx * c + sz * s;
        this.z += -sx * s + sz * c;
        this.shot = null;
        this.play('idle', 0);
        this.mixer.update(0);
      } else if (this.shot) {
        this.shot = null;
      }
    }

    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.y = this.heading;
    const tagY = this.state === 'sit' ? this.standTagY - 0.5 : this.standTagY;
    this.nameTag.position.y += (tagY - this.nameTag.position.y) * (1 - Math.exp(-dt * 6));

    // Animatsiya ustidan bosh suratga buriladi.
    this.headAngle += (this.headTarget - this.headAngle) * (1 - Math.exp(-dt * 6));
    this.nameTag.visible = this.state !== 'kiss' && this.state !== 'slow';
    if (this.head && this.state !== 'dance' && this.state !== 'kiss' && this.state !== 'slow') {
      this.root.updateMatrixWorld(true);
      this.head.parent.getWorldQuaternion(parentQ).invert();
      axis.copy(UP).applyQuaternion(parentQ).normalize();
      turnQ.setFromAxisAngle(axis, this.headAngle);
      this.head.quaternion.premultiply(turnQ);
    }
    this.updateFace(dt, performance.now());
  }

  /** O‘pish: boshlar yaqinlashadi, ko‘zlar yumiladi, qo‘llar yuz va belda turadi. */
  kissPose(partner, weight, tilt, time) {
    this.root.updateMatrixWorld(true);
    partner.root.updateMatrixWorld(true);
    this.kissAmount = weight;
    const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const side = new THREE.Vector3(forward.z, 0, -forward.x);
    const male = this.gender === 'male';
    const { bones } = this;

    // Lablar tegishi uchun boshlar orasidagi masofaga qarab engashadi.
    const gap = this.head.getWorldPosition(new THREE.Vector3()).distanceTo(partner.head.getWorldPosition(new THREE.Vector3()));
    const reach = THREE.MathUtils.clamp((gap - 0.19) / 0.84, 0, 0.42) * (male ? 1.15 : 0.85);
    const lean = (male ? 0.18 : 0.07) + reach + Math.sin(time * 0.9) * 0.015;
    rotateWorld(bones.spine, new THREE.Quaternion().setFromAxisAngle(side, lean * weight));

    const mine = this.head.getWorldPosition(new THREE.Vector3());
    const theirs = partner.head.getWorldPosition(new THREE.Vector3());
    const look = theirs.clone().sub(mine).normalize();
    rotateWorld(this.head, new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(forward, look), weight));
    rotateWorld(this.head, new THREE.Quaternion().setFromAxisAngle(look, (0.3 + Math.sin(time * 0.7) * 0.05) * tilt * weight));

    const otherForward = new THREE.Vector3(Math.sin(partner.heading), 0, Math.cos(partner.heading));
    const otherSide = new THREE.Vector3(otherForward.z, 0, -otherForward.x);
    const at = (bone) => bone.getWorldPosition(new THREE.Vector3());
    const targets = male
      ? [
          at(partner.bones.pelvis).addScaledVector(otherForward, -0.1).addScaledVector(otherSide, -0.12).add(new THREE.Vector3(0, 0.12, 0)),
          at(partner.bones.spine).addScaledVector(otherForward, -0.12).addScaledVector(otherSide, 0.08),
        ]
      : [
          at(partner.bones.neck).addScaledVector(otherForward, -0.04).addScaledVector(otherSide, -0.11).add(new THREE.Vector3(0, -0.04, 0)),
          at(partner.bones.neck).addScaledVector(otherForward, -0.04).addScaledVector(otherSide, 0.11).add(new THREE.Vector3(0, -0.04, 0)),
        ];
    // Barmoqlar sherikning orqa tomoni o'rtasiga qarab yopiladi.
    const wrap = at(male ? partner.bones.spine : partner.bones.neck).addScaledVector(otherForward, male ? -0.16 : -0.11);
    reachArm(bones.lUpper, bones.lFore, bones.lHand, targets[0], weight);
    aimHand(bones.lHand, bones.lFinger, wrap, weight);
    reachArm(bones.rUpper, bones.rFore, bones.rHand, targets[1], weight);
    aimHand(bones.rHand, bones.rFinger, wrap, weight);
  }

  /** Yuz ifodasi: ko‘z pirpiratish, jilmayish, gapirish, chaynash va o‘pish. */
  updateFace(dt, now) {
    if (!this.morph) return;
    const t = now * 0.001;
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkLeft = 0.17;
      this.blinkTimer = 2.2 + Math.random() * 3.8;
    }
    this.blinkLeft = Math.max(0, this.blinkLeft - dt);
    const blink = this.blinkLeft > 0 ? Math.sin((this.blinkLeft / 0.17) * Math.PI) : 0;
    this.chew = Math.max(0, this.chew - dt);
    const kissing = this.kissAmount;
    const talking = this.current === 'talk2';
    const smile = { dance: 0.55, wave: 0.5, slow: 0.42, table: 0.34, sit: 0.3 }[this.state] ?? (this.gender === 'male' ? 0.14 : 0.24);

    const goal = {
      blink: Math.max(blink, kissing > 0.45 ? 0.96 : 0, this.state === 'slow' ? 0.72 : 0),
      smile: smile * (1 - kissing * 0.9),
      jaw: this.chew > 0 ? 0.08 + 0.09 * (0.5 + 0.5 * Math.sin(t * 9)) : talking ? 0.05 + Math.abs(Math.sin(t * 7.3) * Math.sin(t * 2.1)) * 0.17 : kissing * 0.03,
      pucker: Math.max(kissing * 0.6, this.sipping ? 0.3 : 0),
    };
    const k = 1 - Math.exp(-dt * 13);
    for (const name of Object.keys(goal)) {
      this.face[name] += (goal[name] - this.face[name]) * k;
      this.morph.morphTargetInfluences[this.morph.morphTargetDictionary[name]] = this.face[name];
    }
    this.kissAmount *= Math.exp(-dt * 6);
  }

  /** Kechki ovqat: vilkada luqma olib og‘ziga yaqinlashtiradi, gohida bokaldan ichadi. */
  updateMeal(dt, glass, utensil) {
    this.sipping = false;
    if (!glass || !utensil || this.state !== 'table' || this.shot) {
      if (utensil) utensil.fork.visible = false;
      this.meal = null;
      return;
    }
    utensil.fork.visible = true;
    this.root.updateMatrixWorld(true);
    const handNow = this.bones.rHand.getWorldPosition(new THREE.Vector3());
    if (!this.meal) {
      utensil.bit.visible = false;
      utensil.fork.position.copy(handNow);
      utensil.fork.quaternion.setFromUnitVectors(UP, new THREE.Vector3(Math.sin(this.heading) * 0.7, -0.7, Math.cos(this.heading) * 0.7).normalize());
      this.mealTimer -= dt;
      if (this.mealTimer > 0) return;
      this.mealStep = (this.mealStep + 1) % 3;
      this.meal = { type: this.mealStep === 2 ? 'sip' : 'bite', s: 0 };
    }

    const meal = this.meal;
    meal.s = Math.min(1, meal.s + dt / (meal.type === 'sip' ? 3.4 : 3));
    const s = meal.s;
    const smooth = THREE.MathUtils.smoothstep;
    const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const mouth = this.head.getWorldPosition(new THREE.Vector3()).addScaledVector(forward, 0.12).add(new THREE.Vector3(0, -0.08, 0));
    const rise = smooth(s, 0.24, 0.5) - smooth(s, 0.62, 0.88);
    const weight = smooth(s, 0, 0.18) * (1 - smooth(s, 0.9, 1));

    if (meal.type === 'sip') {
      this.sipping = rise > 0.6;
      utensil.fork.visible = false;
      const hand = this.reachRight(glass.rest.clone().lerp(mouth, rise), weight);
      if (s > 0.2 && s < 0.92) glass.mesh.position.copy(hand).add(new THREE.Vector3(0, -0.02, 0));
      else glass.mesh.position.copy(glass.rest);
    } else {
      const handPlate = utensil.plate.clone().add(new THREE.Vector3(0, 0.15, 0)).addScaledVector(forward, -0.1);
      const handMouth = mouth.clone().addScaledVector(forward, 0.1).add(new THREE.Vector3(0, -0.14, 0));
      const hand = this.reachRight(handPlate.lerp(handMouth, rise), weight);
      const tip = utensil.plate.clone().lerp(mouth, rise);
      utensil.fork.position.copy(hand);
      utensil.fork.quaternion.setFromUnitVectors(UP, tip.sub(hand).normalize());
      utensil.bit.visible = s > 0.22 && s < 0.58;
      if (s > 0.58 && !meal.bitten) {
        meal.bitten = true;
        this.chew = 2.4;
        utensil.food.scale.multiplyScalar(0.93);
      }
      rotateWorld(this.head, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(forward.z, 0, -forward.x), 0.13 * rise));
    }
    if (s >= 1) {
      this.meal = null;
      this.mealTimer = 3 + Math.random() * 4;
      glass.mesh.position.copy(glass.rest);
    }
  }

  /** Sekin raqs: quchoqlashib, yonoqlari tegib, u yoqdan-bu yoqqa tebranadi. */
  slowPose(partner, weight, time, sign) {
    this.root.updateMatrixWorld(true);
    partner.root.updateMatrixWorld(true);
    const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const side = new THREE.Vector3(forward.z, 0, -forward.x);
    const { bones } = this;
    rotateWorld(bones.pelvis, new THREE.Quaternion().setFromAxisAngle(forward, Math.sin(time * 1.5) * 0.05 * sign * weight));
    rotateWorld(bones.spine, new THREE.Quaternion().setFromAxisAngle(side, 0.13 * weight));
    rotateWorld(this.head, new THREE.Quaternion().setFromAxisAngle(forward, 0.26 * sign * weight));

    const otherForward = new THREE.Vector3(Math.sin(partner.heading), 0, Math.cos(partner.heading));
    const otherSide = new THREE.Vector3(otherForward.z, 0, -otherForward.x);
    const male = this.gender === 'male';
    const center = (male ? partner.bones.pelvis : partner.bones.neck).getWorldPosition(new THREE.Vector3());
    const wrap = center.clone().addScaledVector(otherForward, male ? -0.16 : -0.11).setY(center.y + (male ? 0.12 : -0.04));
    for (const [upper, fore, hand, finger, s] of [[bones.lUpper, bones.lFore, bones.lHand, bones.lFinger, -1], [bones.rUpper, bones.rFore, bones.rHand, bones.rFinger, 1]]) {
      const target = center.clone().addScaledVector(otherForward, male ? -0.11 : -0.04).addScaledVector(otherSide, s * (male ? 0.14 : 0.11)).setY(center.y + (male ? 0.12 : -0.05));
      reachArm(upper, fore, hand, target, weight);
      aimHand(hand, finger, wrap, weight);
    }
  }

  /** Yonma-yon yurganda sherigining qo‘lini ushlaydi. */
  holdHand(partner, weight) {
    this.root.updateMatrixWorld(true);
    const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const toOther = new THREE.Vector3(partner.x - this.x, 0, partner.z - this.z);
    const onRight = forward.x * toOther.z - forward.z * toOther.x > 0;
    const { lUpper, lFore, lHand, rUpper, rFore, rHand, pelvis } = this.bones;
    const mine = pelvis.getWorldPosition(new THREE.Vector3());
    const theirs = partner.bones.pelvis.getWorldPosition(new THREE.Vector3());
    const target = mine.lerp(theirs, 0.5).addScaledVector(forward, 0.04).setY(0.9);
    if (onRight) reachArm(rUpper, rFore, rHand, target, weight);
    else reachArm(lUpper, lFore, lHand, target, weight);
  }

  /** Skameykada boshini sherigining yelkasiga qo‘yadi. */
  restOn(partner, weight) {
    this.root.updateMatrixWorld(true);
    const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const toOther = new THREE.Vector3(partner.x - this.x, 0, partner.z - this.z);
    const lean = forward.x * toOther.z - forward.z * toOther.x > 0 ? -1 : 1;
    rotateWorld(this.bones.spine, new THREE.Quaternion().setFromAxisAngle(forward, lean * 0.21 * weight));
    rotateWorld(this.head, new THREE.Quaternion().setFromAxisAngle(forward, lean * 0.3 * weight));
  }

  /** Skameykada qo‘lini sherigining yelkasiga oshiradi. */
  armAround(partner, weight) {
    this.root.updateMatrixWorld(true);
    partner.root.updateMatrixWorld(true);
    const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const toOther = new THREE.Vector3(partner.x - this.x, 0, partner.z - this.z);
    const onRight = forward.x * toOther.z - forward.z * toOther.x > 0;
    const { lUpper, lFore, lHand, rUpper, rFore, rHand } = this.bones;
    const neck = partner.bones.neck.getWorldPosition(new THREE.Vector3());
    const away = toOther.normalize();
    const target = neck.addScaledVector(away, 0.2).add(new THREE.Vector3(0, -0.08, 0)).addScaledVector(forward, -0.04);
    if (onRight) reachArm(rUpper, rFore, rHand, target, weight);
    else reachArm(lUpper, lFore, lHand, target, weight);
  }

  /** O‘ng qo‘lni dunyodagi nuqtaga cho‘zadi (gul berish uchun). */
  reachRight(target, weight) {
    this.root.updateMatrixWorld(true);
    const { rUpper, rFore, rHand } = this.bones;
    reachArm(rUpper, rFore, rHand, target, weight);
    return rHand.getWorldPosition(new THREE.Vector3());
  }
}
