'use strict';
// ============================================================
//  Dados do jogo: recursos, biomas, mundos, armas, construções,
//  inimigos e receitas do Fabricador
// ============================================================

const RES = {
  sucata: { name: 'Sucata', color: '#d1a85a', desc: 'Restos de criaturas e máquinas. Usada em construções.' },
  ferro: { name: 'Ferro', color: '#a9b8c8', desc: 'Metal comum, extraído em quase todo mundo.' },
  bio: { name: 'Biogel', color: '#6fdc5a', desc: 'Gel orgânico de mundos selvagens.' },
  crio: { name: 'Criocristal', color: '#6fe8ff', desc: 'Cristal gelado de mundos congelados.' },
  piro: { name: 'Pirita Ígnea', color: '#ff8a3c', desc: 'Mineral incandescente de mundos vulcânicos.' },
  grav: { name: 'Gravitônio', color: '#b07cff', desc: 'Matéria densa de anomalias gravitacionais.' },
  vazio: { name: 'Essência do Vazio', color: '#ff4dd8', desc: 'Energia instável das bordas do universo.' },
};
const RES_ORDER = ['sucata', 'ferro', 'bio', 'crio', 'piro', 'grav', 'vazio'];

const BIOMES = {
  rock: {
    name: 'Rochoso', sky: ['#120f1c', '#2a2238', '#5c3f4c'], mts: ['#1f1a2b', '#2d2536', '#3f3140'],
    ground: { base: '#4a3a2e', top: '#7a6448', dark: '#2a2019', detail: '#94785a' },
    weather: 'dust', fog: '#5c3f4c', light: '#ffcf9a', celestial: { type: 'moon', color: '#e8d8c0', r: 22, x: 0.75, y: 0.2 }, deco: 'rocks',
  },
  jungle: {
    name: 'Selva', sky: ['#06141a', '#123a3a', '#2f6b4a'], mts: ['#0c2420', '#123428', '#1a4630'],
    ground: { base: '#2a3a20', top: '#4fa04a', dark: '#18241a', detail: '#a6d86a' },
    weather: 'spores', fog: '#2f6b4a', light: '#c8ff9a', celestial: { type: 'planet', color: '#a6d86a', r: 34, x: 0.2, y: 0.18, biome: 'jungle' }, deco: 'plants',
  },
  ice: {
    name: 'Congelado', sky: ['#0a1630', '#24508a', '#8ac4e8'], mts: ['#3a6a9a', '#5b8fbf', '#8cbde0'],
    ground: { base: '#5b7fa8', top: '#eaf6ff', dark: '#2f4a6a', detail: '#bfe6ff' },
    weather: 'snow', fog: '#a8d8f0', light: '#e0f6ff', celestial: { type: 'sun', color: '#f0fbff', r: 10, x: 0.8, y: 0.15 }, deco: 'crystals',
  },
  lava: {
    name: 'Vulcânico', sky: ['#140406', '#3a0c0c', '#8a2a12'], mts: ['#1e0808', '#2c0c0a', '#3e100c'],
    ground: { base: '#2a1414', top: '#4a2420', dark: '#120808', detail: '#ff6a2a' },
    weather: 'embers', fog: '#8a2a12', light: '#ff9a4a', celestial: { type: 'sun', color: '#ffb347', r: 26, x: 0.3, y: 0.22 }, deco: 'lavarocks',
  },
  anomaly: {
    name: 'Anomalia', sky: ['#080616', '#1e1240', '#48308a'], mts: ['#140c2c', '#1e1240', '#2a1a52'],
    ground: { base: '#2a2440', top: '#6a5aa0', dark: '#161228', detail: '#d9b8ff' },
    weather: 'motes', fog: '#48308a', light: '#d9b8ff', celestial: { type: 'rings', color: '#d9b8ff', r: 30, x: 0.7, y: 0.25, biome: 'anomaly' }, deco: 'floaters',
  },
  void: {
    name: 'Vazio', sky: ['#020105', '#0c0618', '#22103a'], mts: ['#08040f', '#0e0820', '#160c2c'],
    ground: { base: '#140c20', top: '#3a2a5a', dark: '#06030c', detail: '#ff3df0' },
    weather: 'void', fog: '#22103a', light: '#ff8af0', celestial: { type: 'rift', color: '#ff3df0', r: 40, x: 0.5, y: 0.2 }, deco: 'spires',
  },
  core: {
    name: 'Primordial', sky: ['#0a0208', '#2a0718', '#7a1f45'], mts: ['#14040c', '#200814', '#300c1e'],
    ground: { base: '#2a1018', top: '#7a2a3a', dark: '#120408', detail: '#fff0a0' },
    weather: 'embers', fog: '#7a1f45', light: '#fff0a0', celestial: { type: 'rift', color: '#fff0a0', r: 50, x: 0.5, y: 0.15 }, deco: 'spires',
  },
};

