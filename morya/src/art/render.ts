// Rasterises vector parts into watercolour pigment and ink layers.
import { brushLine, tracePoly, wobble } from '../engine/geom';
import { bloomStamps, blotchTile, ctx2d, grainTile, makeCanvas, type Canvas } from '../engine/textures';
import { INK, type Part } from './parts';

let blooms: Canvas[] | null = null;
const tinted = new Map<string, Canvas>();
export function tintedBloom(color: string, k: number): Canvas {
  const key = color + k;
  let c = tinted.get(key);
  if (!c) {
    blooms ??= softBlooms();
    const src = blooms[k % blooms.length];
    c = makeCanvas(src.width, src.height);
    const g = ctx2d(c);
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    tinted.set(key, c);
  }
  return c;
}

/** Glaze blooms fade toward the centre edge so they merge like wet-in-wet. */
function softBlooms(): Canvas[] {
  return bloomStamps(6, 160).map((b) => {
    const c = makeCanvas(b.width, b.height);
    const g = ctx2d(c);
    g.drawImage(b, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    const R = b.width / 2;
    const grad = g.createRadialGradient(R, R, R * 0.2, R, R, R);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0.75)');
    grad.addColorStop(1, 'rgba(0,0,0,0.9)');
    g.fillStyle = grad;
    g.fillRect(0, 0, b.width, b.height);
    return c;
  });
}

export interface Box { x: number; y: number; w: number; h: number }

export function layerCanvas(box: Box, rs: number) {
  const c = makeCanvas(box.w * rs, box.h * rs);
  const g = ctx2d(c);
  g.setTransform(rs, 0, 0, rs, -box.x * rs, -box.y * rs);
  return { c, g };
}

/** Paints each region as layered wash: base, glazes, pooled rim, granulation. */
export function paintPigment(g: CanvasRenderingContext2D, parts: Part[], seed = 1) {
  parts.forEach((p, i) => {
    if (!p.fill || !p.shape) return;
    const shape = wobble(p.shape, 1.6, seed + i * 3.7, 0.03);
    g.save();
    g.beginPath();
    tracePoly(g, shape);
    g.globalAlpha = p.fillAlpha ?? 1;
    g.fillStyle = p.fill;
    g.fill();
    g.clip();
    for (const s of p.shade ?? []) {
      // wet-in-wet glaze: an irregular bloom with a pooled rim, not an airbrushed gradient
      const k = Math.floor(Math.abs(Math.sin(s.x * 12.9 + s.y * 78.2)) * 6);
      g.globalAlpha = s.alpha;
      const b = tintedBloom(s.color, k);
      const rr = s.r * 1.15;
      g.drawImage(b, s.x - rr, s.y - rr, rr * 2, rr * 2);
    }
    // pigment pooled at the edge of the wash
    g.globalCompositeOperation = 'multiply';
    g.strokeStyle = p.fill;
    g.lineJoin = 'round';
    g.globalAlpha = 0.28;
    g.lineWidth = 9;
    g.beginPath();
    if (p.rim) tracePoly(g, p.rim.pts, p.rim.closed);
    g.stroke();
    g.globalAlpha = 0.35;
    g.lineWidth = 2.5;
    g.stroke();
    g.restore();
  });
  settle(g);
}

/** Lets pigment sink into the paper tooth. Operates on whatever is already painted. */
export function settle(g: CanvasRenderingContext2D, strength = 1) {
  const c = g.canvas;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 0.55 * strength;
  g.fillStyle = g.createPattern(blotchTile(), 'repeat')!;
  g.fillRect(0, 0, c.width, c.height);
  g.globalAlpha = 0.5 * strength;
  g.fillStyle = g.createPattern(grainTile(), 'repeat')!;
  g.fillRect(0, 0, c.width, c.height);
  g.restore();
}

/** Ink drawing with occlusion: each region erases the lines behind it before drawing its own. */
export function paintInk(g: CanvasRenderingContext2D, parts: Part[], opts: { alpha?: number; widthScale?: number; sketch?: boolean } = {}) {
  const ws = opts.widthScale ?? 1;
  parts.forEach((p, i) => {
    if (p.shape && p.fill && !p.seeThrough) {
      g.save();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      tracePoly(g, p.shape);
      g.fill();
      g.restore();
    }
    p.lines.forEach((l, j) => {
      const seed = i * 13 + j * 7 + 1;
      if (opts.sketch && l.w > 1) {
        // a lighter searching line beneath the committed one, as in a real underdrawing
        const drift = wobble(l.pts, 1.8, seed * 3.1, 0.012).map((q) => ({ x: q.x + 1.1, y: q.y - 0.9 }));
        brushLine(g, drift, { width: l.w * 0.45, color: l.color ?? INK, alpha: 0.2 * (opts.alpha ?? 1), closed: l.closed, seed: seed + 5, taper: 0.3, vary: 0.6 });
      }
      brushLine(g, l.pts, { width: l.w * ws, color: l.color ?? INK, alpha: (l.alpha ?? 0.9) * (opts.alpha ?? 1), closed: l.closed, seed, taper: l.closed ? 0.1 : 0.2 });
    });
  });
  // dry, broken quality of a real nib on toothy paper
  const c = g.canvas;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  g.globalAlpha = 0.9;
  g.fillStyle = g.createPattern(grainTile(), 'repeat')!;
  g.fillRect(0, 0, c.width, c.height);
  g.restore();
}

/** Ink over existing pigment on the same canvas (occlusion happens on a separate sheet). */
export function paintInkOver(g: CanvasRenderingContext2D, parts: Part[], opts: { alpha?: number; widthScale?: number } = {}) {
  const sheet = makeCanvas(g.canvas.width, g.canvas.height);
  const sg = ctx2d(sheet);
  sg.setTransform(g.getTransform());
  paintInk(sg, parts, opts);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(sheet, 0, 0);
  g.restore();
}

export function renderPigmentLayer(parts: Part[], box: Box, rs: number, seed = 1): Canvas {
  const { c, g } = layerCanvas(box, rs);
  paintPigment(g, parts, seed);
  return c;
}

export function renderInkLayer(parts: Part[], box: Box, rs: number): Canvas {
  const { c, g } = layerCanvas(box, rs);
  paintInk(g, parts);
  return c;
}
