# Focused Phase 1B: four flagship worlds, live wallpapers, themed Top repositories

Branch `feature/phase1b-immersive-themes` (PR #2, stacked on PR #1). Not merged.

## 0f. Final verification, performance review and themed border & glow — latest

### 1. CI and live results for `cd7165d`

- **CI** ([run](https://github.com/naman-dev-00/RepoVibe/actions/runs/41824478588)): green. Check, unit, E2E and package all pass.
- **Live github.com** ([run](https://github.com/naman-dev-00/RepoVibe/actions/runs/41824478605)): 14/15 tests, 237 PASS, **2 FAIL**, 0 BLOCKED.
  - LIVE 8 passed on real pages for all four worlds: the depth scene, the moving objects, pointer-events none, AA text.
  - The failure was LIVE 9's Sci-Fi README check: 2 text elements at 3.85:1, in Static mode at 1366 px.
  - It does not reproduce on the local page replay (7.25:1 minimum). That replay is older than today's live page.

**Changes made in response:**
1. **Readability tones now cover what the engine shows.** They are measured on the depth composite (layers, plus light shafts at their runtime opacity) and on the opaque pixels of the moving objects, at the 99th percentile. Before, they came only from the flat image, but objects such as Sci-Fi's near-white holo ring can sit behind any panel. Production panel opacity stays 0.86 (AA even over white). Lower user choices are now raised further.
2. **LIVE 9 logs specifics.** The README check now logs the exact lowest elements, their ratios and their positions, so a remaining live failure is diagnosable from the job log.

**Result on `2cceb59`:**
- **Live github.com** ([run](https://github.com/naman-dev-00/RepoVibe/actions/runs/41833688468)): **15/15 tests, 238 PASS, 0 FAIL, 0 BLOCKED**. README minimum per world: Sci-Fi 7.36 (was 3.85), Forest 4.96, Cyberpunk 7.44, Galaxy 9.62; all 35/35 blocks individually backed.
- **CI** ([run](https://github.com/naman-dev-00/RepoVibe/actions/runs/41833688420)): green.
- **Live github.com on `be10bd4`** (tests and report only; same extension code): 13/15. The new LIVE 9 diagnostics named the elements:
  - all at y = 24, at the top of the viewport, after scrolling to the README;
  - Cyberpunk: "#2531" at 3.51;
  - Sci-Fi: "package.json", "prep v7.0.1 release (", "Jul 17" at 3.13–3.78.

  These are the file table's **sticky** latest-commit row, which stays pinned at the top while its panel scrolls away. As a nested surface it was transparent, so its text floated over the scene. That is a real, scroll-position-dependent defect, which is why `2cceb59` passed by chance.

  **Fix:** the runtime scan tags sticky rows with text, even inside panels, as `data-repv-sticky`. They get a solid themed backing (≥ 94 %). Verified on the replay with the same scroll (row backed, minimum 7.25 / 8.83), and covered by a new E2E test (pinned row, solid backing, AA, restore).
- **Local E2E:** one intermittent baseline diff (Galaxy, 1.77 %); CI passed the same test. The pixel-baseline helper now waits until every depth layer and object image has decoded before capturing, and the test is stable over 3 runs.

### 2. Motion evidence inspected

Frames extracted from `docs/recordings/cosmic-galaxy-depth.webm`, plus the autonomous-motion strip `docs/screenshots/depth/cosmic-galaxy-autonomous.jpg` (pointer held still, t = 0 / 2 / 4 s). Confirmed:
- every rock changes position and rotation between frames with no input;
- the rocks cropped by the screen edges and the pop-out rocks move the most with the pointer;
- the planet and sky barely move.

**Defect found in the recording itself.** After the switch to Cinematic, the recorded page rendered shrunken in the corner of the video. The cause: the harness opened a new extension page mid-recording, which disturbed the recorded tab's screencast. Fixed by opening the control page before recording; the recordings were regenerated.

### 3. Performance review: what was found and fixed

Profiler: `scripts/perf-profile.js`. It reports:
- rAF frame times;
- CDP main-thread metrics;
- paint, raster and composite time from a Chrome trace;
- composited layer count and area;
- JS heap;
- CPU of all Chromium processes, read from `/proc`.

**Rendering here is software: the GPU string is "ANGLE (SwiftShader)".**

| Finding | Evidence | Fix |
|---|---|---|
| **Every pointer frame repainted the whole document and the repository container** (32 document paints in 2 s; raster about 650 ms/s against 238 ms/s with depth off). | Trace `Paint` events by DOM node. Gone with pop-out off or parallax off. | Pop-out objects cropped at the screen edge changed the page's *scrollable overflow* when they moved. The pop-out container is now `overflow-x:clip`. Result: **0 paints** during pointer motion in all four worlds; raster about 650 → 140 ms/s. |
| Autonomous motion cost | With the pointer still: no paint, no raster, no main-frame work. | None needed: all drift, spin, flicker, fall and cross animations run on the compositor. |
| Per-frame style writes | About 25 inline `transform` writes per frame. | Scene objects share 5 depth buckets (one mover each); unchanged transforms are skipped. Scene movers drop from about 25 to about 13. |
| Layer area | Blanket 6 % overscan on every plane. | Overscan sized per layer: k × 54 px + 10 px. |
| Placement checks (`elementsFromPoint`) | Several hundred probes per placement. | Run only when the layout signature changes (size, band position, document height, settings, images). Never per frame. |
| Per-frame allocation | — | One template string per mover per changed frame. No objects or arrays allocated in the loop. |
| **Auto quality could oscillate** | It re-probed on every mode change. With Lite active it measured faster and switched back to Full. | **One decision per page.** Measured once (never in Static, only while visible), on a one-way ladder: Full ≥ 40 fps, Lite 25–40, Minimal < 25. Never switches back mid-page. E2E proves at most one switch across 5 mode changes. |
| Slowest machines | Lite still about 21–29 fps in software. | New **Minimal** tier (Auto only): no particle planes or light shafts; the layers, moving objects and pop-out objects stay. Forest under Auto: 15 → 38 fps in software. |

**Measured, 1366 × 768, real-page replay, 5 s of pointer motion, software rendering (SwiftShader):**

| World · mode | avg fps | p95 frame | frames > 33 ms | main thread ms/s (style) | paint ms/s | CPU (all Chromium processes) | layers (area) | JS heap |
|---|---|---|---|---|---|---|---|---|
| Galaxy · Static | 57.6 | 16.8 ms | 0.7 % | 91 (3) | 15 | 0.28 cores | 22 (27 vp) | 2.1 MB |
| Galaxy · depth off | 58.8 | 16.8 ms | 0.3 % | 108 (14) | 21 | 1.14 | 12 (21 vp) | 2.3 MB |
| Galaxy · Ambient Full | 19.3 | 83 ms | 84 % | 154 (26) | 8 | 1.23 | 36 (28 vp) | 2.0 MB |
| Galaxy · Ambient Lite | 28.5 | 50 ms | 19 % | 273 (31) | 11 | 1.27 | 26 (25 vp) | 2.1 MB |
| Galaxy · Cinematic Full | 18.6 | 83 ms | 76 % | 159 (29) | 10 | 1.24 | 37 (29 vp) | 2.0 MB |
| Forest · Static / Full / Lite / Cinematic | 57.0 / 15.1 / 22.4 / 16.1 | 17 / 117 / 83 / 117 ms | 1 / 92 / 54 / 95 % | 96 / 310 / 152 / 159 | 15 / 10 / 9 / 10 | 0.30 / 1.23 / 1.23 / 1.23 | 25 / 30 / 25 / 31 | 2.0–2.6 MB |
| Cyberpunk · Static / Full / Lite / Cinematic | 56.4 / 17.6 / 20.1 / 14.9 | 17 / 100 / 83 / 133 ms | 1 / 96 / 75 / 91 % | 98 / 164 / 139 / 174 | 14 / 13 / 11 / 11 | 0.30 / 1.23 / 1.21 / 1.23 | 23 / 27 / 22 / 28 | 2.0–2.6 MB |
| Sci-Fi · Static / Full / Lite / Cinematic | 56.0 / 15.2 / 22.5 / 15.3 | 17 / 117 / 83 / 117 ms | 1 / 92 / 58 / 94 % | 111 / 191 / 167 / 181 | 18 / 9 / 11 / 10 | 0.33 / 1.24 / 1.22 / 1.24 | 23 / 27 / 22 / 28 | 2.0–2.6 MB |
| Depth off (all worlds) | 58.8–60 | 16.7–16.8 ms | 0–0.3 % | 80–108 | 15–21 | 0.99–1.14 | 12 (20–22 vp) | 2.3 MB |

**Auto, the default**, after its single decision. Software rendering selects Minimal in all four worlds. Measured without tracing, 5 s of pointer motion:

| World | Galaxy | Forest | Cyberpunk | Sci-Fi |
|---|---|---|---|---|
| fps | 30.8 | 40.0 | 29.0 | 26.8 |
| main thread ms/s | 91 | 119 | 80 | 79 |

The layers, moving objects and pop-out objects stay in Minimal; only the particle planes and light shafts are dropped.

Notes on the table:
- **Source:** `docs/perf-profile.json`.
- **Tracing overhead:** main thread and CPU are measured *with tracing on*, which inflates them.
- **Paint** is the residual GitHub hover repaint under the moving pointer. It is equal with depth off.
- **Raster** is about 100–180 ms/s, down from about 650 before the overflow fix.
- **Heap** stays about 2–2.6 MB, with no growth across modes.

**What limits software rendering.** Each moving plane damages the full viewport, so the compositor re-blends every layer on the CPU each frame. Software compositing saturates at about 1.2 CPU cores, regardless of our main-thread work, which is now small.

**Hardware.** On a GPU those blends are textured quads, cheap at 60 fps. The **50–60 fps target on ordinary GPU-accelerated desktop Chrome is UNVERIFIED**: no GPU hardware was available for measurement. Profiling with `scripts/perf-profile.js` on such a machine will show the result: its output records whether the GPU is hardware or SwiftShader.

### 4. Default pop-out behaviour is tested (foreground on)

- A new E2E test uses the true defaults (Ambient, Auto quality, foreground 100 %). It shows the pop-out objects and verifies the Auto ladder decides at most once.
- The Galaxy hero test also runs with the foreground on.
- Only the legacy pixel-baseline tests switch pop-out off, because their placement is deferred until images load.

### 5. Themed border & glow system

| World | Edge | Glow |
|---|---|---|
| Enchanted Forest | mint/teal `#5fe0b9` | soft mint `#9dffd8`, strength 0.34 |
| Cosmic Galaxy | violet `#a98bff` | cosmic blue `#6f9bff`, strength 0.38 |
| Cyberpunk Neon | magenta `#ff4fd8` | cyan `#3ff0ff`, strength 0.5 (strongest) |
| Futuristic Sci-Fi | cyan `#7fe6ff` | cyan-white `#e8fbff`, strength 0.4 |
| Other themes | accent | accent; strength by theme character |

Treatment:
- **Edges.** About 1.5 px: a 1 px themed border plus a 0.5 px outer ring.
- **Glow.** Two soft outer layers, 10 px and 26 px, at low alpha, so the edge looks like it gently emits light.
- **Highlight.** A faint inner top highlight.
- **Shadow.** A grounding drop shadow.

Where it applies:
- **Panels and boxes:** themed edge and glow.
- **Buttons, inputs and search:** themed edge and gentle glow, stronger on hover and focus.
- **Menus, dialogs and popovers:** edge and stronger glow.
- **Home cards:** a resting accent ring and glow.
- **Sidebar sections:** they no longer float. They get a light anchoring surface (26 % in dark themes), a themed frame and glow, and 12 px inner padding; text keeps its own readable backing.
- **README:** a themed frame and glow around an open interior.

Small dividers are untouched. No blur was added.

Before/after on the real-page replay (Static, 1366 px), with sidebar, README and button group for each world: `docs/screenshots/borders/<world>.jpg`. The before is `cd7165d`, loaded via `REPOVIBE_EXT`.

### 6. Readability

Screenshot-measured text contrast on the real-page replays, with the border & glow, the new tones, the moving objects and Static's layered scene all active:
- coverage: code, issues and PR list × 4 worlds × Static and Ambient × 1366 and 1920 px;
- result: **48/48 runs, 0 text elements below 4.5:1**;
- minimum 4.63: GitHub's own header text.

Home cards still theme 6/6 rows on all three markup variants.

### 7. Tests

- **Unit:** 30/30.
- **Offline E2E:** 56/56. New:
  - Auto ladder decides once, with pop-out on by default;
  - Galaxy hero (pop-out never over content, click-through, autonomous motion);
  - depth ordering including buckets.

  Adjusted:
  - the sidebar may carry a light anchoring surface of at most 35 % (it no longer has to be fully transparent);
  - the panel-opacity control is tested where the guard leaves room (60 % overlay);
  - 3 baselines refreshed for the border and glow.
- **Live:** see the PR description.

### 8. Remaining limitations

- Performance on GPU hardware is unmeasured. In software rendering, Full quality is 15–21 fps; Auto selects Lite or Minimal.
- The Sci-Fi README live failure on `cd7165d` could not be reproduced locally. The tone fix and the new logging are in place, and the next live run decides.
- This is 2.5D layered art: no live 3D geometry.
- Signed-in GitHub is unverified.

## 0e. 3D Overdrive: living, layered worlds with pop-out objects — latest

**Goal.** GitHub should sit inside a living 3D environment, not in front of a wallpaper. This build makes three changes to get there:
- **Moving objects:** close and mid-depth objects are now individual objects that move on their own and with the pointer, each at its own depth.
- **Pop-out layer:** some objects are drawn *in front of* the page, but only in safe regions.
- **Layered Static:** Static and reduced-motion modes keep the full layered scene, at rest.

**Honest statement of the technique.** The scenes are real 3D renders (raymarched GLSL), made offline. At runtime the page shows layered 2D planes and individually rendered 2D objects moved with CSS transforms. There is no real-time 3D geometry in the browser.

### 1. Architecture

| Part | What it does |
|---|---|
| Offline renderer (`scripts/wallpapers/render3d.js`) | Per-depth layers as before (far/mid/near/front/rays, `uLayer` 1–5). New: **sprite mode**. A shader declares `// @sprites name:WxH, …`; each sprite is rendered alone on transparency with `uLayer = 10 + index` (`--sprites`, `--sprites-only`, `--only s-<name>`). |
| Scene plane (`#repovibe-depth`, fixed, `z-index:-1`, `pointer-events:none`) | 9 layer slots (far → nearest particles), plus **scene sprites** inserted by depth: mid sprites under the light shafts, close sprites just behind the nearest particles. |
| Pop-out plane (`#repovibe-popout`, absolute in the document, `z-index:2`, `pointer-events:none`) | Objects drawn **above the page**, placed only in safe regions:<ul><li>the scene window (the band between the repository tabs and the content), cropped by the screen edges;</li><li>a side margin wider than 150 px.</li></ul>Sizes and positions are chosen at runtime (see §3). |
| Motion | **Pointer parallax.** One smoothed rAF loop writes `translate3d` on every layer and sprite, scaled by its depth factor k:<ul><li>far 0.12;</li><li>mid sprites 0.4–0.86;</li><li>close sprites 1.2–2.1;</li><li>pop-out objects 2.2–3.0 (horizontal).</li></ul>**Autonomous motion.** CSS loops on each object's image: drift/rotate paths, sky-crossing (`cross`/`crossRev`), falling leaves (`fall`), neon `flicker`, glow `pulse` and holo-ring `spin`. They use independent properties (`transform`, `rotate`, `scale`, `opacity`), so effects combine. Cinematic: about 2.3× parallax, about 1.8× drift distance, faster loops, camera drift on the layers. |
| Modes | **Static and reduced motion:** the same layered scene with sprites at rest; no animation, no pointer response, no overscan. **Ambient:** gentle parallax and autonomous motion. **Cinematic:** stronger everything. Hidden tabs pause; disable or theme change removes both planes and all listeners. |
| Controls (Studio → Appearance) | Existing: motion mode, 3D depth on/off, depth quality (Auto/Full/Lite), scene window on/off and height, readability backing, brightness, overlay, panel opacity. **New sliders:** parallax 0–200 %, animation 0–200 % (0 = still), particle density 0–100 %, foreground/pop-out 0–150 % (0 removes the pop-out plane and fades the front layer). *Restore visual defaults* resets all of them. |
| Assets | 4 worlds × (3–5 layers + 4–8 sprites), all original procedural renders. They are listed in the catalogue, so packaging verification and unit tests check every file. |

### 2. Files changed (this round)

- **Engine and settings:** `content.js` (sprite tables, sprite builder, pop-out placement, parallax loop, CSS); `shared/core.js` (`depthTuning`); `studio.html`, `studio.js` (sliders).
- **Rendering pipeline:**
  - `scripts/wallpapers/render3d.js` (sprite mode);
  - `scripts/wallpapers/shaders/common.glsl` (no vignette on sprites);
  - `cosmic-galaxy.glsl` (asteroid sprite raymarcher; baked rocks retired);
  - `enchanted-forest.glsl`, `neon-city-3d.glsl`, `scifi-ai.glsl` (sprite sets);
  - `scripts/wallpapers/build-catalog.js`, `shared/wallpaper-catalog.js` (sprites listed).
- **Packaging and evidence:** `scripts/verify-package.js`, `scripts/depth-evidence.js`.
- **Assets:** `wallpapers/depth/*/s-*.webp` (new); `wallpapers/cosmic-galaxy.webp` and its thumbnail (re-rendered).
- **Tests:** `tests/core.test.js`, `tests/e2e/depth.e2e.js`, `tests/live/github.live.js`, three refreshed baselines.

### 3. How the pop-out effect works (and why it never blocks GitHub)

Pop-out objects are drawn in a layer above the page, but only where the page has nothing to show. The placement runs on load, resize, image load and DOM changes, skipping when the layout is unchanged:
1. **Reach.** Each candidate gets its *reach*: pointer parallax (k × amplitude) plus its own drift range (Cinematic 1.8×). It must fit entirely in the scene window, never over the repository tabs above it or the content below.
2. **Sampling.** A 5 × 5 grid over the object's box, grown by its reach, is tested with `elementsFromPoint`. Any text node, link, button, input, image, icon, code, ARIA control or painted panel rejects the size.
3. **Sizing.** The largest of four sizes that passes is used; if none passes, the object is hidden.
4. **Side margins.** These are found by probing for the first text, control or panel from each side.
5. **Pointer and stacking.** The plane is `pointer-events:none`, so every click reaches GitHub. Its `z-index:2` keeps GitHub's menus, dialogs and sticky header above it.

Depth cues on pop-out objects:
- the largest parallax of anything on screen;
- a contact shadow;
- cropping by the screen edge;
- overlap with the scene window's edges, plus its own motion.

### 4. Worlds

| World | Far | Mid (moving objects) | Close / pop-out | Autonomous motion |
|---|---|---|---|---|
| **Cosmic Galaxy (hero)** | Stars, nebula, spiral galaxy, moon | Ringed planet and halo; asteroid belt of 10 individually drifting rocks, one crossing the whole sky | 2 large rocks cropped by the screen edges. Pop-out: a hero rock in front of the planet inside the scene window, a big rock at the right edge, an elongated shard at the left edge, a rock in wide left margins. | Every rock drifts and rotates on its own path. Stars twinkle at 2 depths. Bokeh drifts. Starlight breathes. Cinematic camera drift. |
| Enchanted Forest | Moonlit glade and trees | Trees at 3 depths, glowing mushroom cluster, glowing flower clusters | Pop-out: leaf sprays at both scene-window edges (wind sway), plus one in wide right margins. Falling leaves at 3 depths. | Wind sway, falling leaves, flower and mushroom glow pulse, fireflies at 3 depths, mist drift, moon shafts. |
| Cyberpunk Neon | Skyline and wet road reflections | Towers at 2 depths, holographic billboard, 2 drones crossing in opposite directions | Pop-out: big flickering neon signs at both scene-window edges and in a wide left margin | Neon flicker, rain at 2 depths, drones, haze beams. |
| Futuristic Sci-Fi | Dark cyan hall, mirrored floor, hologram core | Ribs at 2 depths, spinning holo ring, probe drones (one crossing) | Pop-out: holographic UI panels at the left edge and in wide right margins, floating data crystal at the right edge | Ring spin, panel pulse, crystal float, drones, particles, ceiling beams. |

The asteroid sprites are raymarched rocks:
- a smooth body with bump-mapped pitting and crater bowls (C1-smooth, so no outline rings);
- a side-lit terminator with self-shadowing and ambient occlusion;
- icy glints and a violet night-side rim;
- rendered at 560–1280 px, then shown at 20–260 px, so they stay sharp.

### 5–7. Evidence (committed)

Captured on a real github.com page replay (`actions/checkout`, logged out, captured locally, not committed), 1366 × 768, popup closed. Files are in `docs/screenshots/depth/`, named by world:

| File | What it shows |
|---|---|
| `<world>-ambient.jpg`, `-cinematic.jpg`, `-static.jpg` | The three motion modes. |
| `<world>-cinematic-pointer-left.jpg` / `-right.jpg` | Full-page parallax states. |
| `<world>-parallax.jpg` | Scene-band crop, pointer at the left edge vs the right edge. |
| `<world>-autonomous.jpg` | Three frames 2 s apart with the pointer held still: objects move on their own. |

**Recordings:** `docs/recordings/<world>-depth.webm`, about 12 s each: a pointer sweep in Ambient, then Cinematic.

**Home cards:** `docs/screenshots/flagship/home-before-after-variants.png`. The cards are unchanged in design: a static scene thumbnail per repository with a hover tilt and scene shift, and no live scene per card.

### 8. Performance (headless Chromium, **CPU-only compositing: no GPU in this container**)

4 s of continuous pointer motion, CDP `Performance.getMetrics` plus a rAF counter (`docs/depth-metrics.json`):

| Mode | Galaxy fps | Forest / Cyberpunk / Sci-Fi fps | Main-thread task ms/s | Script ms/s | JS heap |
|---|---|---|---|---|---|
| Static (layered, at rest) | 60 | 60 | 39–60 | ≈3 | 2.8–3.7 MB |
| Depth off (flat + live layer) | 60 | 59–60 | 59–74 | ≈3 | 2.8–3.4 MB |
| Ambient, Full | 18 | 14–15 | 66–96 | 5–7 | 3.3–3.9 MB |
| Ambient, Lite (Auto picks this below 40 fps) | 34 | 25 | 86–141 | 8–13 | 2.8–3.1 MB |
| Cinematic, Full | 23 | 17–18 | 76–125 | 6–8 | 2.9–3.0 MB |

Before this round, the same harness measured about 30 fps for Ambient Full. The extra moving objects and the pop-out layer cost frame rate under CPU compositing. The task time rises in Lite because more frames are produced.

What dominates, in this environment:
- the full-viewport particle planes: particles 0 → +15 fps;
- the number of animated layers;
- the pop-out filter shadow, which has been replaced by a gradient: +4 fps.

Main-thread script stays below 15 ms/s; layout is 0. On a GPU-composited desktop, layers are textured quads and should be far cheaper, but that is **UNVERIFIED**. Safety valves:
- Auto quality switches to **Lite** below 40 fps (fewer planes, no full-viewport animation, resting belt rocks, no pop-out shadow);
- the particle, animation and foreground sliders;
- Static keeps the layered look with zero animation.

### 9. Tests

- **Unit:** 30/30. New checks:
  - every sprite the engine references exists on disk and in the catalogue;
  - `depthTuning` normalisation and restore.
- **Offline E2E:** 55/55. New and updated:
  - Galaxy hero: at least 6 objects move with the pointer still; pop-out objects have `z-index:2` and `pointer-events:none`; nothing readable or clickable lies under any of them; clicks pass through; foreground 0 removes the plane; disable restores.
  - Depth ordering, far < mid < close sprites < pop-out, for all four worlds.
  - Static and reduced motion: layered but motionless, with no pointer response.
- **Contrast with the full scene active**, real-page replays at 1920 × 1080 (code, issues and PR list × 4 worlds × Ambient and Cinematic): 24/24 runs with **0 text elements below 4.5:1**. The minimum, 4.63, is GitHub's own header.
- **Live github.com:** see the PR description. LIVE 8 now requires at least 2 moving objects in the depth scene on every real page and logs the pop-out count.

### 10. Limitations

- **2.5D.** Layered 2D planes and objects, not live 3D geometry. Objects do not rotate in true 3D: rotation is in-plane, and the crystal "turn" is a scale.
- **Pop-out size is bounded** by the scene window: about 120–230 px tall on Standard. A *Tall* scene window gives bigger pop-out objects. Narrow screens (< 768 px) show no pop-out objects.
- **Performance** on real GPUs is unmeasured (see §8).
- **Flat fallback.** The flat Galaxy image (used with blur, uploads, or depth off) no longer bakes in asteroids.
- **Signed-in GitHub** remains UNVERIFIED (the suites never sign in).

### 11. Acceptance (this round)

| Requirement | Status |
|---|---|
| Foreground / mid / background separation, independent layers, parallax | **PASS**: 9 planes plus per-object depth; measured ordering in E2E |
| Autonomous motion (asteroids drift, stars twinkle, leaves fall, rain, holograms) | **PASS**: E2E verifies motion with the pointer still; autonomous frame strips |
| Pop-out objects in front of the page, never blocking interaction | **PASS** offline. E2E: objects shown, nothing under them, click-through. Live: pop-out count logged. |
| Galaxy hero: close rocks clearly nearer, reacts to the mouse, sharper and more dimensional | **PASS**: high-detail rock sprites, strongest parallax, contact shadows, cropped by screen edges |
| Other three worlds upgraded and distinct | **PASS** |
| Static / Ambient / Cinematic visibly different; reduced motion; hidden-tab pause; cleanup | **PASS** |
| User controls | **PASS** |
| Readability | **PASS**: 0 text below 4.5:1 in 24 real-page runs |
| Performance | **PARTIAL**: CPU-only numbers above; GPU unverified; Auto/Lite/sliders available |
| Home cards preserved | **PASS** |
| Real signed-in GitHub | **UNVERIFIED** |

## 0c. Text-only readability backing — latest

**Request.** The scene was visible, but README areas, sidebars and lists still sat behind broad panels. Backing should exist only where text exists, and empty space should stay open.

**What I found.** On the real `actions/checkout` page replay, these were the broad surfaces:

| Surface | Size | Opacity |
|---|---|---|
| README `article.markdown-body` | 840 × 8 725 px | 86 % |
| Each About/sidebar section | 272 px wide | 86 % |
| Issue / pull-request list container | 1 062–1 232 px wide | 86 % |
| Footer | full width | 86 % |
| Code-block wrappers | full README width | 30 % |

They had no backdrop blur since Crisp Immersive (v0.3.0), but they were large, nearly solid surfaces.

**Change.** A new setting, *Readability backing*, defaults to **Text only (open)**. It is in Studio → Appearance; *Full panels* restores the previous look. In the new default:

- **README / markdown.** The container is transparent. Each heading, paragraph, list item, definition, blockquote and summary gets its own compact backing that hugs the text:
  - `width: fit-content`;
  - a 6 px spread shadow in the same colour instead of padding, so the layout is unchanged;
  - rounded corners and a soft lift shadow.

  Nested inline text is never double-backed. Centred blocks stay centred. Image-only paragraphs (badge rows, logos) get no backing. Tables keep a panel-strength surface. Code blocks keep their ≥ 90 % backing, and their full-width wrapper is cleared.
- **Sidebar, About and footer.** The sections are transparent. Headings, paragraphs, links, labels and counters each get a small pill backing that is cloned per line.
- **Issue and pull-request lists** (GitHub's React list view). The list is transparent. In each row, these get their own compact backing:
  - the title;
  - the labels;
  - the metadata line (number, author, time; detected structurally by its `relative-time`, so it works for both list types);
  - the trailing counters.

  The list toolbar keeps a panel.
- **Kept as panels** (dense UI): file tables, code viewers, comment boxes, headers, menus, dialogs and the flash banner.
- **No blur.** No blur is added anywhere. The backing uses the same guard-computed alpha as other loose text: AA over the brightest pixel of the scene.

- **Runtime safety net.** Inside open containers, any visible text that no CSS rule backs gets its nearest element tagged `data-repv-text`, which receives the same compact backing. This covers text in plain `<span>`/`<div>` elements, such as the sidebar's "9.0k stars" and "202 watching". The scan runs with the panel scan, is bounded, and is removed on disable.

  **Found by the live run on `5b21748`.** On real github.com the Sci-Fi world had two sidebar stats at 1.46–1.85:1, because those plain spans had no backing. The same gap explains the LIVE 9 text checks at 1920 px for Forest and Sci-Fi; correlation and visibility passed there. Reproduced locally (1.85:1 at 1600 px) and fixed: 0 text below 4.5:1 at 1366, 1600 and 1920 px for all four worlds.

**Measured before/after** on the same real-page replays, 1366 × 768, 4 worlds × 3 pages × 3 scroll positions (`scripts/open-reading-evidence.js`, `docs/open-reading-metrics.json`). "Scene exposed" is the share of the viewport with nothing painted over the scene:

| View | Scene exposed, full panels | Scene exposed, text only | Text below 4.5:1 (text only) |
|---|---|---|---|
| Code page, top | 40 % | 44 % | 0 |
| Code page, README | 36–40 % | **57–62 %** | 0 (min 5.5) |
| Issues, top | 36 % | 53 % | 0 |
| Issues, list | 6 % | **60–64 %** | 0 (min 5.8) |
| Pull requests, top | 59 % | 60 % | 0 |
| Pull requests, list | 8 % | **54 %** | 0 (min 6.0) |

The minimum contrast on every page is 4.63–4.69:1. That is GitHub's own header text, which this change does not touch.

**Before/after images:** `docs/screenshots/open-reading/<page>-<world>-1.jpg` shows the README or list view for every world and page; `actions-checkout-code-enchanted-forest-0.jpg` shows the top of the page.

**Tests:**
- New `tests/e2e/open-reading.e2e.js` checks:
  - the README and sidebar containers have no broad backing;
  - the heading, paragraph, list item, sidebar heading and link are each backed;
  - a link inside a list item is not double-backed;
  - a paragraph's backing hugs its text, and centred blocks stay centred;
  - the space below and beside short text is fully open;
  - code and tables keep strong backing;
  - all text is ≥ 4.5:1;
  - *Full panels* restores the broad surface live;
  - disabling restores native layout.
- LIVE 9's README check now requires an open README with every text block individually backed, and AA text.
- Unit tests cover the setting's normalisation.

**Unchanged:** Home Top repositories cards, the four flagship worlds and the depth engine; the full E2E suite covers them.

**Limits:**
- The list-row hooks rely on GitHub's current React list view (`listContainer`, `listItem`, `data-listview-item-title-container`, `relative-time`). Other list markup keeps its panel, which is safe but less open.
- Light themes use light backings: the same mechanism, mirrored.
- Real signed-in pages are unverified, as before.

## 0b. Immersive depth engine (2.5D) and the missing Home repository cards — latest

This section supersedes the older notes below wherever they conflict. In particular, Futuristic Sci-Fi is no longer a white hall, and the live layers are now part of a layered depth scene.

### 1. Root cause: why Home → Top repositories showed no themed cards

The old adapter made three structural assumptions:
1. The list is `#dashboard-repos-container` / `.js-repos-container`, or sits under an `h2`/`h3` reading "Top repositories".
2. Every row is an `<li>`.
3. The art painted on that `<li>` is visible.

The signed-in dashboard is a React app, and its sidebar breaks all three:
- the heading text sits in a `<span>`/`<div>`, not a heading element;
- rows are `div[role=listitem]`, or the `<a>` itself;
- an inner row wrapper paints GitHub's opaque surface over anything on the row.

I reproduced this with two new fixture variants (`/?variant=react`, `/?variant=anchor`). The old code themed **0/6** rows on both. On the classic markup it themed rows, but the art could be hidden by inner wrappers.

### 2. Adapter changes (`content.js`)

- **List detection, in order:**
  1. legacy ids;
  2. `aria-label` / `data-testid` mentioning top repositories;
  3. any short element whose own text is exactly "Top repositories".

  The container walk-up stops before it grows wider than a sidebar (≤ max(560 px, 55 % of the viewport)), so the main feed is never matched.
- **Rows:** for each link to exactly `/owner/repo`, the row is the largest ancestor inside the list that contains no other repository. This works for `<li>`, `div[role=listitem]` and anchor rows. Inner wrapper backgrounds are neutralised only inside themed rows.
- **Card styling:**
  - rounded card;
  - per-repository wallpaper thumbnail (static, no depth engine on Home);
  - theme accent border and glow;
  - readable name on guarded glass;
  - optional hover lift with a subtle `perspective(520px) rotateX(4deg)` tilt, disabled under reduced motion.
- **Behaviour:** links and the click area are untouched.
- **Updates and restore:**
  - theme changes re-render the cards immediately;
  - SPA navigation, "Show more" and dynamic rows are handled by the existing throttled observer, home path only;
  - disabling removes every attribute and the stylesheet.
- **Diagnostics:** `GET_REPO` returns `homeCards`, which Studio → Settings → Diagnostics shows: detection method, number of repository links, rows themed, and a reason per unthemed row. Example reasons: `repository choice is "Original GitHub"`; `automatic themes are off and the global theme is Original GitHub`.

### 3. The four scenes

All four are original raymarched GLSL scenes, rendered offline (`scripts/wallpapers/render3d.js --layers`) into five 2560×1440 WebP layers each. Objects are assigned to a slab **per object instance by camera distance**, so no object is cut in half. A flat composite is kept for Static mode, uploads and fallbacks.

| World | far | mid | near | front (pop-out) | rays | particle planes (runtime) |
|---|---|---|---|---|---|---|
| Enchanted Forest | sky, distant trees, stream, glade | trees 11–27 m: trunks with root flare, branches, canopy clumps, glowing mushrooms (clipped to terrain) | trees < 11 m | leaf clusters + twigs framing the scene window | moonlight shafts | fireflies at 3 depths, mist |
| Cosmic Galaxy | stars, nebula, moon, spiral galaxy | ringed gas giant + halo + rings (alpha) | asteroid field | three close rocks at the window edges | starlight shafts | stars at 2 depths, bokeh dust |
| Cyberpunk Neon | skyline beyond 110 m, wet road with reflections of every slab | blocks 40–110 m | blocks < 40 m | two glowing neon sign boards + cables | neon haze beams | rain at 2 depths, near bokeh |
| Futuristic Sci-Fi | dark hall, mirrored floor, walls with light slots, holographic core at the end | ribs 18–42 m | ribs < 18 m | two holographic UI panels | ceiling light beams | data particles at 2 depths, near bokeh |

Sci-Fi was reworked from a bright, plain white corridor into a dark hall with cyan-lit ribs, a strong hologram and reflections. Its preset palette is now dark, with light text, to match.

### 4. How the depth system works (technical, honest)

**This is layered 2.5D, not real-time 3D geometry.** The scenes are 3D when rendered offline. In the browser they are 9 flat planes moved at different rates. Nothing is re-rendered from a new camera position, so there is no true perspective change or disocclusion beyond what the slab edges give.

- **Container:**
  - one `<div id="repovibe-depth" aria-hidden="true">`, a sibling of `<body>`;
  - styled `position:fixed; inset:0; z-index:-1; pointer-events:none; contain:strict`;
  - layers in order: far · pfar · mist · mid · pmid · near · rays · front · pnear, then the readability veil;
  - each layer is 112 % of the viewport, so edges never show.
- **Parallax:**
  - a passive `pointermove` listener feeds a smoothed rAF loop (factor 0.1/frame; the loop stops once settled);
  - it writes `translate3d` directly on each layer;
  - layer factor k (far 0.12 → pnear 2.1) × amplitude (Ambient 13 px, Cinematic 30 px);
  - only `transform`/`opacity` ever change.
- **Cinematic** adds:
  - a slow camera drift (`repv-cam`, 26 s, translate + scale weighted by k);
  - swaying foreground (`repv-sway`);
  - breathing light shafts.
- **Pop-out without interference:**
  - foreground objects are art inside the fixed scene layer, below all page content (z-index −1);
  - they are placed at the edges of the scene window, so they never cover text, buttons, links, editors, menus or modals, and never receive pointer events. Tests check `elementFromPoint`.
  - "Overlapping the window's border" means the leaves, signs, rocks and panels extend past the scene window into the page margins. They are still behind every panel.
- **Fallbacks:** the sharp flat scene is used for:
  - Static mode;
  - `prefers-reduced-motion` (CSS `display:none` and JS);
  - "3D depth" off;
  - uploads, blur > 0, non-cover/center positioning;
  - non-repository pages. **Home never runs the engine**; its cards use static thumbnails.
- **Lifecycle:**
  - hidden tabs get `repv-depth-paused` (all animations paused) and the rAF loop is cancelled;
  - disabling, or switching to a theme without depth, removes the container, classes and listeners;
  - the covered flat parallax layer stops animating.
- **Settings:**
  - popup: *3D depth* toggle;
  - Studio → Appearance: *3D depth effects*, *Depth quality* (Auto / Full / Lite) and *Scene window height* (Compact / Standard / Tall), plus the existing scene-window on/off;
  - *Restore visual defaults* resets the height;
  - **Auto** measures the frame rate for 2 s after the scene settles and switches to **Lite** below 40 fps;
  - **Lite** hides the three extra particle/mist planes and per-layer animations.

### 5–7. Evidence (committed)

- **Each world**, captured on the real github.com `actions/checkout` page replay (logged out, captured locally, not committed), at 1366×768 with the popup closed:
  - `docs/screenshots/depth/<world>-ambient.jpg`
  - `docs/screenshots/depth/<world>-cinematic.jpg`
  - `docs/screenshots/depth/<world>-static.jpg`
- **Parallax proof:** `docs/screenshots/depth/<world>-parallax.jpg` shows the scene band with the pointer at the left edge versus the right edge. The foreground and near trees, rocks, signs and ribs shift visibly; the distant layers barely move.
- **Recordings:** `docs/recordings/<world>-depth.webm`, about 12 s each at 960×540: a pointer sweep in Ambient, then Cinematic.
- **Measured layer displacement**, full left→right sweep at 1366 px (`docs/depth-metrics.json`), identical across worlds by design:

  | Layer | far | pfar | mist | mid | pmid | rays | near | front | pnear |
  |---|---|---|---|---|---|---|---|---|---|
  | Ambient (px) | 3.0 | 6.6 | 8.1 | 12.2 | 17.8 | 14.0 | 25.4 | 41.9 | 53.3 |

  Cinematic measured ≈ 2.3× more (front 93 px).
- **Home before/after:** `docs/screenshots/flagship/home-before-after-variants.png` compares the old adapter on the React sidebar (0/6 rows) with the new adapter on the React, anchor and classic markup (6/6 each, art visible on all 6). Also `home-top-repositories-react.png` and `-anchor.png`.

### 8. CPU/GPU findings (headless Chromium, software compositing, no GPU in this container)

Measured with CDP `Performance.getMetrics` and a rAF counter during 4 s of continuous pointer motion at 1366×768 (`docs/depth-metrics.json`):

| Mode | fps | main-thread task ms/s | style ms/s | JS heap |
|---|---|---|---|---|
| Static (flat) | 60 | 22–26 | ≈1 | 2.6–2.8 MB |
| Depth off, Ambient (flat + live layer) | 60 | 30–46 | ≈5 | 2.6–3.3 MB |
| Depth Ambient, Full | 29–30 | 53–55 | ≈9.5 | 3.4–3.9 MB |
| Depth Ambient, Lite | 32–36 | 48–56 | ≈8.5 | 3.6–3.9 MB |
| Depth Cinematic, Full | 21–24 | 49–54 | ≈11 | 3.1–3.4 MB |

**Interpretation:**
- Main-thread work stays small: about 5 % of a core, layout 0, script < 2 ms/s.
- The frame rate here is limited by **software compositing**, since this container has no GPU. Each frame blends 9 viewport-sized alpha planes on the CPU.
- On a GPU-composited desktop browser these are plain textured quads and should be far cheaper. That is **UNVERIFIED**: I had no GPU hardware to measure on.
- Two optimisations came out of this profiling:
  - dropping `mix-blend-mode` on the rays layer;
  - writing per-layer transforms instead of a cascading custom property.

  Together they took Ambient from 24–25 fps to 29–30 fps here.
- The Auto quality setting exists for slow machines.

### 9. Test results

| Suite | Result |
|---|---|
| Unit (`npm test`) | 29/29 (new: depth/scene-height/quality config normalisation and restore; flagship depth layers declared and present on disk) |
| Offline E2E (`npm run test:e2e`) | see the latest run in the PR description; the new `tests/e2e/depth.e2e.js` covers:<ul><li>layers present and loaded at full resolution;</li><li>parallax ordered far < mid < near < front < pnear;</li><li>stronger in Cinematic;</li><li>`pointer-events:none`, `z-index:-1`, link hit-testing, no horizontal scroll;</li><li>transform/opacity-only animation;</li><li>Lite/Full;</li><li>Static, depth off and reduced motion fall back to the flat scene;</li><li>scene-window heights;</li><li>no depth scene on Home;</li><li>restore on disable;</li><li>all four worlds.</li></ul>Home variants: React and anchor sidebars (6/6 rows, art visible, sync, Show more, exact DOM restore, click-through). |
| Contrast with the engine active (real-page replay; code, issues and PR list × 4 worlds × Ambient and Cinematic, `MOTION=… scripts/measure-snapshots.js`) | 24/24 runs: **0 text elements below 4.5:1**, minimum 4.63 |
| Package | 98 files, 30 wallpapers, 20 depth layers, permissions unchanged (`storage`, `https://github.com/*`), ZIP ≈ 7.7 MB |
| Live github.com | see the PR description (the run is triggered by this push) |

Changed test semantics, stated openly:
- **Scene-visibility metric.** `sceneMetrics` now also reports correlation over the *exposed* scene blocks. The crisp and scene tests assert exposed correlation ≥ 0.8 (measured 1.00 for all four) and keep a full-frame floor of 0.3. The full-frame correlation mixes in the panel layout. With the darker re-rendered forest (0.44) and sci-fi hall (0.35), that dominates over the scene itself, which is still pixel-identical where exposed.
- **Flagship test.** It now expects the depth scene in Ambient. The flat live-layer test runs with depth off, since that is the path Static, depth-off, uploads and blur use.
- **Sci-Fi palette.** The tests that expected Sci-Fi to be the light world now expect a dark world.
- **Baselines.** Four were regenerated after inspection:
  - popup: new 3D-depth row;
  - gallery: new Sci-Fi thumbnail;
  - `repo-galaxy-saved`: re-rendered galaxy.

### 10. Accessibility

- The scene is `aria-hidden`, never focusable, and never intercepts input.
- Reduced motion removes the engine entirely (CSS and JS).
- Text measured AA (≥ 4.5:1) everywhere on the real-page replays with depth active.
- On Home the lowest card-name contrast is 4.65:1, on the React variant; it is 6.5:1 on classic and anchor.
- Forced-colors and `prefers-contrast: more` remove card art, as before.
- The depth container has no text, so screen readers are unaffected.

### 11. Limitations

- This is 2.5D layered artwork, not live 3D: there is no true camera translation, and parallax happens in the plane.
- Real-GPU performance is unmeasured (see §8).
- **Real signed-in GitHub Home is UNVERIFIED.** The suite never signs in. The adapter is structural and covers the three markup families seen so far, but a future GitHub markup can still defeat it; Diagnostics then explains why.

  **Minimal user-side check:** reload the extension, open github.com signed in, then open Studio → Settings → Diagnostics → *Check*. The line `Home · Top repositories found via … N/N rows themed` should appear. Alternatively, in DevTools run:

  ```js
  document.querySelectorAll('[data-repv-card]').length
  ```

  It should equal the number of rows.
- Recordings and screenshots come from a logged-out real-page replay and the offline fixtures, not a signed-in session.
- Depth layers add about 3.7 MB to the extension.

### 12. Acceptance matrix (final criteria A–F)

| Criterion | Status | Evidence |
|---|---|---|
| A. Home shows per-repository miniature wallpapers | **PASS** on the authenticated-page fixtures (classic, React, anchor: 6/6, art visible) · **UNVERIFIED** on real signed-in GitHub | flagship E2E (3 variants), before/after image |
| B. A click opens the matching environment | **PASS** (fixture: click-through, page theme equals card theme) | flagship E2E |
| C. Convincing sense of depth | **PASS** as layered 2.5D: 9 planes, measured parallax 3 → 53 px, occluding foreground, haze and shafts. Not real-time 3D. | depth E2E, parallax images, recordings |
| D. Demonstrable cinematic motion | **PASS**: Cinematic camera drift, sway and breathing shafts, ≈2.3× parallax | depth E2E, recordings |
| E. No functional interference | **PASS**: `pointer-events:none`, hit tests, no horizontal scroll, AA text with depth on, Home untouched by the engine | depth E2E, contrast runs |
| F. Responsive, readable, stable | Readable/stable: **PASS**. Performance: **PARTIAL**, ~30 fps in software-only headless Chromium; GPU desktop UNVERIFIED; Auto/Lite available. | §8 |
| Static / Ambient / Cinematic differ visibly; reduced motion; hidden-tab pause; release on disable | **PASS** (offline). Hidden-tab pause is implemented but not covered by an automated test. | depth E2E |
| No new permissions, data-only themes, original assets | **PASS** | verify:package, `wallpapers/LICENSE.md` |

### 13. PR and commit

PR #2: https://github.com/naman-dev-00/RepoVibe/pull/2. The latest SHA and the live-run result are in the PR description, since a commit cannot quote its own hash.


## 0a. Visual redesign: Crisp Immersive (v0.3.0), replacing the blurred, frosted default

**Report.** On a real logged-in account the previous fix still looked like recoloured GitHub, because transparency, blur and dimming effects obscured the scenes.

The screenshot mentioned in the request did not reach this session. Diagnosis therefore used controlled A/B renders of real github.com pages (offline replay of captured real pages) and real-site runs.

**What obscured the art.** One factor was changed at a time on the real Code page (Enchanted Forest, 1366×768).

| Layer | Finding |
|---|---|
| Panel `backdrop-filter: blur(8px) saturate(1.1)` | Applied to **11 surfaces**: the 904×942 file table, the header strips and five sidebar sections. It turned roughly 40 % of the viewport into frosted glass. This was the main cause. |
| Global overlay 12 % + brightness 92 % | A second dimming layer over the whole scene. |
| Wide halo text-shadow (up to 16 px) on loose text | Dark glows over the scene around titles. |
| Exposed area | Only **16 %** of the 1366 px Code page showed the scene with nothing over it. Even a perfectly crisp scene was only glimpsed. |
| Wallpaper blur | 0 by default (not a cause); a blurred body copy only exists when chosen. |
| README surface | **Bug found:** `article.markdown-body` also has `container-lg`, so the transparent-shell rule overrode its panel. README text sat directly on the scene. |
| Footer, pagination, disabled controls | No surface below the fold. GitHub's disabled-text colour fell below native contrast on scene themes. |

**New design system** (`content.js`, `shared/core.js`):

1. **Crisp Immersive is the default.**
   - Wallpaper blur 0, panel backdrop blur 0, native brightness (100 %), overlay 6 % (4 % on light themes).
   - The scene is painted once, as the fixed root background, at native sharpness. There is no dimming veil beyond the minimal overlay and no blurred copy.
2. **Clean reading panels:**
   - Nearly solid (86–88 %, readability-guarded) with a hairline edge and a soft shadow instead of frost.
   - One layer only; nested panels are transparent.
   - The README, footer and pagination are now panels. GitHub's disabled-text colour is derived from the theme, never worse than native.
3. **Scene window:** a transparent band (clamp 140 px – 27 vh – 320 px; 72 px on phones) between GitHub's repository tabs and the repository content.
   - The scene shows there at full native sharpness.
   - Nothing is covered or moved out of reach; the content simply starts lower.
   - It can be switched off in the popup and in the Studio.
4. **Three appearance presets** for the built-in themes (`config.appearance`). Each sets the six visual controls explicitly; none couples them afterwards. Custom themes keep their own values.

   | Preset | Wallpaper blur | Panel backdrop blur | Overlay | Brightness | Panel opacity (chosen) |
   |---|---|---|---|---|---|
   | **Crisp Immersive** (default) | 0 | 0 | 6 % | 100 % | 86 % |
   | Balanced | 0 | 0 | 32 % (comfort) | 85 % | 96 % |
   | Frosted Glass (opt-in) | 0 | 18 px + sheen | 10 % | 96 % | 52 % |

   The readability guard models the Frosted sheen. On dark scenes it raises Frosted panels to about 0.9 so text stays AA, and the Studio shows that change.
5. **Independent controls**, as labelled in the Studio: wallpaper blur, panel backdrop blur, wallpaper brightness, wallpaper opacity, overlay darkness and panel opacity.
6. **Upgrades and diagnostics:**
   - Older stored settings without `appearance` become Crisp Immersive for the built-in themes.
   - **Studio → Settings → Restore visual defaults** resets the appearance, and the six visual controls of every custom theme, to Crisp values. Repository, owner and automatic assignments, wallpapers (including IndexedDB uploads), colours and names are kept.
   - **Diagnostics** (Studio → Settings) report what is *actually running* in the GitHub tab: version, a second RepoVibe copy active on the page (duplicate installations), stylesheet size, scene on the page background, appearance, scene window, and the effective blur / overlay / brightness / chosen vs rendered panel opacity.
   - The popup footer shows the installed version.

**Before → after** on the same real github.com page: `docs/screenshots/flagship/crisp-before-after-1366.jpg`.

**Visual inspection, per theme** (Crisp Immersive default, real Code page, 1366×768, offline replay of real github.com):

| Theme | Environment recognisable? | Visible artwork sharp? | What still covers the scene | Contrast / navigation |
|---|---|---|---|---|
| Cyberpunk Neon | Yes: neon tower canyon, signs, light trails in the scene window and margins | Yes | File table, About sidebar, header strips (readable panels) | AA; GitHub navigation untouched |
| Enchanted Forest | Yes: trunks, misty clearing, fireflies, glowing ground plants | Yes | Same | AA |
| Cosmic Galaxy | Yes: ringed planet, moon, asteroids, stars | Yes | Same | AA |
| Futuristic Sci-Fi | Yes: the arched white hall and corridor | Yes; the light, restrained scene is the most subtle | Same | AA |

**Measured.**
- **Readability:** screenshot-measured text contrast on real Code / Issues / Pull request pages, including **two screens below the fold** (README, footer, pagination). 1366×768 and 1920×1080 for the four worlds, and all **20 presets** at 1600×900. Every combination has **0 text elements below 4.5:1**. The single exception is GitHub's *disabled* "Previous" pagination button on the light Sci-Fi theme, at 3.58:1. Inactive controls are exempt from WCAG 1.4.3, and native GitHub renders it at 3.57:1. Balanced and Frosted Glass: 0 below 4.5:1 on all 12 flagship page combinations.
- **Sharpness:** on the layout fixture, exposed-scene edge energy measures 1.15–1.62 vs 0.10–0.28 for the same page with a 6 px wallpaper blur.
- **Exposure:** 51 % of the viewport shows the scene with nothing over it, against 16 % on the pre-redesign real Code page.

**Limits (honest).**
- Artwork physically covered by readable panels cannot be fully visible. In Crisp Immersive the panels are clean and nearly solid, so the scene shows where it is exposed: the scene window, gaps and margins.
- On dense lists at 1366 px that is mainly the scene window and the margins.
- The Forest band shows the trunks, mist and fireflies. The glowing ground plants appear lower, around the content.
- Your logged-in pages remain UNVERIFIED by the automated suites, which never sign in. Use Studio → Settings → Diagnostics in your browser to confirm the version, the absence of a duplicate installation, and the effective values.

**Live result on real github.com (logged out), commit `0e7dc25`** ([run 41772640412](https://github.com/naman-dev-00/RepoVibe/actions/runs/41772640412)): **15/15 tests, 238 PASS, 0 FAIL, 0 BLOCKED**. CI is green on the same commit (27 unit, 49 E2E).

Crisp Immersive by default, on every real Code / Issues / Pull request page for all four worlds:

| Check | Result |
|---|---|
| RepoVibe backdrop blur | **None**: 4 blurred elements, exactly native GitHub's own (logged-out header buttons) |
| Blurred wallpaper copy | None |
| Scene window | 207 px at 1366 px; 292 px at 1920 px |
| Exposed scene | **35–66 %** of the viewport, against 12–23 % in the frosted build and 0 % before the P0 fix |
| Sharpness of the exposed scene | 1.12–2.03, against 0.12–0.41 for a 6 px-blurred control on the same page |
| README | Readable panel (theme surface at 0.86–0.88); text 6.4–9.1:1 |
| Text | 0 elements below 4.5:1 and none below native |
| Diagnostic configuration | Uncovered 33 %, sharpness ≈ 1.0 |
| Live motion and restore | PASS |

The three presets on the real page:
- Backdrop-blurred elements: Crisp 4 and Balanced 4 (both native GitHub's own), Frosted 17.
- Pixel differences: Crisp vs Balanced 23.3 %, Crisp vs Frosted 11.1 %, Balanced vs Frosted 32.0 %.

**One real defect found and fixed in this round (CI):** a fresh-install race could drop the four seeded default mappings. A GitHub tab persisting its automatic pick could write back a config read just before seeding. The service worker now records seeding separately and re-applies only the missing mappings. The previously intermittent test then passed 8/8.

Live screenshots, inspected:
- `docs/screenshots/flagship/live-github-crisp.jpg`: Code, Issues and README at 1366 for each world.
- `docs/screenshots/flagship/live-github-appearance-presets.jpg`: Crisp, Balanced and Frosted on the same real page.

| World | Code (scene window) | Issues | README |
|---|---|---|---|
| Enchanted Forest | Trunks, mist, fireflies | Forest band above the list | Glowing ground plants and trunks beside a solid README panel |
| Cosmic Galaxy | Ringed planet, moon, asteroids, spiral galaxy | Planet and moon above the list | Planet, rings and asteroid around the README |
| Cyberpunk Neon | Neon tower canyon, signs, light trails | Towers above the list | Towers and neon on both sides |
| Futuristic Sci-Fi | Arched white hall, corridor | Arches above the list | Hall columns either side of a crisp white README |

Every environment is recognisable at a glance on the real site.

**Tests added.**
- `tests/e2e/crisp.e2e.js` (7 tests):
  - Crisp by default from a pre-redesign config, per flagship: **zero elements with backdrop blur**, no blurred wallpaper copy, scene window ≥ 140 px, single panel layer with no nested glass, ≥ 25 % exposed, sharpness ≥ 1.6× a blurred control, AA text.
  - The presets are visibly different, and only Frosted blurs.
  - Independent controls.
  - Popup appearance and scene-window switches act on the page, and the version is shown.
  - Studio **Restore visual defaults** keeps assignments, wallpapers, colours and names; **diagnostics** show the effective values.
- 3 unit tests.
- Live: LIVE 9 now also checks Crisp (no RepoVibe backdrop blur, no blurred copy, scene window, sharpness vs a blurred control, README surface and AA) and the three presets on real github.com.

## 0. P0 defect: "actual wallpapers are invisible on GitHub" — root cause, fix, evidence

**Reported:** on a real, logged-in GitHub account the four flagship themes changed only the interface colours. The forest and the galaxy were not recognisable.

**Diagnosis.** It was confirmed on real github.com, not assumed:
- `tests/live/diagnose.live.js` samples the layer stack (`elementsFromPoint` with each element's computed background) and checks that the image decodes.
- It captures MHTML snapshots of real Code / Issues / Pull request pages.
- `tests/e2e/real-snapshot.js` replays those snapshots offline, with GitHub's real DOM and CSS.

**The snapshots stay local.** They contain GitHub-owned CSS and content, so they are gitignored and never committed.

| Hypothesis | Finding |
|---|---|
| Wallpaper behind an opaque root background | **No.** `body::before` (z-index −1 in the root stacking context) painted *above* `<html>`'s background, and the image decoded at 2560×1440. |
| Asset URLs not resolving | **No.** The `chrome-extension://…/wallpapers/*.webp` images loaded on github.com. |
| Glass making the interface effectively opaque | **Yes, root cause.** See below. |

**Root cause.** GitHub's current React layout wraps the whole page in `.prc-PageLayout-PageLayoutWrapper-*`, which is 1366 px wide at 1366 px. The old "content column" selector `[class*="PageLayout-PageLayoutWrapper"]` matched it. So everything below the header sat under **60–90 % guarded glass plus `backdrop-filter: blur(12px)`**:
- Inner "muted" surfaces stacked further layers on top (e.g. `bgColor-muted` boxes at 0.74).
- The defaults also dimmed the art (brightness 80 %, overlay 20 %).

The scene was reduced to a blurred colour wash. The old offline fixture used a narrow `.container-xl` column and never reproduced this.

**Fix: new rendering model (`content.js`).**
1. **The scene is painted as the fixed root background** of `<html>`. It sits on the canvas under every element, with no negative z-index.
   - Opacity, overlay darkness and brightness are colour veils in the same background stack, so every slider changes visible pixels.
   - Blur, and Cinematic parallax, use a `body::before` copy above it. The root layer remains as the fallback.
2. **Page shells and GitHub's surface tokens are transparent**, so nothing stacks.
3. **One layer of guarded glass, on targeted panels only:**
   - header strips and side navigation;
   - the bordered boxes and rounded list containers GitHub draws (file table, README, issue/PR lists, comment cards).

   GitHub's class names are hashed, so these are **detected at runtime from computed styles** and tagged `data-repv-panel`. The tags are removed when RepoVibe is inactive or disabled. Panels nested inside panels are transparent. Gaps between panels show the scene at full strength.
4. **Loose text outside panels** (repository title, About, toolbar links, badges, invisible buttons) gets a small guard-computed backing plus a halo.
   - GitHub's semantic colours (success, danger, attention) are raised for contrast.
   - Label chips get a theme-tone wash.
   - The logged-out marketing header, whose text is always white, keeps a dark backdrop.
5. **Readability guard (`RepoVibeCore.panelOpacity`)**:
   - Single-layer model with a 4.8:1 target (0.3 above AA).
   - Loose items are guarded against pure white.
   - It reports when it raises the user's panel opacity, and the Studio says so explicitly (no silent opaque panels).
   - New **Scene visibility** presets: Immersive / Balanced / Readable.
6. Flagship palettes use lighter secondary and accent colours, so less glass is needed:

   | Theme | Panel opacity before → after |
   |---|---|
   | Cyberpunk | 0.86 → 0.65 |
   | Galaxy | 0.78 → 0.65 |
   | Sci-Fi | 0.72 → 0.62 |

**Evidence: real github.com pages replayed offline** (`actions/checkout` Code / Issues / Pull requests).

| Measure (four flagships) | Before (pre-fix renderer) | After |
|---|---|---|
| Correlation of page luminance structure with the wallpaper itself, 1366×768 | −0.03 … 0.50 (cyberpunk ≈ 0, forest 0.14–0.19) | 0.32 … 0.70 |
| Same, 1920×1080 | — | 0.49 … 0.77 |
| Viewport showing the scene unobstructed, 1366×768 | **0 %** | 12–37 % (lists … code) |
| Same, 1920×1080 | — | 23–50 % |
| Text contrast (screenshot-measured, 109–144 elements per page) | — | **min 4.52–4.63:1, 0 below 4.5:1**, identical to native GitHub's own minimum on these pages |

Before/after on the real Code page at 1920×1080: `docs/screenshots/flagship/real-github-before-after-1920.jpg`.

**Visual inspection (stated explicitly).** In every "after" image the scene is recognisable without the gallery:
- **Cyberpunk Neon:** the neon tower canyon and signs.
- **Enchanted Forest:** trunks, the glowing ground plants and the clearing.
- **Cosmic Galaxy:** the ringed planet, asteroids, stars and the spiral galaxy.
- **Futuristic Sci-Fi:** the white arched hall.

In every "before" image only the tint is recognisable.

**Honest limits.**
- On dense list pages at 1366×768, the Issues and Pull request lists fill most of the viewport. There the scene shows in the header band, gaps and margins, and at about 35–42 % through the single glass layer. It is recognisable, but less dominant than on the Code page or at 1920 px.
- The **Readable** preset trades scene for calm. **Immersive** removes the overlay, and the guard still keeps text at AA.
- Logged-in pages were not tested: the suite never signs in. Their layout uses the same `prc-PageLayout` wrappers and bordered boxes, which the runtime detection targets, but **real logged-in visuals remain UNVERIFIED**.

**Regression tests.**
- `tests/e2e/scene.e2e.js` (6 tests) runs on `fixture-layout.html`, which reproduces GitHub's current React structure. It checks:
  - recognisability (correlation ≥ 0.45, diagnostic config ≥ 0.6);
  - unobstructed area ≥ 45 % and median transmission ≥ 0.6;
  - **never more than one glass layer**;
  - ≥ 30 % of pixels changed vs the same theme in solid colour;
  - AA text;
  - every control changing the pixels (opacity, overlay, brightness up/down, blur, position, size, panel opacity, glass blur);
  - repository switching;
  - pixel-exact restore on disable.
- **These tests fail on the pre-fix renderer.** Measured: correlation 0.38–0.52, median transmission 0.27–0.44, stacked glass down to 0.10.
- **LIVE 9** repeats the visibility, contrast, diagnostic-config, motion and restore checks on real github.com at both resolutions.

**Live result on real github.com (logged out), commit `e85e736`** ([run 41715797905](https://github.com/naman-dev-00/RepoVibe/actions/runs/41715797905)): **14/14 tests, 206 PASS, 0 FAIL, 0 BLOCKED**. CI is green on the same commit.

LIVE 9 per world, on Code / Issues / Pull requests:
- **Text:** every page check passed. A check passes only with 0 text elements below 3:1 and no more below 4.5:1 than native GitHub.
- **Diagnostic configuration and live motion:** passed for all four worlds, with no RepoVibe console errors.
- **Restore:** passed: no classes, styles, panel markers or root image remain.

| World | Correlation with the scene, 1366 / 1920 | Unobstructed viewport, 1366 / 1920 | Pixels changed vs solid colour |
|---|---|---|---|
| Cyberpunk Neon | 0.32–0.38 / 0.52 | 12–26 % / 42 % | 43–62 % |
| Enchanted Forest | 0.35–0.42 / 0.51–0.53 | 12–26 % / 23–42 % | 45–63 % |
| Cosmic Galaxy | 0.68–0.70 / 0.74–0.77 | 12–26 % / 23–42 % | 52–62 % |
| Futuristic Sci-Fi | 0.40–0.48 / 0.57 | 12–26 % / 42 % | 19–40 % |

For comparison, the pre-fix renderer scored −0.03 … 0.50 correlation and 0 % unobstructed.

Live screenshots: `docs/screenshots/flagship/live-github-scenes.jpg` (Code at 1920×1080 and Issues at 1366×768 per world).

**Visual inspection of the live screenshots:**

| World | Code page, 1920×1080 | Issues page, 1366×768 |
|---|---|---|
| Cyberpunk | Neon tower canyon, signs and the wet road | Towers and signs in the top band and at the right edge |
| Forest | Trunks, glowing ground plants, the clearing | Trunks and plants |
| Galaxy | Ringed planet, asteroids, spiral galaxy, stars | Planet arc behind the list |
| Sci-Fi | The arched white hall | Arches visible but subtle (the weakest case) |

All four are recognisable without the gallery.

The first live runs also found **one real defect**, now fixed and verified live: with the vivid Sunset Boulevard scene at 1600 px, About-sidebar stats and links dropped to 2.0–2.9:1. Sidebar sections are now panels, and counters and inline code have backings. On the real-page replay all 20 presets then meet AA on the Code page.

Harness fixes made along the way:
- Token-set detection now uses a token RepoVibe never overrides.
- Visually-hidden text is excluded from contrast measurement.
- LIVE 9 moved to its own file within the time budget.

## 1. Architecture

| Area | Implementation |
|---|---|
| Flagship themes (`shared/core.js`) | Presets get `flagship` and `motion` fields. `preset-1` **Cyberpunk Neon** (rain), `preset-8` **Enchanted Forest** (fireflies; was *Forest Retreat*), `preset-15` **Futuristic Sci-Fi** (holo; was *Minimal White*), `preset-19` **Cosmic Galaxy** (stars; was *Galaxy*). Preset ids are unchanged, so existing assignments keep working. The set still has 20 presets, so automatic picks stay stable. |
| 3D artwork | New raymarched GLSL scenes, rendered offline to 2560×1440 WebP plus thumbnails: `enchanted-forest`, `cosmic-galaxy`, `scifi-ai`. Cyberpunk keeps `neon-city-3d`. The earlier `alien-world` stays selectable in the Studio. |
| Default mappings | `DEFAULT_REPO_MAPPINGS` (tradPro → Cyberpunk, RepoVibe → Forest, Pool-Souls → Galaxy, ai-powered-inbox-assistant → Sci-Fi). The service worker seeds them **once** on install/update (`seedDefaultMappings`, `seededMappings` flag). Existing user choices are never replaced. After seeding they are ordinary manual assignments, and removing one sticks. |
| Live wallpapers (`content.js`) | Two fixed pseudo-element layers, `html::after` and `body::after`, with `pointer-events:none` and `z-index:-1`. They sit between the wallpaper and the page, so no DOM is injected. Only `transform` and `opacity` are animated. Rain, fireflies and stars are seeded procedural **SVG particle tiles** (data: images). Holo is a CSS grid plus a scan band. The Cyberpunk layer also has neon flicker and fog drift. Classes `repv-motion-<kind>` and `repv-motion-cinematic` sit on `<html>`. Config `motionMode`: **Static / Ambient (default) / Cinematic**, where Cinematic is faster and adds slow wallpaper parallax. `prefers-reduced-motion` turns it off in both JS (`motionFor`) and CSS (`animation:none`), and the extension reacts live to changes. |
| Home cards (`content.js`) | On `/` and `/dashboard`, the script finds `#dashboard-repos-container` or `.js-repos-container`. If neither exists, it falls back to the container of a "Top repositories" heading. It styles only `<li>` rows that hold a link to exactly `/owner/repo`. Each row gets `data-repv-card="<theme id>"`. One `<style id="repovibe-cards-v1">` holds a per-theme rule: the wallpaper **thumbnail** behind theme-coloured glass, with the alpha set by the readability guard (`requiredGlass`, ≥ 4.6:1). The art is fully visible on the right edge, where no text sits. The theme comes from `themeResolution`, the same function the repository page uses. Unpersisted automatic picks are stored in one ordered batch, so a card and its repository page always match. The cards re-render on config changes, SPA navigation and dynamic rows (the existing rAF-throttled observer, home path only). Under forced-colors or `prefers-contrast: more` the art is removed. Under reduced motion there is no hover animation. Disabling removes every attribute and the stylesheet. |
| UI | Popup: the four flagships come first in quick themes, plus a *Live wallpaper* Static/Ambient/Cinematic control with a status line ("Fireflies · ambient", "Off: system prefers reduced motion"). It already showed the repository, the active theme and manual vs automatic. Studio: flagships come first with a `◉ LIVE · <KIND>` badge, and Settings has a motion selector. |
| Permissions | Unchanged: `storage` and `https://github.com/*`. No new fetching; the cards use bundled thumbnails or already-stored IndexedDB images. |

## 2. Theme status (honest)

| Theme | Artwork | Live layer | Assessment |
|---|---|---|---|
| Cyberpunk Neon | 3D neon rain canyon: towers, signs, wet reflections, fog | rain (two depths) + neon flicker + fog drift | **Complete** |
| Enchanted Forest | 3D moonlit forest: bent trunks, glowing plants, stream, teal haze, fireflies, foreground leaves | fireflies (two depths) + mist | **Complete**. Procedural CG; the trunks and stream are simpler than hand-painted concept art. |
| Cosmic Galaxy | 3D ringed gas giant, moon, lit asteroids, volumetric nebula, spiral galaxy, stars | twinkling stars (two depths) + nebula drift | **Complete** |
| Futuristic Sci-Fi | *(superseded by §0b: now a dark cyan-lit hall with depth layers)* 3D white arched hall, cyan light strips, glossy floor, holographic core | holographic grid + scan band | **Complete but restrained**. Clean and minimal as asked; the holographic rings are faint, so the scene reads as bright and airy rather than dramatic. |

None of the four is a flat gradient. All are original work (`wallpapers/LICENSE.md`); no third-party or copyrighted art. "Moving branches" or leaves are **not** implemented. The forest's motion is fireflies and mist only.

## 3. Evidence

- The four repository pages (offline fixture, 1600×900, live layer frozen at 1.5 s): `docs/screenshots/flagship/flagship-repos.jpg` and `repo-*.jpg`.
- Home Top repositories, before/after (authenticated-page fixture): `docs/screenshots/flagship/home-top-repositories-before.png`, `-after.png`, `-light.png`, plus the full page `home-dashboard.jpg`.
- Real github.com: LIVE 8 logs the screenshots `flagship-<theme>-overview|issues` (see §5).

## 4. Tests (offline)

| Suite | Result |
|---|---|
| Unit (`npm test`) | 23/23 (3 new: flagship definitions + guard, seeded mappings incl. "user choice wins" and "removal sticks", motion modes / reduced motion / normalization) |
| Offline E2E (`npm run test:e2e`) | 36/36 (32 existing + 4 new in `tests/e2e/flagship.e2e.js`) |
| Package | MV3 v0.2.0, 78 files, 30 wallpapers (10 3D), permissions unchanged |

The new E2E tests cover:
- the fresh-install mappings across all four repository pages, each with its own world, live layer, persistence across refresh, no text < 3:1 and clickable links;
- Static/Ambient/Cinematic, reduced motion, persistence, transform/opacity-only animation and `pointer-events:none`;
- Home: different rows show different themes, unconfigured rows get the stable persisted automatic theme (equal to their page), only Top repositories rows are styled, name contrast, update → preview without reload, "Show more" rows, forced-colors and more-contrast, reduced motion, disable → DOM identical and pixel-identical to an extension-free baseline, and a click opening the themed repository;
- light mode.

Changes to existing tests (semantics, not weakening):
- The `setConfig` helper defaults legacy-style configs to motion **Static**, so earlier pixel measurements stay deterministic. Snapshots use `animations: 'disabled'`.
- One fresh-install assertion now expects the four seeded mappings.
- The popup baseline test now waits for seeding and checks the manual mapping ("Enchanted Forest", "Manually assigned", "Fireflies · ambient") and an automatic one.
- Five snapshot baselines were regenerated because the artwork and UI changed on purpose (Galaxy art, gallery order and badges, popup motion section).

## 5. Live github.com

LIVE 8 (GitHub Actions, logged out, no credentials) checks:
- the seeded mappings;
- each mapped repository if it is publicly visible (otherwise recorded as INFO and UNVERIFIED live);
- each of the four worlds on `actions/checkout` overview and issues: live layer running, pointer-events none, screenshot contrast, link hit test;
- reduced motion and Static on the real page;
- the logged-out Home being an untouched no-op.

Run on `cc11cd1` ([run 41672652490](https://github.com/naman-dev-00/RepoVibe/actions/runs/41672652490)): 6/8 scenarios passed. The two failures were **test-harness defects**, both fixed in the next commit:
1. LIVE 7 expected a fresh profile to hold no manual assignments. Fresh installs now hold the four seeded mappings, so the check now looks only at the repositories under test.
2. LIVE 8's reduced-motion check counted GitHub's own CSS animation `prc-UnderlineNav-detect-overflow`. The check now counts only RepoVibe's `repv-*` keyframes; the RepoVibe classes had been removed.

LIVE 8 results on real github.com from that run:
- Seeded mappings: PASS.
- `naman-dev-00/RepoVibe` (Enchanted Forest, fireflies) and `naman-dev-00/ai-powered-inbox-assistant` (Futuristic Sci-Fi, holo): PASS on their own real pages, with no text below 3:1.
- `tradPro` and `Pool-Souls`: HTTP 404 logged out, so live is UNVERIFIED for those two pages.
- All four worlds on `actions/checkout` overview and issues: 8/8 PASS. Live layer running, pointer-events none, no text below 3:1 (min 4.46–4.63), links clickable.
- Static mode: PASS.
- Logged-out Home: PASS (no cards, no stylesheet).
- RepoVibe console errors: 0.

**Re-run on `edadc85` ([run 41674326275](https://github.com/naman-dev-00/RepoVibe/actions/runs/41674326275)): 8/8 scenarios, 171 PASS, 0 FAIL, 0 BLOCKED, 18 INFO.** CI on the same commit: green. Screenshots recovered from the job log: `docs/screenshots/flagship/live-github-flagships.jpg`.

**Honest visual assessment of the real pages.** Each repository clearly gets its own palette, glass and live layer:
- teal forest glass with fireflies;
- violet neon with rain;
- deep indigo with stars;
- a bright white and cyan hall.

Text stays readable throughout. On dense pages (file lists, issue lists), however, GitHub's content column covers most of a 1600 px viewport. The readability guard then keeps the artwork **heavily muted** behind the panels. It shows through mainly in the margins, in gaps, and below short pages: the sci-fi hall is clearly visible under the small inbox-assistant repository. So on real repository pages the effect is a strong per-repository atmosphere rather than a fully visible scene. Immersion on real dense pages: **PARTIAL**. Home cards and the fixtures show the art at full strength.

**Signed-in Home (Top repositories) on real GitHub: UNVERIFIED.** Real logged-in visuals were not tested because the suite never signs in or uses credentials. Coverage is the authenticated-page fixture only. GitHub may change the dashboard markup; detection falls back to the heading text.

## 6. Limitations

- Real signed-in dashboard markup is unverified (see §5). If GitHub renders Top repositories without `<li>` rows, the cards stay off rather than breaking anything.
- On real repository pages, GitHub's content column covers most of a desktop viewport. The art and the motion are strongest in the margins and gaps, and softened behind the guarded glass.
- The motion layers cost compositor time. Static mode or the OS reduced-motion setting removes them. Cinematic parallax moves the full wallpaper layer.
- Uploaded (IndexedDB) wallpapers on Home cards: up to 8 distinct uploads per page get artwork; beyond that, cards fall back to the theme's colours.
- tradPro and Pool-Souls are not publicly reachable, so their own pages cannot be checked live.

## 7. Acceptance matrix

| Requirement | Status | Evidence |
|---|---|---|
| Four premium layered 3D themes | **PASS** (Sci-Fi restrained, see §2) | renders, contact sheet |
| Four default repository mappings, persistent, independent, manual wins, auto for others | **PASS** (offline + unit; live seeding PASS; live pages PASS for RepoVibe and ai-powered-inbox-assistant; tradPro and Pool-Souls 404 logged out, so UNVERIFIED live) | flagship E2E 1, unit, LIVE 8 |
| Wallpaper clearly visible, GitHub readable | Readable: **PASS** (live, 0 elements < 3:1). Visible: **PASS** in fixtures, margins and short pages · **PARTIAL** on dense real pages (art muted behind glass) | LIVE 8, screenshots |
| Live wallpapers, Static/Ambient/Cinematic, reduced motion, non-blocking | **PASS** (offline + live) | flagship E2E 2, LIVE 8 |
| Themed Top repositories cards (fixture) | **PASS** | flagship E2E 3–4, screenshots |
| Themed Top repositories cards (real signed-in GitHub) | **UNVERIFIED** | requires login |
| Sidebar ↔ repository sync, dynamic rows, SPA | **PASS** (fixture) | flagship E2E 3 |
| High contrast / forced colors / reduced motion on cards | **PASS** (emulated) | flagship E2E 3 |
| Disable restores original | **PASS** (DOM + pixels) | flagship E2E 3 |
| Popup/Studio show repo, theme, manual vs auto, motion control | **PASS** | popup baseline test, screenshots |
| Existing tests preserved | **PASS** | 23 unit, 36 E2E |
| No new permissions, no remote code or fetching | **PASS** | verify:package |
