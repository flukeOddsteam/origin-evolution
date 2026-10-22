// Body plans. A species' average genes decide which recognisable group it belongs to, which in turn
// decides how it is drawn and named. Nothing is scripted: a lineage of fish that grows large and
// predatory simply *becomes* a shark-like body plan.

export const ARCH = {
  // ---- microscopic & early sea life
  microbe:   { th: "จุลชีพเซลล์เดียว", icon: "🦠", group: "จุลชีพ", era: 0, habitat: "water" },
  colony:    { th: "โคโลนีหลายเซลล์", icon: "🧫", group: "จุลชีพ", era: 1, habitat: "water" },
  jelly:     { th: "แมงกะพรุน", icon: "🪼", group: "สัตว์ไม่มีกระดูกสันหลัง", era: 1, habitat: "water" },
  worm:      { th: "หนอนทะเล", icon: "🪱", group: "สัตว์ไม่มีกระดูกสันหลัง", era: 1, habitat: "water" },
  starfish:  { th: "ดาวทะเล", icon: "⭐", group: "สัตว์ไม่มีกระดูกสันหลัง", era: 2, habitat: "water" },
  trilobite: { th: "ไทรโลไบต์", icon: "🪲", group: "สัตว์ขาปล้อง", era: 2, habitat: "water" },
  crab:      { th: "ปู", icon: "🦀", group: "สัตว์ขาปล้อง", era: 2, habitat: "water" },
  lobster:   { th: "กุ้งมังกร", icon: "🦞", group: "สัตว์ขาปล้อง", era: 2, habitat: "water" },
  ammonite:  { th: "แอมโมไนต์", icon: "🐚", group: "หอยและหมึก", era: 2, habitat: "water" },
  squid:     { th: "หมึกกล้วย", icon: "🦑", group: "หอยและหมึก", era: 2, habitat: "water" },
  octopus:   { th: "หมึกยักษ์", icon: "🐙", group: "หอยและหมึก", era: 2, habitat: "water" },
  // ---- fish & sea mammals
  fish:      { th: "ปลา", icon: "🐟", group: "ปลา", era: 2, habitat: "water" },
  reeffish:  { th: "ปลาแนวปะการัง", icon: "🪸", group: "ปลา", era: 2, habitat: "water", temp: "hot" },
  predfish:  { th: "ปลานักล่า", icon: "🐠", group: "ปลา", era: 2, habitat: "water" },
  eel:       { th: "ปลาไหลทะเล", icon: "〰️", group: "ปลา", era: 2, habitat: "water" },
  ray:       { th: "ปลากระเบน", icon: "🪁", group: "ปลา", era: 2, habitat: "water" },
  shark:     { th: "ฉลาม", icon: "🦈", group: "ปลา", era: 2, habitat: "water" },
  dolphin:   { th: "โลมา", icon: "🐬", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "water" },
  whale:     { th: "วาฬ", icon: "🐋", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "water" },
  // ---- shorelines
  frog:      { th: "กบ", icon: "🐸", group: "สัตว์ครึ่งบกครึ่งน้ำ", era: 2, habitat: "amph" },
  salamander:{ th: "ซาลาแมนเดอร์", icon: "🦎", group: "สัตว์ครึ่งบกครึ่งน้ำ", era: 2, habitat: "amph" },
  croc:      { th: "จระเข้", icon: "🐊", group: "สัตว์เลื้อยคลาน", era: 3, habitat: "amph" },
  turtle:    { th: "เต่า", icon: "🐢", group: "สัตว์เลื้อยคลาน", era: 3, habitat: "amph" },
  seal:      { th: "แมวน้ำ", icon: "🦭", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "amph" },
  capybara:  { th: "คาปิบารา", icon: "🐹", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "amph" },
  hippo:     { th: "ฮิปโปโปเตมัส", icon: "🦛", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "amph" },
  penguin:   { th: "เพนกวิน", icon: "🐧", group: "นก", era: 3, habitat: "amph", temp: "cold" },
  // ---- small land life
  insect:    { th: "แมลงปีกแข็ง", icon: "🐞", group: "แมลง", era: 3, habitat: "land" },
  flyinsect: { th: "ผีเสื้อและแมลงปอ", icon: "🦋", group: "แมลง", era: 3, habitat: "land" },
  spider:    { th: "แมงมุม", icon: "🕷️", group: "สัตว์ขาปล้อง", era: 3, habitat: "land" },
  scorpion:  { th: "แมงป่อง", icon: "🦂", group: "สัตว์ขาปล้อง", era: 3, habitat: "land", temp: "hot" },
  snail:     { th: "หอยทาก", icon: "🐌", group: "หอยและหมึก", era: 3, habitat: "land" },
  // ---- reptiles & dinosaurs
  lizard:    { th: "กิ้งก่า", icon: "🦎", group: "สัตว์เลื้อยคลาน", era: 3, habitat: "land" },
  snake:     { th: "งู", icon: "🐍", group: "สัตว์เลื้อยคลาน", era: 3, habitat: "land" },
  ceratops:  { th: "ไดโนเสาร์มีเขา", icon: "🐲", group: "ไดโนเสาร์", era: 3, habitat: "land" },
  stego:     { th: "ไดโนเสาร์หลังแผ่น", icon: "🦴", group: "ไดโนเสาร์", era: 3, habitat: "land" },
  sauropod:  { th: "ไดโนเสาร์คอยาว", icon: "🦕", group: "ไดโนเสาร์", era: 3, habitat: "land" },
  theropod:  { th: "ไดโนเสาร์นักล่า", icon: "🦖", group: "ไดโนเสาร์", era: 3, habitat: "land" },
  pterosaur: { th: "เทอโรซอร์", icon: "🐉", group: "ไดโนเสาร์", era: 3, habitat: "land" },
  // ---- birds
  bird:      { th: "นกเกาะคอน", icon: "🐦", group: "นก", era: 3, habitat: "land" },
  parrot:    { th: "นกแก้ว", icon: "🦜", group: "นก", era: 3, habitat: "land" },
  raptor:    { th: "นกล่าเหยื่อ", icon: "🦅", group: "นก", era: 3, habitat: "land" },
  wader:     { th: "นกกระสาและฟลามิงโก", icon: "🦩", group: "นก", era: 3, habitat: "land" },
  ratite:    { th: "นกกระจอกเทศ", icon: "🪶", group: "นก", era: 3, habitat: "land" },
  // ---- mammals
  bat:       { th: "ค้างคาว", icon: "🦇", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  rodent:    { th: "สัตว์ฟันแทะ", icon: "🐭", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  rabbit:    { th: "กระต่าย", icon: "🐇", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  boar:      { th: "หมูป่า", icon: "🐗", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  deer:      { th: "กวาง", icon: "🦌", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  horse:     { th: "ม้าและม้าลาย", icon: "🦓", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  bovid:     { th: "วัวป่าและควาย", icon: "🦬", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  camel:     { th: "อูฐ", icon: "🐫", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land", temp: "hot" },
  giraffe:   { th: "ยีราฟ", icon: "🦒", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  rhino:     { th: "แรด", icon: "🦏", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  elephant:  { th: "ช้าง", icon: "🐘", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  mammoth:   { th: "แมมมอธ", icon: "🦣", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land", temp: "cold" },
  fox:       { th: "จิ้งจอก", icon: "🦊", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  wolf:      { th: "หมาป่า", icon: "🐺", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  bigcat:    { th: "เสือและสิงโต", icon: "🐅", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  bear:      { th: "หมี", icon: "🐻", group: "สัตว์เลี้ยงลูกด้วยนม", era: 3, habitat: "land" },
  monkey:    { th: "ลิง", icon: "🐒", group: "ไพรเมต", era: 3, habitat: "land" },
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
    if (g.form < 0.55) {
      if (g.armor >= 0.5) return "trilobite";
      if (g.armor >= 0.3 && g.speed < 0.9) return "starfish";
      return g.speed < 1 && g.size >= 1.1 ? "jelly" : "worm";
    }
    if (g.armor >= 0.5) {
      if (g.speed >= 1.3) return "ammonite";
      if (g.diet >= 0.38 || g.size >= 1.6) return g.size < 1.6 && g.speed >= 1 ? "lobster" : "crab";
      return "trilobite";
    }
    if (g.intellect >= 0.25 && g.diet >= 0.45) return g.speed < 1.4 ? "octopus" : "squid"; // cephalopods: clever hunters
    if (g.warm >= 0.5) return g.size >= 3.4 || g.diet < 0.38 ? "whale" : "dolphin";
    if (g.size >= 3.4 && g.diet < 0.62) return "whale";
    if (g.diet >= 0.62 && g.size >= 2) return "shark";
    if (g.diet < 0.38 && g.size >= 2) return "ray";
    if (g.diet >= 0.5) return g.speed < 1.3 ? "eel" : "predfish";
    return g.thermal >= 0.72 ? "reeffish" : "fish";
  }
  if (amph) {
    if (g.armor >= 0.5) return "turtle";
    if (g.warm >= 0.5) return g.wing >= 0.3 ? "penguin" : g.diet >= 0.5 ? "seal" : g.size >= 2.6 ? "hippo" : "capybara";
    if (g.diet >= 0.5 && g.size >= 1.6) return "croc";
    return g.speed >= 1.1 ? "frog" : "salamander";
  }
  if (g.wing >= 0.5) {
    if (g.warm < 0.5) return g.size < 1 ? "flyinsect" : "pterosaur";
    if (g.diet >= 0.62) return "raptor";
    if (g.size >= 1.6 && g.diet < 0.38) return "wader";
    if (g.intellect >= 0.2) return "parrot";
    if (g.size < 0.85 && g.diet >= 0.38) return "bat";
    return "bird";
  }
  if (g.wing >= 0.25 && g.warm >= 0.5 && g.size >= 1.8) return "ratite";
  if (g.size < 1 && g.warm < 0.5 && g.armor >= 0.4) {
    if (g.diet >= 0.5) return g.thermal >= 0.72 ? "scorpion" : "spider";
    return g.speed < 0.8 ? "snail" : "insect";
  }
  if (g.armor >= 0.55) return "turtle";
  if (g.warm < 0.5) { // reptiles and dinosaurs
    if (g.diet >= 0.62) return g.size >= 1.5 ? "theropod" : g.speed < 1.3 ? "snake" : "lizard";
    if (g.diet < 0.38) {
      if (g.size >= 3) return "sauropod";
      if (g.size >= 1.5) return g.armor >= 0.42 ? "stego" : "ceratops";
    }
    return "lizard";
  }
  if (g.diet >= 0.62) return g.size >= 2 ? "bigcat" : g.size < 1.2 ? "fox" : "wolf";
  if (g.diet >= 0.38) {
    if (g.intellect >= 0.22 && g.size < 1.8) return "monkey";
    return g.size >= 2 ? "bear" : g.size >= 1.2 ? "boar" : "rodent";
  }
  if (g.size >= 3) return g.thermal < 0.3 ? "mammoth" : g.speed >= 1.3 ? "giraffe" : "elephant";
  if (g.armor >= 0.3 && g.size >= 2.2) return "rhino";
  if (g.size >= 1.3) {
    if (g.speed >= 1.9) return g.size >= 2 ? "horse" : "deer";
    return g.thermal >= 0.72 ? "camel" : "bovid";
  }
  return g.speed >= 1.7 ? "rabbit" : "rodent";
}

// Preferred biomes (ids from world.js B): grazing there is richer, elsewhere poorer. This niche
// partitioning lets many body plans coexist instead of one generalist taking every habitat.
// DEEP0 OCEAN1 REEF2 KELP3 SEA_ICE4 BEACH5 DESERT6 SAVANNA7 JUNGLE8 GRASS9 FOREST10 TAIGA11 TUNDRA12 SNOW13 MOUNTAIN14
const HOME = {
  microbe: [0, 1, 2, 3], colony: [1, 2, 3], jelly: [0, 1], worm: [0, 1, 3], starfish: [2, 3], trilobite: [1, 3], crab: [5, 2], lobster: [3, 2],
  ammonite: [0, 1], squid: [0, 1], octopus: [2, 3], fish: [1, 3], reeffish: [2], predfish: [1, 2], eel: [2, 3], ray: [1, 2], shark: [0, 1],
  dolphin: [1, 2], whale: [0, 1, 4], frog: [8, 10], salamander: [10, 11], croc: [8, 7, 5], turtle: [5, 2, 8], seal: [4, 5], hippo: [7, 8, 5], capybara: [8, 5, 7],
  penguin: [4, 5, 13], insect: [10, 9, 8], flyinsect: [9, 8], spider: [10, 8], scorpion: [6], snail: [10, 8], lizard: [6, 7], snake: [8, 7, 9],
  ceratops: [9, 7], stego: [10, 9], sauropod: [8, 10], theropod: [7, 10], pterosaur: [5, 14], bird: [10, 9], parrot: [8], raptor: [14, 9, 7],
  wader: [5, 7], ratite: [7, 6], bat: [8, 10], rodent: [9, 10], rabbit: [9, 12], boar: [10, 8], deer: [10, 11], horse: [9, 7], bovid: [9, 7],
  camel: [6], giraffe: [7], rhino: [7, 9], elephant: [7, 8], mammoth: [12, 11, 13], fox: [11, 12, 10], wolf: [11, 10, 12], bigcat: [7, 8],
  bear: [11, 10], monkey: [8], ape: [8, 10],
};
const AFF_CACHE = {};
/** Per-biome foraging multiplier for a body plan (1 everywhere for generalists like humans). */
export const AFF_TUNE = { on: 0.65, home: 1.6 };
export function affinityOf(arch) {
  if (AFF_CACHE[arch]) return AFF_CACHE[arch];
  const home = HOME[arch], a = new Float32Array(15).fill(home ? AFF_TUNE.on : 1);
  if (home) for (const b of home) a[b] = AFF_TUNE.home;
  return (AFF_CACHE[arch] = a);
}

// Gene patches used when an empty niche is filled by a large mutation in an existing lineage.
const SEA = { habitat: 0.06, intellect: 0.05, warm: 0.1, wing: 0 };
const SHORE = { intellect: 0.05, wing: 0 };
const LAND = { habitat: 0.82, form: 0.9, wing: 0, armor: 0.08, intellect: 0.05 };
const MAMMAL = { ...LAND, warm: 0.85 };
export const TEMPLATES = {
  jelly: { ...SEA, form: 0.35, speed: 0.6, size: 1.3, diet: 0.45, armor: 0, habitat: 0.05 },
  worm: { ...SEA, form: 0.5, speed: 1.1, size: 0.9, armor: 0, habitat: 0.1, diet: 0.3 },
  starfish: { ...SEA, form: 0.5, armor: 0.38, speed: 0.5, size: 1.0, diet: 0.3, habitat: 0.1 },
  trilobite: { ...SEA, form: 0.62, armor: 0.7, speed: 0.8, diet: 0.15, size: 1.0, habitat: 0.15 },
  crab: { ...SEA, form: 0.7, armor: 0.75, speed: 0.9, diet: 0.5, size: 1.7, habitat: 0.3 },
  lobster: { ...SEA, form: 0.72, armor: 0.75, speed: 1.1, diet: 0.5, size: 1.3, habitat: 0.2 },
  ammonite: { ...SEA, form: 0.66, armor: 0.7, speed: 1.5, diet: 0.55, size: 1.4, habitat: 0.05 },
  squid: { ...SEA, intellect: 0.27, form: 0.75, diet: 0.62, speed: 2, size: 1.5, armor: 0, habitat: 0.05 },
  octopus: { ...SEA, intellect: 0.27, form: 0.78, diet: 0.66, speed: 1.0, size: 1.3, armor: 0, habitat: 0.1 },
  fish: { ...SEA, form: 0.7, armor: 0.08, diet: 0.15, speed: 1.6, size: 1.1, habitat: 0.08 },
  reeffish: { ...SEA, form: 0.7, armor: 0.05, diet: 0.2, speed: 1.5, size: 0.9, thermal: 0.82, habitat: 0.08 },
  predfish: { ...SEA, form: 0.72, armor: 0.05, diet: 0.56, speed: 2, size: 1.5, habitat: 0.08 },
  eel: { ...SEA, form: 0.72, armor: 0.05, diet: 0.66, speed: 1.0, size: 1.4, habitat: 0.08 },
  ray: { ...SEA, form: 0.75, armor: 0.05, diet: 0.2, size: 2.3, speed: 1.2, habitat: 0.08 },
  shark: { ...SEA, form: 0.78, armor: 0, diet: 0.82, size: 2.6, speed: 2.2, sense: 110, habitat: 0.05 },
  dolphin: { ...SEA, form: 0.92, armor: 0, warm: 0.85, intellect: 0.2, diet: 0.7, size: 2.2, speed: 2.4, sense: 120, habitat: 0.05 },
  whale: { ...SEA, form: 0.95, armor: 0, diet: 0.2, size: 3.9, speed: 1.4, warm: 0.85, habitat: 0.05, longevity: 1.8 },
  frog: { ...SHORE, form: 0.72, habitat: 0.5, size: 0.9, diet: 0.45, armor: 0, warm: 0.1, speed: 1.2 },
  salamander: { ...SHORE, form: 0.72, habitat: 0.5, size: 0.8, diet: 0.4, armor: 0, warm: 0.1, speed: 0.8 },
  croc: { ...SHORE, form: 0.85, habitat: 0.52, diet: 0.78, size: 2.4, armor: 0.3, speed: 1.1, warm: 0.15 },
  turtle: { ...SHORE, form: 0.85, habitat: 0.55, armor: 0.82, size: 1.6, speed: 0.6, diet: 0.12, warm: 0.15, longevity: 2 },
  seal: { ...SHORE, form: 0.9, habitat: 0.48, warm: 0.85, armor: 0, size: 1.9, diet: 0.72, speed: 1.6 },
  capybara: { ...SHORE, form: 0.9, habitat: 0.5, warm: 0.85, armor: 0, size: 1.4, diet: 0.05, speed: 1.1, fertility: 0.8 },
  hippo: { ...SHORE, form: 0.9, habitat: 0.52, warm: 0.85, armor: 0.1, size: 3.6, diet: 0.05, speed: 0.8 },
  penguin: { ...SHORE, form: 0.88, habitat: 0.5, warm: 0.85, wing: 0.35, armor: 0, size: 1.2, diet: 0.66, speed: 1.5, thermal: 0.15 },
  insect: { ...LAND, size: 0.7, armor: 0.55, warm: 0.1, form: 0.75, speed: 1.2, fertility: 0.95, diet: 0.15 },
  flyinsect: { ...LAND, size: 0.65, wing: 0.78, armor: 0.3, warm: 0.1, form: 0.75, speed: 1.8, fertility: 0.95, diet: 0.1 },
  spider: { ...LAND, size: 0.7, armor: 0.45, warm: 0.1, form: 0.78, speed: 1.3, fertility: 0.8, diet: 0.75 },
  scorpion: { ...LAND, size: 0.8, armor: 0.6, warm: 0.1, form: 0.8, speed: 1.1, fertility: 0.7, diet: 0.75, thermal: 0.85 },
  snail: { ...LAND, size: 0.75, armor: 0.6, warm: 0.1, form: 0.7, speed: 0.5, fertility: 0.9, diet: 0.1 },
  lizard: { ...LAND, size: 1, warm: 0.15, diet: 0.2, speed: 1.4 },
  snake: { ...LAND, size: 1.1, warm: 0.15, diet: 0.75, speed: 1.0, sense: 90 },
  theropod: { ...LAND, size: 2.6, diet: 0.82, warm: 0.3, speed: 2, sense: 110 },
  sauropod: { ...LAND, size: 4.3, diet: 0.04, warm: 0.3, speed: 0.7, longevity: 1.8 },
  ceratops: { ...LAND, size: 2.2, diet: 0.05, warm: 0.3, armor: 0.35, speed: 1 },
  stego: { ...LAND, size: 2.6, diet: 0.05, warm: 0.3, armor: 0.5, speed: 0.8 },
  pterosaur: { ...LAND, size: 1.8, wing: 0.8, warm: 0.3, diet: 0.7, speed: 2.2, sense: 120 },
  bird: { ...LAND, size: 1.2, wing: 0.82, warm: 0.85, diet: 0.25, speed: 2 },
  parrot: { ...LAND, size: 1.0, wing: 0.8, warm: 0.85, diet: 0.3, speed: 1.8, intellect: 0.23 },
  raptor: { ...LAND, size: 1.5, wing: 0.82, warm: 0.85, diet: 0.78, speed: 2.4, sense: 130 },
  wader: { ...LAND, size: 1.9, wing: 0.7, warm: 0.85, diet: 0.3, speed: 1.4 },
  ratite: { ...LAND, size: 2.4, wing: 0.35, warm: 0.85, diet: 0.2, speed: 2.4 },
  bat: { ...LAND, size: 0.75, wing: 0.75, warm: 0.85, diet: 0.5, speed: 2 },
  rodent: { ...MAMMAL, size: 0.8, diet: 0.3, fertility: 0.95, speed: 1.5 },
  rabbit: { ...MAMMAL, size: 0.8, diet: 0.05, fertility: 0.95, speed: 2.0 },
  boar: { ...MAMMAL, size: 1.6, diet: 0.45, speed: 1.4, armor: 0.15 },
  deer: { ...MAMMAL, size: 1.8, diet: 0.05, speed: 2.1 },
  horse: { ...MAMMAL, size: 2.3, diet: 0.05, speed: 2.4 },
  bovid: { ...MAMMAL, size: 2.4, diet: 0.05, speed: 1.2, armor: 0.2 },
  camel: { ...MAMMAL, size: 2.4, diet: 0.05, speed: 1.3, thermal: 0.85 },
  giraffe: { ...MAMMAL, size: 3.4, diet: 0.03, speed: 1.6 },
  rhino: { ...MAMMAL, size: 2.8, diet: 0.04, armor: 0.4, speed: 1.1 },
  elephant: { ...MAMMAL, size: 4.1, diet: 0.05, speed: 0.8, intellect: 0.3, longevity: 2 },
  mammoth: { ...MAMMAL, size: 4.2, diet: 0.05, speed: 0.8, warm: 0.95, thermal: 0.12, longevity: 2 },
  fox: { ...MAMMAL, size: 0.95, diet: 0.7, speed: 2.0, sense: 100 },
  wolf: { ...MAMMAL, size: 1.5, diet: 0.78, speed: 2.1, sense: 110 },
  bigcat: { ...MAMMAL, size: 2.4, diet: 0.86, speed: 2.3, sense: 120 },
  bear: { ...MAMMAL, size: 2.8, warm: 0.88, diet: 0.5, speed: 1.2 },
  monkey: { ...MAMMAL, size: 1.2, diet: 0.45, speed: 1.6, intellect: 0.25 },
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
  starfish: [["Aster", "Echin", "Ophi", "Crinoi"], ["ias", "aster", "ura", "dea"]],
  lobster: [["Homar", "Palinur", "Nephro", "Panul"], ["us", "ops", "irus"]],
  octopus: [["Octo", "Enteroct", "Amphiocto", "Cirro"], ["pus", "opus", "teuthis"]],
  reeffish: [["Pomacanth", "Chaeto", "Amphiprio", "Zebrasom", "Labro"], ["us", "don", "n", "a", "ides"]],
  eel: [["Muraen", "Anguill", "Gymnoth", "Conger"], ["a", "ella", "orax", ""]],
  ray: [["Manta", "Mobul", "Dasyat", "Raj"], ["", "a", "is", "ella"]],
  dolphin: [["Delphin", "Tursi", "Orcin", "Steno"], ["us", "ops", "us", "ella"]],
  salamander: [["Ambyst", "Triturus", "Andri", "Plethod"], ["oma", "", "as", "on"]],
  seal: [["Phoca", "Halichoer", "Mirounga", "Odoben"], ["", "us", "", "us"]],
  capybara: [["Hydrochoer", "Kerodon", "Neochoer"], ["us", "", "us"]],
  hippo: [["Hippopot", "Choerops", "Hexaproto"], ["amus", "is", "don"]],
  penguin: [["Aptenod", "Spheni", "Pygosc", "Eudypt"], ["ytes", "scus", "elis", "es"]],
  spider: [["Arane", "Lycos", "Theraph", "Salti"], ["us", "a", "osa", "cus"]],
  scorpion: [["Scorpio", "Androct", "Pandin", "Buth"], ["", "onus", "us", "us"]],
  snail: [["Helix", "Achatin", "Cepae", "Limax"], ["", "a", "a", ""]],
  snake: [["Python", "Boa", "Najo", "Vipera", "Crotal"], ["", "", "", "", "us"]],
  stego: [["Stego", "Kentro", "Ankylo", "Tuojiang"], ["saurus", "saurus", "saurus", "osaurus"]],
  pterosaur: [["Pterano", "Quetzalco", "Pterodact", "Rhampho"], ["don", "atlus", "ylus", "rhynchus"]],
  parrot: [["Ara", "Psittac", "Cacat", "Amazo"], ["", "us", "ua", "na"]],
  wader: [["Ardea", "Phoenicopt", "Grus", "Cicon"], ["", "erus", "", "ia"]],
  ratite: [["Struthio", "Rhea", "Dromai", "Casuar"], ["", "", "us", "ius"]],
  bat: [["Pteropus", "Myotis", "Desmod", "Rhinolo"], ["", "", "us", "phus"]],
  rabbit: [["Lepus", "Oryctola", "Sylvila", "Ochoto"], ["", "gus", "gus", "na"]],
  boar: [["Sus", "Phacochoer", "Babyrou", "Hylochoer"], ["", "us", "sa", "us"]],
  horse: [["Equus", "Hippari", "Mesohipp", "Merychipp"], ["", "on", "us", "us"]],
  camel: [["Camelus", "Lama", "Vicugn", "Titanotyl"], ["", "", "a", "opus"]],
  giraffe: [["Giraffa", "Okapi", "Sivather", "Samother"], ["", "a", "ium", "ium"]],
  rhino: [["Rhinoc", "Coelodon", "Elasmother", "Ceratother"], ["eros", "ta", "ium", "ium"]],
  mammoth: [["Mammuth", "Mammut", "Palaeolox"], ["us", "", "odon"]],
  fox: [["Vulpes", "Urocyon", "Otocyon", "Alopex"], ["", "", "", ""]],
  monkey: [["Macac", "Cebus", "Papio", "Colob"], ["a", "", "", "us"]],
};
export function genusFor(arch) {
  const r = ROOTS[arch] || ROOTS.microbe;
  const pick = (a) => a[(Math.random() * a.length) | 0];
  return pick(r[0]) + pick(r[1]);
}
