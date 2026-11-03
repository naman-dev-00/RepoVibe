/* RepoVibe service worker: the only bridge between GitHub pages and the extension-origin IndexedDB.
   - WALLPAPER_GET: content scripts cannot open the extension's IndexedDB, so they ask here by id.
   - Migration: v1 themes stored wallpapers inline as data URLs in chrome.storage; move them to IndexedDB
     and keep only a reference. Failures leave the user's settings untouched (inline data keeps working).
   - WALLPAPER_CLEANUP: delete assets no saved theme references (Studio triggers after saving).
   No network access, no extra permissions. */
importScripts('shared/wallpaper-catalog.js', 'shared/core.js', 'shared/wallpaper-store.js');
const C = globalThis.RepoVibeCore;
const WP = globalThis.RepoVibeWallpapers;
const MIGRATION_KEY = 'repovibe.migration';

function referencedIds(config) {
  return Object.values(config.customThemes || {})
    .map(t => /^idb:(.+)$/.exec(t.wallpaperRef || ''))
    .filter(Boolean).map(m => m[1]);
}

async function migrateInlineWallpapers() {
  const status = { at: Date.now(), migrated: 0, failed: [] };
  try {
    const legacy = Object.entries((await C.loadConfig()).customThemes).filter(([, t]) => t.wallpaper && !t.wallpaperRef);
    if (!legacy.length) return status;
    const refs = {};
    for (const [id, theme] of legacy) {
      try { refs[id] = `idb:${(await WP.put(WP.dataUrlToBlob(theme.wallpaper), { name: `${theme.name} (migrated)` })).id}`; }
      catch (e) { status.failed.push({ theme: id, error: String(e && e.message || e) }); }
    }
    await C.updateConfig(latest => {
      for (const [id, ref] of Object.entries(refs)) {
        const t = latest.customThemes[id];
        if (t && t.wallpaper && !t.wallpaperRef) { t.wallpaperRef = ref; t.wallpaper = ''; status.migrated++; }
      }
    });
  } catch (e) { status.failed.push({ error: String(e && e.message || e) }); }
  await chrome.storage.local.set({ [MIGRATION_KEY]: status });
  return status;
}

// Seed the default repository → theme mappings once (they then behave like any manual choice).
function seedMappings() { return C.updateConfig(C.seedDefaultMappings).catch(e => console.warn('[RepoVibe] Unable to seed mappings', e)); }
chrome.runtime.onInstalled.addListener(() => { seedMappings(); migrateInlineWallpapers(); });
chrome.runtime.onStartup.addListener(() => { migrateInlineWallpapers(); });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !message || typeof message !== 'object') return false;
  if (message.type === 'WALLPAPER_GET') {
    WP.get(String(message.id || ''))
      .then(async record => sendResponse(record ? { ok: true, dataUrl: await WP.toDataUrl(record.blob) } : { ok: false, error: 'missing' }))
      .catch(e => sendResponse({ ok: false, error: String(e && e.message || e) }));
    return true;
  }
  if (message.type === 'WALLPAPER_MIGRATE') { migrateInlineWallpapers().then(sendResponse); return true; }
  if (message.type === 'WALLPAPER_CLEANUP') {
    // Only extension pages (Studio) may request cleanup; keep anything the caller says is still in use.
    if (!sender.url || !sender.url.startsWith(chrome.runtime.getURL(''))) return false;
    C.loadConfig()
      .then(config => WP.cleanup([...referencedIds(config), ...(Array.isArray(message.keep) ? message.keep : [])], Number(message.minAgeMs) >= 0 ? Number(message.minAgeMs) : undefined))
      .then(removed => sendResponse({ ok: true, removed }))
      .catch(e => sendResponse({ ok: false, error: String(e && e.message || e) }));
    return true;
  }
  return false;
});
