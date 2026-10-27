'use strict';
// ============================================================
//  Projéteis (jogador, torres, inimigos e chefes)
// ============================================================

class Projectile {
  constructor(o) {
    Object.assign(this, {
      x: 0, y: 0, vx: 0, vy: 0, team: 'player', kind: 'bullet', dmg: 5, life: 1, r: 1, color: '#fff',
      aoe: 0, pierce: 0, chill: 0, knock: 0, gravity: 0, bounce: false, dead: false, t: 0, homing: 0,
    }, o);
    this.hit = new Set();
    this.px = this.x; this.py = this.y;
  }

  update(dt, m) {
    this.t += dt; this.life -= dt;
    this.px = this.x; this.py = this.y;
    if (this.gravity) this.vy += GRAV * m.gravAt(this.x) * this.gravity * dt;
    if (this.homing && m.player && !m.player.dead) {
      const a = Math.atan2(m.player.cy - this.y, m.player.cx - this.x), sp = Math.hypot(this.vx, this.vy);
      const cur = Math.atan2(this.vy, this.vx), na = angleLerp(cur, a, Math.min(1, this.homing * dt));
      this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
    }
    this.x += this.vx * dt; this.y += this.vy * dt;

    // rastros
    if (this.kind === 'rocket') {
      FX.add({ x: this.x, y: this.y, vx: rand(-10, 10), vy: rand(-10, 10), color: '#aaaaaa', type: 'smoke', size: 3, life: 0.5, grav: -10 });
      if (Math.random() < 0.6) FX.add({ x: this.x, y: this.y, color: '#ffb347', size: 1, life: 0.15, glow: true });
    } else if (this.kind === 'fireball' && Math.random() < 0.7) {
      FX.add({ x: this.x, y: this.y, vx: rand(-10, 10), vy: rand(-20, 0), color: choose(['#ffb347', '#ff6a2a']), size: 2, life: 0.3, glow: true });
    } else if (this.kind === 'cryo' && Math.random() < 0.4) {
      FX.add({ x: this.x, y: this.y, vx: rand(-10, 10), vy: rand(-10, 10), color: '#e8fbff', size: 1, life: 0.3 });
    } else if (this.kind === 'acid' && Math.random() < 0.4) {
      FX.add({ x: this.x, y: this.y, color: this.color, size: 1, life: 0.25 });
    }

    if (this.kind === 'shock') { this.updateShock(dt, m); return; }

    if (this.team === 'player') this.collidePlayerTeam(m);
    else this.collideEnemyTeam(m);
    if (this.dead) return;

    // chão
    if (this.y >= GROUND_Y) {
      if (this.bounce) {
        this.y = GROUND_Y - 1; this.vy *= -0.45; this.vx *= 0.7;
        if (Math.abs(this.vy) < 30) this.vy = 0;
      } else return this.impact(m, true);
    }
    if (this.x < -40 || this.x > m.width + 40 || this.y < -200) this.dead = true;
    if (this.life <= 0) {
      if (this.aoe) this.impact(m, false);
      else this.dead = true;
    }
  }

  collidePlayerTeam(m) {
    for (const e of m.enemies) {
      if (e.dead || this.hit.has(e)) continue;
      if (circleRect(this.x, this.y, this.r + 1, e.rect())) {
        if (this.kind === 'grenade' || this.aoe) return this.impact(m, false);
        m.damageEnemy(e, this.dmg, { knock: this.knock, dirX: sign(this.vx), chill: this.chill, x: this.x, y: this.y, crit: this.crit });
        this.hit.add(e);
        this.sparks();
        if (this.pierce > 0) { this.pierce--; } else { this.dead = true; return; }
      }
    }
    const b = m.boss;
    if (b && !b.dead && !this.hit.has(b) && b.hitTest(this.x, this.y, this.r + 1)) {
      if (this.aoe) return this.impact(m, false);
      b.damage(this.dmg, this.x, this.y, this.chill);
      this.sparks();
      if (this.pierce > 0) { this.pierce--; this.hit.add(b); } else { this.dead = true; return; }
    }
  }

  collideEnemyTeam(m) {
    const p = m.player;
    if (!p.dead && circleRect(this.x, this.y, this.r, p.rect())) {
      if (this.aoe) return this.impact(m, false);
      p.hurt(this.dmg, this.x);
      if (this.kind === 'acid') FX.burst(this.x, this.y, 5, { color: [this.color], speed: 40, life: 0.3 });
      this.dead = true; return;
    }
    // teto bloqueia projéteis inimigos vindos de cima
    for (const bd of m.buildings) {
      if (bd.dead) continue;
      if (bd.type === 'ceiling') {
        if (pointInRect(this.x, this.y, bd.fieldRect()) && this.vy > -50) {
          if (this.aoe) return this.impact(m, false, bd);
          bd.damage(this.dmg * 0.6); this.sparks(); this.dead = true; return;
        }
        continue;
      }
      if (!bd.def.solid) continue;
      if (circleRect(this.x, this.y, this.r, bd.rect())) {
        if (this.aoe) return this.impact(m, false);
        bd.damage(this.dmg); this.sparks(); this.dead = true; return;
      }
    }
    const d = m.drill;
    if (circleRect(this.x, this.y, this.r, d.rect())) {
      if (this.aoe) return this.impact(m, false);
      m.damageDrill(this.dmg); this.sparks(); this.dead = true;
    }
  }

