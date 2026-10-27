'use strict';
// ============================================================
//  Sprites em pixel art (definidos como texto) + utilitários
// ============================================================

const Sprites = {
  cache: new Map(),
  flashCache: new WeakMap(),

  fromRows(rows, pal) {
    const w = Math.max(...rows.map(r => r.length)), h = rows.length;
    const c = makeCanvas(w, h), x = c.getContext('2d');
    for (let j = 0; j < h; j++) {
      const r = rows[j];
      for (let i = 0; i < r.length; i++) {
        const col = pal[r[i]];
        if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
      }
    }
    return c;
  },
  get(key, build) {
    let c = this.cache.get(key);
    if (!c) { c = build(); this.cache.set(key, c); }
    return c;
  },
  flash(img) {
    let f = this.flashCache.get(img);
    if (!f) {
      f = makeCanvas(img.width, img.height);
      const x = f.getContext('2d');
      x.drawImage(img, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, f.width, f.height);
      this.flashCache.set(img, f);
    }
    return f;
  },
};

function drawSprite(ctx, img, x, y, flip = false, flash = false) {
  const src = flash ? Sprites.flash(img) : img;
  x = Math.round(x); y = Math.round(y);
  if (flip) {
    ctx.save(); ctx.translate(x + img.width, y); ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0); ctx.restore();
  } else ctx.drawImage(src, x, y);
}

// ---------------- Glow (luz aditiva) ----------------
const Glow = {
  cache: new Map(),
  get(color, r) {
    r = Math.max(2, Math.round(r));
    const key = color + r;
    let c = this.cache.get(key);
    if (!c) {
      c = makeCanvas(r * 2, r * 2);
      const x = c.getContext('2d');
      const g = x.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0, rgba(color, 0.9));
      g.addColorStop(0.25, rgba(color, 0.45));
      g.addColorStop(1, rgba(color, 0));
      x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2);
      this.cache.set(key, c);
    }
    return c;
  },
  draw(ctx, x, y, r, color, a = 1) {
    if (a <= 0.01) return;
    const c = this.get(color, r);
    const prevA = ctx.globalAlpha, prevC = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = prevA * Math.min(1, a);
    ctx.drawImage(c, x - c.width / 2, y - c.height / 2);
    ctx.globalAlpha = prevA; ctx.globalCompositeOperation = prevC;
  },
};

// ---------------- Jogador ----------------
const PLAYER_PAL = {
  o: '#14101e', w: '#e4e8f0', g: '#9aa6bf', d: '#4b5674', v: '#2f8fd8', V: '#a8f0ff', a: '#f08a3c', k: '#2a2f45',
};
const PLAYER_BODY = [
  '....oooo....',
  '...owwwwo...',
  '..owwwvvvo..',
  '..owwvVVvo..',
  '..owwwvvvo..',
  '...owwwwo...',
  '.ooogaagooo.',
  'oddowwwwwwo.',
  'oddowwwgwwo.',
  'oddowwwgwwo.',
  '.ooowaaawo..',
];
const PLAYER_LEGS = {
  idle: ['...owwowwo..', '...owwowwo..', '...ogwogwo..', '...oaaoaao..', '...ooo.ooo..'],
  run1: ['..owwo.owwo.', '.owwo...owo.', '.ogwo...ogwo', 'oaao....oaao', 'ooo......ooo'],
  run2: ['...owwwwo...', '...owwwo....', '....ogwo....', '....oaao....', '....oooo....'],
  jump: ['...owwowwo..', '..owwo.owwo.', '..oaao..ogwo', '..ooo...oaao', '........ooo.'],
};
function playerSprite(frame) {
  return Sprites.get('player_' + frame, () => Sprites.fromRows(PLAYER_BODY.concat(PLAYER_LEGS[frame]), PLAYER_PAL));
}

