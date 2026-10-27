'use strict';
// ============================================================
//  Missão: pouso, preparação, ondas, chefe e extração
// ============================================================

const BIOME_WEIGHTS = {
  rock: { crawler: 4, spitter: 2, wasp: 2, brute: 1.3, bomber: 0.8 },
  jungle: { crawler: 3, spitter: 1.5, wasp: 4.5, brute: 1, bomber: 1 },
  ice: { crawler: 4.5, spitter: 2, wasp: 1.5, brute: 1.6, bomber: 0.7 },
  lava: { crawler: 3, spitter: 2.5, wasp: 1.5, brute: 2.2, bomber: 1 },
  anomaly: { crawler: 3, spitter: 2, wasp: 3, brute: 1, bomber: 2 },
  void: { crawler: 3, spitter: 2.5, wasp: 3, brute: 1.8, bomber: 1.8 },
  core: { crawler: 3, spitter: 2.5, wasp: 3, brute: 2, bomber: 2 },
};

class Mission {
  constructor(world) {
    this.world = world; this.biomeDef = BIOMES[world.biome];
    this.width = 1700;
    this.depleted = !!Save.data.completed[world.id];
    const tier = world.tier;
    this.hpMul = 1 + 0.45 * (tier - 1);
    this.dmgMul = 1 + 0.22 * (tier - 1);
    this.bossHpMul = 1 + 0.45 * (tier - 1);
    this.seed = (hashStr(world.id) + Save.data.stats.missions * 7919) >>> 0;
    FX.reset();
    this.bg = new Background(world.biome, this.width, this.seed);
    this.drill = new Drill(this, this.width / 2);
    this.player = new Player(this, this.width / 2 - 50);
    this.buildings = []; this.enemies = []; this.projs = []; this.pickups = [];
    this.escorts = [];
    this.camX = this.width / 2 - W / 2;
    this.phase = 'landing'; this.phaseT = 0; this.t = 0;
    this.wave = 0; this.waves = world.waves;
    this.spawnQueue = []; this.waveT = 0; this.waveSide = 'both';
    this.collected = {};
    this.stats = { kills: 0, built: 0, deposits: 0, time: 0 };
    this.buildMode = false; this.buildSel = 'wall';
    this.boss = null; this.bossSide = 'right';
    this.ship = { x: this.drill.x - 40, y: -50, vy: 0, visible: true };
    this.repairAcc = 0; this.drillAlertT = 0;
    this.tutorial = !Save.data.tutorialDone; this.tutStep = 0; this.tutT = 0;
    this.ended = false; this.result = null;
    this.genDeposits();
    this.gravCrush = Save.lvl('grav_mk') > 0;
    this.refundRate = Save.lvl('refund') ? 0.8 : 0.5;
    this.orbLvl = Save.lvl('orbital'); this.orbCd = this.orbLvl >= 2 ? 12 : 20; this.orbT = this.orbCd; this.strikes = [];
    const bonus = 40 * Save.lvl('logistics');
    if (bonus) Save.add('sucata', bonus);
    this.zonesDirty = true;
    this.refreshZones();
    Sound.startMusic('calm', world.biome); Sound.setIntensity(0);
  }

  genDeposits() {
    const r = seededRng(this.seed + 3);
    this.deposits = [];
    const xs = [];
    const scan = Save.lvl('scanner') > 0;
    const n = 4 + Math.floor(r() * 2) + (scan ? 2 : 0);
    for (let i = 0; i < n; i++) {
      let x, tries = 0;
      do { x = 120 + r() * (this.width - 240); tries++; } while ((Math.abs(x - this.width / 2) < 180 || xs.some(o => Math.abs(o - x) < 120)) && tries < 50);
      xs.push(x);
      const cache = i === 0;
      const res = cache ? this.world.res : (r() < 0.55 ? this.world.res : (this.world.res2 || 'ferro'));
      const amount = Math.round((cache ? 18 : 10 + r() * 8) * (1 + 0.15 * (this.world.tier - 1)) * (this.depleted ? 0.6 : 1) * (scan ? 1.3 : 1));
      this.deposits.push(new Deposit(this, Math.round(x), cache ? 'cache' : 'vein', res, amount));
    }
  }

  // ---------------- consultas de ambiente ----------------
  refreshZones() {
    this.tempZones = []; this.gravZones = [];
    for (const b of this.buildings) {
      if (b.dead) continue;
      if (b.type === 'heater' || b.type === 'cooler') this.tempZones.push(b);
      if (b.type === 'gravity') this.gravZones.push(b);
    }
  }
  tempAt(x) {
    let T = this.world.temp;
    for (const b of this.tempZones) if (Math.abs(x - b.x) <= b.radius) T += b.delta;
    return T;
  }
  gravZoneAt(x) {
    for (const b of this.gravZones) if (Math.abs(x - b.x) <= b.radius) return b.mode;
    return null;
  }
  gravAt(x) {
    let g = this.world.gravity;
    for (const b of this.gravZones) if (Math.abs(x - b.x) <= b.radius) g *= b.mode === 'heavy' ? 2.6 : 0.3;
    return g;
  }
  mouseWorld() { return { x: Input.mouse.x + this.camX, y: Input.mouse.y }; }

  // ---------------- utilitários ----------------
  addProj(p) { this.projs.push(p); }
  announce(title, sub, kind) { UI.banner(title, sub, kind); }
  toast(msg, dur = 1.6, kind) { UI.toast(msg, dur, kind); }

