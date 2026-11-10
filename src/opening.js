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
      if (data[i + 3] > 110 && data[i] + data[i + 1] + data[i + 2] > 90) points.push([x, y, data[i], data[i + 1], data[i + 2]]);
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

/** Yon tomondan ko‘ringan atirgul. Qorong‘i chiziqlar zarrachasiz qolib, gulbarglarni ajratib turadi. */
const roseScale = (W, H) => Math.min(W, H) * (W < 600 * 1.5 ? 0.0028 : 0.0017);

function drawRose(ctx, W, H) {
  const s = roseScale(W, H);
  ctx.save();
  ctx.translate(W / 2, H * 0.33);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const shape = (d, top, bottom, y0 = -160, y1 = 140, line = 5) => {
    const path = new Path2D(d);
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fill(path);
    ctx.strokeStyle = '#120207';
    ctx.lineWidth = line;
    ctx.stroke(path);
  };

  // Poya va tikanlar
  ctx.strokeStyle = '#3f9a68';
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(0, 130);
  ctx.bezierCurveTo(-16, 170, 14, 205, -4, 238);
  ctx.stroke();
  shape('M-7,172 L-30,160 L-6,188Z', '#57b983', '#2f7a52', 160, 190, 2);

  // Barglar
  const leaf = (x, y, angle, size) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(size, size);
    shape('M0,0 C32,-40 96,-44 140,0 C96,44 32,40 0,0Z', '#6fd39a', '#2f8a5a', -44, 44, 4);
    ctx.strokeStyle = '#123a26';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(132, 0);
    for (let i = 1; i <= 4; i++) {
      const vx = i * 26;
      ctx.moveTo(vx, 0);
      ctx.lineTo(vx + 20, -24 + i * 2);
      ctx.moveTo(vx, 0);
      ctx.lineTo(vx + 20, 24 - i * 2);
    }
    ctx.stroke();
    ctx.restore();
  };
  leaf(-6, 192, Math.PI + 0.42, 0.66);
  leaf(4, 214, -0.32, 0.58);

  // Gulbarglar: orqadan oldinga
  const deep = '#7c0f2f';
  const mid = '#b5173f';
  const bright = '#e0355f';
  const light = '#f2557c';

  shape('M-95,-55 C-105,-130 -35,-160 5,-150 C55,-160 115,-125 100,-50 C60,-90 -50,-90 -95,-55Z', bright, deep);
  shape('M-15,125 C-120,120 -185,40 -165,-40 C-155,-90 -115,-105 -85,-85 C-110,-20 -85,70 -15,125Z', light, deep);
  shape('M20,125 C125,118 185,35 168,-45 C158,-92 118,-104 88,-84 C112,-20 90,70 20,125Z', light, deep);
  shape('M-5,115 C-85,100 -130,30 -118,-40 C-110,-85 -70,-95 -45,-75 C-70,-20 -55,60 -5,115Z', bright, mid);
  shape('M10,115 C90,98 132,25 120,-42 C112,-85 72,-96 48,-75 C72,-20 58,60 10,115Z', bright, mid);
  shape('M-62,-50 C-60,-100 -15,-118 8,-112 C40,-118 72,-92 65,-45 C35,-72 -30,-72 -62,-50Z', light, mid);
  shape('M-52,-52 L52,-52 L42,58 L-42,58Z', mid, deep, -52, 58, 0.5);
  shape('M-24,-58 C-20,-85 20,-90 28,-60 C34,-30 10,-10 -8,-20 C-26,-30 -30,-48 -24,-58Z', '#ff7d9c', mid);
  shape('M-55,-48 C-70,0 -45,48 0,55 C-25,20 -30,-20 -18,-62 C-30,-66 -45,-60 -55,-48Z', light, deep);
  shape('M60,-46 C72,5 42,50 0,55 C30,25 34,-20 22,-64 C36,-66 52,-60 60,-46Z', light, deep);
  shape('M-78,-10 C-80,60 -30,98 8,95 C48,95 85,55 82,-12 C55,30 -50,32 -78,-10Z', bright, deep, -12, 96);
  shape('M-100,35 C-85,110 -35,135 5,135 C50,135 92,108 105,32 C70,72 -60,76 -100,35Z', light, mid, 32, 136);

  // Markazdagi burama
  ctx.strokeStyle = '#120207';
  ctx.lineWidth = 4;
  ctx.stroke(new Path2D('M-12,-50 C-8,-68 16,-70 18,-52 C19,-38 4,-32 -2,-42 C-5,-48 2,-54 7,-50'));

  // Kosacha barglari
  shape('M-12,128 C-50,140 -80,165 -98,172 C-60,178 -25,165 -3,146Z', '#62c78f', '#2f7a52', 128, 178, 3);
  shape('M12,128 C50,140 80,165 98,172 C60,178 25,165 3,146Z', '#62c78f', '#2f7a52', 128, 178, 3);
  shape('M-20,128 C-16,152 16,152 20,128 C8,134 -8,134 -20,128Z', '#57b983', '#2f7a52', 128, 152, 3);
  ctx.restore();
}

function drawRoseName(ctx, W, H, name) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontFor = (size) => `400 ${size}px ${SCRIPT}`;
  fitText(ctx, name, fontFor, W * 0.7, Math.min(W * 0.16, 130));
  ctx.fillStyle = '#ffd9c7';
  ctx.fillText(name, W / 2, H * 0.33 + 285 * roseScale(W, H));
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

  const COUNT = innerWidth < 600 ? 3000 : 5200;
  const envelope = sample(W, H, COUNT, (c) => drawEnvelope(c, W, H));
  const nameShape = sample(W, H, COUNT, (c) => drawName(c, W, H, name));
  // Ism alohida ulush oladi, aks holda katta gul barcha zarrachalarni olib qo‘yadi.
  const nameCount = Math.round(COUNT * 0.2);
  const rose = [
    ...sample(W, H, COUNT - nameCount, (c) => drawRose(c, W, H)),
    ...sample(W, H, nameCount, (c) => drawRoseName(c, W, H, name)),
  ];

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
    await wait(4800);
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
