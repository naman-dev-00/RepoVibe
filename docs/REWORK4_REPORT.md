# Additional visual feedback (round 3b, 2026-11-12)

Statuses unchanged: approved — Enchanted Forest, Cosmic Galaxy, Futuristic Sci-Fi, Pixel Paradise, Arctic Frost; experimental — Sakura Dreams,
Ocean Depths (and the other non-reviewed themes); archived — Synthwave theme and the six backgrounds listed in `docs/REWORK3_REPORT.md`.

## Sakura Dreams (painted, `scripts/wallpapers/sakura-paint.py`)
* **Straight road**: a stone-paved road runs dead straight to the vanishing point (it previously wavered), with paving rows in perspective,
  staggered joints and pale curbs; fallen petals lie on it.
* **Anime look**: a saturated blue sky fading to a pink-white horizon with big cel-shaded cumulus (white lit tops, lavender-blue shade, flat
  bases); a snow-capped volcanic peak at the end of the road (lit snow face / shaded face, haze toward its foot); every blossom cluster is first
  laid down as a cel-shaded clump (shadow tone + lit cap) and then covered with individual blossoms, so crowns read as full, rounded anime
  masses; fresher meadow greens. The ~130 trees from round 3 (avenue, orchard, hill groves, arching near crowns) are kept.
* Text backing unchanged: rose-tinted, guarded opacity, 0 AA failures.

## Cyberpunk Neon — drizzle matched to the ripples
* Rain → **drizzle**: about half as many streaks, shorter and hairline (round caps), falling at roughly 40 % of the previous speed
  (near 1.5 s / far 2.6 s per 400 px loop instead of 0.62 / 1.05 s).
* The canal rings now match it: each of the 20 drop points lands **once every 7–10 s** (the ring spreads and fades in the first third of its
  cycle, then the water there is calm), so about two light rings are spreading at any moment — previously every point rang continuously
  every ~3 s. Rings rest (faint) in Static and reduced motion and keep running in Lite.

## Ocean Depths
* **Turtles swim forward**: the sea-life sprites face left but the turtle and one fish school crossed left → right, i.e. tail first. Every
  crossing swimmer now travels the way it faces; the pop-out turtle and fish paddle in place instead of drifting backwards. Browser test checks
  every swimmer's direction and that the turtle's x decreases over time; evidence `docs/screenshots/rework4/motion/ocean-turtle-forward.jpg`.
* **No plants on the middle rock**: the four seagrass sprites (which stood on the rock) are removed, and baked seagrass now grows only in the
  sand (never on rock).
* Refinement: soft contact shadows under the rocks, cooler blue-green seagrass. Plants: 16 swaying (kelp, sea fans, soft corals, anemones).

## Evidence (real github.com page replay, logged out; default Auto quality)
* Before (round 3) / after: `docs/screenshots/rework4/compare/{sakura-dreams,cyberpunk-neon,ocean-depths}.jpg`
* Motion: `docs/screenshots/rework4/motion/` — Sakura updated scene, Cyberpunk drizzle + rings (four frames 0.5 s apart), Ocean turtle head first
* Recordings: `docs/recordings/rework4/`

## Tests
Unit 36/36. Browser E2E full run 82/83 — the one failure was the Lite-mode test still expecting Ocean's `repv-cross` animation (swimmers now
use `repv-cross-rev`); expectation updated, the rework file re-ran 7/7. New test: swimmers head first, no plants on the middle rock.

## Limitations
* Sakura is a stylised procedural painting in an anime spirit, not hand-drawn anime art.
* GPU smoothness and signed-in GitHub visuals are UNVERIFIED.
