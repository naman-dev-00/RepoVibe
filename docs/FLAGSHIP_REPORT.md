# Focused Phase 1B: four flagship worlds, live wallpapers, themed Top repositories

Branch `feature/phase1b-immersive-themes` (PR #2, stacked on PR #1). Not merged.

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
