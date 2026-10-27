'use strict';
// ============================================================
//  Chefes: Verme Colossal, Rainha da Colmeia, Titã Ancestral
//  e Soberano do Vazio (chefe final)
// ============================================================

class Boss {
  constructor(m, type) {
    this.m = m; this.type = type; this.def = BOSSES[type];
    this.name = this.def.name;
    this.maxHp = Math.round(this.def.hp * m.bossHpMul); this.hp = this.maxHp;
    this.dead = false; this.dying = 0; this.t = 0; this.flash = 0;
    this.pal = ENEMY_PALETTES[m.world.biome];
    this.nativeT = m.world.temp;
    this.contactCd = new Map();
    this.chill = 0; this.dmgMul = m.dmgMul;
  }
  thermalSlow(x) {
    const diff = Math.abs(this.m.tempAt(x) - this.nativeT);
    let s = diff > 90 ? 0.55 : diff > 45 ? 0.75 : 1;
    this.thermal = diff > 45;
    if (this.m.gravZoneAt(x) === 'heavy') s *= 0.6;
    if (this.chill > 0) s *= 0.7;
    return s;
  }
  damage(d, x, y, chill) {
    if (this.dead || this.dying) return;
    const mul = this.damageMul ? this.damageMul() : 1;
    d *= mul;
    if (this.thermal) d *= 1.25;
    this.hp -= d; this.flash = 0.06;
    if (chill) this.chill = 1;
    FX.text(x, y - 6, Math.round(d), mul < 1 ? '#a0a0c0' : d >= 40 ? '#ffcf5a' : '#ffffff', { life: 0.6, vy: -40 });
    if (Math.random() < 0.3) Sound.play('hit', { vol: 0.5 });
    if (this.hp <= 0) { this.hp = 0; this.startDying(); }
  }
  startDying() {
    this.dying = 2.2;
    Sound.play('roar'); FX.addShake(8);
    this.m.onBossDying(this);
  }
  updateDying(dt) {
    this.dying -= dt;
    const c = this.center();
    if (Math.random() < 0.35) {
      FX.explosion(c.x + rand(-30, 30), c.y + rand(-25, 25), rand(10, 22), undefined);
      Sound.play('explosion', { vol: 0.5, gap: 90 });
    }
    if (this.dying <= 0) {
      this.dying = 0;
      this.dead = true;
      FX.explosion(c.x, c.y, 60, ['#ffffff', this.pal.c, this.pal.a, '#ffb347'], true);
      FX.burst(c.x, c.y, 60, { color: [this.pal.a, this.pal.b, this.pal.c], speed: 220, grav: 380, bounce: true, life: 2, size: 3 });
      FX.screenFlash('#ffffff', 0.9);
      Sound.play('bigExplosion');
      this.m.onBossKilled(this);
    }
  }
  contact(key, cd) {
    const now = this.t, last = this.contactCd.get(key) || -99;
    if (now - last < cd) return false;
    this.contactCd.set(key, now); return true;
  }
  // dano por contato a jogador, construções e broca em um círculo
  contactDamage(cx, cy, r, dmgP, dmgB, dmgD) {
    const m = this.m, p = m.player;
    if (!p.dead && circleRect(cx, cy, r, p.rect()) && this.contact(p, 0.8)) p.hurt(dmgP * this.dmgMul, cx);
    for (const b of m.buildings) {
      if (b.dead) continue;
      const rr = b.type === 'ceiling' ? b.fieldRect() : b.rect();
      if (circleRect(cx, cy, r, rr) && this.contact(b, 0.6)) { b.damage(dmgB); FX.burst(cx, cy, 6, { color: ['#ffe14d', '#fff'], speed: 90, type: 'spark' }); }
    }
    if (circleRect(cx, cy, r, m.drill.rect()) && this.contact(m.drill, 0.8)) m.damageDrill(dmgD * this.dmgMul);
  }
  laserHits(x1, y1, x2, y2, dt, dps) {
    const m = this.m, p = m.player;
    const segDist = (px, py) => {
      const vx = x2 - x1, vy = y2 - y1, l2 = vx * vx + vy * vy;
      const t = clamp(((px - x1) * vx + (py - y1) * vy) / l2, 0, 1);
      return dist(px, py, x1 + vx * t, y1 + vy * t);
    };
    if (!p.dead && segDist(p.cx, p.cy) < 8 && this.contact('laser', 0.25)) p.hurt(dps * 0.25 * this.dmgMul, x2);
    for (const b of m.buildings) if (!b.dead && Math.abs(b.x - x2) < 9) b.damage(dps * 2 * dt);
    if (Math.abs(m.drill.x - x2) < 24) m.damageDrill(dps * 1.2 * dt * this.dmgMul);
    if (Math.random() < 0.6) FX.burst(x2, GROUND_Y - 1, 2, { color: ['#ffffff', this.laserColor || '#ff4d4d'], speed: 80, angle: -Math.PI / 2, spread: 1, life: 0.3, glow: true });
  }
  drawLaser(ctx, camX, x1, y1, x2, y2, telegraph, color) {
    if (telegraph) {
      ctx.strokeStyle = rgba(color, 0.4 + Math.sin(this.t * 40) * 0.3); ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x1 - camX, y1); ctx.lineTo(x2 - camX, y2); ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(color, 0.5); ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x1 - camX, y1); ctx.lineTo(x2 - camX, y2); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x1 - camX, y1); ctx.lineTo(x2 - camX, y2); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    Glow.draw(ctx, x2 - camX, y2, 18, color, 0.8);
  }
  nearGround() { return false; }
}

