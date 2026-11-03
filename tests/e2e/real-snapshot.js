'use strict';
/* Offline replay of REAL github.com pages captured as MHTML by tests/live/diagnose.live.js (Page.captureSnapshot).
   Every request the page makes is answered from the snapshot's parts (GitHub's real HTML, stylesheets and images);
   anything not in the snapshot is aborted. The extension injects exactly as on github.com because the main document
   is served at its original https://github.com/... URL. Scripts are not part of MHTML snapshots, so this replays
   GitHub's real DOM + CSS (layout, tokens, stacking), not its JavaScript behaviour. */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const DIR = path.join(__dirname, 'real-snapshots');

function decodeQP(text) {
  const bytes = [];
  const s = text.replace(/=\r?\n/g, '');
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && /^[0-9A-F]{2}$/i.test(s.slice(i + 1, i + 3))) { bytes.push(parseInt(s.slice(i + 1, i + 3), 16)); i += 2; }
    else { const c = s.charCodeAt(i); if (c < 128) bytes.push(c); else bytes.push(...Buffer.from(s[i], 'utf8')); }
  }
  return Buffer.from(bytes);
}
function parseMhtml(text) {
  const boundary = /boundary="?([^";\r\n]+)"?/i.exec(text)[1];
  const parts = new Map();
  let main = null;
  for (const chunk of text.split(`--${boundary}`).slice(1)) {
    const sep = chunk.search(/\r?\n\r?\n/);
    if (sep < 0) continue;
    const head = chunk.slice(0, sep), body = chunk.slice(sep).replace(/^\r?\n\r?\n/, '').replace(/\r?\n$/, '');
    const header = name => (new RegExp(`^${name}:\\s*(.+)$`, 'im').exec(head) || [])[1]?.trim();
    const location = header('Content-Location'), type = header('Content-Type') || 'application/octet-stream', enc = (header('Content-Transfer-Encoding') || '').toLowerCase();
    if (!location) continue;
    const buf = enc === 'base64' ? Buffer.from(body.replace(/\s+/g, ''), 'base64') : enc === 'quoted-printable' ? decodeQP(body) : Buffer.from(body, 'utf8');
    parts.set(location, { type: type.split(';')[0], body: buf });
    if (!main && /^text\/html/i.test(type)) main = location;
  }
  return { parts, main };
}
function available() { return fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith('.mhtml.gz')).map(f => f.replace('.mhtml.gz', '')) : []; }
function load(name) { return parseMhtml(zlib.gunzipSync(fs.readFileSync(path.join(DIR, `${name}.mhtml.gz`))).toString('utf8')); }

/** Route the context so that `snapshot.main` (an https://github.com URL) and its subresources come from the snapshot. */
async function serve(context, snapshot) {
  await context.unroute('https://github.com/**').catch(() => {});
  await context.route(/^https?:\/\//, route => {
    const url = route.request().url();
    const part = snapshot.parts.get(url) || snapshot.parts.get(url.split('#')[0]);
    if (part) return route.fulfill({ status: 200, contentType: part.type, body: part.body });
    return route.abort();
  });
}
module.exports = { DIR, available, load, serve, parseMhtml };
