/* GitHub-only isolated content script. All effects are CSS; no GitHub requests or file changes. */
(() => {
  'use strict';
  const C = globalThis.RepoVibeCore;
  const STYLE_ID = 'repovibe-style-v1';
  let config = C.normalizeConfig(null);
  let activePreview = null;
  let currentHref = location.href;
  let requestedId = 0;
  let configChanges = 0;

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

  function buildCss(t) {
    const v = C.normalizeTheme(t);
    const light = C.isLightColor(v.bg);
    const bg = v.backgroundMode === 'solid' ? v.bg : `linear-gradient(${v.gradientAngle}deg, ${v.bg} 0%, ${v.gradientTo} 58%, ${v.gradientThird} 100%)`;
    const image = v.backgroundMode === 'image' && v.wallpaper ? `url("${v.wallpaper}")` : 'none';
    const compact = v.layout === 'compact';
    const panel = rgba(v.surface, v.glassOpacity / 100);
    // Whitelist only constrained colors, numbers, enum values and validated PNG/JPEG/WebP data URLs.
    // Note: --bgColor-emphasis is GitHub's *neutral* emphasis (tooltips, counters) paired with white
    // --fgColor-onEmphasis text, so it is intentionally not overridden with the accent.
    return `
html.repv-active { --bgColor-default:${v.surface} !important; --bgColor-muted:${v.surface2} !important;
 --bgColor-inset:${v.codeBg} !important;
 --fgColor-default:${v.text} !important; --fgColor-muted:${v.muted} !important;
 --fgColor-accent:${v.accent} !important; --fgColor-link:${v.accent} !important;
 --borderColor-default:${v.border} !important; --borderColor-muted:${v.border} !important;
 --overlay-bgColor:${v.surface} !important; --overlay-borderColor:${v.border} !important;
 --underlineNav-borderColor-active:${v.accent} !important; --focus-outlineColor:${v.accent} !important;
 --button-default-bgColor-rest:${v.surface2} !important;
 --button-default-fgColor-rest:${v.text} !important;
 --button-default-borderColor-rest:${v.border} !important;
 --control-borderColor-rest:${v.border} !important;
 --color-canvas-default:${v.surface} !important; --color-canvas-subtle:${v.surface2} !important;
 --color-canvas-inset:${v.codeBg} !important; --color-fg-default:${v.text} !important;
 --color-fg-muted:${v.muted} !important; --color-accent-fg:${v.accent} !important;
 --color-border-default:${v.border} !important;
 --repv-bg:${v.bg}; --repv-panel:${v.surface}; --repv-panel2:${v.surface2};
 --repv-text:${v.text}; --repv-muted:${v.muted}; --repv-accent:${v.accent}; --repv-border:${v.border};
 --repv-radius:${v.radius}px; --repv-blur:${v.glass}px;
 --repv-panel-opacity:${v.glassOpacity / 100}; background:${bg} fixed !important; color-scheme:${light ? 'light' : 'dark'}; }
html.repv-active body { background:transparent !important; color:var(--repv-text) !important; font-family:${cssFont(v.font)} !important; }
html.repv-active body::before { content:""; position:fixed; inset:${v.wallpaperBlur ? `-${v.wallpaperBlur * 2}px` : '0'}; z-index:-1; pointer-events:none;
 background-image:${image}; background-position:center; background-size:cover; background-repeat:no-repeat;
 opacity:${v.wallpaperOpacity / 100}; filter:blur(${v.wallpaperBlur}px); }
html.repv-active :is(.AppHeader, .Header, #repository-container-header, .UnderlineNav, .js-header-wrapper) {
 background-color:${panel} !important; color:${v.text} !important; border-color:${v.border} !important; }
html.repv-active :is(.Box, .Box-row, .markdown-body, .Layout-sidebar .BorderGrid, .react-directory-row,
 .react-code-view-bottom-padding, .react-code-lines, .blob-wrapper, .file, .commit-tease,
 .js-navigation-container, .repository-content .container-lg, [data-testid="code-viewer"])
 { background-color:${panel} !important; color:${v.text} !important; border-color:${v.border} !important; }
html.repv-active :is(.Box, .markdown-body, .Layout-sidebar .BorderGrid, .blob-wrapper, .file) {
 border-radius:var(--repv-radius) !important; }
html.repv-active :is(.btn, .Button, button:not([class]), input[type="text"], input[type="search"], textarea) {
 border-radius:calc(var(--repv-radius) * .65) !important; }
html.repv-active :is(.btn, .Button, .form-control, .FormControl-input, .form-select) {
 border-color:${v.border} !important; }
html.repv-active :is(.color-fg-muted, .text-color-muted, .fgColor-muted) { color:${v.muted} !important; }
html.repv-active :is(.markdown-body pre, .highlight pre, .blob-code, .react-code-text, .react-code-line, .diff-table) {
 background-color:${v.codeBg} !important; }
html.repv-active :is(.blob-code, .react-code-text, .react-code-line, .markdown-body pre code, .highlight pre, .diff-table,
 #read-only-cursor-text-area, [data-testid="read-only-cursor-text-area"]) {
 font-family:ui-monospace, SFMono-Regular, Consolas, monospace !important; font-size:${v.codeFontSize}px !important; }
html.repv-active :is(.Box, .markdown-body, .Layout-sidebar .BorderGrid) {
 backdrop-filter:blur(var(--repv-blur)); }
${v.layout === 'wide' ? `html.repv-active :is(.container-xl, .container-lg) { max-width:1800px !important; }` : ''}
${compact ? `html.repv-active :is(.Box-row, .react-directory-row) {padding-top:5px !important;padding-bottom:5px !important;}
html.repv-active .Layout {gap:12px !important;}` : ''}
@media (prefers-reduced-motion:no-preference) {
 html.repv-active :is(.Box, .btn, .Button) { transition:border-color .18s ease, box-shadow .18s ease; }
 ${v.vibe === 'neon' ? `html.repv-active :is(.Box:hover, .Button:hover) { box-shadow:0 0 14px ${v.accent}45; }` : ''}
}
`;
  }

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

  let lastTheme = null;
  let lastMode = null;
  function render() {
    const theme = activePreview || C.themeResolution(config, location.href).theme;
    lastTheme = theme;
    lastMode = themeMode(theme);
    const root = document.documentElement;
    if (!root) return;
    let style = document.getElementById(STYLE_ID);
    if (!theme) {
      root.classList.remove('repv-active');
      if (style) style.remove();
      applyColorMode(root, null);
      return;
    }
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || root).appendChild(style);
    }
    const css = buildCss(theme);
    if (style.textContent !== css) style.textContent = css;
    root.classList.add('repv-active');
    applyColorMode(root, lastMode);
  }
  // GitHub navigations can swap <head> or reset <html> attributes; restore our state if lost.
  function ensureApplied() {
    const root = document.documentElement;
    if (!lastTheme || !root) return;
    if (!document.getElementById(STYLE_ID) || !root.classList.contains('repv-active')) render();
    else applyColorMode(root, lastMode);
  }

  // After the extension is reloaded, updated, disabled or removed, this script is orphaned: chrome.*
  // calls throw and no new script replaces it. Stop observing and restore GitHub's own appearance.
  let tornDown = false;
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
    if (document.documentElement) { document.documentElement.classList.remove('repv-active'); applyColorMode(document.documentElement, null); }
  }
  function guard(fn) {
    return (...args) => { if (tornDown) return; if (!extensionAlive()) { teardown(); return; } fn(...args); };
  }
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
  // URL fallback for GitHub SPA navigation that does not fire a standard event.
  // The observer only checks the URL; it does not restyle per DOM mutation.
  let scheduled = false;
  const observer = new MutationObserver(guard(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; if (!tornDown) { updateForNavigation(); ensureApplied(); } });
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
