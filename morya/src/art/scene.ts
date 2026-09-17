// Builds every raster layer of the painting once, in artboard space.
// Supplied artwork (see docs/ART_ASSET_REQUIREMENTS.md) replaces a procedural layer
// when listed in /art/manifest.json.
import { tracePoly } from '../engine/geom';
import { blotchTile, ctx2d, grainTile, makeCanvas, type Canvas } from '../engine/textures';
import { ganeshParts } from './ganesh';
import { FRONT_BOX, GANESH_BOX, ART, HALO, WOMAN_BOX } from './layout';
import { BELLS, ORNAMENTS, type BellPiece, type OrnamentDef } from './ornaments';
import { layerCanvas, paintInk, paintInkOver, paintPigment, type Box } from './render';
import { backParts, frontParts, womanParts } from './surroundings';

export interface Layer {
  canvas: Canvas;
  box: Box;
}
/** The resting (unburnished) look of one ornament, laid over the colour until it is found. */
export interface OrnamentLayer extends Layer {
  def: OrnamentDef;
}
export interface Scene {
  rs: number;
  ganeshColor: Layer;
  ganeshInk: Layer;
  back: Layer;
  front: Layer;
  woman: Layer;
  ornaments: OrnamentLayer[];
}

type Manifest = { layers?: Record<string, string> };

const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 0));

