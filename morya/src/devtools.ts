// Development-only helpers for driving the painting from the console during QA.
type W = Window & {
  __drag: (pts: [number, number][], step?: number) => Promise<void>;
  __zig: (x0: number, x1: number, y0: number, y1: number, rows: number, step?: number) => Promise<void>;
  __tap: (x: number, y: number) => Promise<void>;
};
const w = window as unknown as W;
const canvas = () => document.querySelector('canvas.art') as HTMLCanvasElement;
const fire = (type: string, x: number, y: number) =>
  canvas().dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 7, bubbles: true, isPrimary: true, pointerType: 'touch', pressure: 0.5 }));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

w.__drag = async (pts, step = 8) => {
  fire('pointerdown', pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 10);
    for (let k = 1; k <= n; k++) {
      fire('pointermove', x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n);
      await wait(step);
    }
  }
  fire('pointerup', pts[pts.length - 1][0], pts[pts.length - 1][1]);
};
w.__zig = async (x0, x1, y0, y1, rows, step = 8) => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= rows; i++) {
    const y = y0 + ((y1 - y0) * i) / rows;
    pts.push(i % 2 ? [x1, y] : [x0, y]);
  }
  await w.__drag(pts, step);
};
w.__tap = async (x, y) => {
  fire('pointerdown', x, y);
  await wait(60);
  fire('pointerup', x, y);
};
type E = { phase: string; key: (e: KeyboardEvent) => boolean };
(window as unknown as { __skip: (to?: string) => Promise<string> }).__skip = async (to = 'living') => {
  const e = (window as unknown as { __morya: E }).__morya;
  const press = () => e.key(new KeyboardEvent('keydown', { key: 'Enter' }));
  const order = ['threshold', 'rekha', 'rang', 'shringar', 'stroke', 'reveal', 'living'];
  (document.querySelector('.diya') as HTMLButtonElement | null)?.click();
  for (let guard = 0; guard < 400 && order.indexOf(e.phase) < order.indexOf(to); guard++) {
    if (['rekha', 'rang', 'shringar'].includes(e.phase) || (e.phase === 'stroke' && guard % 5 === 0)) press();
    await wait(300);
  }
  return e.phase;
};
export {};
