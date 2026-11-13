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
  const PANELS = '.AppHeader, header.GlobalNav, .Header, .js-header-wrapper header, #repository-container-header, .Box, .markdown-body, .Layout-sidebar, aside[class*="sidebar"], [class*="sidebarSection"], .BorderGrid-row, .Flash, [class*="Flash-Flash"], .blob-wrapper, .file, [data-testid="code-viewer"], .timeline-comment, footer.footer, .footer, footer[role="contentinfo"], [role="contentinfo"], .paginate-container, nav[aria-label*="agination"], [role="tree"]:not([role="tree"] *), nav[aria-label*="file tree" i], [data-testid*="file-tree" i]:not([data-testid*="file-tree" i] *), [data-repv-panel]'; // file-tree pane of the code view is dense UI (live finding: tree rows over a bright sky at 2.0:1)
  /* Open reading (default "Text only" readability backing): prose containers lose their broad surface and every text block
     gets its own compact backing instead, so empty space around/below text shows the scene. Dense UI (file tables,
     issue/PR lists, code viewers, comment boxes, menus) keeps its panel. */
  const SIDE = '.Layout-sidebar, aside[class*="sidebar"], [class*="sidebarSection"], .BorderGrid-row, .BorderGrid, footer.footer, .footer, footer[role="contentinfo"], [role="contentinfo"]';
  const LIST = '[class*="listContainer"]:has(> ul > li[class*="listItem"], > [role="list"] > li[class*="listItem"])';
  const OPEN = `.markdown-body:not(.comment-body, .js-comment-body), #readme, [data-repv-frame], ${SIDE}`;
  const PROSE = '.markdown-body:not(.comment-body, .js-comment-body)';
  const PROSE_BLOCKS = 'h1, h2, h3, h4, h5, h6, p, li, dt, dd, blockquote, details > summary, figcaption';
  const SIDE_TEXT = 'h1, h2, h3, h4, p, li, dt, dd, summary, a, .Label, [class*="prc-Label"], .Counter, [class*="CounterLabel"], [class*="Truncate"], relative-time';
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
    // Panel backdrop blur only when the user picks it (Frosted Glass or the slider); Crisp Immersive has none.
    const blur = glass && v.glass > 0 ? `backdrop-filter:blur(${v.glass}px) saturate(1.1); -webkit-backdrop-filter:blur(${v.glass}px) saturate(1.1);` : 'backdrop-filter:none; -webkit-backdrop-filter:none;';
    // Panels read as clean surfaces floating over the scene: hairline edge + soft shadow instead of heavy frost.
    const frosted = glass && v.glass >= 8;
    // Themed border & glow: an edge colour and a soft emitted glow per world (flagships get their own pair, other themes
    // derive both from the accent), strength by the theme's character. Borders read ~1.5 px (1 px border + 0.5 px ring).
    const WORLD_EDGE = { 'enchanted-forest': ['#5fe0b9', '#9dffd8', 0.34], 'cosmic-galaxy': ['#a98bff', '#6f9bff', 0.38], 'neon-city-3d': ['#ff4fd8', '#3ff0ff', 0.5], 'scifi-ai': ['#7fe6ff', '#e8fbff', 0.4],
      'sakura-garden': ['#ff8fb8', '#ffd0e0', 0.34], 'ocean-kingdom': ['#4fd5e8', '#9af0ff', 0.36], 'arctic-frost-3d': ['#4a9fe6', '#bfe4ff', 0.3], 'aurora-borealis': ['#5fe8b0', '#9a8cff', 0.38],
      'synthwave-highway': ['#ff4fd8', '#3ff0ff', 0.5], 'dark-library': ['#d9a441', '#ffd27a', 0.3], 'pixel-paradise-3d': ['#3ad6d0', '#ffe27a', 0.34], 'sunset-coast': ['#ff9a4d', '#ffd08a', 0.34],
      'digital-rain': ['#2cff7a', '#9dffbf', 0.42] };
    const wslug = (/^builtin:([a-z0-9-]+)$/.exec(v.wallpaperRef || '') || [])[1];
    const [edgeC, glowC, glowS] = WORLD_EDGE[wslug] || [v.accent, v.accent, { neon: 0.45, glass: 0.3, soft: 0.24, minimal: 0.14, pixel: 0.2 }[v.vibe] ?? 0.24];
    const edgeLine = rgba(edgeC, light ? 0.68 : 0.8), edgeRing = rgba(edgeC, light ? 0.42 : 0.5); // major surfaces: border 1 px + ring 2 px ≈ 3 px themed edge (box-shadow ring: no layout change)
    const innerRim = rgba('#ffffff', light ? 0.24 : 0.07), topLight = rgba('#ffffff', light ? 0.4 : 0.1); // subtle inner highlight
    const glowNear = rgba(glowC, glowS * (light ? 0.6 : 0.95)), glowFar = rgba(edgeC, glowS * (light ? 0.3 : 0.5));
    const panelGlow = `0 0 0 2px ${edgeRing}, 0 0 14px -1px ${glowNear}, 0 0 34px -6px ${glowFar}, inset 0 0 0 1px ${innerRim}, inset 0 1px 0 ${topLight}, 0 10px 26px ${rgba('#000000', light ? 0.1 : 0.3)}`;
    const edge = frosted
      // Frosted Glass (opt-in): a milky sheen and bright rim make the glass itself visible, not just a darker panel.
      ? `background-image:linear-gradient(160deg, ${rgba('#ffffff', light ? 0.32 : 0.14)}, ${rgba('#ffffff', light ? 0.12 : 0.04)} 60%) !important; box-shadow:inset 0 1px 0 ${rgba('#ffffff', 0.22)}, 0 0 0 1px ${rgba('#ffffff', light ? 0.5 : 0.16)}, 0 10px 30px ${rgba('#000000', light ? 0.14 : 0.3)};`
      : `box-shadow:${panelGlow};`;
    // A tight, light halo on loose text (its real backing is the small guard-computed pill), not a wide dimming glow.
    const halo = `0 0 1px ${rgba(v.bg, 0.9)}, 0 0 3px ${rgba(v.bg, 0.7)}`;
    const compact = v.layout === 'compact';
    const back = rgba(v.bg, looseA); // same guard-computed alpha as other loose text: AA over the brightest scene pixel
    const lift = `0 2px 10px ${rgba('#000000', light ? 0.08 : 0.2)}`;
    const openCss = `
html.repv-open :where(${OPEN}) { background-color:transparent !important; background-image:none !important; box-shadow:none !important; border-color:transparent !important; backdrop-filter:none !important; -webkit-backdrop-filter:none !important; }
/* anchored, not floating: sidebar sections get a very light surface + themed frame + glow (text keeps its own backing),
   the README a themed frame + glow around an open interior */
html.repv-open :is([class*="sidebarSection"], .BorderGrid-row):not(:where([class*="sidebarSection"], .BorderGrid-row) *):not(:empty) { background-color:${rgba(v.surface, light ? a : 0.26)} !important; border:1px solid ${edgeLine} !important; border-radius:var(--repv-radius); box-shadow:0 0 0 2px ${edgeRing}, 0 0 16px -2px ${glowNear}, inset 0 0 0 1px ${innerRim}, inset 0 1px 0 ${rgba('#ffffff', light ? 0.3 : 0.05)} !important; padding-left:12px !important; padding-right:12px !important; margin-bottom:10px !important; }
html.repv-open :is(#readme, [data-repv-frame], .markdown-body:not(.comment-body, .js-comment-body)):not(:where(#readme, [data-repv-frame]) *):not(:where([data-repv-panel]) .markdown-body) { border-color:${edgeLine} !important; outline:1px solid ${edgeLine} !important; outline-offset:-1px; /* a 1 px themed line without changing the box (GitHub's card may or may not draw a border) */ border-radius:var(--repv-radius); box-shadow:0 0 0 2px ${edgeRing}, 0 0 18px -2px ${glowNear}, 0 0 38px -8px ${glowFar}, inset 0 0 0 1px ${innerRim}, inset 0 0 26px -12px ${glowFar} !important; }
html.repv-open :is(${PROSE}) :is(${PROSE_BLOCKS}):not(:is(li, blockquote, td, th, p, dd, summary, table) *):not(:has(img, picture, video, svg:not(.octicon))) {
 background-color:${back} !important; box-shadow:0 0 0 6px ${back}, ${lift}; border-radius:6px; width:fit-content; max-width:100%; box-sizing:border-box; }
html.repv-open :is(${PROSE}) :is([align="center"], [align="center"] > *, [style*="text-align: center"]):is(${PROSE_BLOCKS}) { margin-left:auto; margin-right:auto; }
html.repv-open :is(${PROSE}) li { margin-top:6px; } /* room for each item's own backing */
html.repv-open :is(${PROSE}) table { background-color:${panel} !important; box-shadow:0 0 0 1px ${v.border}, ${lift}; border-radius:6px; }
html.repv-open :is(${PROSE}) :is(table tr, table td, table th) { background-color:transparent !important; }
html.repv-open :is(${PROSE}) :is(.highlight, .snippet-clipboard-content) { background-color:transparent !important; }
html.repv-open :is(${PROSE}) pre { box-shadow:${lift}; }
html.repv-open :is(${SIDE}) :is(${SIDE_TEXT}):not(:is(${SIDE_TEXT}, button, .btn) *):not(:is([class*="ButtonBase"], .btn, button)[data-variant]:not([data-variant="invisible"])) {
 background-color:${back} !important; box-shadow:0 0 0 3px ${back}; border-radius:5px; box-decoration-break:clone; -webkit-box-decoration-break:clone; }
html.repv-open :is(${SIDE}) :is(h1, h2, h3, h4, p, li, dt, dd):not(:is(${SIDE_TEXT}) *) { width:fit-content; max-width:100%; }
html.repv-open :is(${OPEN}) { text-shadow:${halo}; }
html.repv-open [data-repv-text] { background-color:${back} !important; box-shadow:0 0 0 3px ${back}; border-radius:5px; box-decoration-break:clone; -webkit-box-decoration-break:clone; }
/* Issue / pull request lists (React list view): the list is open; each row's title, labels, metadata line and trailing
   counters get their own compact backing; the list toolbar keeps a panel. */
html.repv-open :is(${LIST}) { background-color:transparent !important; box-shadow:none !important; backdrop-filter:none !important; }
html.repv-open :is(${LIST}) > :not(ul, ol, [role="list"]) { background-color:${panel} !important; border-radius:var(--repv-radius) var(--repv-radius) 0 0; }
html.repv-open :is(${LIST}) li[class*="listItem"] :is([data-listview-item-title-container] h3, [class*="trailingBadgesContainer"]:not(:empty), [class*="description"]),
html.repv-open :is(${LIST}) li[class*="listItem"] > div:not([data-listview-item-title-container]):has(relative-time) > div > div:has(relative-time):not(:has([class*="description"])),
html.repv-open :is(${LIST}) li[class*="listItem"] > div:last-child:not([data-listview-item-title-container]):not(:has(relative-time)) > :not(:empty):has(*, :not(:empty)) {
 background-color:${back} !important; box-shadow:0 0 0 4px ${back}, ${lift}; border-radius:6px; width:fit-content; max-width:100%; }
html.repv-open :is(${LIST}) li[class*="listItem"] > div:last-child > * { height:fit-content; align-self:center; }
html.repv-open :is(${LIST}) li[class*="listItem"] { text-shadow:${halo}; }
`;
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
 ${glass ? `--fgColor-disabled:${rgba(v.muted, 0.82)} !important; --button-default-fgColor-disabled:${rgba(v.muted, 0.82)} !important;` : ''}
 --repv-bg:${v.bg}; --repv-panel:${v.surface}; --repv-panel2:${v.surface2};
 --repv-text:${v.text}; --repv-muted:${v.muted}; --repv-accent:${v.accent}; --repv-border:${v.border};
 --repv-radius:${v.radius}px; --repv-blur:${v.glass}px; --repv-panel-opacity:${a};
 background:${rootBackground} !important; color-scheme:${light ? 'light' : 'dark'}; }
