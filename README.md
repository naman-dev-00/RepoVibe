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

## What works in v0.1.1

- Chrome Manifest V3 with host access limited to `https://github.com/*` and local `storage` permission.
- 20 designed color/gradient themes; CSS variables integrated with GitHub's current color token convention plus scoped panel, code, and navigation styling.
- Settings priority: **repository → account/organization owner → global**, with an independent native/unmodified appearance override.
- GitHub repository detection, supported navigations using `turbo:load`, `turbo:render`, history events, and a URL-only observer fallback.
- Popup: current repository, on/off toggle, six quick themes, repo/global scope, native appearance override, Studio launcher.
- Full Studio: browse all 20 presets; edit 10 theme colors, name, description, font, radii, glass blur/opacity, gradient, code font size, and compact/wide layout.
- Local wallpaper upload (PNG/JPEG/WebP). Images are resized/compressed by the Studio to fit extension-local storage. No remote images.
- Connected GitHub tab previews: change the editor, see CSS change immediately. **Save** persists; closing or switching scope clears uncommitted previews.
- Session undo/redo of appearance edits, safe theme JSON import/export, custom theme library, native appearance restore.
- Local-only architecture; no backend, analytics, GitHub login, API requests, or remote code.
- Node built-in unit test suite covering preset catalog, GitHub URL parsing, priority, and input sanitization.

## Scope and known limitations

This is a **functional Phase 1 MVP**, not the complete 24-section product vision. Features left for later releases include time/language-based automatic rules, full page-type styling, advanced layout manipulation, motion/particle engines, community galleries, a large-wallpaper IndexedDB store, synchronization and a comprehensive GitHub-version compatibility matrix. Most controls apply to broadly shared Github components; some newer, changing GitHub views will retain original styles. Styling of security-sensitive views is deliberately conservative. A color token or selector might need adjustment after GitHub UI updates.

**Technology choice:** This standalone initial release deliberately uses dependency-free JavaScript, HTML and CSS rather than the specification's preferred React/TypeScript/Vite architecture. This makes it directly loadable in Chrome without installing dependencies or compiling. The code is modular and can be migrated to the preferred stack in Phase 2; the goal here is to provide an actual working extension immediately. Chromium integration with the live github.com UI was **not** fully verified in this environment; manual browser acceptance is required before public distribution.

**Wallpaper storage:** This MVP stores locally compressed JPEG data in `chrome.storage.local`, which has a typical quota of 10 MB. It compresses each wallpaper to around 750 KB or less. Avoid assigning many distinct wallpapers. For Phase 2, replace this with IndexedDB in the extension origin plus a safe delivery mechanism to the content script.

## Test

Requires Node.js 18+ (Node.js 22 recommended):

```sh
npm test            # unit tests (no dependencies)
npm run check       # syntax check of all scripts
npm run test:e2e    # Chromium E2E with the unpacked extension loaded
```

The E2E suite needs Playwright with a Chromium build available (`require('playwright')`). It intercepts `https://github.com/*` and serves `tests/e2e/fixture.html`, so it runs offline and does not replace manual testing on live GitHub. Visual baselines are in `tests/e2e/__screenshots__`; refresh them with `UPDATE_SNAPSHOTS=1 npm run test:e2e`. Latest results and the defect list are in `docs/ACCEPTANCE_REPORT.md`.

Build a loadable ZIP with `npm run package` (produces `RepoVibe-Extension.zip`).

## Project files

| File | Purpose |
| --- | --- |
| `manifest.json` | MV3 installation and GitHub-only permissions |
| `shared/core.js` | Theme definitions, sanitizers, repository detection, resolver, local persistence |
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
