'use strict';
/* Live github.com acceptance harness. Talks to the REAL github.com, logged out, with no credentials.
   Rules: never bypass access controls. A 403/429, login redirect, CAPTCHA/abuse page or network refusal
   is recorded as BLOCKED (test skipped), never retried around and never reported as a pass. */
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const OUT = path.join(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });
const results = [];

class Blocked extends Error {}

function record(scenario, target, status, detail = '') {
  results.push({ scenario, target, status, detail: String(detail).slice(0, 400), at: new Date().toISOString() });
  console.log(`[live] ${status.padEnd(7)} ${scenario} · ${target}${detail ? ` · ${String(detail).slice(0, 200)}` : ''}`);
}

const slug = s => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 80);

/** Navigate to a real github.com URL; throw Blocked if GitHub refuses or challenges us. */
async function gotoLive(page, url) {
  const failedAssets = [];
  const onFail = req => { if (/githubassets\.com|githubusercontent\.com/.test(req.url())) failedAssets.push(`${new URL(req.url()).hostname}: ${req.failure()?.errorText}`); };
  page.on('requestfailed', onFail);
  try { return await gotoLiveInner(page, url, failedAssets); } finally { page.off('requestfailed', onFail); }
}
async function gotoLiveInner(page, url, failedAssets) {
  let response;
  try { response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }); }
  catch (e) { throw new Blocked(`navigation to ${url} failed: ${e.message.split('\n')[0]}`); }
  await assertNotBlocked(page, response, url);
  await settle(page);
  // A page is only valid evidence if GitHub's own stylesheets loaded. --fgColor-danger is a Primer token
  // RepoVibe never sets, so it is empty exactly when GitHub's CSS (github.githubassets.com) is missing.
  const styled = await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--fgColor-danger').trim() !== '', null, { timeout: 15000 }).then(() => true, () => false);
  if (!styled) throw new Blocked(`GitHub HTML loaded but its stylesheets did not (degraded page is not valid evidence)${failedAssets.length ? `; failed assets: ${[...new Set(failedAssets)].slice(0, 3).join(', ')}` : ''}`);
  return response;
}
async function assertNotBlocked(page, response, url) {
  const status = response ? response.status() : 0;
  if ([401, 403, 407, 429].includes(status) || status >= 500) throw new Blocked(`HTTP ${status} for ${url}`);
  const now = new URL(page.url());
  if (now.hostname !== 'github.com') throw new Blocked(`redirected off github.com to ${now.hostname}`);
  if (/^\/(login|session|sessions)\b/.test(now.pathname)) throw new Blocked(`authentication required (redirected to ${now.pathname})`);
  // Challenge/abuse pages are short and say so; normal repository pages can mention "rate limit" in content.
  const text = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 4000) : '').catch(() => '');
  if (text.length < 1500 && /too many requests|whoa there|captcha|verify you are (a )?human|unusual traffic|secondary rate limit/i.test(text)) {
    throw new Blocked(`GitHub challenge/rate-limit page for ${url}: ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
  }
}
/** GitHub keeps long-lived connections open, so networkidle never arrives; wait for load plus a short settle. */
async function settle(page, ms = 1500) {
  await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/** RepoVibe state on the page, read from the main world (CSS vars/classes/attributes are shared). */
const themeState = page => page.evaluate(() => {
  const root = document.documentElement, cs = getComputedStyle(root);
  const v = name => cs.getPropertyValue(name).trim();
  const header = document.querySelector('.AppHeader, header.Header, header[role="banner"], .js-header-wrapper header');
  return {
    url: location.href,
    active: root.classList.contains('repv-active'),
    style: !!document.getElementById('repovibe-style-v1'),
    mode: root.getAttribute('data-color-mode'),
    writtenMode: root.getAttribute('data-repv-color-mode'),
    originalMode: root.getAttribute('data-repv-original-color-mode'),
    colorScheme: cs.colorScheme,
    bgDefault: v('--bgColor-default'), fgDefault: v('--fgColor-default'), accent: v('--fgColor-accent'),
    fgDanger: v('--fgColor-danger'), fgSuccess: v('--fgColor-success'),
    htmlBgImage: cs.backgroundImage.slice(0, 60),
    bodyColor: getComputedStyle(document.body).color,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    wallpaper: getComputedStyle(document.body, '::before').backgroundImage.slice(0, 40),
    wallpaperFilter: getComputedStyle(document.body, '::before').filter,
    headerFound: !!header, headerBg: header ? getComputedStyle(header).backgroundColor : null,
    title: document.title
  };
});

/** Computed-style fingerprint used to prove GitHub's original appearance is restored exactly. */
const fingerprint = page => page.evaluate(() => {
  const pick = sel => { const el = document.querySelector(sel); if (!el) return null; const c = getComputedStyle(el); return [c.color, c.backgroundColor, c.backgroundImage.slice(0, 40), c.borderTopColor, c.fontFamily.slice(0, 40), c.maxWidth].join('|'); };
  const root = document.documentElement;
  return {
    mode: root.getAttribute('data-color-mode'),
    classes: [...root.classList].filter(c => c.startsWith('repv')).join(' '),
    repvAttrs: [...root.attributes].filter(a => a.name.startsWith('data-repv')).map(a => a.name).join(' '),
    html: pick('html'), body: pick('body'), header: pick('.AppHeader, header'), main: pick('main, [role="main"]'),
    link: pick('main a, a'), border: pick('.Box, .border, [class*="Box-"]'), container: pick('.container-xl, .container-lg')
  };
});

/** Readability audit: visible text elements whose contrast with their effective background is < 3:1. */
const readability = (page, fallbackBg) => page.evaluate(fallback => {
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = c => [c.r, c.g, c.b].map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }).reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const base = parse(fallback) || { r: 255, g: 255, b: 255, a: 1 };
  const bgOf = el => {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 0.99) break; }
    }
    return layers.reverse().reduce((under, top) => blend(top, under), base);
  };
  const out = { checked: 0, low: 0, samples: [] };
  for (const el of document.querySelectorAll('body *')) {
    if (out.checked >= 800) break;
    if (!(el instanceof HTMLElement) || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'TEMPLATE'].includes(el.tagName)) continue;
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight * 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || Number(cs.opacity) < 0.4 || cs.display === 'none' || cs.clipPath !== 'none' && cs.clipPath !== '') continue;
    let fg = parse(cs.color); if (!fg || fg.a < 0.2) continue;
    const bg = bgOf(el); if (fg.a < 1) fg = blend(fg, bg);
    out.checked++;
    const cr = ratio(fg, bg);
    if (cr < 3) { out.low++; if (out.samples.length < 12) out.samples.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} "${el.textContent.trim().slice(0, 30)}" ${cr.toFixed(2)}:1`); }
  }
  return out;
}, fallbackBg);