const WORLDS = [
  { id: 'terranova', name: 'Terra Nova', biome: 'rock', tier: 1, temp: 18, gravity: 1.0, res: 'ferro', waves: 4, boss: 'worm', pos: [0.13, 0.62], r: 11,
    desc: 'Planeta rochoso e estável, rico em ferro. Um bom lugar para montar a primeira operação de extração.' },
  { id: 'viridia', name: 'Viridia', biome: 'jungle', tier: 1, temp: 34, gravity: 0.9, res: 'bio', waves: 4, boss: 'queen', pos: [0.24, 0.30], r: 12,
    desc: 'Selva úmida coberta de esporos. A fauna voadora é agressiva — tetos ajudam.' },
  { id: 'glacius', name: 'Glacius', biome: 'ice', tier: 2, temp: -55, gravity: 1.0, res: 'crio', waves: 5, boss: 'worm', pos: [0.40, 0.72], r: 10,
    desc: 'Mundo congelado. O frio corrói a saúde do traje. Aquecedores salvam vidas — e enfraquecem a fauna nativa.' },
  { id: 'pyros', name: 'Pyros', biome: 'lava', tier: 2, temp: 95, gravity: 1.25, res: 'piro', waves: 5, boss: 'titan', pos: [0.43, 0.22], r: 12,
    desc: 'Rios de lava e gravidade alta. Ar-condicionado é essencial. Armas esquentam mais rápido.' },
  { id: 'helion', name: 'Hélion Delta', biome: 'anomaly', tier: 3, temp: 5, gravity: 0.5, res: 'grav', waves: 6, boss: 'queen', pos: [0.58, 0.48], r: 13,
    desc: 'Uma anomalia gravitacional. Saltos longos, projéteis flutuantes e muito Gravitônio.' },
  { id: 'krios', name: 'Krios Profundo', biome: 'ice', tier: 3, temp: -85, gravity: 1.5, res: 'crio', res2: 'grav', waves: 6, boss: 'titan', pos: [0.66, 0.80], r: 11,
    desc: 'Gelo eterno sob gravidade esmagadora. Somente os bem preparados sobrevivem.' },
  { id: 'fornalha', name: 'Fornalha', biome: 'lava', tier: 3, temp: 125, gravity: 0.85, res: 'piro', res2: 'grav', waves: 6, boss: 'worm', pos: [0.68, 0.16], r: 10,
    desc: 'A superfície derrete metal. Um verme colossal habita o magma.' },
  { id: 'nyx', name: 'Abismo de Nyx', biome: 'void', tier: 4, temp: -25, gravity: 0.7, res: 'vazio', waves: 7, boss: 'queen', pos: [0.80, 0.42], r: 12,
    desc: 'Na borda do universo conhecido. A Essência do Vazio pulsa sob o solo.' },
  { id: 'nucleo', name: 'Núcleo Primordial', biome: 'core', tier: 5, temp: 45, gravity: 1.0, res: 'vazio', waves: 7, boss: 'sovereign', pos: [0.91, 0.66], r: 16, final: true,
    desc: 'A origem de toda a fauna hostil. Destrua o Soberano do Vazio e o universo será seu para explorar.' },
];
const WORLD_BY_ID = Object.fromEntries(WORLDS.map(w => [w.id, w]));

