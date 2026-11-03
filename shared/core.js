/* RepoVibe shared, dependency-free data/validation layer.
   Loaded in both extension pages and the isolated GitHub content-script world. */
(function (root) {
  'use strict';
  const STORAGE_KEY = 'repovibe.v1';
  const HEX = /^#[0-9a-fA-F]{6}$/;
  const MAX_WALLPAPER_LENGTH = 1050000;
  const MAX_CUSTOM_THEMES = 80;
  const FONT_VALUES = ['system', 'rounded', 'serif', 'mono'];
  const LAYOUTS = ['standard', 'wide', 'compact'];
  const RESERVED = new Set(['about', 'account', 'apps', 'blog', 'codespaces', 'collections', 'contact', 'dashboard', 'enterprise', 'events', 'explore', 'features', 'gist', 'issues', 'join', 'login', 'logout', 'marketplace', 'new', 'notifications', 'organizations', 'orgs', 'pricing', 'pulls', 'search', 'security', 'settings', 'site', 'sponsors', 'stars', 'topics', 'trending', 'users']);
  const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
  const ROWS = [
    // name, tagline, primary background, panel, brighter panel, foreground, muted, accent, border, gradient 2, gradient 3, code, vibe
    ['Cyberpunk Neon', 'Electric after dark', '#100c25', '#1b1538', '#292044', '#f3edff', '#aaa0cc', '#a879ff', '#49337e', '#25104c', '#051f31', '#15122a', 'neon'],
    ['Midnight Developer', 'Deep focus', '#0b1220', '#151e30', '#1e2b40', '#ebf1ff', '#9aabc6', '#6eacff', '#34445e', '#132b47', '#0b1828', '#101c30', 'minimal'],
    ['Sakura Dreams', 'Soft blossom light', '#fff1f6', '#fff8fb', '#ffe7ef', '#4b2540', '#7a5669', '#a8366d', '#e9bed3', '#ffe2f0', '#f8e9ff', '#fff0f8', 'soft'],
    ['Cozy Coding', 'Warm and familiar', '#241c1b', '#342926', '#47352e', '#fff1dc', '#c4a998', '#f1ac72', '#725345', '#4a2e24', '#261d2b', '#28201f', 'soft'],
    ['Matrix', 'Into the source', '#071008', '#0d1c10', '#15291a', '#b9f9bd', '#76aa7c', '#4ad66d', '#265637', '#081e0f', '#04110b', '#0a160c', 'neon'],
    ['Dracula', 'Legendary dark', '#191a2a', '#292a40', '#343650', '#f6f5ff', '#b3b2cd', '#bd93f9', '#55506c', '#34233c', '#1b2640', '#202134', 'soft'],
    ['Ocean Depths', 'Below the surface', '#061b2c', '#0d2a40', '#163954', '#e7f8ff', '#9fc4d2', '#46c6ee', '#315870', '#08324d', '#082333', '#09283b', 'glass'],
    ['Forest Retreat', 'Natural focus', '#14221c', '#21362a', '#2c4435', '#eaf8e8', '#acc4b1', '#86cd8c', '#42634b', '#233f25', '#13291f', '#1b2e23', 'soft'],
    ['Retro Terminal', 'Back to basics', '#171911', '#23291a', '#313928', '#f1f3c9', '#a8b28a', '#bdd774', '#5c6440', '#313019', '#181e16', '#1c2119', 'pixel'],
    ['Pixel Paradise', '8-bit nostalgia', '#211a41', '#302959', '#40356c', '#fbf3ff', '#beb1de', '#ff9bd5', '#7350a0', '#33216b', '#14304f', '#29234b', 'pixel'],
    ['Solar Flare', 'A spark of energy', '#291913', '#422617', '#5c331c', '#fff1dd', '#d9b297', '#ffad54', '#885337', '#5a2918', '#2b1b19', '#341f19', 'neon'],
    ['Arctic Frost', 'Cool clarity', '#eaf5fc', '#fbfdff', '#deecf6', '#213952', '#4b6178', '#2a5f9e', '#bfd7e8', '#e1f5ff', '#d6e4ff', '#f2f8fd', 'glass'],
    ['Lavender Nights', 'A gentle glow', '#1e1837', '#2c2448', '#3a305c', '#f8efff', '#b9abcd', '#d0a6ff', '#5b4d78', '#392252', '#221a43', '#29203f', 'soft'],
    ['Dark Academia', 'Timeless and thoughtful', '#241d19', '#362b23', '#45362b', '#f2e8d3', '#bcb09b', '#d4b47d', '#69513a', '#30221a', '#221a17', '#2e251e', 'minimal'],
    ['Minimal White', 'Nothing but the work', '#f6f7f9', '#ffffff', '#f1f3f6', '#202631', '#5b6470', '#3454c4', '#dce0e7', '#f8fafc', '#eef1f7', '#fafbfe', 'minimal'],
    ['Obsidian', 'Pure concentration', '#0d0e11', '#18191e', '#202228', '#f4f4f7', '#a1a1ad', '#a5a9bd', '#3b3e48', '#15161a', '#0d0e11', '#17181c', 'minimal'],
    ['Aurora', 'Northern lights', '#0c1724', '#122b34', '#1b3b45', '#e8fff8', '#9dcbc6', '#7eedd7', '#355d5c', '#113b4b', '#2d2557', '#142633', 'glass'],
    ['Sunset Boulevard', 'Golden hour', '#301b32', '#4c294a', '#60375b', '#fff1f1', '#d5b0c7', '#ff9d82', '#7d4d73', '#9a4d61', '#442b6e', '#3c2540', 'soft'],
    ['Galaxy', 'Somewhere in space', '#0b0b25', '#17183d', '#24244e', '#f0edff', '#a5a6d3', '#979bff', '#464784', '#251d53', '#102c4b', '#141433', 'glass'],
    ['Synthwave', 'Night drive', '#210c37', '#33194a', '#462359', '#fff1ff', '#c9a1df', '#ff65c3', '#76438d', '#551b6c', '#102e5d', '#2b1342', 'neon']
  ];
  const PRESETS = ROWS.map((row, index) => ({
    id: `preset-${index + 1}`,
    name: row[0], description: row[1],
    bg: row[2], surface: row[3], surface2: row[4], text: row[5], muted: row[6], accent: row[7], border: row[8],
    gradientTo: row[9], gradientThird: row[10], codeBg: row[11], vibe: row[12],
    radius: row[12] === 'pixel' ? 3 : row[12] === 'minimal' ? 8 : 16,
    glass: row[12] === 'glass' ? 18 : 0,
    glassOpacity: row[12] === 'glass' ? 82 : 100,
    gradientAngle: 135,
    backgroundMode: 'gradient',
    wallpaper: '',
    wallpaperOpacity: 65,
    wallpaperBlur: 0,
    font: row[12] === 'pixel' ? 'mono' : 'system',
    codeFontSize: 13,
    layout: 'standard'
  }));
  const DEFAULT = {
    version: 1, enabled: true, defaultThemeId: 'native',
    repoAssignments: {}, ownerAssignments: {}, customThemes: {}
  };
  const colorKeys = ['bg', 'surface', 'surface2', 'text', 'muted', 'accent', 'border', 'gradientTo', 'gradientThird', 'codeBg'];
  const own = (obj, key) => obj != null && typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
  function relativeLuminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [16, 8, 0].map(shift => {
      const c = ((n >> shift) & 255) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  }
  function contrastRatio(a, b) {
    const x = relativeLuminance(a), y = relativeLuminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function isLightColor(hex) { return HEX.test(hex || '') && relativeLuminance(hex) > 0.4; }
  function safeString(value, max = 100) {
    return typeof value === 'string' ? value.slice(0, max).replace(/[<>\u0000-\u001f]/g, '') : '';
  }
  function clamp(value, low, high, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? Math.max(low, Math.min(high, num)) : fallback;
  }
  function safeWallpaper(value) {
    return typeof value === 'string' && value.length <= MAX_WALLPAPER_LENGTH && /^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(value) ? value : '';
  }
  function normalizeTheme(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Theme must be an object.');
    const base = PRESETS[1];
    const theme = {
      id: /^[-a-zA-Z0-9_]{1,90}$/.test(input.id || '') ? input.id : `custom-${Date.now()}`,
      name: safeString(input.name || 'My theme', 60),
      description: safeString(input.description || 'Custom RepoVibe theme', 120),
      vibe: ['soft', 'neon', 'minimal', 'glass', 'pixel'].includes(input.vibe) ? input.vibe : 'soft'
    };
    for (const key of colorKeys) theme[key] = HEX.test(input[key] || '') ? input[key] : base[key];
    theme.radius = clamp(input.radius, 0, 28, 14);
    theme.glass = clamp(input.glass, 0, 30, 0);
    theme.glassOpacity = clamp(input.glassOpacity, 55, 100, 100);
    theme.gradientAngle = clamp(input.gradientAngle, 0, 360, 135);
    theme.backgroundMode = ['solid', 'gradient', 'image'].includes(input.backgroundMode) ? input.backgroundMode : 'gradient';
    theme.wallpaper = safeWallpaper(input.wallpaper);
    if (theme.backgroundMode === 'image' && !theme.wallpaper) theme.backgroundMode = 'gradient';
    theme.wallpaperOpacity = clamp(input.wallpaperOpacity, 15, 100, 65);
    theme.wallpaperBlur = clamp(input.wallpaperBlur, 0, 20, 0);
    theme.font = FONT_VALUES.includes(input.font) ? input.font : 'system';
    theme.codeFontSize = clamp(input.codeFontSize, 11, 20, 13);
    theme.layout = LAYOUTS.includes(input.layout) ? input.layout : 'standard';
    return theme;
  }
  function normalizeConfig(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return structuredClone(DEFAULT);
    const config = structuredClone(DEFAULT);
    config.enabled = raw.enabled !== false;
    config.defaultThemeId = typeof raw.defaultThemeId === 'string' && raw.defaultThemeId.length <= 90 ? raw.defaultThemeId : 'native';
    for (const type of ['repoAssignments', 'ownerAssignments']) {
      if (!raw[type] || typeof raw[type] !== 'object') continue;
      for (const [key, value] of Object.entries(raw[type])) {
        if (/^[a-zA-Z0-9_.-]{1,100}(?:\/[a-zA-Z0-9_.-]{1,100})?$/.test(key) && !UNSAFE_KEYS.has(key.toLowerCase()) && typeof value === 'string' && value.length <= 90) {
          config[type][key.toLowerCase()] = value;
        }
      }
    }
    if (raw.customThemes && typeof raw.customThemes === 'object') {
      for (const [id, theme] of Object.entries(raw.customThemes).slice(0, MAX_CUSTOM_THEMES)) {
        if (id.startsWith('custom-') && /^[-a-zA-Z0-9_]{1,90}$/.test(id)) {
          try { config.customThemes[id] = normalizeTheme({...theme, id}); } catch (_) { /* Ignore invalid entry */ }
        }
      }
    }
    return config;
  }
  function repositoryFromUrl(href) {
    let u;
    try { u = new URL(href); } catch (_) { return null; }
    if (u.hostname.toLowerCase() !== 'github.com') return null;
    const segments = u.pathname.split('/').filter(Boolean);
    if (segments.length < 2 || RESERVED.has(segments[0].toLowerCase())) return null;
    if (!/^[\w.-]+$/.test(segments[0]) || !/^[\w.-]+$/.test(segments[1])) return null;
    return { owner: segments[0].toLowerCase(), repo: segments[1].toLowerCase(), key: `${segments[0]}/${segments[1]}`.toLowerCase(), label: `${segments[0]}/${segments[1]}` };
  }
  function themeById(config, id) {
    if (typeof id !== 'string' || id === 'native') return null;
    return own(config.customThemes, id) || PRESETS.find(t => t.id === id) || null;
  }
  function themeResolution(config, href) {
    if (!config.enabled) return { theme: null, scope: 'disabled', repository: repositoryFromUrl(href) };
    const repo = repositoryFromUrl(href);
    let scope = 'global';
    let id = config.defaultThemeId;
    if (repo && own(config.ownerAssignments, repo.owner)) { id = own(config.ownerAssignments, repo.owner); scope = 'owner'; }
    if (repo && own(config.repoAssignments, repo.key)) { id = own(config.repoAssignments, repo.key); scope = 'repository'; }
    return { theme: themeById(config, id), scope, repository: repo, id };
  }
  async function loadConfig() {
    const obj = await chrome.storage.local.get(STORAGE_KEY);
    return normalizeConfig(obj[STORAGE_KEY]);
  }
  async function saveConfig(config) {
    if (config && config.customThemes && Object.keys(config.customThemes).length > MAX_CUSTOM_THEMES) {
      throw new Error(`Your theme library is full (${MAX_CUSTOM_THEMES} themes). Nothing was saved.`);
    }
    const safe = normalizeConfig(config);
    try { await chrome.storage.local.set({ [STORAGE_KEY]: safe }); }
    catch (e) {
      if (/quota/i.test(String(e && e.message))) throw new Error('Extension storage is full (wallpapers use most of it). Remove a wallpaper or custom theme. Nothing was saved.');
      throw e;
    }
    return safe;
  }
  // Read-modify-write against the latest stored config so concurrent extension pages (popup, Studio,
  // multiple Studio tabs) do not overwrite each other's changes with a stale in-memory copy.
  // Writes are serialized within a page.
  let writeQueue = Promise.resolve();
  function updateConfig(mutator) {
    const run = writeQueue.then(async () => {
      const latest = await loadConfig();
      const result = mutator(latest);
      return saveConfig(result === undefined ? latest : result);
    });
    writeQueue = run.catch(() => {});
    return run;
  }
  function themeUsage(config, id) {
    const uses = [];
    if (config.defaultThemeId === id) uses.push({scope:'global', key:''});
    for (const [key, value] of Object.entries(config.ownerAssignments)) if (value === id) uses.push({scope:'owner', key});
    for (const [key, value] of Object.entries(config.repoAssignments)) if (value === id) uses.push({scope:'repository', key});
    return uses;
  }
  function assignTheme(config, scope, repo, themeId) {
    if (scope === 'repository') {
      if (!repo) throw new Error('Open a repository to use a repository-specific theme.');
      config.repoAssignments[repo.key] = themeId;
    } else if (scope === 'owner') {
      if (!repo) throw new Error('Open a repository to use an owner-specific theme.');
      config.ownerAssignments[repo.owner] = themeId;
    } else config.defaultThemeId = themeId;
    return config;
  }
  function isPreset(id) { return PRESETS.some(theme => theme.id === id); }
  root.RepoVibeCore = Object.freeze({
    STORAGE_KEY, PRESETS, DEFAULT, MAX_CUSTOM_THEMES, normalizeConfig, normalizeTheme, safeWallpaper,
    repositoryFromUrl, themeById, themeResolution, loadConfig, saveConfig, updateConfig, themeUsage, assignTheme, isPreset,
    contrastRatio, isLightColor
  });
})(globalThis);
