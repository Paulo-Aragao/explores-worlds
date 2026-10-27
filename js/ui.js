'use strict';
// ============================================================
//  Interface (DOM): título, mapa, Fabricador, HUD, menus
// ============================================================

const $ = (sel, root = document) => root.querySelector(sel);
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
function costHtml(cost, check = true) {
  return Object.entries(cost).map(([k, v]) => {
    const ok = !check || (Save.data.inv[k] || 0) >= v;
    return `<span class="cost ${ok ? '' : 'bad'}" title="${RES[k].name}"><img src="${resIconUrl(k)}">${v}</span>`;
  }).join('');
}

// miniaturas desenhadas a partir das próprias rotinas de desenho do jogo
const Thumbs = {
  cache: {},
  building(type) {
    if (this.cache['b_' + type]) return this.cache['b_' + type];
    const c = makeCanvas(56, 64), x = c.getContext('2d');
    const stub = { camX: 0, nearestEnemy: () => null, world: { biome: 'rock' } };
    const b = new Building(stub, type, 28);
    b.buildT = 1; b.t = 1.2;
    x.translate(0, -(GROUND_Y - 62));
    b.draw(x, 0);
    let url;
    if (type === 'ceiling') url = canvasUrl(c, 2);
    else {
      const h = BUILDINGS[type].h + 6, crop = makeCanvas(28, Math.max(h, 12)), cx = crop.getContext('2d');
      cx.drawImage(c, 14, 62 - h + 2, 28, h, 0, 0, 28, h);
      url = canvasUrl(crop, 3);
    }
    return (this.cache['b_' + type] = url);
  },
  player() {
    if (this.cache.player) return this.cache.player;
    return (this.cache.player = canvasUrl(playerSprite('idle'), 4));
  },
  weapon(id) {
    if (this.cache['w_' + id]) return this.cache['w_' + id];
    const c = makeCanvas(22, 10), x = c.getContext('2d');
    const fake = { weapon: id, aim: 0, face: 1, recoil: 0, heat: { [id]: 0 }, over: {} };
    Player.prototype.drawGun.call(fake, x, 4, 5);
    return (this.cache['w_' + id] = canvasUrl(c, 4));
  },
};

