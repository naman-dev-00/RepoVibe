/* GitHub-only isolated content script. All effects are CSS; no GitHub requests or file changes. */
(() => {
  'use strict';
  const C = globalThis.RepoVibeCore;
  const STYLE_ID = 'repovibe-style-v1';
  let config = C.normalizeConfig(null);
  let activePreview = null;
  let currentHref = location.href;
  let requestedId = 0;

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
    const bg = v.backgroundMode === 'solid' ? v.bg : `linear-gradient(${v.gradientAngle}deg, ${v.bg} 0%, ${v.gradientTo} 58%, ${v.gradientThird} 100%)`;
    const image = v.backgroundMode === 'image' && v.wallpaper ? `url("${v.wallpaper}")` : 'none';
    const wide = v.layout === 'wide' ? 'min(98vw, 1800px)' : 'none';
    const compact = v.layout === 'compact';
    const panel = rgba(v.surface, v.glassOpacity / 100);
    // Whitelist only constrained colors, numbers, enum values and validated PNG/JPEG/WebP data URLs.
    return `
html.repv-active { --bgColor-default:${v.surface} !important; --bgColor-muted:${v.surface2} !important;
 --bgColor-inset:${v.codeBg} !important; --bgColor-emphasis:${v.accent} !important;
 --fgColor-default:${v.text} !important; --fgColor-muted:${v.muted} !important;
 --fgColor-accent:${v.accent} !important; --borderColor-default:${v.border} !important;
 --button-default-bgColor-rest:${v.surface2} !important;
 --button-default-fgColor-rest:${v.text} !important;
 --button-default-borderColor-rest:${v.border} !important;
 --control-borderColor-rest:${v.border} !important;
 --repv-bg:${v.bg}; --repv-panel:${v.surface}; --repv-panel2:${v.surface2};
 --repv-text:${v.text}; --repv-muted:${v.muted}; --repv-accent:${v.accent}; --repv-border:${v.border};
 --repv-radius:${v.radius}px; --repv-blur:${v.glass}px;
 --repv-panel-opacity:${v.glassOpacity / 100}; background:${bg} fixed !important; color-scheme:${['#fff', '#f6'].some(x => v.bg.toLowerCase().startsWith(x)) ? 'light' : 'dark'}; }
html.repv-active body { background:transparent !important; color:var(--repv-text) !important; font-family:${cssFont(v.font)} !important; }
html.repv-active body::before { content:""; position:fixed; inset:0; z-index:-1; pointer-events:none;
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
html.repv-active :is(a:not(.btn), .Link--primary:hover, .Link--secondary:hover) { --fgColor-accent:${v.accent}; }
html.repv-active :is(.markdown-body pre, .highlight pre, .blob-code, .react-code-text, .react-code-line, .diff-table) {
 background-color:${v.codeBg} !important; }
html.repv-active :is(.blob-code, .react-code-text, .react-code-line, .markdown-body pre code, .highlight pre, .diff-table) {
 font-family:ui-monospace, SFMono-Regular, Consolas, monospace !important; font-size:${v.codeFontSize}px !important; }
html.repv-active :is(.Box, .markdown-body, .Layout-sidebar .BorderGrid) {
 backdrop-filter:blur(var(--repv-blur)); }
html.repv-active :is(.Layout, .container-xl, .container-lg) { max-width:${wide} !important; }
${compact ? `html.repv-active :is(.Box-row, .react-directory-row) {padding-top:5px !important;padding-bottom:5px !important;}
html.repv-active .Layout {gap:12px !important;}` : ''}
@media (prefers-reduced-motion:no-preference) {
 html.repv-active :is(.Box, .btn, .Button) { transition:border-color .18s ease, box-shadow .18s ease; }
 ${v.vibe === 'neon' ? `html.repv-active :is(.Box:hover, .Button:hover) { box-shadow:0 0 14px ${v.accent}45; }` : ''}
}
`;
  }

  function render() {
    const theme = activePreview || C.themeResolution(config, location.href).theme;
    const root = document.documentElement;
    if (!root) return;
    let style = document.getElementById(STYLE_ID);
    if (!theme) {
      root.classList.remove('repv-active');
      if (style) style.remove();
      return;
    }
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || root).appendChild(style);
    }
    style.textContent = buildCss(theme);
    root.classList.add('repv-active');
  }

  function updateForNavigation() {
    if (location.href === currentHref) return;
    currentHref = location.href;
    activePreview = null;
    render();
  }
  function onNavigation() { queueMicrotask(updateForNavigation); }
  document.addEventListener('turbo:load', onNavigation);
  document.addEventListener('turbo:render', onNavigation);
  document.addEventListener('pjax:end', onNavigation);
  window.addEventListener('popstate', onNavigation);
  window.addEventListener('pageshow', onNavigation);
  // URL fallback for GitHub SPA navigation that does not fire a standard event.
  // The observer only checks the URL; it does not restyle per DOM mutation.
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; updateForNavigation(); });
  });
  const startObserver = () => {
    if (document.documentElement) observer.observe(document.documentElement, { childList:true, subtree:true });
  };
  if (document.documentElement) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, {once:true});

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[C.STORAGE_KEY]) return;
    config = C.normalizeConfig(changes[C.STORAGE_KEY].newValue);
    if (!activePreview) render();
  });
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
    try { const loaded = await C.loadConfig(); if (thisRequest === requestedId) config = loaded; }
    catch (e) { console.warn('[RepoVibe] Unable to load preferences', e); }
    render();
  }
  init();
})();
