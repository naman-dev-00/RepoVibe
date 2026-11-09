# Phase 1B — Butterfly removal and eight additional immersive worlds

Branch `feature/phase1b-immersive-themes` · PR #2 (not merged). Honest labelling throughout: the worlds are **painted layered 2.5D scenes**
(pre-rendered signed-distance artwork in depth layers + individually animated transparent sprites + particle planes), **not real-time 3D
geometry**. Real signed-in GitHub visuals and GPU frame rates are **UNVERIFIED** (only software-rendered Chromium and logged-out replays of
locally captured pages were available).

## 1. Butterfly removal (Stage A)
The idle timer, spawn/landing/departure logic, sprite assets, listeners/timers, Studio toggle and handlers, CSS, tests, evidence scripts and README
text were deleted (`content.js`, `shared/core.js`, `studio.html/js`, `tests/*`, `scripts/butterfly-evidence.js`, `docs/screenshots/butterfly/`,
`docs/recordings/butterfly-enchanted-forest.webm`). `normalizeConfig` rebuilds the config from its defaults, so an old saved `idleButterfly` value is
simply dropped while every other setting is kept (unit test). A test asserts that no shipped source mentions a butterfly and that no pointer
listener or idle creature exists (`depth.e2e.js`). Mouse parallax stays removed; nothing reacts to the cursor.

## 2. Architecture changes
* `shared/worlds.js` (new, data only, loaded before `content.js`): per-world sprite lists, pop-out definitions and particle tiles. No code is
  executed from data; no new permissions.
* Stage: for data-driven worlds the sprites live in a 16:9 stage with exactly the baked layers' cover geometry (`#repovibe-depth[data-world]`), so a
  sprite that continues a baked object (a swaying tree head on its trunk) stays registered at any aspect ratio. These layers carry no overscan or camera drift.
* One shared 23 s irregular **gust curve** (`repv-gust-r` rotation about the base, `repv-gust-x` push, `repv-tile-gust` for particle planes) with an
  x-dependent delay, so a gust travels across the scene. Branches/canopies (rotation) and petals/flakes/pages (push) follow the same clock.
* New sprite motion kinds: `wind`, `swim` (wobble + tilt), `rise` (bubbles, jellyfish), `approach` (perspective growth: grid scan lines, a car),
  seamless `tile` particle planes (one-tile-period transform loop, compositor only).
* `scripts/wallpapers/shaders/lib2d.glsl` (painter helpers: tapered capsules, blossoms, pines, palms) and `render3d.js` `// @lib2d`.
* Preset ids and assignments are unchanged; each preset's `wallpaperRef` now points at its world: preset-3 Sakura Dreams `sakura-garden`,
  preset-7 Ocean Depths `ocean-kingdom`, preset-12 Arctic Frost `arctic-frost-3d` (light), preset-17 Aurora `aurora-borealis`, preset-20 Synthwave
  `synthwave-highway`, preset-14 Dark Academia `dark-library`, preset-10 Pixel Paradise `pixel-paradise-3d`, preset-18 Sunset Boulevard `sunset-coast`.
  The previous artwork stays in the wallpaper catalogue for custom themes.
* Integration: repo assignments, automatic selection, live switching, persistence, Static/Ambient/Cinematic, wallpaper customisation, the visual
  controls, scene window, text-only backing, themed glow borders (new edge/glow pairs per world), disable/restore, popup and Studio (gallery badge
  "◉ LIVE WORLD" + "2.5D LAYERED"), Home "Top repositories" cards (optimised ≤ 60 KB thumbnails, never eight live renderers).

## 3. The eight worlds (what they really are)
| World | Artwork | Autonomous motion (Ambient; Cinematic ≈ 1.3–1.6× stronger) | Pop-out |
|---|---|---|---|
| Sakura Dreams | sunrise garden, Mt. Fuji, torii in a pond with reflections, arched bridge, pagoda hill, two cherry trees (heads are sprites, trunks baked) | both tree heads sway about the trunk fork on the gust curve, petals fall with sway/flutter/turn **and** are pushed by the same gust, petal tile planes, two koi swim | blossom boughs, wind-driven |
| Ocean Depths | sunlit water column, caustic seabed, reef coral, kelp forest, sunken ruins | kelp and fan coral sway on one current; 2 fish schools, turtle, manta, whale cross; jellyfish and bubbles rise; marine snow | jellyfish, turtle |
| Arctic Frost (light) | bright frozen valley: cracked ice lake, glaciated range, snow pines, ice crystals, icicles | blizzard flakes on the gust curve (3 planes), 3 pines sway, fox crosses, crystal shimmer | ice crystal, pine |
| Aurora | starry sky, still lake with reflections, pines, lit cabin | three aurora curtains drift/breathe/change independently, pines sway, meteor, star twinkle | pine bough |
| Synthwave | striped sun, wireframe mountains, perspective grid and road, neon posts | scan lines approach with perspective easing, a car drives in, palms sway, sun pulses | palms |
| Dark Academia | gothic library: arched moonlit windows, shelves, ladder, globe, desk, stacks | flickering candles, swaying chandelier/curtains, drifting dust, loose pages on the gust | candle, book stack |
| Pixel Paradise | quantised voxel-style pixel art island, sea, rocks | palms rock, clouds and gulls cross, cubes float up, crab patrols | spinning cube, palm |
| Sunset Boulevard | low sun with glitter path, cliff road with guard rail, headlands | palms sway, clouds/gulls drift, convertible cruises, golden dust | palm, gull |

