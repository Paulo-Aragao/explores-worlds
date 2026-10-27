'use strict';
// ============================================================
//  Construções, Broca extratora e Depósitos exploráveis
// ============================================================

const CANOPY_H = 56;

class Building {
  constructor(m, type, x) {
    this.m = m; this.type = type; this.def = BUILDINGS[type];
    this.x = x; this.t = rand(0, 5); this.flash = 0; this.dead = false; this.buildT = 0;
    let hpMul = 1;
    if (type === 'wall' || type === 'ceiling') hpMul += 0.5 * Save.lvl('wall_mk');
    this.maxHp = Math.round(this.def.hp * hpMul); this.hp = this.maxHp;
    if (type === 'turret') {
      const l = Save.lvl('turret_mk');
      this.dmg = this.def.dmg * (1 + 0.35 * l); this.range = this.def.range * (1 + 0.15 * l);
      this.cd = 0; this.aim = -Math.PI / 2; this.level = l;
    }
    if (type === 'mine') {
      const k = Save.lvl('mine_mk') ? 1.4 : 1;
      this.radius = this.def.radius * k; this.dmg = this.def.dmg * k;
      this.armT = 0; this.fuse = -1;
    }
    if (type === 'heater' || type === 'cooler') {
      const k = Save.lvl('thermo_mk') ? 1 : 0;
      this.radius = this.def.radius * (1 + 0.25 * k); this.delta = this.def.delta * (1 + 0.4 * k);
    }
    if (type === 'gravity') { this.radius = this.def.radius * (Save.lvl('grav_mk') ? 1.3 : 1); this.mode = 'heavy'; }
    this.spent = buildCost(type);
    this.regen = 0.01 * Save.lvl('auto_repair');
    this.rateMul = 1 + 0.25 * Save.lvl('turret_rate');
  }
  get canopyY() { return GROUND_Y - CANOPY_H; }
  rect() {
    if (this.type === 'ceiling') return { x: this.x - 2, y: this.canopyY, w: 4, h: CANOPY_H };
    return { x: this.x - this.def.w / 2, y: GROUND_Y - this.def.h, w: this.def.w, h: this.def.h };
  }
  fieldRect() { return { x: this.x - 24, y: 8, w: 48, h: this.canopyY + 4 - 8 }; }
  get cy() { return this.type === 'ceiling' ? this.canopyY : GROUND_Y - this.def.h / 2; }

  damage(d) {
    if (this.dead) return;
    this.hp -= d; this.flash = 0.12;
    if (this.type === 'mine' && this.fuse < 0) { this.fuse = 0.15; }
    if (this.hp <= 0) this.destroy();
  }
  repair(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }
  destroy(silent = false) {
    if (this.dead) return;
    this.dead = true;
    if (this.type === 'mine') { this.detonate(); return; }
    if (!silent) {
      FX.explosion(this.x, this.cy, 16, ['#ffffff', '#ffb347', '#ff6a2a', '#555566']);
      FX.burst(this.x, this.cy, 14, { color: ['#5a6378', '#9aa6bf', '#2a2f45'], speed: 120, grav: 400, bounce: true, life: 1.4, size: 2 });
      Sound.play('explosion', { vol: 0.6 });
      this.m.toast(this.def.name + ' destruída!', 1.2, 'danger');
    }
  }

  detonate() {
    this.dead = true;
    const m = this.m;
    m.explode(this.x, GROUND_Y - 4, this.radius, this.dmg, { hurtsEnemies: true, hurtsPlayer: true, playerMul: 0.45, hurtsBuildings: false, big: true });
    // reação em cadeia
    for (const b of m.buildings) {
      if (b !== this && !b.dead && b.type === 'mine' && Math.abs(b.x - this.x) < this.radius && b.fuse < 0) b.fuse = 0.18;
    }
  }

