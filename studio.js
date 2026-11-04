(() => {
  'use strict';
  const C = globalThis.RepoVibeCore;
  const WP = globalThis.RepoVibeWallpapers;
  const $ = id => document.getElementById(id);
  const colorFields = [
    ['bg', 'Page background'], ['surface', 'Panels'], ['surface2', 'Raised surfaces'],
    ['text', 'Text'], ['muted', 'Secondary text'], ['accent', 'Accent'],
    ['border', 'Borders'], ['codeBg', 'Code background'],
    ['gradientTo', 'Gradient middle'], ['gradientThird', 'Gradient end']
  ];
  const sliderFields = {
    radius: 'px', glass: 'px', glassOpacity: '%', gradientAngle: '°',
    wallpaperOpacity: '%', wallpaperBlur: 'px', wallpaperBrightness: '%', wallpaperOverlay: '%', codeFontSize: 'px'
  };
  const SOURCE_LABEL = { repository: 'Manually assigned to this repository', owner: 'Owner / organization theme', auto: 'Automatic theme for this repository', global: 'Global theme', disabled: 'RepoVibe is disabled' };
  const MAX_INPUT_BYTES = 25 * 1024 * 1024;
  const MAX_EDGE = 3840;
  let config = C.normalizeConfig(null);
  let repo = null;
  let tabId = null;
  let scope = 'global';
  let draft = structuredClone(C.PRESETS[1]);
  let dirty = false;
  let modified = false;
  let port = null;
  let undoStack = [];
  let undoIndex = -1;
  let toastTimer = null;
  let currentView = 'gallery';
  let uploaded = [];               // IndexedDB wallpaper metadata
  const objectUrls = new Map();    // idb id -> object URL for thumbnails/preview

  function say(message, isError = false) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').className = `toast visible${isError ? ' error' : ''}`;
    toastTimer = setTimeout(() => { $('toast').className = 'toast'; }, 4200);
  }
  function newId() { return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
  const repoUrl = () => (repo ? `https://github.com/${repo.key}` : 'https://github.com/');
  /** What the selected scope currently shows (for the repository scope: the full resolution, incl. automatic). */
  function scopeResolution() {
    if (scope === 'repository' && repo) return C.themeResolution(config, repoUrl());
    if (scope === 'owner' && repo && Object.hasOwn(config.ownerAssignments, repo.owner)) return { id: config.ownerAssignments[repo.owner], source: 'owner' };
    return { id: config.defaultThemeId, source: 'global' };
  }
  function selectedScopeThemeId() { return scopeResolution().id; }
  function targetName() { return scope === 'repository' && repo ? repo.label : scope === 'owner' && repo ? `${repo.owner}/*` : 'all GitHub pages'; }
  function prepareForScope() {
    const existing = C.themeById(config, selectedScopeThemeId()) || C.PRESETS[1];
    draft = structuredClone(existing);
    dirty = false; modified = false;
    undoStack = [structuredClone(draft)]; undoIndex = 0;
    clearPreview();
    paint();
  }
  function updateSaveState() {
    $('saveState').textContent = dirty ? '● Unsaved changes' : 'No unsaved changes';
    $('saveState').classList.toggle('dirty', dirty);
    $('saveButton').disabled = !dirty;
    $('saveButton').textContent = scope === 'repository' && repo ? `Save to ${repo.label}` : scope === 'owner' && repo ? `Save to ${repo.owner}/*` : 'Save globally';
    $('undoButton').disabled = undoIndex < 1;
    $('redoButton').disabled = undoIndex >= undoStack.length - 1;
    const res = scopeResolution();
    const active = C.themeById(config, res.id);
    $('selectedName').textContent = dirty ? `${draft.name} (preview)` : (active?.name || 'Original GitHub');
    $('themeSource').textContent = !config.enabled ? SOURCE_LABEL.disabled : res.id === 'native' ? 'Original GitHub appearance' : SOURCE_LABEL[res.source] || '';
    $('resetRepoTheme').disabled = !(scope === 'repository' && repo && Object.hasOwn(config.repoAssignments, repo.key));
    $('restoreGitHub').disabled = scope === 'repository' && !repo;
  }
  function remember() {
    undoStack = undoStack.slice(0, undoIndex + 1);
    undoStack.push(structuredClone(draft));
    if (undoStack.length > 50) undoStack.shift();
    undoIndex = undoStack.length - 1;
    updateSaveState();
  }
  function setDraft(key, value) {
    if (!draft || Object.is(draft[key], value)) return;
    draft[key] = value;
    draft = C.normalizeTheme(draft);
    dirty = true; modified = true;
    remember(); updatePreview(); paintPreview(); updateSliderOutputs();
  }
  function setDraftMany(patch) {
    draft = C.normalizeTheme({ ...draft, ...patch });
    dirty = true; modified = true;
    remember(); updatePreview(); paint();
  }
  function selectTheme(theme, { silent } = {}) {
    draft = structuredClone(theme);
    dirty = true;
    modified = false; // Applying an unchanged preset does not create a custom copy.
    undoStack = [structuredClone(draft)]; undoIndex = 0;
    updatePreview(); paint();
    if (!silent) say(`${theme.name} previewing on ${targetName()}. Save to keep it.`);
  }
  function connectToTab() {
    if (!Number.isInteger(tabId)) { $('previewState').textContent = 'No active GitHub tab linked'; return; }
    try {
      port = chrome.tabs.connect(tabId, { name: 'repovibe-preview' });
      port.onDisconnect.addListener(() => {
        void chrome.runtime.lastError; // e.g. tab was opened before the extension was installed/reloaded
        port = null;
        $('previewState').textContent = 'Preview disconnected · saved themes still work';
      });
      $('previewState').textContent = '● Live preview connected';
    } catch (e) { port = null; $('previewState').textContent = 'Could not connect preview'; }
  }
  function updatePreview() {
    if (!port) return;
    try { port.postMessage({ type: 'PREVIEW', theme: C.normalizeTheme(draft) }); }
    catch (_) { $('previewState').textContent = 'Preview unavailable; save still works'; }
  }
  function clearPreview() { try { port?.postMessage({ type: 'CLEAR' }); } catch (_) { /* Disconnected tab */ } }
  function switchView(view) {
    currentView = view;
    for (const button of document.querySelectorAll('.sidebar-link')) button.classList.toggle('active', button.dataset.view === view);
    for (const section of document.querySelectorAll('.view')) section.classList.toggle('active-view', section.id === `view-${view}`);
    const titles = { gallery: 'Discover your vibe', customize: 'Appearance studio', background: 'Background studio', code: 'Code & layout', library: 'My theme library', settings: 'Settings & backup' };
    $('viewTitle').textContent = titles[view] || titles.gallery;
    if (view === 'library') paintLibrary();
    if (view === 'settings') paintStorage();
  }

  /* ---------- wallpaper helpers */
  function wallpaperThumb(ref) {
    const b = /^builtin:(.+)$/.exec(ref || '');
    if (b) { const w = C.WALLPAPERS.find(x => x.slug === b[1]); return w ? w.thumb : ''; }
    const i = /^idb:(.+)$/.exec(ref || '');
    return i ? objectUrls.get(i[1]) || '' : '';
  }
  async function loadUploaded() {
    try { uploaded = await WP.list(); } catch (e) { uploaded = []; say(`Wallpaper storage unavailable: ${e.message}`, true); }
    for (const item of uploaded) {
      if (objectUrls.has(item.id)) continue;
      try { const rec = await WP.get(item.id); if (rec) objectUrls.set(item.id, URL.createObjectURL(rec.blob)); }
      catch (_) { objectUrls.set(item.id, ''); /* corrupted: shown as missing */ }
    }
  }
  function wallpaperTile(ref, label, thumb, extraClass = '') {
    const b = document.createElement('button');
    b.type = 'button'; b.className = `wallpaper-tile ${extraClass}`; b.setAttribute('role', 'option');
    b.dataset.ref = ref; b.title = label;
    const selected = draft.backgroundMode === 'image' && draft.wallpaperRef === ref;
    b.setAttribute('aria-selected', String(selected)); b.classList.toggle('selected', selected);
    if (thumb) { const img = document.createElement('img'); img.src = thumb; img.alt = ''; img.loading = 'lazy'; b.appendChild(img); }
    else { const s = document.createElement('span'); s.className = 'missing'; s.textContent = 'Missing image'; b.appendChild(s); }
    const cap = document.createElement('span'); cap.className = 'wallpaper-caption'; cap.textContent = label; b.appendChild(cap);
    b.addEventListener('click', () => setDraftMany({ wallpaperRef: ref, wallpaper: '', backgroundMode: 'image' }));
    return b;
  }
  function paintWallpapers() {
    const grid = $('wallpaperGrid');
    const tiles = C.WALLPAPERS.map(w => wallpaperTile(w.ref, w.name, w.thumb, w.style === '3d' ? 'is-3d' : ''));
    for (const u of uploaded) tiles.push(wallpaperTile(`idb:${u.id}`, u.name || 'My upload', objectUrls.get(u.id), 'uploaded'));
    if (/^idb:/.test(draft.wallpaperRef) && !uploaded.some(u => `idb:${u.id}` === draft.wallpaperRef)) tiles.push(wallpaperTile(draft.wallpaperRef, 'Missing wallpaper', '', 'uploaded'));
    grid.replaceChildren(...tiles);
  }
  async function processWallpaper(file) {
    if (!file || !WP.TYPES.includes(file.type)) throw new Error('Choose a PNG, JPEG, or WebP file.');
    if (file.size > MAX_INPUT_BYTES) throw new Error('Image input must be under 25 MB.');
    const started = performance.now();
    let bitmap;
    try { bitmap = await createImageBitmap(file); } catch (_) { throw new Error('This file is not a readable image.'); }
    try {
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      let quality = 0.86, blob;
      do { blob = await canvas.convertToBlob({ type: 'image/webp', quality }); quality -= 0.1; } while (blob.size > WP.MAX_BYTES && quality > 0.4);
      const meta = await WP.put(blob, { width: canvas.width, height: canvas.height, name: file.name.replace(/\.[a-z]+$/i, '') });
      return { meta, ms: Math.round(performance.now() - started), inputBytes: file.size };
    } finally { bitmap.close(); }
  }

  /* ---------- gallery */
  function makeGalleryCard(theme) {
    const card = document.createElement('div');
    card.className = 'gallery-card'; card.tabIndex = 0; card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Preview ${theme.name}`);
    const isSelected = theme.id === draft.id && (dirty || selectedScopeThemeId() === draft.id);
    if (isSelected) card.classList.add('selected');
    const art = document.createElement('div');
    art.className = 'gallery-art';
    const thumb = wallpaperThumb(theme.wallpaperRef);
    if (thumb) { const img = document.createElement('img'); img.className = 'art-image'; img.src = thumb; img.alt = ''; img.loading = 'lazy'; art.appendChild(img); }
    else art.style.background = `linear-gradient(${theme.gradientAngle}deg, ${theme.bg}, ${theme.gradientTo}, ${theme.gradientThird})`;
    art.style.setProperty('--accent', theme.accent);
    art.style.setProperty('--surface', theme.surface);
    art.style.setProperty('--surface-glass', `color-mix(in srgb, ${theme.surface} ${theme.glassOpacity}%, transparent)`);
    art.style.setProperty('--border', theme.border);
    art.style.setProperty('--text', theme.text);
    const style = (C.WALLPAPERS.find(w => w.ref === theme.wallpaperRef) || {}).style;
    if (style) { const badge = document.createElement('span'); badge.className = `style-badge ${style === '3d' ? 'is-3d' : ''}`; badge.textContent = style === '3d' ? '3D CINEMATIC' : 'ILLUSTRATED'; art.appendChild(badge); }
    if (theme.flagship) { card.classList.add('is-flagship'); const live = document.createElement('span'); live.className = 'live-badge'; live.textContent = `◉ LIVE · ${theme.motion.toUpperCase()}`; art.appendChild(live); }
    const mock = document.createElement('div'); mock.className = 'art-mock';
    mock.innerHTML = '<div class="art-bar"><i></i><i></i><i></i></div><div class="art-panel"><b></b><i></i><i></i><i></i></div><div class="art-panel secondary"><i></i><i></i></div>';
    art.appendChild(mock);
    const meta = document.createElement('div'); meta.className = 'gallery-meta';
    const title = document.createElement('strong'); title.textContent = theme.name;
    const swatches = document.createElement('span'); swatches.className = 'swatches';
    for (const c of [theme.accent, theme.surface, theme.text]) { const dot = document.createElement('i'); dot.style.background = c; swatches.appendChild(dot); }
    title.appendChild(swatches);
    const description = document.createElement('p'); description.textContent = theme.description;
    const actions = document.createElement('div'); actions.className = 'card-actions';
    const apply = document.createElement('button'); apply.type = 'button'; apply.className = 'primary-button small'; apply.textContent = 'Apply';
    apply.title = `Apply ${theme.name} to ${targetName()}`;
    apply.addEventListener('click', e => { e.stopPropagation(); selectTheme(theme, { silent: true }); saveTheme(); });
    const customize = document.createElement('button'); customize.type = 'button'; customize.className = 'outline-button'; customize.textContent = 'Customize';
    customize.addEventListener('click', e => { e.stopPropagation(); selectTheme(theme); switchView('customize'); });
    actions.append(apply, customize);
    meta.append(title, description, actions); card.append(art, meta);
    if (isSelected) { const tick = document.createElement('span'); tick.className = 'tick'; tick.textContent = '✓'; card.append(tick); }
    card.addEventListener('click', () => selectTheme(theme));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTheme(theme); } });
    return card;
  }
  // Flagship live worlds first, then the other 3D cinematic themes, then illustrated ones (stable within each group).
  function paintGallery() {
    const rank = t => t.flagship ? 2 : (C.WALLPAPERS.find(w => w.ref === t.wallpaperRef) || {}).style === '3d' ? 1 : 0;
    $('themeGallery').replaceChildren(...[...C.PRESETS].sort((a, b) => rank(b) - rank(a)).map(makeGalleryCard));
  }

  function paintColors() {
    const controls = $('colorControls'); controls.replaceChildren();
    for (const [key, label] of colorFields) {
      const wrapper = document.createElement('label'); wrapper.className = 'color-field';
      const name = document.createElement('span'); name.textContent = label;
      const input = document.createElement('input'); input.type = 'color'; input.value = draft[key]; input.title = label;
      input.addEventListener('input', () => setDraft(key, input.value));
      wrapper.append(name, input); controls.append(wrapper);
    }
  }
  function updateSliderOutputs() {
    for (const [id, unit] of Object.entries(sliderFields)) { $(id).value = draft[id]; $(`${id}Val`).textContent = `${draft[id]}${unit}`; }
    const hasArt = draft.backgroundMode === 'image' && (draft.wallpaperRef || draft.wallpaper);
    const g = hasArt ? C.panelOpacity(draft) : null;
    const guard = g ? Math.round(g.opacity * 100) : draft.glassOpacity;
    const note = !g ? '' : g.raised
      ? `Readability guard: you chose ${draft.glassOpacity}% panels; they render at ${guard}% over this scene so text, secondary text and links stay at 4.8:1 or better. To see more scene, lower Overlay darkness only if text stays light-on-dark, or pick lighter text/accent colours.`
      : `Panels render at your ${guard}% — this scene needs no more for readable text.`;
    $('glassGuardNote').textContent = note;
    if ($('sceneGuardNote')) $('sceneGuardNote').textContent = note;
  }
  function paintPreview() {
    const preview = $('palettePreview');
    const thumb = draft.backgroundMode === 'image' ? wallpaperThumb(draft.wallpaperRef) : '';
    const overlay = `color-mix(in srgb, ${draft.bg} ${draft.wallpaperOverlay}%, transparent)`;
    preview.style.background = thumb
      ? `linear-gradient(${overlay}, ${overlay}), url("${thumb}") ${draft.wallpaperPosition}/${draft.wallpaperSize} no-repeat, ${draft.bg}`
      : `linear-gradient(${draft.gradientAngle}deg, ${draft.bg}, ${draft.gradientTo}, ${draft.gradientThird})`;
    preview.style.borderColor = draft.border;
    const panel = preview.querySelector('.preview-content');
    panel.style.background = `color-mix(in srgb, ${draft.surface} ${draft.glassOpacity}%, transparent)`;
    panel.style.backdropFilter = `blur(${draft.glass}px)`;
    panel.style.borderRadius = `${draft.radius}px`;
    preview.querySelectorAll('.fake-title, .fake-button').forEach(el => { el.style.background = draft.accent; });
    $('codePreview').style.background = draft.codeBg;
    $('codePreview').style.fontSize = `${draft.codeFontSize}px`;
  }
  function paintLibrary() {
    const root = $('customThemes'); root.replaceChildren();
    const themes = Object.values(config.customThemes);
    if (!themes.length) {
      const empty = document.createElement('div'); empty.className = 'empty-state';
      empty.textContent = 'No saved custom themes yet. Edit a preset and save to create your first.';
      root.appendChild(empty); return;
    }
    for (const theme of themes) {
      const item = document.createElement('div'); item.className = 'library-item';
      const color = document.createElement('div'); color.className = 'swatch';
      const thumb = wallpaperThumb(theme.wallpaperRef);
      color.style.background = thumb ? `url("${thumb}") center/cover` : `linear-gradient(135deg,${theme.bg},${theme.accent})`;
      const detail = document.createElement('div'); detail.className = 'library-details';
      const title = document.createElement('strong'); title.textContent = theme.name;
      const uses = C.themeUsage(config, theme.id).length;
      const desc = document.createElement('span'); desc.textContent = `${theme.description || 'My custom theme'} · used by ${uses} assignment${uses === 1 ? '' : 's'}`;
      detail.append(title, desc);
      const apply = document.createElement('button'); apply.className = 'outline-button'; apply.textContent = 'Use theme';
      apply.addEventListener('click', () => { selectTheme(theme); switchView('customize'); });
      const exportButton = document.createElement('button'); exportButton.className = 'outline-button'; exportButton.textContent = '↓'; exportButton.title = 'Export';
      exportButton.addEventListener('click', () => exportTheme(theme));
      item.append(color, detail, apply, exportButton); root.appendChild(item);
    }
  }
  async function paintStorage() {
    await loadUploaded();
    const used = new Set(Object.values(config.customThemes).map(t => (/^idb:(.+)$/.exec(t.wallpaperRef || '') || [])[1]).filter(Boolean));
    const total = uploaded.reduce((s, u) => s + u.size, 0);
    $('storageUsage').textContent = uploaded.length ? `${uploaded.length} uploaded wallpaper${uploaded.length === 1 ? '' : 's'} · ${(total / 1024 / 1024).toFixed(1)} MB in IndexedDB` : 'No uploaded wallpapers. Bundled artwork needs no storage.';
    $('storageList').replaceChildren(...uploaded.map(u => {
      const row = document.createElement('div'); row.className = 'library-item';
      const sw = document.createElement('div'); sw.className = 'swatch'; if (objectUrls.get(u.id)) sw.style.background = `url("${objectUrls.get(u.id)}") center/cover`;
      const d = document.createElement('div'); d.className = 'library-details';
      const t = document.createElement('strong'); t.textContent = u.name || u.id;
      const m = document.createElement('span'); m.textContent = `${u.width}×${u.height} · ${(u.size / 1024).toFixed(0)} KB · ${used.has(u.id) ? 'in use' : 'unused'}`;
      d.append(t, m); row.append(sw, d); return row;
    }));
  }
  function paint() {
    $('sidebarRepo').textContent = repo ? repo.label : 'All GitHub';
    $('targetLabel').textContent = scope === 'repository' && repo ? repo.label : scope === 'owner' && repo ? `${repo.owner}/*` : 'All GitHub pages';
    $('scopeSelect').value = scope;
    $('themeName').value = draft.name;
    $('themeDescription').value = draft.description;
    $('fontSelect').value = draft.font;
    $('backgroundMode').value = draft.backgroundMode;
    $('wallpaperPosition').value = draft.wallpaperPosition;
    $('wallpaperSize').value = draft.wallpaperSize;
    $('layoutSelect').value = draft.layout;
    $('enableStudio').checked = config.enabled;
    $('autoAssignToggle').checked = config.autoAssign;
    paintAppearance(); paintDiagnostics();
    $('motionMode').value = config.motionMode;
    updateSliderOutputs();
    paintColors();
    paintGallery();
    paintWallpapers();
    paintPreview();
    updateSaveState();
  }
  async function saveTheme() {
    try {
      const theme = C.normalizeTheme({ ...draft, wallpaper: draft.wallpaperRef ? '' : draft.wallpaper });
      let id = theme.id;
      if (modified && C.isPreset(id)) id = newId();
      if (modified && id === 'native') id = newId();
      const updated = id.startsWith('custom-') ? { ...theme, id } : null;
      let sharedUses = 0;
      config = await C.updateConfig(latest => {
        if (updated) {
          const target = scope === 'repository' ? repo?.key : scope === 'owner' ? repo?.owner : '';
          sharedUses = C.themeUsage(latest, id).filter(use => !(use.scope === scope && use.key === (target || ''))).length;
          latest.customThemes[id] = updated;
        }
        C.assignTheme(latest, scope, repo, id); // manual assignment; never overwritten by automatic picks
      });
      if (updated) draft = structuredClone(updated);
      dirty = false; modified = false;
      undoStack = [structuredClone(draft)]; undoIndex = 0;
      clearPreview(); paint();
      const where = scope === 'repository' ? repo?.label : scope === 'owner' ? `${repo?.owner}/*` : 'all GitHub pages';
      say(sharedUses ? `${draft.name} saved for ${where}. This custom theme is also used by ${sharedUses} other assignment${sharedUses === 1 ? '' : 's'}, which now show the same changes.` : `${draft.name} saved for ${where}.`);
      chrome.runtime.sendMessage({ type: 'WALLPAPER_CLEANUP', keep: [] }, () => void chrome.runtime.lastError); // removes only old, unreferenced uploads
    } catch (e) { say(`Could not save: ${e.message}`, true); }
  }
  async function resetScope() {
    try {
      config = await C.updateConfig(latest => {
        if (scope === 'repository' && repo) delete latest.repoAssignments[repo.key];
        else if (scope === 'owner' && repo) delete latest.ownerAssignments[repo.owner];
        else latest.defaultThemeId = 'native';
      });
      prepareForScope();
      say('Default appearance restored for this scope.');
    } catch (e) { say(e.message, true); }
  }
  function exportTheme(theme) {
    const normalized = C.normalizeTheme(theme);
    const pack = { format: 'repovibe-theme', version: 1, theme: normalized };
    const file = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(file);
    const link = document.createElement('a'); link.href = href;
    link.download = `repovibe-${normalized.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'theme'}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 2000);
    say('Theme exported as safe JSON.');
  }
  async function importTheme(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) throw new Error('Theme file exceeds the 2 MB limit.');
    const parsed = JSON.parse(await file.text());
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Theme file is missing theme data.');
    if (parsed.format && parsed.format !== 'repovibe-theme') throw new Error('Not a RepoVibe theme file.');
    const input = parsed.theme || parsed;
    if (!input || typeof input !== 'object' || typeof input.name !== 'string') throw new Error('Theme file is missing theme data.');
    const id = newId();
    // IndexedDB references from another browser would point at nothing here; keep bundled refs only.
    const imported = C.normalizeTheme({ ...input, id, wallpaperRef: /^builtin:/.test(input.wallpaperRef || '') ? input.wallpaperRef : '' });
    config = await C.updateConfig(latest => { latest.customThemes[id] = imported; });
    selectTheme(imported);
    switchView('library');
    paintLibrary();
    say(`${imported.name} imported. Save to assign it to a repository.`);
  }
  async function init() {
    try {
      config = await C.loadConfig();
      const query = new URLSearchParams(location.search);
      const candidate = Number(query.get('target'));
      if (Number.isSafeInteger(candidate) && candidate > 0) {
        try {
          const tab = await chrome.tabs.get(candidate);
          if (tab?.url && /^https:\/\/github\.com(?:\/|$)/.test(tab.url)) { tabId = candidate; repo = C.repositoryFromUrl(tab.url); }
        } catch (_) { /* Closed or unavailable tab */ }
      }
      if (tabId === null) {
        const tabs = await chrome.tabs.query({ url: 'https://github.com/*' });
        // Prefer the GitHub tab the user looked at most recently.
        const gitTab = tabs.filter(t => Number.isInteger(t.id)).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
        if (gitTab) { tabId = gitTab.id; repo = C.repositoryFromUrl(gitTab.url || ''); }
      }
      for (const option of $('scopeSelect').options) if (!repo && option.value !== 'global') option.disabled = true;
      scope = repo ? 'repository' : 'global'; // repository-specific editing is the default on a repository
      await loadUploaded();
      connectToTab();
      prepareForScope();
      switchView(query.get('view') === 'customize' ? 'customize' : 'gallery');
    } catch (e) { say(`Unable to initialize studio: ${e.message}`, true); }
  }

  for (const button of document.querySelectorAll('.sidebar-link')) button.addEventListener('click', () => switchView(button.dataset.view));
  $('scopeSelect').addEventListener('change', event => {
    if (dirty && !confirm('Discard unsaved changes and switch scope?')) { event.target.value = scope; return; }
    scope = event.target.value;
    prepareForScope();
  });
  // Appearance presets: saved globally for the built-in themes at once, and applied to the draft so a custom theme can
  // take them too (Save keeps it). Each preset only sets the six visual controls; it never couples them afterwards.
  function paintAppearance() {
    for (const b of document.querySelectorAll('[data-appearance]')) { const on = b.dataset.appearance === config.appearance; b.classList.toggle('selected', on); b.setAttribute('aria-checked', String(on)); }
    $('sceneWindowToggle').checked = config.sceneWindow;
  }
  for (const button of document.querySelectorAll('[data-appearance]')) button.addEventListener('click', async () => {
    const name = button.dataset.appearance;
    try {
      config = await C.updateConfig(latest => { latest.appearance = name; });
      setDraftMany(C.appearanceValues(name, draft));
      paintAppearance();
      say(`${C.APPEARANCES[name].label}: applied to built-in themes${String(draft.id).startsWith('custom-') ? '; save to keep it for this custom theme' : ''}.`);
    } catch (e) { say(e.message, true); }
  });
  $('sceneWindowToggle').addEventListener('change', async event => {
    const on = event.target.checked;
    try { config = await C.updateConfig(latest => { latest.sceneWindow = on; }); say(on ? 'Scene window on.' : 'Scene window off.'); } catch (e) { say(e.message, true); }
  });
  $('restoreVisual').addEventListener('click', async () => {
    let changed = 0;
    try {
      config = await C.updateConfig(latest => { changed = C.restoreVisualDefaults(latest); latest.sceneWindow = true; });
      if (!String(draft.id).startsWith('custom-')) setDraftMany(C.appearanceValues('crisp', draft));
      paintAppearance();
      say(`Visual defaults restored: Crisp Immersive${changed ? `; ${changed} custom theme${changed === 1 ? '' : 's'} reset` : ''}. Assignments and wallpapers kept.`);
    } catch (e) { say(e.message, true); }
  });
  async function paintDiagnostics() {
    const out = $('diagnostics');
    try {
      const tabs = await chrome.tabs.query({ url: 'https://github.com/*' });
      const tab = tabs.find(t => t.active) || tabs[0];
      if (!tab) { out.textContent = `Installed: v${chrome.runtime.getManifest().version}. No GitHub tab open.`; return; }
      chrome.tabs.sendMessage(tab.id, { type: 'GET_REPO' }, response => {
        void chrome.runtime.lastError;
        const d = response && response.diagnostics;
        if (!d) { out.textContent = `Installed: v${chrome.runtime.getManifest().version}. The GitHub tab is not running this version yet — reload it.`; return; }
        const t = d.theme;
        out.textContent = [
          `Running on the page: v${d.version}${d.version !== chrome.runtime.getManifest().version ? ` (installed v${chrome.runtime.getManifest().version} — reload the tab)` : ''}`,
          d.duplicate ? `WARNING: ${d.instances.length} RepoVibe copies active (${d.instances.join(', ')}) — remove older ones in chrome://extensions` : 'single installation',
          d.active ? `stylesheet ${d.stylesheet} bytes, scene on page background: ${d.wallpaperOnRoot ? 'yes' : 'no'}` : 'theme not active on this page',
          `appearance ${C.APPEARANCES[d.appearance]?.label || d.appearance}, scene window ${d.sceneWindow ? 'on' : 'off'}`,
          d.homeCards && d.homeCards.home ? (d.homeCards.method && d.homeCards.method !== 'none' && d.homeCards.rows
            ? `Home · Top repositories found via ${d.homeCards.method}: ${d.homeCards.links} repository links, ${d.homeCards.rows.filter(r => r.theme).length}/${d.homeCards.rows.length} rows themed${d.homeCards.rows.filter(r => !r.theme).map(r => `; ${r.repo} not themed: ${r.reason}`).join('')}`
            : `Home · Top repositories not themed: ${d.homeCards.reason || 'unknown'}`) : '',
          t ? `${t.name}: wallpaper blur ${t.wallpaperBlur}px, panel backdrop blur ${t.panelBlur}px (${d.panelsWithBackdropBlur} blurred panels), overlay ${t.overlay}%, brightness ${t.brightness}%, panel opacity chosen ${t.panelOpacityChosen}% / rendered ${Math.round((d.panelOpacityRendered || 0) * 100)}%` : ''
        ].filter(Boolean).join(' · ');
      });
    } catch (e) { out.textContent = `Diagnostics unavailable: ${e.message}`; }
  }
  $('refreshDiagnostics').addEventListener('click', paintDiagnostics);
  for (const id of Object.keys(sliderFields)) $(id).addEventListener('input', event => setDraft(id, Number(event.target.value)));
  for (const [id, key] of [['themeName', 'name'], ['themeDescription', 'description'], ['fontSelect', 'font'], ['backgroundMode', 'backgroundMode'], ['layoutSelect', 'layout'], ['wallpaperPosition', 'wallpaperPosition'], ['wallpaperSize', 'wallpaperSize']]) {
    $(id).addEventListener(id === 'themeName' || id === 'themeDescription' ? 'input' : 'change', event => {
      if (key === 'backgroundMode' && event.target.value === 'image' && !draft.wallpaperRef && !draft.wallpaper) {
        say('Choose a wallpaper first.'); event.target.value = draft.backgroundMode; return;
      }
      setDraft(key, event.target.value);
    });
  }
  $('saveButton').addEventListener('click', saveTheme);
  $('undoButton').addEventListener('click', () => {
    if (undoIndex < 1) return;
    undoIndex--; draft = structuredClone(undoStack[undoIndex]); dirty = true; modified = true; paint(); updatePreview();
  });
  $('redoButton').addEventListener('click', () => {
    if (undoIndex >= undoStack.length - 1) return;
    undoIndex++; draft = structuredClone(undoStack[undoIndex]); dirty = true; modified = true; paint(); updatePreview();
  });
  $('wallpaperInput').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    say('Processing wallpaper…');
    try {
      const { meta, ms } = await processWallpaper(file);
      await loadUploaded();
      setDraftMany({ wallpaperRef: `idb:${meta.id}`, wallpaper: '', backgroundMode: 'image' });
      say(`Wallpaper stored locally (${meta.width}×${meta.height}, ${(meta.size / 1024).toFixed(0)} KB, ${ms} ms). Save to keep it in this theme.`);
    } catch (e) { say(e.message, true); }
  });
  $('removeWallpaper').addEventListener('click', () => { setDraftMany({ wallpaperRef: '', wallpaper: '', backgroundMode: 'gradient' }); say('Wallpaper removed from this theme draft.'); });
  $('exportTheme').addEventListener('click', () => exportTheme(draft));
  $('importTheme').addEventListener('click', () => $('importInput').click());
  $('importInput').addEventListener('change', async event => {
    try { await importTheme(event.target.files?.[0]); } catch (e) { say(`Import failed: ${e.message}`, true); }
    event.target.value = '';
  });
  $('resetScope').addEventListener('click', resetScope);
  $('resetRepoTheme').addEventListener('click', async () => {
    if (!repo) return;
    try { config = await C.updateConfig(latest => { delete latest.repoAssignments[repo.key]; }); scope = 'repository'; prepareForScope(); say(`${repo.label} now uses its ${C.themeResolution(config, repoUrl()).source === 'auto' ? 'automatic' : 'inherited'} theme.`); }
    catch (e) { say(e.message, true); }
  });
  $('restoreGitHub').addEventListener('click', async () => {
    try {
      config = await C.updateConfig(latest => { C.assignTheme(latest, scope, repo, 'native'); });
      prepareForScope(); say(`Original GitHub appearance restored for ${targetName()}.`);
    } catch (e) { say(e.message, true); }
  });
  $('enableStudio').addEventListener('change', async event => {
    const enabled = event.target.checked;
    try { config = await C.updateConfig(latest => { latest.enabled = enabled; }); updateSaveState(); say(config.enabled ? 'RepoVibe enabled.' : 'RepoVibe paused.'); }
    catch (e) { say(e.message, true); }
  });
  $('autoAssignToggle').addEventListener('change', async event => {
    const on = event.target.checked;
    try { config = await C.updateConfig(latest => { latest.autoAssign = on; }); updateSaveState(); say(on ? 'Unconfigured repositories now get their own automatic theme.' : 'Automatic themes off: unconfigured repositories use the global theme.'); }
    catch (e) { say(e.message, true); }
  });
  $('motionMode').addEventListener('change', async event => {
    const mode = event.target.value;
    try { config = await C.updateConfig(latest => { latest.motionMode = mode; }); say(`Live wallpaper motion: ${mode}.`); }
    catch (e) { say(e.message, true); }
  });
  $('cleanupStorage').addEventListener('click', () => {
    const keep = (/^idb:(.+)$/.exec(draft.wallpaperRef || '') || [])[1];
    chrome.runtime.sendMessage({ type: 'WALLPAPER_CLEANUP', keep: keep ? [keep] : [], minAgeMs: 0 }, async response => {
      void chrome.runtime.lastError;
      if (!response || !response.ok) { say(`Cleanup failed: ${response?.error || 'service worker unavailable'}`, true); return; }
      for (const id of response.removed) { const u = objectUrls.get(id); if (u) URL.revokeObjectURL(u); objectUrls.delete(id); }
      await paintStorage(); paintWallpapers();
      say(`Removed ${response.removed.length} unused wallpaper${response.removed.length === 1 ? '' : 's'}.`);
    });
  });
  // Keep assignments/library current when the popup or another Studio changes storage; the draft is untouched.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[C.STORAGE_KEY]) return;
    config = C.normalizeConfig(changes[C.STORAGE_KEY].newValue);
    $('enableStudio').checked = config.enabled;
    $('autoAssignToggle').checked = config.autoAssign;
    paintAppearance();
    $('motionMode').value = config.motionMode;
    updateSaveState();
    if (currentView === 'library') paintLibrary();
  });
  window.addEventListener('beforeunload', () => { try { port?.disconnect(); } catch (_) { /* Already disconnected */ } });
  init();
})();
