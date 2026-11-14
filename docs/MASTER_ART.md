# Master artwork: what to supply and how it is integrated

Some scenes cannot be drawn by code without losing what makes the reference beautiful (painted foliage, architecture, water, interiors).
For those the artwork comes from you, and RepoVibe's job is to **keep it exactly as supplied** and add motion around it.

Scenes waiting for master artwork: **Cherry Blossom**, **Anime Street**, **Waterfall**, **Cozy Coding** (autumn room).
They are not registered and have no placeholder: nothing appears in the gallery until real artwork exists.

## Rights (required)
RepoVibe may ship commercially, so every file needs a right to redistribute it commercially, including modified/layered versions:
commissioned work with a written licence, a stock licence that covers redistribution inside a product, or an image generator whose
terms grant commercial use of outputs. A picture found online is not usable, and neither are the reference screenshots themselves.
Record it in `world.json` (`license`, `attribution`, `source`); the intake refuses empty or placeholder values, and the text is copied
into `wallpapers/manifest.json` and `wallpapers/LICENSE.md` stays the place to keep any licence document.

## Files: `art-masters/<slug>/` (not committed, not shipped)
| File | Required | Notes |
|---|---|---|
| `world.json` | yes | `name`, `category`, `description`, `license`, `attribution`, `source`, optional `focal: [x, y]` (0–1) |
| `master.png` | yes | The complete illustration. **3840 × 2160 or larger**, landscape. PNG or lossless WebP (JPEG works but bakes in its artefacts). |
| `far.png` `mid.png` `near.png` `front.png` | recommended | The same illustration split into depth layers on the **same canvas**, transparent where empty. Painted behind each cut (no holes where a nearer layer moves). |
| `rays.png` | optional | Light shafts / glow on transparency. |
| `s-<name>.png` | per scene | Elements that move on their own, as transparent cut-outs (see below). |
| `t-<name>.png` | per scene | Seamless tiles (falling petals, water texture, mist). |

Portrait references: supply a landscape composition (the scene extended sideways by the artist), not a stretched or letterboxed portrait.
The intake crops to 16:9 around `focal` and never changes the aspect ratio.

## What the intake does (`scripts/wallpapers/import-master.py <slug>`)
* **Refuses** missing rights, a master below 2560 × 1440, layers that do not match the master's canvas or do not composite back to it,
  and images that were **enlarged from a smaller original**. The last check measures how much edge detail survives a 2× down-and-up
  resample: genuine full-resolution art keeps 0.4–0.85 of it, an enlarged image keeps more than 0.9 (your 740-px aurora reference
  enlarged to 3840 px scores 0.99). `--check-only` reports without writing.
* **Never** repaints, sharpens, blurs, recolours or upscales. Output is the supplied pixels, cropped if needed, encoded as WebP at
  quality 93 with alpha preserved.
* Writes the full-size layers (up to 3840 wide) **and** 2560-wide variants. The page uses the 4K set only when the screen can show
  more than 2560 device pixels; smaller screens get the 2560 set, so nothing is upscaled when a sharper file exists and laptops do not
  decode 4K layers.
* Reports package size and decoded image memory, so a scene that is too heavy is visible before it ships.

## Per-scene layer brief
The motion is added around the plate; the plate itself does not move.

**Cherry Blossom (enchanted sakura forest)**
`far` sky, mountains, distant trees · `mid` the path, bushes, mid-distance trees · `near` the large framing trees' trunks and main
canopy · `front` nearest overhanging branches. Sprites: 4–8 separate blossom boughs (`s-boughA…`) cut where they join a branch, so
each can sway on its own from that joint; 3 single petals (`s-petalA…C`). Tiles: none needed (petal fields are generated).

**Anime Street (sunset neighbourhood)**
`far` sky without clouds · `mid` distant street and far houses · `near` main houses, poles, cables, road with its shadows · `front`
nearest tree/eave if any. Sprites: 2–3 clouds (`s-cloudA…`), 3–6 blossom branches cut at their joints, petals. Buildings, wires and
the road stay in the plates and are never animated.

**Waterfall (sunlit forest waterfall)**
`far` sky/forest behind the cliff · `mid` cliff and rocks **without the falling water** (rock painted behind it) · `near` pool, bank,
plants · `front` nearest leaves/branches. Tiles: `t-water` a vertically seamless strip of the fall's streaks (it scrolls downward
inside the fall's shape), `t-mask-fall` the fall's shape in white on transparent, `t-ripple` seamless pool ripple. Sprites: `s-mist`
soft mist, `s-splash` 2–3 splash shapes, 4–6 plant fronds cut at their bases.

**Cozy Coding (autumn room)**
`far` the view outside the window (tree, foliage, sky) · `mid` wall, window frame with real transparent panes, pictures · `near`
desk, lantern, papers, chair (and the character, if you want one in the scene) · `front` anything nearer. Sprites: 3–5 leaf clusters
outside (sway), `s-flame` the candle flame, single leaves. Tiles: none needed.

If only `master.png` is supplied the scene still works as one sharp plate; motion is then limited to overlays (petals, light, mist),
which is less convincing than layered art but never degrades the illustration.
