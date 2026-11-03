# RepoVibe development roadmap

The source design specification describes a four-phase product. The delivered v0.1.0 is a functioning first milestone, with foundational capabilities only.

## Phase 1 — First installable release (this ZIP)

- [x] Installable Chrome MV3 package, no external executable code
- [x] GitHub repository detection and theme priority engine
- [x] Global, owner and repository-specific assignments
- [x] 20 coordinated built-in presets
- [x] Background gradients and locally compressed custom wallpapers
- [x] UI colors, typography choices, panel radius/glass, basic code and layout settings
- [x] Quick popup and responsive full Studio
- [x] Real-time temporary preview via Chrome tab connection
- [x] Safe theme JSON import/export and custom themes
- [x] Native appearance restoration, on/off toggle and basic tests
- [ ] Manual Chrome/GitHub integration acceptance across page types, account modes, and dynamic navigation
- [ ] Live rollout and Chrome Web Store publication

## Phase 2 — Durable visual platform

1. Move to TypeScript + React + Vite with reusable components and E2E testing.
2. Build page-type-specific adapters for GitHub code, issues, pull requests, discussions, actions, commits and settings; never rely on one universal selector.
3. Implement code font families, carefully validated diff colors and source-code contrast checks.
4. Add robust IndexedDB wallpaper asset management; avoid storing large base64 payloads in config.
5. Add profiles, saved theme duplication, rename, deletion, and per-view overrides.
6. Add reduced-motion settings and optional lightweight animations only after performance baselines.
7. Add error reporting locally, user-driven diagnostic export, migration handling and guarded rollback of faulty themes.
8. Add Playwright browser E2E + visual regression snapshots; test on current GitHub DOM after every release.

**Gate:** all real functionality verified in Chrome, no broken navigation/menus, no inaccessible text contrasts, all tests green, scope inheritance deterministic.

## Phase 3 — Smart styling

1. Language-based themes via safe source of repository language metadata; avoid unnecessary GitHub authentication or API calls.
2. Day/night or time-based switching with explicit timezone behavior.
3. Seasonal and random favorite rules with deterministic conflict resolution.
4. Performance settings, animation pause when hidden, CSS token resilience.
5. Page-specific theme overrides and rule editor.

**Gate:** conflicts visible in UI, predictable priority and no flicker or redundant network calls.

## Phase 4 — Community

1. Optional pack import/export and creator attribution.
2. Community theme browser with explicit user consent and security review.
3. Moderated theme data; no raw JavaScript or unrestricted CSS execution.
4. Backend only when justified by user-facing value, privacy review, and ongoing maintenance.

**Gate:** safe import schema, user control, clear permissions, abuse prevention and tested rollback.

## Engineering notes

The GitHub UI changes frequently. Prefer CSS variables, narrowly scoped selectors and feature detection. Keep source-code highlighting readable, treat security-sensitive pages conservatively, and never collect or modify repository contents. Test both current Chrome and GitHub before submission to the Chrome Web Store.
