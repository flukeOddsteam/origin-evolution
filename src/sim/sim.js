// Agent-based ecosystem: every organism is an individual that moves, senses, eats, flees,
// reproduces with mutation and dies. Species emerge from genetic divergence.
import { GENES, GENE_KEYS, mutateGenes, geneDistance, blendGenes, roleOf, speciesName, describeSpecies, tierOf, gauss } from "./genes.js";
import { World, WORLD_W, WORLD_H, CELL, GW, GH } from "./world.js";
import { capsFor } from "./eras.js";
import { civStep, nearestSettlement } from "./civ.js";

export const TICKS_PER_SECOND = 30;
const BIN = 64, BW = Math.ceil(WORLD_W / BIN), BH = Math.ceil(WORLD_H / BIN);
const PLANT_E = 3.8;
const SPEC_T = 0.085;
const SAMPLE_EVERY = 60;
const HISTORY_MAX = 360;
const TAU = Math.PI * 2;

const MODE = { WANDER: 0, GRAZE: 1, HUNT: 2, FLEE: 3, MIGRATE: 4 };
export { MODE };
export const MODE_TH = ["สำรวจ", "หาอาหาร", "ไล่ล่า", "หลบหนี", "อพยพ"];

export class Simulation {
  constructor(seed) {
    this.world = new World(seed);
    this.creatures = [];
    this.newborn = [];
    this.species = new Map();
    this.settlements = [];
    this.tick = 0;
    this.nextId = 1;
    this.nextSpecies = 1;
    this.nextSettlement = 1;
    this.era = 0;
    this.params = { mutationRate: 0.28, mutationStrength: 0.045, plantGrowth: 1, plantCap: 1, metabolism: 1, capacity: 1100, offspring: 1, farmYield: 1, civGrowth: 1, knowledgeMult: 1, pollutionMult: 1, emigration: 1, guide: null, mutagenUntil: 0 };
    this.climate = { offset: 0, target: 0, player: 0, pollution: 0, applied: 0 };
    this.activeEvents = [];
    this.nextNatural = 3000 + Math.random() * 3000;
    this.out = { dna: 0, energy: 0, knowledge: 0, births: 0, deaths: 0, speciation: 0 };
    this.totals = { births: 0, deaths: 0, eaten: 0, starved: 0, aged: 0, species: 0, extinct: 0 };
    this.recent = { births: [], deaths: [] };
    this.history = [];
    this.events = [];
    this.effects = []; // short-lived visual effects for the renderer
    this.colonies = 0; this.launches = 0;
    this.bins = Array.from({ length: BW * BH }, () => []);
    this.lastNewSpecies = -999;
    this.stats = { n: 0, roles: [0, 0, 0], tiers: {}, alive: 0, civPop: 0, biodiversity: 0 };
  }

  static create(seed) {
    const s = new Simulation(seed);
    const root = {
      size: 0.75, speed: 0.7, sense: 38, diet: 0.06, habitat: 0.05, thermal: 0.62,
      intellect: 0, form: 0.04, fertility: 0.6, longevity: 1, hue: 168,
    };
    const sp = s.newSpecies(root, null);
    // seed the warm shallow seas
    const w = s.world;
    let placed = 0, guard = 0;
    while (placed < 70 && guard++ < 20000) {
      const x = Math.random() * WORLD_W, y = WORLD_H * (0.3 + Math.random() * 0.4), i = w.idx(x, y);
      if (w.type[i] !== 1) continue;
      const g = mutateGenes(root, { rate: 0.5, strength: 0.01, caps: capsFor(0) });
      s.creatures.push(s.makeCreature(x, y, g, sp.id, 0.7, 0));
      w.bio[i] = Math.max(w.bio[i], 0.6);
      placed++;
    }
    s.emit("info", "โมเลกุลจำลองตัวเองกลุ่มแรกถือกำเนิดในทะเลตื้นอันอบอุ่น");
    return s;
  }

  // ------------------------------------------------------------------ helpers
  emit(type, text, extra = {}) { this.events.push({ type, text, tick: this.tick, ...extra }); }
  drainEvents() { const e = this.events; this.events = []; return e; }
  get caps() { return capsFor(this.era); }

  newSpecies(genes, parentId) {
    const parent = parentId ? this.species.get(parentId) : null;
    const sapient = !!(parent?.sapient && genes.intellect >= 0.55);
    const proto = !!(parent?.proto || parent?.sapient);
    const sp = {
      id: this.nextSpecies++, parent: parentId, children: [], c: { ...genes }, avg: { ...genes },
      hue: genes.hue, name: speciesName(genes, sapient), born: this.tick, extinct: null,
      count: 0, peak: 0, total: 0, sapient, proto, era: this.era, depth: parent ? parent.depth + 1 : 0,
      desc: describeSpecies(genes, sapient), role: roleOf(genes), tier: tierOf(genes, sapient), hist: [],
    };
    if (parent) parent.children.push(sp.id);
    this.species.set(sp.id, sp);
    this.totals.species++;
    return sp;
  }

  makeCreature(x, y, g, sp, energyFrac = 0.6, gen = 0) {
    const c = { id: this.nextId++, x, y, a: Math.random() * TAU, g, sp, gen, age: 0, cd: 90, e: 0, mode: 0, tx: x, ty: y, prey: null, think: (Math.random() * 5) | 0, dead: false, mig: 0, atk: 0, born: this.tick };
    this.derive(c);
    c.e = c.maxE * energyFrac;
    return c;
  }

