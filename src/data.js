// Game content: eras, milestones, upgrades, technologies and player powers.
// Milestones read the live simulation (see game.js `metrics`).

export const ERAS = [
  { id: "origin", name: "มหาสมุทรแห่งจุดกำเนิด", type: "ORIGIN OF LIFE", icon: "🌊",
    description: "โมเลกุลจำลองตัวเองล่องลอยในทะเลตื้นอันอบอุ่น กินสารอาหาร แบ่งตัว และกลายพันธุ์ทีละน้อย",
    unlock: "ยุคเซลล์แรก — เปิดทางให้ผู้ล่า และขนาดตัวใหญ่ขึ้นได้",
    goals: [{ m: "population", need: 300, label: "สิ่งมีชีวิต" }], cost: { dna: 150 } },
  { id: "cells", name: "ยุคเซลล์แรก", type: "MICROBIAL AGE", icon: "🦠",
    description: "เซลล์บางกลุ่มเริ่มกลืนกินเซลล์อื่น ห่วงโซ่อาหารแรกเกิดขึ้น เหยื่อต้องหนี ผู้ล่าต้องเร็วขึ้น",
    unlock: "ชีวิตหลายเซลล์ — ร่างกายซับซ้อนขึ้นและตัวใหญ่ขึ้น",
    goals: [{ m: "species", need: 5, label: "สายพันธุ์ที่มีชีวิต" }, { m: "predators", need: 15, label: "ผู้ล่า" }], cost: { dna: 600 } },
  { id: "multicellular", name: "ชีวิตหลายเซลล์", type: "MULTICELLULAR ERA", icon: "🧫",
    description: "เซลล์ทำงานร่วมกันเป็นร่างเดียว เกิดครีบ หาง และดวงตา สัตว์น้ำรูปร่างหลากหลายครองมหาสมุทร",
    unlock: "การพิชิตผืนดิน — พืชขึ้นบก สัตว์เริ่มคลานขึ้นจากทะเล",
    goals: [{ m: "complex", need: 120, label: "สิ่งมีชีวิตหลายเซลล์" }], cost: { dna: 1600 } },
  { id: "land", name: "การพิชิตผืนดิน", type: "LAND COLONIZATION", icon: "🦎",
    description: "พืชแผ่ขยายจากชายฝั่งเข้าสู่ใจกลางทวีป สัตว์ที่พัฒนาขาและปอดได้ครอบครองโลกใหม่",
    unlock: "รุ่งอรุณแห่งมนุษย์ — สมองใหญ่ขึ้นและเครื่องมือชิ้นแรก",
    goals: [{ m: "landAnimals", need: 80, label: "สัตว์บก" }], cost: { dna: 4000 } },
  { id: "tribes", name: "รุ่งอรุณแห่งมนุษย์", type: "EARLY HUMANS", icon: "🪨",
    description: "สายพันธุ์หนึ่งเริ่มใช้เครื่องมือ สื่อสาร และรวมกลุ่ม เมื่อฉลาดพอจะตั้งแคมป์และล่าสัตว์รอบตัว",
    unlock: "ยุคเกษตรกรรม — หมู่บ้านและไร่นา",
    goals: [{ m: "sapient", need: 1, label: "เผ่าพันธุ์ผู้มีปัญญา" }, { m: "settlements", need: 3, label: "ถิ่นฐาน" }], cost: { dna: 8000 } },
  { id: "agriculture", name: "ยุคเกษตรกรรม", type: "AGRICULTURAL AGE", icon: "🌾",
    description: "ป่ากลายเป็นไร่นา อาหารส่วนเกินทำให้ประชากรเพิ่มขึ้น แต่สัตว์ป่าเริ่มสูญเสียถิ่นที่อยู่",
    unlock: "นครและอารยธรรม — เมือง ถนน และการค้า",
    goals: [{ m: "civPop", need: 250, label: "ประชากรอารยธรรม" }, { m: "techs", need: 2, label: "เทคโนโลยี" }], cost: { knowledge: 250 } },
  { id: "cities", name: "นครและอารยธรรม", type: "AGE OF CIVILIZATION", icon: "🏛️",
    description: "ถนนเชื่อมเมือง การค้าแลกเปลี่ยนอาหารและความรู้ ประชากรขยายไปทั่วทวีป",
    unlock: "ยุคอุตสาหกรรม — เครื่องจักร และมลพิษ",
    goals: [{ m: "civPop", need: 1200, label: "ประชากรอารยธรรม" }, { m: "techs", need: 4, label: "เทคโนโลยี" }], cost: { knowledge: 1500 } },
  { id: "industry", name: "ยุคอุตสาหกรรม", type: "INDUSTRIAL REVOLUTION", icon: "⚙️",
    description: "โรงงานเพิ่มผลผลิตมหาศาล แต่ควันทำให้โลกร้อนขึ้น สิ่งมีชีวิตที่ปรับตัวไม่ทันจะสูญพันธุ์",
    unlock: "ยุคดิจิทัลและ AI",
    goals: [{ m: "civPop", need: 4000, label: "ประชากรอารยธรรม" }, { m: "techs", need: 6, label: "เทคโนโลยี" }], cost: { knowledge: 7000 } },
  { id: "digital", name: "ยุคดิจิทัลและ AI", type: "DIGITAL INTELLIGENCE", icon: "🤖",
    description: "เครือข่ายข้อมูลเชื่อมทุกเมือง ความรู้เพิ่มขึ้นแบบทวีคูณ มหานครเรืองแสงตลอดคืน",
    unlock: "อารยธรรมอวกาศ — ท่าอวกาศและจรวด",
    goals: [{ m: "civPop", need: 9000, label: "ประชากรอารยธรรม" }, { m: "techs", need: 8, label: "เทคโนโลยี" }], cost: { knowledge: 30000 } },
  { id: "space", name: "อารยธรรมอวกาศ", type: "SPACEFARING CIVILIZATION", icon: "🚀",
    description: "นครใหญ่สร้างท่าอวกาศ จรวดออกเดินทางเพื่อตั้งอาณานิคมบนดาวดวงอื่น",
    unlock: "อารยธรรมระหว่างดาว",
    goals: [{ m: "colonies", need: 8, label: "อาณานิคมนอกโลก" }], cost: { knowledge: 120000 } },
  { id: "interstellar", name: "อารยธรรมระหว่างดาว", type: "INTERSTELLAR AGE", icon: "🌌",
    description: "อารยธรรมขยายข้ามระบบดาว ส่งความรู้และพันธุกรรมกลับมายังดาวแม่",
    unlock: "จุดเอกฐานแห่งวิวัฒนาการ",
    goals: [{ m: "colonies", need: 40, label: "อาณานิคมนอกโลก" }, { m: "techs", need: 12, label: "เทคโนโลยี" }], cost: { knowledge: 600000 } },
  { id: "singularity", name: "จุดเอกฐานแห่งวิวัฒนาการ", type: "EVOLUTIONARY SINGULARITY", icon: "✧",
    description: "ชีวิต ความรู้ และพลังงานก้าวข้ามขอบเขตเดิม เริ่มวัฏจักรใหม่เพื่อสร้างจักรวาลที่ดีกว่าเดิม",
    unlock: "วิวัฒนาการสูงสุด", goals: [], cost: null },
];

