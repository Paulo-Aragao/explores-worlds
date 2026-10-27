'use strict';
// ============================================================
//  Controles de toque (celular / tablet)
//  - metade esquerda da tela: analógico de movimento
//  - metade direita: analógico de mira (segurar = atirar)
//  - botões virtuais para pular, esquivar, construir, itens...
//  Tudo é traduzido para as mesmas teclas/mouse que o resto do jogo usa.
// ============================================================

const TouchControls = {
  enabled: false,
  down: {}, pressed: {},
  move: null,   // { id, ox, oy, x, y }
  aim: null,    // { id, ox, oy, x, y, moved }
  build: null,  // { id } — arrastando a peça no modo construção
  angle: 0,
  lastTouchT: -1e9,
  _fsTried: false,

  BUTTONS: [
    // id, rótulo, tecla, modo (hold | tap), onde aparece
    ['jump', 'PULAR', 'Space', 'hold', 'combat'],
    ['dash', 'ESQUIVA', 'ShiftLeft', 'tap', 'combat'],
    ['weapon', 'ARMA', 'KeyQ', 'tap', 'combat'],
    ['use', 'USAR', 'KeyE', 'hold', 'combat'],
    ['repair', 'REPARAR', 'KeyR', 'hold', 'combat'],
    ['build', 'CONSTRUIR', 'KeyB', 'tap', 'any'],
    ['sell', 'DESMONTAR', 'Dismantle', 'tap', 'build'],
    ['grenade', 'GRANADA', 'KeyG', 'tap', 'combat'],
    ['medkit', 'CURA', 'KeyH', 'tap', 'combat'],
    ['repairkit', 'KIT REP.', 'KeyF', 'tap', 'combat'],
    ['wave', 'ONDA ▶', 'Enter', 'tap', 'wave'],
    ['pause', 'II', 'Escape', 'tap', 'any'],
  ],

  isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  },

  init(canvas) {
    this.canvas = canvas;
    const root = document.createElement('div');
    root.id = 'touch';
    root.className = 'hidden';
    root.innerHTML = `
      <div class="t-stick" id="t-move"><i></i></div>
      <div class="t-stick aim" id="t-aim"><i></i></div>
      ${this.BUTTONS.map(([id, label]) => `<button class="t-btn t-${id}" data-t="${id}">${label}</button>`).join('')}`;
    document.body.appendChild(root);
    const rot = document.createElement('div');
    rot.id = 'rotate';
    rot.innerHTML = '<div><div class="r-ico">⟳</div>Gire o celular para jogar na horizontal</div>';
    document.body.appendChild(rot);
    this.root = root;
    this.moveEl = root.querySelector('#t-move');
    this.aimEl = root.querySelector('#t-aim');
    this.btnEls = {};
    root.querySelectorAll('.t-btn').forEach(b => { this.btnEls[b.dataset.t] = b; });
    if (this.isTouchDevice()) document.documentElement.classList.add('touch');

    const opt = { passive: false };
    document.addEventListener('touchstart', (e) => this.onStart(e), opt);
    document.addEventListener('touchmove', (e) => this.onMove(e), opt);
    document.addEventListener('touchend', (e) => this.onEnd(e), opt);
    document.addEventListener('touchcancel', (e) => this.onEnd(e), opt);
  },

  inMission() {
    return Game.scene === 'mission' && Game.mission && !Game.paused && !Game.modalOpen() && !Game.mission.ended;
  },

  // toques sobre elementos da interface (botões, modais, slots) seguem o fluxo normal do navegador
  isUiTarget(t) {
    return t && t.closest && t.closest('#ui button, #ui .btn, #ui .slot, #ui .tab, #ui .card, #ui .sidepanel, #ui .modal-box, #ui [data-a], #ui .title-screen, #ui .intro-screen');
  },

  onStart(e) {
    this.lastTouchT = performance.now();
    if (!Input.usingTouch) { Input.usingTouch = true; Input.usingGamepad = false; }
    Sound.unlock();
    this.tryFullscreen();
    for (const t of e.changedTouches) {
      const btn = t.target.closest && t.target.closest('.t-btn');
      if (btn) { e.preventDefault(); this.pressBtn(btn, t.identifier); continue; }
      if (this.isUiTarget(t.target)) continue;
      e.preventDefault();
      if (!this.inMission()) {
        // menus e mapa estelar: o toque vira um clique do mouse
        Input._move(t);
        Input.mouse.leftPressed = true;
        continue;
      }
      const m = Game.mission;
      const left = t.clientX < window.innerWidth * 0.42;
      if (left && !this.move) {
        this.move = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY };
        this.placeStick(this.moveEl, t.clientX, t.clientY);
      } else if (m.buildMode && !this.build) {
        this.build = { id: t.identifier };
        Input._move(t);
      } else if (!left && !this.aim) {
        this.aim = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY, moved: false };
        this.placeStick(this.aimEl, t.clientX, t.clientY);
        Input.mouse.left = true;
        Input.mouse.leftPressed = true;
      }
    }
  },

  onMove(e) {
    for (const t of e.changedTouches) {
      if (this.move && t.identifier === this.move.id) { e.preventDefault(); this.move.x = t.clientX; this.move.y = t.clientY; }
      else if (this.aim && t.identifier === this.aim.id) {
        e.preventDefault();
        this.aim.x = t.clientX; this.aim.y = t.clientY;
        if (Math.hypot(this.aim.x - this.aim.ox, this.aim.y - this.aim.oy) > 8) this.aim.moved = true;
      } else if (this.build && t.identifier === this.build.id) { e.preventDefault(); Input._move(t); }
      else if (t.target.closest && t.target.closest('.t-btn')) e.preventDefault();
    }
  },

  onEnd(e) {
    for (const t of e.changedTouches) {
      if (this.move && t.identifier === this.move.id) { this.move = null; this.moveEl.classList.remove('on'); }
      if (this.aim && t.identifier === this.aim.id) { this.aim = null; this.aimEl.classList.remove('on'); Input.mouse.left = false; }
      if (this.build && t.identifier === this.build.id) {
        this.build = null;
        Input._move(t);
        if (this.inMission() && Game.mission.buildMode) Input.mouse.leftPressed = true; // soltar = construir
      }
      for (const id in this.btnEls) {
        const b = this.btnEls[id];
        if (b._touch === t.identifier) { b._touch = null; b.classList.remove('on'); delete this.down[b._key]; }
      }
    }
  },

  pressBtn(btn, touchId) {
    const def = this.BUTTONS.find(d => d[0] === btn.dataset.t);
    const [, , key, mode] = def;
    btn._key = key;
    btn._touch = touchId;
    btn.classList.add('on');
    if (key === 'Dismantle') Input.mouse.rightPressed = true;
    this.pressed[key] = true;
    if (mode === 'hold') this.down[key] = true;
    if (key === 'Space') { this.pressed.KeyW = true; }
  },

  placeStick(el, x, y) {
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.firstElementChild.style.transform = '';
    el.classList.add('on');
  },

  knob(el, s, max) {
    let dx = s.x - s.ox, dy = s.y - s.oy;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    el.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`;
    return { dx: dx / max, dy: dy / max };
  },

  tryFullscreen() {
    if (this._fsTried || !this.isTouchDevice()) return;
    this._fsTried = true;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    try {
      const p = req.call(el, { navigationUI: 'hide' });
      if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (err) {} }).catch(() => {});
    } catch (err) {}
  },

  // chamado por Input.update depois de ler o teclado
  update(dt) {
    const I = Input;
    const show = I.usingTouch && this.inMission();
    this.root.classList.toggle('hidden', !show);
    if (!show) {
      if (this.move || this.aim || this.build) { this.move = this.aim = this.build = null; I.mouse.left = false; }
      this.down = {}; this.pressed = {};
      this.moveEl.classList.remove('on'); this.aimEl.classList.remove('on');
      return;
    }
    const m = Game.mission, p = m.player;
    const active = ['prep', 'wave', 'break', 'bossWarn', 'boss'].includes(m.phase);
    const mode = m.buildMode ? 'build' : 'combat';
    for (const [id, , , , where] of this.BUTTONS) {
      const vis = where === 'any' ? active || id === 'pause'
        : where === 'wave' ? (m.phase === 'prep' || m.phase === 'break') && !m.buildMode
        : where === mode;
      this.btnEls[id].classList.toggle('hidden', !vis);
    }
    this.btnEls.build.classList.toggle('sel', m.buildMode);
    this.btnEls.build.textContent = m.buildMode ? 'SAIR' : 'CONSTRUIR';

    Object.assign(I.down, this.down);
    Object.assign(I.pressed, this.pressed);
    this.pressed = {};

    // movimento
    if (this.move) {
      const k = this.knob(this.moveEl, this.move, 40);
      if (k.dx < -0.3) I.down.KeyA = true;
      if (k.dx > 0.3) I.down.KeyD = true;
      if (k.dy > 0.65) {
        if (!this.move.drop) I.pressed.KeyS = true;
        this.move.drop = true; I.down.KeyS = true;
      } else this.move.drop = false;
      if (Math.abs(k.dx) > 0.3 && !this.aim) this.angle = k.dx > 0 ? 0 : Math.PI;
    }

    // mira (fora do modo construção)
    if (m.buildMode || !p || p.dead) return;
    if (this.aim) {
      const k = this.knob(this.aimEl, this.aim, 44);
      if (this.aim.moved && Math.hypot(k.dx, k.dy) > 0.15) this.angle = Math.atan2(k.dy, k.dx);
    }
    const sx = p.cx - m.camX, sy = p.y + 9;
    I.mouse.x = clamp(sx + Math.cos(this.angle) * 85, 4, W - 4);
    I.mouse.y = clamp(sy + Math.sin(this.angle) * 85, 4, H - 4);
  },
};