  derive(c) {
    const g = c.g;
    c.r = 1.6 + g.size * 2.1;
    c.maxE = 2 + 4 * g.size * g.size;
    c.maxAge = (1100 + g.size * 260) * g.longevity;
    c.spd = g.speed * 0.85;
    c.meat = Math.pow(g.diet, 1.3);
    c.veg = Math.pow(1 - g.diet, 1.3);
    c.hunter = g.diet >= 0.38;
    const brain = this.species.get(c.sp)?.proto || this.species.get(c.sp)?.sapient ? 0.0008 : 0.0018;
    c.base = (0.0019 * g.size + 0.0011 * g.speed * g.size) * (1 - 0.3 * g.form)
      + g.sense * 0.000012 + g.intellect * brain * (0.5 + g.size * 0.3) + g.form * 0.0012;
    // complex bodies digest better; on land in the age of tools, intelligence multiplies foraging
    const sapient = this.species.get(c.sp)?.sapient;
    const proto = this.species.get(c.sp)?.proto;
    c.tool = sapient ? 1.45 + 0.3 * g.intellect : proto && g.habitat > 0.5 ? 1.05 + 0.6 * g.intellect : 1;
    c.digest = (0.55 + 0.9 * g.form) * (0.75 + 0.22 * Math.min(g.size, 3)) * c.tool;
    if (c.tool > 1) c.base *= 0.75; // cooperation and shelter: tool users waste less energy
  }

  suit(g, i) {
    const h = g.habitat;
    if (this.world.isWater(i)) return h <= 0.3 ? 1 : Math.max(0, 1 - (h - 0.3) / 0.6);
    return h >= 0.65 ? 1 : Math.max(0, (h - 0.25) / 0.4);
  }

  // ------------------------------------------------------------------ main loop
  step() {
    this.tick++;
    const w = this.world, P = this.params;
    if (this.tick % 5 === 0) {
      w.updatePlants(5, { plantGrowth: P.plantGrowth, plantCap: P.plantCap, farmYield: P.farmYield, landPlants: this.era >= 3 });
    }
    if (this.tick % 30 === 0) { this.updateClimate(); civStep(this, 30); }

    // spatial bins
    for (const b of this.bins) b.length = 0;
    const list = this.creatures;
    for (const c of list) this.bins[this.binOf(c.x, c.y)].push(c);

    const crowd = Math.max(0, list.length / P.capacity - 1);
    this.crowdMult = 1 + crowd * 3 + crowd * crowd * 10;
    this.metabMult = P.metabolism * this.crowdMult;

    for (let k = 0; k < list.length; k++) {
      const c = list[k];
      if (c.dead) continue;
      this.updateCreature(c);
    }

    // cleanup + newborns
    let j = 0;
    for (let k = 0; k < list.length; k++) { const c = list[k]; if (!c.dead) list[j++] = c; }
    list.length = j;
    if (this.newborn.length) { for (const c of this.newborn) list.push(c); this.newborn.length = 0; }

    if (this.tick % SAMPLE_EVERY === 0) this.sample();
    if (this.tick >= this.nextNatural) this.naturalEvent();
    for (let e = this.effects.length - 1; e >= 0; e--) if (--this.effects[e].life <= 0) this.effects.splice(e, 1);
  }

  binOf(x, y) {
    const bx = Math.max(0, Math.min(BW - 1, (x / BIN) | 0)), by = Math.max(0, Math.min(BH - 1, (y / BIN) | 0));
    return by * BW + bx;
  }