export const RESOURCES = [
  { id: "dna", name: "DNA", label: "จากการเกิดและสายพันธุ์ใหม่", icon: "🧬", color: "mint" },
  { id: "energy", name: "พลังงาน", label: "จากการกินและการสังเคราะห์แสง", icon: "⚡", color: "gold" },
  { id: "population", name: "ประชากร", label: "สิ่งมีชีวิต + อารยธรรม", icon: "👥", color: "blue" },
  { id: "knowledge", name: "ความรู้", label: "จากถิ่นฐานของผู้มีปัญญา", icon: "🔬", color: "purple" },
];

// Upgrades shape the living world itself rather than adding flat income.
export const UPGRADES = [
  { id: "nutrients", name: "ทะเลอุดมธาตุอาหาร", icon: "🫧", res: "energy", cost: 40, grow: 1.7, max: 10, era: 0,
    desc: "พืชและแพลงก์ตอนงอกใหม่เร็วขึ้น 12% ต่อระดับ", apply: (p, n) => { p.plantGrowth *= 1 + 0.12 * n; } },
  { id: "photosynthesis", name: "สังเคราะห์แสงประสิทธิภาพสูง", icon: "☀️", res: "energy", cost: 90, grow: 1.8, max: 8, era: 0,
    desc: "แต่ละพื้นที่รองรับพืชได้มากขึ้น 10% ต่อระดับ", apply: (p, n) => { p.plantCap *= 1 + 0.1 * n; } },
  { id: "metabolism", name: "เมแทบอลิซึมประหยัดพลังงาน", icon: "🔋", res: "dna", cost: 80, grow: 1.9, max: 8, era: 0,
    desc: "สิ่งมีชีวิตใช้พลังงานน้อยลง 5% ต่อระดับ อยู่รอดได้นานขึ้น", apply: (p, n) => { p.metabolism *= Math.pow(0.95, n); } },
  { id: "capacity", name: "ขยายขีดจำกัดระบบนิเวศ", icon: "🌍", res: "energy", cost: 150, grow: 2, max: 6, era: 1,
    desc: "โลกรองรับสิ่งมีชีวิตได้มากขึ้น 120 ตัวต่อระดับ ก่อนเกิดความแออัด", apply: (p, n) => { p.capacity += 120 * n; } },
  { id: "dnaHarvest", name: "การเก็บเกี่ยว DNA", icon: "🧬", res: "energy", cost: 120, grow: 1.75, max: 12, era: 0,
    desc: "รับ DNA จากการเกิดเพิ่มขึ้น 20% ต่อระดับ", income: { dna: 0.2 } },
  { id: "bioEnergy", name: "วงจรพลังงานชีวภาพ", icon: "⚡", res: "dna", cost: 60, grow: 1.7, max: 12, era: 0,
    desc: "รับพลังงานจากระบบนิเวศเพิ่มขึ้น 25% ต่อระดับ", income: { energy: 0.25 } },
  { id: "parentalCare", name: "การดูแลลูกอ่อน", icon: "🥚", res: "dna", cost: 900, grow: 1.9, max: 6, era: 3,
    desc: "ลูกที่เกิดใหม่ได้รับพลังงานตั้งต้นมากขึ้น 8% ต่อระดับ", apply: (p, n) => { p.offspring *= 1 + 0.08 * n; } },
  { id: "irrigation", name: "ระบบชลประทาน", icon: "💧", res: "knowledge", cost: 120, grow: 1.9, max: 8, era: 5,
    desc: "ไร่นาให้ผลผลิตมากขึ้น 15% ต่อระดับ เมืองโตได้มากขึ้น", apply: (p, n) => { p.farmYield *= 1 + 0.15 * n; } },
];