html.repv-active body { background:transparent !important; color:var(--repv-text) !important; font-family:${cssFont(v.font)} !important; }
${glass ? `html.repv-active :is(${SHELLS}):not(.markdown-body, .Box, [data-repv-panel]) { background-color:transparent !important; backdrop-filter:none !important; } /* an element that is both a shell and a panel (README article.container-lg) stays a panel */
html.repv-active :where(${PANELS}) { background-color:${panel} !important; ${blur} ${edge} border-radius:var(--repv-radius); text-shadow:none; }
html.repv-active :where(header.GlobalNav, .AppHeader, .Header, .js-header-wrapper header) { box-shadow:none; border-radius:0; }
/* Scene window: a transparent band between GitHub's repository tabs and the repository content shows the scene at full,
   native sharpness. Nothing is covered or moved out of reach: the content simply starts lower. Toggle: popup / Studio. */
html.repv-active.repv-scene-window #repo-content-pjax-container, html.repv-active.repv-scene-window turbo-frame#repo-content-turbo-frame:not(:has(#repo-content-pjax-container)) { padding-top:clamp(140px, 27vh, 320px) !important; }
html.repv-active.repv-scene-window.repv-scene-compact #repo-content-pjax-container, html.repv-active.repv-scene-window.repv-scene-compact turbo-frame#repo-content-turbo-frame:not(:has(#repo-content-pjax-container)) { padding-top:clamp(96px, 16vh, 180px) !important; }
html.repv-active.repv-scene-window.repv-scene-tall #repo-content-pjax-container, html.repv-active.repv-scene-window.repv-scene-tall turbo-frame#repo-content-turbo-frame:not(:has(#repo-content-pjax-container)) { padding-top:clamp(200px, 40vh, 480px) !important; }
@media (max-width:767px) { html.repv-active.repv-scene-window #repo-content-pjax-container, html.repv-active.repv-scene-window turbo-frame#repo-content-turbo-frame:not(:has(#repo-content-pjax-container)) { padding-top:72px !important; } }
html.repv-active :is(.HeaderMktg, header.header-logged-out) { background-color:rgba(1,4,9,${Math.max(0.85, a)}) !important; } /* logged-out header text is always white */
html.repv-active :where(${PANELS}) :where(${PANELS}) { background-color:transparent !important; backdrop-filter:none !important; -webkit-backdrop-filter:none !important; box-shadow:none !important; }
html.repv-active [data-repv-sticky] { background-color:${rgba(v.surface, Math.max(0.94, a))} !important; } /* pinned rows keep a solid backing wherever they float */
html.repv-active :is(main, .application-main, [class*="PageLayout-Pane"]) { text-shadow:${halo}; }
html.repv-active :is(${PANELS}, ${FLOATING}, input, textarea, select, button, .btn, .Button, pre, code) { text-shadow:none; }
html.repv-active :is(input[type="text"], input[type="search"], textarea:not(#read-only-cursor-text-area, [data-testid="read-only-cursor-text-area"]), select, .form-control, .FormControl-input, [class*="TextInputWrapper"]) { background-color:${control} !important; }
html.repv-active :is(main, .application-main) :is(a, h1, h2, h3, p, .Label, [class*="prc-Label"], .Counter, [class*="CounterLabel"], [data-variant="invisible"], .Button--invisible, .btn-octicon):not(:where(${PANELS}) *):not(.btn):not(:has(img)):not(:is([class*="ButtonBase"], .btn, button)[data-variant]:not([data-variant="invisible"])) { background-color:${rgba(v.bg, looseA)} !important; border-radius:6px; box-decoration-break:clone; -webkit-box-decoration-break:clone; }
html.repv-active :is(main, .application-main) a:has(img):not(:where(${PANELS}) *) > :is(span, strong):not(:has(img)) { background-color:${rgba(v.bg, looseA)} !important; border-radius:6px; padding:0 4px; }
html.repv-active :is(main, .application-main) :is(a, h1, h2, h3, p):not(:where(${PANELS}) *):not(.btn):not([class*="Button"]):not(:has(img)) { padding-left:4px; padding-right:4px; margin-left:-4px; margin-right:-4px; }
html.repv-active :where(${PANELS}) :not(pre) > code { background-color:${rgba(v.bg, 0.5)} !important; }
${light ? '' : `html.repv-active :is(.IssueLabel, [class*="IssueLabel"], [class*="TokenBase"], [class*="Token__"]) { box-shadow:inset 0 0 0 100vmax ${rgba(v.bg, 0.45)}; }`}
html.repv-active:is(.repv-motion-cinematic${v.wallpaperBlur > 0 ? ', *' : ''}) body::before { content:""; position:fixed; inset:${v.wallpaperBlur > 0 ? `-${v.wallpaperBlur * 2}px` : '-4%'}; z-index:-1; pointer-events:none;
 background:${[...veils.map(l => l.replace(' fixed', '')), `var(--repv-wallpaper, none) ${POSITION[v.wallpaperPosition]} / ${v.wallpaperSize} no-repeat`, v.bg].join(', ')};
 filter:${v.wallpaperBlur > 0 ? `blur(${v.wallpaperBlur}px)` : 'none'}; }` : `html.repv-active :is(.AppHeader, .Header, #repository-container-header, .Box, .markdown-body) { background-color:${v.surface} !important; }`}