/** Errors attributable to RepoVibe (content script or extension pages), separate from GitHub's own noise. */
function watchErrors(context) {
  const extension = [], github = [];
  const watch = page => {
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const loc = m.location()?.url || '';
      const line = `${page.url().slice(0, 80)}: ${m.text().slice(0, 300)}`;
      if (loc.startsWith('chrome-extension://') || /repovibe|repv-/i.test(m.text()) || page.url().startsWith('chrome-extension://')) extension.push(line); else github.push(line);
    });
    page.on('pageerror', e => {
      const line = `${page.url().slice(0, 80)}: ${e.message.slice(0, 300)}`;
      if (/chrome-extension:\/\/|repovibe|repv-/i.test(`${e.stack}`) || page.url().startsWith('chrome-extension://')) extension.push(line); else github.push(line);
    });
  };
  context.on('page', watch);
  context.pages().forEach(watch);
  return { extension, github };
}

async function shot(page, name) {
  const file = path.join(OUT, `${slug(name)}.png`);
  await page.screenshot({ path: file }).catch(() => {});
  return file;
}
async function debugDump(page, name, extra = {}) {
  const base = path.join(OUT, `FAIL-${slug(name)}`);
  await page.screenshot({ path: `${base}.png`, fullPage: false }).catch(() => {});
  const html = await page.content().catch(() => '');
  fs.writeFileSync(`${base}.html`, html.slice(0, 2_000_000));
  const state = await themeState(page).catch(e => ({ error: e.message }));
  fs.writeFileSync(`${base}.json`, JSON.stringify({ ...extra, state }, null, 2));
}

/** Wraps a live scenario: BLOCKED → skipped and recorded; assertion failure → debug artifacts + FAIL. */
function liveTest(name, fn) {
  test(name, async t => {
    const ctx = { pages: [] };
    try {
      await fn(t, ctx);
    } catch (e) {
      if (e instanceof Blocked) { record(name, '-', 'BLOCKED', e.message); t.skip(`BLOCKED: ${e.message}`); return; }
      for (const p of ctx.pages) if (!p.isClosed()) await debugDump(p, `${name}-${ctx.pages.indexOf(p)}`, { error: e.message });
      record(name, '-', 'FAIL', e.message);
      throw e;
    }
  });
}

function writeSummary() {
  fs.writeFileSync(path.join(OUT, 'live-results.json'), JSON.stringify(results, null, 2));
  const counts = results.reduce((m, r) => (m[r.status] = (m[r.status] || 0) + 1, m), {});
  const rows = results.map(r => `| ${r.scenario} | ${r.target} | ${r.status === 'PASS' ? '✅ PASS' : r.status === 'FAIL' ? '❌ FAIL' : r.status === 'BLOCKED' ? '⛔ BLOCKED' : r.status} | ${r.detail.replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`);
  const md = [`## RepoVibe live github.com acceptance`, ``, `Real github.com, logged out, Chromium + unpacked extension. ${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(' · ')}`, ``,
    `| Scenario | Target | Result | Detail |`, `|---|---|---|---|`, ...rows, ''].join('\n');
  fs.writeFileSync(path.join(OUT, 'summary.md'), md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}
test.after(writeSummary);

module.exports = { Blocked, record, gotoLive, settle, themeState, fingerprint, readability, watchErrors, shot, debugDump, liveTest, OUT };
