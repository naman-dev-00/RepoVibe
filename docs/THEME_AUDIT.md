# RepoVibe theme audit and proposed curated shortlist

Status: **for the owner's review. Nothing has been approved or archived.** All 20 built-in themes are currently `experimental`
(`shared/theme-review.js` is empty). No assignment, custom theme, upload or preference has been changed.

Review material: one 1600×900 screenshot per preset on a real github.com page replay (Ambient, popup closed) in
`docs/theme-review/preset-N.jpg`, an overview page `docs/theme-review/index.html`, and the measured facts in `docs/theme-review/facts.json`.
Earlier per-world evidence (motion strips, recordings, 4K shots) is in `docs/screenshots/worlds/` and `docs/recordings/worlds/`.

Notes on the columns:
* **Depth**: the number of layered planes plus individually animated objects (sprites); `—` means a single flat image.
* **Pop-out**: objects that reach into the page margins (pointer-events none).
* **Readability**: lowest measured text contrast on the replay (WCAG AA = 4.5:1 for normal text; all 20 have 0 failures).
* **Performance**: software-rendered Chromium, 1366×768. Static mode / Ambient (Full quality). GPU frame rates are UNVERIFIED.
* **Assessment**: my visual judgement from the screenshots and recordings. It is an opinion for the owner, not an approval.

| # | Theme | Artwork | Resolution | Depth | Pop-out | Autonomous motion | Readability | Performance | Limitations | Assessment |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Cyberpunk Neon | raymarched 3D neon city | 2560×1440 | 9 planes, 3 objects | 3 (signs, probe) | rain, neon flicker, drifting probe | 4.75 | ~57 / ~20 fps | stylised CG; soft at 4K | **Strong** |
| 2 | Midnight Developer | procedural 2D skyline | 1920×1080 | — | — | none | 4.75 | flat (60) | flat, simple shapes; upscaled at 1440p+ | Weak |
| 3 | Sakura Dreams | owner's reference image + cut-out trees, 3D petals/boughs | 2560×1440 (from 768 px source) | 8 planes, 12 objects | 2 boughs + petals | trees sway on gusts, petals, clouds | 4.58 | ~59 / ~20 fps | plate soft at 1440p+ (768 px source) | **Strong** (best atmosphere) |
| 4 | Cozy Coding | procedural 2D room | 1920×1080 | — | — | none | 4.75 | flat | flat, simple shapes | Fair |
| 5 | Matrix | procedural 2D digital rain | 1920×1080 | — | — | none | 4.75 | flat | static "rain"; generic | Weak |
| 6 | Dracula | procedural 2D castle | 1920×1080 | — | — | none | 4.75 | flat | silhouette art, low detail | Fair |
| 7 | Ocean Depths | owner's reference image + cut-out coral, raymarched sea life | 2560×1440 (from 768 px source) | 9 planes, 29 objects | 3 (jelly, turtle, coral) | coral sway, caustics, fish, turtles, jellyfish, bubbles | 4.75 | ~59 / ~20–24 fps | plate soft at 1440p+; manta/whale cartoonish | **Strong** |
| 8 | Enchanted Forest | raymarched 3D forest | 2560×1440 | 9 planes, 9 objects | 2 sprays | fireflies, falling leaves, mist | 4.75 | 57 / 20 fps | CG look; soft at 4K | **Strong** |
| 9 | Retro Terminal | procedural pixel landscape | 1920×1080 | — | — | none | 4.75 | flat | flat; low resolution style | Fair (style piece) |
| 10 | Pixel Paradise | voxel-style pixel art island | 2560×1440 | 6 planes, 6 objects | 2 (cube, palm) | palms, clouds, gulls, cubes | 4.75 | 59 / 23 fps | simple island, crude palms | Fair |
| 11 | Solar Flare | raymarched 3D dunes | 2560×1440 | — (flat) | — | none | 4.75 | flat | no depth/motion, flat colour field | Fair |
| 12 | Arctic Frost (light) | painted 2.5D frozen valley | 2560×1440 | 8 planes, 8 objects | 2 | blizzard, swaying pines, fox | 4.58 | 56 / 19 fps | washed-out mountains; low contrast art | Weak–Fair |
| 13 | Lavender Nights | procedural 2D fantasy | 1920×1080 | — | — | none | 4.75 | flat | simple shapes | Weak |
| 14 | Dark Academia | painted 2.5D library | 2560×1440 | 7 planes, 7 objects | 2 (candle, books) | candles, chandelier, dust, pages | 4.75 | 57 / 20 fps | heavy red curtains, flat shelves | Fair |
| 15 | Futuristic Sci-Fi | raymarched 3D AI hall | 2560×1440 | 9 planes, 3 objects | 2 | holo grid, drifting core | 4.75 | ~57 / ~20 fps | CG look; soft at 4K | **Strong** |
| 16 | Obsidian | procedural 2D shards | 1920×1080 | — | — | none | 4.75 | flat | near-black, little scenery | Weak (but useful minimal) |
| 17 | Aurora | painted 2.5D lake + aurora curtains | 2560×1440 | 7 planes, 7 objects | 2 boughs | drifting aurora curtains, pines, meteor | 4.75 | 58 / 17 fps | simple pines; soft ribbons | Fair–Good |
| 18 | Sunset Boulevard | painted 2.5D coast | 2560×1440 | 6 planes, 8 objects | 2 | palms, gulls, car, clouds | 4.75 | 57 / 23 fps | pale sky; crude palm fronds | Fair |
| 19 | Cosmic Galaxy | raymarched 3D space | 2560×1440 | 7 planes, 12 objects | 4 rocks | asteroids, stars, nebula drift | 4.75 | ~57 / ~20 fps | CG look | **Strong** |
| 20 | Synthwave | painted 2.5D grid highway | 2560×1440 | 6 planes, 9 objects | 2 palms | scanning grid, car, palms, sun pulse | 4.75 | 58 / 22 fps | crude palms | Good |

