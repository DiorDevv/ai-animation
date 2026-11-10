import * as THREE from 'three';
import { HALL, FRAME_Y, DOOR, TERRACE } from './layout.js';

// Yorug‘lik va soyalar oldindan teksturaga chiziladi: telefonda ham silliq ishlaydi.
const MAX_TEX = 4096;

function surface(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w);
  canvas.height = Math.round(h);
  return [canvas, canvas.getContext('2d')];
}

export function toTexture(canvas, anisotropy = 4) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

function edgeShade(ctx, x0, y0, x1, y1, rect, strength) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, `rgba(30,26,22,${strength})`);
  g.addColorStop(1, 'rgba(30,26,22,0)');
  ctx.fillStyle = g;
  ctx.fillRect(...rect);
}

function ellipseGlow(ctx, x, y, rx, ry, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(${color},${alpha})`);
  g.addColorStop(0.55, `rgba(${color},${alpha * 0.4})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

/**
 * Devor teksturasi. `items` — devordagi ramkalar, `along` markazdan masofa.
 * `panel` berilsa, o‘rtada to‘q rangli maydon chiziladi.
 */
export function bakeWall({ length, items, panel = 0, draw }) {
  const H = HALL.height;
  const ppm = Math.min(96, MAX_TEX / length);
  const [canvas, ctx] = surface(length * ppm, H * ppm);
  const { width: W, height: Ht } = canvas;
  const toX = (a) => (a + length / 2) * ppm;
  const toY = (y) => (H - y) * ppm;

  const base = ctx.createLinearGradient(0, 0, 0, Ht);
  base.addColorStop(0, '#2f2722');
  base.addColorStop(0.5, '#4b3430');
  base.addColorStop(1, '#3f2b28');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, Ht);

  if (panel) {
    ctx.fillStyle = '#15110e';
    ctx.fillRect(toX(-panel / 2), 0, panel * ppm, Ht);
  }

  const glowAlpha = panel ? 0.3 : 0.8;
  for (const it of items) {
    const rx = (it.outerW / 2 + 1.1) * ppm;
    ellipseGlow(ctx, toX(it.along), toY(FRAME_Y + 0.7), rx, 2.5 * ppm, '255,214,158', glowAlpha);
  }

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.7)';
  ctx.shadowBlur = 0.16 * ppm;
  ctx.shadowOffsetY = 0.07 * ppm;
  ctx.fillStyle = '#333';
  for (const it of items) {
    ctx.fillRect(toX(it.along - it.outerW / 2), toY(FRAME_Y + it.outerH / 2), it.outerW * ppm, it.outerH * ppm);
  }
  ctx.restore();

  edgeShade(ctx, 0, 0, 0, 0.75 * ppm, [0, 0, W, 0.75 * ppm], 0.42);
  edgeShade(ctx, 0, Ht, 0, Ht - 0.4 * ppm, [0, Ht - 0.4 * ppm, W, 0.4 * ppm], 0.26);
  edgeShade(ctx, 0, 0, 0.7 * ppm, 0, [0, 0, 0.7 * ppm, Ht], 0.24);
  edgeShade(ctx, W, 0, W - 0.7 * ppm, 0, [W - 0.7 * ppm, 0, 0.7 * ppm, Ht], 0.24);

  if (draw) draw(ctx, { W, Ht, ppm });
  return toTexture(canvas);
}

