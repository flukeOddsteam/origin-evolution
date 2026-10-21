// Civilisation layer: sapient bands found camps, camps grow into villages, towns and cities that
// farm the land, hunt wildlife, emit pollution and eventually launch rockets.
import { SETTLEMENT_LEVELS, SETTLEMENT_LEVEL_CAP } from "./eras.js";
import { CELL, GW, GH, WORLD_W, WORLD_H } from "./world.js";

const A = ["ศรี", "นา", "วัง", "เชียง", "ภู", "ลำ", "ทุ่ง", "ท่า", "บาง", "ดอน", "เวียง", "สุวรรณ", "อุดร", "รัตน", "จันท", "พิมาย", "อโย", "ทวา", "กุสิ", "หริ", "ละโว้", "ไตร", "อินท", "ปัญจ"];
const B = ["นคร", "บุรี", "ธานี", "ปุระ", "วดี", "ทวีป", "คาม", "ราช", "พิมาน", "ภูมิ", "ราษฎร์", "ปราการ"];
const pick = (a) => a[(Math.random() * a.length) | 0];
const settlementName = (sim) => { for (let k = 0; k < 12; k++) { const n = pick(A) + pick(B); if (!sim.settlements.some((s) => s.name === n)) return n; } return pick(A) + pick(B) + " " + sim.nextSettlement; };

export function nearestSettlement(sim, x, y, maxD = Infinity) {
  let best = null, bd = maxD;
  for (const s of sim.settlements) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s; } }
  return best;
}

function foodEfficiency(era) { return [1, 1, 1, 1, 1, 1.5, 2.6, 5, 9, 14, 20, 28][Math.min(era, 11)]; }