  updateCreature(c) {
    const w = this.world, g = c.g;
    c.age++;
    if (c.cd > 0) c.cd--;
    if (c.atk > 0) c.atk--;
    if (++c.think >= 5) { c.think = 0; this.decide(c); }

    // ---- movement
    let tx = c.tx, ty = c.ty;
    if (c.mode === MODE.HUNT) {
      const p = c.prey;
      if (!p || p.dead) { c.mode = MODE.WANDER; c.prey = null; }
      else { tx = p.x; ty = p.y; }
    }
    const dx = tx - c.x, dy = ty - c.y, dist = Math.hypot(dx, dy);
    const ci = w.idx(c.x, c.y), s0 = this.suit(g, ci);
    let speed = c.spd * (0.25 + 0.75 * s0);
    if (c.mode === MODE.FLEE || c.mode === MODE.HUNT) speed *= 1.3;
    else if (c.mode === MODE.GRAZE && dist < 6) speed *= 0.2;
    if (dist > 1) {
      const want = Math.atan2(dy, dx);
      let da = want - c.a;
      da = ((da + Math.PI) % TAU + TAU) % TAU - Math.PI;
      const turn = 0.22;
      c.a += Math.max(-turn, Math.min(turn, da));
    }
    c.a += (Math.random() - 0.5) * 0.18;
    const step = Math.min(speed, dist + 0.5);
    let nx = c.x + Math.cos(c.a) * step, ny = c.y + Math.sin(c.a) * step;
    if (nx < 4 || nx > WORLD_W - 4) { c.a = Math.PI - c.a; nx = Math.max(4, Math.min(WORLD_W - 4, nx)); }
    if (ny < 4 || ny > WORLD_H - 4) { c.a = -c.a; ny = Math.max(4, Math.min(WORLD_H - 4, ny)); }
    const ni = w.idx(nx, ny);
    if (ni !== ci && this.suit(g, ni) < 0.18 && s0 >= 0.18) {
      c.a += Math.PI * (0.6 + Math.random() * 0.8);
      if (c.mode !== MODE.HUNT && c.mode !== MODE.FLEE) { c.mode = MODE.WANDER; this.pickWander(c); }
    } else { c.x = nx; c.y = ny; }

    // ---- metabolism
    const i = w.idx(c.x, c.y), s = this.suit(g, i);
    const dT = Math.abs(g.thermal - w.temp[i]);
    const heat = dT > 0.12 ? (dT - 0.12) * (dT - 0.12) * 0.045 * (0.6 + 0.4 * g.size) : 0;
    c.e -= (c.base + 0.0026 * step * step * g.size) * this.metabMult + heat + (1 - s) * 0.004;

    // ---- feeding
    if (c.veg > 0.05 && c.e < c.maxE) {
      const b = w.bio[i];
      if (b > 0.01) {
        const bite = Math.min(b, 0.016 * (0.3 + g.size * 0.9) * (c.mode === MODE.GRAZE ? 1 : 0.35));
        w.bio[i] = b - bite;
        const gain = bite * PLANT_E * c.veg * c.digest;
        c.e = Math.min(c.maxE, c.e + gain);
        this.out.energy += gain;
      }
    }
    if (c.mode === MODE.HUNT && c.prey && !c.prey.dead && c.atk === 0) {
      const p = c.prey;
      if (Math.hypot(p.x - c.x, p.y - c.y) < c.r + p.r + 1.5) {
        const chance = 0.32 + 0.4 * (c.spd / (c.spd + p.spd + 0.01)) + g.intellect * 0.15 - p.g.intellect * 0.12;
        if (Math.random() < chance) {
          const gain = (p.e * 0.7 + p.maxE * 0.6) * c.meat * (0.8 + 0.6 * g.form) * (c.tool > 1 ? 1.2 : 1);
          c.e = Math.min(c.maxE * 1.05, c.e + gain);
          this.out.energy += gain * 0.5;
          this.kill(p, "eaten");
          if (this.effects.length < 300) this.effects.push({ kind: "kill", x: p.x, y: p.y, life: 22, max: 22, r: p.r });
          c.mode = MODE.WANDER; c.prey = null;
        } else { c.atk = 14; }
      }
    }

    // ---- reproduction
    if (c.cd === 0 && c.age > 140 && c.e > c.maxE * (0.86 - 0.3 * g.fertility)) this.reproduce(c);

    // ---- death
    if (c.e <= 0) this.kill(c, "starved");
    else if (c.age > c.maxAge) this.kill(c, "aged");
    else if (Math.random() < 0.00004) this.kill(c, "other");
  }

  decide(c) {
    const g = c.g, w = this.world;
    const range = g.sense * (1 + g.intellect * 0.5);
    let threat = null, tD = Infinity, prey = null, pD = Infinity;
    const hungry = c.e < c.maxE * 0.9;
    const huntSize = g.diet >= 0.62 ? 1.05 : 0.75; // omnivores only take small prey
    const r = Math.ceil(range / BIN), bx = Math.max(0, Math.min(BW - 1, (c.x / BIN) | 0)), by = Math.max(0, Math.min(BH - 1, (c.y / BIN) | 0));
    const r2 = range * range, alert2 = (range * (0.55 + g.intellect * 0.45)) ** 2;
    for (let yy = Math.max(0, by - r); yy <= Math.min(BH - 1, by + r); yy++) {
      for (let xx = Math.max(0, bx - r); xx <= Math.min(BW - 1, bx + r); xx++) {
        const bin = this.bins[yy * BW + xx];
        for (let k = 0; k < bin.length; k++) {
          const o = bin[k];
          if (o === c || o.dead || o.sp === c.sp) continue;
          const ddx = o.x - c.x, ddy = o.y - c.y, d2 = ddx * ddx + ddy * ddy;
          if (d2 > r2) continue;
          if (o.hunter && c.r < o.r * (o.g.diet >= 0.62 ? 1.05 : 0.75) && d2 < alert2 && d2 < tD) { threat = o; tD = d2; }
          if (c.hunter && hungry && o.r < c.r * huntSize && d2 < pD) {
            const oi = w.idx(o.x, o.y);
            if (this.suit(g, oi) > 0.3) { prey = o; pD = d2; }
          }
        }
      }
    }
    if (threat && c.mode !== MODE.MIGRATE) {
      c.mode = MODE.FLEE; c.prey = null;
      const ax = c.x - threat.x, ay = c.y - threat.y, l = Math.hypot(ax, ay) || 1;
      c.tx = c.x + (ax / l) * 120; c.ty = c.y + (ay / l) * 120;
      return;
    }
    if (c.mode === MODE.MIGRATE) {
      if (Math.hypot(c.tx - c.x, c.ty - c.y) < 20 || c.mig <= 0) { c.mode = MODE.WANDER; c.mig = 0; }
      else { c.mig--; if (c.e > c.maxE * 0.3) return; }
    }
    if (prey && (c.meat > c.veg || w.bio[w.idx(c.x, c.y)] < 0.2)) { c.mode = MODE.HUNT; c.prey = prey; return; }
    if (c.mode === MODE.HUNT && c.prey && !c.prey.dead) return;
    if (hungry) {
      // forage: sample a few spots and move to the richest suitable one
      const here = w.idx(c.x, c.y);
      let best = w.bio[here] * this.suit(g, here) * 1.15, bx2 = c.x, by2 = c.y;
      const samples = 3 + Math.round(g.intellect * 6 + g.sense / 60);
      for (let k = 0; k < samples; k++) {
        const a = Math.random() * TAU, d = Math.random() * range;
        const sx = c.x + Math.cos(a) * d, sy = c.y + Math.sin(a) * d;
        if (sx < 0 || sy < 0 || sx >= WORLD_W || sy >= WORLD_H) continue;
        const si = w.idx(sx, sy), sc = w.bio[si] * this.suit(g, si) - d * 0.0012;
        if (sc > best) { best = sc; bx2 = sx; by2 = sy; }
      }
      if (best > 0.04) { c.mode = MODE.GRAZE; c.tx = bx2; c.ty = by2; c.prey = null; return; }
    }
    if (c.mode !== MODE.WANDER || Math.hypot(c.tx - c.x, c.ty - c.y) < 10 || Math.random() < 0.05) {
      c.mode = MODE.WANDER; c.prey = null; this.pickWander(c);
    }
  }