const UI = {
  root: null, hudEls: null, hudCache: {}, toastTimer: null,

  init() {
    this.root = $('#ui');
    this.root.innerHTML = `
      <div id="screen"></div>
      <div id="hud" class="hidden"></div>
      <div id="banner" class="hidden"><div class="b-title"></div><div class="b-sub"></div></div>
      <div id="toasts"></div>
      <div id="hint" class="hidden"></div>
      <div id="modal" class="hidden"></div>
      <div id="fade"></div>`;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && !$('#modal').classList.contains('hidden') && Game.scene !== 'mission') this.closeModal();
    });
  },
  clearScreen() { $('#screen').innerHTML = ''; $('#screen').className = ''; },
  fade(cb, dur = 350) {
    const f = $('#fade'); f.classList.add('on');
    setTimeout(() => { cb && cb(); setTimeout(() => f.classList.remove('on'), 60); }, dur);
  },

  // ---------------- TÍTULO ----------------
  showTitle() {
    this.clearScreen(); this.hideHUD();
    const s = $('#screen'); s.className = 'title-screen';
    const has = Save.exists();
    s.innerHTML = `
      <div class="title-wrap">
        <div class="logo">EXPLORE<br><span>WORLDS</span></div>
        <div class="tagline">tower defense · side-scrolling shooter · exploração espacial</div>
        <div class="menu">
          ${has ? '<button class="btn primary" data-a="continue">Continuar</button>' : ''}
          <button class="btn ${has ? '' : 'primary'}" data-a="new">Novo Jogo</button>
          <button class="btn" data-a="help">Como Jogar</button>
        </div>
        <div class="foot">
          Protótipo · clique na tela para ativar o som · M silencia<br>
          <span class="foot-gp" id="foot-gp" style="display:inline-block; margin-top:6px; color:var(--cyan);">
            ${Input.usingGamepad ? '🎮 DualSense ATIVO (D-Pad: navegar · ✕: confirmar)' : '🎮 DualSense: pressione qualquer botão para ativar'}
          </span>
        </div>
      </div>`;
    s.onclick = (e) => {
      const a = e.target.dataset && e.target.dataset.a;
      if (!a) return;
      Sound.unlock(); Sound.play('click');
      if (a === 'continue') { Save.load(); this.fade(() => Game.toStarmap()); }
      if (a === 'new') {
        if (has) this.confirm('Começar um novo jogo apagará o progresso atual. Continuar?', () => { Save.newGame(); this.fade(() => Game.intro()); });
        else { Save.newGame(); this.fade(() => Game.intro()); }
      }
      if (a === 'help') this.showHelp();
    };
  },

  showIntro(done) {
    this.clearScreen();
    const s = $('#screen'); s.className = 'intro-screen';
    const lines = [
      'Ano 3127. A humanidade esgotou os recursos do seu sistema natal.',
      'A nave-mãe <b>AURORA</b> parte para as bordas do universo conhecido.',
      'Sua missão: pousar em mundos hostis, instalar a <b>BROCA EXTRATORA</b> e defendê-la das criaturas nativas.',
      'Com os recursos de cada mundo, fabrique armas, construções e motores de dobra para ir cada vez mais longe...',
      '...até o <b>Núcleo Primordial</b>, a origem de toda a fauna hostil.',
    ];
    s.innerHTML = `<div class="intro">${lines.map((l, i) => `<p style="animation-delay:${i * 1.1}s">${l}</p>`).join('')}
      <button class="btn primary" style="animation-delay:${lines.length * 1.1}s">Iniciar exploração</button></div>`;
    $('button', s).onclick = () => { Sound.play('click'); this.fade(done); };
  },

  // ---------------- MAPA ESTELAR ----------------
  showStarmap() {
    this.clearScreen(); this.hideHUD();
    const s = $('#screen'); s.className = 'starmap-screen';
    s.innerHTML = `
      <div class="topbar">
        <div class="inv" id="sm-inv"></div>
        <div class="tb-actions">
          <button class="btn small accent" data-a="fab">⚙ Fabricador</button>
          <button class="btn small" data-a="help">?</button>
          <button class="btn small" data-a="menu">☰</button>
        </div>
      </div>
      <div class="objective" id="sm-obj"></div>
      <div class="sidepanel hidden" id="sm-side"></div>`;
    s.onclick = (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      const act = a.dataset.a;
      Sound.play('click');
      if (act === 'fab') this.showFabricator();
      if (act === 'help') this.showHelp();
      if (act === 'menu') this.showGameMenu();
      if (act === 'land' && Starmap.sel) Starmap.launch(Starmap.sel);
      if (act === 'close-side') { this.hideSidePanel(); Starmap.sel = null; }
    };
    this.refreshStarmap();
  },
  refreshStarmap() {
    const inv = $('#sm-inv'); if (!inv) return;
    const sd = Save.data;
    inv.innerHTML = RES_ORDER.map(k => `<span class="res" title="${RES[k].name} — ${RES[k].desc}"><img src="${resIconUrl(k)}"><b>${sd.inv[k] || 0}</b></span>`).join('') +
      `<span class="sep"></span>` +
      Object.entries(ITEMS).map(([k, it]) => `<span class="item" title="${it.name}">${it.key}·${it.name.split(' ')[0]} <b>${sd.items[k] || 0}</b></span>`).join('');
    $('#sm-obj').innerHTML = '<span>OBJETIVO</span> ' + this.objective();
    if (Starmap.sel) this.showSidePanel(Starmap.sel);
  },
  objective() {
    const sd = Save.data, warp = Save.lvl('warp');
    if (sd.won) return 'Você conquistou o universo! Continue explorando e aprimorando seu arsenal.';
    if (!Object.keys(sd.completed).length) return 'Pouse em <b>Terra Nova</b> ou <b>Viridia</b> para extrair seus primeiros recursos.';
    if (warp === 0) return 'Fabrique o <b>Motor de Dobra Mk II</b> (Fabricador › Nave) para alcançar o Setor 2.';
    if (warp === 1) return 'Colete Criocristal e Pirita no Setor 2 e fabrique o <b>Motor de Dobra Mk III</b>.';
    if (warp === 2) return 'Explore o Setor 3 em busca de Gravitônio para o <b>Motor de Dobra Mk IV</b>.';
    if (!Save.lvl('corekey')) return 'Extraia Essência do Vazio em <b>Nyx</b> e fabrique a <b>Chave do Núcleo</b>.';
    return 'Viaje ao <b>Núcleo Primordial</b> e derrote o Soberano do Vazio!';
  },
  showSidePanel(w) {
    const p = $('#sm-side'); if (!p) return;
    const reach = worldReachable(w), done = Save.data.completed[w.id];
    const b = BIOMES[w.biome];
    const tempCls = w.temp < -10 ? 'cold' : w.temp > 40 ? 'hot' : '';
    const ths = 20 * Save.lvl('thermal');
    const tempWarn = w.temp < -10 - ths ? 'Frio extremo: leve Aquecedores ou Traje Térmico.' : w.temp > 40 + ths ? 'Calor extremo: leve Ar-condicionado ou Traje Térmico.' : '';
    const gWarn = w.gravity >= 1.2 ? 'Gravidade alta: saltos curtos.' : w.gravity <= 0.6 ? 'Gravidade baixa: saltos longos.' : '';
    p.innerHTML = `
      <button class="x" data-a="close-side">×</button>
      <div class="sp-name">${w.name}</div>
      <div class="sp-biome">${b.name} · Setor ${Math.min(4, w.tier)}${w.final ? ' · FINAL' : ''}</div>
      <div class="sp-desc">${w.desc}</div>
      <div class="sp-stats">
        <div><span>Temperatura</span><b class="${tempCls}">${w.temp > 0 ? '+' : ''}${w.temp}°C</b></div>
        <div><span>Gravidade</span><b>${w.gravity.toFixed(2)} g</b></div>
        <div><span>Ondas</span><b>${w.waves} + chefe</b></div>
        <div><span>Chefe</span><b>${BOSSES[w.boss].name}</b></div>
        <div><span>Recursos</span><b class="sp-res"><img src="${resIconUrl(w.res)}">${RES[w.res].name}${w.res2 ? ` <img src="${resIconUrl(w.res2)}">${RES[w.res2].name}` : ''}${w.res !== 'ferro' ? ` <img src="${resIconUrl('ferro')}">` : ''}</b></div>
        <div><span>Ameaça</span><b class="threat">${'◆'.repeat(Math.min(5, w.tier))}${'◇'.repeat(Math.max(0, 5 - w.tier))}</b></div>
      </div>
      ${tempWarn || gWarn ? `<div class="sp-warn">${[tempWarn, gWarn].filter(Boolean).join('<br>')}</div>` : ''}
      ${done ? `<div class="sp-done">Concluído ${done}x · jazidas parcialmente esgotadas (rendimento reduzido)</div>` : ''}
      ${reach ? `<button class="btn primary wide" data-a="land">Viajar e pousar</button>` : `<div class="sp-lock">🔒 ${worldLockReason(w)}</div>`}`;
    p.classList.remove('hidden');
  },
  hideSidePanel() { const p = $('#sm-side'); if (p) p.classList.add('hidden'); },

  // ---------------- FABRICADOR ----------------
  showFabricator(tab = this.fabTab || 'armas') {
    this.fabTab = tab;
    const m = this.openModal('fab');
    const sd = Save.data;
    const recipes = RECIPES.filter(r => r.cat === tab);
    m.innerHTML = `
      <div class="modal-head"><div class="mh-title">⚙ FABRICADOR</div><button class="x" data-a="close">×</button></div>
      <div class="fab-inv">${RES_ORDER.map(k => `<span class="res" title="${RES[k].name}"><img src="${resIconUrl(k)}"><b>${sd.inv[k] || 0}</b><i>${RES[k].name}</i></span>`).join('')}</div>
      <div class="tabs">${RECIPE_CATS.map(c => `<button class="tab ${c.id === tab ? 'on' : ''}" data-tab="${c.id}">${c.name}</button>`).join('')}</div>
      <div class="fab-grid">${recipes.map(r => this.recipeCard(r)).join('')}</div>`;
    m.onclick = (e) => {
      const t = e.target.closest('[data-tab]'); if (t) { Sound.play('click'); this.showFabricator(t.dataset.tab); return; }
      const c = e.target.closest('[data-craft]'); if (c) { this.craft(c.dataset.craft); return; }
      if (e.target.closest('[data-a="close"]')) { Sound.play('click'); this.closeModal(); }
    };
  },
  recipeState(r) {
    const lvl = Save.lvl(r.id);
    const maxed = r.max && lvl >= r.max;
    const cost = r.cost[Math.min(lvl, r.cost.length - 1)];
    const reqOk = !r.req || r.req();
    return { lvl, maxed, cost, reqOk, can: !maxed && reqOk && Save.has(cost) };
  },
  recipeCard(r) {
    const st = this.recipeState(r);
    let icon = '';
    if (r.weapon) icon = `<img class="ic wpn" src="${Thumbs.weapon(r.weapon)}">`;
    else if (r.blueprint) icon = `<img class="ic bld" src="${Thumbs.building(r.blueprint)}">`;
    else if (r.item) icon = `<div class="ic glyph">${ITEMS[r.item].key}</div>`;
    else if (r.ico) {
      const [k, v] = r.ico.split(':');
      if (k === 'b') icon = `<img class="ic bld" src="${Thumbs.building(v)}">`;
      else if (k === 'w') icon = `<img class="ic wpn" src="${Thumbs.weapon(v)}">`;
      else if (k === 'r') icon = `<img class="ic res" src="${resIconUrl(v)}">`;
      else if (k === 'p') icon = `<img class="ic bld" src="${Thumbs.player()}">`;
      else icon = `<div class="ic glyph">${v}</div>`;
    }
    else icon = `<div class="ic glyph">${r.name[0]}</div>`;
    let lvlTxt = '';
    if (r.max > 1) lvlTxt = `<div class="pips">${Array.from({ length: r.max }, (_, i) => `<i class="${i < st.lvl ? 'on' : ''}"></i>`).join('')}</div>`;
    if (r.item) lvlTxt = `<div class="owned">Possui: ${Save.data.items[r.item] || 0}</div>`;
    let btn;
    if (st.maxed) btn = `<div class="done">✔ ${r.max > 1 ? 'Máximo' : 'Fabricado'}</div>`;
    else if (!st.reqOk) btn = `<div class="req">${r.reqText}</div>`;
    else btn = `<div class="costs">${costHtml(st.cost)}</div><button class="btn small ${st.can ? 'primary' : 'disabled'}" data-craft="${r.id}">Fabricar</button>`;
    let name = r.name;
    if (r.id === 'warp') name = 'Motor de Dobra Mk ' + ['II', 'III', 'IV', 'IV'][st.lvl];
    return `<div class="card ${st.maxed ? 'maxed' : ''}">${icon}<div class="c-body"><div class="c-name">${name}</div><div class="c-desc">${r.desc}</div>${lvlTxt}</div><div class="c-foot">${btn}</div></div>`;
  },
  craft(id) {
    const r = RECIPES.find(x => x.id === id);
    const st = this.recipeState(r);
    if (!st.can) { Sound.play('error'); return; }
    Save.spend(st.cost);
    const sd = Save.data;
    if (r.item) sd.items[r.item] = (sd.items[r.item] || 0) + r.qty;
    else {
      sd.upgrades[r.id] = (sd.upgrades[r.id] || 0) + 1;
      if (r.weapon && !sd.weapons.includes(r.weapon)) sd.weapons.push(r.weapon);
      if (r.blueprint && !sd.blueprints.includes(r.blueprint)) sd.blueprints.push(r.blueprint);
    }
    Save.save();
    Sound.play('craft');
    this.toast('Fabricado: ' + (r.id === 'warp' ? 'Motor de Dobra Mk ' + ['II', 'III', 'IV'][Save.lvl('warp') - 1] : r.name), 1.8, 'good');
    if (r.id === 'warp') this.toast('Novo setor ao alcance!', 2.4, 'gold');
    if (r.id === 'corekey') this.toast('O Núcleo Primordial está ao alcance!', 2.4, 'gold');
    this.showFabricator(this.fabTab);
    this.refreshStarmap();
  },

  // ---------------- MODAIS ----------------
  openModal(kind) {
    const m = $('#modal');
    m.className = 'modal-' + kind;
    m.innerHTML = '';
    const box = el('div', 'modal-box');
    m.appendChild(box);
    return box;
  },
  closeModal() {
    const m = $('#modal');
    m.className = 'hidden'; m.innerHTML = '';
    if (Game.scene === 'mission' && Game.paused && !Game.mission?.ended) Game.paused = false;
  },
  confirm(text, yes) {
    const m = this.openModal('confirm');
    m.innerHTML = `<div class="confirm-text">${text}</div><div class="row"><button class="btn" data-a="no">Cancelar</button><button class="btn danger" data-a="yes">Confirmar</button></div>`;
    m.onclick = (e) => {
      const a = e.target.dataset.a;
      if (a === 'no') { Sound.play('click'); this.closeModal(); }
      if (a === 'yes') { Sound.play('click'); this.closeModal(); yes(); }
    };
  },
  showHelp() {
    const m = this.openModal('help');
    m.innerHTML = `
      <div class="modal-head"><div class="mh-title">COMO JOGAR & CONTROLES</div><button class="x" data-a="close">×</button></div>
      <div class="help-cols">
        <div>
          <h4>🎮 DualSense / Joystick (PS5)</h4>
          <table class="keys">
            <tr><td>Analógico Esq.</td><td>Mover (andar / correr)</td></tr>
            <tr><td>✕ (Cross)</td><td>Pular · Jetpack (segurar no ar)</td></tr>
            <tr><td>○ (Circle) / L3</td><td>Esquiva (Dash) · Desmontar no modo build</td></tr>
            <tr><td>▢ (Square)</td><td>Interagir (extrair / cápsula / gravidade)</td></tr>
            <tr><td>△ (Triangle)</td><td>Próxima arma · Abrir Fabricador no mapa</td></tr>
            <tr><td>Analógico Dir.</td><td>Mira Twin-Stick 360° com retículo</td></tr>
            <tr><td>R2</td><td>Atirar · Posicionar construção</td></tr>
            <tr><td>L2</td><td>Reparar com solda (segurar)</td></tr>
            <tr><td>L1 / R1</td><td>Arma anterior / próxima (ou girar construções)</td></tr>
            <tr><td>R3 / Touchpad</td><td>Alternar Modo Construção</td></tr>
            <tr><td>D-pad ▲ / Touchpad</td><td>Lançar Granada · Chamar onda antecipada</td></tr>
            <tr><td>D-pad ◀ / ▶</td><td>Kit Médico (◀) / Kit de Reparo (▶)</td></tr>
            <tr><td>D-pad ▼</td><td>Descer de plataforma de teto</td></tr>
            <tr><td>Options / Start</td><td>Pausar jogo</td></tr>
            <tr><td>Vibração Háptica</td><td>Feedback tátil de tiros, danos, reparos e explosões</td></tr>
          </table>
        </div>
        <div>
          <h4>⌨ Teclado & Mouse</h4>
          <table class="keys">
            <tr><td>A / D</td><td>Mover</td></tr>
            <tr><td>W / Espaço</td><td>Pular (segure no ar: jetpack)</td></tr>
            <tr><td>S</td><td>Descer de um Teto</td></tr>
            <tr><td>Shift</td><td>Esquiva</td></tr>
            <tr><td>Mouse</td><td>Mirar / atirar</td></tr>
            <tr><td>Q / Roda / 1-6</td><td>Trocar arma</td></tr>
            <tr><td>B / Tab / Botão dir.</td><td>Modo construção</td></tr>
            <tr><td>1-7 (construção)</td><td>Escolher construção</td></tr>
            <tr><td>Botão dir. (construção)</td><td>Desmontar (reembolso 50%)</td></tr>
            <tr><td>E (segure)</td><td>Extrair veios · alternar gravidade</td></tr>
            <tr><td>R (segure)</td><td>Reparar (gasta sucata)</td></tr>
            <tr><td>G / H / F</td><td>Granada / Kit médico / Kit de reparo</td></tr>
            <tr><td>Enter</td><td>Chamar próxima onda (bônus)</td></tr>
            <tr><td>Esc / P</td><td>Pausa · M: som</td></tr>
          </table>
          <h4 style="margin-top:10px">Ciclo de Jogo & Ambiente</h4>
          <p>1. Escolha um planeta no <b>Mapa Estelar</b> e pouse.</p>
          <p>2. A <b>Broca</b> extrai recursos. Proteja-a das hordas construindo torres e defesas.</p>
          <p>3. <b>Temperatura & Gravidade</b> afetam você e as criaturas nativas — adapte seu arsenal e defesas.</p>
          <p>4. No fim da missão, fabrique melhorias e novos motores de dobra no <b>Fabricador</b>.</p>
        </div>
      </div>`;
    m.onclick = (e) => { if (e.target.closest('[data-a="close"]')) { Sound.play('click'); this.closeModal(); } };
  },
  showGameMenu() {
    const m = this.openModal('menu');
    m.innerHTML = `
      <div class="modal-head"><div class="mh-title">MENU</div><button class="x" data-a="close">×</button></div>
      <div class="menu col">
        <button class="btn" data-a="sound">Som: ${Sound.muted ? 'DESLIGADO' : 'LIGADO'}</button>
        <button class="btn" data-a="title">Voltar ao título</button>
        <button class="btn danger" data-a="reset">Apagar progresso</button>
      </div>
      <div class="stats-mini">Missões: ${Save.data.stats.missions} · Sucesso: ${Save.data.stats.success} · Abates: ${Save.data.stats.kills} · Chefes: ${Save.data.stats.bosses}</div>`;
    m.onclick = (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      Sound.play('click');
      const act = a.dataset.a;
      if (act === 'close') this.closeModal();
      if (act === 'sound') { Sound.setMuted(!Sound.muted); this.showGameMenu(); }
      if (act === 'title') { this.closeModal(); this.fade(() => Game.toTitle()); }
      if (act === 'reset') this.confirm('Apagar todo o progresso salvo?', () => { try { localStorage.removeItem(SAVE_KEY); } catch (e2) { } Save.load(); this.fade(() => Game.toTitle()); });
    };
  },
  showPause(mission) {
    const m = this.openModal('pause');
    m.innerHTML = `
      <div class="modal-head"><div class="mh-title">PAUSADO</div></div>
      <div class="pause-info">${mission.world.name} · Onda ${mission.wave}/${mission.waves} · Abates ${mission.stats.kills}</div>
      <div class="menu col">
        <button class="btn primary" data-a="resume">Continuar</button>
        <button class="btn" data-a="help">Controles</button>
        <button class="btn" data-a="sound">Som: ${Sound.muted ? 'DESLIGADO' : 'LIGADO'}</button>
        <button class="btn danger" data-a="abandon">Abandonar missão</button>
      </div>`;
    m.onclick = (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      Sound.play('click');
      const act = a.dataset.a;
      if (act === 'resume') this.closeModal();
      if (act === 'help') { this.showHelp(); $('#modal .modal-box').onclick = (ev) => { if (ev.target.closest('[data-a="close"]')) this.showPause(mission); }; }
      if (act === 'sound') { Sound.setMuted(!Sound.muted); this.showPause(mission); }
      if (act === 'abandon') this.confirm('Abandonar a missão? Você perderá 50% dos recursos coletados nela.', () => { Game.paused = false; mission.abandon(); });
    };
  },
  showResults(res) {
    const m = this.openModal('results');
    const rows = (obj, sign) => Object.entries(obj).filter(([, v]) => v > 0).map(([k, v]) => `<div class="r-row"><img src="${resIconUrl(k)}"><span>${RES[k].name}</span><b>${sign}${v}</b></div>`).join('') || '<div class="r-row muted">—</div>';
    const t = Math.round(res.stats.time);
    const nextUnlock = res.success && res.firstClear ? `<div class="r-note">Novo mundo conquistado! Recursos de ${RES[res.world.res].name} agora disponíveis no Fabricador.</div>` : '';
    m.innerHTML = `
      <div class="r-head ${res.success ? 'ok' : 'bad'}">${res.success ? 'EXTRAÇÃO CONCLUÍDA' : 'MISSÃO FRACASSADA'}</div>
      <div class="r-world">${res.world.name} · ${BIOMES[res.world.biome].name}</div>
      <div class="r-cols">
        <div><h4>Recursos obtidos</h4>${rows(res.collected, '+')}
          ${!res.success && Object.keys(res.lost).length ? `<h4 class="bad">Perdidos na evacuação</h4>${rows(res.lost, '-')}` : ''}
          ${res.success ? `<div class="r-bonus">Inclui bônus de conclusão</div>` : ''}
        </div>
        <div><h4>Estatísticas</h4>
          <div class="r-row"><span>Ondas</span><b>${res.success ? res.world.waves + '/' + res.world.waves : Math.max(0, res.wave - 1) + '/' + res.world.waves}</b></div>
          <div class="r-row"><span>Abates</span><b>${res.stats.kills}</b></div>
          <div class="r-row"><span>Construções</span><b>${res.stats.built}</b></div>
          <div class="r-row"><span>Depósitos</span><b>${res.stats.deposits}</b></div>
          <div class="r-row"><span>Tempo</span><b>${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</b></div>
        </div>
      </div>
      ${nextUnlock}
      <div class="row"><button class="btn primary" data-a="ok">${res.success && res.world.final ? 'Continuar' : 'Voltar ao mapa'}</button></div>`;
    m.onclick = (e) => {
      if (!e.target.closest('[data-a="ok"]')) return;
      Sound.play('click');
      this.closeModal();
      if (res.success && res.world.final) this.fade(() => Game.ending());
      else this.fade(() => Game.toStarmap());
    };
  },
  showEnding() {
    this.clearScreen(); this.hideHUD();
    const s = $('#screen'); s.className = 'intro-screen';
    const st = Save.data.stats;
    const lines = [
      'O Soberano do Vazio caiu.',
      'Sem sua influência, a fauna dos mundos se acalma e as rotas estelares se abrem.',
      'A <b>AURORA</b> agora pode explorar o universo inteiro.',
      `Missões: <b>${st.missions}</b> · Abates: <b>${st.kills}</b> · Chefes derrotados: <b>${st.bosses}</b>`,
      '<span class="gold">FIM — obrigado por jogar o protótipo de EXPLORE WORLDS</span>',
    ];
    s.innerHTML = `<div class="intro">${lines.map((l, i) => `<p style="animation-delay:${i * 1.2}s">${l}</p>`).join('')}
      <button class="btn primary" style="animation-delay:${lines.length * 1.2}s">Continuar explorando</button></div>`;
    $('button', s).onclick = () => { Sound.play('click'); this.fade(() => Game.toStarmap()); };
  },

  // ---------------- AVISOS ----------------
  toast(msg, dur = 1.6, kind = '') {
    const box = $('#toasts');
    const t = el('div', 'toast ' + (kind || ''), msg);
    box.appendChild(t);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, dur * 1000);
  },
  banner(title, sub, kind = 'info') {
    const b = $('#banner');
    b.className = 'show ' + kind;
    $('.b-title', b).textContent = title;
    $('.b-sub', b).textContent = sub || '';
    void b.offsetWidth;
    b.classList.add('anim');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => { b.className = 'hidden'; }, 3200);
  },
  hint(html) {
    const h = $('#hint');
    if (!html) { h.className = 'hidden'; return; }
    h.innerHTML = `<div class="h-tag">DICA</div>${html}`;
    h.className = 'show';
  },

  // ---------------- HUD ----------------
  showHUD(m) {
    const h = $('#hud');
    h.className = '';
    this.hudCache = {};
    const slots = BUILD_ORDER.map((t, i) => `
      <div class="slot" data-b="${t}">
        <span class="k">${i + 1}</span>
        <img src="${Thumbs.building(t)}">
        <div class="sc">${costHtml(buildCost(t), false)}</div>
        <div class="lock">BLOQ</div>
      </div>`).join('');
    h.innerHTML = `
      <div class="h-tl">
        <div class="bar hp"><i></i><span></span></div>
        <div class="bar fuel"><i></i></div>
        <div class="wpn"><img><div><b class="wn"></b><div class="bar heat"><i></i></div></div></div>
        <div class="items"></div>
      </div>
      <div class="h-tc"><div class="phase"></div><div class="sub"></div></div>
      <div class="h-boss hidden"><div class="bn"></div><div class="bar boss"><i></i></div></div>
      <div class="h-tr">
        <div class="env"><span class="temp"></span><span class="grav"></span></div>
        <div class="col"></div>
      </div>
      <div class="h-bc">
        <div class="drill"><span>BROCA</span><div class="bar drillbar"><i></i></div><b></b></div>
        <div class="buildbar">${slots}</div>
        <div class="bhint"></div>
      </div>`;
    h.querySelectorAll('.slot').forEach(s => {
      s.onpointerdown = (e) => {
        e.stopPropagation();
        const t = s.dataset.b;
        if (!m.unlocked(t)) { Sound.play('error'); this.toast('Projeto bloqueado — fabrique no Fabricador', 1.4, 'danger'); return; }
        m.buildSel = t; m.buildMode = true; Sound.play('click');
      };
    });
    this.hudEls = {
      hpI: $('.hp i', h), hpS: $('.hp span', h), fuel: $('.fuel', h), fuelI: $('.fuel i', h),
      wImg: $('.wpn img', h), wName: $('.wn', h), heatI: $('.heat i', h), heat: $('.heat', h), items: $('.items', h),
      phase: $('.phase', h), sub: $('.sub', h), boss: $('.h-boss', h), bossN: $('.bn', h), bossI: $('.boss i', h),
      temp: $('.temp', h), grav: $('.grav', h), col: $('.col', h), drillI: $('.drillbar i', h), drillB: $('.drill b', h),
      slots: [...h.querySelectorAll('.slot')], bhint: $('.bhint', h), buildbar: $('.buildbar', h),
    };
  },
  hideHUD() { const h = $('#hud'); if (h) { h.className = 'hidden'; h.innerHTML = ''; } this.hudEls = null; this.hint(null); },
  _set(key, el2, prop, val) {
    if (this.hudCache[key] === val) return;
    this.hudCache[key] = val;
    if (prop === 'html') el2.innerHTML = val;
    else if (prop === 'text') el2.textContent = val;
    else if (prop === 'width') el2.style.width = val;
    else if (prop === 'class') el2.className = val;
    else if (prop === 'src') el2.src = val;
  },
  updateHUD(m) {
    const E = this.hudEls; if (!E) return;
    const p = m.player, sd = Save.data;
    const hpK = clamp(p.hp / p.maxHp, 0, 1);
    this._set('hp', E.hpI, 'width', (hpK * 100).toFixed(1) + '%');
    this._set('hpS', E.hpS, 'text', p.dead ? 'REIMPLANTANDO ' + Math.ceil(p.respawnT) + 's' : Math.ceil(p.hp) + ' / ' + p.maxHp + (p.shieldMax ? '  ◈' + Math.ceil(p.shield) : ''));
    this._set('hpc', E.hpI.parentNode, 'class', 'bar hp' + (p.shield > 0 ? ' shielded' : ''));
    this._set('fuelOn', E.fuel, 'class', 'bar fuel' + (p.fuelMax ? '' : ' hidden'));
    if (p.fuelMax) this._set('fuel', E.fuelI, 'width', (p.fuel / p.fuelMax * 100).toFixed(0) + '%');
    const w = p.weapon;
    this._set('wimg', E.wImg, 'src', Thumbs.weapon(w));
    this._set('wname', E.wName, 'text', WEAPONS[w].name + (p.weapons.length > 1 ? `  [${p.wi + 1}/${p.weapons.length}]` : ''));
    this._set('heat', E.heatI, 'width', p.heat[w].toFixed(0) + '%');
    this._set('heatc', E.heat, 'class', 'bar heat' + (p.over[w] ? ' over' : ''));
    const pad = Input.usingGamepad, touch = Input.usingTouch && !pad;
    const gKey = pad ? 'D▲' : 'G';
    const hKey = pad ? 'D◀' : 'H';
    const fKey = pad ? 'D▶' : 'F';
    this._set('items', E.items, 'html', `<span>${gKey} <b>${sd.items.grenade}</b></span><span>${hKey} <b>${sd.items.medkit}</b></span><span>${fKey} <b>${sd.items.repairkit}</b></span>${m.orbLvl ? `<span class="orb ${m.orbT <= 0.5 ? 'ready' : ''}">☄ <b>${Math.max(0, Math.ceil(m.orbT))}s</b></span>` : ''}<span class="sc">${costHtml({ sucata: sd.inv.sucata, ferro: sd.inv.ferro }, false)}</span>`);

    // fase
    const callWaveKey = pad ? 'Touchpad/D▲' : touch ? 'ONDA ▶' : 'ENTER';
    let ph = '', sub = '';
    switch (m.phase) {
      case 'landing': ph = 'POUSANDO'; sub = m.world.name; break;
      case 'prep': ph = 'PREPARAÇÃO'; sub = 'Onda 1 em ' + Math.ceil(m.prepTime - m.phaseT) + 's · ' + callWaveKey + ' para iniciar'; break;
      case 'break': ph = 'INTERVALO'; sub = 'Onda ' + (m.wave + 1) + ' em ' + Math.ceil(m.prepTime - m.phaseT) + 's · ' + callWaveKey + ' para chamar'; break;
      case 'wave': { const left = m.enemies.filter(e => !e.dead).length + m.spawnQueue.length; ph = 'ONDA ' + m.wave + '/' + m.waves; sub = left + ' hostis restantes'; break; }
      case 'bossWarn': ph = '⚠ ALERTA ⚠'; sub = 'Sinal massivo detectado'; break;
      case 'boss': ph = 'CHEFE'; sub = 'Derrote ' + BOSSES[m.world.boss].name; break;
      case 'extract': ph = 'EXTRAÇÃO'; sub = 'Missão concluída'; break;
      case 'failed': ph = 'FRACASSO'; sub = 'Evacuando...'; break;
    }
    this._set('ph', E.phase, 'text', ph);
    this._set('phc', E.phase, 'class', 'phase ' + m.phase);
    this._set('sub', E.sub, 'text', sub);
    // chefe
    const b = m.boss;
    const showBoss = b && !b.dead;
    this._set('bossOn', E.boss, 'class', 'h-boss' + (showBoss ? '' : ' hidden'));
    if (showBoss) {
      this._set('bossN', E.bossN, 'text', b.name + (b.shards && b.shards.length ? ' · ESCUDO ATIVO' : ''));
      this._set('bossI', E.bossI, 'width', (b.hp / b.maxHp * 100).toFixed(1) + '%');
    }
    // ambiente
    const T = Math.round(m.tempAt(p.cx)), g = m.gravAt(p.cx);
    const tc = p.tempExcess ? (p.tempExcess < 0 ? 'temp cold warn' : 'temp hot warn') : (T < 0 ? 'temp cold' : T > 40 ? 'temp hot' : 'temp');
    this._set('temp', E.temp, 'text', '🌡 ' + (T > 0 ? '+' : '') + T + '°C');
    this._set('tempc', E.temp, 'class', tc);
    const gz = m.gravZoneAt(p.cx);
    this._set('grav', E.grav, 'text', '⇣ ' + g.toFixed(2) + 'g' + (gz ? (gz === 'heavy' ? ' ALTA' : ' BAIXA') : ''));
    const colHtml = RES_ORDER.filter(k => m.collected[k]).map(k => `<span><img src="${resIconUrl(k)}">+${m.collected[k]}</span>`).join('');
    this._set('col', E.col, 'html', colHtml ? '<em>COLETADO</em>' + colHtml : '');
    // broca
    const dk = clamp(m.drill.hp / m.drill.maxHp, 0, 1);
    this._set('drill', E.drillI, 'width', (dk * 100).toFixed(1) + '%');
    this._set('drillc', E.drillI.parentNode, 'class', 'bar drillbar' + (dk < 0.3 ? ' low' : ''));
    this._set('drillB', E.drillB, 'text', Math.ceil(m.drill.hp));
    // construção
    this._set('bmode', E.buildbar, 'class', 'buildbar' + (m.buildMode ? ' active' : ''));
    E.slots.forEach(s => {
      const t = s.dataset.b, un = m.unlocked(t), aff = Save.has(buildCost(t));
      const cls = 'slot' + (un ? '' : ' locked') + (un && !aff ? ' poor' : '') + (m.buildMode && m.buildSel === t ? ' sel' : '');
      this._set('slot' + t, s, 'class', cls);
    });
    const defaultHint = pad
      ? 'R3 / Touchpad: construir · ▢: interagir · L2: reparar'
      : touch ? 'Esquerda: mover · Direita: mirar e atirar'
      : 'B: construir · E: interagir · R: reparar';
    const buildHint = pad
      ? `<b>${BUILDINGS[m.buildSel].name}</b> — L1/R1: selecionar · R2: construir · ○: desmontar`
      : touch ? `<b>${BUILDINGS[m.buildSel].name}</b> — arraste e solte para construir`
      : `<b>${BUILDINGS[m.buildSel].name}</b> — ${BUILDINGS[m.buildSel].desc}`;
    this._set('bhint', E.bhint, 'html', m.buildMode ? buildHint : defaultHint);
  },
};
