# RepoVibe wallpaper pipeline

RepoVibe wallpapers are **bundled local assets**: no remote wallpaper service, no network access. Everything is driven
by `wallpapers/manifest.json`, the single source of truth, from which `shared/wallpaper-catalog.js` is generated.

## What ships today (honest status)

| Style | Count | How it was made | Quality statement |
|---|---|---|---|
| **3D cinematic** | 7 | Raymarched GLSL scenes rendered offline in headless Chromium WebGL2 (`scripts/wallpapers/shaders/*.glsl`, `render3d.js`), 2560×1440, 2×2 supersampled, filmic (ACES) tonemapping | Real 3D: geometry, perspective, soft shadows, aerial perspective / height fog, reflections, volumetric aurora. Foreground/midground/background separation. They are **procedural CG renders**, not hand-painted concept art. |
| Illustrated (2D) | 20 | Procedurally painted layered vector scenes (`scenes.js`, `generate.js`), 1920×1080 | Layered 2D illustrations with glow and atmosphere. **These do not meet the "3D cinematic" bar** and are labelled *Illustrated* in the gallery. |

The 3D scenes are: alpine lake at golden hour, neon rain canyon (cyberpunk street), alien world with a giant ringed
planet, aurora over a fjord, synthwave valley, desert dunes at dusk, and ocean twilight.

**Not yet achieved (limitation, stated plainly):** the concept-art-grade scenes in the brief — a cherry-blossom
temple with steps and lanterns, a magical glowing forest with foreground foliage and a river, a 3D anime-inspired
village, a cozy futuristic room with depth, a 3D library — need either a real DCC tool (Blender, Unreal, Houdini) or
licensed premium artwork. This environment has no image-generation model, no Blender and no licensed asset library,
and procedurally raymarching dense organic scenes (trees, foliage, architecture with stairs and lanterns) to a
premium standard was not feasible here. Presets that still use 2D illustrations are listed in the PR description and
carry the *Illustrated* badge. Nothing is presented as 3D unless it is a 3D render.

## Adding premium 3D wallpapers (recommended workflow)

1. **Create or license the art.**
   - Own renders: Blender (Cycles/EEVEE), Unreal Engine (Movie Render Queue), Houdini, or similar. Recommended
     composition for RepoVibe: keep the strongest detail in the outer thirds and the upper area; the centre column is
     covered by GitHub content (glass panels), and the readability guard raises panel opacity over very bright areas.
   - Licensed packs: only use assets whose licence permits redistribution inside a browser extension (e.g. CC0,
     CC BY with attribution, or a commercial licence that names software redistribution). Keep the licence text.
   - Never use copyrighted characters, franchise artwork or AI outputs whose terms forbid redistribution.
2. **Export** a PNG, JPEG or WebP of at least 1920×1080 (2560×1440 or larger preferred), 16:9.
3. **Import** it:
   ```bash
   npm run wallpapers:import -- path/to/render.png --slug misty-temple --name "Misty temple" \
     --category Anime-inspired --style 3d --license "CC BY 4.0" --attribution "Jane Doe" \
     --source-url https://example.com/original
   ```
   The importer centre-crops to 2560×1440 WebP (quality 0.9) and a 480×270 thumbnail, appends the manifest entry
   (`source: "imported"`), and regenerates the catalog. It refuses to run without `--license`, `--attribution` and
   either `--source-url` or `--license-file`.
4. **Assign** it to a preset by editing `PRESET_WALLPAPERS` in `shared/core.js` (index = preset order), or leave it as
   an extra choice users can pick in Studio → Background.
5. **Verify**: `npm run wallpapers:catalog` (validates files, dimensions, licence fields and measures the readability
   tones), then `npm test`, `npm run test:e2e`, `npm run package && npm run verify:package`.
6. **Credit** the author in `wallpapers/LICENSE.md` (and the PR) when the licence requires attribution.

## Regenerating the bundled assets

```bash
npm run wallpapers   # 2D scenes + 3D renders + catalog (3D renders take ~1–2 min each with software GL)
```

Renders are deterministic for a given Chromium version. Individual scenes: `node scripts/wallpapers/render3d.js
alien-world`; fast composition previews: `--preview 960x540 --out /tmp/previews`.

## How assets are used at runtime

- Content scripts reference bundled wallpapers via `chrome-extension://…/wallpapers/<slug>.webp`
  (`web_accessible_resources`, github.com only). Uploaded wallpapers live in IndexedDB and are served by the service
  worker.
- The **readability guard** (`RepoVibeCore.requiredGlass`) uses each wallpaper's measured 98th/2nd-percentile colours
  from the catalog to raise glass opacity just enough that text stays ≥ 4.5:1 — so very bright art stays readable.
