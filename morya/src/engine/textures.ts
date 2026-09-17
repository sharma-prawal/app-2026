// Procedural textures: handmade paper, pigment granulation, brush stamps.
import { rng } from './geom';

export type Canvas = HTMLCanvasElement;

export function makeCanvas(w: number, h: number): Canvas {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export const ctx2d = (c: Canvas) => c.getContext('2d') as CanvasRenderingContext2D;

/** Tileable value noise on a `period`-cell lattice. */
function periodicNoise(size: number, period: number, seed: number) {
  const r = rng(seed);
  const lat = new Float32Array(period * period).map(() => r());
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const gy = (y / size) * period;
    const iy = Math.floor(gy), fy = gy - iy, uy = fy * fy * (3 - 2 * fy);
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * period;
      const ix = Math.floor(gx), fx = gx - ix, ux = fx * fx * (3 - 2 * fx);
      const x0 = ix % period, x1 = (ix + 1) % period, y0 = iy % period, y1 = (iy + 1) % period;
      const a = lat[y0 * period + x0], b = lat[y0 * period + x1], c = lat[y1 * period + x0], d = lat[y1 * period + x1];
      out[y * size + x] = a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
    }
  }
  return out;
}

let paperCache: Canvas | null = null;

/** A seamless tile of warm handmade paper: mottling, fibres, tooth. */
export function paperTile(size = 512): Canvas {
  if (paperCache) return paperCache;
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const img = g.createImageData(size, size);
  const low = periodicNoise(size, 4, 11);
  const mid = periodicNoise(size, 16, 23);
  const hi = periodicNoise(size, 96, 37);
  const r = rng(5);
  for (let i = 0; i < size * size; i++) {
    const tooth = (r() - 0.5) * 7;
    const v = (low[i] - 0.5) * 9 + (mid[i] - 0.5) * 6 + (hi[i] - 0.5) * 8 + tooth;
    img.data[i * 4] = 243 + v;
    img.data[i * 4 + 1] = 233 + v * 0.95;
    img.data[i * 4 + 2] = 214 + v * 0.85;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // fibres
  const fr = rng(99);
  for (let i = 0; i < 260; i++) {
    const x = fr() * size, y = fr() * size, len = 6 + fr() * 22, a = fr() * Math.PI * 2;
    const dark = fr() < 0.55;
    g.strokeStyle = dark ? `rgba(120,90,60,${0.05 + fr() * 0.07})` : `rgba(255,250,240,${0.18 + fr() * 0.2})`;
    g.lineWidth = 0.5 + fr() * 0.9;
    for (const ox of [0, -size, size]) for (const oy of [0, -size, size]) {
      g.beginPath();
      g.moveTo(x + ox, y + oy);
      g.quadraticCurveTo(x + ox + Math.cos(a) * len * 0.5 + (fr() - 0.5) * 4, y + oy + Math.sin(a) * len * 0.5, x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
      g.stroke();
    }
  }
  paperCache = c;
  return c;
}

let grainCache: Canvas | null = null;
/** Sparse dark speckle with alpha; applied source-atop to settle pigment into the tooth. */
export function grainTile(size = 256): Canvas {
  if (grainCache) return grainCache;
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const img = g.createImageData(size, size);
  const hi = periodicNoise(size, 64, 71);
  const r = rng(17);
  for (let i = 0; i < size * size; i++) {
    const n = hi[i] * 0.6 + r() * 0.4;
    img.data[i * 4] = 70;
    img.data[i * 4 + 1] = 45;
    img.data[i * 4 + 2] = 30;
    img.data[i * 4 + 3] = n > 0.62 ? (n - 0.62) * 300 : 0;
  }
  g.putImageData(img, 0, 0);
  grainCache = c;
  return c;
}

let blotchCache: Canvas | null = null;
/** Large soft pigment variation (alpha only), tileable. */
export function blotchTile(size = 256): Canvas {
  if (blotchCache) return blotchCache;
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const img = g.createImageData(size, size);
  const a = periodicNoise(size, 5, 3);
  const b = periodicNoise(size, 11, 8);
  for (let i = 0; i < size * size; i++) {
    const v = a[i] * 0.65 + b[i] * 0.35;
    img.data[i * 4] = 90;
    img.data[i * 4 + 1] = 50;
    img.data[i * 4 + 2] = 35;
    img.data[i * 4 + 3] = Math.max(0, v - 0.45) * 190;
  }
  g.putImageData(img, 0, 0);
  blotchCache = c;
  return c;
}

/** Dry-brush stamps: bristle streaks along +x with ragged ends. */
export function bristleStamps(count = 4, size = 96): Canvas[] {
  const out: Canvas[] = [];
  for (let k = 0; k < count; k++) {
    const c = makeCanvas(size, size);
    const g = ctx2d(c);
    const r = rng(300 + k);
    const R = size / 2;
    // soft body
    const grad = g.createRadialGradient(R, R, 0, R, R, R);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    // bristles
    for (let i = 0; i < 46; i++) {
      const off = (r() * 2 - 1) * R * 0.85;
      const half = Math.sqrt(1 - (off / R) ** 2) * R * (0.6 + r() * 0.4);
      g.strokeStyle = `rgba(0,0,0,${0.25 + r() * 0.55})`;
      g.lineWidth = 0.8 + r() * 2.4;
      g.beginPath();
      g.moveTo(R - half, R + off);
      g.lineTo(R + half * (0.7 + r() * 0.3), R + off + (r() - 0.5) * 2);
      g.stroke();
    }
    out.push(c);
  }
  return out;
}

/** Watercolour blooms: irregular blobs, fuller at the rim like a drying pool. */
export function bloomStamps(count = 6, size = 160): Canvas[] {
  const out: Canvas[] = [];
  for (let k = 0; k < count; k++) {
    const c = makeCanvas(size, size);
    const g = ctx2d(c);
    const r = rng(800 + k * 7);
    const R = size / 2;
    const n = 36;
    const phase = Array.from({ length: 4 }, () => r() * Math.PI * 2);
    const radius = (a: number) =>
      R * 0.78 * (1 + 0.1 * Math.sin(3 * a + phase[0]) + 0.07 * Math.sin(5 * a + phase[1]) + 0.05 * Math.sin(9 * a + phase[2]) + 0.03 * Math.sin(17 * a + phase[3]));
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = radius(a);
      const x = R + Math.cos(a) * rr, y = R + Math.sin(a) * rr;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    const grad = g.createRadialGradient(R, R, 0, R, R, R * 0.9);
    grad.addColorStop(0, 'rgba(0,0,0,0.78)');
    grad.addColorStop(0.75, 'rgba(0,0,0,0.9)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = grad;
    g.fill();
    // feathered outer edge so the mask never shows a hard polygon
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2;
      const rr = radius(a) * (0.9 + r() * 0.14);
      g.fillStyle = `rgba(0,0,0,${0.2 + r() * 0.4})`;
      g.beginPath();
      g.arc(R + Math.cos(a) * rr, R + Math.sin(a) * rr, 1.5 + r() * 4, 0, Math.PI * 2);
      g.fill();
    }
    out.push(c);
  }
  return out;
}

/** Rims of blooms, for the darker pigment edge left as water dries. */
export function rimStamps(blooms: Canvas[]): Canvas[] {
  return blooms.map((b) => {
    const c = makeCanvas(b.width, b.height);
    const g = ctx2d(c);
    g.drawImage(b, 0, 0);
    g.globalCompositeOperation = 'destination-out';
    const s = 0.86;
    g.drawImage(b, (b.width * (1 - s)) / 2, (b.height * (1 - s)) / 2, b.width * s, b.height * s);
    return c;
  });
}