// ---------------- Inimigos ----------------
const ENEMY_PALETTES = {
  rock: { o: '#1a0f0f', a: '#9a6240', b: '#5a3424', c: '#d79a62', e: '#ffe14d' },
  jungle: { o: '#0c1a0c', a: '#4f9a3a', b: '#2a5a26', c: '#a6e05e', e: '#ff4d6d' },
  ice: { o: '#0c1424', a: '#7ec8e3', b: '#3d6f9e', c: '#effcff', e: '#3dffd8' },
  lava: { o: '#1a0606', a: '#d2452c', b: '#7a1e1e', c: '#ffb347', e: '#fff27a' },
  anomaly: { o: '#120a24', a: '#8a5ad6', b: '#4a2a7e', c: '#d9b8ff', e: '#7affea' },
  void: { o: '#05020a', a: '#40235e', b: '#1d0f30', c: '#c25cff', e: '#ff3df0' },
  core: { o: '#12040c', a: '#a32d5a', b: '#561230', c: '#ff8ab0', e: '#fff3a0' },
};
const ENEMY_ROWS = {
  crawler1: [
    '................',
    '.....oooooo.....',
    '...ooaacaaaoo...',
    '..oaaacaaaaaaoo.',
    '.oaacaaaaaaaaeeo',
    '.oaaaaaaabaaaeeo',
    '..obbbbbbbbbbbo.',
    '...o.o..o.o..o..',
    '..o..o.o..o.o...',
  ],
  crawler2: [
    '................',
    '.....oooooo.....',
    '...ooaacaaaoo...',
    '..oaaacaaaaaaoo.',
    '.oaacaaaaaaaaeeo',
    '.oaaaaaaabaaaeeo',
    '..obbbbbbbbbbbo.',
    '...o..o.o..o.o..',
    '....o.o..o.o..o.',
  ],
  brute1: [
    '..........oooo........',
    '........ooaaaaoo..o...',
    '.......oaaacaaaaooco..',
    '......oaaccaaaaaaoco..',
    '.....oaacaaaaaaaaaoo..',
    '....oaaaaaaaaaaaeeao..',
    '...oaaaaaaaaaaaaeeaao.',
    '..oaabaaaaaaaaaaaaaao.',
    '..oabbaaaaaaaaaaacaao.',
    '.oabbbaaaaaaaaaacccao.',
    '.oabbaaaaaaaaaaaacco..',
    '.oabaaaabbbbaaaaaoo...',
    '..obaaabooobbaaabo....',
    '..obbbbo...obbbbbo....',
    '...obbo.....obbbo.....',
    '...oooo.....oooo......',
  ],
  brute2: [
    '..........oooo........',
    '........ooaaaaoo..o...',
    '.......oaaacaaaaooco..',
    '......oaaccaaaaaaoco..',
    '.....oaacaaaaaaaaaoo..',
    '....oaaaaaaaaaaaeeao..',
    '...oaaaaaaaaaaaaeeaao.',
    '..oaabaaaaaaaaaaaaaao.',
    '..oabbaaaaaaaaaaacaao.',
    '.oabbbaaaaaaaaaacccao.',
    '.oabbaaaaaaaaaaaacco..',
    '.oabaaaabbbbaaaaaoo...',
    '..obaaabooobbaaabo....',
    '...obbbbo.obbbbo......',
    '....obbo...obbo.......',
    '....oooo...oooo.......',
  ],
  spitter1: [
    '......oooo......',
    '....ooccaaoo....',
    '...ocaaaaaaaoo..',
    '..ocaaaaaaaaeeo.',
    '..oaaaaaaaaaeeo.',
    '..oaaabbaaaaaaoo',
    '..oaabbbbaaaacco',
    '...oabbbbaaaaoo.',
    '....oaaaaaaaao..',
    '...obbbbbbbbbo..',
    '..o.o..o..o..o..',
    '.o..o..o..o...o.',
  ],
  spitter2: [
    '......oooo......',
    '....ooccaaoo....',
    '...ocaaaaaaaoo..',
    '..ocaaaaaaaaeeo.',
    '..oaaaaaaaaaeeo.',
    '..oaaabbaaaaaaoo',
    '..oaabbbbaaaacco',
    '...oabbbbaaaaoo.',
    '....oaaaaaaaao..',
    '...obbbbbbbbbo..',
    '...o.o..o..o.o..',
    '...o..o.o.o..o..',
  ],
  wasp: [
    '.....ooooo....',
    '...ooaacaaoo..',
    '..obaabaaaeeo.',
    '.obbaabaaaeeo.',
    '..obbaabaaoo..',
    '...oobbaoo....',
    '.....oo.......',
    '....o.........',
  ],
  bomber: [
    '........oooooooo........',
    '......ooccaaaaaaoo......',
    '.....occaaaaaaaaaao.....',
    '....ocaaaaaaaaaaaaao....',
    '...ocaaaaabbaaaaaaaao...',
    '...oaaaaabbbbaaaaaaao...',
    '...oaaaaabbbbaaaaaaao...',
    '...oaaaaaabbaaaaaaaao...',
    '....oaaaaaaaaaaaaaao....',
    '.....ooaaeaaeaaeaoo.....',
    '.......oooooooooo.......',
  ],
};
function enemySprite(name, pal) {
  return Sprites.get('en_' + name + '_' + pal, () => Sprites.fromRows(ENEMY_ROWS[name], ENEMY_PALETTES[pal]));
}