// ------------------------------------------------------------
//  Verme Colossal: escava, salta do solo e ergue-se para cuspir
// ------------------------------------------------------------
class WormBoss extends Boss {
  constructor(m, side) {
    super(m, 'worm');
    this.N = 18; this.spacing = 8;
    this.side = side;
    this.hx = m.drill.x + (side === 'left' ? -520 : 520); this.hy = GROUND_Y + 30;
    this.vx = 0; this.vy = 0;
    this.state = 'under'; this.stateT = 0; this.tx = m.drill.x + (side === 'left' ? -160 : 160);
    this.hist = [];
    for (let i = 0; i < this.N * this.spacing + 2; i++) this.hist.push({ x: this.hx - (side === 'left' ? i : -i), y: this.hy });
    this.spitT = 0; this.attacks = 0;
  }
  center() { return { x: this.hx, y: Math.min(this.hy, GROUND_Y - 10) }; }
  seg(i) {
    const p = this.hist[Math.min(this.hist.length - 1, i * this.spacing)];
    return { x: p.x, y: p.y, r: lerp(13, 5, i / (this.N - 1)) };
  }
  pushHist() {
    const h = this.hist[0];
    const d = dist(h.x, h.y, this.hx, this.hy);
    if (d >= 1) {
      const n = Math.floor(d);
      for (let k = 1; k <= n; k++) this.hist.unshift({ x: lerp(h.x, this.hx, k / d), y: lerp(h.y, this.hy, k / d) });
      this.hist.length = Math.min(this.hist.length, this.N * this.spacing + 2);
    }
  }
  pickTarget() {
    const m = this.m, r = Math.random();
    if (r < 0.4 && !m.player.dead) return m.player.cx;
    if (r < 0.7) return m.drill.x + rand(-20, 20);
    const bs = m.buildings.filter(b => !b.dead);
    return bs.length ? choose(bs).x : m.drill.x;
  }
  update(dt) {
    this.t += dt; this.flash -= dt; this.chill -= dt;
    if (this.dying) { this.updateDying(dt); return; }
    const m = this.m, g = GRAV * m.world.gravity * 0.85;
    const slow = this.thermalSlow(this.hx);
    this.stateT += dt;
    const enraged = this.hp < this.maxHp * 0.5;
    switch (this.state) {
      case 'under': {
        this.hy = lerp(this.hy, GROUND_Y + 30, dt * 4);
        const dx = this.tx - this.hx;
        this.hx += clamp(dx, -1, 1) * Math.min(Math.abs(dx), 120 * slow * (enraged ? 1.3 : 1) * dt);
        if (Math.random() < 0.7) FX.add({ x: this.hx + rand(-8, 8), y: GROUND_Y - 1, vx: rand(-40, 40), vy: rand(-90, -30), color: choose([BIOMES[m.world.biome].ground.top, BIOMES[m.world.biome].ground.base]), size: 2, life: 0.5, grav: 400 });
        if (Math.abs(dx) < 10 && this.stateT > 1) { this.state = 'rumble'; this.stateT = 0; Sound.play('stomp', { vol: 0.6 }); }
        break;
      }
      case 'rumble': {
        FX.addShake(3);
        FX.burst(this.hx, GROUND_Y - 1, 3, { color: [BIOMES[m.world.biome].ground.top], speed: 120, angle: -Math.PI / 2, spread: 0.5, grav: 400, life: 0.6, size: 2 });
        if (this.stateT > 0.75) {
          this.attacks++;
          const rise = this.attacks % 3 === 0;
          if (rise) { this.state = 'rise'; this.stateT = 0; this.vy = 0; this.vx = 0; }
          else {
            this.state = 'air'; this.stateT = 0;
            const hgt = rand(100, 150);
            this.vy = -Math.sqrt(2 * g * hgt);
            this.vx = (Math.random() < 0.5 ? -1 : 1) * rand(70, 120) * (enraged ? 1.3 : 1);
          }
          Sound.play('roar', { vol: 0.7 });
          FX.burst(this.hx, GROUND_Y, 26, { color: [BIOMES[m.world.biome].ground.top, BIOMES[m.world.biome].ground.base, '#888'], speed: 180, angle: -Math.PI / 2, spread: 1.2, grav: 400, life: 1, size: 2, bounce: true });
          FX.addShake(7);
        }
        break;
      }
      case 'air': {
        this.vy += g * dt;
        this.hx += this.vx * dt; this.hy += this.vy * dt;
        this.contactDamage(this.hx, this.hy, 13, 22, 90, 45);
        if (this.hy > GROUND_Y + 30 && this.vy > 0) {
          this.state = 'under'; this.stateT = 0; this.tx = this.pickTarget();
          FX.burst(this.hx, GROUND_Y, 16, { color: [BIOMES[m.world.biome].ground.top, '#888'], speed: 140, angle: -Math.PI / 2, spread: 1.2, grav: 400, life: 0.8, size: 2 });
          FX.addShake(4);
        }
        break;
      }
      case 'rise': {
        const topY = GROUND_Y - 78;
        if (this.stateT < 0.6) this.hy = lerp(this.hy, topY, dt * 6);
        else this.hy = topY + Math.sin(this.stateT * 2) * 4;
        this.hx += Math.sin(this.stateT * 1.5) * 18 * dt;
        this.contactDamage(this.hx, this.hy, 13, 18, 70, 35);
        // corpo vertical também machuca
        for (let i = 1; i < 6; i++) { const s = this.seg(i); if (s.y < GROUND_Y) this.contactDamage(s.x, s.y, s.r, 12, 40, 25); }
        this.spitT -= dt;
        if (this.spitT <= 0 && this.stateT > 0.6) {
          this.spitT = enraged ? 0.6 : 0.9;
          const p = m.player;
          const tx = !p.dead && Math.random() < 0.7 ? p.cx : m.drill.x, ty = !p.dead ? p.cy : m.drill.cy;
          for (let k = -1; k <= 1; k++) {
            const T = 1.0 + k * 0.12, sx = this.hx, sy = this.hy;
            const gg = GRAV * m.gravAt(sx);
            m.addProj(new Projectile({ x: sx, y: sy, vx: (tx + k * 22 - sx) / T, vy: (ty - sy - 0.5 * gg * T * T) / T, team: 'enemy', kind: 'acid', dmg: 14 * this.dmgMul, life: 4, r: 3, color: this.pal.e, gravity: 1, aoe: 14 }));
          }
          Sound.play('hit');
        }
        if (this.stateT > 4.5) { this.state = 'sink'; this.stateT = 0; }
        break;
      }
      case 'sink': {
        this.hy += 160 * dt;
        if (this.hy > GROUND_Y + 30) { this.state = 'under'; this.stateT = 0; this.tx = this.pickTarget(); }
        break;
      }
    }
    this.hx = clamp(this.hx, -60, m.width + 60);
    this.pushHist();
  }
  hitTest(x, y, r) {
    if (this.dying) return false;
    for (let i = 0; i < this.N; i++) {
      const s = this.seg(i);
      if (s.y - s.r > GROUND_Y) continue;
      if (dist2(x, y, s.x, s.y) < (s.r + r) * (s.r + r)) return true;
    }
    return false;
  }
  targetPoint() {
    if (this.hy - 13 > GROUND_Y) return null;
    return { x: this.hx, y: this.hy };
  }
  nearGround(x, r) { return Math.abs(this.hx - x) < r && this.hy > GROUND_Y - 30 && this.hy < GROUND_Y + 20; }
  draw(ctx, camX) {
    const pal = this.pal, fl = this.flash > 0;
    const f = (c) => fl ? mixHex(c, '#ffffff', 0.55) : c;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, GROUND_Y + 1); ctx.clip();
    for (let i = this.N - 1; i >= 0; i--) {
      const s = this.seg(i);
      if (s.y - s.r > GROUND_Y) continue;
      const x = s.x - camX, y = s.y;
      if (x < -30 || x > W + 30) continue;
      const nx = this.seg(Math.max(0, i - 1));
      const a = Math.atan2(nx.y - s.y, nx.x - s.x);
      // garras laterais (como na referência)
      if (i > 1 && i % 2 === 0) {
        ctx.strokeStyle = pal.c; ctx.lineWidth = 2;
        const wig = Math.sin(this.t * 10 + i) * 0.4;
        for (const sd of [-1, 1]) {
          const ca = a + sd * (Math.PI / 2 + wig);
          ctx.beginPath(); ctx.moveTo(x, y);
          const ex = x + Math.cos(ca) * (s.r + 5), ey = y + Math.sin(ca) * (s.r + 5);
          ctx.quadraticCurveTo(ex + Math.cos(a) * 3, ey + Math.sin(a) * 3, ex - Math.cos(a) * 3, ey - Math.sin(a) * 3);
          ctx.stroke();
        }
      }
      ctx.fillStyle = f(pal.o);
      ctx.beginPath(); ctx.arc(x, y, s.r + 1, 0, TAU); ctx.fill();
      ctx.fillStyle = f(i % 2 ? pal.a : shade(pal.a, -0.1));
      ctx.beginPath(); ctx.arc(x, y, s.r, 0, TAU); ctx.fill();
      ctx.fillStyle = f(pal.b);
      ctx.beginPath(); ctx.arc(x + Math.cos(a + Math.PI / 2) * s.r * 0.35, y + Math.sin(a + Math.PI / 2) * s.r * 0.35, s.r * 0.6, 0, TAU); ctx.fill();
      ctx.fillStyle = f(pal.c);
      ctx.beginPath(); ctx.arc(x - Math.cos(a + Math.PI / 2) * s.r * 0.4, y - Math.sin(a + Math.PI / 2) * s.r * 0.4, s.r * 0.35, 0, TAU); ctx.fill();
      // bolhas (textura)
      ctx.fillStyle = shade(pal.a, 0.25);
      ctx.fillRect(Math.round(x + Math.cos(a) * 2), Math.round(y - 2), 2, 2);
    }
    // cabeça
    const hx = this.hx - camX, hy = this.hy;
    const nx = this.seg(1), a = Math.atan2(hy - nx.y, this.hx - nx.x);
    if (hy - 14 < GROUND_Y) {
      const open = this.state === 'rise' || this.state === 'air' ? 0.5 + Math.sin(this.t * 12) * 0.3 : 0.2;
      ctx.strokeStyle = f(pal.c); ctx.lineWidth = 3;
      for (const sd of [-1, 1]) {
        const ma = a + sd * open;
        ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * 8, hy + Math.sin(a) * 8);
        ctx.quadraticCurveTo(hx + Math.cos(ma) * 18, hy + Math.sin(ma) * 18, hx + Math.cos(a - sd * 0.2) * 22, hy + Math.sin(a - sd * 0.2) * 22);
        ctx.stroke();
      }
      for (const sd of [-1, 1]) {
        const ex = hx + Math.cos(a + sd * 0.6) * 7, ey = hy + Math.sin(a + sd * 0.6) * 7;
        ctx.fillStyle = pal.e; ctx.fillRect(Math.round(ex) - 1, Math.round(ey) - 1, 3, 3);
        Glow.draw(ctx, ex, ey, 8, pal.e, 0.7);
      }
    }
    ctx.restore();
    // monte de terra quando subterrâneo
    if (this.state === 'under' || this.state === 'rumble') {
      const x = Math.round(this.hx - camX);
      ctx.fillStyle = BIOMES[this.m.world.biome].ground.top;
      const hh = this.state === 'rumble' ? 6 + Math.sin(this.t * 40) * 2 : 3;
      ctx.beginPath(); ctx.ellipse(x, GROUND_Y + 1, 16, hh, 0, Math.PI, 0); ctx.fill();
      if (this.state === 'rumble') {
        ctx.fillStyle = '#ff4d4d';
        drawText(ctx, '!', x, GROUND_Y - 22 - Math.sin(this.t * 20) * 2, '#ff4d4d', 2, 'center');
      }
    }
  }
}

