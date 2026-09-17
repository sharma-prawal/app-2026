// Development-only view of the authored layers: /?art[=ink|color|full|back|resting]&crop=x,y,w
import { buildScene } from './art/scene';
import { ctx2d, makeCanvas, paperTile } from './engine/textures';

export async function renderArtDebug(root: HTMLElement) {
  const q = new URLSearchParams(location.search);
  const mode = q.get('art') || 'full';
  const rs = Number(q.get('rs') || 1);
  const c = makeCanvas(1000 * rs, 1700 * rs);
  c.style.width = '100%';
  c.style.display = 'block';
  const crop = q.get('crop');
  if (crop) {
    const [x, y, w] = crop.split(',').map(Number);
    const k = innerWidth / w;
    c.style.width = `${1000 * k}px`;
    c.style.transform = `translate(${-x * k}px, ${-y * k}px)`;
    c.style.transformOrigin = '0 0';
    document.body.style.overflow = 'hidden';
  }
  root.appendChild(c);
  const g = ctx2d(c);
  g.fillStyle = g.createPattern(paperTile(), 'repeat')!;
  g.fillRect(0, 0, c.width, c.height);
  const t0 = performance.now();
  const s = await buildScene(rs);
  console.log('scene built in', Math.round(performance.now() - t0), 'ms');
  const put = (l: { canvas: HTMLCanvasElement; box: { x: number; y: number; w: number; h: number } }) =>
    g.drawImage(l.canvas, l.box.x * rs, l.box.y * rs, l.box.w * rs, l.box.h * rs);
  if (mode === 'full' || mode === 'back') put(s.back);
  if (mode === 'full' || mode === 'color' || mode === 'resting') put(s.ganeshColor);
  if (mode === 'resting') s.ornaments.forEach(put);
  if (mode !== 'color' && mode !== 'back') put(s.ganeshInk);
  if (mode === 'full') {
    put(s.front);
    put(s.woman);
  }
}
