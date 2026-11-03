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
  // A page is only valid evidence if GitHub's own stylesheets loaded. --fgColor-sponsors is a Primer token
  // RepoVibe never sets, so it is empty exactly when GitHub's CSS (github.githubassets.com) is missing.
  const styled = await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--fgColor-sponsors').trim() !== '', null, { timeout: 15000 }).then(() => true, () => false);
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

/** Proof that a page is the real, fully styled github.com page for the expected repository. */
async function liveEvidence(page, response, expectedPath, repo) {
  const ev = await page.evaluate(() => {
    const meta = n => document.querySelector(`meta[name="${n}"], meta[property="${n}"]`)?.getAttribute('content') || null;
    const sheets = [...document.styleSheets].map(s => s.href).filter(Boolean).map(h => new URL(h).hostname);
    return { host: location.hostname, path: location.pathname, site: meta('og:site_name'), nwo: meta('octolytics-dimension-repository_nwo'),
      primerToken: getComputedStyle(document.documentElement).getPropertyValue('--fgColor-sponsors').trim(),
      githubSheets: sheets.filter(h => h.endsWith('githubassets.com')).length };
  });
  const status = response ? response.status() : 0;
  const ok = status === 200 && ev.host === 'github.com' && ev.path.replace(/\/$/, '') === expectedPath.replace(/\/$/, '') && ev.site === 'GitHub' && ev.primerToken !== '' && ev.githubSheets > 0 && (!repo || (ev.nwo || '').toLowerCase() === repo.toLowerCase());
  return { ok, detail: `HTTP ${status} https://${ev.host}${ev.path} · og:site_name=${ev.site} · repository meta=${ev.nwo} · ${ev.githubSheets} GitHub stylesheets · --fgColor-sponsors=${ev.primerToken}` };
}

/** Everything RepoVibe ever writes into GitHub's DOM, searched across the whole document. */
const extensionDom = page => page.evaluate(() => {
  const found = [];
  for (const el of document.querySelectorAll('[id^="repovibe-"]')) found.push(`#${el.id}`);
  for (const el of document.querySelectorAll('[class*="repv"]')) if ([...el.classList].some(c => c.startsWith('repv'))) found.push(`${el.tagName.toLowerCase()}.repv*`);
  for (const el of document.querySelectorAll('*')) for (const a of el.attributes) if (a.name.startsWith('data-repv')) found.push(`${el.tagName.toLowerCase()}[${a.name}]`);
  const before = getComputedStyle(document.body, '::before');
  if (before.content !== 'none' && before.content !== 'normal' && before.backgroundImage !== 'none') found.push('body::before wallpaper layer');
  return found;
});

/** RepoVibe state on the page, read from the main world (CSS vars/classes/attributes are shared). */
const themeState = page => page.evaluate(() => {
  const root = document.documentElement, cs = getComputedStyle(root);
  const v = name => cs.getPropertyValue(name).trim();
  // Signed-in GitHub uses .AppHeader (themed by RepoVibe). Logged-out pages use a marketing header that
  // carries its own fixed data-color-mode; it is reported separately, not expected to take the theme.
  const header = document.querySelector('.AppHeader');
  const mktg = document.querySelector('header.HeaderMktg, header.header-logged-out');
  return {
    url: location.href,
    active: root.classList.contains('repv-active'),
    style: !!document.getElementById('repovibe-style-v1'),
    mode: root.getAttribute('data-color-mode'),
    writtenMode: root.getAttribute('data-repv-color-mode'),
    originalMode: root.getAttribute('data-repv-original-color-mode'),
    colorScheme: cs.colorScheme,
    bgDefault: v('--bgColor-default'), surface: v('--repv-panel'), fgDefault: v('--fgColor-default'), accent: v('--fgColor-accent'),
    wallpaperVar: v('--repv-wallpaper').slice(0, 60),
    fgDanger: v('--fgColor-danger'), fgSuccess: v('--fgColor-success'), fgSponsors: v('--fgColor-sponsors'),
    htmlBgImage: cs.backgroundImage.slice(0, 60),
    bodyColor: getComputedStyle(document.body).color,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    wallpaper: getComputedStyle(document.body, '::before').backgroundImage.slice(0, 40),
    wallpaperFilter: getComputedStyle(document.body, '::before').filter,
    headerFound: !!header, headerBg: header ? getComputedStyle(header).backgroundColor : null,
    loggedOutHeader: mktg ? { mode: mktg.getAttribute('data-color-mode'), bg: getComputedStyle(mktg).backgroundColor, color: getComputedStyle(mktg).color } : null,
    title: document.title
  };
});

/** GitHub's Primer components transition `color`; after a theme switch getComputedStyle returns mid-fade
    values. Force a style recalc (which starts pending transitions), then wait for finite animations. */
