# Theme approval update and targeted rework (owner feedback, 2026-11-11)

## 1. Theme status (recorded in `shared/theme-review.js`)
| Status | Themes |
|---|---|
| **Approved** | Enchanted Forest (`preset-8`), Cosmic Galaxy (`preset-19`), Futuristic Sci-Fi (`preset-15`) |
| **Experimental, rework requested** | Cyberpunk Neon (`preset-1`), Sakura Dreams (`preset-3`), Ocean Depths (`preset-7`), Pixel Paradise (`preset-10`), Arctic Frost (`preset-12`) |
| **Experimental** (no decision yet) | the other 12 built-in themes |
| **Archived** | none |

The approved themes now lead the Studio's **Approved themes** section and take the first popup featured slots (Enchanted Forest,
Futuristic Sci-Fi, Cosmic Galaxy, then Cyberpunk Neon, Retro Terminal and Synthwave from the previous fallback). Their artwork and code are unchanged.
No assignment, custom theme, upload or preference is rewritten (unit test: curated collection).

## 2. What changed per theme
**Cyberpunk Neon** (`neon-city-3d`, raymarched)
* The street became a **canal**: calm water whose wavelets vary mostly along the view axis, so neon reflections stretch into clean vertical
  streaks (the old asphalt had squiggly, noisy reflections). A low neon haze lies on the far water.
* **Animated rain-drop ripples**: 20 ripple sprites on the canal (scene window and side gutters, where the water is visible), each growing from
  its impact point and fading, with different periods so drops never land in step. Compositor-only (`scale`, `opacity`); at rest in Static,
  Lite and reduced motion (faint frozen rings).
* **Cleaner composition**: canal-side walkways with one continuous LED strip per side (magenta left, cyan right) leading to the vanishing point;
  facades organised by storeys, lit/dark floors, pilasters and ledges, a single continuous storefront trim and roofline trim per side, individual
  shopfronts; blade signs perpendicular to the facades with framed glyph faces (replacing the floating neon bars); taller towers get setbacks.
  The camera was lowered so the canal fills the part of the scene GitHub actually shows.

**Sakura Dreams** (`sakura-garden`, owner's reference plate)
* **Crisper blossoms**: the 768 px reference is upscaled 3.3×, which made every canopy soft. A detail pass now paints ~90 000 individual
  five-petal blossoms over the canopies and the petal carpet, each coloured from the canopy beneath it (so lighting and shading are kept),
  smaller on the far trees, larger on the near ones and on the ground, fewer in shaded hollows. Applies to the plate and the swaying tree sprites.
* **Translucent text backing**: the light-theme reading surfaces dropped from 0.91 to 0.70 opacity. To keep WCAG AA the text colours were
  deepened (plum `#2e0f26` / `#3e1c36`, accent `#781a4a`); the readability guard still raises opacity wherever the scene needs it.
  Measured on the real-page replay: lowest text contrast 4.58:1, 0 AA failures.

**Ocean Depths** (`ocean-kingdom`, owner's reference plate)
* **Clearer background**: the blobby white specks baked into the source (smudges once upscaled) are removed from the blue water and rock
  (coral tips are excluded), local clarity on the reef, and crisp polyp detail on the corals; the live particle planes provide crisp marine snow.
* **Sea life reworked**: the polka-dot manta and the pale whale were removed (they could not be made convincing). The fish were remodelled as
  streamlined bodies with forked tails and natural counter-shading (yellowtail, blue tang); the turtle has hawksbill-brown scutes with dark
  seams and dark scaled skin; the jellies are glassy moon jellies (mostly transparent bell, bright rim, four rosy rings). Every creature is shaded
  into the water's blue-green at its distance, and a distant school is hazed by opacity, so nothing looks pasted on.
* **Plants move more**: the coral groups' sway on the shared current is 1.9× stronger (1.3–4.2°).
* The crossing turtle swims higher, clear of the repository header buttons.

**Pixel Paradise** (`pixel-paradise-3d`) — background **redesigned entirely** (original pixel art)
* A sunset archipelago on one pixel grid with a limited palette and 4×4 ordered dithering: dithered sky with stars, a pixel sun and its broken
  golden reflection on the sea, three shaded cloud banks, layered mountains, a jungle cliff island with a waterfall and a lit hut, a palm islet,
  a beach with foam line and boulders, and framing palm silhouettes. Palette colours are exact (the shader undoes the tone curve).
* Sprites redrawn to match (palms with leafy fronds, shaded pixel clouds, dark gulls, a floating pixel gem, the crab); palms re-placed on the islet.
  Themed edge changed to the warm sunset pair.

**Arctic Frost** (`arctic-frost-3d`, light theme) — rebuilt
* A **raymarched alpine range** (eroded heightfield): snow by slope and altitude, exposed rock strata, soft shadows from a low golden sun,
  aerial perspective, high cirrus. A **frozen lake** reflects the range, with fine cracks and wind-drifted snow.
* **New trees**: a tiered spruce model with ragged drooping bough tips, needle texture, patchy snow lumps on the upper face of each tier
  (warm on the sunlit side, blue in shadow) and a shadow under each lump; used for the far-shore forest, the groves and the swaying pine sprites.
* Foreground snowbank with wind ripples and sparkle. Removed: the icicle band, the cartoon crystal slabs and their pop-out.
* Translucent reading surfaces (0.71): lowest text contrast 4.58:1, 0 AA failures.

## 3. Evidence
Real github.com page replay (`actions/checkout`, logged out, captured locally; the snapshot is not committed), 1600×900, Ambient, popup closed.
* Before/after on GitHub: `docs/screenshots/rework/compare/<theme>.jpg` (before = e98753f, the shots from the theme review)
* After on GitHub: `docs/screenshots/rework/after/<theme>-github.jpg`
* Whole scene before/after (flat composite; most of the lower scene is under GitHub's content): `docs/screenshots/rework/scene/<theme>.jpg`
* Motion: three frames 1.2 s apart with the pointer parked `docs/screenshots/rework/motion/<theme>-motion.jpg`, and Ambient recordings
  `docs/recordings/rework/<theme>-ambient.webm`
* Measured facts: `docs/screenshots/rework/facts.json`

## 4. Is each reworked theme visually stronger?
My assessment from the evidence (an opinion for the owner, not an approval):
| Theme | Stronger? | Notes |
|---|---|---|
| Cyberpunk Neon | Yes | Cohesive, regular canal scene; reflections clean; ripples clearly animate in the scene window. Still stylised CG. |
| Sakura Dreams | Yes, moderately | Canopies read as blossoms instead of mush; backing is translucent. Trunks and mountains stay soft (768 px source). |
| Ocean Depths | Yes | Cleaner water, no cartoon manta/whale, sea life sits in the water. Despeckled dark rock has a few smudgy patches. |
| Pixel Paradise | Yes, clearly | A deliberate, detailed scene instead of a placeholder. Dither texture is strong at large pixel sizes (by design). |
| Arctic Frost | Yes, clearly | Real mountains and believable spruces. The lake sits mostly under GitHub's content; the scene window shows the range. |

## 5. Limitations
* Signed-in GitHub visuals and GPU frame rates are UNVERIFIED (software-rendered Chromium only).
* Sakura and Ocean remain limited by the 768 px reference plates: detail synthesis adds crisp texture, it cannot invent real structure.
* Arctic Frost's mountains are rendered once (2.5D layers), not real-time 3D; the same applies to every world.
* None of the five is approved: they await the owner's review. No new batch of backgrounds was started.
