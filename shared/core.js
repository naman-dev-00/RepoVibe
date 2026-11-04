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
    ['Cyberpunk Neon', 'Neon rain canyon', '#100c25', '#1b1538', '#292044', '#f3edff', '#c4bbe3', '#c6a8ff', '#49337e', '#25104c', '#051f31', '#15122a', 'neon'],
    ['Midnight Developer', 'Deep focus', '#0b1220', '#151e30', '#1e2b40', '#ebf1ff', '#9aabc6', '#6eacff', '#34445e', '#132b47', '#0b1828', '#101c30', 'minimal'],
    ['Sakura Dreams', 'Soft blossom light', '#fff1f6', '#fff8fb', '#ffe7ef', '#4b2540', '#7a5669', '#a8366d', '#e9bed3', '#ffe2f0', '#f8e9ff', '#fff0f8', 'soft'],
    ['Cozy Coding', 'Warm and familiar', '#241c1b', '#342926', '#47352e', '#fff1dc', '#c4a998', '#f1ac72', '#725345', '#4a2e24', '#261d2b', '#28201f', 'soft'],
    ['Matrix', 'Into the source', '#071008', '#0d1c10', '#15291a', '#b9f9bd', '#76aa7c', '#4ad66d', '#265637', '#081e0f', '#04110b', '#0a160c', 'neon'],
    ['Dracula', 'Legendary dark', '#191a2a', '#292a40', '#343650', '#f6f5ff', '#b3b2cd', '#bd93f9', '#55506c', '#34233c', '#1b2640', '#202134', 'soft'],
    ['Ocean Depths', 'Twilight swell', '#061b2c', '#0d2a40', '#163954', '#e7f8ff', '#9fc4d2', '#46c6ee', '#315870', '#08324d', '#082333', '#09283b', 'glass'],
    ['Enchanted Forest', 'Moonlit glade, fireflies', '#08181a', '#10272a', '#183436', '#e6fbf5', '#9cc7bd', '#5ee0c1', '#2c5753', '#0c3335', '#10263f', '#0d2123', 'glass'],
    ['Retro Terminal', 'Back to basics', '#171911', '#23291a', '#313928', '#f1f3c9', '#a8b28a', '#bdd774', '#5c6440', '#313019', '#181e16', '#1c2119', 'pixel'],
    ['Pixel Paradise', '8-bit nostalgia', '#211a41', '#302959', '#40356c', '#fbf3ff', '#beb1de', '#ff9bd5', '#7350a0', '#33216b', '#14304f', '#29234b', 'pixel'],
    ['Solar Flare', 'Dunes at dusk', '#291913', '#422617', '#5c331c', '#fff1dd', '#d9b297', '#ffad54', '#885337', '#5a2918', '#2b1b19', '#341f19', 'neon'],
    ['Arctic Frost', 'Alpine golden hour', '#eaf5fc', '#fbfdff', '#deecf6', '#213952', '#4b6178', '#2a5f9e', '#bfd7e8', '#e1f5ff', '#d6e4ff', '#f2f8fd', 'glass'],
    ['Lavender Nights', 'A gentle glow', '#1e1837', '#2c2448', '#3a305c', '#f8efff', '#b9abcd', '#d0a6ff', '#5b4d78', '#392252', '#221a43', '#29203f', 'soft'],
    ['Dark Academia', 'Timeless and thoughtful', '#241d19', '#362b23', '#45362b', '#f2e8d3', '#c9bea9', '#d4b47d', '#69513a', '#30221a', '#221a17', '#2e251e', 'minimal'],
    ['Futuristic Sci-Fi', 'Holographic AI core', '#08131d', '#0f1e2b', '#16293a', '#e8f7ff', '#a3c3d6', '#5fd4ff', '#2a4a60', '#0f3a52', '#122a44', '#0c1823', 'glass'],
    ['Obsidian', 'Pure concentration', '#0d0e11', '#18191e', '#202228', '#f4f4f7', '#a1a1ad', '#a5a9bd', '#3b3e48', '#15161a', '#0d0e11', '#17181c', 'minimal'],
    ['Aurora', 'Northern lights over a fjord', '#0c1724', '#122b34', '#1b3b45', '#e8fff8', '#9dcbc6', '#7eedd7', '#355d5c', '#113b4b', '#2d2557', '#142633', 'glass'],
    ['Sunset Boulevard', 'Golden hour', '#301b32', '#4c294a', '#60375b', '#fff1f1', '#d5b0c7', '#ff9d82', '#7d4d73', '#9a4d61', '#442b6e', '#3c2540', 'soft'],
    ['Cosmic Galaxy', 'Ringed giant, nebula, deep space', '#0b0b25', '#17183d', '#24244e', '#f0edff', '#c0c1e8', '#b9bcff', '#464784', '#251d53', '#102c4b', '#141433', 'glass'],
    ['Synthwave', 'Neon valley drive', '#210c37', '#33194a', '#462359', '#fff1ff', '#c9a1df', '#ff65c3', '#76438d', '#551b6c', '#102e5d', '#2b1342', 'neon']
  ];
  // Wallpaper catalogue generated from wallpapers/manifest.json (shared/wallpaper-catalog.js, loaded first).
  const CATALOG = root.RepoVibeWallpaperCatalog || [];
  const WORST_CASE_TONE = ['#ffffff', '#000000']; // unknown (uploaded) images
  const WALLPAPERS = CATALOG.map(w => ({ slug: w.slug, name: w.name, category: w.category, style: w.style,
    ref: `builtin:${w.slug}`, path: `wallpapers/${w.slug}.webp`, thumb: `wallpapers/thumbs/${w.slug}.webp`, tone: w.tone, toneSoft: w.toneSoft || w.tone,
    depth: (w.depth || []).map(l => ({ layer: l, path: `wallpapers/depth/${w.slug}/${l}.webp` })) }));
  const WALLPAPER_TONES = Object.fromEntries(WALLPAPERS.map(w => [w.slug, w.tone]));
  const WALLPAPER_TONES_SOFT = Object.fromEntries(WALLPAPERS.map(w => [w.slug, w.toneSoft]));
  // Preset N → wallpaper. 3D cinematic renders where available; the rest use the illustrated (2D) scenes.
  const PRESET_WALLPAPERS = ['neon-city-3d', 'midnight-skyline', 'sakura-street', 'cozy-room', 'digital-rain', 'gothic-castle',
    'ocean-twilight', 'enchanted-forest', 'pixel-dusk', 'pixel-island', 'desert-dunes', 'alpine-lake', 'lavender-fantasy',
    'academia-library', 'scifi-ai', 'obsidian-shards', 'aurora-fjord', 'sunset-village', 'cosmic-galaxy', 'synthwave-3d'];
  // Flagship themes and their live-wallpaper ambience (lightweight CSS motion layered over the art).
  const MOTIONS = ['none', 'rain', 'fireflies', 'stars', 'holo'];
  const FLAGSHIP_MOTION = { 'preset-1': 'rain', 'preset-8': 'fireflies', 'preset-19': 'stars', 'preset-15': 'holo' };
  const MOTION_MODES = ['static', 'ambient', 'cinematic'];
  const SCENE_HEIGHTS = ['compact', 'standard', 'tall'];
  const DEPTH_QUALITIES = ['auto', 'full', 'lite'];
  /* Appearance presets for the built-in themes (config.appearance). Each sets the six visual controls explicitly; they
     never change one another afterwards. Crisp Immersive is the default: sharp scene (no wallpaper blur, no panel
     backdrop blur, native brightness, minimal overlay) and clean, nearly solid reading panels. Balanced adds a subtle
     overlay and more solid panels. Frosted Glass is the opt-in glassmorphism style. Custom themes keep their own values. */
  const APPEARANCES = {
    crisp: { label: 'Crisp Immersive', dark: { wallpaperBlur: 0, glass: 0, wallpaperOpacity: 100, wallpaperBrightness: 100, wallpaperOverlay: 6, glassOpacity: 86 }, light: { wallpaperBlur: 0, glass: 0, wallpaperOpacity: 100, wallpaperBrightness: 100, wallpaperOverlay: 4, glassOpacity: 88 } },
    balanced: { label: 'Balanced', dark: { wallpaperBlur: 0, glass: 0, wallpaperOpacity: 100, wallpaperBrightness: 85, wallpaperOverlay: 32, glassOpacity: 96 }, light: { wallpaperBlur: 0, glass: 0, wallpaperOpacity: 100, wallpaperBrightness: 100, wallpaperOverlay: 26, glassOpacity: 96 } },
    frosted: { label: 'Frosted Glass', dark: { wallpaperBlur: 0, glass: 18, wallpaperOpacity: 100, wallpaperBrightness: 96, wallpaperOverlay: 10, glassOpacity: 52 }, light: { wallpaperBlur: 0, glass: 18, wallpaperOpacity: 100, wallpaperBrightness: 100, wallpaperOverlay: 6, glassOpacity: 58 } }
  };
  const VISUAL_FIELDS = ['wallpaperBlur', 'glass', 'wallpaperOpacity', 'wallpaperBrightness', 'wallpaperOverlay', 'glassOpacity'];
  function appearanceValues(name, theme) { const a = APPEARANCES[name] || APPEARANCES.crisp; return { ...(isLightHex(theme.bg) ? a.light : a.dark) }; }
  // Development/testing mappings seeded once (service worker, on install/update). They are ordinary manual
  // repository assignments afterwards: the user can change or remove them and they are never re-added.
  const DEFAULT_REPO_MAPPINGS = Object.freeze({
    'naman-dev-00/tradpro': 'preset-1',
    'naman-dev-00/repovibe': 'preset-8',
    'naman-dev-00/pool-souls': 'preset-19',
    'naman-dev-00/ai-powered-inbox-assistant': 'preset-15'
  });
  const WALLPAPER_SLUGS = new Set(WALLPAPERS.map(w => w.slug));
  const POSITIONS = ['center', 'top', 'bottom', 'left', 'right'];
  const SIZES = ['cover', 'contain'];
  function safeWallpaperRef(ref) {
    if (typeof ref !== 'string') return '';
    const builtin = /^builtin:([a-z0-9-]{1,40})$/.exec(ref);
    if (builtin) return WALLPAPER_SLUGS.has(builtin[1]) ? ref : '';
    return /^idb:[a-zA-Z0-9_-]{8,64}$/.test(ref) ? ref : '';
  }
  function isLightHex(h) { const n = parseInt(h.slice(1), 16); return ((n >> 16 & 255) * 0.299 + (n >> 8 & 255) * 0.587 + (n & 255) * 0.114) > 160; }

  const PRESETS = ROWS.map((row, index) => ({
    id: `preset-${index + 1}`,
    name: row[0], description: row[1],
    bg: row[2], surface: row[3], surface2: row[4], text: row[5], muted: row[6], accent: row[7], border: row[8],
    gradientTo: row[9], gradientThird: row[10], codeBg: row[11], vibe: row[12],
    radius: row[12] === 'pixel' ? 3 : row[12] === 'minimal' ? 8 : 16,
    glass: 0, // no panel backdrop blur by default (Crisp Immersive); Frosted Glass is an explicit choice
    glassOpacity: isLightHex(row[2]) ? 88 : 86, // clean, nearly solid reading surfaces; the scene stays sharp around them
    gradientAngle: 135,
    backgroundMode: 'image',
    wallpaper: '',
    wallpaperRef: `builtin:${PRESET_WALLPAPERS[index]}`,
    wallpaperStyle: (WALLPAPERS.find(w => w.slug === PRESET_WALLPAPERS[index]) || {}).style || 'illustrated',
    wallpaperOpacity: 100,
    wallpaperBlur: 0,
    wallpaperBrightness: 100, // native brightness: panels carry readability, the scene is not dimmed
    wallpaperOverlay: isLightHex(row[2]) ? 4 : 6,
    wallpaperPosition: 'center',
    wallpaperSize: 'cover',
    font: row[12] === 'pixel' ? 'mono' : 'system',
    codeFontSize: 13,
    layout: 'standard',
    flagship: Object.hasOwn(FLAGSHIP_MOTION, `preset-${index + 1}`),
    motion: FLAGSHIP_MOTION[`preset-${index + 1}`] || 'none'
  }));
  const CONFIG_VERSION = 2;
  const DEFAULT = {
    version: CONFIG_VERSION, enabled: true, defaultThemeId: 'native',
    autoAssign: true, autoAssignments: {}, motionMode: 'ambient', seededMappings: false, appearance: 'crisp', sceneWindow: true, sceneHeight: 'standard', depthEffects: true, depthQuality: 'auto', readingBacking: 'text',
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
    theme.glassOpacity = clamp(input.glassOpacity, 40, 100, 100);
    theme.gradientAngle = clamp(input.gradientAngle, 0, 360, 135);
    theme.backgroundMode = ['solid', 'gradient', 'image'].includes(input.backgroundMode) ? input.backgroundMode : 'gradient';
    theme.wallpaper = safeWallpaper(input.wallpaper); // legacy v1 inline data URL (migrated to IndexedDB by the service worker)
    theme.wallpaperRef = safeWallpaperRef(input.wallpaperRef);
    if (theme.backgroundMode === 'image' && !theme.wallpaper && !theme.wallpaperRef) theme.backgroundMode = 'gradient';
    theme.wallpaperOpacity = clamp(input.wallpaperOpacity, 15, 100, 100);
    theme.wallpaperBlur = clamp(input.wallpaperBlur, 0, 20, 0);
    theme.wallpaperBrightness = clamp(input.wallpaperBrightness, 40, 140, 100);
    theme.wallpaperOverlay = clamp(input.wallpaperOverlay, 0, 85, 25);
    theme.wallpaperPosition = POSITIONS.includes(input.wallpaperPosition) ? input.wallpaperPosition : 'center';
    theme.wallpaperSize = SIZES.includes(input.wallpaperSize) ? input.wallpaperSize : 'cover';
    theme.font = FONT_VALUES.includes(input.font) ? input.font : 'system';
    theme.codeFontSize = clamp(input.codeFontSize, 11, 20, 13);
    theme.layout = LAYOUTS.includes(input.layout) ? input.layout : 'standard';
    theme.motion = MOTIONS.includes(input.motion) ? input.motion : 'none';
    return theme;
  }
  function normalizeConfig(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return structuredClone(DEFAULT);
    const config = structuredClone(DEFAULT);
    config.enabled = raw.enabled !== false;
    config.defaultThemeId = typeof raw.defaultThemeId === 'string' && raw.defaultThemeId.length <= 90 ? raw.defaultThemeId : 'native';
    // v1 -> v2 migration: users who chose a shared global theme keep it (auto-assignment off);
    // everyone else gets automatic per-repository themes. v2 stores the user's explicit choice.
    config.autoAssign = raw.version >= 2 ? raw.autoAssign !== false : config.defaultThemeId === 'native';
    config.motionMode = MOTION_MODES.includes(raw.motionMode) ? raw.motionMode : 'ambient';
    config.appearance = Object.hasOwn(APPEARANCES, raw.appearance) ? raw.appearance : 'crisp';
    config.sceneWindow = raw.sceneWindow !== false;
    config.sceneHeight = SCENE_HEIGHTS.includes(raw.sceneHeight) ? raw.sceneHeight : 'standard';
    config.depthEffects = raw.depthEffects !== false;
    config.readingBacking = raw.readingBacking === 'panels' ? 'panels' : 'text';
    config.depthQuality = DEPTH_QUALITIES.includes(raw.depthQuality) ? raw.depthQuality : 'auto';
    config.seededMappings = raw.seededMappings === true;
    for (const type of ['repoAssignments', 'ownerAssignments', 'autoAssignments']) {
      if (!raw[type] || typeof raw[type] !== 'object') continue;
      for (const [key, value] of Object.entries(raw[type])) {
        if (/^[a-zA-Z0-9_.-]{1,100}(?:\/[a-zA-Z0-9_.-]{1,100})?$/.test(key) && !UNSAFE_KEYS.has(key.toLowerCase()) && typeof value === 'string' && value.length <= 90) {
          if (type === 'autoAssignments' && !isPreset(value)) continue; // automatic picks are always built-in presets
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
    const custom = own(config.customThemes, id);
    if (custom) return custom;
    const preset = PRESETS.find(t => t.id === id);
    // Built-in themes follow the chosen appearance preset (Crisp Immersive by default).
    return preset ? { ...preset, ...appearanceValues(config.appearance, preset), appearance: config.appearance || 'crisp' } : null;
  }
  /** Restore visual defaults without touching repository/owner/automatic assignments, wallpapers, colours or names:
      appearance → Crisp Immersive and every custom theme's six visual controls → the Crisp values for its tone.
      Returns the number of custom themes changed. */
  function restoreVisualDefaults(config) {
    config.appearance = 'crisp';
    config.sceneHeight = 'standard';
    config.readingBacking = 'text';
    let changed = 0;
    for (const theme of Object.values(config.customThemes)) {
      const v = appearanceValues('crisp', theme);
      if (VISUAL_FIELDS.some(k => theme[k] !== v[k])) { Object.assign(theme, v); changed++; }
    }
    return changed;
  }
  /** Readability guard. Text sits on glass (surface at opacity g) over the wallpaper layer, which is: image pixel ×
      brightness, tinted by the overlay (theme bg at o), drawn at layer opacity over the theme bg. For the brightest and
      darkest measured pixels of the wallpaper, find the smallest g ≥ the user's choice at which text, secondary text and
      accent all keep ≥ minRatio. Browsers composite in sRGB channel space, which this mirrors. Returns 0..1. */
  function requiredGlass(theme, tone = WORST_CASE_TONE, minRatio = 4.6, sheen = 0) {
    const mix = (a, b, t) => a.map((v, i) => v * t + b[i] * (1 - t));
    const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    const lum = c => c.map(v => { v = Math.min(255, Math.max(0, v)) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const bg = rgb(theme.bg), surface = rgb(theme.surface);
    const o = theme.wallpaperOverlay / 100, b = theme.wallpaperBrightness / 100, op = theme.wallpaperOpacity / 100;
    // Same stack as the page paints (content.js sceneLayers): brightness veil (black below 100 %, white above),
    // then overlay (theme bg at o), then opacity veil (theme bg at 1 - op).
    const bright = px => b <= 1 ? px.map(v => v * b) : mix([255, 255, 255], px, Math.min(0.6, (b - 1) * 0.5));
    const backdrops = tone.map(h => { const px = bright(rgb(h)); return mix(mix(bg, px, o), bg, op); });
    const fgs = [theme.text, theme.muted, theme.accent].map(rgb); // GitHub's semantic colours are raised in content.js
    for (let g = Math.max(0, theme.glassOpacity / 100); g <= 1.0001; g += 0.01) {
      // sheen: the Frosted Glass highlight (white at its strongest alpha) painted over the panel colour.
      const ok = backdrops.every(back => { const panel = mix([255, 255, 255], mix(surface, back, g), sheen); return fgs.every(fg => ratio(fg, panel) >= minRatio); });
      if (ok) return Math.min(1, Math.round(g * 100) / 100);
    }
    return 1;
  }
  /** Brightest/darkest measured colours of a bundled scene. soft=true: measured after a 6 px-equivalent blur, used when
      panels blur their backdrop by ≥ 6 px (text then sits on the blurred scene, never on single sharp pixels).
      Uploaded images always use the worst case (white/black). */
  function wallpaperTone(ref, soft = false) {
    const m = /^builtin:(.+)$/.exec(ref || '');
    return (m && (soft ? WALLPAPER_TONES_SOFT : WALLPAPER_TONES)[m[1]]) || WORST_CASE_TONE;
  }
  /** Panel opacity the page actually uses (the guard's result) and whether it raised the user's choice. */
  function panelOpacity(theme) {
    const t = normalizeTheme(theme);
    // 4.8:1 target (0.3 above AA) absorbs anti-aliasing and GitHub's own nested tints measured on real pages.
    const sheen = t.glass >= 8 ? (isLightHex(t.bg) ? 0.32 : 0.14) : 0; // must match content.js (Frosted Glass highlight)
    const needed = requiredGlass(t, wallpaperTone(t.wallpaperRef, t.glass >= 6), 4.8, sheen);
    // Loose items outside panels (headings, links, badges) get an unblurred backing in the theme background colour.
    // They are small and can sit on any pixel (including the brightest 2 % the tone excludes), so their bright extreme is
    // pure white.
    const darkest = wallpaperTone(t.wallpaperRef)[1];
    const loose = requiredGlass({ ...t, surface: t.bg, glassOpacity: 60 }, ['#ffffff', darkest], 4.8);
    return { opacity: needed, loose, chosen: t.glassOpacity / 100, raised: needed > t.glassOpacity / 100 + 0.001 };
  }

  /** 32-bit FNV-1a hash of a normalized string (stable across browsers and sessions). */
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  /** Deterministic automatic theme for an unconfigured repository.
      start = FNV-1a(owner/repo) mod N; walk the preset list from there and take the first preset not already
      used by another repository of the same owner (manual or automatic), so sibling repos differ while
      there are presets left. Pure: same (key, config) → same result. Not unique once an owner has > N repos. */
  function pickAutoTheme(key, config) {
    const k = String(key).toLowerCase();
    const owner = k.split('/')[0];
    const used = new Set();
    for (const type of ['repoAssignments', 'autoAssignments']) {
      for (const [other, id] of Object.entries(config[type] || {})) if (other !== k && other.split('/')[0] === owner) used.add(id);
    }
    const start = fnv1a(k) % PRESETS.length;
    for (let i = 0; i < PRESETS.length; i++) { const id = PRESETS[(start + i) % PRESETS.length].id; if (!used.has(id)) return id; }
    return PRESETS[start].id;
  }
  /** Precedence (first match wins): disabled → repository (manual) → owner → automatic (if enabled; persisted
      pick, else computed) → global default. "native" at any explicit level means original GitHub. */
  function themeResolution(config, href) {
    const repo = repositoryFromUrl(href);
    if (!config.enabled) return { theme: null, scope: 'disabled', source: 'disabled', repository: repo };
    let scope = 'global', id = config.defaultThemeId, persisted = true;
    if (repo && own(config.repoAssignments, repo.key)) { id = own(config.repoAssignments, repo.key); scope = 'repository'; }
    else if (repo && own(config.ownerAssignments, repo.owner)) { id = own(config.ownerAssignments, repo.owner); scope = 'owner'; }
    else if (repo && config.autoAssign) {
      scope = 'auto';
      id = own(config.autoAssignments, repo.key);
      if (!id) { id = pickAutoTheme(repo.key, config); persisted = false; }
    }
    return { theme: themeById(config, id), scope, source: scope, repository: repo, id, persisted };
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
      if (result === false) return latest; // mutator decided nothing needs saving
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
  /** Adds the default repository mappings once. Existing choices for those repositories are never replaced, and
      after seeding (seededMappings) removals stick. Returns false when nothing changes (for updateConfig). */
  function seedDefaultMappings(config) {
    if (config.seededMappings) return false;
    for (const [key, id] of Object.entries(DEFAULT_REPO_MAPPINGS)) if (!Object.hasOwn(config.repoAssignments, key)) config.repoAssignments[key] = id;
    config.seededMappings = true;
    return config;
  }
  /** Effective live-wallpaper motion: 'none' | theme motion, at 'ambient' or 'cinematic' intensity. */
  function motionFor(theme, config, reducedMotion) {
    if (!theme || reducedMotion || config.motionMode === 'static' || !theme.motion || theme.motion === 'none') return { kind: 'none', mode: 'static' };
    return { kind: theme.motion, mode: config.motionMode };
  }
  root.RepoVibeCore = Object.freeze({
    STORAGE_KEY, PRESETS, DEFAULT, MAX_CUSTOM_THEMES, CONFIG_VERSION, WALLPAPERS, POSITIONS, SIZES,
    APPEARANCES, VISUAL_FIELDS, SCENE_HEIGHTS, DEPTH_QUALITIES, appearanceValues, restoreVisualDefaults,
    MOTIONS, MOTION_MODES, FLAGSHIP_MOTION, DEFAULT_REPO_MAPPINGS, seedDefaultMappings, motionFor,
    safeWallpaperRef, fnv1a, pickAutoTheme, requiredGlass, wallpaperTone, panelOpacity, normalizeConfig, normalizeTheme, safeWallpaper,
    repositoryFromUrl, themeById, themeResolution, loadConfig, saveConfig, updateConfig, themeUsage, assignTheme, isPreset,
    contrastRatio, isLightColor
  });
})(globalThis);
