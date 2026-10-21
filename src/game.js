// Game layer: resources, era progression, upgrades, technologies, player powers and saving.
// The living world itself is in sim/; this file turns what happens there into progress.
import { ERAS, UPGRADES, TECHS, POWERS, powerCost } from "./data.js";
import { Simulation, TICKS_PER_SECOND } from "./sim/sim.js";
import { GENES } from "./sim/genes.js";

export const SAVE_KEY = "originEvolutionSave_v3";
const OLD_KEY = "originEvolutionSave_v2";
export const VERSION = "0.4.0";

const BASE_PARAMS = { mutationRate: 0.28, mutationStrength: 0.045, plantGrowth: 1, plantCap: 1, metabolism: 1, capacity: 1100, offspring: 1, farmYield: 1, civGrowth: 1, knowledgeMult: 1, pollutionMult: 1, emigration: 1 };

export function freshState(prestige = 0) {
  return {
    version: 3, createdAt: Date.now(), savedAt: Date.now(), playTime: 0,
    res: { dna: 0, energy: 20, knowledge: 0 }, totalDNA: 0,
    upgrades: {}, techs: {}, mutation: 0, prestige, cycles: 0,
    eraLog: [{ era: 0, tick: 0, at: Date.now() }], log: [],
    records: { maxPop: 0, maxSpecies: 0 },
  };
}

export function format(n, compact = true) {
  if (!Number.isFinite(n)) return "∞";
  if (compact) for (const [v, s] of [[1e15, "Qa"], [1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]]) if (Math.abs(n) >= v) return (n / v).toFixed(n / v >= 100 ? 0 : n / v >= 10 ? 1 : 2) + s;
  if (Math.abs(n) < 10 && n % 1 !== 0) return n.toFixed(1);
  return Math.floor(n).toLocaleString("en-US");
}
export const RES_TH = { dna: "DNA", energy: "พลังงาน", knowledge: "ความรู้" };

export class Game {
  constructor(state, sim) {
    this.state = state;
    this.sim = sim;
    this.metricsCache = null;
    this.applyParams();
  }

