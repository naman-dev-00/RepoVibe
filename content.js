/* GitHub-only isolated content script. All effects are CSS; no GitHub requests or file changes. */
(() => {
  'use strict';
  const C = globalThis.RepoVibeCore;
  const STYLE_ID = 'repovibe-style-v1';
  const WALLPAPER_STYLE_ID = 'repovibe-wallpaper-v1';
  const CARDS_STYLE_ID = 'repovibe-cards-v1';
  const MOTION_CLASSES = ['repv-motion-rain', 'repv-motion-fireflies', 'repv-motion-stars', 'repv-motion-holo', 'repv-motion-cinematic'];
  const reducedQuery = globalThis.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let config = C.normalizeConfig(null);
  let activePreview = null;
  let currentHref = location.href;
  let requestedId = 0;
  let configChanges = 0;
  let tornDown = false;

  const cssFont = font => ({
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    rounded: '"Trebuchet MS", "Segoe UI", sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    mono: 'ui-monospace, SFMono-Regular, Consolas, monospace'
  })[font] || '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  function rgba(hex, opacity) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${opacity})`;
  }

  const POSITION = { center: 'center center', top: 'center top', bottom: 'center bottom', left: 'left center', right: 'right center' };
  /* Wallpaper rendering model (Phase 1B P0 fix; replaces the full-width glass column that hid the scene on real GitHub).
     1. The scene is painted as the ROOT background (<html>, background-attachment:fixed): it sits on the canvas
        under every element, needs no negative z-index and cannot be hidden behind a root colour. Overlay, brightness
        and opacity are colour layers in the same background stack, so every slider changes the visible pixels.
        Blur (optional) adds a blurred copy on body::before above the root layer.
     2. Page shells and GitHub's surface tokens become transparent, so nothing stacks into an opaque wash.
     3. Readability comes from ONE layer of guarded glass on targeted panels only: header strips, side panes and the
        bordered boxes GitHub draws (file table, README, lists, comments). GitHub's React class names are hashed,
        so bordered boxes are detected at runtime from computed styles and tagged data-repv-panel. Panels nested in
        a panel are transparent. Gaps between panels show the scene at full strength.
     4. Loose text outside panels (repository title, About, toolbar labels) gets a theme-coloured halo.
     5. Menus, dialogs and popovers stay opaque; code stays ≥ 90 % opaque. */
  const SHELLS = 'body, .application-main, main, #js-repo-pjax-container, turbo-frame, .container-xl, .container-lg, .container-md, [class*="PageLayout-PageLayoutWrapper"], [class*="PageLayout-PageLayoutContent"], .PageLayout, [class*="PageLayout-Content"], .Layout, .Layout-main';
  const PANELS = '.AppHeader, header.GlobalNav, .Header, .js-header-wrapper header, #repository-container-header, .Box, .markdown-body, .Layout-sidebar, aside[class*="sidebar"], [class*="sidebarSection"], .BorderGrid-row, .Flash, [class*="Flash-Flash"], .blob-wrapper, .file, [data-testid="code-viewer"], .timeline-comment, [data-repv-panel]';
  // Floating UI must stay opaque and readable over any wallpaper.
  const FLOATING = '.Overlay, .Overlay-backdrop--center > *, .dropdown-menu, .SelectMenu-modal, .Popover-message, details-dialog, .Box--overlay, [role="menu"], [role="listbox"], [role="dialog"], [popover], .tooltipped::after';

  /** Root background stack: veils (top) over the image over the theme colour. Mirrors RepoVibeCore.sceneBackdrop. */
  function sceneLayers(v) {
    const layer = c => `linear-gradient(${c}, ${c}) fixed`;
    const out = [];
    if (v.wallpaperOpacity < 100) out.push(layer(rgba(v.bg, 1 - v.wallpaperOpacity / 100)));
    if (v.wallpaperOverlay > 0) out.push(layer(rgba(v.bg, v.wallpaperOverlay / 100)));
    const b = v.wallpaperBrightness / 100;
    if (b < 1) out.push(layer(`rgba(0,0,0,${(1 - b).toFixed(3)})`));
    else if (b > 1) out.push(layer(`rgba(255,255,255,${Math.min(0.6, (b - 1) * 0.5).toFixed(3)})`));
    return out;
  }

  /** @param hasImage  true when a wallpaper image is available → scene mode with targeted glass panels. */
  function buildCss(t, hasImage) {
    const v = C.normalizeTheme(t);
    const light = C.isLightColor(v.bg);
    const glass = hasImage;
    // Readability guard: the smallest single-layer panel opacity ≥ the user's choice at which text, secondary text and
    // links stay ≥ 4.6:1 over the brightest and darkest measured pixels of this scene (see RepoVibeCore.requiredGlass).
    const guard = glass ? C.panelOpacity(v) : null;
    const a = glass ? guard.opacity : v.glassOpacity / 100;
    const looseA = glass ? guard.loose : 1;
    const panel = rgba(v.surface, a);
    const inset = glass ? rgba(v.codeBg, Math.max(0.9, a)) : v.codeBg;
    const control = glass ? rgba(v.surface2, Math.max(0.85, a)) : v.surface2;
    const tint = rgba(v.bg, 0.3); // inner "muted" surfaces deepen the panel towards the theme background (more contrast, never another full glass layer)
    const gradient = `linear-gradient(${v.gradientAngle}deg, ${v.bg} 0%, ${v.gradientTo} 58%, ${v.gradientThird} 100%)`;
    const veils = glass ? sceneLayers(v) : [];
    const rootBackground = glass
      ? [...veils, `var(--repv-wallpaper, none) ${POSITION[v.wallpaperPosition]} / ${v.wallpaperSize} no-repeat fixed`, v.bg].join(', ')
      : v.backgroundMode === 'solid' ? v.bg : `${gradient} fixed`;
    const blur = glass && v.glass > 0 ? `backdrop-filter:blur(${v.glass}px) saturate(1.1); -webkit-backdrop-filter:blur(${v.glass}px) saturate(1.1);` : '';
    const halo = `0 0 1px ${rgba(v.bg, 1)}, 0 0 3px ${rgba(v.bg, 0.95)}, 0 0 8px ${rgba(v.bg, 0.9)}, 0 0 16px ${rgba(v.bg, 0.75)}`;
    const compact = v.layout === 'compact';
    // Whitelist only constrained colors, numbers and enum values. The wallpaper URL itself lives in a
    // separate style element (see renderWallpaper) and is either a bundled extension URL or a validated data URL.
    // --bgColor-emphasis is GitHub's *neutral* emphasis (tooltips, counters) paired with white text: not overridden.
    return `
html.repv-active { --bgColor-default:${glass ? 'transparent' : v.surface} !important; --bgColor-muted:${glass ? tint : v.surface2} !important;
 --bgColor-inset:${inset} !important;
 --fgColor-default:${v.text} !important; --fgColor-muted:${v.muted} !important;
 --fgColor-accent:${v.accent} !important; --fgColor-link:${v.accent} !important;
 --borderColor-default:${v.border} !important; --borderColor-muted:${v.border} !important;
 --overlay-bgColor:${v.surface} !important; --overlay-borderColor:${v.border} !important;
 --underlineNav-borderColor-active:${v.accent} !important; --focus-outlineColor:${v.accent} !important;
 --button-default-bgColor-rest:${control} !important;
 --button-default-fgColor-rest:${v.text} !important;
 --button-default-borderColor-rest:${v.border} !important;
 --control-borderColor-rest:${v.border} !important; --control-bgColor-rest:${control} !important;
 --color-canvas-default:${glass ? 'transparent' : v.surface} !important; --color-canvas-subtle:${glass ? tint : v.surface2} !important;
 --color-canvas-inset:${inset} !important; --color-fg-default:${v.text} !important;
 --color-fg-muted:${v.muted} !important; --color-accent-fg:${v.accent} !important;
 --color-border-default:${v.border} !important;
 ${glass ? (light ? '--fgColor-success:#0f5c27 !important; --fgColor-danger:#a0111f !important; --fgColor-attention:#6b4700 !important; --fgColor-done:#6a2fc2 !important;'
   : '--fgColor-success:#6ee787 !important; --fgColor-danger:#ff9492 !important; --fgColor-attention:#f2cc60 !important; --fgColor-done:#d2a8ff !important;') : ''}
 --repv-bg:${v.bg}; --repv-panel:${v.surface}; --repv-panel2:${v.surface2};
 --repv-text:${v.text}; --repv-muted:${v.muted}; --repv-accent:${v.accent}; --repv-border:${v.border};
 --repv-radius:${v.radius}px; --repv-blur:${v.glass}px; --repv-panel-opacity:${a};
 background:${rootBackground} !important; color-scheme:${light ? 'light' : 'dark'}; }
html.repv-active body { background:transparent !important; color:var(--repv-text) !important; font-family:${cssFont(v.font)} !important; }
${glass ? `html.repv-active :is(${SHELLS}) { background-color:transparent !important; backdrop-filter:none !important; }
html.repv-active :where(${PANELS}) { background-color:${panel} !important; ${blur} border-radius:var(--repv-radius); text-shadow:none; }
html.repv-active :is(.HeaderMktg, header.header-logged-out) { background-color:rgba(1,4,9,${Math.max(0.85, a)}) !important; } /* logged-out header text is always white */
html.repv-active :where(${PANELS}) :where(${PANELS}) { background-color:transparent !important; backdrop-filter:none !important; -webkit-backdrop-filter:none !important; }
html.repv-active :is(main, .application-main, [class*="PageLayout-Pane"]) { text-shadow:${halo}; }
html.repv-active :is(${PANELS}, ${FLOATING}, input, textarea, select, button, .btn, .Button, pre, code) { text-shadow:none; }
html.repv-active :is(input[type="text"], input[type="search"], textarea, select, .form-control, .FormControl-input, [class*="TextInputWrapper"]) { background-color:${control} !important; }
html.repv-active :is(main, .application-main) :is(a, h1, h2, h3, p, .Label, [class*="prc-Label"], .Counter, [class*="CounterLabel"], [data-variant="invisible"], .Button--invisible, .btn-octicon):not(:where(${PANELS}) *):not(.btn):not(:has(img)):not(:is([class*="ButtonBase"], .btn, button)[data-variant]:not([data-variant="invisible"])) { background-color:${rgba(v.bg, looseA)} !important; border-radius:6px; box-decoration-break:clone; -webkit-box-decoration-break:clone; }
html.repv-active :is(main, .application-main) a:has(img):not(:where(${PANELS}) *) > :is(span, strong):not(:has(img)) { background-color:${rgba(v.bg, looseA)} !important; border-radius:6px; padding:0 4px; }
html.repv-active :is(main, .application-main) :is(a, h1, h2, h3, p):not(:where(${PANELS}) *):not(.btn):not([class*="Button"]):not(:has(img)) { padding-left:4px; padding-right:4px; margin-left:-4px; margin-right:-4px; }
html.repv-active :where(${PANELS}) :not(pre) > code { background-color:${rgba(v.bg, 0.5)} !important; }
${light ? '' : `html.repv-active :is(.IssueLabel, [class*="IssueLabel"], [class*="TokenBase"], [class*="Token__"]) { box-shadow:inset 0 0 0 100vmax ${rgba(v.bg, 0.45)}; }`}
html.repv-active:is(.repv-motion-cinematic${v.wallpaperBlur > 0 ? ', *' : ''}) body::before { content:""; position:fixed; inset:${v.wallpaperBlur > 0 ? `-${v.wallpaperBlur * 2}px` : '-4%'}; z-index:-1; pointer-events:none;
 background:${[...veils.map(l => l.replace(' fixed', '')), `var(--repv-wallpaper, none) ${POSITION[v.wallpaperPosition]} / ${v.wallpaperSize} no-repeat`, v.bg].join(', ')};
 filter:${v.wallpaperBlur > 0 ? `blur(${v.wallpaperBlur}px)` : 'none'}; }` : `html.repv-active :is(.AppHeader, .Header, #repository-container-header, .Box, .markdown-body) { background-color:${v.surface} !important; }`}
html.repv-active :is(.AppHeader, .Header, #repository-container-header, .UnderlineNav, .js-header-wrapper, header.GlobalNav) { color:${v.text} !important; border-color:${v.border} !important; }
html.repv-active :is(.Box, .markdown-body, .blob-wrapper, .file, [data-repv-panel]) { border-color:${v.border} !important; }
html.repv-active :is(${FLOATING}) { background-color:${v.surface} !important; backdrop-filter:none !important; text-shadow:none; }
html.repv-active :is(.btn, .Button, button:not([class]), input[type="text"], input[type="search"], textarea) {
 border-radius:calc(var(--repv-radius) * .65) !important; }
html.repv-active :is(.btn, .Button, .form-control, .FormControl-input, .form-select) {
 border-color:${v.border} !important; }
html.repv-active :is(.color-fg-muted, .text-color-muted, .fgColor-muted) { color:${v.muted} !important; }
html.repv-active :is(.markdown-body pre, .highlight pre, .blob-code, .react-code-text, .react-code-line, .diff-table, .react-code-lines) {
 background-color:${inset} !important; }
html.repv-active :is(.blob-code, .react-code-text, .react-code-line, .markdown-body pre code, .highlight pre, .diff-table,
 #read-only-cursor-text-area, [data-testid="read-only-cursor-text-area"]) {
 font-family:ui-monospace, SFMono-Regular, Consolas, monospace !important; font-size:${v.codeFontSize}px !important; }
${v.layout === 'wide' ? `html.repv-active :is(.container-xl, .container-lg) { max-width:1800px !important; }` : ''}
${compact ? `html.repv-active :is(.Box-row, .react-directory-row) {padding-top:5px !important;padding-bottom:5px !important;}
html.repv-active .Layout {gap:12px !important;}` : ''}
${glass ? MOTION_CSS : ''}
@media (prefers-reduced-motion:no-preference) {
 html.repv-active :is(.Box, .btn, .Button) { transition:border-color .18s ease, box-shadow .18s ease; }
 ${v.vibe === 'neon' ? `html.repv-active :is(.Box:hover, .Button:hover) { box-shadow:0 0 14px ${v.accent}45; }` : ''}
}
@media (forced-colors:active) { html.repv-active { background:Canvas !important; } html.repv-active * { text-shadow:none !important; } }
`;
  }

  /* ---- Runtime panel detection: GitHub's React UI draws its boxes (file table, README, issue lists, comment cards)
     with hashed CSS-module classes, so they are found by their computed border instead: a visible border on all four
     sides, rounded corners and a reasonable size, not inside another panel or floating UI. Tagged data-repv-panel;
     the attribute is removed when RepoVibe is inactive or disabled. Throttled; scans only the main content. */
  const PANEL_ATTR = 'data-repv-panel';
  let panelScanQueued = false;
  let panelChecked = new WeakSet(); // each element's computed style is read once (reset when the theme changes)
  function isBoxed(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 200 || r.height < 30) return false;
    if (el.tagName === 'TABLE') return true; // data tables (repository file list) draw borders per cell
    const cs = getComputedStyle(el);
    const sides = ['Top', 'Right', 'Bottom', 'Left'].filter(k => cs[`border${k}Style`] !== 'none' && parseFloat(cs[`border${k}Width`]) >= 1).length;
    const rounded = ['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'].some(k => parseFloat(cs[`border${k}Radius`]) >= 3);
    if (sides >= 3 && rounded) return true; // boxes, and box headers/footers rounded on one end
    // list views (issues, pull requests): a rounded clipping container whose outline is drawn by its children
    return rounded && (cs.overflow === 'hidden' || cs.overflowY === 'hidden') && r.width >= 300 && r.height >= 60;
  }
  function scanPanels() {
    panelScanQueued = false;
    if (tornDown || !document.documentElement.classList.contains('repv-active') || !lastWallpaperUrl) return;
    const scope = document.querySelector('main, .application-main, [data-turbo-body]') || document.body;
    if (!scope) return;
    const candidates = scope.querySelectorAll('div, section, table, ul, ol, nav, article, form, details');
    const limit = Math.min(candidates.length, 6000);
    for (let i = 0; i < limit; i++) {
      const el = candidates[i];
      if (panelChecked.has(el) || el.hasAttribute(PANEL_ATTR)) continue;
      panelChecked.add(el);
      if (el.closest(`[${PANEL_ATTR}], ${FLOATING}`) || el.closest(PANELS.replace(', [data-repv-panel]', ''))) continue;
      if (isBoxed(el)) el.setAttribute(PANEL_ATTR, '');
    }
  }
  function queuePanelScan() {
    if (panelScanQueued) return;
    panelScanQueued = true;
    setTimeout(() => requestAnimationFrame(scanPanels), 120);
  }
  function clearPanels() { panelChecked = new WeakSet(); for (const el of document.querySelectorAll(`[${PANEL_ATTR}]`)) el.removeAttribute(PANEL_ATTR); }

  /* ---- Live wallpapers: lightweight ambient motion drawn with two fixed, pointer-events:none pseudo-element layers
     (html::after, body::after) between the wallpaper and the page. Only transform/opacity are animated (compositor
     work, no layout). Classes on <html>: repv-motion-<kind> (+ repv-motion-cinematic). Disabled entirely for
     prefers-reduced-motion and in Static mode. Content panels stay above the layers, so motion shows in the margins
     and softly through glass, and never intercepts input. */
  const M = 'html.repv-active';
  const LAYER = 'content:""; position:fixed; pointer-events:none; z-index:-1; will-change:transform, opacity;';
  // Particle tiles are small procedurally generated SVGs (seeded, so identical on every page) used as repeating
  // data: images — GitHub's CSP already allows data: images (the uploaded-wallpaper path relies on it too).
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const svgUrl = (w, h, body, defs = '') => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><defs>${defs}</defs>${body}</svg>`)}")`;
  function rainTile(seed, n, alpha) {
    const r = rng(seed); let body = '';
    for (let i = 0; i < n; i++) { const x = r() * 400, y = r() * 400, len = 14 + r() * 30; body += `<line x1='${x.toFixed(1)}' y1='${y.toFixed(1)}' x2='${(x - len * 0.16).toFixed(1)}' y2='${(y + len).toFixed(1)}' stroke='url(#d)' stroke-width='${(0.8 + r() * 0.7).toFixed(2)}' opacity='${(alpha * (0.45 + r() * 0.55)).toFixed(2)}'/>`; }
    return svgUrl(400, 400, body, `<linearGradient id='d' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#bcd4ff' stop-opacity='0'/><stop offset='1' stop-color='#d9e6ff'/></linearGradient>`);
  }
  function glowTile(seed, w, h, n, colors, rMin, rMax) {
    const r = rng(seed); let body = '';
    for (let i = 0; i < n; i++) { const c = i % colors.length; body += `<circle cx='${(r() * w).toFixed(1)}' cy='${(r() * h).toFixed(1)}' r='${(rMin + r() * (rMax - rMin)).toFixed(2)}' fill='url(#g${c})' opacity='${(0.55 + r() * 0.45).toFixed(2)}'/>`; }
    return svgUrl(w, h, body, colors.map((col, i) => `<radialGradient id='g${i}'><stop offset='0' stop-color='#fff'/><stop offset='.18' stop-color='${col}'/><stop offset='1' stop-color='${col}' stop-opacity='0'/></radialGradient>`).join(''));
  }
  const RAIN_NEAR = rainTile(7, 34, 0.55), RAIN_FAR = rainTile(19, 60, 0.3);
  const FLIES_A = glowTile(3, 900, 700, 9, ['#ffe27a', '#b6ff9a', '#fff1a8'], 7, 12), FLIES_B = glowTile(11, 1300, 900, 12, ['#ffd86b', '#9dffd0'], 5, 9);
  const STARS_A = glowTile(5, 600, 600, 46, ['#eef2ff', '#cfd8ff', '#fff4e0'], 1.4, 3.2), STARS_B = glowTile(23, 820, 820, 40, ['#d8ccff', '#bfe0ff'], 1.1, 2.4);
  const MOTION_CSS = `
${M}.repv-motion-rain::after { ${LAYER} left:-10%; right:-10%; top:-400px; height:calc(100vh + 800px);
 background:${RAIN_NEAR} 0 0 / 400px 400px repeat, ${RAIN_FAR} 0 0 / 200px 200px repeat; opacity:.8; animation:repv-rain .6s linear infinite; }
${M}.repv-motion-rain body::after { ${LAYER} inset:-8%;
 background:radial-gradient(40% 24% at 15% 34%, rgba(255,60,200,.16), transparent 70%), radial-gradient(35% 22% at 85% 38%, rgba(60,200,255,.14), transparent 70%), radial-gradient(70% 16% at 50% 88%, rgba(150,170,255,.12), transparent 70%);
 animation:repv-flicker 7s steps(1) infinite, repv-fog 38s ease-in-out infinite alternate; }
${M}.repv-motion-fireflies::after { ${LAYER} inset:-40px;
 background:${FLIES_A} 0 0 / 900px 700px repeat;
 animation:repv-fly-a 13s ease-in-out infinite alternate, repv-pulse 3.2s ease-in-out infinite alternate; }
${M}.repv-motion-fireflies body::after { ${LAYER} inset:-60px;
 background:${FLIES_B} 120px 80px / 1300px 900px repeat, radial-gradient(60% 22% at 30% 88%, rgba(120,230,210,.11), transparent 70%), radial-gradient(50% 18% at 78% 72%, rgba(110,200,255,.08), transparent 70%);
 animation:repv-fly-b 17s ease-in-out infinite alternate, repv-pulse 4.6s ease-in-out infinite alternate-reverse; }
${M}.repv-motion-stars::after { ${LAYER} inset:0; background:${STARS_A} 0 0 / 600px 600px repeat;
 animation:repv-twinkle 3.4s ease-in-out infinite alternate; }
${M}.repv-motion-stars body::after { ${LAYER} inset:-12%;
 background:${STARS_B} 0 0 / 820px 820px repeat, radial-gradient(40% 30% at 18% 30%, rgba(150,80,255,.13), transparent 70%), radial-gradient(35% 30% at 82% 75%, rgba(60,140,255,.11), transparent 70%);
 animation:repv-nebula 70s ease-in-out infinite alternate, repv-twinkle 5.2s ease-in-out infinite alternate-reverse; }
${M}.repv-motion-holo::after { ${LAYER} left:0; right:0; top:-64px; height:calc(100vh + 128px);
 background-image:linear-gradient(rgba(0,150,230,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(0,150,230,.10) 1px, transparent 1px);
 background-size:64px 64px; -webkit-mask-image:linear-gradient(transparent, #000 35%, #000 70%, transparent); mask-image:linear-gradient(transparent, #000 35%, #000 70%, transparent);
 animation:repv-grid 9s linear infinite; }
${M}.repv-motion-holo body::after { ${LAYER} left:0; right:0; top:0; height:28vh;
 background:linear-gradient(transparent, rgba(80,200,255,.12) 47%, rgba(160,235,255,.22) 50%, rgba(80,200,255,.12) 53%, transparent);
 animation:repv-scan 12s ease-in-out infinite; }
${M}.repv-motion-cinematic::after { animation-duration:.4s, 2.4s; }
${M}.repv-motion-cinematic body::before { animation:repv-parallax 48s ease-in-out infinite alternate; will-change:transform; }
@keyframes repv-rain { from { transform:translate3d(0,0,0); } to { transform:translate3d(-64px,400px,0); } }
@keyframes repv-fog { from { transform:translate3d(-3%,0,0); } to { transform:translate3d(3%,-1%,0); } }
@keyframes repv-flicker { 0%, 100% { opacity:1; } 41% { opacity:.55; } 43% { opacity:1; } 72% { opacity:.7; } 73% { opacity:1; } 88% { opacity:.6; } 89% { opacity:1; } }
@keyframes repv-fly-a { from { transform:translate3d(0,0,0); } 50% { transform:translate3d(18px,-26px,0); } to { transform:translate3d(-14px,-8px,0); } }
@keyframes repv-fly-b { from { transform:translate3d(0,0,0); } 50% { transform:translate3d(-22px,-14px,0); } to { transform:translate3d(16px,-30px,0); } }
@keyframes repv-pulse { from { opacity:.25; } to { opacity:1; } }
@keyframes repv-twinkle { from { opacity:.35; } to { opacity:1; } }
@keyframes repv-nebula { from { transform:translate3d(-2%,0,0) scale(1); } to { transform:translate3d(2%,-2%,0) scale(1.06); } }
@keyframes repv-grid { from { transform:translate3d(0,0,0); } to { transform:translate3d(0,64px,0); } }
@keyframes repv-scan { from { transform:translate3d(0,-30vh,0); } to { transform:translate3d(0,105vh,0); } }
@keyframes repv-parallax { from { transform:scale(1.03) translate3d(-.8%,0,0); } to { transform:scale(1.07) translate3d(.8%,-.6%,0); } }
@media (prefers-reduced-motion:reduce) { ${M}::after, ${M} body::after, ${M} body::before { animation:none !important; } }
`;
  function applyMotion(root, theme, hasImage) {
    const motion = hasImage ? C.motionFor(theme, config, Boolean(reducedQuery?.matches)) : { kind: 'none', mode: 'static' };
    const wanted = motion.kind === 'none' ? [] : [`repv-motion-${motion.kind}`, ...(motion.mode === 'cinematic' ? ['repv-motion-cinematic'] : [])];
    for (const c of MOTION_CLASSES) if (root.classList.contains(c) !== wanted.includes(c)) root.classList.toggle(c, wanted.includes(c));
    return wanted.join(' ');
  }

  /* ---- Wallpaper resolution: bundled assets, IndexedDB assets (via service worker), legacy inline data. */
  const DATA_IMAGE = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
  const wallpaperCache = new Map(); // ref -> { url } | { pending: true } | { url: null } (missing/corrupted)
  function wallpaperUrl(theme) {
    if (!theme || theme.backgroundMode !== 'image') return null;
    const ref = theme.wallpaperRef || '';
    const builtin = /^builtin:([a-z0-9-]+)$/.exec(ref);
    if (builtin) { const w = C.WALLPAPERS.find(x => x.slug === builtin[1]); return w ? chrome.runtime.getURL(w.path) : null; }
    const idb = /^idb:(.+)$/.exec(ref);
    if (idb) {
      const hit = wallpaperCache.get(ref);
      if (hit) return hit.pending ? undefined : hit.url;
      wallpaperCache.set(ref, { pending: true });
      try {
        chrome.runtime.sendMessage({ type: 'WALLPAPER_GET', id: idb[1] }, response => {
          void chrome.runtime.lastError;
          const url = response && response.ok && DATA_IMAGE.test(response.dataUrl || '') ? response.dataUrl : null;
          wallpaperCache.set(ref, { url });
          while (wallpaperCache.size > 3) wallpaperCache.delete(wallpaperCache.keys().next().value); // bound memory
          render();
        });
      } catch (_) { wallpaperCache.set(ref, { url: null }); }
      return undefined;
    }
    return theme.wallpaper && DATA_IMAGE.test(theme.wallpaper) ? theme.wallpaper : null; // legacy v1
  }
  function renderWallpaper(url) {
    let el = document.getElementById(WALLPAPER_STYLE_ID);
    if (!url) { if (el) el.remove(); return; }
    const css = `html.repv-active{--repv-wallpaper:url("${url}");}`;
    if (!el) { el = document.createElement('style'); el.id = WALLPAPER_STYLE_ID; (document.head || document.documentElement).appendChild(el); }
    if (el.textContent !== css) el.textContent = css;
  }

  /* ---- Automatic assignment: persist the first deterministic pick so it never changes later. Batched (in order)
     so the Home sidebar's rows are stored in one write and siblings pick distinct themes exactly as on their pages. */
  const persisting = new Set();
  function persistAutoAssignments(keys) {
    keys = keys.filter(k => !persisting.has(k));
    if (!keys.length) return;
    keys.forEach(k => persisting.add(k));
    C.updateConfig(latest => {
      if (!latest.enabled || !latest.autoAssign) return false;
      let changed = false;
      for (const key of keys) {
        const owner = key.split('/')[0];
        if (Object.hasOwn(latest.repoAssignments, key) || Object.hasOwn(latest.ownerAssignments, owner) || Object.hasOwn(latest.autoAssignments, key)) continue;
        latest.autoAssignments[key] = C.pickAutoTheme(key, latest);
        changed = true;
      }
      return changed ? latest : false;
    }).catch(() => { keys.forEach(k => persisting.delete(k)); });
  }
  const persistAutoAssignment = key => persistAutoAssignments([key]);

  // GitHub picks its base token set from data-color-mode. A light RepoVibe theme on a dark-mode
  // account (or vice versa) would otherwise keep the wrong mode for every token we do not override.
  // Rules: only touch the attribute when GitHub's effective mode differs from the theme's; remember
  // the user's value in the DOM; if GitHub/the user changes appearance while we are active, adopt that
  // as the new value to restore (never restore a stale one).
  const MODE_ATTR = 'data-color-mode';
  const ORIGINAL_MODE_ATTR = 'data-repv-original-color-mode';
  const WRITTEN_MODE_ATTR = 'data-repv-color-mode';
  const darkQuery = globalThis.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  const effectiveMode = value => value === 'light' || value === 'dark' ? value : (darkQuery?.matches ? 'dark' : 'light');
  const themeMode = theme => theme ? (C.isLightColor(theme.bg) ? 'light' : 'dark') : null;
  // `wanted` is 'light' | 'dark' | null (inactive). Kept cheap: this runs on observer ticks.
  function applyColorMode(root, wanted) {
    const current = root.getAttribute(MODE_ATTR);
    const written = root.getAttribute(WRITTEN_MODE_ATTR);
    if (written !== null && current !== written) {
      root.setAttribute(ORIGINAL_MODE_ATTR, current ?? '');
      root.removeAttribute(WRITTEN_MODE_ATTR);
    }
    const touched = root.hasAttribute(WRITTEN_MODE_ATTR);
    const userMode = touched ? root.getAttribute(ORIGINAL_MODE_ATTR) || null : current;
    if (wanted && effectiveMode(userMode) !== wanted) {
      if (!touched) root.setAttribute(ORIGINAL_MODE_ATTR, userMode ?? '');
      root.setAttribute(WRITTEN_MODE_ATTR, wanted);
      if (current !== wanted) root.setAttribute(MODE_ATTR, wanted);
      return;
    }
    if (touched) {
      if (userMode) root.setAttribute(MODE_ATTR, userMode); else root.removeAttribute(MODE_ATTR);
    }
    root.removeAttribute(WRITTEN_MODE_ATTR);
    root.removeAttribute(ORIGINAL_MODE_ATTR);
  }

  /* ---- GitHub Home: themed "Top repositories" cards. Each row of the signed-in dashboard sidebar shows a miniature of
     its own repository's resolved theme (manual > owner > automatic > global), behind guarded glass so the name stays
     readable. Only rows whose link is exactly /owner/repo are styled; links, avatars and click behaviour are untouched
     (we only add data-repv-card* attributes and one <style>). Nothing is fetched from GitHub. */
  const isHome = () => location.hostname === 'github.com' && (location.pathname === '/' || location.pathname === '/dashboard');
  const HEADING = /^\s*top repositories\s*$/i;
  function topRepositoryRows() {
    let container = document.getElementById('dashboard-repos-container') || document.querySelector('.js-repos-container');
    if (!container) {
      const heading = [...document.querySelectorAll('aside h2, aside h3, h2, h3, [role="heading"]')].find(h => HEADING.test(h.textContent || ''));
      for (let el = heading?.parentElement, i = 0; el && i < 5 && !container; el = el.parentElement, i++) if (el.querySelector('li a[href]')) container = el;
    }
    if (!container) return [];
    const rows = [];
    for (const li of container.querySelectorAll('li')) {
      for (const a of li.querySelectorAll('a[href]')) {
        let u; try { u = new URL(a.getAttribute('href'), location.origin); } catch (_) { continue; }
        if (u.origin !== location.origin || u.pathname.split('/').filter(Boolean).length !== 2) continue;
        const repo = C.repositoryFromUrl(u.href);
        if (repo) { rows.push({ li, repo, href: u.href }); break; }
      }
    }
    return rows;
  }
  const cardImageCache = new Map(); // idb ref -> { url } | { pending }
  function cardImage(theme) {
    if (!theme || theme.backgroundMode !== 'image') return null;
    const builtin = /^builtin:([a-z0-9-]+)$/.exec(theme.wallpaperRef || '');
    if (builtin) { const w = C.WALLPAPERS.find(x => x.slug === builtin[1]); return w ? chrome.runtime.getURL(w.thumb) : null; }
    const idb = /^idb:(.+)$/.exec(theme.wallpaperRef || '');
    if (!idb) return theme.wallpaper && DATA_IMAGE.test(theme.wallpaper) ? theme.wallpaper : null;
    const hit = cardImageCache.get(theme.wallpaperRef);
    if (hit) return hit.url || null;
    if (cardImageCache.size >= 8) return null; // bounded: further uploads fall back to the theme colours
    cardImageCache.set(theme.wallpaperRef, { pending: true });
    try {
      chrome.runtime.sendMessage({ type: 'WALLPAPER_GET', id: idb[1] }, response => {
        void chrome.runtime.lastError;
        cardImageCache.set(theme.wallpaperRef, { url: response && response.ok && DATA_IMAGE.test(response.dataUrl || '') ? response.dataUrl : null });
        renderCards();
      });
    } catch (_) { cardImageCache.set(theme.wallpaperRef, { url: null }); }
    return null;
  }
  function cardRule(theme) {
    const v = C.normalizeTheme(theme);
    // Text sits on the left part of the card over theme-coloured glass; guard it like page panels (≥ 4.6:1 for
    // name, muted owner and accent against the brightest/darkest pixels of the art).
    const a = C.requiredGlass({ ...v, surface: v.bg, glassOpacity: 62, wallpaperOverlay: 0, wallpaperBrightness: 100, wallpaperOpacity: 100 }, C.wallpaperTone(v.wallpaperRef));
    const img = cardImage(theme);
    return `li[data-repv-card="${theme.id}"] { --repv-card-glass:${rgba(v.bg, a)}; --repv-card-solid:${v.bg}; --repv-card-text:${v.text};
 --repv-card-muted:${v.muted}; --repv-card-accent:${v.accent}; --repv-card-border:${rgba(v.border, 0.9)};
 --repv-card-img:${img ? `url("${img}")` : `linear-gradient(135deg, ${v.bg}, ${v.gradientTo} 60%, ${v.gradientThird})`}; }`;
  }
  const CARD_CSS = `
li[data-repv-card] { position:relative; list-style:none; margin:6px 0 0 !important; padding:6px 46px 6px 10px !important; border-radius:10px;
 border:1px solid var(--repv-card-border); overflow:hidden; color:var(--repv-card-text) !important;
 background-color:var(--repv-card-solid) !important;
 background-image:linear-gradient(90deg, var(--repv-card-glass) 0, var(--repv-card-glass) calc(100% - 58px), transparent calc(100% - 14px)), var(--repv-card-img) !important;
 background-size:auto, cover !important; background-position:center, center right !important; background-repeat:no-repeat !important;
 box-shadow:0 1px 2px rgba(0,0,0,.18); }
li[data-repv-card] > div { margin-top:0 !important; align-items:center; }
li[data-repv-card] a, li[data-repv-card] a * { color:var(--repv-card-text) !important; }
li[data-repv-card] a span, li[data-repv-card] .color-fg-muted { color:var(--repv-card-muted) !important; }
li[data-repv-card] a:hover { text-decoration:underline; text-decoration-color:var(--repv-card-accent); }
li[data-repv-card]:focus-within { outline:2px solid var(--repv-card-accent); outline-offset:1px; }
@media (prefers-reduced-motion:no-preference) {
 li[data-repv-card] { transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease; }
 li[data-repv-card]:hover { transform:translateY(-1px); border-color:var(--repv-card-accent); box-shadow:0 6px 16px rgba(0,0,0,.28), 0 0 0 1px var(--repv-card-accent); }
}
@media (prefers-contrast:more) { li[data-repv-card] { background-image:none !important; } }
@media (forced-colors:active) { li[data-repv-card] { background:none !important; border:1px solid CanvasText; padding:4px 0 !important; }
 li[data-repv-card] a, li[data-repv-card] a * { color:LinkText !important; } }
`;
  function clearCards() {
    document.getElementById(CARDS_STYLE_ID)?.remove();
    for (const li of document.querySelectorAll('li[data-repv-card]')) li.removeAttribute('data-repv-card');
  }
  let lastCardsCss = '';
  function renderCards() {
    if (tornDown) return;
    const rows = isHome() && config.enabled ? topRepositoryRows() : [];
    if (!rows.length) { if (lastCardsCss || document.querySelector('li[data-repv-card]')) { clearCards(); lastCardsCss = ''; } return; }
    const themes = new Map(), unpersisted = [];
    for (const { li, repo } of rows) {
      const r = C.themeResolution(config, `https://github.com/${repo.key}`);
      if (r.source === 'auto' && !r.persisted) unpersisted.push(repo.key);
      if (!r.theme) { if (li.hasAttribute('data-repv-card')) li.removeAttribute('data-repv-card'); continue; }
      themes.set(r.theme.id, r.theme);
      if (li.getAttribute('data-repv-card') !== r.theme.id) li.setAttribute('data-repv-card', r.theme.id);
    }
    if (unpersisted.length) persistAutoAssignments(unpersisted);
    const css = themes.size ? CARD_CSS + [...themes.values()].map(cardRule).join('\n') : '';
    let el = document.getElementById(CARDS_STYLE_ID);
    if (!css) { el?.remove(); lastCardsCss = ''; return; }
    if (!el) { el = document.createElement('style'); el.id = CARDS_STYLE_ID; (document.head || document.documentElement).appendChild(el); }
    if (el.textContent !== css) el.textContent = css;
    lastCardsCss = css;
  }

  let lastTheme = null;
  let lastMode = null;
  let lastWallpaperUrl = null;
  let lastMotion = '';
  function render() {
    if (tornDown) return;
    const resolution = C.themeResolution(config, location.href);
    if (!activePreview && resolution.source === 'auto' && !resolution.persisted && resolution.repository) persistAutoAssignment(resolution.repository.key);
    const theme = activePreview || resolution.theme;
    lastTheme = theme;
    lastMode = themeMode(theme);
    const root = document.documentElement;
    if (!root) return;
    let style = document.getElementById(STYLE_ID);
    if (!theme) {
      root.classList.remove('repv-active', ...MOTION_CLASSES);
      lastMotion = '';
      clearPanels();
      if (style) style.remove();
      renderWallpaper(null);
      applyColorMode(root, null);
      renderCards();
      return;
    }
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || root).appendChild(style);
    }
    const url = wallpaperUrl(theme);
    lastWallpaperUrl = url || null;
    renderWallpaper(url);
    const css = buildCss(theme, Boolean(url));
    if (style.textContent !== css) style.textContent = css;
    root.classList.add('repv-active');
    lastMotion = applyMotion(root, theme, Boolean(url));
    applyColorMode(root, lastMode);
    if (url) queuePanelScan(); else clearPanels();
    renderCards();
  }
  // GitHub navigations can swap <head> or reset <html> attributes; restore our state if lost.
  function ensureApplied() {
    const root = document.documentElement;
    if (!lastTheme || !root) return;
    if (!document.getElementById(STYLE_ID) || !root.classList.contains('repv-active') || (lastWallpaperUrl && !document.getElementById(WALLPAPER_STYLE_ID))
      || lastMotion.split(' ').some(c => c && !root.classList.contains(c))) render();
    else applyColorMode(root, lastMode);
  }

  // After the extension is reloaded, updated, disabled or removed, this script is orphaned: chrome.*
  // calls throw and no new script replaces it. Stop observing and restore GitHub's own appearance.
  function extensionAlive() {
    try { return Boolean(chrome.runtime?.id); } catch (_) { return false; }
  }
  function teardown() {
    if (tornDown) return;
    tornDown = true;
    observer.disconnect();
    rootObserver.disconnect();
    for (const [target, type] of NAV_EVENTS) target.removeEventListener(type, onNavigation);
    globalThis.navigation?.removeEventListener?.('navigatesuccess', onNavigation);
    darkQuery?.removeEventListener?.('change', onSystemModeChange);
    activePreview = null; lastTheme = null; lastMode = null;
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(WALLPAPER_STYLE_ID)?.remove();
    clearCards();
    clearPanels();
    reducedQuery?.removeEventListener?.('change', onReducedMotionChange);
    if (document.documentElement) { document.documentElement.classList.remove('repv-active', ...MOTION_CLASSES); applyColorMode(document.documentElement, null); }
  }
  function guard(fn) {
    return (...args) => { if (tornDown) return; if (!extensionAlive()) { teardown(); return; } fn(...args); };
  }
  function onReducedMotionChange() { if (!tornDown) render(); }
  function onSystemModeChange() { if (lastMode && document.documentElement) applyColorMode(document.documentElement, lastMode); }

  function updateForNavigation() {
    if (location.href === currentHref) return;
    currentHref = location.href;
    // Keep an active Studio preview across in-page navigation; it ends when the Studio disconnects.
    render();
  }
  const onNavigation = guard(() => queueMicrotask(updateForNavigation));
  const NAV_EVENTS = [[document, 'turbo:load'], [document, 'turbo:render'], [document, 'pjax:end'], [window, 'popstate'], [window, 'pageshow']];
  for (const [target, type] of NAV_EVENTS) target.addEventListener(type, onNavigation);
  globalThis.navigation?.addEventListener?.('navigatesuccess', onNavigation);
  darkQuery?.addEventListener?.('change', onSystemModeChange);
  reducedQuery?.addEventListener?.('change', onReducedMotionChange);
  // URL fallback for GitHub SPA navigation that does not fire a standard event.
  // The observer only checks the URL; it does not restyle per DOM mutation.
  let scheduled = false;
  const observer = new MutationObserver(guard(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; if (!tornDown) { updateForNavigation(); ensureApplied(); if (lastWallpaperUrl) queuePanelScan(); if (isHome()) renderCards(); } });
  }));
  const rootObserver = new MutationObserver(guard(ensureApplied));
  const startObserver = () => {
    if (document.documentElement) {
      observer.observe(document.documentElement, { childList:true, subtree:true });
      rootObserver.observe(document.documentElement, { attributes:true, attributeFilter:['class', 'data-color-mode'] });
    }
  };
  if (document.documentElement) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, {once:true});

  chrome.storage.onChanged.addListener(guard((changes, area) => {
    if (area !== 'local' || !changes[C.STORAGE_KEY]) return;
    config = C.normalizeConfig(changes[C.STORAGE_KEY].newValue);
    configChanges++;
    if (!activePreview) render();
  }));
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== 'repovibe-preview') return;
    port.onMessage.addListener(message => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'PREVIEW' && message.theme) {
        try { activePreview = C.normalizeTheme(message.theme); render(); } catch (_) { /* Invalid preview */ }
      } else if (message.type === 'CLEAR') { activePreview = null; render(); }
    });
    port.onDisconnect.addListener(() => { activePreview = null; render(); });
  });
  chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
    if (message && message.type === 'GET_REPO') {
      sendResponse({href: location.href, repository: C.repositoryFromUrl(location.href)});
    }
  });
  async function init() {
    const thisRequest = ++requestedId;
    const changesBefore = configChanges;
    // Ignore the initial read if storage changed meanwhile: onChanged already holds newer data.
    try { const loaded = await C.loadConfig(); if (thisRequest === requestedId && configChanges === changesBefore) config = loaded; }
    catch (e) { console.warn('[RepoVibe] Unable to load preferences', e); }
    render();
  }
  init();
})();