  update(dt) {
    const m = this.m;
    this.t += dt; this.flash -= dt; this.buildT = Math.min(1, this.buildT + dt * 2.5);
    if (this.regen && this.hp < this.maxHp && this.type !== 'mine') this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.regen * dt);
    switch (this.type) {
      case 'turret': {
        this.cd -= dt;
        const tgt = m.nearestEnemy(this.x, GROUND_Y - 22, this.range);
        if (tgt) {
          const ta = Math.atan2(tgt.y - (GROUND_Y - 22), tgt.x - this.x);
          this.aim = angleLerp(this.aim, ta, Math.min(1, dt * 10));
          if (this.cd <= 0 && Math.abs(angleLerp(0, ta - this.aim, 1)) < 0.25) {
            this.cd = 1 / (this.def.rate * this.rateMul);
            const bx = this.x + Math.cos(this.aim) * 10, by = GROUND_Y - 22 + Math.sin(this.aim) * 10;
            m.addProj(new Projectile({ x: bx, y: by, vx: Math.cos(this.aim) * 400, vy: Math.sin(this.aim) * 400, team: 'player', kind: 'bullet', dmg: this.dmg, life: 0.7, r: 1, color: '#ffe14d', knock: 8 }));
            FX.add({ x: bx, y: by, type: 'flashball', size: 4, life: 0.05, color: '#ffe14d' });
            Sound.play('turret', { gap: 60 });
          }
        } else this.aim = angleLerp(this.aim, -Math.PI / 2 + Math.sin(this.t * 0.8) * 0.9, dt * 2);
        break;
      }
      case 'mine': {
        if (this.armT < 1) { this.armT += dt; break; }
        if (this.fuse < 0) {
          for (const e of m.enemies) {
            if (e.dead) continue;
            if (Math.abs(e.x - this.x) < 16 && e.y > GROUND_Y - 30) { this.fuse = 0.35; Sound.play('mine'); break; }
          }
          if (this.fuse < 0 && m.boss && !m.boss.dead && m.boss.nearGround && m.boss.nearGround(this.x, 22)) { this.fuse = 0.3; Sound.play('mine'); }
        } else {
          this.fuse -= dt;
          if (Math.floor(this.fuse * 20) % 2 === 0) Sound.play('mine', { gap: 50 });
          if (this.fuse <= 0) this.detonate();
        }
        break;
      }
      case 'heater': case 'cooler': {
        if (Math.random() < 0.35) {
          const hot = this.type === 'heater';
          FX.add({
            x: this.x + rand(-this.radius, this.radius), y: rand(GROUND_Y - 120, GROUND_Y),
            vx: rand(-4, 4), vy: hot ? rand(-30, -12) : rand(6, 18),
            color: hot ? choose(['#ff9a4a', '#ffcf5a']) : choose(['#e8fbff', '#9fe8ff']), life: 1.2, size: 1,
          });
        }
        break;
      }
      case 'gravity': {
        if (Math.random() < 0.4) {
          const heavy = this.mode === 'heavy';
          FX.add({
            x: this.x + rand(-this.radius, this.radius), y: heavy ? rand(30, GROUND_Y - 60) : rand(GROUND_Y - 80, GROUND_Y),
            vx: 0, vy: heavy ? rand(60, 120) : rand(-40, -15), color: heavy ? '#b07cff' : '#e0c8ff', life: 0.9, size: 1,
          });
        }
        break;
      }
    }
  }

  drawZone(ctx, camX) {
    if (!(this.type === 'heater' || this.type === 'cooler' || this.type === 'gravity')) return;
    const r = this.radius, x0 = Math.round(this.x - r - camX), w = Math.round(r * 2);
    let col;
    if (this.type === 'heater') col = '#ff7a2a';
    else if (this.type === 'cooler') col = '#4ad8ff';
    else col = this.mode === 'heavy' ? '#9a5aff' : '#e0b8ff';
    const g = ctx.createLinearGradient(0, 20, 0, GROUND_Y);
    g.addColorStop(0, rgba(col, 0)); g.addColorStop(1, rgba(col, 0.16 + Math.sin(this.t * 2) * 0.03));
    ctx.fillStyle = g; ctx.fillRect(x0, 20, w, GROUND_Y - 20);
    ctx.fillStyle = rgba(col, 0.35);
    for (let y = 30 + Math.floor((this.t * 20) % 8); y < GROUND_Y; y += 8) { ctx.fillRect(x0, y, 1, 3); ctx.fillRect(x0 + w - 1, y, 1, 3); }
    if (this.type === 'gravity') {
      ctx.fillStyle = rgba(col, 0.25);
      const dir = this.mode === 'heavy' ? 1 : -1;
      for (let i = 0; i < 6; i++) {
        const yy = ((this.t * 40 * dir + i * 30) % 180 + 180) % 180;
        ctx.fillRect(x0 + 2, Math.round(GROUND_Y - 180 + yy), w - 4, 1);
      }
    }
  }

  draw(ctx, camX) {
    const bx = Math.round(this.x - camX), gy = GROUND_Y;
    if (bx < -40 || bx > W + 40) return;
    const flash = this.flash > 0;
    const rise = Math.round((1 - easeOutCubic(this.buildT)) * (this.def.h || 20));
    ctx.save();
    if (rise > 0) { ctx.beginPath(); ctx.rect(bx - 40, 0, 80, gy); ctx.clip(); ctx.translate(0, rise); }
    switch (this.type) {
      case 'wall': this.drawWall(ctx, bx, gy); break;
      case 'turret': this.drawTurret(ctx, bx, gy); break;
      case 'mine': this.drawMine(ctx, bx, gy); break;
      case 'heater': this.drawThermo(ctx, bx, gy, true); break;
      case 'cooler': this.drawThermo(ctx, bx, gy, false); break;
      case 'gravity': this.drawGravity(ctx, bx, gy); break;
      case 'ceiling': this.drawCeiling(ctx, bx, gy); break;
    }
    if (flash) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6;
      const r = this.type === 'ceiling' ? { x: this.x - 24, y: this.canopyY - 2, w: 48, h: 8 } : this.rect();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(r.x - camX), r.y, r.w, r.h);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    // barra de vida
    if (this.hp < this.maxHp && this.type !== 'mine') {
      const r = this.type === 'ceiling' ? { y: this.canopyY - 6 } : { y: GROUND_Y - this.def.h - 5 };
      const w = 14, k = this.hp / this.maxHp;
      ctx.fillStyle = '#000'; ctx.fillRect(bx - w / 2 - 1, r.y - 1, w + 2, 3);
      ctx.fillStyle = k > 0.5 ? '#6fdc5a' : k > 0.25 ? '#ffcf5a' : '#ff4d4d';
      ctx.fillRect(bx - w / 2, r.y, Math.round(w * k), 1);
    }
    // dano: fumaça
    if (this.hp < this.maxHp * 0.35 && Math.random() < 0.15 && this.type !== 'mine') {
      FX.add({ x: this.x + rand(-5, 5), y: this.cy - 5, vy: -20, vx: rand(-5, 5), color: '#444455', type: 'smoke', size: 3, life: 1 });
    }
  }

  drawWall(ctx, bx, gy) {
    const h = 28, x = bx - 8, y = gy - h;
    ctx.fillStyle = '#151824'; ctx.fillRect(x, y, 16, h);
    ctx.fillStyle = '#5a6378'; ctx.fillRect(x + 1, y + 1, 14, h - 2);
    ctx.fillStyle = '#7b86a0'; ctx.fillRect(x + 1, y + 1, 14, 1); ctx.fillRect(x + 1, y + 1, 1, h - 6);
    ctx.fillStyle = '#3a4152';
    for (let s = 9; s < h - 4; s += 8) ctx.fillRect(x + 1, y + s, 14, 1);
    ctx.fillRect(x + 14, y + 2, 1, h - 6);
    ctx.fillStyle = '#a9b8c8';
    [[2, 3], [12, 3], [2, 11], [12, 11], [2, 19], [12, 19]].forEach(([i, j]) => ctx.fillRect(x + i, y + j, 1, 1));
    for (let i = 0; i < 14; i++) {
      for (let j = 0; j < 4; j++) {
        ctx.fillStyle = ((i + j) % 4 < 2) ? '#e0b030' : '#1c1f2b';
        ctx.fillRect(x + 1 + i, gy - 5 + j, 1, 1);
      }
    }
    const k = this.hp / this.maxHp;
    if (k < 0.6) { ctx.fillStyle = '#1c1f2b'; ctx.fillRect(x + 5, y + 4, 1, 4); ctx.fillRect(x + 6, y + 8, 1, 3); ctx.fillRect(x + 5, y + 11, 1, 2); }
    if (k < 0.3) { ctx.fillStyle = '#1c1f2b'; ctx.fillRect(x + 10, y + 14, 1, 5); ctx.fillRect(x + 9, y + 18, 1, 3); }
  }

  drawTurret(ctx, bx, gy) {
    // base
    ctx.fillStyle = '#151824'; ctx.fillRect(bx - 8, gy - 8, 16, 8); ctx.fillRect(bx - 3, gy - 20, 6, 13);
    ctx.fillStyle = '#4b5674'; ctx.fillRect(bx - 7, gy - 7, 14, 6);
    ctx.fillStyle = '#6b7690'; ctx.fillRect(bx - 7, gy - 7, 14, 1);
    ctx.fillStyle = '#3a4152'; ctx.fillRect(bx - 2, gy - 19, 4, 12);
    ctx.fillStyle = '#e0b030'; ctx.fillRect(bx - 6, gy - 3, 2, 2); ctx.fillRect(bx + 4, gy - 3, 2, 2);
    // cabeça giratória
    const hx = bx, hy = gy - 22;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(this.aim);
    ctx.fillStyle = '#151824'; ctx.fillRect(-5, -4, 10, 8); ctx.fillRect(3, -2, 9, 4);
    ctx.fillStyle = this.level >= 2 ? '#8a5ad6' : this.level >= 1 ? '#5a8a6a' : '#7b86a0';
    ctx.fillRect(-4, -3, 8, 6);
    ctx.fillStyle = '#a9b8c8'; ctx.fillRect(4, -1, 7, 2);
    ctx.fillStyle = shade(ctx.fillStyle, 0.3); ctx.fillRect(-4, -3, 8, 1);
    ctx.restore();
    const has = this.m.nearestEnemy(this.x, GROUND_Y - 22, this.range);
    ctx.fillStyle = has ? '#ff4d4d' : '#6fdc5a'; ctx.fillRect(hx - 1, hy - 1, 2, 2);
    Glow.draw(ctx, hx, hy, 6, has ? '#ff4d4d' : '#6fdc5a', 0.4);
  }

  drawMine(ctx, bx, gy) {
    ctx.fillStyle = '#151824'; ctx.fillRect(bx - 6, gy - 4, 12, 4);
    ctx.fillStyle = '#4b4a3a'; ctx.fillRect(bx - 5, gy - 3, 10, 2);
    ctx.fillStyle = '#7a7860'; ctx.fillRect(bx - 5, gy - 3, 10, 1);
    ctx.fillStyle = '#2a2a20'; ctx.fillRect(bx - 1, gy - 5, 2, 1);
    let col = '#ffcf5a';
    if (this.armT >= 1) col = this.fuse >= 0 ? (Math.floor(this.fuse * 20) % 2 ? '#ffffff' : '#ff2a2a') : (Math.floor(this.t * 2) % 2 ? '#ff4d4d' : '#5a1010');
    ctx.fillStyle = col; ctx.fillRect(bx - 1, gy - 6, 2, 1);
    Glow.draw(ctx, bx, gy - 6, this.fuse >= 0 ? 12 : 5, col === '#5a1010' ? '#ff4d4d' : col, this.fuse >= 0 ? 0.8 : 0.35);
  }

  drawThermo(ctx, bx, gy, hot) {
    const x = bx - 8, y = gy - 24;
    const accent = hot ? '#ff7a2a' : '#4ad8ff';
    ctx.fillStyle = '#151824'; ctx.fillRect(x, y, 16, 24);
    ctx.fillStyle = hot ? '#5a3a2e' : '#2e4a5a'; ctx.fillRect(x + 1, y + 1, 14, 22);
    ctx.fillStyle = hot ? '#7a5242' : '#466a7e'; ctx.fillRect(x + 1, y + 1, 14, 1);
    ctx.fillStyle = '#151824'; ctx.fillRect(x + 2, y + 4, 12, 12);
    if (hot) {
      const pulse = 0.7 + Math.sin(this.t * 4) * 0.3;
      for (let j = 0; j < 5; j++) { ctx.fillStyle = mixHex('#7a1e1e', '#ffcf5a', pulse * (j % 2 ? 0.7 : 1)); ctx.fillRect(x + 3, y + 5 + j * 2, 10, 1); }
      Glow.draw(ctx, bx, y + 10, 14, '#ff7a2a', 0.5 * pulse);
    } else {
      ctx.fillStyle = '#9fe8ff'; ctx.beginPath(); ctx.arc(bx, y + 10, 5, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(bx, y + 10); ctx.rotate(this.t * 12);
      ctx.fillStyle = '#2e4a5a'; for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.fillRect(0, -1, 5, 2); }
      ctx.restore();
      ctx.fillStyle = '#e8fbff'; ctx.fillRect(bx - 1, y + 9, 2, 2);
      Glow.draw(ctx, bx, y + 10, 14, '#4ad8ff', 0.4);
    }
    ctx.fillStyle = accent; ctx.fillRect(x + 3, y + 18, 3, 2); ctx.fillRect(x + 10, y + 18, 3, 2);
    ctx.fillStyle = '#e0b030'; ctx.fillRect(x + 1, gy - 2, 14, 1);
  }

  drawGravity(ctx, bx, gy) {
    const top = gy - 34;
    ctx.fillStyle = '#151824';
    ctx.beginPath(); ctx.moveTo(bx - 8, gy); ctx.lineTo(bx - 3, top + 8); ctx.lineTo(bx + 3, top + 8); ctx.lineTo(bx + 8, gy); ctx.fill();
    ctx.fillStyle = '#3a2a5a';
    ctx.beginPath(); ctx.moveTo(bx - 6, gy - 1); ctx.lineTo(bx - 2, top + 10); ctx.lineTo(bx + 2, top + 10); ctx.lineTo(bx + 6, gy - 1); ctx.fill();
    ctx.fillStyle = '#5a4a8a'; ctx.fillRect(bx - 2, top + 10, 1, 22);
    ctx.fillStyle = '#b07cff';
    for (let j = 0; j < 3; j++) ctx.fillRect(bx - 1, gy - 8 - j * 7, 2, 2);
    const heavy = this.mode === 'heavy';
    const col = heavy ? '#9a5aff' : '#f0d8ff';
    const pulse = 0.7 + Math.sin(this.t * (heavy ? 3 : 6)) * 0.3;
    Glow.draw(ctx, bx, top + 4, 16, col, 0.7 * pulse);
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(bx, top + 4, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 1, top + 2, 2, 2);
    ctx.strokeStyle = rgba(col, 0.8); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(bx, top + 4, 8, 3, 0, this.t * 2, this.t * 2 + Math.PI * 1.3); ctx.stroke();
    drawText(ctx, heavy ? 'ALTA' : 'BAIXA', bx, gy + 4, col, 1, 'center');
  }

  drawCeiling(ctx, bx, gy) {
    const cy = this.canopyY;
    // campo de energia
    const hitGlow = this.flash > 0 ? 0.25 : 0;
    const fr = this.fieldRect();
    const fx = Math.round(fr.x - this.m.camX);
    const g = ctx.createLinearGradient(0, fr.y, 0, cy);
    g.addColorStop(0, 'rgba(120,220,255,0)'); g.addColorStop(1, `rgba(120,220,255,${0.13 + hitGlow})`);
    ctx.fillStyle = g; ctx.fillRect(fx, fr.y, 48, cy - fr.y);
    ctx.fillStyle = `rgba(160,240,255,${0.25 + hitGlow})`;
    for (let y = cy - 4; y > fr.y + 20; y -= 6) {
      const off = (Math.floor(y / 6) % 2) * 3;
      for (let i = off; i < 48; i += 6) ctx.fillRect(fx + i, y, 2, 1);
    }
    ctx.fillStyle = `rgba(160,240,255,${0.5 + hitGlow})`;
    ctx.fillRect(fx, Math.round(fr.y + 20 + ((this.t * 30) % (cy - fr.y - 20))), 48, 1);
    // poste
    ctx.fillStyle = '#151824'; ctx.fillRect(bx - 2, cy, 4, gy - cy);
    ctx.fillStyle = '#5a6378'; ctx.fillRect(bx - 1, cy, 2, gy - cy);
    ctx.fillStyle = '#151824'; ctx.fillRect(bx - 5, gy - 4, 10, 4);
    // cobertura
    ctx.fillStyle = '#151824'; ctx.fillRect(bx - 24, cy - 1, 48, 6);
    ctx.fillStyle = '#5a6378'; ctx.fillRect(bx - 23, cy, 46, 4);
    ctx.fillStyle = '#7b86a0'; ctx.fillRect(bx - 23, cy, 46, 1);
    for (let i = 0; i < 46; i += 4) { ctx.fillStyle = (i / 4) % 2 ? '#e0b030' : '#1c1f2b'; ctx.fillRect(bx - 23 + i, cy + 3, 4, 1); }
    ctx.fillStyle = '#4ad8ff'; ctx.fillRect(bx - 23, cy - 1, 2, 1); ctx.fillRect(bx + 21, cy - 1, 2, 1);
    Glow.draw(ctx, bx - 22, cy, 5, '#4ad8ff', 0.5); Glow.draw(ctx, bx + 22, cy, 5, '#4ad8ff', 0.5);
  }
}

