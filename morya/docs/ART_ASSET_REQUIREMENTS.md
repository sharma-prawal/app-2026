# Art asset requirements

The application is complete without any external artwork: every layer — Ganesh ji,
ornaments, the surrounding niche, offerings, and the figure of Aashna — is painted
procedurally inside the repository (`src/art/`).

One asset would still raise the piece meaningfully, and could not be made well in code:

| Priority | File | Why |
| --- | --- | --- |
| **Recommended** | `public/art/woman.png` | A true painterly likeness of Aashna, made from the reference photographs. The in-code figure is a respectful stylised placeholder (seen from behind, no face). |
| Optional | `public/art/ganesh-line.png`, `public/art/ganesh-color.png` | A hand-painted Ganesh ji, if a richer miniature rendering is wanted. |
| Optional | `public/art/surroundings.png`, `public/art/foreground.png`, `public/art/ornament-<id>.png` | Replacements for the niche/border and offerings. |

Nothing else is needed. Audio is synthesised; fonts are bundled.

---

## How the supplied master art is used

- `ganesh-line.png` and `ganesh-color.png` are used as supplied; they register exactly (the colour is knocked out under the ink).
- `surroundings.png` was painted around a smaller Ganesh ji of its own. At load, the app replaces that figure with the
  niche wall wherever the master figure could let it show through (`cleanBackdrop` in `src/art/scene.ts`).
  It ships as `surroundings.webp` (quality 92, ~2 MB instead of 21 MB); the lossless master is kept in
  `input/art-masters/surroundings.png`.
- `woman.png` is its own layer so she can be revealed last.
- `ornament-*.png` are not used: they are rectangular crops of the whole painting, and `ornament-bell.png` is empty.
  Shringar instead wakes the gold, tilak and bells already in `ganesh-color.png` (`src/art/ornaments.ts`).
- Every anchor (eyes, trunk, lamp flames, incense, memory objects, her thali) is measured from the supplied art and kept
  in `src/art/layout.ts`. If the art is replaced, re-measure them.

## How supplied art is picked up

1. Put the file in `public/art/`.
2. List it in `public/art/manifest.json`:

   ```json
   { "layers": { "woman": "woman.png" } }
   ```

3. Reload. A listed file that is missing or fails to decode is ignored and the painted fallback is used.

No code changes are required.

## Shared registration (applies to every layer)

- **Every supplied layer is authored on the full artboard**: **2000 × 3400 px** (2× the 1000 × 1700 artboard units used in code; aspect 10 : 17, portrait).
- The app crops each file to the region it needs, so a figure must sit in exactly the place described below.
- Coordinates below are **artboard units**; multiply by 2 for pixels.
- Colour: sRGB PNG. Transparent unless stated.
- Visual language: Indian miniature painting × organic watercolour × handmade paper, restrained antique gold.
  Sepia-brown ink outlines (`#4a2e1f`), no glossy digital rendering, no photorealism, no pure black or pure white.
  Palette: ivory `#f3e9d6`, sindoor `#c8452d`, saffron `#e3914a`, dusty rose `#d48f8c`, muted teal `#5b958e`,
  indigo `#46597e`, antique gold `#c49a4e`.
- Do not paint paper texture into transparent layers: the paper is drawn by the app beneath everything.

---

## 1. `woman.png` — Aashna, offering (recommended)

**Purpose.** Revealed when the painting widens in movement 5. She must look as though she always belonged in the painting.

**Source.** Use `input/wife-reference/` for identity (hair, build, colouring) and
`input/ganesh-memories/IMG_7187.jpeg` for the posture (kneeling, reaching toward the altar).
Keep these photographs private: generate locally or with a service you trust with personal images.

**Canvas.** 2000 × 3400 px, **transparent**.

**Figure placement (artboard units).**

- The whole figure, including hair and offering, must stay inside **x 60 – 480, y 1140 – 1640**
  (pixels: x 120 – 960, y 2280 – 3280). Anything outside that region is discarded.
- The ground line she kneels on: **y ≈ 1625**.
- Her head: about **x 220 – 320, y 1145 – 1270**.
- The offering (a brass thali of marigolds, or flowers in her hands) held at about **x 380 – 480, y 1290 – 1360**.
- Keep **x 430 – 790, y 1196 – 1406** clear apart from the thali at its left edge: her own golden stroke is drawn there.

**Composition.**

- Kneeling / seated on her heels, body turned **away from the viewer**, facing up and to the right toward Ganesh ji
  (who is centred at x 500, y 700).
- **Three-quarter back view or lost profile only.** No frontal face; at most the curve of a cheek and eyelashes.
- Long, dark hair falling down her back, a jasmine gajra, a jhumka.
- Attire in the palette: sindoor-red lehenga or saree with a gold hem; saffron or dusty-rose dupatta.
- Scale: about 480 units tall in total. She should read as clearly smaller and lower than Ganesh ji, who remains the centre.

**Layers (optional but helpful).** If painting in layers, flatten before export; the app uses a single image.

**Continuity.** Ink outline weight similar to the Ganesh ji line work (about 2–3 px at 2000 px width), soft watercolour
pooling at edges, no hard drop shadows.

---

## 2. `ganesh-line.png` and `ganesh-color.png` (optional)

**Purpose.** `ganesh-line` is revealed by her finger in movement 1 (Rekha) and is what remains during the hidden
press-and-hold. `ganesh-color` is revealed as watercolour in movement 2 (Rang).

**Canvas.** 2000 × 3400 px each, **transparent**, perfectly registered to each other.

**Placement.** Everything within **x 190 – 824, y 160 – 1190** (pixels x 380 – 1648, y 320 – 2380).

- Halo centre (500, 470), radius 250. Crown tip near y 175. Lotus seat base near y 1168.
- Eyes centred near (452, 496) and (548, 496): this is where the "eyes" moment is detected.
- Ornament layers (crown gold, jewellery, tilak, halo rays, seat edge, bell) are drawn on top at their current
  positions; either keep the crown/necklace/seat where they are, or also supply the matching `ornament-*.png`.

**Line layer:** ink only, no fills. **Colour layer:** washes only, no ink lines (lines come from the line layer).

---

## 3. Surroundings, foreground, ornaments (optional)

| File | Region (artboard units) | Transparent | Notes |
| --- | --- | --- | --- |
| `surroundings.png` | whole artboard | may be opaque | border, niche, toran, jharokha window (memory object at 150, 330), floor. Keep the bell's chain area around x 736 free. |
| `foreground.png` | x 30 – 970, y 1120 – 1680 | yes | diya at (720, 1478) with the flame tip at (764, 1452) — the flame is animated by the app, do not paint one; modak plate at (586, 1590); lotus at (884, 1546); incense stick tip at (842, 1318). |
| `ornament-halo.png` | x 210 – 790, y 180 – 760 | yes | rays and rings only. |
| `ornament-crown.png` | x 370 – 630, y 160 – 460 | yes | gold leaf crown. |
| `ornament-tilak.png` | x 460 – 540, y 404 – 494 | yes | tilak and bindu. |
| `ornament-jewels.png` | x 230 – 770, y 570 – 1070 | yes | necklaces, armlets, bangles, anklets. |
| `ornament-seat.png` | x 280 – 720, y 1040 – 1180 | yes | gold edges of the lotus seat. |
| `ornament-bell.png` | x 686 – 786, y 40 – 320 | yes | hanging bell; it swings from (736, 52). |

Memory objects (diya, bell, lotus, modak plate, window) must stay where listed: touching them opens the photographs.
