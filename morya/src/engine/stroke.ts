// Her one stroke: captured as vector samples, kept locally, and later placed
// into the painting as a golden thread without changing its shape.
import type { Box } from '../art/render';
import { clamp, smooth as smoothstep, type Pt } from './geom';

export interface StrokePoint {
  x: number;
  y: number;
  /** relative width 0..1 derived from speed and pressure */
  w: number;
}

const KEY = 'morya.stroke.v1';

export function loadStroke(): StrokePoint[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { points?: number[][] };
    const pts = (data.points ?? []).filter((p) => p.length >= 3 && p.every(Number.isFinite)).map(([x, y, w]) => ({ x, y, w }));
    return pts.length > 1 ? pts : null;
  } catch {
    return null;
  }
}

export function saveStroke(points: StrokePoint[]) {
  try {
    const compact = points.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, Math.round(p.w * 100) / 100]);
    localStorage.setItem(KEY, JSON.stringify({ v: 1, points: compact }));
  } catch {
    /* private mode: the stroke still lives for this sitting */
  }
}

export function strokeLength(pts: Pt[]) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return L;
}

/** Uniformly scales and centres a stroke into a zone. Shape and proportions are preserved. */
export function placeStroke(points: StrokePoint[], zone: Box): { points: StrokePoint[]; scale: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
  const s = clamp(Math.min(zone.w / bw, zone.h / bh), 0.15, 2.4);
  const cx = zone.x + zone.w / 2, cy = zone.y + zone.h / 2;
  const mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
  return { points: points.map((p) => ({ x: cx + (p.x - mx) * s, y: cy + (p.y - my) * s, w: p.w })), scale: s };
}

/**
 * Places her stroke between her offering and his seat, by uniform scale and translation only.
 * Its first point (or last, whichever way the line naturally travels toward him) is set at `from`;
 * the scale brings the other end as near `toward` as the shape allows, within `bounds`.
 * Every bend and irregularity of the original is kept.
 */
export function anchorStroke(points: StrokePoint[], from: Pt, toward: Pt, zone: Box, bounds: Box): StrokePoint[] {
  const aim = { x: toward.x - from.x, y: toward.y - from.y };
  const alignment = (pts: StrokePoint[]) => {
    const v = { x: pts[pts.length - 1].x - pts[0].x, y: pts[pts.length - 1].y - pts[0].y };
    const n = Math.hypot(v.x, v.y) * Math.hypot(aim.x, aim.y);
    return n ? (v.x * aim.x + v.y * aim.y) / n : -1;
  };
  const reversed = [...points].reverse();
  const pts = alignment(reversed) > alignment(points) ? reversed : points;
  const fit = placeStroke(pts, zone).scale;
  const first = pts[0], last = pts[pts.length - 1];
  const v = { x: last.x - first.x, y: last.y - first.y };
  const vv = v.x * v.x + v.y * v.y;
  let s = vv > 1 && v.x * aim.x + v.y * aim.y > 0 ? clamp((v.x * aim.x + v.y * aim.y) / vv, fit * 0.6, fit * 1.5) : fit;
  const place = (k: number) => pts.map((p) => ({ x: from.x + (p.x - first.x) * k, y: from.y + (p.y - first.y) * k, w: p.w }));
  let out = place(s);
  for (let i = 0; i < 30; i++) {
    const inside = out.every((p) => p.x >= bounds.x && p.x <= bounds.x + bounds.w && p.y >= bounds.y && p.y <= bounds.y + bounds.h);
    if (inside) break;
    s *= 0.9;
    out = place(s);
  }
  return out;
}

/** Smooths raw samples with a light moving average, keeping endpoints. */
export function smoothStroke(points: StrokePoint[]): StrokePoint[] {
  if (points.length < 4) return points;
  const out: StrokePoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    out.push({ x: (a.x + b.x * 2 + c.x) / 4, y: (a.y + b.y * 2 + c.y) / 4, w: (a.w + b.w * 2 + c.w) / 4 });
  }
  out.push(points[points.length - 1]);
  return out;
}

/**
 * Draws a ribbon along the stroke with its recorded widths.
 * `upto` in 0..1 draws only the first part (for the thread being drawn in).
 */
export function drawRibbon(g: CanvasRenderingContext2D, pts: StrokePoint[], baseWidth: number, fill: string | CanvasGradient, upto = 1, ends = 0) {
  if (pts.length < 2) {
    if (pts.length === 1) {
      g.fillStyle = fill;
      g.beginPath();
      g.arc(pts[0].x, pts[0].y, baseWidth * 0.5, 0, Math.PI * 2);
      g.fill();
    }
    return;
  }
  const n = Math.max(2, Math.floor(pts.length * clamp(upto)));
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b.y - a.y), ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const t = i / (pts.length - 1);
    // `ends`: fraction of the length over which both ends draw out to a fine point
    const taper = ends > 0 ? 0.08 + 0.92 * smoothstep(Math.min(t, 1 - t) / ends) : Math.min(1, t * 8, (1 - t) * 6 + 0.15);
    const w = baseWidth * (0.35 + pts[i].w * 0.65) * (0.3 + 0.7 * taper) * 0.5;
    left.push({ x: pts[i].x + nx * w, y: pts[i].y + ny * w });
    right.push({ x: pts[i].x - nx * w, y: pts[i].y - ny * w });
  }
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(left[0].x, left[0].y);
  for (const p of left) g.lineTo(p.x, p.y);
  for (let i = right.length - 1; i >= 0; i--) g.lineTo(right[i].x, right[i].y);
  g.closePath();
  g.fill();
}