html.repv-active :is(.AppHeader, .Header, #repository-container-header, .UnderlineNav, .js-header-wrapper, header.GlobalNav) { color:${v.text} !important; border-color:${v.border} !important; }
html.repv-active :is(.Box, .markdown-body, .blob-wrapper, .file, [data-repv-panel]) { border-color:${glass ? edgeLine : v.border} !important; }
${glass ? `/* themed border & glow on controls, inputs and floating UI */
html.repv-active :is(.btn, .Button, [class*="ButtonBase"]):not(:where(${FLOATING}) *) { border-color:${rgba(edgeC, light ? 0.45 : 0.5)} !important; box-shadow:0 0 0 1.5px ${edgeRing}, 0 0 10px -3px ${glowNear}, inset 0 1px 0 ${rgba('#ffffff', light ? 0.3 : 0.06)}; }
html.repv-active :is(.btn, .Button, [class*="ButtonBase"]):not(:where(${FLOATING}) *):hover { border-color:${edgeLine} !important; box-shadow:0 0 0 1.5px ${edgeLine}, 0 0 14px -2px ${glowNear}, inset 0 1px 0 ${rgba('#ffffff', light ? 0.35 : 0.08)}; }
html.repv-active :is(input[type="text"], input[type="search"], textarea:not(#read-only-cursor-text-area, [data-testid="read-only-cursor-text-area"]), .form-control, .FormControl-input, [class*="TextInputWrapper"], .search-input) { border-color:${rgba(edgeC, light ? 0.45 : 0.5)} !important; box-shadow:0 0 0 1px ${edgeRing}, 0 0 10px -4px ${glowNear} !important; }
html.repv-active :is(input[type="text"], input[type="search"], textarea:not(#read-only-cursor-text-area, [data-testid="read-only-cursor-text-area"]), .form-control, .FormControl-input):focus, html.repv-active [class*="TextInputWrapper"]:focus-within { box-shadow:0 0 0 1px ${edgeLine}, 0 0 14px -2px ${glowNear} !important; }
html.repv-active :is(${FLOATING}) { border-color:${edgeLine} !important; box-shadow:0 0 0 2px ${edgeRing}, 0 0 18px -4px ${glowNear}, 0 16px 40px ${rgba('#000000', light ? 0.18 : 0.45)} !important; }` : ''}
html.repv-active :is(${FLOATING}) { background-color:${v.surface} !important; backdrop-filter:none !important; text-shadow:none; }
html.repv-active :is(.btn, .Button, button:not([class]), input[type="text"], input[type="search"], textarea:not(#read-only-cursor-text-area, [data-testid="read-only-cursor-text-area"])) {
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
${glass ? openCss + MOTION_CSS + DEPTH_CSS : ''}
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
  const STICKY_ATTR = 'data-repv-sticky';
  const FRAME_ATTR = 'data-repv-frame'; // a bordered card whose content is mostly README prose: framed, but open (no broad surface)
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
      // Sticky rows (e.g. the file table's latest-commit header) stay pinned at the top of the viewport while the rest
      // of their panel scrolls away, so they float over the scene: they get their own solid backing (checked even inside
      // panels, where nested surfaces are otherwise transparent). Not inside floating UI (menus keep their own).
      if (getComputedStyle(el).position === 'sticky' && !el.closest(FLOATING) && el.textContent.trim() && el.getBoundingClientRect().height < 200) { el.setAttribute(STICKY_ATTR, ''); continue; }
      if (el.closest(`[${PANEL_ATTR}], ${FLOATING}`) || el.closest(PANELS.replace(', [data-repv-panel]', ''))) continue;
      if (isBoxed(el)) {
        // GitHub now wraps the README (tab bar + article) in one rounded, bordered card that has no #readme id. Treated as a dense-UI panel it
        // painted a full-size tinted surface over the whole README; a card that mostly holds prose is an open frame instead.
        const prose = document.documentElement.classList.contains('repv-open') && el.querySelector(PROSE);
        if (prose && prose.getBoundingClientRect().height >= 0.5 * el.getBoundingClientRect().height) { el.setAttribute(FRAME_ATTR, ''); continue; }
        el.setAttribute(PANEL_ATTR, '');
      }
    }
    scanOpenText();
    if (document.getElementById(POP_ID)) queuePlacePop();
  }
  /* Open reading safety net: inside open containers, any visible text that is not on a backing yet (text in plain
     spans/divs that the CSS block rules do not name, e.g. sidebar "9.0k stars") gets its nearest element tagged
     data-repv-text, which carries the same compact backing. Bounded; re-run with the panel scan. */
  const TEXT_ATTR = 'data-repv-text';
  const alphaOf = c => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return 0; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return p.length > 3 ? p[3] : 1; };
  function scanOpenText() {
    if (!document.documentElement.classList.contains('repv-open')) return;
    const backed = new Map();
    const isBacked = (el, stop) => {
      for (let e = el; e && e !== stop.parentElement; e = e.parentElement) {
        if (backed.has(e)) return backed.get(e);
        if (e.hasAttribute(TEXT_ATTR) || alphaOf(getComputedStyle(e).backgroundColor) >= 0.3) { backed.set(e, true); return true; }
      }
      return false;
    };
    let budget = 5000;
    for (const box of document.querySelectorAll(`${OPEN}, ${LIST}`)) {
      if (box.closest(FLOATING)) continue;
      const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n && budget > 0; n = walker.nextNode(), budget--) {
        if (!n.nodeValue.trim()) continue;
        const el = n.parentElement;
        if (!el || el.closest(`pre, code, svg, template, script, style, [hidden], ${FLOATING}`)) continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 2 || r.height <= 2) continue; // hidden / visually-hidden text
        if (!isBacked(el, box)) { el.setAttribute(TEXT_ATTR, ''); backed.set(el, true); }
      }
    }
  }
  function queuePanelScan() {
    if (panelScanQueued) return;
    panelScanQueued = true;
    setTimeout(() => requestAnimationFrame(scanPanels), 120);
  }
  function clearPanels() { panelChecked = new WeakSet(); for (const el of document.querySelectorAll(`[${PANEL_ATTR}], [${TEXT_ATTR}], [${STICKY_ATTR}], [${FRAME_ATTR}]`)) { el.removeAttribute(FRAME_ATTR); el.removeAttribute(PANEL_ATTR); el.removeAttribute(TEXT_ATTR); el.removeAttribute(STICKY_ATTR); } }

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
  function rainTile(seed, n, alpha, lenK = 1, wK = 1) {
    const r = rng(seed); let body = '';
    for (let i = 0; i < n; i++) { const x = r() * 400, y = r() * 400, len = (16 + r() * 34) * lenK; body += `<line x1='${x.toFixed(1)}' y1='${y.toFixed(1)}' x2='${(x - len * 0.16).toFixed(1)}' y2='${(y + len).toFixed(1)}' stroke='url(#d)' stroke-width='${((0.8 + r() * 0.7) * wK).toFixed(2)}' stroke-linecap='round' opacity='${(alpha * (0.45 + r() * 0.55)).toFixed(2)}'/>`; }
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
@keyframes repv-rain { from { transform:translate3d(0,0,0); } to { transform:translate3d(0,400px,0); } } /* exactly one tile period (200/400 px tiles): seamless loop, the slant is in the streaks */
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

  /* ---- Depth engine (2.5D). Scenes rendered as separate depth slabs from the same 3D camera (far, mid, near,
     decorative front, light rays — real occlusion + alpha, see scripts/wallpapers/shaders) are stacked in ONE injected
     element, #repovibe-depth, a sibling of <body> (GitHub's DOM tree is not touched), fixed, pointer-events:none, behind
     all content. Each layer moves in proportion to its depth (parallax factor k): the pointer drives a smoothed offset
     (rAF only while it changes), Cinematic adds a slow camera drift that is itself parallaxed per layer, swaying
     foreground leaves and breathing light rays. Particle planes sit between the slabs at their own depths. Only
     transform/opacity animate (compositor). Static mode, reduced motion, uploads, custom position/size or wallpaper blur
     use the flat root scene instead (no engine). This is layered 2.5D, not real-time 3D geometry. */
  const DEPTH_ID = 'repovibe-depth';
  const LAYER_K = { far: 0.12, pfar: 0.26, mist: 0.32, mid: 0.48, pmid: 0.7, near: 1.0, rays: 0.55, front: 1.65, pnear: 2.1 };
  function bokehTile(seed, w, h, n, colors) {
    const r = rng(seed); let body = '';
    for (let i = 0; i < n; i++) body += `<circle cx='${(r() * w).toFixed(1)}' cy='${(r() * h).toFixed(1)}' r='${(9 + r() * 14).toFixed(1)}' fill='url(#g${i % colors.length})' opacity='${(0.35 + r() * 0.35).toFixed(2)}'/>`;
    return svgUrl(w, h, body, colors.map((col, i) => `<radialGradient id='g${i}'><stop offset='0' stop-color='${col}' stop-opacity='.95'/><stop offset='.45' stop-color='${col}' stop-opacity='.45'/><stop offset='1' stop-color='${col}' stop-opacity='0'/></radialGradient>`).join(''));
  }
  /* Declarative particle tiles for the data-only worlds (shared/worlds.js): shape = petal | flake | dot | bubble | cube | ember | page.
     A tile plane drifts by exactly one tile period per loop (seamless), pushed sideways by the shared gust. */
  function shapeTile(shape, seed, w, h, n, colors, rMin, rMax) {
    const r = rng(seed); let body = '', defs = '';
    colors.forEach((c, i) => { defs += `<radialGradient id='s${i}'><stop offset='0' stop-color='${c}' stop-opacity='1'/><stop offset='.55' stop-color='${c}' stop-opacity='.55'/><stop offset='1' stop-color='${c}' stop-opacity='0'/></radialGradient>`; });
    for (let i = 0; i < n; i++) {
      const x0 = r() * w, y0 = r() * h, s = rMin + r() * (rMax - rMin), ci = i % colors.length, c = colors[ci], rot = (r() * 360).toFixed(0), o = (0.55 + r() * 0.45).toFixed(2), m = s * 2.6;
      const offs = [[0, 0]]; if (x0 < m) offs.push([w, 0]); if (x0 > w - m) offs.push([-w, 0]); if (y0 < m) offs.push([0, h]); if (y0 > h - m) offs.push([0, -h]); // wrap: a particle cut by one edge reappears on the other
      for (const [ox, oy] of offs) {
        const x = x0 + ox, y = y0 + oy, T = `transform='translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot})' opacity='${o}'`;
        if (shape === 'petal') body += `<path ${T} d='M0,${-s} C${s * 0.9},${-s * 0.7} ${s * 0.8},${s * 0.5} 0,${s} C${-s * 0.8},${s * 0.5} ${-s * 0.9},${-s * 0.7} 0,${-s} Z' fill='${c}'/>`;
        else if (shape === 'flake') { let a = ''; for (let k = 0; k < 3; k++) a += `<line x1='${-s}' y1='0' x2='${s}' y2='0' transform='rotate(${k * 60})' stroke='${c}' stroke-width='${Math.max(0.7, s * 0.14).toFixed(2)}' stroke-linecap='round'/>`; body += `<g ${T}>${a}<circle r='${(s * 0.22).toFixed(2)}' fill='${c}'/></g>`; }
        else if (shape === 'bubble') body += `<g ${T}><circle r='${s}' fill='none' stroke='${c}' stroke-width='${Math.max(0.8, s * 0.1).toFixed(2)}' stroke-opacity='.8'/><circle r='${(s * 0.9).toFixed(2)}' fill='${c}' fill-opacity='.08'/><circle cx='${(-s * 0.35).toFixed(2)}' cy='${(-s * 0.35).toFixed(2)}' r='${(s * 0.2).toFixed(2)}' fill='#fff' fill-opacity='.85'/></g>`;
        else if (shape === 'cube') body += `<rect ${T} x='${-s}' y='${-s}' width='${2 * s}' height='${2 * s}' fill='${c}' stroke='#fff' stroke-opacity='.35' stroke-width='${Math.max(0.6, s * 0.12).toFixed(2)}'/>`;
        else if (shape === 'ember') body += `<g ${T}><circle r='${(s * 2.4).toFixed(2)}' fill='url(#s${ci})'/><circle r='${(s * 0.55).toFixed(2)}' fill='${c}'/></g>`;
        else if (shape === 'page') body += `<g ${T}><rect x='${(-s * 0.7).toFixed(2)}' y='${-s}' width='${(s * 1.4).toFixed(2)}' height='${2 * s}' rx='${(s * 0.08).toFixed(2)}' fill='${c}'/><path d='M${(-s * 0.45).toFixed(2)},${(-s * 0.5).toFixed(2)} H${(s * 0.45).toFixed(2)} M${(-s * 0.45).toFixed(2)},${(-s * 0.1).toFixed(2)} H${(s * 0.45).toFixed(2)} M${(-s * 0.45).toFixed(2)},${(s * 0.3).toFixed(2)} H${(s * 0.2).toFixed(2)}' stroke='#5a4630' stroke-opacity='.45' stroke-width='${Math.max(0.5, s * 0.07).toFixed(2)}'/></g>`;
        else body += `<circle cx='${x.toFixed(1)}' cy='${y.toFixed(1)}' r='${(s * 2).toFixed(1)}' fill='url(#s${ci})' opacity='${o}'/>`; // dot: soft glow mote
      }
    }
    return svgUrl(w, h, body, defs);
  }
  const WORLDS = globalThis.RepoVibeWorlds || {};
  const worldTiles = new Map();
  function worldParticles(slug) {   // declarative tiles → { plane: [url, size, motion] }, built once per world
    if (!worldTiles.has(slug)) {
      const out = {};
      for (const t of WORLDS[slug]?.tiles || []) {
        if (t.image) {   // a pre-rendered seamless image tile (caustics, clouds), sized relative to the stage so it scales with the scene; optional mask keeps it on part of the scene
          const u = n => `url("${chrome.runtime.getURL(`wallpapers/depth/${slug}/${n}.webp`)}")`;
          const wc = `calc(max(100vw, 177.78vh) * ${t.rel})`, hc = `calc(max(100vw, 177.78vh) * ${(t.rel * t.h / t.w).toFixed(4)})`;
          out[t.plane] = [u(t.image), `${wc} ${hc}`, { w: wc, h: hc, sx: t.sx, sy: t.sy, t: t.t, gust: t.gust, mask: t.mask ? u(t.mask) : null, region: t.region }];
          continue;
        }
        out[t.plane] = [shapeTile(t.shape, t.seed, t.w, t.h, t.n, t.colors, t.r[0], t.r[1]), `${t.w}px ${t.h}px`, t.still ? undefined : { w: t.w, h: t.h, sx: t.sx, sy: t.sy, t: t.t, gust: t.gust }];
      }   // still: the default twinkle/flicker plane (stars, motes)
      worldTiles.set(slug, out);
    }
    return worldTiles.get(slug);
  }
  // Per-scene particle planes and atmosphere (only scenes with rendered depth layers use the engine).
  const DEPTH_PARTICLES = {
    'enchanted-forest': { pfar: [glowTile(31, 700, 520, 22, ['#ffe27a', '#b6ff9a'], 2, 4), '700px 520px'], pmid: [glowTile(37, 900, 700, 10, ['#ffe27a', '#9dffd0', '#fff1a8'], 5, 9), '900px 700px'],
      pnear: [bokehTile(41, 1400, 900, 6, ['#fff0a0', '#a8ffd8']), '1400px 900px'], mist: 'radial-gradient(60% 22% at 30% 78%, rgba(130,235,215,.16), transparent 70%), radial-gradient(50% 18% at 78% 66%, rgba(120,205,255,.12), transparent 70%), radial-gradient(70% 16% at 50% 92%, rgba(150,230,220,.12), transparent 70%)' },
    'cosmic-galaxy': { pfar: [glowTile(53, 600, 600, 70, ['#eef2ff', '#cfd8ff', '#fff4e0'], 0.9, 2.2), '600px 600px'], pmid: [glowTile(57, 820, 820, 36, ['#d8ccff', '#bfe0ff'], 1.4, 3), '820px 820px'],
      pnear: [bokehTile(59, 1500, 1000, 4, ['#c9b8ff', '#9fd0ff']), '1500px 1000px'], mist: 'radial-gradient(45% 32% at 20% 30%, rgba(150,80,255,.14), transparent 70%), radial-gradient(40% 30% at 82% 72%, rgba(60,140,255,.12), transparent 70%)' },
    // no free-falling rain planes: every drop in this scene is a 'drop' sprite paired with the ring it makes on the canal (see SPRITES)
    'neon-city-3d': {
      pnear: [bokehTile(71, 1400, 900, 7, ['#ff4fd8', '#4fe3ff', '#b48cff']), '1400px 900px'], mist: 'radial-gradient(60% 20% at 50% 88%, rgba(150,170,255,.16), transparent 70%), radial-gradient(40% 24% at 15% 40%, rgba(255,60,200,.14), transparent 70%), radial-gradient(35% 22% at 85% 40%, rgba(60,200,255,.12), transparent 70%)' },
    'scifi-ai': { pfar: [glowTile(73, 640, 480, 26, ['#7fdcff', '#c8f2ff'], 1, 2.4), '640px 480px'], pmid: [glowTile(79, 900, 640, 12, ['#5fd0ff', '#ffffff'], 2, 4), '900px 640px'],
      pnear: [bokehTile(83, 1400, 900, 5, ['#9fe6ff', '#ffffff']), '1400px 900px'], mist: 'radial-gradient(60% 24% at 50% 80%, rgba(160,225,255,.20), transparent 70%)' }
  };
  /* Sprites: individually rendered objects (transparent WebP) that move on their own (CSS drift/rotation loop) and
     with the pointer at their own depth factor k. plane 'scene' = inside the fixed scene behind GitHub (x/y/w in % of
     the viewport); plane 'pop' = the pop-out layer ABOVE the page, but only in safe regions: the scene window ('band',
     x/y as fractions of the band, h = height as a multiple of the band height) or a wide side margin ('margin').
     A pop sprite is shown only where no text, control, image or panel lies under it (checked at runtime). */
  const POP_ID = 'repovibe-popout';
  const SPRITES = {
    'cosmic-galaxy': [
      // asteroid belt: the three mid rocks reused at different sizes, depths, flips and drift paths
      { n: 'midC', plane: 'scene', k: 0.55, x: 40, y: 12, w: 3.2, cross: 150, rot: 220 },          // crosses the whole sky on its own
      { n: 'b1', src: 'midA', plane: 'scene', k: 0.42, x: 33, y: 40, w: 2.1, dx: 30, dy: 10, rot: 60, dur: 46, flip: 1 },
      { n: 'b2', src: 'midB', plane: 'scene', k: 0.48, x: 57, y: 22, w: 2.6, dx: -26, dy: 12, rot: -48, dur: 52 },
      { n: 'b3', src: 'midC', plane: 'scene', k: 0.5, x: 13, y: 16, w: 1.8, dx: 20, dy: -8, rot: 90, dur: 38, flip: 1 },
      { n: 'b4', src: 'midA', plane: 'scene', k: 0.58, x: 84, y: 48, w: 3, dx: -34, dy: -14, rot: 40, dur: 44 },
      { n: 'b5', src: 'midB', plane: 'scene', k: 0.45, x: 45, y: 66, w: 2.2, dx: 24, dy: -16, rot: -70, dur: 50, flip: 1 },
      { n: 'b6', src: 'midC', plane: 'scene', k: 0.64, x: 66, y: 78, w: 3.6, dx: -28, dy: 18, rot: 34, dur: 36 },
      { n: 'b7', src: 'midA', plane: 'scene', k: 0.4, x: 27, y: 85, w: 1.6, dx: 16, dy: 10, rot: -110, dur: 58 },
      { n: 'midA', plane: 'scene', k: 0.62, x: 72, y: 30, w: 4.6, dx: 46, dy: -20, rot: 28, dur: 34 },
      { n: 'midB', plane: 'scene', k: 0.7, x: 20, y: 62, w: 5.6, dx: -40, dy: 16, rot: -34, dur: 40 },
      { n: 'foreB', plane: 'scene', k: 1.2, x: 4, y: 34, w: 12, dx: 26, dy: 18, rot: -16, dur: 31 },  // cropped by the left edge
      { n: 'foreA', plane: 'scene', k: 1.35, x: 95, y: 72, w: 17, dx: -34, dy: -22, rot: 14, dur: 28 }, // cropped by the right edge
      { n: 'popA', plane: 'pop', at: 'band', x: 0.985, y: 0.52, h: 1.25, k: 2.7, dx: -24, dy: 6, rot: 9, dur: 24 },
      { n: 'shard', plane: 'pop', at: 'band', x: 0.02, y: 0.4, h: 0.7, k: 3.0, dx: 22, dy: -5, rot: -11, dur: 21 },
      { n: 'hero', src: 'foreB', plane: 'pop', at: 'band', x: 0.79, y: 0.5, h: 0.95, k: 2.2, dx: -30, dy: 5, rot: 12, dur: 26 }, // in front of the planet, inside the scene window
      { n: 'popB', plane: 'pop', at: 'margin', side: 'left', y: 0.66, h: 0.2, k: 2.4, dx: 14, dy: -18, rot: 16, dur: 27 }
    ],
    'enchanted-forest': [
      { n: 'flowerB', plane: 'scene', k: 0.6, x: 30, y: 90, w: 4.2, dx: 3, dy: 0, rot: 2, dur: 8, fx: 'pulse' },
      { n: 'mush', plane: 'scene', k: 0.72, x: 11, y: 86, w: 9, dx: 0, dy: 0, rot: 0, dur: 30, fx: 'pulse' },
      { n: 'flowerA', plane: 'scene', k: 0.86, x: 87, y: 84, w: 6.4, dx: 4, dy: 0, rot: 2.5, dur: 7, fx: 'pulse' },
      // Falling leaves, wind-driven: a shared breeze (net drift to the right, strength dx) plus, per leaf, its own sideways
      // sway (sw px, every `sway` s), pendulum flutter (±fa deg, every `flut` s) and edge-on turn (every `turn` s), so no two
      // leaves move alike. `sy` is where a leaf rests in Static / reduced motion.
      { n: 'lf1', src: 'leafY', plane: 'scene', k: 0.9, x: 63, y: 0, w: 2.5, fall: 36, dx: 260, rot: 190, sw: 38, sway: 5.2, flut: 2.9, fa: 34, turn: 3.7, sy: 58 },
      { n: 'lf2', src: 'leafG', plane: 'scene', k: 1.5, x: 21, y: 0, w: 3.5, fall: 27, dx: 340, rot: -150, sw: 62, sway: 4.4, flut: 2.3, fa: 42, turn: 2.9, sy: 36, flip: 1 },
      { n: 'lf3', src: 'leafO', plane: 'scene', k: 2.1, x: 80, y: 0, w: 5.0, fall: 21, dx: 300, rot: 230, sw: 80, sway: 3.8, flut: 2.0, fa: 48, turn: 2.5, sy: 70 },
      { n: 'lf4', src: 'leafM', plane: 'scene', k: 1.1, x: 44, y: 0, w: 2.9, fall: 32, dx: 220, rot: 120, sw: 46, sway: 4.9, flut: 2.6, fa: 38, turn: 3.3, sy: 28, flip: 1 },
      { n: 'lf5', src: 'leafY', plane: 'scene', k: 0.7, x: 8, y: 0, w: 2.1, fall: 40, dx: 200, rot: -210, sw: 30, sway: 5.8, flut: 3.1, fa: 30, turn: 4.0, sy: 80 },
      { n: 'lf6', src: 'leafG', plane: 'scene', k: 1.8, x: 91, y: 0, w: 4.0, fall: 24, dx: 280, rot: 170, sw: 70, sway: 4.1, flut: 2.2, fa: 44, turn: 2.7, sy: 48, flip: 1 },
      { n: 'sprayA', plane: 'pop', at: 'band', x: 0.97, y: 0.5, h: 1.1, k: 2.6, dx: -12, dy: 3, rot: 2.5, dur: 9 },     // wind sway
      { n: 'sprayB', plane: 'pop', at: 'band', x: 0.03, y: 0.45, h: 0.9, k: 2.8, dx: 12, dy: -3, rot: -3, dur: 11 },
      { n: 'mSpray', src: 'sprayA', plane: 'pop', at: 'margin', side: 'right', y: 0.55, h: 0.3, k: 2.3, dx: -10, dy: 4, rot: 3, dur: 10, flip: 1 }
    ],
    'neon-city-3d': [
      { n: 'drone', plane: 'scene', k: 0.5, x: 50, y: 16, w: 8, cross: 38, rot: 0 },
      { n: 'dr2', src: 'drone', plane: 'scene', k: 0.8, x: 50, y: 30, w: 5, crossRev: 27, rot: 0, flip: 1 },
      // drizzle drop rings on the canal: each drop lands once every 7–10 s (ring spreads and fades in the first ~third of its cycle, then the water is calm
      // there until the next drop), periods differ so drops never land in step — about two small rings at a time across the scene, matching the light drizzle
      { n: 'rp1', src: 'ripple', plane: 'scene', k: 0.3, x: 50, y: 45.5, w: 1.3, dur: 7.8, delay: 0.0, fx: 'ripple' },
      { n: 'rp2', src: 'ripple', plane: 'scene', k: 0.3, x: 46, y: 47, w: 1.9, dur: 8.9, delay: -3.2, fx: 'ripple' },
      { n: 'rp3', src: 'ripple', plane: 'scene', k: 0.3, x: 55, y: 48, w: 2.2, dur: 7.0, delay: -1.2, fx: 'ripple' },
      { n: 'rp4', src: 'ripple', plane: 'scene', k: 0.3, x: 41, y: 50, w: 2.8, dur: 8.4, delay: -5.8, fx: 'ripple' },
      { n: 'rp5', src: 'ripple', plane: 'scene', k: 0.3, x: 52, y: 51, w: 3.2, dur: 9.7, delay: -4.6, fx: 'ripple' },
      { n: 'rp6', src: 'ripple', plane: 'scene', k: 0.3, x: 60, y: 50.5, w: 3.1, dur: 7.3, delay: -2.3, fx: 'ripple' },
      { n: 'rp7', src: 'ripple', plane: 'scene', k: 0.3, x: 36, y: 53, w: 3.8, dur: 9.2, delay: -7.0, fx: 'ripple' },
      { n: 'rp8', src: 'ripple', plane: 'scene', k: 0.3, x: 47, y: 54, w: 4.1, dur: 7.6, delay: -0.6, fx: 'ripple' },
      { n: 'rp9', src: 'ripple', plane: 'scene', k: 0.3, x: 65, y: 54, w: 4.1, dur: 8.6, delay: -5.5, fx: 'ripple' },
      { n: 'rp10', src: 'ripple', plane: 'scene', k: 0.3, x: 56, y: 56, w: 4.7, dur: 10.0, delay: -3.8, fx: 'ripple' },
      { n: 'rp11', src: 'ripple', plane: 'scene', k: 0.3, x: 30, y: 57, w: 5.1, dur: 7.8, delay: -8.4, fx: 'ripple' },
      { n: 'rp12', src: 'ripple', plane: 'scene', k: 0.3, x: 71, y: 58, w: 5.4, dur: 9.5, delay: -1.7, fx: 'ripple' },
      { n: 'rp13', src: 'ripple', plane: 'scene', k: 0.3, x: 5, y: 82, w: 9.5, dur: 8.9, delay: -4.3, fx: 'ripple' },
      { n: 'rp14', src: 'ripple', plane: 'scene', k: 0.3, x: 9, y: 92, w: 9.5, dur: 7.6, delay: -6.4, fx: 'ripple' },
      { n: 'rp15', src: 'ripple', plane: 'scene', k: 0.3, x: 3, y: 97, w: 9.5, dur: 9.7, delay: -2.6, fx: 'ripple' },
      { n: 'rp16', src: 'ripple', plane: 'scene', k: 0.3, x: 93, y: 86, w: 9.5, dur: 8.4, delay: -7.5, fx: 'ripple' },
      { n: 'rp17', src: 'ripple', plane: 'scene', k: 0.3, x: 97, y: 95, w: 9.5, dur: 7.8, delay: -0.9, fx: 'ripple' },
      { n: 'rp18', src: 'ripple', plane: 'scene', k: 0.3, x: 90, y: 98, w: 9.5, dur: 9.2, delay: -5.2, fx: 'ripple' },
      { n: 'rp19', src: 'ripple', plane: 'scene', k: 0.3, x: 42, y: 70, w: 9.2, dur: 8.1, delay: -2.9, fx: 'ripple' },
      { n: 'rp20', src: 'ripple', plane: 'scene', k: 0.3, x: 58, y: 76, w: 9.5, dur: 8.9, delay: -6.1, fx: 'ripple' },
      { n: 'holo', plane: 'scene', k: 0.72, x: 72, y: 32, w: 13, dx: 8, dy: -5, rot: 0, dur: 12, fx: 'flicker' },
      { n: 'signA', plane: 'pop', at: 'band', x: 0.035, y: 0.5, h: 1.05, k: 2.6, dx: 5, dy: 2, rot: 0.8, dur: 6, fx: 'flicker' },
      { n: 'signB', plane: 'pop', at: 'band', x: 0.9, y: 0.45, h: 0.62, k: 2.3, dx: -6, dy: 2, rot: -0.6, dur: 7, fx: 'flicker' },
      { n: 'mSign', src: 'signA', plane: 'pop', at: 'margin', side: 'left', y: 0.55, h: 0.42, k: 2.4, dx: 4, dy: 3, rot: 0.6, dur: 6, fx: 'flicker' }
    ],
    'scifi-ai': [
      { n: 'ring', plane: 'scene', k: 0.6, x: 63, y: 30, w: 15, dx: 6, dy: -4, rot: 0, dur: 14, fx: 'spin' },
      { n: 'probe', plane: 'scene', k: 0.78, x: 50, y: 20, w: 5.5, cross: 36, rot: 0 },
      { n: 'pr2', src: 'probe', plane: 'scene', k: 1.25, x: 88, y: 62, w: 7, dx: -40, dy: 16, rot: 6, dur: 14 },
      { n: 'panel', plane: 'pop', at: 'band', x: 0.05, y: 0.5, h: 1.05, k: 2.5, dx: 8, dy: -3, rot: 1, dur: 9, fx: 'pulse' },
      { n: 'crystal', plane: 'pop', at: 'band', x: 0.9, y: 0.5, h: 0.85, k: 2.2, dx: -6, dy: 8, rot: 6, dur: 8, fx: 'spinY' },
      { n: 'mPanel', src: 'panel', plane: 'pop', at: 'margin', side: 'right', y: 0.55, h: 0.4, k: 2.3, dx: -6, dy: 4, rot: -1, dur: 10, fx: 'pulse' }
    ]
  };
  // Cyberpunk: every ring on the canal is made by a visible drop. Each 'drop' sprite is generated from its ripple (same x, duration and delay),
  // stands on the ring's centre and falls during the last 12 % of the shared cycle, so it lands exactly where and when the ring starts.
  SPRITES['neon-city-3d'].push(...SPRITES['neon-city-3d'].filter(s => s.fx === 'ripple').map(s => {
    // anchored by its bottom edge on the ring's centre, so the pairing holds at every viewport aspect ratio
    return { n: s.n.replace('rp', 'dp'), src: 'drop', plane: 'scene', k: s.k, x: s.x, y: s.y, w: s.w * 0.11, anchor: 'bottom', dur: s.dur, delay: s.delay, fx: 'drop' };
  }));
  const spritesOf = slug => SPRITES[slug] || WORLDS[slug]?.sprites || [];
  function spriteUrl(slug, n) { return chrome.runtime.getURL(`wallpapers/depth/${slug}/s-${n}.webp`); }
  function tuning() { const t = config.depthTuning || {}; return { parallax: (t.parallax ?? 100) / 100, motion: (t.motion ?? 100) / 100, particles: (t.particles ?? 100) / 100, foreground: (t.foreground ?? 100) / 100 }; }
  function buildSprite(slug, s, cinematic) {
    const wrap = document.createElement('div');
    wrap.className = 'repv-s'; if (s.plane === 'pop') wrap.dataset.k = String(s.k); wrap.dataset.sprite = s.n; wrap.dataset.depth = String(s.k);
    const img = document.createElement('img');
    img.src = spriteUrl(slug, s.src || s.n); img.alt = '';
    if (s.noShadow) wrap.dataset.ns = '';   // soft pink boughs and similar: no dark contact shadow
    if (s.flip) wrap.style.scale = '-1 1'; // mirror on the wrapper: the image's own `scale` may be animated (leaf turn)
    img.decoding = 'async'; img.draggable = false;
    const m = cinematic ? 1.8 : 1;
    if (s.cross || s.crossRev) { img.dataset.cross = s.crossRev ? 'rev' : ''; img.style.setProperty('--dur', `${(s.cross || s.crossRev) / (cinematic ? 1.5 : 1)}s`); }
    else if (s.fall) {
      img.dataset.fall = ''; const sp = cinematic ? 1.35 : 1;
      img.style.setProperty('--dur', `${s.fall / sp}s`); img.style.setProperty('--sw', `${s.sw || 40}px`); img.style.setProperty('--sway', `${(s.sway || 4.5) / sp}s`);
      img.style.setProperty('--flut', `${(s.flut || 2.5) / sp}s`); img.style.setProperty('--fa', `${s.fa || 38}deg`); img.style.setProperty('--turn', `${(s.turn || 3.2) / sp}s`);
      wrap.style.setProperty('--sy', `${s.sy ?? 40}%`);
    }
    else if (s.rise) {   // bubbles, motes, spores: rise with sway; start below the stage, fade out above it
      img.dataset.rise = ''; const sp = cinematic ? 1.3 : 1;
      img.style.setProperty('--dur', `${s.rise / sp}s`); img.style.setProperty('--sw', `${s.sw || 30}px`); img.style.setProperty('--sway', `${(s.sway || 4.2) / sp}s`);
      img.style.setProperty('--flut', `${(s.flut || 3) / sp}s`); img.style.setProperty('--fa', `${s.fa || 12}deg`);
      wrap.style.setProperty('--sy', `${s.sy ?? 60}%`);
    }
    else if (s.approach) {   // perspective approach: starts tiny at its vanishing point, grows and slides to its end point
      img.dataset.approach = ''; img.style.setProperty('--dur', `${s.approach / (cinematic ? 1.35 : 1)}s`); img.style.setProperty('--ax', s.ax || '30vw'); img.style.setProperty('--ay', s.ay || '30vh'); img.style.setProperty('--a0', String(s.a0 ?? 0.05));
      wrap.style.setProperty('--sy', `${s.sy ?? 50}%`);
    }
    else img.style.setProperty('--dur', `${(s.dur || 30) / (cinematic ? 1.35 : 1)}s`);
    if (s.swim) { img.dataset.swim = ''; img.style.setProperty('--wob', `${s.swim.wob || 24}px`); img.style.setProperty('--wp', `${(s.swim.wp || 5) / (cinematic ? 1.3 : 1)}s`); img.style.setProperty('--tilt', `${s.swim.tilt || 6}deg`); }
    if (s.wind) {   // tied to the shared gust clock: the gust reaches objects further right a moment later, so it visibly travels
      img.dataset.wind = ''; img.style.setProperty('--wa', `${s.wind * (cinematic ? 1.6 : 1)}deg`); img.style.setProperty('--ox', s.ox || '50%'); img.style.setProperty('--oy', s.oy || '100%');
      img.style.setProperty('--gd', `${(-(GUST_S) + (s.x ?? 50) * 0.035).toFixed(2)}s`); img.style.setProperty('--fl', `${(s.fl || 4.2) / (cinematic ? 1.3 : 1)}s`);
    }
    if (s.gust) { wrap.dataset.gust = ''; wrap.style.setProperty('--gx', `${s.gust * (cinematic ? 1.5 : 1)}px`); wrap.style.setProperty('--gd', `${(-(GUST_S) + (s.x ?? 50) * 0.035).toFixed(2)}s`); }
    if (s.gl) img.style.setProperty('--gl', `${s.gl}s`);
    if (s.jp) img.style.setProperty('--jp', `${s.jp / (cinematic ? 1.25 : 1)}s`);
    img.style.setProperty('--dx', `${(s.dx || 0) * m}px`); img.style.setProperty('--dy', `${(s.dy || 0) * m}px`); img.style.setProperty('--rot', `${(s.rot || 0) * (cinematic ? 1.4 : 1)}deg`);
    if (!s.wind) img.style.animationDelay = s.delay !== undefined ? `${s.delay}s` : `${-((s.n.charCodeAt(0) * 7 + s.n.charCodeAt(s.n.length - 1) * 3 + s.n.length * 13) % 20)}s`; // desynchronised loops
    if (s.fx) img.dataset.fx = s.fx;
    if (s.fx === 'stream') img.style.setProperty('--rest', String(s.rest ?? 0.5));
    if (s.fx === 'flow') {   // a seamless ribbon (two periods side by side) streams through a clipping wrapper; the wrapper undulates
      wrap.dataset.flow = s.flow < 0 ? 'rev' : ''; wrap.style.setProperty('--sd', `${(s.sway || 13) / (cinematic ? 1.3 : 1)}s`); wrap.style.setProperty('--sk', `${s.skew ?? 2.5}deg`);
      wrap.style.animationDelay = `${-(s.n.length * 3.7 % 11)}s`;
    }
    wrap.appendChild(img);
    if (s.op) wrap.style.opacity = String(s.op); // distance haze for far objects (the water/air colour shows through)
    if (s.anchor === 'bottom') wrap.style.translate = '-50% -100%';
    if (s.plane === 'scene') { wrap.style.left = `${s.x}%`; wrap.style.top = `${s.y}%`; wrap.style.width = `${s.w}%`; if (s.z) wrap.style.zIndex = String(s.z); } // % of the 16:9 stage that shares the baked layers' cover geometry
    else wrap.dataset.pop = s.at;
    return wrap;
  }
  // Pop-out placement: inside the scene window (band) or a wide side margin, at the largest size that keeps every
  // sampled point (sprite box grown by its parallax + drift reach) clear of text, controls, media and panels.
  const CONTENTISH = 'a, button, input, textarea, select, label, img, svg, video, canvas, code, pre, summary, [role="button"], [role="tab"], [role="menu"], [role="dialog"], [contenteditable]';
  function blockedAt(x, y) {
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
    for (const e of document.elementsFromPoint(x, y)) {
      if (e === document.documentElement || e === document.body || e.closest(`#${DEPTH_ID}, #${POP_ID}`)) continue;
      if (e.matches(CONTENTISH) || e.closest(CONTENTISH)) return true;
      if ([...e.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim())) return true;
      const bg = getComputedStyle(e).backgroundColor;
      if (!/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return true;
      return false; // topmost real element is an empty layout box: open space
    }
    return false;
  }
  function placePop() {
    const pop = document.getElementById(POP_ID); if (!pop) return;
    const t = tuning();
    const band = document.getElementById('repo-content-pjax-container') || document.querySelector('turbo-frame#repo-content-turbo-frame'); // the element that carries the scene-window padding
    const bandH = band && document.documentElement.classList.contains('repv-scene-window') ? parseFloat(getComputedStyle(band).paddingTop) || 0 : 0;
    const br = band ? band.getBoundingClientRect() : null;
    // skip when nothing that placement depends on has changed (panel scans re-queue this after DOM mutations)
    const sig = `${innerWidth}x${innerHeight}|${br ? Math.round(br.top + scrollY) : -1}|${bandH}|${document.documentElement.scrollHeight}|${t.foreground}|${t.parallax}|${pop.childElementCount}|${[...pop.querySelectorAll('img')].filter(i => i.complete).length}`;
    if (pop.dataset.sig === sig) return;
    pop.dataset.sig = sig;
    // side margins: the open space at mid-height, found by probing (first text/control/panel from each side)
    const probeY = [0.45, 0.6, 0.75].map(f => innerHeight * f);
    let colLeft = innerWidth / 2, colRight = innerWidth / 2;
    for (let x = 0; x < innerWidth / 2; x += 8) if (probeY.some(y => blockedAt(x, y))) { colLeft = x; break; }
    for (let x = innerWidth - 1; x > innerWidth / 2; x -= 8) if (probeY.some(y => blockedAt(x, y))) { colRight = x; break; }
    const amp = 0; // no pointer parallax: an object's reach is its own drift only
    for (const w of pop.querySelectorAll('.repv-s')) {
      const s = spritesOf(pop.dataset.scene).find(x => x.plane === 'pop' && x.n === w.dataset.sprite);
      const img = w.firstChild; const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
      let ok = false;
      if (s && t.foreground > 0 && innerWidth >= 768) {
        for (const f of [1.25, 1, 0.8, 0.62]) {
          let h, left, top, fixed = false;
          if (s.at === 'band') {
            if (bandH < 60 || !br) break;
            // how far the sprite can travel: pointer parallax (k × amplitude) + its own drift (Cinematic ≤ 1.8×)
            const rx = s.k * amp + Math.abs(s.dx || 0) * 1.8 * t.motion + 6, ry = s.k * amp * 0.25 + Math.abs(s.dy || 0) * 1.8 * t.motion + 6;
            h = Math.min(bandH * s.h * f * (0.55 + 0.45 * t.foreground), bandH - 2 * ry); if (h < 56) break;
            const wpx = h * ratio;
            left = br.left + scrollX + s.x * innerWidth - wpx / 2;
            const bandTop = br.top + scrollY;
            top = Math.max(bandTop + ry, Math.min(bandTop + bandH - ry - h, bandTop + s.y * bandH - h / 2));
            const vx = left - scrollX, vy = top - scrollY; // viewport coords for the check
            const pts = []; for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) pts.push([vx - rx + (wpx + 2 * rx) * i / 4, vy - ry + (h + 2 * ry) * j / 4]);
            // never over the repository tabs (above the band) or the content (below it)
            if (top - ry < br.top + scrollY - 1 || top + h + ry > br.top + scrollY + bandH + 1) continue;
            if (pts.some(([x, y]) => blockedAt(x, y))) continue;
          } else {
            const margin = s.side === 'left' ? colLeft : innerWidth - colRight;
            if (margin < 150) break;
            h = innerHeight * s.h * f * (0.55 + 0.45 * t.foreground); const wpx = h * ratio;
            if (wpx > margin * 0.95) continue;
            fixed = true;
            left = s.side === 'left' ? margin * 0.08 : innerWidth - margin * 0.08 - wpx; top = innerHeight * s.y - h / 2;
            const reach = s.k * amp + Math.abs(s.dx || 0) * 1.8 + 10;
            if (s.side === 'left' ? left + wpx + reach > colLeft : left - reach < colRight) continue;
            const pts = []; for (let i = 0; i <= 3; i++) for (let j = 0; j <= 4; j++) pts.push([left - reach + (wpx + 2 * reach) * i / 3, top - reach + (h + 2 * reach) * j / 4]);
            if (pts.some(([x, y]) => blockedAt(x, y))) continue;
          }
          w.style.position = fixed ? 'fixed' : 'absolute';
          w.style.left = `${Math.round(left)}px`; w.style.top = `${Math.round(top)}px`; w.style.height = `${Math.round(h)}px`; w.style.width = 'auto';
          ok = true; break;
        }
      }
      w.hidden = !ok;
    }
  }
  let popTimer = 0;
  function queuePlacePop() { clearTimeout(popTimer); popTimer = setTimeout(() => requestAnimationFrame(placePop), 150); }
  let depthState = { key: '', listening: false, probing: false, decided: false, autoLite: false, fps: null, decisions: 0 };
  /* No pointer parallax (removed by request): the scene never reacts to the mouse. Depth comes from the layered art,
     the moving objects at different depths and their own autonomous motion. */
  // Hidden tab: pause every depth animation outright (Chrome throttles too, this makes it explicit) and stop the rAF.
  function onVisibility() {
    const hidden = document.visibilityState === 'hidden' && depthState.listening;
    document.documentElement?.classList.toggle('repv-depth-paused', hidden);
  }
  function listenPointer(on) {
    if (on === depthState.listening) return;
    depthState.listening = on;
    const m = on ? 'addEventListener' : 'removeEventListener';
    document[m]('visibilitychange', onVisibility);
    onVisibility();
  }
  function depthFor(theme, url) {
    if (!theme || !url || !config.depthEffects) return null;
    const v = C.normalizeTheme(theme);
    if (v.wallpaperBlur > 0 || v.wallpaperSize !== 'cover' || v.wallpaperPosition !== 'center') return null;
    const m = /^builtin:([a-z0-9-]+)$/.exec(v.wallpaperRef || '');
    const w = m && C.WALLPAPERS.find(x => x.slug === m[1]);
    if (!w || !w.depth || !w.depth.length) return null;
    return { slug: w.slug, layers: Object.fromEntries(w.depth.map(d => [d.layer, chrome.runtime.getURL(d.path)])), mode: config.motionMode === 'static' || reducedQuery?.matches ? 'static' : config.motionMode, veil: sceneLayers(v).map(l => l.replace(' fixed', '')).join(', ') };
  }
  function removeDepth() {
    document.getElementById(DEPTH_ID)?.remove(); document.getElementById(POP_ID)?.remove();
    window.removeEventListener('resize', queuePlacePop); clearTimeout(popTimer); depthState.movers = null;
    document.documentElement?.classList.remove('repv-depth', 'repv-depth-cinematic', 'repv-depth-static', 'repv-depth-paused', 'repv-depth-lite', 'repv-depth-minimal');
    listenPointer(false); depthState.key = '';
  }
  function renderDepth(theme, url) {
    const d = depthFor(theme, url);
    const root = document.documentElement;
    if (!d) { if (depthState.key || document.getElementById(DEPTH_ID)) removeDepth(); return; }
    const T = tuning();
    const key = `${d.slug}|${d.mode}|${d.veil}|${T.foreground > 0}`;
    let el = document.getElementById(DEPTH_ID);
    if (!el || depthState.key !== key) {
      el?.remove();
      el = document.createElement('div');
      el.id = DEPTH_ID; el.setAttribute('aria-hidden', 'true'); el.dataset.scene = d.slug; el.dataset.mode = d.mode; if (WORLDS[d.slug]) el.dataset.world = '';
      const P = DEPTH_PARTICLES[d.slug] || worldParticles(d.slug);
      const order = ['far', 'pfar', 'mist', 'mid', 'pmid', 'near', 'rays', 'front', 'pnear'];
      const SP = spritesOf(d.slug);
      // scene sprites share a few depth buckets (one parallax mover each) instead of one mover per object
      const bucketK = k => k < 0.52 ? 0.46 : k < 0.75 ? 0.64 : k < 1 ? 0.86 : k < 1.6 ? 1.28 : 1.8;
      const addSprites = near => {
        const buckets = new Map();
        for (const s of SP.filter(x => x.plane === 'scene' && (near ? x.k >= 1 : x.k < 1))) {
          const bk = bucketK(s.k);
          if (!buckets.has(bk)) { const b = document.createElement('div'); b.className = 'repv-b'; b.dataset.k = String(bk); buckets.set(bk, b); el.appendChild(b); if (WORLDS[d.slug]) b.dataset.stage = ''; }
          buckets.get(bk).appendChild(buildSprite(d.slug, s, d.mode === 'cinematic'));
        }
      };
      for (const name of order) {
        if (name === 'rays') addSprites(false);  // mid-depth sprites sit below the light shafts
        if (name === 'pnear') addSprites(true);  // close sprites sit just behind the nearest particles
        const img = d.layers[name] ? `url("${d.layers[name]}")` : null;
        const part = P[name];
        if (!img && !part) continue;
        const layer = document.createElement('div');
        layer.className = 'repv-l'; layer.dataset.l = name; layer.dataset.k = String(LAYER_K[name]); layer.style.setProperty('--k', String(LAYER_K[name]));
        const inner = document.createElement('i');
        if (img) inner.style.backgroundImage = img;
        else if (Array.isArray(part)) {
          layer.dataset.tile = ''; inner.style.backgroundImage = part[0]; inner.style.backgroundSize = part[1];
          const tl = part[2]; // world tile plane: one-tile-period transform loop (seamless, compositor-only) + optional gust push
          if (tl) {
            layer.dataset.tw = ''; const cin = d.mode === 'cinematic', pxw = typeof tl.w === 'string' ? tl.w : +tl.w, pxh = typeof tl.h === 'string' ? tl.h : +tl.h;
            if (tl.region) {   // only the part of the stage the plane is visible in is drawn: a clip rectangle (stage fractions x0,y0,x1,y1) keeps the compositor from blending a full-viewport plane
              const [x0, y0, x1, y1] = tl.region, Ws = 'max(100vw, 177.78vh)', Hs = 'max(56.25vw, 100vh)', L = `((100vw - ${Ws}) / 2)`, T = `((100vh - ${Hs}) / 2)`;
              layer.style.clipPath = `inset(calc(${T} + ${y0} * ${Hs}) calc(100vw - ${L} - ${x1} * ${Ws}) calc(100vh - ${T} - ${y1} * ${Hs}) calc(${L} + ${x0} * ${Ws}))`;
            }
            if (tl.mask) { layer.style.webkitMaskImage = tl.mask; layer.style.maskImage = tl.mask; layer.style.webkitMaskSize = layer.style.maskSize = 'cover'; layer.style.webkitMaskPosition = layer.style.maskPosition = 'center'; layer.style.webkitMaskRepeat = layer.style.maskRepeat = 'no-repeat'; }
            inner.style.setProperty('--tw', typeof pxw === 'string' ? pxw : `${pxw}px`); inner.style.setProperty('--th', typeof pxh === 'string' ? pxh : `${pxh}px`); inner.style.setProperty('--sx', String(tl.sx || 0)); inner.style.setProperty('--sy2', String(tl.sy || 0));
            const twv = inner.style.getPropertyValue('--tw'), thv = inner.style.getPropertyValue('--th');
            if (tl.sx > 0) inner.style.setProperty('--exl', twv); else if (tl.sx < 0) inner.style.setProperty('--exr', twv);
            if (tl.sy > 0) inner.style.setProperty('--eyt', thv); else if (tl.sy < 0) inner.style.setProperty('--eyb', thv);
            inner.style.setProperty('--tp', `${(tl.t || 40) / (cin ? 1.4 : 1)}s`); if (tl.gust) layer.dataset.gustpush = '';          }
        }
        else inner.style.backgroundImage = part;
        layer.appendChild(inner); el.appendChild(layer);
      }
      const veil = document.createElement('div'); veil.className = 'repv-veil'; if (d.veil) veil.style.backgroundImage = d.veil; el.appendChild(veil);
      root.appendChild(el);
      document.getElementById(POP_ID)?.remove();
      const pops = spritesOf(d.slug).filter(x => x.plane === 'pop');
      if (pops.length && T.foreground > 0) {
        const pop = document.createElement('div'); pop.id = POP_ID; pop.setAttribute('aria-hidden', 'true'); pop.dataset.scene = d.slug;
        for (const s of pops) { const w = buildSprite(d.slug, s, d.mode === 'cinematic'); w.hidden = true; w.firstChild.addEventListener('load', queuePlacePop, { once: true }); pop.appendChild(w); }
        root.appendChild(pop);
        window.addEventListener('resize', queuePlacePop, { passive: true });
      }
      depthState.key = key; depthState.movers = null;
    }
    el.style.setProperty('--drift', String(T.motion)); el.style.setProperty('--particles', String(Math.min(1, T.particles))); el.style.setProperty('--fg', String(Math.min(1, T.foreground)));
    document.getElementById(POP_ID)?.style.setProperty('--drift', String(T.motion));
    root.classList.toggle('repv-depth-still', T.motion === 0);
    root.classList.toggle('repv-depth-static', d.mode === 'static');
    queuePlacePop();
    root.classList.add('repv-depth');
    root.classList.toggle('repv-depth-cinematic', d.mode === 'cinematic');
    listenPointer(d.mode !== 'static');
    applyDepthQuality();
    probeDepthQuality(key);
  }
  // Quality: Full, Lite (drops the three extra particle/mist planes and per-layer animations) or Auto, which measures the
  // frame rate for 2 s once the scene has settled and switches to Lite below 40 fps for the rest of this page's life.
  function applyDepthQuality() {
    const lite = config.depthQuality === 'lite' || (config.depthQuality === 'auto' && depthState.autoLite);
    const minimal = config.depthQuality === 'auto' && depthState.autoMinimal;
    document.documentElement?.classList.toggle('repv-depth-lite', lite && !!document.getElementById(DEPTH_ID));
    document.documentElement?.classList.toggle('repv-depth-minimal', minimal && !!document.getElementById(DEPTH_ID));
  }
  // Auto decides ONCE per page: measured in a moving mode (never Static), in a visible tab, after the scene settled.
  // Lite is sticky for the rest of the page's life (no oscillation: a Lite scene would otherwise measure faster and
  // switch back). An aborted measurement (tab hidden, scene rebuilt) simply retries later; it never flips a decision.
  function probeDepthQuality(key) {
    if (config.depthQuality !== 'auto' || depthState.decided || depthState.probing) return;
    if (document.getElementById(DEPTH_ID)?.dataset.mode === 'static') return;
    depthState.probing = true;
    setTimeout(() => {
      if (depthState.key !== key || document.visibilityState !== 'visible') { depthState.probing = false; return; }
      let n = 0; const t0 = performance.now();
      const tick = () => {
        if (depthState.key !== key) { depthState.probing = false; return; }
        n++; const dt = performance.now() - t0;
        if (dt < 2000) { requestAnimationFrame(tick); return; }
        depthState.probing = false;
        if (document.visibilityState !== 'visible') return; // rAF throttled: not a real measurement
        depthState.fps = Math.round(n / (dt / 1000));
        depthState.decided = true; depthState.decisions++;
        depthState.autoLite = depthState.fps < 40;
        depthState.autoMinimal = depthState.fps < 25; // one-way ladder, decided once: Full ≥ 40 fps, Lite 25–40, Minimal < 25
        applyDepthQuality();
      };
      requestAnimationFrame(tick);
    }, 1500);
  }
  const GUST_S = 23; // shared irregular gust cycle (s): wind-driven sprites and gust-pushed wrappers all follow it
  const DEPTH_CSS = `
html.repv-depth #${'repovibe-depth'} { position:fixed; inset:0; z-index:-1; pointer-events:none; overflow:hidden; contain:strict; --amp:13px; }
html.repv-depth-cinematic #repovibe-depth { --amp:30px; }
#repovibe-depth > .repv-l { position:absolute; inset:calc(-1 * (var(--k) * 24px + 8px)); will-change:transform; transform:translate3d(0, 0, 0); } /* overscan sized to this layer's own travel (Cinematic camera drift), not a blanket 6 % */
#repovibe-depth > .repv-b { position:absolute; inset:0; will-change:transform; }
/* Data-driven worlds: sprites live in a 16:9 "stage" that has exactly the baked layers' cover geometry, so a sprite that continues a baked
   object (a swaying tree head on its trunk) stays registered at every aspect ratio; layers carry no overscan or camera drift here. */
#repovibe-depth[data-world] > .repv-b[data-stage] { inset:auto; left:50%; top:50%; width:max(100vw, 177.78vh); height:max(56.25vw, 100vh); margin-left:calc(max(100vw, 177.78vh) / -2); margin-top:calc(max(56.25vw, 100vh) / -2); }
#repovibe-depth[data-world] > .repv-l { inset:0; }
#repovibe-depth > .repv-l > i { position:absolute; inset:0; background-position:center; background-size:cover; background-repeat:no-repeat; }
#repovibe-depth > .repv-l[data-tile] > i { background-position:0 0; background-repeat:repeat; }
/* spare area only where the plane slides FROM (one tile on the leading side, plus a 100 px margin all round for the gust push): a whole-period slide never shows an edge, and the plane is ~35 % smaller than with a tile on every side */
#repovibe-depth > .repv-l[data-tw] > i { inset:calc(-100px - var(--eyt, 0px)) calc(-100px - var(--exr, 0px)) calc(-100px - var(--eyb, 0px)) calc(-100px - var(--exl, 0px)); }
#repovibe-depth > .repv-veil { position:absolute; inset:0; }
#repovibe-depth > [data-l="rays"] { opacity:.8; } /* light-coloured alpha art: no blend mode (avoids an extra render surface) */
html.repv-depth-lite #repovibe-depth > :is([data-l="pfar"], [data-l="mist"], [data-l="pnear"]) { visibility:hidden; }
/* Lite (manual, or Auto below 40 fps): fewer full-viewport planes and no camera drift — the main cost of software compositing.
   The weather never freezes: the mid particle plane (rain, snow, petals, bubbles) keeps falling — a single compositor transform —
   because a still weather plane reads as a frozen picture. Main objects keep drifting, plants keep swaying, ripples keep running;
   distant belt rocks rest; pop-out objects lose their filter shadow. */
html.repv-depth-lite #repovibe-depth > .repv-l:not([data-l="pmid"]) > i { animation:none !important; }
html.repv-depth-lite #repovibe-depth .repv-b[data-k="0.46"] > .repv-s > img:not([data-fx="ripple"], [data-fx="drop"], [data-fx="flow"], [data-fx="stream"], [data-wind], [data-cross], [data-swim], [data-fall], [data-rise], [data-approach]) { animation:none !important; } /* only idle drift rests (e.g. distant belt rocks); travellers never freeze mid-path */
html.repv-depth-lite #repovibe-popout > .repv-s::before { display:none; }
/* Minimal (Auto only, < 25 fps): no light shafts; the one moving weather plane, layers, moving objects and pop-out stay */
html.repv-depth-minimal #repovibe-depth > [data-l="rays"] { visibility:hidden; }
#repovibe-depth > [data-l="front"] > i { transform-origin:50% 0; }
html.repv-depth.repv-active::after, html.repv-depth body::after { content:none !important; animation:none !important; }
html.repv-depth body::before { animation:none !important; will-change:auto !important; } /* covered by the depth scene: no hidden work */
@media (prefers-reduced-motion:no-preference) {
 #repovibe-depth > [data-l="pfar"] > i { animation:repv-fly-a 16s ease-in-out infinite alternate, repv-pulse 3.6s ease-in-out infinite alternate; }
 #repovibe-depth > [data-l="pmid"] > i { animation:repv-fly-b 12s ease-in-out infinite alternate, repv-pulse 2.8s ease-in-out infinite alternate-reverse; }
 #repovibe-depth > [data-l="pnear"] > i { animation:repv-bokeh 22s ease-in-out infinite alternate; }
 #repovibe-depth > [data-l="mist"] > i { animation:repv-fog 30s ease-in-out infinite alternate; }
 #repovibe-depth > [data-l="rays"] > i { animation:repv-breathe 9s ease-in-out infinite alternate; }
 html.repv-depth-cinematic #repovibe-depth > .repv-l:not([data-tile]) > i { animation:repv-cam 26s ease-in-out infinite alternate; }
 html.repv-depth-cinematic #repovibe-depth > .repv-l[data-l="front"] > i { animation:repv-sway 7s ease-in-out infinite alternate; }
 html.repv-depth-cinematic #repovibe-depth > .repv-l[data-l="rays"] > i { animation:repv-breathe 5s ease-in-out infinite alternate, repv-cam 26s ease-in-out infinite alternate; }
}
@keyframes repv-cam { from { transform:translate3d(calc(var(--k) * -16px), calc(var(--k) * 4px), 0) scale(calc(1 + var(--k) * .012)); } to { transform:translate3d(calc(var(--k) * 16px), calc(var(--k) * -6px), 0) scale(calc(1 + var(--k) * .03)); } }
@keyframes repv-sway { from { transform:rotate(-.7deg) translate3d(-6px, 0, 0); } to { transform:rotate(.7deg) translate3d(6px, 2px, 0); } }
@keyframes repv-breathe { from { opacity:.45; } to { opacity:1; } }
@keyframes repv-bokeh { from { transform:translate3d(-20px, 10px, 0); } to { transform:translate3d(24px, -18px, 0); } }
/* Sprites (scene plane) and the pop-out layer */
#repovibe-depth .repv-b > .repv-s { position:absolute; translate:-50% -50%; }
.repv-s > img { display:block; width:100%; height:auto; user-select:none; }
#repovibe-popout { position:absolute; top:0; left:0; width:100%; height:0; overflow-x:clip; overflow-y:visible; z-index:2; pointer-events:none; } /* clipped horizontally: objects cropped by the screen edge never change the page's scroll overflow (which forced a relayout + repaint of the whole document on every parallax frame) */
#repovibe-popout > .repv-s { will-change:transform; }
#repovibe-popout > .repv-s > img { height:100%; width:auto; position:relative; }
/* contact shadow under each pop-out object: a cheap gradient on the (non-animated) wrapper, not a per-frame filter */
#repovibe-popout > .repv-s::before { content:""; position:absolute; left:8%; right:8%; top:30%; bottom:-14%; border-radius:50%; background:radial-gradient(closest-side, rgba(0, 0, 0, .5), rgba(0, 0, 0, .22) 60%, transparent); transform:translateY(12%); }
#repovibe-popout > .repv-s[data-ns]::before { display:none; }
#repovibe-popout > .repv-s[hidden], #repovibe-depth .repv-s[hidden] { display:none; }
#repovibe-depth > [data-l="front"] { opacity:var(--fg, 1); }
#repovibe-depth > :is([data-l="pfar"], [data-l="pmid"], [data-l="pnear"], [data-l="mist"]) { opacity:var(--particles, 1); }
@media (prefers-reduced-motion:no-preference) {
 :is(#repovibe-depth, #repovibe-popout) .repv-s > img { animation:repv-drift var(--dur, 30s) ease-in-out infinite alternate; }
 :is(#repovibe-depth, #repovibe-popout) .repv-s > img[data-cross] { animation:repv-cross var(--dur, 120s) linear infinite; }
 :is(#repovibe-depth, #repovibe-popout) .repv-s > img[data-cross="rev"] { animation-name:repv-cross-rev; }
 :is(#repovibe-depth, #repovibe-popout) .repv-s > img[data-fall] { animation:repv-fall var(--dur, 30s) linear infinite, repv-leaf-sway var(--sway, 4.5s) ease-in-out infinite alternate, repv-leaf-flutter var(--flut, 2.5s) ease-in-out infinite alternate, repv-leaf-turn var(--turn, 3.2s) ease-in-out infinite alternate; }
 :is(#repovibe-depth, #repovibe-popout) .repv-s > img[data-fx="flicker"] { animation:repv-drift var(--dur, 30s) ease-in-out infinite alternate, repv-flick 4.3s steps(1, end) infinite; }
 :is(#repovibe-depth, #repovibe-popout) .repv-s > img[data-fx="pulse"] { animation:repv-drift var(--dur, 30s) ease-in-out infinite alternate, repv-glow var(--gl, 3.2s) ease-in-out infinite alternate; }
 :is(#repovibe-depth, #repovibe-popout) .repv-s > img[data-fx="spin"] { animation:repv-drift var(--dur, 30s) ease-in-out infinite alternate, repv-spin 40s linear infinite; }
 :is(#repovibe-depth, #repovibe-popout) .repv-s > img[data-fx="spinY"] { animation:repv-drift var(--dur, 30s) ease-in-out infinite alternate, repv-spin-y 9s ease-in-out infinite alternate; }
 html.repv-depth-cinematic :is(#repovibe-depth, #repovibe-popout) .repv-s > img[data-fx="spin"] { animation-duration:var(--dur, 30s), 22s; }
 #repovibe-depth .repv-s > img[data-fx="ripple"] { animation:repv-ripple var(--dur, 8s) linear infinite; }
 #repovibe-depth .repv-s > img[data-fx="drop"] { animation:repv-drop var(--dur, 8s) linear infinite; }
 #repovibe-depth .repv-s > img[data-fx="stream"] { animation:repv-stream var(--dur, 8s) linear infinite; }
 #repovibe-depth .repv-s > img[data-fx="flow"] { animation:repv-flow var(--dur, 80s) linear infinite, repv-aurora-glow var(--gl, 7s) ease-in-out infinite alternate; }
 #repovibe-depth .repv-s[data-flow="rev"] > img[data-fx="flow"] { animation-name:repv-flow-rev, repv-aurora-glow; }
 #repovibe-depth .repv-s[data-flow] { animation:repv-aurora-sway var(--sd, 13s) ease-in-out infinite alternate; }
}
#repovibe-depth .repv-s > img[data-fx="ripple"] { opacity:.28; scale:.6; } /* at rest (Static, reduced motion): faint frozen rings */
#repovibe-depth .repv-s > img[data-fx="drop"] { opacity:0; } /* at rest (Static, reduced motion): no drop hangs in the air */
/* code streams (Matrix): each column falls from above the stage to below it — the whole travel is one loop, so the code moves continuously
   top → bottom; at rest (Static, reduced motion) a stream stays where its loop phase puts it, fully inside the scene */
#repovibe-depth .repv-s > img[data-fx="stream"] { transform:translate3d(0, calc((max(56.25vw, 100vh) + 100%) * var(--rest, .5)), 0); }
@keyframes repv-stream { from { transform:translate3d(0, 0, 0); } to { transform:translate3d(0, calc(max(56.25vw, 100vh) + 100%), 0); } }
@keyframes repv-drop { 0%, 87.5% { transform:translate3d(0, -560%, 0); opacity:0; } 88.5% { opacity:.95; } 99.6% { transform:translate3d(0, 0, 0); opacity:.95; } 100% { transform:translate3d(0, 0, 0); opacity:0; } } /* falls, lands as its ring starts (0 % of the shared cycle) */
/* Aurora ribbons: one period visible through the wrapper (overflow clipped, soft edges); the image is two periods wide and slides by one period */
#repovibe-depth .repv-s[data-flow] { overflow:hidden; transform-origin:50% 85%; -webkit-mask-image:linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent); mask-image:linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent); }
#repovibe-depth .repv-s[data-flow] > img { width:200%; max-width:none; }
@keyframes repv-flow { from { transform:translate3d(0, 0, 0); } to { transform:translate3d(-50%, 0, 0); } }
@keyframes repv-flow-rev { from { transform:translate3d(-50%, 0, 0); } to { transform:translate3d(0, 0, 0); } }
@keyframes repv-aurora-glow { 0% { opacity:.55; } 45% { opacity:1; } 70% { opacity:.78; } 100% { opacity:.95; } }
@keyframes repv-aurora-sway { 0% { transform:skewX(calc(var(--sk) * -1)) scaleY(.9); } 50% { transform:skewX(calc(var(--sk) * .4)) scaleY(1.06); } 100% { transform:skewX(var(--sk)) scaleY(.96); } }
@keyframes repv-ripple { 0% { scale:.06; opacity:0; } 1.5% { opacity:1; } 22% { opacity:.8; } 38% { scale:1; opacity:0; } 100% { scale:1; opacity:0; } } /* a drizzle drop: quick ring, then calm water until the next drop */
#repovibe-depth .repv-s:has(> img[data-fall]) { top:0 !important; }
#repovibe-depth .repv-s:has(> img[data-rise]) { top:0 !important; }
html.repv-depth-static #repovibe-depth .repv-s:has(> img:is([data-fall], [data-rise], [data-approach])), html.repv-depth-still #repovibe-depth .repv-s:has(> img:is([data-fall], [data-rise], [data-approach])) { top:var(--sy, 40%) !important; } /* at rest: a leaf lies in the scene instead of hiding above it */
@keyframes repv-cross-rev { from { transform:translate3d(60vw, -3vh, 0); } to { transform:translate3d(-80vw, 5vh, 0); } }
/* A leaf in a breeze: net descent and drift with a gust (faster fall and push at 45–70 %), a slow overall spin, plus three independent,
   desynchronised oscillations (individual transform properties compose): sideways sway, pendulum flutter, turning edge-on. */
@keyframes repv-fall { 0% { transform:translate3d(0, -14vh, 0) rotate(0deg); opacity:0; } 6% { opacity:1; } 45% { transform:translate3d(calc(var(--dx) * .3), 44vh, 0) rotate(calc(var(--rot) * .4)); } 70% { transform:translate3d(calc(var(--dx) * .72), 82vh, 0) rotate(calc(var(--rot) * .75)); } 94% { opacity:1; } 100% { transform:translate3d(var(--dx), 122vh, 0) rotate(var(--rot)); opacity:0; } }
@keyframes repv-leaf-sway { from { translate:calc(var(--sw, 40px) * -1) 0; } to { translate:var(--sw, 40px) 0; } }
@keyframes repv-leaf-flutter { from { rotate:calc(var(--fa, 38deg) * -1); } to { rotate:var(--fa, 38deg); } }
@keyframes repv-leaf-turn { from { scale:1 1; } to { scale:.38 1; } }
@keyframes repv-flick { 0%, 100% { opacity:1; } 31% { opacity:.55; } 33% { opacity:1; } 62% { opacity:.8; } 64% { opacity:1; } 66% { opacity:.4; } 67% { opacity:1; } }
@keyframes repv-glow { from { opacity:.72; } to { opacity:1; } }
@keyframes repv-spin { from { rotate:0deg; } to { rotate:360deg; } }
@keyframes repv-spin-y { from { scale:.82 1; } to { scale:1 1; } }
@keyframes repv-drift { 0% { transform:translate3d(0, 0, 0) rotate(0deg); } 50% { transform:translate3d(calc(var(--dx) * var(--drift, 1)), calc(var(--dy) * var(--drift, 1)), 0) rotate(calc(var(--rot) * .55 * var(--drift, 1))); } 100% { transform:translate3d(calc(var(--dx) * -.45 * var(--drift, 1)), calc(var(--dy) * .7 * var(--drift, 1)), 0) rotate(calc(var(--rot) * var(--drift, 1))); } }
@keyframes repv-cross { from { transform:translate3d(-60vw, 6vh, 0) rotate(0deg); } to { transform:translate3d(80vw, -4vh, 0) rotate(var(--rot)); } }
/* World motion kinds. WIND: one irregular 23 s gust curve shared by every wind-driven object (rotation about its base) and gust-pushed wrapper (translation);
   --gd delays by x position so a gust visibly travels across the scene. RISE: bubbles/motes. APPROACH: perspective growth. SWIM: body wobble. TILE: seamless particle plane. */
@media (prefers-reduced-motion:no-preference) {
 :is(#repovibe-depth, #repovibe-popout) .repv-s > img[data-wind] { transform-origin:var(--ox, 50%) var(--oy, 100%); animation:repv-gust-r 23s ease-in-out infinite, repv-flutter var(--fl, 4.2s) ease-in-out infinite alternate; animation-delay:var(--gd, 0s), 0s; }
 #repovibe-depth .repv-s[data-gust] { animation:repv-gust-x 23s ease-in-out infinite; animation-delay:var(--gd, 0s); }
 #repovibe-depth .repv-s > img[data-rise] { animation:repv-rise var(--dur, 30s) linear infinite, repv-leaf-sway var(--sway, 4.2s) ease-in-out infinite alternate, repv-leaf-flutter var(--flut, 3s) ease-in-out infinite alternate; }
 #repovibe-depth .repv-s > img[data-approach] { animation:repv-approach var(--dur, 60s) linear infinite; }
 #repovibe-depth .repv-s > img[data-swim] { animation-name:repv-drift, repv-swim; animation-duration:var(--dur, 30s), var(--wp, 5s); animation-timing-function:ease-in-out; animation-iteration-count:infinite; animation-direction:alternate; }
 #repovibe-depth .repv-s > img[data-swim][data-cross] { animation-name:repv-cross, repv-swim; animation-timing-function:linear, ease-in-out; animation-direction:normal, alternate; }
 #repovibe-depth .repv-s > img[data-swim][data-cross="rev"] { animation-name:repv-cross-rev, repv-swim; }
 #repovibe-depth .repv-s > img[data-jp] { animation-duration:var(--dur, 30s), var(--jp, 4s); }
 #repovibe-depth > .repv-l[data-tw] > i { animation:repv-tile var(--tp, 40s) linear infinite; }
 #repovibe-depth > .repv-l[data-tw][data-gustpush] > i { animation:repv-tile var(--tp, 40s) linear infinite, repv-tile-gust 23s ease-in-out infinite; }
}
html.repv-depth-static #repovibe-depth .repv-s:has(> img[data-approach]), html.repv-depth-still #repovibe-depth .repv-s:has(> img[data-approach]) { visibility:hidden; } /* scanning lines / arriving traffic only exist while moving; the baked scene is complete at rest */
#repovibe-depth .repv-s > img[data-approach] { animation-timing-function:cubic-bezier(.62, 0, .95, .55) !important; }
@keyframes repv-gust-r { 0%, 100% { rotate:calc(var(--wa) * -.15); } 12% { rotate:calc(var(--wa) * .25); } 22% { rotate:calc(var(--wa) * .9); } 31% { rotate:calc(var(--wa) * .35); } 47% { rotate:calc(var(--wa) * -.1); } 58% { rotate:calc(var(--wa) * .55); } 66% { rotate:calc(var(--wa) * 1.15); } 78% { rotate:calc(var(--wa) * .2); } 90% { rotate:calc(var(--wa) * -.2); } }
@keyframes repv-flutter { from { transform:rotate(-.8deg); } to { transform:rotate(.8deg); } }
@keyframes repv-gust-x { 0%, 100% { translate:-50% -50%; } 22% { translate:calc(-50% + var(--gx) * .8) -50%; } 31% { translate:calc(-50% + var(--gx) * .3) -50%; } 47% { translate:calc(-50% + var(--gx) * -.1) -50%; } 66% { translate:calc(-50% + var(--gx)) -50%; } 78% { translate:calc(-50% + var(--gx) * .15) -50%; } }
@keyframes repv-tile-gust { 0%, 100% { translate:0 0; } 22% { translate:60px 8px; } 31% { translate:25px 2px; } 66% { translate:80px 10px; } 78% { translate:12px 0; } }
@keyframes repv-tile { from { transform:translate3d(0, 0, 0); } to { transform:translate3d(calc(var(--tw) * var(--sx)), calc(var(--th) * var(--sy2)), 0); } }
@keyframes repv-rise { 0% { transform:translate3d(0, 112vh, 0); opacity:0; } 8% { opacity:1; } 90% { opacity:1; } 100% { transform:translate3d(0, -12vh, 0); opacity:0; } }
@keyframes repv-approach { 0% { transform:translate3d(0, 0, 0) scale(.05); opacity:0; } 10% { opacity:var(--a0, 1); } 100% { transform:translate3d(var(--ax), var(--ay), 0) scale(1); opacity:1; } }
@keyframes repv-swim { from { rotate:calc(var(--tilt, 6deg) * -1); translate:0 calc(var(--wob, 24px) * -.5); } to { rotate:var(--tilt, 6deg); translate:0 calc(var(--wob, 24px) * .5); } }
/* Static (and reduced motion): the same layered scene, at rest: no overscan, no animation, no pointer response */
html.repv-depth-cinematic #repovibe-depth[data-world] > .repv-l:not([data-tile], [data-l="rays"]) > i { animation:none; }
html.repv-depth-static #repovibe-depth > .repv-l { inset:0; }
html.repv-depth-static :is(#repovibe-depth, #repovibe-popout) *, html.repv-depth-still :is(#repovibe-depth, #repovibe-popout) * { animation:none !important; }
html.repv-depth-paused :is(#repovibe-depth, #repovibe-popout) *, html.repv-depth-paused #repovibe-depth { animation-play-state:paused !important; }
@media (prefers-reduced-motion:reduce) { :is(#repovibe-depth, #repovibe-popout) * { animation:none !important; } }
`;

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
  /* Homepage adapter. GitHub's signed-in dashboard has been served both as classic markup (#dashboard-repos-container,
     <li> rows) and as React (hashed classes, div[role=listitem] rows, headings in spans). Nothing here depends on one
     selector: (1) find the Top repositories list by legacy id, landmark/label or its heading text; (2) find every link
     whose path is exactly /owner/repo inside it; (3) the row is the largest ancestor of a link that contains no other
     repository (works for li, div rows and rows that are the link itself). Each decision is recorded for diagnostics. */
  const HEADING = /^\s*top\s+repositories\s*$/i;
  const REPO_LIST_LABEL = /top repositories/i;
  let cardDiag = { home: false };
  function repoKeyOf(a) {
    let u; try { u = new URL(a.getAttribute('href'), location.origin); } catch (_) { return null; }
    if (u.origin !== location.origin || u.search || u.pathname.split('/').filter(Boolean).length !== 2) return null;
    return C.repositoryFromUrl(u.href);
  }
  function findRepoList() {
    const legacy = document.getElementById('dashboard-repos-container') || document.querySelector('.js-repos-container');
    if (legacy) return { container: legacy, method: 'legacy id' };
    const labelled = [...document.querySelectorAll('[aria-label], [data-testid]')].find(el => REPO_LIST_LABEL.test(el.getAttribute('aria-label') || '') || /top-?repositories/i.test(el.getAttribute('data-testid') || ''));
    if (labelled && labelled.querySelector('a[href]')) return { container: labelled, method: 'label' };
    // Heading text: any short element whose whole text is "Top repositories" (h1–h6, role=heading, span, div, summary).
    const heading = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"], summary, span, div')]
      .find(el => (el.textContent || '').length <= 40 && HEADING.test(el.textContent || ''));
    if (!heading) return { container: null, method: 'none', reason: 'no "Top repositories" heading, landmark or legacy container on this page' };
    for (let el = heading.parentElement, i = 0; el && el !== document.body && i < 10; el = el.parentElement, i++) {
      const links = [...el.querySelectorAll('a[href]')].filter(a => !heading.contains(a) && repoKeyOf(a));
      if (links.length) {
        // Never take a container as wide as the feed: the sidebar list is narrow.
        if (el.getBoundingClientRect().width > Math.max(560, innerWidth * 0.55)) return { container: null, method: 'heading', reason: 'heading found but its nearest list container is as wide as the page (feed), not themed' };
        return { container: el, method: 'heading', heading };
      }
    }
    return { container: null, method: 'heading', reason: 'heading found but no repository links near it yet (list still loading?)' };
  }
  function topRepositoryRows() {
    const found = findRepoList();
    cardDiag = { home: true, method: found.method, reason: found.reason || '', links: 0, rows: [] };
    if (!found.container) return [];
    const container = found.container;
    const links = [...container.querySelectorAll('a[href]')].filter(a => !(found.heading && found.heading.contains(a)));
    const rows = [], seen = new Set();
    for (const a of links) {
      const repo = repoKeyOf(a);
      if (!repo) continue;
      cardDiag.links++;
      // Largest ancestor (inside the container) that holds only this repository's links.
      let row = a;
      for (let el = a.parentElement; el && el !== container; el = el.parentElement) {
        const keys = new Set([...el.querySelectorAll('a[href]')].map(x => repoKeyOf(x)?.key).filter(Boolean));
        if (keys.size > 1 || el.querySelector('input, textarea, select, h1, h2, h3')) break;
        row = el;
      }
      if (seen.has(row)) continue;
      seen.add(row);
      rows.push({ row, repo });
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
    return `[data-repv-card="${theme.id}"] { --repv-card-glass:${rgba(v.bg, a)}; --repv-card-solid:${v.bg}; --repv-card-text:${v.text};
 --repv-card-muted:${v.muted}; --repv-card-accent:${v.accent}; --repv-card-border:${rgba(v.border, 0.9)};
 --repv-card-img:${img ? `url("${img}")` : `linear-gradient(135deg, ${v.bg}, ${v.gradientTo} 60%, ${v.gradientThird})`}; }`;
  }
  const CARD_CSS = `
[data-repv-card] { position:relative; list-style:none; margin:6px 0 0 !important; padding:8px 84px 8px 10px !important; border-radius:10px; min-height:40px; box-sizing:border-box;
 border:1px solid var(--repv-card-border); overflow:hidden; color:var(--repv-card-text) !important;
 background-color:var(--repv-card-solid) !important;
 background-image:radial-gradient(120% 140% at 100% 0%, rgba(255,255,255,.14), transparent 55%), linear-gradient(90deg, var(--repv-card-glass) 0, var(--repv-card-glass) calc(100% - 110px), rgba(0,0,0,.04) calc(100% - 30px)), var(--repv-card-img) !important;
 background-size:auto, auto, cover !important; background-position:center, center, center right !important; background-repeat:no-repeat !important;
 box-shadow:inset 0 1px 0 rgba(255,255,255,.10), 0 2px 6px rgba(0,0,0,.22), 0 0 0 1px color-mix(in srgb, var(--repv-card-accent) 55%, transparent), 0 0 12px -5px var(--repv-card-accent); }
[data-repv-card][data-repv-card-inline] { display:block !important; }
/* GitHub's own row wrappers must not paint over the card art (React rows often carry an opaque background). */
[data-repv-card] :is(div, span, li, ul, p, strong, small, header, footer, section) { background-color:transparent !important; background-image:none !important; }
[data-repv-card] > div { margin-top:0 !important; align-items:center; }
[data-repv-card] a, [data-repv-card] a *, a[data-repv-card], a[data-repv-card] * { color:var(--repv-card-text) !important; }
[data-repv-card] a span, [data-repv-card] .color-fg-muted { color:var(--repv-card-muted) !important; }
[data-repv-card] a:hover, a[data-repv-card]:hover { text-decoration:underline; text-decoration-color:var(--repv-card-accent); }
[data-repv-card]:focus-within, a[data-repv-card]:focus-visible { outline:2px solid var(--repv-card-accent); outline-offset:1px; }
@media (prefers-reduced-motion:no-preference) {
 [data-repv-card] { transition:transform .22s cubic-bezier(.2,.7,.2,1), box-shadow .22s ease, border-color .22s ease, background-position .6s ease; transform-origin:50% 100%; }
 [data-repv-card]:hover { transform:perspective(520px) rotateX(4deg) translateY(-2px); border-color:var(--repv-card-accent);
  background-position:center, center, 70% 40% !important; box-shadow:inset 0 1px 0 rgba(255,255,255,.18), 0 10px 22px rgba(0,0,0,.35), 0 0 0 1px var(--repv-card-accent), 0 0 18px -4px var(--repv-card-accent); }
}
@media (prefers-contrast:more) { [data-repv-card] { background-image:none !important; } }
@media (forced-colors:active) { [data-repv-card] { background:none !important; border:1px solid CanvasText; padding:4px 0 !important; }
 [data-repv-card] a, [data-repv-card] a * { color:LinkText !important; } }
`;
  function clearCards() {
    document.getElementById(CARDS_STYLE_ID)?.remove();
    for (const el of document.querySelectorAll('[data-repv-card]')) { el.removeAttribute('data-repv-card'); el.removeAttribute('data-repv-card-inline'); }
  }
  let lastCardsCss = '';
  function renderCards() {
    if (tornDown) return;
    if (!isHome()) { cardDiag = { home: false }; if (lastCardsCss || document.querySelector('[data-repv-card]')) { clearCards(); lastCardsCss = ''; } return; }
    if (!config.enabled) { cardDiag = { home: true, reason: 'RepoVibe is turned off' }; clearCards(); lastCardsCss = ''; return; }
    const rows = topRepositoryRows();
    if (!rows.length) { if (lastCardsCss || document.querySelector('[data-repv-card]')) { clearCards(); lastCardsCss = ''; } return; }
    const themes = new Map(), unpersisted = [];
    for (const { row, repo } of rows) {
      const r = C.themeResolution(config, `https://github.com/${repo.key}`);
      if (r.source === 'auto' && !r.persisted) unpersisted.push(repo.key);
      const why = !r.theme ? (r.id === 'native' ? `${r.scope} choice is "Original GitHub"` : r.scope === 'global' && !config.autoAssign ? 'automatic themes are off and the global theme is Original GitHub' : 'no theme resolved') : '';
      cardDiag.rows.push({ repo: repo.label, row: row.tagName.toLowerCase(), theme: r.theme ? r.theme.name : null, source: r.scope, reason: why });
      if (!r.theme) { if (row.hasAttribute('data-repv-card')) row.removeAttribute('data-repv-card'); continue; }
      themes.set(r.theme.id, r.theme);
      if (row.getAttribute('data-repv-card') !== r.theme.id) row.setAttribute('data-repv-card', r.theme.id);
      const inline = getComputedStyle(row).display === 'inline';
      if (inline !== row.hasAttribute('data-repv-card-inline')) row.toggleAttribute('data-repv-card-inline', inline);
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
    lastReduced = reducedNow();
    const resolution = C.themeResolution(config, location.href);
    if (!activePreview && resolution.source === 'auto' && !resolution.persisted && resolution.repository) persistAutoAssignment(resolution.repository.key);
    const theme = activePreview || resolution.theme;
    lastTheme = theme;
    lastMode = themeMode(theme);
    const root = document.documentElement;
    if (!root) return;
    let style = document.getElementById(STYLE_ID);
    if (!theme) {
      root.classList.remove('repv-active', 'repv-scene-window', 'repv-scene-compact', 'repv-scene-tall', 'repv-open', ...MOTION_CLASSES);
      removeDepth(); setHeartbeat(false);
      registerInstance(false);
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
    registerInstance(true);
    lastMotion = applyMotion(root, theme, Boolean(url));
    const wantWindow = Boolean(url) && config.sceneWindow && Boolean(resolution.repository) && !activePreview?.noWindow;
    if (root.classList.contains('repv-scene-window') !== wantWindow) root.classList.toggle('repv-scene-window', wantWindow);
    if (wantWindow) lastMotion = `${lastMotion} repv-scene-window`.trim();
    const wantOpen = Boolean(url) && config.readingBacking === 'text';
    if (root.classList.contains('repv-open') !== wantOpen) { root.classList.toggle('repv-open', wantOpen); clearPanels(); } // frames vs panels depend on the reading mode: classify again
    for (const h of ['compact', 'tall']) if (root.classList.contains(`repv-scene-${h}`) !== (wantWindow && config.sceneHeight === h)) root.classList.toggle(`repv-scene-${h}`, wantWindow && config.sceneHeight === h);
    renderDepth(theme, resolution.repository ? url : null); // one depth scene, repository pages only (never on Home)
    setHeartbeat(Boolean(url));
    applyColorMode(root, lastMode);
    if (url) queuePanelScan(); else clearPanels();
    renderCards();
  }
  // GitHub navigations can swap <head> or reset <html> attributes; restore our state if lost.
  /* Reduced motion is applied from the media query's `change` event, but an event is not a guarantee (it is delivered with a
     rendering update): the state each render was made for is remembered and reconciled on every DOM mutation and on a 1 s
     heartbeat while a scene is active, so a missed event can never leave motion running (or stopped) against the setting. */
  let lastReduced = null, heartbeat = 0;
  const reducedNow = () => Boolean(reducedQuery?.matches);
  function reconcileMotion() { if (!tornDown && lastTheme && lastReduced !== null && lastReduced !== reducedNow()) render(); }
  function setHeartbeat(on) {
    if (on && !heartbeat) heartbeat = setInterval(guard(reconcileMotion), 1000);
    else if (!on && heartbeat) { clearInterval(heartbeat); heartbeat = 0; }
  }
  function ensureApplied() {
    const root = document.documentElement;
    if (!lastTheme || !root) return;
    if (lastReduced !== null && lastReduced !== reducedNow()) { render(); return; }
    if (!document.getElementById(STYLE_ID) || !root.classList.contains('repv-active') || (lastWallpaperUrl && !document.getElementById(WALLPAPER_STYLE_ID))
      || lastMotion.split(' ').some(c => c && !root.classList.contains(c)) || (depthState.key && !document.getElementById(DEPTH_ID))) render();
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
    removeDepth(); setHeartbeat(false);
    registerInstance(false);
    reducedQuery?.removeEventListener?.('change', onReducedMotionChange);
    if (document.documentElement) { document.documentElement.classList.remove('repv-active', 'repv-scene-window', 'repv-scene-compact', 'repv-scene-tall', 'repv-open', ...MOTION_CLASSES); applyColorMode(document.documentElement, null); }
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
      sendResponse({href: location.href, repository: C.repositoryFromUrl(location.href), diagnostics: diagnostics()});
    }
  });
  /* Diagnostics for the popup/Studio: what is ACTUALLY running on this page (not what settings say). */
  const INSTANCE_ATTR = 'data-repv-instances';
  // Present only while this copy is styling the page (removed when inactive/disabled, so restoration leaves no trace).
  let warnedDuplicate = false;
  function registerInstance(active) {
    const root = document.documentElement; if (!root) return;
    const ids = new Set((root.getAttribute(INSTANCE_ATTR) || '').split(' ').filter(Boolean));
    let id; try { id = chrome.runtime.id; } catch (_) { id = null; }
    if (active && id) ids.add(id); else if (id) ids.delete(id);
    const next = [...ids].join(' ');
    if (next) { if (root.getAttribute(INSTANCE_ATTR) !== next) root.setAttribute(INSTANCE_ATTR, next); } else root.removeAttribute(INSTANCE_ATTR);
    if (ids.size > 1 && !warnedDuplicate && (warnedDuplicate = true)) console.warn('[RepoVibe] More than one RepoVibe installation is active on this page:', [...ids].join(', '), '— disable older copies in chrome://extensions.');
  }
  function diagnostics() {
    const root = document.documentElement, cs = getComputedStyle(root);
    const panels = [...document.querySelectorAll('[data-repv-panel], .Box, header.GlobalNav, .AppHeader')].slice(0, 200);
    const blurs = panels.map(el => getComputedStyle(el).backdropFilter).filter(b => b && b !== 'none');
    const instances = (root.getAttribute(INSTANCE_ATTR) || '').split(' ').filter(Boolean);
    const t = lastTheme ? C.normalizeTheme(lastTheme) : null;
    return {
      version: chrome.runtime.getManifest().version, extensionId: chrome.runtime.id, instances, duplicate: instances.length > 1,
      active: root.classList.contains('repv-active'), stylesheet: (document.getElementById(STYLE_ID)?.textContent || '').length,
      appearance: config.appearance, sceneWindow: root.classList.contains('repv-scene-window'), readingBacking: root.classList.contains('repv-open') ? 'text' : 'panels',
      theme: t && { id: t.id, name: t.name, wallpaperBlur: t.wallpaperBlur, panelBlur: t.glass, overlay: t.wallpaperOverlay, brightness: t.wallpaperBrightness, opacity: t.wallpaperOpacity, panelOpacityChosen: t.glassOpacity },
      panelOpacityRendered: Number(cs.getPropertyValue('--repv-panel-opacity')) || null,
      panelsWithBackdropBlur: blurs.length, panelsDetected: document.querySelectorAll('[data-repv-panel]').length,
      wallpaperOnRoot: /url\(/.test(cs.backgroundImage),
      homeCards: cardDiag,
      depth: (() => { const el = document.getElementById(DEPTH_ID); return el ? { scene: el.dataset.scene, mode: el.dataset.mode, layers: [...el.children].map(c => c.dataset.l).filter(Boolean), quality: config.depthQuality, lite: document.documentElement.classList.contains('repv-depth-lite'), minimal: document.documentElement.classList.contains('repv-depth-minimal'), measuredFps: depthState.fps, autoDecisions: depthState.decisions } : null; })()
    };
  }

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
