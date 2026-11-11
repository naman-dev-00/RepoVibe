# Theme rework, round 2 (owner feedback, 2026-11-11)

## Theme status (unchanged by this round; `shared/theme-review.js`)
| Status | Themes |
|---|---|
| **Approved** | Enchanted Forest, Cosmic Galaxy, Futuristic Sci-Fi (not modified) |
| **Experimental, rework in progress** | Sakura Dreams, Ocean Depths, Arctic Frost, Cyberpunk Neon, Pixel Paradise |
| **Experimental** | the other 12 · **Archived**: none |

## 1. Why rain and snow looked like still images (root cause)
Two causes, both fixed:
1. **Auto quality froze the weather.** The default quality is *Auto*, which switches to *Lite* when the page renders below 40 fps (most
   laptops without a strong GPU, many tabs open). Lite hid the far and near particle planes but **kept the mid plane visible and stopped every
   plane animation** (`.repv-l > i { animation:none }`), so a frozen sheet of rain, snow or petals sat over the scene. Lite also stopped plant
   sway, the canal ripples, and the distant fish schools (which then sat stacked mid-screen). The round-1 evidence forced *Full* quality and
   missed it.
   **Now:** in Lite and Minimal the mid weather plane keeps falling (one compositor transform), plants keep swaying, ripples keep running and
   every traveller (swimmers, crossers, falling leaves/petals, rising bubbles) keeps moving; Lite still drops the extra planes and the camera
   drift. Only idle drift (e.g. distant belt rocks) rests. Covered by a new browser test that forces Lite and checks the weather plane is
   visible, animating and actually travelling.
2. **The motion itself was weak.** Cyberpunk's rain keyframe moved 64 px sideways on a 200 px tile, so every 0.9 s loop jumped, and the layer
   slid down without extending upward, sweeping a rain-free band across the top. Snow and petal tiles crawled (far snow 13 px/s, mid 23 px/s,
   petals 19–36 px/s). **Now:** rain loops exactly one tile period (seamless), near rain is longer and brighter and falls faster than far
   rain; snow falls at ~60/115/200 px/s on three depths with a slight slant and the shared gust, the mid snow plane is twice as dense; petals
   fall at ~65–130 px/s.

Measured with the default Auto quality in this container (which drops to Minimal): share of scene pixels that change every 0.5 s —
Cyberpunk 5–6 %, Sakura 29–37 %, Ocean 6–8 %, Pixel Paradise 3–4 %, Arctic 2–4 % (snow is small and sparse by nature). Frame strips:
`docs/screenshots/rework2/motion/`; the running animations are listed per theme in `docs/screenshots/rework2/facts.json`.

## 2. Softer reading surfaces (Sakura, Arctic)
The light themes' panels were near-white (Sakura 0.91, Arctic 0.80 opacity — the guard raised Arctic because of the new dark spruces).
Now the surface is **tinted** (Sakura rose `#f3d6e3`, Arctic ice blue `#cfe0ef`), the requested opacity is 0.45 and the readability guard
raises it only as far as WCAG AA needs over the scene's darkest pixels: **Sakura 0.66, Arctic 0.67**. Text colours were deepened (plum,
navy) to make that possible. Sidebar sections use the same guarded opacity (no fixed 0.86 floor). Code blocks and tables keep their stronger
backing. Measured: 0 WCAG AA failures on both (lowest 4.58:1).

## 3. Exact changes per theme
**Sakura Dreams — background created from scratch** (`scripts/wallpapers/sakura-paint.py`; the reference plate is no longer used)
* Painted dawn sky with sun glow; a drifting cloud tile behind the mountains; three ridged mountain ranges with lit slopes, snow on the high
  peaks and mist at their feet; distant blossom groves made of ~26 000 individually stamped tiny flowers; a path through a meadow carpeted with
  ~110 000 fallen petals; a row of small cherry trees along the path.
