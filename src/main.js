import * as THREE from 'three';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import './style.css';

import { SITE, MEMORIES } from './config.js';
import { loadMemories } from './memories.js';
import { computeLayout } from './layout.js';
import { buildWorld } from './world.js';
import { Player, EYE } from './player.js';
import { Input } from './input.js';

const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

$('intro-title').textContent = SITE.title;
$('intro-from').textContent = SITE.from;
$('intro-to').textContent = SITE.to;
document.title = SITE.title;

function fail(message) {
  const button = $('enter');
  button.textContent = message;
  button.disabled = true;
}

async function boot() {
  await Promise.all([
    document.fonts.load('500 40px "Cormorant Garamond"'),
    document.fonts.load('italic 400 40px "Cormorant Garamond"'),
    document.fonts.load('500 20px "Manrope"'),
  ]);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, powerPreference: 'high-performance' });
  } catch {
    fail('Bu brauzer 3D ni qo‘llab-quvvatlamaydi');
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));

  const memories = await loadMemories(MEMORIES, (p) => {
    $('bar-fill').style.transform = `scaleX(${p})`;
  });
  const layout = computeLayout(memories);
  const world = buildWorld(layout, renderer.capabilities.getMaxAnisotropy());
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 80);
  const player = new Player(camera, layout, reducedMotion);
  const { placements, benches } = layout;

  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1 ? 78 : 62;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  // --- Xotirani yaqindan ko‘rish ---
  let current = -1;
  let returnPose = null;
  let returnMode = 'walk';

  function framePose(p) {
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const portrait = camera.aspect < 1;
    const usableH = portrait ? 0.62 : 0.72; // pastdagi izoh paneli uchun joy
    const d = Math.max(p.outerH / (2 * tan * usableH), p.outerW / (2 * tan * camera.aspect * 0.92));
    const visibleH = 2 * tan * d;
    const at = p.pos.clone().addScaledVector(p.normal, d);
    return { x: at.x, y: p.pos.y - visibleH * ((1 - usableH) / 2), z: at.z, yaw: p.yaw, pitch: 0 };
  }

  function showPanel(p) {
    const { memory } = p;
    $('panel-date').textContent = memory.date;
    $('panel-title').textContent = memory.title;
    $('panel-note').textContent = memory.note;
    $('panel').hidden = false;
    $('hud').hidden = true;
  }

  function openMemory(i) {
    if (player.mode === 'walk' || player.mode === 'sit') {
      returnPose = player.pose();
      returnMode = player.mode;
    } else if (player.mode !== 'view') {
      return;
    }
    current = i;
    $('panel').hidden = true;
    $('hud').hidden = true;
    const p = placements[i];
    player.flyTo(framePose(p), 1.1, () => {
      player.mode = 'view';
      showPanel(p);
    });
  }

  function closeMemory() {
    if (player.mode !== 'view') return;
    $('panel').hidden = true;
    player.flyTo(returnPose, 0.9, () => {
      player.mode = returnMode;
      $('hud').hidden = false;
    });
  }

  const step = (dir) => {
    if (player.mode === 'view') openMemory((current + dir + placements.length) % placements.length);
  };
  $('prev').onclick = () => step(-1);
  $('next').onclick = () => step(1);
  $('close').onclick = closeMemory;

  // --- Yaqin atrofdagi harakat tugmasi ---
  const chip = $('chip');
  let prompt = null;
  let promptKey = '';
  const toFrame = new THREE.Vector3();
  const look = new THREE.Vector3();

  function findPrompt() {
    if (player.mode === 'sit') return { kind: 'stand', label: 'Turish' };
    if (player.mode !== 'walk') return null;

    for (let i = 0; i < benches.length; i++) {
      if (Math.hypot(player.x - benches[i].seat.x, player.z - benches[i].seat.z) < 1.5) {
        return { kind: 'bench', bench: benches[i], label: 'O‘tirish', id: i };
      }
    }

    camera.getWorldDirection(look);
    let best = 0.86;
    let found = -1;
    placements.forEach((p, i) => {
      toFrame.subVectors(p.pos, camera.position);
      if (toFrame.length() > 6) return;
      const dot = toFrame.normalize().dot(look);
      if (dot > best) {
        best = dot;
        found = i;
      }
    });
    return found >= 0 ? { kind: 'frame', index: found, label: 'Yaqindan ko‘rish', id: found } : null;
  }

  function act() {
    if (!prompt) return;
    if (prompt.kind === 'frame') openMemory(prompt.index);
    else if (prompt.kind === 'bench') player.sit(prompt.bench);
    else if (prompt.kind === 'stand') player.stand();
  }
  chip.onclick = act;

  function refreshPrompt() {
    prompt = findPrompt();
    const key = prompt ? `${prompt.kind}${prompt.id ?? ''}` : '';
    if (key === promptKey) return;
    promptKey = key;
    chip.hidden = !prompt;
    if (prompt) chip.innerHTML = input.touch ? prompt.label : `${prompt.label} <kbd>E</kbd>`;
  }

  // --- Kirish ---
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function frameAt(x, y) {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(world.frames)[0]?.object.userData.placement ?? null;
  }

  const canInteract = () => player.mode === 'walk' || player.mode === 'sit';
  const hint = $('hint');
  let hintVisible = true;
  const hideHint = () => {
    if (!hintVisible) return;
    hintVisible = false;
    hint.classList.add('gone');
  };

  const input = new Input($('scene'), $('stick'), $('knob'), {
    onLook(dx, dy) {
      if (!canInteract()) return;
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
      if (code === 'KeyE' || code === 'Enter') {
        if (started && canInteract()) act();
      } else if (player.mode === 'view') {
        if (code === 'Escape') closeMemory();
        if (code === 'ArrowLeft') step(-1);
        if (code === 'ArrowRight') step(1);
      }
    },
  });

  hint.textContent = input.touch
    ? 'Joystik bilan yuring, ekranni surib atrofga qarang, suratga teging.'
    : 'W A S D bilan yuring, sichqonchani sudrab qarang, suratni bosing.';

  // --- Musiqa ---
  let audio = null;
  if (SITE.music) {
    audio = new Audio(`${import.meta.env.BASE_URL}${SITE.music}`);
    audio.loop = true;
    audio.volume = 0.55;
    const music = $('music');
    music.hidden = false;
    music.onclick = () => {
      if (audio.paused) audio.play();
      else audio.pause();
      music.classList.toggle('off', audio.paused);
    };
  }

  // --- Asosiy sikl ---
  let started = false;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (started) {
      input.poll();
      if (input.strafe || input.forward) hideHint();
      player.update(dt, input);
      refreshPrompt();
    } else {
      camera.rotation.set(0, 0, 0);
      camera.position.set(0, EYE, -0.4);
    }
    if (!reducedMotion) world.heart.rotation.y = now * 0.0006;
    renderer.render(world.scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const enter = $('enter');
  enter.textContent = 'Muzeyga kirish';
  enter.disabled = false;
  enter.focus();
  enter.onclick = () => {
    audio?.play().catch(() => {});
    $('intro').classList.add('leaving');
    $('hud').hidden = false;
    setTimeout(() => $('intro').remove(), 1000);
    player.z = -0.4;
    started = true;
    player.flyTo({ x: 0, y: EYE, z: -1.8, yaw: 0, pitch: 0 }, 2.2, () => {
      player.mode = 'walk';
    });
  };
}

boot().catch((err) => {
  console.error(err);
  fail('Xatolik yuz berdi, sahifani yangilang');
});
