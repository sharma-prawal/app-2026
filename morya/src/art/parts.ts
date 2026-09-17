import { sample, tubeOutline, type Pt } from '../engine/geom';

export const INK = '#4a2e1f';

export interface Line {
  pts: Pt[];
  w: number;
  closed?: boolean;
  color?: string;
  alpha?: number;
  taper?: number;
}

export interface Shade {
  x: number;
  y: number;
  r: number;
  color: string;
  alpha: number;
}

export interface Part {
  id: string;
  /** closed region used for pigment and for occluding lines behind it */
  shape?: Pt[];
  fill?: string;
  fillAlpha?: number;
  /** watercolor glaze toward this colour inside the region */
  shade?: Shade[];
  /** skip line occlusion (e.g. translucent veils) */
  seeThrough?: boolean;
  /** the inked silhouette, where pigment pools */
  rim?: { pts: Pt[]; closed: boolean };
  lines: Line[];
}

export interface RegionOpts {
  w?: number;
  details?: (string | [string, number])[];
  detailW?: number;
  shade?: Shade[];
  fillAlpha?: number;
  lineColor?: string;
  noOutline?: boolean;
  seeThrough?: boolean;
}

const lineColorOr = (o: RegionOpts) => o.lineColor;

function detailLines(o: RegionOpts): Line[] {
  const out: Line[] = [];
  for (const d of o.details ?? []) {
    const [path, w] = typeof d === 'string' ? [d, o.detailW ?? (o.w ?? 2.6) * 0.7] : d;
    for (const s of sample(path, 2.5)) out.push({ pts: s.pts, w, closed: s.closed, color: lineColorOr(o) });
  }
  return out;
}

/** A closed painted region with its ink outline. */
export function region(id: string, d: string, fill: string | undefined, o: RegionOpts = {}): Part {
  const subs = sample(d, 2.5);
  const shape = subs[0]?.pts;
  const lines: Line[] = o.noOutline
    ? []
    : subs.map((s) => ({ pts: s.pts, w: o.w ?? 2.6, closed: true, color: o.lineColor }));
  return { id, shape, fill, fillAlpha: o.fillAlpha, shade: o.shade, seeThrough: o.seeThrough, rim: shape && { pts: shape, closed: true }, lines: [...lines, ...detailLines(o)] };
}

/** Ink-only detail lines. */
export function ink(id: string, paths: (string | [string, number])[], w = 2, color?: string): Part {
  return region(id, 'M0 0', undefined, { noOutline: true, details: paths, detailW: w, lineColor: color });
}

export interface TubeOpts extends RegionOpts {
  profile?: (t: number) => number;
  /** draw the outline across the starting end */
  capStart?: boolean;
}

/** A tapering limb/trunk: fill from the centerline, ink along both edges and the far end. */
export function tube(id: string, center: string, w0: number, w1: number, fill: string, o: TubeOpts = {}): Part {
  const c = sample(center, 2)[0].pts;
  const shape = tubeOutline(c, w0, w1, o.profile);
  const lines: Line[] = o.noOutline ? [] : [{ pts: o.capStart ? [...shape, shape[0]] : shape, w: o.w ?? 2.6, color: o.lineColor }];
  return { id, shape, fill, fillAlpha: o.fillAlpha, shade: o.shade, rim: { pts: shape, closed: !!o.capStart }, lines: [...lines, ...detailLines(o)] };
}

export function circlePath(cx: number, cy: number, r: number, ry = r) {
  const k = 0.5523;
  return `M ${cx - r} ${cy} C ${cx - r} ${cy - ry * k} ${cx - r * k} ${cy - ry} ${cx} ${cy - ry} C ${cx + r * k} ${cy - ry} ${cx + r} ${cy - ry * k} ${cx + r} ${cy} C ${cx + r} ${cy + ry * k} ${cx + r * k} ${cy + ry} ${cx} ${cy + ry} C ${cx - r * k} ${cy + ry} ${cx - r} ${cy + ry * k} ${cx - r} ${cy} Z`;
}

/** Petal pointing along `dir` (radians, 0 = up) from a base point. */
export function petalPath(bx: number, by: number, w: number, h: number, dir = 0, lean = 0) {
  const pts: [number, number][] = [
    [-w / 2, 0], [-w / 2, -h * 0.55], [-w * 0.12 + lean * 0.5, -h * 0.95], [lean, -h],
    [w * 0.12 + lean * 0.5, -h * 0.95], [w / 2, -h * 0.55], [w / 2, 0],
  ];
  const cs = Math.cos(dir), sn = Math.sin(dir);
  const t = ([x, y]: [number, number]) => `${(bx + x * cs - y * sn).toFixed(1)} ${(by + x * sn + y * cs).toFixed(1)}`;
  return `M ${t(pts[0])} C ${t(pts[1])} ${t(pts[2])} ${t(pts[3])} C ${t(pts[4])} ${t(pts[5])} ${t(pts[6])} Z`;
}
