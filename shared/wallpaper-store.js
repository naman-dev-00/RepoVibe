/* RepoVibe wallpaper asset store (IndexedDB, extension origin only).
   Used by the Studio (upload/list) and the service worker (serve to content scripts, migration, cleanup).
   Records are content-addressed: id = "w" + first 24 hex chars of SHA-256(bytes), so identical images are
   stored once and theme settings only hold a short reference ("idb:<id>"), never the image data. */
(function (root) {
  'use strict';
  const DB_NAME = 'repovibe-assets';
  const STORE = 'wallpapers';
  const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  const MAX_BYTES = 12 * 1024 * 1024; // per stored (already compressed) wallpaper
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbPromise = null; reject(req.error || new Error('IndexedDB unavailable')); };
    });
    return dbPromise;
  }
  function tx(mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const store = t.objectStore(STORE);
      let result;
      Promise.resolve(fn(store, v => { result = v; })).catch(reject);
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error || new Error('IndexedDB transaction failed'));
      t.onabort = () => reject(t.error || new Error('IndexedDB transaction aborted'));
    }));
  }
  const reqP = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });

  async function sha256Hex(buffer) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  /** Magic-byte check: the declared type must match the file content. */
  function sniff(bytes) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
    return null;
  }
  function validId(id) { return typeof id === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(id); }

  /** Stores an image Blob; returns its metadata (without the blob). Deduplicates identical content. */
  async function put(blob, meta = {}) {
    if (!(blob instanceof Blob)) throw new Error('Wallpaper must be a file.');
    if (blob.size === 0 || blob.size > MAX_BYTES) throw new Error(`Wallpaper must be between 1 byte and ${MAX_BYTES / 1024 / 1024} MB after compression.`);
    const buffer = await blob.arrayBuffer();
    const type = sniff(new Uint8Array(buffer.slice(0, 16)));
    if (!type || !TYPES.includes(type)) throw new Error('Only PNG, JPEG and WebP images are supported.');
    const id = `w${(await sha256Hex(buffer)).slice(0, 24)}`;
    const existing = await get(id).catch(() => null);
    if (existing) return strip(existing);
    const record = { id, type, size: blob.size, width: Number(meta.width) || 0, height: Number(meta.height) || 0,
      name: typeof meta.name === 'string' ? meta.name.slice(0, 80).replace(/[<>\u0000-\u001f]/g, '') : '', createdAt: Date.now(),
      blob: new Blob([buffer], { type }) };
    await tx('readwrite', store => reqP(store.put(record)));
    return strip(record);
  }
  async function get(id) {
    if (!validId(id)) return null;
    const record = await tx('readonly', (store, done) => reqP(store.get(id)).then(done));
    if (!record) return null;
    if (!(record.blob instanceof Blob) || record.blob.size === 0 || !TYPES.includes(record.type)) throw new Error(`Wallpaper ${id} is corrupted.`);
    return record;
  }
  const strip = r => ({ id: r.id, type: r.type, size: r.size, width: r.width, height: r.height, name: r.name, createdAt: r.createdAt });
  async function list() {
    const all = await tx('readonly', (store, done) => reqP(store.getAll()).then(done));
    return (all || []).map(strip).sort((a, b) => b.createdAt - a.createdAt);
  }
  async function remove(id) { if (validId(id)) await tx('readwrite', store => reqP(store.delete(id))); }
  /** Deletes assets that no theme references. Assets newer than minAgeMs are kept (e.g. an unsaved Studio upload). */
  async function cleanup(referencedIds, minAgeMs = 60 * 60 * 1000) {
    const keep = new Set(referencedIds);
    const removed = [];
    for (const item of await list()) if (!keep.has(item.id) && Date.now() - item.createdAt > minAgeMs) { await remove(item.id); removed.push(item.id); }
    return removed;
  }
  async function toDataUrl(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return `data:${blob.type};base64,${btoa(binary)}`;
  }
  function dataUrlToBlob(dataUrl) {
    const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
    if (!m) throw new Error('Not an image data URL.');
    const bin = atob(m[2]); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: m[1] });
  }

  root.RepoVibeWallpapers = Object.freeze({ DB_NAME, STORE, TYPES, MAX_BYTES, put, get, list, remove, cleanup, toDataUrl, dataUrlToBlob, sniff });
})(globalThis);
