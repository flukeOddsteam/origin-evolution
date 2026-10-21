// Planet surface: terrain from seeded noise, per-cell temperature, plant biomass and farmland.

export const WORLD_W = 1920, WORLD_H = 1080, CELL = 24;
export const GW = WORLD_W / CELL, GH = WORLD_H / CELL; // 80 x 45
export const T = { DEEP: 0, SHALLOW: 1, BEACH: 2, LAND: 3, HIGH: 4, MOUNT: 5 };

function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
function fractal(x, y, seed) {
  let v = 0, amp = 1, f = 1, norm = 0;
  for (let o = 0; o < 5; o++) { v += valueNoise(x * f, y * f, seed + o * 101) * amp; norm += amp; amp *= 0.5; f *= 2; }
  return v / norm;
}

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
    this.sea = sea;
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
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < GW && ny < GH && this.isWater(ny * GW + nx)) this.coast[i] = 1;
      }
    }
    let land = 0; for (let i = 0; i < n; i++) if (!this.isWater(i)) land++;
    this.landCells = land; this.waterCells = n - land;
  }

  isWater(i) { return this.type[i] <= T.SHALLOW; }
  idx(x, y) {
    const cx = Math.max(0, Math.min(GW - 1, (x / CELL) | 0)), cy = Math.max(0, Math.min(GH - 1, (y / CELL) | 0));
    return cy * GW + cx;
  }

  setClimate(offset) {
    for (let i = 0; i < this.temp.length; i++) this.temp[i] = this.baseTemp[i] + offset;
  }

  tempFactor(i) {
    const t = this.temp[i];
    if (t < 0.08) return 0.04; // ice
    const water = this.isWater(i);
    const d = (t - 0.62) / (water ? 0.85 : 0.6);
    return Math.max(water ? 0.3 : 0.12, 1 - d * d);
  }

  maxBio(i, env) {
    const ty = this.type[i];
    if (this.farm[i]) return 2.4 * env.farmYield * Math.max(0.3, this.tempFactor(i));
    let m;
    if (ty === T.DEEP) m = 0.4; else if (ty === T.SHALLOW) m = 1;
    else {
      const g = this.green[i];
      m = (ty === T.BEACH ? 0.45 : ty === T.LAND ? 1.05 : ty === T.HIGH ? 0.65 : 0.15) * g;
    }
    return m * this.tempFactor(i) * env.plantCap;
  }

  /** dt in ticks. env = { plantGrowth, plantCap, farmYield, landPlants } */
  updatePlants(dt, env) {
    const n = GW * GH, rate = 0.0055 * env.plantGrowth * dt;
    if (env.landPlants) {
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        const i = y * GW + x;
        if (this.isWater(i) || this.green[i] >= 1) continue;
        let src = this.coast[i] ? 0.5 : 0;
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
    }
    this.totalBio = total;
  }

  serialize() {
    const r = (a) => Array.from(a, (v) => Math.round(v * 1000) / 1000);
    return { seed: this.seed, bio: r(this.bio), green: r(this.green), farm: Array.from(this.farm) };
  }
  static restore(d) {
    const w = new World(d.seed);
    if (d.bio?.length === w.bio.length) w.bio.set(d.bio);
    if (d.green?.length === w.green.length) w.green.set(d.green);
    if (d.farm?.length === w.farm.length) w.farm.set(d.farm);
    return w;
  }
}
