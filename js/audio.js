'use strict';
// ============================================================
//  Áudio sintetizado (WebAudio) — efeitos e música generativa
// ============================================================

const Sound = {
  ctx: null, master: null, sfx: null, music: null, noiseBuf: null,
  muted: false, last: {},
  mus: { on: false, timer: null, step: 0, nextTime: 0, mode: 'calm', biome: 'rock', pad: null, intensity: 0 },

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.7;
      this.master.connect(this.ctx.destination);
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      comp.connect(this.master);
      this.sfx = this.ctx.createGain(); this.sfx.gain.value = 0.55; this.sfx.connect(comp);
      this.music = this.ctx.createGain(); this.music.gain.value = 0.32; this.music.connect(comp);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      if (this.mus.wanted) this.startMusic(this.mus.wanted.mode, this.mus.wanted.biome);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  },

  tone({ type = 'square', f = 440, f2 = null, dur = 0.1, vol = 0.2, attack = 0.004, delay = 0, dest = null, curve = 'exp' }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
      else o.frequency.linearRampToValueAtTime(f2, t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx);
    o.start(t); o.stop(t + dur + 0.02);
  },

  noise({ dur = 0.2, vol = 0.3, f = 1200, f2 = null, type = 'lowpass', delay = 0, q = 1, dest = null }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const fl = this.ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest || this.sfx);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },

  play(name, opt = {}) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    const gap = opt.gap ?? 35;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    const v = opt.vol ?? 1;
    switch (name) {
      case 'blaster': this.tone({ type: 'square', f: 880, f2: 220, dur: 0.09, vol: 0.12 * v }); break;
      case 'shotgun': this.noise({ dur: 0.22, vol: 0.4 * v, f: 2500, f2: 300 }); this.tone({ type: 'sawtooth', f: 160, f2: 50, dur: 0.15, vol: 0.18 * v }); break;
      case 'rifle': this.tone({ type: 'sawtooth', f: 1200, f2: 400, dur: 0.05, vol: 0.08 * v }); break;
      case 'cryo': this.noise({ dur: 0.08, vol: 0.12 * v, f: 5000, type: 'highpass' }); break;
      case 'rocket': this.noise({ dur: 0.4, vol: 0.25 * v, f: 800, f2: 200 }); this.tone({ type: 'triangle', f: 300, f2: 90, dur: 0.3, vol: 0.15 * v }); break;
      case 'rail': this.tone({ type: 'sawtooth', f: 2000, f2: 60, dur: 0.45, vol: 0.2 * v }); this.tone({ type: 'sine', f: 90, f2: 40, dur: 0.4, vol: 0.3 * v }); break;
      case 'turret': this.tone({ type: 'square', f: 600, f2: 300, dur: 0.05, vol: 0.05 * v }); break;
      case 'hit': this.tone({ type: 'square', f: 300, f2: 120, dur: 0.05, vol: 0.07 * v }); break;
      case 'enemyDie': this.noise({ dur: 0.18, vol: 0.18 * v, f: 1800, f2: 200 }); this.tone({ type: 'square', f: 220, f2: 60, dur: 0.12, vol: 0.08 * v }); break;
      case 'explosion':
        this.noise({ dur: 0.7, vol: 0.55 * v, f: 1400, f2: 60 });
        this.tone({ type: 'sine', f: 120, f2: 30, dur: 0.6, vol: 0.45 * v }); break;
      case 'bigExplosion':
        this.noise({ dur: 1.6, vol: 0.7 * v, f: 900, f2: 40 });
        this.tone({ type: 'sine', f: 80, f2: 20, dur: 1.4, vol: 0.6 * v }); break;
      case 'hurt': this.tone({ type: 'sawtooth', f: 220, f2: 80, dur: 0.18, vol: 0.2 * v }); break;
      case 'pickup': this.tone({ type: 'sine', f: 900 + Math.random() * 200, f2: 1600, dur: 0.07, vol: 0.06 * v }); break;
      case 'build': this.tone({ type: 'square', f: 200, f2: 400, dur: 0.08, vol: 0.12 * v }); this.noise({ dur: 0.12, vol: 0.2 * v, f: 600, delay: 0.05 }); break;
      case 'sell': this.tone({ type: 'square', f: 500, f2: 200, dur: 0.12, vol: 0.1 * v }); break;
      case 'error': this.tone({ type: 'square', f: 140, dur: 0.12, vol: 0.1 * v }); this.tone({ type: 'square', f: 110, dur: 0.12, vol: 0.1 * v, delay: 0.1 }); break;
      case 'click': this.tone({ type: 'square', f: 700, f2: 900, dur: 0.04, vol: 0.06 * v }); break;
      case 'craft':
        [523, 659, 784, 1046].forEach((f, i) => this.tone({ type: 'square', f, dur: 0.1, vol: 0.08 * v, delay: i * 0.07 })); break;
      case 'wave':
        this.tone({ type: 'sawtooth', f: 110, f2: 220, dur: 0.6, vol: 0.18 * v, curve: 'lin' });
        this.tone({ type: 'sawtooth', f: 165, f2: 330, dur: 0.6, vol: 0.12 * v, curve: 'lin' }); break;
      case 'alarm':
        for (let i = 0; i < 4; i++) { this.tone({ type: 'square', f: 880, dur: 0.18, vol: 0.12 * v, delay: i * 0.4 }); this.tone({ type: 'square', f: 660, dur: 0.18, vol: 0.12 * v, delay: i * 0.4 + 0.2 }); } break;
      case 'win':
        [392, 523, 659, 784, 1046].forEach((f, i) => this.tone({ type: 'triangle', f, dur: 0.35, vol: 0.15 * v, delay: i * 0.12 })); break;
      case 'lose':
        [392, 330, 262, 196].forEach((f, i) => this.tone({ type: 'triangle', f, dur: 0.4, vol: 0.15 * v, delay: i * 0.2 })); break;
      case 'jump': this.tone({ type: 'square', f: 300, f2: 600, dur: 0.08, vol: 0.05 * v }); break;
      case 'dash': this.noise({ dur: 0.15, vol: 0.15 * v, f: 3000, f2: 800, type: 'bandpass' }); break;
      case 'overheat': this.noise({ dur: 0.5, vol: 0.2 * v, f: 6000, f2: 1000, type: 'highpass' }); break;
      case 'beep': this.tone({ type: 'square', f: 1400, dur: 0.05, vol: 0.06 * v }); break;
      case 'warp': this.tone({ type: 'sawtooth', f: 60, f2: 1200, dur: 1.2, vol: 0.15 * v }); this.noise({ dur: 1.2, vol: 0.2 * v, f: 300, f2: 6000, type: 'bandpass' }); break;
      case 'stomp': this.tone({ type: 'sine', f: 70, f2: 25, dur: 0.5, vol: 0.5 * v }); this.noise({ dur: 0.4, vol: 0.3 * v, f: 500, f2: 80 }); break;
      case 'roar': this.tone({ type: 'sawtooth', f: 90, f2: 50, dur: 1.2, vol: 0.3 * v }); this.noise({ dur: 1.2, vol: 0.25 * v, f: 700, f2: 200, type: 'bandpass', q: 3 }); break;
      case 'laser': this.tone({ type: 'sawtooth', f: 180, f2: 200, dur: 0.6, vol: 0.12 * v }); break;
      case 'mine': this.tone({ type: 'square', f: 1800, dur: 0.04, vol: 0.06 * v }); break;
      case 'repair': this.tone({ type: 'triangle', f: 600 + Math.random() * 300, dur: 0.04, vol: 0.04 * v }); break;
      case 'toggle': this.tone({ type: 'sine', f: 300, f2: 900, dur: 0.2, vol: 0.12 * v }); break;
      case 'drill': this.noise({ dur: 0.3, vol: 0.05 * v, f: 300, type: 'bandpass', q: 4 }); break;
    }
  },

  // ---------------- Música generativa ----------------
  SCALES: {
    rock: [0, 3, 5, 7, 10], jungle: [0, 2, 4, 7, 9], ice: [0, 2, 3, 7, 8], lava: [0, 1, 5, 7, 8],
    anomaly: [0, 2, 6, 7, 11], void: [0, 1, 3, 6, 8], core: [0, 1, 4, 6, 7], space: [0, 2, 4, 7, 11],
  },
  ROOTS: { rock: 45, jungle: 48, ice: 50, lava: 43, anomaly: 47, void: 41, core: 44, space: 48 },

  startMusic(mode, biome = 'space') {
    this.mus.wanted = { mode, biome };
    if (!this.ctx) return;
    this.mus.mode = mode; this.mus.biome = biome;
    if (this.mus.on) { this._setPad(); return; }
    this.mus.on = true; this.mus.step = 0; this.mus.nextTime = this.ctx.currentTime + 0.1;
    this._setPad();
    this.mus.timer = setInterval(() => this._schedule(), 60);
  },
  setIntensity(i) { this.mus.intensity = i; },
  stopMusic() {
    this.mus.on = false; this.mus.wanted = null;
    clearInterval(this.mus.timer);
    if (this.mus.pad) { const p = this.mus.pad; p.g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.5); setTimeout(() => p.oscs.forEach(o => o.stop()), 2000); this.mus.pad = null; }
  },
  _midi(n) { return 440 * Math.pow(2, (n - 69) / 12); },
  _setPad() {
    const ctx = this.ctx;
    if (this.mus.pad) { const p = this.mus.pad; p.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.6); setTimeout(() => p.oscs.forEach(o => { try { o.stop(); } catch (e) { } }), 2500); }
    const root = this.ROOTS[this.mus.biome] || 45;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    g.gain.setTargetAtTime(0.09, ctx.currentTime, 1.2);
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 500; fl.Q.value = 2;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 260;
    lfo.connect(lg); lg.connect(fl.frequency); lfo.start();
    const oscs = [lfo];
    [0, 7, 12].forEach((iv, i) => {
      [-6, 6].forEach(det => {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = this._midi(root - 12 + iv); o.detune.value = det + i;
        o.connect(fl); o.start(); oscs.push(o);
      });
    });
    fl.connect(g); g.connect(this.music);
    this.mus.pad = { g, oscs, fl };
  },
  _schedule() {
    if (!this.ctx || !this.mus.on) return;
    const spb = this.mus.mode === 'combat' ? 0.125 : 0.25;
    while (this.mus.nextTime < this.ctx.currentTime + 0.2) {
      const t = this.mus.nextTime - this.ctx.currentTime;
      const s = this.mus.step;
      const scale = this.SCALES[this.mus.biome] || this.SCALES.space;
      const root = this.ROOTS[this.mus.biome] || 45;
      const inten = this.mus.intensity;
      if (this.mus.mode === 'combat') {
        if (s % 8 === 0) this.tone({ type: 'sine', f: 120, f2: 40, dur: 0.25, vol: 0.35, delay: t, dest: this.music });
        if (s % 8 === 4 && inten > 0.3) this.noise({ dur: 0.12, vol: 0.12, f: 1800, type: 'bandpass', delay: t, dest: this.music });
        if (s % 2 === 1) this.noise({ dur: 0.03, vol: 0.04 + inten * 0.03, f: 8000, type: 'highpass', delay: t, dest: this.music });
        if (s % 4 === 0) {
          const n = root - 12 + scale[[0, 0, 3, 2][(s >> 4) % 4]];
          this.tone({ type: 'square', f: this._midi(n), dur: 0.2, vol: 0.05, delay: t, dest: this.music });
        }
        if (Math.random() < 0.18 + inten * 0.2) {
          const n = root + 12 + scale[randi(0, scale.length - 1)] + (Math.random() < 0.3 ? 12 : 0);
          this.tone({ type: 'triangle', f: this._midi(n), dur: 0.12, vol: 0.05, delay: t, dest: this.music });
        }
      } else {
        if (Math.random() < 0.28) {
          const n = root + 12 + scale[randi(0, scale.length - 1)] + (Math.random() < 0.25 ? 12 : 0);
          this.tone({ type: 'triangle', f: this._midi(n), dur: 0.9, vol: 0.045, delay: t, dest: this.music });
          if (Math.random() < 0.4) this.tone({ type: 'sine', f: this._midi(n + 12), dur: 1.4, vol: 0.02, delay: t + spb * 3, dest: this.music });
        }
      }
      this.mus.step++;
      this.mus.nextTime += spb;
    }
  },
};