// ---------------- Ícones de recurso ----------------
const RES_SHAPES = {
  sucata: ['..ooo..', '.oaaao.', 'oabbbao', 'oab.bao', 'oabbbao', '.oaaao.', '..ooo..'],
  ferro: ['.......', '.ooooo.', 'oacccao', 'oaaaaao', 'obbbbbo', '.ooooo.', '.......'],
  bio: ['...o...', '..oco..', '.ocaao.', 'ocaaaao', 'oaaaabo', '.oabbo.', '..ooo..'],
  crio: ['...o...', '..oco..', '.ocaao.', 'ocaaabo', '.oaabo.', '..obo..', '...o...'],
  piro: ['..o.o..', '.oco.o.', '.ocaoao', 'ocaaaao', 'oaaaabo', '.oabbo.', '..ooo..'],
  grav: ['..ooo..', '.ocaao.', 'ocaaaao', 'oaabaao', 'oaaaabo', '.oabbo.', '..ooo..'],
  vazio: ['...o...', '..oao..', '.oacao.', 'oacbcao', '.oacao.', '..oao..', '...o...'],
};
function resIcon(res) {
  return Sprites.get('res_' + res, () => {
    const c = RES[res].color;
    return Sprites.fromRows(RES_SHAPES[res], { o: shade(c, -0.7), a: c, b: shade(c, -0.35), c: shade(c, 0.6) });
  });
}
const _iconUrls = {};
function resIconUrl(res) {
  if (_iconUrls[res]) return _iconUrls[res];
  const s = resIcon(res), c = makeCanvas(s.width * 4, s.height * 4), x = c.getContext('2d');
  x.imageSmoothingEnabled = false; x.drawImage(s, 0, 0, c.width, c.height);
  return (_iconUrls[res] = c.toDataURL());
}
function canvasUrl(src, scale = 4) {
  const c = makeCanvas(src.width * scale, src.height * scale), x = c.getContext('2d');
  x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL();
}

// ---------------- Ruído de valor ----------------
function makeNoise2D(seed) {
  const rng = seededRng(seed);
  const N = 256, perm = new Uint8Array(N * 2), vals = new Float32Array(N);
  for (let i = 0; i < N; i++) { perm[i] = i; vals[i] = rng(); }
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < N; i++) perm[N + i] = perm[i];
  const v = (x, y) => vals[perm[(perm[x & 255] + y) & 511]];
  const sm = t => t * t * (3 - 2 * t);
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
    const u = sm(xf), w = sm(yf);
    return lerp(lerp(a, b, u), lerp(c, d, u), w);
  };
  return (x, y, oct = 4) => {
    let s = 0, amp = 1, f = 1, tot = 0;
    for (let i = 0; i < oct; i++) { s += n(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2; }
    return s / tot;
  };
}

