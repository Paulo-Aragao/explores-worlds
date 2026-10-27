'use strict';
// ============================================================
//  Mapa estelar: navegação entre mundos
// ============================================================

const HOME = { id: 'home', name: 'Nave-Mãe Aurora', pos: [0.0, 0.46], r: 0 };
const LINKS = [
  ['home', 'terranova'], ['home', 'viridia'], ['terranova', 'viridia'],
  ['terranova', 'glacius'], ['viridia', 'pyros'], ['glacius', 'helion'], ['pyros', 'helion'],
  ['helion', 'krios'], ['helion', 'fornalha'], ['krios', 'nyx'], ['fornalha', 'nyx'], ['helion', 'nyx'], ['nyx', 'nucleo'],
];

const Starmap = {
  t: 0, sel: null, hover: null, ship: { x: 0, y: 0, a: 0 }, travel: null,

  pos(w) {
    const p = (w.id === 'home' ? HOME : w).pos;
    return { x: Math.round(18 + p[0] * (W * 0.68 - 18)), y: Math.round(34 + p[1] * (H - 78)) };
  },
  node(id) { return id === 'home' ? HOME : WORLD_BY_ID[id]; },

  enter() {
    const loc = this.node(Save.data.location) || HOME;
    const p = this.pos(loc);
    this.ship.x = p.x; this.ship.y = p.y - 16; this.travel = null;
    this.sel = null; this.hover = null;
    Sound.startMusic('calm', 'space');
    Sound.setIntensity(0);
  },

  launch(w) {
    if (this.travel) return;
    if (!worldReachable(w)) { Sound.play('error'); Input.rumble(0.2, 0.3, 120); return; }
    const from = { x: this.ship.x, y: this.ship.y }, to = this.pos(w);
    this.travel = { from, to: { x: to.x, y: to.y - 16 }, t: 0, w };
    Sound.play('warp');
    Input.rumble(0.4, 0.7, 400);
    UI.hideSidePanel();
  },

  selectByDirection(dx, dy) {
    const cur = this.sel || this.node(Save.data.location) || HOME;
    const curP = this.pos(cur);
    let best = null, bestScore = Infinity;
    for (const w of WORLDS) {
      if (w === cur) continue;
      const p = this.pos(w);
      const vX = p.x - curP.x, vY = p.y - curP.y;
      const dot = vX * dx + vY * dy;
      if (dot <= 0) continue; // direção oposta ou perpendicular
      const d = Math.hypot(vX, vY);
      const anglePenalty = 1 - (dot / (d || 1));
      const score = d + anglePenalty * 150;
      if (score < bestScore) { bestScore = score; best = w; }
    }
    if (best) {
      this.sel = best;
      const targetPos = this.pos(best);
      Input.mouse.x = targetPos.x;
      Input.mouse.y = targetPos.y;
      Sound.play('click');
      Input.rumble(0.1, 0.05, 40);
      UI.showSidePanel(this.sel);
    }
  },

  update(dt) {
    this.t += dt;
    if (this.travel) {
      const tr = this.travel;
      tr.t += dt / 1.6;
      const k = easeInOut(Math.min(1, tr.t));
      const nx = lerp(tr.from.x, tr.to.x, k), ny = lerp(tr.from.y, tr.to.y, k) - Math.sin(k * Math.PI) * 18;
      this.ship.a = Math.atan2(ny - this.ship.y, nx - this.ship.x);
      this.ship.x = nx; this.ship.y = ny;
      if (Math.random() < 0.9) FX.add({ x: nx, y: ny, vx: rand(-10, 10), vy: rand(-10, 10), color: choose(['#7affea', '#ffffff', '#2f8fd8']), size: 1, life: 0.6, glow: true });
      if (tr.t >= 1) { this.travel = null; Game.startMission(tr.w); }
      FX.update(dt);
      return;
    }
    FX.update(dt);

    // Controles por Gamepad / D-pad no mapa
    if (Input.usingGamepad) {
      if (Input.gpPressed[12]) this.selectByDirection(0, -1); // Cima
      if (Input.gpPressed[13]) this.selectByDirection(0, 1);  // Baixo
      if (Input.gpPressed[14]) this.selectByDirection(-1, 0); // Esquerda
      if (Input.gpPressed[15]) this.selectByDirection(1, 0);  // Direita
      if (Input.gpPressed[2] && this.sel && worldReachable(this.sel)) { // Quadrado / Square -> Iniciar missão
        this.launch(this.sel);
        return;
      }
      if (Input.gpPressed[3]) { // Triângulo / Triangle -> Abrir Fabricador
        UI.showCrafter();
        Sound.play('click');
        Input.rumble(0.1, 0.05, 40);
      }
      if (Input.gpPressed[1] && this.sel) { // Círculo / Circle -> Desmarcar planeta
        this.sel = null;
        UI.hideSidePanel();
        Sound.play('click');
      }
    }

    const mx = Input.mouse.x, my = Input.mouse.y;
    this.hover = null;
    for (const w of WORLDS) {
      const p = this.pos(w);
      if (dist2(mx, my, p.x, p.y) < (w.r + 5) * (w.r + 5)) this.hover = w;
    }
    if (Input.mouse.leftPressed && this.hover) {
      this.sel = this.hover; Sound.play('click');
      UI.showSidePanel(this.sel);
    }
    if (!this.travel) {
      const loc = this.node(Save.data.location) || HOME, p = this.pos(loc);
      this.ship.x = p.x + Math.cos(this.t * 0.8) * (loc.r + 10); this.ship.y = p.y + Math.sin(this.t * 0.8) * (loc.r + 6) * 0.5 - 2;
      this.ship.a = this.t * 0.8 + Math.PI / 2;
    }
  },

  render(ctx) {
    SpaceBG.draw(ctx, this.t, 1.5);
    // setores
    const sectors = [[0.0, 'SETOR 1'], [0.36, 'SETOR 2'], [0.53, 'SETOR 3'], [0.76, 'SETOR 4']];
    for (const [sx, name] of sectors) {
      const x = Math.round(18 + sx * (W * 0.68 - 18)) + (sx ? -6 : 22);
      ctx.fillStyle = 'rgba(122,255,234,0.08)'; if (sx) for (let y = 30; y < H - 40; y += 4) ctx.fillRect(x, y, 1, 2);
      drawText(ctx, name, x + 4, H - 44, 'rgba(122,255,234,0.35)', 1, 'left', null);
    }
    // rotas
    for (const [a, b] of LINKS) {
      const A = this.node(a), B = this.node(b), pa = this.pos(A), pb = this.pos(B);
      const open = (a === 'home' || worldReachable(A)) && worldReachable(B);
      ctx.strokeStyle = open ? 'rgba(122,255,234,0.35)' : 'rgba(255,255,255,0.08)';
      ctx.setLineDash(open ? [2, 2] : [1, 3]); ctx.lineDashOffset = -this.t * 6;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    // nave-mãe
    const hp = this.pos(HOME);
    Glow.draw(ctx, hp.x, hp.y, 18, '#7affea', 0.4);
    ctx.fillStyle = '#9aa6bf'; ctx.fillRect(hp.x - 6, hp.y - 2, 12, 4);
    ctx.fillStyle = '#e4e8f0'; ctx.fillRect(hp.x - 4, hp.y - 4, 8, 2); ctx.fillRect(hp.x - 1, hp.y - 8, 2, 4);
    ctx.fillStyle = '#7affea'; ctx.fillRect(hp.x - 8, hp.y, 2, 1); ctx.fillRect(hp.x + 6, hp.y, 2, 1);
    drawText(ctx, 'AURORA', hp.x, hp.y + 7, '#7affea', 1, 'center');
    // planetas
    for (const w of WORLDS) {
      const p = this.pos(w);
      const reach = worldReachable(w), done = Save.data.completed[w.id];
      const col = (PLANET_COLORS[w.biome] || PLANET_COLORS.rock)[2];
      Glow.draw(ctx, p.x, p.y, w.r * 2.6, col, reach ? 0.35 : 0.12);
      const img = planetFrame(w.r, w.biome, hashStr(w.id), this.t * 0.03 + hashStr(w.id) % 7 / 7, 40);
      ctx.globalAlpha = reach ? 1 : 0.35;
      ctx.drawImage(img, p.x - w.r, p.y - w.r);
      ctx.globalAlpha = 1;
      if (w.final) {
        ctx.strokeStyle = rgba('#fff0a0', 0.4 + Math.sin(this.t * 2) * 0.2);
        ctx.beginPath(); ctx.ellipse(p.x, p.y, w.r + 8, (w.r + 8) * 0.35, -0.3, 0, TAU); ctx.stroke();
      }
      const isSel = this.sel === w, isHover = this.hover === w;
      if (isSel || isHover) {
        ctx.strokeStyle = isSel ? '#ffe14d' : 'rgba(255,255,255,0.7)';
        ctx.setLineDash([3, 2]); ctx.lineDashOffset = this.t * 8;
        ctx.beginPath(); ctx.arc(p.x, p.y, w.r + 4, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      const label = w.name;
      drawText(ctx, label, p.x, p.y + w.r + 4, reach ? (isSel ? '#ffe14d' : '#e4e8f0') : '#6a6a80', 1, 'center');
      if (done) drawText(ctx, 'OK x' + done, p.x, p.y + w.r + 10, '#6fdc5a', 1, 'center');
      else if (!reach) drawText(ctx, 'BLOQ', p.x, p.y + w.r + 10, '#ff6a6a', 1, 'center');
      else drawText(ctx, 'NOVO', p.x, p.y + w.r + 10, Math.sin(this.t * 4) > 0 ? '#ffe14d' : '#ffb347', 1, 'center');
    }
    // nave
    FX.draw(ctx, 0);
    const s = this.ship;
    ctx.save(); ctx.translate(Math.round(s.x), Math.round(s.y)); ctx.rotate(s.a);
    Glow.draw(ctx, -4, 0, 6, '#7affea', 0.7);
    ctx.fillStyle = '#e4e8f0'; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3, -3); ctx.lineTo(-2, 0); ctx.lineTo(-3, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2f8fd8'; ctx.fillRect(0, -1, 2, 2);
    ctx.restore();
  },
};
