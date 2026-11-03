(() => {
  'use strict';
  const C = globalThis.RepoVibeCore;
  const $ = id => document.getElementById(id);
  let config;
  let repo = null;
  let tabId = null;
  let tabIsGitHub = false;
  let selectedScope = 'repository';

  function announce(message, isError = false) {
    $('status').textContent = message;
    $('status').className = `inline-status ${isError ? 'is-error' : ''}`;
  }
  function makeThemeButton(theme) {
    const button = document.createElement('button');
    button.className = 'theme-tile';
    button.style.setProperty('--tile-color', theme.accent || '#999');
    button.style.setProperty('--tile-bg', theme.bg || '#111');
    button.style.setProperty('--tile-end', theme.gradientTo || '#333');
    const label = document.createElement('span');
    label.textContent = theme.name;
    button.appendChild(label);
    button.title = `Apply ${theme.name}`;
    button.addEventListener('click', async () => {
      try {
        config = await C.updateConfig(latest => { C.assignTheme(latest, selectedScope, repo, theme.id); });
        render(); announce(`${theme.name} applied ${selectedScope === 'repository' ? 'to this repo' : 'globally'}.`);
      } catch (error) { announce(error.message, true); }
    });
    return button;
  }
  function render() {
    const resolved = C.themeResolution(config, repo ? `https://github.com/${repo.key}` : 'https://github.com/');
    $('enabled').checked = config.enabled;
    $('repoName').textContent = repo ? repo.label : tabIsGitHub ? 'GitHub homepage' : 'Open GitHub to customize';
    $('activeTheme').textContent = config.enabled ? `Active theme: ${resolved.theme?.name || 'Original GitHub'}` : 'Theme engine is paused';
    $('scopeInfo').textContent = ({repository:'◈ Repository override',owner:'◈ Owner theme',global:'◈ Global theme',disabled:'◈ Temporarily disabled'})[resolved.scope];
    const repoRadio = document.querySelector('input[name="scope"][value="repository"]');
    repoRadio.disabled = !repo;
    if (!repo && selectedScope === 'repository') { selectedScope = 'global'; document.querySelector('input[name="scope"][value="global"]').checked = true; }
    const list = $('quickThemes');
    list.replaceChildren();
    const quick = [C.PRESETS[0], C.PRESETS[1], C.PRESETS[2], C.PRESETS[8], C.PRESETS[14], C.PRESETS[19]];
    for (const theme of quick) list.appendChild(makeThemeButton(theme));
  }
  async function init() {
    try {
      config = await C.loadConfig();
      const [tab] = await chrome.tabs.query({active:true, currentWindow:true});
      tabId = Number.isInteger(tab?.id) ? tab.id : null;
      const url = tab?.url || '';
      repo = C.repositoryFromUrl(url);
      tabIsGitHub = /^https:\/\/github\.com(?:\/|$)/i.test(url);
      render();
    } catch (e) { announce(`Could not load extension: ${e.message}`, true); }
  }
  for (const radio of document.querySelectorAll('input[name="scope"]')) {
    radio.addEventListener('change', event => { selectedScope = event.target.value; render(); });
  }
  $('enabled').addEventListener('change', async event => {
    const enabled = event.target.checked;
    try { config = await C.updateConfig(latest => { latest.enabled = enabled; }); render(); announce(config.enabled ? 'RepoVibe enabled.' : 'RepoVibe paused.'); }
    catch (error) { announce(error.message, true); }
  });
  $('openStudio').addEventListener('click', () => {
    const suffix = tabIsGitHub && tabId !== null ? `?target=${tabId}` : '';
    chrome.tabs.create({url: chrome.runtime.getURL(`studio.html${suffix}`)});
  });
  $('resetCurrent').addEventListener('click', async () => {
    try {
      config = await C.updateConfig(latest => {
        if (repo && selectedScope === 'repository') latest.repoAssignments[repo.key] = 'native';
        else latest.defaultThemeId = 'native';
      }); render(); announce('Default appearance restored for this scope.'); }
    catch (error) { announce(error.message, true); }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[C.STORAGE_KEY] || !config) return;
    config = C.normalizeConfig(changes[C.STORAGE_KEY].newValue);
    render();
  });
  init();
})();
