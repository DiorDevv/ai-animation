const MAX_EDGE = 1280; // telefon xotirasini to‘ldirmaslik uchun
const SAMPLE_ASPECTS = [4 / 5, 3 / 4, 16 / 10, 4 / 5, 1, 3 / 2, 3 / 4, 4 / 5, 4 / 5, 4 / 5];
const SAMPLE_COLORS = [
  ['#7d2f3b', '#e2a58f'],
  ['#34506b', '#d9b99b'],
  ['#c9764f', '#2c3350'],
  ['#5d6b4e', '#e7d5ae'],
  ['#8a4a6b', '#f0c3a6'],
  ['#274a52', '#efb07f'],
];

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function fromImage(img) {
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function sample(index) {
  const aspect = SAMPLE_ASPECTS[index % SAMPLE_ASPECTS.length];
  const [a, b] = SAMPLE_COLORS[index % SAMPLE_COLORS.length];
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(aspect >= 1 ? 1000 : 1000 * aspect);
  canvas.height = Math.round(aspect >= 1 ? 1000 / aspect : 1000);
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, a);
  bg.addColorStop(1, b);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.font = `500 ${Math.round(h * 0.26)}px "Cormorant Garamond", serif`;
  ctx.fillText(String(index + 1), w / 2, h * 0.54);
  ctx.font = `400 ${Math.round(h * 0.045)}px "Manrope", sans-serif`;
  ctx.fillText('Surat shu yerga', w / 2, h * 0.66);
  return canvas;
}

export async function loadMemories(list, onProgress) {
  let done = 0;
  const base = import.meta.env.BASE_URL;
  return Promise.all(
    list.map(async (memory, index) => {
      let canvas;
      try {
        canvas = fromImage(await loadImage(`${base}memories/${memory.file}`));
      } catch {
        canvas = sample(index);
      }
      onProgress(++done / list.length);
      return { ...memory, index, canvas, aspect: canvas.width / canvas.height };
    }),
  );
}
