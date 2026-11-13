'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({URL, structuredClone, console, Date, Math});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../shared/wallpaper-catalog.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../shared/core.js'), 'utf8'), context);
const C = context.RepoVibeCore;

test('bundles twenty distinct complete presets', () => {
  assert.equal(C.PRESETS.length, 20);
  assert.equal(new Set(C.PRESETS.map(t => t.id)).size, 20);
  for (const t of C.PRESETS) assert.match(t.accent, /^#[a-fA-F0-9]{6}$/);
});
test('recognizes GitHub repositories without misidentifying site pages', () => {
  assert.equal(C.repositoryFromUrl('https://github.com/Acme/Project/tree/main').key, 'acme/project');
  assert.equal(C.repositoryFromUrl('https://github.com/settings/profile'), null);
  assert.equal(C.repositoryFromUrl('https://github.com/search?q=foo'), null);
  assert.equal(C.repositoryFromUrl('https://evil.example/acme/project'), null);
  assert.equal(C.repositoryFromUrl('https://github.com/acme'), null);
});
test('resolves repo > owner > global and obeys disable', () => {
  const cfg = C.normalizeConfig(null);
  cfg.autoAssign = false; // legacy chain: repo > owner > global (automatic tier covered separately)
  cfg.defaultThemeId = 'preset-2';
  cfg.ownerAssignments['acme'] = 'preset-3';
  cfg.repoAssignments['acme/project'] = 'preset-1';
  assert.equal(C.themeResolution(cfg, 'https://github.com/acme/project/issues').theme.name, 'Cyberpunk Neon');
  assert.equal(C.themeResolution(cfg, 'https://github.com/acme/another').theme.name, 'Sakura Dreams');
  assert.equal(C.themeResolution(cfg, 'https://github.com/else/another').theme.name, 'Midnight Developer');
  cfg.enabled = false;
  assert.equal(C.themeResolution(cfg, 'https://github.com/acme/project').theme, null);
});
test('invalid CSS data and external wallpaper URLs are stripped', () => {
  const theme = C.normalizeTheme({...C.PRESETS[0], wallpaperRef:'', bg:'red; color:transparent', wallpaper:'url(https://evil.example/track)', backgroundMode:'image'});
  assert.equal(theme.bg, C.PRESETS[1].bg);
  assert.equal(theme.wallpaper, '');
  assert.equal(theme.backgroundMode, 'gradient');
  assert.equal(theme.radius, 16);
});
test('safely loads config, preserving only valid data', () => {
  const config = C.normalizeConfig({enabled:false, defaultThemeId:'preset-2', repoAssignments:{'acme/code':'preset-1','bad key':'preset-4'}});
  assert.equal(config.enabled, false);
  assert.equal(config.repoAssignments['acme/code'], 'preset-1');
  assert.equal(config.repoAssignments['bad key'], undefined);
});
test('safe image data is accepted only with image MIME and base64', () => {
  assert.equal(C.safeWallpaper('data:image/png;base64,aGVsbG8='), 'data:image/png;base64,aGVsbG8=');
  assert.equal(C.safeWallpaper('data:image/svg+xml;base64,aGVsbG8='), '');
});
test('every preset meets WCAG AA (4.5:1) for text, secondary text and links on all surfaces', () => {
  for (const t of C.PRESETS) {
    for (const fg of ['text', 'muted', 'accent']) {
      for (const bg of ['surface', 'surface2', 'codeBg']) {
        const ratio = C.contrastRatio(t[fg], t[bg]);
        assert.ok(ratio >= 4.5, `${t.name}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
      }
    }
  }
});
test('light/dark detection uses luminance, not string prefixes', () => {
  const light = [...C.PRESETS.filter(t => C.isLightColor(t.bg)).map(t => t.name)].sort();
  assert.deepEqual(light, ['Arctic Frost', 'Sakura Dreams']);
  assert.equal(C.isLightColor('not a color'), false);
});
test('prototype-like keys never resolve to inherited Object members', () => {
  const cfg = C.normalizeConfig(JSON.parse('{"defaultThemeId":"preset-2","ownerAssignments":{"__proto__":"preset-1","constructor":"preset-1"},"repoAssignments":{"constructor/x":"preset-3"}}'));
  assert.equal(Object.keys(cfg.ownerAssignments).length, 0);
  assert.equal(Object.getPrototypeOf(cfg.ownerAssignments), Object.prototype);
  assert.equal(C.themeResolution(cfg, 'https://github.com/toString/repo').theme.name, 'Midnight Developer');
  assert.equal(C.themeResolution(cfg, 'https://github.com/hasOwnProperty/repo').scope, 'global');
  assert.equal(C.themeById(cfg, 'constructor'), null);
  assert.equal(C.normalizeConfig([1, 2]).defaultThemeId, 'native');
});
function coreWithStorage(initial, { failWith } = {}) {
  let stored = initial === undefined ? {} : { [C.STORAGE_KEY]: initial };
  const chrome = { storage: { local: {
    get: async key => (key in stored ? { [key]: structuredClone(stored[key]) } : {}),
    set: async obj => { if (failWith) throw new Error(failWith); await new Promise(r => setTimeout(r, 5)); stored = { ...stored, ...structuredClone(obj) }; }
  } } };
  const ctx = vm.createContext({ URL, structuredClone, console, Date, Math, setTimeout, chrome });
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../shared/wallpaper-catalog.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../shared/core.js'), 'utf8'), ctx);
  return { core: ctx.RepoVibeCore, stored: () => stored[C.STORAGE_KEY] };
}
test('updateConfig merges against latest storage instead of a stale copy', async () => {
  const a = coreWithStorage({ defaultThemeId: 'preset-1' });
  const stale = await a.core.loadConfig();              // e.g. Studio loaded earlier
  await a.core.updateConfig(c => { c.repoAssignments['acme/x'] = 'preset-2'; }); // popup change
  stale.ownerAssignments.acme = 'preset-3';
  await a.core.updateConfig(c => { c.ownerAssignments.acme = 'preset-3'; }); // Studio save via updateConfig
  assert.equal(a.stored().repoAssignments['acme/x'], 'preset-2', 'earlier change preserved');
  assert.equal(a.stored().ownerAssignments.acme, 'preset-3');
  await Promise.all([1, 2, 3, 4].map(n => a.core.updateConfig(c => { c.repoAssignments[`o/r${n}`] = 'preset-1'; })));
  assert.equal(Object.keys(a.stored().repoAssignments).length, 5, 'serialized concurrent writes all persist');
});
test('saveConfig refuses to silently drop custom themes past the library limit', async () => {
  const themes = {};
  for (let i = 0; i < C.MAX_CUSTOM_THEMES; i++) themes[`custom-${i}`] = { name: `T${i}` };
  const s = coreWithStorage({ customThemes: themes });
  await assert.rejects(s.core.updateConfig(c => { c.customThemes['custom-new'] = { name: 'New' }; c.defaultThemeId = 'custom-new'; }), /library is full/);
  assert.equal(Object.keys(s.stored().customThemes).length, C.MAX_CUSTOM_THEMES);
  assert.notEqual(s.stored().defaultThemeId, 'custom-new', 'nothing partially saved');
});
test('storage quota failures produce an actionable message', async () => {
  const s = coreWithStorage({}, { failWith: 'QUOTA_BYTES quota exceeded' });
  await assert.rejects(s.core.saveConfig({ enabled: true }), /storage is full/);
  const t = coreWithStorage({});
  await t.core.updateConfig(() => { throw new Error('boom'); }).catch(() => {});
  await t.core.updateConfig(c => { c.defaultThemeId = 'preset-4'; });
  assert.equal(t.stored().defaultThemeId, 'preset-4', 'a failed write does not block later writes');
});
test('themeUsage lists every assignment of a custom theme', () => {
  const cfg = C.normalizeConfig({ defaultThemeId: 'custom-a', ownerAssignments: { acme: 'custom-a' }, repoAssignments: { 'x/y': 'custom-a', 'x/z': 'preset-1' }, customThemes: { 'custom-a': { name: 'A' } } });
  assert.deepEqual(JSON.parse(JSON.stringify(C.themeUsage(cfg, 'custom-a'))), [{ scope: 'global', key: '' }, { scope: 'owner', key: 'acme' }, { scope: 'repository', key: 'x/y' }]);
});

test('every preset ships its own distinct bundled wallpaper and valid wallpaper settings', () => {
  assert.equal(new Set(C.PRESETS.map(t => t.wallpaperRef)).size, 20);
  for (const t of C.PRESETS) {
    assert.equal(t.backgroundMode, 'image');
    assert.equal(C.safeWallpaperRef(t.wallpaperRef), t.wallpaperRef);
    const n = C.normalizeTheme(t);
    assert.equal(n.wallpaperRef, t.wallpaperRef); assert.equal(n.wallpaperSize, 'cover');
  }
  for (const w of C.WALLPAPERS) assert.ok(fs.existsSync(require('node:path').join(__dirname, '..', w.path)) && fs.existsSync(require('node:path').join(__dirname, '..', w.thumb)), `asset missing: ${w.slug}`);
});
test('wallpaper references accept only bundled slugs or IndexedDB ids', () => {
  for (const bad of ['builtin:../../etc', 'builtin:unknown', 'https://evil.example/x.png', 'idb:short', 'idb:"); x', 'javascript:alert(1)', 42])
    assert.equal(C.safeWallpaperRef(bad), '', String(bad));
  assert.equal(C.safeWallpaperRef('idb:w0123456789abcdef01234567'), 'idb:w0123456789abcdef01234567');
  const t = C.normalizeTheme({ name: 'x', wallpaperBrightness: 999, wallpaperOverlay: -5, wallpaperPosition: 'url(x)', wallpaperSize: 'stretch' });
  assert.deepEqual([t.wallpaperBrightness, t.wallpaperOverlay, t.wallpaperPosition, t.wallpaperSize], [140, 0, 'center', 'cover']);
});
test('automatic assignment is deterministic, stable and independent of call order', () => {
  const cfg = C.normalizeConfig(null);
  const ids = ['user/RepoVibe', 'user/PoolSouls', 'user/TradePro', 'user/leetcode-solutions'].map(k => C.pickAutoTheme(k.toLowerCase(), cfg));
  assert.deepEqual(ids, ['user/RepoVibe', 'user/PoolSouls', 'user/TradePro', 'user/leetcode-solutions'].map(k => C.pickAutoTheme(k.toLowerCase(), C.normalizeConfig(null))));
  const r = C.themeResolution(cfg, 'https://github.com/User/RepoVibe/issues');
  assert.equal(r.source, 'auto'); assert.equal(r.persisted, false); assert.equal(r.id, C.pickAutoTheme('user/repovibe', cfg));
  assert.equal(C.fnv1a('a'), 0xe40c292c); // reference FNV-1a vector
});
test('automatic assignment spreads sibling repositories across presets', () => {
  const cfg = C.normalizeConfig(null);
  for (let i = 0; i < 20; i++) { const key = `acme/repo-${i}`; cfg.autoAssignments[key] = C.pickAutoTheme(key, cfg); }
  assert.equal(new Set(Object.values(cfg.autoAssignments)).size, 20, 'first 20 repos of one owner get 20 different themes');
  const extra = C.pickAutoTheme('acme/repo-20', cfg); assert.ok(C.isPreset(extra), 'beyond 20 repos themes repeat (no uniqueness claim)');
  assert.notEqual(C.pickAutoTheme('acme/new', { ...cfg, repoAssignments: { 'acme/manual': C.pickAutoTheme('acme/new', C.normalizeConfig(null)) }, autoAssignments: {} }), C.pickAutoTheme('acme/new', C.normalizeConfig(null)), 'a manual sibling choice is avoided too');
});
test('precedence: manual repo > owner > automatic > global; manual is never replaced by auto', () => {
  const cfg = C.normalizeConfig({ version: 2, autoAssign: true, defaultThemeId: 'preset-2', ownerAssignments: { org: 'preset-3' }, repoAssignments: { 'me/pinned': 'preset-5', 'me/plain': 'native' }, autoAssignments: { 'me/pinned': 'preset-9', 'me/auto': 'preset-11' } });
  const src = url => { const r = C.themeResolution(cfg, url); return [r.source, r.id]; };
  assert.deepEqual(src('https://github.com/me/pinned'), ['repository', 'preset-5']);
  assert.deepEqual(src('https://github.com/me/plain'), ['repository', 'native']);
  assert.equal(C.themeResolution(cfg, 'https://github.com/me/plain').theme, null, 'manual "Restore GitHub" wins over auto');
  assert.deepEqual(src('https://github.com/org/anything'), ['owner', 'preset-3']);
  assert.deepEqual(src('https://github.com/me/auto'), ['auto', 'preset-11']);
  assert.deepEqual(src('https://github.com/settings/profile'), ['global', 'preset-2']);
  cfg.autoAssign = false;
  assert.deepEqual(src('https://github.com/me/auto'), ['global', 'preset-2'], 'disabling auto falls back to the shared global theme');
  cfg.enabled = false;
  assert.equal(C.themeResolution(cfg, 'https://github.com/me/pinned').source, 'disabled');
});
test('v1 config migration: global-theme users keep a shared theme; others get auto; bad auto ids dropped', () => {
  assert.equal(C.normalizeConfig({ defaultThemeId: 'preset-4' }).autoAssign, false);
  assert.equal(C.normalizeConfig({ defaultThemeId: 'native' }).autoAssign, true);
  assert.equal(C.normalizeConfig({}).autoAssign, true);
  assert.equal(C.normalizeConfig({ version: 2, defaultThemeId: 'preset-4', autoAssign: true }).autoAssign, true);
  assert.equal(C.normalizeConfig({ version: 2, autoAssign: false }).autoAssign, false);
  assert.deepEqual(JSON.parse(JSON.stringify(C.normalizeConfig({ version: 2, autoAssignments: { 'a/b': 'custom-x', 'a/c': 'preset-2' } }).autoAssignments)), { 'a/c': 'preset-2' });
  const legacy = C.normalizeConfig({ customThemes: { 'custom-old': { name: 'Old', backgroundMode: 'image', wallpaper: 'data:image/png;base64,aGVsbG8=' } } });
  assert.equal(legacy.customThemes['custom-old'].wallpaper, 'data:image/png;base64,aGVsbG8=', 'legacy inline wallpaper preserved until migrated');
  assert.equal(legacy.customThemes['custom-old'].backgroundMode, 'image');
});
test('readability guard keeps text, secondary text and links >= 4.5:1 over each wallpaper\'s brightest and darkest regions', () => {
  for (const t of C.PRESETS) {
    for (const tone of [C.wallpaperTone(t.wallpaperRef), ['#ffffff', '#000000']]) {
      const g = C.requiredGlass(t, tone);
      assert.ok(g >= t.glassOpacity / 100, 'never lowers the user choice');
      const loose = C.requiredGlass({ ...t, glassOpacity: 40 }, tone);
      assert.ok(loose >= 0.4 && loose <= g, `${t.name}: guard raises a 40% choice to ${loose}`);
    }
  }
  const sunset = C.PRESETS.find(t => t.name === 'Sunset Boulevard');
  assert.ok(C.requiredGlass({ ...sunset, glassOpacity: 40, wallpaperOverlay: 0 }, C.wallpaperTone(sunset.wallpaperRef)) > 0.6, 'bright artwork forces substantial glass');
  assert.deepEqual([...C.wallpaperTone('idb:w0123456789abcdef012345')], ['#ffffff', '#000000'], 'unknown uploads assume worst case');
});

/* ---- Focused Phase 1B: four flagship worlds, default repository mappings, live-wallpaper motion. */
test('four flagship themes with 3D artwork and a live layer each', () => {
  const flagships = C.PRESETS.filter(t => t.flagship);
  assert.deepEqual(JSON.parse(JSON.stringify(flagships.map(t => [t.id, t.name, t.motion]))), [
    ['preset-1', 'Cyberpunk Neon', 'rain'], ['preset-8', 'Enchanted Forest', 'fireflies'],
    ['preset-15', 'Futuristic Sci-Fi', 'holo'], ['preset-19', 'Cosmic Galaxy', 'stars']]);
  const slugs = flagships.map(t => t.wallpaperRef.replace('builtin:', ''));
  assert.deepEqual([...slugs], ['neon-city-3d', 'enchanted-forest', 'scifi-ai', 'cosmic-galaxy']);
  for (const slug of slugs) assert.equal(C.WALLPAPERS.find(w => w.slug === slug).style, '3d', `${slug} is a 3D render`);
  assert.ok(flagships.every(t => !C.isLightColor(t.bg)), 'all four flagship worlds are dark scenes (Sci-Fi became a dark cyan-lit hall in v0.3)');
  // every flagship keeps readable text over its own artwork
  for (const t of flagships) assert.ok(C.requiredGlass(t, C.wallpaperTone(t.wallpaperRef)) <= 0.9, `${t.name} guard`);
});
test('default repository mappings are seeded once and then behave like manual choices', () => {
  assert.deepEqual({ ...C.DEFAULT_REPO_MAPPINGS }, {
    'naman-dev-00/tradpro': 'preset-1', 'naman-dev-00/repovibe': 'preset-8',
    'naman-dev-00/pool-souls': 'preset-19', 'naman-dev-00/ai-powered-inbox-assistant': 'preset-15' });
  const config = C.normalizeConfig({ version: 2, repoAssignments: { 'naman-dev-00/tradpro': 'preset-5' } });
  assert.equal(config.seededMappings, false);
  const seeded = C.normalizeConfig(C.seedDefaultMappings(config));
  assert.equal(seeded.repoAssignments['naman-dev-00/tradpro'], 'preset-5', 'an existing user choice is never replaced');
  assert.equal(seeded.repoAssignments['naman-dev-00/repovibe'], 'preset-8');
  const names = ['naman-dev-00/RepoVibe', 'naman-dev-00/Pool-Souls', 'naman-dev-00/ai-powered-inbox-assistant']
    .map(k => C.themeResolution(seeded, `https://github.com/${k}/issues`)).map(r => [r.scope, r.theme.name]);
  assert.deepEqual(JSON.parse(JSON.stringify(names)), [['repository', 'Enchanted Forest'], ['repository', 'Cosmic Galaxy'], ['repository', 'Futuristic Sci-Fi']]);
  delete seeded.repoAssignments['naman-dev-00/repovibe'];
  assert.equal(C.seedDefaultMappings(seeded), false, 'removals stick: seeding happens only once');
  assert.equal(C.themeResolution({ ...seeded, autoAssign: true }, 'https://github.com/naman-dev-00/RepoVibe').source, 'auto');
  assert.equal(C.themeResolution(seeded, 'https://github.com/someone/else').scope !== 'repository', true, 'unconfigured repos are not affected');
});
test('live wallpaper motion: modes, reduced motion, persistence', () => {
  const config = C.normalizeConfig({ version: 2 });
  assert.equal(config.motionMode, 'ambient', 'default is Ambient');
  const neon = C.PRESETS[0], plain = C.PRESETS[1];
  assert.deepEqual({ ...C.motionFor(neon, config, false) }, { kind: 'rain', mode: 'ambient' });
  assert.equal(C.motionFor(neon, config, true).kind, 'none', 'prefers-reduced-motion disables motion');
  assert.equal(C.motionFor(neon, { ...config, motionMode: 'static' }, false).kind, 'none');
  assert.deepEqual({ ...C.motionFor(neon, { ...config, motionMode: 'cinematic' }, false) }, { kind: 'rain', mode: 'cinematic' });
  assert.equal(C.motionFor(plain, config, false).kind, 'none', 'non-flagship themes have no live layer');
  assert.equal(C.normalizeConfig({ version: 2, motionMode: 'cinematic' }).motionMode, 'cinematic');
  assert.equal(C.normalizeConfig({ version: 2, motionMode: 'turbo' }).motionMode, 'ambient');
  assert.equal(C.normalizeTheme({ ...neon, id: 'custom-x' }).motion, 'rain', 'customized copies keep their live layer');
  assert.equal(C.normalizeTheme({ ...neon, id: 'custom-y', motion: 'explode' }).motion, 'none');
});

/* ---- v0.2.1 scene rendering: one guarded glass layer, honest feedback. */
test('panel guard: single-layer opacity, feedback when raised, loose items guarded against pure white', () => {
  for (const t of C.PRESETS.filter(p => p.flagship)) {
    const g = C.panelOpacity(t);
    assert.ok(g.opacity >= g.chosen && g.opacity <= 0.95, `${t.name}: guarded panel opacity ${g.opacity}`);
    assert.equal(g.raised, g.opacity > g.chosen + 0.001);
    assert.ok(g.loose > 0 && g.loose <= 0.8, `${t.name}: loose-item backing ${g.loose}`);
  }
  const strict = C.panelOpacity({ ...C.PRESETS[0], glassOpacity: 40 });
  assert.equal(strict.raised, true, 'choosing lighter glass than the scene allows is reported, not silently ignored');
  assert.ok(C.panelOpacity({ ...C.PRESETS[0], glassOpacity: 100 }).opacity === 1 && !C.panelOpacity({ ...C.PRESETS[0], glassOpacity: 100 }).raised);
  // Brightness above 100 % brightens the scene (white veil) and therefore needs at least as much glass for light text.
  const dim = C.panelOpacity({ ...C.PRESETS[18], wallpaperBrightness: 70 }).opacity, bright = C.panelOpacity({ ...C.PRESETS[18], wallpaperBrightness: 130 }).opacity;
  assert.ok(bright >= dim, `brighter scene needs ≥ glass (${dim} → ${bright})`);
  // More overlay darkness lets lighter glass suffice for light-on-dark themes.
  assert.ok(C.panelOpacity({ ...C.PRESETS[18], wallpaperOverlay: 60 }).opacity <= C.panelOpacity({ ...C.PRESETS[18], wallpaperOverlay: 0 }).opacity);
  // Uploaded images assume the worst case.
  assert.ok(C.panelOpacity({ ...C.PRESETS[18], wallpaperRef: 'idb:w0123456789abcdef012345' }).opacity >= C.panelOpacity(C.PRESETS[18]).opacity);
});

/* ---- Crisp Immersive design system: appearance presets, independent controls, restore. */
test('Crisp Immersive is the default: no wallpaper blur, no panel backdrop blur, native brightness, minimal overlay', () => {
  const config = C.normalizeConfig({ version: 2 });
  assert.equal(config.appearance, 'crisp'); assert.equal(config.sceneWindow, true);
  for (const p of C.PRESETS) {
    assert.equal(p.glass, 0, `${p.name}: no panel backdrop blur by default`);
    assert.equal(p.wallpaperBlur, 0); assert.equal(p.wallpaperBrightness, 100); assert.ok(p.wallpaperOverlay <= 6);
    const t = C.themeById(config, p.id);
    assert.equal(t.glass, 0); assert.equal(t.wallpaperBlur, 0); assert.equal(t.appearance, 'crisp');
  }
  // Old stored configs (no appearance) upgrade to Crisp for built-in themes.
  assert.equal(C.normalizeConfig({ version: 2, defaultThemeId: 'preset-8' }).appearance, 'crisp');
  assert.equal(C.normalizeConfig({ version: 2, appearance: 'glassy' }).appearance, 'crisp');
});
test('appearance presets are visibly different and only set the six visual controls', () => {
  const forest = C.PRESETS[7];
  const v = name => C.themeById(C.normalizeConfig({ version: 2, appearance: name }), forest.id);
  const crisp = v('crisp'), balanced = v('balanced'), frosted = v('frosted');
  assert.equal(crisp.glass, 0); assert.equal(balanced.glass, 0); assert.ok(frosted.glass >= 12, 'only Frosted Glass blurs panels');
  assert.ok(balanced.wallpaperOverlay > crisp.wallpaperOverlay && balanced.glassOpacity > crisp.glassOpacity, 'Balanced: more overlay, more solid panels');
  assert.ok(frosted.glassOpacity < crisp.glassOpacity, 'Frosted: more translucent panels');
  for (const t of [crisp, balanced, frosted]) { assert.equal(t.wallpaperBlur, 0, 'no preset blurs the wallpaper itself'); assert.equal(t.wallpaperRef, forest.wallpaperRef); assert.equal(t.accent, forest.accent); }
  assert.deepEqual([...C.VISUAL_FIELDS].sort(), ['glass', 'glassOpacity', 'wallpaperBlur', 'wallpaperBrightness', 'wallpaperOpacity', 'wallpaperOverlay']);
  // Custom themes keep their own explicit values whatever the appearance.
  const cfg = C.normalizeConfig({ version: 2, appearance: 'frosted', customThemes: { 'custom-a': { ...forest, id: 'custom-a', glass: 3, wallpaperBlur: 2 } } });
  assert.equal(C.themeById(cfg, 'custom-a').glass, 3); assert.equal(C.themeById(cfg, 'custom-a').wallpaperBlur, 2);
});
test('restore visual defaults resets only visual controls; assignments, wallpapers, colours and names are kept', () => {
  const cfg = C.normalizeConfig({ version: 2, appearance: 'frosted', repoAssignments: { 'a/b': 'custom-old' }, autoAssignments: { 'c/d': 'preset-3' },
    customThemes: { 'custom-old': { ...C.PRESETS[7], id: 'custom-old', name: 'Mine', accent: '#123456', glass: 14, wallpaperBlur: 8, wallpaperOverlay: 40, wallpaperBrightness: 70, glassOpacity: 55, wallpaperRef: 'idb:w0123456789abcdef012345' } } });
  assert.equal(C.restoreVisualDefaults(cfg), 1);
  const t = C.normalizeConfig(cfg).customThemes['custom-old'];
  assert.equal(cfg.appearance, 'crisp');
  assert.deepEqual([t.glass, t.wallpaperBlur, t.wallpaperOverlay, t.wallpaperBrightness, t.glassOpacity], [0, 0, 6, 100, 86]);
  assert.deepEqual([t.name, t.accent, t.wallpaperRef], ['Mine', '#123456', 'idb:w0123456789abcdef012345']);
  assert.equal(cfg.repoAssignments['a/b'], 'custom-old'); assert.equal(cfg.autoAssignments['c/d'], 'preset-3');
  assert.equal(C.restoreVisualDefaults(cfg), 0, 'idempotent');
});

test('depth effects and scene-window height are normalized, defaulted and restored', () => {
  const d = C.normalizeConfig({});
  assert.equal(d.depthEffects, true); assert.equal(d.sceneHeight, 'standard');
  const c = C.normalizeConfig({ depthEffects: false, sceneHeight: 'tall' });
  assert.equal(c.depthEffects, false); assert.equal(c.sceneHeight, 'tall');
  assert.equal(C.normalizeConfig({ sceneHeight: '<script>' }).sceneHeight, 'standard');
  assert.equal(C.normalizeConfig({ depthEffects: 'no' }).depthEffects, true);
  assert.equal(d.readingBacking, 'text'); assert.equal(C.normalizeConfig({ readingBacking: 'panels' }).readingBacking, 'panels'); assert.equal(C.normalizeConfig({ readingBacking: 'x' }).readingBacking, 'text');
  assert.equal(d.depthQuality, 'auto'); assert.equal(C.normalizeConfig({ depthQuality: 'lite' }).depthQuality, 'lite'); assert.equal(C.normalizeConfig({ depthQuality: 'ultra' }).depthQuality, 'auto');
  C.restoreVisualDefaults(c); assert.equal(c.sceneHeight, 'standard');
});

test('flagship wallpapers declare depth layers that exist on disk, starting with a far layer', () => {
  const path = require('node:path');
  const flagship = ['enchanted-forest', 'cosmic-galaxy', 'neon-city-3d', 'scifi-ai'];
  for (const slug of flagship) {
    const w = Object.values(C.WALLPAPERS).find(x => x.slug === slug || x.id === slug);
    assert.ok(w, slug);
    assert.ok(Array.isArray(w.depth) && w.depth.length >= 3, `${slug} depth layers`);
    assert.equal(w.depth[0].layer, 'far');
    for (const l of w.depth) {
      assert.match(l.path, /^wallpapers\/depth\/[a-z0-9-]+\/(far|mid|near|front|rays)\.webp$/);
      assert.ok(fs.existsSync(path.join(__dirname, '..', l.path)), l.path);
    }
  }
});

test('every sprite referenced by the depth engine exists on disk and in the catalogue', () => {
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '../content.js'), 'utf8');
  const block = src.slice(src.indexOf('const SPRITES = {'), src.indexOf('function spriteUrl'));
  const worlds = [...block.matchAll(/'([a-z0-9-]+)': \[([\s\S]*?)\n    \]/g)];
  assert.ok(worlds.length >= 1);
  for (const [, slug, body] of worlds) {
    const w = C.WALLPAPERS.find(x => x.slug === slug);
    for (const [, n] of [...body.matchAll(/\{ n: '([A-Za-z0-9]+)'(?!, src)/g), ...body.matchAll(/src: '([A-Za-z0-9]+)'/g)]) {
      assert.ok(fs.existsSync(path.join(__dirname, '..', 'wallpapers', 'depth', slug, `s-${n}.webp`)), `${slug}/s-${n}.webp`);
      assert.ok((context.RepoVibeWallpaperCatalog.find(x => x.slug === slug).sprites || []).includes(n), `${slug}: ${n} listed in the catalogue (packaged + verified)`);
    }
    assert.ok(w, slug);
  }
});

test('removed idle-butterfly preference: ignored on load, other settings preserved, no trace in the shipped sources', () => {
  const path = require('node:path');
  const c = C.normalizeConfig({ version: 2, idleButterfly: true, sceneHeight: 'tall', depthQuality: 'lite', defaultThemeId: 'preset-8', repoAssignments: { 'a/b': 'preset-1' } });
  assert.equal('idleButterfly' in c, false); assert.equal(c.sceneHeight, 'tall'); assert.equal(c.depthQuality, 'lite'); assert.equal(c.repoAssignments['a/b'], 'preset-1');
  for (const f of ['content.js', 'shared/core.js', 'studio.js', 'studio.html', 'popup.js', 'popup.html', 'background.js']) assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), /butterfly/i, `${f} has no butterfly code`);
});

/* ---- Eight additional immersive worlds (data-driven, shared/worlds.js). */
const WORLD_IDS = { 'preset-3': 'sakura-garden', 'preset-7': 'ocean-kingdom', 'preset-12': 'arctic-frost-3d', 'preset-17': 'aurora-borealis', 'preset-20': 'synthwave-highway', 'preset-14': 'dark-library', 'preset-10': 'pixel-paradise-3d', 'preset-18': 'sunset-coast' };
const loadWorlds = () => { const ctx = vm.createContext({ globalThis: {} }); ctx.globalThis = ctx; vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../shared/worlds.js'), 'utf8'), ctx); return ctx.RepoVibeWorlds; };

test('the eight worlds keep their preset ids and are assigned their own layered artwork', () => {
  const path = require('node:path');
  assert.deepEqual(JSON.parse(JSON.stringify(C.WORLD_PRESETS)).sort(), Object.keys(WORLD_IDS).sort());
  for (const [id, slug] of Object.entries(WORLD_IDS)) {
    const p = C.PRESETS.find(t => t.id === id);
    assert.equal(p.wallpaperRef, `builtin:${slug}`, `${id} uses ${slug}`); assert.equal(p.world, true); assert.equal(p.flagship, false, 'worlds are not the four flagships');
    const w = C.WALLPAPERS.find(x => x.slug === slug);
    assert.ok(w && w.depth.length >= 4 && w.depth[0].layer === 'far', `${slug} layered`);
    for (const l of w.depth) assert.ok(fs.existsSync(path.join(__dirname, '..', l.path)), l.path);
    assert.ok(fs.existsSync(path.join(__dirname, '..', w.path)) && fs.existsSync(path.join(__dirname, '..', w.thumb)), `${slug} flat image and thumbnail (Home cards use the thumbnail, not a renderer)`);
  }
  assert.equal(C.PRESETS.filter(t => t.flagship).length, 4, 'the four flagships are unchanged');
  assert.ok(C.isLightColor(C.PRESETS.find(t => t.id === 'preset-12').bg), 'Arctic Frost remains the light theme');
});

test('every world sprite and pop-out declared in shared/worlds.js exists on disk and in the catalogue; data is well-formed', () => {
  const path = require('node:path');
  const W = loadWorlds();
  assert.deepEqual(Object.keys(W).sort(), Object.values(WORLD_IDS).sort());
  for (const [slug, def] of Object.entries(W)) {
    const cat = context.RepoVibeWallpaperCatalog.find(x => x.slug === slug);
    assert.ok(cat, slug); assert.ok(def.sprites.some(s => s.plane === 'pop'), `${slug} has pop-out elements`); assert.ok(def.sprites.some(s => s.wind), `${slug} has wind-driven sway`);
    for (const s of def.sprites) {
      const file = s.src || s.n;
      assert.ok(fs.existsSync(path.join(__dirname, '..', 'wallpapers', 'depth', slug, `s-${file}.webp`)), `${slug}/s-${file}.webp`);
      assert.ok((cat.sprites || []).includes(file), `${slug}: ${file} listed in the catalogue`);
      assert.ok(['scene', 'pop'].includes(s.plane)); assert.ok(Number.isFinite(s.k), `${slug}/${s.n} depth`);
      if (s.plane === 'scene') assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y) && s.w > 0, `${slug}/${s.n} placement`);
      if (s.plane === 'pop') assert.ok(s.noShadow && ['band', 'margin'].includes(s.at), `${slug}/${s.n} pop-out`);
    }
    for (const t of def.tiles) {
      assert.ok(['pfar', 'mist', 'pmid', 'pnear'].includes(t.plane), `${slug} tile plane`);
      if (t.image) for (const n of [t.image, t.mask].filter(Boolean)) assert.ok(fs.existsSync(path.join(__dirname, '..', 'wallpapers', 'depth', slug, `${n}.webp`)), `${slug}/${n}.webp (image tile / mask)`);
      else assert.ok(['petal', 'flake', 'dot', 'bubble', 'cube', 'ember', 'page'].includes(t.shape), `${slug} tile shape`);
    }
  }
});

/* ---- Curated collection: approved / experimental / archived (owner-maintained shared/theme-review.js). */
function coreWithReview(review) {
  const ctx = vm.createContext({ URL, structuredClone, console, Date, Math, RepoVibeThemeReview: review });
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../shared/wallpaper-catalog.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../shared/core.js'), 'utf8'), ctx);
  return ctx.RepoVibeCore;
}
test('nothing is approved without the owner: every built-in theme starts experimental, the six popup picks are preserved', () => {
  const K = coreWithReview(undefined);
  const col = K.themeCollection(K.normalizeConfig({}));
  assert.equal(col.approved.length, 0); assert.equal(col.archived.length, 0); assert.equal(col.experimental.length, K.PRESETS.length);
  assert.deepEqual(JSON.parse(JSON.stringify(K.featuredThemes().map(t => t.id))), ['preset-1', 'preset-8', 'preset-19', 'preset-15', 'preset-9', 'preset-20']);
  assert.equal(K.themeStatus('custom-x'), 'custom');
  const shipped = fs.readFileSync(require('node:path').join(__dirname, '../shared/theme-review.js'), 'utf8');
  // the shipped lists hold exactly the owner's decisions (2026-11-11, round 3 on 2026-11-12)
  const ctx = vm.createContext({}); vm.runInContext(shipped, ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.RepoVibeThemeReview)), { 'preset-8': 'approved', 'preset-19': 'approved', 'preset-15': 'approved', 'preset-10': 'approved', 'preset-12': 'approved', 'preset-20': 'archived', 'preset-7': 'approved', 'preset-3': 'archived', 'preset-14': 'archived',
    'preset-16': 'approved', 'preset-9': 'approved', 'preset-11': 'approved', 'preset-1': 'approved', 'preset-2': 'archived', 'preset-13': 'archived', 'preset-18': 'archived' });
  assert.deepEqual(Object.keys(ctx.RepoVibeWallpaperReview).sort(), ['alien-world', 'dark-library', 'galaxy-planet', 'lavender-fantasy', 'midnight-skyline', 'neon-rain-street', 'pixel-island', 'sakura-garden', 'sunset-coast', 'synthwave-grid', 'synthwave-highway']);
  const S = coreWithReview(ctx.RepoVibeThemeReview), scol = S.themeCollection(S.normalizeConfig({}));
  assert.deepEqual(JSON.parse(JSON.stringify(scol.approved.map(t => t.name))), ['Cyberpunk Neon', 'Ocean Depths', 'Enchanted Forest', 'Retro Terminal', 'Pixel Paradise', 'Solar Flare', 'Arctic Frost', 'Futuristic Sci-Fi', 'Obsidian', 'Cosmic Galaxy']);
  assert.deepEqual(JSON.parse(JSON.stringify(scol.archived.map(t => t.name))), ['Midnight Developer', 'Sakura Dreams', 'Lavender Nights', 'Dark Academia', 'Sunset Boulevard', 'Synthwave']);
  assert.deepEqual(JSON.parse(JSON.stringify(scol.experimental.map(t => t.name))), ['Cozy Coding', 'Matrix', 'Dracula', 'Aurora'], 'the four rework targets await approval');
  // archived assignments still resolve (nothing destroyed)
  const keep = S.normalizeConfig({ repoAssignments: { 'a/s': 'preset-3', 'a/m': 'preset-2' }, ownerAssignments: { o: 'preset-14', l: 'preset-13' }, defaultThemeId: 'preset-18' });
  assert.equal(S.themeResolution(keep, 'https://github.com/a/s').id, 'preset-3'); assert.equal(S.themeResolution(keep, 'https://github.com/o/x').id, 'preset-14');
  assert.equal(S.themeResolution(keep, 'https://github.com/a/m').id, 'preset-2'); assert.equal(S.themeResolution(keep, 'https://github.com/l/x').id, 'preset-13');
  assert.equal(S.themeResolution(keep, 'https://github.com/z/z').id, 'preset-18', 'an archived global theme keeps applying');
  assert.equal(keep.defaultThemeId, 'preset-18');
  assert.deepEqual(JSON.parse(JSON.stringify(S.themeCollection(keep).inUseArchived.map(t => t.name))), ['Midnight Developer', 'Sakura Dreams', 'Lavender Nights', 'Dark Academia', 'Sunset Boulevard'], 'shown as "archived, still in use" only where assigned');
  assert.deepEqual(JSON.parse(JSON.stringify(S.featuredThemes().map(t => t.id))), ['preset-1', 'preset-7', 'preset-8', 'preset-9', 'preset-10', 'preset-11'], 'approved themes take the six featured slots');
});
test('approved themes take the featured slots; archived themes leave discovery but saved assignments and custom themes keep working', () => {
  const K = coreWithReview({ 'preset-8': 'approved', 'preset-3': 'approved', 'preset-5': 'archived', 'preset-9': 'archived' });
  assert.equal(K.themeStatus('preset-8'), 'approved'); assert.equal(K.themeStatus('preset-5'), 'archived'); assert.equal(K.themeStatus('preset-2'), 'experimental');
  const feat = K.featuredThemes().map(t => t.id);
  assert.deepEqual(JSON.parse(JSON.stringify(feat.slice(0, 2))), ['preset-3', 'preset-8'], 'approved first (catalogue order)');
  assert.ok(!feat.includes('preset-9') && !feat.includes('preset-5') && feat.length === 6, 'archived never featured');
  const config = K.normalizeConfig({ autoAssign: true, repoAssignments: { 'acme/app': 'preset-5' }, ownerAssignments: { octo: 'preset-9' }, defaultThemeId: 'preset-5',
    customThemes: { 'custom-a': { ...K.PRESETS[0], id: 'custom-a', name: 'Mine' } } });
  // nothing is deleted or rewritten
  assert.equal(config.repoAssignments['acme/app'], 'preset-5'); assert.equal(config.ownerAssignments.octo, 'preset-9'); assert.equal(config.defaultThemeId, 'preset-5');
  assert.equal(K.themeResolution(config, 'https://github.com/acme/app').id, 'preset-5', 'archived theme still applies where it is assigned');
  assert.equal(K.themeResolution(config, 'https://github.com/octo/x').id, 'preset-9');
  const col = K.themeCollection(config);
  assert.deepEqual(JSON.parse(JSON.stringify(col.inUseArchived.map(t => t.id).sort())), ['preset-5', 'preset-9'], 'archived-in-use stays reachable in the gallery');
  assert.equal(col.custom.length, 1); assert.ok(!col.approved.concat(col.experimental).some(t => t.id === 'preset-5'));
  // new automatic picks never land on an archived theme
  for (let i = 0; i < 300; i++) assert.ok(!['preset-5', 'preset-9'].includes(K.pickAutoTheme(`owner${i}/repo${i}`, K.normalizeConfig({}))));
});

