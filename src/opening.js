// Kirishdagi manzara: konvert zarrachalarga sochilib, ism va atirgulga aylanadi.
const SERIF = '"Cormorant Garamond", serif';
const SCRIPT = '"Great Vibes", "Cormorant Garamond", serif';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Rasmni chizib, uning piksellaridan zarracha nishonlarini oladi. */
function sample(W, H, count, draw) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  draw(ctx);
  const { data } = ctx.getImageData(0, 0, W, H);
  const points = [];
  const step = 2;
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const i = (y * W + x) * 4;
      if (data[i + 3] > 110) points.push([x, y, data[i], data[i + 1], data[i + 2]]);
    }
  }
  shuffle(points);
  return Array.from({ length: count }, (_, i) => points[i % points.length]);
}

function fitText(ctx, text, fontFor, maxWidth, start) {
  let size = start;
  ctx.font = fontFor(size);
  while (ctx.measureText(text).width > maxWidth && size > 14) {
    size -= 2;
    ctx.font = fontFor(size);
  }
  return size;
}

function drawEnvelope(ctx, W, H) {
  const w = Math.min(W * 0.72, 460);
  const h = w * 0.64;
  const x = (W - w) / 2;
  const y = (H - h) / 2 - 20;
  ctx.strokeStyle = '#f0c9a8';
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w / 2, y + h * 0.56);
  ctx.lineTo(x + w, y);
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w * 0.36, y + h * 0.42);
  ctx.moveTo(x + w, y + h);
  ctx.lineTo(x + w * 0.64, y + h * 0.42);
  ctx.stroke();

  ctx.fillStyle = '#e8627c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${w * 0.13}px serif`;
  ctx.fillText('♥', W / 2, y + h * 0.5);
  ctx.fillStyle = '#fbeee0';
  ctx.font = `500 ${w * 0.1}px ${SERIF}`;
  ctx.fillText('Senga', W / 2, y + h * 0.8);
}

function drawName(ctx, W, H, name) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontFor = (s) => `400 ${s}px ${SCRIPT}`;
  fitText(ctx, name, fontFor, W * 0.82, Math.min(W * 0.26, 190));
  ctx.fillStyle = '#ff8fa8';
  ctx.fillText(name, W / 2, H / 2);
}

function petal(ctx, cx, cy, rx, ry, angle, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, -ry * 0.6, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRose(ctx, W, H, name) {
  const s = Math.min(W, H) * 0.0021 * (W < 600 ? 1.5 : 1);
  const cx = W / 2;
  const cy = H * 0.34;

  ctx.strokeStyle = '#4fae78';
  ctx.lineWidth = 9 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy + 60 * s);
  ctx.bezierCurveTo(cx - 24 * s, cy + 160 * s, cx + 26 * s, cy + 220 * s, cx - 6 * s, cy + 320 * s);
  ctx.stroke();
  ctx.fillStyle = '#58c088';
  for (const [dx, dy, a] of [[-14, 190, -2.1], [8, 245, 2.0]]) {
    ctx.save();
    ctx.translate(cx + dx * s, cy + dy * s);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, -44 * s, 20 * s, 44 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const rings = [
    [8, 120, 46, 80, '#a81b43'],
    [7, 86, 40, 66, '#d22a59'],
    [6, 56, 32, 52, '#ee4a78'],
    [5, 30, 24, 38, '#ff6f95'],
    [3, 10, 15, 22, '#ffa3bb'],
  ];
  rings.forEach(([n, r, rx, ry, color], ring) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.55;
      petal(ctx, cx + Math.sin(a) * r * 0.5 * s, cy - Math.cos(a) * r * 0.5 * s, rx * s, ry * s, a, color);
    }
  });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontFor = (size) => `400 ${size}px ${SCRIPT}`;
  fitText(ctx, name, fontFor, W * 0.7, Math.min(W * 0.14, 96));
  ctx.fillStyle = '#ffd9c7';
  ctx.fillText(name, W / 2, H * 0.84);
}

/**
 * @param onFirstTap brauzer ovozga ruxsat berishi uchun bosish paytida chaqiriladi
 * @param onReveal muzey ko‘rina boshlashidan oldin chaqiriladi
 */
export async function playOpening(name, reducedMotion, onFirstTap, onReveal) {
  const root = document.getElementById('opening');
  const button = document.getElementById('open-env');
  const canvas = document.getElementById('opening-canvas');
  root.hidden = false;

  const dpr = Math.min(devicePixelRatio, 1.5);
  const W = Math.round(innerWidth * dpr);
  const H = Math.round(innerHeight * dpr);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const COUNT = innerWidth < 600 ? 1500 : 2600;
  const envelope = sample(W, H, COUNT, (c) => drawEnvelope(c, W, H));
  const nameShape = sample(W, H, COUNT, (c) => drawName(c, W, H, name));
  const rose = sample(W, H, COUNT, (c) => drawRose(c, W, H, name));

  const particles = Array.from({ length: COUNT }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: 255,
    g: 200,
    b: 180,
    rate: 2.6 + Math.random() * 2.4,
  }));

  let target = envelope;
  let swirl = 0;
  let running = true;
  const colors = new Map();
  const colorOf = (r, g, b) => {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let c = colors.get(key);
    if (!c) {
      c = `rgb(${(r >> 3) << 3},${(g >> 3) << 3},${(b >> 3) << 3})`;
      colors.set(key, c);
    }
    return c;
  };

  let last = performance.now();
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(10,8,14,.34)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    const size = 1.5 * dpr;
    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      const t = target[i];
      const k = 1 - Math.exp(-dt * p.rate);
      p.x += (t[0] - p.x) * k;
      p.y += (t[1] - p.y) * k;
      p.r += (t[2] - p.r) * k;
      p.g += (t[3] - p.g) * k;
      p.b += (t[4] - p.b) * k;
      if (swirl) {
        const dx = p.x - W / 2;
        const dy = p.y - H / 2;
        p.x += (-dy * swirl - dx * swirl * 0.35) * dt;
        p.y += (dx * swirl - dy * swirl * 0.35) * dt;
      }
      ctx.fillStyle = colorOf(p.r, p.g, p.b);
      ctx.fillRect(p.x, p.y, size, size);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  await wait(reducedMotion ? 100 : 1500);
  button.hidden = false;
  button.focus();
  await new Promise((resolve) => {
    button.onclick = () => {
      onFirstTap();
      resolve();
    };
  });
  button.hidden = true;

  if (!reducedMotion) {
    swirl = 3.4;
    target = particles.map((p) => {
      const a = Math.atan2(p.y - H / 2, p.x - W / 2);
      const r = Math.min(W, H) * (0.18 + Math.random() * 0.14);
      return [W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r * 0.45, 232, 60, 110];
    });
    await wait(1200);
    swirl = 0;
    target = nameShape;
    await wait(2800);
    target = rose;
    await wait(3800);
  } else {
    target = rose;
    await wait(1500);
  }

  onReveal();
  root.classList.add('leaving');
  await wait(1000);
  running = false;
  root.remove();
}
