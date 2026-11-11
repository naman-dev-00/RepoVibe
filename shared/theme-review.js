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
  'preset-15': 'approved'  // Futuristic Sci-Fi
  // Rework requested (stay experimental, not archived): Cyberpunk Neon, Sakura Dreams, Ocean Depths, Pixel Paradise, Arctic Frost.
};
