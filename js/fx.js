'use strict';
// ============================================================
//  Efeitos: partículas, textos flutuantes, explosões, tremor
// ============================================================

const FX = {
  parts: [], texts: [], rings: [], beams: [],
  shake: 0, flash: 0, flashColor: '#ffffff', hitstop: 0,
  MAX: 1600,

  reset() { this.parts.length = 0; this.texts.length = 0; this.rings.length = 0; this.beams.length = 0; this.shake = 0; this.flash = 0; this.hitstop = 0; },

  add(p) {
    if (this.parts.length >= this.MAX) this.parts.shift();
    p.life = p.life ?? 0.6; p.max = p.life;
    p.vx = p.vx || 0; p.vy = p.vy || 0; p.size = p.size ?? 1; p.grav = p.grav || 0; p.drag = p.drag ?? 0;
    p.type = p.type || 'px';
    this.parts.push(p);
    return p;
  },
  burst(x, y, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = o.angle !== undefined ? o.angle + rand(-(o.spread ?? Math.PI), o.spread ?? Math.PI) : rand(0, TAU);
      const sp = rand(o.speedMin ?? 20, o.speed ?? 80);
      this.add({
        x: x + rand(-(o.jitter || 0), o.jitter || 0), y: y + rand(-(o.jitter || 0), o.jitter || 0),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(o.lifeMin ?? 0.25, o.life ?? 0.6),
        color: Array.isArray(o.color) ? choose(o.color) : (o.color || '#fff'),
        size: o.size ?? 1, grav: o.grav ?? 0, drag: o.drag ?? 2, type: o.type || 'px', bounce: o.bounce,
        glow: o.glow,
      });
    }
  },
  explosion(x, y, r, colors = ['#fff3a0', '#ffb347', '#ff6a2a', '#ff3d3d'], big = false) {
    this.add({ x, y, type: 'flashball', size: r * 1.2, life: 0.18, color: colors[0] });
    this.rings.push({ x, y, r: 2, max: r * 1.25, life: 0.35, t: 0, color: colors[1] || colors[0], w: big ? 3 : 2 });
    this.burst(x, y, Math.min(60, 10 + r), { color: colors, speed: r * 4.5, speedMin: r, life: 0.55, size: 2, drag: 3.5, glow: true, grav: 60 });
    this.burst(x, y, Math.min(30, 5 + r / 2), { color: ['#3a3040', '#5a4e5a', '#2a2430'], speed: r * 1.8, life: 1.3, lifeMin: 0.6, type: 'smoke', size: r / 4 + 2, drag: 2, grav: -30 });
    this.burst(x, y, Math.min(20, 4 + r / 3), { color: ['#2a2020', '#4a3a30'], speed: r * 5, life: 1.2, grav: 420, drag: 0.5, size: 1, bounce: true });
    this.shake = Math.max(this.shake, Math.min(10, r / 6 + (big ? 5 : 1)));
    if (typeof Input !== 'undefined' && Input.rumble) {
      Input.rumble(Math.min(1, 0.25 + r / 40), Math.min(1, r / 30 + (big ? 0.35 : 0)), big ? 320 : 180);
    }
  },
  text(x, y, str, color = '#fff', o = {}) {
    if (this.texts.length > 60) this.texts.shift();
    this.texts.push({ x: x + rand(-3, 3), y, str, color, life: o.life ?? 0.9, max: o.life ?? 0.9, vy: o.vy ?? -32, scale: o.scale ?? 1 });
  },
  beam(x1, y1, x2, y2, color, w = 3, life = 0.25) { this.beams.push({ x1, y1, x2, y2, color, w, life, max: life }); },
  addShake(v) { this.shake = Math.max(this.shake, v); },
  screenFlash(color, a = 0.6) { this.flashColor = color; this.flash = Math.max(this.flash, a); },

  update(dt) {
    const ps = this.parts;
    let w = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += p.grav * dt;
      if (p.drag) { const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vy *= f; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.bounce && p.y > GROUND_Y) { p.y = GROUND_Y; p.vy *= -0.4; p.vx *= 0.6; }
      ps[w++] = p;
    }
    ps.length = w;
    for (const t of this.texts) { t.life -= dt; t.y += t.vy * dt; t.vy *= 1 - 2 * dt; }
    this.texts = this.texts.filter(t => t.life > 0);
    for (const r of this.rings) { r.t += dt; }
    this.rings = this.rings.filter(r => r.t < r.life);
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter(b => b.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 2.5);
  },

  draw(ctx, camX) {
    for (const p of this.parts) {
      const x = p.x - camX, y = p.y;
      if (x < -30 || x > W + 30) continue;
      const t = p.life / p.max;
      if (p.type === 'smoke') {
        ctx.globalAlpha = t * 0.55;
        ctx.fillStyle = p.color;
        const s = Math.max(1, Math.round(p.size * (1.6 - t * 0.6)));
        ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
      } else if (p.type === 'flashball') {
        ctx.globalAlpha = 1;
        Glow.draw(ctx, x, y, p.size * (0.6 + (1 - t)), p.color, t * 1.4);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = t;
        const s = Math.round(p.size * 0.5 * t);
        ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
      } else if (p.type === 'spark') {
        ctx.globalAlpha = Math.min(1, t * 1.5);
        ctx.strokeStyle = p.color; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * 0.03, y - p.vy * 0.03); ctx.stroke();
      } else {
        ctx.globalAlpha = Math.min(1, t * 2);
        ctx.fillStyle = p.color;
        const s = p.size;
        ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
        if (p.glow) Glow.draw(ctx, x, y, 4 + s * 2, p.color, t * 0.5);
      }
    }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const k = r.t / r.life;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color; ctx.lineWidth = r.w;
      ctx.beginPath(); ctx.arc(r.x - camX, r.y, lerp(r.r, r.max, easeOutCubic(k)), 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const b of this.beams) {
      const k = b.life / b.max;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(b.color, k);
      ctx.lineWidth = b.w * k + 1;
      ctx.beginPath(); ctx.moveTo(b.x1 - camX, b.y1); ctx.lineTo(b.x2 - camX, b.y2); ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', k);
      ctx.lineWidth = Math.max(1, b.w * k * 0.4);
      ctx.beginPath(); ctx.moveTo(b.x1 - camX, b.y1); ctx.lineTo(b.x2 - camX, b.y2); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
  },
  drawTexts(ctx, camX) {
    for (const t of this.texts) {
      const k = t.life / t.max;
      ctx.globalAlpha = Math.min(1, k * 3);
      drawText(ctx, t.str, t.x - camX, t.y, t.color, t.scale, 'center');
    }
    ctx.globalAlpha = 1;
  },
};