// ---------------- Armas ----------------
const WEAPONS = {
  blaster: { name: 'Blaster', rate: 5, dmg: 8, speed: 430, spread: 0.03, heat: 7, count: 1, life: 1.2, color: '#7af0ff', size: 2, sfx: 'blaster', knock: 30,
    desc: 'Pistola de energia confiável.' },
  shotgun: { name: 'Espalhadora', rate: 1.6, dmg: 7, speed: 380, spread: 0.3, heat: 24, count: 7, life: 0.38, color: '#ffd27a', size: 2, sfx: 'shotgun', knock: 90,
    desc: 'Rajada de 7 projéteis a curta distância. Empurra inimigos.' },
  rifle: { name: 'Rifle de Pulso', rate: 11, dmg: 5.5, speed: 520, spread: 0.06, heat: 4.2, count: 1, life: 1.0, color: '#9cff6a', size: 1, sfx: 'rifle', knock: 12,
    desc: 'Cadência altíssima. Ótimo contra enxames.' },
  cryo: { name: 'Canhão Criogênico', rate: 14, dmg: 2.6, speed: 230, spread: 0.14, heat: 3.2, count: 1, life: 0.45, color: '#c8f8ff', size: 3, sfx: 'cryo', chill: 1, pierce: 2, knock: 0,
    desc: 'Jato congelante de curto alcance que atravessa e retarda inimigos.' },
  rocket: { name: 'Lança-Foguetes', rate: 1.3, dmg: 42, speed: 250, spread: 0.02, heat: 30, count: 1, life: 2, color: '#ff9a4d', size: 3, sfx: 'rocket', aoe: 38, knock: 0, rocket: true,
    desc: 'Foguetes com dano em área.' },
  rail: { name: 'Railgun Gravitacional', rate: 0.95, dmg: 75, heat: 42, color: '#d7a8ff', sfx: 'rail', hitscan: true, knock: 120,
    desc: 'Disparo instantâneo que atravessa todos os inimigos na linha.' },
};
const WEAPON_ORDER = ['blaster', 'shotgun', 'rifle', 'cryo', 'rocket', 'rail'];

// ---------------- Construções ----------------
const BUILDINGS = {
  wall: { name: 'Parede', cost: { sucata: 8, ferro: 4 }, hp: 260, w: 16, h: 28, solid: true,
    desc: 'Barra o avanço de inimigos terrestres.' },
  turret: { name: 'Torre de Vigilância', cost: { sucata: 22, ferro: 10 }, hp: 110, w: 16, h: 26, solid: true, range: 150, rate: 3, dmg: 6,
    desc: 'Atira automaticamente em inimigos terrestres e aéreos.' },
  mine: { name: 'Explosivo', cost: { sucata: 12, ferro: 4 }, hp: 40, w: 12, h: 6, solid: false, radius: 50, dmg: 110,
    desc: 'Explode quando um inimigo se aproxima. Cuidado: também fere você!' },
  ceiling: { name: 'Teto', cost: { sucata: 16, ferro: 8 }, hp: 240, w: 48, h: 58, solid: false,
    desc: 'Barreira aérea: bloqueia voadores e bombas. Serve de plataforma.' },
  heater: { name: 'Aquecedor', cost: { sucata: 18, ferro: 8 }, hp: 100, w: 16, h: 24, solid: true, radius: 58, delta: 70,
    desc: 'Eleva a temperatura ao redor. Protege do frio e debilita fauna de mundos gelados.' },
  cooler: { name: 'Ar-condicionado', cost: { sucata: 18, ferro: 8 }, hp: 100, w: 16, h: 24, solid: true, radius: 58, delta: -70,
    desc: 'Diminui a temperatura ao redor. Protege do calor e debilita fauna de mundos quentes.' },
  gravity: { name: 'Torre de Gravidade', cost: { sucata: 28, ferro: 12 }, hp: 130, w: 16, h: 34, solid: true, radius: 70,
    desc: 'Altera a gravidade ao redor. [E] alterna entre ALTA (puxa voadores e retarda) e BAIXA (inimigos flutuam).' },
};
const BUILD_ORDER = ['wall', 'turret', 'mine', 'ceiling', 'heater', 'cooler', 'gravity'];

