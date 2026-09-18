# Asset licences

| Asset | Source | Licence |
| --- | --- | --- |
| All painting layers (Ganesh ji, ornaments, niche, border, offerings, placeholder figure), paper, brush and bloom textures | Authored in this repository (`src/art`, `src/engine/textures.ts`) | Original work for this project |
| Threshold diya | Inline SVG in `src/ui/Threshold.tsx` | Original work for this project |
| Sounds (bell, ignition, room tone, drone, brush, breath) | Synthesised at runtime with Web Audio (`src/engine/audio.ts`) | Original work; no recordings |
| Invocation (`public/audio/invocation.m4a`) | The opening 29.6 s of **"Ganpati Bappa Morya \| Hindu Festive Music"** by **kontraa** (Kontraa Studio; publisher UKA Music Publishing LLC), from Pixabay: <https://pixabay.com/music/religious-theme-ganpati-bappa-morya-hindu-festive-music-569131/>. Retrieved 2026-09-18. Trimmed to the slow opening, before the percussion enters, 0.25 s fade in, 4 s fade out, re-encoded to AAC 112 kbps, metadata removed | [Pixabay Content License](https://pixabay.com/service/license-summary/): free use, no attribution required, modification allowed; the file may not be redistributed on its own. It ships only inside this private piece. The track is not marked "AI generated" on Pixabay (checked 2026-09-18) |
| Cormorant Garamond typeface | [`@fontsource/cormorant-garamond`](https://fontsource.org/fonts/cormorant-garamond), bundled at build time | SIL Open Font License 1.1 |
| Memory photographs | `input/ganesh-memories/` (private, family photographs) → `public/memories/` derivatives | Private. Not for redistribution. Derivatives are regenerated locally and excluded from git |
| Reference photographs of Aashna | `input/wife-reference/` | Private. Used only as reference; not shipped |
| “Ten Days, One Blessing” epilogue | Four approved private Flow/Veo masters in `input/epilogue-masters/` → normalized 720×1280 delivery master at `public/epilogue/morya-blessing.mp4` | Private commissioned/generated material for this project. The untouched source clips are not shipped; only the single optimized derivative is served |

No third-party images or runtime URLs are used, and the one third-party recording above is served from the app's own
files, never hotlinked. There is no analytics, backend, or network call beyond loading the app's own files.

Choosing the recording: on 2026-09-18 every Ganesh-specific track on Pixabay's "ganesh", "ganesha", "ganpati",
"ganesh chaturthi", "vinayaka" and "ganapati" searches was checked. Most are marked AI-generated and were set aside.
Of the rest, Elijah_K's "Ganesha" is percussion-driven and "Maha Ganapati Mool Mantra" is an electronic beat track;
this one opens with a slow passage of sustained phrases, without percussion, suited to a single devotional moment.
Only that opening is used.

## Code dependencies

| Package | Licence | Use |
| --- | --- | --- |
| react, react-dom | MIT | UI shell |
| vite, @vitejs/plugin-react | MIT | dev server and build |
| typescript | Apache-2.0 | type checking |
| sharp | Apache-2.0 | local image derivatives (dev only) |