  static load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { raw = null; }
    if (raw?.version === 3 && raw.sim) {
      try {
        const st = { ...freshState(), ...raw }; delete st.sim;
        return { game: new Game(st, Simulation.restore(raw.sim)), restored: true, savedAt: raw.savedAt };
      } catch (e) { console.warn("save restore failed", e); }
    }
    let prestige = 0;
    try { const old = JSON.parse(localStorage.getItem(OLD_KEY)); if (old?.prestige) prestige = old.prestige; } catch { /* ignore */ }
    return { game: Game.newGame(prestige), restored: false };
  }

  static newGame(prestige = 0, cycles = 0) {
    const st = freshState(prestige); st.cycles = cycles;
    const g = new Game(st, Simulation.create());
    g.log("ระบบจำลองเริ่มทำงาน — โลกใหม่ก่อตัวขึ้น", "info");
    return g;
  }

  save() {
    this.state.savedAt = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ...this.state, sim: this.sim.serialize() }));
      return true;
    } catch (e) { console.warn("save failed", e); return false; }
  }
  exportJSON() { this.state.savedAt = Date.now(); return JSON.stringify({ ...this.state, sim: this.sim.serialize() }); }
  static importJSON(text) {
    const raw = JSON.parse(text);
    if (raw?.version !== 3 || !raw.sim) throw new Error("bad save");
    const st = { ...freshState(), ...raw }; delete st.sim;
    return new Game(st, Simulation.restore(raw.sim));
  }

  log(text, type = "info") {
    this.state.log.unshift({ text, type, t: this.sim?.tick || 0, at: Date.now() });
    if (this.state.log.length > 120) this.state.log.length = 120;
  }

  // ------------------------------------------------------------ parameters & income
  applyParams() {
    const s = this.state, p = { ...BASE_PARAMS };
    for (const u of UPGRADES) { const n = s.upgrades[u.id] || 0; if (n && u.apply) u.apply(p, n); }
    for (const t of TECHS) if (s.techs[t.id] && t.apply) t.apply(p);
    p.mutationRate += 0.035 * s.mutation;
    p.mutationStrength *= 1 + 0.12 * s.mutation;
    p.plantGrowth *= 1 + 0.04 * s.prestige;
    const keep = { guide: this.sim.params.guide, mutagenUntil: this.sim.params.mutagenUntil };
    Object.assign(this.sim.params, p, keep);
    this.sim.rederiveAll();
  }

  incomeMult(res) {
    const s = this.state;
    let m = 1;
    for (const u of UPGRADES) if (u.income?.[res]) m += u.income[res] * (s.upgrades[u.id] || 0);
    for (const t of TECHS) if (s.techs[t.id] && t.income?.[res]) m += t.income[res];
    if (res === "dna") m *= 1 + 0.06 * s.mutation;
    return m * (1 + 0.08 * s.prestige);
  }

  /** Move what the simulation produced into the player's resources. Call after stepping. */
  collect() {
    const o = this.sim.out, s = this.state;
    const dna = o.dna * 0.1 * this.incomeMult("dna");
    const energy = o.energy * 0.02 * this.incomeMult("energy");
    const knowledge = o.knowledge * this.incomeMult("knowledge");
    s.res.dna += dna; s.res.energy += energy; s.res.knowledge += knowledge;
    s.totalDNA += dna;
    o.dna = 0; o.energy = 0; o.knowledge = 0;
    return { dna, energy, knowledge };
  }

  // ------------------------------------------------------------ metrics & milestones
  metrics(force = false) {
    const sim = this.sim;
    if (!force && this.metricsCache && this.metricsCache.tick === sim.tick) return this.metricsCache;
    let complex = 0, land = 0;
    const w = sim.world;
    for (const c of sim.creatures) {
      if (c.g.form >= 0.45) complex++;
      if (c.g.habitat >= 0.62 && !w.isWater(w.idx(c.x, c.y))) land++;
    }
    const sapient = [...sim.species.values()].filter((sp) => sp.sapient && sp.extinct === null).length + (sim.settlements.length ? 0 : 0);
    const st = sim.stats;
    const m = {
      tick: sim.tick, population: st.n, species: st.alive, predators: st.roles[2], complex, landAnimals: land,
      sapient: Math.max(sapient, sim.settlements.length ? 1 : 0), settlements: sim.settlements.length,
      civPop: st.civPop, techs: Object.keys(this.state.techs).length, colonies: sim.colonies,
    };
    this.metricsCache = m;
    const r = this.state.records;
    r.maxPop = Math.max(r.maxPop, st.n); r.maxSpecies = Math.max(r.maxSpecies, st.alive);
    return m;
  }

  goals() {
    const e = ERAS[this.sim.era], m = this.metrics();
    return e.goals.map((g) => ({ ...g, cur: m[g.m] || 0, done: (m[g.m] || 0) >= g.need }));
  }
  eraCost() { return ERAS[this.sim.era].cost; }
  canAfford(cost) { return !!cost && Object.entries(cost).every(([k, v]) => this.state.res[k] >= v); }
  canEvolve() { const e = ERAS[this.sim.era]; return !!e.cost && this.goals().every((g) => g.done) && this.canAfford(e.cost); }

  evolve() {
    if (!this.canEvolve()) return false;
    for (const [k, v] of Object.entries(this.eraCost())) this.state.res[k] -= v;
    const next = this.sim.era + 1;
    this.sim.advanceEra(next);
    this.state.eraLog.push({ era: next, tick: this.sim.tick, at: Date.now() });
    this.log(`${ERAS[next].icon} เข้าสู่ ${ERAS[next].name}`, "era");
    this.applyParams();
    return true;
  }

  // ------------------------------------------------------------ shop
  upgradeCost(u) { return Math.ceil(u.cost * Math.pow(u.grow, this.state.upgrades[u.id] || 0)); }
  buyUpgrade(id) {
    const u = UPGRADES.find((x) => x.id === id), s = this.state;
    if (!u) return "ไม่พบอัปเกรด";
    if (this.sim.era < u.era) return "ยังไม่ถึงยุคที่ปลดล็อก";
    if ((s.upgrades[id] || 0) >= u.max) return "ถึงระดับสูงสุดแล้ว";
    const c = this.upgradeCost(u);
    if (s.res[u.res] < c) return `${RES_TH[u.res]} ไม่พอ`;
    s.res[u.res] -= c; s.upgrades[id] = (s.upgrades[id] || 0) + 1;
    this.applyParams();
    this.log(`${u.icon} ${u.name} ระดับ ${s.upgrades[id]}`, "upgrade");
    return true;
  }

  buyTech(id) {
    const t = TECHS.find((x) => x.id === id), s = this.state;
    if (!t || s.techs[id]) return "วิจัยแล้ว";
    if (this.sim.era < t.era) return "ยังไม่ถึงยุคที่ปลดล็อก";
    if (s.res.knowledge < t.cost) return "ความรู้ไม่พอ";
    s.res.knowledge -= t.cost; s.techs[id] = true;
    this.applyParams();
    this.log(`${t.icon} ค้นพบเทคโนโลยี: ${t.name}`, "tech");
    return true;
  }

  mutationCost() { return Math.ceil(100 * Math.pow(2.1, this.state.mutation)); }
  buyMutation() {
    const c = this.mutationCost();
    if (this.state.mutation >= 10) return "ถึงระดับสูงสุดแล้ว";
    if (this.state.res.dna < c) return "DNA ไม่พอ";
    this.state.res.dna -= c; this.state.mutation++;
    this.applyParams();
    this.log(`🧪 อัตราการกลายพันธุ์เพิ่มเป็นระดับ ${this.state.mutation}`, "upgrade");
    return true;
  }

  guideCost() { return Math.ceil(60 * Math.pow(1 + this.sim.era, 1.6)); }
  /** Directional selection: newborns are nudged toward a trait for 90 simulated seconds. */
  guide(gene, dir) {
    const c = this.guideCost();
    if (!GENES[gene]) return "ไม่พบยีน";
    if (this.state.res.dna < c) return "DNA ไม่พอ";
    this.state.res.dna -= c;
    this.sim.params.guide = { gene, dir, amount: 0.02, until: this.sim.tick + 90 * TICKS_PER_SECOND, start: this.sim.tick };
    this.log(`🎯 กำหนดแรงคัดเลือก: ${GENES[gene].label} ${dir > 0 ? "เพิ่มขึ้น" : "ลดลง"}`, "guide");
    return true;
  }
  mutagenCost() { return Math.ceil(80 * Math.pow(1 + this.sim.era, 1.5)); }
  mutagen() {
    const c = this.mutagenCost();
    if (this.state.res.dna < c) return "DNA ไม่พอ";
    this.state.res.dna -= c;
    this.sim.params.mutagenUntil = this.sim.tick + 45 * TICKS_PER_SECOND;
    this.log("☢️ รังสีคอสมิกเร่งการกลายพันธุ์ 3 เท่า", "guide");
    return true;
  }

  powerCost(id) { const p = POWERS.find((x) => x.id === id); return p?.cost ? powerCost(p, this.sim.era) : 0; }
  usePower(id, x, y, spId) {
    const p = POWERS.find((q) => q.id === id);
    if (!p || !p.cost) return "ไม่มีผล";
    const c = powerCost(p, this.sim.era);
    if (this.state.res[p.res] < c) return `${RES_TH[p.res]} ไม่พอ (${format(c)})`;
    if (id === "bloom") { this.sim.bloom(x, y, 90, 1.3); this.log("🌿 อาหารเบ่งบานตามคำสั่งของคุณ", "power"); }
    else if (id === "meteor") { const k = this.sim.meteor(x, y, 75); this.log(`☄️ คุณส่งอุกกาบาตลงมา สิ่งมีชีวิตตาย ${k} ตัว`, "power"); }
    else if (id === "seed") {
      if (!spId) return "เลือกสายพันธุ์ก่อน (คลิกสิ่งมีชีวิตหรือเลือกในแท็บสิ่งมีชีวิต)";
      const n = this.sim.seed(x, y, spId, 8);
      if (!n) return "สายพันธุ์นี้อยู่ในพื้นที่นี้ไม่ได้";
      this.log(`🧬 ปล่อย ${this.sim.species.get(spId).name} ${n} ตัว`, "power");
    }
    this.state.res[p.res] -= c;
    return true;
  }
  climateCost() { return Math.ceil(50 * (1 + this.sim.era * 0.6)); }
  climate(dir) {
    const c = this.climateCost();
    if (this.state.res.energy < c) return "พลังงานไม่พอ";
    this.state.res.energy -= c;
    this.sim.shiftClimate(dir * 0.06);
    this.log(dir > 0 ? "🔥 คุณทำให้โลกอุ่นขึ้น" : "❄️ คุณทำให้โลกเย็นลง", "power");
    return true;
  }

  // ------------------------------------------------------------ prestige
  prestigeGain() { return Math.max(1, Math.floor(Math.sqrt(this.state.totalDNA / 5000)) + Math.floor(this.sim.colonies / 4)); }
  canPrestige() { return this.sim.era >= 9; }
  prestige() {
    if (!this.canPrestige()) return null;
    const gain = this.prestigeGain();
    const g = Game.newGame(this.state.prestige + gain, this.state.cycles + 1);
    g.log(`🌌 จักรวาลเริ่มวัฏจักรใหม่ ได้เศษซากจักรวาล ${gain} ชิ้น`, "era");
    return g;
  }
}
