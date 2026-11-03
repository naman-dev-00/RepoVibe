'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({URL, structuredClone, console, Date, Math});
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
  const theme = C.normalizeTheme({...C.PRESETS[0], bg:'red; color:transparent', wallpaper:'url(https://evil.example/track)', backgroundMode:'image'});
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
  assert.deepEqual(light, ['Arctic Frost', 'Minimal White', 'Sakura Dreams']);
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
