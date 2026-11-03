# RepoVibe ✦

**Your GitHub. Your Style. Every Repo, A Different Vibe.**

RepoVibe is an installable, local-first Chrome extension that makes GitHub visually customizable. Choose from **20 complete theme presets**, give individual repositories their own look, and adjust it in a full visual studio. All changes are client-side CSS; GitHub repository files and account data are not modified.

## Install in Chrome (no build tools required)

1. Extract `RepoVibe-Extension.zip` to a normal folder. Keep the files together.
2. Open `chrome://extensions` in Google Chrome.
3. Enable **Developer mode** (top right).
4. Select **Load unpacked** and choose the folder containing `manifest.json` (not the ZIP file itself).
5. Open a normal GitHub repository, e.g. `https://github.com/owner/repository`.
6. Click the RepoVibe extension icon (pin it if useful), choose a quick theme, or open **Theme Studio** for more controls.

**Note:** After editing this extension's source locally, return to `chrome://extensions` and press its Reload button. A hard reload of the GitHub tab might be needed after an extension reload.

## What works in v0.2.0

- **Immersive wallpapers.** Every one of the 20 presets ships with its own original artwork (bundled WebP, no remote service): neon rain street, cherry-blossom street, cozy room, gothic castle, ocean depths, forest waterfall, pixel-art dusk and island, solar sunset, snow peaks, lavender fantasy, academia library, aurora lake, sunset village, galaxy, synthwave and more. See `wallpapers/LICENSE.md`.
- **Glass layering on GitHub.** With a wallpaper, GitHub's page canvas becomes transparent and its panels become translucent "glass" (adjustable opacity and blur), so the artwork shows around and behind content. Menus, dialogs and popovers stay opaque; code stays ≥ 90% opaque; links remain clickable; the wallpaper is a fixed layer that stays put while scrolling.
- **Background controls with live preview:** wallpaper, opacity, brightness, blur, overlay darkness, position, cover/contain, glass panel opacity and glass blur.
- **Every repository gets its own vibe.** Unconfigured repositories receive a deterministic automatic theme (stable hash of `owner/repo`, avoiding themes already used by the same owner's other repositories) that is saved on first visit and never changes. Precedence: **your repository choice → owner choice → automatic → global**. Manual choices — including "Restore GitHub appearance" — are never overwritten. Turn automatic themes off in Studio → Settings to use one shared global theme. With 20 presets, themes repeat once an owner has more than 20 repositories.
- **Repository-first controls.** The popup and Studio show the repository, the active theme and where it comes from (manual, automatic, owner, global), with *Customize this repository*, *Save to this repository*, *Reset repository theme* and *Restore GitHub appearance*.
- **Your own wallpapers in IndexedDB.** PNG/JPEG/WebP up to 25 MB, downscaled to ≤ 3840 px WebP, content-addressed (identical images stored once), referenced by id from themes; v0.1 inline wallpapers migrate automatically; missing or corrupted images fall back to the theme's colors; unused images can be cleaned up.
- **Artwork gallery** with real previews, accent swatches, glass panel mock-ups and *Apply* / *Customize* actions.
- Everything from v0.1.1: GitHub light/dark base-mode handling, exact restoration, client-side navigation support, safe JSON import/export, local-only privacy, no new permissions (`storage` + `https://github.com/*`).

## Scope and known limitations

This is a **functional Phase 1 MVP**, not the complete 24-section product vision. Features left for later releases include time/language-based automatic rules, full page-type styling, advanced layout manipulation, motion/particle engines, community galleries, synchronization and a comprehensive GitHub-version compatibility matrix. Most controls apply to broadly shared Github components; some newer, changing GitHub views will retain original styles. Styling of security-sensitive views is deliberately conservative. A color token or selector might need adjustment after GitHub UI updates.

**Technology choice:** This standalone initial release deliberately uses dependency-free JavaScript, HTML and CSS rather than the specification's preferred React/TypeScript/Vite architecture. This makes it directly loadable in Chrome without installing dependencies or compiling. The code is modular and can be migrated to the preferred stack in Phase 2; the goal here is to provide an actual working extension immediately. Chromium integration with the live github.com UI was **not** fully verified in this environment; manual browser acceptance is required before public distribution.

**Wallpaper storage:** bundled artwork needs no storage. Your uploads live in IndexedDB in the extension's own origin (not visible to github.com) and are delivered to GitHub pages by the extension's service worker; theme settings only hold a reference id.

## Test

Requires Node.js 18+ (Node.js 22 recommended):

```sh
npm test            # unit tests (no dependencies)
npm run check       # syntax check of all scripts
npm ci && npx playwright install chromium   # once: dev dependency + browser
npm run test:e2e    # Chromium E2E with the unpacked extension loaded
```

The E2E suite needs Playwright with a Chromium build available (`require('playwright')`). It intercepts `https://github.com/*` and serves `tests/e2e/fixture.html`, so it runs offline and does not replace manual testing on live GitHub. Visual baselines are in `tests/e2e/__screenshots__`; refresh them with `UPDATE_SNAPSHOTS=1 npm run test:e2e`. Latest results and the defect list are in `docs/ACCEPTANCE_REPORT.md`.

Build a loadable ZIP with `npm run package` (produces `RepoVibe-Extension.zip`) and check it with `npm run verify:package`.

Live github.com acceptance (real site, logged out, no credentials) runs separately with `npm run test:live` and in `.github/workflows/live-github.yml` (pull requests touching extension files, weekly, manual dispatch). It reports BLOCKED, not PASS, when GitHub or its assets are unreachable. Results: `docs/ACCEPTANCE_REPORT.md`.

CI (`.github/workflows/ci.yml`) runs all of the above on every pull request and push to `main`. Install dev dependencies with `npm ci` and Chromium with `npx playwright install --with-deps chromium`.

## Project files

| File | Purpose |
| --- | --- |
| `manifest.json` | MV3 installation and GitHub-only permissions |
| `shared/core.js` | Theme + wallpaper catalogue, sanitizers, repository detection, resolver and automatic assignment, local persistence |
| `shared/wallpaper-store.js` | IndexedDB wallpaper store (validation, dedup, cleanup) |
| `background.js` | Service worker: serves uploaded wallpapers to GitHub pages, migrates v0.1 wallpapers, cleanup |
| `wallpapers/` | 20 original bundled wallpapers + thumbnails (`LICENSE.md`); generator in `scripts/wallpapers/` |
| `content.js` | Safe CSS presentation on GitHub, route awareness, editor preview connection |
| `popup.html`, `popup.js` | Compact extension popup and quick theme assignment |
| `studio.html`, `studio.js` | Full gallery and visual customization studio |
| `ui.css` | Responsive popup and studio design |
| `icons/` | Local icons |
| `tests/` | Node unit tests and Chromium E2E tests (`tests/e2e/`) |
| `docs/ACCEPTANCE_REPORT.md` | Defects found, fixes, and test evidence |
| `docs/ROADMAP.md` | Future roadmap and acceptance criteria |

## Chrome compatibility/acceptance checklist

Before a public release, test manually on GitHub (logged in and logged out):

- [ ] Load as unpacked extension without `manifest.json` errors.
- [ ] On a repository, apply a popup preset and verify header, background, panels and code readability.
- [ ] Switch between two repositories and confirm independent looks persist after reload/restart.
- [ ] Open Studio from a repo and observe changes immediately without saving. Close Studio and confirm preview reverses.
- [ ] Edit and save a custom theme; refresh the GitHub tab and verify persistence.
- [ ] Upload a wallpaper and adjust its opacity and blur; save, reload, and verify it is still visible.
- [ ] Undo/redo changes, import/export JSON, reset one scope, disable globally.
- [ ] Navigate repository tabs via client-side links: Code, Issues, Pull requests, Actions, Discussions and Releases.
- [ ] Test both GitHub light and dark base modes, narrow viewports and accessibility settings.
- [ ] Verify inputs, editor, menus, diff colors, and GitHub interaction remain readable and clickable.

## Privacy & security

RepoVibe stores settings and compressed images locally in Chrome's extension storage, only injects CSS on `github.com`, and does not access GitHub private repository file contents or send data to remote servers. Imported theme JSON is validated and treated strictly as data. It does not load remotely executable stylesheets or scripts.

## Contributions

Work on feature branches and submit reviewable PRs. Do not merge untested visual changes. See `docs/ROADMAP.md` for staged work.
