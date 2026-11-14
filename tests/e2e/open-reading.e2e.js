'use strict';
/* "Text only" readability backing (default): prose containers (README markdown, sidebar, footer) lose their broad
   surface; each text block gets its own compact backing and empty space shows the scene. Dense UI keeps its panel. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, extPage, setConfig, visualContrast } = require('./helpers');

const updateConfig = (context, src) => extPage(context).then(async p => {
  await p.waitForFunction(() => !!globalThis.RepoVibeCore);
  await p.evaluate(s => RepoVibeCore.updateConfig(new Function('c', s)), src);
  await p.close();
});
const README = `<div class="Layout-sidebar" id="tSide" style="position:absolute;right:40px;top:260px;width:260px"><div class="BorderGrid-row"><h2>About</h2><p>Action for checking out a repo</p><a href="/acme/other">Readme</a><div class="insights"><span id="tStat">202 watching</span></div></div></div>
<article class="markdown-body" id="tMd" style="margin:40px 320px 0 40px;min-height:820px">
<h1>Checkout v7</h1><p>Only two short lines of README text here.</p>
<ul><li>First item</li><li>Second item with <a href="/acme/other">a link</a></li></ul>
<p align="center">Centred note</p><pre><code>uses: actions/checkout@v7</code></pre><table><tr><th>Input</th><td>token</td></tr></table></article>`;
const alpha = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return p.length > 3 ? p[3] : 1; };

test('text-only readability backing: compact per-block backings, empty space open, AA text, Full panels and restore', async () => {
  const { context, errors, close } = await launch();
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-8', motionMode: 'static' }); // readingBacking defaults to 'text'
    const page = await context.newPage(); await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('https://github.com/acme/project/layout');
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-open'));
    await page.evaluate(html => { document.querySelector('main, .application-main, body').insertAdjacentHTML('beforeend', html); }, README);
    await page.evaluate(() => document.getElementById('tMd').scrollIntoView());
    // plain-span text (no named element) is caught by the runtime safety net
    await page.waitForFunction(() => document.getElementById('tStat').hasAttribute('data-repv-text'));
    const s = await page.evaluate(() => {
      const bg = e => getComputedStyle(e).backgroundColor, md = document.getElementById('tMd'), r = md.getBoundingClientRect();
      const q = sel => md.querySelector(sel);
      const stack = (x, y) => document.elementsFromPoint(x, y).filter(e => e !== document.documentElement).map(e => bg(e));
      const last = [...md.children].at(-1).getBoundingClientRect();
      return { md: bg(md), h1: bg(q('h1')), p: bg(q('p')), li: bg(q('li')), liA: bg(q('li a')), pre: bg(q('pre')), table: bg(q('table')),
        pWidth: q('p').getBoundingClientRect().width, mdWidth: r.width,
        centred: (() => { const c = q('p[align="center"]').getBoundingClientRect(); return Math.abs((c.left + c.right) / 2 - (r.left + r.right) / 2); })(),
        below: stack(r.left + 30, Math.min(innerHeight - 5, last.bottom + 60)), beside: stack(r.right - 20, q('p').getBoundingClientRect().top + 8),
        side: bg(document.getElementById('tSide')), sideRow: bg(document.querySelector('#tSide .BorderGrid-row')), sideH2: bg(document.querySelector('#tSide h2')), sideA: bg(document.querySelector('#tSide a')) };
    });
    // broad surfaces are gone
    assert.equal(alpha(s.md), 0, `README has no broad backing (${s.md})`);
    // sidebar sections are anchored by a light surface + themed frame (not a reading panel): alpha stays low
    for (const k of ['side', 'sideRow']) assert.ok(alpha(s[k]) <= 0.35, `${k}: only a light anchoring surface (${s[k]})`);
    // each text block has its own backing; nested inline text does not stack a second one
    s.stat = await page.evaluate(() => getComputedStyle(document.getElementById('tStat')).backgroundColor);
    for (const k of ['h1', 'p', 'li', 'sideH2', 'sideA', 'stat']) assert.ok(alpha(s[k]) >= 0.5, `${k} backed (${s[k]})`);
    assert.equal(alpha(s.liA), 0, 'a link inside a backed list item is not double-backed');
    // compact: the backing hugs the text, centred blocks stay centred
    assert.ok(s.pWidth < s.mdWidth * 0.6, `paragraph backing hugs its text (${s.pWidth} of ${s.mdWidth})`);
    assert.ok(s.centred < 4, `align=center block stays centred (${s.centred}px off)`);
    // empty space below and beside text shows the scene: nothing painted over it
    assert.ok(s.below.every(c => alpha(c) < 0.02), `space below the README text is open: ${s.below}`);
    assert.ok(s.beside.every(c => alpha(c) < 0.02), `space beside a short paragraph is open: ${s.beside}`);
    // code and tables keep strong backing
    assert.ok(alpha(s.pre) >= 0.9, `code block backing ${s.pre}`); assert.ok(alpha(s.table) >= 0.8, `table backing ${s.table}`);
    const contrast = await visualContrast(context, page);
    assert.equal(contrast.below45, 0, `all text ≥ 4.5:1 (${JSON.stringify(contrast.low.slice(0, 5))})`);
    // "Full panels" brings the broad surface back; the setting is live
    await updateConfig(context, "c.readingBacking = 'panels';");
    await page.waitForFunction(() => !document.documentElement.classList.contains('repv-open'));
    assert.ok(alpha(await page.evaluate(() => getComputedStyle(document.getElementById('tMd')).backgroundColor)) >= 0.8, 'full panel restored');
    await updateConfig(context, "c.readingBacking = 'text'; c.enabled = false;");
    await page.waitForFunction(() => !document.documentElement.className.includes('repv'));
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#tMd p')).width === getComputedStyle(document.querySelector('#tMd')).width), true, 'disabled: native block layout');
    assert.equal(await page.evaluate(() => document.querySelectorAll('[data-repv-text]').length), 0, 'disabled: no text markers left');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('sticky rows that stay pinned while their panel scrolls away get a solid backing (live finding: file-table header over the scene)', async () => {
  const { context, errors, close } = await launch();
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-1', motionMode: 'static' });
    const page = await context.newPage(); await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('https://github.com/acme/project/layout');
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-active'));
    await page.evaluate(() => {
      const box = document.createElement('div'); box.className = 'Box'; box.id = 'tBox'; box.style.margin = '20px 40px';
      box.innerHTML = '<div id="tSticky" style="position:sticky;top:0;z-index:1;padding:8px">latest commit · prep v7.0.1 release (#2531) · Jul 17</div>' + Array.from({ length: 60 }, (_, i) => `<div style="padding:8px">file-${i}.json</div>`).join('');
      (document.querySelector('main, .application-main') || document.body).appendChild(box);
    });
    await page.waitForFunction(() => document.getElementById('tSticky').hasAttribute('data-repv-sticky'));
    await page.evaluate(() => { const b = document.getElementById('tBox'); window.scrollTo(0, b.getBoundingClientRect().top + scrollY + 1200); });
    await page.waitForTimeout(300);
    const st = await page.evaluate(() => { const e = document.getElementById('tSticky'); return { top: Math.round(e.getBoundingClientRect().top), bg: getComputedStyle(e).backgroundColor }; });
    assert.ok(st.top <= 2, `the row is pinned at the top (${st.top})`);
    assert.ok(alpha(st.bg) >= 0.9, `pinned row has a solid backing (${st.bg})`);
    const contrast = await visualContrast(context, page);
    assert.equal(contrast.below45, 0, JSON.stringify(contrast.low.slice(0, 3)));
    await updateConfig(context, 'c.enabled = false;');
    await page.waitForFunction(() => !document.querySelector('[data-repv-sticky]'));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test("GitHub's transparent read-only code overlay (textarea over the code lines) is never painted by input styling", async () => {
  const { context, errors, close } = await launch();
  try {
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-15' });
    const page = await context.newPage(); await page.goto('https://github.com/acme/project');
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-active'));
    const s = await page.evaluate(() => { const t = document.getElementById('read-only-cursor-text-area'), cs = getComputedStyle(t); const ref = getComputedStyle(document.createElement('textarea'));
      const probe = document.createElement('textarea'); document.body.appendChild(probe); const ps = getComputedStyle(probe); const out = { shadow: cs.boxShadow, bg: cs.backgroundColor, inputShadow: ps.boxShadow, inputBg: ps.backgroundColor }; probe.remove(); void ref; return out; });
    assert.equal(s.shadow, 'none', 'no themed ring/glow on the code overlay');
    assert.notEqual(s.bg, s.inputBg, 'the code overlay does not receive the themed control background');
    assert.notEqual(s.inputShadow, 'none', 'ordinary textareas are still themed');
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('README inside GitHub\'s new bordered card (no #readme id) is an open frame, not a tinted panel (live regression)', async () => {
  const { context, errors, close } = await launch();
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-8', motionMode: 'static' });
    const page = await context.newPage(); await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('https://github.com/acme/project/layout');
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-open'));
    // Markup as served by github.com in Nov 2026: one rounded, bordered card holding the README tab bar and the article
    await page.evaluate(() => {
      const paras = Array.from({ length: 6 }, (_, i) => `<h2>Section ${i + 1}</h2><p>Short paragraph ${i + 1}.</p><ul><li>Item A</li><li>Item B</li></ul>`).join('');
      (document.querySelector('main, .application-main') || document.body).insertAdjacentHTML('beforeend',
        `<div id="tCard" style="margin:30px 340px 0 40px;border:1px solid #30363d;border-radius:6px"><nav id="tTabs" style="display:flex;gap:16px;padding:8px 16px;border-bottom:1px solid #30363d"><a href="#">README</a><a href="#">Code of conduct</a></nav><article class="markdown-body" style="padding:24px">${paras}</article></div>`);
    });
    await page.waitForFunction(() => document.getElementById('tCard').hasAttribute('data-repv-frame'));
    await page.evaluate(() => document.getElementById('tCard').scrollIntoView({ block: 'start' }));
    await page.waitForFunction(() => document.querySelector('#tCard p').hasAttribute('data-repv-text') || getComputedStyle(document.querySelector('#tCard p')).backgroundColor !== 'rgba(0, 0, 0, 0)');
    const s = await page.evaluate(() => { const c = document.getElementById('tCard'), cs = getComputedStyle(c), r = c.getBoundingClientRect(), p = c.querySelector('p').getBoundingClientRect();
      const under = document.elementsFromPoint(r.right - 30, p.top + 4).filter(e => e !== document.documentElement).map(e => getComputedStyle(e).backgroundColor);
      return { panel: c.hasAttribute('data-repv-panel'), bg: cs.backgroundColor, backdrop: cs.backdropFilter, shadow: cs.boxShadow, border: cs.borderTopWidth, under, pBg: getComputedStyle(c.querySelector('p')).backgroundColor, tabBg: getComputedStyle(c.querySelector('#tTabs a')).backgroundColor }; });
    assert.equal(s.panel, false, 'not a dense panel');
    assert.equal(alpha(s.bg), 0, `no broad surface behind the README (${s.bg})`); assert.equal(s.backdrop, 'none', 'no backdrop blur');
    assert.notEqual(s.shadow, 'none', 'themed frame glow kept');
    assert.ok(s.under.every(c => alpha(c) < 0.02), `empty space beside the text shows the scene: ${s.under}`);
    assert.ok(alpha(s.pBg) >= 0.5 && alpha(s.tabBg) >= 0.3, `text keeps compact backings (p ${s.pBg}, tab ${s.tabBg})`);
    const contrast = await visualContrast(context, page);
    assert.equal(contrast.fails.length, 0, `WCAG AA: ${contrast.failSummary}`);
    // "Full panels" still gives the card its broad surface back
    await updateConfig(context, "c.readingBacking = 'panels';");
    await page.waitForFunction(() => !document.documentElement.classList.contains('repv-open'));
    await page.waitForFunction(() => document.getElementById('tCard').hasAttribute('data-repv-panel') || !document.getElementById('tCard').hasAttribute('data-repv-frame'));
    await updateConfig(context, 'c.enabled = false;');
    await page.waitForFunction(() => !document.querySelector('[data-repv-frame], [data-repv-panel]'));
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('code-view file tree is a readable panel over bright scenery (live finding: ".github" 2.01:1 over the Sunset sky)', async () => {
  const { context, errors, close } = await launch();
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: true, defaultThemeId: 'preset-18', motionMode: 'static' });
    const page = await context.newPage(); await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('https://github.com/acme/project/layout');
    await page.waitForFunction(() => document.documentElement.classList.contains('repv-active'));
    await page.evaluate(() => (document.querySelector('main, .application-main') || document.body).insertAdjacentHTML('afterbegin',
      `<nav aria-label="File Tree Navigation" id="tTree" style="position:absolute;left:12px;top:120px;width:260px"><ul role="tree">${['.github', '.licenses/npm', '__test__', 'adrs', 'dist', 'images', 'src', '.gitattributes'].map(n => `<li role="treeitem"><div style="padding:6px 10px"><span>${n}</span></div></li>`).join('')}</ul></nav>`));
    await page.waitForTimeout(500);
    const bg = await page.evaluate(() => [document.getElementById('tTree'), document.querySelector('#tTree [role="tree"]')].map(e => getComputedStyle(e).backgroundColor).find(c => c !== 'rgba(0, 0, 0, 0)') || 'rgba(0, 0, 0, 0)');
    const a = (bg.match(/[\d.]+/g) || []).map(Number); assert.ok((a.length > 3 ? a[3] : 1) >= 0.6, `file tree has a panel surface (${bg})`);
    const contrast = await visualContrast(context, page);
    assert.equal(contrast.fails.length, 0, `WCAG AA: ${contrast.failSummary}`);
    assert.deepEqual(errors, []);
  } finally { await close(); }
});

test('themed borders: ~3 px edge (1 px border + 2 px ring) with glow and inner highlight on major surfaces, no layout shift, no glow on text', async () => {
  const { context, errors, close } = await launch();
  try {
    context.setDefaultTimeout(30000);
    await setConfig(context, { enabled: false });
    const page = await context.newPage(); await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('https://github.com/acme/project/layout');
    await page.evaluate(html => document.querySelector('main, .application-main, body').insertAdjacentHTML('beforeend', html), README);
    const size = () => page.evaluate(() => ['tMd', 'tSide'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
    const before = await size();
    for (const [id, edge] of [['preset-8', [94, 224, 193]], ['preset-3', [255, 143, 184]], ['preset-7', [79, 213, 232]]]) {
      await updateConfig(context, `c.enabled = true; c.defaultThemeId = '${id}'; c.motionMode = 'static';`);
      await page.waitForFunction(() => document.documentElement.classList.contains('repv-open'));
      await page.waitForTimeout(300);
      const s = await page.evaluate(() => { const g = e => { const cs = getComputedStyle(e); return { border: cs.borderTopStyle !== 'none' ? cs.borderTopWidth : cs.outlineStyle !== 'none' ? cs.outlineWidth : '0px', color: cs.borderTopStyle !== 'none' ? cs.borderTopColor : cs.outlineColor, shadow: cs.boxShadow }; };
        return { md: g(document.getElementById('tMd')), side: g(document.querySelector('#tSide .BorderGrid-row')), p: getComputedStyle(document.querySelector('#tMd p')).boxShadow, h1: getComputedStyle(document.querySelector('#tMd h1')).textShadow }; });
      for (const k of ['md', 'side']) {
        assert.equal(s[k].border, '1px', `${id} ${k}: 1 px themed line (border, or an inset outline where GitHub draws none)`);
        assert.match(s[k].shadow, /0px 0px 0px 2px/, `${id} ${k}: 2 px themed ring (total ≈ 3 px edge): ${s[k].shadow}`);
        assert.match(s[k].shadow, /0px 0px 0px 1px inset/, `${id} ${k}: subtle inner highlight`);
        assert.ok((s[k].shadow.match(/rgba?\(/g) || []).length >= 4, `${id} ${k}: ring + near/far glow + inner light`);
        const c = (s[k].color.match(/\d+/g) || []).map(Number); assert.ok(Math.abs(c[0] - edge[0]) + Math.abs(c[1] - edge[1]) + Math.abs(c[2] - edge[2]) < 30, `${id} ${k}: theme-matching edge colour ${s[k].color}`);
      }
      assert.doesNotMatch(s.p, /0px 0px 0px 2px/, 'text blocks do not get the heavy outline');
      // the edge is drawn with box-shadow rings and an inset outline: the README box keeps its native size, and the size of every surface is the
      // same whatever the theme (the sidebar's pre-existing 12 px framing padding is the only intended difference from native GitHub)
      const now = await size(); assert.deepEqual(now[0], before[0], `${id}: README box unchanged`);
      if (!globalThis.__firstSize) globalThis.__firstSize = now; assert.deepEqual(now, globalThis.__firstSize, `${id}: same geometry in every theme`);
    }
    assert.deepEqual(errors, []);
  } finally { await close(); }
});
