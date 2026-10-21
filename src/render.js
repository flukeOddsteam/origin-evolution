// Canvas renderer: biome terrain, rivers, flora, every body plan drawn as vector art,
// civilisation, day/night, clouds and weather.
import { WORLD_W, WORLD_H, CELL, GW, GH, T, B, BIOMES, hash, fractal } from "./sim/world.js";
import { archetypeOf } from "./sim/archetypes.js";
import { DRAW, drawSimple, paletteFor, SHADOW } from "./creatures.js";

const TEX_W = 640, TEX_H = 360;
const CLOUD_W = 240, CLOUD_H = 135;
export const DAY_TICKS = 3600; // one day-night cycle = 2 simulated minutes
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;

// Ground colours per biome [r,g,b]
const BIOME_RGB = [
  [10, 34, 72], [22, 80, 122], [30, 150, 160], [22, 86, 92], [218, 232, 244],
  [214, 196, 140], [218, 184, 122], [176, 164, 92], [34, 98, 48], [108, 150, 70],
  [52, 112, 58], [52, 92, 70], [138, 142, 120], [236, 242, 250], [128, 124, 122],
];
const BARREN = [116, 100, 82];
const FLOWERS = ["#f4d35e", "#ee6c9d", "#ffffff", "#b388eb", "#ff8c42"];
const CORALS = ["#e8806f", "#e5a65a", "#b68ad8", "#e07aa0", "#d9c470"];