async function loadManifest(): Promise<Manifest> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}art/manifest.json`, { cache: 'no-cache' });
    if (!res.ok) return {};
    return (await res.json()) as Manifest;
  } catch {
    return {};
  }
}

/** Draws supplied artwork into a layer; null if it is missing or fails to decode. */
async function supplied(manifest: Manifest, key: string, box: Box, rs: number): Promise<Canvas | null> {
  const file = manifest.layers?.[key];
  if (!file) return null;
  try {
    const img = new Image();
    img.src = `${import.meta.env.BASE_URL}art/${file}`;
    await img.decode();
    const c = makeCanvas(box.w * rs, box.h * rs);
    const g = ctx2d(c);
    // supplied layers are authored for the full artboard; crop to this layer's box
    const kx = img.naturalWidth / ART.w, ky = img.naturalHeight / ART.h;
    g.drawImage(img, box.x * kx, box.y * ky, box.w * kx, box.h * ky, 0, 0, c.width, c.height);
    return c;
  } catch {
    console.info(`[morya] supplied layer "${key}" unavailable, using the painted fallback`);
    return null;
  }
}

// ───────────────────────── backdrop ─────────────────────────

/** Binary dilation (max) or erosion (min) with a square window, via running counts. */
function morph(src: Uint8Array, w: number, h: number, r: number, max: boolean): Uint8Array {
  if (!max) return morph(src.map((v) => 1 - v), w, h, r, true).map((v) => 1 - v);
  const pass = (inp: Uint8Array, horizontal: boolean) => {
    const out = new Uint8Array(inp.length);
    const n = horizontal ? w : h, m = horizontal ? h : w;
    for (let j = 0; j < m; j++) {
      const at = (i: number) => (horizontal ? j * w + i : i * w + j);
      let count = 0;
      for (let i = 0; i < Math.min(r, n); i++) count += inp[at(i)];
      for (let i = 0; i < n; i++) {
        if (i + r < n) count += inp[at(i + r)];
        if (i - r - 1 >= 0) count -= inp[at(i - r - 1)];
        out[at(i)] = count > 0 ? 1 : 0;
      }
    }
    return out;
  };
  return pass(pass(src, true), false);
}

/**
 * The supplied surroundings were painted around a smaller Ganesh ji of their own.
 * Wherever the master figure's silhouette (closed over its concavities) would sit, that
 * figure is replaced by the niche wall, carried in from either side of it,
 * so nothing of it can ghost between his arms, halo and seat.
 */
function cleanBackdrop(back: Canvas, figure: Canvas[]) {
  const U = 4; // artboard units per cell
  const w = ART.w / U, h = ART.h / U;
  const probe = makeCanvas(w, h);
  const pg = probe.getContext('2d', { willReadFrequently: true })!;
  for (const f of figure) pg.drawImage(f, GANESH_BOX.x / U, GANESH_BOX.y / U, GANESH_BOX.w / U, GANESH_BOX.h / U);
  const alpha = pg.getImageData(0, 0, w, h).data;
  let body: Uint8Array = new Uint8Array(w * h);
  for (let i = 0; i < body.length; i++) body[i] = alpha[i * 4 + 3] > 28 ? 1 : 0;
  body = morph(morph(body, w, h, 9, true), w, h, 9, false);
  const hr = 214 / U; // the hidden figure's own halo lies within this
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (Math.hypot(x + 0.5 - HALO.x / U, y + 0.5 - HALO.y / U) < hr) body[y * w + x] = 1;
  }
  // only the plain niche wall between the pillars and above the altar cloth is ever rebuilt
  const nx0 = Math.ceil(232 / U), nx1 = Math.floor(768 / U), ny1 = Math.floor(1128 / U);
  const inNiche = (x: number, y: number) => x >= nx0 && x <= nx1 && y <= ny1;
  const hole = morph(body, w, h, 2, true).map((v, i) => (v && inNiche(i % w, (i / w) | 0) ? 1 : 0));
  const avoid = morph(hole, w, h, 2, true);

  pg.clearRect(0, 0, w, h);
  pg.drawImage(back, 0, 0, w, h);
  const src = pg.getImageData(0, 0, w, h).data;
  // the wall's tone for each row: the median of the open plaster in that row (vines and chains fall out)
  const rowTone: (number[] | null)[] = [];
  for (let y = 0; y <= ny1; y++) {
    const ch: number[][] = [[], [], []];
    for (let x = nx0; x <= nx1; x++) {
      if (avoid[y * w + x]) continue;
      for (let q = 0; q < 3; q++) ch[q].push(src[(y * w + x) * 4 + q]);
    }
    rowTone.push(ch[0].length >= 6 ? ch.map((v) => v.sort((p, q) => p - q)[v.length >> 1]) : null);
  }
  for (let y = 0; y <= ny1; y++) {
    if (rowTone[y]) continue;
    let d = 1;
    while (d <= ny1 && !rowTone[y - d] && !rowTone[y + d]) d++;
    rowTone[y] = rowTone[y - d] ?? rowTone[y + d] ?? [236, 224, 204];
  }
  const blurred = new Float32Array(w * h * 3);
  const R = 10;
  for (let y = 0; y <= ny1; y++) {
    const acc = [0, 0, 0];
    let n = 0;
    for (let dy = -R; dy <= R; dy++) {
      const t = rowTone[Math.min(ny1, Math.max(0, y + dy))]!;
      for (let q = 0; q < 3; q++) acc[q] += t[q];
      n++;
    }
    for (let x = 0; x < w; x++) for (let q = 0; q < 3; q++) blurred[(y * w + x) * 3 + q] = acc[q] / n;
  }

  const patch = pg.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      s += hole[yy * w + xx];
      n++;
    }
    const i = y * w + x;
    patch.data[i * 4] = blurred[i * 3];
    patch.data[i * 4 + 1] = blurred[i * 3 + 1];
    patch.data[i * 4 + 2] = blurred[i * 3 + 2];
    patch.data[i * 4 + 3] = (s / n) * 255;
  }
  pg.clearRect(0, 0, w, h);
  pg.putImageData(patch, 0, 0);

  // lift to full resolution with the plaster's own mottling and tooth
  const hi = makeCanvas(back.width, back.height);
  const hg = ctx2d(hi);
  hg.imageSmoothingQuality = 'high';
  hg.drawImage(probe, 0, 0, hi.width, hi.height);
  hg.globalCompositeOperation = 'source-atop';
  hg.globalAlpha = 0.22;
  hg.fillStyle = hg.createPattern(blotchTile(), 'repeat')!;
  hg.fillRect(0, 0, hi.width, hi.height);
  hg.globalAlpha = 0.18;
  hg.fillStyle = hg.createPattern(grainTile(), 'repeat')!;
  hg.fillRect(0, 0, hi.width, hi.height);
  ctx2d(back).drawImage(hi, 0, 0);
}

// ───────────────────────── resting gold ─────────────────────────

const band = (v: number, a0: number, a1: number, b0: number, b1: number) =>
  v <= a0 || v >= b1 ? 0 : v < a1 ? (v - a0) / (a1 - a0) : v > b0 ? (b1 - v) / (b1 - b0) : 1;

/** The ornament's pixels as they look before they are found: gold unburnished, tilak only a trace. */
function restingLayer(def: OrnamentDef, colour: Canvas, rs: number): Canvas | null {
  if (!def.key) return null;
  const { c, g } = layerCanvas(def.box, rs);
  g.drawImage(colour, GANESH_BOX.x, GANESH_BOX.y, GANESH_BOX.w, GANESH_BOX.h);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gr = d[i + 1], b = d[i + 2];
    const max = Math.max(r, gr, b), min = Math.min(r, gr, b);
    const s = max ? (max - min) / max : 0, v = max / 255;
    let hue = 0;
    if (max !== min) {
      if (max === r) hue = (60 * (gr - b)) / (max - min);
      else if (max === gr) hue = 60 * (2 + (b - r) / (max - min));
      else hue = 60 * (4 + (r - gr) / (max - min));
      if (hue < 0) hue += 360;
    }
    const lum = 0.3 * r + 0.59 * gr + 0.11 * b;
    let k: number;
    if (def.key === 'gold') {
      k = band(hue, 32, 37, 52, 57) * band(s, 0.2, 0.28, 0.6, 0.74) * band(v, 0.4, 0.55, 1.01, 1.02);
      // matte, slightly cooler ochre: the leaf is there but has not caught the light
      d[i] = Math.min(255, lum * 1.02);
      d[i + 1] = lum * 0.94;
      d[i + 2] = lum * 0.8;
      k *= 0.68;
    } else {
      const redHue = Math.min(hue, 360 - hue);
      k = band(redHue, -1, 0, 22, 34) * band(s, 0.25, 0.4, 1.01, 1.02);
      d[i] = 240;
      d[i + 1] = 226;
      d[i + 2] = 206;
      k *= 0.8;
    }
    d[i + 3] = d[i + 3] * k;
  }
  g.putImageData(img, 0, 0);
  const shape = makeCanvas(c.width, c.height);
  const sg = ctx2d(shape);
  sg.setTransform(rs, 0, 0, rs, -def.box.x * rs, -def.box.y * rs);
  sg.fillStyle = '#000';
  def.region(sg);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(shape, 0, 0);
  return c;
}

// ───────────────────────── seat bells ─────────────────────────

export interface BellSprite {
  piece: BellPiece;
  box: Box;
  colour: Canvas;
  ink: Canvas;
}

function piecePath(g: CanvasRenderingContext2D, p: BellPiece) {
  g.beginPath();
  tracePoly(g, p.shape);
}

/** Lifts one side's hanging bells out of the painting so they can swing. */
export function liftBells(scene: Scene, side: 'left' | 'right'): BellSprite[] {
  const rs = scene.rs;
  return BELLS[side].map((piece) => {
    const xs = piece.shape.map((q) => q.x), ys = piece.shape.map((q) => q.y);
    const box = { x: Math.min(...xs) - 1, y: Math.min(...ys) - 1, w: Math.max(...xs) - Math.min(...xs) + 2, h: Math.max(...ys) - Math.min(...ys) + 2 };
    const lift = (src: Canvas) => {
      const { c, g } = layerCanvas(box, rs);
      piecePath(g, piece);
      g.clip();
      g.drawImage(src, GANESH_BOX.x, GANESH_BOX.y, GANESH_BOX.w, GANESH_BOX.h);
      return c;
    };
    const sprite = { piece, box, colour: lift(scene.ganeshColor.canvas), ink: lift(scene.ganeshInk.canvas) };
    for (const target of [scene.ganeshColor.canvas, scene.ganeshInk.canvas]) {
      const g = ctx2d(target);
      g.save();
      g.setTransform(rs, 0, 0, rs, -GANESH_BOX.x * rs, -GANESH_BOX.y * rs);
      g.globalCompositeOperation = 'destination-out';
      piecePath(g, piece);
      g.fill();
      g.restore();
    }
    return sprite;
  });
}

/** Returns lifted bells to the painting, exactly where they were. */
export function settleBells(scene: Scene, sprites: BellSprite[]) {
  const rs = scene.rs;
  for (const s of sprites) {
    for (const [target, src] of [[scene.ganeshColor.canvas, s.colour], [scene.ganeshInk.canvas, s.ink]] as const) {
      const g = ctx2d(target);
      g.save();
      g.setTransform(rs, 0, 0, rs, -GANESH_BOX.x * rs, -GANESH_BOX.y * rs);
      g.drawImage(src, s.box.x, s.box.y, s.box.w, s.box.h);
      g.restore();
    }
  }
}

// ───────────────────────── build ─────────────────────────

export async function buildScene(rs: number, onGanesh?: () => void): Promise<Scene> {
  const manifest = await loadManifest();

  const gParts = ganeshParts();
  const colorC = (await supplied(manifest, 'ganesh-color', GANESH_BOX, rs)) ?? (() => {
    const { c, g } = layerCanvas(GANESH_BOX, rs);
    paintPigment(g, gParts, 1);
    return c;
  })();
  await yieldFrame();
  const inkC = (await supplied(manifest, 'ganesh-line', GANESH_BOX, rs)) ?? (() => {
    const { c, g } = layerCanvas(GANESH_BOX, rs);
    paintInk(g, gParts, { sketch: true });
    return c;
  })();
  onGanesh?.();
  await yieldFrame();

  const ornaments: OrnamentLayer[] = [];
  for (const def of ORNAMENTS) {
    const canvas = restingLayer(def, colorC, rs);
    ornaments.push({ def, canvas: canvas ?? makeCanvas(1, 1), box: def.box });
    await yieldFrame();
  }

  const backRs = rs * 0.7;
  const tb = performance.now();
  const backSupplied = await supplied(manifest, 'surroundings', ART, backRs);
  const tc = performance.now();
  let backC: Canvas;
  if (backSupplied) {
    cleanBackdrop(backSupplied, [colorC, inkC]);
    if (import.meta.env.DEV) console.log('[morya] backdrop decode', Math.round(tc - tb), 'ms, clean', Math.round(performance.now() - tc), 'ms');
    backC = backSupplied;
  } else {
    const { c, g } = layerCanvas(ART, backRs);
    const parts = backParts();
    paintPigment(g, parts, 3);
    paintInkOver(g, parts, { alpha: 0.9 });
    backC = c;
  }
  await yieldFrame();

  const frontC = (await supplied(manifest, 'foreground', FRONT_BOX, rs)) ?? (() => {
    const { c, g } = layerCanvas(FRONT_BOX, rs);
    const parts = frontParts();
    paintPigment(g, parts, 5);
    paintInkOver(g, parts);
    return c;
  })();
  await yieldFrame();

  // A supplied painted figure of her replaces the placeholder.
  const womanC = (await supplied(manifest, 'woman', WOMAN_BOX, rs)) ?? (() => {
    const { c, g } = layerCanvas(WOMAN_BOX, rs);
    const parts = womanParts();
    paintPigment(g, parts, 9);
    paintInkOver(g, parts);
    return c;
  })();

  return {
    rs,
    ganeshColor: { canvas: colorC, box: GANESH_BOX },
    ganeshInk: { canvas: inkC, box: GANESH_BOX },
    back: { canvas: backC, box: ART },
    front: { canvas: frontC, box: FRONT_BOX },
    woman: { canvas: womanC, box: WOMAN_BOX },
    ornaments,
  };
}
