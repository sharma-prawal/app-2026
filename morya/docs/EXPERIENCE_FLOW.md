# Experience flow

One continuous sitting. Nothing depends on the date, and nothing waits for another day.
The whole piece is a single canvas (`src/engine/Engine.ts`) with a thin layer of words on top (`src/App.tsx`).

| # | Movement | What she does | What happens | Moves on when |
|---|---|---|---|---|
| 0 | **Threshold** | Touches the unlit diya | Flame catches, soft ignition and a bell (this gesture also starts Web Audio), the words fade, the lamp's warmth fades into the paper, a faint pencil curl appears where the trunk will be | ~2 s after the flame |
| 1 | **Rekha** | Moves a finger over the paper | A dry brush reveals the master line drawing. Near a defining form (trunk, eyes, ears, face, crown, blessing hand, lotus, modak bowl, torso, seat) that form comes forward whole and firm; jewellery, textile and garland detail stay faint. When the eyes appear, the paper warms very slightly | About 60 % of those forms are found → the fine detail settles in by itself and the brush stops answering. Nothing moves on while her finger is down; once it lifts, the drawing is left alone for ~2 s, one low bell sounds, and *Now, bring Him to colour.* Colour begins only from a new touch |
| 2 | **Rang** | Keeps painting | The same gesture now lays watercolour: drops bloom, feather beyond the brush, dry with darker rims | About 60 % of the colour → remaining gaps bloom in on their own; again it waits for her finger to lift and a short stillness |
| 3 | **Shringar** | Touches where light glints | Nothing is added to the painting. Its gold rests matte and the tilak is only a trace until found; each discovery wakes what is already painted: gold leaf spreads over the crown and jewellery, the tilak and trunk pattern bloom, the halo's gold sweeps around, gold runs along the lotus seat, and the seat's small hanging bells swing once. Light passes over newly woken gold once | All six found. After three, a pause of ~9 s reveals the rest; if she never finds one, the hint returns. **Fully adorned:** the cues and words leave, one low bell, and all of his gold catches the light once, together; ~6 s of stillness before her stroke is asked for |
| 4 | **One stroke from you** | Draws one continuous line | The painting is quieted under paper, the view drops to a blank area. Her stroke is recorded as vector points and saved in `localStorage`. A tap is not accepted as a stroke | ~3 s after she lifts her finger |
| 5 | **Reveal** | Watches | The painting returns and seems complete, and stays so for a breath. **He is here:** a short sung invocation to Ganpati rises out of silence, very low (the only recording in the piece, ~30 s, see ASSET_LICENSES.md), and warm light gathers around him before receding into the shrine. The niche and its architecture bloom outward from him; the view begins, slowly, to open; floor and offerings arrive from the lamp; last of all Aashna, from the thali in her hands. Then her own line appears in ink at the rim of her thali, and antique gold travels along it toward his seat — the same shape, only uniformly scaled and moved, finely tapered | ~24 s |
| 6 | **Memories** | Touches the lamp, a bell, the lotus, the modak plate or the flowers in her hair | Wet pigment blooms at the object; the painting recedes to about a third of its presence, quieted and warmed under paper; the photograph surfaces as a large focal region. Its centre is untouched; only its perimeter breaks into paper and fibre. A verified capture year appears quietly when available. No card or frame. The count follows the order she sees them (the first she opens is *1 of 5*); *Next memory* and a left swipe always go to one she has not seen, a right swipe goes back through those she has. At *5 of 5* the action is *And one more thing.*, which returns to the painting with the note already placed. *Back to painting* (or Escape) lets it sink back. If the invocation is still sounding, it is set down | — |
| 7 | **Living painting** | Nothing | The complete shrine first holds at its widest framing, then settles slightly inward so Ganesh ji, Aashna and the offerings remain intimate and readable. Only what a painting could plausibly do remains: the samai's painted flames breathe, one faint thread continues the incense smoke, a few slow motes, and very occasional gold response. After a quiet pause: *Every year, you bring him home.* → *Five memories are waiting in the painting.* Each memory object gets one understated catch-light, one at a time, before the guidance stops. As soon as all five have been seen (by any route), a folded patra, tied with a mauli thread, is placed beside the offerings within about a second; if she found the memories before the words, *Every year, you bring him home.* is said then, once. Only if the note goes unnoticed for ~7 s does *And one more thing.* point to it. Without the memories, it comes after a long stillness. It opens only if touched, unfolding from its top fold into a narrow handmade sheet; when folded away, the painting returns for a final quiet *Ganpati Bappa Morya*. | — |

## Hidden: press and hold

On the finished painting, press and hold anywhere (~0.4 s) without moving.
Gold rests first, then the world around him softens away, then the watercolour drains while the view leans in toward
him — leaving the master line drawing and her stroke, back in ink. Release and everything returns.

## Replay

"paint it again" dissolves to paper and resets every piece of state: masks, ornaments, camera, tweens and timers,
particles, the memory overlay, hold, final words, ambience. Her previous stroke stays in `localStorage`, and a new
stroke replaces it.

## Curated memories

| Object | Photograph | Why |
|---|---|---|
| Lamp (samai) | `20210911_104015` (2021) — Ganesh ji among pink blossoms, brass diya lit | the lamp echoes the threshold |
| Bell | `IMG_7187` (2023) — Aashna offering beneath hanging bells | the painting's composition, lived |
| Lotus | `IMG_0880` (2024) — Ganesh ji in turquoise, marigolds | the richest colour |
| Modak | `IMG_1548` (year withheld; metadata is not reliable) — Ganesh ji in the red turban | a close, tender portrait |
| Flowers in her hair | `IMG_0310` (2025) — Aashna smiling beside the altar | another year of the same care |

Not used: the visarjan-in-water image (the piece deliberately has no farewell), and near-duplicates of the same altar.

## Accessibility and fallbacks

- **Keyboard:** Enter/Space completes each painting movement, reveals the next ornament, offers a default stroke; memory
  objects become focusable buttons in the finished painting; Escape closes a memory.
- **Reduced motion:** camera moves become dissolves; flame is still; no smoke, motes, parallax or metallic sweep;
  reveals are near-instant. The painting and every interaction remain.
- **No sound permission / muted:** everything works silently. Mute persists.
- **No motion sensor / permission declined:** gold light drifts slowly on its own.
- **Missing photographs:** touching the object gives a glint; the painting stays.
- **Missing supplied art:** painted fallbacks are used (see `ART_ASSET_REQUIREMENTS.md`).
- **Tab hidden:** animation and audio pause.