## Proposed curated shortlist (for approval)
Proposed **Approved** (7): Sakura Dreams, Ocean Depths, Enchanted Forest, Cosmic Galaxy, Cyberpunk Neon, Futuristic Sci-Fi, Synthwave.
Six featured popup slots, if approved: Ocean Depths, Sakura Dreams, Enchanted Forest, Cosmic Galaxy, Cyberpunk Neon, Futuristic Sci-Fi.

Proposed to stay **Experimental** (needs art work before approval): Aurora, Dark Academia, Sunset Boulevard, Pixel Paradise, Arctic Frost
(the only light theme — keep it available), Solar Flare.

Proposed **Archived** (hidden from discovery; existing assignments keep working): Midnight Developer, Matrix, Lavender Nights, Cozy Coding,
Dracula, Retro Terminal, Obsidian. These are flat procedural 2D images at 1920×1080 with no depth or motion; they do not meet the premium bar.
Obsidian and Retro Terminal are reasonable minimal / retro choices — the owner may prefer to keep them Experimental.

## How approval is applied
Edit `shared/theme-review.js` (data only), e.g. `{ 'preset-7': 'approved', 'preset-2': 'archived' }`.
* Approved themes appear in the Studio's **Approved themes** section and take the popup's six featured slots first.
* Archived themes disappear from discovery and from **new** automatic picks. Any repository, owner, global or automatic assignment that
  already uses one keeps it unchanged; the Studio lists such themes under **Archived, still in use** so a replacement can be chosen
  deliberately. Custom themes, uploads and imported themes are never affected.
* Covered by unit tests (`tests/core.test.js`: curated collection) and browser tests (`tests/e2e/gallery.e2e.js`).

## New backgrounds
From now on new worlds come in batches of exactly five, each submitted for visual approval before the next batch starts. No batch has been
started; the first batch waits for the owner's decision on this list.
