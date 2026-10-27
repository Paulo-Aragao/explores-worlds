'use strict';
// ============================================================
//  Ferramentas de desenvolvimento (carregadas só com ?dev na URL)
//  Ex.: Dev.mission('pyros'); Dev.rich(); Dev.boss();
// ============================================================

const Dev = {
  step(n, fn) { for (let i = 0; i < n; i++) { fn && fn(i); Game.t += 1 / 60; Game.update(1 / 60); Input.endFrame(); } Game.render(); },
  press(k) { Input.pressed[k] = true; Input.down[k] = true; },
  rich() {
    Object.keys(Save.data.inv).forEach(k => Save.data.inv[k] = 999);
    Save.data.weapons = WEAPON_ORDER.slice();
    Save.data.blueprints = BUILD_ORDER.slice();
    Save.save(); UI.refreshStarmap();
  },
  unlockAll() { this.rich(); Save.data.upgrades.warp = 3; Save.data.upgrades.corekey = 1; Save.data.upgrades.jetpack = 2; Save.save(); UI.refreshStarmap(); },
  mission(id) { Game.scene = 'mission'; UI.clearScreen(); Game.mission = new Mission(WORLD_BY_ID[id]); UI.showHUD(Game.mission); return Game.mission; },
  boss() { const m = Game.mission; m.enemies.forEach(e => e.hurt(9999)); m.wave = m.waves; m.setPhase('bossWarn'); },
  place(type, wx) { const m = Game.mission; m.buildMode = true; m.buildSel = type; Input.mouse.x = wx - m.camX; Input.mouse.y = 180; Input.mouse.leftPressed = true; this.step(1); m.buildMode = false; },
  bot(god = true) {
    const m = Game.mission; if (!m || m.ended) return;
    const p = m.player;
    if (god) { p.hp = p.maxHp; m.drill.hp = Math.max(m.drill.hp, 200); }
    const t = m.nearestEnemy(p.cx, p.cy, 450);
    if (t) { Input.mouse.x = t.x - m.camX; Input.mouse.y = t.y; Input.mouse.left = true; } else Input.mouse.left = false;
    const dx = m.drill.x - p.cx; Input.down.KeyA = dx < -50; Input.down.KeyD = dx > 50;
    if (m.phase === 'prep' || m.phase === 'break') this.press('Enter');
  },
};
window.Dev = Dev;
