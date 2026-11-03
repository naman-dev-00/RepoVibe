# Claude Code handoff prompt

Paste the following into Claude Code after pushing the RepoVibe source ZIP contents into a GitHub repository:

---

You are working in the RepoVibe Chrome extension repository. This is an existing first-release codebase, NOT an empty project. Read README.md, docs/ROADMAP.md, manifest.json, shared/core.js, content.js, popup.js, studio.js, ui.css, and all tests before editing.

**Product vision:** RepoVibe is a privacy-first Chrome extension that allows global, owner-specific and repository-specific GitHub appearance themes, a theme gallery, local wallpapers, a live visual editor and safe import/export. The root product specification is more extensive than the current code: do not claim the full feature vision is complete.

**First assignment — actual Chrome acceptance and defect remediation (priority 1):**
1. Use a feature branch. Do not merge to main automatically.
2. Install the unpacked extension in a real Chromium/Chrome browser with Developer Mode. If the environment cannot launch Chrome, record the restriction and do not invent browser test results.
3. Open several public GitHub repositories in normal Chrome, including light/dark GitHub base theme modes. Test Code, Issues, Pull requests, Actions, Discussions, Releases, commits, README, and narrow viewport screens.
4. Verify extension popup, repo detection, repository switching, owner/global precedence, appearance reset, enabled toggle, and live Studio preview. Confirm preview reverts when the Studio closes without saving.
5. Verify every UI control does what its label promises, including image upload, CSS blur/opacity, gradients, fonts, wide/compact layout, code readability, undo/redo, JSON import/export and custom theme persistence.
6. Check that icons load and Chrome reports no manifest/CSP/runtime errors. Verify `chrome.tabs.get`/`tabs.query`/`tabs.connect` work with declared permissions and make minimum permission adjustments only if needed.
7. Identify fragile GitHub selectors, nonfunctional controls, contrast issues, navigation/layout regressions, and CSS rule interactions; fix rather than hide failures. Avoid changing GitHub's functional semantics or sensitive controls.
8. Add browser E2E tests with an appropriate extension-capable test environment. Include screenshot comparisons for the key pages, error capture, checks for no visual effect when disabled, and tests for React/Turbo client-side navigation.
9. Keep safety: themes are data-only, no remote code, no arbitrary CSS import, no GitHub credentials, no content extraction or external telemetry, no permission to unrelated domains. Watch for CSS injection, XSS, prototype-key, schema and wallpaper quota issues.
10. Run `npm test` and `npm run check`; record pass/fail and commands. Test Chrome installation manually when possible.

**Second assignment — quality improvements (only after defects are addressed):**
- Introduce a versioned configuration migration strategy and robust backup/restore behavior.
- Add accessible keyboard interactions, contrast warnings, reduced-motion control and a local diagnostics interface.
- Add explicit theme deletion/duplication and make editing an existing shared custom theme's effect on multiple repositories clear.
- Improve wallpaper storage architecture to support multiple large images via IndexedDB while keeping permissions narrow.
- Consider migrating interface components to React + TypeScript + Vite per ROADMAP. If migrating, ensure CSP-compatible bundled assets, independently bundled content scripts, and no production dependencies loaded from CDNs. Retain a working extension at each PR.

**Deliverables:**
- A concise findings report with reproducible defects and severity, plus fixes.
- Updated extension source and docs, no placeholder controls.
- New or improved automated tests, including passing commands and exact test counts.
- A working extension package under a reproducible build/install process.
- A small, reviewable pull request with evidence, including a manual test matrix and known limitations.

Never say a feature is tested unless it was executed. Never claim you merged or published anything until that action actually occurred. Prioritize usable functionality and GitHub compatibility over decorative features.

---
