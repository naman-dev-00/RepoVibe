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

## 7. Premium-artwork upgrade attempt (status: PARTIAL — the visual requirement is **NOT** met)
**Tooling reality.** This environment has no Blender/Maya, no DCC or path tracer, no asset downloads (outbound hosts are blocked) and no GPU; the only available way
to produce genuine 3D-rendered images is the project's own GLSL raymarcher run in software (SwiftShader). I therefore did not (and cannot) deliver
cinematic game-environment quality. What was actually done:

| Asset | Before | After |
|---|---|---|
| Ocean Depths: sea turtle, whale, manta, jellyfish, two reef fish | 2D signed-distance silhouettes | **real raymarched 3D models** (`lib3d.glsl`): modelled turtle with hex scutes, flippers and head; whale with ventral pleats; manta; jellyfish with bell, arms, tentacles; scaled fish; subsurface, caustic key light, ambient occlusion, rim light |
| Sakura Dreams: blossom boughs, falling petals, koi | flat vector blobs / 2D shapes | **real raymarched 3D**: individually modelled five-petal flowers (cupped, notched petals, stamens), bark twigs, curved translucent petals, a shaded koi |
| Everything else in these two worlds (kelp, coral, seabed, sky, Fuji, torii, bridge, pond, tree heads, trunks, grass) | procedural 2D painting | **unchanged — still procedural 2D**, now visibly lower fidelity than the new 3D sprites |
| Arctic Frost, Aurora, Synthwave, Dark Academia, Pixel Paradise, Sunset Boulevard | procedural 2D painting | **unchanged** |

Visual assessment of the result (1920×1080 and 3840×2160 evidence in `docs/screenshots/worlds/quality/`, before/after, plus `*-ambient-before.webm` vs `*-ambient.webm`):
* The turtle, koi, flowers and petals now read as lit 3D objects; the manta and jellyfish are only moderately convincing; the whale is plausible but low detail.
* The 2D environment layers are the weak point and now clash with the 3D sprites; coral and kelp look like flat vector art.
* **4K:** layers and tree-head sprites are rendered at 2560×1440 / ~1.2× density, so at 3840×2160 they are visibly soft; the new 3D sprites are sharp at 1440p but only ≈1.2× oversampled for 4K. Requirement "foreground detailed on 4K" is **not met**.
* Performance and behaviour safeguards are unchanged (same sprite names and sizes, same motion data, same tests).

### Assets needed to actually reach the target (replacement pipeline)
Drop WebP files (RGBA for sprites/foreground layers) into `wallpapers/depth/<slug>/` using the existing names, then `npm run wallpapers:catalog`; no code changes.
* All worlds: far/mid/near/front layers at **3840×2160** (render at 2× supersampling from a real DCC/path tracer scene with PBR materials, volumetric fog and global illumination), plus `rays`.
* Ocean: coral colonies (branching, brain, fan) with displaced geometry, kelp ribbons, rock/seabed with sediment, ruins; Sakura: modelled cherry trunks and canopy clusters (heads as separate RGBA at ≥2× density), stone lantern, koi pond water with refraction; Arctic: ice formations with refraction/caustics, snow pines; Aurora: volumetric curtains; Synthwave: modelled car, palms; Dark Academia: modelled shelves/books, candle with volumetric flame; Pixel Paradise: true voxel scene (e.g. MagicaVoxel renders); Sunset: modelled palms, car, cliff road.
* Sprites should be rendered at ≥2× their display size (≥3× for foreground/pop-outs) so they stay sharp at 4K.
Until such assets exist, the eight worlds must be regarded as stylised, with only the items listed above upgraded.

## 8. Ocean Depths and Sakura Dreams rebuilt from the owner's reference images
Inputs: `assets/reference/oceanbg.jpg` and `assets/reference/cherrybg.jpg` (768×512, supplied by the project owner; derived layers and 3D sprites are original). Pipeline: `scripts/wallpapers/reference-world.py`
(+ `render3d.js` for the raymarched sprites). **What is real and what is simulated:**

| Element | Technique | Real 3D? |
|---|---|---|
| Scene plates (reef; cherry forest) | 16:9 crop, 3.33× Lanczos upscale, unsharp + luminance-modulated grain (no detail can be invented) | No — a 2D photograph-like plate |
| Coral groups (12) / tree groups (4) | colour + hand-placed-polygon segmentation, RGBA cut-outs, plate re-filled only in a thin edge band (push-pull), animated as wind sprites about their base on the shared 23 s gust curve | No — 2.5D cut-outs |
| Caustics (Ocean) | seamless caustic tile ×2 planes moving in opposite directions, restricted to the sunlit sand with a mask image | No — animated 2D planes |
| Light shafts, vignette | generated alpha layers; shafts breathe | No |
| Clouds (Sakura) | the sky window is cut out of the plate; a seamless cloud tile drifts slowly behind it | No |
| Fish, turtles, jellyfish, manta, whale; falling petals, blossom boughs | **raymarched signed-distance 3D models** (materials, subsurface, caustic key light, AO) rendered to sharp transparent sprites | **Yes** (rendered offline, displayed as sprites) |
| Pop-outs | the 3D sprites plus cut-out coral and petals above the page, `pointer-events:none`, placed only in measured empty margins/band | Mixed |
No mouse parallax and no butterfly were reintroduced; Static shows the plate and sprites at rest (the original composition), reduced motion = Static.

**Honest assessment against the references.** Composition, colour, light and atmosphere are now those of the references (turquoise reef with golden shafts, purple/orange coral, lit sand ripples; pink forest, trunks framing the view, petal-covered path, mountain vista),
because the plates *are* the references. The scenes read as alive (swaying coral/trees, moving caustics, drifting clouds, schools and petals) but:
* **Sharpness:** the plates are upscaled from 768 px, so they are soft at 1440p and clearly soft at 4K; the 3D sprites and particles are sharp on top of them. A ≥3840×2160 source would be needed for the "ultra-HD" target.
* **Depth is simulated:** no depth map was available, so only the objects listed above separate from the plate; sway amplitude is deliberately small (≤ ~1.8°) because cut edges would show.
* The raymarched sea life is stylistically a little cleaner/cartoonier than the photographic plate (manta and whale especially).
* Marine vegetation does not exist in the Ocean reference, so none was invented; coral sway stands in for it.
So: the references' **atmosphere and composition are achieved; their rendering fidelity at 1440p/4K is not**, and the scenes are 2.5D, not geometry.

**Performance** (software-rendered Chromium, 1366×768, real-page replay; GPU **UNVERIFIED**): Ocean Static 57.6 / Ambient Full 15.4 / Lite 30.6 / Cinematic 14.6 fps; Sakura 57.6 / 17.9 / 28.6 / 18.7; heap ≤ 2.6 MB; ≈1.3–1.4 MB of layers per world
(`docs/perf-profile-reference.json`). Caustic/cloud planes are hidden in Lite and Minimal. Evidence: `docs/screenshots/worlds/reference/` (inputs, before/after, 1080p, 4K, pop-out crops, motion strips) and `docs/recordings/worlds/{ocean-kingdom,sakura-garden}-reference-{ambient,cinematic}.webm`.
