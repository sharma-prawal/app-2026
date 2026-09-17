// The forms a person recognises Ganesh ji by, measured on the master line drawing.
// During Rekha a finger near one of these reveals the whole local form boldly;
// jewellery, textile and garland detail are left to settle in once the figure is found.
import { sample } from '../engine/geom';
import { ctx2d, makeCanvas, type Canvas } from '../engine/textures';
import { TRUNK } from './layout';
import type { Box } from './render';

type Oval = { x: number; y: number; rx: number; ry: number; w: number; rot?: number };

const OVALS: Oval[] = [
  { x: 507, y: 495, rx: 76, ry: 74, w: 1 }, // face
  { x: 459, y: 503, rx: 34, ry: 22, w: 1 }, // eyes
  { x: 555, y: 503, rx: 34, ry: 22, w: 1 },
  { x: 390, y: 505, rx: 58, ry: 92, w: 0.9, rot: 0.15 }, // ears
  { x: 624, y: 505, rx: 58, ry: 92, w: 0.9, rot: -0.15 },
  { x: 507, y: 300, rx: 132, ry: 128, w: 0.85 }, // crown silhouette
  { x: 368, y: 700, rx: 44, ry: 78, w: 1 }, // blessing hand
  { x: 748, y: 500, rx: 56, ry: 58, w: 0.9 }, // lotus
  { x: 664, y: 760, rx: 62, ry: 66, w: 0.95 }, // modak bowl and hand
  { x: 270, y: 590, rx: 44, ry: 60, w: 0.7 }, // axe hand
  { x: 742, y: 610, rx: 42, ry: 58, w: 0.7 }, // lotus hand
  { x: 507, y: 720, rx: 96, ry: 140, w: 0.75 }, // torso
  { x: 507, y: 920, rx: 210, ry: 78, w: 0.7 }, // folded legs
  { x: 507, y: 1085, rx: 300, ry: 72, w: 0.85 }, // lotus seat
];

/** Soft weight map (alpha) over `box` at `scale` px per unit. */
export function formMap(box: Box, scale: number): Canvas {
  const c = makeCanvas(box.w * scale, box.h * scale);
  const g = ctx2d(c);
  g.setTransform(scale, 0, 0, scale, -box.x * scale, -box.y * scale);
  for (const o of OVALS) {
    g.save();
    g.translate(o.x, o.y);
    g.rotate(o.rot ?? 0);
    g.scale(o.rx, o.ry);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, `rgba(0,0,0,${o.w})`);
    grad.addColorStop(0.72, `rgba(0,0,0,${o.w})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, 1, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // the trunk: a soft capsule that narrows toward the curl
  const pts = sample(TRUNK, 4)[0].pts;
  g.lineCap = 'round';
  for (const [w, a] of [[62, 0.35], [48, 0.6], [34, 1]] as const) {
    g.strokeStyle = `rgba(0,0,0,${a})`;
    for (let i = 1; i < pts.length; i++) {
      const t = i / pts.length;
      g.lineWidth = w * (1 - t * 0.45);
      g.beginPath();
      g.moveTo(pts[i - 1].x, pts[i - 1].y);
      g.lineTo(pts[i].x, pts[i].y);
      g.stroke();
    }
  }
  return c;
}