  collect(res, n, popup = true) {
    Save.add(res, n);
    this.collected[res] = (this.collected[res] || 0) + n;
    if (popup) Sound.play('pickup', { gap: 40 });
  }
  dropLoot(x, y, res, amount) {
    const n = Math.min(amount, res === 'sucata' ? 5 : 6);
    let left = amount;
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? left : Math.max(1, Math.round(amount / n));
      left -= v;
      if (v <= 0) break;
      this.pickups.push({ x, y, vx: rand(-60, 60), vy: rand(-140, -60), res, val: v, t: rand(0, 3), age: 0 });
    }
  }

  nearestEnemy(x, y, range) {
    let best = null, bd = range * range;
    for (const e of this.enemies) {
      if (e.dead || e.x < -4 || e.x > this.width + 4) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (this.boss && !this.boss.dead && !this.boss.dying) {
      const tp = this.boss.targetPoint();
      if (tp) { const d = dist2(x, y, tp.x, tp.y); if (d < bd) { bd = d; best = tp; } }
    }
    return best;
  }

  damageEnemy(e, dmg, o) { e.hurt(dmg, o); }

  damageDrill(d) {
    if (this.phase === 'failed' || this.phase === 'extract' || this.phase === 'landing') return;
    this.drill.hp -= d; this.drill.flash = 0.06;
    if (this.drillAlertT <= 0) {
      this.drillAlertT = 6;
      this.toast('A BROCA ESTÁ SOB ATAQUE!', 1.6, 'danger');
      Sound.play('beep');
      Input.rumble(0.5, 0.4, 180);
    }
    if (this.drill.hp <= 0) { this.drill.hp = 0; this.fail(); }
  }

  explode(x, y, r, dmg, o = {}) {
    FX.explosion(x, y, r * 0.6, o.colors, o.big);
    Sound.play('explosion', { vol: o.big ? 1 : 0.7, gap: 50 });
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = dist(x, y, e.x, e.y);
      if (d < r + e.w / 2 && o.hurtsEnemies) e.hurt(dmg * (1 - 0.5 * clamp(d / r, 0, 1)), { knock: 100, dirX: sign(e.x - x) });
    }
    const b = this.boss;
    if (b && !b.dead && o.hurtsEnemies && b.hitTest(x, y, r * 0.8)) b.damage(dmg, x, y);
    const p = this.player;
    if (o.hurtsPlayer && !p.dead) {
      const d = dist(x, y, p.cx, p.cy);
      if (d < r) p.hurt(dmg * (o.playerMul ?? 1) * (1 - 0.5 * d / r), x);
    }
    if (o.hurtsBuildings) {
      for (const bd of this.buildings) {
        if (bd.dead) continue;
        const rr = bd.type === 'ceiling' ? bd.fieldRect() : bd.rect();
        if (circleRect(x, y, r, rr)) bd.damage(dmg);
      }
      if (circleRect(x, y, r, this.drill.rect())) this.damageDrill(dmg);
    }
  }

  railShot(x, y, a, dmg, knock, color) {
    const len = 560, step = 3;
    const dx = Math.cos(a), dy = Math.sin(a);
    const hit = new Set();
    let ex = x, ey = y;
    for (let s = 0; s < len; s += step) {
      ex = x + dx * s; ey = y + dy * s;
      if (ey > GROUND_Y) break;
      for (const e of this.enemies) {
        if (e.dead || hit.has(e)) continue;
        if (pointInRect(ex, ey, e.rect())) { hit.add(e); e.hurt(dmg, { knock, dirX: sign(dx) }); FX.burst(ex, ey, 6, { color: [color, '#fff'], speed: 100, type: 'spark' }); }
      }
      const b = this.boss;
      if (b && !b.dead && !hit.has(b) && b.hitTest(ex, ey, 1)) { hit.add(b); b.damage(dmg, ex, ey); FX.burst(ex, ey, 8, { color: [color, '#fff'], speed: 120, type: 'spark' }); }
    }
    FX.beam(x, y, ex, ey, color, 4, 0.3);
    FX.burst(ex, ey, 8, { color: [color, '#ffffff'], speed: 80, glow: true, life: 0.4 });
  }

  useRepairKit() {
    for (const b of this.buildings) if (!b.dead) { b.repair(b.maxHp * 0.4); FX.burst(b.x, b.cy, 8, { color: ['#7affea', '#ffffff'], speed: 40, glow: true }); }
    this.drill.hp = Math.min(this.drill.maxHp, this.drill.hp + this.drill.maxHp * 0.15);
    FX.burst(this.drill.x, this.drill.cy, 20, { color: ['#7affea', '#ffffff'], speed: 60, glow: true });
    Sound.play('craft'); this.toast('Kit de reparo usado!');
  }

  // ---------------- eventos ----------------
  onEnemyKilled(e) {
    this.stats.kills++;
    Save.data.stats.kills++;
    this.dropLoot(e.x, e.y, 'sucata', Math.round(e.def.scrap * (1 + 0.15 * (this.world.tier - 1)) * (1 + 0.25 * Save.lvl('scavenger'))));
    const ls = Save.lvl('lifesteal'), p = this.player;
    if (ls && !p.dead) p.hp = Math.min(p.maxHp, p.hp + ls);
    if (Math.random() < 0.12) this.dropLoot(e.x, e.y, this.world.res, randi(1, 2));
  }
  onBossDying(b) {
    this.announce(b.name.toUpperCase(), 'está caindo!', 'gold');
    for (const e of this.enemies) if (!e.dead) e.hurt(9999, { silent: true });
  }
  onBossKilled(b) {
    Save.data.stats.bosses++;
    this.dropLoot(b.center().x, GROUND_Y - 30, this.world.res, Math.round((25 + 10 * this.world.tier) * (this.depleted ? 0.5 : 1)));
    this.dropLoot(b.center().x, GROUND_Y - 30, 'sucata', 40);
    if (this.world.res2) this.dropLoot(b.center().x, GROUND_Y - 30, this.world.res2, 10 + 4 * this.world.tier);
    this.setPhase('extract');
  }

  fail() {
    if (this.phase === 'failed') return;
    this.setPhase('failed');
    Input.rumble(0.9, 1.0, 600);
    FX.explosion(this.drill.x, this.drill.cy, 50, undefined, true);
    FX.screenFlash('#ff4d4d', 0.6);
    Sound.play('bigExplosion');
    this.announce('BROCA DESTRUÍDA', 'Extração fracassada — evacuando...', 'danger');
  }

  setPhase(p) {
    this.phase = p; this.phaseT = 0;
    const startKey = Input.usingGamepad ? 'TOUCHPAD ou D-PAD CIMA' : 'ENTER';
    switch (p) {
      case 'prep':
        this.prepTime = (this.tutorial ? 60 : 30) + 15 * Save.lvl('logistics');
        this.announce(this.world.name.toUpperCase(), 'Prepare as defesas · ' + startKey + ' inicia a onda', 'info');
        break;
      case 'break':
        this.prepTime = 22;
        this.announce('ONDA ' + this.wave + ' CONCLUÍDA', 'Intervalo · ' + startKey + ' chama a próxima', 'good');
        Sound.play('win', { vol: 0.6 });
        for (const pk of this.pickups) pk.magnet = true;
        Sound.startMusic('calm', this.world.biome);
        break;
      case 'wave':
        this.wave++;
        this.genWave(this.wave);
        Sound.play('wave');
        Sound.startMusic('combat', this.world.biome);
        Sound.setIntensity(this.wave / this.waves);
        break;
      case 'bossWarn':
        Sound.play('alarm');
        this.bossSide = Math.random() < 0.5 ? 'left' : 'right';
        this.announce('ALERTA: SINAL MASSIVO', BOSSES[this.world.boss].name + ' se aproxima pela ' + (this.bossSide === 'left' ? 'ESQUERDA' : 'DIREITA'), 'danger');
        for (const pk of this.pickups) pk.magnet = true;
        break;
      case 'boss':
        this.boss = makeBoss(this, this.world.boss, this.bossSide);
        Sound.play('roar'); Sound.setIntensity(1);
        FX.addShake(6);
        break;
      case 'extract':
        this.announce('EXTRAÇÃO COMPLETA', 'A nave está descendo para buscar você', 'good');
        Sound.play('win'); Sound.startMusic('calm', this.world.biome);
        for (const pk of this.pickups) pk.magnet = true;
        this.ship = { x: this.drill.x + 40, y: -60, vy: 0, visible: true };
        break;
    }
  }

  genWave(n) {
    const tier = this.world.tier;
    const level = n + (tier - 1) * 2;
    const budget = 5 + n * 4.5 + (tier - 1) * 7;
    const weights = BIOME_WEIGHTS[this.world.biome];
    const types = Object.keys(ENEMIES).filter(k => ENEMIES[k].minWave <= level - 1);
    const sides = n === 1 ? [choose(['left', 'right'])] : choose([['left'], ['right'], ['left', 'right'], ['left', 'right']]);
    this.waveSide = sides.length > 1 ? 'both' : sides[0];
    const list = [];
    let b = budget;
    while (b > 0) {
      let tot = 0; for (const t of types) tot += weights[t];
      let r = Math.random() * tot, pick = types[0];
      for (const t of types) { r -= weights[t]; if (r <= 0) { pick = t; break; } }
      list.push(pick); b -= ENEMIES[pick].cost;
    }
    const interval = clamp(1.5 - n * 0.12 - (tier - 1) * 0.1, 0.4, 1.5);
    let t = 1;
    this.spawnQueue = list.map((type, i) => {
      if (i % 5 === 4) t += interval * 2.5; // pausas entre grupos
      t += interval * rand(0.6, 1.3);
      return { t, type, side: choose(sides) };
    });
    this.waveT = 0;
    const sideTxt = this.waveSide === 'both' ? 'pelos DOIS LADOS' : 'pela ' + (this.waveSide === 'left' ? 'ESQUERDA' : 'DIREITA');
    this.announce('ONDA ' + n + '/' + this.waves, list.length + ' hostis ' + sideTxt, 'danger');
  }

  // ---------------- construção ----------------
  unlocked(type) { return Save.data.blueprints.includes(type); }
  ghost() {
    const mw = this.mouseWorld();
    const type = this.buildSel, def = BUILDINGS[type];
    const gx = Math.floor(mw.x / 8) * 8 + 4;
    let ok = true, reason = '';
    if (gx < 40 || gx > this.width - 40) { ok = false; reason = 'Fora da área'; }
    if (Math.abs(gx - this.drill.x) < 26 + def.w / 2) { ok = false; reason = 'Muito perto da broca'; }
    for (const b of this.buildings) {
      if (b.dead) continue;
      const dx = Math.abs(b.x - gx);
      if (type === 'ceiling' && b.type === 'ceiling') { if (dx < 48) { ok = false; reason = 'Sobrepõe outro teto'; } }
      else if (type === 'ceiling') { if (dx < b.def.w / 2 + 3) { ok = false; reason = 'Espaço ocupado'; } }
      else if (b.type === 'ceiling') { if (dx < def.w / 2 + 3) { ok = false; reason = 'Espaço ocupado'; } }
      else if (dx < (def.w + b.def.w) / 2) { ok = false; reason = 'Espaço ocupado'; }
    }
    for (const d of this.deposits) if (!d.done && Math.abs(d.x - gx) < 12 + def.w / 2) { ok = false; reason = 'Depósito no caminho'; }
    if (ok && !Save.has(buildCost(type))) { ok = false; reason = 'Recursos insuficientes'; }
    return { x: gx, ok, reason, type };
  }
  place() {
    const g = this.ghost();
    if (!g.ok) { this.toast(g.reason, 1, 'danger'); Sound.play('error'); return; }
    Save.spend(buildCost(g.type));
    const b = new Building(this, g.type, g.x);
    this.buildings.push(b);
    this.stats.built++;
    this.zonesDirty = true;
    Sound.play('build');
    FX.burst(g.x, GROUND_Y - 2, 12, { color: ['#ffe14d', '#ffffff', '#9aa6bf'], speed: 70, angle: -Math.PI / 2, spread: 1.3, grav: 200, life: 0.5 });
    if (this.tutorial && this.tutStep === 3 && this.phase === 'prep') this.advanceTut();
  }
  buildingAtMouse() {
    const mw = this.mouseWorld();
    for (const b of this.buildings) {
      if (b.dead) continue;
      const r = b.type === 'ceiling' ? { x: b.x - 24, y: b.canopyY - 4, w: 48, h: GROUND_Y - b.canopyY + 4 } : b.rect();
      if (pointInRect(mw.x, mw.y, { x: r.x - 2, y: r.y - 6, w: r.w + 4, h: r.h + 8 })) return b;
    }
    return null;
  }
  sell(b) {
    const k = b.hp / b.maxHp;
    for (const [res, v] of Object.entries(b.spent)) { const n = Math.floor(v * this.refundRate * k); if (n) Save.add(res, n); }
    b.destroy(true);
    this.zonesDirty = true;
    FX.burst(b.x, b.cy, 12, { color: ['#ffe14d', '#9aa6bf'], speed: 60 });
    Sound.play('sell');
    this.toast(b.def.name + ' desmontada (+' + Math.round(this.refundRate * 100) + '% recursos)', 1.2);
  }

  cycleBuild(dir) {
    const list = BUILD_ORDER.filter(t => this.unlocked(t));
    if (!list.length) return;
    let idx = list.indexOf(this.buildSel);
    if (idx < 0) idx = 0;
    else idx = (idx + dir + list.length) % list.length;
    this.buildSel = list[idx];
    Sound.play('click');
    Input.rumble(0.12, 0.05, 40);
  }

  // ---------------- tutorial ----------------
  advanceTut() {
    this.tutStep++; this.tutT = 0;
    const pad = Input.usingGamepad;
    const steps = pad ? [
      'Mova com <b>Analógico Esquerdo</b>, pule com <b>✕</b> e esquive com <b>○ ou L3</b>.',
      'Mire com o <b>Analógico Direito</b> e atire com <b>R2</b>. Troque de arma com <b>△ ou R1</b>.',
      'Pressione <b>R3 ou Touchpad</b> para construir. Escolha com <b>L1/R1</b> e aperte <b>R2</b> para posicionar.',
      'Segure <b>▢</b> perto de veios para extrair. Segure <b>L2</b> perto de construções para reparar.',
      'Quando estiver pronto, pressione <b>Touchpad ou D-pad Cima</b> para chamar a onda. Boa sorte!',
    ] : [
      'Mova com <b>A/D</b>, pule com <b>W/Espaço</b> e esquive com <b>Shift</b>.',
      'Mire com o <b>mouse</b> e <b>clique</b> para atirar. <b>Q</b> ou a roda do mouse trocam de arma.',
      'Pressione <b>B</b> para o modo construção. Escolha com <b>1-7</b> e clique para posicionar. Proteja a <b>BROCA</b>!',
      'Segure <b>E</b> perto de veios brilhantes para extrair. Segure <b>R</b> perto de construções para reparar (custa sucata).',
      'Quando estiver pronto, pressione <b>ENTER</b> para chamar a primeira onda. Boa sorte, explorador!',
    ];
    if (this.tutStep - 1 < steps.length) UI.hint(steps[this.tutStep - 1]);
    else UI.hint(null);
  }

  // ---------------- loop ----------------
  update(dt) {
    if (this.ended) return;
    this.t += dt; this.phaseT += dt; this.stats.time += dt;
    this.drillAlertT -= dt;
    if (this.zonesDirty || (Math.floor(this.t * 10) % 5 === 0)) { this.refreshZones(); this.zonesDirty = false; }
    const I = Input, p = this.player;
    const active = ['prep', 'wave', 'break', 'bossWarn', 'boss'].includes(this.phase);

    // ----- entradas de construção -----
    if (active || this.phase === 'extract') {
      if (I.wasPressed('KeyB', 'Tab') && active) { this.buildMode = !this.buildMode; Sound.play('click'); }
      if (this.buildMode) {
        BUILD_ORDER.forEach((t, i) => {
          if (I.wasPressed('Digit' + (i + 1))) {
            if (this.unlocked(t)) { this.buildSel = t; Sound.play('click'); }
            else { this.toast('Projeto bloqueado — fabrique no Fabricador', 1.4, 'danger'); Sound.play('error'); }
          }
        });
        if (I.wasPressed('PrevBuild')) this.cycleBuild(-1);
        if (I.wasPressed('NextBuild')) this.cycleBuild(1);
        if (I.mouse.leftPressed) this.place();
        if (I.mouse.rightPressed || I.wasPressed('Dismantle')) {
          const b = this.buildingAtMouse();
          if (b) { this.sell(b); I.rumble(0.2, 0.25, 90); }
          else this.buildMode = false;
        }
        if (!active) this.buildMode = false;
      } else if (I.mouse.rightPressed && active) { this.buildMode = true; Sound.play('click'); }
    }

    // ----- fases -----
    switch (this.phase) {
      case 'landing': this.updateLanding(dt); break;
      case 'prep': case 'break':
        if (this.tutorial && this.phase === 'prep') {
          this.tutT += dt;
          if (this.tutStep === 1 && (this.tutT > 7 || Math.abs(p.vx) > 50 && this.tutT > 3)) this.advanceTut();
          else if (this.tutStep === 2 && (this.tutT > 9 || (this.tutT > 3 && Input.mouse.left))) this.advanceTut();
          else if (this.tutStep === 3 && this.tutT > 16) this.advanceTut();
          else if (this.tutStep === 4 && this.tutT > 10) this.advanceTut();
        }
        if (this.phaseT >= this.prepTime || I.wasPressed('Enter', 'NumpadEnter')) {
          const left = Math.max(0, this.prepTime - this.phaseT);
          if (left > 2) { const bonus = Math.floor(left * 0.6); if (bonus > 0) { this.collect('sucata', bonus); this.toast('Bônus de antecipação: +' + bonus + ' sucata', 1.6); } }
          if (this.tutorial && this.phase === 'prep') { UI.hint(null); this.tutStep = 99; }
          this.setPhase('wave');
        }
        break;
      case 'wave': {
        this.waveT += dt;
        while (this.spawnQueue.length && this.spawnQueue[0].t <= this.waveT) {
          const s = this.spawnQueue.shift();
          this.enemies.push(new Enemy(this, s.type, s.side, { hpMul: 1 + 0.07 * (this.wave - 1) }));
        }
        if (!this.spawnQueue.length && !this.enemies.some(e => !e.dead)) {
          if (this.wave >= this.waves) this.setPhase('bossWarn');
          else this.setPhase('break');
        }
        break;
      }
      case 'bossWarn':
        if (this.phaseT > 3.8) this.setPhase('boss');
        break;
      case 'boss':
        if (this.boss) this.boss.update(dt);
        break;
      case 'extract': this.updateExtract(dt); break;
      case 'failed':
        if (Math.random() < 0.2) FX.explosion(this.drill.x + rand(-25, 25), GROUND_Y - rand(5, 40), rand(8, 18));
        if (this.phaseT > 4) this.finish(false);
        break;
    }
    if (this.boss && this.phase !== 'boss' && this.boss.dying > 0 && !this.boss.dead) this.boss.update(dt);

    // ----- entidades -----
    if ((this.phase !== 'landing' || this.playerOut) && !(this.phase === 'extract' && this.phaseT > 2.2)) p.update(dt);
    for (const e of this.escorts) e.update(dt);
    this.drill.update(dt, active);
    for (const b of this.buildings) b.update(dt);
    if (this.buildings.some(b => b.dead)) { this.buildings = this.buildings.filter(b => !b.dead); this.zonesDirty = true; }
    for (const e of this.enemies) if (!e.dead) e.update(dt);
    this.enemies = this.enemies.filter(e => !e.dead);
    for (const pr of this.projs) pr.update(dt, this);
    this.projs = this.projs.filter(pr => !pr.dead);
    this.updatePickups(dt);
    for (const d of this.deposits) d.update(dt);
    if (active && !p.dead) this.updateInteractions(dt);
    if (this.orbLvl) this.updateOrbital(dt);
    FX.update(dt);
    this.bg.updateWeather(dt);

    // ----- câmera -----
    let tx;
    if (this.phase === 'landing' || this.phase === 'failed') tx = this.drill.x - W / 2;
    else if (p.dead) tx = this.drill.x - W / 2;
    else tx = p.cx - W / 2 + (Input.mouse.x - W / 2) * 0.28;
    this.camX = lerp(this.camX, clamp(tx, 0, this.width - W), Math.min(1, dt * 5));
  }

  updateLanding(dt) {
    const s = this.ship, t = this.phaseT;
    const hoverY = GROUND_Y - 120;
    if (t < 1.4) s.y = lerp(-50, hoverY, easeOutCubic(t / 1.4));
    else if (t > 2.4) s.y = lerp(hoverY, -80, easeInOut(clamp((t - 2.4) / 1.2, 0, 1)));
    if (t > 1.3 && !this.drillDropped) { this.drillDropped = true; this.drill.held = false; this.drill.dropY = (s.y + 54) - GROUND_Y; }
    if (t > 1.9 && !this.playerOut) {
      this.playerOut = true;
      this.player.x = s.x - 5; this.player.y = hoverY + 10; this.player.vy = -60; this.player.vx = -40;
    }
    if (t > 3.6) {
      s.visible = false;
      const n = Save.lvl('escort');
      for (let i = 0; i < n; i++) this.escorts.push(new Escort(this, i));
      this.setPhase('prep');
      if (this.tutorial) this.advanceTut();
    }
  }

  updateExtract(dt) {
    const s = this.ship, t = this.phaseT, p = this.player;
    const hoverY = GROUND_Y - 110;
    if (t < 2) s.y = lerp(-60, hoverY, easeOutCubic(t / 2));
    if (t > 2.2 && !p.dead) {
      // nave puxa o jogador com um raio trator
      p.x = lerp(p.x, s.x - 5, dt * 2); p.y = lerp(p.y, hoverY, dt * 1.2); p.vy = 0;
      if (Math.random() < 0.6) FX.add({ x: s.x + rand(-8, 8), y: rand(hoverY, GROUND_Y), vy: -60, color: '#7affea', life: 0.6, size: 1, glow: true });
    }
    if (t > 5.2) s.y = lerp(hoverY, -100, easeInOut(clamp((t - 5.2) / 1, 0, 1)));
    if (t > 6.4) this.finish(true);
  }

  updatePickups(dt) {
    const p = this.player;
    for (const k of this.pickups) {
      k.t += dt; k.age += dt;
      const d = p.dead ? 999 : dist(k.x, k.y, p.cx, p.cy);
      if (!p.dead && (k.magnet || d < p.magnet) && k.age > 0.35) {
        const a = Math.atan2(p.cy - k.y, p.cx - k.x), sp = 160 + (k.magnet ? 160 : 0) + 3000 / Math.max(10, d);
        k.vx = lerp(k.vx, Math.cos(a) * sp, Math.min(1, dt * 8)); k.vy = lerp(k.vy, Math.sin(a) * sp, Math.min(1, dt * 8));
        k.x += k.vx * dt; k.y += k.vy * dt;
        if (d < 8) {
          k.got = true; this.collect(k.res, k.val);
          FX.text(p.cx, p.y - 8, '+' + k.val + ' ' + RES[k.res].name, RES[k.res].color, { life: 0.8, vy: -24 });
        }
      } else {
        k.vy += GRAV * 0.8 * dt; k.x += k.vx * dt; k.y += k.vy * dt;
        if (k.y > GROUND_Y - 3) { k.y = GROUND_Y - 3; k.vy *= -0.35; k.vx *= 0.6; }
      }
      k.x = clamp(k.x, 4, this.width - 4);
    }
    this.pickups = this.pickups.filter(k => !k.got);
  }

  updateInteractions(dt) {
    const p = this.player, I = Input;
    this.prompt = null;
    const ePrompt = I.usingGamepad ? '[' + I.btn('interact') + ']' : '[E]';
    const rPrompt = I.usingGamepad ? '[' + I.btn('repair') + ']' : '[R]';
    // depósitos
    let dep = null;
    for (const d of this.deposits) if (!d.done && Math.abs(d.x - p.cx) < 18 && p.onGround) dep = d;
    let grav = null;
    for (const b of this.buildings) if (b.type === 'gravity' && !b.dead && Math.abs(b.x - p.cx) < 18) grav = b;
    if (dep) {
      this.prompt = { x: dep.x, y: GROUND_Y - 30, text: ePrompt + ' ' + (dep.kind === 'cache' ? 'ABRIR CAPSULA' : 'EXTRAIR') };
      if (I.isDown('KeyE')) {
        dep.extract(dt);
        if (I.usingGamepad && Math.random() < 0.25) I.rumble(0.1, 0.05, 50);
      }
    } else if (grav) {
      this.prompt = { x: grav.x, y: GROUND_Y - 48, text: ePrompt + ' GRAVIDADE ' + (grav.mode === 'heavy' ? 'BAIXA' : 'ALTA') };
      if (I.wasPressed('KeyE')) {
        grav.mode = grav.mode === 'heavy' ? 'light' : 'heavy';
        Sound.play('toggle');
        I.rumble(0.18, 0.1, 90);
        FX.burst(grav.x, GROUND_Y - 30, 14, { color: ['#b07cff', '#ffffff'], speed: 80, glow: true });
      }
    }
    // reparo
    let rep = null, rd = 34;
    for (const b of this.buildings) {
      if (b.dead || b.hp >= b.maxHp) continue;
      const d = Math.abs(b.x - p.cx);
      if (d < rd) { rd = d; rep = b; }
    }
    if (!rep && this.drill.hp < this.drill.maxHp && Math.abs(this.drill.x - p.cx) < 36) rep = this.drill;
    if (rep && !this.prompt) this.prompt = { x: rep.x, y: rep === this.drill ? GROUND_Y - 66 : (rep.type === 'ceiling' ? rep.canopyY - 12 : GROUND_Y - rep.def.h - 12), text: rPrompt + ' REPARAR' };
    if (rep && I.isDown('KeyR')) {
      if ((Save.data.inv.sucata || 0) <= 0) {
        if (I.wasPressed('KeyR')) { this.toast('Sem sucata para reparar', 1, 'danger'); Sound.play('error'); I.rumble(0.2, 0.3, 100); }
      } else {
        const amt = 70 * dt;
        if (rep === this.drill) this.drill.hp = Math.min(this.drill.maxHp, this.drill.hp + amt);
        else rep.repair(amt);
        this.repairAcc += amt;
        while (this.repairAcc >= 10) { this.repairAcc -= 10; Save.data.inv.sucata = Math.max(0, Save.data.inv.sucata - 1); }
        if (Math.random() < 0.5) FX.burst(rep.x + rand(-6, 6), (rep.cy || GROUND_Y - 20) + rand(-6, 6), 1, { color: ['#7affea', '#ffe14d'], speed: 60, type: 'spark', life: 0.3 });
        Sound.play('repair', { gap: 70 });
        if (I.usingGamepad && Math.random() < 0.3) I.rumble(0.12, 0.05, 50);
        FX.beam(p.cx, p.y + 8, rep.x + rand(-4, 4), (rep.cy || GROUND_Y - 20), '#7affea', 1, 0.05);
      }
    }
  }

  // ---------------- satélite de ataque ----------------
  updateOrbital(dt) {
    for (const st of this.strikes) {
      st.t += dt;
      if (st.t >= 0.8 && !st.hit) {
        st.hit = true;
        const dmg = this.orbLvl >= 2 ? 190 : 120;
        this.explode(st.x, GROUND_Y - 6, 42, dmg, { hurtsEnemies: true, colors: ['#ffffff', '#7affea', '#2f8fd8', '#b07cff'], big: true });
        FX.beam(st.x, -10, st.x, GROUND_Y, '#7affea', 10, 0.45);
        FX.screenFlash('#7affea', 0.25);
      }
    }
    this.strikes = this.strikes.filter(st => st.t < 1.3);
    if (this.phase !== 'wave' && this.phase !== 'boss') return;
    this.orbT -= dt;
    if (this.orbT > 0) return;
    // escolhe o ponto com mais inimigos por perto
    let best = null, bestN = 0;
    for (const e of this.enemies) {
      if (e.dead || e.x < 0 || e.x > this.width) continue;
      let n = 0;
      for (const o of this.enemies) if (!o.dead && Math.abs(o.x - e.x) < 40) n++;
      if (n > bestN) { bestN = n; best = e.x; }
    }
    if (best === null && this.boss && !this.boss.dead && !this.boss.dying) { const tp = this.boss.targetPoint(); if (tp) best = tp.x; }
    if (best === null) { this.orbT = 1; return; }
    this.orbT = this.orbCd;
    this.strikes.push({ x: best, t: 0, hit: false });
    Sound.play('laser');
  }
  drawStrike(ctx, camX, st) {
    const x = st.x - camX;
    if (st.t < 0.8) {
      const k = st.t / 0.8;
      ctx.strokeStyle = rgba('#ff4d4d', 0.5 + Math.sin(st.t * 40) * 0.3); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, GROUND_Y, 42 * (1.2 - k * 0.2), 6, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = rgba('#7affea', 0.15 + k * 0.3); ctx.fillRect(Math.round(x) - 1, 0, 2, GROUND_Y);
    }
  }

  finish(success) {
    if (this.ended) return;
    this.ended = true;
    const sd = Save.data, w = this.world;
    sd.stats.missions++;
    sd.tutorialDone = true;
    const res = { success, world: w, collected: Object.assign({}, this.collected), stats: Object.assign({}, this.stats), lost: {}, bonus: {}, firstClear: false, wave: this.wave };
    if (success) {
      sd.stats.success++;
      const mul = (1 + 0.25 * Save.lvl('cargo')) * (this.depleted ? 0.5 : 1);
      const bonus = { [w.res]: Math.round((30 + 12 * w.tier) * mul) };
      bonus.ferro = (bonus.ferro || 0) + Math.round(15 * mul);
      for (const [k, v] of Object.entries(bonus)) { Save.add(k, v); res.collected[k] = (res.collected[k] || 0) + v; }
      res.bonus = bonus;
      if (!sd.completed[w.id]) { res.firstClear = true; sd.completed[w.id] = 1; }
      else sd.completed[w.id]++;
      if (w.final) sd.won = true;
    } else {
      for (const [k, v] of Object.entries(this.collected)) {
        const lose = Math.min(Math.floor(v * 0.5), sd.inv[k] || 0);
        sd.inv[k] -= lose; res.lost[k] = lose;
      }
    }
    sd.location = w.id;
    Save.save();
    this.result = res;
    Sound.play(success ? 'win' : 'lose');
    Game.missionEnded(res);
  }

  abandon() {
    if (this.ended) return;
    this.finish(false);
  }

  // ---------------- desenho ----------------
  render(ctx) {
    const sh = FX.shake;
    const ox = sh ? Math.round(rand(-sh, sh)) : 0, oy = sh ? Math.round(rand(-sh, sh)) : 0;
    const camX = Math.round(this.camX);
    ctx.save();
    ctx.translate(ox, oy);
    this.bg.drawBack(ctx, camX, this.t);
    for (const b of this.buildings) b.drawZone(ctx, camX);
    this.bg.drawTerrain(ctx, camX);
    for (const d of this.deposits) d.draw(ctx, camX);
    this.drill.draw(ctx, camX);
    for (const b of this.buildings) if (b.type === 'ceiling') b.draw(ctx, camX);
    for (const b of this.buildings) if (b.type !== 'ceiling') b.draw(ctx, camX);
    if (this.boss && !this.boss.dead && this.boss.type === 'worm') this.boss.draw(ctx, camX);
    for (const e of this.enemies) if (!e.air || e.pulled) e.draw(ctx, camX);
    this.drawPickups(ctx, camX);
    if (this.phase !== 'landing' || this.playerOut) this.player.draw(ctx, camX);
    for (const e of this.escorts) e.draw(ctx, camX);
    for (const e of this.enemies) if (e.air && !e.pulled) e.draw(ctx, camX);
    if (this.boss && !this.boss.dead && this.boss.type !== 'worm') this.boss.draw(ctx, camX);
    if (this.ship.visible) this.drawShip(ctx, camX);
    for (const pr of this.projs) pr.draw(ctx, camX);
    for (const st of this.strikes) this.drawStrike(ctx, camX, st);
    FX.draw(ctx, camX);
    this.bg.drawWeather(ctx, camX);
    if (this.buildMode) this.drawBuildGhost(ctx, camX);
    FX.drawTexts(ctx, camX);
    if (this.prompt && !this.buildMode) {
      const bob = Math.sin(this.t * 5) * 1.5;
      drawText(ctx, this.prompt.text, this.prompt.x - camX, this.prompt.y + bob, '#ffe14d', 1, 'center');
    }
    ctx.restore();
    this.drawOverlay(ctx, camX);
  }

  drawPickups(ctx, camX) {
    for (const k of this.pickups) {
      const x = k.x - camX;
      if (x < -10 || x > W + 10) continue;
      const img = resIcon(k.res);
      const bob = Math.sin(k.t * 5) * 1;
      Glow.draw(ctx, x, k.y + bob, 7, RES[k.res].color, 0.45);
      ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(k.y - img.height / 2 + bob));
    }
  }

  drawShip(ctx, camX) {
    const s = this.ship, x = Math.round(s.x - camX), y = Math.round(s.y);
    // chamas
    Glow.draw(ctx, x - 12, y + 12, 14, '#7affea', 0.7);
    Glow.draw(ctx, x + 12, y + 12, 14, '#7affea', 0.7);
    if (Math.random() < 0.8) {
      FX.add({ x: s.x - 12 + rand(-2, 2), y: s.y + 12, vy: rand(80, 140), vx: rand(-10, 10), color: choose(['#7affea', '#ffffff']), life: 0.3, size: 2, glow: true });
      FX.add({ x: s.x + 12 + rand(-2, 2), y: s.y + 12, vy: rand(80, 140), vx: rand(-10, 10), color: choose(['#7affea', '#ffffff']), life: 0.3, size: 2, glow: true });
    }
    ctx.fillStyle = '#14101e';
    ctx.beginPath(); ctx.moveTo(x - 26, y + 6); ctx.lineTo(x - 18, y - 6); ctx.lineTo(x + 16, y - 8); ctx.lineTo(x + 30, y + 2); ctx.lineTo(x + 24, y + 10); ctx.lineTo(x - 22, y + 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9aa6bf';
    ctx.beginPath(); ctx.moveTo(x - 24, y + 5); ctx.lineTo(x - 17, y - 5); ctx.lineTo(x + 15, y - 7); ctx.lineTo(x + 28, y + 2); ctx.lineTo(x + 23, y + 9); ctx.lineTo(x - 21, y + 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e4e8f0'; ctx.fillRect(x - 16, y - 5, 30, 2);
    ctx.fillStyle = '#4b5674'; ctx.fillRect(x - 22, y + 5, 46, 4);
    ctx.fillStyle = '#2f8fd8'; ctx.fillRect(x + 12, y - 4, 10, 4);
    ctx.fillStyle = '#a8f0ff'; ctx.fillRect(x + 14, y - 4, 4, 1);
    ctx.fillStyle = '#f08a3c'; ctx.fillRect(x - 10, y + 1, 14, 2);
    ctx.fillStyle = '#14101e'; ctx.fillRect(x - 15, y + 9, 6, 4); ctx.fillRect(x + 9, y + 9, 6, 4);
    const blink = Math.floor(this.t * 3) % 2;
    ctx.fillStyle = blink ? '#ff4d4d' : '#6fdc5a'; ctx.fillRect(x - 25, y + 5, 2, 2); ctx.fillRect(x + 28, y + 1, 2, 2);
  }

  drawBuildGhost(ctx, camX) {
    const g = this.ghost();
    const def = BUILDINGS[g.type];
    const x = g.x - camX;
    const col = g.ok ? '#6fdc5a' : '#ff4d4d';
    // grade de chão
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = Math.floor(camX / 8) * 8; i < camX + W; i += 8) ctx.fillRect(i - camX, GROUND_Y, 1, 2);
    // fantasma
    const fake = new Building(this, g.type, g.x);
    fake.buildT = 1;
    ctx.globalAlpha = 0.55;
    fake.draw(ctx, camX);
    ctx.globalAlpha = 1;
    const r = g.type === 'ceiling' ? { x: g.x - 24, y: GROUND_Y - CANOPY_H - 2, w: 48, h: CANOPY_H + 2 } : { x: g.x - def.w / 2, y: GROUND_Y - def.h, w: def.w, h: def.h };
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(r.x - camX) + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    // alcance
    ctx.setLineDash([2, 3]);
    if (g.type === 'turret') { ctx.strokeStyle = rgba(col, 0.6); ctx.beginPath(); ctx.arc(x, GROUND_Y - 22, fake.range, 0, TAU); ctx.stroke(); }
    if (g.type === 'mine') { ctx.strokeStyle = rgba('#ff9a4a', 0.7); ctx.beginPath(); ctx.arc(x, GROUND_Y - 4, fake.radius, Math.PI, TAU); ctx.stroke(); }
    if (g.type === 'heater' || g.type === 'cooler' || g.type === 'gravity') {
      ctx.strokeStyle = rgba(g.type === 'heater' ? '#ff7a2a' : g.type === 'cooler' ? '#4ad8ff' : '#b07cff', 0.8);
      ctx.strokeRect(Math.round(x - fake.radius) + 0.5, 20.5, Math.round(fake.radius * 2), GROUND_Y - 20);
    }
    if (g.type === 'ceiling') { ctx.strokeStyle = rgba('#7affea', 0.6); ctx.strokeRect(Math.round(x - 24) + 0.5, 8.5, 48, GROUND_Y - CANOPY_H - 8); }
    ctx.setLineDash([]);
    if (!g.ok) drawText(ctx, g.reason, x, r.y - 10, '#ff6a6a', 1, 'center');
    // modo venda
    const hb = this.buildingAtMouse();
    if (hb) {
      const k = hb.hp / hb.maxHp;
      const refund = Object.entries(hb.spent).map(([res, v]) => Math.floor(v * this.refundRate * k) + ' ' + RES[res].name).join(' ');
      const tip = Input.usingGamepad ? '[' + Input.btn('dismantle') + '] DESMONTAR (' + refund + ')' : 'BOTAO DIREITO: DESMONTAR (' + refund + ')';
      drawText(ctx, tip, W / 2, H - 70, '#ffcf5a', 1, 'center');
    }
  }

  drawOverlay(ctx, camX) {
    // vinheta e alerta térmico
    const p = this.player;
    if (!p.dead && p.tempExcess) {
      const cold = p.tempExcess < 0;
      const k = clamp(Math.abs(p.tempExcess) / 60, 0.25, 0.8) * (0.8 + Math.sin(this.t * 6) * 0.2);
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.9);
      g.addColorStop(0, rgba(cold ? '#6fe8ff' : '#ff6a2a', 0)); g.addColorStop(1, rgba(cold ? '#6fe8ff' : '#ff6a2a', k * 0.6));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (!p.dead && p.hp < p.maxHp * 0.3) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.95);
      g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,0,0,${0.25 + Math.sin(this.t * 8) * 0.1})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (!this._vign) {
      this._vign = makeCanvas(W, H);
      const x = this._vign.getContext('2d');
      const g = x.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.0);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    }
    ctx.drawImage(this._vign, 0, 0);
    if (FX.flash > 0) { ctx.globalAlpha = FX.flash; ctx.fillStyle = FX.flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }

    // indicadores de inimigos fora da tela
    let leftN = 0, rightN = 0;
    for (const e of this.enemies) { if (e.dead) continue; if (e.x < camX) leftN++; else if (e.x > camX + W) rightN++; }
    const bp = Math.sin(this.t * 8) > 0;
    if (leftN) { drawText(ctx, '<' + leftN, 4, H / 2 - 20, bp ? '#ff4d4d' : '#ff9a9a', 2); }
    if (rightN) { drawText(ctx, rightN + '>', W - 4, H / 2 - 20, bp ? '#ff4d4d' : '#ff9a9a', 2, 'right'); }
    if (this.drill.x < camX - 10 || this.drill.x > camX + W + 10) {
      const left = this.drill.x < camX;
      drawText(ctx, left ? '< BROCA' : 'BROCA >', left ? 4 : W - 4, H / 2, '#7affea', 1, left ? 'left' : 'right');
    }

    // minimapa
    const mmW = 160, mmX = Math.round(W / 2 - mmW / 2), mmY = 22, sc = mmW / this.width;
    ctx.fillStyle = 'rgba(5,6,14,0.75)'; ctx.fillRect(mmX - 1, mmY - 1, mmW + 2, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(mmX + Math.round(camX * sc), mmY - 1, Math.round(W * sc), 8);
    for (const tz of this.tempZones) { ctx.fillStyle = tz.delta > 0 ? 'rgba(255,122,42,0.5)' : 'rgba(74,216,255,0.5)'; ctx.fillRect(mmX + Math.round((tz.x - tz.radius) * sc), mmY + 5, Math.max(1, Math.round(tz.radius * 2 * sc)), 1); }
    for (const d of this.deposits) if (!d.done) { ctx.fillStyle = RES[d.res].color; ctx.fillRect(mmX + Math.round(d.x * sc), mmY + 4, 1, 2); }
    for (const b of this.buildings) { ctx.fillStyle = '#9aa6bf'; ctx.fillRect(mmX + Math.round(b.x * sc), mmY + 3, 1, 2); }
    ctx.fillStyle = '#7affea'; ctx.fillRect(mmX + Math.round(this.drill.x * sc) - 1, mmY + 1, 3, 4);
    for (const e of this.enemies) { if (e.dead) continue; ctx.fillStyle = '#ff4d4d'; ctx.fillRect(mmX + Math.round(clamp(e.x, 0, this.width) * sc), mmY + (e.air && !e.pulled ? 1 : 4), 1, 1); }
    if (this.boss && !this.boss.dead) { const c = this.boss.center(); ctx.fillStyle = bp ? '#ff4dff' : '#ffffff'; ctx.fillRect(mmX + Math.round(clamp(c.x, 0, this.width) * sc) - 1, mmY, 3, 6); }
    if (!p.dead) { ctx.fillStyle = '#ffffff'; ctx.fillRect(mmX + Math.round(p.cx * sc), mmY + 1, 1, 4); }
  }
}
