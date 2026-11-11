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
  const REF_SAKURA = [{"n":"treeNearL","plane":"scene","x":15.84,"y":32.05,"w":31.68,"k":1.28,"z":3,"wind":0.45,"ox":"50%","oy":"100%","fl":7.0},{"n":"treeNearR","plane":"scene","x":76.6,"y":36.63,"w":46.8,"k":1.28,"z":3,"wind":0.4,"ox":"50%","oy":"100%","fl":7.6},{"n":"treeMidL","plane":"scene","x":32.29,"y":33.78,"w":26.52,"k":0.86,"z":2,"wind":0.9,"ox":"50%","oy":"100%","fl":5.4},{"n":"treeMidR","plane":"scene","x":69.34,"y":39.48,"w":21.41,"k":0.86,"z":2,"wind":1.0,"ox":"50%","oy":"100%","fl":5.0}];
  /*REF-SAKURA-END*/
  const treeSpan = 0.625;
  W['sakura-garden'] = {
    // Built from the owner's reference plate (assets/reference/cherrybg.jpg): the plate is the mid layer (sky cut out), tree groups are cut-out sprites that
    // sway on the shared gust, the sky window shows drifting cloud tiles, petals fall in 3D-rendered sprites and tile planes. Hybrid 2.5D, not 3D geometry.
    tiles: [
      { plane: 'pfar', image: 't-clouds', rel: 0.8, w: 2048, h: 1024, sx: -1, sy: 0, t: 420 },
      { plane: 'pmid', shape: 'petal', seed: 5, w: 900, h: 640, n: 22, colors: ['#ff8fc0', '#ffc2dc', '#e65ca0'], r: [4, 8], sx: -1, sy: 1, t: 34, gust: true },
      { plane: 'pnear', shape: 'petal', seed: 11, w: 1100, h: 760, n: 10, colors: ['#ffb0d0', '#ff7fb2', '#fff0f6'], r: [10, 17], sx: -1, sy: 1, t: 21, gust: true }
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

  /* ---- Ocean Depths: a reef under a sunlit surface. One slow current sways kelp and fans; schools, turtle, manta and whale cross. */
  /*REF-OCEAN-BEGIN*/
  const REF_OCEAN = [{"n":"coralPurpleL","plane":"scene","x":7.64,"y":24.9,"w":15.27,"k":1.28,"z":3,"wind":0.7,"ox":"50%","oy":"100%","fl":7.4},{"n":"coralOrangeA","plane":"scene","x":24.0,"y":43.58,"w":12.23,"k":0.86,"z":2,"wind":1.7,"ox":"50%","oy":"100%","fl":5.2},{"n":"coralOrangeB","plane":"scene","x":29.53,"y":45.31,"w":11.02,"k":0.86,"z":2,"wind":1.9,"ox":"50%","oy":"100%","fl":4.8},{"n":"coralPurpleS","plane":"scene","x":15.68,"y":49.13,"w":9.34,"k":0.86,"z":2,"wind":1.5,"ox":"50%","oy":"100%","fl":5.6},{"n":"coralOrangeBig","plane":"scene","x":21.27,"y":67.92,"w":29.41,"k":1.28,"z":3,"wind":1.1,"ox":"50%","oy":"100%","fl":6.4},{"n":"coralPurpleMid","plane":"scene","x":36.56,"y":57.6,"w":14.92,"k":0.86,"z":2,"wind":1.3,"ox":"50%","oy":"100%","fl":5.9},{"n":"coralOrangeC","plane":"scene","x":47.64,"y":70.0,"w":11.84,"k":0.86,"z":2,"wind":2.0,"ox":"50%","oy":"100%","fl":4.4},{"n":"coralOrangeD","plane":"scene","x":52.32,"y":70.56,"w":8.16,"k":0.86,"z":2,"wind":2.2,"ox":"50%","oy":"100%","fl":4.2},{"n":"coralPurpleLow","plane":"scene","x":30.06,"y":88.16,"w":10.27,"k":1.28,"z":3,"wind":1.2,"ox":"50%","oy":"100%","fl":6.0},{"n":"coralPurpleBR","plane":"scene","x":90.08,"y":90.21,"w":19.84,"k":1.28,"z":3,"wind":0.9,"ox":"50%","oy":"100%","fl":7.8}];
  /*REF-OCEAN-END*/
  const kelp = (n, x, base, span, ratio, wind, fl) => ({ n, plane: 'scene', k: 0.64, x: X(x), y: Y(base + span / 2), w: stageW(ratio, span), z: 2, wind, ox: '50%', oy: '100%', fl });
  const school = (n, y, dx, dur, delay, scale, rev) => ({ n, plane: 'scene', k: 0.46, x: 50, y, w: scale, [rev ? 'crossRev' : 'cross']: dur, dx: 0, dy: 0, rot: 0, delay, swim: { wob: 8, wp: 1.1, tilt: 3 } });
  W['ocean-kingdom'] = {
    // Built from the owner's reference plate (assets/reference/oceanbg.jpg): the plate is the far layer (corals inpainted at their edges), coral groups are cut-out
    // sprites that sway on the shared current, two counter-moving caustic planes are masked onto the sunlit sand, light shafts breathe, and the sea life
    // (fish, turtles, jellyfish, manta, whale) are real raymarched 3D models. Hybrid 2.5D, not 3D geometry.
    tiles: [
      { plane: 'pfar', image: 't-caustic', mask: 't-mask-sand', rel: 0.42, w: 1024, h: 1024, sx: 1, sy: 0.6, t: 52 },
      { plane: 'mist', image: 't-caustic', mask: 't-mask-sand', rel: 0.29, w: 1024, h: 1024, sx: -1, sy: -0.4, t: 41 },
      { plane: 'pmid', shape: 'dot', seed: 3, w: 900, h: 700, n: 60, colors: ['#e8fdff', '#bff3ff'], r: [1.2, 2.6], sx: 0, sy: 1, t: 95, gust: false },
      { plane: 'pnear', shape: 'bubble', seed: 15, w: 1200, h: 900, n: 7, colors: ['#e8fbff'], r: [9, 16], sx: 0, sy: -1, t: 22, gust: true }
    ],
    sprites: [
      ...REF_OCEAN,
      { n: 'whale', plane: 'scene', k: 0.46, x: 50, y: 17, w: stageW(1500 / 560, 0.2), crossRev: 170, dx: 0, dy: 0, rot: 0, delay: -40, swim: { wob: 6, wp: 6, tilt: 1.2 } },
      { n: 'manta', plane: 'scene', k: 0.64, x: 50, y: 27, w: stageW(1200 / 700, 0.3), cross: 95, dx: 0, dy: 0, rot: 0, delay: -22, swim: { wob: 16, wp: 3.6, tilt: 3 } },
      { n: 'turtle', plane: 'scene', k: 0.86, x: 50, y: 52, w: stageW(760 / 520, 0.26), cross: 120, dx: 0, dy: 0, rot: 0, delay: -70, swim: { wob: 10, wp: 2.8, tilt: 3.5 } },
      school('fishA', 40, 0, 36, -2, 3.2), school('fishA', 43, 0, 36, -5, 2.6), school('fishA', 38, 0, 36, -8, 2.9), school('fishA', 45, 0, 36, -11, 2.2), school('fishA', 41, 0, 36, -14, 2.7),
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
      { n: 'turtleP', src: 'turtle', plane: 'pop', at: 'band', x: 0.04, y: 0.55, h: 0.7, k: 2.8, dx: 14, dy: -4, rot: -2, dur: 12, noShadow: 1, flip: 1, swim: { wob: 10, wp: 3, tilt: 4 } },
      { n: 'coralBRp', src: 'coralPurpleMid', plane: 'pop', at: 'margin', side: 'right', y: 0.82, h: 0.24, k: 2.4, dx: -4, dy: 0, rot: 1, dur: 9, noShadow: 1, wind: 1.6, ox: '50%', oy: '100%' },
      { n: 'coralLp', src: 'coralOrangeBig', plane: 'pop', at: 'margin', side: 'left', y: 0.6, h: 0.3, k: 2.5, dx: 4, dy: 0, rot: -1, dur: 10, noShadow: 1, wind: 1.4, ox: '50%', oy: '100%' },
      { n: 'fishPop', src: 'fishA', plane: 'pop', at: 'band', x: 0.6, y: 0.4, h: 0.22, k: 2.9, dx: 60, dy: -10, rot: 2, dur: 12, noShadow: 1, swim: { wob: 8, wp: 1.1, tilt: 3 } }
    ]
  };

  // helpers shared by the remaining worlds. base(): sprite whose base sits at (bx, by) in scene units; at(): centred at (cx, cy)
  const BASE = 0.48; // the shaders draw bottom-anchored sprites with the base at local y = -0.48
  const base = (n, bx, by, ratio, span, o) => Object.assign({ n, plane: 'scene', x: X(bx), y: Y(by + BASE * span), w: stageW(ratio, span), ox: '50%', oy: '100%' }, o);
  const at = (n, cx, cy, ratio, span, o) => Object.assign({ n, plane: 'scene', x: X(cx), y: Y(cy), w: stageW(ratio, span) }, o);

  /* ---- Arctic Frost (light theme): a bright frozen valley. Blizzard flakes ride the shared gust; pines sway; the fox crosses. */
  W['arctic-frost-3d'] = {
    tiles: [
      { plane: 'pfar', shape: 'flake', seed: 4, w: 800, h: 600, n: 40, colors: ['#ffffff', '#e4f3ff'], r: [3, 5.5], sx: -1, sy: 1, t: 46, gust: true },
      { plane: 'pmid', shape: 'flake', seed: 9, w: 900, h: 700, n: 24, colors: ['#ffffff', '#d6ecff'], r: [5, 8.5], sx: -1, sy: 1, t: 30, gust: true },
      { plane: 'pnear', shape: 'flake', seed: 17, w: 1100, h: 800, n: 9, colors: ['#ffffff'], r: [10, 15], sx: -1, sy: 1, t: 19, gust: true }
    ],
    sprites: [
      base('pineA', -0.46, -0.09, 640 / 900, 0.34, { k: 0.64, z: 2, wind: 1.4, fl: 5.2 }), base('pineC', 0.58, -0.1, 560 / 800, 0.3, { k: 0.64, z: 2, wind: 1.6, fl: 4.8 }),
      base('pineB', -0.2, -0.14, 520 / 760, 0.27, { k: 0.86, z: 2, wind: 1.3, fl: 5.6 }),
      at('fox', 0, -0.33, 520 / 300, 0.14, { k: 0.86, cross: 70, dx: 0, dy: 0, rot: 0, delay: -18, swim: { wob: 6, wp: 0.7, tilt: 2 } }),
      at('crystal', 0.2, -0.3, 600 / 760, 0.3, { k: 0.86, z: 2, dx: 0, dy: 0, rot: 0, dur: 30, fx: 'pulse' }),
      at('shard', -0.3, -0.36, 1, 0.05, { k: 1.1, dx: 5, dy: -6, rot: 12, dur: 7, fx: 'pulse' }),
      // two wind-blown flake sprites in the foreground
      { n: 'f1', src: 'flake', plane: 'scene', k: 1.8, x: 20, y: 0, w: 2.3, fall: 18, dx: 340, rot: 160, sw: 60, sway: 3.6, flut: 2.0, fa: 40, turn: 2.6, sy: 40, gust: 220 },
      { n: 'f2', src: 'flake', plane: 'scene', k: 2.1, x: 66, y: 0, w: 3.0, fall: 15, dx: 380, rot: -140, sw: 80, sway: 3.2, flut: 1.8, fa: 44, turn: 2.3, sy: 62, gust: 260 },
      { n: 'crystalP', src: 'crystal', plane: 'pop', at: 'band', x: 0.97, y: 0.5, h: 0.9, k: 2.6, dx: -6, dy: -4, rot: 1.5, dur: 9, noShadow: 1, fx: 'pulse' },
      { n: 'pineAp', src: 'pineA', plane: 'pop', at: 'band', x: 0.03, y: 0.55, h: 1.0, k: 2.8, dx: 8, dy: 0, rot: -1.5, dur: 10, noShadow: 1, wind: 1.6, ox: '50%', oy: '100%' }
    ]
  };

  /* ---- Aurora: three aurora curtains drift, breathe and change hue independently; pines sway on a still night; a meteor streaks. */
  W['aurora-borealis'] = {
    tiles: [
      { plane: 'pfar', shape: 'dot', seed: 2, w: 900, h: 600, n: 46, colors: ['#ffffff', '#cfe8ff', '#fff6d6'], r: [0.9, 1.7], still: true },
      { plane: 'pmid', shape: 'dot', seed: 6, w: 1000, h: 700, n: 20, colors: ['#bff7e6', '#ffffff'], r: [1.4, 2.4], still: true }
    ],
    sprites: [
      at('curtainA', 0.0, 0.24, 2200 / 900, 0.62, { k: 0.46, dx: 40, dy: -8, rot: 0.8, dur: 34, fx: 'pulse', gl: 9, z: 1 }),
      at('curtainB', -0.3, 0.2, 2000 / 800, 0.5, { k: 0.46, dx: -50, dy: 10, rot: -0.6, dur: 41, fx: 'pulse', gl: 12, delay: -14, z: 1 }),
      at('curtainC', 0.35, 0.28, 1800 / 700, 0.46, { k: 0.46, dx: 36, dy: -12, rot: 0.5, dur: 47, fx: 'pulse', gl: 15, delay: -29, z: 1 }),
      base('pineL', -0.66, -0.1, 900 / 1300, 0.62, { k: 0.86, z: 3, wind: 1.1, fl: 6.2 }), base('pineR', 0.7, -0.1, 760 / 1200, 0.56, { k: 0.86, z: 3, wind: 1.2, fl: 5.8 }),
      at('cabin', 0.5, -0.082, 420 / 300, 0.05, { k: 0.5, dx: 0, dy: 0, rot: 0, dur: 5, fx: 'flicker' }),
      at('meteor', 0.2, 0.3, 8, 0.05, { k: 0.46, cross: 22, dx: 0, dy: 0, rot: 0, delay: -9 }),
      { n: 'bough', plane: 'pop', at: 'band', x: 0.97, y: 0.5, h: 0.9, k: 2.6, dx: -8, dy: 3, rot: 1.5, dur: 10, noShadow: 1, wind: 1.4, ox: '100%', oy: '50%' },
      { n: 'boughB', src: 'bough', plane: 'pop', at: 'band', x: 0.03, y: 0.45, h: 0.8, k: 2.8, dx: 8, dy: -3, rot: -1.5, dur: 12, noShadow: 1, flip: 1, wind: 1.6, ox: '0%', oy: '50%' }
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

  /* ---- Pixel Paradise: a voxel island. Chunky palms rock, clouds and gulls drift, cubes float up, a crab patrols the sand. */
  W['pixel-paradise-3d'] = {
    tiles: [
      { plane: 'pmid', shape: 'cube', seed: 9, w: 900, h: 700, n: 16, colors: ['#ffd23f', '#ff8a3d', '#fff08a'], r: [3, 6], sx: 0, sy: -1, t: 52, gust: true }
    ],
    sprites: [
      at('cloudA', -0.4, 0.3, 640 / 240, 0.2, { k: 0.46, cross: 160, dx: 0, dy: 0, rot: 0, delay: -40, z: 1 }), at('cloudB', 0.5, 0.36, 520 / 200, 0.17, { k: 0.46, crossRev: 210, dx: 0, dy: 0, rot: 0, delay: -90, z: 1 }),
      base('palmA', -0.12, 0.14, 480 / 640, 0.44, { k: 0.64, z: 2, wind: 2.4, fl: 4.4 }), base('palmB', 0.18, 0.13, 420 / 600, 0.4, { k: 0.64, z: 2, wind: 2.6, fl: 4.0 }),
      at('gull', 0.0, 0.2, 160 / 96, 0.07, { k: 0.64, cross: 48, dx: 0, dy: 0, rot: 0, delay: -14, swim: { wob: 14, wp: 1.4, tilt: 3 } }),
      at('crab', -0.5, -0.43, 200 / 120, 0.09, { k: 1.1, z: 4, dx: 60, dy: 0, rot: 0, dur: 9 }),
      { n: 'cube', plane: 'pop', at: 'band', x: 0.96, y: 0.5, h: 0.5, k: 2.6, dx: -6, dy: -14, rot: 14, dur: 6, noShadow: 1, fx: 'spin' },
      { n: 'palmAp', src: 'palmA', plane: 'pop', at: 'band', x: 0.03, y: 0.55, h: 1.0, k: 2.8, dx: 5, dy: 0, rot: -1, dur: 11, noShadow: 1, wind: 2.4, ox: '50%', oy: '100%' }
    ]
  };
  globalThis.RepoVibeWorlds = W;
})();
