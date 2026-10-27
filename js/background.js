'use strict';
// ============================================================
//  Cenário procedural: céu, montanhas em parallax, terreno, clima
// ============================================================

class Background {
  constructor(biomeId, levelW, seed) {
    this.b = BIOMES[biomeId]; this.biome = biomeId;
    this.levelW = levelW; this.seed = seed;
    this.noise = makeNoise2D(seed);
    this.rng = seededRng(seed);
    this.factors = [0.12, 0.28, 0.5];
    this.buildSky();
    this.buildMountains();
    this.buildTerrain();
    this.weather = [];
    for (let i = 0; i < 90; i++) this.weather.push(this.newWeather(true));
  }

  buildSky() {
    const b = this.b, c = makeCanvas(W, H), x = c.getContext('2d');
    // gradiente em faixas (pixelado)
    const bands = 24;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const col = t < 0.6 ? mixHex(b.sky[0], b.sky[1], t / 0.6) : mixHex(b.sky[1], b.sky[2], (t - 0.6) / 0.4);
      x.fillStyle = col;
      x.fillRect(0, Math.floor(i * H * 0.85 / bands), W, Math.ceil(H * 0.85 / bands) + 1);
    }
    x.fillStyle = b.sky[2]; x.fillRect(0, Math.floor(H * 0.85), W, H);
    // dithering entre faixas
    for (let i = 1; i < bands; i++) {
      const y = Math.floor(i * H * 0.85 / bands);
      const t = i / (bands - 1);
      x.fillStyle = t < 0.6 ? mixHex(b.sky[0], b.sky[1], (i - 1) / (bands - 1) / 0.6) : mixHex(b.sky[1], b.sky[2], ((i - 1) / (bands - 1) - 0.6) / 0.4);
      for (let px = (i % 2); px < W; px += 2) x.fillRect(px, y, 1, 1);
    }
    // estrelas
    const r = this.rng;
    const starCount = this.biome === 'ice' ? 60 : 180;
    for (let i = 0; i < starCount; i++) {
      const sx = Math.floor(r() * W), sy = Math.floor(Math.pow(r(), 1.6) * H * 0.6);
      const br = r();
      x.fillStyle = br > 0.95 ? '#ffffff' : br > 0.7 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)';
      x.fillRect(sx, sy, 1, 1);
      if (br > 0.985) { x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(sx - 1, sy, 3, 1); x.fillRect(sx, sy - 1, 1, 3); }
    }
    // nebulosa suave
    x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const g = x.createRadialGradient(r() * W, r() * H * 0.5, 0, r() * W, r() * H * 0.5, 60 + r() * 80);
      g.addColorStop(0, rgba(b.fog, 0.10)); g.addColorStop(1, rgba(b.fog, 0));
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    }
    x.globalCompositeOperation = 'source-over';
    this.sky = c;
  }

  buildMountains() {
    const b = this.b;
    this.layers = [];
    const bases = [[118, 60], [146, 46], [176, 34]];
    for (let L = 0; L < 3; L++) {
      const f = this.factors[L];
      const w = Math.ceil(W + (this.levelW - W) * f) + 4;
      const c = makeCanvas(w, H), x = c.getContext('2d');
      const col = b.mts[L], hi = shade(col, 0.18), lo = shade(col, -0.25);
      const [base, amp] = bases[L];
      const hs = new Array(w);
      for (let i = 0; i < w; i++) {
        let n = this.noise(i * 0.012 + L * 37, L * 11.3, 4);
        let h;
        switch (this.biome) {
          case 'rock': n = Math.round(n * 7) / 7; h = base - (n - 0.4) * amp * 1.8; break; // mesas
          case 'ice': h = base - Math.pow(Math.abs(this.noise(i * 0.02 + L * 9, 3.3, 3) * 2 - 1), 0.6) * amp * 1.3 + 10; break;
          case 'jungle': h = base - (n - 0.35) * amp; break;
          case 'void': case 'core': {
            const sp = this.noise(i * 0.09 + L * 5, 1.7, 2);
            h = base - (n - 0.4) * amp * 0.8 - (sp > 0.62 ? (sp - 0.62) * amp * 6 : 0); break;
          }
          case 'lava': h = base - (n - 0.4) * amp * 1.3; break;
          default: h = base - (n - 0.4) * amp * 1.4;
        }
        hs[i] = Math.round(clamp(h, 20, H));
      }
      for (let i = 0; i < w; i++) {
        const h = hs[i];
        x.fillStyle = col; x.fillRect(i, h, 1, H - h);
        x.fillStyle = hi; x.fillRect(i, h, 1, 1);
        if (hs[i - 1] !== undefined && hs[i - 1] > h) { x.fillStyle = hi; x.fillRect(i, h, 1, Math.min(3, hs[i - 1] - h)); }
        if (this.biome === 'ice' && L < 2) { x.fillStyle = shade(col, 0.55); x.fillRect(i, h, 1, Math.max(1, Math.round(4 - (h - (base - amp)) * 0.05))); }
        // sombreamento por faixas
        if (i % 3 === 0) { x.fillStyle = lo; x.fillRect(i, h + 6 + ((i * 7) % 11), 1, 1); }
      }
      // detalhes por bioma
      const r = this.rng;
      if (this.biome === 'jungle' && L >= 1) {
        for (let k = 0; k < w / 9; k++) {
          const tx = Math.floor(r() * w), th = hs[tx];
          const trunkH = 8 + Math.floor(r() * 18) * (L === 2 ? 1.4 : 1);
          x.fillStyle = shade(col, -0.15); x.fillRect(tx, th - trunkH, 1 + (L === 2 ? 1 : 0), trunkH);
          x.fillStyle = shade(col, 0.1);
          x.beginPath(); x.arc(tx + 0.5, th - trunkH, 3 + r() * 5, 0, TAU); x.fill();
          if (r() < 0.25) { x.fillStyle = rgba('#c8ff9a', 0.5); x.fillRect(tx + 2, th - trunkH + 2, 1, 1); }
        }
      }
      if (this.biome === 'lava' && L === 1) {
        for (let k = 0; k < 3; k++) {
          const vx = Math.floor(r() * w), vh = hs[vx];
          const g = x.createRadialGradient(vx, vh, 0, vx, vh, 30);
          g.addColorStop(0, 'rgba(255,120,40,0.5)'); g.addColorStop(1, 'rgba(255,60,20,0)');
          x.fillStyle = g; x.fillRect(vx - 30, vh - 30, 60, 60);
          x.fillStyle = '#ff6a2a';
          for (let j = 0; j < 30; j++) x.fillRect(vx + Math.round(Math.sin(j * 0.7) * 2), vh + j, 1, 1);
        }
      }
      if (this.biome === 'anomaly' && L === 1) {
        for (let k = 0; k < w / 70; k++) {
          const fx = r() * w, fy = 40 + r() * 70, fw = 8 + r() * 22;
          x.fillStyle = col;
          x.beginPath(); x.moveTo(fx - fw / 2, fy); x.lineTo(fx + fw / 2, fy); x.lineTo(fx + fw * 0.1, fy + fw * 0.8); x.closePath(); x.fill();
          x.fillStyle = hi; x.fillRect(Math.round(fx - fw / 2), Math.round(fy), Math.round(fw), 1);
        }
      }
      if ((this.biome === 'void' || this.biome === 'core') && L === 2) {
        for (let k = 0; k < w / 40; k++) {
          const sx = Math.floor(r() * w);
          x.fillStyle = this.b.ground.detail; x.globalAlpha = 0.6;
          x.fillRect(sx, hs[sx] - 1, 1, 1); x.globalAlpha = 1;
        }
      }
      // névoa de profundidade
      const fog = x.createLinearGradient(0, base - amp, 0, H);
      fog.addColorStop(0, rgba(b.fog, 0)); fog.addColorStop(1, rgba(b.fog, 0.35 - L * 0.1));
      x.globalCompositeOperation = 'source-atop';
      x.fillStyle = fog; x.fillRect(0, 0, w, H);
      x.globalCompositeOperation = 'source-over';
      this.layers.push(c);
    }
  }

  buildTerrain() {
    const b = this.b, g = b.ground, r = this.rng;
    const w = this.levelW, c = makeCanvas(w, H), x = c.getContext('2d');
    // props de fundo (atrás das entidades)
    this.drawProps(x, w);
    // corpo do chão
    x.fillStyle = g.base; x.fillRect(0, GROUND_Y, w, H - GROUND_Y);
    // estratos
    for (let y = GROUND_Y + 8; y < H; y += 9 + Math.floor(r() * 6)) {
      x.fillStyle = shade(g.base, -0.12 - (y - GROUND_Y) / 300);
      for (let i = 0; i < w; i++) {
        const o = Math.round(this.noise(i * 0.05, y * 0.3, 2) * 3);
        x.fillRect(i, y + o, 1, 1);
      }
    }
    // escurece com profundidade
    const dg = x.createLinearGradient(0, GROUND_Y, 0, H);
    dg.addColorStop(0, rgba(g.dark, 0)); dg.addColorStop(1, rgba(g.dark, 0.85));
    x.fillStyle = dg; x.fillRect(0, GROUND_Y, w, H - GROUND_Y);
    // pedrinhas e textura
    for (let i = 0; i < w * 0.9; i++) {
      const px = Math.floor(r() * w), py = GROUND_Y + 5 + Math.floor(Math.pow(r(), 0.8) * (H - GROUND_Y - 5));
      x.fillStyle = r() < 0.5 ? shade(g.base, 0.12) : shade(g.base, -0.25);
      x.fillRect(px, py, r() < 0.2 ? 2 : 1, 1);
    }
    // detalhes especiais no subsolo
    if (this.biome === 'lava' || this.biome === 'core') {
      for (let k = 0; k < w / 40; k++) {
        let cx = r() * w, cy = GROUND_Y + 6 + r() * 30;
        x.fillStyle = g.detail;
        for (let j = 0; j < 14; j++) { x.fillRect(Math.round(cx), Math.round(cy), 1, 1); cx += rand(-1, 2); cy += rand(-0.5, 1.2); }
      }
    }
    if (this.biome === 'ice' || this.biome === 'anomaly' || this.biome === 'void') {
      for (let k = 0; k < w / 60; k++) {
        const cx = Math.floor(r() * w), cy = GROUND_Y + 10 + Math.floor(r() * 40);
        x.fillStyle = g.detail; x.globalAlpha = 0.7;
        x.fillRect(cx, cy, 2, 1); x.fillRect(cx + 1, cy - 1, 1, 3);
        x.globalAlpha = 1;
      }
    }
    // superfície
    for (let i = 0; i < w; i++) {
      const th = 3 + Math.round(this.noise(i * 0.08, 5.5, 2) * 3);
      x.fillStyle = g.top; x.fillRect(i, GROUND_Y, 1, th);
      x.fillStyle = shade(g.top, 0.25); x.fillRect(i, GROUND_Y, 1, 1);
      x.fillStyle = shade(g.top, -0.3); x.fillRect(i, GROUND_Y + th, 1, 1);
      if (this.biome === 'jungle' && r() < 0.5) {
        const gh = 1 + Math.floor(r() * 4);
        x.fillStyle = r() < 0.5 ? g.top : shade(g.top, 0.2);
        x.fillRect(i, GROUND_Y - gh, 1, gh);
      }
      if (this.biome === 'rock' && r() < 0.06) { x.fillStyle = g.detail; x.fillRect(i, GROUND_Y - 1, 2, 1); }
      if (this.biome === 'ice' && r() < 0.04) { x.fillStyle = '#ffffff'; x.fillRect(i, GROUND_Y - 1, 1, 1); }
      if ((this.biome === 'lava' || this.biome === 'core') && r() < 0.03) { x.fillStyle = g.detail; x.fillRect(i, GROUND_Y + 1, 1, 2); }
    }
    this.terrain = c;
  }

  drawProps(x, w) {
    const b = this.b, g = b.ground, r = this.rng, deco = b.deco;
    const n = Math.floor(w / 28);
    for (let k = 0; k < n; k++) {
      const px = Math.floor(r() * w);
      // deixa a área central (base) mais limpa
      if (Math.abs(px - w / 2) < 60) continue;
      const s = 0.6 + r() * 1.0;
      const dark = shade(g.base, -0.35), mid = shade(g.base, -0.1), light = shade(g.top, -0.05);
      switch (deco) {
        case 'rocks': {
          const rw = Math.round(6 + 12 * s), rh = Math.round(4 + 8 * s);
          x.fillStyle = dark; x.beginPath(); x.ellipse(px, GROUND_Y, rw / 2, rh, 0, Math.PI, 0); x.fill();
          x.fillStyle = mid; x.fillRect(px - rw / 4, GROUND_Y - rh + 1, rw / 3, 1);
          if (r() < 0.2) { // pilar de pedra
            const ph = Math.round(20 + 30 * s);
            x.fillStyle = dark; x.fillRect(px - 3, GROUND_Y - ph, 6, ph);
            x.fillStyle = mid; x.fillRect(px - 3, GROUND_Y - ph, 2, ph);
            x.fillRect(px - 5, GROUND_Y - ph - 3, 10, 3);
          }
          break;
        }
        case 'plants': {
          const ph = Math.round(10 + 26 * s);
          x.strokeStyle = shade(g.top, -0.35); x.lineWidth = 1;
          x.beginPath(); x.moveTo(px, GROUND_Y); x.quadraticCurveTo(px + rand(-6, 6), GROUND_Y - ph / 2, px + rand(-4, 4), GROUND_Y - ph); x.stroke();
          x.fillStyle = shade(g.top, -0.2);
          for (let j = 0; j < 4; j++) { x.beginPath(); x.ellipse(px + rand(-6, 6), GROUND_Y - ph + rand(-3, 6), 4 * s + 1, 2, rand(-0.6, 0.6), 0, TAU); x.fill(); }
          if (r() < 0.5) { x.fillStyle = choose(['#ff4d6d', '#ffd84d', '#9af0ff']); x.fillRect(px + 1, GROUND_Y - ph - 1, 2, 2); }
          break;
        }
        case 'crystals': {
          const ch = Math.round(8 + 22 * s);
          const cc = r() < 0.5 ? '#9fdcf5' : '#d8f4ff';
          x.fillStyle = cc;
          x.beginPath(); x.moveTo(px - 3, GROUND_Y); x.lineTo(px, GROUND_Y - ch); x.lineTo(px + 3, GROUND_Y); x.fill();
          x.fillStyle = '#ffffff'; x.fillRect(px - 1, GROUND_Y - ch + 3, 1, ch - 5);
          if (r() < 0.6) { x.fillStyle = shade(cc, -0.2); x.beginPath(); x.moveTo(px + 2, GROUND_Y); x.lineTo(px + 6, GROUND_Y - ch * 0.5); x.lineTo(px + 7, GROUND_Y); x.fill(); }
          break;
        }
        case 'lavarocks': {
          const ch = Math.round(10 + 26 * s);
          x.fillStyle = '#1a0a0a'; x.fillRect(px - 4, GROUND_Y - ch, 8, ch);
          x.fillStyle = '#2e1410'; x.fillRect(px - 4, GROUND_Y - ch, 3, ch);
          x.fillStyle = '#ff6a2a';
          for (let j = 0; j < ch; j += 4) if (r() < 0.4) x.fillRect(px + 1, GROUND_Y - ch + j, 1, 2);
          break;
        }
        case 'floaters': {
          const fy = GROUND_Y - 30 - r() * 60, fw = 4 + 10 * s;
          x.fillStyle = mid; x.beginPath(); x.moveTo(px - fw / 2, fy); x.lineTo(px + fw / 2, fy); x.lineTo(px, fy + fw * 0.7); x.fill();
          x.fillStyle = light; x.fillRect(Math.round(px - fw / 2), Math.round(fy), Math.round(fw), 1);
          x.fillStyle = rgba('#d9b8ff', 0.4); x.fillRect(Math.round(px), Math.round(fy + fw), 1, 1);
          break;
        }
        case 'spires': {
          const ch = Math.round(16 + 40 * s);
          x.fillStyle = '#0a0612';
          x.beginPath(); x.moveTo(px - 4, GROUND_Y); x.lineTo(px, GROUND_Y - ch); x.lineTo(px + 4, GROUND_Y); x.fill();
          x.fillStyle = g.detail; x.fillRect(px, GROUND_Y - ch, 1, 2);
          break;
        }
      }
    }
  }

  newWeather(init) {
    const t = this.b.weather;
    const p = { x: rand(0, W), y: init ? rand(0, H) : -5, d: rand(0.3, 1.2), ph: rand(0, TAU) };
    switch (t) {
      case 'snow': p.vx = rand(-8, -2); p.vy = rand(12, 26); p.c = '#ffffff'; break;
      case 'embers': p.vx = rand(-6, 6); p.vy = rand(-22, -8); p.c = choose(['#ffb347', '#ff6a2a', '#fff27a']); if (!init) p.y = H + 5; p.glow = true; break;
      case 'spores': p.vx = rand(-4, 4); p.vy = rand(-5, 5); p.c = choose(['#c8ff9a', '#9af0ff']); p.glow = true; break;
      case 'dust': p.vx = rand(-30, -14); p.vy = rand(-2, 4); p.c = 'rgba(220,180,140,0.5)'; if (!init) { p.x = W + 5; p.y = rand(0, H); } break;
      case 'motes': p.vx = rand(-3, 3); p.vy = rand(-8, -2); p.c = '#d9b8ff'; p.glow = true; if (!init) p.y = H + 5; break;
      case 'void': p.vx = rand(-2, 2); p.vy = rand(-6, 6); p.c = choose(['#ff3df0', '#8a5aff']); p.glow = true; break;
    }
    return p;
  }

  updateWeather(dt) {
    for (let i = 0; i < this.weather.length; i++) {
      const p = this.weather[i];
      p.ph += dt * 2;
      p.x += (p.vx + Math.sin(p.ph) * 4) * dt * p.d;
      p.y += p.vy * dt * p.d;
      if (p.y > H + 8 || p.y < -10 || p.x < -10 || p.x > W + 10) {
        const np = this.newWeather(false);
        if (np.vy > 0 && this.b.weather !== 'dust') np.y = -5;
        if (this.b.weather === 'spores' || this.b.weather === 'void') { np.x = rand(0, W); np.y = rand(0, H); }
        this.weather[i] = np;
      }
    }
  }

  drawBack(ctx, camX, t) {
    ctx.drawImage(this.sky, 0, 0);
    this.drawCelestial(ctx, t, camX);
    for (let L = 0; L < 3; L++) {
      ctx.drawImage(this.layers[L], -Math.round(camX * this.factors[L]), 0);
    }
  }

  drawCelestial(ctx, t, camX) {
    const c = this.b.celestial;
    const cx = Math.round(c.x * W - camX * 0.04), cy = Math.round(c.y * H);
    if (c.type === 'moon' || c.type === 'planet' || c.type === 'rings') {
      Glow.draw(ctx, cx, cy, c.r * 2.2, c.color, 0.25);
      const img = planetFrame(c.r, c.biome || 'rock', this.seed + 7, t * 0.01, 48);
      if (c.type === 'rings') {
        ctx.strokeStyle = rgba(c.color, 0.5); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, cy, c.r * 1.9, c.r * 0.45, -0.3, Math.PI, TAU); ctx.stroke();
      }
      ctx.drawImage(img, cx - c.r, cy - c.r);
      if (c.type === 'rings') {
        ctx.strokeStyle = rgba(c.color, 0.7); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, cy, c.r * 1.9, c.r * 0.45, -0.3, 0, Math.PI); ctx.stroke();
      }
    } else if (c.type === 'sun') {
      Glow.draw(ctx, cx, cy, c.r * 6, c.color, 0.45);
      ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(cx, cy, c.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, cy, c.r * 0.6, 0, TAU); ctx.fill();
    } else if (c.type === 'rift') {
      const pulse = 0.8 + Math.sin(t * 1.5) * 0.2;
      Glow.draw(ctx, cx, cy, c.r * 2.5 * pulse, c.color, 0.35);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.05);
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = rgba(c.color, 0.25 + i * 0.15); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 0, c.r * (1 - i * 0.25), c.r * 0.25 * (1 - i * 0.2), i * 0.6 + t * 0.1, 0, TAU); ctx.stroke();
      }
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, 0, c.r * 0.35, c.r * 0.12, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  drawTerrain(ctx, camX) {
    ctx.drawImage(this.terrain, Math.round(camX), 0, W, H, 0, 0, W, H);
  }

  drawWeather(ctx, camX) {
    for (const p of this.weather) {
      const x = ((p.x - camX * 0.6 * p.d) % W + W) % W;
      ctx.fillStyle = p.c;
      ctx.globalAlpha = 0.4 + p.d * 0.4;
      ctx.fillRect(Math.round(x), Math.round(p.y), p.d > 1 ? 2 : 1, p.d > 1 ? 2 : 1);
      if (p.glow) Glow.draw(ctx, x, p.y, 4, p.c, 0.35 * p.d);
    }
    ctx.globalAlpha = 1;
  }
}

