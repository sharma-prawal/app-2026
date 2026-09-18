// Reveal masks in artboard space. Brush stamps accumulate directly; watercolour
// drops grow ("bloom"), stay wet for a while, then dry into the permanent mask.
import type { Box } from '../art/render';
import { easeOut } from './geom';
import { ctx2d, makeCanvas, type Canvas } from './textures';

export interface Drop {
  x: number;
  y: number;
  r0: number;
  r1: number;
  t0: number;
  dur: number;
  k: number;
  rot: number;
  alpha: number;
}

const GRID_W = 36;

export class RevealMask {
  readonly box: Box;
  readonly scale: number;
  readonly dry: Canvas;
  readonly live: Canvas;
  readonly rimDry: Canvas | null;
  readonly rimLive: Canvas | null;
  private dg: CanvasRenderingContext2D;
  private lg: CanvasRenderingContext2D;
  drops: Drop[] = [];
  full = false;
  dirty = true;
  private probe: Canvas;
  private pg: CanvasRenderingContext2D;
  private keys: Uint8Array | null = null;
  private keyCount = 0;
  private covered: Uint8Array;
  readonly gw: number;
  readonly gh: number;

  constructor(box: Box, scale: number, withRims = false) {
    this.box = box;
    this.scale = scale;
    this.dry = makeCanvas(box.w * scale, box.h * scale);
    this.live = makeCanvas(box.w * scale, box.h * scale);
    this.dg = ctx2d(this.dry);
    this.lg = ctx2d(this.live);
    this.rimDry = withRims ? makeCanvas(box.w * scale, box.h * scale) : null;
    this.rimLive = withRims ? makeCanvas(box.w * scale, box.h * scale) : null;
    this.gw = GRID_W;
    this.gh = Math.max(1, Math.round((GRID_W * box.h) / box.w));
    this.covered = new Uint8Array(this.gw * this.gh);
    this.probe = makeCanvas(this.gw, this.gh);
    this.pg = this.probe.getContext('2d', { willReadFrequently: true })!;
  }

  clear() {
    for (const c of [this.dry, this.live, this.rimDry, this.rimLive]) if (c) ctx2d(c).clearRect(0, 0, c.width, c.height);
    this.drops = [];
    this.full = false;
    this.dirty = true;
    this.covered.fill(0);
  }

  /** Stamps into the permanent mask. x, y, r in artboard units. */
  stamp(img: Canvas, x: number, y: number, r: number, rot: number, alpha: number, target: CanvasRenderingContext2D = this.dg) {
    const s = this.scale;
    target.save();
    target.globalAlpha = alpha;
    target.translate((x - this.box.x) * s, (y - this.box.y) * s);
    target.rotate(rot);
    target.drawImage(img, -r * s, -r * s, r * 2 * s, r * 2 * s);
    target.restore();
    this.dirty = true;
  }

  private scratch: Canvas | null = null;

  /** Stamps only where `clip` (same box and scale as this mask) carries weight. */
  stampClipped(img: Canvas, x: number, y: number, r: number, rot: number, alpha: number, clip: Canvas) {
    const s = this.scale;
    this.scratch ??= makeCanvas(this.dry.width, this.dry.height);
    const sg = ctx2d(this.scratch);
    const px = Math.floor((x - r - this.box.x) * s) - 2, py = Math.floor((y - r - this.box.y) * s) - 2;
    const size = Math.ceil(r * 2 * s) + 4;
    sg.clearRect(px, py, size, size);
    this.stamp(img, x, y, r, rot, alpha, sg);
    sg.globalCompositeOperation = 'destination-in';
    sg.drawImage(clip, px, py, size, size, px, py, size, size);
    sg.globalCompositeOperation = 'source-over';
    this.dg.drawImage(this.scratch, px, py, size, size, px, py, size, size);
    this.dirty = true;
  }

  addDrop(d: Drop) {
    this.drops.push(d);
    this.dirty = true;
  }

  /** Advances wet drops; returns true while anything is still wet. */
  update(now: number, blooms: Canvas[], rims: Canvas[] | null) {
    if (!this.drops.length && !this.dirty) return false;
    const still: Drop[] = [];
    for (const d of this.drops) {
      if (now - d.t0 >= d.dur) {
        this.stamp(blooms[d.k % blooms.length], d.x, d.y, d.r1, d.rot, d.alpha);
        if (rims && this.rimDry) this.stamp(rims[d.k % rims.length], d.x, d.y, d.r1, d.rot, 0.45, ctx2d(this.rimDry));
      } else still.push(d);
    }
    this.drops = still;
    // live = dry + growing drops
    const s = this.scale;
    this.lg.clearRect(0, 0, this.live.width, this.live.height);
    this.lg.drawImage(this.dry, 0, 0);
    const rg = this.rimLive ? ctx2d(this.rimLive) : null;
    if (rg && this.rimDry) {
      rg.clearRect(0, 0, this.rimLive!.width, this.rimLive!.height);
      rg.drawImage(this.rimDry, 0, 0);
    }
    for (const d of this.drops) {
      if (now < d.t0) continue;
      const p = easeOut((now - d.t0) / d.dur);
      const r = d.r0 + (d.r1 - d.r0) * p;
      this.lg.save();
      this.lg.globalAlpha = d.alpha * Math.min(1, 0.35 + p);
      this.lg.translate((d.x - this.box.x) * s, (d.y - this.box.y) * s);
      this.lg.rotate(d.rot);
      this.lg.drawImage(blooms[d.k % blooms.length], -r * s, -r * s, r * 2 * s, r * 2 * s);
      this.lg.restore();
      if (rg && rims) {
        // a wet edge is darker than a dry one
        rg.save();
        rg.globalAlpha = 0.9 - p * 0.45;
        rg.translate((d.x - this.box.x) * s, (d.y - this.box.y) * s);
        rg.rotate(d.rot);
        rg.drawImage(rims[d.k % rims.length], -r * s, -r * s, r * 2 * s, r * 2 * s);
        rg.restore();
      }
    }
    this.dirty = false;
    return this.drops.length > 0;
  }