  updateShock(dt, m) {
    // onda de choque correndo pelo chão
    this.y = GROUND_Y - 3;
    if (Math.random() < 0.8) FX.add({ x: this.x, y: GROUND_Y - 1, vx: rand(-20, 20), vy: rand(-80, -30), color: this.color, size: 2, life: 0.4, grav: 300 });
    const p = m.player;
    if (!p.dead && !this.hit.has(p) && Math.abs(p.cx - this.x) < 8 && p.y + p.h >= GROUND_Y - 4) { p.hurt(this.dmg, this.x); this.hit.add(p); }
    for (const bd of m.buildings) {
      if (bd.dead || this.hit.has(bd) || bd.type === 'ceiling') continue;
      if (Math.abs(bd.x - this.x) < bd.def.w / 2 + 3) { bd.damage(this.dmg * 1.5); this.hit.add(bd); }
    }
    if (!this.hit.has(m.drill) && Math.abs(m.drill.x - this.x) < 28) { m.damageDrill(this.dmg); this.hit.add(m.drill); }
    if (this.life <= 0 || this.x < 0 || this.x > m.width) this.dead = true;
  }

  sparks() {
    FX.burst(this.x, this.y, this.kind === 'cryo' ? 2 : 4, { color: [this.color, '#ffffff'], speed: 90, life: 0.2, type: 'spark', drag: 4 });
  }

  impact(m, ground, ceiling = null) {
    this.dead = true;
    if (this.frag) {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI * (i + 0.5) / 10;
        m.addProj(new Projectile({ x: this.x, y: Math.min(this.y, GROUND_Y - 3), vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, team: 'player', kind: 'bullet', dmg: this.dmg * 0.25, life: 0.35, r: 1, color: '#c8ff9a', knock: 20 }));
      }
    }
    if (this.aoe) {
      const isPlayer = this.team === 'player';
      m.explode(this.x, Math.min(this.y, GROUND_Y - 2), this.aoe, this.dmg, {
        hurtsEnemies: isPlayer, hurtsPlayer: !isPlayer || this.kind === 'grenade', playerMul: this.kind === 'grenade' ? 0.35 : 1,
        hurtsBuildings: !isPlayer, colors: this.kind === 'bomb' ? undefined : (this.kind === 'fireball' ? undefined : ['#ffffff', this.color, shade(this.color, -0.3), '#ff6a2a']),
      });
      return;
    }
    if (ground) {
      if (this.kind === 'acid') {
        FX.burst(this.x, GROUND_Y - 1, 6, { color: [this.color, shade(this.color, -0.3)], speed: 50, angle: -Math.PI / 2, spread: 1.2, grav: 300, life: 0.4 });
      } else FX.burst(this.x, GROUND_Y - 1, 3, { color: [this.color], speed: 50, angle: -Math.PI / 2, spread: 1.2, life: 0.2, type: 'spark' });
    }
  }

  draw(ctx, camX) {
    const x = this.x - camX, y = this.y;
    if (x < -20 || x > W + 20) return;
    switch (this.kind) {
      case 'bullet': {
        const len = Math.min(8, Math.hypot(this.vx, this.vy) * 0.012);
        const a = Math.atan2(this.vy, this.vx);
        ctx.strokeStyle = this.color; ctx.lineWidth = this.r + 0.5;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a) * len, y - Math.sin(a) * len); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
        Glow.draw(ctx, x, y, 7, this.color, 0.6);
        break;
      }
      case 'cryo': {
        const k = clamp(this.life / 0.45, 0, 1);
        ctx.globalAlpha = 0.5 + k * 0.5;
        ctx.fillStyle = '#e8fbff';
        const s = Math.round(2 + (1 - k) * 3);
        ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
        ctx.globalAlpha = 1;
        Glow.draw(ctx, x, y, 8, '#6fe8ff', 0.5 * k);
        break;
      }
      case 'rocket': {
        const a = Math.atan2(this.vy, this.vx);
        ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(a);
        ctx.fillStyle = '#d8d8e0'; ctx.fillRect(-4, -1, 6, 3);
        ctx.fillStyle = '#ff5a3a'; ctx.fillRect(2, -1, 2, 3);
        ctx.restore();
        Glow.draw(ctx, x - Math.cos(a) * 5, y - Math.sin(a) * 5, 9, '#ffb347', 0.8);
        break;
      }
      case 'grenade': {
        ctx.fillStyle = '#2a3a2a'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
        ctx.fillStyle = Math.floor(this.t * 10) % 2 ? '#ff4d4d' : '#9cff6a'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 3, 2, 1);
        Glow.draw(ctx, x, y, 5, '#9cff6a', 0.3);
        break;
      }
      case 'acid': case 'spore': {
        ctx.fillStyle = this.color;
        ctx.fillRect(Math.round(x) - this.r, Math.round(y) - this.r, this.r * 2, this.r * 2);
        ctx.fillStyle = shade(this.color, 0.5); ctx.fillRect(Math.round(x) - this.r, Math.round(y) - this.r, 1, 1);
        Glow.draw(ctx, x, y, 6 + this.r, this.color, 0.5);
        break;
      }
      case 'bomb': {
        ctx.fillStyle = '#1a1020'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 3, 5, 6);
        ctx.fillStyle = this.color; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 2, 2);
        Glow.draw(ctx, x, y, 6, this.color, 0.5 + Math.sin(this.t * 30) * 0.3);
        break;
      }
      case 'fireball': case 'orb': {
        Glow.draw(ctx, x, y, this.r * 4, this.color, 0.8);
        ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(x, y, this.r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, Math.max(1, this.r * 0.45), 0, TAU); ctx.fill();
        break;
      }
      case 'shock': {
        Glow.draw(ctx, x, GROUND_Y - 4, 12, this.color, 0.7);
        ctx.fillStyle = this.color; ctx.fillRect(Math.round(x) - 2, GROUND_Y - 8, 4, 8);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x) - 1, GROUND_Y - 6, 2, 6);
        break;
      }
    }
  }
}
