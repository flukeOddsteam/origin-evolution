// What evolution is allowed to reach in each era. Raising a cap is what "unlocking an era" means
// for the living world: the genes can now drift further and new body plans become possible.
export const ERA_CAPS = [
  { size: 1.0, form: 0.2,  diet: 0.3, habitat: 0.3,  intellect: 0.05, armor: 0.2, warm: 0.2, wing: 0 }, // 0 primordial ocean
  { size: 1.7, form: 0.42, diet: 1,   habitat: 0.3,  intellect: 0.1,  armor: 0.5, warm: 0.2, wing: 0 }, // 1 cells — predation appears
  { size: 3.2, form: 0.78, diet: 1,   habitat: 0.48, intellect: 0.25, armor: 1,   warm: 0.3, wing: 0 }, // 2 multicellular
  { size: 5,   form: 1,    diet: 1,   habitat: 1,    intellect: 0.5,  armor: 1,   warm: 1,   wing: 1 }, // 3 land
  { size: 6,   form: 1,    diet: 1,   habitat: 1,    intellect: 1,    armor: 1,   warm: 1,   wing: 1 }, // 4 early humans
];
export const capsFor = (era) => ERA_CAPS[Math.min(era, ERA_CAPS.length - 1)];

// Highest settlement level allowed per era (0 camp, 1 village, 2 town, 3 city, 4 metropolis)
export const SETTLEMENT_LEVEL_CAP = [0, 0, 0, 0, 0, 1, 2, 3, 4, 4, 4, 4];
export const SETTLEMENT_LEVELS = [
  { name: "แคมป์", min: 0, cap: 28 },
  { name: "หมู่บ้าน", min: 22, cap: 140 },
  { name: "เมือง", min: 110, cap: 600 },
  { name: "นคร", min: 480, cap: 2400 },
  { name: "มหานคร", min: 1900, cap: 9000 },
];