export function bakeFloor(layout) {
  const W = HALL.width;
  const L = layout.length;
  const ppm = Math.min(64, MAX_TEX / L);
  const [canvas, ctx] = surface(W * ppm, L * ppm);
  const { width: cw, height: ch } = canvas;
  const toX = (x) => (x + W / 2) * ppm;
  const toY = (z) => (L + z) * ppm;

  ctx.fillStyle = '#2b231d';
  ctx.fillRect(0, 0, cw, ch);

  // Beton donadorligi
  for (let i = 0; i < cw * ch * 0.012; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,225,190,.04)' : 'rgba(0,0,0,.08)';
    ctx.fillRect(Math.random() * cw, Math.random() * ch, 1.5, 1.5);
  }

  ctx.strokeStyle = 'rgba(255,220,170,.06)';
  ctx.lineWidth = 1;
  for (let z = 0; z < L; z += 2.75) {
    ctx.beginPath();
    ctx.moveTo(0, z * ppm);
    ctx.lineTo(cw, z * ppm);
    ctx.stroke();
  }
  for (let x = -W / 2 + 2.75; x < W / 2; x += 2.75) {
    ctx.beginPath();
    ctx.moveTo(toX(x), 0);
    ctx.lineTo(toX(x), ch);
    ctx.stroke();
  }

  for (const p of layout.placements) {
    const c = p.pos.clone().addScaledVector(p.normal, 0.9);
    const alongX = p.wall === 'end';
    const wide = (p.outerW / 2 + 0.8) * ppm;
    const deep = 1.6 * ppm;
    ellipseGlow(ctx, toX(c.x), toY(c.z), alongX ? wide : deep, alongX ? deep : wide, '255,196,128', 0.5);
  }

  // Atirgul yo‘lagi: markazdagi gilam va sochilgan barglar.
  const carpet = 2.5 * ppm;
  const carpetX = (cw - carpet) / 2;
  ctx.fillStyle = '#5c1421';
  ctx.fillRect(carpetX, 0, carpet, ch);
  ctx.fillStyle = 'rgba(214,170,92,.75)';
  ctx.fillRect(carpetX + 0.07 * ppm, 0, 0.035 * ppm, ch);
  ctx.fillRect(carpetX + carpet - 0.105 * ppm, 0, 0.035 * ppm, ch);

  const petal = (x, y) => drawPetal(ctx, x, y, ppm);
  for (let i = 0; i < L * 42; i++) {
    const edge = Math.random() < 0.6;
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = edge ? side * (1.15 + Math.random() * 0.75) : (Math.random() - 0.5) * 2.2;
    petal(toX(x), Math.random() * ch);
  }
  // Yaltiroq pol: har suratning xira aksi.
  const reflection = document.createElement('canvas');
  reflection.width = reflection.height = 40;
  const rc = reflection.getContext('2d');
  for (const p of layout.placements) {
    rc.globalCompositeOperation = 'source-over';
    rc.clearRect(0, 0, 40, 40);
    rc.save();
    rc.translate(0, 40);
    rc.scale(1, -1);
    rc.drawImage(p.memory.canvas, 0, 0, 40, 40);
    rc.restore();
    rc.globalCompositeOperation = 'destination-in';
    const fade = rc.createLinearGradient(0, 0, 0, 40);
    fade.addColorStop(0, 'rgba(0,0,0,.42)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    rc.fillStyle = fade;
    rc.fillRect(0, 0, 40, 40);

    ctx.save();
    ctx.setTransform(p.right.x * ppm, p.right.z * ppm, p.normal.x * ppm, p.normal.z * ppm, toX(p.pos.x), toY(p.pos.z));
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(reflection, -p.w / 2, 0.02, p.w, 1.5);
    ctx.restore();
  }

  for (const b of layout.benches) {
    const alongX = Math.abs(b.along.x) > 0.5;
    const a = (b.length / 2 + 0.25) * ppm;
    const d = 0.5 * ppm;
    ellipseGlow(ctx, toX(b.seat.x), toY(b.seat.z), alongX ? a : d, alongX ? d : a, '40,32,24', 0.5);
  }
  ellipseGlow(ctx, toX(layout.pedestal.x), toY(layout.pedestal.z), 0.85 * ppm, 0.85 * ppm, '40,32,24', 0.55);

  edgeShade(ctx, 0, 0, 0.8 * ppm, 0, [0, 0, 0.8 * ppm, ch], 0.3);
  edgeShade(ctx, cw, 0, cw - 0.8 * ppm, 0, [cw - 0.8 * ppm, 0, 0.8 * ppm, ch], 0.3);
  edgeShade(ctx, 0, 0, 0, 0.8 * ppm, [0, 0, cw, 0.8 * ppm], 0.3);
  edgeShade(ctx, 0, ch, 0, ch - 0.8 * ppm, [0, ch - 0.8 * ppm, cw, 0.8 * ppm], 0.3);

  return toTexture(canvas, 8);
}

