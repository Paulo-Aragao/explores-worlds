'use strict';
// ============================================================
//  Núcleo: constantes, matemática, input e fonte em pixel
// ============================================================

const W = 480, H = 270;          // resolução interna (pixel art)
const GROUND_Y = 214;            // linha do chão
const TILE = 16;
const GRAV = 620;                // gravidade base (px/s²)
const TAU = Math.PI * 2;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sign = (v) => (v < 0 ? -1 : 1);
const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const angleLerp = (a, b, t) => {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
};
const rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const pointInRect = (px, py, r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
const circleRect = (cx, cy, cr, r) => {
  const nx = clamp(cx, r.x, r.x + r.w), ny = clamp(cy, r.y, r.y + r.h);
  return dist2(cx, cy, nx, ny) <= cr * cr;
};
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function seededRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(lerp(v, B[i], t)));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
function shade(hex, f) { return f >= 0 ? mixHex(hex, '#ffffff', f) : mixHex(hex, '#000000', -f); }

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return c;
}

// ------------------------------------------------------------
//  Input (Teclado, Mouse e Gamepad / DualSense)
// ------------------------------------------------------------
const Input = {
  down: {}, pressed: {}, released: {},
  kbDown: {}, kbPressed: {},
  mouse: { x: W / 2, y: H / 2, left: false, right: false, leftPressed: false, rightPressed: false, wheel: 0 },
  lastPhysicalMouse: { x: -999, y: -999 },
  canvas: null,
  gamepad: null,
  usingGamepad: false,
  isPlayStation: true, // Padrão otimizado para o usuário com DualSense
  gamepadName: 'DualSense (PS5)',
  pad: null,
  padPrev: {},
  padPressed: {},
  lastAimAngle: 0,
  buildOffset: 0,
  _toastShown: false,

  init(canvas) {
    this.canvas = canvas;
    const block = ['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    window.addEventListener('keydown', (e) => {
      this.usingGamepad = false;
      if (e.target && (e.target.tagName === 'INPUT')) return;
      const k = e.code;
      if (!this.kbDown[k]) this.kbPressed[k] = true;
      this.kbDown[k] = true;
      if (block.includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.kbDown[e.code] = false;
      this.released[e.code] = true;
    });
    window.addEventListener('mousemove', (e) => {
      if (Math.hypot(e.clientX - this.lastPhysicalMouse.x, e.clientY - this.lastPhysicalMouse.y) > 4) {
        this.usingGamepad = false;
        this.lastPhysicalMouse.x = e.clientX;
        this.lastPhysicalMouse.y = e.clientY;
      }
      this._move(e);
    });
    canvas.addEventListener('mousedown', (e) => {
      this.usingGamepad = false;
      this._move(e);
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
      Sound.unlock();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      this.usingGamepad = false;
      this.mouse.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('blur', () => {
      this.kbDown = {}; this.down = {}; this.mouse.left = this.mouse.right = false;
    });
    window.addEventListener('keydown', () => Sound.unlock(), { once: true });

    window.addEventListener('gamepadconnected', (e) => {
      this._detectGamepadType(e.gamepad);
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast('🎮 ' + this.gamepadName + ' conectado! Pressione qualquer botão.', 3, 'good');
      }
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.gamepad = null;
      this.usingGamepad = false;
      this._toastShown = false;
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast('Controle desconectado', 2, 'danger');
      }
    });
  },

  _detectGamepadType(gp) {
    if (!gp) return;
    const id = (gp.id || '').toLowerCase();
    this.isPlayStation = /dualsense|wireless controller|054c|playstation|sony/i.test(id) || !/xbox|xinput/i.test(id);
    this.gamepadName = this.isPlayStation ? 'DualSense (PS5)' : (gp.id.split('(')[0].trim() || 'Controle');
  },

  _move(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left) / r.width * W;
    this.mouse.y = (e.clientY - r.top) / r.height * H;
  },

  isDown(...codes) { return codes.some(c => this.down[c]); },
  wasPressed(...codes) { return codes.some(c => this.pressed[c]); },

  rumble(weak = 0.4, strong = 0.4, duration = 120) {
    if (!this.gamepad || !this.gamepad.vibrationActuator) return;
    try {
      this.gamepad.vibrationActuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration: Math.min(1000, Math.max(20, Math.round(duration))),
        weakMagnitude: clamp(weak, 0, 1),
        strongMagnitude: clamp(strong, 0, 1),
      }).catch(() => {});
    } catch (e) {}
  },

  _readGamepad(gp) {
    if (!gp) return null;
    const isStd = gp.mapping === 'standard';
    const b = gp.buttons;
    const btn = (i) => {
      if (!b || i >= b.length || !b[i]) return false;
      return b[i].pressed || b[i].value > 0.3;
    };

    let cross = false, circle = false, square = false, triangle = false;
    let l1 = false, r1 = false, l2 = false, r2 = false;
    let create = false, options = false, l3 = false, r3 = false;
    let dpadUp = false, dpadDown = false, dpadLeft = false, dpadRight = false;

    if (isStd) {
      cross = btn(0);
      circle = btn(1);
      square = btn(2);
      triangle = btn(3);
      l1 = btn(4);
      r1 = btn(5);
      l2 = btn(6);
      r2 = btn(7);
      create = btn(8) || btn(17);
      options = btn(9);
      l3 = btn(10);
      r3 = btn(11);
      dpadUp = btn(12);
      dpadDown = btn(13);
      dpadLeft = btn(14);
      dpadRight = btn(15);
    } else {
      // DirectInput / Bluetooth nativo no Windows para DualSense
      // Mapeamento Raw HID do Windows:
      // Botão 0: Square (▢), Botão 1: Cross (✕), Botão 2: Circle (○), Botão 3: Triangle (△)
      square = btn(0);
      cross = btn(1);
      circle = btn(2);
      triangle = btn(3);
      l1 = btn(4);
      r1 = btn(5);
      l2 = btn(6);
      r2 = btn(7);
      create = btn(8) || btn(13);
      options = btn(9);
      l3 = btn(10);
      r3 = btn(11);

      if (btn(12)) dpadUp = true;
      if (btn(13)) dpadDown = true;
      if (btn(14)) dpadLeft = true;
      if (btn(15)) dpadRight = true;

      // POV Hat do D-pad (axes[9] ou axes[4])
      const axes = gp.axes || [];
      const hatIdx = axes.length > 9 ? 9 : (axes.length > 4 ? 4 : -1);
      if (hatIdx >= 0) {
        const v = axes[hatIdx];
        if (v >= -1.05 && v <= 1.05) {
          if (v < -0.85 || v > 0.85) dpadUp = true;
          if (v > -0.85 && v < 0.0) dpadRight = true;
          if (v > 0.0 && v < 0.6) dpadDown = true;
          if (v > 0.3 && v < 1.05) dpadLeft = true;
        }
      }
    }

    const deadzone = 0.16;
    const ax = (val) => (Math.abs(val) > deadzone ? val : 0);
    const lx = ax(gp.axes[0] || 0);
    const ly = ax(gp.axes[1] || 0);
    const rx = ax(gp.axes[2] || 0);
    const ry = ax((gp.axes.length > 5 && Math.abs(gp.axes[5]) > deadzone) ? gp.axes[5] : (gp.axes[3] || 0));

    return {
      cross, circle, square, triangle,
      l1, r1, l2, r2,
      create, options, l3, r3,
      dpadUp, dpadDown, dpadLeft, dpadRight,
      lx, ly, rx, ry
    };
  },

  navigateMenu(dir) {
    const modal = document.querySelector('#modal:not(.hidden)');
    const container = modal || document.querySelector('#screen') || document.body;
    const items = Array.from(container.querySelectorAll('button:not(:disabled), .btn:not(.disabled), .tab, [data-craft]:not(.disabled), [data-a]'))
      .filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
      });

    if (!items.length) return;

    let curIdx = items.findIndex(el => el.classList.contains('gp-focused') || document.activeElement === el);
    let nextIdx = 0;
    if (curIdx >= 0) {
      items[curIdx].classList.remove('gp-focused');
      nextIdx = (curIdx + dir + items.length) % items.length;
    } else {
      nextIdx = dir > 0 ? 0 : items.length - 1;
    }

    const nextEl = items[nextIdx];
    nextEl.classList.add('gp-focused');
    nextEl.focus({ preventScroll: false });
    nextEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    Sound.play('click');
    this.rumble(0.08, 0.04, 30);
  },

  clickFocused() {
    const focused = document.querySelector('.gp-focused') || document.activeElement;
    if (focused && typeof focused.click === 'function' && focused !== document.body) {
      focused.click();
      Sound.play('click');
      this.rumble(0.2, 0.1, 60);
      return true;
    }
    // Fallback: se não tiver focado, clica no primeiro botão ou elemento na posição do mouse
    this.clickElementAtMouse();
    return true;
  },

  clickElementAtMouse() {
    if (!this.canvas) return;
    const r = this.canvas.getBoundingClientRect();
    const cx = r.left + (this.mouse.x / W) * r.width;
    const cy = r.top + (this.mouse.y / H) * r.height;
    const el = document.elementFromPoint(cx, cy);
    if (el) {
      const clickTarget = el.closest('button, .btn, .tab, .slot, .card, [data-a], [data-tab], [data-craft]') || el;
      if (clickTarget && typeof clickTarget.click === 'function') {
        clickTarget.click();
        Sound.play('click');
        this.rumble(0.2, 0.1, 60);
      }
    }
  },

  drawVirtualCursor(ctx) {
    const x = Math.round(this.mouse.x), y = Math.round(this.mouse.y);
    ctx.save();
    const inCombat = typeof Game !== 'undefined' && Game.scene === 'mission' && Game.mission && !Game.mission.buildMode && !Game.paused && !Game.modalOpen();
    if (inCombat) {
      // Retículo Crosshair cibernético na missão
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - 4, y, 9, 1);
      ctx.fillRect(x, y - 4, 1, 9);
      ctx.fillStyle = '#7affea';
      ctx.fillRect(x - 4, y, 3, 1);
      ctx.fillRect(x + 2, y, 3, 1);
      ctx.fillRect(x, y - 4, 1, 3);
      ctx.fillRect(x + 2, y, 1, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 1, 1);
    } else {
      // Cursor futurista para menus, mapa estelar e modais
      Glow.draw(ctx, x + 2, y + 2, 8, '#7affea', 0.4);
      ctx.fillStyle = '#05040b';
      ctx.beginPath();
      ctx.moveTo(x + 1, y);
      ctx.lineTo(x + 8, y + 7);
      ctx.lineTo(x + 4, y + 7);
      ctx.lineTo(x + 6, y + 12);
      ctx.lineTo(x + 4, y + 13);
      ctx.lineTo(x + 2, y + 8);
      ctx.lineTo(x, y + 10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#7affea';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 6, y + 6);
      ctx.lineTo(x + 3, y + 6);
      ctx.lineTo(x + 5, y + 10);
      ctx.lineTo(x + 4, y + 11);
      ctx.lineTo(x + 2, y + 7);
      ctx.lineTo(x, y + 9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
  },

  btn(action) {
    if (!this.usingGamepad) {
      const kbMap = {
        jump: 'W / Espaço',
        dash: 'Shift',
        shoot: 'Mouse Esq.',
        aim: 'Mouse',
        nextWeapon: 'Q / Roda',
        interact: '[E]',
        repair: '[R]',
        build: '[B]',
        dismantle: 'Botão Dir.',
        grenade: '[G]',
        medkit: '[H]',
        repairkit: '[F]',
        wave: 'ENTER',
        pause: 'ESC / P',
      };
      return kbMap[action] || action;
    }
    const ps = this.isPlayStation;
    const padMap = {
      jump: ps ? '✕' : 'A',
      dash: ps ? '○ / L3' : 'B / L3',
      shoot: ps ? 'R2' : 'RT',
      aim: 'Analógico Dir.',
      nextWeapon: ps ? '△ / R1' : 'Y / RB',
      prevWeapon: ps ? 'L1' : 'LB',
      interact: ps ? '▢' : 'X',
      repair: ps ? 'L2' : 'LT',
      build: ps ? 'R3 / Touchpad' : 'R3 / Select',
      dismantle: ps ? '○' : 'B',
      grenade: 'D-Pad Cima',
      medkit: 'D-Pad Esq.',
      repairkit: 'D-Pad Dir.',
      wave: ps ? 'Touchpad / D-Pad Cima' : 'Select / D-Pad Cima',
      pause: ps ? 'Options' : 'Start',
    };
    return padMap[action] || action;
  },

  update(dt) {
    // 1. Reconstruir estado de teclas limpo do teclado
    this.down = Object.assign({}, this.kbDown);
    this.pressed = Object.assign({}, this.kbPressed);

    // 2. Leitura de Gamepad
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (let i = 0; i < gps.length; i++) {
      if (gps[i] && (gps[i].buttons?.length > 0 || gps[i].axes?.length > 0)) {
        gp = gps[i];
        break;
      }
    }
    this.gamepad = gp;
    if (!gp) return;

    this._detectGamepadType(gp);
    const pad = this._readGamepad(gp);
    if (!pad) return;

    // Detectar qualquer entrada ativa no controle
    let hasInput = false;
    for (const k in pad) {
      if (typeof pad[k] === 'boolean' && pad[k]) hasInput = true;
      else if (typeof pad[k] === 'number' && Math.abs(pad[k]) > 0.15) hasInput = true;
    }

    if (hasInput && !this.usingGamepad) {
      this.usingGamepad = true;
      Sound.unlock();
      const fgp = document.getElementById('foot-gp');
      if (fgp) fgp.innerHTML = '🎮 <b style="color:var(--cyan)">' + this.gamepadName + ' ATIVO</b> (D-Pad: navegar · ✕: confirmar)';
      if (!document.querySelector('.gp-focused')) {
        const primary = document.querySelector('.btn.primary, .btn, button');
        if (primary) primary.classList.add('gp-focused');
      }
      if (!this._toastShown && typeof UI !== 'undefined' && UI.toast) {
        this._toastShown = true;
        UI.toast('🎮 ' + this.gamepadName + ' ativo!', 2, 'good');
      }
    }

    // Calcular bordas de subida dos botões (padPressed)
    this.padPressed = {};
    for (const k in pad) {
      if (typeof pad[k] === 'boolean') {
        this.padPressed[k] = pad[k] && !this.padPrev[k];
      }
    }

    if (!this.usingGamepad) {
      this.padPrev = pad;
      return;
    }

    const inMission = typeof Game !== 'undefined' && Game.scene === 'mission' && Game.mission && !Game.paused;
    const modalOpen = typeof Game !== 'undefined' && Game.modalOpen();

    if (inMission && !modalOpen) {
      const m = Game.mission, p = m.player;

      // Movimento horizontal
      if (pad.lx < -0.25 || pad.dpadLeft) this.down['KeyA'] = true;
      if (pad.lx > 0.25 || pad.dpadRight) this.down['KeyD'] = true;

      // Descer de teto
      if (pad.ly > 0.55 || pad.dpadDown) {
        this.down['KeyS'] = true;
        if (this.padPressed.dpadDown || (pad.ly > 0.55 && !(this.padPrev.ly > 0.55))) {
          this.pressed['KeyS'] = true;
        }
      }

      // Pulo / Jetpack (Cross)
      if (pad.cross) {
        this.down['Space'] = true;
        this.down['KeyW'] = true;
      }
      if (this.padPressed.cross) {
        this.pressed['Space'] = true;
        this.pressed['KeyW'] = true;
      }

      // Dash (Circle ou L3)
      if ((this.padPressed.circle && !m.buildMode) || this.padPressed.l3) {
        this.pressed['ShiftLeft'] = true;
        this.down['ShiftLeft'] = true;
      }

      // Armas (Triangle ou R1)
      if ((this.padPressed.triangle || this.padPressed.r1) && !m.buildMode) {
        this.pressed['KeyQ'] = true;
      }
      if (this.padPressed.l1 && !m.buildMode) {
        this.mouse.wheel = -1;
      }

      // Disparo / Construir (R2)
      if (pad.r2) this.mouse.left = true;
      if (this.padPressed.r2) this.mouse.leftPressed = true;

      // Interagir (Square)
      if (pad.square) this.down['KeyE'] = true;
      if (this.padPressed.square) this.pressed['KeyE'] = true;

      // Reparar (L2)
      if (pad.l2) this.down['KeyR'] = true;
      if (this.padPressed.l2) this.pressed['KeyR'] = true;

      // Itens no D-pad (fora do modo build)
      if (!m.buildMode) {
        if (this.padPressed.dpadUp) {
          if (m.phase === 'prep' || m.phase === 'break') this.pressed['Enter'] = true;
          else this.pressed['KeyG'] = true;
        }
        if (this.padPressed.dpadLeft) this.pressed['KeyH'] = true;
        if (this.padPressed.dpadRight) this.pressed['KeyF'] = true;
      }

      // Modo Construção (R3 ou Touchpad/Create)
      if (this.padPressed.r3 || this.padPressed.create) {
        this.pressed['KeyB'] = true;
      }

      // Ações no Modo Construção
      if (m.buildMode) {
        if (this.padPressed.l1 || this.padPressed.dpadLeft) this.pressed['PrevBuild'] = true;
        if (this.padPressed.r1 || this.padPressed.dpadRight) this.pressed['NextBuild'] = true;
        if (this.padPressed.cross) this.mouse.leftPressed = true;
        if (this.padPressed.circle || this.padPressed.l2) {
          this.mouse.rightPressed = true;
          this.pressed['Dismantle'] = true;
        }
      }

      // Chamar onda no intervalo (Touchpad/Create)
      if ((m.phase === 'prep' || m.phase === 'break') && this.padPressed.create) {
        this.pressed['Enter'] = true;
      }

      // Pausa (Options)
      if (this.padPressed.options) {
        this.pressed['Escape'] = true;
      }

      // Mira analógica 360° com o analógico direito
      if (p && !p.dead) {
        const screenPx = p.cx - m.camX;
        const screenPy = p.y + 9;
        if (m.buildMode) {
          if (Math.abs(pad.rx) > 0.15) {
            this.buildOffset = clamp(this.buildOffset + pad.rx * 280 * dt, -200, 200);
          } else if (Math.abs(pad.lx) > 0.15) {
            this.buildOffset = clamp(this.buildOffset + pad.lx * 220 * dt, -200, 200);
          }
          this.mouse.x = clamp(screenPx + (this.buildOffset || (p.face * 50)), 16, W - 16);
          this.mouse.y = GROUND_Y - 16;
        } else {
          this.buildOffset = 0;
          const rMag = Math.hypot(pad.rx, pad.ry);
          if (rMag > 0.2) {
            this.lastAimAngle = Math.atan2(pad.ry, pad.rx);
            this.mouse.x = clamp(screenPx + Math.cos(this.lastAimAngle) * 85, 4, W - 4);
            this.mouse.y = clamp(screenPy + Math.sin(this.lastAimAngle) * 85, 4, H - 4);
          } else if (Math.abs(pad.lx) > 0.25) {
            const faceAngle = pad.lx > 0 ? 0 : Math.PI;
            this.lastAimAngle = faceAngle;
            this.mouse.x = clamp(screenPx + Math.cos(faceAngle) * 85, 4, W - 4);
            this.mouse.y = screenPy;
          } else if (this.lastAimAngle !== undefined) {
            this.mouse.x = clamp(screenPx + Math.cos(this.lastAimAngle) * 85, 4, W - 4);
            this.mouse.y = clamp(screenPy + Math.sin(this.lastAimAngle) * 85, 4, H - 4);
          }
        }
      }
    } else {
      // Menus, modais, mapa estelar e tela de título
      const cursorSpeed = 300;
      if (Math.abs(pad.lx) > 0.12 || Math.abs(pad.ly) > 0.12) {
        this.mouse.x = clamp(this.mouse.x + pad.lx * cursorSpeed * dt, 4, W - 4);
        this.mouse.y = clamp(this.mouse.y + pad.ly * cursorSpeed * dt, 4, H - 4);
      }

      // Navegação por foco de botões no D-Pad ou analógico esquerdo
      const navDown = this.padPressed.dpadDown || (pad.ly > 0.55 && !(this.padPrev.ly > 0.55));
      const navUp = this.padPressed.dpadUp || (pad.ly < -0.55 && !(this.padPrev.ly < -0.55));
      if (navDown) this.navigateMenu(1);
      if (navUp) this.navigateMenu(-1);

      // Confirmar / Clicar com Cross (✕) ou R2
      if (this.padPressed.cross || this.padPressed.r2) {
        this.mouse.left = true;
        this.mouse.leftPressed = true;
        this.clickFocused();
        Sound.unlock();
      }

      // Cancelar / Fechar com Circle (○)
      if (this.padPressed.circle) {
        if (modalOpen) {
          UI.closeModal();
          Sound.play('click');
        } else if (typeof Game !== 'undefined' && Game.scene === 'starmap' && Starmap.sel) {
          UI.hideSidePanel();
          Starmap.sel = null;
          Sound.play('click');
        }
      }

      // Triangle (△) abre Fabricador no Mapa Estelar
      if (this.padPressed.triangle) {
        if (typeof Game !== 'undefined' && Game.scene === 'starmap' && !modalOpen) {
          UI.showFabricator();
          Sound.play('click');
        }
      }

      // Options (Start) abre menu ou fecha modal
      if (this.padPressed.options) {
        if (modalOpen) {
          UI.closeModal();
          Sound.play('click');
        } else if (typeof Game !== 'undefined' && Game.scene === 'starmap') {
          UI.showGameMenu();
          Sound.play('click');
        } else if (inMission) {
          this.pressed['Escape'] = true;
        }
      }

      // L1 / R1 alterna abas em modais (como o Fabricador)
      if (modalOpen && (this.padPressed.l1 || this.padPressed.r1)) {
        if (typeof RECIPE_CATS !== 'undefined' && typeof UI !== 'undefined' && UI.fabTab) {
          const tabs = RECIPE_CATS.map(c => c.id);
          let curIdx = tabs.indexOf(UI.fabTab || 'armas');
          if (curIdx >= 0) {
            const nextIdx = (curIdx + (this.padPressed.r1 ? 1 : -1) + tabs.length) % tabs.length;
            UI.showFabricator(tabs[nextIdx]);
            Sound.play('click');
          }
        }
      }

      // D-Pad no Mapa Estelar pula para planetas
      if (typeof Game !== 'undefined' && Game.scene === 'starmap' && !modalOpen && !Starmap.travel) {
        if (this.padPressed.dpadUp || this.padPressed.dpadDown || this.padPressed.dpadLeft || this.padPressed.dpadRight) {
          const dirX = this.padPressed.dpadRight ? 1 : this.padPressed.dpadLeft ? -1 : 0;
          const dirY = this.padPressed.dpadDown ? 1 : this.padPressed.dpadUp ? -1 : 0;
          if (typeof Starmap.selectByDirection === 'function') {
            Starmap.selectByDirection(dirX, dirY);
          }
        }
        if (this.padPressed.square && Starmap.sel) {
          Starmap.launch(Starmap.sel);
        }
      }
    }

    this.padPrev = pad;
  },

  endFrame() {
    this.kbPressed = {};
    this.pressed = {};
    this.released = {};
    this.mouse.leftPressed = false;
    this.mouse.rightPressed = false;
    this.mouse.wheel = 0;
  },
};

// ------------------------------------------------------------
//  Fonte bitmap 3x5 para textos dentro do canvas
// ------------------------------------------------------------
const FONT = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '011', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
  'A': ['010', '101', '111', '101', '101'], 'B': ['110', '101', '110', '101', '110'],
  'C': ['011', '100', '100', '100', '011'], 'D': ['110', '101', '101', '101', '110'],
  'E': ['111', '100', '110', '100', '111'], 'F': ['111', '100', '110', '100', '100'],
  'G': ['011', '100', '101', '101', '011'], 'H': ['101', '101', '111', '101', '101'],
  'I': ['111', '010', '010', '010', '111'], 'J': ['001', '001', '001', '101', '010'],
  'K': ['101', '110', '100', '110', '101'], 'L': ['100', '100', '100', '100', '111'],
  'M': ['101', '111', '111', '101', '101'], 'N': ['110', '101', '101', '101', '101'],
  'O': ['010', '101', '101', '101', '010'], 'P': ['110', '101', '110', '100', '100'],
  'Q': ['010', '101', '101', '110', '011'], 'R': ['110', '101', '110', '101', '101'],
  'S': ['011', '100', '010', '001', '110'], 'T': ['111', '010', '010', '010', '010'],
  'U': ['101', '101', '101', '101', '111'], 'V': ['101', '101', '101', '101', '010'],
  'W': ['101', '101', '111', '111', '101'], 'X': ['101', '101', '010', '101', '101'],
  'Y': ['101', '101', '010', '010', '010'], 'Z': ['111', '001', '010', '100', '111'],
  '+': ['000', '010', '111', '010', '000'], '-': ['000', '000', '111', '000', '000'],
  '!': ['010', '010', '010', '000', '010'], '?': ['110', '001', '010', '000', '010'],
  '.': ['000', '000', '000', '000', '010'], ':': ['000', '010', '000', '010', '000'],
  '%': ['101', '001', '010', '100', '101'], '/': ['001', '001', '010', '100', '100'],
  ' ': ['000', '000', '000', '000', '000'], '[': ['110', '100', '100', '100', '110'],
  ']': ['011', '001', '001', '001', '011'], '°': ['010', '101', '010', '000', '000'],
  'x': ['000', '101', '010', '101', '000'], '(': ['010', '100', '100', '100', '010'],
  ')': ['010', '001', '001', '001', '010'], ',': ['000', '000', '000', '010', '100'],
  '<': ['001', '010', '100', '010', '001'], '>': ['100', '010', '001', '010', '100'],
  '=': ['000', '111', '000', '111', '000'], "'": ['010', '010', '000', '000', '000'],
};
const _glyphCache = new Map();
function _glyph(ch, color) {
  const key = ch + color;
  let c = _glyphCache.get(key);
  if (c) return c;
  const g = FONT[ch] || FONT['?'];
  c = makeCanvas(3, 5);
  const x = c.getContext('2d');
  x.fillStyle = color;
  for (let y = 0; y < 5; y++) for (let i = 0; i < 3; i++) if (g[y][i] === '1') x.fillRect(i, y, 1, 1);
  _glyphCache.set(key, c);
  return c;
}
function normText(t) {
  return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/X(?=\d)/g, 'x');
}
function textWidth(t, s = 1) { return normText(t).length * 4 * s - s; }
function drawText(ctx, text, x, y, color = '#fff', s = 1, align = 'left', shadow = '#000') {
  const t = normText(text);
  const w = t.length * 4 * s - s;
  let sx = align === 'center' ? Math.round(x - w / 2) : align === 'right' ? Math.round(x - w) : Math.round(x);
  y = Math.round(y);
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch !== ' ') {
      if (shadow) ctx.drawImage(_glyph(ch, shadow), sx + s, y + s, 3 * s, 5 * s);
      ctx.drawImage(_glyph(ch, color), sx, y, 3 * s, 5 * s);
    }
    sx += 4 * s;
  }
}
