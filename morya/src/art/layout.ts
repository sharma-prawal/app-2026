// Composition map of the artboard. All units are artboard units (1000 × 1700).
// Anchors are measured from the supplied master painting (public/art), not from the procedural fallback.
import type { Box } from './render';

export const ART: Box = { x: 0, y: 0, w: 1000, h: 1700 };

/** Everything that belongs to Ganesh ji himself. */
export const GANESH_BOX: Box = { x: 190, y: 160, w: 634, h: 1030 };
/** Offerings and foreground flora. */
export const FRONT_BOX: Box = { x: 30, y: 1120, w: 940, h: 560 };
/** Aashna, kneeling with her thali. */
export const WOMAN_BOX: Box = { x: 60, y: 1130, w: 420, h: 520 };

/** Camera framings. `pad` in CSS px; `bottom` reserves space for a whisper line. */
export const FRAMES = {
  // wide enough that the seat's hanging bells are never cut by the screen edge
  ganesh: { box: { x: 200, y: 168, w: 614, h: 1004 }, pad: 12, top: 10, bottom: 44 },
  stroke: { box: { x: 260, y: 1190, w: 480, h: 480 }, pad: 16, top: 64, bottom: 40 },
  // the shrine, just inside its painted border; top and bottom edges settle into the paper
  full: { box: { x: 45, y: 40, w: 910, h: 1620 }, pad: 0, top: 8, bottom: 64 },
  // after the complete shrine has been seen, settle closer for a more intimate, readable final painting
  // `bottom` also holds the ending copy (see PAPER_TOP): the blessing lines need a full band of clean paper under the art
  living: { box: { x: 105, y: 80, w: 790, h: 1540 }, pad: 0, top: 8, bottom: 88 },
  // press and hold: leaning in toward the master drawing and her line
  hold: { box: { x: 184, y: 160, w: 646, h: 1190 }, pad: 16, top: 8, bottom: 24 },
} as const;
export type FrameName = keyof typeof FRAMES;

/**
 * Artboard y below which the living painting has fully softened into bare paper (measured: the last
 * foreground and the painted border are gone by here). The ending copy is set beneath this line.
 */
export const PAPER_TOP = 1656;

/** Where her stroke lives in the finished painting: a golden thread rising from her thali toward his seat. */
export const STROKE_ZONE: Box = { x: 452, y: 1170, w: 270, h: 160 };
/** Her offering, where the thread begins: the rim of the thali nearest him. */
export const THALI = { x: 444, y: 1277 };
/** Where the thread reaches toward: the base of his lotus seat. */
export const SEAT_BASE = { x: 540, y: 1170 };
/** The thread never leaves the space between her and the altar. */
export const THREAD_BOUNDS: Box = { x: 404, y: 1112, w: 400, h: 270 };

/** The samai's five painted flames (base of each flame). */
export const FLAMES = [
  { x: 827, y: 1281 }, { x: 851, y: 1281 }, { x: 878, y: 1290 }, { x: 906, y: 1279 }, { x: 930, y: 1281 },
];
/** Top of the painted incense smoke; the living thread continues from here. */
export const INCENSE = { x: 750, y: 1244 };

/** The "eyes" beat of Rekha. */
export const EYES = [
  { x: 459, y: 503, r: 30 },
  { x: 555, y: 503, r: 30 },
];
/** Trunk centreline, from between the eyes to the curl. */
export const TRUNK = 'M 507 532 C 505 600 510 650 535 690 C 555 715 600 720 612 695 C 620 675 598 668 590 685';
export const HALO = { x: 507, y: 469, r: 206 };

export interface MemoryDef {
  id: string;
  label: string;
  alt: string;
  /** Only shown when the original photograph carries a reliable capture year. */
  year?: string;
  hit: { x: number; y: number; r: number };
  /** where the reveal "wells up" from inside the object */
  glint: { x: number; y: number }[];
}

export const MEMORIES: MemoryDef[] = [
  {
    id: 'diya', label: 'the lamp', alt: 'Ganesh ji at home among pink blossoms, a brass diya lit before him', year: '2021',
    hit: { x: 878, y: 1320, r: 62 }, glint: [{ x: 878, y: 1262 }],
  },
  {
    id: 'bell', label: 'the bell', alt: 'Nikki offering at the altar beneath hanging bells', year: '2023',
    hit: { x: 715, y: 262, r: 52 }, glint: [{ x: 712, y: 280 }],
  },
  {
    id: 'lotus', label: 'the lotus', alt: 'Ganesh ji in a turquoise turban, garlanded with marigolds', year: '2024',
    hit: { x: 778, y: 1557, r: 62 }, glint: [{ x: 786, y: 1540 }],
  },
  {
    id: 'modak', label: 'the modak', alt: 'Ganesh ji in a red turban and embroidered shawl',
    hit: { x: 650, y: 1590, r: 62 }, glint: [{ x: 642, y: 1574 }],
  },
  {
    id: 'window', label: 'the flowers in her hair', alt: 'Nikki smiling beside the altar she prepared', year: '2025',
    hit: { x: 160, y: 1262, r: 48 }, glint: [{ x: 156, y: 1250 }],
  },
];
