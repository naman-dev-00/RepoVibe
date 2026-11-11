'use strict';
/* The screenshot contrast measurement must apply WCAG 1.4.3 per element: normal text needs 4.5:1, only large text (>= 24 px, or >= 18.66 px bold)
   may stop at 3:1, and disabled controls are exempt. (A live reading of 4.06:1 used to be accepted because the gate was 3:1 for everything.) */
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch, setConfig, visualContrast } = require('./helpers');

test('visualContrast flags normal text under 4.5:1, allows large text at 3:1 and ignores disabled controls', async () => {
  const { context, errors, close } = await launch({ colorScheme: 'light' });
  try {
    await setConfig(context, { enabled: false });   // plain page: the checker itself is under test, not RepoVibe's styling
    const page = await context.newPage(); await page.setViewportSize({ width: 900, height: 600 });
    await page.goto('https://github.com/acme/project/layout');
    await page.evaluate(() => {
      document.documentElement.innerHTML = '<head><style>html,body{background:#fff !important;color-scheme:light}</style></head><body style="margin:0"></body>';
      for (const a of [...document.documentElement.attributes]) document.documentElement.removeAttribute(a.name);
      document.documentElement.style.background = '#fff';
      const add = (id, css, text, attrs = '') => document.body.insertAdjacentHTML('beforeend', `<div ${attrs} id="${id}" style="position:absolute;left:20px;${css}">${text}</div>`);
      add('ok', 'top:20px;font:16px sans-serif;color:#767676', 'Normal text 4.54:1');            // passes AA
      add('bad', 'top:80px;font:16px sans-serif;color:#858585', 'Normal text 3.54:1');           // fails AA (needs 4.5)
      add('bad2', 'top:140px;font:16px sans-serif;color:#949494', 'Normal text 3.03:1');         // fails AA
      add('large', 'top:200px;font:28px sans-serif;color:#858585', 'Large text 3.54:1');         // passes (large text needs 3)
      add('boldlarge', 'top:260px;font:700 19px sans-serif;color:#858585', 'Bold 19px text 3.54:1'); // passes (large bold)
      add('largebad', 'top:320px;font:28px sans-serif;color:#b0b0b0', 'Large text 2.1:1');      // fails even as large text
      add('dis', 'top:400px;font:16px sans-serif;color:#b0b0b0', 'Disabled control', 'aria-disabled="true"'); // exempt
    });
    const vc = await visualContrast(context, page);
    const failed = vc.fails.map(f => f.text).sort();
    assert.deepEqual(failed, ['Large text 2.1:1', 'Normal text 3.03:1', 'Normal text 3.54:1'], `AA verdicts: ${vc.failSummary}`);
    const by = Object.fromEntries(vc.fails.map(f => [f.text, f]));
    assert.equal(by['Normal text 3.54:1'].required, 4.5); assert.equal(by['Large text 2.1:1'].required, 3);
    assert.ok(vc.below3.length < vc.fails.length, 'the old 3:1 gate would have accepted a normal-text failure that the AA verdict rejects');
    assert.deepEqual(errors.filter(e => !/Failed to load resource/.test(e)), []);
  } finally { await close(); }
});