// ------------------------------------------------------------
//  Broca extratora (o "núcleo" a ser defendido)
// ------------------------------------------------------------
class Drill {
  constructor(m, x) {
    this.m = m; this.x = x;
    this.maxHp = Math.round(1000 * (1 + 0.4 * Save.lvl('drill_armor'))); this.hp = this.maxHp;
    this.t = 0; this.flash = 0; this.acc = {}; this.landed = false; this.dropY = -80; this.held = true;
    this.rateMul = (1 + 0.35 * Save.lvl('drill_speed')) * (1 + 0.25 * Save.lvl('cargo')) * (m.depleted ? 0.6 : 1);
    this.regen = 3 * Save.lvl('drill_regen');
    this.guns = Array.from({ length: Save.lvl('drill_turret') }, (_, i) => ({ ox: i ? 12 : -9, aim: -Math.PI / 2, cd: rand(0, 0.5) }));
  }
  rect() { return { x: this.x - 24, y: GROUND_Y - 40, w: 48, h: 40 }; }
  get cy() { return GROUND_Y - 22; }

  update(dt, mining) {
    if (this.held) return;
    this.t += dt; this.flash -= dt;
    if (!this.landed) {
      this.dropY = Math.min(0, this.dropY + dt * 160);
      if (this.dropY >= 0) {
        this.landed = true; FX.addShake(6); Sound.play('stomp');
        FX.burst(this.x, GROUND_Y, 30, { color: [BIOMES[this.m.world.biome].ground.top, '#aaaaaa'], speed: 120, angle: -Math.PI / 2, spread: 1.4, grav: 300, life: 0.8, size: 2 });
      }
      return;
    }
    if (mining) {
      const w = this.m.world;
      const out = [[w.res, 0.34]];
      if (w.res2) out.push([w.res2, 0.14]);
      if (w.res !== 'ferro') out.push(['ferro', 0.2]);
      for (const [res, rate] of out) {
        this.acc[res] = (this.acc[res] || 0) + rate * this.rateMul * dt;
        if (this.acc[res] >= 1) {
          const n = Math.floor(this.acc[res]); this.acc[res] -= n;
          this.m.collect(res, n, false);
          FX.text(this.x + rand(-10, 10), GROUND_Y - 52, '+' + n, RES[res].color, { life: 1.2, vy: -18 });
          FX.burst(this.x, GROUND_Y - 4, 4, { color: [RES[res].color], speed: 60, angle: -Math.PI / 2, spread: 0.6, grav: 300, life: 0.6, glow: true });
        }
      }
      if (Math.random() < 0.3) FX.add({ x: this.x + rand(-6, 6), y: GROUND_Y - 2, vx: rand(-30, 30), vy: rand(-60, -20), color: BIOMES[this.m.world.biome].ground.top, life: 0.5, grav: 300, size: 1 });
      if (Math.random() < 0.02) Sound.play('drill', { gap: 300 });
      if (this.regen && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
      for (const g of this.guns) {
        g.cd -= dt;
        const gx = this.x + g.ox, gy = GROUND_Y - 50;
        const tgt = this.m.nearestEnemy(gx, gy, 170);
        if (!tgt) { g.aim = angleLerp(g.aim, -Math.PI / 2, dt * 2); continue; }
        const ta = Math.atan2(tgt.y - gy, tgt.x - gx);
        g.aim = angleLerp(g.aim, ta, Math.min(1, dt * 10));
        if (g.cd <= 0) {
          g.cd = 0.45;
          const bx = gx + Math.cos(g.aim) * 8, by = gy + Math.sin(g.aim) * 8;
          this.m.addProj(new Projectile({ x: bx, y: by, vx: Math.cos(g.aim) * 420, vy: Math.sin(g.aim) * 420, team: 'player', kind: 'bullet', dmg: 9, life: 0.6, r: 1, color: '#7affea', knock: 10 }));
          FX.add({ x: bx, y: by, type: 'flashball', size: 4, life: 0.05, color: '#7affea' });
          Sound.play('turret', { gap: 60 });
        }
      }
    }
    if (this.hp < this.maxHp * 0.5 && Math.random() < 0.2) FX.add({ x: this.x + rand(-15, 15), y: GROUND_Y - 38, vy: -25, vx: rand(-5, 5), color: '#333344', type: 'smoke', size: 4, life: 1.4 });
    if (this.hp < this.maxHp * 0.25 && Math.random() < 0.1) FX.burst(this.x + rand(-15, 15), GROUND_Y - rand(10, 35), 3, { color: ['#ffe14d', '#ffffff'], speed: 80, type: 'spark', life: 0.3 });
  }

  draw(ctx, camX) {
    if (this.held) return;
    const bx = Math.round(this.x - camX), gy = GROUND_Y + Math.round(this.dropY);
    const t = this.t;
    // feixe de extração para dentro do solo (como na referência)
    if (this.landed) {
      const pulse = 0.6 + Math.sin(t * 6) * 0.2;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, GROUND_Y, 0, H);
      g.addColorStop(0, `rgba(120,255,230,${0.55 * pulse})`); g.addColorStop(1, 'rgba(120,255,230,0)');
      ctx.fillStyle = g; ctx.fillRect(bx - 4, GROUND_Y, 8, H - GROUND_Y);
      ctx.fillStyle = `rgba(220,255,250,${0.7 * pulse})`; ctx.fillRect(bx - 1, GROUND_Y, 2, H - GROUND_Y);
      for (let i = 0; i < 5; i++) {
        const yy = GROUND_Y + ((t * 60 + i * 12) % (H - GROUND_Y));
        ctx.fillStyle = 'rgba(180,255,240,0.6)'; ctx.fillRect(bx - 3, Math.round(yy), 6, 1);
      }
      ctx.globalCompositeOperation = 'source-over';
      Glow.draw(ctx, bx, GROUND_Y, 26, '#7affea', 0.5 * pulse);
    }
    // pernas (estrutura em A)
    ctx.fillStyle = '#151824';
    ctx.fillRect(bx - 24, gy - 30, 4, 30); ctx.fillRect(bx + 20, gy - 30, 4, 30);
    ctx.fillStyle = '#4b5674'; ctx.fillRect(bx - 23, gy - 30, 2, 30); ctx.fillRect(bx + 21, gy - 30, 2, 30);
    ctx.fillStyle = '#151824'; ctx.fillRect(bx - 27, gy - 3, 10, 3); ctx.fillRect(bx + 17, gy - 3, 10, 3);
    ctx.strokeStyle = '#2a2f45'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx - 22, gy - 28); ctx.lineTo(bx + 22, gy - 4); ctx.moveTo(bx + 22, gy - 28); ctx.lineTo(bx - 22, gy - 4); ctx.stroke();
    // broca giratória
    const spin = Math.floor(t * 20) % 4;
    ctx.fillStyle = '#151824'; ctx.fillRect(bx - 5, gy - 14, 10, 14);
    for (let j = 0; j < 7; j++) {
      ctx.fillStyle = (j + spin) % 2 ? '#a9b8c8' : '#5a6378';
      const ww = 8 - Math.floor(j / 2) * 2;
      ctx.fillRect(bx - ww / 2, gy - 13 + j * 2, ww, 2);
    }
    // corpo
    const by = gy - 44;
    ctx.fillStyle = '#151824'; ctx.fillRect(bx - 16, by, 32, 30);
    ctx.fillStyle = '#5a6378'; ctx.fillRect(bx - 15, by + 1, 30, 28);
    ctx.fillStyle = '#7b86a0'; ctx.fillRect(bx - 15, by + 1, 30, 2);
    ctx.fillStyle = '#3a4152'; ctx.fillRect(bx - 15, by + 12, 30, 1); ctx.fillRect(bx - 1, by + 3, 1, 9);
    // painel / tela
    ctx.fillStyle = '#0c1424'; ctx.fillRect(bx - 11, by + 15, 22, 10);
    const k = this.hp / this.maxHp;
    const scr = k > 0.5 ? '#7affea' : k > 0.25 ? '#ffcf5a' : '#ff4d4d';
    ctx.fillStyle = scr;
    for (let i = 0; i < 18; i++) {
      const hh = 1 + Math.round((Math.sin(t * 5 + i * 0.7) * 0.5 + 0.5) * 6);
      if (i < 18 * k) ctx.fillRect(bx - 10 + i, by + 24 - hh, 1, hh);
    }
    Glow.draw(ctx, bx, by + 20, 14, scr, 0.35);
    // tanques laterais
    ctx.fillStyle = '#151824'; ctx.fillRect(bx - 21, by + 8, 6, 16); ctx.fillRect(bx + 15, by + 8, 6, 16);
    ctx.fillStyle = '#3fa06a'; ctx.fillRect(bx - 20, by + 9, 4, 14);
    ctx.fillStyle = '#e0b030'; ctx.fillRect(bx + 16, by + 9, 4, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx - 20, by + 9, 1, 14); ctx.fillRect(bx + 16, by + 9, 1, 14);
    // antena
    ctx.fillStyle = '#151824'; ctx.fillRect(bx + 6, by - 12, 2, 12);
    ctx.fillStyle = '#9aa6bf'; ctx.fillRect(bx + 2, by - 14, 10, 2);
    const blink = Math.floor(t * 2) % 2;
    ctx.fillStyle = blink ? '#ff4d4d' : '#5a1010'; ctx.fillRect(bx + 6, by - 16, 2, 2);
    if (blink) Glow.draw(ctx, bx + 7, by - 15, 8, '#ff4d4d', 0.6);
    // canhões da broca
    for (const g of this.guns) {
      const gx = bx + g.ox, gy2 = by - 6;
      ctx.fillStyle = '#151824'; ctx.fillRect(gx - 3, by - 3, 6, 4);
      ctx.save(); ctx.translate(gx, gy2); ctx.rotate(g.aim);
      ctx.fillStyle = '#151824'; ctx.fillRect(-3, -3, 6, 6); ctx.fillRect(2, -2, 7, 3);
      ctx.fillStyle = '#7b86a0'; ctx.fillRect(-2, -2, 4, 4);
      ctx.fillStyle = '#7affea'; ctx.fillRect(3, -1, 5, 1);
      ctx.restore();
    }
    // luzes
    ctx.fillStyle = '#7affea'; ctx.fillRect(bx - 13, by + 5, 2, 2); ctx.fillRect(bx + 11, by + 5, 2, 2);
    Glow.draw(ctx, bx - 12, by + 6, 6, '#7affea', 0.4); Glow.draw(ctx, bx + 12, by + 6, 6, '#7affea', 0.4);
    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ff6a6a'; ctx.fillRect(bx - 16, by, 32, 44);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }
}