  pickWander(c) {
    const a = c.a + (Math.random() - 0.5) * 2, d = 40 + Math.random() * c.g.sense * 1.5;
    c.tx = Math.max(5, Math.min(WORLD_W - 5, c.x + Math.cos(a) * d));
    c.ty = Math.max(5, Math.min(WORLD_H - 5, c.y + Math.sin(a) * d));
  }

  reproduce(c) {
    const P = this.params, total = this.creatures.length + this.newborn.length;
    if (total > P.capacity * 1.9) return;
    const g = c.g;
    // once towns exist, people mostly have children inside settlements rather than in the wild
    if (this.era >= 5 && this.settlements.length >= 6 && this.species.get(c.sp)?.sapient && Math.random() < 0.75) { c.cd = 200; return; }
    const kids = g.fertility > 0.72 && g.size < 1.6 ? 2 : 1;
    const share = (c.e * 0.42 * P.offspring) / kids;
    c.e *= 0.5;
    c.cd = Math.round(140 + 120 * g.size * (1.25 - g.fertility));
    const mutagen = this.tick < P.mutagenUntil ? 3 : 1;
    const opts = {
      rate: Math.min(0.9, P.mutationRate * mutagen), strength: P.mutationStrength * (mutagen > 1 ? 1.8 : 1),
      caps: this.caps, bias: P.guide && this.tick < P.guide.until ? P.guide : null, drift: this.driftFor(c),
    };
    for (let k = 0; k < kids; k++) {
      const cg = mutateGenes(g, Math.random() < 0.012 * mutagen ? { ...opts, rate: 0.35, strength: opts.strength * 5 } : opts);
      const a = Math.random() * TAU;
      const child = this.makeCreature(c.x + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r, cg, c.sp, 0, c.gen + 1);
      child.e = Math.min(child.maxE, share);
      child.sp = this.assignSpecies(child, c.sp);
      this.newborn.push(child);
      this.out.births++; this.totals.births++;
      this.out.dna += 1;
      const sp = this.species.get(child.sp); sp.total++;
    }
    if (Math.random() < 0.25 && this.effects.length < 260) this.effects.push({ kind: "birth", x: c.x, y: c.y, life: 18, max: 18, r: c.r });
  }

  /** Called when the player unlocks a new era: a key evolutionary innovation appears in a few individuals. */
  advanceEra(era) {
    this.era = era;
    const caps = this.caps;
    const pool = this.creatures.filter((c) => !c.dead);
    const pickFrom = (arr, n) => { const out = []; for (let k = 0; k < n && arr.length; k++) out.push(arr.splice((Math.random() * arr.length) | 0, 1)[0]); return out; };
    const innovate = (who, patch, text) => this.innovate(who, patch, text, era);
    const _unused = (who, patch, text) => {
      if (!who.length) return;
      const g = { ...who[0].g, ...patch(who[0].g) };
      const sp = this.newSpecies(mutateGenes(g, { rate: 0, strength: 0, caps }), who[0].sp);
      if (era === 4) sp.proto = true;
      for (const c of who) {
        const cg = { ...c.g, ...patch(c.g) };
        c.g = mutateGenes(cg, { rate: 0.4, strength: 0.01, caps }); c.sp = sp.id; this.derive(c); c.e = c.maxE * 0.8;
      }
      this.emit("innovation", text.replace("{n}", sp.name), { species: sp.id });
    };
    if (era === 1) {
      innovate(pickFrom(pool.slice(), 10), (g) => ({ diet: 0.72, size: Math.min(caps.size, g.size + 0.45), speed: g.speed + 0.25, sense: g.sense + 20 }), "🦷 นวัตกรรมทางวิวัฒนาการ: {n} เรียนรู้การกลืนกินเซลล์อื่น — ผู้ล่ากลุ่มแรกถือกำเนิด");
    } else if (era === 2) {
      innovate(pickFrom(pool.filter((c) => c.g.diet < 0.4), 10), (g) => ({ form: 0.5, size: Math.min(caps.size, g.size + 0.6) }), "🧫 {n} เซลล์รวมตัวแบ่งหน้าที่กัน — สิ่งมีชีวิตหลายเซลล์ตัวแรก");
      innovate(pickFrom(pool.filter((c) => c.g.diet >= 0.5), 6), (g) => ({ form: 0.5, size: Math.min(caps.size, g.size + 0.8) }), "🦑 {n} นักล่าหลายเซลล์ ว่ายเร็วและใหญ่กว่าเดิม");
    } else if (era === 3) {
      const w = this.world;
      const coastal = pool.filter((c) => c.g.diet < 0.5 && c.g.form > 0.35 && this.nearLand(c));
      innovate(pickFrom(coastal.length ? coastal : pool.filter((c) => c.g.diet < 0.5), 10), (g) => ({ habitat: 0.62, form: Math.max(g.form, 0.65), size: Math.max(g.size, 1.4) }), "🦎 {n} คลานขึ้นจากทะเล — สัตว์บกตัวแรกบุกเบิกผืนดิน");
      for (let i = 0; i < w.bio.length; i++) if (w.coast[i]) w.green[i] = Math.max(w.green[i], 0.6);
      this.emit("bloom", "🌱 พืชเริ่มยึดครองชายฝั่ง และจะค่อย ๆ แผ่ขยายเข้าสู่ใจกลางทวีป");
    } else if (era === 4) {
      this.spawnProto(pool, innovate);
    }
    this.rederiveAll();
  }

