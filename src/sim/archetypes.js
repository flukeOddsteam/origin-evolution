// Body plans. A species' average genes decide which recognisable group it belongs to, which in turn
// decides how it is drawn and named. Nothing is scripted: a lineage of fish that grows large and
// predatory simply *becomes* a shark-like body plan.

export const ARCH = {
  microbe:   { th: "จุลชีพเซลล์เดียว", icon: "🦠", group: "จุลชีพ", era: 0, habitat: "water" },
  colony:    { th: "โคโลนีหลายเซลล์", icon: "🧫", group: "จุลชีพ", era: 1, habitat: "water" },
  jelly:     { th: "แมงกะพรุน", icon: "🪼", group: "สัตว์ไม่มีกระดูกสันหลัง", era: 1, habitat: "water" },
  worm:      { th: "หนอนทะเล", icon: "🪱", group: "สัตว์ไม่มีกระดูกสันหลัง", era: 1, habitat: "water" },
  trilobite: { th: "ไทรโลไบต์", icon: "🪲", group: "สัตว์ขาปล้อง", era: 2, habitat: "water" },
  crab:      { th: "ปูและกุ้ง", icon: "🦀", group: "สัตว์ขาปล้อง", era: 2, habitat: "water" },
  ammonite:  { th: "แอมโมไนต์", icon: "🐚", group: "หอยและหมึก", era: 2, habitat: "water" },
  squid:     { th: "หมึก", icon: "🦑", group: "หอยและหมึก", era: 2, habitat: "water" },
  fish:      { th: "ปลา", icon: "🐟", group: "ปลา", era: 2, habitat: "water" },
  predfish:  { th: "ปลานักล่า", icon: "🐠", group: "ปลา", era: 2, habitat: "water" },
  shark:     { th: "ฉลาม", icon: "🦈", group: "ปลา", era: 2, habitat: "water" },
  whale:     { th: "วาฬ", icon: "🐋", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "water" },
  frog:      { th: "กบและซาลาแมนเดอร์", icon: "🐸", group: "สัตว์ครึ่งบกครึ่งน้ำ", era: 2, habitat: "amph" },
  croc:      { th: "จระเข้", icon: "🐊", group: "สัตว์เลื้อยคลาน", era: 3, habitat: "amph" },
  turtle:    { th: "เต่า", icon: "🐢", group: "สัตว์เลื้อยคลาน", era: 3, habitat: "amph" },
  insect:    { th: "แมลงปีกแข็ง", icon: "🐞", group: "แมลง", era: 3, habitat: "land" },
  flyinsect: { th: "ผีเสื้อและแมลงปอ", icon: "🦋", group: "แมลง", era: 3, habitat: "land" },
  lizard:    { th: "กิ้งก่า", icon: "🦎", group: "สัตว์เลื้อยคลาน", era: 3, habitat: "land" },
  ceratops:  { th: "ไดโนเสาร์มีเขา", icon: "🦏", group: "ไดโนเสาร์", era: 3, habitat: "land" },
  sauropod:  { th: "ไดโนเสาร์คอยาว", icon: "🦕", group: "ไดโนเสาร์", era: 3, habitat: "land" },
  theropod:  { th: "ไดโนเสาร์นักล่า", icon: "🦖", group: "ไดโนเสาร์", era: 3, habitat: "land" },
  bird:      { th: "นก", icon: "🐦", group: "นก", era: 3, habitat: "land" },
  raptor:    { th: "นกล่าเหยื่อ", icon: "🦅", group: "นก", era: 3, habitat: "land" },
  rodent:    { th: "สัตว์ฟันแทะ", icon: "🐭", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  deer:      { th: "กวาง", icon: "🦌", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  bovid:     { th: "วัวป่าและควาย", icon: "🦬", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  elephant:  { th: "ช้างและแมมมอธ", icon: "🐘", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  wolf:      { th: "หมาป่า", icon: "🐺", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  bigcat:    { th: "เสือและสิงโต", icon: "🐅", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  bear:      { th: "หมี", icon: "🐻", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  ape:       { th: "วานร", icon: "🦍", group: "ไพรเมต", era: 4, habitat: "land" },
  human:     { th: "มนุษย์", icon: "🧑", group: "ไพรเมต", era: 4, habitat: "land" },
};
export const ARCH_KEYS = Object.keys(ARCH);

export function archetypeOf(g, sapient, proto) {
  if (sapient) return "human";
  if (proto) return "ape";
  if (g.form < 0.22) return "microbe";
  if (g.form < 0.45) return g.speed < 0.9 && g.size >= 1.1 ? "jelly" : "colony";
  const land = g.habitat >= 0.62, amph = !land && g.habitat >= 0.4;
  if (!land && !amph) {
    if (g.form < 0.55) return g.armor >= 0.5 ? "trilobite" : g.speed < 1 && g.size >= 1.1 ? "jelly" : "worm";
    if (g.armor >= 0.5) return g.speed >= 1.3 ? "ammonite" : g.diet >= 0.38 || g.size >= 1.6 ? "crab" : "trilobite";
    if (g.intellect >= 0.25) return "squid";
    if (g.size >= 3.4 && g.diet < 0.62) return "whale";
    if (g.diet >= 0.62 && g.size >= 2) return "shark";
    return g.diet >= 0.5 ? "predfish" : "fish";
  }
  if (amph) {
    if (g.armor >= 0.5) return "turtle";
    return g.diet >= 0.5 && g.size >= 1.6 ? "croc" : "frog";
  }
  if (g.wing >= 0.5) {
    if (g.size < 1 && g.warm < 0.5) return "flyinsect";
    return g.diet >= 0.62 ? "raptor" : "bird";
  }
  if (g.size < 1 && g.warm < 0.5 && g.armor >= 0.4) return "insect";
  if (g.armor >= 0.55) return "turtle";
  if (g.warm < 0.5) { // reptiles and dinosaurs
    if (g.diet >= 0.62) return g.size >= 1.5 ? "theropod" : "lizard";
    if (g.diet < 0.38) return g.size >= 3 ? "sauropod" : g.size >= 1.5 ? "ceratops" : "lizard";
    return "lizard";
  }
  if (g.diet >= 0.62) return g.size >= 2 ? "bigcat" : "wolf";
  if (g.diet >= 0.38) return g.size >= 2 ? "bear" : "rodent";
  if (g.size >= 3) return "elephant";
  if (g.size >= 1.3) return g.speed >= 1.6 ? "deer" : "bovid";
  return "rodent";
}

// Gene patches used when an empty niche is filled by a large mutation in an existing lineage.
const LAND = { habitat: 0.82, form: 0.9, wing: 0, armor: 0.08 };
export const TEMPLATES = {
  jelly: { form: 0.35, speed: 0.6, size: 1.3, diet: 0.45, armor: 0, habitat: 0.05 },
  worm: { form: 0.5, speed: 1.1, size: 0.9, armor: 0, habitat: 0.1, diet: 0.3 },
  trilobite: { form: 0.62, armor: 0.7, speed: 0.8, diet: 0.15, size: 1.0, habitat: 0.15 },
  crab: { form: 0.7, armor: 0.75, speed: 0.9, diet: 0.5, size: 1.7, habitat: 0.3 },
  ammonite: { form: 0.66, armor: 0.7, speed: 1.5, diet: 0.55, size: 1.4, habitat: 0.05 },
  squid: { intellect: 0.27, form: 0.75, diet: 0.62, speed: 2, size: 1.5, armor: 0, habitat: 0.05 },
  fish: { form: 0.7, armor: 0.08, diet: 0.15, speed: 1.6, size: 1.1, habitat: 0.08 },
  predfish: { form: 0.72, armor: 0.05, diet: 0.56, speed: 2, size: 1.5, habitat: 0.08 },
  shark: { form: 0.78, armor: 0, diet: 0.82, size: 2.6, speed: 2.2, sense: 110, habitat: 0.05 },
  whale: { form: 0.95, armor: 0, diet: 0.2, size: 3.9, speed: 1.4, warm: 0.85, habitat: 0.05, longevity: 1.8 },
  frog: { form: 0.72, habitat: 0.5, size: 0.9, diet: 0.45, armor: 0, warm: 0.1, speed: 1.2 },
  croc: { form: 0.85, habitat: 0.52, diet: 0.78, size: 2.4, armor: 0.3, speed: 1.1, warm: 0.15 },
  turtle: { form: 0.85, habitat: 0.55, armor: 0.82, size: 1.6, speed: 0.6, diet: 0.12, warm: 0.15, longevity: 2 },
  insect: { ...LAND, size: 0.7, armor: 0.55, warm: 0.1, form: 0.75, speed: 1.2, fertility: 0.95, diet: 0.15 },
  flyinsect: { ...LAND, size: 0.65, wing: 0.78, armor: 0.3, warm: 0.1, form: 0.75, speed: 1.8, fertility: 0.95, diet: 0.1 },
  lizard: { ...LAND, size: 1, warm: 0.15, diet: 0.2, speed: 1.4 },
  theropod: { ...LAND, size: 2.6, diet: 0.82, warm: 0.3, speed: 2, sense: 110 },
  sauropod: { ...LAND, size: 4.3, diet: 0.04, warm: 0.3, speed: 0.7, longevity: 1.8 },
  ceratops: { ...LAND, size: 2.2, diet: 0.05, warm: 0.3, armor: 0.35, speed: 1 },
  bird: { ...LAND, size: 1.2, wing: 0.82, warm: 0.85, diet: 0.25, speed: 2 },
  raptor: { ...LAND, size: 1.5, wing: 0.82, warm: 0.85, diet: 0.78, speed: 2.4, sense: 130 },
  rodent: { ...LAND, size: 0.8, warm: 0.82, diet: 0.3, fertility: 0.95, speed: 1.5 },
  deer: { ...LAND, size: 1.8, warm: 0.82, diet: 0.05, speed: 2.1 },
  bovid: { ...LAND, size: 2.4, warm: 0.82, diet: 0.05, speed: 1.2, armor: 0.2 },
  elephant: { ...LAND, size: 4.1, warm: 0.85, diet: 0.05, speed: 0.8, intellect: 0.3, longevity: 2 },
  wolf: { ...LAND, size: 1.5, warm: 0.85, diet: 0.78, speed: 2.1, sense: 110 },
  bigcat: { ...LAND, size: 2.4, warm: 0.85, diet: 0.86, speed: 2.3, sense: 120 },
  bear: { ...LAND, size: 2.8, warm: 0.88, diet: 0.5, speed: 1.2 },
};

// Latin-ish genus roots so names read like real taxa of that group
const ROOTS = {
  microbe: [["Proto", "Archaeo", "Cyano", "Bacillo", "Spiro"], ["cella", "coccus", "bacter", "monas"]],
  colony: [["Volvo", "Myxo", "Choano", "Placo"], ["zoa", "cystis", "morpha"]],
  jelly: [["Aurel", "Medu", "Cyan", "Physa"], ["ia", "sozoa", "ea", "lia"]],
  worm: [["Anneli", "Nereo", "Vermi", "Spiro"], ["da", "branchus", "nema"]],
  trilobite: [["Trilo", "Olen", "Paradox", "Phaco"], ["bites", "ellus", "ides", "ops"]],
  crab: [["Carcino", "Astaco", "Pagur", "Callinect"], ["us", "ides", "es"]],
  ammonite: [["Ammo", "Nautil", "Goniat", "Cerat"], ["nites", "us", "ites"]],
  squid: [["Teutho", "Archi", "Octo", "Sepio"], ["teuthis", "pus", "lida"]],
  fish: [["Ichthyo", "Cyprin", "Clupe", "Salmo", "Labeo"], ["ichthys", "us", "odon", "ella"]],
  predfish: [["Sphyr", "Esoc", "Lepido", "Pirano"], ["aena", "us", "steus", "don"]],
  shark: [["Carcharo", "Megalo", "Squal", "Galeo"], ["don", "us", "cerdo", "rhinus"]],
  whale: [["Balaeno", "Mega", "Basilo", "Cetus"], ["ptera", "cetus", "saurus", "therium"]],
  frog: [["Rana", "Bufo", "Salamand", "Triton"], ["", "rella", "ra", "ix"]],
  croc: [["Crocodyl", "Sarco", "Deino", "Gavial"], ["us", "suchus", "is"]],
  turtle: [["Testud", "Chelon", "Archel", "Geochelon"], ["o", "ia", "on", "e"]],
  insect: [["Coleo", "Scarab", "Carab", "Lucan"], ["ptera", "aeus", "us", "ida"]],
  flyinsect: [["Lepido", "Odonato", "Papil", "Meganeur"], ["ptera", "ra", "io", "a"]],
  lizard: [["Lacerta", "Iguan", "Varan", "Gekko"], ["", "odon", "us", "nis"]],
  ceratops: [["Tricera", "Centro", "Styraco", "Proto"], ["tops", "saurus", "ceratops"]],
  sauropod: [["Brachio", "Diplo", "Apato", "Titano"], ["saurus", "docus", "titan"]],
  theropod: [["Tyranno", "Allo", "Velocir", "Carno"], ["saurus", "raptor", "taurus"]],
  bird: [["Passer", "Colum", "Archaeo", "Avi"], ["ina", "ba", "pteryx", "cula"]],
  raptor: [["Aquila", "Falco", "Haliae", "Accip"], ["", "etus", "iter", "nis"]],
  rodent: [["Mus", "Ratt", "Sciur", "Castor"], ["", "us", "idae", "oides"]],
  deer: [["Cerv", "Capreol", "Rangif", "Megalo"], ["us", "ceros", "er"]],
  bovid: [["Bos", "Bison", "Bubal", "Syncer"], ["", "us", "primigenius"]],
  elephant: [["Elephas", "Mammuth", "Loxodo", "Masto"], ["", "us", "nta", "don"]],
  wolf: [["Canis", "Lyca", "Cuon", "Aenocyon"], ["", "on", "lupus"]],
  bigcat: [["Panthera", "Smilo", "Acinon", "Felis"], ["", "don", "yx"]],
  bear: [["Ursus", "Arcto", "Agrio", "Ailuro"], ["", "dus", "therium", "poda"]],
  ape: [["Australo", "Pithe", "Paran", "Ardi"], ["pithecus", "cus", "thropus"]],
  human: [["Homo", "Sapio", "Noeto"], [""]],
};
export function genusFor(arch) {
  const r = ROOTS[arch] || ROOTS.microbe;
  const pick = (a) => a[(Math.random() * a.length) | 0];
  return pick(r[0]) + pick(r[1]);
}
