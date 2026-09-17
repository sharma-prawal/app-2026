// Derives small, metadata-free WebP crops of the curated memory photographs.
// Originals in input/ are only ever read, never modified.
//
//   npm run images            (skips crops that already exist)
//   npm run images -- --force (rebuild every crop)
//
// Crop boxes are fractions of the EXIF-corrected image: [left, top, width, height].
// Each crop is 4:5 so the in-painting reveal can treat all memories alike.
import sharp from 'sharp';
import { mkdir, access, stat } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'input/ganesh-memories';
const OUT = 'public/memories';
const WIDTHS = [720, 1200];

export const MEMORIES = [
  // Diya → the altar where the lamp was lit among pink blossoms
  { id: 'diya', file: '20210911_104015.jpeg', focus: { cx: 0.47, cy: 0.56, w: 0.78 } },
  // Bell → her offering beneath the hanging bells
  { id: 'bell', file: 'IMG_7187.jpeg', focus: { cx: 0.5, cy: 0.5, w: 1 } },
  // Lotus → Ganesh ji in turquoise, surrounded by marigolds
  { id: 'lotus', file: 'IMG_0880.jpeg', focus: { cx: 0.5, cy: 0.5, w: 1 } },
  // Modak → Ganesh ji in the red turban
  { id: 'modak', file: 'IMG_1548.JPG', focus: { cx: 0.5, cy: 0.47, w: 1 } },
  // Flowers in her hair → her beside the altar the following year
  { id: 'window', file: 'IMG_0310.jpeg', focus: { cx: 0.53, cy: 0.53, w: 0.72 } },
];

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

const force = process.argv.includes('--force');
await mkdir(OUT, { recursive: true });

for (const m of MEMORIES) {
  const src = path.join(SRC, m.file);
  if (!(await exists(src))) { console.warn(`skip ${m.id}: ${src} missing`); continue; }
  const outs = WIDTHS.map((w) => path.join(OUT, `${m.id}-${w}.webp`));
  if (!force && (await Promise.all(outs.map(exists))).every(Boolean)) {
    const srcTime = (await stat(src)).mtimeMs;
    const outTimes = await Promise.all(outs.map(async (o) => (await stat(o)).mtimeMs));
    if (outTimes.every((t) => t >= srcTime)) continue;
  }
  const rotated = await sharp(src).rotate().toBuffer();
  const { width: W, height: H } = await sharp(rotated).metadata();
  // 4:5 crop, width as a fraction of the image width, clamped to fit.
  let cw = Math.round(W * m.focus.w);
  let ch = Math.round((cw * 5) / 4);
  if (ch > H) { ch = H; cw = Math.round((ch * 4) / 5); }
  const left = Math.max(0, Math.min(W - cw, Math.round(W * m.focus.cx - cw / 2)));
  const top = Math.max(0, Math.min(H - ch, Math.round(H * m.focus.cy - ch / 2)));
  for (const w of WIDTHS) {
    const out = path.join(OUT, `${m.id}-${w}.webp`);
    await sharp(rotated)
      .extract({ left, top, width: cw, height: ch })
      .resize({ width: w })
      .webp({ quality: 80 })
      .toFile(out); // sharp strips EXIF/GPS by default
    console.log(`${out}  (${cw}×${ch} crop of ${W}×${H})`);
  }
}
