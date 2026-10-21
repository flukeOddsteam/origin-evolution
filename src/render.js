// Canvas renderer: terrain, plants, organisms drawn procedurally from their genes, settlements and effects.
import { WORLD_W, WORLD_H, CELL, GW, GH, T } from "./sim/world.js";
import { tierOf } from "./sim/genes.js";

const TEX_W = 640, TEX_H = 360;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
function hsl(h, s, l, a = 1) { return `hsla(${h | 0},${s | 0}%,${l | 0}%,${a})`; }

export class Renderer {
  constructor(canvas, sim) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.tex = document.createElement("canvas");
    this.tex.width = TEX_W; this.tex.height = TEX_H;
    this.tctx = this.tex.getContext("2d");
    this.img = this.tctx.createImageData(TEX_W, TEX_H);
    this.cam = { x: WORLD_W / 2, y: WORLD_H / 2, zoom: 1 };
    this.frame = 0; this.texAge = 999;
    this.selected = null; this.follow = false; this.hoverSettlement = null;
    this.effects = true;
    this.setSim(sim);
    this.resize();
  }

  setSim(sim) { this.sim = sim; this.texAge = 999; }

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

  buildTexture(rowStart = 0, rowEnd = TEX_H) {
    const t0 = performance.now();
    const w = this.sim.world, d = this.img.data;
    const sx = GW / TEX_W, sy = GH / TEX_H;
    const sea = w.sea;
    for (let py = rowStart; py < rowEnd; py++) {
      const gy = (py + 0.5) * sy - 0.5, y0 = clamp(Math.floor(gy), 0, GH - 1), y1 = Math.min(GH - 1, y0 + 1), fy = clamp(gy - y0, 0, 1);
      for (let px = 0; px < TEX_W; px++) {
        const gx = (px + 0.5) * sx - 0.5, x0 = clamp(Math.floor(gx), 0, GW - 1), x1 = Math.min(GW - 1, x0 + 1), fx = clamp(gx - x0, 0, 1);
        const i00 = y0 * GW + x0, i10 = y0 * GW + x1, i01 = y1 * GW + x0, i11 = y1 * GW + x1;
        const bl = (a) => mix(mix(a[i00], a[i10], fx), mix(a[i01], a[i11], fx), fy);
        const h = bl(w.height), t = bl(w.temp), bio = bl(w.bio), green = bl(w.green);
        const near = fx < 0.5 ? (fy < 0.5 ? i00 : i01) : (fy < 0.5 ? i10 : i11);
        const farm = w.farm[near];
        let r, g, b;
        if (h < sea) {
          const depth = clamp((sea - h) / 0.25, 0, 1);
          r = mix(28, 8, depth); g = mix(96, 30, depth); b = mix(122, 64, depth);
          const plank = clamp(bio, 0, 1.2);
          r += plank * 6; g += plank * 34; b -= plank * 10;
          if (t < 0.1) { const ice = clamp((0.1 - t) / 0.08, 0, 1); r = mix(r, 214, ice); g = mix(g, 232, ice); b = mix(b, 245, ice); }
        } else {
          const e = clamp((h - sea) / 0.3, 0, 1);
          // barren rock → beach sand at the coast → mountains
          r = mix(118, 104, e); g = mix(102, 96, e); b = mix(80, 92, e);
          if (h < sea + 0.012) { r = 176; g = 160; b = 112; }
          if (e > 0.62) { const m = (e - 0.62) / 0.38; r = mix(r, 150, m); g = mix(g, 150, m); b = mix(b, 160, m); }
          const veg = clamp(green * (0.5 + 0.5 * Math.min(1, bio * 1.8)), 0, 1);
          const dry = clamp((t - 0.78) / 0.2, 0, 1);
          r = mix(r, mix(46, 150, dry), veg); g = mix(g, mix(118, 134, dry), veg); b = mix(b, mix(58, 70, dry), veg);
          if (farm) { r = mix(r, 196, 0.75); g = mix(g, 168, 0.75); b = mix(b, 72, 0.75); if ((px + py) % 5 === 0) { r -= 14; g -= 12; b -= 6; } }
          if (t < 0.12) { const snow = clamp((0.12 - t) / 0.08, 0, 1); r = mix(r, 232, snow); g = mix(g, 240, snow); b = mix(b, 250, snow); }
          // relief shading from the height slope
          const hx = this.hAt(gx + 0.35, gy - 0.35) - this.hAt(gx - 0.35, gy + 0.35);
          const shade = clamp(1 + hx * 5, 0.8, 1.18);
          r *= shade; g *= shade; b *= shade;
        }
        const o = (py * TEX_W + px) * 4;
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
      }
    }
    this.tctx.putImageData(this.img, 0, 0, 0, rowStart, TEX_W, rowEnd - rowStart);
    this.texAge = 0;
    this.texMs = performance.now() - t0;
  }

  // ------------------------------------------------------------ main draw
  draw(time) {
    const ctx = this.ctx, sim = this.sim, z = this.cam.zoom, dpr = this.dpr;
    this.frame++;
    // terrain is rebuilt a band of rows per frame so it never causes a hitch
    if (this.texAge > 900) { this.buildTexture(); this.texRow = 0; }
    else { const r0 = this.texRow || 0, r1 = Math.min(TEX_H, r0 + 18); this.buildTexture(r0, r1); this.texRow = r1 >= TEX_H ? 0 : r1; }
    if (this.follow && this.selected && !this.selected.dead) { this.cam.x = this.selected.x; this.cam.y = this.selected.y; this.clampCam(); }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#050a14"; ctx.fillRect(0, 0, this.w, this.h);
    ctx.setTransform(z * dpr, 0, 0, z * dpr, (this.w / 2 - this.cam.x * z) * dpr, (this.h / 2 - this.cam.y * z) * dpr);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(this.tex, 0, 0, WORLD_W, WORLD_H);

    const v = this.view();
    if (z > 1.3) this.drawPlants(v, time);
    this.drawWater(v, time);
    this.drawCivilization(v, time);
    this.drawCreatures(v, time);
    this.drawEffects(time);
    this.drawSelection(time);
    if (sim.climate.pollution > 0.04) {
      ctx.fillStyle = `rgba(120,110,90,${clamp(sim.climate.pollution * 0.6, 0, 0.22)})`;
      ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    }
  }

  view() {
    const z = this.cam.zoom, hw = this.w / 2 / z, hh = this.h / 2 / z;
    return { x0: this.cam.x - hw - 10, x1: this.cam.x + hw + 10, y0: this.cam.y - hh - 10, y1: this.cam.y + hh + 10 };
  }

  drawWater(v, time) {
    if (!this.effects || this.cam.zoom < 0.9) return;
    const ctx = this.ctx, w = this.sim.world;
    ctx.strokeStyle = "rgba(180,230,255,0.07)"; ctx.lineWidth = 1 / this.cam.zoom;
    ctx.beginPath();
    const cx0 = Math.max(0, (v.x0 / CELL) | 0), cx1 = Math.min(GW - 1, (v.x1 / CELL) | 0), cy0 = Math.max(0, (v.y0 / CELL) | 0), cy1 = Math.min(GH - 1, (v.y1 / CELL) | 0);
    for (let cy = cy0; cy <= cy1; cy += 2) for (let cx = cx0; cx <= cx1; cx += 2) {
      const i = cy * GW + cx;
      if (!w.isWater(i) || w.temp[i] < 0.1) continue;
      const x = cx * CELL + ((cx * 7 + cy * 13) % 20), y = cy * CELL + ((cx * 11 + cy * 5) % 20) + Math.sin(time / 900 + cx + cy) * 2;
      ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4, y - 2, x + 8, y);
    }
    ctx.stroke();
  }

  drawPlants(v, time) {
    const ctx = this.ctx, w = this.sim.world;
    const cx0 = Math.max(0, (v.x0 / CELL) | 0), cx1 = Math.min(GW - 1, (v.x1 / CELL) | 0), cy0 = Math.max(0, (v.y0 / CELL) | 0), cy1 = Math.min(GH - 1, (v.y1 / CELL) | 0);
    const water = new Path2D(), leaf = new Path2D(), trunk = new Path2D(), crop = new Path2D();
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const i = cy * GW + cx, b = w.bio[i];
      if (b < 0.15) continue;
      const n = Math.min(4, Math.ceil(b * 3));
      for (let k = 0; k < n; k++) {
        const hsh = (cx * 73856093) ^ (cy * 19349663) ^ (k * 83492791);
        const ox = ((hsh >>> 0) % 997) / 997 * CELL, oy = ((hsh >>> 10) % 991) / 991 * CELL;
        const x = cx * CELL + ox, y = cy * CELL + oy;
        if (w.isWater(i)) {
          if (w.temp[i] < 0.1) continue;
          const s = 0.6 + b * 0.8;
          water.moveTo(x + s, y); water.arc(x, y + Math.sin(time / 700 + hsh) * 0.6, s, 0, TAU);
        } else if (w.farm[i]) {
          crop.moveTo(x, y); crop.lineTo(x, y - 2.4 - b);
        } else if (w.green[i] > 0.2 && w.temp[i] >= 0.12) {
          const s = 1.2 + Math.min(b, 1.2) * 2.4;
          if (k % 2 === 0) { trunk.moveTo(x, y); trunk.lineTo(x, y - s * 0.6); leaf.moveTo(x + s, y - s); leaf.arc(x, y - s, s, 0, TAU); }
          else { leaf.moveTo(x - s * 0.6, y); leaf.lineTo(x, y - s * 1.3); leaf.lineTo(x + s * 0.6, y); }
        }
      }
    }
    ctx.fillStyle = "rgba(120,220,170,0.55)"; ctx.fill(water);
    ctx.strokeStyle = "rgba(70,50,30,0.8)"; ctx.lineWidth = 0.7; ctx.stroke(trunk);
    ctx.fillStyle = "rgba(48,140,70,0.85)"; ctx.fill(leaf);
    ctx.strokeStyle = "rgba(240,210,110,0.9)"; ctx.lineWidth = 0.6; ctx.stroke(crop);
  }

  drawCreatures(v, time) {
    const ctx = this.ctx, z = this.cam.zoom, sim = this.sim;
    const minR = 1.4 / z;
    const detail = z > 1.1 && this.effects;
    for (const c of sim.creatures) {
      if (c.x < v.x0 || c.x > v.x1 || c.y < v.y0 || c.y > v.y1) continue;
      const sp = sim.species.get(c.sp);
      const r = Math.max(minR, c.r * 1.25);
      const g = c.g;
      const light = 50 + g.intellect * 12 + (c.e / c.maxE) * 12;
      const col = hsl(g.hue, 62, light);
      if (!detail || r * z < 3.2) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.fill();
        if (c.hunter && r * z > 1.6) { ctx.strokeStyle = "rgba(255,120,120,.8)"; ctx.lineWidth = 0.6 / z; ctx.stroke(); }
        continue;
      }
      const tier = tierOf(g, sp?.sapient);
      const ph = time / 140 + c.id;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(tier === "sapient" ? 0 : c.a);
      if (tier === "cell") this.drawCell(ctx, r, g, col, ph);
      else if (tier === "colony") this.drawColony(ctx, r, g, col, ph);
      else if (tier === "swimmer") this.drawSwimmer(ctx, r, g, col, ph, c.hunter);
      else if (tier === "amphibian" || tier === "land") this.drawWalker(ctx, r, g, col, ph, c.hunter, tier === "amphibian");
      else this.drawPerson(ctx, r, g, col, ph, c);
      ctx.restore();
    }
  }

  drawCell(ctx, r, g, col, ph) {
    const wob = 1 + Math.sin(ph) * 0.06;
    ctx.fillStyle = col; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(0, 0, r * wob, r / wob, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = r * 0.16; ctx.stroke();
    ctx.fillStyle = "rgba(20,30,50,.55)"; ctx.beginPath(); ctx.arc(r * 0.15, 0, r * 0.33, 0, TAU); ctx.fill();
    if (g.diet >= 0.38) { ctx.strokeStyle = "rgba(255,140,140,.9)"; ctx.lineWidth = r * 0.14; for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + ph * 0.2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35); ctx.stroke(); } }
    // flagellum
    ctx.strokeStyle = col; ctx.lineWidth = r * 0.14; ctx.beginPath(); ctx.moveTo(-r, 0);
    ctx.quadraticCurveTo(-r * 1.6, Math.sin(ph * 2) * r * 0.6, -r * 2.1, 0); ctx.stroke();
  }

  drawColony(ctx, r, g, col, ph) {
    const n = 3 + Math.round(g.form * 8);
    ctx.fillStyle = col;
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU + ph * 0.1, d = r * 0.55;
      ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.5, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = r * 0.1; ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, TAU); ctx.stroke();
    if (g.diet >= 0.38) { ctx.fillStyle = "rgba(255,120,120,.9)"; ctx.beginPath(); ctx.arc(r * 0.9, 0, r * 0.3, 0, TAU); ctx.fill(); }
  }

  drawSwimmer(ctx, r, g, col, ph, hunter) {
    const len = r * (1.5 + g.speed * 0.25), wid = r * 0.75, tail = Math.sin(ph * (1.5 + g.speed)) * 0.5;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(-len * 0.8, 0); ctx.lineTo(-len * 1.35, wid * (0.8 + tail)); ctx.lineTo(-len * 1.35, -wid * (0.8 - tail)); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, len, wid, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.beginPath(); ctx.ellipse(0, -wid * 0.3, len * 0.7, wid * 0.35, 0, 0, TAU); ctx.fill();
    if (g.form > 0.6) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-len * 0.1, -wid); ctx.lineTo(-len * 0.45, -wid * 1.7); ctx.lineTo(-len * 0.5, -wid * 0.8); ctx.fill(); }
    this.eye(ctx, len * 0.6, -wid * 0.35, r * 0.22);
    if (hunter) { ctx.strokeStyle = "rgba(255,235,235,.95)"; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.moveTo(len * 0.95, -wid * 0.25); ctx.lineTo(len * 1.25, 0); ctx.lineTo(len * 0.95, wid * 0.25); ctx.stroke(); }
  }

  drawWalker(ctx, r, g, col, ph, hunter, amphibian) {
    const len = r * 1.35, wid = r * 0.72, step = Math.sin(ph * (1.2 + g.speed));
    ctx.strokeStyle = hsl(g.hue, 40, 30); ctx.lineWidth = r * 0.24; ctx.lineCap = "round";
    for (const [lx, side] of [[len * 0.5, 1], [len * 0.5, -1], [-len * 0.5, 1], [-len * 0.5, -1]]) {
      const sw = step * (lx > 0 ? 1 : -1) * side * r * 0.45;
      ctx.beginPath(); ctx.moveTo(lx, side * wid * 0.6); ctx.lineTo(lx + sw, side * wid * 1.45); ctx.stroke();
    }
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(-len * 0.9, 0); ctx.quadraticCurveTo(-len * 1.6, step * r * 0.4, -len * (amphibian ? 1.7 : 1.9), step * r * 0.2); ctx.lineWidth = r * (amphibian ? 0.4 : 0.22); ctx.strokeStyle = col; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, len, wid, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(len * 1.05, 0, r * 0.55, r * 0.45, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(-len * 0.1, wid * 0.25, len * 0.7, wid * 0.4, 0, 0, TAU); ctx.fill();
    this.eye(ctx, len * 1.2, -r * 0.18, r * 0.17);
    if (hunter) { ctx.fillStyle = "rgba(255,240,240,.95)"; ctx.beginPath(); ctx.moveTo(len * 1.5, -r * 0.12); ctx.lineTo(len * 1.75, 0); ctx.lineTo(len * 1.5, r * 0.12); ctx.fill(); }
  }

  drawPerson(ctx, r, g, col, ph, c) {
    const s = r * 1.1, walk = Math.sin(ph * 1.6) * (c.mode === 0 || c.mode === 4 ? 1 : 0.3);
    ctx.strokeStyle = hsl(g.hue, 45, 35); ctx.lineWidth = s * 0.22; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, s * 0.2); ctx.lineTo(-walk * s * 0.35, s); ctx.moveTo(0, s * 0.2); ctx.lineTo(walk * s * 0.35, s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -s * 0.4); ctx.lineTo(walk * s * 0.4, s * 0.15); ctx.moveTo(0, -s * 0.4); ctx.lineTo(-walk * s * 0.4, s * 0.15); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -s * 0.15, s * 0.32, s * 0.48, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = hsl(30, 45, 70); ctx.beginPath(); ctx.arc(0, -s * 0.85, s * 0.3, 0, TAU); ctx.fill();
    if (c.mode === 4) { ctx.strokeStyle = "rgba(160,110,60,.9)"; ctx.lineWidth = s * 0.12; ctx.beginPath(); ctx.moveTo(s * 0.4, -s * 0.9); ctx.lineTo(s * 0.4, s); ctx.stroke(); }
  }

  eye(ctx, x, y, r) {
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = "#0b1020"; ctx.beginPath(); ctx.arc(x + r * 0.25, y, r * 0.55, 0, TAU); ctx.fill();
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