// ------------------------------------------------------------
//  Rainha da Colmeia: voa, invoca vespas, esporos e investidas
// ------------------------------------------------------------
class QueenBoss extends Boss {
  constructor(m, side) {
    super(m, 'queen');
    this.x = m.drill.x + (side === 'left' ? -520 : 520); this.y = 60;
    this.alt = 66; this.dir = side === 'left' ? 1 : -1;
    this.patrolX = m.drill.x; this.state = 'enter';
    this.sporeT = 2; this.summonT = 5; this.diveT = 8; this.stateT = 0;
    this.w = 40; this.h = 30;
  }
  center() { return { x: this.x, y: this.y }; }
  rect() { return { x: this.x - 18, y: this.y - 14, w: 36, h: 30 }; }
  update(dt) {
    this.t += dt; this.flash -= dt; this.chill -= dt;
    if (this.dying) { this.y += 30 * dt; this.updateDying(dt); return; }
    const m = this.m, p = m.player;
    const slow = this.thermalSlow(this.x);
    const heavy = m.gravZoneAt(this.x) === 'heavy';
    const enraged = this.hp < this.maxHp * 0.5;
    this.stateT += dt;
    // teto: ela se choca e danifica
    for (const b of m.buildings) {
      if (b.dead || b.type !== 'ceiling') continue;
      if (rectsOverlap(this.rect(), b.fieldRect()) && this.contact(b, 0.5)) { b.damage(35); FX.burst(this.x, this.y, 5, { color: ['#a0f0ff', '#fff'], speed: 70, type: 'spark' }); }
    }
    if (this.state === 'enter') {
      this.x += this.dir * 70 * dt;
      this.y = lerp(this.y, this.alt, dt);
      if (Math.abs(this.x - m.drill.x) < 220) { this.state = 'patrol'; this.stateT = 0; }
    } else if (this.state === 'patrol') {
      const tgtAlt = this.alt + (heavy ? 50 : 0) + Math.sin(this.t * 1.3) * 10;
      this.y = lerp(this.y, tgtAlt, dt * 1.5);
      const anchor = !p.dead ? lerp(m.drill.x, p.cx, 0.6) : m.drill.x;
      const tx = anchor + Math.sin(this.t * 0.45) * 120;
      this.x += clamp(tx - this.x, -1, 1) * 55 * slow * (enraged ? 1.3 : 1) * dt;
      this.dir = tx > this.x ? 1 : -1;
      this.sporeT -= dt; this.summonT -= dt; this.diveT -= dt;
      if (this.sporeT <= 0) {
        this.sporeT = enraged ? 1.8 : 2.8;
        const base = !p.dead ? Math.atan2(p.cy - this.y, p.cx - this.x) : Math.PI / 2;
        const n = enraged ? 9 : 7;
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.16;
          m.addProj(new Projectile({ x: this.x, y: this.y + 8, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, team: 'enemy', kind: 'spore', dmg: 9 * this.dmgMul, life: 3, r: 2, color: this.pal.e }));
        }
        Sound.play('cryo');
      }
      if (this.summonT <= 0) {
        this.summonT = enraged ? 6 : 8;
        for (let i = 0; i < (enraged ? 4 : 3) && m.enemies.length < 14; i++) {
          const e = new Enemy(m, 'wasp', 'left', { x: this.x + rand(-10, 10), y: this.y + 10 });
          e.alt = rand(70, 140); m.enemies.push(e);
        }
        FX.burst(this.x, this.y + 10, 16, { color: [this.pal.c, this.pal.e], speed: 70, glow: true });
        Sound.play('roar', { vol: 0.5 });
      }
      if (this.diveT <= 0 && !p.dead) { this.state = 'telegraph'; this.stateT = 0; this.diveTarget = { x: p.cx, y: p.cy }; }
    } else if (this.state === 'telegraph') {
      this.x += Math.sin(this.t * 60) * 20 * dt;
      if (this.stateT > 0.7) { this.state = 'dive'; this.stateT = 0; Sound.play('dash'); }
    } else if (this.state === 'dive') {
      const a = Math.atan2(this.diveTarget.y - this.y, this.diveTarget.x - this.x);
      this.x += Math.cos(a) * 280 * dt; this.y += Math.sin(a) * 280 * dt;
      this.contactDamage(this.x, this.y, 16, 24, 60, 30);
      if (dist(this.x, this.y, this.diveTarget.x, this.diveTarget.y) < 10 || this.stateT > 1.2 || this.y > GROUND_Y - 16) {
        this.state = 'patrol'; this.diveT = enraged ? 5 : 8;
        FX.addShake(3);
      }
    }
    this.contactDamage(this.x, this.y, 14, 12, 20, 10);
    this.y = Math.min(this.y, GROUND_Y - 16);
  }
  hitTest(x, y, r) { return !this.dying && circleRect(x, y, r, this.rect()); }
  targetPoint() { return { x: this.x, y: this.y }; }
  draw(ctx, camX) {
    const x = Math.round(this.x - camX), y = Math.round(this.y), pal = this.pal, fl = this.flash > 0;
    const f = (c) => fl ? mixHex(c, '#ffffff', 0.55) : c;
    const flap = Math.sin(this.t * 28);
    // asas
    ctx.fillStyle = rgba(pal.c, 0.45);
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(x + sd * 14, y - 12 - flap * 4, 18, 6 + Math.abs(flap) * 3, sd * (0.5 + flap * 0.2), 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + sd * 10, y - 4 - flap * 2, 12, 4, sd * 0.2, 0, TAU); ctx.fill();
    }
    // abdômen (segmentos listrados)
    for (let i = 3; i >= 0; i--) {
      const ax = x - this.dir * (6 + i * 5), ay = y + 6 + i * 3 + Math.sin(this.t * 3 + i) * 1.5;
      const r = 9 - i;
      ctx.fillStyle = f(pal.o); ctx.beginPath(); ctx.arc(ax, ay, r + 1, 0, TAU); ctx.fill();
      ctx.fillStyle = f(i % 2 ? pal.a : pal.b); ctx.beginPath(); ctx.arc(ax, ay, r, 0, TAU); ctx.fill();
      ctx.fillStyle = f(pal.c); ctx.fillRect(ax - 2, ay - r + 1, 3, 1);
    }
    Glow.draw(ctx, x - this.dir * 22, y + 16, 10, pal.e, 0.5);
    // tórax
    ctx.fillStyle = f(pal.o); ctx.beginPath(); ctx.ellipse(x + this.dir * 4, y, 13, 10, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = f(pal.a); ctx.beginPath(); ctx.ellipse(x + this.dir * 4, y, 12, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = f(pal.c); ctx.beginPath(); ctx.ellipse(x + this.dir * 2, y - 4, 7, 3, 0, 0, TAU); ctx.fill();
    // pernas
    ctx.strokeStyle = f(pal.o); ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const lx = x + this.dir * (i * 4), ly = y + 8;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + this.dir * 2, ly + 6 + Math.sin(this.t * 6 + i) * 2); ctx.lineTo(lx - this.dir * 1, ly + 10); ctx.stroke();
    }
    // cabeça com coroa
    const hx = x + this.dir * 16, hy = y - 4;
    ctx.fillStyle = f(pal.o); ctx.beginPath(); ctx.arc(hx, hy, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = f(pal.b); ctx.beginPath(); ctx.arc(hx, hy, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = f(pal.c);
    for (let i = -2; i <= 2; i++) ctx.fillRect(hx + i * 2 - 1, hy - 10 - (i === 0 ? 3 : Math.abs(i) === 1 ? 1 : 0), 2, 4);
    const eyeCol = this.state === 'telegraph' ? '#ff2a2a' : pal.e;
    ctx.fillStyle = eyeCol; ctx.fillRect(hx + this.dir * 2 - 1, hy - 2, 3, 2); ctx.fillRect(hx - this.dir * 2 - 1, hy - 2, 2, 2);
    Glow.draw(ctx, hx, hy - 1, this.state === 'telegraph' ? 20 : 10, eyeCol, 0.8);
  }
}

