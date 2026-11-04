#!/usr/bin/env node
'use strict';
/* Verifies RepoVibe-Extension.zip is a complete, minimal-permission MV3 package. Exits non-zero on any problem. */
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const zip = path.resolve(process.argv[2] || 'RepoVibe-Extension.zip');
const problems = [];
const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter(Boolean);
const files = new Set(entries.filter(e => !e.endsWith('/')));
let manifest;
try { manifest = JSON.parse(execFileSync('unzip', ['-p', zip, 'manifest.json'], { encoding: 'utf8' })); }
catch (e) { console.error(`manifest.json missing or invalid: ${e.message}`); process.exit(1); }

if (manifest.manifest_version !== 3) problems.push(`manifest_version is ${manifest.manifest_version}, expected 3`);
if (manifest.version !== require('../package.json').version) problems.push(`manifest version ${manifest.version} != package.json version`);
if (JSON.stringify(manifest.permissions) !== JSON.stringify(['storage'])) problems.push(`unexpected permissions ${JSON.stringify(manifest.permissions)}`);
if (JSON.stringify(manifest.host_permissions) !== JSON.stringify(['https://github.com/*'])) problems.push(`unexpected host_permissions ${JSON.stringify(manifest.host_permissions)}`);
if (manifest.content_security_policy) problems.push('custom content_security_policy present; review required');

const required = new Set(['manifest.json', manifest.action?.default_popup, manifest.options_page, manifest.background?.service_worker,
  ...Object.values(manifest.icons || {}), ...Object.values(manifest.action?.default_icon || {}),
  ...(manifest.content_scripts || []).flatMap(cs => [...(cs.js || []), ...(cs.css || [])])]);
for (const page of ['popup.html', 'studio.html']) {
  // Every local script/stylesheet the extension pages reference.
  const html = execFileSync('unzip', ['-p', zip, page], { encoding: 'utf8' });
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^[a-z]+:/i.test(ref)) problems.push(`${page} references remote resource ${ref}`);
    else required.add(ref);
  }
}
// Service worker importScripts() dependencies and every bundled wallpaper + thumbnail.
if (manifest.background?.service_worker) {
  const sw = execFileSync('unzip', ['-p', zip, manifest.background.service_worker], { encoding: 'utf8' });
  for (const [, list] of sw.matchAll(/importScripts\(([^)]*)\)/g)) for (const [, f] of list.matchAll(/'([^']+)'/g)) required.add(f);
}
const catalogSrc = execFileSync('unzip', ['-p', zip, 'shared/wallpaper-catalog.js'], { encoding: 'utf8' });
const catalog = JSON.parse(catalogSrc.slice(catalogSrc.indexOf('['), catalogSrc.lastIndexOf(']') + 1));
const wallpaperSlugs = catalog.map(w => w.slug);
const threeD = catalog.filter(w => w.style === '3d').length;
if (wallpaperSlugs.length < 10) problems.push(`expected at least 10 bundled wallpapers, found ${wallpaperSlugs.length}`);
for (const slug of wallpaperSlugs) { required.add(`wallpapers/${slug}.webp`); required.add(`wallpapers/thumbs/${slug}.webp`); }
// 2.5D depth layers declared by the catalogue (pre-rendered slabs for the parallax engine)
const depthLayers = catalog.flatMap(w => (w.depth || []).map(l => `wallpapers/depth/${w.slug}/${l}.webp`));
for (const f of depthLayers) required.add(f);
if (catalog.filter(w => (w.depth || []).length).length < 4) problems.push('expected depth layers for the four flagship worlds');
if (!files.has('wallpapers/LICENSE.md')) problems.push('missing wallpapers/LICENSE.md');
for (const war of manifest.web_accessible_resources || []) {
  if (JSON.stringify(war.matches) !== JSON.stringify(['https://github.com/*'])) problems.push(`web_accessible_resources exposed beyond github.com: ${JSON.stringify(war.matches)}`);
}
for (const file of required) if (file && !files.has(file)) problems.push(`missing required file: ${file}`);
for (const file of files) if (/^(tests|scripts|node_modules|\.github)\//.test(file) || file.endsWith('.zip')) problems.push(`unexpected file in package: ${file}`);

if (problems.length) { console.error(`Package verification FAILED:\n - ${problems.join('\n - ')}`); process.exit(1); }
console.log(`Package OK: MV3 v${manifest.version}, ${files.size} files, ${wallpaperSlugs.length} wallpapers (${threeD} 3D), ${depthLayers.length} depth layers, permissions ${JSON.stringify(manifest.permissions)}, hosts ${JSON.stringify(manifest.host_permissions)}`);
console.log([...files].sort().map(f => `  ${f}`).join('\n'));