* Four cherry trees **grown recursively** (gnarled tapered limbs with lit/shadow bark and fissures, an umbrella crown). **Every blossom is an
  individual notched five-petal flower with stamens and a magenta eye** (up to 60 000 per near tree), lit by its place in its clump (top-left
  lit, underside shaded) and in the crown; a few young bronze-green leaves. Everything supersampled 2×.
* The trees are sprites that sway from the trunk base on the shared gust; new blossom sprays for the pop-out layer; petals fall faster.

**Ocean Depths — background created from scratch** (`scripts/wallpapers/ocean-paint.py`; the reference plate is no longer used)
* Water column from a bright surface (fine wave network, Snell's-window glare) to deep blue; two hazed distant reef ranges; rippled sand with
  a fine caustic network; reef walls and rocks with relief lighting from above, blue undersides, ambient occlusion and soft coralline/sponge
  patches; a coral garden of thick staghorn corals with lit flanks and pale tips, brain corals, soft corals, seagrass — all hazed by distance.
* **Plants are separate swaying sprites** pivoting at their holdfasts on the shared current: four giant kelp strands (translucent lance-shaped
  blades, midribs, lit rims, gas bladders), two sea fans (branch lace), two soft corals, two seagrass tufts — sway 2.4–4.6°, each with its own
  period, so the movement varies naturally.
* Animals: manta and whale removed (round 1); fish, turtle and jellies are the round-1 remodels (natural colours, shaded into the water);
  turtles are smaller now, and the distant schools keep swimming in Lite.

**Arctic Frost**
* **New trees** (`scripts/wallpapers/arctic-trees.py`): a spruce painter with whorls of drooping boughs, each a filled mass with a sky-lit upper
  face, a shaded underside and needle texture, snow lumps resting on top of the boughs (warm in sun, blue in shadow), a drift of snow at the
  foot. Used for the swaying sprites, two groves and the far-shore tree line.
* **More background detail**: a hazed distant forest of ~1 400 small spruces on the lower slopes and valley mist, over the raymarched range and
  frozen lake from round 1.
* Snow: three depths, faster, denser, slanted with the gust; keeps falling in Lite. Softer tinted panels (above).

**Cyberpunk Neon**
* Rain visibly animated (root cause above): seamless loop, two depths, longer/brighter near streaks, no rain-free band. Ripples keep running in
  Lite. Composition from round 1 (canal, LED walkways, storey-organised facades, blade signs) unchanged.

**Pixel Paradise — redesigned again**
* A sunny tropical lagoon in classic clean pixel art (finer grid, flat stepped shading, dark outlines, only small dither seams between sky
  bands): puffy shaded clouds, a ringed sun, distant islands, a lagoon from deep blue to turquoise with wave dashes and sun glitter, a jungle
  cliff with ledges, moss and a waterfall with splash, a palm islet with a stilt hut and pier, a beach with foam, wet sand, shells and rocks,
  framing fronds. Theme colours changed to deep ocean navy with a gold accent; themed edge turquoise/gold.

## 4. Evidence
Real github.com page replay (`actions/checkout`, logged out, local snapshot, not committed), 1600×900, Ambient, **default Auto quality**.
* Before (round 1, `3a8945c`) / after on GitHub: `docs/screenshots/rework2/compare/<theme>.jpg`
* Whole scene before/after: `docs/screenshots/rework2/scene/<theme>.jpg`
* Motion strips (four frames 0.5 s apart, % of pixels changed): `docs/screenshots/rework2/motion/<theme>-motion.jpg`
* Recordings: `docs/recordings/rework2/<theme>-ambient.webm`
* Facts (quality class, running animations, contrast, motion %): `docs/screenshots/rework2/facts.json`

## 5. Limitations
* Sakura and Ocean are now procedural paintings (stylised illustration, not photographs); the sea animals are raymarched models from round 1.
* GPU frame rates and signed-in GitHub visuals are UNVERIFIED (software-rendered Chromium, logged-out pages).
* In Lite/Minimal only the mid weather plane is shown (one depth); Full shows three.
* No theme was approved or archived by me; no new batch of backgrounds was started.
