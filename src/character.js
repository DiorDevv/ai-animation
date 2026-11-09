import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

// Animatsiyalar yozib olingan tezlik (m/s): oyoqlar polda sirpanmasligi uchun.
const CLIP_SPEED = { female: { walk: 1.21, run: 2.28 }, male: { walk: 1.01, run: 2.4 } };
const RUN_ABOVE = 2.5;
const FADE = 0.28;

export async function loadAvatars(onProgress) {
  const loader = new GLTFLoader();
  const genders = ['female', 'male'];
  const loaded = genders.map(() => 0);
  const gltfs = await Promise.all(
    genders.map((gender, i) =>
      loader.loadAsync(`${import.meta.env.BASE_URL}avatars/${gender}.glb`, (e) => {
        if (e.total) loaded[i] = e.loaded / e.total;
        onProgress((loaded[0] + loaded[1]) / 2);
      }),
    ),
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
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
  sprite.scale.set(0.17 * (width / 84), 0.17, 1);
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
    this.root = new THREE.Group();
    const model = clone(gltf.scene);
    model.traverse((n) => {
      if (n.isMesh) n.frustumCulled = false;
    });
    this.root.add(model, blobMesh());
    this.head = model.getObjectByName('Bip01_Head');

    this.standTagY = gender === 'male' ? 2.05 : 1.96;
    this.nameTag = nameSprite(name);
    this.nameTag.position.y = this.standTagY;
    this.root.add(this.nameTag);

    this.mixer = new THREE.AnimationMixer(model);
    this.actions = Object.fromEntries(gltf.animations.map((clip) => [clip.name, this.mixer.clipAction(clip)]));
    for (const action of Object.values(this.actions)) action.time = phaseOffset;
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
    if (this.state === 'sit') return 'sit';
    if (this.state === 'dance') return 'dance';
    if (this.speed < 0.14) return 'idle';
    return this.speed > RUN_ABOVE ? 'run' : 'walk';
  }

  update(dt) {
    const clip = this.chooseClip();
    this.play(clip);
    if (clip === 'walk' || clip === 'run') {
      this.actions[clip].timeScale = Math.max(0.55, this.speed / this.speeds[clip]);
    }
    this.mixer.update(dt);

    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.y = this.heading;
    const tagY = this.state === 'sit' ? this.standTagY - 0.5 : this.standTagY;
    this.nameTag.position.y += (tagY - this.nameTag.position.y) * (1 - Math.exp(-dt * 6));

    // Animatsiya ustidan bosh suratga buriladi.
    this.headAngle += (this.headTarget - this.headAngle) * (1 - Math.exp(-dt * 6));
    if (this.head && this.state !== 'dance') {
      this.root.updateMatrixWorld(true);
      this.head.parent.getWorldQuaternion(parentQ).invert();
      axis.copy(UP).applyQuaternion(parentQ).normalize();
      turnQ.setFromAxisAngle(axis, this.headAngle);
      this.head.quaternion.premultiply(turnQ);
    }
  }
}
