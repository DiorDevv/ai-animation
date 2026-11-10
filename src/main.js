import * as THREE from 'three';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/great-vibes/400.css';
import './style.css';

import { SITE, MEMORIES } from './config.js';
import { loadMemories } from './memories.js';
import { computeLayout } from './layout.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Character, loadAvatars } from './character.js';
import { Hearts, Petals, Fireworks } from './effects.js';
import { Input } from './input.js';
import { Net } from './net.js';
import { Sound } from './sound.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { playOpening } from './opening.js';
import { Sky, NAME_DISTANCE } from './finale.js';

const $ = (id) => document.getElementById(id);
const STORE_KEY = 'our-museum-v1';
function loadStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}
function saveStore(data) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...loadStore(), ...data }));
  } catch {
    // saqlash imkoni bo‘lmasa ham sayt ishlayveradi
  }
}
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

$('intro-title').textContent = SITE.title;
$('intro-from').textContent = SITE.from;
$('intro-to').textContent = SITE.to;
document.title = SITE.title;

function fail(message) {
  $('status').textContent = message;
}

/** Yuklash tugagach ism va jinsni so‘raydi. */
function askProfile() {
  const form = $('profile');
  const nameInput = $('name');
  const enter = $('enter');
  $('status').hidden = true;
  document.querySelector('.bar').hidden = true;
  form.hidden = false;
  nameInput.focus();

  const refresh = () => {
    enter.disabled = !(nameInput.value.trim() && form.elements.gender.value);
  };
  form.addEventListener('input', refresh);
  const saved = loadStore().profile;
  if (saved) {
    nameInput.value = saved.name;
    form.elements.gender.value = saved.gender;
    refresh();
  }

  return new Promise((resolve) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (enter.disabled) return;
      nameInput.blur();
      const profile = { name: nameInput.value.trim(), gender: form.elements.gender.value };
      saveStore({ profile });
      resolve(profile);
    });
  });
}