// ------------------------------------------------------------
//  Titã Ancestral: colosso que caminha, pisoteia e dispara
// ------------------------------------------------------------
class TitanBoss extends Boss {
  constructor(m, side) {
    super(m, 'titan');
    this.dir = side === 'left' ? 1 : -1;
    this.x = m.drill.x + (side === 'left' ? -480 : 480);
    this.w = 44; this.h = 76;
    this.stompT = 5; this.fireT = 3; this.laserT = 10; this.atkT = 0; this.walkT = 0;
    this.state = 'walk'; this.stateT = 0; this.laser = null;
    this.laserColor = '#ff4d4d';
  }
  center() { return { x: this.x, y: GROUND_Y - 40 }; }
  rect() { return { x: this.x - 18, y: GROUND_Y - this.h, w: 36, h: this.h }; }
  update(dt) {
    this.t += dt; this.flash -= dt; this.chill -= dt;
    if (this.dying) { this.updateDying(dt); return; }
    const m = this.m, p = m.player;
    const slow = this.thermalSlow(this.x);
    const enraged = this.hp < this.maxHp * 0.5;
    this.stateT += dt; this.atkT += dt;
    // bloqueio
    const front = this.x + this.dir * 18;
    let blocker = null;
    for (const b of m.buildings) {
      if (b.dead || !b.def.solid) continue;
      const r = b.rect();
      if (this.dir > 0 ? (front >= r.x - 1 && this.x < r.x + r.w) : (front <= r.x + r.w + 1 && this.x > r.x)) { blocker = b; break; }
    }
    const dr = m.drill.rect();
    const atDrill = this.dir > 0 ? front >= dr.x - 1 && this.x < dr.x + dr.w : front <= dr.x + dr.w + 1 && this.x > dr.x;
    if (this.state === 'walk') {
      if (blocker || atDrill) {
        if (this.atkT > 1.6) {
          this.atkT = 0;
          if (blocker) blocker.damage(80); else m.damageDrill(45 * this.dmgMul);
          FX.addShake(5); Sound.play('stomp');
          FX.burst(front, GROUND_Y - 20, 10, { color: ['#ffe14d', '#fff'], speed: 120, type: 'spark' });
        }
      } else {
        this.x += this.dir * 13 * slow * (enraged ? 1.35 : 1) * dt;
        this.walkT += dt * slow;
      }
      // Nunca passa do centro da broca
      this.stompT -= dt; this.fireT -= dt; this.laserT -= dt;
      if (this.stompT <= 0) { this.state = 'stomp'; this.stateT = 0; }
      else if (this.fireT <= 0) {
        this.fireT = enraged ? 2.6 : 3.8;
        const tx = !p.dead ? p.cx : m.drill.x;
        for (let k = 0; k < 3; k++) {
          const T = 1.1 + k * 0.15, sx = this.x + this.dir * 14, sy = GROUND_Y - 58;
          const gg = GRAV * m.gravAt(sx);
          const ex = tx + rand(-25, 25);
          m.addProj(new Projectile({ x: sx, y: sy, vx: (ex - sx) / T, vy: (GROUND_Y - 4 - sy - 0.5 * gg * T * T) / T, team: 'enemy', kind: 'fireball', dmg: 16 * this.dmgMul, life: 4, r: 3, color: '#ff8a3c', gravity: 1, aoe: 20 }));
        }
        Sound.play('rocket');
      } else if (enraged && this.laserT <= 0) {
        this.state = 'laser'; this.stateT = 0;
        const startX = this.x + this.dir * 30;
        this.laser = { x: startX, to: !p.dead ? p.cx + this.dir * 60 : m.drill.x };
        Sound.play('laser');
      }
    } else if (this.state === 'stomp') {
      if (this.stateT > 0.7) {
        this.state = 'walk'; this.stompT = enraged ? 4 : 6;
        Sound.play('stomp'); FX.addShake(9);
        for (const d of [-1, 1]) m.addProj(new Projectile({ x: this.x + d * 20, y: GROUND_Y - 3, vx: d * 150, vy: 0, team: 'enemy', kind: 'shock', dmg: 20 * this.dmgMul, life: 3, r: 4, color: this.pal.e }));
        FX.burst(this.x, GROUND_Y, 30, { color: [BIOMES[m.world.biome].ground.top, '#888'], speed: 160, angle: -Math.PI / 2, spread: 1.5, grav: 400, life: 0.9, size: 2, bounce: true });
        if (enraged && m.enemies.length < 12) for (let i = 0; i < 2; i++) m.enemies.push(new Enemy(m, 'crawler', this.dir > 0 ? 'left' : 'right', { x: this.x - this.dir * 20 }));
      }
    } else if (this.state === 'laser') {
      const L = this.laser;
      if (this.stateT > 1.0) {
        L.x = lerp(L.x, L.to, dt * 0.9);
        const ex = this.x + this.dir * 8, ey = GROUND_Y - 66;
        this.laserHits(ex, ey, L.x, GROUND_Y, dt, 40);
        FX.addShake(1.5);
      }
      if (this.stateT > 3.2) { this.state = 'walk'; this.laserT = 9; this.laser = null; }
    }
    this.contactDamage(this.x, GROUND_Y - 20, 16, 16, 0, 0);
  }
  hitTest(x, y, r) { return !this.dying && circleRect(x, y, r, this.rect()); }
  targetPoint() { return { x: this.x, y: GROUND_Y - 45 }; }
  nearGround(x, r) { return Math.abs(this.x - x) < 20 + r; }
  draw(ctx, camX) {
    const x = Math.round(this.x - camX), gy = GROUND_Y, pal = this.pal, fl = this.flash > 0;
    const f = (c) => fl ? mixHex(c, '#ffffff', 0.55) : c;
    const d = this.dir;
    const step = Math.sin(this.walkT * 3);
    const lift = this.state === 'stomp' ? Math.min(1, this.stateT / 0.5) * 14 : 0;
    // pernas
    const legs = [[-9, Math.max(0, step) * 4], [9, Math.max(0, -step) * 4 + lift]];
    for (const [lx, up] of legs) {
      ctx.fillStyle = f(pal.o); ctx.fillRect(x + lx - 6, gy - 30 - up, 12, 30);
      ctx.fillStyle = f(pal.b); ctx.fillRect(x + lx - 5, gy - 29 - up, 10, 28);
      ctx.fillStyle = f(pal.a); ctx.fillRect(x + lx - 5, gy - 29 - up, 3, 28);
      ctx.fillStyle = f(pal.o); ctx.fillRect(x + lx - 8, gy - 6 - up, 16, 6);
      ctx.fillStyle = f(pal.c); ctx.fillRect(x + lx - 7, gy - 6 - up, 14, 1);
    }
    // tronco
    const ty = gy - 70 + Math.abs(step) * 2;
    ctx.fillStyle = f(pal.o); ctx.fillRect(x - 20, ty, 40, 42);
    ctx.fillStyle = f(pal.a); ctx.fillRect(x - 19, ty + 1, 38, 40);
    ctx.fillStyle = f(pal.c); ctx.fillRect(x - 19, ty + 1, 38, 2);
    ctx.fillStyle = f(pal.b); ctx.fillRect(x - 19, ty + 28, 38, 13);
    // placas e rachaduras incandescentes
    ctx.fillStyle = f(pal.b);
    ctx.fillRect(x - 12, ty + 8, 1, 14); ctx.fillRect(x + 8, ty + 6, 1, 18);
    ctx.fillStyle = pal.e;
    ctx.fillRect(x - 4, ty + 14, 8, 2); ctx.fillRect(x - 1, ty + 10, 2, 10);
    Glow.draw(ctx, x, ty + 15, 14, pal.e, 0.4 + Math.sin(this.t * 3) * 0.15);
    // braço canhão
    const ax = x + d * 18, ay = ty + 10;
    ctx.fillStyle = f(pal.o); ctx.fillRect(ax - 6, ay - 2, 12, 22);
    ctx.fillStyle = f(pal.b); ctx.fillRect(ax - 5, ay - 1, 10, 20);
    ctx.fillStyle = f('#2a1a1a'); ctx.fillRect(ax + d * 2 - 2, ay - 6, 5, 6);
    Glow.draw(ctx, ax + d * 2, ay - 6, 6, '#ff8a3c', 0.5);
    // cabeça
    const hx = x + d * 4, hy = ty - 12;
    ctx.fillStyle = f(pal.o); ctx.fillRect(hx - 10, hy, 20, 14);
    ctx.fillStyle = f(pal.a); ctx.fillRect(hx - 9, hy + 1, 18, 12);
    ctx.fillStyle = f(pal.c);
    ctx.fillRect(hx - 12, hy - 5, 4, 7); ctx.fillRect(hx + 8, hy - 5, 4, 7);
    const eyeC = this.state === 'laser' ? '#ffffff' : pal.e;
    ctx.fillStyle = eyeC; ctx.fillRect(hx + d * 3 - 3, hy + 5, 6, 3);
    Glow.draw(ctx, hx + d * 3, hy + 6, this.state === 'laser' ? 22 : 10, this.state === 'laser' ? '#ff4d4d' : pal.e, 0.8);
    // laser
    if (this.laser) {
      const ex = this.x + d * 7, ey = GROUND_Y - 64 + Math.abs(step) * 2;
      this.drawLaser(ctx, camX, ex, ey, this.laser.x, GROUND_Y, this.stateT < 1, '#ff4d4d');
    }
    if (this.state === 'stomp') drawText(ctx, '!', x, gy - 96 - Math.sin(this.t * 20) * 2, '#ff4d4d', 2, 'center');
  }
}

