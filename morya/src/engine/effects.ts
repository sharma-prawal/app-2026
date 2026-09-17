// Small living details, drawn in artboard space each frame.
import { noise1, rng } from './geom';

/**
 * Life for a flame that is already painted: warmth around it and a tiny bright tip that
 * breathes and leans a little. Sized to the painted flame, never a second flame beside it.
 */
export function drawFlame(g: CanvasRenderingContext2D, x: number, y: number, t: number, alpha: number, seed = 0, still = false) {
  if (alpha <= 0.01) return;
  const f = still ? 0 : noise1(t * 0.0035 + seed * 3.1, seed + 3) * 0.6 + noise1(t * 0.009 + seed, seed + 7) * 0.4;
  const sway = still ? 0 : noise1(t * 0.0018 + seed * 1.7, seed + 11) * 0.9;
  g.save();
  g.globalAlpha = alpha;
  const glow = g.createRadialGradient(x, y - 9, 0, x, y - 9, 26);
  glow.addColorStop(0, `rgba(255, 214, 140, ${0.2 + f * 0.06})`);
  glow.addColorStop(1, 'rgba(255, 200, 120, 0)');
  g.fillStyle = glow;
  g.fillRect(x - 26, y - 35, 52, 52);
  const h = 12 * (1 + f * 0.08), w = 2.6;
  const tipX = x + sway, tipY = y - 4 - h;
  g.fillStyle = `rgba(255, 246, 220, ${0.5 + f * 0.12})`;
  g.beginPath();
  g.moveTo(x, y - 3);
  g.bezierCurveTo(x - w, y - 5, x - w * 0.7 + sway * 0.3, y - 4 - h * 0.55, tipX, tipY);
  g.bezierCurveTo(x + w * 0.7 + sway * 0.3, y - 4 - h * 0.55, x + w, y - 5, x, y - 3);
  g.fill();
  g.restore();
}

/** One slow, thin thread continuing the painted incense smoke upward. */
export function drawSmoke(g: CanvasRenderingContext2D, x: number, y: number, t: number, alpha: number) {
  if (alpha <= 0.01) return;
  g.save();
  g.lineCap = 'round';
  let px = x, py = y;
  const drift = t * 0.00022;
  for (let j = 1; j < 26; j++) {
    const nx = x + Math.sin(j * 0.21 + drift) * j * 0.55 + noise1(j * 0.16 + t * 0.00018, 5) * j * 0.45;
    const ny = y - j * 7;
    const a = alpha * 0.17 * Math.sin((j / 26) * Math.PI) * (1 - j / 34);
    g.strokeStyle = `rgba(150, 140, 142, ${a})`;
    g.lineWidth = 1.6 + j * 0.12;
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(nx, ny);
    g.stroke();
    px = nx;
    py = ny;
  }
  g.restore();
}

export interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
}

export function makeMotes(n: number, seed = 1): Mote[] {
  const r = rng(seed);
  return Array.from({ length: n }, () => ({
    x: 260 + r() * 480,
    y: 300 + r() * 900,
    vx: (r() - 0.5) * 0.003,
    vy: -0.002 - r() * 0.004,
    r: 2.2 + r() * 2,
    phase: r() * Math.PI * 2,
  }));
}

export function stepMotes(motes: Mote[], dt: number, t: number) {
  for (const m of motes) {
    m.x += (m.vx + noise1(t * 0.0002 + m.phase, 2) * 0.004) * dt;
    m.y += m.vy * dt;
    if (m.y < 260) m.y = 1200;
    if (m.x < 240) m.x = 760;
    if (m.x > 760) m.x = 240;
  }
}

export function drawMotes(g: CanvasRenderingContext2D, motes: Mote[], t: number, alpha: number) {
  if (alpha <= 0.01) return;
  g.save();
  for (const m of motes) {
    const tw = 0.3 + 0.7 * Math.sin(t * 0.0006 + m.phase);
    g.globalAlpha = alpha * 0.3 * Math.max(0, tw);
    g.fillStyle = '#f7e2b0';
    g.beginPath();
    g.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/**
 * An irregular fleck of light on gold: not a hotspot ring, just a glint that
 * comes and goes. `unit` is artboard units per CSS pixel so it keeps a legible size.
 */
export function drawGlint(g: CanvasRenderingContext2D, x: number, y: number, t: number, phase: number, strength: number, unit: number) {
  const cycle = (Math.sin(t * 0.0017 + phase) + 1) / 2;
  const a = strength * (0.12 + 0.88 * Math.pow(cycle, 4));
  if (a < 0.02) return;
  const s = 7 * unit * (0.7 + 0.5 * cycle);
  g.save();
  g.translate(x, y);
  g.rotate(phase + t * 0.0001);
  const haze = g.createRadialGradient(0, 0, 0, 0, 0, s * 2.6);
  haze.addColorStop(0, `rgba(255, 232, 170, ${a * 0.45})`);
  haze.addColorStop(1, 'rgba(255, 232, 170, 0)');
  g.fillStyle = haze;
  g.fillRect(-s * 2.6, -s * 2.6, s * 5.2, s * 5.2);
  g.fillStyle = `rgba(255, 246, 214, ${a})`;
  g.beginPath();
  g.moveTo(0, -s);
  g.quadraticCurveTo(s * 0.12, -s * 0.12, s * 0.7, 0);
  g.quadraticCurveTo(s * 0.12, s * 0.14, 0, s * 0.8);
  g.quadraticCurveTo(-s * 0.1, s * 0.1, -s * 0.55, 0);
  g.quadraticCurveTo(-s * 0.12, -s * 0.1, 0, -s);
  g.fill();
  g.restore();
}