export const TECHS = [
  { id: "fire", name: "การใช้ไฟ", icon: "🔥", era: 4, cost: 25, desc: "ปรุงอาหารและป้องกันตัว", bonus: "ถิ่นฐานเติบโต +30%", apply: (p) => { p.civGrowth *= 1.3; } },
  { id: "agriculture", name: "การเพาะปลูก", icon: "🌾", era: 5, cost: 90, desc: "เปลี่ยนทุ่งหญ้าเป็นไร่นา", bonus: "ผลผลิตไร่นา +30%", apply: (p) => { p.farmYield *= 1.3; } },
  { id: "writing", name: "ภาษาเขียน", icon: "📜", era: 5, cost: 160, desc: "บันทึกความรู้ส่งต่อข้ามรุ่น", bonus: "ความรู้ +40%", apply: (p) => { p.knowledgeMult *= 1.4; } },
  { id: "wheel", name: "ล้อและถนน", icon: "🛞", era: 6, cost: 500, desc: "ขนส่งอาหารและผู้คนระหว่างเมือง", bonus: "การอพยพ +60% · เติบโต +15%", apply: (p) => { p.emigration *= 1.6; p.civGrowth *= 1.15; } },
  { id: "science", name: "วิธีการทางวิทยาศาสตร์", icon: "🔭", era: 6, cost: 1200, desc: "ทดลอง พิสูจน์ และสะสมความรู้อย่างเป็นระบบ", bonus: "ความรู้ +60%", apply: (p) => { p.knowledgeMult *= 1.6; } },
  { id: "steam", name: "เครื่องจักรไอน้ำ", icon: "⚙️", era: 7, cost: 3500, desc: "เกษตรเชิงอุตสาหกรรม แลกกับมลพิษ", bonus: "ผลผลิตไร่นา +50% · มลพิษ +30%", apply: (p) => { p.farmYield *= 1.5; p.pollutionMult *= 1.3; } },
  { id: "green", name: "พลังงานสะอาด", icon: "♻️", era: 7, cost: 6000, desc: "ลดการปล่อยคาร์บอนจากเมือง", bonus: "มลพิษ −60%", apply: (p) => { p.pollutionMult *= 0.4; } },
  { id: "computing", name: "คอมพิวเตอร์และ AI", icon: "🤖", era: 8, cost: 15000, desc: "ปัญญาประดิษฐ์ช่วยวิจัยทุกสาขา", bonus: "ความรู้ +100%", apply: (p) => { p.knowledgeMult *= 2; } },
  { id: "genetics", name: "พันธุวิศวกรรม", icon: "🧪", era: 8, cost: 22000, desc: "อ่านและเขียนจีโนมได้เอง", bonus: "DNA +100% · กลายพันธุ์แรงขึ้น", income: { dna: 1 }, apply: (p) => { p.mutationStrength *= 1.2; } },
  { id: "rocketry", name: "จรวดขนส่ง", icon: "🚀", era: 9, cost: 60000, desc: "ยานขนส่งหนักสู่วงโคจร", bonus: "ความรู้ +50% · อพยพ +50%", apply: (p) => { p.knowledgeMult *= 1.5; p.emigration *= 1.5; } },
  { id: "terraforming", name: "การปรับสภาพดาว", icon: "🪐", era: 9, cost: 150000, desc: "ควบคุมภูมิอากาศของดาวทั้งดวง", bonus: "มลพิษ −80%", apply: (p) => { p.pollutionMult *= 0.2; } },
  { id: "stellar", name: "ฟิสิกส์ระหว่างดาว", icon: "🌌", era: 10, cost: 450000, desc: "เดินทางข้ามระบบดาวได้", bonus: "ผลผลิตทั้งหมด +50%", income: { dna: 0.5, energy: 0.5, knowledge: 0.5 } },
];

