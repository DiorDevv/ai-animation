import * as THREE from 'three';
import { HALL, FRAME_Y } from './layout.js';

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
  base.addColorStop(0.5, '#43372f');
  base.addColorStop(1, '#3a2f28');
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
