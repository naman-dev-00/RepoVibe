# Acceptance & defect report — v0.1.1

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

No permission changes were needed: `tabs.query`/`tabs.get` URLs and `tabs.connect` work for github.com tabs with the existing `host_permissions`.

## Automated tests

| Command | Result |
|---|---|
| `npm run check` | pass |
| `npm test` (unit) | 9 / 9 pass |
| `npm run test:e2e` (Chromium + extension) | 11 / 11 pass |

The E2E suite was also run against the **original v0.1.0 source**: 6 of 11 tests fail there (emphasis/accent, light-on-dark mode, prototype owners, layout/code textarea, preview across navigation, null import), confirming the tests detect the defects above.

E2E coverage: no-effect when disabled/native (pixel-identical to a browser without the extension), preset token application, light/dark base mode switch and restore, repo > owner > global priority, wide/compact/code-size controls, pushState + `turbo:load` + back navigation, popup quick theme + engine toggle, Studio preview → close reverts → save persists after reload, color/slider edits with undo/redo, custom theme save, JSON export download, JSON import (sanitized, prototype-safe, error path), wallpaper upload compression/blur/persistence, 390px-wide Studio without horizontal scroll, and zero console/page errors in every test. Visual baselines live in `tests/e2e/__screenshots__` (refresh with `UPDATE_SNAPSHOTS=1`).

## Known limitations

- Selectors and tokens still need verification against live GitHub (see README checklist); the fixture cannot prove GitHub's current DOM.
- Visual baselines are rendered by Linux Chromium; other platforms may need `UPDATE_SNAPSHOTS=1` locally.
- Wallpapers still live in `chrome.storage.local` (≈10 MB quota); IndexedDB migration remains a Phase 2 item.
- Editing a saved custom theme updates every repository using it (second-assignment item).