// ---------------- Inimigos ----------------
const ENEMIES = {
  crawler: { name: 'Rastejante', hp: 22, speed: 42, dmg: 8, atkRate: 1.1, w: 14, h: 8, scrap: 2, cost: 1, minWave: 0, sprite: ['crawler1', 'crawler2'] },
  spitter: { name: 'Cuspidor', hp: 30, speed: 30, dmg: 10, atkRate: 0.5, w: 14, h: 11, scrap: 4, cost: 2, minWave: 1, ranged: true, range: 115, sprite: ['spitter1', 'spitter2'] },
  wasp: { name: 'Vespa', hp: 16, speed: 62, dmg: 7, atkRate: 0.8, w: 12, h: 8, scrap: 3, cost: 1.5, minWave: 1, air: true, sprite: ['wasp'] },
  brute: { name: 'Brutamonte', hp: 120, speed: 24, dmg: 22, atkRate: 0.8, w: 20, h: 15, scrap: 7, cost: 4, minWave: 2, bldMul: 2, heavy: true, sprite: ['brute1', 'brute2'] },
  bomber: { name: 'Bombardeiro', hp: 60, speed: 28, dmg: 18, atkRate: 0.45, w: 22, h: 11, scrap: 6, cost: 4, minWave: 3, air: true, bomber: true, sprite: ['bomber'] },
};

const BOSSES = {
  worm: { name: 'Verme Colossal', hp: 950 },
  queen: { name: 'Rainha da Colmeia', hp: 850 },
  titan: { name: 'Titã Ancestral', hp: 1250 },
  sovereign: { name: 'Soberano do Vazio', hp: 3600 },
};

