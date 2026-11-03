(() => {
  'use strict';
  const C = globalThis.RepoVibeCore;
  const $ = id => document.getElementById(id);
  const colorFields = [
    ['bg', 'Page background'], ['surface', 'Panels'], ['surface2', 'Raised surfaces'],
    ['text', 'Text'], ['muted', 'Secondary text'], ['accent', 'Accent'],
    ['border', 'Borders'], ['codeBg', 'Code background'],
    ['gradientTo', 'Gradient middle'], ['gradientThird', 'Gradient end']
  ];
  const sliderFields = {
    radius:'px', glass:'px', glassOpacity:'%', gradientAngle:'°',
    wallpaperOpacity:'%', wallpaperBlur:'px', codeFontSize:'px'
  };
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

  function say(message, isError = false) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').className = `toast visible${isError ? ' error' : ''}`;
    toastTimer = setTimeout(() => { $('toast').className = 'toast'; }, 3700);
  }
  function newId() { return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
  function selectedScopeThemeId() {
    if (scope === 'repository' && repo && config.repoAssignments[repo.key]) return config.repoAssignments[repo.key];
    if (scope !== 'global' && repo && config.ownerAssignments[repo.owner]) return config.ownerAssignments[repo.owner];
    return config.defaultThemeId;
  }
  function prepareForScope() {
    const savedId = selectedScopeThemeId();
    // Show a good starting point if the scope is not configured; do not apply until selected.
    const existing = C.themeById(config, savedId) || C.PRESETS[1];
    draft = structuredClone(existing);
    dirty = false;
    modified = false;
    undoStack = [structuredClone(draft)];
    undoIndex = 0;
    clearPreview();
    paint();
  }
  function updateSaveState() {
    $('saveState').textContent = dirty ? '● Unsaved changes' : 'No unsaved changes';
    $('saveState').classList.toggle('dirty', dirty);
    $('saveButton').disabled = !dirty;
    $('undoButton').disabled = undoIndex < 1;
    $('redoButton').disabled = undoIndex >= undoStack.length - 1;
    $('selectedName').textContent = dirty ? draft.name : (C.themeById(config, selectedScopeThemeId())?.name || 'Original GitHub');
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
    dirty = true;
    modified = true;
    remember();
    updatePreview();
    paintPreview();
    updateSliderOutputs();
  }
  function selectTheme(theme) {
    draft = structuredClone(theme);
    dirty = true;
    modified = false; // Applying an unchanged preset does not create a custom copy.
    undoStack = [structuredClone(draft)];
    undoIndex = 0;
    updatePreview();
    paint();
    say(`${theme.name} selected. Click Save theme to keep it.`);
  }
  function connectToTab() {
    if (!Number.isInteger(tabId)) { $('previewState').textContent = 'No active GitHub tab linked'; return; }
    try {
      port = chrome.tabs.connect(tabId, {name:'repovibe-preview'});
      port.onDisconnect.addListener(() => {
        port = null;
        $('previewState').textContent = 'Preview disconnected · saved themes still work';
      });
      $('previewState').textContent = '● Live preview connected';
    } catch (e) {
      port = null;
      $('previewState').textContent = 'Could not connect preview';
    }
  }
  function updatePreview() {
    if (!port) return;
    try { port.postMessage({type:'PREVIEW', theme:C.normalizeTheme(draft)}); }
    catch (_) { $('previewState').textContent = 'Preview unavailable; save still works'; }
  }
  function clearPreview() {
    try { port?.postMessage({type:'CLEAR'}); } catch (_) { /* Disconnected tab */ }
  }
  function switchView(view) {
    currentView = view;
    for (const button of document.querySelectorAll('.sidebar-link')) button.classList.toggle('active', button.dataset.view === view);
    for (const section of document.querySelectorAll('.view')) section.classList.toggle('active-view', section.id === `view-${view}`);
    const titles = {gallery:'Discover your vibe', customize:'Appearance studio', background:'Background studio', code:'Code & layout', library:'My theme library', settings:'Settings & backup'};
    $('viewTitle').textContent = titles[view] || titles.gallery;
    if (view === 'library') paintLibrary();
  }
  function makeGalleryCard(theme) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'gallery-card';
    const isSelected = theme.id === draft.id && (dirty || selectedScopeThemeId() === draft.id);
    if (isSelected) button.classList.add('selected');
    const art = document.createElement('div');
    art.className = 'gallery-art';
    art.style.background = `linear-gradient(${theme.gradientAngle}deg, ${theme.bg}, ${theme.gradientTo}, ${theme.gradientThird})`;
    art.style.setProperty('--accent', theme.accent);
    art.style.setProperty('--surface', theme.surface);
    art.style.setProperty('--border', theme.border);
    art.style.setProperty('--text', theme.text);
    art.innerHTML = '<div class="art-panel"><i></i><i></i><i></i></div><div class="art-panel secondary"><i></i><i></i></div>';
    const meta = document.createElement('div'); meta.className = 'gallery-meta';
    const title = document.createElement('strong'); title.textContent = theme.name;
    const description = document.createElement('p'); description.textContent = theme.description;
    meta.append(title, description); button.append(art, meta);
    if (isSelected) {
      const tick = document.createElement('span'); tick.className = 'tick'; tick.textContent = '✓'; button.append(tick);
    }
    button.addEventListener('click', () => selectTheme(theme));
    return button;
  }
  function paintGallery() {
    const gallery = $('themeGallery');
    gallery.replaceChildren(...C.PRESETS.map(makeGalleryCard));
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
    for (const [id, unit] of Object.entries(sliderFields)) {
      $(id).value = draft[id];
      $(`${id}Val`).textContent = `${draft[id]}${unit}`;
    }
  }
  function paintPreview() {
    const preview = $('palettePreview');
    preview.style.background = `linear-gradient(${draft.gradientAngle}deg, ${draft.bg}, ${draft.gradientTo}, ${draft.gradientThird})`;
    preview.style.borderColor = draft.border;
    const panel = preview.querySelector('.preview-content');
    panel.style.background = draft.surface; panel.style.borderRadius = `${draft.radius}px`;
    preview.querySelectorAll('.fake-title, .fake-button').forEach(el => el.style.background = draft.accent);
    $('codePreview').style.background = draft.codeBg;
    $('codePreview').style.fontSize = `${draft.codeFontSize}px`;
  }
  function paintLibrary() {
    const root = $('customThemes'); root.replaceChildren();
    const themes = Object.values(config.customThemes);
    if (!themes.length) {
      const empty = document.createElement('div'); empty.className = 'empty-state';
      empty.textContent = 'No saved custom themes yet. Edit a preset and click Save theme to create your first.';
      root.appendChild(empty); return;
    }
    for (const theme of themes) {
      const item = document.createElement('div'); item.className = 'library-item';
      const color = document.createElement('div'); color.className = 'swatch'; color.style.background = `linear-gradient(135deg,${theme.bg},${theme.accent})`;
      const detail = document.createElement('div'); detail.className = 'library-details';
      const title = document.createElement('strong'); title.textContent = theme.name;
      const desc = document.createElement('span'); desc.textContent = theme.description || 'My custom theme';
      detail.append(title,desc);
      const apply = document.createElement('button'); apply.className = 'outline-button'; apply.textContent = 'Use theme';
      apply.addEventListener('click', () => { selectTheme(theme); switchView('customize'); });
      const exportButton = document.createElement('button'); exportButton.className = 'outline-button'; exportButton.textContent = '↓'; exportButton.title = 'Export';
      exportButton.addEventListener('click', () => exportTheme(theme));
      item.append(color,detail,apply,exportButton); root.appendChild(item);
    }
  }
  function paint() {
    $('sidebarRepo').textContent = repo ? repo.label : 'All GitHub';
    $('targetLabel').textContent = scope === 'repository' && repo ? repo.label : scope === 'owner' && repo ? `${repo.owner}/*` : 'All GitHub pages';
    $('scopeSelect').value = scope;
    $('themeName').value = draft.name;
    $('themeDescription').value = draft.description;
    $('fontSelect').value = draft.font;
    $('backgroundMode').value = draft.backgroundMode;
    $('layoutSelect').value = draft.layout;
    $('enableStudio').checked = config.enabled;
    updateSliderOutputs();
    paintColors();
    paintGallery();
    paintPreview();
    updateSaveState();
  }
  async function saveTheme() {
    try {
      const theme = C.normalizeTheme(draft);
      let id = theme.id;
      if (modified && C.isPreset(id)) id = newId();
      if (modified && id === 'native') id = newId();
      if (id.startsWith('custom-')) {
        const updated = {...theme, id};
        config.customThemes[id] = updated;
        draft = structuredClone(updated);
      }
      C.assignTheme(config, scope, repo, id);
      config = await C.saveConfig(config);
      dirty = false; modified = false;
      undoStack = [structuredClone(draft)]; undoIndex = 0;
      clearPreview();
      paint();
      say(`${draft.name} saved for ${scope === 'repository' ? repo?.label : scope === 'owner' ? repo?.owner : 'GitHub'}.`);
    } catch (e) { say(`Could not save: ${e.message}`, true); }
  }
  async function resetScope() {
    try {
      if (scope === 'repository' && repo) delete config.repoAssignments[repo.key];
      else if (scope === 'owner' && repo) delete config.ownerAssignments[repo.owner];
      else config.defaultThemeId = 'native';
      config = await C.saveConfig(config);
      prepareForScope();
      say('Default appearance restored for this scope.');
    } catch (e) { say(e.message,true); }
  }
  function exportTheme(theme) {
    const normalized = C.normalizeTheme(theme);
    const pack = {format:'repovibe-theme', version:1, theme:normalized};
    const file = new Blob([JSON.stringify(pack,null,2)], {type:'application/json'});
    const href = URL.createObjectURL(file);
    const link = document.createElement('a'); link.href = href;
    link.download = `repovibe-${normalized.name.toLowerCase().replace(/[^a-z0-9]+/g,'-') || 'theme'}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 2000);
    say('Theme exported as safe JSON.');
  }
  async function importTheme(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) throw new Error('Theme file exceeds the 2 MB limit.');
    const parsed = JSON.parse(await file.text());
    if (parsed.format && parsed.format !== 'repovibe-theme') throw new Error('Not a RepoVibe theme file.');
    const input = parsed.theme || parsed;
    if (!input || typeof input !== 'object' || typeof input.name !== 'string') throw new Error('Theme file is missing theme data.');
    const id = newId();
    const imported = C.normalizeTheme({...input, id});
    config.customThemes[id] = imported;
    config = await C.saveConfig(config);
    selectTheme(imported);
    switchView('library');
    paintLibrary();
    say(`${imported.name} imported. Save to assign it to a repository.`);
  }
  async function imageToLocalDataUrl(file) {
    if (!file || !['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG, or WebP file.');
    if (file.size > 20 * 1024 * 1024) throw new Error('Image input must be under 20 MB.');
    const objectUrl = URL.createObjectURL(file);
    let bitmap;
    try { bitmap = await createImageBitmap(file); } finally { URL.revokeObjectURL(objectUrl); }
    try {
      let width = Math.min(bitmap.width, 1600);
      let height = Math.max(1, Math.round(bitmap.height * (width / bitmap.width)));
      let quality = .78;
      let data = '';
      for (let attempt = 0; attempt < 7; attempt++) {
        const canvas = document.createElement('canvas'); canvas.width = Math.round(width); canvas.height = Math.round(height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is unavailable.');
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        data = canvas.toDataURL('image/jpeg', quality);
        if (data.length <= 750000) return data;
        width = Math.max(320, Math.round(width * .77));
        height = Math.max(200, Math.round(height * .77));
        quality = Math.max(.52, quality - .06);
      }
      throw new Error('Image is too complex to store locally. Try a smaller image.');
    } finally { bitmap.close(); }
  }
  async function init() {
    try {
      config = await C.loadConfig();
      const query = new URLSearchParams(location.search);
      const candidate = Number(query.get('target'));
      if (Number.isSafeInteger(candidate) && candidate > 0) {
        try {
          const tab = await chrome.tabs.get(candidate);
          if (tab?.url && /^https:\/\/github\.com(?:\/|$)/.test(tab.url)) {
            tabId = candidate; repo = C.repositoryFromUrl(tab.url);
          }
        } catch (_) { /* Closed or unavailable tab */ }
      }
      if (tabId === null) {
        const tabs = await chrome.tabs.query({url:'https://github.com/*'});
        const gitTab = tabs.find(t => Number.isInteger(t.id));
        if (gitTab) { tabId = gitTab.id; repo = C.repositoryFromUrl(gitTab.url || ''); }
      }
      for (const option of $('scopeSelect').options) {
        if (!repo && option.value !== 'global') option.disabled = true;
      }
      scope = repo ? 'repository' : 'global';
      connectToTab();
      prepareForScope();
      switchView('gallery');
    } catch (e) { say(`Unable to initialize studio: ${e.message}`,true); }
  }

  for (const button of document.querySelectorAll('.sidebar-link')) button.addEventListener('click', () => switchView(button.dataset.view));
  $('scopeSelect').addEventListener('change', event => {
    if (dirty && !confirm('Discard unsaved changes and switch scope?')) { event.target.value = scope; return; }
    scope = event.target.value;
    prepareForScope();
  });
  for (const id of Object.keys(sliderFields)) {
    $(id).addEventListener('input', event => setDraft(id, Number(event.target.value)));
  }
  for (const [id, key] of [['themeName','name'],['themeDescription','description'],['fontSelect','font'],['backgroundMode','backgroundMode'],['layoutSelect','layout']]) {
    $(id).addEventListener(id === 'themeName' || id === 'themeDescription' ? 'input' : 'change', event => {
      if (key === 'backgroundMode' && event.target.value === 'image' && !draft.wallpaper) {
        say('Upload a wallpaper to use Image mode.'); event.target.value = 'gradient'; return;
      }
      setDraft(key, event.target.value);
    });
  }
  $('saveButton').addEventListener('click', saveTheme);
  $('undoButton').addEventListener('click', () => {
    if (undoIndex < 1) return;
    undoIndex--;
    draft = structuredClone(undoStack[undoIndex]); dirty = true; modified = true;
    paint(); updatePreview();
  });
  $('redoButton').addEventListener('click', () => {
    if (undoIndex >= undoStack.length - 1) return;
    undoIndex++;
    draft = structuredClone(undoStack[undoIndex]); dirty = true; modified = true;
    paint(); updatePreview();
  });
  $('wallpaperInput').addEventListener('change', async event => {
    try {
      const data = await imageToLocalDataUrl(event.target.files?.[0]);
      setDraft('wallpaper', data);
      setDraft('backgroundMode', 'image');
      $('backgroundMode').value = 'image';
      say('Wallpaper added to this editing session. Save to keep it.');
    } catch (e) { say(e.message,true); }
    event.target.value = '';
  });
  $('removeWallpaper').addEventListener('click', () => {
    setDraft('backgroundMode','gradient');
    setDraft('wallpaper','');
    $('backgroundMode').value = 'gradient';
    say('Wallpaper removed from this theme draft.');
  });
  $('exportTheme').addEventListener('click', () => exportTheme(draft));
  $('importTheme').addEventListener('click', () => $('importInput').click());
  $('importInput').addEventListener('change', async event => {
    try { await importTheme(event.target.files?.[0]); }
    catch (e) { say(`Import failed: ${e.message}`,true); }
    event.target.value = '';
  });
  $('resetScope').addEventListener('click', resetScope);
  $('enableStudio').addEventListener('change', async event => {
    config.enabled = event.target.checked;
    try { config = await C.saveConfig(config); say(config.enabled ? 'RepoVibe enabled.' : 'RepoVibe paused.'); }
    catch (e) { say(e.message,true); }
  });
  window.addEventListener('beforeunload', () => { try { port?.disconnect(); } catch (_) { /* Already disconnected */ } });
  init();
})();
