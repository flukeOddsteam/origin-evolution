// Genome definition, mutation and genetic distance.
// Every gene is a plain number inside [min, max]; eras raise the caps (see ERA_CAPS in eras.js).

export const GENES = {
  size:      { min: 0.6, max: 6,   label: "ขนาดตัว",            short: "ขนาด",   w: 1.0 },
  speed:     { min: 0.2, max: 3,   label: "ความเร็ว",            short: "เร็ว",    w: 1.0 },
  sense:     { min: 15,  max: 180, label: "ระยะรับรู้",          short: "รับรู้",  w: 0.7 },
  diet:      { min: 0,   max: 1,   label: "อาหาร (พืช → เนื้อ)",  short: "กินเนื้อ", w: 1.6 },
  habitat:   { min: 0,   max: 1,   label: "ถิ่นอาศัย (น้ำ → บก)", short: "บก",     w: 1.4 },
  thermal:   { min: 0,   max: 1,   label: "อุณหภูมิที่ชอบ",       short: "ร้อน",    w: 0.9 },
  intellect: { min: 0,   max: 1,   label: "สติปัญญา",            short: "ปัญญา",  w: 1.2 },
  form:      { min: 0,   max: 1,   label: "ความซับซ้อนของร่าง",   short: "ซับซ้อน", w: 1.0 },
  fertility: { min: 0.1, max: 1,   label: "อัตราการสืบพันธุ์",    short: "สืบพันธุ์", w: 0.6 },
  longevity: { min: 0.5, max: 2,   label: "อายุขัย",              short: "อายุ",    w: 0.5 },
  armor:     { min: 0,   max: 1,   label: "เกราะ / เปลือก",       short: "เกราะ",   w: 1.1 },
  warm:      { min: 0,   max: 1,   label: "เลือดอุ่น",            short: "เลือดอุ่น", w: 1.1 },
  wing:      { min: 0,   max: 1,   label: "ปีก / การบิน",         short: "ปีก",     w: 1.3 },
};
export const GENE_DEFAULTS = { armor: 0, warm: 0.1, wing: 0 };
export const GENE_KEYS = Object.keys(GENES);
const W_SUM = GENE_KEYS.reduce((a, k) => a + GENES[k].w, 0);

export function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function capOf(key, caps) {
  const g = GENES[key];
  return caps && caps[key] !== undefined ? Math.min(g.max, caps[key]) : g.max;
}

export function clampGenes(genes, caps) {
  for (const k of GENE_KEYS) {
    const g = GENES[k];
    genes[k] = Math.max(g.min, Math.min(capOf(k, caps), genes[k]));
  }
  return genes;
}

/**
 * Copy + mutate. `opts` = { rate, strength, caps, bias: {gene, dir, amount} | null, drift: {gene: amount} }
 */
export function mutateGenes(parent, opts) {
  const child = { ...parent };
  let changed = 0;
  for (const k of GENE_KEYS) {
    if (Math.random() < opts.rate) {
      const g = GENES[k];
      const step = gauss() * opts.strength * (g.max - g.min);
      child[k] += step;
      changed += Math.abs(step) / (g.max - g.min);
    }
  }
  if (opts.bias) {
    const g = GENES[opts.bias.gene];
    child[opts.bias.gene] += opts.bias.dir * opts.bias.amount * (g.max - g.min) * Math.random();
  }
  if (opts.drift) for (const k in opts.drift) child[k] += opts.drift[k] * Math.random();
  child.hue = ((parent.hue ?? 160) + gauss() * (2 + changed * 90) + 360) % 360;
  return clampGenes(child, opts.caps);
}

export function geneDistance(a, b) {
  let s = 0;
  for (const k of GENE_KEYS) {
    const g = GENES[k];
    const d = (a[k] - b[k]) / (g.max - g.min);
    s += g.w * d * d;
  }
  return Math.sqrt(s / W_SUM);
}

export function blendGenes(target, src, alpha) {
  for (const k of GENE_KEYS) target[k] += (src[k] - target[k]) * alpha;
  return target;
}

// ---- Descriptions --------------------------------------------------------
export function roleOf(g) {
  if (g.diet >= 0.62) return "carnivore";
  if (g.diet >= 0.38) return "omnivore";
  return "herbivore";
}
export const ROLE_TH = { herbivore: "กินพืช", omnivore: "กินทั้งพืชและสัตว์", carnivore: "ผู้ล่า" };
export const ROLE_ICON = { herbivore: "🌿", omnivore: "🍖", carnivore: "🦷" };

export function tierOf(g, sapient) {
  if (sapient) return "sapient";
  if (g.form < 0.22) return "cell";
  if (g.form < 0.45) return "colony";
  if (g.habitat >= 0.62 && g.form >= 0.55) return "land";
  if (g.habitat >= 0.4 && g.form >= 0.5) return "amphibian";
  return "swimmer";
}
export const TIER_TH = {
  cell: "เซลล์เดียว", colony: "โคโลนีหลายเซลล์", swimmer: "สัตว์น้ำ",
  amphibian: "สัตว์ครึ่งบกครึ่งน้ำ", land: "สัตว์บก", sapient: "เผ่าพันธุ์ผู้มีปัญญา",
};

const EPI = ["primus", "minor", "major", "lentus", "mitis", "aquaticus", "terrestris", "borealis", "australis", "rubra", "viridis", "magnus", "parvus", "errans", "striatus", "maculatus", "gracilis", "robustus", "vulgaris", "elegans"];

/** arch is the body-plan key from archetypes.js (genus chosen to read like that group). */
export function speciesName(g, sapient, arch = "microbe", genusFor = null) {
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const genus = genusFor ? genusFor(arch) : "Proto" + pick(["cella", "coccus"]);
  let epi = pick(EPI);
  if (g.diet > 0.62) epi = pick(["ferox", "venator", "rapax", "vorax", "rex"]);
  else if (g.thermal < 0.3) epi = pick(["glacialis", "borealis", "frigidus"]);
  else if (g.thermal > 0.72) epi = pick(["tropicus", "ardens", "calidus"]);
  else if (g.speed > 2.4) epi = "velox";
  else if (g.size > 3.5) epi = pick(["magnus", "giganteus", "maximus"]);
  if (sapient) epi = pick(["sapiens", "sapiens", "astutus", "faber", "loquens"]);
  return genus.charAt(0).toUpperCase() + genus.slice(1) + " " + epi;
}

export function describeSpecies(g, sapient, archTh) {
  const bits = [archTh || TIER_TH[tierOf(g, sapient)]];
  bits.push(ROLE_TH[roleOf(g)]);
  if (g.wing >= 0.5) bits.push("บินได้");
  if (g.armor >= 0.5) bits.push("มีเกราะ");
  if (g.speed > 2.3) bits.push("ว่องไว");
  if (g.size > 3.2) bits.push("ตัวใหญ่");
  else if (g.size < 0.9) bits.push("ตัวจิ๋ว");
  if (g.thermal < 0.3) bits.push("ทนหนาว");
  else if (g.thermal > 0.72) bits.push("ชอบร้อน");
  if (g.intellect > 0.45 && !sapient) bits.push("ฉลาด");
  return bits.join(" · ");
}
