'use strict';
// ============================================================
//  Jogador (explorador) e drones de escolta
// ============================================================

class Player {
  constructor(m, x) {
    this.m = m;
    this.w = 10; this.h = 16;
    this.x = x; this.y = GROUND_Y - this.h;
    this.vx = 0; this.vy = 0; this.face = 1; this.onGround = true;
    this.maxHp = 100 + 30 * Save.lvl('armor'); this.hp = this.maxHp;
    this.jetLevel = Save.lvl('jetpack');
    this.fuelMax = this.jetLevel ? 1.3 * (this.jetLevel >= 2 ? 1.8 : 1) : 0; this.fuel = this.fuelMax;
    this.jetting = false;
    this.weapons = WEAPON_ORDER.filter(w => Save.data.weapons.includes(w));
    this.wi = 0; this.heat = {}; this.over = {};
    this.weapons.forEach(w => { this.heat[w] = 0; this.over[w] = false; });
    this.cd = 0; this.inv = 0; this.dead = false; this.respawnT = 0;
    this.dashT = 0; this.dashCd = 0; this.animT = 0; this.aim = 0;
    this.lastHurt = 0; this.tempHurtT = 0; this.dropT = 0;
    this.dmgMul = 1 + 0.2 * Save.lvl('dmg');
    this.coolMul = 1 + 0.35 * Save.lvl('cool');
    const th = 20 * Save.lvl('thermal');
    this.comfort = [-10 - th, 40 + th];
    this.magnet = Save.lvl('magnet') ? 70 : 36;
    this.regen = Save.lvl('regen') > 0;
    this.repairing = false; this.recoil = 0;
    this.critChance = 0.1 * Save.lvl('crit');
    this.rofMul = 1 + 0.12 * Save.lvl('rof');
    this.speedMul = 1 + 0.12 * Save.lvl('boots');
    this.dashCdMax = 0.85 * (1 - 0.3 * Save.lvl('dash_mk'));
    this.dashHits = Save.lvl('dash_mk') >= 2 ? new Set() : null;
    this.shieldMax = 25 * Save.lvl('shield'); this.shield = this.shieldMax; this.shieldT = 0;
    this.maxAirJumps = Save.lvl('double_jump'); this.airJumps = this.maxAirJumps;
    this.grenadeMk = Save.lvl('grenade_mk') > 0;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get weapon() { return this.weapons[this.wi]; }
  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  hurt(d, srcX = null, kind = 'hit') {
    if (this.dead || this.inv > 0 || this.m.phase === 'extract') return;
    this.lastHurt = 0;
    if (kind !== 'temp') {
      this.shieldT = 0;
      if (this.shield > 0) {
        const ab = Math.min(this.shield, d);
        this.shield -= ab; d -= ab;
        FX.burst(this.cx, this.cy, 6, { color: ['#7affea', '#ffffff'], speed: 60, life: 0.3, glow: true });
        if (this.shield <= 0) { Sound.play('overheat', { vol: 0.6 }); FX.text(this.cx, this.y - 10, 'ESCUDO CAIU', '#7affea'); }
        if (d <= 0) { this.inv = 0.3; Sound.play('hit'); return; }
      }
    }
    this.hp -= d;
    this.inv = kind === 'temp' ? 0 : 0.45;
    if (kind !== 'temp') {
      Sound.play('hurt'); FX.addShake(3);
      Input.rumble(0.65, 0.85, 200);
      FX.burst(this.cx, this.cy, 6, { color: ['#ff4d4d', '#ffffff'], speed: 70, life: 0.3 });
      if (srcX !== null) { this.vx += sign(this.cx - srcX) * 120; this.vy = Math.min(this.vy, -80); }
    }
    FX.text(this.cx, this.y - 4, '-' + Math.ceil(d), kind === 'temp' ? '#ffb347' : '#ff5a5a');
    if (this.hp <= 0) this.die();
  }
  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); FX.text(this.cx, this.y - 6, '+' + n, '#6fdc5a'); }

  die() {
    this.dead = true; this.hp = 0; this.respawnT = 5;
    Input.rumble(0.9, 1.0, 500);
    FX.explosion(this.cx, this.cy, 18, ['#ffffff', '#7af0ff', '#2f8fd8']);
    FX.burst(this.cx, this.cy, 20, { color: ['#e4e8f0', '#9aa6bf', '#f08a3c'], speed: 140, grav: 400, bounce: true, life: 1.5, size: 2 });
    Sound.play('explosion');
    this.m.announce('VOCÊ CAIU', 'Reimplantação em 5s...', 'danger');
  }
  respawn() {
    const d = this.m.drill;
    this.dead = false; this.hp = this.maxHp; this.inv = 2;
    this.x = d.x - 5; this.y = GROUND_Y - 80; this.vx = 0; this.vy = 0;
    this.fuel = this.fuelMax; this.shield = this.shieldMax;
    FX.burst(this.cx, this.cy, 24, { color: ['#7af0ff', '#ffffff'], speed: 90, life: 0.6, glow: true });
    Sound.play('warp', { vol: 0.5 });
  }

  update(dt) {
    const m = this.m, I = Input;
    if (this.dead) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.respawn();
      return;
    }
    this.animT += dt; this.inv -= dt; this.cd -= dt; this.dashCd -= dt; this.dropT -= dt;
    this.lastHurt += dt; this.recoil = Math.max(0, this.recoil - dt * 30);
    const g = GRAV * m.gravAt(this.cx);

    // ----- movimento horizontal -----
    let dir = 0;
    if (I.isDown('KeyA', 'ArrowLeft')) dir -= 1;
    if (I.isDown('KeyD', 'ArrowRight')) dir += 1;
    const speed = 96 * this.speedMul;
    if (this.dashT > 0) {
      this.dashT -= dt;
      FX.add({ x: this.cx - this.vx * 0.02, y: this.cy + rand(-5, 5), color: '#7af0ff', life: 0.25, size: 2, glow: true });
      if (this.dashHits) {
        for (const e of m.enemies) {
          if (e.dead || this.dashHits.has(e) || !rectsOverlap(this.rect(), e.rect())) continue;
          this.dashHits.add(e);
          e.hurt(25 * this.dmgMul, { knock: 80, dirX: sign(this.vx) });
          FX.burst(e.x, e.y, 6, { color: ['#7af0ff', '#ffffff'], speed: 80, type: 'spark' });
        }
      }
    } else {
      const target = dir * speed;
      const acc = this.onGround ? 900 : 520;
      this.vx = approach(this.vx, target, acc * dt);
    }
    if (I.wasPressed('ShiftLeft', 'ShiftRight') && this.dashCd <= 0) {
      const dd = dir || this.face;
      this.vx = dd * 330; this.dashT = 0.16; this.dashCd = this.dashCdMax; if (this.dashHits) this.dashHits.clear(); this.inv = Math.max(this.inv, 0.2);
      this.vy = Math.min(this.vy, 0) * 0.3;
      Sound.play('dash');
      Input.rumble(0.3, 0.1, 90);
    }

    // ----- pulo / jetpack -----
    const jumpPressed = I.wasPressed('KeyW', 'Space', 'ArrowUp');
    const jumpHeld = I.isDown('KeyW', 'Space', 'ArrowUp');
    if (jumpPressed && this.onGround) {
      this.vy = -235; this.onGround = false; this.jetArm = false;
      Sound.play('jump');
      FX.burst(this.cx, this.y + this.h, 5, { color: [BIOMES[m.world.biome].ground.top], speed: 30, life: 0.35, angle: -Math.PI / 2, spread: 1.2 });
    } else if (jumpPressed && !this.onGround) {
      if (this.airJumps > 0 && !(this.fuel > 0 && this.vy > -40 && this.fuelMax > 0 && this.jetArm)) {
        this.airJumps--; this.vy = -215; this.jetArm = false;
        Sound.play('jump');
        FX.burst(this.cx, this.y + this.h, 8, { color: ['#b07cff', '#ffffff'], speed: 50, life: 0.35, glow: true });
      } else this.jetArm = true;
    }
    this.jetting = false;
    if (!this.onGround && jumpHeld && this.fuel > 0 && this.fuelMax > 0 && (this.jetArm || this.vy > -40)) {
      this.jetting = true;
      this.vy = Math.max(-150, this.vy - (g + 900) * dt);
      this.fuel -= dt;
      if (Math.random() < 0.8) FX.add({ x: this.cx - this.face * 4, y: this.y + this.h - 2, vx: rand(-15, 15), vy: rand(60, 110), color: choose(['#ffb347', '#ff6a2a', '#fff27a']), life: 0.3, size: 2, glow: true });
    }
    if (this.onGround) { this.fuel = Math.min(this.fuelMax, this.fuel + dt * 1.2); this.airJumps = this.maxAirJumps; }

    // ----- física -----
    this.vy += g * dt;
    if (this.vy > 500) this.vy = 500;
    const prevBottom = this.y + this.h;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.onGround = false;
    if (I.wasPressed('KeyS', 'ArrowDown')) this.dropT = 0.25;
    // plataformas de teto
    if (this.vy >= 0 && this.dropT <= 0) {
      for (const b of m.buildings) {
        if (b.type !== 'ceiling' || b.dead) continue;
        const top = b.canopyY;
        if (this.x + this.w > b.x - 24 && this.x < b.x + 24 && prevBottom <= top + 1 && this.y + this.h >= top) {
          this.y = top - this.h; this.vy = 0; this.onGround = true;
        }
      }
    }
    if (this.y + this.h >= GROUND_Y) {
      if (this.vy > 300) FX.burst(this.cx, GROUND_Y, 6, { color: [BIOMES[m.world.biome].ground.top], speed: 40, life: 0.3, angle: -Math.PI / 2, spread: 1.4 });
      this.y = GROUND_Y - this.h; this.vy = 0; this.onGround = true;
    }
    if (this.y < -60) { this.y = -60; this.vy = Math.max(0, this.vy); }
    this.x = clamp(this.x, 4, m.width - this.w - 4);

    // ----- mira -----
    const mw = m.mouseWorld();
    const px = this.cx, py = this.y + 9;
    this.aim = Math.atan2(mw.y - py, mw.x - px);
    if (!m.buildMode || true) this.face = mw.x >= px ? 1 : -1;

    // ----- armas -----
    if (I.wasPressed('KeyQ') || I.mouse.wheel) {
      const d = I.mouse.wheel ? sign(I.mouse.wheel) : 1;
      this.switchWeapon((this.wi + d + this.weapons.length) % this.weapons.length);
    }
    if (!m.buildMode) {
      for (let i = 0; i < this.weapons.length; i++) if (I.wasPressed('Digit' + (i + 1))) this.switchWeapon(i);
    }
    const tempF = clamp(1 + (20 - m.tempAt(this.cx)) / 110, 0.45, 1.9);
    for (const w of this.weapons) {
      this.heat[w] = Math.max(0, this.heat[w] - 38 * tempF * this.coolMul * dt * (this.weapon === w ? 1 : 1.6));
      if (this.over[w] && this.heat[w] < 35) this.over[w] = false;
    }
    if (!m.buildMode && I.mouse.left && this.cd <= 0 && !this.over[this.weapon] && m.phase !== 'extract') this.fire();
    if (this.over[this.weapon] && Math.random() < 0.3) FX.add({ x: this.cx + Math.cos(this.aim) * 8, y: py + Math.sin(this.aim) * 8, vy: -20, vx: rand(-5, 5), color: '#ccccdd', type: 'smoke', size: 3, life: 0.6 });

    // ----- temperatura -----
    const T = m.tempAt(this.cx);
    const ex = T < this.comfort[0] ? this.comfort[0] - T : T > this.comfort[1] ? T - this.comfort[1] : 0;
    this.tempExcess = ex * (T < this.comfort[0] ? -1 : 1);
    if (ex > 0) {
      this.tempHurtT += dt;
      if (this.tempHurtT >= 0.5) { this.tempHurtT = 0; this.hurt(0.5 + ex * 0.03, null, 'temp'); }
      if (!this.tempWarned) {
        this.tempWarned = true;
        m.toast(T < this.comfort[0] ? 'Frio extremo! Fique perto de um Aquecedor' : 'Calor extremo! Fique perto de um Ar-condicionado', 2.4, 'danger');
      }
      if (Math.random() < 0.2) FX.add({ x: this.cx + rand(-5, 5), y: this.y + rand(0, 12), vy: T < 0 ? 5 : -18, color: T < 0 ? '#e0f8ff' : '#ff9a4a', life: 0.5, size: 1 });
    }
    // ----- regeneração -----
    if (this.regen && this.lastHurt > 4 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 2 * dt);
    if (this.shieldMax) {
      this.shieldT += dt;
      if (this.shieldT > 3 && this.shield < this.shieldMax) this.shield = Math.min(this.shieldMax, this.shield + 12 * dt);
    }

    // ----- itens -----
    const items = Save.data.items;
    if (I.wasPressed('KeyG')) {
      if (items.grenade > 0) {
        items.grenade--;
        const a = this.aim, sp = 260;
        m.addProj(new Projectile({ x: this.cx, y: py, vx: Math.cos(a) * sp + this.vx * 0.3, vy: Math.sin(a) * sp - 60, team: 'player', kind: 'grenade', dmg: 70 * this.dmgMul * (this.grenadeMk ? 1.6 : 1), aoe: this.grenadeMk ? 60 : 46, frag: this.grenadeMk, life: 1.4, r: 2, color: '#9cff6a', gravity: 1, bounce: true }));
        Sound.play('jump');
      } else { m.toast('Sem granadas — fabrique mais no Fabricador'); Sound.play('error'); }
    }
    if (I.wasPressed('KeyH')) {
      if (items.medkit > 0 && this.hp < this.maxHp) { items.medkit--; this.heal(60); Sound.play('craft'); FX.burst(this.cx, this.cy, 14, { color: ['#6fdc5a', '#c8ff9a'], speed: 50, glow: true }); }
      else if (items.medkit <= 0) { m.toast('Sem kits médicos'); Sound.play('error'); }
    }
    if (I.wasPressed('KeyF')) {
      if (items.repairkit > 0) { items.repairkit--; m.useRepairKit(); }
      else { m.toast('Sem kits de reparo'); Sound.play('error'); }
    }
  }

  switchWeapon(i) {
    if (i === this.wi || i < 0 || i >= this.weapons.length) return;
    this.wi = i; this.cd = Math.max(this.cd, 0.12);
    Sound.play('click');
    this.m.toast(WEAPONS[this.weapon].name, 0.8);
  }

  fire() {
    const m = this.m, id = this.weapon, wp = WEAPONS[id];
    const a0 = this.aim;
    const px = this.cx, py = this.y + 9;
    const gx = px + Math.cos(a0) * 10, gy = py + Math.sin(a0) * 10;
    const dmg = wp.dmg * this.dmgMul;
    const roll = () => Math.random() < this.critChance;
    if (wp.hitscan) {
      const c = roll();
      m.railShot(gx, gy, a0, dmg * (c ? 2.5 : 1), wp.knock, c ? '#ff5af0' : wp.color);
    } else {
      for (let i = 0; i < wp.count; i++) {
        const a = a0 + rand(-wp.spread, wp.spread);
        const sp = wp.speed * (wp.count > 1 ? rand(0.85, 1.1) : 1);
        const crit = roll();
        m.addProj(new Projectile({ crit,
          x: gx, y: gy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, team: 'player', kind: wp.rocket ? 'rocket' : (wp.chill ? 'cryo' : 'bullet'),
          dmg: dmg * (crit ? 2.5 : 1), life: wp.life, r: wp.size, color: wp.color, aoe: wp.aoe || 0, pierce: wp.pierce || 0, chill: wp.chill || 0, knock: wp.knock,
        }));
      }
    }
    FX.add({ x: gx, y: gy, type: 'flashball', size: wp.count > 1 || wp.rocket || wp.hitscan ? 9 : 5, life: 0.06, color: wp.color });
    if (wp.count > 1 || wp.rocket) FX.burst(gx, gy, 4, { color: ['#cccccc', '#888888'], type: 'smoke', size: 3, speed: 20, life: 0.5, grav: -20 });
    Sound.play(wp.sfx);
    const rumbleByWp = {
      blaster: [0.12, 0.05, 50],
      shotgun: [0.5, 0.8, 130],
      rifle: [0.12, 0.08, 40],
      cryo: [0.08, 0.04, 50],
      rocket: [0.4, 0.85, 200],
      rail: [0.7, 1.0, 280],
    };
    const rmb = rumbleByWp[id] || [0.2, 0.2, 60];
    Input.rumble(rmb[0], rmb[1], rmb[2]);
    this.cd = 1 / (wp.rate * this.rofMul);
    this.recoil = wp.count > 1 || wp.rocket || wp.hitscan ? 3 : 1;
    if (wp.count > 1 || wp.hitscan) { this.vx -= Math.cos(a0) * 70; FX.addShake(wp.hitscan ? 4 : 2); }
    this.heat[id] += wp.heat;
    if (this.heat[id] >= 100) { this.heat[id] = 100; this.over[id] = true; Sound.play('overheat'); m.toast('SUPERAQUECIDA!', 0.8); }
  }

  draw(ctx, camX) {
    if (this.dead) return;
    if (this.inv > 0 && Math.floor(this.inv * 20) % 2 === 0 && this.inv < 1.9) return;
    const x = Math.round(this.x - camX) - 1, y = Math.round(this.y);
    let frame = 'idle';
    if (!this.onGround) frame = 'jump';
    else if (Math.abs(this.vx) > 10) frame = Math.floor(this.animT * 10) % 2 ? 'run1' : 'run2';
    const flip = this.face < 0;
    const bob = frame === 'run2' ? -1 : 0;
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    const sh = this.onGround ? 1 : clamp(1 - (GROUND_Y - (this.y + this.h)) / 80, 0.2, 1);
    ctx.fillRect(Math.round(this.cx - camX - 5 * sh), GROUND_Y, Math.round(10 * sh), 2);
    // jetpack chama
    if (this.jetting) Glow.draw(ctx, this.cx - camX - this.face * 4, y + 16, 10, '#ff9a4a', 0.7);
    drawSprite(ctx, playerSprite(frame), x, y + bob, flip, this.inv > 0 && this.inv > 0.35 && this.hp > 0 && false);
    // arma
    this.drawGun(ctx, this.cx - camX, y + 9 + bob);
    if (this.shield > 0) {
      ctx.strokeStyle = rgba('#7affea', 0.25 + 0.35 * this.shield / this.shieldMax + Math.sin(this.animT * 6) * 0.08);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(this.cx - camX, y + 8, 9, 11, 0, 0, TAU); ctx.stroke();
    }
    // visor brilho
    Glow.draw(ctx, x + (flip ? 4 : 8), y + 3, 4, '#7af0ff', 0.25);
  }

  drawGun(ctx, px, py) {
    const id = this.weapon, wp = WEAPONS[id];
    ctx.save();
    ctx.translate(Math.round(px), Math.round(py));
    ctx.rotate(this.aim);
    if (this.face < 0) ctx.scale(1, -1);
    const r = -this.recoil;
    const heat = this.heat[id] / 100;
    const hot = this.over[id] ? '#ff5a3a' : mixHex(wp.color, '#ff5a3a', heat * 0.8);
    ctx.fillStyle = '#e4e8f0'; ctx.fillRect(0 + r, -1, 3, 3); // mão
    switch (id) {
      case 'blaster':
        ctx.fillStyle = '#4b5674'; ctx.fillRect(2 + r, -2, 7, 3);
        ctx.fillStyle = '#2a2f45'; ctx.fillRect(3 + r, 1, 2, 2);
        ctx.fillStyle = hot; ctx.fillRect(8 + r, -2, 2, 2); break;
      case 'shotgun':
        ctx.fillStyle = '#6b4a34'; ctx.fillRect(0 + r, 0, 4, 3);
        ctx.fillStyle = '#4b5674'; ctx.fillRect(2 + r, -2, 10, 3);
        ctx.fillStyle = '#2a2f45'; ctx.fillRect(4 + r, 1, 5, 1);
        ctx.fillStyle = hot; ctx.fillRect(11 + r, -2, 1, 3); break;
      case 'rifle':
        ctx.fillStyle = '#3a4a3a'; ctx.fillRect(0 + r, -2, 13, 3);
        ctx.fillStyle = '#2a2f45'; ctx.fillRect(4 + r, 1, 2, 3);
        ctx.fillStyle = hot; ctx.fillRect(6 + r, -2, 4, 1); ctx.fillRect(12 + r, -1, 2, 1); break;
      case 'cryo':
        ctx.fillStyle = '#5b8fbf'; ctx.fillRect(1 + r, -3, 9, 5);
        ctx.fillStyle = '#c8f8ff'; ctx.fillRect(3 + r, -2, 3, 3);
        ctx.fillStyle = hot; ctx.fillRect(10 + r, -2, 2, 3); break;
      case 'rocket':
        ctx.fillStyle = '#5a3a2a'; ctx.fillRect(-3 + r, -3, 16, 5);
        ctx.fillStyle = '#2a2f45'; ctx.fillRect(2 + r, 2, 2, 2);
        ctx.fillStyle = hot; ctx.fillRect(12 + r, -2, 2, 3); break;
      case 'rail':
        ctx.fillStyle = '#3a2a5a'; ctx.fillRect(-1 + r, -2, 15, 4);
        ctx.fillStyle = hot; ctx.fillRect(2 + r, -3, 10, 1); ctx.fillRect(2 + r, 2, 10, 1);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(14 + r, -1, 1, 2); break;
    }
    ctx.restore();
  }
}