async function boot() {
  await Promise.all([
    document.fonts.load('500 40px "Cormorant Garamond"'),
    document.fonts.load('italic 400 40px "Cormorant Garamond"'),
    document.fonts.load('500 20px "Manrope"'),
    document.fonts.load('400 40px "Great Vibes"'),
  ]);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, powerPreference: 'high-performance' });
  } catch {
    fail('Bu brauzer 3D ni qo‘llab-quvvatlamaydi');
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));

  // Suratlar yarim, personajlar yarim progress.
  const progress = [0, 0];
  const showProgress = () => {
    $('bar-fill').style.transform = `scaleX(${(progress[0] + progress[1]) / 2})`;
  };
  const [memories, avatars] = await Promise.all([
    loadMemories(MEMORIES, (p) => {
      progress[0] = p;
      showProgress();
    }),
    loadAvatars((p) => {
      progress[1] = p;
      showProgress();
    }),
  ]);
  const layout = computeLayout(memories);
  const world = buildWorld(layout, renderer.capabilities.getMaxAnisotropy(), SITE.reasons.length);
  const { placements, benches, pedestal } = layout;

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 320);
  let composer = null;
  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1 ? 78 : 62;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  const profile = await askProfile();
  // --- Sifat darajasi: 2 — nur effekti bilan, 1 — o‘rta, 0 — kuchsiz qurilma ---
  const forced = new URLSearchParams(location.search).get('q');
  let tier = forced ? Number(forced) : matchMedia('(pointer: coarse)').matches ? 1 : 2;
  function applyTier() {
    renderer.setPixelRatio(tier === 2 ? Math.min(devicePixelRatio, 1.75) : tier === 1 ? Math.min(devicePixelRatio, 1.5) : 1);
    if (tier === 2 && !composer) {
      const target = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
      composer = new EffectComposer(renderer, target);
      composer.addPass(new RenderPass(world.scene, camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.38, 0.65, 0.97));
      composer.addPass(new OutputPass());
    }
    if (tier < 2) composer = null;
    world.flames.forEach((f) => {
      f.flame.visible = tier > 0;
    });
    resize();
  }
  applyTier();

  let fpsFrames = 0;
  let fpsTime = 0;
  function watchSpeed(dt) {
    if (forced || tier === 0) return;
    fpsFrames++;
    fpsTime += dt;
    if (fpsTime < 3) return;
    const fps = fpsFrames / fpsTime;
    fpsFrames = 0;
    fpsTime = 0;
    if (fps < 30) {
      tier--;
      applyTier();
    }
  }

  // Teri va kiyimga tabiiy yorug‘lik beradi.
  if (tier > 0) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    world.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    world.scene.environmentIntensity = 0.3;
    pmrem.dispose();
  }

  const sound = new Sound();
  const me = new Character(avatars[profile.gender], profile.gender, profile.name);
  const companionGender =
    SITE.companion.gender === 'opposite' ? (profile.gender === 'male' ? 'female' : 'male') : SITE.companion.gender;
  let them = new Character(avatars[companionGender], companionGender, SITE.companion.name, 0.35);
  let themKey = `${companionGender}:${SITE.companion.name}`;
  world.scene.add(me.root, them.root);
  me.onStep = () => sound.step(1);
  them.onStep = () => sound.step(0.4);
  const player = new Player(camera, layout, me, them, reducedMotion);
  me.update(0.016);
  them.update(0.016);
  const hearts = new Hearts(world.scene);
  const petals = new Petals(world.scene, layout.length);
  const fireworks = new Fireworks(world.scene, pedestal.x, -layout.length);
  const sky = new Sky(world.scene, world.room, renderer.getPixelRatio(), reducedMotion, -layout.length);

  // --- Xotirani yaqindan ko‘rish ---
  let current = -1;
  let returnMode = 'walk';
  const store = loadStore();
  const seen = new Set((store.seen ?? []).filter((i) => i < placements.length));
  for (const n of world.notes) {
    if (store.notes?.includes(n.index)) {
      n.found = true;
      n.group.visible = false;
    }
  }
  let finished = false;

  const canInteract = () => (player.mode === 'walk' || player.mode === 'sit') && !me.slide && !me.shot;

  function framePose(p) {
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const portrait = camera.aspect < 1;
    const usableH = portrait ? 0.62 : 0.72; // pastdagi izoh paneli uchun joy
    const d = Math.max(p.outerH / (2 * tan * usableH), p.outerW / (2 * tan * camera.aspect * 0.92));
    const visibleH = 2 * tan * d;
    const at = p.pos.clone().addScaledVector(p.normal, d);
    return { x: at.x, y: p.pos.y - visibleH * ((1 - usableH) / 2), z: at.z, yaw: p.yaw, pitch: 0 };
  }

  function updateProgress() {
    const found = world.notes.filter((n) => n.found).length;
    $('progress').textContent = `${seen.size}/${placements.length} xotira · ${found}/${world.notes.length} xat`;
  }

  function markSeen(i) {
    seen.add(i);
    saveStore({ seen: [...seen] });
    updateProgress();
  }

  function toast(text) {
    hint.textContent = text;
    hint.classList.remove('gone');
    hintVisible = true;
  }

  function showPanel(p) {
    const { memory } = p;
    $('panel-date').textContent = memory.date;
    $('panel-title').textContent = memory.title;
    $('panel-note').textContent = memory.note;
    $('panel').hidden = false;
    markSeen(placements.indexOf(p));
    playVoice(memory);
  }

  function openMemory(i) {
    if (canInteract()) returnMode = player.mode;
    else if (player.mode !== 'view') return;
    current = i;
    stopVoice();
    $('panel').hidden = true;
    $('hud').hidden = true;
    const p = placements[i];
    player.flyTo(framePose(p), 1.1, () => {
      player.mode = 'view';
      showPanel(p);
    }, false);
  }

  function closeMemory() {
    if (player.mode !== 'view') return;
    stopVoice();
    $('panel').hidden = true;
    player.flyTo(() => player.followPose(), 0.9, () => {
      player.mode = returnMode;
      $('hud').hidden = false;
      if (!finished && seen.size === placements.length) finish();
    }, true);
  }

  const step = (dir) => {
    if (player.mode === 'view') openMemory((current + dir + placements.length) % placements.length);
  };
  $('prev').onclick = () => step(-1);
  $('next').onclick = () => step(1);
  $('close').onclick = closeMemory;

  // --- Ovozli xabar ---
  const voice = new Audio();
  const voiceBtn = $('voice');
  // Telefon brauzerlari ovozni faqat bosishdan keyin ruxsat etadi, shuning uchun bitta element oldindan ochiladi.
  voice.src = SILENT_WAV;

  function duckMusic(on) {
    if (audio) audio.volume = on ? 0.12 : 0.55;
    sound.duck(on);
  }
  function syncVoiceButton() {
    const playing = !voice.paused && !voice.ended;
    voiceBtn.textContent = playing ? '❚❚' : '▶';
    voiceBtn.setAttribute('aria-pressed', String(playing));
    duckMusic(playing);
  }
  voice.onplay = voice.onpause = voice.onended = syncVoiceButton;

  function playVoice(memory) {
    voiceBtn.hidden = !memory.voice;
    if (!memory.voice) return;
    voice.src = `${import.meta.env.BASE_URL}memories/${memory.voice}`;
    voice.play().catch(syncVoiceButton);
  }
  function stopVoice() {
    voice.pause();
  }
  voiceBtn.onclick = () => {
    if (voice.paused) voice.play().catch(() => {});
    else voice.pause();
  };

  // --- Yakun: maktub ---
  function finish() {
    finished = true;
    world.heart.material.emissive.set(0x5a0a14);
    $('progress').classList.add('done');
    toast('Hamma xotiralarni ko‘rding. Endi terrasaga chiq, yurak seni kutyapti.');
  }

  $('letter-title').textContent = SITE.letter.title.replace('{name}', profile.name);
  $('letter-body').replaceChildren(
    ...SITE.letter.body.map((text) => Object.assign(document.createElement('p'), { textContent: text })),
  );
  $('letter-sign').textContent = SITE.letter.sign;

  let finaleDone = false;
  let finaleRunning = false;

  function startFinale() {
    if (finaleDone || finaleRunning || !started) return;
    finaleRunning = true;
    returnMode = me.state === 'sit' ? 'sit' : 'walk';
    if (me.state === 'dance' || me.state === 'wave' || me.state === 'kiss') me.state = 'stand';
    stopVoice();
    $('panel').hidden = true;
    $('hud').hidden = true;
    player.avatarsVisible = true;

    const pose = player.followPose();
    const pitch = 0.62;
    const cp = Math.cos(pitch);
    const dir = new THREE.Vector3(-Math.sin(pose.yaw) * cp, Math.sin(pitch), -Math.cos(pose.yaw) * cp);
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const width = 2 * NAME_DISTANCE * tan * camera.aspect * 0.82;

    player.flyTo({ ...pose, pitch }, 3.2, () => {
      player.mode = 'view';
    });
    const text = player.remote
      ? player.side === 1
        ? `${profile.name} ♥ ${partnerName}`
        : `${partnerName} ♥ ${profile.name}`
      : profile.name;
    sky.start({ origin: new THREE.Vector3(pose.x, pose.y, pose.z), dir, right, up, width }, text, () => {
      finaleRunning = false;
      finaleDone = true;
      showLetter();
    });
  }

  function openLetter() {
    returnMode = player.mode;
    showLetter();
  }

  function showLetter() {
    player.mode = 'view';
    petals.start();
    $('hud').hidden = true;
    $('letter').hidden = false;
    $('letter-close').focus();
  }

  function closeLetter() {
    $('letter').hidden = true;
    fireworks.start(34); // maktubdan keyin daryo ustida mushakbozlik
    player.flyTo(() => player.followPose(), 1.3, () => {
      player.mode = returnMode;
      $('hud').hidden = false;
    });
  }
  $('letter-close').onclick = closeLetter;

  // --- Yashirin xatchalar ---
  let noteTimer = 0;
  function openNote(n) {
    n.found = true;
    n.group.visible = false;
    saveStore({ notes: world.notes.filter((x) => x.found).map((x) => x.index) });
    updateProgress();
    showNote(SITE.reasons[n.index]);
  }

  function showNote(text) {
    $('note-text').textContent = text;
    $('note').hidden = false;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      $('note').hidden = true;
    }, 6500);
  }

  // --- Osmondagi narsalar: uchar yulduz va bizning yulduzimiz ---
  const skyTag = $('skytag');
  let skyTarget = null;
  let skyKey = '';
  let wishIndex = 0;
  const skyPoint = new THREE.Vector3();

  function refreshSkyTag() {
    let target = null;
    if (player.camOutside && (player.mode === 'walk' || player.mode === 'sit')) {
      const wish = world.night.wish();
      target = wish ? { kind: 'wish', at: wish, label: 'Tilak ol ✨' } : { kind: 'star', at: world.night.ourStar, label: SITE.ourStar.name };
      skyPoint.copy(target.at).project(camera);
      if (skyPoint.z > 1 || Math.abs(skyPoint.x) > 0.92 || Math.abs(skyPoint.y) > 0.9) target = null;
    }
    skyTarget = target;
    const key = target ? target.kind : '';
    if (key !== skyKey) {
      skyKey = key;
      skyTag.hidden = !target;
      if (target) skyTag.textContent = target.label;
    }
    if (target) {
      const x = ((skyPoint.x + 1) / 2) * innerWidth;
      const y = ((1 - skyPoint.y) / 2) * innerHeight;
      skyTag.style.transform = `translate(${x}px, ${y}px) translate(-50%, 16px)`;
    }
  }

  skyTag.onclick = () => {
    if (!skyTarget) return;
    if (skyTarget.kind === 'wish') {
      showNote(SITE.wishes[wishIndex++ % SITE.wishes.length]);
      world.night.catchWish();
    } else {
      showNote(SITE.ourStar.message);
    }
  };

  // --- Birga o‘tgan vaqt ---
  if (world.counter && SITE.together?.since) {
    const since = new Date(SITE.together.since).getTime();
    const tick = () => {
      const total = Math.max(0, Math.floor((Date.now() - since) / 1000));
      const days = Math.floor(total / 86400);
      const hours = Math.floor((total % 86400) / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      world.counter(`Birga: ${days} kun, ${hours} soat, ${minutes} daqiqa, ${total % 60} soniya`);
    };
    tick();
    setInterval(tick, 1000);
  }

  // --- Narsalar ustidagi yorliq ---
  const tag = $('tag');
  let prompt = null;
  let promptKey = '';
  const anchor = new THREE.Vector3();
  const look = new THREE.Vector3();
  const toFrame = new THREE.Vector3();
  const heartAnchor = new THREE.Vector3(pedestal.x, 2, pedestal.z);

  function findPrompt() {
    if (player.mode === 'sit' && !me.slide && !me.shot) {
      return { kind: 'stand', label: 'Turish', at: anchor.set(me.x, 1.9, me.z) };
    }
    if (player.mode === 'dance') return null;
    if (!canInteract()) return null;

    if (finished && Math.hypot(me.x - pedestal.x, me.z - pedestal.z) < 2.4) {
      if (player.remote && !finaleDone && Math.hypot(them.x - pedestal.x, them.z - pedestal.z) > 3) {
        return { kind: 'wait', label: `${partnerName} ham kelsin`, at: heartAnchor };
      }
      return { kind: 'letter', label: 'Maktubni ochish', at: heartAnchor };
    }

    const { dinner } = layout;
    if (Math.hypot(me.x - dinner.center.x, me.z - dinner.center.z) < 2.5) {
      return { kind: 'dinner', label: 'Kechki ovqat', at: anchor.set(dinner.center.x, 1.5, dinner.center.z) };
    }

    for (const n of world.notes) {
      if (!n.found && Math.hypot(me.x - n.x, me.z - n.z) < 1.5) {
        return { kind: 'note', note: n, label: 'Xatni ochish', id: n.index, at: anchor.set(n.x, 1.6, n.z) };
      }
    }

    for (let i = 0; i < benches.length; i++) {
      if (Math.hypot(me.x - benches[i].seat.x, me.z - benches[i].seat.z) < 1.7) {
        return { kind: 'bench', bench: benches[i], label: 'O‘tirish', id: i, at: anchor.copy(benches[i].seat).setY(1) };
      }
    }

    camera.getWorldDirection(look);
    let best = Infinity;
    let found = -1;
    placements.forEach((p, i) => {
      toFrame.subVectors(p.pos, camera.position).normalize();
      const dot = toFrame.dot(look);
      const dist = Math.hypot(p.pos.x - me.x, p.pos.z - me.z);
      if (dist > 5.6 || dot < 0.55) return;
      projected.copy(p.pos).project(camera);
      if (Math.abs(projected.x) > 0.9) return; // ekranda ko‘rinmayotgan suratga yorliq chiqmasin
      const score = dist - dot * 3;
      if (score < best) {
        best = score;
        found = i;
      }
    });
    if (found < 0) return null;
    const p = placements[found];
    const label = seen.has(found) ? 'Yana ko‘rish' : 'Ko‘rish';
    return { kind: 'frame', index: found, label, id: found, at: anchor.copy(p.pos).setY(p.pos.y + p.outerH / 2 + 0.2).addScaledVector(p.normal, 0.1) };
  }

  function act() {
    if (!prompt) return;
    if (prompt.kind === 'frame') openMemory(prompt.index);
    else if (prompt.kind === 'bench') player.sit(prompt.bench);
    else if (prompt.kind === 'dinner') player.sitDinner(layout.dinner);
    else if (prompt.kind === 'stand') player.stand();
    else if (prompt.kind === 'letter') {
      if (finaleDone) openLetter();
      else {
        if (player.remote) net.sendFinale();
        startFinale();
      }
    } else if (prompt.kind === 'note') openNote(prompt.note);
  }
  tag.onclick = act;

  const projected = new THREE.Vector3();
  function refreshTag() {
    prompt = findPrompt();
    const key = prompt ? `${prompt.kind}${prompt.id ?? ''}${prompt.label}` : '';
    if (key !== promptKey) {
      promptKey = key;
      tag.hidden = !prompt;
      if (prompt) tag.innerHTML = input.touch ? prompt.label : `${prompt.label} <kbd>E</kbd>`;
    }
    if (!prompt) return;
    projected.copy(prompt.at).project(camera);
    const x = THREE.MathUtils.clamp(((projected.x + 1) / 2) * innerWidth, 80, innerWidth - 80);
    const y = THREE.MathUtils.clamp(((1 - projected.y) / 2) * innerHeight, 70, innerHeight - 120);
    tag.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }

  // --- Kirish ---
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function frameAt(x, y) {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(world.frames)[0]?.object.userData.placement ?? null;
  }

  const hint = $('hint');
  let hintVisible = true;
  const hideHint = () => {
    if (!hintVisible) return;
    hintVisible = false;
    hint.classList.add('gone');
  };

  const canLook = () => ['walk', 'sit', 'dance', 'slow'].includes(player.mode);

  const input = new Input($('scene'), $('stick'), $('knob'), {
    onLook(dx, dy) {
      if (!canLook()) return;
      player.look(dx, dy);
      hideHint();
    },
    onTap(x, y) {
      if (!canInteract()) return;
      const p = frameAt(x, y);
      if (p) openMemory(placements.indexOf(p));
    },
    onHover(x, y) {
      $('scene').style.cursor = canInteract() && frameAt(x, y) ? 'pointer' : 'grab';
    },
    onKey(code) {
      if (!started) return;
      if (code === 'KeyE' || code === 'Enter') {
        if (canInteract()) act();
      } else if (code === 'KeyQ') {
        player.toggleDance();
      } else if (code === 'KeyK') {
        kiss();
      } else if (code === 'KeyG') {
        gift();
      } else if (player.mode === 'view' && $('letter').hidden) {
        if (code === 'Escape') closeMemory();
        if (code === 'ArrowLeft') step(-1);
        if (code === 'ArrowRight') step(1);
      } else if (code === 'Escape' && !$('letter').hidden) {
        closeLetter();
      }
    },
  });

  hint.textContent = input.touch
    ? 'Joystik bilan yuring, ekranni surib atrofga qarang, suratga teging.'
    : 'W A S D bilan yuring, sichqonchani sudrab qarang, Q bilan raqsga tushing.';
  $('dance').innerHTML = input.touch ? 'Raqs' : 'Raqs <kbd>Q</kbd>';
  $('dance').onclick = () => player.toggleDance();
  $('kiss').innerHTML = input.touch ? 'O‘pish' : 'O‘pish <kbd>K</kbd>';
  function kiss() {
    if (!player.canKiss()) return;
    if (player.remote) net.sendKiss();
    player.startKiss(true);
  }
  $('kiss').onclick = kiss;
  player.onSlowStart = () => {
    if (player.remote) net.sendEvent('d');
  };
  $('gift').innerHTML = input.touch ? 'Sovg‘a berish' : 'Sovg‘a berish <kbd>G</kbd>';
  function gift() {
    if (player.giveGift(true) && player.remote) net.sendEvent('g');
  }
  $('gift').onclick = gift;
  player.onGift = () => showNote(SITE.gift.message);
  $('run').innerHTML = input.touch ? 'Yugurish' : 'Yugurish <kbd>Shift</kbd>';
  $('run').onclick = (e) => {
    input.runToggle = !input.runToggle;
    e.currentTarget.blur();
  };
  updateProgress();

  // --- Musiqa ---
  let audio = null;
  if (SITE.music) {
    audio = new Audio(`${import.meta.env.BASE_URL}${SITE.music}`);
    audio.loop = true;
    audio.volume = 0.55;
  }
  const soundBtn = $('music');
  soundBtn.hidden = false;
  soundBtn.onclick = () => {
    const off = !sound.muted;
    sound.setMuted(off);
    voice.muted = off;
    if (audio) audio.muted = off;
    soundBtn.classList.toggle('off', off);
  };

  // --- Ikkinchi mehmon ---
  function setPartner(name, gender) {
    const key = `${gender}:${name}`;
    if (key === themKey) return;
    themKey = key;
    const fresh = new Character(avatars[gender], gender, name, 0.35);
    fresh.x = them.x;
    fresh.z = them.z;
    fresh.heading = them.heading;
    fresh.onStep = () => sound.step(0.4);
    world.scene.remove(them.root);
    world.scene.add(fresh.root);
    them = fresh;
    player.them = fresh;
  }

  let partnerName = '';
  const net = new Net(profile, {
    onSlot(slot) {
      player.side = slot === 0 ? 1 : -1;
      // Ikkinchi mehmon birinchisining ustida paydo bo‘lmasin.
      if (slot === 1 && player.mode === 'fly') {
        [me.x, them.x] = [them.x, me.x];
        [me.z, them.z] = [them.z, me.z];
        player.focusX = me.x;
        player.focusZ = me.z;
      }
    },
    onPeer(peer, first) {
      setPartner(peer.name, peer.gender);
      partnerName = peer.name;
      player.remote = { x: them.x, z: them.z, h: them.heading, s: 0, st: 'stand' };
      if (first) {
        toast(`${peer.name} muzeyga kirdi`);
        player.greet();
      }
    },
    onState(state) {
      if (player.remote) player.remote = state;
    },
    onFinale() {
      startFinale();
    },
    onKiss() {
      if (player.canKiss()) player.startKiss(false);
    },
    onSlow() {
      if (player.canKiss()) player.startSlow(false);
    },
    onGift() {
      player.giveGift(false);
    },
    onLeft() {
      player.remote = null;
      them.state = 'stand';
      toast(`${partnerName} muzeydan chiqdi`);
    },
  });

  let lastSent = { x: 0, z: 0, h: 0, s: 0, st: '' };
  let sendClock = 0;
  let idleClock = 0;
  function broadcast(dt, net) {
    sendClock += dt;
    idleClock += dt;
    if (sendClock < 0.1) return;
    sendClock = 0;
    const round = (v) => Math.round(v * 100) / 100;
    const s = { x: round(me.x), z: round(me.z), h: round(me.heading), s: round(me.speed), st: me.state };
    const changed = Object.keys(s).some((k) => s[k] !== lastSent[k]);
    if (!changed && idleClock < 1) return;
    idleClock = 0;
    lastSent = s;
    net.sendState(s);
  }

  // --- Asosiy sikl ---
  let started = false;
  let last = performance.now();
  let emit = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (started) {
      input.poll();
      if (input.strafe || input.forward) hideHint();
      player.update(dt, input);
      broadcast(dt, net);
      refreshTag();
      refreshSkyTag();
      $('dance').classList.toggle('on', player.mode === 'dance' || player.mode === 'slow');
      $('kiss').hidden = !player.canKiss();
      $('gift').hidden = !(me.state === 'table' && them.state === 'table' && !me.shot && !them.shot && !player.gift);
      $('run').classList.toggle('on', input.run);
      $('run').setAttribute('aria-pressed', String(input.run));

      if ((player.mode === 'dance' || player.mode === 'kiss') && !reducedMotion) {
        emit -= dt;
        if (emit <= 0) {
          emit = 0.28;
          hearts.emit((me.x + them.x) / 2, (me.z + them.z) / 2);
        }
      }
    }

    hearts.update(dt);
    petals.update(dt, now);
    sky.update(dt);
    fireworks.update(dt, sound);
    if (!reducedMotion) {
      for (const f of world.flames) {
        const v = 0.3 + Math.sin(now * 0.011 + f.seed) * 0.025 + Math.sin(now * 0.023 + f.seed * 2) * 0.02;
        f.flame.scale.setScalar(v);
      }
      world.romance(now);
      world.night.update(now, camera, player.camOutside);
      for (const n of world.notes) {
        if (n.found) continue;
        n.group.position.y = 1.15 + Math.sin(now * 0.0016 + n.seed) * 0.07;
        n.group.rotation.y = now * 0.0007 + n.seed;
      }
    }
    if (!reducedMotion) {
      world.heart.rotation.y = now * 0.0006;
      if (finished) world.heart.scale.setScalar(0.42 * (1 + Math.sin(now * 0.005) * 0.09));
    }
    if (started) {
      if (composer) composer.render(dt);
      else renderer.render(world.scene, camera);
      watchSpeed(dt);
    }
    requestAnimationFrame(frame);
  }
  camera.position.set(0, 3.5, -0.4);
  requestAnimationFrame(frame);

  function unlockAudio() {
    audio?.play().catch(() => {});
    voice.play().catch(() => {});
    sound.start(!SITE.music);
  }

  function begin() {
    $('intro').remove();
    $('hud').hidden = false;
    player.cam = { x: 0, y: 3.7, z: -0.4, yaw: 0, pitch: -0.08 };
    started = true;
    player.flyTo(() => player.followPose(), 3, () => {
      player.mode = 'walk';
      if (!player.remote) player.greetCompanion();
      if (!finished && seen.size === placements.length) finish();
    });
  }

  playOpening(profile.name, reducedMotion, unlockAudio, begin);
}

boot().catch((err) => {
  console.error(err);
  fail('Xatolik yuz berdi, sahifani yangilang');
});
