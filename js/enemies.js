'use strict';
// ============================================================
//  Inimigos: terrestres, cuspidores, voadores e bombardeiros
// ============================================================

class Enemy {
  constructor(m, type, side, o = {}) {
    this.m = m; this.type = type; this.def = ENEMIES[type];
    const d = this.def, w = m.world;
    this.pal = w.biome;
    this.air = !!d.air;
    this.w = d.w; this.h = d.h;
    this.maxHp = Math.round(d.hp * m.hpMul * (o.hpMul || 1)); this.hp = this.maxHp;
    this.dmg = d.dmg * m.dmgMul;
    this.speed = d.speed * rand(0.9, 1.12);
    this.dir = side === 'left' ? 1 : -1;
    this.x = o.x ?? (side === 'left' ? -12 : m.width + 12);
    this.alt = this.air ? (d.bomber ? rand(28, 64) : rand(60, 140)) : 0;
    this.y = o.y ?? (this.air ? this.alt : GROUND_Y - this.h / 2);
    this.vx = 0; this.vy = 0; this.kvx = 0;
    this.nativeT = w.temp;
    this.atkT = rand(0, 0.5); this.t = rand(0, 10); this.flash = 0; this.dead = false;
    this.state = 'move'; this.diveCd = rand(0.5, 2); this.chill = 0;
    this.onGround = !this.air; this.pulled = false;
    this.target = null; this.hopT = 0;
    this.statusT = 0;
  }
  rect() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }
  get bottom() { return this.y + this.h / 2; }

  // fatores ambientais (temperatura, gravidade, congelamento)
  envMods() {
    const m = this.m;
    const T = m.tempAt(this.x), diff = Math.abs(T - this.nativeT);
    let slow = 1, dot = 0;
    if (diff > 90) { slow = 0.4; dot = 9; } else if (diff > 45) { slow = 0.62; dot = 3.5; }
    this.thermal = diff > 45 ? (T > this.nativeT ? 'hot' : 'cold') : null;
    const gz = m.gravZoneAt(this.x);
    this.gz = gz;
    if (gz === 'heavy') { slow *= 0.45; if (m.gravCrush) dot += 6; }
    if (gz === 'light' && !this.air) slow *= 0.4;
    if (this.chill > 0) slow *= 0.45;
    return { slow, dot };
  }

  update(dt) {
    const m = this.m;
    this.t += dt; this.flash -= dt; this.atkT += dt; this.diveCd -= dt; this.chill = Math.max(0, this.chill - dt);
    const env = this.envMods();
    if (env.dot) {
      this.statusT += dt;
      if (this.statusT > 0.5) { this.statusT = 0; this.hurt(env.dot * 0.5, { silent: true, color: this.thermal === 'hot' ? '#ffb347' : '#9fe8ff' }); }
      if (Math.random() < 0.15) FX.add({ x: this.x + rand(-4, 4), y: this.y + rand(-4, 4), vy: this.thermal === 'hot' ? -25 : 10, color: this.thermal === 'hot' ? '#ff9a4a' : '#e8fbff', life: 0.4, size: 1 });
    }
    if (this.dead) return;
    this.kvx *= Math.max(0, 1 - 6 * dt);
    if (Math.abs(this.kvx) < 1) this.kvx = 0;

    // gravidade alta puxa voadores ao chão
    if (this.air && this.gz === 'heavy' && !this.pulled) { this.pulled = true; }
    if (this.pulled && this.gz !== 'heavy' && this.air) { this.pulled = false; }

    if (!this.air || this.pulled) this.updateGround(dt, env);
    else if (this.def.bomber) this.updateBomber(dt, env);
    else this.updateFlyer(dt, env);

    this.x = clamp(this.x, -30, m.width + 30);
  }

  // ------ terrestres ------
  updateGround(dt, env) {
    const m = this.m, d = this.def;
    const g = GRAV * m.gravAt(this.x);
    this.vy += g * dt;
    this.y += this.vy * dt;
    if (this.bottom >= GROUND_Y) {
      this.y = GROUND_Y - this.h / 2; this.vy = 0; this.onGround = true;
      if (this.gz === 'light' && !this.pulled) { this.vy = -rand(70, 130); this.onGround = false; }
    } else this.onGround = false;

    const drill = m.drill;
    this.dir = drill.x > this.x ? 1 : -1;
    const front = this.x + this.dir * this.w / 2;
    let blocker = null, bdist = 1e9;
    for (const b of m.buildings) {
      if (b.dead || !b.def.solid) continue;
      const r = b.rect();
      const near = this.dir > 0 ? r.x : r.x + r.w;
      const between = this.dir > 0 ? (front >= near - 1 && this.x < r.x + r.w) : (front <= near + 1 && this.x > r.x);
      if (between && this.bottom > r.y) { const dd = Math.abs(this.x - b.x); if (dd < bdist) { bdist = dd; blocker = b; } }
    }
    const dr = drill.rect();
    const dnear = this.dir > 0 ? dr.x : dr.x + dr.w;
    if ((this.dir > 0 ? front >= dnear - 1 && this.x < dr.x + dr.w : front <= dnear + 1 && this.x > dr.x)) {
      const dd = Math.abs(this.x - drill.x); if (dd < bdist) { bdist = dd; blocker = drill; }
    }
    const p = m.player;
    const playerClose = !p.dead && Math.abs(p.cx - this.x) < this.w / 2 + 7 && p.y + p.h > this.y - this.h / 2 - 2 && p.y < this.bottom;

    // cuspidor: atira à distância
    if (d.ranged) {
      let tgt = null, td = d.range;
      if (!p.dead && sign(p.cx - this.x) === this.dir && Math.abs(p.cx - this.x) < td) { tgt = { x: p.cx, y: p.cy }; td = Math.abs(p.cx - this.x); }
      for (const b of m.buildings) {
        if (b.dead || !b.def.solid) continue;
        const dd = (b.x - this.x) * this.dir;
        if (dd > 0 && dd < td) { tgt = { x: b.x, y: b.cy }; td = dd; }
      }
      const ddr = (drill.x - this.x) * this.dir;
      if (ddr > 0 && ddr - 20 < td) { tgt = { x: drill.x, y: drill.cy }; td = ddr; }
      if (tgt && td < d.range) {
        this.state = 'attack';
        if (this.atkT >= 1 / d.atkRate) {
          this.atkT = 0;
          const T = 0.9, sx = this.x + this.dir * 5, sy = this.y - 3;
          const gg = GRAV * m.gravAt(this.x);
          const vx = (tgt.x - sx) / T, vy = (tgt.y - sy - 0.5 * gg * T * T) / T;
          m.addProj(new Projectile({ x: sx, y: sy, vx, vy, team: 'enemy', kind: 'acid', dmg: this.dmg, life: 3, r: 2, color: ENEMY_PALETTES[this.pal].e, gravity: 1 }));
          Sound.play('hit', { vol: 0.5, gap: 80 });
        }
        this.x += this.kvx * dt;
        return;
      }
    }

    if (playerClose) {
      this.state = 'attack';
      if (this.atkT >= 1 / d.atkRate) { this.atkT = 0; p.hurt(this.dmg, this.x); this.lunge = 0.15; }
    } else if (blocker) {
      this.state = 'attack';
      if (this.atkT >= 1 / d.atkRate) {
        this.atkT = 0; this.lunge = 0.15;
        const dm = this.dmg * (d.bldMul || 1);
        if (blocker === drill) m.damageDrill(dm); else blocker.damage(dm);
        FX.burst(front, this.y, 3, { color: ['#ffe14d', '#ffffff'], speed: 60, type: 'spark', life: 0.2 });
        Sound.play('hit', { vol: 0.4, gap: 60 });
      }
    } else {
      this.state = 'move';
      if (this.onGround || this.gz === 'light') this.x += this.dir * this.speed * env.slow * dt;
    }
    this.x += this.kvx * dt;
    if (this.lunge) this.lunge = Math.max(0, this.lunge - dt);
  }

  // ------ vespas ------
  updateFlyer(dt, env) {
    const m = this.m, d = this.def, p = m.player, drill = m.drill;
    const sp = this.speed * env.slow;
    // teto bloqueia
    let ceil = null;
    for (const b of m.buildings) {
      if (b.dead || b.type !== 'ceiling') continue;
      if (rectsOverlap(this.rect(), b.fieldRect())) { ceil = b; break; }
    }
    if (ceil && this.state !== 'retreat') {
      this.state = 'blocked';
      this.x -= this.dir * 8 * dt;
      this.y += Math.sin(this.t * 6) * 10 * dt;
      if (this.atkT >= 1 / d.atkRate) {
        this.atkT = 0; ceil.damage(this.dmg);
        FX.burst(this.x + this.dir * 5, this.y, 4, { color: ['#a0f0ff', '#ffffff'], speed: 60, type: 'spark', life: 0.25 });
        Sound.play('hit', { vol: 0.3, gap: 60 });
      }
      return;
    }
    if (this.state === 'blocked') this.state = 'move';

    let tgt = drill, tx = drill.x, ty = drill.cy;
    if (!p.dead && dist(p.cx, p.cy, this.x, this.y) < 110) { tgt = p; tx = p.cx; ty = p.cy; }
    if (this.state === 'move') {
      this.dir = tx > this.x ? 1 : -1;
      this.x += this.dir * sp * dt;
      this.y = lerp(this.y, this.alt + Math.sin(this.t * 3) * 8, Math.min(1, dt * 2));
      if (Math.abs(tx - this.x) < 80 && this.diveCd <= 0) { this.state = 'dive'; this.diveT = 0; }
    } else if (this.state === 'dive') {
      this.diveT += dt;
      const a = Math.atan2(ty - this.y, tx - this.x);
      this.x += Math.cos(a) * sp * 2.2 * dt; this.y += Math.sin(a) * sp * 2.2 * dt;
      this.dir = Math.cos(a) > 0 ? 1 : -1;
      const hitR = tgt === p ? p.rect() : drill.rect();
      if (rectsOverlap(this.rect(), hitR)) {
        if (tgt === p) p.hurt(this.dmg, this.x); else m.damageDrill(this.dmg);
        this.state = 'retreat'; this.retreatT = 0.7; this.diveCd = rand(1.2, 2.2);
      }
      if (this.diveT > 2.5 || this.y > GROUND_Y - 4) { this.state = 'retreat'; this.retreatT = 0.6; this.diveCd = 1; }
    } else if (this.state === 'retreat') {
      this.retreatT -= dt;
      this.y -= sp * 1.4 * dt; this.x -= this.dir * sp * 0.5 * dt;
      if (this.retreatT <= 0 || this.y < this.alt) this.state = 'move';
    }
    this.x += this.kvx * dt;
  }

  // ------ bombardeiros ------
  updateBomber(dt, env) {
    const m = this.m, d = this.def, drill = m.drill;
    const sp = this.speed * env.slow;
    let ceil = null;
    for (const b of m.buildings) {
      if (b.dead || b.type !== 'ceiling') continue;
      if (rectsOverlap(this.rect(), b.fieldRect())) { ceil = b; break; }
    }
    this.y = lerp(this.y, this.alt + Math.sin(this.t * 1.5) * 4, Math.min(1, dt));
    if (ceil) {
      this.x -= this.dir * 5 * dt;
      if (this.atkT >= 1 / d.atkRate) { this.atkT = 0; this.dropBomb(); }
      return;
    }
    const dx = drill.x - this.x;
    if (Math.abs(dx) > 26) { this.dir = sign(dx); this.x += this.dir * sp * dt; }
    else { this.x += Math.sin(this.t * 0.8) * sp * 0.6 * dt; }
    // solta bombas sobre alvos
    if (this.atkT >= 1 / d.atkRate) {
      const p = m.player;
      let over = Math.abs(dx) < 30 || (!p.dead && Math.abs(p.cx - this.x) < 12);
      if (!over) for (const b of m.buildings) if (!b.dead && b.def.solid && Math.abs(b.x - this.x) < 10) { over = true; break; }
      if (over) { this.atkT = 0; this.dropBomb(); }
    }
    this.x += this.kvx * dt;
  }
  dropBomb() {
    this.m.addProj(new Projectile({ x: this.x, y: this.y + 6, vx: this.dir * 10, vy: 20, team: 'enemy', kind: 'bomb', dmg: this.dmg, aoe: 22, life: 6, r: 3, color: ENEMY_PALETTES[this.pal].e, gravity: 0.6 }));
  }

  hurt(dmg, o = {}) {
    if (this.dead) return;
    this.hp -= dmg;
    if (!o.silent) this.flash = 0.08;
    if (o.knock && !this.def.heavy) this.kvx += o.dirX * o.knock;
    else if (o.knock) this.kvx += o.dirX * o.knock * 0.25;
    if (o.chill) this.chill = 1.2;
    if (o.crit) FX.text(this.x, this.y - this.h / 2 - 2, Math.round(dmg) + '!', '#ff5af0', { life: 0.8, vy: -50 });
    else if (o.color || dmg >= 1) FX.text(this.x, this.y - this.h / 2 - 2, Math.round(dmg) || '', o.color || (dmg >= 40 ? '#ffcf5a' : '#ffffff'), { life: 0.6, vy: -40 });
    if (this.hp <= 0) this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    const m = this.m, pal = ENEMY_PALETTES[this.pal];
    FX.burst(this.x, this.y, 14 + this.w, { color: [pal.a, pal.b, pal.c], speed: 110, grav: 380, life: 0.9, size: 2, bounce: true, drag: 1 });
    FX.burst(this.x, this.y, 6, { color: [pal.e], speed: 60, life: 0.4, glow: true });
    FX.add({ x: this.x, y: this.y, type: 'flashball', size: this.w * 0.8, life: 0.12, color: pal.c });
    FX.addShake(this.def.heavy || this.def.bomber ? 3 : 1);
    Sound.play('enemyDie');
    m.onEnemyKilled(this);
  }

  draw(ctx, camX) {
    const x = this.x - camX;
    if (x < -40 || x > W + 40) return;
    const d = this.def;
    const frames = d.sprite;
    const moving = this.state === 'move';
    let fi = 0;
    if (frames.length > 1) fi = Math.floor(this.t * (moving ? 8 : 3)) % frames.length;
    const img = enemySprite(frames[fi], this.pal);
    const flip = this.dir < 0;
    let ox = 0;
    if (this.lunge) ox = this.dir * 2;
    const sx = x - img.width / 2 + ox, sy = this.y + this.h / 2 - img.height + (this.air && !this.pulled ? 3 : 0);
    // sombra
    if (!this.air || this.pulled) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(Math.round(x - this.w / 2), GROUND_Y, this.w, 1); }
    else {
      const k = clamp(1 - (GROUND_Y - this.y) / 220, 0.15, 0.6);
      ctx.fillStyle = `rgba(0,0,0,${k * 0.5})`; ctx.fillRect(Math.round(x - this.w * k / 2), GROUND_Y, Math.round(this.w * k), 1);
    }
    // asas da vespa
    if (this.type === 'wasp') {
      const flap = Math.sin(this.t * 40);
      ctx.fillStyle = rgba(ENEMY_PALETTES[this.pal].c, 0.55);
      ctx.beginPath(); ctx.ellipse(x - this.dir * 1, this.y - 5 - flap * 2, 5, 2 + Math.abs(flap) * 2, flip ? 0.5 : -0.5, 0, TAU); ctx.fill();
    }
    drawSprite(ctx, img, sx, sy, flip, this.flash > 0);
    if (this.type === 'bomber') {
      const p = 0.5 + Math.sin(this.t * 4) * 0.3;
      Glow.draw(ctx, x, this.y + 2, 10, ENEMY_PALETTES[this.pal].e, 0.3 * p);
    }
    Glow.draw(ctx, x + this.dir * (this.w / 2 - 2), this.y - 1, 4, ENEMY_PALETTES[this.pal].e, 0.35);
    // status
    if (this.chill > 0) { ctx.fillStyle = 'rgba(200,248,255,0.45)'; ctx.fillRect(Math.round(sx), Math.round(sy), img.width, img.height); }
    if (this.thermal === 'hot') Glow.draw(ctx, x, this.y, 10, '#ff6a2a', 0.25);
    if (this.thermal === 'cold') Glow.draw(ctx, x, this.y, 10, '#9fe8ff', 0.25);
    // vida
    if (this.hp < this.maxHp) {
      const w = Math.max(8, this.w), k = this.hp / this.maxHp;
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(Math.round(x - w / 2), Math.round(this.y - this.h / 2 - 4), w, 2);
      ctx.fillStyle = '#ff4d4d'; ctx.fillRect(Math.round(x - w / 2), Math.round(this.y - this.h / 2 - 4), Math.round(w * k), 1);
    }
  }
}