// Céu estrelado de espaço profundo (título e mapa estelar)
const SpaceBG = {
  canvas: null, stars: [],
  build() {
    const c = makeCanvas(W, H), x = c.getContext('2d');
    x.fillStyle = '#05040b'; x.fillRect(0, 0, W, H);
    const noise = makeNoise2D(1337);
    const img = x.getImageData(0, 0, W, H);
    const cols = [[90, 40, 140], [30, 80, 150], [150, 40, 90]];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const n = noise(i * 0.008, j * 0.008, 5), m = noise(i * 0.004 + 50, j * 0.004 + 20, 3);
      const v = Math.max(0, n - 0.48) * 2.2;
      const ci = m < 0.45 ? 0 : m < 0.55 ? 1 : 2;
      const p = (j * W + i) * 4;
      let k = v * v;
      // dithering ordenado para visual pixel
      const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]][j % 4][i % 4] / 16;
      k = Math.floor(k * 6 + bayer) / 6;
      img.data[p] += cols[ci][0] * k; img.data[p + 1] += cols[ci][1] * k; img.data[p + 2] += cols[ci][2] * k;
    }
    x.putImageData(img, 0, 0);
    const r = seededRng(99);
    for (let i = 0; i < 260; i++) {
      const sx = Math.floor(r() * W), sy = Math.floor(r() * H), br = r();
      x.fillStyle = br > 0.9 ? '#fff' : br > 0.6 ? 'rgba(220,230,255,0.7)' : 'rgba(200,210,255,0.35)';
      x.fillRect(sx, sy, 1, 1);
    }
    this.canvas = c;
    for (let i = 0; i < 70; i++) this.stars.push({ x: rand(0, W), y: rand(0, H), d: rand(0.2, 1), tw: rand(0, TAU) });
  },
  draw(ctx, t, drift = 4) {
    if (!this.canvas) this.build();
    ctx.drawImage(this.canvas, 0, 0);
    for (const s of this.stars) {
      const x = ((s.x - t * drift * s.d) % W + W) % W;
      const a = 0.5 + Math.sin(t * 2 + s.tw) * 0.5;
      ctx.fillStyle = `rgba(255,255,255,${(0.3 + a * 0.7) * s.d})`;
      ctx.fillRect(Math.round(x), Math.round(s.y), 1, 1);
      if (s.d > 0.85 && a > 0.8) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(Math.round(x) - 1, Math.round(s.y), 3, 1); ctx.fillRect(Math.round(x), Math.round(s.y) - 1, 1, 3); }
    }
  },
};