  innovate(who, patch, text, era = this.era) {
    if (!who.length) return null;
    const caps = this.caps;
    const g = { ...who[0].g, ...patch(who[0].g) };
    const sp = this.newSpecies(mutateGenes(g, { rate: 0, strength: 0, caps }), who[0].sp);
    if (era >= 4 && g.intellect >= 0.5) sp.proto = true;
    for (const c of who) {
      const cg = { ...c.g, ...patch(c.g) };
      c.g = mutateGenes(cg, { rate: 0.4, strength: 0.01, caps }); c.sp = sp.id; this.derive(c); c.e = c.maxE * 0.85;
    }
    this.emit("innovation", text.replace("{n}", sp.name), { species: sp.id });
    return sp;
  }

  /** Tool-using primates. Re-attempted if the lineage dies out before reaching sapience. */
  spawnProto(pool = this.creatures.filter((c) => !c.dead), innovate = (w, p, t) => this.innovate(w, p, t)) {
    this.lastProto = this.tick;
    const land = pool.filter((c) => c.g.habitat > 0.55 && c.g.diet < 0.6 && c.g.form > 0.5).sort((a, b) => b.g.intellect - a.g.intellect);
    if (land.length < 10) return;
    const near = land.filter((c) => Math.hypot(c.x - land[0].x, c.y - land[0].y) < 300);
    const who = (near.length >= 12 ? near : land).slice(0, 24);
    this.bloom(who[0].x, who[0].y, 130, 1.2); // they appear in a fertile valley
    this.protoAttempts = (this.protoAttempts || 0) + 1;
    const iq = Math.min(0.69, 0.57 + 0.04 * this.protoAttempts);
    innovate(who, (g) => ({ intellect: Math.max(g.intellect, iq), longevity: Math.max(g.longevity, 1.3), fertility: 0.7, size: 1.4, diet: 0.46, habitat: Math.max(g.habitat, 0.78), form: 0.92, thermal: 0.6, sense: Math.max(g.sense, 70), speed: 1.1 }),
      "🐒 {n} เริ่มใช้เครื่องมือและสื่อสารกัน — บรรพบุรุษของผู้มีปัญญา");
  }

  rederiveAll() { for (const c of this.creatures) { const e = c.e; this.derive(c); c.e = Math.min(e, c.maxE); } }

  nearLand(c) {
    const w = this.world, cx = (c.x / CELL) | 0, cy = (c.y / CELL) | 0;
    for (let yy = cy - 2; yy <= cy + 2; yy++) for (let xx = cx - 2; xx <= cx + 2; xx++) {
      if (xx >= 0 && yy >= 0 && xx < GW && yy < GH && !w.isWater(yy * GW + xx)) return true;
    }
    return false;
  }

  // Gentle directional pressures that represent ecological opportunity in each era
  driftFor(c) {
    const g = c.g, sp = this.species.get(c.sp);
    if (this.era >= 4 && (sp?.proto || sp?.sapient) && g.habitat > 0.5) return { intellect: 0.02 };
    if (this.era >= 3 && g.form > 0.55 && this.world.coast[this.world.idx(c.x, c.y)]) return { habitat: 0.02 };
    if (this.era >= 1 && sp && sp.tier !== "cell" && this.era <= 2) return { form: 0.004 };
    return null;
  }

  assignSpecies(child, spId) {
    const sp = this.species.get(spId);
    const d = geneDistance(child.g, sp.c);
    if (d < SPEC_T) { blendGenes(sp.c, child.g, 0.0015); return spId; }
    // join a close relative before inventing a new species
    const candidates = [...sp.children, sp.parent].filter(Boolean);
    for (const id of candidates) {
      const o = this.species.get(id);
      if (o && o.extinct === null && geneDistance(child.g, o.c) < SPEC_T * 0.8) { blendGenes(o.c, child.g, 0.004); return id; }
    }
    if (this.tick - this.lastNewSpecies < 45) return spId;
    this.lastNewSpecies = this.tick;
    const ns = this.newSpecies(child.g, spId);
    this.out.speciation++;
    this.out.dna += 4 * (1 + this.era);
    this.emit("speciation", `สายพันธุ์ใหม่แตกแขนง: ${ns.name} (${ns.desc}) จาก ${sp.name}`, { species: ns.id });
    return ns.id;
  }

