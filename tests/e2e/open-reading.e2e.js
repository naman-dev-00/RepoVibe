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
