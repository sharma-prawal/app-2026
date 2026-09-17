// Small vector toolkit: an absolute-command SVG path parser, samplers and
// a calligraphic (variable width) stroke renderer used by every drawn line.

export type Pt = { x: number; y: number };
type Cmd = { c: 'M' | 'L' | 'C' | 'Q' | 'Z'; p: number[] };

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t: number) => {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1D value noise in [-1, 1]. */
export function noise1(x: number, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => {
    const s = Math.sin((n + seed * 57.13) * 127.1) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

/** Smooth 2D value noise in [0, 1]. */
export function noise2(x: number, y: number, seed = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const h = (a: number, b: number) => {
    const s = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export function parse(d: string): Cmd[] {
  const tokens = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const out: Cmd[] = [];
  let cur: Cmd | null = null;
  const arity: Record<string, number> = { M: 2, L: 2, C: 6, Q: 4, Z: 0 };
  for (const t of tokens) {
    if (/[MLCQZ]/i.test(t)) {
      cur = { c: t.toUpperCase() as Cmd['c'], p: [] };
      out.push(cur);
    } else if (cur) {
      // implicit repetition of the previous command
      if (cur.p.length === arity[cur.c] && arity[cur.c] > 0) {
        cur = { c: cur.c === 'M' ? 'L' : cur.c, p: [] };
        out.push(cur);
      }
      cur.p.push(parseFloat(t));
    }
  }
  return out;
}

/** Samples a path into polylines (one per subpath). */
export function sample(d: string, step = 3): { pts: Pt[]; closed: boolean }[] {
  const res: { pts: Pt[]; closed: boolean }[] = [];
  let pts: Pt[] = [];
  let x = 0, y = 0, sx = 0, sy = 0;
  const flush = (closed: boolean) => {
    if (pts.length > 1) res.push({ pts, closed });
    pts = [];
  };
  for (const { c, p } of parse(d)) {
    if (c === 'M') {
      flush(false);
      x = sx = p[0];
      y = sy = p[1];
      pts.push({ x, y });
    } else if (c === 'L') {
      const n = Math.max(1, Math.ceil(Math.hypot(p[0] - x, p[1] - y) / step));
      for (let i = 1; i <= n; i++) pts.push({ x: lerp(x, p[0], i / n), y: lerp(y, p[1], i / n) });
      x = p[0];
      y = p[1];
    } else if (c === 'C' || c === 'Q') {
      const cp = c === 'Q'
        ? [x + (2 / 3) * (p[0] - x), y + (2 / 3) * (p[1] - y), p[2] + (2 / 3) * (p[0] - p[2]), p[3] + (2 / 3) * (p[1] - p[3]), p[2], p[3]]
        : p;
      const approx = Math.hypot(cp[0] - x, cp[1] - y) + Math.hypot(cp[2] - cp[0], cp[3] - cp[1]) + Math.hypot(cp[4] - cp[2], cp[5] - cp[3]);
      const n = Math.max(2, Math.ceil(approx / step));
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        pts.push({
          x: u * u * u * x + 3 * u * u * t * cp[0] + 3 * u * t * t * cp[2] + t * t * t * cp[4],
          y: u * u * u * y + 3 * u * u * t * cp[1] + 3 * u * t * t * cp[3] + t * t * t * cp[5],
        });
      }
      x = cp[4];
      y = cp[5];
    } else if (c === 'Z') {
      if (Math.hypot(sx - x, sy - y) > 0.5) pts.push({ x: sx, y: sy });
      x = sx;
      y = sy;
      flush(true);
    }
  }
  flush(false);
  return res;
}

/** Transforms every coordinate pair of a path string. */
export function mapPath(d: string, fn: (x: number, y: number) => [number, number]) {
  return parse(d)
    .map(({ c, p }) => {
      const q: number[] = [];
      for (let i = 0; i < p.length; i += 2) q.push(...fn(p[i], p[i + 1]));
      return c + q.map((v) => +v.toFixed(2)).join(' ');
    })
    .join(' ');
}
export const mirror = (d: string, cx = 500) => mapPath(d, (x, y) => [2 * cx - x, y]);

export function polyLength(pts: Pt[]) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return L;
}

export function tracePoly(ctx: CanvasRenderingContext2D | Path2D, pts: Pt[], close = true) {
  if (!pts.length) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (close) ctx.closePath();
}

/** Displaces a polyline by low-frequency noise so fills never look machine-cut. */
export function wobble(pts: Pt[], amp: number, seed: number, freq = 0.02): Pt[] {
  let s = 0;
  return pts.map((p, i) => {
    if (i) s += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    return { x: p.x + noise1(s * freq, seed) * amp, y: p.y + noise1(s * freq, seed + 9.1) * amp };
  });
}

/** Outline polygon of a tapering tube around a centerline. */
export function tubeOutline(center: Pt[], w0: number, w1: number, profile?: (t: number) => number): Pt[] {
  const L = polyLength(center) || 1;
  const left: Pt[] = [];
  const right: Pt[] = [];
  let s = 0;
  for (let i = 0; i < center.length; i++) {
    const a = center[Math.max(0, i - 1)];
    const b = center[Math.min(center.length - 1, i + 1)];
    if (i) s += Math.hypot(center[i].x - center[i - 1].x, center[i].y - center[i - 1].y);
    const t = s / L;
    const w = (lerp(w0, w1, t) * (profile ? profile(t) : 1)) / 2;
    let nx = -(b.y - a.y), ny = b.x - a.x;
    const n = Math.hypot(nx, ny) || 1;
    nx /= n;
    ny /= n;
    left.push({ x: center[i].x + nx * w, y: center[i].y + ny * w });
    right.push({ x: center[i].x - nx * w, y: center[i].y - ny * w });
  }
  return [...left, ...right.reverse()];
}

export interface BrushOpts {
  width: number;
  color: string;
  alpha?: number;
  /** fraction of length over which each end tapers */
  taper?: number;
  /** relative width variation along the line */
  vary?: number;
  seed?: number;
  closed?: boolean;
  /** 0..1, draw only the first fraction of the line */
  upto?: number;
}

/** Draws a filled, variable-width, tapered stroke along a polyline. */
export function brushLine(ctx: CanvasRenderingContext2D, pts: Pt[], o: BrushOpts) {
  if (pts.length < 2) return;
  const taper = o.taper ?? 0.18;
  const vary = o.vary ?? 0.35;
  const seed = o.seed ?? 1;
  const L = polyLength(pts);
  const limit = L * (o.upto ?? 1);
  const left: Pt[] = [];
  const right: Pt[] = [];
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (s > limit && i > 1) break;
    const t = s / (L || 1);
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b.y - a.y), ny = b.x - a.x;
    const n = Math.hypot(nx, ny) || 1;
    nx /= n;
    ny /= n;
    const ends = o.closed ? 1 : Math.min(smooth(t / taper), smooth((1 - t) / taper));
    const w = (o.width / 2) * (0.25 + 0.75 * ends) * (1 + vary * noise1(s * 0.03, seed));
    left.push({ x: pts[i].x + nx * w, y: pts[i].y + ny * w });
    right.push({ x: pts[i].x - nx * w, y: pts[i].y - ny * w });
  }
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.fillStyle = o.color;
  ctx.beginPath();
  tracePoly(ctx, [...left, ...right.reverse()]);
  ctx.fill();
  ctx.restore();
}