  kill(c, cause) {
    if (c.dead) return;
    c.dead = true; c.cause = cause;
    this.out.deaths++; this.totals.deaths++;
    if (cause === "eaten") this.totals.eaten++; else if (cause === "starved") this.totals.starved++; else if (cause === "aged") this.totals.aged++;
    const i = this.world.idx(c.x, c.y);
    if (cause !== "eaten") this.world.bio[i] += 0.08 * c.g.size; // decomposition returns nutrients
  }

  // ------------------------------------------------------------------ statistics
  sample() {
    const counts = new Map(), sums = new Map();
    let roles = [0, 0, 0];
    for (const c of this.creatures) {
      counts.set(c.sp, (counts.get(c.sp) || 0) + 1);
      let s = sums.get(c.sp);
      if (!s) { s = {}; for (const k of GENE_KEYS) s[k] = 0; s.hue = 0; sums.set(c.sp, s); }
      for (const k of GENE_KEYS) s[k] += c.g[k];
      s.hueX = (s.hueX || 0) + Math.cos(c.g.hue * Math.PI / 180); s.hueY = (s.hueY || 0) + Math.sin(c.g.hue * Math.PI / 180);
      const d = c.g.diet; roles[d >= 0.62 ? 2 : d >= 0.38 ? 1 : 0]++;
    }
    let alive = 0, H = 0;
    const n = this.creatures.length;
    for (const sp of this.species.values()) {
      if (sp.extinct !== null) continue;
      const cnt = counts.get(sp.id) || 0;
      sp.count = cnt;
      if (cnt > 0) {
        alive++;
        sp.peak = Math.max(sp.peak, cnt);
        const s = sums.get(sp.id);
        for (const k of GENE_KEYS) sp.avg[k] = s[k] / cnt;
        sp.hue = ((Math.atan2(s.hueY, s.hueX) * 180 / Math.PI) + 360) % 360;
        const p = cnt / n; H -= p * Math.log(p);
        if (!sp.sapient && this.era >= 4 && sp.avg.intellect >= 0.7 && sp.avg.habitat >= 0.55 && cnt >= 6) {
          sp.sapient = true;
          sp.name = speciesName(sp.avg, true);
          for (const c of this.creatures) if (c.sp === sp.id) { const e = c.e; this.derive(c); c.e = e; }
          this.emit("sapient", `🧠 ${sp.name} ตระหนักรู้ในตัวเอง — เผ่าพันธุ์ผู้มีปัญญากลุ่มแรกถือกำเนิด`, { species: sp.id });
        }
        sp.role = roleOf(sp.avg); sp.tier = tierOf(sp.avg, sp.sapient); sp.desc = describeSpecies(sp.avg, sp.sapient);
      } else if (this.tick - sp.born > 120) {
        sp.extinct = this.tick; this.totals.extinct++;
        if (sp.peak >= 8) this.emit("extinction", `💀 ${sp.name} สูญพันธุ์ (ประชากรสูงสุด ${sp.peak})`, { species: sp.id });
      }
      sp.hist.push(cnt); if (sp.hist.length > 60) sp.hist.shift();
    }
    let civPop = 0; for (const s of this.settlements) civPop += s.pop;
    this.stats = { n, roles, alive, civPop, biodiversity: H, plants: this.world.totalBio || 0, temp: this.climate.offset };
    const top = [...this.species.values()].filter((s) => s.extinct === null && s.count > 0).sort((a, b) => b.count - a.count).slice(0, 7);
    const snap = { t: this.tick, n, plants: this.stats.plants, roles: [...roles], civ: civPop, sp: {} };
    let rest = n; for (const s of top) { snap.sp[s.id] = s.count; rest -= s.count; }
    snap.other = rest;
    this.history.push(snap);
    if (this.history.length > HISTORY_MAX) this.history.shift();
    const now = this.tick;
    this.recent.births.push([now, this.totals.births]); this.recent.deaths.push([now, this.totals.deaths]);
    while (this.recent.births.length && now - this.recent.births[0][0] > TICKS_PER_SECOND * 60) { this.recent.births.shift(); this.recent.deaths.shift(); }
    if (n === 0) this.rescue();
    if (this.era >= 4 && !this.settlements.length && this.tick - (this.lastProto || 0) > 4500 && ![...this.species.values()].some((s) => s.extinct === null && s.count > 0 && (s.proto || s.sapient))) this.spawnProto();
    if (n > 0 && this.era >= 1 && roles[2] + roles[1] < Math.max(4, n * 0.015) && this.tick - (this.lastPredatorSpawn || 0) > 4000) this.spawnPredators();
  }

  /** Empty predator niche: a herbivore lineage turns carnivorous through a large mutation. */
  spawnPredators() {
    this.lastPredatorSpawn = this.tick;
    const pool = this.creatures.filter((c) => !c.dead && c.g.diet < 0.4 && !this.species.get(c.sp)?.sapient);
    if (pool.length < 30) return;
    const src = pool[(Math.random() * pool.length) | 0];
    const near = pool.filter((c) => c.sp === src.sp && Math.hypot(c.x - src.x, c.y - src.y) < 220).slice(0, 7);
    const caps = this.caps;
    const g0 = mutateGenes({ ...src.g, diet: 0.74, size: Math.min(caps.size, src.g.size * 1.35 + 0.3), speed: src.g.speed + 0.3, sense: src.g.sense + 25 }, { rate: 0, strength: 0, caps });
    const sp = this.newSpecies(g0, src.sp);
    for (const c of near) {
      c.g = mutateGenes({ ...c.g, diet: 0.74, size: Math.min(caps.size, c.g.size * 1.35 + 0.3), speed: c.g.speed + 0.3, sense: c.g.sense + 25 }, { rate: 0.3, strength: 0.01, caps });
      c.sp = sp.id; this.derive(c); c.e = c.maxE * 0.9;
    }
    this.emit("innovation", `🦷 ช่องว่างในห่วงโซ่อาหาร: ${sp.name} วิวัฒน์เป็นนักล่าสายพันธุ์ใหม่`, { species: sp.id });
  }

