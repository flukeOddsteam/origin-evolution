// Planet surface: terrain from seeded noise, rivers, moisture, biomes, temperature, plant biomass and farmland.

export const WORLD_W = 1920, WORLD_H = 1080, CELL = 24;
export const GW = WORLD_W / CELL, GH = WORLD_H / CELL; // 80 x 45
export const T = { DEEP: 0, SHALLOW: 1, BEACH: 2, LAND: 3, HIGH: 4, MOUNT: 5 };

// Biomes come from temperature × moisture and change whenever the climate does.
export const B = { DEEP: 0, OCEAN: 1, REEF: 2, KELP: 3, SEA_ICE: 4, BEACH: 5, DESERT: 6, SAVANNA: 7, JUNGLE: 8, GRASS: 9, FOREST: 10, TAIGA: 11, TUNDRA: 12, SNOW: 13, MOUNTAIN: 14 };
export const BIOMES = [
  { name: "มหาสมุทรลึก", plant: 0.4, icon: "🌊" }, { name: "ทะเลเปิด", plant: 1, icon: "🌊" }, { name: "แนวปะการัง", plant: 1.35, icon: "🪸" },
  { name: "ป่าสาหร่ายเคลป์", plant: 1.25, icon: "🌿" }, { name: "ทะเลน้ำแข็ง", plant: 0.05, icon: "🧊" }, { name: "ชายหาด", plant: 0.4, icon: "🏖️" },
  { name: "ทะเลทราย", plant: 0.18, icon: "🏜️" }, { name: "ทุ่งสะวันนา", plant: 0.75, icon: "🌾" }, { name: "ป่าดิบชื้น", plant: 1.45, icon: "🌴" },
  { name: "ทุ่งหญ้า", plant: 0.95, icon: "🌱" }, { name: "ป่าเขตอบอุ่น", plant: 1.15, icon: "🌳" }, { name: "ป่าสน", plant: 0.8, icon: "🌲" },
  { name: "ทุนดรา", plant: 0.32, icon: "🪨" }, { name: "ธารน้ำแข็ง", plant: 0.03, icon: "❄️" }, { name: "ภูเขาสูง", plant: 0.15, icon: "⛰️" },
];

export function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smooth(t) { return t * t * (3 - 2 * t); }
export function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
export function fractal(x, y, seed, oct = 5) {
  let v = 0, amp = 1, f = 1, norm = 0;
  for (let o = 0; o < oct; o++) { v += valueNoise(x * f, y * f, seed + o * 101) * amp; norm += amp; amp *= 0.5; f *= 2; }
  return v / norm;
}
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];

export class World {
  constructor(seed = (Math.random() * 1e9) | 0) {
    this.seed = seed;
    const n = GW * GH;
    this.height = new Float32Array(n);
    this.elev = new Float32Array(n);   // 0..1 above sea level (land only)
    this.type = new Uint8Array(n);
    this.baseTemp = new Float32Array(n);
    this.temp = new Float32Array(n);
    this.bio = new Float32Array(n);
    this.green = new Float32Array(n);  // how far land plants have colonised a land cell (0..1)
    this.farm = new Uint8Array(n);
    this.coast = new Uint8Array(n);    // land cell touching water
    this.moist = new Float32Array(n);  // 0 dry .. 1 wet
    this.biome = new Uint8Array(n);
    this.river = new Uint8Array(n);
    this.decay = new Float32Array(n);  // dead matter that feeds fungi
    this.rivers = [];
    this.generate();
  }