export function civStep(sim, dt) {
  if (sim.era < 4) { sim.climate.pollution = 0; return; }
  const w = sim.world, P = sim.params, sec = dt / 30;

  // --- 1. sapient bands settle down
  if (sim.settlements.length < 70) {
    for (const c of sim.creatures) {
      if (c.dead || c.age < 200 || Math.random() > 0.3) continue;
      const sp = sim.species.get(c.sp);
      if (!sp?.sapient) continue;
      if (c.mode === 4 && c.mig > 0) continue; // still migrating
      const i = w.idx(c.x, c.y);
      if (w.isWater(i) || w.type[i] >= 5) continue;
      const home = nearestSettlement(sim, c.x, c.y, 200);
      if (home) { // wandering people are drawn into nearby settlements
        if (home.sp === c.sp || sim.species.get(home.sp)?.sapient) { c.dead = true; c.joined = true; home.pop += 1; }
        continue;
      }
      const band = [];
      for (const o of sim.creatures) if (!o.dead && o.sp === c.sp && Math.abs(o.x - c.x) < 60 && Math.abs(o.y - c.y) < 60) band.push(o);
      if (band.length < 3) continue;
      const joined = band.slice(0, 8);
      for (const o of joined) { o.dead = true; o.joined = true; }
      const s = { id: sim.nextSettlement++, name: settlementName(sim), x: c.x, y: c.y, sp: c.sp, pop: joined.length, level: 0, born: sim.tick, peak: joined.length, port: false };
      sim.settlements.push(s);
      sim.emit("settlement", `🔥 ${sp.name} ตั้งถิ่นฐานแห่งใหม่: ${s.name}`, { settlement: s.id });
      if (sim.settlements.length >= 70) break;
    }
  }

  // --- 2. each settlement eats, grows, farms, hunts, emigrates
  const eff = foodEfficiency(sim.era) * P.farmYield;
  const levelCap = SETTLEMENT_LEVEL_CAP[Math.min(sim.era, SETTLEMENT_LEVEL_CAP.length - 1)];
  let totalPop = 0;
  for (let k = sim.settlements.length - 1; k >= 0; k--) {
    const s = sim.settlements[k];
    const R = 2 + s.level, cx = (s.x / CELL) | 0, cy = (s.y / CELL) | 0;
    let avail = 0; const cells = [];
    for (let yy = cy - R; yy <= cy + R; yy++) for (let xx = cx - R; xx <= cx + R; xx++) {
      if (xx < 0 || yy < 0 || xx >= GW || yy >= GH || (xx - cx) ** 2 + (yy - cy) ** 2 > R * R + 1) continue;
      const i = yy * GW + xx;
      if (w.type[i] === 0) continue; // no deep sea fishing for early people
      cells.push(i); avail += w.bio[i];
    }
    const want = s.pop * 0.03 * sec / eff;
    const take = Math.min(want, avail * 0.3);
    if (avail > 0) { const f = take / avail; for (const i of cells) w.bio[i] -= w.bio[i] * f; }
    const ratio = want > 0 ? take / want + (sim.era <= 5 ? 0.45 : 0.25) : 1; // plus gathering, hunting and fishing beyond the territory
    s.pop *= 1 + 0.014 * P.civGrowth * (ratio - 0.72) * sec;
    const cap = SETTLEMENT_LEVELS[Math.min(levelCap, 4)].cap;
    if (s.pop > cap) s.pop += (cap - s.pop) * 0.05;

    // level up / down
    let lvl = 0;
    for (let l = 0; l <= levelCap; l++) if (s.pop >= SETTLEMENT_LEVELS[l].min) lvl = l;
    if (lvl > s.level) sim.emit("settlement", `🏘️ ${s.name} เติบโตเป็น${SETTLEMENT_LEVELS[lvl].name} (ประชากร ${Math.round(s.pop)})`, { settlement: s.id });
    s.level = lvl;
    s.peak = Math.max(s.peak, s.pop);

    // agriculture converts wild land into farmland
    if (sim.era >= 5 && Math.random() < 0.18 * (s.level + 1) * sec) {
      const i = cells[(Math.random() * cells.length) | 0];
      if (i !== undefined && !w.isWater(i) && w.type[i] < 5 && w.green[i] > 0.25 && !w.farm[i]) w.farm[i] = 1;
    }
    // people hunt local wildlife
    if (Math.random() < 0.3 * sec) {
      const rr = R * CELL;
      for (const c of sim.creatures) {
        if (c.dead || Math.abs(c.x - s.x) > rr || Math.abs(c.y - s.y) > rr) continue;
        if (sim.species.get(c.sp)?.sapient) continue;
        if (Math.random() < 0.05 * (1 + s.level)) { sim.kill(c, "eaten"); s.pop += 0.1; }
      }
    }
    // emigration spreads civilisation across the continents
    if (s.pop > SETTLEMENT_LEVELS[s.level].cap * (s.level ? 0.55 : 0.45) && sim.settlements.length < 70 && Math.random() < 0.05 * P.emigration * sec) {
      const sp = sim.species.get(s.sp);
      if (sp) {
        const a = Math.random() * Math.PI * 2, d = 240 + Math.random() * 220;
        const tx = Math.max(10, Math.min(WORLD_W - 10, s.x + Math.cos(a) * d)), ty = Math.max(10, Math.min(WORLD_H - 10, s.y + Math.sin(a) * d));
        if (!w.isWater(w.idx(tx, ty))) {
          for (let m = 0; m < 4; m++) {
            const c = sim.makeCreature(s.x + (Math.random() - 0.5) * 10, s.y + (Math.random() - 0.5) * 10, { ...sp.avg, hue: sp.hue }, sp.id, 0.9, 0);
            c.mode = 4; c.mig = 140; c.tx = tx + (Math.random() - 0.5) * 20; c.ty = ty + (Math.random() - 0.5) * 20; c.age = 220;
            sim.newborn.push(c);
          }
          s.pop -= 4;
        }
      }
    }
    // knowledge
    sim.out.knowledge += s.pop * 0.004 * (1 + s.level * 0.6) * P.knowledgeMult * sec;
    // spaceflight
    if (sim.era >= 9 && s.level >= 3) {
      s.port = true;
      if (Math.random() < 0.005 * (s.level - 2) * sec * (sim.era >= 10 ? 2.5 : 1)) {
        sim.launches++;
        sim.effects.push({ kind: "rocket", x: s.x, y: s.y, life: 120, max: 120, r: 0 });
        if (Math.random() < 0.35) { sim.colonies++; sim.emit("space", `🚀 ยานจาก ${s.name} ก่อตั้งอาณานิคมนอกโลกแห่งที่ ${sim.colonies}`); }
      }
    }
    if (s.pop < 1.5) {
      sim.settlements.splice(k, 1);
      if (s.peak > 15) sim.emit("ruin", `🏚️ ${s.name} ถูกทิ้งร้าง เหลือเพียงซากปรักหักพัง`);
      continue;
    }
    totalPop += s.pop;
  }
  sim.out.knowledge += sim.colonies * 2 * P.knowledgeMult * sec;

  // --- 3. industry heats the planet
  const target = sim.era >= 7 ? Math.min(0.32, totalPop * 1.4e-5 * P.pollutionMult) : 0;
  sim.climate.pollution += (target - sim.climate.pollution) * 0.01 * sec;
}
