# Acceptance & defect report — v0.1.1 (Phase 1A, PR #1)

## Environment and what was (and was not) executed

- Chromium (Playwright build, new headless mode) with the unpacked extension loaded via `--load-extension`.
- **Live github.com was not reachable from the test environment** (outbound proxy returned HTTP 403). No results below come from the live GitHub DOM. Instead, `https://github.com/*` requests were intercepted and answered with `tests/e2e/fixture.html`, an offline page that mirrors the parts RepoVibe touches (Primer tokens under `data-color-mode`, `.AppHeader`, `.container-xl`, `.Box`, overlays, a React-style code view with `#read-only-cursor-text-area`, pushState and `turbo:load` navigation). The content script, popup, Studio, `chrome.tabs.*`, `chrome.storage` and preview ports all ran for real against that URL.
- Not executed: live GitHub page types (Code, Issues, PRs, Actions, Discussions, Releases), logged-in vs logged-out, high-contrast/colorblind GitHub themes, headed Chrome stable, Chrome Web Store packaging. These remain on the manual checklist in README.

## Defects found and fixed

| # | Severity | Defect | Reproduction (before fix) | Fix |
|---|---|---|---|---|
| 1 | High | "Balanced (default)" and "Compact" layouts removed GitHub's page max-width | Any theme → `.container-xl` computed `max-width: none`; content stretches edge-to-edge on wide screens | Max-width rule only emitted for `wide` (`min(96vw, 1800px)`); `.Layout` no longer touched |
| 2 | High | `--bgColor-emphasis` overridden with the accent | GitHub uses it for *neutral* emphasis (counters, tooltips) with white text; light accents (Aurora `#7eedd7`, Retro `#bdd774`) gave ~1.3:1 contrast | Override removed; accent now drives `--fgColor-link`, `--underlineNav-borderColor-active`, `--focus-outlineColor` |
| 3 | High | Light theme on a dark-mode account (or vice versa) kept the other mode's tokens; `color-scheme` used a string-prefix guess that classified Arctic Frost as dark | Arctic Frost on dark account → dark native controls/scrollbars, dark un-overridden tokens on a light page | Luminance-based detection; content script sets `data-color-mode` to match the theme and restores the original value when inactive |
| 4 | Medium | Menus/overlays stayed on GitHub's native surface | Theme text color on GitHub's overlay background | `--overlay-bgColor`/`--overlay-borderColor` and legacy `--color-*` tokens set |
| 5 | Medium | Light presets failed WCAG AA (links ≥ 3.0:1, secondary text ≥ 3.3:1) | Sakura Dreams, Arctic Frost, Minimal White | Darkened `muted`/`accent`; all 20 presets now ≥ 4.5:1 for text, muted and accent on all surfaces (unit-tested) |
| 6 | Medium | Prototype keys resolved to inherited members | `github.com/constructor/x` or `/toString/x` returned `Object.prototype` functions as assignments → global theme ignored; a stored id of `constructor` crashed render | Own-property lookups; `__proto__`/`constructor`/`prototype` keys dropped on load |
| 7 | Medium | Studio live preview vanished on any in-page navigation while Studio was still open | Preview a theme, click a repo tab link → preview gone until next edit | Preview persists until the Studio port disconnects or sends `CLEAR` |
| 8 | Medium | Code font-size applied to code lines but not GitHub's overlay textarea | Selection/cursor misaligned with visible text in the React code viewer | Same font rules applied to `#read-only-cursor-text-area` |
| 9 | Low | Style tag/class could be lost after GitHub head/attribute swaps | — (defensive) | Root attribute observer + self-heal on navigation ticks |
| 10 | Low | Importing a JSON file containing `null` showed a raw TypeError | Import `null` → "Cannot read properties of null" | Clear "missing theme data" error |
| 11 | Low | Unchecked `runtime.lastError` when the target tab has no content script | Open Studio for a tab loaded before install → console error | `lastError` consumed in `onDisconnect` |
| 12 | Low | Studio opened from the options page linked an arbitrary GitHub tab | Multiple GitHub tabs → preview went to the first found | Most recently accessed GitHub tab is preferred |
| 13 | Low | Blurred wallpaper showed soft transparent edges | Wallpaper blur > 0 | Wallpaper layer oversized by 2× the blur radius |