// ---------------- Planetas (esferas em pixel art) ----------------
const PLANET_COLORS = {
  rock: ['#3b2a22', '#6e4a34', '#a56e46', '#d8a070'],
  jungle: ['#123a22', '#246b35', '#4fa04a', '#a6d86a'],
  ice: ['#2b4f7a', '#5b93c4', '#a8d8f0', '#f2fbff'],
  lava: ['#2a0a08', '#6e1a12', '#d2452c', '#ffcf5a'],
  anomaly: ['#1e1240', '#48308a', '#8a5ad6', '#d9b8ff'],
  void: ['#07030f', '#22103a', '#5a2a8a', '#ff3df0'],
  core: ['#2a0718', '#7a1f45', '#e04a7a', '#fff0a0'],
  home: ['#0e2a4a', '#1f5a8a', '#3fa06a', '#e8f0ff'],
};
function renderPlanet(r, biome, seed, rot = 0, lightDir = [-0.6, -0.5]) {
  const size = r * 2 + 1;
  const c = makeCanvas(size, size), x = c.getContext('2d');
  const img = x.createImageData(size, size);
  const noise = makeNoise2D(seed);
  const cols = (PLANET_COLORS[biome] || PLANET_COLORS.rock).map(hexToRgb);
  const L = Math.hypot(lightDir[0], lightDir[1], 0.6);
  const lx = lightDir[0] / L, ly = lightDir[1] / L, lz = 0.6 / L;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const dx = (i - r) / r, dy = (j - r) / r;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      const dz = Math.sqrt(1 - d2);
      const a = (Math.atan2(dx, dz) / Math.PI + rot) * Math.PI, v = Math.asin(dy) / Math.PI;
      const ca = Math.cos(a) * 1.6, sa = Math.sin(a) * 1.6;
      let n = noise(ca + v * 5 + 10, sa + v * 3 + 10, 4);
      if (biome === 'jungle' || biome === 'home') n = n * 0.8 + (noise(ca * 3 + v * 9, sa * 3, 2) * 0.2);
      if (biome === 'ice') n = Math.abs(v) > 0.33 ? 0.95 : n;
      let lum = dx * lx + dy * ly + dz * lz;
      lum = clamp(lum * 0.9 + 0.25, 0, 1);
      let idx = n < 0.42 ? 0 : n < 0.52 ? 1 : n < 0.62 ? 2 : 3;
      let shadeIdx = idx - (lum < 0.25 ? 2 : lum < 0.5 ? 1 : 0) + (lum > 0.92 ? 1 : 0);
      shadeIdx = clamp(shadeIdx, 0, 3);
      // dithering na borda da sombra
      if (lum > 0.24 && lum < 0.3 && (i + j) % 2 === 0) shadeIdx = Math.max(0, shadeIdx - 1);
      let col = cols[shadeIdx];
      if (lum < 0.12) col = col.map(v2 => v2 * 0.45);
      const p = (j * size + i) * 4;
      img.data[p] = col[0]; img.data[p + 1] = col[1]; img.data[p + 2] = col[2]; img.data[p + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}
const planetFrames = new Map();
function planetFrame(r, biome, seed, t, frames = 32) {
  const key = r + biome + seed;
  let arr = planetFrames.get(key);
  if (!arr) { arr = new Array(frames); planetFrames.set(key, arr); }
  const f = Math.floor(((t % 1) + 1) % 1 * frames);
  if (!arr[f]) arr[f] = renderPlanet(r, biome, seed, f / frames * 2);
  return arr[f];
}