async function settleAnimations(page) {
  await page.evaluate(async () => {
    void document.body.offsetHeight;
    const running = document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.race([Promise.all(running.map(a => a.finished.catch(() => {}))), new Promise(r => setTimeout(r, 3000))]);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }).catch(() => {});
}

/** Computed-style fingerprint used to prove GitHub's original appearance is restored exactly.
    The first call pins up to 60 concrete DOM nodes (stored on window); later calls re-read the SAME nodes,
    so GitHub's lazy rendering cannot swap in different elements. Nodes removed meanwhile are skipped. */
const fingerprint = async page => { await settleAnimations(page); return fingerprintNow(page); };
const fingerprintNow = page => page.evaluate(() => {
  const root = document.documentElement;
  if (!window.__repvFpNodes) {
    const picks = ['html', 'body', '.AppHeader', 'header', 'main', '[role="main"]', '#repository-container-header', 'nav[aria-label="Repository"]', '.UnderlineNav', '.Box', '.markdown-body', '.react-code-text', '.Layout-sidebar', '.container-xl', '.btn', '.Button', 'a', '.Counter', '.Label'];
    const nodes = picks.map(sel => document.querySelector(sel)).filter(Boolean);
    for (const el of document.querySelectorAll('main *, [role="main"] *')) {
      if (nodes.length >= 60) break;
      if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && el.getBoundingClientRect().height > 0) nodes.push(el);
    }
    window.__repvFpNodes = [...new Set(nodes)];
  }
  const styles = window.__repvFpNodes.map((el, i) => {
    if (!el.isConnected) return `${i}:detached`;
    const c = getComputedStyle(el);
    return `${i}:${el.tagName}|${c.color}|${c.backgroundColor}|${c.backgroundImage.slice(0, 40)}|${c.borderTopColor}|${c.fontFamily.slice(0, 30)}|${c.fontSize}|${c.maxWidth}|${c.borderTopLeftRadius}`;
  });
  return {
    mode: root.getAttribute('data-color-mode'),
    classes: [...root.classList].filter(c => c.startsWith('repv')).join(' '),
    repvAttrs: [...root.attributes].filter(a => a.name.startsWith('data-repv')).map(a => a.name).join(' '),
    repvStyle: !!document.getElementById('repovibe-style-v1'),
    styles
  };
});
/** Compares two fingerprints from the same pinned nodes, ignoring nodes GitHub detached in between. */
function sameAppearance(before, after) {
  const diffs = [];
  for (const k of ['mode', 'classes', 'repvAttrs', 'repvStyle']) if (before[k] !== after[k]) diffs.push(`${k}: ${before[k]} → ${after[k]}`);
  let compared = 0;
  before.styles.forEach((b, i) => {
    const a = after.styles[i];
    if (b.endsWith(':detached') || a.endsWith(':detached')) return;
    compared++;
    if (a !== b) diffs.push(`node ${b.split('|')[0]}: ${b.slice(b.indexOf('|') + 1, 90)} → ${a.slice(a.indexOf('|') + 1, 90)}`);
  });
  return { same: diffs.length === 0 && compared > 0, compared, diffs };
}

/** Readability audit: visible text elements whose contrast with their effective background is < 3:1. */
const readability = async (page, fallbackBg) => { await settleAnimations(page); return readabilityNow(page, fallbackBg); };
const readabilityNow = (page, fallbackBg) => page.evaluate(fallback => {
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

/** Optional: print a small JPEG of the page into the job log (LIVE_LOG_SCREENSHOTS=1) so screenshots of the real
    site can be recovered from logs without artifact-download credentials. */
async function logShot(context, page, name) {
  if (!process.env.LIVE_LOG_SCREENSHOTS) return;
  const png = await page.screenshot().catch(() => null);
  if (!png) return;
  const helper = await context.newPage();
  const jpeg = await helper.evaluate(async src => {
    const img = new Image(); img.src = src; await img.decode();
    const c = new OffscreenCanvas(960, Math.round(img.height * 960 / img.width)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const bytes = new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: 0.62 })).arrayBuffer());
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }, `data:image/png;base64,${png.toString('base64')}`).catch(() => null);
  await helper.close();
  // GitHub truncates log lines at ~64 KB: emit numbered chunks.
  if (jpeg) { const n = Math.ceil(jpeg.length / 60000); for (let i = 0; i < n; i++) console.log(`[shot] ${slug(name)} ${i + 1}/${n} ${jpeg.slice(i * 60000, (i + 1) * 60000)}`); }
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

module.exports = { logShot, Blocked, record, gotoLive, settle, settleAnimations, liveEvidence, extensionDom, themeState, fingerprint, sameAppearance, readability, watchErrors, shot, debugDump, liveTest, OUT };