// ---------------- Receitas do Fabricador ----------------
// cost: array por nível. max: níveis. Sem max = consumível repetível.
const RECIPES = [
  // ARMAS
  { id: 'w_shotgun', cat: 'armas', name: 'Espalhadora', icon: 'shotgun', max: 1, weapon: 'shotgun', cost: [{ ferro: 35, sucata: 30 }], desc: WEAPONS.shotgun.desc },
  { id: 'w_rifle', cat: 'armas', name: 'Rifle de Pulso', icon: 'rifle', max: 1, weapon: 'rifle', cost: [{ ferro: 50, bio: 25 }], desc: WEAPONS.rifle.desc },
  { id: 'w_cryo', cat: 'armas', name: 'Canhão Criogênico', icon: 'cryo', max: 1, weapon: 'cryo', cost: [{ ferro: 45, crio: 30 }], desc: WEAPONS.cryo.desc },
  { id: 'w_rocket', cat: 'armas', name: 'Lança-Foguetes', icon: 'rocket', max: 1, weapon: 'rocket', cost: [{ ferro: 60, piro: 30 }], desc: WEAPONS.rocket.desc },
  { id: 'w_rail', cat: 'armas', name: 'Railgun Gravitacional', icon: 'rail', max: 1, weapon: 'rail', cost: [{ ferro: 80, grav: 35, crio: 15 }], desc: WEAPONS.rail.desc },
  { id: 'dmg', ico: 'w:rail', cat: 'armas', name: 'Calibragem de Dano', max: 3, cost: [{ ferro: 30, sucata: 40 }, { ferro: 60, bio: 20, piro: 15 }, { ferro: 90, grav: 25, vazio: 10 }],
    desc: '+20% de dano em todas as armas por nível.' },
  { id: 'cool', ico: 'b:cooler', cat: 'armas', name: 'Dissipador Térmico', max: 2, cost: [{ ferro: 40, crio: 15 }, { ferro: 70, crio: 35, grav: 10 }],
    desc: 'Armas esfriam 35% mais rápido por nível.' },

  { id: 'crit', ico: 'w:rifle', cat: 'armas', name: 'Munição Perfurante', max: 3, cost: [{ ferro: 35, sucata: 35 }, { ferro: 55, crio: 20 }, { ferro: 80, grav: 20, vazio: 8 }],
    desc: '+10% de chance de acerto crítico (dano x2,5) por nível.' },
  { id: 'rof', ico: 'w:blaster', cat: 'armas', name: 'Gatilho Acelerado', max: 3, cost: [{ ferro: 40, sucata: 30 }, { ferro: 60, bio: 25 }, { ferro: 90, piro: 30, grav: 15 }],
    desc: '+12% de cadência de tiro em todas as armas por nível.' },
  { id: 'grenade_mk', ico: 'g:G', cat: 'armas', name: 'Granadas de Fragmentação', max: 1, cost: [{ ferro: 40, piro: 20 }],
    desc: 'Granadas causam +60% de dano, têm raio maior e soltam estilhaços.' },
  { id: 'lifesteal', ico: 'r:bio', cat: 'armas', name: 'Sifão Vital', max: 2, cost: [{ bio: 35, sucata: 30 }, { bio: 60, vazio: 12 }],
    desc: 'Cada abate recupera 1 de vida por nível.' },

  // TRAJE
  { id: 'armor', ico: 'p', cat: 'traje', name: 'Blindagem do Traje', max: 3, cost: [{ ferro: 30, sucata: 25 }, { ferro: 55, bio: 20 }, { ferro: 80, piro: 25, crio: 25 }],
    desc: '+30 de vida máxima por nível.' },
  { id: 'jetpack', ico: 'p', cat: 'traje', name: 'Jetpack', max: 2, cost: [{ ferro: 35, bio: 15 }, { ferro: 60, grav: 20 }],
    desc: 'Segure PULAR no ar para voar. Nível 2: +80% combustível.' },
  { id: 'thermal', ico: 'p', cat: 'traje', name: 'Traje Térmico', max: 2, cost: [{ ferro: 30, bio: 20 }, { ferro: 60, crio: 20, piro: 20 }],
    desc: 'Amplia a faixa de temperatura suportável em ±20°C por nível.' },
  { id: 'magnet', ico: 'r:sucata', cat: 'traje', name: 'Ímã de Coleta', max: 1, cost: [{ ferro: 25, sucata: 30 }],
    desc: 'Dobra o raio de coleta de recursos.' },
  { id: 'regen', ico: 'r:bio', cat: 'traje', name: 'Nanorreparo', max: 1, cost: [{ bio: 40, grav: 15 }],
    desc: 'Regenera 2 de vida por segundo fora de combate direto.' },

  { id: 'boots', ico: 'p', cat: 'traje', name: 'Servomotores', max: 2, cost: [{ ferro: 30, sucata: 25 }, { ferro: 50, grav: 15 }],
    desc: '+12% de velocidade de movimento por nível.' },
  { id: 'dash_mk', ico: 'p', cat: 'traje', name: 'Propulsor de Esquiva', max: 2, cost: [{ ferro: 30, bio: 15 }, { ferro: 55, piro: 20 }],
    desc: 'Recarga da esquiva 30% menor por nível. Nível 2: a esquiva causa dano a quem você atravessa.' },
  { id: 'shield', ico: 'g:◈', cat: 'traje', name: 'Escudo de Energia', max: 2, cost: [{ ferro: 50, crio: 20 }, { ferro: 80, grav: 25, vazio: 8 }],
    desc: 'Escudo de 25 pontos (+25 por nível) que absorve dano e recarrega após 3s sem levar golpes.' },
  { id: 'double_jump', ico: 'p', cat: 'traje', name: 'Botas Gravitacionais', max: 1, cost: [{ ferro: 40, grav: 15 }],
    desc: 'Permite um segundo pulo no ar.' },
  { id: 'scavenger', ico: 'r:sucata', cat: 'traje', name: 'Kit de Garimpo', max: 2, cost: [{ ferro: 25, sucata: 40 }, { ferro: 45, bio: 25 }],
    desc: '+25% de sucata deixada por inimigos por nível.' },

  // CONSTRUÇÕES
  { id: 'bp_ceiling', cat: 'construcoes', name: 'Projeto: Teto', icon: 'b_ceiling', max: 1, blueprint: 'ceiling', cost: [{ ferro: 35, sucata: 20 }], desc: BUILDINGS.ceiling.desc },
  { id: 'bp_heater', cat: 'construcoes', name: 'Projeto: Aquecedor', icon: 'b_heater', max: 1, blueprint: 'heater', cost: [{ ferro: 40, bio: 15 }], desc: BUILDINGS.heater.desc },
  { id: 'bp_cooler', cat: 'construcoes', name: 'Projeto: Ar-condicionado', icon: 'b_cooler', max: 1, blueprint: 'cooler', cost: [{ ferro: 40, bio: 15 }], desc: BUILDINGS.cooler.desc },
  { id: 'bp_gravity', cat: 'construcoes', name: 'Projeto: Torre de Gravidade', icon: 'b_gravity', max: 1, blueprint: 'gravity', cost: [{ ferro: 60, crio: 20, piro: 20 }], desc: BUILDINGS.gravity.desc },
  { id: 'turret_mk', ico: 'b:turret', cat: 'construcoes', name: 'Torres Mk II/III', max: 2, cost: [{ ferro: 50, sucata: 40 }, { ferro: 80, piro: 25, crio: 25 }],
    desc: '+35% de dano e +15% de alcance das torres por nível.' },
  { id: 'wall_mk', ico: 'b:wall', cat: 'construcoes', name: 'Paredes Reforçadas', max: 2, cost: [{ ferro: 40, sucata: 30 }, { ferro: 60, grav: 20 }],
    desc: '+50% de vida para paredes e tetos por nível.' },
  { id: 'mine_mk', ico: 'b:mine', cat: 'construcoes', name: 'Explosivo de Plasma', max: 1, cost: [{ ferro: 40, piro: 25 }],
    desc: '+40% de raio e dano dos explosivos.' },
  { id: 'thermo_mk', ico: 'b:heater', cat: 'construcoes', name: 'Termorreguladores Mk II', max: 1, cost: [{ crio: 25, piro: 25, ferro: 30 }],
    desc: 'Aquecedores e ar-condicionados ficam 40% mais fortes e com mais alcance.' },

  { id: 'build_cost', ico: 'r:ferro', cat: 'construcoes', name: 'Fabricação Modular', max: 2, cost: [{ ferro: 50, sucata: 40 }, { ferro: 80, crio: 20, piro: 20 }],
    desc: 'Construções custam 15% menos por nível.' },
  { id: 'auto_repair', ico: 'b:wall', cat: 'construcoes', name: 'Nanorrobôs de Reparo', max: 2, cost: [{ ferro: 45, bio: 25 }, { ferro: 70, bio: 40, grav: 15 }],
    desc: 'Construções regeneram 1% da vida por segundo por nível.' },
  { id: 'turret_rate', ico: 'b:turret', cat: 'construcoes', name: 'Sincronizador de Torres', max: 2, cost: [{ ferro: 45, crio: 15 }, { ferro: 70, piro: 25 }],
    desc: '+25% de cadência das torres por nível.' },
  { id: 'refund', ico: 'r:sucata', cat: 'construcoes', name: 'Reciclagem', max: 1, cost: [{ ferro: 30, sucata: 30 }],
    desc: 'Desmontar construções devolve 80% dos recursos em vez de 50%.' },
  { id: 'grav_mk', ico: 'b:gravity', cat: 'construcoes', name: 'Ressonador Gravitacional', max: 1, cost: [{ grav: 35, ferro: 50 }],
    desc: 'Torres de gravidade têm +30% de alcance e o modo ALTO esmaga inimigos (6 de dano/s).' },

  // NAVE
  { id: 'warp', ico: 'g:»', cat: 'nave', name: 'Motor de Dobra', max: 3, cost: [{ ferro: 70, bio: 30 }, { ferro: 110, crio: 40, piro: 40 }, { ferro: 150, grav: 55 }],
    desc: 'Aumenta o alcance da nave. Mk II: setor 2 · Mk III: setor 3 · Mk IV: setor 4.' },
  { id: 'corekey', ico: 'r:vazio', cat: 'nave', name: 'Chave do Núcleo', max: 1, cost: [{ vazio: 60, grav: 30, ferro: 100 }], req: () => Save.lvl('warp') >= 3, reqText: 'Requer Motor de Dobra Mk IV',
    desc: 'Coordenadas e escudo para alcançar o Núcleo Primordial.' },
  { id: 'drill_speed', ico: 'r:ferro', cat: 'nave', name: 'Broca Aprimorada', max: 3, cost: [{ ferro: 40, sucata: 30 }, { ferro: 70, piro: 20 }, { ferro: 100, grav: 25 }],
    desc: '+35% de velocidade de extração por nível.' },
  { id: 'drill_armor', ico: 'r:grav', cat: 'nave', name: 'Blindagem da Broca', max: 2, cost: [{ ferro: 50, sucata: 30 }, { ferro: 90, crio: 25 }],
    desc: '+40% de vida da broca por nível.' },
  { id: 'cargo', ico: 'r:piro', cat: 'nave', name: 'Compartimento de Carga', max: 2, cost: [{ ferro: 45, bio: 15 }, { ferro: 80, piro: 20, crio: 20 }],
    desc: '+25% de recursos extraídos por nível.' },
  { id: 'escort', ico: 'g:✈', cat: 'nave', name: 'Drone de Escolta', max: 2, cost: [{ ferro: 60, bio: 25, sucata: 40 }, { ferro: 90, grav: 25 }],
    desc: 'Uma pequena nave que acompanha você e atira nos inimigos. Nível 2: dois drones.' },

  { id: 'drill_turret', ico: 'b:turret', cat: 'nave', name: 'Torreta da Broca', max: 2, cost: [{ ferro: 60, sucata: 40 }, { ferro: 90, piro: 25 }],
    desc: 'Instala um canhão no topo da broca que atira sozinho. Nível 2: canhão duplo.' },
  { id: 'drill_regen', ico: 'r:bio', cat: 'nave', name: 'Reator de Reparo', max: 2, cost: [{ ferro: 50, bio: 30 }, { ferro: 80, crio: 25, grav: 15 }],
    desc: 'A broca regenera 3 de vida por segundo por nível.' },
  { id: 'scanner', ico: 'r:crio', cat: 'nave', name: 'Scanner Orbital', max: 1, cost: [{ ferro: 40, crio: 20 }],
    desc: '+2 depósitos por missão e veios 30% mais ricos.' },
  { id: 'orbital', ico: 'g:☄', cat: 'nave', name: 'Satélite de Ataque', max: 2, cost: [{ ferro: 80, grav: 30 }, { ferro: 110, vazio: 25 }],
    desc: 'A cada 20s um raio orbital atinge o maior grupo de inimigos. Nível 2: a cada 12s e mais dano.' },
  { id: 'logistics', ico: 'r:sucata', cat: 'nave', name: 'Logística de Pouso', max: 2, cost: [{ ferro: 30, sucata: 30 }, { ferro: 50, bio: 20 }],
    desc: 'Começa cada missão com +40 de sucata e +15s de preparação por nível.' },

  // ITENS
  { id: 'i_grenade', cat: 'itens', name: 'Granadas (x3)', item: 'grenade', qty: 3, cost: [{ sucata: 15, ferro: 6 }], desc: '[G] Arremessa uma granada. Dano em área.' },
  { id: 'i_medkit', cat: 'itens', name: 'Kit Médico', item: 'medkit', qty: 1, cost: [{ bio: 10, sucata: 8 }], desc: '[H] Recupera 60 de vida.' },
  { id: 'i_repair', cat: 'itens', name: 'Kit de Reparo', item: 'repairkit', qty: 1, cost: [{ ferro: 20, sucata: 10 }], desc: '[F] Repara 40% de todas as construções e 15% da broca.' },
];
const RECIPE_CATS = [
  { id: 'armas', name: 'Armas' }, { id: 'traje', name: 'Traje' }, { id: 'construcoes', name: 'Construções' },
  { id: 'nave', name: 'Nave' }, { id: 'itens', name: 'Itens' },
];
const ITEMS = {
  grenade: { name: 'Granada', key: 'G' },
  medkit: { name: 'Kit Médico', key: 'H' },
  repairkit: { name: 'Kit de Reparo', key: 'F' },
};

// custo de uma construção já com o desconto da Fabricação Modular
function buildCost(type) {
  const k = 1 - 0.15 * Save.lvl('build_cost');
  return Object.fromEntries(Object.entries(BUILDINGS[type].cost).map(([r, v]) => [r, Math.max(1, Math.round(v * k))]));
}

function worldReachable(w) {
  if (w.final) return Save.lvl('corekey') >= 1;
  return w.tier <= 1 + Save.lvl('warp');
}
function worldLockReason(w) {
  if (w.final) return 'Requer a Chave do Núcleo';
  const need = w.tier - 1;
  return 'Requer Motor de Dobra Mk ' + ['I', 'II', 'III', 'IV'][need];
}