### Round 2 — CI integration and hardening review

| # | Severity | Defect | Reproduction (before fix) | Fix | Regression test |
|---|---|---|---|---|---|
| 14 | High | Studio/popup wrote back a stale in-memory config (data loss) | Open Studio, assign a theme in the popup, save in Studio → popup change silently lost | `updateConfig()` read-modify-write against latest storage, serialized per page; Studio/popup refresh on `storage.onChanged` | E2E "Studio save does not overwrite…", unit "updateConfig merges…" |
| 15 | High | User/GitHub appearance change overwritten while active, then a stale mode restored | Light theme on dark account; switch GitHub to "auto"; RepoVibe forced it back and later restored "dark" | Mode is only overridden when GitHub's *effective* mode differs from the theme; an external change becomes the value to restore; follows OS scheme changes for "auto" | E2E "GitHub appearance changes…" |
| 16 | Medium | 81st custom theme silently dropped by `normalizeConfig(...).slice(0, 80)` while still assigned | Save a theme with 80 already stored | `saveConfig` refuses with a clear "library is full" error; nothing partially saved | unit "saveConfig refuses…" |
| 17 | Medium | Orphaned content script after extension reload/update/disable kept observers running and left a stale theme | Reload extension; page keeps old theme, observers keep firing into a dead context | Detects invalidated context, disconnects both observers and all listeners, removes styling and restores `data-color-mode` | E2E "orphaned content script…" |
| 18 | Medium | Per-frame performance: observer ticks re-normalized the theme, regex-scanning a wallpaper data URL of up to ~750 KB each frame with DOM churn | Wallpaper theme on a busy GitHub page | Resolved mode cached at render; style text only rewritten when changed | code review only (no timing test) |
| 19 | Low | Storage quota failures surfaced raw Chrome errors | Exceed `storage.local` quota with wallpapers | Actionable "storage is full… nothing was saved" message | unit "storage quota failures…" |
| 20 | Low | Initial config read could overwrite a newer `storage.onChanged` value | Change settings while a GitHub tab is loading | Initial read ignored if a change arrived meanwhile | code review only |
| 21 | Low | Editing a custom theme shared by several targets changed all of them without telling the user | Two repos share a custom theme; edit from one | Save message states how many other assignments also change | E2E "editing a custom theme shared…" |

Previously untested round-1 fixes now covered: #9 head/style/class restoration, #11/#12 Studio target handling (unavailable target, tab closed mid-session, most-recently-used tab), #13 blurred wallpaper edges (edge pixels sampled).

No permission changes were needed: `tabs.query`/`tabs.get` URLs and `tabs.connect` work for github.com tabs with the existing `host_permissions`.

## Continuous integration

`.github/workflows/ci.yml` runs on pull requests, pushes to `main` and manual dispatch (Ubuntu, Node 22, `contents: read`): `npm ci` → `npx playwright install --with-deps chromium` → `npm run check` → `npm test` → `npm run test:e2e` → `npm run package` → `npm run verify:package` (MV3, exact permissions, all manifest/page-referenced files present, no remote resources, no test/dev files). The ZIP is uploaded as a workflow artifact; E2E screenshots are uploaded on failure. Playwright is a pinned dev dependency (`1.63.0`) with a lockfile; it is not part of the extension package.

## Automated tests

| Command | Result |
|---|---|
| `npm run check` | pass |
| `npm test` (unit) | 13 / 13 pass |
| `npm run test:e2e` (Chromium + extension, offline fixture) | 20 / 20 pass (11 acceptance + 9 hardening) |
| `npm run package` + `npm run verify:package` | pass (MV3, 13 files, `storage` + `https://github.com/*` only) |