export class Renderer {
  constructor(canvas, sim) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.tex = document.createElement("canvas");
    this.tex.width = TEX_W; this.tex.height = TEX_H;
    this.tctx = this.tex.getContext("2d");
    this.img = this.tctx.createImageData(TEX_W, TEX_H);
    this.grain = new Float32Array(TEX_W * TEX_H);
    for (let y = 0; y < TEX_H; y++) for (let x = 0; x < TEX_W; x++) this.grain[y * TEX_W + x] = (hash(x, y, 99) - 0.5) * 10 + (fractal(x / 9, y / 9, 7, 3) - 0.5) * 22;
    this.cloudCanvas = document.createElement("canvas");
    this.cloudCanvas.width = CLOUD_W; this.cloudCanvas.height = CLOUD_H;
    this.cloudDensity = new Float32Array(CLOUD_W * CLOUD_H);
    this.drops = [];
    this.cam = { x: WORLD_W / 2, y: WORLD_H / 2, zoom: 1 };
    this.frame = 0; this.texAge = 999;
    this.selected = null; this.follow = false;
    this.effects = true; this.weather = true;
    this.setSim(sim);
    this.resize();
  }

  setSim(sim) { this.sim = sim; this.texAge = 999; this.buildClouds(); }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(10, r.width); this.h = Math.max(10, r.height);
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    this.fit = Math.min(this.w / WORLD_W, this.h / WORLD_H);
    this.cam.zoom = clamp(this.cam.zoom, this.minZoom(), 8);
    this.clampCam();
  }
  minZoom() { return this.fit; }
  clampCam() {
    const hw = this.w / 2 / this.cam.zoom, hh = this.h / 2 / this.cam.zoom;
    this.cam.x = hw * 2 >= WORLD_W ? WORLD_W / 2 : clamp(this.cam.x, hw, WORLD_W - hw);
    this.cam.y = hh * 2 >= WORLD_H ? WORLD_H / 2 : clamp(this.cam.y, hh, WORLD_H - hh);
  }
  toWorld(sx, sy) { return { x: (sx - this.w / 2) / this.cam.zoom + this.cam.x, y: (sy - this.h / 2) / this.cam.zoom + this.cam.y }; }
  zoomAt(sx, sy, factor) {
    const before = this.toWorld(sx, sy);
    this.cam.zoom = clamp(this.cam.zoom * factor, this.minZoom(), 8);
    const after = this.toWorld(sx, sy);
    this.cam.x += before.x - after.x; this.cam.y += before.y - after.y;
    this.clampCam();
  }
  pan(dx, dy) { this.cam.x -= dx / this.cam.zoom; this.cam.y -= dy / this.cam.zoom; this.follow = false; this.clampCam(); }
  focus(x, y, zoom) { this.cam.x = x; this.cam.y = y; if (zoom) this.cam.zoom = clamp(zoom, this.minZoom(), 8); this.clampCam(); }
  fitWorld() { this.cam.zoom = this.minZoom(); this.cam.x = WORLD_W / 2; this.cam.y = WORLD_H / 2; this.follow = false; this.clampCam(); }

  // ------------------------------------------------------------ terrain texture
  hAt(gx, gy) {
    const H = this.sim.world.height;
    const x0 = clamp(Math.floor(gx), 0, GW - 1), y0 = clamp(Math.floor(gy), 0, GH - 1), x1 = Math.min(GW - 1, x0 + 1), y1 = Math.min(GH - 1, y0 + 1);
    const fx = clamp(gx - x0, 0, 1), fy = clamp(gy - y0, 0, 1);
    return mix(mix(H[y0 * GW + x0], H[y0 * GW + x1], fx), mix(H[y1 * GW + x0], H[y1 * GW + x1], fx), fy);
  }

  /** Colour of one grid cell as seen from orbit: biome, plant cover, farmland, snow. */
  cellRGB(i, out) {
    const w = this.sim.world, b = w.biome[i];
    let [r, g, bl] = BIOME_RGB[b];
    if (!w.isWater(i) && b !== B.SNOW && b !== B.MOUNTAIN && b !== B.BEACH) {
      const max = BIOMES[b].plant || 1;
      const cover = clamp(w.green[i] * (0.45 + 0.55 * Math.min(1, w.bio[i] / max)), 0, 1);
      r = mix(BARREN[0], r, cover); g = mix(BARREN[1], g, cover); bl = mix(BARREN[2], bl, cover);
      if (w.farm[i]) { r = 190; g = 168; bl = 78; }
    } else if (w.isWater(i) && b !== B.SEA_ICE) {
      const plank = clamp(w.bio[i], 0, 1.4);
      g += plank * 14; r += plank * 3;
    }
    out[0] = r; out[1] = g; out[2] = bl;
  }

  /** Per-cell colours and slopes, refreshed once per full texture pass. */
  prepareCells() {
    const w = this.sim.world, n = GW * GH;
    if (!this.cellCol) { this.cellCol = new Float32Array(n * 3); this.cellSlope = new Float32Array(n); }
    const c = [0, 0, 0], H = w.height;
    for (let i = 0; i < n; i++) {
      this.cellRGB(i, c); this.cellCol[i * 3] = c[0]; this.cellCol[i * 3 + 1] = c[1]; this.cellCol[i * 3 + 2] = c[2];
      const x = i % GW, y = (i / GW) | 0;
      const a = H[Math.max(0, y - 1) * GW + Math.min(GW - 1, x + 1)], b = H[Math.min(GH - 1, y + 1) * GW + Math.max(0, x - 1)];
      this.cellSlope[i] = (a - b) * 0.5;
    }
  }

  buildTexture(rowStart = 0, rowEnd = TEX_H) {
    const t0 = performance.now();
    const w = this.sim.world, d = this.img.data, C = this.cellCol, SL = this.cellSlope, Hh = w.height, grain = this.grain;
    const sx = GW / TEX_W, sy = GH / TEX_H, sea = w.sea, deep = w.deep;
    for (let py = rowStart; py < rowEnd; py++) {
      const gy = (py + 0.5) * sy - 0.5, y0 = clamp(Math.floor(gy), 0, GH - 1), y1 = Math.min(GH - 1, y0 + 1), fy = clamp(gy - y0, 0, 1);
      for (let px = 0; px < TEX_W; px++) {
        const gx = (px + 0.5) * sx - 0.5, x0 = clamp(Math.floor(gx), 0, GW - 1), x1 = Math.min(GW - 1, x0 + 1), fx = clamp(gx - x0, 0, 1);
        const i00 = y0 * GW + x0, i10 = y0 * GW + x1, i01 = y1 * GW + x0, i11 = y1 * GW + x1;
        const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        const h = Hh[i00] * w00 + Hh[i10] * w10 + Hh[i01] * w01 + Hh[i11] * w11;
        const water = h < sea;
        // blend the four neighbouring cells, but never mix land and sea colours across the coastline
        const k00 = (Hh[i00] < sea) === water ? w00 : 0, k10 = (Hh[i10] < sea) === water ? w10 : 0, k01 = (Hh[i01] < sea) === water ? w01 : 0, k11 = (Hh[i11] < sea) === water ? w11 : 0;
        const ws = k00 + k10 + k01 + k11;
        let r, g, b;
        if (ws > 0) {
          r = (C[i00 * 3] * k00 + C[i10 * 3] * k10 + C[i01 * 3] * k01 + C[i11 * 3] * k11) / ws;
          g = (C[i00 * 3 + 1] * k00 + C[i10 * 3 + 1] * k10 + C[i01 * 3 + 1] * k01 + C[i11 * 3 + 1] * k11) / ws;
          b = (C[i00 * 3 + 2] * k00 + C[i10 * 3 + 2] * k10 + C[i01 * 3 + 2] * k01 + C[i11 * 3 + 2] * k11) / ws;
        } else if (water) { r = 22; g = 80; b = 122; } else { r = 200; g = 186; b = 132; }
        const gr = grain[py * TEX_W + px];
        if (water) {
          const depth = clamp((sea - h) / (sea - deep + 0.08), 0, 1), k = 1.15 - depth * 0.55;
          r *= k; g *= k; b *= k * 1.05;
          if (sea - h < 0.012) { const f = (1 - (sea - h) / 0.012) * 0.45; r += (200 - r) * f; g += (230 - g) * f; b += (235 - b) * f; } // surf
          r += gr * 0.25; g += gr * 0.3; b += gr * 0.35;
        } else {
          if (h < sea + 0.006) { r += (205 - r) * 0.6; g += (190 - g) * 0.6; b += (140 - b) * 0.6; } // wet sand
          const e = (h - sea) / 0.32;
          if (e > 0.75) { const s2 = clamp((e - 0.75) / 0.2, 0, 1); r += (236 - r) * s2; g += (240 - g) * s2; b += (248 - b) * s2; } // snow caps
          const slope = SL[i00] * w00 + SL[i10] * w10 + SL[i01] * w01 + SL[i11] * w11;
          const shade = clamp(1 + slope * 9, 0.72, 1.22);
          r = r * shade + gr; g = g * shade + gr; b = b * shade + gr * 0.8;
          const near = fx < 0.5 ? (fy < 0.5 ? i00 : i01) : (fy < 0.5 ? i10 : i11);
          if (w.farm[near] && ((px * 2 + py) % 6) < 2) { r -= 26; g -= 8; b -= 18; } // furrows
          else if (w.biome[near] === B.DESERT && ((px * 3 + py * 5 + (gr | 0)) % 11) < 2) { r += 12; g += 10; b += 6; } // dunes
        }
        const o = (py * TEX_W + px) * 4;
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
      }
    }
    this.tctx.putImageData(this.img, 0, 0, 0, rowStart, TEX_W, rowEnd - rowStart);
    this.texAge = 0;
    this.texMs = performance.now() - t0;
  }

  // ------------------------------------------------------------ clouds
  buildClouds() {
    if (!this.sim) return;
    const seed = this.sim.world.seed + 5, cctx = this.cloudCanvas.getContext("2d"), img = cctx.createImageData(CLOUD_W, CLOUD_H);
    for (let y = 0; y < CLOUD_H; y++) for (let x = 0; x < CLOUD_W; x++) {
      // periodic in x so the layer can scroll and wrap
      const a = (x / CLOUD_W) * TAU, n = fractal(Math.cos(a) * 6 + 20, y / 18 + Math.sin(a) * 6, seed, 4);
      const dens = clamp((n - 0.5) * 3.2, 0, 1);
      this.cloudDensity[y * CLOUD_W + x] = dens;
      const o = (y * CLOUD_W + x) * 4;
      img.data[o] = 255; img.data[o + 1] = 255; img.data[o + 2] = 255; img.data[o + 3] = dens * 230;
    }
    cctx.putImageData(img, 0, 0);
    if (!this.cloudShadow) { this.cloudShadow = document.createElement("canvas"); this.cloudShadow.width = CLOUD_W; this.cloudShadow.height = CLOUD_H; }
    const sctx = this.cloudShadow.getContext("2d");
    for (let k = 0; k < img.data.length; k += 4) { img.data[k] = 0; img.data[k + 1] = 10; img.data[k + 2] = 30; }
    sctx.putImageData(img, 0, 0);
  }
  cloudOffset() { return ((this.sim.tick * 0.25) % WORLD_W + WORLD_W) % WORLD_W; }
  cloudAt(x, y) {
    const cx = Math.floor((((x - this.cloudOffset()) % WORLD_W + WORLD_W) % WORLD_W) / WORLD_W * CLOUD_W);
    const cy = clamp(Math.floor(y / WORLD_H * CLOUD_H), 0, CLOUD_H - 1);
    return this.cloudDensity[cy * CLOUD_W + cx] || 0;
  }
  /** 0 = noon, 1 = midnight */
  night() {
    const p = (this.sim.tick % DAY_TICKS) / DAY_TICKS; // 0 dawn .. 0.5 dusk
    const sun = Math.sin(p * TAU);
    return clamp(0.15 - sun * 1.3, 0, 1);
  }
  dayLabel() { const p = (this.sim.tick % DAY_TICKS) / DAY_TICKS; const h = (6 + p * 24) % 24; return `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`; }

  /** Rebuild a band of the terrain texture (also used by the 3D view, which drapes it over the mesh). */
  tickTexture() {
    this.frame++;
    if (this.texAge > 900) { this.prepareCells(); this.buildTexture(); this.texRow = 0; }
    else if (this.frame % 2 === 0) {
      const r0 = this.texRow || 0, r1 = Math.min(TEX_H, r0 + 12);
      if (r0 === 0) this.prepareCells();
      this.buildTexture(r0, r1); this.texRow = r1 >= TEX_H ? 0 : r1;
    }
  }

  // ------------------------------------------------------------ main draw
  draw(time) {
    const ctx = this.ctx, sim = this.sim, z = this.cam.zoom, dpr = this.dpr;
    this.tickTexture();
    if (this.follow && this.selected && !this.selected.dead) { this.cam.x = this.selected.x; this.cam.y = this.selected.y; this.clampCam(); }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#050a14"; ctx.fillRect(0, 0, this.w, this.h);
    ctx.setTransform(z * dpr, 0, 0, z * dpr, (this.w / 2 - this.cam.x * z) * dpr, (this.h / 2 - this.cam.y * z) * dpr);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(this.tex, 0, 0, WORLD_W, WORLD_H);

    const v = this.view();
    this.drawRivers(time);
    this.drawWater(v, time);
    if (z > 1.15 && this.effects) this.drawFlora(v, time);
    this.drawCivilization(v, time);
    this.drawCreatures(v, time);
    this.drawEffects(time);
    if (sim.climate.pollution > 0.04) {
      ctx.fillStyle = `rgba(120,110,90,${clamp(sim.climate.pollution * 0.6, 0, 0.22)})`;
      ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    }
    if (this.weather) this.drawSky(v, time);
    this.drawSelection(time);
    if (this.weather) this.drawPrecip(time);
  }

  view() {
    const z = this.cam.zoom, hw = this.w / 2 / z, hh = this.h / 2 / z;
    return { x0: this.cam.x - hw - 10, x1: this.cam.x + hw + 10, y0: this.cam.y - hh - 10, y1: this.cam.y + hh + 10 };
  }
  cellRange(v, pad = 0) {
    return [Math.max(0, ((v.x0 / CELL) | 0) - pad), Math.min(GW - 1, ((v.x1 / CELL) | 0) + pad), Math.max(0, ((v.y0 / CELL) | 0) - pad), Math.min(GH - 1, ((v.y1 / CELL) | 0) + pad)];
  }

  drawRivers(time) {
    const ctx = this.ctx, w = this.sim.world;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const path of w.rivers) {
      const pts = path.map((i) => [(i % GW + 0.5) * CELL + (hash(i, 3, 1) - 0.5) * 8, (((i / GW) | 0) + 0.5) * CELL + (hash(i, 4, 1) - 0.5) * 8]);
      const trace = () => {
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length - 1; k++) ctx.quadraticCurveTo(pts[k][0], pts[k][1], (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2);
        ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      };
      const frozen = w.temp[path[0]] < 0.1;
      trace(); ctx.strokeStyle = frozen ? "rgba(220,235,245,.9)" : "rgba(40,90,70,.55)"; ctx.lineWidth = 6; ctx.stroke();
      trace(); ctx.strokeStyle = frozen ? "#e8f2fa" : "#3a86b8"; ctx.lineWidth = 3.4; ctx.stroke();
      if (!frozen && this.cam.zoom > 1.3) { ctx.setLineDash([3, 9]); ctx.lineDashOffset = -time / 120; trace(); ctx.strokeStyle = "rgba(220,240,255,.45)"; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); }
    }
  }

  drawWater(v, time) {
    if (!this.effects || this.cam.zoom < 0.9) return;
    const ctx = this.ctx, w = this.sim.world;
    ctx.strokeStyle = "rgba(200,235,255,0.10)"; ctx.lineWidth = 1.2 / this.cam.zoom;
    ctx.beginPath();
    const [cx0, cx1, cy0, cy1] = this.cellRange(v);
    for (let cy = cy0; cy <= cy1; cy += 2) for (let cx = cx0; cx <= cx1; cx += 2) {
      const i = cy * GW + cx;
      if (!w.isWater(i) || w.temp[i] < 0.1) continue;
      const x = cx * CELL + ((cx * 7 + cy * 13) % 20) + Math.sin(time / 1400 + cy) * 3, y = cy * CELL + ((cx * 11 + cy * 5) % 20) + Math.sin(time / 900 + cx + cy) * 2;
      ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 5, y - 2.5, x + 10, y);
    }
    ctx.stroke();
  }

  /** Individual plants, corals and fungi, chosen by biome and drawn in batched layers. */
  drawFlora(v, time) {
    const ctx = this.ctx, w = this.sim.world, z = this.cam.zoom;
    const [cx0, cx1, cy0, cy1] = this.cellRange(v, 1);
    const L = { shadow: new Path2D(), trunk: new Path2D(), dark: new Path2D(), mid: new Path2D(), light: new Path2D(), conifer: new Path2D(), coniferLight: new Path2D(), grass: new Path2D(), dry: new Path2D(), cactus: new Path2D(), rock: new Path2D(), kelp: new Path2D(), seagrass: new Path2D(), crop: new Path2D(), palm: new Path2D(), snow: new Path2D(), cap: new Path2D(), stem: new Path2D() };
    const flowers = FLOWERS.map(() => new Path2D()), corals = CORALS.map(() => new Path2D());
    const sway = Math.sin(time / 900) * 0.6;
    const circ = (p, x, y, r) => { p.moveTo(x + r, y); p.arc(x, y, r, 0, TAU); };
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const i = cy * GW + cx, b = w.biome[i], bio = w.bio[i], max = BIOMES[b].plant || 1;
      const dens = clamp(bio / (max * 0.9), 0, 1) * (w.isWater(i) ? 1 : w.green[i]);
      const n = w.isWater(i) ? Math.round(dens * 3) : Math.round(dens * 5);
      for (let k = 0; k < Math.max(n, 2); k++) {
        const hs = hash(i, k, 17), hs2 = hash(i, k, 29), hs3 = hash(i, k, 43);
        const x = cx * CELL + hs * CELL, y = cy * CELL + hs2 * CELL;
        if (k >= n) { // sparse rocks and debris even where nothing grows
          if (!w.isWater(i) && hs3 > 0.82 && (b === B.DESERT || b === B.TUNDRA || b === B.MOUNTAIN || b === B.BEACH || w.green[i] < 0.2)) circ(L.rock, x, y, 1 + hs3 * 1.4);
          continue;
        }
        const s = 0.8 + hs3 * 0.6;
        if (w.farm[i]) { for (let q = -2; q <= 2; q++) { L.crop.moveTo(x + q * 1.6, y); L.crop.lineTo(x + q * 1.6 + sway * 0.4, y - 2.5 - bio); } continue; }
        switch (b) {
          case B.JUNGLE:
            if (k % 3 === 0) { this.palm(L, x, y, 4.5 * s, sway); }
            else { circ(L.shadow, x + 2, y + 2, 5 * s); circ(L.dark, x, y, 5 * s); circ(L.mid, x - 1.2 * s, y - 1.2 * s, 3.2 * s); circ(L.light, x - 2 * s, y - 2 * s, 1.4 * s); }
            break;
          case B.FOREST:
            if (k % 2 === 0) { circ(L.shadow, x + 2, y + 2, 4 * s); circ(L.mid, x, y, 4 * s); circ(L.light, x - 1.2 * s, y - 1.2 * s, 2.2 * s); }
            else { circ(L.dark, x, y, 2.4 * s); }
            break;
          case B.TAIGA: case B.TUNDRA:
            if (b === B.TUNDRA && k % 2) { circ(L.dry, x, y, 1.2 * s); break; }
            circ(L.shadow, x + 2, y + 2, 3.2 * s);
            for (let q = 0; q < 3; q++) { const rr = (3.4 - q) * s; L.conifer.moveTo(x - rr, y + rr * 0.3 - q * 1.6); L.conifer.lineTo(x + sway * 0.3, y - rr - q * 1.6); L.conifer.lineTo(x + rr, y + rr * 0.3 - q * 1.6); }
            L.coniferLight.moveTo(x, y - 4 * s); L.coniferLight.lineTo(x - 1.4 * s, y - 1 * s); L.coniferLight.lineTo(x, y - 1.5 * s);
            if (w.temp[i] < 0.2) circ(L.snow, x, y - 3.5 * s, 1 * s);
            break;
          case B.GRASS:
            for (let q = 0; q < 3; q++) { const gx = x + (q - 1) * 1.5; L.grass.moveTo(gx, y); L.grass.lineTo(gx + sway + (q - 1) * 0.8, y - 2.6 * s); }
            if (hs3 > 0.6 && z > 1.6) circ(flowers[(hs3 * 97 | 0) % FLOWERS.length], x + 2, y - 1, 0.55);
            if (k === 0 && hs3 > 0.7) { circ(L.shadow, x + 2, y + 2, 3.5); circ(L.mid, x, y, 3.5); circ(L.light, x - 1, y - 1, 1.8); }
            break;
          case B.SAVANNA:
            if (k === 0 && hs3 > 0.45) { // acacia
              L.trunk.moveTo(x, y + 2); L.trunk.lineTo(x, y - 2);
              L.shadow.moveTo(x + 8, y + 3); L.shadow.ellipse(x + 2, y + 3, 6, 2.5, 0, 0, TAU);
              L.mid.moveTo(x + 6, y - 3); L.mid.ellipse(x, y - 3, 6, 2.6, 0, 0, TAU);
            } else for (let q = 0; q < 3; q++) { const gx = x + (q - 1) * 1.4; L.dry.moveTo(gx, y); L.dry.lineTo(gx + sway, y - 2.4 * s); }
            break;
          case B.DESERT:
            if (hs3 > 0.6) { circ(L.shadow, x + 1.5, y + 1.5, 1.6); L.cactus.rect(x - 0.9, y - 4, 1.8, 5); L.cactus.rect(x - 2.6, y - 2.6, 1.7, 0.9); L.cactus.rect(x - 2.6, y - 4.2, 0.9, 2.4); L.cactus.rect(x + 0.9, y - 1.8, 1.6, 0.9); L.cactus.rect(x + 1.7, y - 3.4, 0.9, 2.4); }
            else circ(L.dry, x, y, 0.9);
            break;
          case B.BEACH:
            if (w.temp[i] > 0.6 && hs3 > 0.5) this.palm(L, x, y, 4 * s, sway); else circ(L.rock, x, y, 0.8);
            break;
          case B.REEF: {
            if (z < 1.7) break;
            const p = corals[(hs3 * 89 | 0) % CORALS.length];
            if (k % 3 === 0) { // branching coral
              for (let q = 0; q < 5; q++) { const a = q * 1.25 + hs * 3, l = (1.6 + hash(i, q, 7) * 1.4) * s; const mx = x + Math.cos(a) * l * 0.55, my = y + Math.sin(a) * l * 0.55; p.moveTo(x, y); p.lineTo(mx, my); p.lineTo(mx + Math.cos(a + 0.5) * l * 0.5, my + Math.sin(a + 0.5) * l * 0.5); p.moveTo(mx, my); p.lineTo(mx + Math.cos(a - 0.5) * l * 0.5, my + Math.sin(a - 0.5) * l * 0.5); }
            } else if (k % 3 === 1) { L.seagrass.moveTo(x + 1.6 * s, y); L.seagrass.arc(x, y, 1.6 * s, 0, TAU); L.seagrass.moveTo(x + 0.9 * s, y); L.seagrass.arc(x, y, 0.9 * s, 0, TAU); } // brain coral rings
            else { for (let q = 0; q < 7; q++) { const a = q / 7 * TAU + Math.sin(time / 700 + hs * 5) * 0.2; p.moveTo(x, y); p.lineTo(x + Math.cos(a) * 1.3 * s, y + Math.sin(a) * 1.3 * s); } } // anemone
            break;
          }
          case B.KELP:
            L.kelp.moveTo(x, y + 4); L.kelp.bezierCurveTo(x + 2 + Math.sin(time / 700 + hs * 9) * 2, y, x - 2 + Math.sin(time / 600 + hs * 7) * 2, y - 4, x + Math.sin(time / 500 + hs * 5) * 2.5, y - 8 * s);
            break;
          case B.OCEAN:
            if (hs3 > 0.4) { L.seagrass.moveTo(x, y); L.seagrass.lineTo(x + Math.sin(time / 800 + hs * 6) * 1.5, y - 3); }
            break;
          default: break;
        }
      }
      // fungi grow where creatures died
      if (!w.isWater(i) && w.decay[i] > 0.25 && w.green[i] > 0.2 && z > 1.6) {
        const m = Math.min(4, Math.ceil(w.decay[i] * 3));
        for (let k = 0; k < m; k++) {
          const x = cx * CELL + hash(i, k, 61) * CELL, y = cy * CELL + hash(i, k, 67) * CELL;
          L.stem.rect(x - 0.35, y - 1.6, 0.7, 1.6);
          L.cap.moveTo(x + 1.3, y - 1.5); L.cap.ellipse(x, y - 1.5, 1.3, 0.9, 0, Math.PI, TAU);
        }
      }
    }
    ctx.lineCap = "round";
    ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.fill(L.shadow);
    ctx.strokeStyle = "#6b5232"; ctx.lineWidth = 1.2; ctx.stroke(L.trunk);
    ctx.fillStyle = "#1f5a2c"; ctx.fill(L.dark);
    ctx.fillStyle = "#2f7a3a"; ctx.fill(L.mid);
    ctx.fillStyle = "rgba(160,210,110,.55)"; ctx.fill(L.light);
    ctx.fillStyle = "#1e4a3a"; ctx.fill(L.conifer);
    ctx.fillStyle = "rgba(120,170,140,.45)"; ctx.fill(L.coniferLight);
    ctx.fillStyle = "#f2f7fb"; ctx.fill(L.snow);
    ctx.strokeStyle = "#5f9a3c"; ctx.lineWidth = 0.6; ctx.stroke(L.grass);
    ctx.strokeStyle = "#b8a35a"; ctx.lineWidth = 0.6; ctx.stroke(L.dry); ctx.fillStyle = "#9c8d5a"; ctx.fill(L.dry);
    ctx.fillStyle = "#4f8a46"; ctx.fill(L.cactus);
    ctx.fillStyle = "#8b8378"; ctx.fill(L.rock);
    ctx.strokeStyle = "#6d6a2c"; ctx.lineWidth = 1.1; ctx.stroke(L.kelp);
    ctx.strokeStyle = "rgba(90,170,120,.7)"; ctx.lineWidth = 0.7; ctx.stroke(L.seagrass);
    ctx.strokeStyle = "#d9b44a"; ctx.lineWidth = 0.6; ctx.stroke(L.crop);
    ctx.strokeStyle = "#7a5a34"; ctx.lineWidth = 1; ctx.stroke(L.palm);
    flowers.forEach((p, k) => { ctx.fillStyle = FLOWERS[k]; ctx.fill(p); });
    ctx.globalAlpha = 0.8; corals.forEach((p, k) => { ctx.strokeStyle = CORALS[k]; ctx.lineWidth = 0.55; ctx.stroke(p); }); ctx.globalAlpha = 1;
    ctx.fillStyle = "#efe6d6"; ctx.fill(L.stem);
    ctx.fillStyle = "#c8452f"; ctx.fill(L.cap);
    if (this._palmLeaves) { ctx.strokeStyle = "#3f8f3a"; ctx.lineWidth = 1.3; ctx.stroke(this._palmLeaves); this._palmLeaves = null; }
  }
  palm(L, x, y, s, sway) {
    L.shadow.moveTo(x + 4, y + 2); L.shadow.ellipse(x + 2, y + 2, s * 0.9, s * 0.4, 0, 0, TAU);
    const tx = x + sway, ty = y - s;
    L.palm.moveTo(x, y); L.palm.quadraticCurveTo(x + 1, y - s * 0.5, tx, ty);
    if (!this._palmLeaves) this._palmLeaves = new Path2D();
    for (let q = 0; q < 6; q++) { const a = q / 6 * TAU + 0.3; this._palmLeaves.moveTo(tx, ty); this._palmLeaves.quadraticCurveTo(tx + Math.cos(a) * s * 0.6, ty + Math.sin(a) * s * 0.6 - 1, tx + Math.cos(a) * s, ty + Math.sin(a) * s + 0.8); }
  }

  // ------------------------------------------------------------ creatures
  drawCreatures(v, time) {
    const ctx = this.ctx, z = this.cam.zoom, sim = this.sim;
    const minR = 1.4 / z, detailOK = this.effects;
    const humanCloth = sim.era >= 6 ? null : "#8a6a48";
    for (const c of sim.creatures) {
      if (c.x < v.x0 || c.x > v.x1 || c.y < v.y0 || c.y > v.y1) continue;
      const sp = sim.species.get(c.sp);
      if (!sp) continue;
      const arch = sp.arch || archetypeOf(c.g, sp.sapient, sp.proto);
      const P = paletteFor(sp, arch);
      const r = Math.max(minR, c.r * 1.2), rs = r * z;
      if (rs < 2.2) { ctx.fillStyle = P.base; ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2); continue; }
      const face = arch === "human" ? c.a : c.a;
      ctx.save();
      ctx.translate(c.x, c.y);
      const lift = SHADOW[arch];
      if (lift !== undefined && rs > 3) {
        ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath();
        ctx.ellipse(r * (0.25 + lift * 0.6), r * (0.35 + lift * 0.8), r * 1.15, r * 0.7, face, 0, TAU); ctx.fill();
      }
      ctx.rotate(face);
      if (rs < 5 || !detailOK) drawSimple(ctx, r, arch, P);
      else {
        const ph = time / 160 + c.id * 1.7;
        const o = { detail: rs > 9, pat: sp.pattern || 0, moving: c.mode !== 1 };
        if (arch === "human") { o.cloth = humanCloth || `hsl(${(c.id * 47) % 360},45%,48%)`; o.skin = ["#e2b48f", "#c99a74", "#a8764f", "#7c5638"][c.id % 4]; o.hair = ["#2b1d14", "#4a3020", "#151515", "#7a5530"][(c.id >> 2) % 4]; o.tool = sim.era < 7; }
        (DRAW[arch] || DRAW.fish)(ctx, r, c.g, P, ph, o);
      }
      ctx.restore();
    }
  }

  // ------------------------------------------------------------ sky
  drawSky(v, time) {
    const ctx = this.ctx, z = this.cam.zoom, night = this.night();
    // cloud shadows and clouds (fade out when zoomed in close)
    const off = this.cloudOffset(), cloudA = clamp(0.5 - (z - this.fit) * 0.3, 0.08, 0.5);
    ctx.save();
    for (const dx of [off - WORLD_W, off]) {
      ctx.globalAlpha = cloudA * 0.3;
      ctx.drawImage(this.cloudShadow, dx + 40, 50, WORLD_W, WORLD_H);
    }
    for (const dx of [off - WORLD_W, off]) { ctx.globalAlpha = cloudA * (1 - night * 0.6); ctx.drawImage(this.cloudCanvas, dx, 0, WORLD_W, WORLD_H); }
    ctx.restore();
    // night: darken, then add lights
    if (night > 0.02) {
      const p = (this.sim.tick % DAY_TICKS) / DAY_TICKS;
      const dusk = Math.max(0, 1 - Math.abs(p - 0.5) * 8) + Math.max(0, 1 - Math.abs(p - 1) * 8) + Math.max(0, 1 - p * 8);
      ctx.fillStyle = `rgba(8,14,40,${night * 0.55})`; ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
      if (dusk > 0) { ctx.fillStyle = `rgba(255,120,60,${dusk * 0.08})`; ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0); }
      this.drawNightLights(v, time, night);
    }
  }

  drawNightLights(v, time, night) {
    const ctx = this.ctx, w = this.sim.world, z = this.cam.zoom;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const s of this.sim.settlements) {
      if (s.x < v.x0 - 80 || s.x > v.x1 + 80 || s.y < v.y0 - 80 || s.y > v.y1 + 80) continue;
      const R = 14 + s.level * 14 + Math.sqrt(s.pop) * 0.6;
      const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, R);
      grd.addColorStop(0, `rgba(255,200,110,${0.55 * night})`); grd.addColorStop(1, "rgba(255,150,60,0)");
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(s.x, s.y, R, 0, TAU); ctx.fill();
    }
    if (z > 1.3 && this.effects) {
      const [cx0, cx1, cy0, cy1] = this.cellRange(v);
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const i = cy * GW + cx, b = w.biome[i];
        const glow = b === B.DEEP || b === B.OCEAN ? "rgba(90,230,255," : b === B.FOREST || b === B.JUNGLE ? "rgba(220,255,120," : null;
        if (!glow || hash(i, 1, 5) > 0.35) continue;
        const tw = 0.5 + 0.5 * Math.sin(time / 300 + i);
        const x = cx * CELL + hash(i, 2, 5) * CELL + Math.sin(time / 1200 + i) * 4, y = cy * CELL + hash(i, 3, 5) * CELL + Math.cos(time / 1300 + i) * 4;
        ctx.fillStyle = glow + (night * tw * 0.8) + ")"; ctx.beginPath(); ctx.arc(x, y, 1.1, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  /** Rain and snow in screen space wherever clouds are thick. */
  drawPrecip(time) {
    const ctx = this.ctx, w = this.sim.world, dpr = this.dpr;
    if (this.drops.length < 160) for (let k = 0; k < 160; k++) this.drops.push({ x: Math.random() * this.w, y: Math.random() * this.h, s: 0.6 + Math.random() * 0.8 });
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    for (const d of this.drops) {
      const p = this.toWorld(d.x, d.y);
      const dens = this.cloudAt(p.x, p.y);
      const i = w.idx(p.x, p.y), snow = w.temp[i] < 0.2;
      d.y += snow ? d.s * 0.9 : d.s * 9; d.x += snow ? Math.sin(time / 500 + d.s * 10) * 0.4 : -d.s * 1.5;
      if (d.y > this.h || d.x < 0) { d.y = -5; d.x = Math.random() * this.w; }
      if (dens < 0.55) continue;
      const a = (dens - 0.55) * 1.6;
      if (snow) { ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(d.x, d.y, 1.3 * d.s, 0, TAU); ctx.fill(); }
      else { ctx.strokeStyle = `rgba(190,215,240,${a * 0.6})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 1.5, d.y - 8); ctx.stroke(); }
    }
    ctx.restore();
  }

  drawCivilization(v, time) {
    const sim = this.sim, ctx = this.ctx, z = this.cam.zoom;
    const S = sim.settlements;
    if (!S.length) return;
    // roads
    if (sim.era >= 6) {
      ctx.strokeStyle = sim.era >= 8 ? "rgba(230,220,200,.55)" : "rgba(170,140,100,.55)"; ctx.lineWidth = (sim.era >= 7 ? 2.2 : 1.4); ctx.setLineDash(sim.era >= 7 ? [] : [3, 2]);
      ctx.beginPath();
      for (const a of S) {
        const near = S.filter((b) => b !== a && b.id > a.id).map((b) => [b, Math.hypot(b.x - a.x, b.y - a.y)]).filter(([, d]) => d < 380).sort((p, q) => p[1] - q[1]).slice(0, 2);
        for (const [b] of near) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    const night = sim.era >= 7 ? 0.5 + 0.5 * Math.sin(time / 4000) : 0;
    for (const s of S) {
      if (s.x < v.x0 - 60 || s.x > v.x1 + 60 || s.y < v.y0 - 60 || s.y > v.y1 + 60) continue;
      const L = s.level, size = 7 + L * 7 + Math.sqrt(s.pop) * 0.3;
      // territory
      ctx.fillStyle = "rgba(255,210,140,.06)"; ctx.beginPath(); ctx.arc(s.x, s.y, (2 + L) * CELL, 0, TAU); ctx.fill();
      if (L === 0) {
        const fl = 1 + Math.sin(time / 90 + s.id) * 0.2;
        const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 14 * fl);
        grd.addColorStop(0, "rgba(255,190,90,.75)"); grd.addColorStop(1, "rgba(255,120,40,0)");
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(s.x, s.y, 14 * fl, 0, TAU); ctx.fill();
        ctx.fillStyle = "#8a6a45";
        for (let k = 0; k < 3; k++) { const a = k * 2.1 + s.id; const tx = s.x + Math.cos(a) * 7, ty = s.y + Math.sin(a) * 7; ctx.beginPath(); ctx.moveTo(tx - 3, ty + 2); ctx.lineTo(tx, ty - 3.5); ctx.lineTo(tx + 3, ty + 2); ctx.fill(); }
        ctx.fillStyle = "#ffcf6a"; ctx.beginPath(); ctx.arc(s.x, s.y, 1.6 * fl, 0, TAU); ctx.fill();
      } else {
        const n = Math.min(34, 4 + L * 5 + Math.floor(Math.sqrt(s.pop) / 3));
        for (let k = 0; k < n; k++) {
          const hsh = (s.id * 9301 + k * 49297) % 233280 / 233280, a = k * 2.399 + s.id, d = Math.sqrt(k / n) * size;
          const bx = s.x + Math.cos(a) * d, by = s.y + Math.sin(a) * d;
          const bw = 3.2 + L * 1.1 + hsh * 2, bh = L >= 2 ? 3.5 + hsh * (L * 5) * (1 - d / size / 1.4) : 3;
          ctx.fillStyle = L >= 3 ? `rgb(${120 + hsh * 50},${130 + hsh * 40},${150 + hsh * 30})` : "#b58a5a";
          ctx.fillRect(bx - bw / 2, by - bh, bw, bh);
          if (L < 3) { ctx.fillStyle = "#7a3b2a"; ctx.beginPath(); ctx.moveTo(bx - bw / 2 - 0.5, by - bh); ctx.lineTo(bx, by - bh - 2); ctx.lineTo(bx + bw / 2 + 0.5, by - bh); ctx.fill(); }
          else if (night > 0.3 && hsh > 0.3) { ctx.fillStyle = `rgba(255,230,140,${night})`; ctx.fillRect(bx - 0.5, by - bh * 0.7, 1, 1); }
        }
        if (s.port) {
          ctx.strokeStyle = "#d8e4ff"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s.x + size + 4, s.y); ctx.lineTo(s.x + size + 4, s.y - 14); ctx.stroke();
          ctx.fillStyle = "#ff8a5c"; ctx.beginPath(); ctx.arc(s.x + size + 4, s.y - 15, 1.6, 0, TAU); ctx.fill();
        }
      }
      // townspeople walking about
      if (z > 1.3 && this.effects) {
        const people = Math.min(14, 2 + Math.floor(Math.sqrt(s.pop) * 0.7));
        ctx.fillStyle = "rgba(255,236,200,.9)";
        for (let k = 0; k < people; k++) {
          const a = time / (2200 + k * 170) + k * 1.7 + s.id, d = size * (0.6 + 0.6 * ((k * 37) % 10) / 10);
          ctx.beginPath(); ctx.arc(s.x + Math.cos(a) * d, s.y + Math.sin(a * 1.3) * d * 0.7, 0.9, 0, TAU); ctx.fill();
        }
      }
      if (z > 0.7) {
        ctx.font = `600 ${11 / z}px "IBM Plex Sans Thai", sans-serif`;
        ctx.textAlign = "center"; ctx.lineWidth = 3 / z; ctx.strokeStyle = "rgba(5,10,20,.75)"; ctx.fillStyle = "#fff4dc";
        const label = `${s.name} · ${Math.round(s.pop)}`;
        ctx.strokeText(label, s.x, s.y + size + 12 / z); ctx.fillText(label, s.x, s.y + size + 12 / z);
      }
    }
  }

  drawEffects(time) {
    if (!this.effects) return;
    const ctx = this.ctx;
    for (const e of this.sim.effects) {
      const t = 1 - e.life / e.max;
      if (e.kind === "birth") { ctx.strokeStyle = `rgba(150,255,200,${0.7 * (1 - t)})`; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1 + t * 2), 0, TAU); ctx.stroke(); }
      else if (e.kind === "kill") { ctx.fillStyle = `rgba(255,90,90,${0.75 * (1 - t)})`; for (let k = 0; k < 5; k++) { const a = k * 1.26; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * t * 9, e.y + Math.sin(a) * t * 9, 1.2, 0, TAU); ctx.fill(); } }
      else if (e.kind === "bloom") { ctx.strokeStyle = `rgba(120,255,160,${0.6 * (1 - t)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * t, 0, TAU); ctx.stroke(); }
      else if (e.kind === "meteor") {
        ctx.fillStyle = `rgba(255,170,80,${0.8 * (1 - t)})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.3 + t), 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(255,240,200,${1 - t})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.5 + t * 1.5), 0, TAU); ctx.stroke();
      } else if (e.kind === "rocket") {
        const y = e.y - t * t * 400, x = e.x + t * 40;
        ctx.strokeStyle = `rgba(255,200,140,${0.6 * (1 - t)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.quadraticCurveTo(e.x, (e.y + y) / 2, x, y); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill();
      }
    }
  }

  drawSelection(time) {
    const c = this.selected;
    if (!c || c.dead) return;
    const ctx = this.ctx, z = this.cam.zoom;
    const r = Math.max(1.4 / z, c.r * 1.25) * 2.2 + 3 / z;
    ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.5 / z; ctx.setLineDash([4 / z, 3 / z]); ctx.lineDashOffset = -time / 60 / z;
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 1 / z;
    ctx.beginPath(); ctx.arc(c.x, c.y, c.g.sense * (1 + c.g.intellect * 0.5), 0, TAU); ctx.stroke();
    if (c.mode === 2 && c.prey && !c.prey.dead) { ctx.strokeStyle = "rgba(255,120,120,.7)"; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.prey.x, c.prey.y); ctx.stroke(); }
    else if (c.mode !== 0) { ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.tx, c.ty); ctx.stroke(); }
  }

  /** Minimap thumbnail of the whole planet (used in the side panel). */
  drawMinimap(canvas) {
    const ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
    ctx.drawImage(this.tex, 0, 0, W, H);
    const sx = W / WORLD_W, sy = H / WORLD_H;
    ctx.fillStyle = "rgba(255,255,255,.75)";
    for (let k = 0; k < this.sim.creatures.length; k += 3) { const c = this.sim.creatures[k]; ctx.fillRect(c.x * sx, c.y * sy, 1, 1); }
    ctx.fillStyle = "#ffcf6a"; for (const s of this.sim.settlements) ctx.fillRect(s.x * sx - 1, s.y * sy - 1, 3, 3);
    const v = this.view();
    ctx.strokeStyle = "#76e4ba"; ctx.lineWidth = 1.5;
    ctx.strokeRect(Math.max(0, v.x0 + 10) * sx, Math.max(0, v.y0 + 10) * sy, (Math.min(WORLD_W, v.x1 - 10) - Math.max(0, v.x0 + 10)) * sx, (Math.min(WORLD_H, v.y1 - 10) - Math.max(0, v.y0 + 10)) * sy);
  }
}
