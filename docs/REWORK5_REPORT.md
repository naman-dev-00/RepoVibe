# Curation + rework round 4 (owner review, 2026-11-13)

## Theme status (`shared/theme-review.js`)
| Status | Themes |
|---|---|
| **Approved** (6) | Enchanted Forest, Cosmic Galaxy, Futuristic Sci-Fi, Pixel Paradise, Arctic Frost, **Ocean Depths** |
| **Needs more work** | Cyberpunk Neon, Aurora ("Aurora Fjord": the gallery's Aurora theme, `preset-17`, "Northern lights over a fjord") |
| **Experimental** (not yet reviewed) | Sunset Boulevard, Solar Flare, Midnight Developer, Cozy Coding, Matrix, Dracula, Retro Terminal, Lavender Nights, Obsidian |
| **Archived** | **Sakura Dreams** (`preset-3`), **Dark Academia** (`preset-14`), Synthwave (`preset-20`) |

The six approved themes fill the popup's six featured slots. The gallery shows 17 themes (6 approved, 11 experimental).

### Removed / archived this round
* Themes: **Sakura Dreams** and **Dark Academia** — hidden from the gallery, the popup and automatic picks.
* Their own worlds: backgrounds `sakura-garden` and `dark-library` — hidden from the Studio's Background picker.
* Safety: nothing is deleted. A repository, owner, global or automatic assignment that uses one of them keeps it; the gallery then lists it
  under "Archived, still in use" so it can be replaced deliberately; a custom theme using one of the backgrounds keeps it (labelled in the picker).
  Unit-tested. The separate illustrated backgrounds "Sakura street" and "Academia library" were not part of this request and remain available.

## Cyberpunk Neon — decision: drops and rings now match (one event)
* The free-falling drizzle planes are **removed** — they were random streaks that never landed where a ring appeared.
* Every ring on the canal now has **its own drop**: generated from the ring's definition, at the same spot, with the same duration and delay, it
  falls during the last 12 % of the shared cycle and lands exactly as its ring starts (0 % of the cycle). Its bottom edge is anchored on the
  ring's centre, so the pairing holds at every window shape (measured offset 0 px for all 20 pairs). 20 drop/ring pairs land every 7–10 s each,
  so the canal sees about two light drops at a time. Drops vanish (and rings rest faintly) in Static and reduced motion; they keep running in Lite.
* Honest note: the pairs are small at the canal's distance — a quiet drizzle, not a feature effect. If you would still rather have no falling
  drops at all, removing them is a one-line change (the rings would stay).

## Aurora — flowing aurora, clear stars, moving sky
* The three aurora curtains were pre-rendered images that only slid rigidly. They are replaced by **three flowing ribbons**
  (`scripts/wallpapers/aurora-ribbons.py`): each is a seamless strip (a sharp green hem, tall rays fading to teal and violet, broad bright
  curtains of light plus fine ray texture). The page shows one period through a soft-edged clipping window and streams the texture along the
  ribbon continuously (70 / 95 / 120 s per period, in alternating directions), while each ribbon **undulates** (slow skew and stretch from its
  hem, 13 / 17 / 21 s) and **breathes** in brightness — three independent tempos, so the aurora keeps changing shape. Placed so the hems stay
  above the mountain ridge.
* **Stars**: the baked sky now has three magnitudes with crisp cores and soft halos, a few bright stars with diffraction spikes and a faint
  galaxy band; two star planes on top drift slowly westward (the sky turning). Lake reflection follows the new sky.
* Measured motion (default Auto quality, which drops to Minimal here): 8.5–10.7 % of scene-band pixels change every 0.5 s (before: rigid drift).

## Evidence
Real github.com page replay (logged out; snapshot not committed), 1600×900, Ambient, default Auto quality.
* Gallery after the curation: `docs/screenshots/rework5/curation/gallery.jpg`, popup `popup.jpg`, background picker `background-picker.jpg`, `facts.json`
* Before / after: `docs/screenshots/rework5/compare/{cyberpunk-neon,aurora}.jpg`
* Motion: `docs/screenshots/rework5/motion/aurora-motion.jpg` (four frames 0.5 s apart with % pixels changed),
  `cyberpunk-neon-motion.jpg`, and `cyberpunk-drop-ring.jpg` (one drop paused at four moments: falling → about to land → lands, ring starts at
  the impact point → ring spreads); recordings `docs/recordings/rework5/`

## Tests
* Unit 36/36 (new: archived Sakura / Dark Academia assignments still resolve and show as "archived, still in use").
* Browser E2E full run 82/85 — the three failures were the popup and gallery screenshot baselines (Ocean Depths now featured/approved, counts
  17); inspected and replaced; the affected files re-ran 22/22. New tests: every drop paired with its ring (position and clock); aurora ribbons
  stream, undulate and breathe and rest in Static; Lite keeps drops, ribbons and stars moving.

## Limitations
* Cyberpunk's drop/ring pairs are subtle at the canal's distance (see above).
* The aurora is layered 2.5D animation of pre-rendered ribbons, not a simulated aurora.
* GPU smoothness and signed-in GitHub visuals are UNVERIFIED.