// Tools the player uses directly on the map. Cost scales with era.
export const POWERS = [
  { id: "inspect", name: "ตรวจสอบ", icon: "🔍", hint: "คลิกสิ่งมีชีวิตเพื่อดูยีนและติดตาม" },
  { id: "bloom", name: "ปลูกอาหาร", icon: "🌿", res: "energy", cost: 30, hint: "คลิกบนแผนที่ให้พืชและแพลงก์ตอนเบ่งบาน" },
  { id: "seed", name: "ปล่อยสายพันธุ์", icon: "🧬", res: "dna", cost: 40, hint: "ปล่อยสายพันธุ์ที่เลือกไว้ 8 ตัว ณ จุดที่คลิก" },
  { id: "meteor", name: "อุกกาบาต", icon: "☄️", res: "energy", cost: 90, hint: "ทำลายทุกสิ่งในรัศมี — การคัดเลือกโดยธรรมชาติแบบฉับพลัน" },
];
export const powerCost = (p, era) => Math.ceil(p.cost * (1 + era * 0.7));

export const GUIDE_GENES = [
  { gene: "size", up: "ตัวใหญ่ขึ้น", down: "ตัวเล็กลง" },
  { gene: "speed", up: "เร็วขึ้น", down: "ช้าลง ประหยัดพลังงาน" },
  { gene: "sense", up: "รับรู้ไกลขึ้น", down: "รับรู้ใกล้ลง" },
  { gene: "diet", up: "กินเนื้อมากขึ้น", down: "กินพืชมากขึ้น" },
  { gene: "habitat", up: "ปรับตัวขึ้นบก", down: "กลับสู่ทะเล" },
  { gene: "thermal", up: "ทนร้อน", down: "ทนหนาว" },
  { gene: "intellect", up: "ฉลาดขึ้น", down: "สมองเล็กลง" },
  { gene: "form", up: "ร่างกายซับซ้อนขึ้น", down: "ร่างกายเรียบง่ายลง" },
  { gene: "fertility", up: "ออกลูกบ่อยขึ้น", down: "ออกลูกน้อยแต่แข็งแรง" },
  { gene: "armor", up: "เกราะหนาขึ้น", down: "ตัวเบาไม่มีเกราะ" },
  { gene: "warm", up: "เลือดอุ่น ทนหนาว", down: "เลือดเย็น ประหยัดพลังงาน" },
  { gene: "wing", up: "พัฒนาปีก", down: "เลิกบิน" },
];
