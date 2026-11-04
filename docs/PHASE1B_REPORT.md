# Phase 1B report — Immersive wallpaper engine & automatic per-repository themes (v0.2.0)

Branch `feature/phase1b-immersive-themes`, stacked on Phase 1A (PR #1, not yet merged into `main`).

## 1. Architecture changes

| Area | Change |
|---|---|
| Rendering (`content.js`) | **Glass mode** when a wallpaper is active: GitHub's surface tokens (`--bgColor-default/muted/inset`, legacy `--color-canvas-*`) become translucent; the outer page shells (`body`, `.application-main`, `main`, repo turbo frame) become transparent; the width-limited **content column** (`.container-*`, Primer `PageLayout`) gets guarded glass so text that GitHub renders without its own panel still has a backing; menus/dialogs/popovers are forced **opaque**; code stays ≥ 90 % opaque. The wallpaper is a fixed, `pointer-events:none`, `z-index:-1` layer (`body::before`) with overlay tint, brightness, blur, position and cover/contain. The image URL lives in its own `<style>` so slider changes never re-serialize large images. |
| Readability guard (`RepoVibeCore.requiredGlass`) | For each wallpaper's measured 98th/2nd-percentile colours (worst case white/black for uploads), computes the minimum glass opacity at which text, secondary text and links stay ≥ 4.6:1 after overlay, brightness and layer opacity, and never lowers the user's choice. Presets default to light glass (60–66 %); the guard raises it per wallpaper (60–87 %). The Studio says when the guard is active. |
| Automatic themes (`shared/core.js`) | Config v2: `autoAssign`, `autoAssignments`. `pickAutoTheme(key, config)`: FNV-1a(owner/repo) mod 20, walking forward past presets already used by the same owner's other repositories (manual or automatic). The first pick is **persisted** by the content script, so it never changes. Precedence: **disabled → manual repository → owner → automatic → global**. Manual choices (including "Restore GitHub appearance" = `native`) are never overwritten. v1 users with a shared global theme keep it (auto off); others get automatic themes. |
| Wallpaper storage | `shared/wallpaper-store.js`: IndexedDB (extension origin), content-addressed ids (`w` + SHA-256 prefix) → deduplication; magic-byte validation (PNG/JPEG/WebP only); ≤ 25 MB input, downscaled to ≤ 3840 px WebP, ≤ 12 MB stored; cleanup of unreferenced assets with a grace period. `background.js` (new MV3 service worker) serves images to content scripts (which cannot open the extension's IndexedDB), migrates v1 inline data-URL wallpapers, and runs cleanup. Missing/corrupted assets fall back to the theme's colours. |
| Wallpaper catalogue | `wallpapers/manifest.json` (style, source, licence, attribution) → `scripts/wallpapers/build-catalog.js` (validates files, dimensions, licence; measures tones) → generated `shared/wallpaper-catalog.js`. `import.js` onboards external premium art. See `docs/WALLPAPER_PIPELINE.md`. |
| UI | Popup: repository, active theme, **theme source**, artwork quick themes, *Customize this repository*, *Reset repository theme*, *Restore GitHub appearance*. Studio: repository-first target (default when on a repo), *Save to <repo>*, source chip, artwork gallery with *Apply* / *Customize* and **3D CINEMATIC / ILLUSTRATED** badges (3D first), wallpaper picker + upload, all background and glass controls with live preview, auto-assign toggle, wallpaper storage view. |
| Permissions | Unchanged: `storage` + `https://github.com/*`. New: `background.service_worker`; `web_accessible_resources: wallpapers/*.webp` limited to `https://github.com/*`. |

## 2. Wallpaper assets and licensing

27 bundled wallpapers, all **original work created for RepoVibe** (`wallpapers/LICENSE.md`), no third-party images:

- **7 × 3D cinematic** (2560×1440, raymarched GLSL, 2×2 SSAA, ACES): neon rain canyon, alien world + ringed planet, aurora fjord, alpine lake, synthwave valley, desert dunes, ocean twilight. Presets: Cyberpunk Neon, Galaxy, Aurora, Arctic Frost, Synthwave, Solar Flare, Ocean Depths.
- **20 × illustrated (2D)** (1920×1080, procedural vector scenes): used by the other 13 presets and selectable in the Studio.

Honest quality statement: the 3D renders are real 3D (geometry, perspective, soft shadows, fog, reflections) with foreground/midground/background depth; neon canyon, alien world, aurora fjord, alpine lake and synthwave are strong; desert dunes and ocean twilight are softer. They are procedural CG, not hand-painted concept art. **Not achieved:** 3D cherry-blossom temple, magical forest, anime village, cozy futuristic room, library — those presets remain *Illustrated*; the import pipeline is ready for premium renders or licensed packs.

## 3–6. Evidence (screenshots, automatic assignment, IndexedDB)

- Before/after on **real github.com**: `docs/screenshots/live-github-3d-before-after.jpg` (native vs Cyberpunk 3D, Galaxy 3D, Aurora 3D) and `live-github-more.jpg` (illustrated theme on Issues/PRs, automatic theme on octocat/Hello-World) — recovered from the live job log.

**Honest visual assessment of the real-site screenshots.** The artwork is present and measurable (49–82 % of pixels change; planet glow, aurora tint and neon hues show through the glass), but on real GitHub the scenes are **heavily subdued**: pages read as rich, atmospheric dark themes rather than GitHub floating inside a vivid 3D scene. This is a structural trade-off, not a tuning bug: GitHub's content column fills most of a desktop viewport, and keeping text ≥ 4.5:1 over a busy image requires suppressing that image behind the text — the readability guard enforces exactly that. The art is at full strength only where there is no text (side margins: ~160 px each at 1600 px, 320+ px at 1920–2560 px; gaps; the area below short pages). Users can lower glass opacity in the Studio; the guard still prevents unreadable text. A future option is a "focus" mode that keeps text on solid cards and shows the art at full strength everywhere else (layout-dependent; not implemented).
- Studio gallery, background studio, popup, 3D and 2D contact sheets: `docs/screenshots/`.
- Automatic assignment (real repos, live): `actions/checkout` → preset-14, `actions/setup-node` → preset-2, `octocat/Hello-World` → preset-5; same-owner repositories differ; persisted separately from manual choices; identical after a browser restart; popup override wins and survives restart.
- IndexedDB (offline E2E + live): upload → stored once (dedup) → `idb:` reference only in settings (config < 20 KB) → previewed and rendered on github.com (92 % of pixels changed) → persists across reload and browser restart; v1 migration; missing asset fallback; cleanup keeps referenced assets.

## 7–8. Test results

| Suite | Result |
|---|---|
| `npm run check` | pass |
| `npm test` (unit) | 20 / 20 |
| `npm run test:e2e` (offline fixture, Chromium + extension) | 32 / 32 (21 from Phase 1A, 12 new, 1 superseded) |
| `npm run package` + `verify:package` | MV3 v0.2.0, 72 files, 27 wallpapers (7 3D), `storage` + `https://github.com/*` only |
| Live github.com (logged out) on `44c8991` | 7 / 7 scenarios, **150 PASS, 0 FAIL, 0 BLOCKED**, 14 INFO |
| Live github.com on `bc42dcd` (adds 3D themes on real pages) | 7 / 7 scenarios, **156 PASS, 0 FAIL, 0 BLOCKED**, 14 INFO; Cyberpunk/Galaxy/Aurora 3D on overview + issues: 0 text elements < 3:1 (p10 5.7–7.7:1) |

Defects found by the live suite and fixed during this phase: (1) un-paneled text dropped to 1.4–2.9:1 over bright wallpapers → content-column glass + readability guard; (2) 82 % glass made pages read as tinted GitHub → dimmed art + per-wallpaper guard; plus the "wide layout narrower" bug from Phase 1A's live work.

## 9. Performance

- 8000×4500 (36 MP) JPEG upload → 3840×2160 WebP (159 KB) in 1.5 s; 29 MB PNG rejected with a clear message.
- Soft navigation with a large uploaded wallpaper: 116–234 ms per navigation (offline fixture); page JS heap 4 MB.
- Uploaded image cache in the content script is bounded (3 entries); bundled images are loaded by the browser from the extension package.
- `backdrop-filter` is only emitted when glass blur > 0 and only on panels/header/column; reduced-motion users get no transitions.

## 10. Remaining limitations

- Premium 3D scenes listed above not produced; 13 presets remain illustrated.
- Signed-in GitHub (`.AppHeader`, menus, settings, private repos) and GitHub's own theme variants: manual.
- Toolbar popup, ZIP install in headed Chrome, Windows/macOS, OS accessibility modes: manual.
- The guard reasons about each wallpaper's brightest/darkest 2 %; text over an unusually bright small region could still dip — the screenshot-measured live checks found none on the tested pages.
- With more than 20 repositories per owner, automatic themes repeat.

## 11. Acceptance matrix (Phase 1B criteria)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | ≥ 10 presets with distinctive wallpaper artwork | **PASS** (20 presets have their own artwork) · **PARTIAL for the 3D direction** (7 presets 3D, 13 illustrated) | contact sheets, LICENSE |
| 2 | Wallpapers visibly appear on actual GitHub pages | **PASS (measurable) · PARTIAL (immersion)** | live: 49–82 % pixels changed (bundled), 92 % (IndexedDB); art subdued behind text by design (see §3–6) |
| 3 | GitHub stays readable and functional | **PASS** | live screenshot contrast: 0 elements < 3:1 on all tested pages; links clickable; menus opaque (offline) |
| 4 | Each repository keeps its manual theme | **PASS** | offline + live |
| 5 | Stable automatic theme for unconfigured repositories | **PASS** | unit + offline + live restart |
| 6 | Moving between repositories applies the right theme | **PASS** | offline SPA + live |
| 7 | User overrides never silently overwritten | **PASS** | unit + offline + live |
| 8 | Wallpaper settings persist after restart | **PASS** | offline restart tests (bundled + IndexedDB) |
| 9 | IndexedDB wallpaper storage works | **PASS** | offline + live |
| 10 | Studio live previews | **PASS** | offline control test; live Studio preview |
| 11 | Gallery displays representative artwork | **PASS** | offline gallery test (20 images load) + screenshot |
| 12 | Existing tests keep passing | **PASS** | 20 unit, 32 offline (semantics-driven updates documented in the PR) |
| 13 | New unit, E2E and live tests pass | **PASS** | as above |
| 14 | Disable restores normal GitHub | **PASS** | offline pixel-identical + live restoration checks |
| — | 3D cinematic visual target | **PARTIAL** | 7 real 3D renders; organic/architectural concept-art scenes not produced (see §2); on real GitHub the scenes are subdued behind readable glass |
| — | Main success condition: repo feels like a personalized environment, not a recolor | **PARTIAL** | strong in the Studio/gallery and around content; on real pages the effect is a deep, atmospheric theme with art at the edges rather than a fully visible scene |