// ------------------------------------------------------------
//  Soberano do Vazio (chefe final)
// ------------------------------------------------------------
class SovereignBoss extends Boss {
  constructor(m) {
    super(m, 'sovereign');
    this.x = m.drill.x; this.y = -60; this.targetY = 80;
    this.phase = 1; this.ringT = 3; this.portalT = 6; this.laserT = 7; this.state = 'enter'; this.stateT = 0;
    this.shards = [];
    this.spawnShards(6);
    this.respawned = false; this.laser = null; this.portals = [];
    this.laserColor = '#ff3df0';
  }
  spawnShards(n) {
    for (let i = 0; i < n; i++) this.shards.push({ a: i / n * TAU, hp: 110 * this.m.bossHpMul * 0.5, max: 110 * this.m.bossHpMul * 0.5, fireT: 2 + i * 0.5, flash: 0, x: 0, y: 0 });
  }
  center() { return { x: this.x, y: this.y }; }
  damageMul() { return this.shards.length ? 0.35 : 1; }
  update(dt) {
    this.t += dt; this.flash -= dt; this.chill -= dt;
    if (this.dying) { this.updateDying(dt); return; }
    const m = this.m, p = m.player;
    this.stateT += dt;
    const k = this.hp / this.maxHp;
    const newPhase = k < 0.33 ? 3 : k < 0.66 ? 2 : 1;
    if (newPhase !== this.phase) {
      this.phase = newPhase;
      m.announce('FASE ' + newPhase, newPhase === 3 ? 'O Soberano está furioso!' : 'Portais do vazio se abrem!', 'danger');
      Sound.play('roar'); FX.screenFlash('#ff3df0', 0.5);
      if (newPhase === 3 && !this.respawned) { this.respawned = true; this.spawnShards(4); }
    }
    if (this.state === 'enter') {
      this.y = lerp(this.y, this.targetY, dt * 1.5);
      if (this.stateT > 2.5) this.state = 'fight';
    } else {
      const tx = (p.dead ? m.drill.x : lerp(m.drill.x, p.cx, 0.5)) + Math.sin(this.t * 0.4) * 110;
      this.x = lerp(this.x, tx, dt * 0.5);
      this.y = this.targetY + Math.sin(this.t * 0.9) * 14;
      // anel de orbes
      this.ringT -= dt;
      if (this.ringT <= 0) {
        this.ringT = this.phase === 3 ? 2.2 : this.phase === 2 ? 3.6 : 4.8;
        const n = this.phase === 3 ? 16 : 12, off = this.t;
        for (let i = 0; i < n; i++) {
          const a = off + i / n * TAU;
          m.addProj(new Projectile({ x: this.x, y: this.y, vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, team: 'enemy', kind: 'orb', dmg: 11 * this.dmgMul, life: 5, r: 3, color: '#ff3df0' }));
        }
        Sound.play('laser');
      }
      // portais
      if (this.phase >= 2) {
        this.portalT -= dt;
        if (this.portalT <= 0) {
          this.portalT = this.phase === 3 ? 7 : 9;
          const side = Math.random() < 0.5 ? 'left' : 'right';
          const px = m.drill.x + (side === 'left' ? -1 : 1) * rand(170, 260);
          this.portals.push({ x: px, t: 0, spawned: false, side });
          Sound.play('warp', { vol: 0.5 });
        }
        this.laserT -= dt;
        if (this.laserT <= 0 && !this.laser) {
          this.laserT = this.phase === 3 ? 6 : 8;
          const startSide = Math.random() < 0.5 ? -1 : 1;
          this.laser = { t: 0, x: this.x + startSide * 140, to: this.x - startSide * 140 };
          Sound.play('laser');
        }
      }
      if (this.laser) {
        const L = this.laser; L.t += dt;
        if (L.t > 1.1) { L.x = lerp(L.x, L.to, dt * 0.8); this.laserHits(this.x, this.y, L.x, GROUND_Y, dt, 45); }
        if (L.t > 3.6) this.laser = null;
      }
      // orbes teleguiados na fase 3
      if (this.phase === 3 && Math.random() < dt * 0.6 && !p.dead) {
        const a = Math.atan2(p.cy - this.y, p.cx - this.x);
        m.addProj(new Projectile({ x: this.x, y: this.y, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, team: 'enemy', kind: 'orb', dmg: 14 * this.dmgMul, life: 4, r: 4, color: '#ffffff', homing: 1.4 }));
      }
    }
    for (const pt of this.portals) {
      pt.t += dt;
      if (pt.t > 1 && !pt.spawned) {
        pt.spawned = true;
        const types = this.phase === 3 ? ['brute', 'spitter', 'wasp', 'crawler'] : ['crawler', 'spitter', 'wasp'];
        for (let i = 0; i < 3 && m.enemies.length < 16; i++) {
          const ty = choose(types);
          const e = new Enemy(m, ty, pt.side, { x: pt.x + rand(-6, 6), y: ty === 'wasp' ? GROUND_Y - 60 : undefined });
          m.enemies.push(e);
        }
      }
    }
    this.portals = this.portals.filter(pt => pt.t < 3);
    // fragmentos
    const spd = this.phase === 3 ? 1.6 : 1;
    for (const s of this.shards) {
      s.a += dt * spd; s.flash -= dt;
      s.x = this.x + Math.cos(s.a) * 36; s.y = this.y + Math.sin(s.a) * 22;
      s.fireT -= dt;
      if (s.fireT <= 0 && !p.dead && this.state === 'fight') {
        s.fireT = rand(2.5, 4);
        const a = Math.atan2(p.cy - s.y, p.cx - s.x);
        m.addProj(new Projectile({ x: s.x, y: s.y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, team: 'enemy', kind: 'orb', dmg: 9 * this.dmgMul, life: 4, r: 2, color: '#c25cff' }));
      }
    }
  }
  hitTest(x, y, r) {
    if (this.dying) return false;
    for (const s of this.shards) if (dist2(x, y, s.x, s.y) < (6 + r) * (6 + r)) { this._hitShard = s; return true; }
    this._hitShard = null;
    return dist2(x, y, this.x, this.y) < (18 + r) * (18 + r);
  }
  damage(d, x, y, chill) {
    const s = this._hitShard;
    if (s && this.shards.includes(s)) {
      s.hp -= d; s.flash = 0.06;
      FX.text(x, y - 6, Math.round(d), '#e0b8ff', { life: 0.5 });
      if (s.hp <= 0) {
        this.shards.splice(this.shards.indexOf(s), 1);
        FX.explosion(s.x, s.y, 16, ['#ffffff', '#ff3df0', '#8a5aff']);
        Sound.play('explosion', { vol: 0.6 });
        if (!this.shards.length) this.m.toast('Escudo do Soberano destruído!', 1.6);
      }
      this._hitShard = null;
      return;
    }
    super.damage(d, x, y, chill);
  }
  targetPoint() {
    if (this.shards.length) { const s = this.shards[0]; this._turretShard = s; return { x: s.x, y: s.y }; }
    return { x: this.x, y: this.y };
  }
  draw(ctx, camX) {
    const x = this.x - camX, y = this.y, fl = this.flash > 0;
    // portais
    for (const pt of this.portals) {
      const k = Math.min(1, pt.t * 2) * (pt.t > 2.5 ? (3 - pt.t) * 2 : 1);
      const px = pt.x - camX;
      Glow.draw(ctx, px, GROUND_Y - 20, 30 * k, '#ff3df0', 0.7);
      ctx.fillStyle = '#05020a'; ctx.beginPath(); ctx.ellipse(px, GROUND_Y - 20, 7 * k, 18 * k, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ff3df0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(px, GROUND_Y - 20, 8 * k, 19 * k, 0, 0, TAU); ctx.stroke();
    }
    if (this.laser) this.drawLaser(ctx, camX, this.x, this.y, this.laser.x, GROUND_Y, this.laser.t < 1.1, '#ff3df0');
    Glow.draw(ctx, x, y, 60, '#ff3df0', 0.35 + Math.sin(this.t * 2) * 0.1);
    // escudo
    if (this.shards.length) {
      ctx.strokeStyle = rgba('#e0b8ff', 0.35 + Math.sin(this.t * 5) * 0.15); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 24, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(200,150,255,0.08)'; ctx.beginPath(); ctx.arc(x, y, 24, 0, TAU); ctx.fill();
    }
    // núcleo cristalino girando
    ctx.save(); ctx.translate(Math.round(x), Math.round(y));
    for (let L = 0; L < 3; L++) {
      ctx.save(); ctx.rotate(this.t * (0.5 + L * 0.4) * (L % 2 ? -1 : 1));
      const r = 18 - L * 5;
      ctx.fillStyle = (fl ? ['#6a4a8a', '#9a6aca', '#e2acff'] : ['#22103a', '#5a2a8a', '#c25cff'])[L];
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.8, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.8, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ff8af0'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
    // olho
    const p = this.m.player;
    const la = Math.atan2((p.cy || GROUND_Y) - y, (p.cx || x) - this.x);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#05020a'; ctx.fillRect(Math.round(Math.cos(la) * 2) - 1, Math.round(Math.sin(la) * 1) - 1, 2, 2);
    ctx.restore();
    // fragmentos
    for (const s of this.shards) {
      const sx = s.x - camX;
      Glow.draw(ctx, sx, s.y, 10, '#c25cff', 0.6);
      ctx.fillStyle = s.flash > 0 ? '#ffffff' : '#8a5aff';
      ctx.beginPath(); ctx.moveTo(sx, s.y - 6); ctx.lineTo(sx + 4, s.y); ctx.lineTo(sx, s.y + 6); ctx.lineTo(sx - 4, s.y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(sx) - 1, Math.round(s.y) - 3, 1, 3);
    }
  }
}

function makeBoss(m, type, side) {
  switch (type) {
    case 'worm': return new WormBoss(m, side);
    case 'queen': return new QueenBoss(m, side);
    case 'titan': return new TitanBoss(m, side);
    case 'sovereign': return new SovereignBoss(m);
  }
}