Static shows the complete layered artwork with no animation and no sprite movement (test: sprite positions identical 2 s apart, 0 running animations);
reduced motion behaves like Static (self-healing watcher retained). Adaptive quality is the existing one-way Auto ladder (Full → Lite → Minimal,
decided once per page, never oscillating). Hidden tabs pause animations (`repv-depth-paused`).

## 4. Honest evaluation (own assessment from the screenshots/recordings; not a user study)
* **Sakura Dreams** — strongest result. Recognisable garden with real depth separation (sky/Fuji/pond far, torii and bridge mid, trunks near, grass
  front) and convincing blossom volume; trees really sway and petals ride the gust. Weaknesses: blossoms read as vector-stylised, a faint seam is
  visible where the sprite tree head meets the baked trunk, far-shore reflection repeats visibly.
* **Ocean Depths** — alive and readable (kelp current, fish, jellyfish), but the manta and whale are crude silhouettes and the coral is flat.
* **Arctic Frost** — pleasant and light, low contrast by design; mountains are weak and the fox is white-on-white.
* **Aurora** — good mood; curtains are soft ribbons (not volumetric); pines are simple.
* **Synthwave** — convincing perspective grid and sun; palms are crude.
* **Dark Academia** — clearly a library with cosy lighting; the red curtain panels are heavy and flat.
* **Pixel Paradise** — chunky and readable; the island and palms are simple, not a rich voxel world.
* **Sunset Boulevard** — warm golden-hour mood; palm fronds are crude.
None of the eight reaches the fidelity of rendered 3D; sprites are 1.2× the 1440p density (upscaled ~1.5× at 4K, so slightly soft at 4K).
**Asset replacement pipeline:** every world is data + GLSL; to upgrade artwork drop higher-fidelity layers/sprites (WebP, same names) into
`wallpapers/depth/<slug>/` (or re-run `node scripts/wallpapers/render3d.js <slug> --layers --sprites`), then `npm run wallpapers:catalog`; no code change.

## 5. Verification
See the PR description's matrix for the final numbers. Evidence: `docs/screenshots/worlds/<slug>-{full,foreground,motion,cinematic,static,comparison}.jpg`,
`docs/recordings/worlds/<slug>-{ambient,cinematic}.webm`, `docs/worlds-evidence.json`, `docs/perf-profile-worlds.json` (software-rendered Chromium,
NOT a GPU measurement).

## 6. Performance (software-rendered Chromium / SwiftShader, 1366×768, real-page replay — **GPU performance UNVERIFIED**)
| World | Static fps | Ambient Full | Ambient Lite | Cinematic Full | JS heap (max) |
|---|---|---|---|---|---|
| Sakura Dreams | 57.2 | 19.9 | 29.7 | 18.9 | 2.4 MB |
| Ocean Depths | 56.6 | 16.6 | 24.4 | 16.9 | 2.4 MB |
| Arctic Frost | 56.2 | 18.9 | 32.0 | 20.1 | 2.4 MB |
| Aurora | 58.2 | 17.1 | 55.4 | 16.8 | 2.5 MB |
| Synthwave | 58.0 | 22.4 | 41.9 | 21.6 | 2.4 MB |
| Dark Academia | 57.2 | 19.9 | 46.0 | 19.8 | 2.3 MB |
| Pixel Paradise | 58.6 | 23.3 | 38.8 | 27.5 | 2.5 MB |
| Sunset Boulevard | 57.4 | 22.9 | 56.4 | 22.8 | 2.2 MB |
For comparison the existing Enchanted Forest measured 19.7 / 34.5 fps (Full / Lite) in the same setup, so the worlds cost about the same.
Everything is software-composited here (CPU ≈ 1.1 cores in Ambient), which is the worst case; on a GPU all animation is compositor-only
(transform/opacity/translate/rotate/scale) and 50–60 fps is *expected* but **not measured**. Weak devices fall down the one-way Auto ladder
(Full ≥ 40 fps, Lite 25–40, Minimal < 25) once per page; wind animation is also dropped in Lite. Memory: layered WebP total ≈ 0.4–1.5 MB per world on disk,
all sprites decode once; no per-frame JS (no requestAnimationFrame loop for the worlds). Full data: `docs/perf-profile-worlds.json`.
