'use strict';
// ============================================================
//  Loop principal e gerenciamento de cenas
// ============================================================

const Game = {
  scene: 'title', mission: null, paused: false, t: 0, last: 0,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    Input.init(this.canvas);
    UI.init();
    Save.load();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.toTitle();
    requestAnimationFrame((t) => this.loop(t));
  },

  resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    let s = Math.min(vw / W, vh / H);
    if (s >= 2) s = Math.max(2, Math.floor(s * 2) / 2);
    const stage = document.getElementById('stage');
    stage.style.width = Math.floor(W * s) + 'px';
    stage.style.height = Math.floor(H * s) + 'px';
    stage.style.setProperty('--u', s + 'px');
  },

  modalOpen() { return !document.getElementById('modal').classList.contains('hidden'); },

  toTitle() {
    this.scene = 'title'; this.mission = null; this.paused = false;
    FX.reset();
    UI.showTitle();
    Sound.startMusic('calm', 'space');
  },
  intro() { this.scene = 'intro'; UI.showIntro(() => this.toStarmap()); },
  toStarmap() {
    this.scene = 'starmap'; this.mission = null; this.paused = false;
    FX.reset();
    Starmap.enter();
    UI.hideHUD();
    UI.showStarmap();
  },
  startMission(w) {
    UI.fade(() => {
      this.scene = 'mission'; this.paused = false;
      UI.clearScreen();
      this.mission = new Mission(w);
      UI.showHUD(this.mission);
    }, 400);
  },
  missionEnded(res) {
    UI.hint(null);
    setTimeout(() => UI.showResults(res), 500);
  },
  ending() { this.scene = 'ending'; this.mission = null; UI.showEnding(); Sound.startMusic('calm', 'core'); },

  loop(ts) {
    const dt = Math.min(0.05, (ts - this.last) / 1000 || 0.016);
    this.last = ts;
    this.t += dt;
    try {
      Input.update(dt);
      this.update(dt);
      this.render();
    } catch (e) { console.error(e); }
    Input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  },

  update(dt) {
    if (Input.wasPressed('KeyM')) { Sound.setMuted(!Sound.muted); UI.toast(Sound.muted ? 'Som desligado' : 'Som ligado', 1); }
    switch (this.scene) {
      case 'starmap':
        if (!this.modalOpen()) Starmap.update(dt); else FX.update(dt);
        break;
      case 'mission': {
        const m = this.mission; if (!m) break;
        if (!m.ended && Input.wasPressed('Escape', 'KeyP')) {
          if (m.buildMode && Input.wasPressed('Escape') && !this.paused) m.buildMode = false;
          else if (this.paused) { UI.closeModal(); this.paused = false; }
          else { this.paused = true; m.buildMode = false; UI.showPause(m); }
        }
        if (!this.paused && !m.ended) m.update(dt);
        else if (m.ended) { FX.update(dt); m.bg.updateWeather(dt); }
        UI.updateHUD(m);
        break;
      }
    }
  },

  render() {
    const ctx = this.ctx;
    switch (this.scene) {
      case 'title': case 'intro': case 'ending': this.renderTitle(ctx); break;
      case 'starmap': Starmap.render(ctx); break;
      case 'mission': if (this.mission) this.mission.render(ctx); break;
    }
    if (Input.usingGamepad) Input.drawVirtualCursor(ctx);
  },

  renderTitle(ctx) {
    const t = this.t;
    SpaceBG.draw(ctx, t, 6);
    const biome = this.scene === 'ending' ? 'home' : 'lava';
    const r = 70, px = W * 0.78, py = H * 0.62;
    Glow.draw(ctx, px, py, r * 2.2, this.scene === 'ending' ? '#7affea' : '#ff6a2a', 0.25);
    ctx.drawImage(planetFrame(r, biome, 4242, t * 0.01, 64), Math.round(px - r), Math.round(py - r));
    const mr = 14, mx = W * 0.55 + Math.cos(t * 0.15) * 10, my = H * 0.3 + Math.sin(t * 0.15) * 4;
    ctx.drawImage(planetFrame(mr, 'ice', 77, t * 0.02, 32), Math.round(mx - mr), Math.round(my - mr));
    // nave passando
    const sx = ((t * 22) % (W + 120)) - 60, sy = H * 0.42 + Math.sin(t * 0.7) * 6;
    Glow.draw(ctx, sx - 8, sy, 10, '#7affea', 0.7);
    ctx.fillStyle = '#9aa6bf'; ctx.fillRect(Math.round(sx) - 6, Math.round(sy) - 1, 12, 3);
    ctx.fillStyle = '#e4e8f0'; ctx.fillRect(Math.round(sx) - 3, Math.round(sy) - 2, 7, 1);
    ctx.fillStyle = '#2f8fd8'; ctx.fillRect(Math.round(sx) + 3, Math.round(sy) - 1, 2, 1);
    if (Math.random() < 0.5) FX.add({ x: sx - 7, y: sy + rand(-1, 1), vx: -30, color: '#7affea', life: 0.5, size: 1, glow: true });
    FX.update(1 / 60);
    FX.draw(ctx, 0);
    // vinheta
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  },
};

window.addEventListener('load', () => Game.init());
