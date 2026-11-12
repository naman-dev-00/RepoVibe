# Theme curation + rework round 3 (owner review, 2026-11-12)

## Theme status (`shared/theme-review.js`)
| Status | Themes |
|---|---|
| **Approved** (5) | Enchanted Forest, Cosmic Galaxy, Futuristic Sci-Fi, Pixel Paradise, Arctic Frost |
| **Experimental, rework requested** | Sakura Dreams, Ocean Depths |
| **Experimental** (no decision yet) | Cyberpunk Neon, Dark Academia, Aurora, Sunset Boulevard, Solar Flare, Midnight Developer, Cozy Coding, Matrix, Dracula, Retro Terminal, Lavender Nights, Obsidian |
| **Archived theme** | Synthwave (`preset-20`) — the owner keeps only the "Synthwave valley" background |

Approved themes take the popup's featured slots (Enchanted Forest, Pixel Paradise, Arctic Frost, Futuristic Sci-Fi, Cosmic Galaxy, then Cyberpunk Neon).

## Removed from the visible collection (archived, not deleted)
Backgrounds hidden from the Studio's Background picker (`RepoVibeWallpaperReview` in `shared/theme-review.js`):
| Background (slug) | Name shown before |
|---|---|
| `pixel-island` | Pixel island |
| `galaxy-planet` | Galaxy & planet |
| `neon-rain-street` | Neon rain street |
| `alien-world` | Alien world |
| `synthwave-grid` | Synthwave grid (Synthwave variant) |
| `synthwave-highway` | Synthwave (the archived theme's world; Synthwave variant) |

Kept: **Synthwave valley** (`synthwave-3d`) and **Alpine lake at golden hour** (`alpine-lake`).

Safety: nothing is deleted. Saved repository/owner/global/automatic assignments to the Synthwave theme keep working; a custom theme that already
uses an archived background keeps it and sees it in the picker labelled "(archived, still in use)"; the gallery shows "Archived, still in use"
only when an archived theme is actually assigned. Covered by unit and browser tests.

## Rain removed from Alpine Lake and Synthwave Valley
Neither image contains rain. The rain came from the **live rain layer of Cyberpunk Neon**, which a theme kept when the user moved it onto
another background (e.g. Customize → Background). Each live ambience layer (rain, fireflies, stars, holo) now applies **only on the artwork it
was designed for**. Verified before/after on the real-page replay: previous code — rain layer ON over both; now — OFF over both
(`docs/screenshots/rework3/curation-before|after/*-motion.jpg`, `facts.json`). Cyberpunk Neon itself keeps its rain.

## Sakura Dreams (painted, `scripts/wallpapers/sakura-paint.py`)
* About **120 cherry trees** instead of ~18: an avenue of two rows on each side of the path receding into the distance, ~96 orchard trees spread
  over the meadow on both sides (hazed by distance), and continuous blossom groves with scalloped crowns over the hills (~52 000 tiny flowers).
* The near trees are larger and lean in so their crowns **arch over the top of the frame**; the mid trees are larger too.
* Soft crown shade on the meadow under every tree; denser petal carpet. Every blossom is still an individual five-petal flower.
* Text backing stays rose-tinted and translucent (guarded opacity 0.66; 0 AA failures).

## Ocean Depths (painted, `scripts/wallpapers/ocean-paint.py`)
* **The surface overhead**: a rippling ceiling of light in perspective across the upper part of the scene, the sun's disc glowing through it
  with a starburst, a Snell's-window glow, and light shafts fanning from the sun's position (moved into the part of the scene GitHub shows).
* **20 swaying plants** (was 10): six giant kelp strands with veined blades, four sea fans with polyps along the branches, four soft corals,
  two sea anemones with curling, glowing-tipped tentacles (new), four seagrass tufts — each on its own current rhythm; ~70 seagrass tufts baked
  into the sand. Animals unchanged (smaller turtles, glassy jellies, natural fish).

## Evidence
* Sakura / Ocean before (round 2, `07a4a06`) and after on GitHub: `docs/screenshots/rework3/compare/`, motion strips `…/motion/`, facts `…/facts.json`
* Alpine Lake / Synthwave Valley before/after (a theme with rain moved onto each background): `docs/screenshots/rework3/curation-before/` and `curation-after/`
* Curated gallery, background picker and popup after the removals: `docs/screenshots/rework3/curation-after/gallery.jpg`, `background-picker.jpg`, `popup.jpg`

## Tests
* Unit 36/36 (new: background curation, archived background still resolves, ambience only on its own artwork).
* Browser E2E: full run 77/82 — the five failures were expected consequences of the curation (two tests clicked "Retro Terminal", no longer
  featured; one picked the now-hidden "Galaxy & planet"; one counted 20 gallery cards; the popup/gallery baselines). Tests updated to the curated
  state and three baselines replaced after inspecting each difference (featured grid and gallery groups only); the affected files re-ran 40/40.
  New browser test: no rain over Alpine Lake / Synthwave Valley, archived backgrounds out of the picker, archived Synthwave assignment still works.

## Limitations
* Sakura and Ocean remain stylised procedural illustrations; Ocean's animals are the round-1 raymarched models.
* GPU frame rates and signed-in GitHub visuals are UNVERIFIED.
