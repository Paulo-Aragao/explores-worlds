'use strict';
// ============================================================
//  Progresso persistente (localStorage)
// ============================================================

const SAVE_KEY = 'exploreworlds_save_v1';

const Save = {
  data: null,
  defaults() {
    return {
      inv: { sucata: 60, ferro: 50, bio: 0, crio: 0, piro: 0, grav: 0, vazio: 0 },
      items: { grenade: 3, medkit: 1, repairkit: 0 },
      weapons: ['blaster'],
      upgrades: {},
      blueprints: ['wall', 'turret', 'mine'],
      completed: {},
      location: 'home',
      stats: { missions: 0, success: 0, kills: 0, bosses: 0, playTime: 0 },
      tutorialDone: false,
      won: false,
      created: Date.now(),
    };
  },
  exists() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } },
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw), def = this.defaults();
        this.data = Object.assign(def, d);
        this.data.inv = Object.assign(def.inv, d.inv);
        this.data.items = Object.assign(this.defaults().items, d.items);
        this.data.stats = Object.assign(this.defaults().stats, d.stats);
        return true;
      }
    } catch (e) { console.warn('save corrompido', e); }
    this.data = this.defaults();
    return false;
  },
  newGame() { this.data = this.defaults(); this.save(); },
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { } },
  lvl(id) { return (this.data && this.data.upgrades[id]) || 0; },
  has(cost) { return Object.entries(cost).every(([k, v]) => (this.data.inv[k] || 0) >= v); },
  spend(cost) {
    if (!this.has(cost)) return false;
    for (const [k, v] of Object.entries(cost)) this.data.inv[k] -= v;
    return true;
  },
  add(res, n) { this.data.inv[res] = (this.data.inv[res] || 0) + n; },
};
