// Headless balance run: node tools/headless.mjs [ticks] [eraSchedule e.g. "0:0,3000:1,9000:2"]
import { Simulation } from "../src/sim/sim.js";
const ticks = +(process.argv[2] || 18000);
const sched = (process.argv[3] || "0:0").split(",").map((p) => p.split(":").map(Number));
const sim = Simulation.create(12345);
const t0 = performance.now();
for (let t = 1; t <= ticks; t++) {
  for (const [at, era] of sched) if (t === at && era > 0) sim.advanceEra(era);
  sim.step();
  for (const e of sim.drainEvents()) if (e.type !== "speciation" || process.env.V || !e.text.includes("แตกแขนง")) console.log(`  [${t}] ${e.text}`);
  if (t % 1500 === 0) {
    const st = sim.stats, alive = [...sim.species.values()].filter((s) => s.extinct === null && s.count > 0).sort((a, b) => b.count - a.count);
    const avg = (k) => (sim.creatures.reduce((a, c) => a + c.g[k], 0) / Math.max(1, sim.creatures.length)).toFixed(2);
    console.log(`t=${t} (${(t / 30 / 60).toFixed(1)}min) era=${sim.era} n=${st.n} roles=${st.roles} species=${st.alive} totalSp=${sim.totals.species} plants=${st.plants.toFixed(0)} size=${avg("size")} form=${avg("form")} diet=${avg("diet")} hab=${avg("habitat")} int=${avg("intellect")} spd=${avg("speed")} T=${sim.climate.offset.toFixed(2)} settl=${sim.settlements.length} civ=${st.civPop.toFixed(0)} dna=${sim.out.dna.toFixed(0)} kn=${sim.out.knowledge.toFixed(0)} | ${((performance.now() - t0) / t).toFixed(2)}ms/tick`);
    console.log("   top:", alive.slice(0, 5).map((s) => `${s.name}[${s.count}] ${s.desc}`).join(" | "));
  }
}
const json = JSON.stringify(sim.serialize());
console.log("save size KB", (json.length / 1024).toFixed(0));
const r = Simulation.restore(JSON.parse(json)); for (let i = 0; i < 100; i++) r.step(); console.log("restore ok n=", r.creatures.length);
const bySmart = [...sim.species.values()].filter((s) => s.avg).sort((a, b) => b.avg.intellect - a.avg.intellect).slice(0, 6);
for (const s of bySmart) console.log("smart:", s.name, "cnt", s.count, "peak", s.peak, "ext", s.extinct, "int", s.avg.intellect.toFixed(2), "hab", s.avg.habitat.toFixed(2), "size", s.avg.size.toFixed(2), "diet", s.avg.diet.toFixed(2), "born", s.born, "sap", s.sapient);