function drawPetal(ctx, x, y, ppm) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.random() * 6.28);
  ctx.fillStyle = ['#c41f3d', '#e0486a', '#9d1531', '#f07a93'][Math.floor(Math.random() * 4)];
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.045 * ppm, 0.03 * ppm, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function bakeTerrace(layout) {
  const { minX, maxX, depth } = TERRACE;
  const L = layout.length;
  const ppm = 64;
  const [canvas, ctx] = surface((maxX - minX) * ppm, depth * ppm);
  const { width: cw, height: ch } = canvas;
  const toX = (x) => (x - minX) * ppm;
  const toY = (z) => (z + L + depth) * ppm;

  ctx.fillStyle = '#3b3532';
  ctx.fillRect(0, 0, cw, ch);
  for (let i = 0; i < cw * ch * 0.012; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,240,220,.05)' : 'rgba(0,0,0,.12)';
    ctx.fillRect(Math.random() * cw, Math.random() * ch, 1.5, 1.5);
  }
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 2;
  for (let x = 0; x < cw; x += 1.1 * ppm) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ch);
    ctx.stroke();
  }
  for (let y = 0; y < ch; y += 1.1 * ppm) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(cw, y);
    ctx.stroke();
  }

  // Oy nuri va eshikdan tushayotgan iliq yorug‘lik
  ellipseGlow(ctx, cw * 0.45, ch * 0.3, cw * 0.6, ch * 0.65, '150,165,220', 0.2);
  ellipseGlow(ctx, toX(DOOR.x), toY(-L), 2.2 * ppm, 3.4 * ppm, '255,196,128', 0.55);

  const { pedestal: h } = layout;
  // Eshikdan yurakkacha barg yo‘li
  for (let i = 0; i < 420; i++) {
    const t = Math.random();
    const x = DOOR.x + (h.x - DOOR.x) * t + (Math.random() - 0.5) * 1.5;
    const z = -L + (h.z + L) * t;
    drawPetal(ctx, toX(x), toY(z), ppm);
  }
  // Yurak atrofida barglardan yurak shakli
  for (let i = 0; i < 300; i++) {
    const t = (i / 300) * Math.PI * 2;
    const hx = 16 * Math.sin(t) ** 3;
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    drawPetal(ctx, toX(h.x + hx * 0.095), toY(h.z - hy * 0.095 + 0.2), ppm);
  }
  ellipseGlow(ctx, toX(h.x), toY(h.z), 0.85 * ppm, 0.85 * ppm, '10,6,4', 0.6);
  for (const b of layout.benches) {
    if (b.seat.z > -L) continue;
    ellipseGlow(ctx, toX(b.seat.x), toY(b.seat.z), (b.length / 2 + 0.25) * ppm, 0.5 * ppm, '10,6,4', 0.55);
  }
  return toTexture(canvas, 8);
}

export function bakeCeilingTile() {
  const [canvas, ctx] = surface(256, 256);
  ctx.fillStyle = '#120f0d';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#2b241e';
  ctx.fillRect(0, 0, 256, 2);
  ctx.fillRect(0, 0, 2, 256);
  const tex = toTexture(canvas, 8);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/);
  const lines = [''];
  for (const word of words) {
    const next = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !lines[lines.length - 1]) {
      lines[lines.length - 1] = next;
    } else if (lines.length < maxLines) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${lines[lines.length - 1]}…`;
      break;
    }
  }
  return lines;
}

export function bakePlaque(memory) {
  const [canvas, ctx] = surface(512, 256);
  ctx.fillStyle = '#e6dac4';
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = '#8b8378';
  ctx.font = '500 26px "Manrope", sans-serif';
  ctx.fillText(`№ ${memory.index + 1}  ·  ${memory.date}`, 32, 58);
  ctx.fillStyle = '#23201c';
  ctx.font = '500 56px "Cormorant Garamond", serif';
  wrapLines(ctx, memory.title, 448, 2).forEach((line, i) => ctx.fillText(line, 32, 130 + i * 60));
  return toTexture(canvas);
}

/** Kirish devoridagi bag‘ishlov yozuvi. */
export function drawDedication(title, dedication) {
  return (ctx, { W, Ht, ppm }) => {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f0dfc2';
    ctx.font = `500 ${0.62 * ppm}px "Cormorant Garamond", serif`;
    ctx.fillText(title, W / 2, Ht * 0.46);
    ctx.fillStyle = '#c8b596';
    ctx.font = `italic 400 ${0.26 * ppm}px "Cormorant Garamond", serif`;
    ctx.fillText(dedication, W / 2, Ht * 0.56);
  };
}
