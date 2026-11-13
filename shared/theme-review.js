'use strict';
/* Owner's visual review of the built-in themes (data only).
   Add an entry ONLY after the project owner has explicitly approved (or archived) a theme after looking at it:
     'preset-8': 'approved'   → primary gallery + eligible for the popup's six featured slots
     'preset-5': 'archived'   → hidden from discovery and from new automatic picks; existing assignments keep working
   Themes not listed are 'experimental' (implemented, awaiting approval). Review material: docs/THEME_AUDIT.md and docs/theme-review/. */
globalThis.RepoVibeThemeReview = {
  // 2026-11-11, owner's review: approved for the main curated gallery
  'preset-8': 'approved',  // Enchanted Forest
  'preset-19': 'approved', // Cosmic Galaxy
  'preset-15': 'approved', // Futuristic Sci-Fi
  // 2026-11-12, owner's review (round 3)
  'preset-10': 'approved', // Pixel Paradise
  'preset-12': 'approved', // Arctic Frost
  'preset-20': 'archived', // Synthwave (owner keeps only the "Synthwave valley" background; existing assignments keep working)
  // 2026-11-13, owner's review (round 4)
  'preset-7': 'approved',  // Ocean Depths
  'preset-3': 'archived',  // Sakura Dreams — removed from the collection; existing assignments keep working
  'preset-14': 'archived', // Dark Academia — removed from the collection; existing assignments keep working
  // 2026-11-13, owner's review (round 5)
  'preset-16': 'approved', // Obsidian
  'preset-9': 'approved',  // Retro Terminal
  'preset-11': 'approved', // Solar Flare
  'preset-1': 'approved',  // Cyberpunk Neon
  'preset-2': 'archived',  // Midnight Developer — removed from the collection; existing assignments keep working
  'preset-13': 'archived', // Lavender Nights — removed from the collection; existing assignments keep working
  'preset-18': 'archived'  // Sunset Boulevard — removed from the collection; existing assignments keep working
  // Still experimental (rework requested): Matrix, Aurora, Cozy Coding, Dracula.
};
/* Background (wallpaper) curation, same rules: 'archived' hides a background from the Studio's picker; any theme that already uses it keeps it. */
globalThis.RepoVibeWallpaperReview = {
  // 2026-11-12, owner's review: removed from the visible collection
  'pixel-island': 'archived', 'galaxy-planet': 'archived', 'neon-rain-street': 'archived', 'alien-world': 'archived',
  'synthwave-grid': 'archived', 'synthwave-highway': 'archived', // Synthwave variants other than "Synthwave valley"
  // 2026-11-13: the archived themes' own worlds leave the picker with them
  'sakura-garden': 'archived', 'dark-library': 'archived',
  // 2026-11-13 (round 5): with Midnight Developer, Lavender Nights and Sunset Boulevard
  'midnight-skyline': 'archived', 'lavender-fantasy': 'archived', 'sunset-coast': 'archived'
};