  generate() {
    const n = GW * GH, s = this.seed;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x;
      let h = fractal(x / 22, y / 22, s) * 0.8 + fractal(x / 7, y / 7, s + 7) * 0.2;
      const ex = Math.min(x, GW - 1 - x) / 8, ey = Math.min(y, GH - 1 - y) / 6; // ocean margin
      h -= (1 - Math.min(1, Math.min(ex, ey))) * 0.18;
      this.height[i] = h;
    }
    const sorted = Array.from(this.height).sort((a, b) => a - b);
    const sea = sorted[Math.floor(n * 0.56)], deep = sorted[Math.floor(n * 0.3)];
    const hi = sorted[Math.floor(n * 0.9)], mt = sorted[Math.floor(n * 0.975)], top = sorted[n - 1];
    this.sea = sea; this.deep = deep;
    for (let i = 0; i < n; i++) {
      const h = this.height[i];
      this.type[i] = h < deep ? T.DEEP : h < sea ? T.SHALLOW : h < sea + 0.012 ? T.BEACH : h < hi ? T.LAND : h < mt ? T.HIGH : T.MOUNT;
      this.elev[i] = h < sea ? 0 : (h - sea) / (top - sea);
      const y = Math.floor(i / GW), lat = Math.abs(y / (GH - 1) - 0.5) * 2;
      let t = 0.95 - lat * 0.82 - this.elev[i] * 0.4;
      if (h < sea) t = t * 0.85 + 0.5 * 0.15; // oceans moderate climate
      this.baseTemp[i] = t;
      this.temp[i] = t;
      this.bio[i] = h < sea ? (h < deep ? 0.15 : 0.35) * Math.random() : 0;
    }
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x;
      if (this.isWater(i)) continue;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < GW && ny < GH && this.isWater(ny * GW + nx)) this.coast[i] = 1;
      }
    }
    let land = 0; for (let i = 0; i < n; i++) if (!this.isWater(i)) land++;
    this.landCells = land; this.waterCells = n - land;
    this.makeRivers();

    // moisture: noise + latitude rain belts + closeness to sea and rivers
    const dist = new Float32Array(n).fill(99), q = [];
    for (let i = 0; i < n; i++) if (this.isWater(i) || this.river[i]) { dist[i] = this.river[i] ? 1 : 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % GW, y = (i / GW) | 0;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const j = ny * GW + nx;
        if (dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; q.push(j); }
      }
    }
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x;
      const lat = Math.abs(y / (GH - 1) - 0.5) * 2;
      const band = 0.5 + 0.5 * Math.cos(lat * Math.PI * 3); // wet tropics, dry subtropics, wetter mid-latitudes
      const m = fractal(x / 12, y / 12, s + 31) * 0.7 + band * 0.45 - Math.min(dist[i], 10) * 0.04 + 0.02 - this.elev[i] * 0.2;
      this.moist[i] = Math.max(0, Math.min(1, m));
    }
    this.classify();
  }

  /** Rivers run downhill from highlands to the sea and make their banks lush. */
  makeRivers() {
    const n = GW * GH, s = this.seed, sources = [];
    for (let i = 0; i < n; i++) if (this.type[i] === T.HIGH && hash(i, 7, s) < 0.06) sources.push(i);
    for (const src of sources.slice(0, 14)) {
      let i = src; const path = [];
      for (let step = 0; step < 140; step++) {
        path.push(i);
        if (this.isWater(i) || (this.river[i] && step > 0)) break;
        const x = i % GW, y = (i / GW) | 0;
        let best = -1, bh = Infinity;
        for (const [dx, dy] of N8) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
          const j = ny * GW + nx;
          if (path.includes(j)) continue;
          const hh = this.height[j] + hash(j, step, s) * 0.01;
          if (hh < bh) { bh = hh; best = j; }
        }
        if (best < 0 || bh > this.height[i] + 0.015) break;
        i = best;
      }
      const end = path[path.length - 1];
      if (path.length > 5 && (this.isWater(end) || this.river[end])) {
        for (const j of path) if (!this.isWater(j)) this.river[j] = 1;
        this.rivers.push(path);
      }
    }
  }

  classify() {
    for (let i = 0; i < this.biome.length; i++) {
      const t = this.temp[i], m = this.moist[i], ty = this.type[i];
      let b;
      if (ty <= T.SHALLOW) {
        if (t < 0.08) b = B.SEA_ICE;
        else if (ty === T.DEEP) b = B.DEEP;
        else if (t > 0.66) b = B.REEF;
        else if (t < 0.42) b = B.KELP;
        else b = B.OCEAN;
      } else if (t < 0.1) b = B.SNOW;
      else if (ty === T.MOUNT) b = B.MOUNTAIN;
      else if (ty === T.BEACH) b = B.BEACH;
      else if (t < 0.2) b = B.TUNDRA;
      else if (t < 0.36) b = B.TAIGA;
      else if (t > 0.62) b = m < 0.3 ? B.DESERT : m < 0.56 ? B.SAVANNA : B.JUNGLE;
      else b = m < 0.42 ? B.GRASS : B.FOREST;
      this.biome[i] = b;
    }
  }

  isWater(i) { return this.type[i] <= T.SHALLOW; }
  idx(x, y) {
    const cx = Math.max(0, Math.min(GW - 1, (x / CELL) | 0)), cy = Math.max(0, Math.min(GH - 1, (y / CELL) | 0));
    return cy * GW + cx;
  }

  setClimate(offset) {
    for (let i = 0; i < this.temp.length; i++) this.temp[i] = this.baseTemp[i] + offset;
    this.classify();
  }

  tempFactor(i) {
    const t = this.temp[i];
    if (t < 0.08) return 0.04; // ice
    const water = this.isWater(i);
    const d = (t - 0.62) / (water ? 0.85 : 0.6);
    return Math.max(water ? 0.3 : 0.12, 1 - d * d);
  }

  maxBio(i, env) {
    if (this.farm[i]) return 2.4 * env.farmYield * Math.max(0.3, this.tempFactor(i));
    let m = BIOMES[this.biome[i]].plant;
    if (!this.isWater(i)) m *= this.green[i] * (this.river[i] ? 1.3 : 1);
    return m * env.plantCap;
  }

  /** dt in ticks. env = { plantGrowth, plantCap, farmYield, landPlants } */
  updatePlants(dt, env) {
    const n = GW * GH, rate = 0.0055 * env.plantGrowth * dt;
    if (env.landPlants) {
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        const i = y * GW + x;
        if (this.isWater(i) || this.green[i] >= 1) continue;
        let src = this.coast[i] || this.river[i] ? 0.5 : 0;
        if (x > 0) src = Math.max(src, this.green[i - 1] - 0.25);
        if (x < GW - 1) src = Math.max(src, this.green[i + 1] - 0.25);
        if (y > 0) src = Math.max(src, this.green[i - GW] - 0.25);
        if (y < GH - 1) src = Math.max(src, this.green[i + GW] - 0.25);
        if (src > 0) this.green[i] = Math.min(1, this.green[i] + src * 0.0016 * dt * env.plantGrowth);
      }
    }
    let total = 0;
    for (let i = 0; i < n; i++) {
      const max = this.maxBio(i, env);
      let b = this.bio[i];
      if (max <= 0.001) { b *= 0.98; }
      else if (b < max) {
        const r = this.farm[i] ? rate * 3 : rate;
        b += r * (b + 0.12 * max) * (1 - b / max);
      } else b -= (b - max) * 0.02 * dt;
      this.bio[i] = b;
      total += b;
      if (this.decay[i] > 0.001) this.decay[i] *= 1 - 0.0015 * dt;
    }
    this.totalBio = total;
  }

  serialize() {
    const r = (a) => Array.from(a, (v) => Math.round(v * 1000) / 1000);
    return { seed: this.seed, bio: r(this.bio), green: r(this.green), farm: Array.from(this.farm), decay: r(this.decay) };
  }
  static restore(d) {
    const w = new World(d.seed);
    if (d.bio?.length === w.bio.length) w.bio.set(d.bio);
    if (d.green?.length === w.green.length) w.green.set(d.green);
    if (d.farm?.length === w.farm.length) w.farm.set(d.farm);
    if (d.decay?.length === w.decay.length) w.decay.set(d.decay);
    return w;
  }
}