// Drone de escolta (upgrade da nave)
class Escort {
  constructor(m, idx) {
    this.m = m; this.idx = idx;
    const p = m.player;
    this.x = p.cx; this.y = p.y - 20; this.cd = rand(0, 0.5); this.t = rand(0, 5); this.aim = 0;
  }
  update(dt) {
    const p = this.m.player; this.t += dt; this.cd -= dt;
    const ox = (this.idx === 0 ? -14 : 14) * (p.dead ? 1 : 1), oy = -22 + Math.sin(this.t * 2 + this.idx) * 4;
    const tx = (p.dead ? this.m.drill.x : p.cx) + ox, ty = (p.dead ? GROUND_Y - 60 : p.y) + oy;
    this.x = lerp(this.x, tx, Math.min(1, dt * 4)); this.y = lerp(this.y, ty, Math.min(1, dt * 4));
    const tgt = this.m.nearestEnemy(this.x, this.y, 160);
    if (tgt) {
      this.aim = Math.atan2(tgt.y - this.y, tgt.x - this.x);
      if (this.cd <= 0) {
        this.cd = 0.4;
        this.m.addProj(new Projectile({ x: this.x, y: this.y, vx: Math.cos(this.aim) * 380, vy: Math.sin(this.aim) * 380, team: 'player', kind: 'bullet', dmg: 5, life: 0.8, r: 1, color: '#ffe14d', knock: 10 }));
        Sound.play('turret', { vol: 0.6 });
      }
    }
  }
  draw(ctx, camX) {
    const x = Math.round(this.x - camX), y = Math.round(this.y);
    Glow.draw(ctx, x, y + 4, 6, '#ffe14d', 0.3 + Math.sin(this.t * 10) * 0.1);
    ctx.fillStyle = '#14101e'; ctx.fillRect(x - 5, y - 2, 10, 5);
    ctx.fillStyle = '#9aa6bf'; ctx.fillRect(x - 4, y - 2, 8, 3);
    ctx.fillStyle = '#e4e8f0'; ctx.fillRect(x - 3, y - 2, 4, 1);
    ctx.fillStyle = '#ffe14d'; ctx.fillRect(x + (Math.cos(this.aim) > 0 ? 2 : -3), y - 1, 1, 1);
    ctx.fillStyle = '#ff9a4a'; ctx.fillRect(x - 1, y + 3, 2, 1);
  }
}
