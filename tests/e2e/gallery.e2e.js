'use strict';
/* Popup "View All Backgrounds" and the curated Studio gallery: placement, deep link with repository context, keyboard access, groups,
   dynamic counts, search, filters, Apply from the gallery, custom themes. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, extPage, setConfig, getConfig } = require('./helpers');

test('popup: six featured themes, then "View All Backgrounds" directly below; it opens the Studio gallery for this repository', async () => {
  const { context, errors, close } = await launch({ colorScheme: 'dark' });
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-8' });
    const gh = await context.newPage(); await gh.goto('https://github.com/acme/project');
    const tabId = await (await extPage(context, 'popup.html')).evaluate(() => new Promise(r => chrome.tabs.query({ url: 'https://github.com/*' }, t => r(t[0].id))));
    // the popup bound to the GitHub tab, as when the user clicks the toolbar icon there
    const popup = await extPage(context, 'popup.html'); await popup.setViewportSize({ width: 384, height: 900 });
    await popup.waitForFunction(() => document.querySelectorAll('#quickThemes .theme-tile, #quickThemes button').length === 6);
    const layout = await popup.evaluate(() => { const g = document.getElementById('quickThemes'), b = document.getElementById('viewAllBackgrounds'), gr = g.getBoundingClientRect(), br = b.getBoundingClientRect();
      return { next: g.nextElementSibling === b, below: br.top >= gr.bottom - 1 && br.top - gr.bottom < 30, fullWidth: Math.abs(br.width - gr.width) < 2, text: b.innerText, tiles: g.children.length, glow: getComputedStyle(b).boxShadow }; });
    assert.equal(layout.tiles, 6); assert.ok(layout.next && layout.below && layout.fullWidth, JSON.stringify(layout));
    assert.match(layout.text, /View All Backgrounds/); assert.match(layout.text, /Explore the full theme collection · \d+ backgrounds/);
    assert.notEqual(layout.glow, 'none', 'theme-aware glow');
    // keyboard: the button is reachable with Tab and activates with Enter
    await popup.focus('#quickThemes > :last-child'); await popup.keyboard.press('Tab');
    assert.equal(await popup.evaluate(() => document.activeElement.id), 'viewAllBackgrounds');
    const opened = context.waitForEvent('page');
    await popup.keyboard.press('Enter');
    const studio = await opened; await studio.waitForLoadState();
    assert.match(studio.url(), /studio\.html\?view=gallery(&target=\d+)?#gallery$/);
    await studio.waitForFunction(() => document.getElementById('view-gallery').classList.contains('active-view') && document.querySelectorAll('.gallery-card').length > 0);
    assert.equal(await studio.evaluate(() => document.activeElement.id), 'gallerySearch', 'lands on the gallery, ready to search');
    // with an explicit GitHub tab target the Studio keeps the repository context
    const st2 = await extPage(context, `studio.html?view=gallery&target=${tabId}#gallery`);
    await st2.waitForFunction(() => /acme\/project/.test(document.getElementById('targetLabel').textContent));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('gallery: approved / experimental / custom groups with live counts, search, filters, current theme, Apply keeps other settings', async () => {
  const { context, errors, close } = await launch({ colorScheme: 'dark' });
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-8', motionMode: 'cinematic', appearance: 'balanced', repoAssignments: { 'acme/other': 'preset-11' },
      customThemes: { 'custom-mine': { id: 'custom-mine', name: 'My Night Theme', description: 'mine', bg: '#101010', surface: '#202020', surfaceAlt: '#303030', text: '#ffffff', muted: '#bbbbbb', accent: '#ff00aa', border: '#444444', gradientTo: '#000000', gradientThird: '#111111', code: '#000000' } } });
    const studio = await extPage(context, 'studio.html?view=gallery#gallery'); await studio.setViewportSize({ width: 1400, height: 1000 });
    await studio.waitForSelector('.gallery-group');
    const info = await studio.evaluate(() => ({ total: RepoVibeCore.PRESETS.length, groups: Object.fromEntries([...document.querySelectorAll('.gallery-group')].map(g => [g.dataset.group, g.querySelectorAll('.gallery-card').length])),
      chips: Object.fromEntries([...document.querySelectorAll('.filter-chip')].map(c => [c.dataset.filter, +c.querySelector('.chip-count').textContent])), count: document.getElementById('galleryCount').textContent,
      current: [...document.querySelectorAll('.gallery-card.is-current')].map(c => c.querySelector('strong').firstChild.textContent) }));
    // owner's review (shared/theme-review.js): five approved, Synthwave archived (hidden: not in use here), everything else experimental
    assert.equal(info.groups.approved, 6, 'the six owner-approved themes'); assert.equal(info.groups.experimental, info.total - 9); assert.equal(info.groups.custom, 1);
    assert.equal(info.groups.inUseArchived, undefined, 'an archived theme nobody uses does not clutter the gallery');
    const approvedNames = await studio.evaluate(() => [...document.querySelectorAll('.gallery-group[data-group="approved"] .gallery-card strong')].map(s => s.firstChild.textContent));
    assert.deepEqual([...approvedNames].sort(), ['Arctic Frost', 'Cosmic Galaxy', 'Enchanted Forest', 'Futuristic Sci-Fi', 'Ocean Depths', 'Pixel Paradise']);
    const shownNames = await studio.evaluate(() => [...document.querySelectorAll('.gallery-card strong')].map(s => s.firstChild.textContent));
    for (const gone of ['Synthwave', 'Sakura Dreams', 'Dark Academia']) assert.ok(!shownNames.includes(gone), `archived ${gone} is not shown`);
    assert.equal(info.chips.all, info.total - 2, 'the count comes from the data (17 visible built-ins + 1 custom)'); assert.match(info.count, new RegExp(`^${info.total - 2} backgrounds · 6 approved · ${info.total - 9} experimental · 1 custom$`));
    assert.deepEqual(info.current, ['Enchanted Forest'], 'current theme identified');
    // search by name
    await studio.fill('#gallerySearch', 'ocean');
    assert.deepEqual(await studio.evaluate(() => [...document.querySelectorAll('.gallery-card strong')].map(s => s.firstChild.textContent)), ['Ocean Depths']);
    await studio.fill('#gallerySearch', '');
    // filters
    await studio.click('.filter-chip[data-filter="custom"]');
    assert.deepEqual(await studio.evaluate(() => [...document.querySelectorAll('.gallery-group')].map(g => g.dataset.group)), ['custom']);
    assert.equal(await studio.getAttribute('.filter-chip[data-filter="custom"]', 'aria-pressed'), 'true');
    await studio.click('.filter-chip[data-filter="experimental"]');
    assert.deepEqual(await studio.evaluate(() => [...document.querySelectorAll('.gallery-group')].map(g => g.dataset.group)), ['experimental']);
    await studio.click('.filter-chip[data-filter="approved"]');
    assert.deepEqual(await studio.evaluate(() => [...document.querySelectorAll('.gallery-group')].map(g => g.dataset.group)), ['approved']);
    assert.equal(await studio.locator('.gallery-group[data-group="approved"] .gallery-card').count(), 6);
    await studio.click('.filter-chip[data-filter="all"]');
    // Apply (global target outside a repository) changes only the theme
    await studio.locator('.gallery-card', { hasText: 'Cosmic Galaxy' }).locator('button', { hasText: 'Apply' }).click();
    await studio.waitForFunction(async () => (await RepoVibeCore.loadConfig()).defaultThemeId === 'preset-19');
    const c = await getConfig(context);
    assert.equal(c.motionMode, 'cinematic'); assert.equal(c.appearance, 'balanced'); assert.equal(c.repoAssignments['acme/other'], 'preset-11'); assert.ok(c.customThemes['custom-mine'], 'custom theme kept');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
