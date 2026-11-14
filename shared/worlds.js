'use strict';
/* Data-only definitions of the additional immersive worlds: sprites, particle tiles and mist. No code runs from here:
   content.js reads this registry and builds the layers/sprites. Coordinates are in the 16:9 "stage" the baked layers share
   (x/y in %, w in % of stage width), so every object stays registered with the artwork at any aspect ratio.
   Scene units used by the shaders: x ∈ [-0.889, 0.889], y ∈ [-0.5, 0.5] (up); helper `at` converts them. */
(function () {
  const AR = 16 / 9;
  const X = x => +(50 + (x / AR) * 100).toFixed(2), Y = y => +(50 - y * 100).toFixed(2);
  // sprite rendered with `span` scene-heights tall and `ratio` = width/height, centred on scene point (cx, cy)
  const stageW = (ratio, span) => +((ratio * span / AR) * 100).toFixed(2);
  const W = {};

  /* ---- Sakura Dreams: a Japanese garden at sunrise. Both cherry trees are sprites whose heads pivot at the trunk fork. */
  /*REF-SAKURA-BEGIN*/
  const REF_SAKURA = [{"n":"treeNearL","plane":"scene","x":27.5,"y":49.03,"w":50.94,"k":1.28,"z":3,"wind":0.45,"ox":"2.9%","oy":"99.7%","fl":7.0},{"n":"treeNearR","plane":"scene","x":76.02,"y":48.16,"w":49.53,"k":1.28,"z":3,"wind":0.4,"ox":"91.3%","oy":"99.7%","fl":7.6},{"n":"treeMidL","plane":"scene","x":21.15,"y":54.62,"w":23.55,"k":0.86,"z":2,"wind":0.9,"ox":"53.1%","oy":"99.5%","fl":5.4},{"n":"treeMidR","plane":"scene","x":75.18,"y":55.24,"w":19.96,"k":0.86,"z":2,"wind":1.0,"ox":"64.8%","oy":"99.2%","fl":5.0}];
  /*REF-SAKURA-END*/
  const treeSpan = 0.625;
  W['sakura-garden'] = {
    // Painted from scratch by scripts/wallpapers/sakura-paint.py (concept from the owner's reference): sky in the far layer, mountains, groves, meadow and
    // path in the mid layer (sky transparent so the cloud tile drifts behind the mountains), four recursively grown cherry trees as sprites whose crowns
    // sway on the shared gust from the trunk base; every blossom is an individual five-petal flower. Petals fall in tile planes and 3D-shaded sprites.
    tiles: [
      { plane: 'pfar', image: 't-clouds', region: [0, 0, 1, 0.5], rel: 0.8, w: 2048, h: 1024, sx: -1, sy: 0, t: 260 },
      { plane: 'pmid', shape: 'petal', seed: 5, w: 900, h: 640, n: 26, colors: ['#ff8fc0', '#ffc2dc', '#e65ca0'], r: [4, 8], sx: -1, sy: 2, t: 20, gust: true },
      { plane: 'pnear', shape: 'petal', seed: 11, w: 1100, h: 760, n: 11, colors: ['#ffb0d0', '#ff7fb2', '#fff0f6'], r: [10, 17], sx: -1, sy: 2, t: 12, gust: true }
    ],
    sprites: [
      ...REF_SAKURA,
      // falling petals share the gust: each wrapper is pushed sideways by the same travelling gust
      { n: 'pt1', src: 'petalA', plane: 'scene', k: 0.7, x: 12, y: 0, w: 1.3, fall: 30, dx: 240, rot: 220, sw: 42, sway: 4.6, flut: 2.4, fa: 36, turn: 3.1, sy: 38, gust: 90 },
      { n: 'pt2', src: 'petalB', plane: 'scene', k: 1.5, x: 34, y: 0, w: 1.9, fall: 23, dx: 320, rot: -180, sw: 60, sway: 3.9, flut: 2.1, fa: 44, turn: 2.7, sy: 62, flip: 1, gust: 150 },
      { n: 'pt3', src: 'petalC', plane: 'scene', k: 2.1, x: 58, y: 0, w: 2.6, fall: 19, dx: 300, rot: 240, sw: 80, sway: 3.5, flut: 1.9, fa: 48, turn: 2.4, sy: 78, gust: 220 },
      { n: 'pt4', src: 'petalA', plane: 'scene', k: 1.1, x: 77, y: 0, w: 1.6, fall: 27, dx: 280, rot: 150, sw: 50, sway: 4.2, flut: 2.5, fa: 40, turn: 3.0, sy: 22, flip: 1, gust: 120 },
      { n: 'pt5', src: 'petalB', plane: 'scene', k: 0.9, x: 91, y: 0, w: 1.4, fall: 33, dx: 200, rot: -200, sw: 36, sway: 5.0, flut: 2.8, fa: 32, turn: 3.6, sy: 52, gust: 80 },
      { n: 'pt6', src: 'petalC', plane: 'scene', k: 1.8, x: 46, y: 0, w: 2.3, fall: 21, dx: 340, rot: 190, sw: 70, sway: 3.7, flut: 2.0, fa: 46, turn: 2.5, sy: 44, gust: 200 },
      { n: 'pt7', src: 'petalC', plane: 'scene', k: 1.3, x: 22, y: 0, w: 1.7, fall: 25, dx: 260, rot: 170, sw: 52, sway: 4.4, flut: 2.3, fa: 40, turn: 3.2, sy: 70, gust: 130, delay: -9 },
      { n: 'pt8', src: 'petalA', plane: 'scene', k: 2.3, x: 68, y: 0, w: 3.2, fall: 17, dx: 360, rot: -250, sw: 90, sway: 3.2, flut: 1.7, fa: 50, turn: 2.2, sy: 30, gust: 260, delay: -6 },
      // pop-out boughs (reach into the page margins and the scene band; pointer-events none)
      { n: 'sprayA', plane: 'pop', at: 'band', x: 0.98, y: 0.5, h: 1.0, k: 2.6, dx: -10, dy: 3, rot: 2, dur: 9, noShadow: 1, wind: 1.6, ox: '100%', oy: '50%' },
      { n: 'sprayB', plane: 'pop', at: 'band', x: 0.02, y: 0.45, h: 0.8, k: 2.8, dx: 10, dy: -3, rot: -2.5, dur: 11, noShadow: 1, flip: 1, wind: 1.8, ox: '0%', oy: '50%' },
      { n: 'popPetal1', src: 'petalC', plane: 'pop', at: 'band', x: 0.88, y: 0.3, h: 0.16, k: 2.9, dx: -40, dy: 26, rot: 40, dur: 7, noShadow: 1 },
      { n: 'popPetal2', src: 'petalA', plane: 'pop', at: 'band', x: 0.1, y: 0.7, h: 0.14, k: 3.0, dx: 36, dy: -22, rot: -50, dur: 8, noShadow: 1 }
    ]
  };

  /* ---- Ocean Depths: a reef under a sunlit surface. One slow current sways the corals; fish schools, a turtle and moon jellies drift through. */
  /*REF-OCEAN-BEGIN*/
  const REF_OCEAN = [{"n":"kelpL3","plane":"scene","x":1.56,"y":78.51,"w":7.03,"ox":"50%","oy":"100%","k":1.28,"z":3,"wind":3.4,"fl":5.0},{"n":"kelpL1","plane":"scene","x":5.86,"y":68.75,"w":11.64,"ox":"50%","oy":"100%","k":1.28,"z":3,"wind":2.6,"fl":6.2},{"n":"kelpL2","plane":"scene","x":12.89,"y":73.61,"w":9.53,"ox":"50%","oy":"100%","k":1.28,"z":3,"wind":3.0,"fl":5.6},{"n":"kelpR3","plane":"scene","x":98.83,"y":79.17,"w":7.3,"ox":"50%","oy":"100%","k":1.28,"z":3,"wind":3.6,"fl":4.8},{"n":"kelpR1","plane":"scene","x":95.31,"y":67.36,"w":11.02,"ox":"50%","oy":"100%","k":1.28,"z":3,"wind":2.4,"fl":6.6},{"n":"kelpR2","plane":"scene","x":87.89,"y":75.69,"w":8.71,"ox":"50%","oy":"100%","k":1.28,"z":3,"wind":3.2,"fl":5.2},{"n":"fanL2","plane":"scene","x":15.62,"y":76.11,"w":11.72,"ox":"50%","oy":"100%","k":0.86,"z":2,"wind":2.8,"fl":4.9},{"n":"fanL","plane":"scene","x":21.88,"y":64.69,"w":16.41,"ox":"50%","oy":"100%","k":0.86,"z":2,"wind":2.4,"fl":5.4},{"n":"fanR","plane":"scene","x":77.34,"y":64.62,"w":14.84,"ox":"50%","oy":"100%","k":0.86,"z":2,"wind":2.6,"fl":5.0},{"n":"fanR2","plane":"scene","x":84.38,"y":75.35,"w":11.72,"ox":"50%","oy":"100%","k":0.86,"z":2,"wind":3.0,"fl":4.6},{"n":"softL","plane":"scene","x":29.69,"y":81.04,"w":11.72,"ox":"50%","oy":"100%","k":1.28,"z":3,"wind":3.4,"fl":4.6},{"n":"softR","plane":"scene","x":71.09,"y":82.08,"w":8.24,"ox":"50%","oy":"100%","k":1.28,"z":3,"wind":3.6,"fl":4.4},{"n":"softL2","plane":"scene","x":35.16,"y":89.72,"w":7.81,"ox":"50%","oy":"100%","k":1.28,"z":3,"wind":3.8,"fl":4.2},{"n":"softR2","plane":"scene","x":65.62,"y":89.69,"w":8.28,"ox":"50%","oy":"100%","k":1.28,"z":3,"wind":3.9,"fl":4.0},{"n":"anemL","plane":"scene","x":39.45,"y":92.36,"w":10.12,"ox":"50%","oy":"100%","k":1.28,"z":3,"wind":4.0,"fl":3.4},{"n":"anemR","plane":"scene","x":60.94,"y":93.06,"w":9.96,"ox":"50%","oy":"100%","k":1.28,"z":3,"wind":4.2,"fl":3.2}];
  /*REF-OCEAN-END*/
  const kelp = (n, x, base, span, ratio, wind, fl) => ({ n, plane: 'scene', k: 0.64, x: X(x), y: Y(base + span / 2), w: stageW(ratio, span), z: 2, wind, ox: '50%', oy: '100%', fl });
  const school = (n, y, dx, dur, delay, scale, rev) => ({ n, plane: 'scene', k: 0.46, x: 50, y, w: scale, [rev ? 'crossRev' : 'cross']: dur, dx: 0, dy: 0, rot: 0, delay, swim: { wob: 8, wp: 1.1, tilt: 3 } });
  W['ocean-kingdom'] = {
    // Painted from scratch by scripts/wallpapers/ocean-paint.py (concept from the owner's reference): water column, reef walls, corals and sand in the far
    // layer; kelp, sea fans, soft corals and seagrass are separate sprites that sway on the shared current from their holdfasts; two counter-moving caustic
    // planes are masked onto the sunlit sand, light shafts breathe; the sea life (fish schools, a turtle, moon jellies) are raymarched 3D models shaded
    // into the water's haze. Hybrid 2.5D, not 3D geometry.
    tiles: [
      { plane: 'pfar', image: 't-caustic', mask: 't-mask-sand', region: [0.38, 0.49, 1, 1], rel: 0.42, w: 1024, h: 1024, sx: 1, sy: 0.6, t: 52 },
      { plane: 'mist', image: 't-caustic', mask: 't-mask-sand', region: [0.38, 0.49, 1, 1], rel: 0.29, w: 1024, h: 1024, sx: -1, sy: -0.4, t: 41 },
      { plane: 'pmid', shape: 'dot', seed: 3, w: 900, h: 700, n: 60, colors: ['#e8fdff', '#bff3ff'], r: [1.2, 2.6], sx: 0, sy: 1, t: 95, gust: false },
      { plane: 'pnear', shape: 'bubble', seed: 15, w: 1200, h: 900, n: 7, colors: ['#e8fbff'], r: [9, 16], sx: 0, sy: -1, t: 22, gust: true }
    ],
    sprites: [
      ...REF_OCEAN,
      // a distant school, half lost in the blue (opacity = water haze): gives depth without another cartoon animal
      { ...school('fishA', 22, 0, 70, -10, 1.2, 1), op: 0.5 }, { ...school('fishA', 24, 0, 70, -13, 1.0, 1), op: 0.45 }, { ...school('fishA', 21, 0, 70, -15, 0.9, 1), op: 0.45 },
      { ...school('fishA', 25, 0, 70, -18, 1.1, 1), op: 0.5 }, { ...school('fishA', 23, 0, 70, -21, 0.8, 1), op: 0.4 }, { ...school('fishA', 26, 0, 70, -24, 1.0, 1), op: 0.45 },
      { n: 'turtle', plane: 'scene', k: 0.86, x: 50, y: 36, w: stageW(760 / 520, 0.15), crossRev: 120, dx: 0, dy: 0, rot: 0, delay: -70, swim: { wob: 10, wp: 2.8, tilt: 3.5 } },
      // every swimmer travels the way it faces: the sea-life sprites face left, so they all cross right → left
      school('fishA', 40, 0, 36, -2, 3.2, 1), school('fishA', 43, 0, 36, -5, 2.6, 1), school('fishA', 38, 0, 36, -8, 2.9, 1), school('fishA', 45, 0, 36, -11, 2.2, 1), school('fishA', 41, 0, 36, -14, 2.7, 1),
      school('fishB', 62, 0, 48, -6, 2.8, 1), school('fishB', 59, 0, 48, -10, 2.4, 1), school('fishB', 65, 0, 48, -16, 2.6, 1), school('fishB', 61, 0, 48, -21, 2.1, 1),
      { n: 'jelly1', src: 'jelly', plane: 'scene', k: 0.64, x: 66, y: 0, w: stageW(520 / 720, 0.26), rise: 70, sw: 34, sway: 6.5, flut: 7, fa: 4, sy: 38 },
      { n: 'jelly2', src: 'jelly', plane: 'scene', k: 1.1, x: 82, y: 0, w: stageW(520 / 720, 0.2), rise: 55, sw: 26, sway: 5.2, flut: 6, fa: 5, sy: 55, delay: -25 },
      { n: 'b1', src: 'bubble', plane: 'scene', k: 0.86, x: 40, y: 100, w: 1.0, rise: 16, sw: 18, sway: 3.4, flut: 2, fa: 5, sy: 70 },
      { n: 'b2', src: 'bubble', plane: 'scene', k: 1.1, x: 46, y: 100, w: 1.5, rise: 21, sw: 24, sway: 4.1, flut: 2, fa: 5, sy: 48, delay: -9 },
      { n: 'b3', src: 'bubble', plane: 'scene', k: 1.5, x: 61, y: 100, w: 0.8, rise: 14, sw: 14, sway: 3.0, flut: 2, fa: 5, sy: 30, delay: -5 },
      { n: 'b4', src: 'bubble', plane: 'scene', k: 1.8, x: 12, y: 100, w: 1.9, rise: 25, sw: 30, sway: 4.4, flut: 2, fa: 5, sy: 60, delay: -17 },
      { n: 'b5', src: 'bubble', plane: 'scene', k: 1.1, x: 88, y: 100, w: 1.2, rise: 18, sw: 20, sway: 3.7, flut: 2, fa: 5, sy: 42, delay: -3 },
      // pop-outs: sea life and foreground coral, closer to the viewer
      { n: 'jelly', plane: 'pop', at: 'band', x: 0.96, y: 0.5, h: 0.9, k: 2.6, dx: -8, dy: -10, rot: 3, dur: 10, noShadow: 1, swim: { wob: 18, wp: 4.4, tilt: 3 } },
      { n: 'turtleP', src: 'turtle', plane: 'pop', at: 'band', x: 0.04, y: 0.55, h: 0.42, k: 2.8, dx: 0, dy: -6, rot: -1.5, dur: 9, noShadow: 1, flip: 1, swim: { wob: 6, wp: 3, tilt: 4 } }, // paddles in place (no backward drift)
      { n: 'softRp', src: 'softR', plane: 'pop', at: 'margin', side: 'right', y: 0.82, h: 0.24, k: 2.4, dx: -4, dy: 0, rot: 1, dur: 9, noShadow: 1, wind: 3.0, ox: '50%', oy: '100%' },
      { n: 'kelpLp', src: 'kelpL2', plane: 'pop', at: 'margin', side: 'left', y: 0.6, h: 0.5, k: 2.5, dx: 4, dy: 0, rot: -1, dur: 10, noShadow: 1, wind: 2.8, ox: '50%', oy: '100%' },
      { n: 'fishPop', src: 'fishA', plane: 'pop', at: 'band', x: 0.6, y: 0.4, h: 0.22, k: 2.9, dx: 0, dy: -6, rot: 1, dur: 7, noShadow: 1, swim: { wob: 6, wp: 1.1, tilt: 3 } }
    ]
  };

  // helpers shared by the remaining worlds. base(): sprite whose base sits at (bx, by) in scene units; at(): centred at (cx, cy)
  const BASE = 0.48; // the shaders draw bottom-anchored sprites with the base at local y = -0.48
  const base = (n, bx, by, ratio, span, o) => Object.assign({ n, plane: 'scene', x: X(bx), y: Y(by + BASE * span), w: stageW(ratio, span), ox: '50%', oy: '100%' }, o);
  const at = (n, cx, cy, ratio, span, o) => Object.assign({ n, plane: 'scene', x: X(cx), y: Y(cy), w: stageW(ratio, span) }, o);

  /* ---- Arctic Frost (light theme): a golden-hour alpine valley over a frozen lake. Snow flurries ride the shared gust; spruces sway; a fox crosses the ice. */
  W['arctic-frost-3d'] = {
    tiles: [
      { plane: 'pfar', shape: 'flake', seed: 4, w: 800, h: 600, n: 46, colors: ['#ffffff', '#e4f3ff'], r: [2.5, 4.5], sx: -1, sy: 3, t: 30, gust: true },
      { plane: 'pmid', shape: 'flake', seed: 9, w: 900, h: 700, n: 58, colors: ['#ffffff', '#d6ecff'], r: [3.5, 7.5], sx: -1, sy: 3, t: 18, gust: true },
      { plane: 'pnear', shape: 'flake', seed: 17, w: 1100, h: 800, n: 10, colors: ['#ffffff'], r: [9, 14], sx: -1, sy: 3, t: 11, gust: true }
    ],
    sprites: [
      // the closest spruces on the near shore sway on the gust; the lake in the centre stays open
      base('pineA', -0.64, -0.13, 558 / 900, 0.36, { k: 0.64, z: 2, wind: 1.2, fl: 5.2 }), base('pineC', 0.68, -0.13, 508 / 820, 0.32, { k: 0.64, z: 2, wind: 1.4, fl: 4.8 }),
      base('pineB', 0.44, -0.125, 471 / 760, 0.24, { k: 0.64, z: 2, wind: 1.1, fl: 5.6 }),
      at('fox', 0, -0.3, 520 / 300, 0.08, { k: 0.86, cross: 70, dx: 0, dy: 0, rot: 0, delay: -18, swim: { wob: 4, wp: 0.7, tilt: 1.5 } }),
      // two wind-blown flake sprites in the foreground
      { n: 'f1', src: 'flake', plane: 'scene', k: 1.8, x: 20, y: 0, w: 2.3, fall: 18, dx: 340, rot: 160, sw: 60, sway: 3.6, flut: 2.0, fa: 40, turn: 2.6, sy: 40, gust: 220 },
      { n: 'f2', src: 'flake', plane: 'scene', k: 2.1, x: 66, y: 0, w: 3.0, fall: 15, dx: 380, rot: -140, sw: 80, sway: 3.2, flut: 1.8, fa: 44, turn: 2.3, sy: 62, gust: 260 },
      { n: 'pineAp', src: 'pineA', plane: 'pop', at: 'band', x: 0.03, y: 0.55, h: 1.0, k: 2.8, dx: 8, dy: 0, rot: -1.5, dur: 10, noShadow: 1, wind: 1.6, ox: '50%', oy: '100%' }
    ]
  };

  /* ---- Aurora: three flowing aurora ribbons (rays stream along each ribbon, the ribbon undulates and breathes, in different directions and
     tempos), a clear star field drifting slowly across the sky; pines sway on a still night; a meteor streaks. */
  W['aurora-borealis'] = {
    // Frozen fjord valley painted by scripts/wallpapers/aurora-paint.py (art direction from the owner's reference). The great massif and the dark
    // rocks are in the front layer, so the aurora (ribbons + veils, mid-depth sprites) hangs behind them and in front of the distant ranges.
    tiles: [
      // the sky turns: a star plane drifts slowly and seamlessly to the west (the painted stars stay as the deep field)
      { plane: 'pfar', shape: 'dot', seed: 2, w: 900, h: 600, n: 64, colors: ['#ffffff', '#dff0ff', '#ffe6f6'], r: [1.1, 2.0], sx: -1, sy: 0, t: 320 },
      // ground mist slides across the ice (the one plane that keeps moving in Lite)
      { plane: 'pmid', image: 't-mist', mask: 't-mask-low', region: [0, 0.6, 1, 1], rel: 1.0, w: 2048, h: 512, sx: 1, sy: 0, t: 110 }
    ],
    sprites: [
      // soft plumes behind the ribbons: they breathe, drift and tilt slowly, each on its own clock
      { n: 'veilA', plane: 'scene', k: 0.46, x: 46, y: 30, w: 50, dx: 46, dy: -14, rot: 5, dur: 23, fx: 'pulse', gl: 8, z: 1 },
      { n: 'veilB', plane: 'scene', k: 0.46, x: 74, y: 26, w: 44, dx: -40, dy: 10, rot: -6, dur: 31, fx: 'pulse', gl: 11, z: 1 },
      { n: 'veilC', src: 'veilA', plane: 'scene', k: 0.46, x: 14, y: 24, w: 34, dx: 30, dy: 12, rot: 7, dur: 27, fx: 'pulse', gl: 6.5, z: 1, flip: 1, op: 0.8 },
      // ribbons: 3200×640 = two periods of 1600×640; w is one period's width on the stage. flow 1 streams right→left, -1 left→right; dur = one period
      at('ribbonA', 0.02, 0.28, 1600 / 640, 0.74, { k: 0.46, z: 1, fx: 'flow', dur: 70, flow: 1, gl: 7, sway: 13, skew: 3 }),
      at('ribbonB', -0.38, 0.25, 1600 / 640, 0.6, { k: 0.46, z: 1, fx: 'flow', dur: 95, flow: -1, gl: 9, sway: 17, skew: -2.5 }),
      at('ribbonC', 0.42, 0.33, 1600 / 640, 0.52, { k: 0.46, z: 1, fx: 'flow', dur: 120, flow: 1, gl: 11, sway: 21, skew: 2 }),
      { n: 'iceGlow', plane: 'scene', k: 0.64, x: 44, y: 82, w: 46, dx: 30, dy: 0, rot: 0, dur: 12, fx: 'pulse', gl: 5, z: 2 },
      { n: 'shimmer', plane: 'scene', k: 0.64, x: 50, y: 80, w: 30, dx: 34, dy: 0, rot: 0, dur: 7, fx: 'pulse', gl: 2.1, z: 2 },
      { n: 'shimmerB', src: 'shimmer', plane: 'scene', k: 0.64, x: 62, y: 90, w: 24, dx: -28, dy: 0, rot: 0, dur: 9, fx: 'pulse', gl: 2.9, z: 2, flip: 1 },
      ...[[9, 9, 2.4, 1.6], [27, 14, 1.7, 2.3], [41, 6, 2.8, 1.9], [57, 15, 1.9, 2.7], [69, 5, 2.3, 1.4], [84, 12, 2.9, 2.1], [93, 24, 1.8, 3.0], [36, 28, 1.6, 2.5], [64, 30, 1.7, 1.7]]
        .map(([x, y, w, gl], i) => ({ n: `star${i + 1}`, src: 'sparkle', plane: 'scene', k: 0.46, x, y, w, dx: 0, dy: 0, rot: 0, dur: 8, fx: 'pulse', gl, z: 1 })),
      at('meteor', 0.2, 0.3, 8, 0.05, { k: 0.46, cross: 22, dx: 0, dy: 0, rot: 0, delay: -9 }),
      // frosted shrubs on the foreground rocks sway on the shared gust
      { n: 'shrub', plane: 'scene', k: 1.28, x: 90.5, y: 66, w: 7, z: 4, wind: 2.2, ox: '50%', oy: '100%', fl: 4.6 },
      { n: 'shrubB', src: 'shrub', plane: 'scene', k: 1.28, x: 5, y: 62, w: 5, z: 4, wind: 2.6, ox: '50%', oy: '100%', fl: 5.3, flip: 1 },
      { n: 'shrubP', src: 'shrub', plane: 'pop', at: 'band', x: 0.975, y: 0.62, h: 0.7, k: 2.6, dx: -4, dy: 0, rot: 1.2, dur: 10, noShadow: 1, wind: 1.6, ox: '50%', oy: '100%' },
      { n: 'shrubQ', src: 'shrub', plane: 'pop', at: 'band', x: 0.025, y: 0.66, h: 0.6, k: 2.8, dx: 4, dy: 0, rot: -1.2, dur: 12, noShadow: 1, flip: 1, wind: 1.8, ox: '50%', oy: '100%' }
    ]
  };

  /* ---- Matrix: a data city under falling code. Three seamless code-rain planes at different depths (small/dim/slow → large/soft/fast) slide
     straight down by exactly one tile per loop, and individual bright streams fall from above the stage to below it at their own speeds:
     the code moves continuously top → bottom. Painted by scripts/wallpapers/matrix-paint.py. */
  // [image, x %, width %, depth k, seconds per fall, phase 0..1]
  const STREAMS = [['streamE', 3, 1.2, 0.46, 13, 0.1], ['streamB', 8, 1.5, 0.64, 10, 0.55], ['streamA', 13.5, 2.25, 0.86, 7.5, 0.3], ['streamD', 18, 3.45, 1.28, 5.6, 0.8],
    ['streamC', 23, 1.95, 0.64, 9, 0.05], ['streamE', 27.5, 1.2, 0.46, 12, 0.62], ['streamF', 32, 4.35, 1.28, 5, 0.42], ['streamB', 37, 1.65, 0.64, 9.5, 0.9],
    ['streamA', 42, 2.1, 0.86, 8, 0.18], ['streamE', 46, 1.2, 0.46, 14, 0.7], ['streamC', 50.5, 2.25, 0.86, 7, 0.48], ['streamB', 55, 1.5, 0.64, 10.5, 0.26],
    ['streamD', 60, 3.3, 1.28, 6, 0.95], ['streamE', 64, 1.2, 0.46, 12.5, 0.36], ['streamA', 68.5, 2.1, 0.86, 7.8, 0.66], ['streamC', 73, 1.8, 0.64, 9.2, 0.12],
    ['streamF', 78, 4.2, 1.28, 5.3, 0.58], ['streamB', 82.5, 1.5, 0.64, 10, 0.02], ['streamA', 87, 2.25, 0.86, 7.2, 0.86], ['streamE', 91, 1.2, 0.46, 13.5, 0.44],
    ['streamD', 95, 3.3, 1.28, 5.8, 0.22], ['streamC', 98.5, 1.95, 0.64, 8.6, 0.74]];
  W['digital-rain'] = {
    tiles: [
      { plane: 'pfar', image: 't-codeFar', rel: 0.5, w: 1024, h: 1024, sx: 0, sy: 1, t: 16 },
      { plane: 'pmid', image: 't-codeMid', rel: 0.8, w: 1024, h: 1024, sx: 0, sy: 1, t: 11 },
      { plane: 'pnear', image: 't-codeNear', rel: 1.25, w: 1024, h: 1024, sx: 0, sy: 1, t: 7 }
    ],
    sprites: [
      // anchored by the bottom edge on the stage's top edge: a stream starts fully above the scene and leaves fully below it
      ...STREAMS.map(([src, x, w, k, dur, ph], i) => ({ n: `st${i + 1}`, src, plane: 'scene', k, x, y: 0, w, anchor: 'bottom', fx: 'stream', dur, delay: +(-dur * ph).toFixed(2), rest: ph, z: k > 1 ? 4 : 2,
        ...(k < 0.5 ? { op: 0.7 } : {}) }))
    ]
  };

  /* ---- Dracula: a gothic city under a huge moon. Moonlit clouds drift across the sky, low fog slides between the rows of houses, bats cross
     the moon with beating wings, every street lamp breathes, the moon's halo pulses. Painted by scripts/wallpapers/dracula-paint.py. */
  const LAMPS = [[0.035, 0.9], [0.105, 0.86], [0.895, 0.86], [0.965, 0.9], [0.3, 0.93], [0.5, 0.95], [0.7, 0.93]];
  const bat = (n, y, w, k, dur, delay, rev, fp) => ({ n, src: 'bat', plane: 'scene', k, x: 50, y, w, [rev ? 'crossRev' : 'cross']: dur, dx: 0, dy: 0, rot: 0, delay, swim: { wob: 30, wp: 0.9, tilt: 7 }, flap: fp, ...(rev ? {} : { flip: 1 }) });
  W['gothic-castle'] = {
    tiles: [
      { plane: 'pfar', image: 't-clouds', mask: 't-mask-sky', region: [0, 0, 1, 0.58], rel: 0.9, w: 2048, h: 1024, sx: -1, sy: 0, t: 150 },
      { plane: 'pmid', image: 't-fog', mask: 't-mask-low', region: [0, 0.44, 1, 1], rel: 1.0, w: 2048, h: 1024, sx: 1, sy: 0, t: 90 }
    ],
    sprites: [
      { n: 'moonHalo', plane: 'scene', k: 0.46, x: 33, y: 30, w: 44, dx: 0, dy: 0, rot: 0, dur: 9, fx: 'pulse', gl: 5.5, z: 1 },
      bat('bat1', 24, 3.4, 0.64, 26, -4, 0, 0.22), bat('bat2', 31, 2.4, 0.46, 34, -17, 0, 0.19), bat('bat3', 19, 2.0, 0.46, 40, -28, 1, 0.2),
      bat('bat4', 37, 4.4, 0.86, 21, -11, 1, 0.24), bat('bat5', 28, 1.7, 0.46, 46, -36, 0, 0.18),
      ...LAMPS.map(([x, y], i) => ({ n: `lamp${i + 1}`, src: 'lampGlow', plane: 'scene', k: 1.28, x: +(x * 100).toFixed(2), y: +(y * 100).toFixed(2), w: 6.5, dx: 0, dy: 0, rot: 0, dur: 6, fx: i % 3 === 1 ? 'flicker' : 'pulse', gl: 2.6 + i * 0.45, z: 3 })),
      { n: 'branch', plane: 'pop', at: 'band', x: 0.985, y: 0.42, h: 0.8, k: 2.6, dx: -6, dy: 3, rot: 1.5, dur: 10, noShadow: 1, wind: 1.5, ox: '100%', oy: '55%' },
      { n: 'branchB', src: 'branch', plane: 'pop', at: 'band', x: 0.015, y: 0.5, h: 0.7, k: 2.8, dx: 6, dy: -3, rot: -1.5, dur: 12, noShadow: 1, flip: 1, wind: 1.7, ox: '0%', oy: '55%' },
      { n: 'popBat', src: 'bat', plane: 'pop', at: 'band', x: 0.56, y: 0.26, h: 0.13, k: 2.9, dx: -60, dy: 24, rot: -8, dur: 7, noShadow: 1, flap: 0.2 }
    ]
  };

  /* ---- Cozy Coding (second design): an anime-style autumn study in late-afternoon light. The room is the front layer and its window panes are
     really transparent, so everything outside sits behind the wall: leaves fall past the glass, three leaf clusters sway on the shared gust,
     and the tree shifts against the frame with depth. Inside, the candle flickers and its glow breathes, light shafts through the window pulse
     slowly, the mug steams. The room itself never moves. Painted by scripts/wallpapers/cozy-paint.py. Stage px → %: x / 25.6, y / 14.4. */
  W['cozy-room'] = {
    tiles: [
      { plane: 'pmid', image: 't-leaves', rel: 0.26, w: 600, h: 1200, sx: -1, sy: 1, t: 26, gust: true },   // falling leaves: outside, behind the wall (keeps moving in Lite)
      { plane: 'pnear', shape: 'dot', seed: 9, w: 900, h: 700, n: 26, colors: ['#ffe0a8', '#ffc880'], r: [0.8, 1.7], sx: -1, sy: -1, t: 140 }   // dust in the light
    ],
    sprites: [
      { n: 'clumpA', plane: 'scene', k: 0.64, x: 40, y: 22, w: 17, z: 2, wind: 2.6, ox: '50%', oy: '98%', fl: 4.8 },
      { n: 'clumpB', plane: 'scene', k: 0.64, x: 61, y: 40, w: 15, z: 2, wind: 3.1, ox: '50%', oy: '98%', fl: 5.6, flip: 1 },
      { n: 'clumpC', plane: 'scene', k: 0.64, x: 84, y: 14, w: 16, z: 2, wind: 2.2, ox: '50%', oy: '98%', fl: 4.2 },
      { n: 'beam', plane: 'scene', k: 1.28, x: 30, y: 46, w: 52, dx: 0, dy: 0, rot: 0, dur: 9, fx: 'pulse', gl: 7, z: 3 },
      { n: 'candleGlow', plane: 'scene', k: 1.28, x: 76.56, y: 82.6, w: 21, dx: 0, dy: 0, rot: 0, dur: 6, fx: 'pulse', gl: 2.3, z: 4 },
      { n: 'flame', plane: 'scene', k: 1.28, x: 76.56, y: 81.2, w: 1.4, dx: 1.5, dy: -1, rot: 4, dur: 0.9, fx: 'flicker', z: 5 },
      { n: 'steam', plane: 'scene', k: 1.28, x: 66, y: 72.4, w: 3.2, dx: 9, dy: -20, rot: 3, dur: 5, fx: 'pulse', gl: 2.6, z: 4, op: 0.5 },
      { n: 'leafPop', plane: 'pop', at: 'band', x: 0.975, y: 0.3, h: 0.3, k: 2.7, dx: -26, dy: 18, rot: 24, dur: 8, noShadow: 1, wind: 3, ox: '50%', oy: '0%' },
      { n: 'leafPopB', src: 'leafPop', plane: 'pop', at: 'band', x: 0.03, y: 0.7, h: 0.22, k: 2.9, dx: 22, dy: -14, rot: -30, dur: 10, noShadow: 1, flip: 1, wind: 3.4, ox: '50%', oy: '0%' }
    ]
  };

  /* ---- Messy Thoughts: minimalist vector line art. A still figure in white outline; its head is a tangle of scribbles in which individual
     strokes keep drawing themselves, resting and fading, each on its own clock, while the whole tangle breathes very slightly. The figure never
     moves. Generated by scripts/wallpapers/messy-thoughts.js (original; seeded maths). Rendered as inline SVG: sharp at any resolution. */
  /*MESSY-BEGIN*/
  const MESSY = {"still":[{"d":"M772 398C770 414 767 427 754 436","sw":3.2},{"d":"M754 436C704 444 652 458 630 498C614 528 606 590 600 668C595 736 592 812 588 900","sw":3.2},{"d":"M668 566C664 646 660 742 657 900","sw":3.2},{"d":"M754 436C760 462 776 478 800 484","sw":3.2},{"d":"M781 474C779 506 783 538 779 572","sw":3.2},{"d":"M831 400C833 416 836 429 849 438","sw":3.2},{"d":"M849 438C899 446 951 460 973 500C989 530 997 592 1003 670C1008 738 1011 814 1015 902","sw":3.2},{"d":"M935 568C939 648 943 744 946 902","sw":3.2},{"d":"M849 438C843 464 827 480 803 486","sw":3.2},{"d":"M822 476C824 508 820 540 824 574","sw":3.2},{"d":"M779 572C777 578 781 584 779 590","sw":3.2},{"d":"M824 574C822 581 826 587 824 594","sw":3.2},{"d":"M702 772C730 754 770 749 802 749C836 749 874 755 902 774","sw":3.2},{"d":"M875.9 219.5C861.2 253.2 828.8 380.9 804.9 382.4C780.9 383.9 745.8 247.1 760.1 226.7C774.3 206.3 887.5 266.5 873.8 283.6C860.2 300.8 722.7 327 693.9 309.7C665 292.5 692.6 207.2 734.2 200.2C775.7 193.3 891.2 252.9 895 275.9C898.8 298.8 766.2 325.7 752.8 311.3C739.3 296.9 798.5 210.4 829.7 206.3C860.9 202.2 916.8 294.4 903.9 291.5C891 288.5 768.9 181.5 767.2 191.9C765.5 202.3 906.3 317.4 895.5 341.7C884.8 366 717.4 335.5 715.1 309.4C712.8 283.4 890.7 223.2 884.6 215.8C878.4 208.3 707.5 277.2 685.5 273.6C663.4 270 736.9 178 777.8 198.3C818.7 218.7 874.1 372.6 883.3 372.1C892.5 371.6 818.1 211.4 822.2 195.8C826.3 180.1 916.5 256.8 903.2 296.4C889.9 336.1 788.2 403.5 757.8 387.4C727.4 371.4 730.3 233.7 755.9 218.9C781.5 204 867.7 278.4 881.7 315.7C895.7 353 855.7 393.7 823.6 399.3C791.5 404.9 747.3 375.9 726.2 342.7C705 309.6 691.8 243.3 721.4 238.8C750.9 234.4 838.5 304 869.1 321","sw":2.2},{"d":"M659.9 302C711 285 879.6 199.9 907.5 219.9C935.4 239.9 840.6 388.5 794.9 398.8C749.2 409.1 685.7 304.6 686.2 269.8C686.7 234.9 752.3 227.4 797.4 230C842.5 232.6 905.6 247.9 904.4 282.4C903.1 316.9 824 405.1 791.3 397C758.5 388.9 719 276.3 745.7 243.2C772.4 210 905.6 216.5 920.6 236.7C935.5 256.9 861.5 339.7 818.1 340.9C774.7 342 692.2 259.2 710.6 242.3C729 225.3 908.3 237.9 907.2 259C906.1 280 713.3 345.7 705.4 344C697.4 342.2 844.3 242.5 868.7 250.5C893.2 258.5 863.2 385.2 823.7 382.6C784.3 379.9 674.4 273.5 677.9 237.8C681.4 202.1 822.1 182.5 840.7 209.9C859.3 237.2 794.6 355.7 767.9 370.1C741.1 384.6 697.5 314.2 711.2 279.9C725 245.5 834.9 192.7 834.5 203.9C834 215 699 320.4 708.9 333.8C718.9 347.1 846.6 282 882.5 268.5","sw":1.8},{"d":"M789.5 344.5C770.8 324.3 690.6 275.8 699 246.7C707.4 217.7 805.1 173.7 830 203.9C855 234.2 813 386.5 819.6 393C826.1 399.4 884.3 243.9 861.8 235.1C839.3 226.2 704.1 342.7 710.8 350.2C717.4 357.6 869.5 268.8 893.8 271.2C918.1 273.5 855.9 366.4 828.3 361.5C800.6 356.7 749.1 253.1 760 247.8C770.8 242.5 885 310.7 880.7 335.8C876.4 361 765.3 398.4 739.2 369.6C713.1 340.7 733 192.5 754.5 196.1C775.9 199.7 848.2 379.1 843 387.1C837.7 395.2 732 268.3 729.2 234.9C726.4 201.6 822.1 200.7 829.4 226C836.8 251.3 782.2 354.2 764.7 357.3C747.1 360.5 720.9 243.5 744.4 241.4C767.9 239.3 850.7 325.4 878.4 347.3","sw":1.4,"op":0.75},{"d":"M745 233.5C743.1 230 737.1 221.6 735.9 215.7C734.6 209.8 737.3 209.1 738.7 203.9C740.1 198.6 744.4 195.7 742.9 189.3C741.4 182.9 735 178.7 731.2 171.9C727.4 165.1 727.4 161.6 723.7 155.2C720 148.7 715.5 145.9 712.8 139.7C710 133.5 710 129.5 710.1 124.1C710.2 118.6 710.6 121.2 713.3 112.3C716 103.5 719.9 83.1 723.7 79.7C727.5 76.3 732.9 90.2 732.2 95.3C731.6 100.4 724.8 104.8 720.4 105.2C716 105.5 711.3 100.5 710.3 96.9C709.2 93.4 712.8 88.9 715.4 87.5C718 86.2 721.9 88.5 723.3 90.2C724.7 91.9 722.4 95 722.2 96.2","sw":1.6,"op":0.7}],"draw":[{"d":"M688.3 288.8C723.6 273.5 813.5 193.4 859 214.7C904.5 235.9 936.7 361.3 908.3 391.6C879.9 421.9 740.2 394.8 721.5 361.2C702.8 327.7 810.8 229.1 817.9 229.4C825 229.6 766 370 755.9 362.6C745.7 355.1 766.1 228.3 768.8 193.4","sw":1.3,"dur":16.1,"delay":-13.3,"flow":1},{"d":"M714.1 239.3C742.8 258.8 847 333.2 853.2 333.3C859.3 333.5 742.8 263.1 743.8 240C744.9 216.9 866.3 206.5 858.3 221.5C850.3 236.5 704.6 299.7 705.2 312.8C705.9 325.9 834.9 275.9 861.4 284.8C888 293.7 868.4 353.8 833.7 355.8C799 357.8 692 318.9 693.6 294.5C695.1 270.1 807.5 218.5 841.2 238C874.9 257.4 887.9 386.6 856.6 388.7C825.3 390.8 688.8 283.8 689.8 248.1C690.9 212.4 826.3 222.5 861.9 215.8","sw":2.1,"dur":21.6,"delay":-12.6,"op":0.7},{"d":"M911.6 337.2C874.3 325.8 730.6 292.4 730.9 282.3C731.2 272.2 912 266.7 912.9 288.3C913.9 310 751.1 408.2 735.5 387.3C719.8 366.4 809.6 207.4 837 187.1C864.4 166.9 896.1 267 868 289.2C839.8 311.4 695.4 302 701 294.4C706.5 286.9 874.8 229 894.7 252.7C914.5 276.4 835.7 404.1 797.2 409.1C758.8 414.1 687.7 313.8 708.6 276.9C729.5 239.9 859.3 239.8 898.5 230.2","sw":1.3,"dur":17,"delay":-1.3},{"d":"M836.6 190.4C850.3 209.6 918 252.1 902.6 283.5C887.2 315 782.7 361.6 762 342.7C741.4 323.7 759.4 204.4 802.7 191.8C846.1 179.2 986.1 243.9 971.7 281.8C957.4 319.7 789.5 379.5 733.3 375.3C677 371.2 683.3 295 699.6 261.8C715.9 228.6 794.9 191.8 812.1 214.6C829.3 237.5 768.6 362.9 782.9 372.3C797.1 381.7 860.8 283.3 881.1 260.1","sw":1.5,"dur":16,"delay":-4,"flow":1},{"d":"M711.6 287.2C739.8 280.7 828.2 232.3 848.1 255.6C868.1 278.8 825.4 399.1 808 399.9C790.6 400.7 749.9 274.5 764 259.2C778 244 878.4 301.4 876.1 326.3C873.7 351.2 754.9 373.8 752.6 379.7C750.2 385.7 870.1 381.5 864.7 355.1C859.2 328.7 754.7 273.3 726 252","sw":2,"dur":12.6,"delay":-6.6},{"d":"M701.4 347.1C737.7 328.5 851.1 244.8 876.9 257.1C902.8 269.4 841.4 424.8 826.6 406.5C811.7 388.3 804.8 173.1 805.3 168.6C805.7 164.2 842.6 361.2 828.8 385.1C814.9 408.9 742.6 325.8 738.2 283.9C733.8 242.1 790.6 158.1 807.5 182.6C824.4 207.2 834.5 394.2 819.8 402.7C805.1 411.2 720.4 256.2 736.3 223.8C752.3 191.3 882.8 210.5 897 245.6C911.3 280.6 824.4 362.8 805.4 393.3","sw":1.8,"dur":16.7,"delay":-4.6,"op":0.7},{"d":"M722 221.9C751.9 243.2 849.9 329.5 866.7 324.7C883.6 319.9 805.5 190.4 803.5 198.6C801.5 206.9 844.5 363.9 857.2 364.6C870 365.4 898.2 218.8 865 202.3C831.9 185.7 706.9 281.4 696.9 284.5C687 287.6 812.5 226 816.7 217.3C820.8 208.6 737.4 215 716.9 242.4C696.4 269.8 683.1 331.3 717.5 349.9C751.9 368.5 849.1 336 883.4 332.4","sw":1.6,"dur":19.5,"delay":-2.3,"flow":1},{"d":"M736.8 213C761.7 244.3 861.7 349.2 857.2 364.3C852.8 379.4 720.8 279.7 715.3 286.2C709.7 292.8 793.2 394.3 830.4 396C867.5 397.7 922.1 317.7 895.2 294.5C868.4 271.3 698 281.6 700.5 283.7C702.9 285.8 901.4 316.9 907.2 304.6C913.1 292.2 738 215.7 728.9 224C719.7 232.3 852.1 354.3 863 344.7C873.8 335 798.2 211.9 781.4 177.3","sw":1.3,"dur":14.7,"delay":-13.3},{"d":"M785.4 184.6C770.9 219 694.5 315.8 715.2 351C735.9 386.3 892.6 373.3 885.6 355.2C878.7 337.1 685.6 293.1 681.6 263.6C677.7 234 851.6 181.2 866.5 212C881.4 242.7 778.6 411.1 753.8 412.4C729 413.6 720.6 236.1 746.5 218.2C772.3 200.3 886.3 312.1 878.9 325.6C871.6 339.2 722.7 308.2 710.9 283.6C699 259.1 828.7 207.6 821.6 206.8C814.4 206 658.3 269.8 676.4 279.8C694.6 289.8 861.2 260.3 909.3 255.2","sw":1.5,"dur":16.9,"delay":-11},{"d":"M727 311.9C741.9 328.7 767.4 408.3 799.1 393.1C830.9 377.8 901.2 256.3 880.7 238.1C860.3 220 713.3 271.9 700.2 305.2C687.1 338.4 798.2 423.9 817.3 399.1C836.3 374.4 808.8 206.2 792.4 185.6C775.9 165 735.8 256 737.8 299.5C739.9 342.9 776.7 416.5 802.4 395.9C828.2 375.3 849.9 240.2 862.3 199.6","sw":1.5,"dur":21.2,"delay":-16.1,"flow":1,"op":0.7},{"d":"M703.6 242.8C729 231.9 810.2 159.4 826.8 190C843.5 220.5 798.7 388.9 784.2 390.5C769.6 392.1 755.4 205.4 756.6 197.6C757.7 189.9 788.6 348.6 789.9 352.9C791.2 357.1 776.6 220.7 762.9 218.2C749.1 215.7 729.1 341.6 723.2 340.9C717.3 340.2 705 238.6 734.5 214.8C763.9 191 838.7 223.3 865.8 225.6","sw":1.8,"dur":15.5,"delay":-8.5},{"d":"M872.5 254.4C875.7 251.2 881.1 243.7 888.3 238.4C895.6 233.1 900.6 229.4 908.8 227.9C917 226.4 922 228.3 929.2 230.9C936.4 233.4 939.1 235.9 944.6 240.7C950.1 245.6 953.9 247.3 956.7 255.2C959.4 263.2 960.7 273 958.3 280.5C956 288 953.1 290.7 945 292.8C936.9 294.8 930.4 291.9 918 290.9C905.6 289.8 887.4 290.3 883.1 287.3C878.8 284.3 891.5 276.2 896.6 275.8C901.7 275.4 907.5 281.1 908.7 285.3C909.9 289.5 906 295.2 902.7 296.9C899.5 298.6 894.3 296.1 892.4 293.8C890.6 291.6 892 287.2 893.4 285.5C894.8 283.8 898.3 285.4 899.5 285.4","sw":1.5,"dur":15,"delay":0,"flow":0,"op":0.8},{"d":"M829.9 218.9C830.9 215.4 832.1 209.1 834.9 201.5C837.8 193.9 842.6 187.9 844.2 180.7C845.9 173.6 844.7 171.9 843.1 165.7C841.5 159.5 840.6 156.4 836.3 149.6C832 142.8 824.4 139.8 821.4 131.7C818.4 123.6 818.8 115.4 821.3 109C823.9 102.6 830.1 104.7 834.3 99.8C838.4 94.8 843.6 93.4 842 84.4C840.4 75.4 825.9 59.8 826.2 54.8C826.4 49.8 840.1 55.6 843.3 59.6C846.5 63.6 844.9 71.6 842.1 74.9C839.3 78.3 832.4 78.2 829.1 76.5C825.9 74.7 825.1 69 826 66.2C826.8 63.4 831.2 62.2 833.4 62.4C835.6 62.6 836.2 66.4 836.9 67.4","sw":1.5,"dur":17.3,"delay":-2.9,"flow":1,"op":0.8},{"d":"M729.2 251.6C723.3 251.7 710 251.4 699.4 252C688.8 252.6 685 253.5 676.3 254.6C667.6 255.7 664 255.2 656 257.4C648 259.6 642 260.9 636.2 265.6C630.4 270.2 629.7 272.7 627 280.9C624.4 289 627 297.1 622.9 306.2C618.8 315.3 611.8 318.2 606.6 326.4C601.3 334.7 595 335.2 596.6 347.6C598.2 360 614.3 381.4 614.6 388.4C614.8 395.3 600.7 386.6 597.9 382.3C595 378 597.1 370.2 600.2 367.1C603.3 363.9 610.1 364.5 613.2 366.5C616.3 368.5 616.7 374.2 615.6 377C614.6 379.7 610.1 380.6 607.9 380.2C605.7 379.8 605.4 376.1 604.8 375","sw":1.5,"dur":19.6,"delay":-6.7,"flow":0,"op":0.8},{"d":"M785.3 214.9C786.3 210.6 788 201.3 790.3 193.5C792.6 185.7 790.8 184 796.6 175.8C802.5 167.7 809.8 161 819.5 152.6C829.2 144.2 834.2 138.7 845 133.7C855.9 128.8 862.8 125.7 873.7 127.9C884.6 130 890.8 138.8 899.5 144.5C908.1 150.2 911.4 148.4 917 156.4C922.6 164.5 924.3 171.8 927.3 184.9C930.4 198 934.1 216.6 932.2 221.9C930.3 227.2 919.4 216.3 917.9 211.4C916.3 206.5 920.5 199.6 924.4 197.4C928.2 195.2 934.6 197.8 937 200.5C939.4 203.3 938.2 208.9 936.4 211.2C934.6 213.6 930 213.2 928.1 212.2C926.1 211.2 926.8 207.5 926.5 206.3","sw":1.5,"dur":21.9,"delay":-11.2,"flow":1,"op":0.8},{"d":"M881 307.6C884 308.6 890.5 310.9 896.2 312.9C901.9 315 903 316 909.4 317.9C915.8 319.8 920.4 322.3 928.3 322.5C936.1 322.6 942.6 320.7 948.7 318.7C954.7 316.8 953.8 315.8 958.7 312.7C963.7 309.5 967.4 305.8 973.3 302.8C979.1 299.9 981.5 297.6 988 298C994.5 298.3 996.6 306.3 1005.7 304.7C1014.8 303 1029 289.5 1033.6 289.9C1038.2 290.4 1032.8 303.8 1028.7 307C1024.7 310.2 1016.7 308.6 1013.3 305.8C1010 302.9 1010.1 296 1011.9 292.8C1013.6 289.6 1019.3 288.8 1022.1 289.7C1024.9 290.5 1026.2 294.9 1025.9 297.1C1025.7 299.3 1021.9 299.9 1020.9 300.6","sw":1.5,"dur":24.2,"delay":-16.5,"flow":0,"op":0.8},{"d":"M718.4 279.6C714.1 280.4 704.5 283.3 696.6 283.5C688.6 283.7 685.7 282 678.7 280.7C671.7 279.5 669.1 278.9 661.5 277.2C653.9 275.5 648.1 272.3 640.7 272.1C633.3 271.9 630.9 277.3 624.6 276.3C618.3 275.3 615.4 270.5 609.1 267.2C602.9 263.8 599.8 263.5 593.5 259.5C587.2 255.4 586.4 254.2 577.7 247C568.9 239.9 551.7 228.7 549.7 223.6C547.6 218.6 562.8 219.1 567.3 221.7C571.8 224.2 573.3 232.1 572 236.3C570.6 240.5 564.2 243 560.5 242.6C556.9 242.2 554 237.2 553.7 234.3C553.5 231.4 557.1 228.6 559.2 228C561.4 227.4 563.3 230.6 564.3 231.3","sw":1.5,"dur":26.5,"delay":-22.5,"flow":1,"op":0.8}]};
  /*MESSY-END*/
  const messyFigure = MESSY.still.filter(st => st.sw >= 3), messyTangle = MESSY.still.filter(st => st.sw < 3);
  W['messy-thoughts'] = {
    tiles: [],
    sprites: [
      { n: 'figure', plane: 'scene', k: 0.86, x: 50, y: 50, w: 100, vb: [1600, 900], z: 1, still: messyFigure },
      { n: 'tangle', plane: 'scene', k: 0.86, x: 50, y: 50, w: 100, vb: [1600, 900], z: 2, still: messyTangle, draw: MESSY.draw, breathe: 19, origin: '50% 32.4%' }
    ]
  };

  /* ---- Eternal Moon: a monochrome moonlit forest. The moon never moves. Thin cloud wisps cross the sky around it, three layered mist planes slide at
     different speeds behind the far trees, between the tree ranks and on the lake, a few stars twinkle. All moonlight is painted behind the trees:
     nothing glows in front of the forest (the earlier halo ring and bloom did, and read as a second disc — removed).
     Painted at 3840 × 2160 by scripts/wallpapers/eternal-moon.py (original). */
  W['eternal-moon'] = {
    tiles: [
      { plane: 'pfar', image: 't-cloud', mask: 't-mask-sky', region: [0, 0, 1, 0.68], rel: 0.9, w: 2048, h: 1024, sx: -1, sy: 0, t: 130 },   // cloud around the moon
      { plane: 'mist', image: 't-fogA', mask: 't-mask-far', region: [0, 0.48, 1, 0.82], rel: 1.0, w: 2048, h: 512, sx: 1, sy: 0, t: 95 },   // fog behind the far trees
      { plane: 'pmid', image: 't-fogB', mask: 't-mask-mid', region: [0, 0.56, 1, 0.84], rel: 1.1, w: 2048, h: 512, sx: -1, sy: 0, t: 58 }, // fog between the tree ranks (keeps moving in Lite)
      { plane: 'pnear', image: 't-fogC', mask: 't-mask-water', region: [0, 0.68, 1, 1], rel: 1.3, w: 2048, h: 512, sx: 1, sy: 0, t: 46 }     // low fog over the lake
    ],
    sprites: [
      { n: 'glitter', plane: 'scene', k: 0.86, x: 56, y: 87, w: 22, dx: 14, dy: 0, rot: 0, dur: 6, fx: 'pulse', gl: 2.4, z: 2 },
      { n: 'glitterB', src: 'glitter', plane: 'scene', k: 0.86, x: 56, y: 90, w: 30, dx: -18, dy: 0, rot: 0, dur: 8, fx: 'pulse', gl: 3.3, z: 2, flip: 1, op: 0.7 },
      // twinkles sit in open sky only (clear of the moon and of every tree top), because sprites draw in front of the tree layers
      ...[[16, 7, 1.4, 2.2], [24, 14, 1.0, 3.1], [31, 5, 1.6, 1.8], [36, 17, 0.9, 2.7], [78, 6, 1.5, 2.0], [84, 13, 1.1, 3.4], [44, 4, 1.2, 2.5], [20, 3, 0.9, 1.6], [70, 3, 1.0, 2.9]]
        .map(([x, y, w, gl], i) => ({ n: `star${i + 1}`, src: 'sparkle', plane: 'scene', k: 0.46, x, y, w, dx: 0, dy: 0, rot: 0, dur: 8, fx: 'pulse', gl, z: 1 }))
    ]
  };

  /* ---- Synthwave: the grid scans toward the viewer, a car drives into the scene, palms sway in neon haze, the sun pulses. */
  const scan = (delay, i) => at('gridLine', 0.0, -0.06, 75, 0.03, { k: 0.64, z: 2, approach: 7, ax: '0vw', ay: '44vh', a0: 0.9, delay, noShadow: 1 });
  W['synthwave-highway'] = {
    tiles: [
      { plane: 'pfar', shape: 'dot', seed: 5, w: 900, h: 600, n: 30, colors: ['#ffffff', '#ff9be8', '#8ff4ff'], r: [0.8, 1.6], still: true }
    ],
    sprites: [
      at('sunGlow', 0.0, 0.1, 1, 0.7, { k: 0.46, dx: 0, dy: 0, rot: 0, dur: 6, fx: 'pulse', z: 1 }),
      scan(0), scan(-1.4), scan(-2.8), scan(-4.2), scan(-5.6),
      at('car', 0.05, -0.1, 640 / 300, 0.08, { k: 0.64, z: 3, approach: 14, ax: '-2vw', ay: '30vh', a0: 0.9, delay: -3 }),
      base('palmL', -0.78, -0.5, 700 / 1000, 0.62, { k: 1.1, z: 4, wind: 1.3, fl: 5.0 }), base('palmR', 0.8, -0.5, 620 / 940, 0.56, { k: 1.1, z: 4, wind: 1.4, fl: 4.6 }),
      { n: 'palmRp', src: 'palmR', plane: 'pop', at: 'band', x: 0.97, y: 0.5, h: 1.0, k: 2.6, dx: -4, dy: 0, rot: 1.2, dur: 9, noShadow: 1, wind: 1.6, ox: '50%', oy: '100%' },
      { n: 'palmLp', src: 'palmL', plane: 'pop', at: 'band', x: 0.03, y: 0.55, h: 1.0, k: 2.8, dx: 4, dy: 0, rot: -1.2, dur: 11, noShadow: 1, wind: 1.7, ox: '50%', oy: '100%' }
    ]
  };

  /* ---- Sunset Boulevard: golden-hour coast. Palms sway in the sea breeze, clouds and gulls drift, a convertible cruises. */
  W['sunset-coast'] = {
    tiles: [
      { plane: 'pnear', shape: 'dot', seed: 7, w: 1000, h: 700, n: 14, colors: ['#ffe2a8', '#ffd0a0'], r: [3, 6], sx: 1, sy: 0, t: 60, gust: true }
    ],
    sprites: [
      at('cloudA', -0.3, 0.3, 1400 / 420, 0.2, { k: 0.46, cross: 200, dx: 0, dy: 0, rot: 0, delay: -60, z: 1 }), at('cloudB', 0.35, 0.37, 1100 / 360, 0.16, { k: 0.46, crossRev: 260, dx: 0, dy: 0, rot: 0, delay: -120, z: 1 }),
      at('car', 0.0, -0.3, 560 / 240, 0.09, { k: 0.64, z: 3, cross: 38, dx: 0, dy: 0, rot: 0, delay: -12 }),
      at('gull', 0.0, 0.15, 2, 0.04, { k: 0.64, cross: 60, dx: 0, dy: 0, rot: 0, delay: -20, swim: { wob: 24, wp: 1.8, tilt: 7 } }), at('gull', 0.0, 0.2, 2, 0.032, { k: 0.64, cross: 60, dx: 0, dy: 0, rot: 0, delay: -26, swim: { wob: 20, wp: 1.5, tilt: 6 } }), at('gull', 0.0, 0.11, 2, 0.028, { k: 0.64, cross: 60, dx: 0, dy: 0, rot: 0, delay: -32, swim: { wob: 18, wp: 2.1, tilt: 6 } }),
      base('palmL', -0.7, -0.5, 760 / 1100, 0.78, { k: 1.1, z: 4, wind: 1.3, fl: 5.2 }), base('palmR', 0.74, -0.5, 660 / 1000, 0.7, { k: 1.1, z: 4, wind: 1.5, fl: 4.8 }),
      { n: 'palmRp', src: 'palmR', plane: 'pop', at: 'band', x: 0.97, y: 0.5, h: 1.0, k: 2.6, dx: -4, dy: 0, rot: 1.2, dur: 9, noShadow: 1, wind: 1.6, ox: '50%', oy: '100%' },
      { n: 'gullP', src: 'gull', plane: 'pop', at: 'band', x: 0.5, y: 0.35, h: 0.25, k: 2.8, dx: 30, dy: -10, rot: 3, dur: 8, noShadow: 1, swim: { wob: 12, wp: 1.6, tilt: 5 } }
    ]
  };

  /* ---- Dark Academia: a gothic library. Candle flames flicker, the chandelier and curtains sway, dust and loose pages drift. */
  W['dark-library'] = {
    tiles: [
      { plane: 'pmid', shape: 'dot', seed: 12, w: 900, h: 700, n: 40, colors: ['#ffe2a8', '#ffd08a'], r: [0.9, 1.8], sx: 1, sy: -1, t: 80, gust: false },
      { plane: 'pnear', shape: 'page', seed: 3, w: 1200, h: 900, n: 5, colors: ['#f5ead0', '#e8d9b4'], r: [8, 12], sx: -1, sy: 1, t: 36, gust: true }
    ],
    sprites: [
      at('chandelier', 0.0, 0.34, 1, 0.34, { k: 0.64, z: 3, dx: 0, dy: 0, rot: 0, dur: 9, wind: 0.9, ox: '50%', oy: '0%', fl: 5.5 }),
      at('curtain', -0.44, 0.02, 420 / 1200, 0.78, { k: 0.64, z: 2, wind: 1.4, ox: '50%', oy: '0%', fl: 6.5 }), at('curtain', 0.44, 0.02, 420 / 1200, 0.78, { k: 0.64, z: 2, flip: 1, wind: 1.4, ox: '50%', oy: '0%', fl: 7.2 }),
      at('flame', -0.62, 0.0, 0.5, 0.05, { k: 0.86, dx: 0, dy: 0, rot: 0, dur: 3, fx: 'flicker' }), at('flame', 0.56, -0.03, 0.5, 0.05, { k: 0.86, dx: 0, dy: 0, rot: 0, dur: 3.4, fx: 'flicker', delay: -1 }),
      { n: 'pg1', src: 'page', plane: 'scene', k: 1.5, x: 30, y: 0, w: 2.6, fall: 26, dx: 300, rot: 200, sw: 70, sway: 4.0, flut: 2.0, fa: 46, turn: 2.6, sy: 45, gust: 140 },
      { n: 'pg2', src: 'page', plane: 'scene', k: 2.0, x: 72, y: 0, w: 3.2, fall: 20, dx: -260, rot: -190, sw: 90, sway: 3.6, flut: 1.8, fa: 50, turn: 2.2, sy: 70, gust: 200 },
      { n: 'candle', plane: 'pop', at: 'band', x: 0.97, y: 0.5, h: 0.9, k: 2.6, dx: -3, dy: 0, rot: 1, dur: 8, noShadow: 1, fx: 'flicker' },
      { n: 'bookStack', plane: 'pop', at: 'band', x: 0.03, y: 0.55, h: 0.7, k: 2.8, dx: 4, dy: 0, rot: -1, dur: 12, noShadow: 1 }
    ]
  };

  /* ---- Pixel Paradise: a sunny pixel-art lagoon. Palms on the islet rock in the breeze, pixel clouds and gulls drift, gems float up, a crab patrols the beach. */
  W['pixel-paradise-3d'] = {
    tiles: [
      { plane: 'pmid', shape: 'cube', seed: 9, w: 900, h: 700, n: 16, colors: ['#ffd23f', '#ff8a3d', '#fff08a'], r: [3, 6], sx: 0, sy: -1, t: 20, gust: true }
    ],
    sprites: [
      at('cloudA', -0.4, 0.3, 640 / 240, 0.2, { k: 0.46, cross: 160, dx: 0, dy: 0, rot: 0, delay: -40, z: 1 }), at('cloudB', 0.5, 0.36, 520 / 200, 0.17, { k: 0.46, crossRev: 210, dx: 0, dy: 0, rot: 0, delay: -90, z: 1 }),
      base('palmA', 0.47, -0.02, 480 / 640, 0.24, { k: 0.64, z: 2, wind: 2.4, fl: 4.4 }), base('palmB', 0.55, -0.015, 420 / 600, 0.19, { k: 0.64, z: 2, wind: 2.6, fl: 4.0 }),
      at('gull', 0.0, 0.2, 160 / 96, 0.07, { k: 0.64, cross: 48, dx: 0, dy: 0, rot: 0, delay: -14, swim: { wob: 14, wp: 1.4, tilt: 3 } }),
      at('crab', -0.5, -0.43, 200 / 120, 0.09, { k: 1.1, z: 4, dx: 60, dy: 0, rot: 0, dur: 9 }),
      { n: 'cube', plane: 'pop', at: 'band', x: 0.96, y: 0.5, h: 0.5, k: 2.6, dx: -6, dy: -14, rot: 14, dur: 6, noShadow: 1, fx: 'spin' },
      { n: 'palmAp', src: 'palmA', plane: 'pop', at: 'band', x: 0.03, y: 0.55, h: 1.0, k: 2.8, dx: 5, dy: 0, rot: -1, dur: 11, noShadow: 1, wind: 2.4, ox: '50%', oy: '100%' }
    ]
  };
  globalThis.RepoVibeWorlds = W;
})();