  ratePerMinute(kind) {
    const a = this.recent[kind];
    if (a.length < 2) return 0;
    const [t0, v0] = a[0], [t1, v1] = a[a.length - 1];
    return t1 > t0 ? (v1 - v0) / ((t1 - t0) / TICKS_PER_SECOND / 60) : 0;
  }

  /** If life goes fully extinct, hardy spores survive in the deep sea so the game can continue. */
  rescue() {
    const caps = this.caps;
    const g = { size: 0.8, speed: 0.8, sense: 40, diet: 0.05, habitat: 0.05, thermal: 0.55, intellect: 0, form: Math.min(caps.form, 0.1), fertility: 0.7, longevity: 1, hue: 200 };
    const sp = this.newSpecies(g, null);
    for (let k = 0; k < 40; k++) {
      const x = Math.random() * WORLD_W, y = Math.random() * WORLD_H, i = this.world.idx(x, y);
      if (this.world.isWater(i)) this.creatures.push(this.makeCreature(x, y, mutateGenes(g, { rate: 0.5, strength: 0.02, caps }), sp.id, 0.8));
    }
    this.emit("info", "ชีวิตเกือบดับสูญ แต่สปอร์ที่ทนทานในทะเลลึกเริ่มต้นวงจรชีวิตใหม่");
  }

  // ------------------------------------------------------------------ climate & events
  updateClimate() {
    const C = this.climate;
    let ev = 0;
    this.activeEvents = this.activeEvents.filter((e) => e.until > this.tick);
    for (const e of this.activeEvents) ev += e.delta;
    C.target = C.player + ev + C.pollution;
    C.offset += (C.target - C.offset) * 0.02;
    if (Math.abs(C.offset - C.applied) > 0.004) { this.world.setClimate(C.offset); C.applied = C.offset; }
  }

  naturalEvent() {
    this.nextNatural = this.tick + 5000 + Math.random() * 7000;
    const roll = Math.random();
    const dur = 2500 + Math.random() * 3000;
    if (roll < 0.28) {
      this.activeEvents.push({ kind: "ice", delta: -0.16 - Math.random() * 0.1, until: this.tick + dur });
      this.emit("climate", "❄️ ยุคน้ำแข็งเริ่มต้น — ทะเลขั้วโลกเยือกแข็ง สิ่งมีชีวิตต้องปรับตัวหรือสูญพันธุ์");
    } else if (roll < 0.5) {
      this.activeEvents.push({ kind: "warm", delta: 0.12 + Math.random() * 0.08, until: this.tick + dur });
      this.emit("climate", "🔥 โลกร้อนขึ้นจากภูเขาไฟระเบิดต่อเนื่อง");
    } else if (roll < 0.72) {
      const x = Math.random() * WORLD_W, y = Math.random() * WORLD_H;
      this.bloom(x, y, 160, 1.4);
      this.emit("bloom", "🌿 สาหร่ายเบ่งบานครั้งใหญ่ อาหารอุดมสมบูรณ์ในบางภูมิภาค");
    } else if (roll < 0.88 && this.era >= 2) {
      const top = [...this.species.values()].filter((s) => s.extinct === null).sort((a, b) => b.count - a.count)[0];
      if (top && top.count > 40) {
        let killed = 0;
        for (const c of this.creatures) if (c.sp === top.id && Math.random() < 0.35) { this.kill(c, "other"); killed++; }
        this.emit("disease", `🦠 โรคระบาดใน ${top.name} ประชากรลดลง ${killed}`);
      }
    } else if (this.era >= 2) {
      const x = Math.random() * WORLD_W, y = Math.random() * WORLD_H;
      const k = this.meteor(x, y, 130);
      this.emit("meteor", `☄️ อุกกาบาตพุ่งชน! สิ่งมีชีวิตตาย ${k} ตัว ฝุ่นทำให้โลกเย็นลงชั่วคราว`);
      this.activeEvents.push({ kind: "dust", delta: -0.1, until: this.tick + 1500 });
    }
  }

  // ------------------------------------------------------------------ player powers
  bloom(x, y, radius = 90, amount = 1.2) {
    const w = this.world, cr = Math.ceil(radius / CELL);
    const cx = (x / CELL) | 0, cy = (y / CELL) | 0;
    for (let yy = cy - cr; yy <= cy + cr; yy++) for (let xx = cx - cr; xx <= cx + cr; xx++) {
      if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
      const d = Math.hypot(xx - cx, yy - cy) / cr;
      if (d > 1) continue;
      const i = yy * GW + xx;
      w.bio[i] += amount * (1 - d * d);
      if (!w.isWater(i) && this.era >= 3) w.green[i] = Math.min(1, w.green[i] + 0.4 * (1 - d));
    }
    this.effects.push({ kind: "bloom", x, y, life: 50, max: 50, r: radius });
  }

