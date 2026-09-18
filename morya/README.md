# Morya — A Living Painting

A private, mobile-first devotional artwork made for one person: Aashna (Nikki).
She lights a diya, finds a painting of Ganesh ji with her finger, colours and adorns it, leaves one stroke of her own —
and discovers that she, her stroke and her memories were part of the painting all along.

Read [`docs/EXPERIENCE_FLOW.md`](docs/EXPERIENCE_FLOW.md) for the full sequence.

## Run

Requires Node 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

Open the printed URL. To try it on a phone on the same Wi-Fi, use the `Network:` address.
(iOS motion permission requires HTTPS; without it the painting uses its own slow light.)

## Build

```bash
npm run build
```

```bash
npm run preview
```

The static site is in `dist/`. Host it privately (it contains personal photographs).

## Optional film epilogue

The four approved 1080×1920 source clips live untouched in the private, ignored
`input/epilogue-masters/` directory. The browser receives only
`public/epilogue/morya-blessing.mp4`: a single 32-second, 720×1280 H.264/yuv420p + AAC,
fast-start file. Scene pictures use direct cuts because the supplied compositions already
match at their boundaries; source ambience is retained with level normalization and
120 ms boundary fades. The app does not preload the film during painting. Fetching begins
only after all five memories have been seen or the letter is opened.

## Photographs

`npm run dev` and `npm run build` first run `npm run images`, which reads the curated originals in
`input/ganesh-memories/` and writes small, metadata-free 4:5 WebP crops to `public/memories/`.
Originals are never modified. Crops are chosen in `scripts/optimize-images.mjs`; to rebuild them:

```bash
npm run images -- --force
```

Both `input/` and `public/memories/` are git-ignored.

## Supplied artwork

Everything is painted in code, but a hand-painted figure of Aashna can be dropped in without code changes.
See [`docs/ART_ASSET_REQUIREMENTS.md`](docs/ART_ASSET_REQUIREMENTS.md).

## Structure

```
src/
  App.tsx              words, threshold, understated controls
  engine/Engine.ts     the single canvas: camera, movements, compositing, input
  engine/reveal.ts     brush and watercolour reveal masks
  engine/stroke.ts     her stroke: capture, storage, placement
  engine/audio.ts      synthesised sound
  engine/effects.ts    flame, incense, motes, glints
  engine/textures.ts   paper, grain, brush and bloom stamps
  art/                 the painting as vector parts, and its rasteriser
scripts/optimize-images.mjs
docs/
```

## Development aids

Only in `npm run dev`:

- `/?art` shows the finished painting's layers without the experience (`/?art=ink`, `/?art=color`).
- The console exposes `__skip('living')` to move through the movements with the keyboard path,
  and `__morya` for inspecting state.

## Privacy

No backend, analytics, or third-party requests. Her stroke, mute preference, and dismissal of the one-time
iPhone Home Screen hint are the only things stored in the browser's `localStorage`. Raw photographs and the
four epilogue masters remain under ignored `input/`; only derived delivery assets enter `public/` and `dist/`.
