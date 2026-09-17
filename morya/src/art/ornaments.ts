// Shringar: the master painting already holds its gold, tilak and bells.
// Until they are found, the gold rests unburnished and the tilak is only a trace;
// each discovery wakes one part of what is already painted. Nothing is added on top.
import type { Pt } from '../engine/geom';
import { HALO } from './layout';
import type { Box } from './render';

export type RevealMode = 'leaf' | 'sweep' | 'bloom' | 'swing' | 'wipe';

export interface OrnamentDef {
  id: string;
  mode: RevealMode;
  /** bounds of the region this ornament wakes */
  box: Box;
  /** which painted pixels rest until found */
  key: 'gold' | 'red' | null;
  /** draws the region (artboard units) with an opaque fill */
  region: (g: CanvasRenderingContext2D) => void;
  hits: { x: number; y: number; r: number; inner?: number }[];
  anchor: Pt;
  glints: Pt[];
}

/** A hanging seat bell, cut from the painting while it swings. Polygons in artboard units. */
export interface BellPiece {
  pivot: Pt;
  shape: Pt[];
}

const chainAndBell = (cx0: number, cx1: number, cy0: number, cy1: number, bx0: number, bx1: number, by1: number): Pt[] => [
  { x: cx0, y: cy0 }, { x: cx1, y: cy0 }, { x: cx1, y: cy1 }, { x: bx1, y: cy1 }, { x: bx1, y: by1 }, { x: bx0, y: by1 }, { x: bx0, y: cy1 }, { x: cx0, y: cy1 },
];
const AXIS = 507;
const mirrorPiece = (p: BellPiece): BellPiece => ({
  pivot: { x: 2 * AXIS - p.pivot.x, y: p.pivot.y },
  shape: p.shape.map((q) => ({ x: 2 * AXIS - q.x, y: q.y })).reverse(),
});
const RIGHT_BELLS: BellPiece[] = [
  { pivot: { x: 758.5, y: 1089 }, shape: chainAndBell(752, 765, 1089, 1126, 743, 777, 1171) },
  { pivot: { x: 793.5, y: 1099 }, shape: chainAndBell(788, 800, 1099, 1110, 778, 811, 1155) },
];
export const BELLS = { right: RIGHT_BELLS, left: RIGHT_BELLS.map(mirrorPiece) };
export const BELL_BOX = { right: { x: 736, y: 1080, w: 82, h: 96 }, left: { x: 196, y: 1080, w: 82, h: 96 } };

const CROWN: Pt[] = [
  { x: 470, y: 168 }, { x: 544, y: 168 }, { x: 560, y: 226 }, { x: 640, y: 300 }, { x: 648, y: 410 },
  { x: 600, y: 452 }, { x: 414, y: 452 }, { x: 366, y: 410 }, { x: 374, y: 300 }, { x: 454, y: 226 },
];
const poly = (g: CanvasRenderingContext2D, pts: Pt[]) => {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.closePath();
};
const eraseFace = (g: CanvasRenderingContext2D) => {
  // keep the face and trunk calm: their gold-toned skin is not ornament
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.ellipse(507, 520, 70, 88, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
};

export const ORNAMENTS: OrnamentDef[] = [
  {
    id: 'halo',
    mode: 'sweep',
    box: { x: HALO.x - 280, y: HALO.y - 280, w: 560, h: 560 },
    key: 'gold',
    region: (g) => {
      g.beginPath();
      g.arc(HALO.x, HALO.y, 280, 0, Math.PI * 2);
      g.arc(HALO.x, HALO.y, 150, 0, Math.PI * 2, true);
      g.fill();
      g.save();
      g.globalCompositeOperation = 'destination-out';
      poly(g, CROWN);
      g.fill();
      // ears, hands and arms that cross the halo
      g.fillRect(230, 470, 560, 300);
      g.restore();
    },
    hits: [{ x: HALO.x, y: HALO.y, r: 280, inner: 176 }],
    anchor: { x: HALO.x, y: HALO.y },
    glints: [{ x: 322, y: 360 }, { x: 694, y: 352 }],
  },
  {
    id: 'crown',
    mode: 'leaf',
    box: { x: 364, y: 166, w: 286, h: 290 },
    key: 'gold',
    region: (g) => {
      poly(g, CROWN);
      g.fill();
    },
    hits: [{ x: 507, y: 312, r: 100 }],
    anchor: { x: 507, y: 312 },
    glints: [{ x: 507, y: 204 }, { x: 560, y: 330 }],
  },
  {
    id: 'tilak',
    mode: 'bloom',
    box: { x: 480, y: 412, w: 54, h: 232 },
    key: 'red',
    region: (g) => {
      g.beginPath();
      g.ellipse(507, 450, 20, 36, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(508, 568, 24, 72, 0, 0, Math.PI * 2);
      g.fill();
    },
    hits: [{ x: 507, y: 470, r: 44 }],
    anchor: { x: 507, y: 450 },
    glints: [{ x: 507, y: 444 }],
  },
  {
    id: 'jewels',
    mode: 'leaf',
    box: { x: 196, y: 468, w: 622, h: 560 },
    key: 'gold',
    region: (g) => {
      g.fillRect(196, 468, 622, 560);
      g.save();
      g.globalCompositeOperation = 'destination-out';
      poly(g, CROWN);
      g.fill();
      g.restore();
      eraseFace(g);
    },
    hits: [{ x: 507, y: 800, r: 96 }],
    anchor: { x: 507, y: 790 },
    glints: [{ x: 507, y: 712 }, { x: 314, y: 640 }],
  },
  {
    id: 'seat',
    mode: 'wipe',
    box: { x: 190, y: 1028, w: 634, h: 146 },
    key: 'gold',
    region: (g) => g.fillRect(190, 1028, 634, 146),
    hits: [{ x: 507, y: 1124, r: 150 }],
    anchor: { x: 507, y: 1124 },
    glints: [{ x: 420, y: 1150 }, { x: 600, y: 1150 }],
  },
  {
    id: 'bell',
    mode: 'swing',
    box: BELL_BOX.right,
    key: null,
    region: () => {},
    hits: [{ x: 776, y: 1132, r: 46 }, { x: 238, y: 1132, r: 46 }],
    anchor: { x: 776, y: 1132 },
    glints: [{ x: 760, y: 1150 }, { x: 254, y: 1150 }],
  },
];

