import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { computeSky } from './astro.js';
import { SITE } from './config.js';

// Terrasadan ko‘rinadigan tun: Somon yo‘li, yulduzlar, haqiqiy Oy, bulutlar va 3D shahar.
const DOME_RADIUS = 250;
const STAR_RADIUS = 235;

/** Haqiqiy 360° tungi surat (osmon va shahar), pastda esa uni aks ettiruvchi daryo. */
function dome(scene, centerZ) {
  const load = (name) => {
    const tex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/${name}`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    return tex;
  };
  const uniforms = {
    uSky: { value: load('city-sky.jpg') },
    uBand: { value: load('city-band.jpg') },
    uTime: { value: 0 },
    // Rasmning qaysi qismi terrasa ro'parasida turishi
    uOffset: { value: 0.0597 },
    uBandBottom: { value: (-0.176 * Math.PI) / 180 },
    uBandTop: { value: (24 * Math.PI) / 180 },
  };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(DOME_RADIUS, 48, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uSky;
        uniform sampler2D uBand;
        uniform float uTime;
        uniform float uOffset;
        uniform float uBandBottom;
        uniform float uBandTop;
        varying vec3 vDir;

        vec3 photo(vec3 d) {
          float e = asin(clamp(d.y, 0.0, 1.0));
          float u = fract(atan(d.x, -d.z) / 6.2831853 + 0.5 + uOffset);
          vec3 color = texture2D(uSky, vec2(u, clamp(e / 1.5708, 0.0, 1.0))).rgb;
          float v = (e - uBandBottom) / (uBandTop - uBandBottom);
          if (v < 1.0) {
            vec3 detail = texture2D(uBand, vec2(u, clamp(v, 0.0, 1.0))).rgb;
            color = mix(detail, color, smoothstep(0.72, 1.0, v));
          }
          return color;
        }

        // Tun: osmon va xira joylar qorayadi, neon va oynalar yorqin qoladi.
        vec3 grade(vec3 c) {
          float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
          return c * mix(0.3, 1.05, smoothstep(0.05, 0.42, luma));
        }

        void main() {
          vec3 d = normalize(vDir);
          vec3 color;
          if (d.y >= 0.0) {
            // Tepaga qarab osmon qorong'ilashadi, yulduz va Oy ko'rinib turadi.
            color = grade(photo(d)) * mix(1.0, 0.5, smoothstep(0.1, 0.75, d.y));
          } else {
            // Daryo yuzasi: to'lqinlar suratdagi shaharni cho'zib aks ettiradi.
            float depth = max(-d.y, 0.004);
            float far = 1.0 / depth;
            // Maydalangan gorizontal to'lqinlar: aks yuqoridan pastga uzun cho'ziladi.
            float waves = sin(far * 0.83 + uTime * 0.8 + d.x * 7.0) * 0.45
                        + sin(far * 2.17 - uTime * 1.25 + d.x * 19.0) * 0.33
                        + sin(far * 5.3 + uTime * 2.1 + d.x * 53.0) * 0.22;
            vec3 sum = vec3(0.0);
            float total = 0.0;
            for (int i = 0; i < 5; i++) {
              float k = float(i) / 4.0;
              float lift = depth * (0.15 + k * k * 2.4) * (1.0 + waves * 0.45);
              vec3 mirror = normalize(vec3(d.x + waves * 0.0025, depth + lift, d.z));
              float w = 1.0 - k * 0.65;
              sum += photo(mirror) * w;
              total += w;
            }
            // Aks ufqda kuchli, yaqin suvda esa deyarli qorong'i.
            float strength = 0.62 * exp(-depth * 11.0) + 0.05;
            color = grade(sum / total) * strength + vec3(0.003, 0.005, 0.011);
          }
          gl_FragColor = vec4(color, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  mesh.position.set(0, 0, centerZ);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return uniforms;
}

function starColor(kelvin) {
  if (kelvin < 3800) return [1, 0.72, 0.5];
  if (kelvin < 5300) return [1, 0.88, 0.7];
  if (kelvin < 7500) return [1, 0.97, 0.92];
  return [0.74, 0.83, 1];
}

function stars(scene, centerZ, pixelRatio, sky) {
  const COUNT = sky.stars.length;
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  const phases = new Float32Array(COUNT);

  sky.stars.forEach((star, i) => {
    positions.set([star.dir[0] * STAR_RADIUS, star.dir[1] * STAR_RADIUS, centerZ + star.dir[2] * STAR_RADIUS], i * 3);
    const bright = Math.min(1.15, 1.3 - star.mag * 0.17);
    colors.set(starColor(star.kelvin).map((c) => c * bright), i * 3);
    sizes[i] = Math.max(1.15, 5.6 - (star.mag + 1.5) * 0.95);
    phases[i] = Math.random() * 6.28;
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: pixelRatio } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uScale;
      varying vec3 vColor;
      varying float vLight;
      void main() {
        vColor = aColor;
        float twinkle = 0.72 + 0.28 * sin(uTime * (1.2 + aPhase * 0.5) + aPhase);
        // Ufqqa yaqin yulduzlar havoda so‘nadi.
        vLight = twinkle * 0.8 * smoothstep(18.0, 85.0, position.y);
        gl_PointSize = aSize * uScale;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vLight;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.1, d);
        gl_FragColor = vec4(vColor * vLight * a, a);
        #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  scene.add(points);
  return material;
}

function moon(scene, position, light) {
  const map = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/moon.jpg`);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(14, 64, 48),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uMap: { value: map }, uLight: { value: light } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormalW;
        void main() {
          vUv = uv;
          vNormalW = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uLight;
        varying vec2 vUv;
        varying vec3 vNormalW;
        void main() {
          float sun = smoothstep(-0.05, 0.55, dot(normalize(vNormalW), uLight));
          vec3 surface = texture2D(uMap, vUv).rgb * vec3(1.0, 0.96, 0.88);
          // Soyadagi qismi shaffof: orqasidagi osmon ko'rinadi, qora doira qolmaydi.
          gl_FragColor = vec4(surface * sun * 1.5, clamp(sun * 3.0, 0.0, 1.0));
          #include <colorspace_fragment>
        }`,
    }),
  );
  mesh.position.copy(position);
  mesh.rotation.y = -Math.PI / 2; // Oyning Yerga qaragan tomoni
  scene.add(mesh);

  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,240,215,.3)');
  g.addColorStop(0.14, 'rgba(240,225,215,.13)');
  g.addColorStop(0.32, 'rgba(215,205,225,.045)');
  g.addColorStop(0.6, 'rgba(190,180,225,.01)');
  g.addColorStop(1, 'rgba(180,170,220,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.scale.setScalar(120);
  halo.position.copy(position);
  scene.add(halo);
}

/** Terrasa turgan binoning tashqi devorlari. */
function museumBlock(scene, cx, centerZ) {
  const block = new THREE.Mesh(new THREE.BoxGeometry(13, 46, -centerZ + 9), new THREE.MeshBasicMaterial({ color: 0x0d0b12 }));
  block.position.set(cx, -23.03, centerZ / 2 - 4.5);
  scene.add(block);
}

const TOWER_HEIGHT = 112;

/** Toshkent teleminorasi: uch tayanch, ikki qavatli kuzatuv qismi va antenna. */
function tvTower(scene, x, base, z, scale) {
  const H = TOWER_HEIGHT;
  const up = new THREE.Vector3(0, 1, 0);
  const strut = (a, b, r0, r1) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const g = new THREE.CylinderGeometry(r1, r0, dir.length(), 8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize()));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    return g;
  };
  const v = (px, py, pz) => new THREE.Vector3(px, py, pz);

  const parts = [strut(v(0, 0, 0), v(0, H * 0.8, 0), 3.1, 1.1), strut(v(0, H * 0.8, 0), v(0, H, 0), 0.6, 0.08)];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const foot = v(Math.cos(a) * 21, 0, Math.sin(a) * 21);
    parts.push(strut(foot, v(Math.cos(a) * 2.4, H * 0.42, Math.sin(a) * 2.4), 1.5, 0.7));
    parts.push(strut(foot, v(Math.cos(a + 0.9) * 2.4, H * 0.2, Math.sin(a + 0.9) * 2.4), 0.6, 0.4));
  }
  for (const [y, r, h] of [[0.46, 7.4, 4.6], [0.6, 5.2, 3.6]]) {
    const pod = new THREE.LatheGeometry(
      [[0, -h / 2], [r * 0.55, -h / 2], [r, -h * 0.1], [r, h * 0.1], [r * 0.6, h / 2], [0, h / 2]].map(([a, b]) => new THREE.Vector2(a, b)),
      24,
    );
    pod.translate(0, H * y, 0);
    parts.push(pod.toNonIndexed());
  }
  const body = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    return g;
  }));
  const tower = new THREE.Mesh(body, new THREE.MeshBasicMaterial({ color: 0x241d31 }));
  tower.position.set(x, base, z);
  tower.scale.setScalar(scale);
  scene.add(tower);

  // Kuzatuv qavatlaridagi oynalar va tik yorug'lik chizig'i
  const glow = new THREE.MeshBasicMaterial({ color: 0xffc97a });
  for (const [y, r] of [[0.46, 7.5], [0.6, 5.3]]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.1, 32, 1, true), glow);
    band.position.set(x, base + H * y * scale, z);
    band.scale.setScalar(scale);
    scene.add(band);
  }
  const strip = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, H * 0.34, 8), new THREE.MeshBasicMaterial({ color: 0xa8a0ff }));
  strip.position.set(x, base + H * 0.31 * scale, z + 2.5 * scale);
  strip.scale.setScalar(scale);
  scene.add(strip);
}

/** Har 20-30 soniyada osmonda uchadigan yulduz. */
function shootingStars(scene, cx, centerZ) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 16;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.85, 'rgba(210,225,255,.75)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 7, 256, 2);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  sprite.visible = false;
  sprite.scale.set(46, 2.9, 1);
  scene.add(sprite);

  const state = { next: 8, t: 0, active: false, catchable: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), head: new THREE.Vector3() };
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const LIFE = 2.1;
  let last = 0;

  const spawn = (camera) => {
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const heading = Math.atan2(forward.x, forward.z) + (Math.random() - 0.5) * 0.9;
    const elevation = 0.42 + Math.random() * 0.4;
    const place = (h, e) => new THREE.Vector3(Math.sin(h) * Math.cos(e), Math.sin(e), Math.cos(h) * Math.cos(e)).multiplyScalar(180).add(new THREE.Vector3(cx, 2, centerZ));
    const side = Math.random() < 0.5 ? -1 : 1;
    state.from.copy(place(heading - side * 0.2, elevation + 0.1));
    state.to.copy(place(heading + side * 0.2, elevation - 0.12));
    state.t = 0;
    state.active = true;
    state.catchable = LIFE + 3;
    sprite.visible = true;
  };

  return {
    state,
    update(now, camera, outside) {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      if (state.catchable > 0) state.catchable -= dt;
      if (!state.active) {
        state.next -= dt;
        if (state.next <= 0 && outside) spawn(camera);
        return;
      }
      state.t += dt / LIFE;
      state.head.lerpVectors(state.from, state.to, Math.min(1, state.t));
      sprite.position.copy(state.head);
      a.copy(state.from).project(camera);
      b.copy(state.to).project(camera);
      sprite.material.rotation = Math.atan2((b.y - a.y) / camera.aspect, b.x - a.x);
      sprite.material.opacity = Math.sin(Math.min(1, state.t) * Math.PI);
      if (state.t >= 1) {
        state.active = false;
        sprite.visible = false;
        state.next = 20 + Math.random() * 10;
      }
    },
  };
}

/** Osmondagi eng mos yorqin yulduz — ikkalangizning yulduzingiz. */
function ourStar(scene, cx, centerZ, sky) {
  const candidates = sky.stars
    .filter((s) => s.alt > 13 && s.alt < 24 && s.mag < 4 && s.dir[0] > -0.12 && s.dir[0] < 0.42 && Math.abs(s.dir[0] - 0.21) > 0.07 && s.dir[2] < 0)
    .sort((p, q) => p.mag - q.mag);
  const dir = candidates[0]?.dir ?? [0.08, 0.34, -0.94];
  const position = new THREE.Vector3(dir[0], dir[1], dir[2]).multiplyScalar(225).add(new THREE.Vector3(cx, 2, centerZ));

  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, 'rgba(255,225,160,.9)');
  g.addColorStop(0.42, 'rgba(255,190,110,.14)');
  g.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255,240,205,.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(64, 10);
  ctx.lineTo(64, 118);
  ctx.moveTo(10, 64);
  ctx.lineTo(118, 64);
  ctx.stroke();
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  glow.position.copy(position);
  glow.scale.setScalar(13);
  scene.add(glow);
  return { position, glow };
}

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

/** Skameyka yonidagi lavha: bu qaysi kunning osmoni ekanini aytadi. */
function skyPlaque(scene, x, z, date, city) {
  const c = document.createElement('canvas');
  c.width = 720;
  c.height = 300;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2b211a';
  ctx.fillRect(0, 0, 720, 300);
  ctx.strokeStyle = '#c9a25a';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, 692, 272);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f0dfc2';
  ctx.font = '400 74px "Great Vibes", serif';
  ctx.fillText('Biz tanishgan kechadagi osmon', 360, 130, 650);
  ctx.fillStyle = '#c9a25a';
  ctx.font = '500 40px "Manrope", sans-serif';
  ctx.fillText(`${date.getUTCDate()}-${MONTHS[date.getUTCMonth()]}, ${date.getUTCFullYear()} · ${city}`, 360, 218, 650);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.54), new THREE.MeshBasicMaterial({ map }));
  board.position.set(x, 1.22, z);
  scene.add(board);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.96, 8), new THREE.MeshLambertMaterial({ color: 0x3b2c20 }));
  post.position.set(x, 0.48, z - 0.02);
  scene.add(post);
}

/** `centerZ` — terrasaga chiqish devori, `cx` — terrasa o‘rtasi. */
export function buildNight(scene, cx, centerZ, pixelRatio, layout) {
  const { sky: place, together } = SITE;
  const localDate = `${together.since}${place.utcOffset}`;
  const sky = computeSky({ date: localDate, lat: place.lat, lon: place.lon });

  const domeUniforms = dome(scene, centerZ);
  const starMaterial = stars(scene, centerZ, pixelRatio, sky);

  const viewer = new THREE.Vector3(cx, 2, centerZ - 4);
  const moonPosition = new THREE.Vector3(...sky.moon.dir).multiplyScalar(190).add(viewer);
  // Oy o'sha kungi fazada: quyosh nuri tomoni hisoblanadi.
  const toViewer = viewer.clone().sub(moonPosition).normalize();
  const right = new THREE.Vector3().crossVectors(toViewer.clone().negate(), new THREE.Vector3(0, 1, 0)).normalize();
  const angle = sky.moon.phaseAngle * (Math.PI / 180);
  const light = toViewer.multiplyScalar(Math.cos(angle)).addScaledVector(right, Math.sin(angle) * (sky.moon.waxing ? 1 : -1));
  moon(scene, moonPosition, light);

  museumBlock(scene, cx, centerZ);
  // Toshkent minorasi daryo ortidagi qirg'oqda, surat tumaniga mos xira siluet.
  tvTower(scene, cx - 105, 0.6, centerZ - 200, 0.42);

  const falling = shootingStars(scene, cx, centerZ);
  const star = ourStar(scene, cx, centerZ, sky);
  const bench = layout.benches[layout.benches.length - 1];
  skyPlaque(scene, bench.seat.x - 2.5, bench.seat.z - 0.1, new Date(new Date(localDate).getTime() + utcOffsetMs(place.utcOffset)), place.city);

  return {
    update(now, camera, outside) {
      const t = now * 0.001;
      domeUniforms.uTime.value = t;
      starMaterial.uniforms.uTime.value = t;
      star.glow.scale.setScalar(13 + Math.sin(t * 1.8) * 1.6);
      falling.update(now, camera, outside);
    },
    ourStar: star.position,
    /** Hozir tutib olsa bo'ladigan uchar yulduz. */
    wish: () => (falling.state.catchable > 0 ? falling.state.head : null),
    catchWish: () => {
      falling.state.catchable = 0;
    },
  };
}

function utcOffsetMs(offset) {
  const sign = offset.startsWith('-') ? -1 : 1;
  const [h, m] = offset.slice(1).split(':').map(Number);
  return sign * (h * 60 + m) * 60000;
}