// ------------------------------------------------------------
//  Depósitos exploráveis (veios de minério e cápsulas antigas)
// ------------------------------------------------------------
class Deposit {
  constructor(m, x, kind, res, amount) {
    this.m = m; this.x = x; this.kind = kind; this.res = res; this.amount = amount;
    this.progress = 0; this.done = false; this.t = rand(0, 5);
  }
  update(dt) { this.t += dt; }
  extract(dt) {
    if (this.done) return;
    this.progress += dt / (this.kind === 'cache' ? 2.6 : 1.8);
    if (Math.random() < 0.5) FX.burst(this.x, GROUND_Y - 4, 1, { color: [RES[this.res].color], speed: 50, angle: -Math.PI / 2, spread: 1, grav: 300, life: 0.4 });
    if (Math.random() < 0.15) Sound.play('repair');
    if (this.progress >= 1) {
      this.done = true;
      const m = this.m;
      if (this.kind === 'cache') {
        m.dropLoot(this.x, GROUND_Y - 8, this.res, this.amount);
        m.dropLoot(this.x, GROUND_Y - 8, 'sucata', 20);
        if (Math.random() < 0.5) { Save.data.items.grenade += 2; FX.text(this.x, GROUND_Y - 30, '+2 GRANADAS', '#9cff6a'); }
        else { Save.data.items.medkit += 1; FX.text(this.x, GROUND_Y - 30, '+1 KIT MEDICO', '#6fdc5a'); }
        m.toast('Cápsula antiga aberta!', 1.5);
      } else {
        m.dropLoot(this.x, GROUND_Y - 6, this.res, this.amount);
        m.toast('Veio de ' + RES[this.res].name + ' extraído!', 1.5);
      }
      FX.burst(this.x, GROUND_Y - 6, 20, { color: [RES[this.res].color, '#ffffff'], speed: 100, glow: true, life: 0.7 });
      Sound.play('craft');
      m.stats.deposits++;
    }
  }
  draw(ctx, camX) {
    const bx = Math.round(this.x - camX), gy = GROUND_Y;
    if (bx < -30 || bx > W + 30) return;
    const col = RES[this.res].color;
    if (this.kind === 'vein') {
      if (this.done) { ctx.fillStyle = shade(col, -0.6); ctx.fillRect(bx - 6, gy - 2, 12, 2); return; }
      const shapes = [[-6, 7, 3], [-2, 12, 4], [3, 9, 3], [7, 5, 2]];
      for (const [dx, h, w] of shapes) {
        ctx.fillStyle = shade(col, -0.45);
        ctx.beginPath(); ctx.moveTo(bx + dx - w, gy); ctx.lineTo(bx + dx, gy - h); ctx.lineTo(bx + dx + w, gy); ctx.fill();
        ctx.fillStyle = col; ctx.fillRect(bx + dx - 1, gy - h + 2, 1, h - 3);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + dx - 1, gy - h + 2, 1, 1);
      }
      Glow.draw(ctx, bx, gy - 6, 16, col, 0.35 + Math.sin(this.t * 3) * 0.12);
      if (Math.random() < 0.03) FX.add({ x: this.x + rand(-6, 6), y: gy - rand(2, 10), vy: -10, color: '#ffffff', size: 1, life: 0.4 });
    } else {
      // cápsula antiga meio enterrada
      ctx.fillStyle = '#151824';
      ctx.beginPath(); ctx.ellipse(bx, gy, 13, 9, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = this.done ? '#2a2a33' : '#4a4458';
      ctx.beginPath(); ctx.ellipse(bx, gy, 12, 8, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#6a6478'; ctx.fillRect(bx - 8, gy - 7, 16, 1);
      if (!this.done) {
        const p = 0.5 + Math.sin(this.t * 2.5) * 0.4;
        ctx.fillStyle = col; ctx.fillRect(bx - 9, gy - 4, 18, 1); ctx.fillRect(bx - 1, gy - 8, 2, 8);
        Glow.draw(ctx, bx, gy - 4, 18, col, 0.4 * p);
      } else {
        ctx.fillStyle = '#151824'; ctx.fillRect(bx - 6, gy - 6, 12, 3);
      }
    }
    if (!this.done && this.progress > 0) {
      ctx.fillStyle = '#000'; ctx.fillRect(bx - 9, gy - 22, 18, 3);
      ctx.fillStyle = col; ctx.fillRect(bx - 8, gy - 21, Math.round(16 * this.progress), 1);
    }
  }
}