  /** Marks which grid cells carry artwork, from the layer's alpha. */
  setKeys(layer: Canvas) {
    const g = this.pg;
    g.clearRect(0, 0, this.gw, this.gh);
    g.drawImage(layer, 0, 0, this.gw, this.gh);
    const d = g.getImageData(0, 0, this.gw, this.gh).data;
    this.keys = new Uint8Array(this.gw * this.gh);
    this.covered.fill(0);
    this.keyCount = 0;
    for (let i = 0; i < this.keys.length; i++) {
      if (d[i * 4 + 3] > 24) {
        this.keys[i] = 1;
        this.keyCount++;
      }
    }
  }

  /** Marks unique artwork-bearing cells for completion, independently of the visual mask. */
  markCoverage(x: number, y: number, r: number) {
    const cw = this.box.w / this.gw, ch = this.box.h / this.gh;
    const x0 = Math.max(0, Math.floor((x - r - this.box.x) / cw));
    const x1 = Math.min(this.gw - 1, Math.floor((x + r - this.box.x) / cw));
    const y0 = Math.max(0, Math.floor((y - r - this.box.y) / ch));
    const y1 = Math.min(this.gh - 1, Math.floor((y + r - this.box.y) / ch));
    const rr = r * r;
    for (let cy = y0; cy <= y1; cy++) {
      const py = this.box.y + (cy + 0.5) * ch;
      for (let cx = x0; cx <= x1; cx++) {
        const i = cy * this.gw + cx;
        if (this.keys && !this.keys[i]) continue;
        const px = this.box.x + (cx + 0.5) * cw;
        if ((px - x) ** 2 + (py - y) ** 2 <= rr) this.covered[i] = 1;
      }
    }
  }

  /** Fraction of unique artwork-bearing cells touched by the logical brush. */
  progress() {
    if (this.full) return 1;
    let hit = 0;
    for (let i = 0; i < this.covered.length; i++) {
      if (this.keys && !this.keys[i]) continue;
      hit += this.covered[i];
    }
    const total = this.keys ? this.keyCount : this.covered.length;
    return total ? hit / total : 1;
  }

  /** Fraction of meaningful cells that are revealed, and a list of those still hidden. */
  coverage(): { value: number; missing: { x: number; y: number }[] } {
    if (this.full) return { value: 1, missing: [] };
    const g = this.pg;
    g.clearRect(0, 0, this.gw, this.gh);
    g.drawImage(this.live, 0, 0, this.gw, this.gh);
    const d = g.getImageData(0, 0, this.gw, this.gh).data;
    let hit = 0;
    const missing: { x: number; y: number }[] = [];
    for (let i = 0; i < this.gw * this.gh; i++) {
      if (this.keys && !this.keys[i]) continue;
      if (d[i * 4 + 3] > 90) hit++;
      else {
        const cx = i % this.gw, cy = Math.floor(i / this.gw);
        missing.push({ x: this.box.x + ((cx + 0.5) / this.gw) * this.box.w, y: this.box.y + ((cy + 0.5) / this.gh) * this.box.h });
      }
    }
    const total = this.keys ? this.keyCount : this.gw * this.gh;
    return { value: total ? hit / total : 1, missing };
  }

  /** Coverage within a circle, for moments tied to a specific place (the eyes). */
  coverageAt(x: number, y: number, r: number) {
    const s = this.scale;
    const size = Math.max(2, Math.round(r * 2 * s));
    const g = this.pg;
    g.clearRect(0, 0, this.gw, this.gh);
    const n = Math.min(this.gw, this.gh, 8);
    g.drawImage(this.live, (x - r - this.box.x) * s, (y - r - this.box.y) * s, size, size, 0, 0, n, n);
    const d = g.getImageData(0, 0, n, n).data;
    let sum = 0;
    for (let i = 0; i < n * n; i++) sum += d[i * 4 + 3];
    return sum / (n * n * 255);
  }

  fill() {
    this.dg.fillStyle = '#000';
    this.dg.fillRect(0, 0, this.dry.width, this.dry.height);
    this.drops = [];
    this.full = true;
    this.dirty = true;
  }
}