test('background curation: archived backgrounds leave the picker but stay available to themes that use them; ambience only on its own artwork', () => {
  const vmctx = vm.createContext({ URL, structuredClone, console, Date, Math });
  for (const f of ['shared/theme-review.js', 'shared/wallpaper-catalog.js', 'shared/core.js']) vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '..', f), 'utf8'), vmctx);
  const K = vmctx.RepoVibeCore;
  const visible = K.pickerWallpapers('').map(w => w.slug);
  for (const gone of ['pixel-island', 'galaxy-planet', 'neon-rain-street', 'alien-world', 'synthwave-grid', 'synthwave-highway']) assert.ok(!visible.includes(gone), `${gone} hidden from the picker`);
  for (const kept of ['alpine-lake', 'synthwave-3d', 'arctic-frost-3d', 'pixel-paradise-3d']) assert.ok(visible.includes(kept), `${kept} still offered`);
  assert.ok(K.pickerWallpapers('builtin:galaxy-planet').some(w => w.slug === 'galaxy-planet'), 'a theme already using an archived background still sees it');
  assert.equal(K.WALLPAPERS.length, 38, 'nothing deleted: every background still resolves for saved themes');
  // a Synthwave assignment keeps working
  const cfg = K.normalizeConfig({ repoAssignments: { 'a/b': 'preset-20' } });
  assert.equal(K.themeResolution(cfg, 'https://github.com/a/b').id, 'preset-20');
  // rain (and the other ambience layers) only on the artwork they were made for
  const cyber = K.PRESETS.find(p => p.id === 'preset-1');
  assert.equal(K.motionFor(cyber, { motionMode: 'ambient' }, false).kind, 'rain');
  for (const ref of ['builtin:alpine-lake', 'builtin:synthwave-3d']) assert.equal(K.motionFor({ ...cyber, wallpaperRef: ref }, { motionMode: 'ambient' }, false).kind, 'none', `no rain over ${ref}`);
  assert.equal(K.motionFor({ ...K.PRESETS.find(p => p.id === 'preset-8'), wallpaperRef: 'builtin:alpine-lake' }, { motionMode: 'ambient' }, false).kind, 'none');
});