  meteor(x, y, radius = 80) {
    let k = 0;
    for (const c of this.creatures) if (!c.dead && Math.hypot(c.x - x, c.y - y) < radius) { this.kill(c, "other"); k++; }
    const w = this.world, cr = Math.ceil(radius / CELL), cx = (x / CELL) | 0, cy = (y / CELL) | 0;
    for (let yy = cy - cr; yy <= cy + cr; yy++) for (let xx = cx - cr; xx <= cx + cr; xx++) {
      if (xx < 0 || yy < 0 || xx >= GW || yy >= GH || Math.hypot(xx - cx, yy - cy) > cr) continue;
      const i = yy * GW + xx; w.bio[i] *= 0.1; w.green[i] *= 0.3; w.farm[i] = 0;
    }
    for (const s of this.settlements) if (Math.hypot(s.x - x, s.y - y) < radius) s.pop *= 0.2;
    this.effects.push({ kind: "meteor", x, y, life: 70, max: 70, r: radius });
    return k;
  }

  seed(x, y, spId, count = 8) {
    const sp = this.species.get(spId);
    if (!sp) return 0;
    const base = { ...sp.avg, hue: sp.hue };
    let made = 0;
    for (let k = 0; k < count * 4 && made < count; k++) {
      const px = x + gauss() * 25, py = y + gauss() * 25;
      if (px < 0 || py < 0 || px >= WORLD_W || py >= WORLD_H) continue;
      const g = mutateGenes(base, { rate: 0.3, strength: 0.01, caps: this.caps });
      if (this.suit(g, this.world.idx(px, py)) < 0.3) continue;
      if (sp.extinct !== null) { sp.extinct = null; this.emit("info", `🧬 ฟื้นคืนชีพ ${sp.name} จากคลังพันธุกรรม`); }
      this.creatures.push(this.makeCreature(px, py, g, spId, 0.8));
      made++;
    }
    if (made) this.effects.push({ kind: "birth", x, y, life: 30, max: 30, r: 30 });
    return made;
  }

  shiftClimate(d) { this.climate.player = Math.max(-0.4, Math.min(0.4, this.climate.player + d)); }

  creatureAt(x, y, slop = 8) {
    let best = null, bd = Infinity;
    for (const c of this.creatures) {
      const d = Math.hypot(c.x - x, c.y - y) - c.r;
      if (d < slop && d < bd) { bd = d; best = c; }
    }
    return best;
  }
  settlementAt(x, y) { return nearestSettlement(this, x, y, 26); }
  findById(id) { return this.creatures.find((c) => c.id === id) || null; }

  // ------------------------------------------------------------------ persistence
  serialize() {
    const r2 = (v) => Math.round(v * 100) / 100, r4 = (v) => Math.round(v * 10000) / 10000;
    return {
      v: 3, tick: this.tick, nextId: this.nextId, nextSpecies: this.nextSpecies, nextSettlement: this.nextSettlement, era: this.era,
      params: this.params, climate: this.climate, activeEvents: this.activeEvents, nextNatural: this.nextNatural,
      totals: this.totals, colonies: this.colonies, launches: this.launches,
      world: this.world.serialize(),
      creatures: this.creatures.map((c) => [c.id, r2(c.x), r2(c.y), r2(c.a), r4(c.e), c.age, c.sp, c.gen, c.cd, c.mig, ...GENE_KEYS.map((k) => r4(c.g[k])), r2(c.g.hue)]),
      species: [...this.species.values()].filter((s) => s.extinct === null || s.peak >= 4 || s.children.length).map((s) => ({ ...s, hist: s.hist.slice(-30) })),
      settlements: this.settlements,
      history: this.history.slice(-200),
    };
  }

  static restore(d) {
    const s = new Simulation(d.world.seed);
    s.world = World.restore(d.world);
    Object.assign(s, { tick: d.tick, nextId: d.nextId, nextSpecies: d.nextSpecies, nextSettlement: d.nextSettlement || 1, era: d.era, nextNatural: d.nextNatural, colonies: d.colonies || 0, launches: d.launches || 0 });
    Object.assign(s.params, d.params);
    Object.assign(s.climate, d.climate); s.climate.applied = -99;
    s.activeEvents = d.activeEvents || [];
    Object.assign(s.totals, d.totals);
    for (const sp of d.species) s.species.set(sp.id, sp);
    s.settlements = d.settlements || [];
    s.history = d.history || [];
    const NK = GENE_KEYS.length;
    for (const a of d.creatures) {
      const g = {}; GENE_KEYS.forEach((k, j) => (g[k] = a[10 + j])); g.hue = a[10 + NK];
      if (!s.species.has(a[6])) continue;
      const c = s.makeCreature(a[1], a[2], g, a[6], 0, a[7]);
      Object.assign(c, { id: a[0], a: a[3], e: a[4], age: a[5], cd: a[8], mig: a[9] });
      if (c.mig > 0) c.mode = MODE.WANDER;
      s.creatures.push(c);
    }
    s.nextId = Math.max(d.nextId, s.nextId);
    s.updateClimate();
    s.world.updatePlants(0, { plantGrowth: s.params.plantGrowth, plantCap: s.params.plantCap, farmYield: s.params.farmYield, landPlants: s.era >= 3 });
    s.sample();
    return s;
  }
}
