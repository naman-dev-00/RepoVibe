# Focused Phase 1B: four flagship worlds, live wallpapers, themed Top repositories

Branch `feature/phase1b-immersive-themes` (PR #2, stacked on PR #1). Not merged.

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
| Futuristic Sci-Fi | 3D white arched hall, cyan light strips, glossy floor, holographic core | holographic grid + scan band | **Complete but restrained**. Clean and minimal as asked; the holographic rings are faint, so the scene reads as bright and airy rather than dramatic. |

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

The re-run on the fixed harness is reported in the PR.

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
| Four default repository mappings, persistent, independent, manual wins, auto for others | **PASS** (offline + unit); live for publicly visible repos | flagship E2E 1, unit, LIVE 8 |
| Wallpaper clearly visible, GitHub readable | **PASS** offline; live per LIVE 8 | contrast checks |
| Live wallpapers, Static/Ambient/Cinematic, reduced motion, non-blocking | **PASS** | flagship E2E 2, LIVE 8 |
| Themed Top repositories cards (fixture) | **PASS** | flagship E2E 3–4, screenshots |
| Themed Top repositories cards (real signed-in GitHub) | **UNVERIFIED** | requires login |
| Sidebar ↔ repository sync, dynamic rows, SPA | **PASS** (fixture) | flagship E2E 3 |
| High contrast / forced colors / reduced motion on cards | **PASS** (emulated) | flagship E2E 3 |
| Disable restores original | **PASS** (DOM + pixels) | flagship E2E 3 |
| Popup/Studio show repo, theme, manual vs auto, motion control | **PASS** | popup baseline test, screenshots |
| Existing tests preserved | **PASS** | 23 unit, 36 E2E |
| No new permissions, no remote code or fetching | **PASS** | verify:package |