Negative controls (same tests, older source):
- Acceptance suite vs original v0.1.0: 6 / 11 fail.
- Hardening suite vs original v0.1.0: 7 / 9 fail; vs round-1 PR head `8d6f514`: 4 / 9 fail (#14, #15, #17, #21).
- Two hardening tests (unavailable Studio target; enable/disable during navigation) also pass on v0.1.0. They are robustness checks, not proof of a fix.

## Security review (full PR diff)

- Permissions unchanged (`storage`, `https://github.com/*`); no `content_security_policy` override; no remote scripts/styles (verified in package check).
- No `eval`, `new Function`, `fetch`/XHR, or new `innerHTML` with dynamic data in extension code.
- Theme import remains data-only through `normalizeTheme` (hex colors, clamped numbers, enums, base64 PNG/JPEG/WebP only); names stripped of `<>`/control characters and rendered with `textContent`; `__proto__`/`constructor`/`prototype` keys dropped; lookups use own properties.
- Wallpaper URLs are only validated `data:` URLs inside `url("...")`; the base64 alphabet cannot break out of the CSS string.
- The content script writes to GitHub's DOM only: one `<style>`, the `repv-active` class, and `data-color-mode` (+ two `data-repv-*` bookkeeping attributes), all removed/restored when inactive or orphaned.
- No findings requiring further change.

## Known limitations

- Selectors and tokens still need verification against live GitHub (see README checklist); the fixture cannot prove GitHub's current DOM.
- Visual baselines are rendered by Linux Chromium; other platforms may need `UPDATE_SNAPSHOTS=1` locally.
- `data-color-mode` handling (#3, #15) is verified only against the fixture's simulation of GitHub changing the attribute. Live GitHub's appearance-settings flow, `data-light-theme`/`data-dark-theme` variants (high contrast, colorblind, dimmed) and any GitHub code that reads `data-color-mode` (e.g. embedded renderers) are UNVERIFIED.
- #18 and #20 have no automated test (performance timing and a load-time race are not reliably testable here).
- Visual snapshots render with bundled, subset DejaVu fonts (`tests/e2e/fonts`) so they do not depend on host system fonts. CI run #1 failed the popup snapshot (14.17% pixel diff) because the runner's system fonts differ from the authoring machine; this was reproduced locally (13.31% under a different fontconfig) and fixed. CI run #2 still differed by 3.71% from host glyph rasterization settings (reproduced locally: subpixel RGB 2.65%, antialias off 4.25%); the harness now launches Chromium with its own fontconfig (`tests/e2e/fonts/fonts.conf`: grayscale antialiasing, slight hinting) plus `--disable-lcd-text --font-render-hinting=none`, and snapshots pass locally under every hostile fontconfig tried. As a consequence, screenshots do not test the theme's font *choice*; that is covered by computed-style assertions. Remaining host differences (e.g. antialiasing) are absorbed by the per-channel threshold and 1–2% tolerance.
- Wallpapers still live in `chrome.storage.local` (≈10 MB quota). **IndexedDB wallpaper persistence is not implemented and its verification is PENDING** (Phase 2).
- Editing a saved custom theme still updates every target using it by design; the Studio now says so, but per-target forking is a second-assignment item.

## Live github.com acceptance (real site, automated)

**Access:** GitHub-hosted Actions runners can load public github.com pages *with* GitHub's CSS/JS (`github.githubassets.com`). The cloud authoring container cannot: it receives repository HTML but every GitHub asset request fails (`ERR_TUNNEL_CONNECTION_FAILED`), so locally the suite reports **BLOCKED** for all scenarios. The harness only accepts a page as evidence if GitHub's own Primer CSS loaded (`--fgColor-danger`, a token RepoVibe never sets, must resolve); HTTP 401/403/407/429/5xx, login redirects, challenge/rate-limit pages and missing assets are recorded as BLOCKED and skipped. No credentials, cookies or personal sessions are used; nothing is retried around a refusal.

**Suite:** `tests/live/github.live.js` (`npm run test:live`), workflow `.github/workflows/live-github.yml` — runs on pull requests touching extension/live-test files, weekly (Mon 04:23 UTC) and on manual dispatch; separate from the deterministic offline CI. Each check becomes a row in the job summary; screenshots, `live-results.json`, and on failure an HTML/JSON/PNG dump per page are uploaded as the `live-github-results` artifact.

**Targets:** `actions/checkout` (overview, `blob/main/action.yml`, issues, pulls, actions, `commits/main`), `octocat/Hello-World`, org page `github.com/actions`; logged out; Chromium 153 (Playwright 1.63.0); light and dark system color schemes (GitHub "auto").

### Result: live run [#3](https://github.com/naman-dev-00/RepoVibe/actions/runs/41612808170) on `0d52c4a` — 5/5 scenarios, 84 PASS · 0 FAIL · 0 BLOCKED · 12 INFO

| Scenario (real github.com) | Overview | Code | Issues | PRs | Actions | Commits |
|---|---|---|---|---|---|---|
| Default settings leave GitHub untouched | PASS | PASS | PASS | PASS | PASS | PASS |
| Theme applied (tokens, text color, gradient) — light system | PASS | PASS | PASS | PASS | PASS | PASS |
| Dark theme switches GitHub base mode; GitHub's own tokens follow | PASS | PASS | PASS | PASS | PASS | PASS |
| Readability vs native GitHub (low-contrast text < 3:1) | PASS 0/190 | PASS 0/177 | PASS 0/141 | PASS 0/185 | PASS 0/182 | PASS 0/148 |
| Exact restoration (60 pinned elements) after reverting | PASS | PASS | PASS | PASS | PASS | PASS |
| Dark system: light theme applied + base mode → light, original "auto" remembered | PASS | PASS | PASS | — | — | — |
| Dark system: GitHub light token set active; readability | PASS | PASS | PASS | — | — | — |
| Dark system: disable restores dark appearance and `data-color-mode="auto"` | PASS | PASS | PASS | — | — | — |
| Client-side (no reload) navigation keeps theme | start | PASS | PASS | PASS | PASS | PASS |
| RepoVibe-attributed console/page errors | 0 in every scenario (GitHub's own: 3–5 per scenario, not attributed to RepoVibe) |||||

| Other live checks | Result |
|---|---|
| Popup identifies the active real repository (`actions/checkout`) | PASS |
| Popup quick theme "This repo" assigns + applies live | PASS |
| Popup toggle disables / re-enables on the live page | PASS |
| Per-repo themes; switching to `octocat/Hello-World` applies its own theme | PASS |
| Theme persists across full reload; browser back restores first repo's theme | PASS |
| Non-repo org page with global "native" stays unmodified | PASS |
| Custom colors, gradient background, wallpaper + 4px blur on a real page | PASS |
| Standard layout keeps GitHub's 1280px container; wide → 1600px at 1600px viewport | PASS |
| Code view: `.react-code-text`, `.react-code-line` and `#read-only-cursor-text-area` all at 17px (selectors confirmed live) | PASS |
| Studio targets the real repo, live preview, save persists after reload | PASS |
| Leaving a repo via the owner link removes the repo theme | INFO — owner link not present on logged-out page; not tested |
| Header theming | INFO — logged-out pages use GitHub's marketing header with its own fixed `data-color-mode="dark"`; the signed-in `.AppHeader` cannot be reached without credentials |

### Defects and test issues found through live runs

- **Defect (fixed):** "Wide coding space" used `max-width:min(96vw,1800px)` and made content *narrower* than GitHub's own below ~1333px viewports (1100 → 1088px). Now raises the cap to 1800px only; offline regression test added; live: 1280 → 1600px.
- **Harness corrections (not RepoVibe defects):** (1) degraded pages without GitHub CSS were initially accepted — now BLOCKED; (2) the marketing-header expectation was wrong for logged-out pages; (3) restoration fingerprints compared different lazily rendered nodes — now pinned; (4) GitHub's Primer `color` transitions produced mid-fade readings (e.g. `rgb(233,228,245)`) and false low-contrast hits — measurements now wait for finite animations. After (4), every readability and restoration check passes.

### Still requires a human (smallest remaining manual checklist)

1. **Signed-in GitHub** (needs your account; intentionally not automated): `.AppHeader` theming, dropdown/overlay menus, dashboard, settings pages, and private repositories.
2. **GitHub theme variants selected in GitHub settings** (signed-in only): high contrast, colorblind, dark dimmed; and changing GitHub's appearance setting while a theme is active.
3. **Installed-extension UX in headed Chrome stable:** load the CI `RepoVibe-Extension` ZIP, open the *toolbar* popup (automation opens `popup.html` as a page), and disable/remove the extension from `chrome://extensions`.
4. **Real storage quota and IndexedDB:** multiple large wallpapers near the 10 MB `storage.local` limit (IndexedDB wallpaper storage is not implemented — PENDING).
5. **Other platforms:** Windows/macOS font rendering, OS reduced-motion and high-contrast modes.

## Acceptance matrix

PASS = verified by an automated test in this PR · FAIL = known failing · BLOCKED = could not be executed in this environment · UNVERIFIED = not yet executed anywhere.

| Area | Offline Chromium fixture | Live GitHub (automated, logged out) |
|---|---|---|
| Extension loads (unpacked + packaged ZIP), no manifest errors | PASS | PASS (unpacked) · ZIP in headed Chrome: UNVERIFIED |
| No effect when disabled/native | PASS | PASS (6 page types) |
| Token theming, overlays, WCAG AA preset contrast | PASS | PASS theming + readability (6 pages × 2 modes); overlays/menus UNVERIFIED (signed-in) |
| `data-color-mode` switching, user appearance change, OS scheme change, restore | PASS | PASS switching/restore with GitHub "auto" in light + dark; changing GitHub's own setting: UNVERIFIED (signed-in) |
| Repo > owner > global priority (incl. prototype-like names) | PASS | PASS repo + global; owner scope UNVERIFIED live |
| Layout (standard/wide/compact), code size + cursor textarea | PASS | PASS standard/wide/code size/textarea; compact UNVERIFIED live |
| SPA / Turbo / back navigation; enable/disable mid-navigation | PASS (simulated) | PASS real client-side nav (5 tabs) + back; toggle mid-nav UNVERIFIED live |
| Head/style/class replacement recovery | PASS (simulated) | PASS indirectly (theme kept across real React/Turbo navigations) |
| Orphaned script cleanup after extension reload | PASS | UNVERIFIED |
| Popup quick themes and toggle | PASS | PASS (popup as page; toolbar popup UNVERIFIED) |
| Studio preview / revert / save; unavailable or closed target; MRU tab | PASS | PASS preview + save + persistence |
| Concurrent popup + Studio edits (no data loss) | PASS | n/a (extension-only) |
| Undo/redo, import/export, custom themes, shared custom theme | PASS | n/a (extension-only) |
| Wallpaper upload, blur edges (storage.local) | PASS | PASS wallpaper + blur rendered |
| Library limit / quota errors | PASS (unit, mocked storage) | UNVERIFIED (real quota) |
| Rendering performance with large wallpaper | UNVERIFIED (code review only) | UNVERIFIED |
| IndexedDB wallpaper persistence | UNVERIFIED (not implemented; PENDING) | UNVERIFIED |
| Code / Issues / PRs / Actions / Discussions / Releases / commits views | — | BLOCKED |
| Logged-in vs logged-out; high-contrast/colorblind/dimmed GitHub themes | — | BLOCKED |
| Chrome stable (headed), Windows/macOS rendering | — | UNVERIFIED |

No FAIL entries are known. Live github.com is BLOCKED only from the authoring container; it is verified automatically on GitHub Actions runners (logged out). Remaining manual items are listed above.
