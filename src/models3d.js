// 3D body plans. Each model is a list of parts built from a handful of shared primitives so every
// creature on screen can be drawn with GPU instancing. Animals are assembled by small anatomy
// builders (quadruped, biped, reptile, fish, bird…) so proportions stay consistent and believable.
// Local space: +X forward, +Y up, +Z to the creature's right; 1 unit = creature radius; ground at y = 0.
//
// part = { g, c, px,py,pz, sx,sy,sz, rx,ry,rz, anim, pivot, knee?, pat? }
//   g      geometry: sph (smooth ellipsoid), ico (faceted), cone, cyl, tcyl (tapered limb), box, tet, torus, ring (thin band)
//   c      colour: b base · d dark · l light/belly · e eye · w ivory · k black · s skin · c clothes · h hair · or a hex number
//   anim   legA/legB (stride), armA/armB, tail, tailV, wingL/wingR, sway, trunk, head, seg0..seg9 (wriggle), flapL/flapR
//   pivot  "y" rotate about the top end, "x" about the base end (tails, necks), "z+"/"z-" about the inner side
//   knee   for a lower leg: length of the upper leg it hangs from, so it follows the swing and bends
//   pat    only drawn for species with that coat pattern (1 stripes, 2 spots, 3 dark saddle)

const PI = Math.PI, H = PI / 2;
const P = (g, c, px, py, pz, sx, sy, sz, rx = 0, ry = 0, rz = 0, anim = null, pivot = null, extra = null) =>
  Object.assign({ g, c, px, py, pz, sx, sy, sz, rx, ry, rz, anim, pivot }, extra);
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

const eyes = (x, y, z, s = 0.06) => [P("sph", "e", x, y, z, s, s, s), P("sph", "e", x, y, -z, s, s, s)];
/** A cylinder from point a to point b in the x-y plane (z offset zz). */
function seg(g, c, ax, ay, bx, by, w, zz = 0, anim = null, extra = null) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy), rz = Math.atan2(dx, dy) * -1;
  return P(g, c, (ax + bx) / 2, (ay + by) / 2, zz, w, L / 2, w, 0, 0, rz, anim, null, extra);
}
/** A jointed leg: thick upper limb from the hip, thinner lower limb that follows it and bends at the knee. */
function leg(x, top, z, len, w, anim, col = "b", low = "d", upperFrac = 0.48) {
  const L1 = len * upperFrac, L2 = len - L1;
  return [
    P("tcyl", col, x, top, z, w, L1 / 2, w, 0, 0, 0, anim, "y"),
    P("tcyl", low, x, top - L1, z, w * 0.62, L2 / 2, w * 0.62, 0, 0, 0, anim, "y", { knee: L1 }),
  ];
}
/** Coat patterns wrapped round an ellipsoid body (x half-length a, height b, width c centred at x0, y0). */
function coat(pats, x0, y0, a, b, c, seed = 1, col = "k") {
  const out = [];
  const cross = (x) => Math.sqrt(Math.max(0.05, 1 - ((x - x0) / a) ** 2));
  if (pats.includes(1)) for (let k = 0; k < 9; k++) {
    const x = x0 + (k / 8 - 0.5) * a * 1.55, f = cross(x);
    out.push(P("ring", col, x, y0, 0, c * f * 0.985, b * f * 0.985, 0.45 + hash(k, seed) * 0.45, 0, H, 0, null, null, { pat: 1 }));
  }
  if (pats.includes(2)) for (let k = 0; k < 18; k++) {
    const x = x0 + (hash(k, seed + 3) - 0.5) * a * 1.6, f = cross(x), phi = (hash(k, seed + 7) - 0.5) * 2.4;
    const s = (0.045 + hash(k, seed + 11) * 0.04) * Math.min(1.1, Math.max(0.6, b * 1.6));
    out.push(P("sph", col, x, y0 + Math.cos(phi) * b * f * 0.97, Math.sin(phi) * c * f * 0.97, s * 1.3, s * 0.5, s, phi, 0, 0, null, null, { pat: 2 }));
  }
  if (pats.includes(3)) out.push(P("sph", "d", x0 - a * 0.05, y0 + b * 0.32, 0, a * 0.8, b * 0.72, c * 0.86, 0, 0, 0, null, null, { pat: 3 }));
  return out;
}

// ------------------------------------------------------------------ four-legged animals
/**
 * o: len (half body length), bh/bw (half height / width), legH, lw (leg width), neck [length, elevation, width],
 *    head [hl, hh, hw], snout [sl, sh, sw] or null, nose, ears ("pointy"|"round"|"long"|"none"), earS,
 *    tail ("thin"|"bushy"|"tuft"|"stub"|"none"), tailL, pats (allowed coat patterns), hump, mane, belly, lowCol
 */
function quad(o) {
  const len = o.len ?? 1, bh = o.bh ?? 0.45, bw = o.bw ?? 0.42, legH = o.legH ?? 0.8, lw = o.lw ?? 0.11;
  const ty = legH + bh * 0.55, parts = [];
  const top = ty - bh * 0.15;
  for (const [x, z, a] of [[len * 0.58, bw * 0.55, "legA"], [len * 0.58, -bw * 0.55, "legB"], [-len * 0.55, bw * 0.55, "legB"], [-len * 0.55, -bw * 0.55, "legA"]])
    parts.push(...leg(x, top, z, top - (o.paw ? 0.02 : 0), x > 0 ? lw : lw * 1.12, a, "b", o.lowCol || "d", o.upper ?? 0.48));
  parts.push(
    P("sph", "b", 0, ty, 0, len, bh, bw),
    P("sph", "b", len * 0.48, ty + bh * 0.14, 0, len * 0.5, bh * 0.92, bw * 0.96),
    P("sph", "b", -len * 0.5, ty + bh * 0.1, 0, len * 0.46, bh * 0.9, bw * 0.98),
  );
  if (o.belly !== false) parts.push(P("sph", "l", 0, ty - bh * 0.42, 0, len * 0.78, bh * 0.5, bw * 0.82));
  if (o.hump) parts.push(P("sph", "b", len * (o.humpX ?? 0.05), ty + bh * 0.85, 0, len * 0.42, bh * o.hump, bw * 0.7));
  const cp = coat(o.pats || [], 0, ty + bh * 0.04, len * 1.02, bh * 1.04, bw * 1.04, o.seed || 1, o.patCol || "k");
  if (o.patAlways) for (const p of cp) p.pat = 0;
  parts.push(...cp);
  // neck & head
  const [nl, ne, nw] = o.neck || [0.5, 0.75, 0.16];
  const nx = len * 0.82, ny = ty + bh * 0.35, ex = nx + Math.cos(ne) * nl, ey = ny + Math.sin(ne) * nl;
  parts.push(P("cyl", "b", (nx + ex) / 2, (ny + ey) / 2, 0, nw, nl / 2 + nw * 0.6, nw * 0.9, 0, 0, -(H - ne), "head", null));
  if (o.mane) parts.push(P("box", o.mane, (nx + ex) / 2 - nw * 0.4, (ny + ey) / 2 + nw * 0.55, 0, nl * 0.48, nw * 0.35, nw * 0.25, 0, 0, -(H - ne) + H, "head"));
  const [hl, hh, hw] = o.head || [0.32, 0.2, 0.18];
  const hx = ex + hl * 0.35, hy = ey + hh * 0.1;
  parts.push(P("sph", "b", hx, hy, 0, hl, hh, hw, 0, 0, -0.2, "head"));
  if (o.snout !== null) {
    const [sl, sh, sw] = o.snout || [hl * 0.55, hh * 0.65, hw * 0.7];
    const sx = hx + hl * 0.78, sy = hy - hh * 0.32;
    parts.push(P("sph", o.snoutCol || "b", sx, sy, 0, sl, sh, sw, 0, 0, -0.15, "head"));
    if (o.nose !== false) parts.push(P("sph", "k", sx + sl * 0.92, sy + sh * 0.15, 0, 0.045 + sw * 0.25, 0.04 + sh * 0.2, sw * 0.6, 0, 0, 0, "head"));
  }
  parts.push(...eyes(hx + hl * 0.4, hy + hh * 0.38, hw * 0.78, Math.max(0.035, hh * 0.18)).map((p) => ((p.anim = "head"), p)));
  const es = o.earS ?? 0.12, earX = hx - hl * 0.35, earY = hy + hh * 0.85;
  if (o.ears === "pointy") for (const s of [1, -1]) parts.push(P("cone", "d", earX, earY + es * 0.6, s * hw * 0.55, es * 0.45, es, es * 0.2, s * 0.35, 0, 0, "head"));
  else if (o.ears === "round") for (const s of [1, -1]) parts.push(P("sph", "d", earX, earY, s * hw * 0.7, es * 0.4, es * 0.7, es * 0.7, s * 0.3, 0, 0, "head"));
  else if (o.ears === "long") for (const s of [1, -1]) parts.push(P("sph", "b", earX - es * 0.2, earY + es * 1.3, s * hw * 0.35, es * 0.35, es * 1.6, es * 0.5, s * 0.15, 0, 0.25, "head"));
  else if (o.ears === "side") for (const s of [1, -1]) parts.push(P("sph", "d", earX + hl * 0.1, earY - hh * 0.2, s * hw * 1.05, es * 0.5, es * 0.35, es, s * 0.6, 0, 0, "head"));
  if (o.horns) parts.push(...o.horns(hx, hy, hl, hh, hw));
  // tail
  const tl = o.tailL ?? 0.6, tx = -len * 0.98, tyy = ty + bh * 0.35, droop = o.tailDroop ?? 0.9;
  if (o.tail === "thin") parts.push(P("cyl", "d", tx, tyy, 0, 0.035, tl / 2, 0.035, 0, 0, H + droop, "tail", "x"));
  else if (o.tail === "tuft") parts.push(P("cyl", "b", tx, tyy, 0, 0.03, tl / 2, 0.03, 0, 0, H + droop, "tail", "x"), P("cone", "k", tx, tyy, 0, 0.06, tl * 0.18, 0.06, 0, 0, H + droop, "tail", "x", { off: tl }));
  else if (o.tail === "bushy") parts.push(P("sph", "d", tx, tyy, 0, tl * 0.18, tl * 0.5, tl * 0.18, 0, 0, H + droop, "tail", "x"));
  else if (o.tail === "stub") parts.push(P("sph", "l", tx + 0.05, tyy, 0, 0.12, 0.12, 0.12));
  else if (o.tail === "long") parts.push(P("tcyl", "b", tx, tyy, 0, 0.07, tl / 2, 0.07, 0, 0, H + droop, "tail", "x"));
  return parts;
}

// ------------------------------------------------------------------ reptiles (sprawling legs)
function reptile(o) {
  const len = o.len ?? 1, bh = o.bh ?? 0.28, bw = o.bw ?? 0.4, ty = o.ty ?? 0.32, parts = [];
  for (const [x, s, a] of [[len * 0.5, 1, "legA"], [len * 0.5, -1, "legB"], [-len * 0.5, 1, "legB"], [-len * 0.5, -1, "legA"]]) {
    const lw = o.lw ?? 0.09, reach = o.reach ?? 0.42;
    parts.push(P("tcyl", "b", x, ty - bh * 0.1, s * bw * 0.7, lw, reach / 2, lw, s * H * 1.08, 0, 0, a, s > 0 ? "z+" : "z-"));
    parts.push(P("tcyl", "d", x + 0.04, ty * 0.45, s * (bw * 0.7 + reach * 0.92), lw * 0.7, ty * 0.45, lw * 0.7, 0, 0, 0, a, null));
  }
  parts.push(P("sph", "b", 0, ty, 0, len, bh, bw), P("sph", "l", 0, ty - bh * 0.4, 0, len * 0.85, bh * 0.5, bw * 0.85));
  parts.push(...coat(o.pats || [], 0, ty, len, bh, bw, o.seed || 2, o.patCol || "d"));
  if (o.scutes) for (let k = 0; k < 7; k++) parts.push(P("cone", "d", len * (0.7 - k * 0.22), ty + bh * 0.9, 0, 0.07, 0.08, 0.05));
  // tail: two tapered segments that wave
  const tl = o.tailL ?? 1.6, tw = o.tailW ?? bw * 0.55;
  parts.push(P("cone", "b", -len * 0.85, ty, 0, tw, tl / 2, tw * 0.85, 0, 0, H + 0.08, "tail", "x"));
  // head
  const [hl, hh, hw] = o.head || [0.45, 0.2, 0.26], hx = len * 0.95 + hl * 0.6, hy = ty + bh * 0.25;
  parts.push(P("sph", "b", len * 0.85, ty + bh * 0.1, 0, 0.3, bh * 0.85, bw * 0.7)); // neck
  parts.push(P("sph", "b", hx, hy, 0, hl, hh, hw, 0, 0, -0.05, "head"));
  if (o.snout) parts.push(P("box", "b", hx + hl * 0.9, hy - hh * 0.25, 0, o.snout, hh * 0.45, hw * 0.55, 0, 0, 0, "head"), P("box", "w", hx + hl * 0.9, hy - hh * 0.55, 0, o.snout * 0.95, 0.02, hw * 0.58, 0, 0, 0, "head"));
  parts.push(...eyes(hx + hl * 0.35, hy + hh * 0.55, hw * 0.65, 0.05));
  if (o.tongue) parts.push(P("box", 0xc8324b, hx + hl * 1.25, hy - hh * 0.2, 0, 0.18, 0.01, 0.02, 0, 0, 0, "sway"));
  return parts;
}

// ------------------------------------------------------------------ fish
function fish(o) {
  const len = o.len ?? 1.3, bh = o.bh ?? 0.6, bw = o.bw ?? 0.38, parts = [];
  parts.push(P("sph", "b", 0, 0, 0, len, bh, bw), P("sph", "l", len * 0.08, -bh * 0.4, 0, len * 0.85, bh * 0.55, bw * 0.92));
  parts.push(...coat(o.pats || [], 0, 0, len, bh, bw, o.seed || 3, o.patCol || "d"));
  // caudal fin: two lobes
  const tf = o.tail ?? 0.55;
  parts.push(P("cone", "d", -len * 0.92, 0, 0, tf * 0.6, tf * 0.7, 0.05, 0, 0, H + 0.6, "tail", "x"), P("cone", "d", -len * 0.92, 0, 0, tf * 0.6, tf * 0.7, 0.05, 0, 0, H - 0.6, "tail", "x"));
  if (o.dorsal !== false) parts.push(P("cone", "d", -len * 0.05, bh * 0.85, 0, (o.dorsal ?? 0.35) * 0.9, o.dorsal ?? 0.35, 0.04, 0, 0, 0.55));
  parts.push(P("cone", "d", len * 0.35, -bh * 0.35, bw * 0.9, 0.18, 0.25, 0.03, 0.6, 0, 1.9, "sway"), P("cone", "d", len * 0.35, -bh * 0.35, -bw * 0.9, 0.18, 0.25, 0.03, -0.6, 0, 1.9, "sway"));
  parts.push(P("cone", "d", -len * 0.45, -bh * 0.8, 0, 0.18, 0.2, 0.03, 0, 0, 2.6));
  parts.push(...eyes(len * 0.68, bh * 0.2, bw * 0.62, o.eye ?? 0.1));
  if (o.teeth) parts.push(P("box", "w", len * 0.92, -bh * 0.15, 0, 0.12, 0.02, bw * 0.4));
  return parts;
}

// ------------------------------------------------------------------ birds
function flyingBird(o) {
  const parts = [], s = o.span ?? 1.2, bl = o.len ?? 0.62;
  parts.push(P("sph", "b", 0, 0, 0, bl, 0.34, 0.33), P("sph", "l", 0.08, -0.12, 0, bl * 0.8, 0.22, 0.28));
  parts.push(P("sph", o.headCol || "b", bl * 0.95, 0.15, 0, 0.27, 0.25, 0.23), P("cone", o.beakCol ?? 0xe8a33c, bl * 0.95 + 0.3, 0.1, 0, 0.07, o.beakL ?? 0.16, 0.07, 0, 0, -H - (o.beakHook ?? 0)));
  for (const side of [1, -1]) {
    const wa = side > 0 ? "wingL" : "wingR", piv = side > 0 ? "z+" : "z-";
    parts.push(P("box", "b", 0.05, 0.08, side * 0.2, 0.3, 0.03, s * 0.3, 0, side * 0.08, 0, wa, piv));
    parts.push(P("box", "d", -0.02, 0.085, side * 0.2, 0.22, 0.022, s * 0.26, 0, side * 0.3, 0, wa, piv, { off: s * 0.55 }));
    parts.push(P("box", "l", 0.12, 0.1, side * 0.2, 0.12, 0.025, s * 0.28, 0, side * 0.05, 0, wa, piv));
  }
  parts.push(P("box", "d", -bl - 0.2, 0.04, 0, 0.3, 0.025, o.tailW ?? 0.22, 0, 0, 0.1, "tailV", "x"));
  parts.push(...eyes(bl * 0.95 + 0.12, 0.24, 0.16, 0.045));
  return parts;
}
/** Long-legged birds that walk: herons, flamingos, ostriches, penguins. */
function standingBird(o) {
  const parts = [], legH = o.legH ?? 1.2, bl = o.len ?? 0.6, bh = o.bh ?? 0.42, by = legH + bh * 0.5;
  for (const [z, a] of [[0.14, "legA"], [-0.14, "legB"]]) parts.push(...leg(0, by - bh * 0.2, z, by - bh * 0.2, o.lw ?? 0.05, a, o.legCol ?? 0xc98a5a, o.legCol ?? 0xc98a5a, 0.5));
  parts.push(P("sph", "b", 0, by, 0, bl, bh, bh * 0.85, 0, 0, o.tilt ?? 0.15), P("sph", "l", 0.05, by - bh * 0.35, 0, bl * 0.8, bh * 0.55, bh * 0.7));
  if (o.wings !== false) for (const s of [1, -1]) parts.push(P("sph", "d", -bl * 0.1, by + bh * 0.1, s * bh * 0.8, bl * 0.75, bh * 0.55, 0.08, 0, s * 0.1, 0.1, o.wingAnim || null));
  const [nl, ne] = o.neck || [0.9, 1.2];
  const nx = bl * 0.75, ny = by + bh * 0.3, ex = nx + Math.cos(ne) * nl, ey = ny + Math.sin(ne) * nl;
  parts.push(seg("cyl", o.neckCol || "b", nx, ny, ex, ey, o.neckW ?? 0.09, 0, "head"));
  parts.push(P("sph", o.headCol || "b", ex + 0.05, ey, 0, 0.18, 0.15, 0.13, 0, 0, 0, "head"));
  parts.push(P("cone", o.beakCol ?? 0xe0b040, ex + 0.2 + (o.beakL ?? 0.3) * 0.9, ey - 0.03 - (o.beakDown ?? 0), 0, 0.045, o.beakL ?? 0.3, 0.045, 0, 0, -H - (o.beakBend ?? 0), "head"));
  parts.push(...eyes(ex + 0.12, ey + 0.06, 0.1, 0.035).map((p) => ((p.anim = "head"), p)));
  if (o.tailTuft) parts.push(P("sph", o.tailTuft, -bl * 0.95, by + bh * 0.2, 0, 0.25, 0.22, 0.3));
  return parts;
}

const HORNS = {
  antlers: (hx, hy, hl, hh, hw) => { const c = 0xd9c7a3, out = []; for (const s of [1, -1]) { out.push(seg("cyl", c, hx - hl * 0.2, hy + hh * 0.8, hx - hl * 0.3, hy + hh * 0.8 + 0.5, 0.025, s * hw * 0.5)); out.push(seg("cyl", c, hx - hl * 0.3, hy + hh * 0.8 + 0.25, hx + hl * 0.2, hy + hh * 0.8 + 0.5, 0.02, s * hw * 0.7)); out.push(seg("cyl", c, hx - hl * 0.3, hy + hh * 0.8 + 0.5, hx - hl * 0.7, hy + hh * 0.8 + 0.75, 0.018, s * hw * 0.9)); out.push(seg("cyl", c, hx - hl * 0.3, hy + hh * 0.8 + 0.5, hx, hy + hh * 0.8 + 0.85, 0.018, s * hw * 0.85)); } return out.map((p) => ((p.anim = "head"), p)); },
  cow: (hx, hy, hl, hh, hw) => [1, -1].map((s) => P("cone", 0xe3d6bb, hx - hl * 0.25, hy + hh * 0.75, s * hw * 1.05, 0.05, 0.22, 0.05, s * 1.25, 0, 0.3, "head")),
  rhino: (hx, hy, hl) => [P("cone", 0xcfc6b4, hx + hl * 1.25, hy + 0.05, 0, 0.09, 0.28, 0.09, 0, 0, -0.35, "head"), P("cone", 0xcfc6b4, hx + hl * 0.85, hy + 0.12, 0, 0.06, 0.14, 0.06, 0, 0, -0.2, "head")],
  ossicones: (hx, hy, hl, hh, hw) => [1, -1].map((s) => P("cyl", "d", hx - hl * 0.3, hy + hh + 0.08, s * hw * 0.4, 0.03, 0.1, 0.03, 0, 0, 0, "head")),
  tusks: (hx, hy, hl, hh, hw) => [1, -1].map((s) => P("cone", "w", hx + hl * 0.9, hy - hh * 0.45, s * hw * 0.4, 0.04, 0.12, 0.04, 0, 0, -1.2, "head")),
};

// ------------------------------------------------------------------ models
const M = {};
M.microbe = [P("sph", "b", 0, 0, 0, 1, 0.75, 0.9), P("sph", "d", 0.25, 0.2, 0, 0.35, 0.3, 0.35), P("sph", "l", -0.3, -0.2, 0.3, 0.12, 0.12, 0.12), P("cyl", "l", -1, 0, 0, 0.05, 0.6, 0.05, 0, 0, H, "tail", "x")];
M.colony = [0, 1, 2, 3, 4, 5].map((k) => P("sph", k % 2 ? "b" : "l", Math.cos(k * 1.05) * 0.6, Math.sin(k * 2.1) * 0.15, Math.sin(k * 1.05) * 0.6, 0.45, 0.45, 0.45)).concat([P("sph", "d", 0, 0.1, 0, 0.4, 0.4, 0.4)]);
M.jelly = [P("sph", "l", 0, 0.4, 0, 1, 0.55, 1), P("sph", "b", 0, 0.28, 0, 0.72, 0.32, 0.72), P("torus", "d", 0, 0.12, 0, 0.85, 0.85, 0.3, H, 0, 0)]
  .concat([0, 1, 2, 3, 4, 5, 6, 7].map((k) => P("cyl", "l", Math.cos(k * 0.785) * 0.55, -0.45, Math.sin(k * 0.785) * 0.55, 0.035, 0.85, 0.035, 0, 0, 0, "sway"))).concat([0, 1, 2, 3].map((k) => P("tcyl", "b", Math.cos(k * 1.57) * 0.18, -0.3, Math.sin(k * 1.57) * 0.18, 0.12, 0.5, 0.12, 0, 0, 0, "sway")));
M.worm = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => P("sph", k % 2 ? "b" : "d", 1 - k * 0.38, 0, 0, 0.4 - k * 0.025, 0.34 - k * 0.02, 0.4 - k * 0.025, 0, 0, 0, "seg" + k))
  .concat([0, 2, 4, 6].flatMap((k) => [1, -1].map((s) => P("cone", "l", 1 - k * 0.38, 0, s * 0.45, 0.04, 0.12, 0.04, s * H, 0, 0, "seg" + k)))).concat(eyes(1.3, 0.15, 0.15, 0.07));
M.starfish = [0, 1, 2, 3, 4].flatMap((k) => { const a = (k / 5) * PI * 2, c = Math.cos(a), s = Math.sin(a); return [P("cone", "b", c * 0.55, 0.12, s * 0.55, 0.28, 0.6, 0.13, 0, -a, -H, "sway"), ...[0.3, 0.55, 0.8].map((d) => P("sph", "l", c * d, 0.22, s * d, 0.06, 0.05, 0.06))]; })
  .concat([P("sph", "d", 0, 0.12, 0, 0.32, 0.14, 0.32)]);
M.trilobite = [P("sph", "b", 0, 0.2, 0, 1.2, 0.3, 0.9), P("sph", "l", 0.75, 0.25, 0, 0.55, 0.28, 0.9), P("sph", "d", -0.1, 0.38, 0, 1.0, 0.2, 0.28), ...eyes(0.85, 0.48, 0.4, 0.09),
  ...[-0.6, -0.3, 0, 0.3].map((x) => P("ring", "d", x, 0.24, 0, 0.88, 0.3, 1, 0, H, 0)),
  ...[-0.5, -0.1, 0.3].flatMap((x, i) => [1, -1].map((s) => P("cyl", "d", x, 0.15, s * 0.85, 0.03, 0.2, 0.03, s * (H + 0.3), 0, 0, i % 2 ? "legA" : "legB", s > 0 ? "z+" : "z-"))),
  P("cyl", "d", 1.2, 0.25, 0.25, 0.025, 0.35, 0.025, 0, 0.5, H), P("cyl", "d", 1.2, 0.25, -0.25, 0.025, 0.35, 0.025, 0, -0.5, H)];
M.crab = [P("sph", "b", 0, 0.45, 0, 1.0, 0.36, 0.85), P("sph", "l", -0.05, 0.62, 0, 0.75, 0.18, 0.62),
  ...[-0.45, -0.15, 0.15, 0.4].flatMap((x, i) => [1, -1].flatMap((s) => [P("tcyl", "d", x, 0.48, s * 0.75, 0.07, 0.25, 0.07, s * (H - 0.35), 0, 0, i % 2 ? "legA" : "legB", s > 0 ? "z+" : "z-"), P("tcyl", "d", x, 0.3, s * 1.32, 0.05, 0.3, 0.05, s * -0.45, 0, 0, i % 2 ? "legA" : "legB")])),
  ...[1, -1].flatMap((s) => [seg("tcyl", "b", 0.75, 0.45, 1.15, 0.55, 0.1, s * 0.75), P("sph", "b", 1.35, 0.55, s * 0.85, 0.38, 0.24, 0.26, 0, -s * 0.3, 0, "sway"), P("cone", "d", 1.7, 0.6, s * 0.78, 0.07, 0.22, 0.05, 0, 0, -H, "sway")]),
  P("cyl", "d", 0.85, 0.8, 0.28, 0.035, 0.15, 0.035), P("cyl", "d", 0.85, 0.8, -0.28, 0.035, 0.15, 0.035), ...eyes(0.85, 0.97, 0.28, 0.07)];
M.lobster = [P("sph", "b", 0.35, 0.35, 0, 0.75, 0.3, 0.38), ...[0, 1, 2, 3, 4].map((k) => P("sph", k % 2 ? "d" : "b", -0.45 - k * 0.27, 0.33 - k * 0.02, 0, 0.2, 0.22 - k * 0.025, 0.32 - k * 0.04, 0, 0, 0, "seg" + (k + 2))),
  P("cone", "d", -1.85, 0.25, 0, 0.3, 0.2, 0.04, H, 0, H, "tail", "x"),
  ...[1, -1].flatMap((s) => [seg("tcyl", "d", 0.9, 0.35, 1.35, 0.4, 0.07, s * 0.35), P("sph", "b", 1.75, 0.42, s * 0.42, 0.42, 0.18, 0.2, 0, -s * 0.2, 0, "sway"), P("cyl", "d", 1.1, 0.5, s * 0.12, 0.012, 0.9, 0.012, 0, s * 0.3, -1.2)]),
  ...[0.55, 0.3, 0.05, -0.2].flatMap((x, i) => [1, -1].map((s) => P("tcyl", "d", x, 0.3, s * 0.35, 0.04, 0.2, 0.04, s * (H + 0.6), 0, 0, i % 2 ? "legA" : "legB", s > 0 ? "z+" : "z-"))), ...eyes(1.05, 0.55, 0.15, 0.06)];
M.ammonite = [P("torus", "b", -0.1, 0.1, 0, 0.75, 0.75, 0.6), P("torus", "d", -0.1, 0.1, 0, 0.42, 0.42, 0.55), P("sph", "l", -0.1, 0.1, 0, 0.32, 0.32, 0.3),
  ...[0, 1, 2, 3, 4].map((k) => P("cone", "l", 0.8, 0.1 + (k - 2) * 0.12, (k % 2 - 0.5) * 0.15, 0.06, 0.45, 0.06, 0, 0, -H, "sway", "x")), ...eyes(0.68, 0.32, 0.25, 0.08)];
M.squid = [P("cone", "b", 0.25, 0, 0, 0.5, 1.05, 0.5, 0, 0, -H), P("sph", "b", -0.55, 0, 0, 0.42, 0.4, 0.4), P("cone", "d", 1.2, 0, 0, 0.45, 0.25, 0.04, H, 0, -H), ...eyes(-0.6, 0.2, 0.36, 0.13),
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => P("tcyl", "l", -0.85, Math.sin(k * 0.785) * 0.18, Math.cos(k * 0.785) * 0.18, 0.06, 0.5 + (k < 2 ? 0.3 : 0), 0.06, 0, 0, H, "tail", "x"))];
M.octopus = [P("sph", "b", -0.15, 0.75, 0, 0.6, 0.6, 0.55, 0, 0, 0.35), P("sph", "b", 0.2, 0.42, 0, 0.42, 0.35, 0.42), ...eyes(0.42, 0.55, 0.28, 0.1),
  ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((k) => { const a = (k / 8) * PI * 2 + 0.2, c = Math.cos(a), s = Math.sin(a); return [P("tcyl", k % 2 ? "b" : "d", 0.2 + c * 0.2, 0.28, s * 0.2, 0.1, 0.45, 0.1, s * 1.2, 0, -c * 1.2, "seg" + k, "y"), P("tcyl", "l", 0.2 + c * 0.75, 0.06, s * 0.75, 0.06, 0.3, 0.06, s * 1.45, 0, -c * 1.45, "seg" + k, "y")]; })];
M.fish = fish({ pats: [1, 2], len: 1.35, bh: 0.62, bw: 0.38 });
M.reeffish = fish({ pats: [1], len: 1.0, bh: 0.85, bw: 0.32, dorsal: 0.55, tail: 0.5, eye: 0.12, patCol: 0xf6f2e8 });
M.predfish = fish({ pats: [1, 2, 3], len: 1.85, bh: 0.48, bw: 0.36, dorsal: 0.32, teeth: true, eye: 0.1 });
M.eel = [...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => P("sph", "b", 1.35 - k * 0.32, 0, 0, 0.26, 0.3 - k * 0.012, 0.22 - k * 0.012, 0, 0, 0, "seg" + k)),
  ...[1, 3, 5, 7].map((k) => P("sph", "d", 1.35 - k * 0.32, 0.22, 0, 0.18, 0.1, 0.06, 0, 0, 0, "seg" + k, null, { pat: 2 })),
  P("sph", "b", 1.65, 0.02, 0, 0.32, 0.24, 0.2), P("box", "w", 1.85, -0.08, 0, 0.12, 0.015, 0.12), ...eyes(1.75, 0.13, 0.13, 0.05)];
M.ray = [P("sph", "b", 0, 0.1, 0, 0.9, 0.18, 0.7), ...[1, -1].flatMap((s) => [P("sph", "b", 0, 0.1, s * 0.3, 0.75, 1.05, 0.06, s * H, 0, 0, s > 0 ? "flapL" : "flapR", s > 0 ? "z+" : "z-"), P("sph", "l", 0, 0.05, s * 0.3, 0.6, 0.85, 0.04, s * H, 0, 0, s > 0 ? "flapL" : "flapR", s > 0 ? "z+" : "z-")]),
  P("sph", "l", 0.05, 0.0, 0, 0.75, 0.1, 0.55), P("cyl", "d", -1.6, 0.1, 0, 0.03, 0.85, 0.03, 0, 0, H, "tail", "x"), ...[1, -1].map((s) => P("box", "d", 0.9, 0.08, s * 0.25, 0.18, 0.04, 0.06, 0, s * 0.4, 0)), ...eyes(0.6, 0.25, 0.25, 0.05)];
M.shark = [P("sph", "b", 0, 0, 0, 2.0, 0.55, 0.55), P("sph", "w", 0.2, -0.24, 0, 1.65, 0.33, 0.47), P("cone", "b", 1.9, -0.02, 0, 0.42, 0.5, 0.38, 0, 0, -H),
  P("cone", "d", 0.05, 0.75, 0, 0.32, 0.5, 0.06, 0, 0, 0.45), P("cone", "d", -1.1, 0.4, 0, 0.12, 0.18, 0.04, 0, 0, 0.6),
  P("cone", "d", -1.95, 0.05, 0, 0.18, 0.75, 0.05, 0, 0, H - 0.75, "tail", "x"), P("cone", "d", -1.95, 0, 0, 0.12, 0.45, 0.05, 0, 0, H + 0.8, "tail", "x"),
  ...[1, -1].map((s) => P("cone", "d", 0.55, -0.3, s * 0.55, 0.3, 0.55, 0.05, s * 1.3, 0, 1.2)), ...[0, 1, 2, 3].flatMap((k) => [1, -1].map((s) => P("box", "d", 1.15 - k * 0.1, 0.05, s * 0.48, 0.01, 0.12, 0.01, 0, 0, 0.15))), ...eyes(1.45, 0.12, 0.38, 0.06)];
M.dolphin = [P("sph", "b", 0, 0, 0, 1.6, 0.5, 0.48), P("sph", "w", 0.25, -0.22, 0, 1.25, 0.3, 0.4), P("sph", "b", 1.45, 0.05, 0, 0.45, 0.38, 0.36), P("cone", "b", 2.0, -0.05, 0, 0.13, 0.25, 0.13, 0, 0, -H),
  P("cone", "d", -0.1, 0.6, 0, 0.3, 0.35, 0.06, 0, 0, 0.6), P("box", "d", -1.85, 0, 0, 0.2, 0.04, 0.55, 0, 0, 0, "tailV", "x"), ...[1, -1].map((s) => P("cone", "d", 0.7, -0.3, s * 0.45, 0.14, 0.32, 0.04, s * 1.0, 0, 1.6)), ...eyes(1.6, 0.08, 0.32, 0.05)];
M.whale = [P("sph", "b", 0, 0, 0, 2.2, 0.8, 0.85), P("sph", "l", 0.3, -0.38, 0, 1.75, 0.42, 0.72), P("sph", "b", 1.6, 0.05, 0, 0.75, 0.6, 0.7),
  ...[0, 1, 2, 3, 4, 5].map((k) => P("box", "w", 1.1 - k * 0.3, -0.62, 0, 0.12, 0.02, 0.5, 0, 0, 0.12)), P("box", "d", -2.35, 0, 0, 0.3, 0.06, 1.2, 0, 0, 0, "tailV", "x"),
  P("cone", "d", -1.1, 0.75, 0, 0.18, 0.15, 0.05, 0, 0, 0.5), ...[1, -1].map((s) => P("box", "d", 0.7, -0.45, s * 1.0, 0.45, 0.05, 0.42, 0, s * 0.4, -0.3)), ...eyes(1.55, -0.05, 0.68, 0.06)];
M.frog = [P("sph", "b", 0, 0.42, 0, 0.75, 0.48, 0.72, 0, 0, 0.25), P("sph", "l", 0.1, 0.28, 0, 0.6, 0.3, 0.62), P("sph", "b", 0.62, 0.62, 0, 0.42, 0.3, 0.55),
  ...coat([2], 0, 0.42, 0.75, 0.48, 0.72, 5, "d"),
  P("sph", "b", 0.72, 0.9, 0.28, 0.18, 0.18, 0.18), P("sph", "b", 0.72, 0.9, -0.28, 0.18, 0.18, 0.18), ...eyes(0.8, 0.95, 0.3, 0.12), P("box", "k", 0.98, 0.55, 0, 0.02, 0.015, 0.35),
  ...[1, -1].flatMap((s) => [P("sph", "d", -0.35, 0.38, s * 0.62, 0.42, 0.22, 0.22, 0, s * 0.5, 0, s > 0 ? "legA" : "legB"), P("tcyl", "d", -0.6, 0.12, s * 0.85, 0.08, 0.3, 0.08, 0, 0, -1.2, s > 0 ? "legA" : "legB"), P("tcyl", "d", 0.5, 0.25, s * 0.48, 0.07, 0.22, 0.07, s * 0.3, 0, 0.2)])];
M.salamander = reptile({ len: 0.95, bh: 0.22, bw: 0.3, ty: 0.25, head: [0.32, 0.15, 0.24], tailL: 1.5, tailW: 0.18, lw: 0.07, reach: 0.35, pats: [2] });
M.croc = reptile({ len: 1.25, bh: 0.3, bw: 0.55, ty: 0.32, head: [0.45, 0.17, 0.26], snout: 0.55, tailL: 1.9, tailW: 0.32, lw: 0.1, reach: 0.5, scutes: true });
M.turtle = [P("sph", "b", 0, 0.5, 0, 1.0, 0.55, 0.85), P("ico", "d", 0, 0.82, 0, 0.62, 0.25, 0.52), ...[[0.4, 0.4], [0.4, -0.4], [-0.4, 0.4], [-0.4, -0.4]].map(([x, z]) => P("ico", "d", x, 0.68, z, 0.3, 0.18, 0.28)),
  P("sph", "l", 0, 0.25, 0, 0.95, 0.12, 0.8), P("sph", "l", 1.05, 0.4, 0, 0.3, 0.24, 0.24, 0, 0, 0, "head"), P("cyl", "l", 0.85, 0.38, 0, 0.14, 0.18, 0.14, 0, 0, -1.2), ...eyes(1.22, 0.48, 0.13, 0.05),
  ...[[0.55, 1, "legA"], [0.55, -1, "legB"], [-0.55, 1, "legB"], [-0.55, -1, "legA"]].map(([x, s, a]) => P("tcyl", "l", x, 0.35, s * 0.72, 0.16, 0.18, 0.16, 0, 0, 0, a, "y")), P("cone", "l", -1.0, 0.35, 0, 0.08, 0.15, 0.08, 0, 0, H)];
M.seal = [P("sph", "b", 0, 0.35, 0, 1.05, 0.38, 0.45, 0, 0, -0.08), P("sph", "l", 0.1, 0.18, 0, 0.9, 0.22, 0.4), P("sph", "b", 0.95, 0.55, 0, 0.35, 0.32, 0.32, 0, 0, 0.3, "head"), P("sph", "l", 1.22, 0.5, 0, 0.18, 0.13, 0.17, 0, 0, 0, "head"),
  P("sph", "k", 1.38, 0.53, 0, 0.04, 0.035, 0.05, 0, 0, 0, "head"), ...eyes(1.15, 0.68, 0.17, 0.05), ...coat([2], 0, 0.35, 1.05, 0.38, 0.45, 6, "d"),
  ...[1, -1].flatMap((s) => [P("sph", "d", 0.45, 0.12, s * 0.45, 0.25, 0.05, 0.12, 0, s * 0.6, 0, s > 0 ? "legA" : "legB"), P("box", "d", -1.15, 0.22, s * 0.15, 0.28, 0.03, 0.12, 0, s * 0.4, 0, "tail", "x")])];
M.hippo = [...quad({ len: 1.05, bh: 0.62, bw: 0.62, legH: 0.35, lw: 0.2, neck: [0.15, 0.3, 0.4], head: [0.5, 0.36, 0.42], snout: [0.42, 0.34, 0.45], ears: "round", earS: 0.1, tail: "stub", seed: 7 }),
  ...[1, -1].map((s) => P("cone", "w", 1.62, 0.52, s * 0.25, 0.03, 0.06, 0.03, 0, 0, 0, "head"))];
M.capybara = quad({ len: 0.85, bh: 0.48, bw: 0.42, legH: 0.3, lw: 0.1, neck: [0.12, 0.3, 0.3], head: [0.38, 0.27, 0.24], snout: [0.2, 0.22, 0.2], ears: "round", earS: 0.08, tail: "none", paw: true, seed: 31 });
M.penguin = standingBird({ legH: 0.18, len: 0.4, bh: 0.62, tilt: 0.08, neck: [0.42, 1.45], neckW: 0.2, headCol: "b", beakCol: 0xe89b2c, beakL: 0.14, lw: 0.07, legCol: 0xe89b2c, wingAnim: "sway" })
  .concat([P("sph", 0xf3f1ea, 0.2, 0.55, 0, 0.26, 0.5, 0.42), P("sph", 0xf2b134, 0.3, 1.1, 0.14, 0.08, 0.05, 0.04, 0, 0, 0, "head"), P("sph", 0xf2b134, 0.3, 1.1, -0.14, 0.08, 0.05, 0.04, 0, 0, 0, "head")]);
M.insect = [P("sph", "b", -0.25, 0.42, 0, 0.75, 0.38, 0.6), P("box", "k", -0.25, 0.8, 0, 0.72, 0.012, 0.012), ...coat([2], -0.25, 0.42, 0.75, 0.38, 0.6, 8, "k").map((p) => ((p.pat = 0), p)),
  P("sph", "k", 0.55, 0.38, 0, 0.28, 0.24, 0.36), P("sph", "k", 0.92, 0.36, 0, 0.2, 0.18, 0.2),
  P("cyl", "k", 1.25, 0.55, 0.15, 0.02, 0.32, 0.02, 0.5, 0, -0.9), P("cyl", "k", 1.25, 0.55, -0.15, 0.02, 0.32, 0.02, -0.5, 0, -0.9),
  ...[0.45, 0, -0.45].flatMap((x, i) => [1, -1].flatMap((s) => [P("tcyl", "k", x, 0.4, s * 0.42, 0.035, 0.2, 0.035, s * (H - 0.25), 0, 0, i % 2 ? "legA" : "legB", s > 0 ? "z+" : "z-"), P("tcyl", "k", x + 0.05, 0.25, s * 0.8, 0.025, 0.25, 0.025, s * -0.3, 0, 0, i % 2 ? "legA" : "legB")]))];
M.flyinsect = [P("tcyl", "k", -0.3, 0, 0, 0.1, 0.65, 0.1, 0, 0, H), P("sph", "k", 0.45, 0, 0, 0.18, 0.16, 0.16), P("sph", "k", 0.65, 0.02, 0, 0.12, 0.12, 0.14), ...eyes(0.7, 0.06, 0.1, 0.06),
  P("box", "b", 0.2, 0.06, 0.08, 0.35, 0.012, 0.58, 0, 0.25, 0, "wingL", "z+"), P("box", "b", 0.2, 0.06, -0.08, 0.35, 0.012, 0.58, 0, -0.25, 0, "wingR", "z-"),
  P("box", "l", -0.15, 0.05, 0.08, 0.28, 0.012, 0.45, 0, -0.35, 0, "wingL", "z+"), P("box", "l", -0.15, 0.05, -0.08, 0.28, 0.012, 0.45, 0, 0.35, 0, "wingR", "z-"),
  P("sph", "d", 0.15, 0.08, 0.6, 0.1, 0.02, 0.1, 0, 0, 0, "wingL", "z+", { pat: 2 }), P("sph", "d", 0.15, 0.08, -0.6, 0.1, 0.02, 0.1, 0, 0, 0, "wingR", "z-", { pat: 2 })];
function arachnid(sting) {
  const parts = [];
  for (const [x, i] of [[0.35, 0], [0.15, 1], [-0.05, 2], [-0.25, 3]]) for (const s of [1, -1]) {
    const a = i % 2 ? "legA" : "legB";
    parts.push(P("tcyl", "d", x, 0.4, s * 0.25, 0.035, 0.3, 0.035, s * 0.9, (i - 1.5) * -0.35 * s, 0, a, s > 0 ? "z+" : "z-"), P("tcyl", "d", x + (i - 1.5) * 0.12, 0.2, s * 0.78, 0.028, 0.22, 0.028, s * -0.45, 0, 0, a));
  }
  if (sting) {
    parts.push(P("sph", "b", 0, 0.32, 0, 0.55, 0.18, 0.32));
    for (let k = 0; k < 5; k++) { const t = k / 4, x = -0.55 - Math.sin(t * 1.6) * 0.45, y = 0.32 + (1 - Math.cos(t * 1.6)) * 0.75; parts.push(P("sph", "b", x, y, 0, 0.13 - k * 0.012, 0.12 - k * 0.01, 0.12 - k * 0.01, 0, 0, 0, "tailV")); }
    parts.push(P("cone", "k", -0.6, 1.15, 0, 0.05, 0.14, 0.05, 0, 0, -2.4, "tailV"));
    for (const s of [1, -1]) parts.push(seg("tcyl", "d", 0.45, 0.32, 0.85, 0.38, 0.05, s * 0.32), P("sph", "b", 1.05, 0.38, s * 0.42, 0.24, 0.1, 0.12, 0, -s * 0.4, 0, "sway"));
  } else {
    parts.push(P("sph", "b", -0.5, 0.48, 0, 0.55, 0.45, 0.48), P("sph", "l", -0.55, 0.78, 0, 0.25, 0.12, 0.08), P("sph", "d", 0.2, 0.42, 0, 0.32, 0.22, 0.28));
    parts.push(...coat([1, 2], -0.5, 0.48, 0.55, 0.45, 0.48, 9, "l"));
  }
  parts.push(P("sph", "e", 0.48, 0.52, 0.06, 0.04, 0.04, 0.04), P("sph", "e", 0.48, 0.52, -0.06, 0.04, 0.04, 0.04));
  return parts;
}
M.spider = arachnid(false);
M.scorpion = arachnid(true);
M.snail = [P("sph", 0xb9a58a, 0.1, 0.12, 0, 1.15, 0.14, 0.32, 0, 0, 0, "seg1"), P("sph", 0xb9a58a, 1.05, 0.25, 0, 0.22, 0.2, 0.2), P("cyl", 0x8f7d64, 1.12, 0.55, 0.1, 0.02, 0.2, 0.02, 0.3, 0, -0.3), P("cyl", 0x8f7d64, 1.12, 0.55, -0.1, 0.02, 0.2, 0.02, -0.3, 0, -0.3),
  P("sph", "e", 1.2, 0.75, 0.15, 0.04, 0.04, 0.04), P("sph", "e", 1.2, 0.75, -0.15, 0.04, 0.04, 0.04),
  P("torus", "b", -0.1, 0.62, 0, 0.5, 0.5, 0.75, 0, 0, 0), P("torus", "d", -0.1, 0.62, 0, 0.28, 0.28, 0.72, 0, 0, 0), P("sph", "l", -0.1, 0.62, 0, 0.2, 0.2, 0.28)];
M.lizard = reptile({ len: 0.95, bh: 0.24, bw: 0.36, ty: 0.3, head: [0.38, 0.18, 0.25], tailL: 1.9, tailW: 0.2, lw: 0.08, reach: 0.42, pats: [1, 2] });
M.snake = [...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => P("sph", k % 2 ? "b" : "d", 1.25 - k * 0.3, 0.16, 0, 0.24, 0.16 - k * 0.006, 0.21 - k * 0.012, 0, 0, 0, "seg" + k)),
  ...[0, 2, 4, 6, 8].map((k) => P("sph", "l", 1.25 - k * 0.3, 0.27, 0, 0.12, 0.05, 0.1, 0, 0, 0, "seg" + k, null, { pat: 2 })),
  P("cone", "d", -1.85, 0.12, 0, 0.1, 0.3, 0.08, 0, 0, H, "seg9"), P("sph", "b", 1.55, 0.2, 0, 0.3, 0.14, 0.22, 0, 0, 0, "seg0"), ...eyes(1.68, 0.3, 0.13, 0.04).map((p) => ((p.anim = "seg0"), p)),
  P("box", 0xc8324b, 1.95, 0.17, 0, 0.14, 0.008, 0.02, 0, 0, 0, "seg0")];
M.ceratops = [...quad({ len: 1.05, bh: 0.6, bw: 0.62, legH: 0.6, lw: 0.2, neck: [0.2, 0.25, 0.4], head: [0.45, 0.38, 0.38], snout: [0.3, 0.25, 0.25], nose: false, tail: "long", tailL: 1.3, tailDroop: 0.35, belly: true, pats: [3], seed: 10 }),
  P("cyl", "l", 1.35, 1.45, 0, 0.72, 0.05, 0.72, 0, 0, H * 0.6, "head"), ...[1, -1].map((s) => P("cone", "w", 1.75, 1.6, s * 0.22, 0.07, 0.42, 0.07, 0, 0, -1.0, "head")), P("cone", "w", 2.05, 1.2, 0, 0.06, 0.18, 0.06, 0, 0, -1.2, "head")];
M.stego = [...quad({ len: 1.1, bh: 0.62, bw: 0.55, legH: 0.55, lw: 0.18, neck: [0.35, -0.15, 0.22], head: [0.3, 0.2, 0.2], snout: [0.18, 0.13, 0.14], nose: false, tail: "long", tailL: 1.4, tailDroop: 0.25, seed: 11 }),
  ...[0, 1, 2, 3, 4, 5, 6].map((k) => P("tet", k % 2 ? "d" : 0xc0573c, 0.8 - k * 0.3, 1.45 + Math.sin((k / 6) * PI) * 0.35, 0, 0.12, 0.3 + Math.sin((k / 6) * PI) * 0.12, 0.25, 0, 0, 0)),
  ...[1, -1].map((s) => P("cone", "w", -2.1, 0.95, s * 0.12, 0.04, 0.22, 0.04, s * 0.8, 0, -0.3, "tail"))];
M.sauropod = [...quad({ len: 1.25, bh: 0.62, bw: 0.62, legH: 0.95, lw: 0.24, neck: [2.0, 0.95, 0.18], head: [0.32, 0.18, 0.2], snout: [0.16, 0.12, 0.14], nose: false, tail: "long", tailL: 2.6, tailDroop: 0.2, belly: true, pats: [2, 3], seed: 12 })];
M.theropod = [...leg(-0.05, 1.05, 0.32, 1.05, 0.2, "legA", "b", "d", 0.5), ...leg(-0.05, 1.05, -0.32, 1.05, 0.2, "legB", "b", "d", 0.5),
  P("sph", "b", 0, 1.32, 0, 0.95, 0.5, 0.46, 0, 0, 0.1), P("sph", "l", 0.08, 1.12, 0, 0.75, 0.25, 0.38), ...coat([1, 3], 0, 1.32, 0.95, 0.5, 0.46, 13, "d"),
  P("cone", "b", -0.75, 1.3, 0, 0.36, 1.0, 0.3, 0, 0, H + 0.05, "tail", "x"),
  seg("cyl", "b", 0.75, 1.5, 1.05, 1.7, 0.22), P("sph", "b", 1.3, 1.78, 0, 0.45, 0.26, 0.26, 0, 0, -0.1, "head"), P("box", "b", 1.55, 1.62, 0, 0.32, 0.1, 0.22, 0, 0, 0, "head"),
  P("box", "w", 1.6, 1.55, 0, 0.3, 0.02, 0.23, 0, 0, 0, "head"), ...eyes(1.42, 1.9, 0.2, 0.06).map((p) => ((p.anim = "head"), p)),
  ...[1, -1].map((s) => seg("tcyl", "d", 0.75, 1.15, 0.95, 0.95, 0.05, s * 0.28))];
M.pterosaur = [...flyingBird({ len: 0.55, span: 1.8, beakCol: "d", beakL: 0.5, headCol: "b", tailW: 0.05 }), P("cone", "d", 0.75, 0.42, 0, 0.05, 0.25, 0.03, 0, 0, 0.9)];
M.bird = flyingBird({ len: 0.62, span: 1.15 });
M.parrot = [...flyingBird({ len: 0.6, span: 1.05, beakCol: 0x2b2b2b, beakL: 0.12, beakHook: 0.7, headCol: "l", tailW: 0.12 }), P("box", "d", -0.95, 0.0, 0, 0.45, 0.02, 0.1, 0, 0, 0.2, "tailV", "x")];
M.raptor = flyingBird({ len: 0.7, span: 1.6, beakCol: 0xe7b43a, beakL: 0.14, beakHook: 0.5, headCol: "l", tailW: 0.3 });
M.bat = [P("sph", "b", 0, 0, 0, 0.45, 0.25, 0.25), P("sph", "b", 0.45, 0.06, 0, 0.18, 0.17, 0.17), ...[1, -1].map((s) => P("cone", "b", 0.42, 0.25, s * 0.1, 0.07, 0.12, 0.04)), ...eyes(0.58, 0.1, 0.09, 0.03),
  ...[1, -1].flatMap((s) => { const a = s > 0 ? "wingL" : "wingR", pv = s > 0 ? "z+" : "z-"; return [P("box", "d", 0.0, 0.02, s * 0.15, 0.32, 0.012, 0.36, 0, 0, 0, a, pv), P("box", "d", -0.05, 0.02, s * 0.15, 0.26, 0.012, 0.32, 0, s * 0.35, 0, a, pv, { off: 0.6 }),
    P("cyl", "k", 0.12, 0.04, s * 0.15, 0.018, 0.65, 0.018, s * H, 0, 0, a, pv), P("cyl", "k", 0.12, 0.04, s * 0.15, 0.014, 0.6, 0.014, s * H, s * 0.5, 0, a, pv, { off: 0.15 })]; })];
M.wader = standingBird({ legH: 1.55, len: 0.55, bh: 0.35, neck: [1.0, 1.25], neckW: 0.06, beakL: 0.32, beakBend: 0.6, beakDown: 0.12, beakCol: 0x2d2d2d, legCol: "d" });
M.ratite = standingBird({ legH: 1.45, len: 0.75, bh: 0.62, neck: [1.1, 1.35], neckW: 0.08, neckCol: 0xd9b9a4, headCol: 0xd9b9a4, beakL: 0.14, beakCol: 0xc9a77a, lw: 0.09, legCol: 0xd9b9a4, tailTuft: 0xf3efe6, tilt: 0.05 })
  .concat([1, -1].map((s) => P("sph", 0xf3efe6, -0.2, 1.85, s * 0.5, 0.4, 0.2, 0.08)));
M.rodent = quad({ len: 0.6, bh: 0.38, bw: 0.38, legH: 0.18, lw: 0.07, neck: [0.08, 0.4, 0.22], head: [0.32, 0.26, 0.26], snout: [0.16, 0.13, 0.14], ears: "round", earS: 0.18, tail: "long", tailL: 1.0, tailDroop: 0.25, paw: true, pats: [3], seed: 14 })
  .concat([P("box", "w", 1.08, 0.43, 0, 0.02, 0.05, 0.05)]);
M.rabbit = quad({ len: 0.55, bh: 0.42, bw: 0.4, legH: 0.18, lw: 0.08, neck: [0.1, 0.9, 0.2], head: [0.3, 0.26, 0.24], snout: [0.12, 0.12, 0.14], ears: "long", earS: 0.22, tail: "stub", paw: true, belly: true, seed: 15 })
  .concat([1, -1].map((s) => P("sph", "b", -0.4, 0.3, s * 0.32, 0.35, 0.3, 0.12)));
M.boar = quad({ len: 0.95, bh: 0.48, bw: 0.42, legH: 0.42, lw: 0.1, neck: [0.15, 0.1, 0.35], head: [0.42, 0.3, 0.28], snout: [0.25, 0.18, 0.18], nose: true, ears: "pointy", earS: 0.16, tail: "thin", tailL: 0.35, hump: 0.4, humpX: 0.35, pats: [1], patCol: "l", seed: 16, horns: HORNS.tusks, mane: "d" });
M.deer = quad({ len: 0.92, bh: 0.42, bw: 0.36, legH: 1.0, lw: 0.08, neck: [0.6, 1.0, 0.13], head: [0.3, 0.17, 0.15], ears: "pointy", earS: 0.18, tail: "stub", horns: HORNS.antlers, pats: [2], patCol: "w", seed: 17 });
M.horse = quad({ len: 1.05, bh: 0.48, bw: 0.38, legH: 1.15, lw: 0.1, neck: [0.75, 0.95, 0.17], head: [0.42, 0.18, 0.15], snout: [0.2, 0.14, 0.13], ears: "pointy", earS: 0.14, tail: "bushy", tailL: 0.9, tailDroop: 1.1, mane: "k", pats: [1, 3], patCol: "k", seed: 18 });
M.bovid = quad({ len: 1.0, bh: 0.6, bw: 0.55, legH: 0.65, lw: 0.13, neck: [0.25, 0.35, 0.32], head: [0.38, 0.3, 0.27], snout: [0.2, 0.18, 0.2], ears: "side", earS: 0.16, tail: "tuft", tailL: 0.7, tailDroop: 1.25, hump: 0.55, humpX: 0.45, horns: HORNS.cow, pats: [2, 3], patCol: "w", seed: 19 });
M.camel = quad({ len: 1.0, bh: 0.48, bw: 0.42, legH: 1.25, lw: 0.1, neck: [0.95, 0.55, 0.13], head: [0.32, 0.17, 0.15], snout: [0.2, 0.12, 0.12], ears: "round", earS: 0.1, tail: "tuft", tailL: 0.5, tailDroop: 1.3, hump: 0.75, humpX: 0.05, seed: 20 });
M.giraffe = quad({ len: 0.9, bh: 0.48, bw: 0.4, legH: 1.55, lw: 0.1, upper: 0.42, neck: [1.9, 1.15, 0.13], head: [0.3, 0.15, 0.13], snout: [0.16, 0.11, 0.1], ears: "pointy", earS: 0.12, tail: "tuft", tailL: 0.75, tailDroop: 1.35, mane: "d", horns: HORNS.ossicones, pats: [2], patAlways: true, patCol: 0x6b3a1c, seed: 21 })
  .concat([0.15, 0.3, 0.45, 0.6, 0.75].flatMap((t, k) => [1, -1].map((s) => P("sph", 0x6b3a1c, 0.74 + Math.cos(1.15) * 1.9 * t, 1.98 + Math.sin(1.15) * 1.9 * t + (k % 2) * 0.05, s * 0.12, 0.07, 0.08, 0.02))));
M.rhino = quad({ len: 1.1, bh: 0.62, bw: 0.58, legH: 0.55, lw: 0.17, neck: [0.2, 0.15, 0.38], head: [0.5, 0.3, 0.28], snout: [0.25, 0.22, 0.22], nose: false, ears: "pointy", earS: 0.14, tail: "thin", tailL: 0.4, horns: HORNS.rhino, seed: 23 })
;
const trunk = (x, y, col = "b") => [0, 1, 2, 3, 4].map((k) => P("tcyl", col, x + k * 0.05, y - k * 0.24, 0, 0.14 - k * 0.015, 0.14, 0.14 - k * 0.015, 0, 0, 0.12 + k * 0.08, "trunk", "y"));
M.elephant = [...quad({ len: 1.15, bh: 0.82, bw: 0.75, legH: 1.0, lw: 0.24, upper: 0.5, neck: [0.15, 0.4, 0.5], head: [0.5, 0.5, 0.45], snout: null, nose: false, tail: "tuft", tailL: 0.8, tailDroop: 1.4, seed: 24, lowCol: "b" }),
  ...[1, -1].map((s) => P("sph", "d", 1.25, 2.15, s * 0.5, 0.42, 0.55, 0.06, s * 0.35, s * 0.4, 0, "sway")),
  ...trunk(1.85, 2.0), ...[1, -1].map((s) => P("cone", "w", 1.95, 1.6, s * 0.25, 0.06, 0.38, 0.06, s * 0.15, 0, -2.0))];
M.mammoth = [...quad({ len: 1.15, bh: 0.88, bw: 0.78, legH: 1.0, lw: 0.26, neck: [0.15, 0.4, 0.5], head: [0.52, 0.58, 0.45], snout: null, nose: false, tail: "stub", seed: 25, lowCol: "b", hump: 0.55, humpX: 0.55 }),
  ...[0, 1, 2, 3, 4, 5, 6].flatMap((k) => [1, -1].map((s) => P("sph", "d", 0.95 - k * 0.33, 1.2, s * 0.66, 0.2, 0.5, 0.12, s * 0.12, 0, (k - 3) * 0.04))), P("sph", "d", 0.2, 1.05, 0, 1.0, 0.35, 0.7),
  ...[1, -1].map((s) => P("sph", "d", 1.3, 2.2, s * 0.42, 0.22, 0.3, 0.05, s * 0.3, s * 0.4, 0, "sway")),
  ...trunk(1.95, 2.1, "d"), ...[1, -1].flatMap((s) => [seg("tcyl", "w", 1.95, 1.7, 2.45, 1.25, 0.07, s * 0.28), seg("tcyl", "w", 2.45, 1.25, 2.6, 1.75, 0.055, s * 0.42)])];
M.fox = quad({ len: 0.7, bh: 0.3, bw: 0.26, legH: 0.42, lw: 0.06, neck: [0.25, 0.75, 0.12], head: [0.24, 0.17, 0.17], snout: [0.2, 0.08, 0.08], ears: "pointy", earS: 0.2, tail: "bushy", tailL: 1.0, tailDroop: 0.55, belly: true, seed: 26 })
  .concat([P("sph", "w", -1.55, 0.55, 0, 0.12, 0.12, 0.12)]);
M.wolf = quad({ len: 0.92, bh: 0.38, bw: 0.32, legH: 0.62, lw: 0.08, neck: [0.32, 0.7, 0.17], head: [0.3, 0.2, 0.2], snout: [0.24, 0.1, 0.11], ears: "pointy", earS: 0.17, tail: "bushy", tailL: 0.85, tailDroop: 1.0, mane: "d", pats: [3], seed: 27 });
M.bigcat = quad({ len: 1.05, bh: 0.42, bw: 0.38, legH: 0.62, lw: 0.11, neck: [0.28, 0.55, 0.2], head: [0.32, 0.25, 0.26], snout: [0.15, 0.12, 0.15], ears: "round", earS: 0.12, tail: "long", tailL: 1.3, tailDroop: 0.7, pats: [1, 2, 3], seed: 28, paw: true });
M.bear = quad({ len: 1.0, bh: 0.65, bw: 0.62, legH: 0.55, lw: 0.17, upper: 0.55, neck: [0.18, 0.3, 0.38], head: [0.38, 0.33, 0.33], snout: [0.22, 0.15, 0.15], ears: "round", earS: 0.13, tail: "stub", hump: 0.35, humpX: 0.5, seed: 29, paw: true });
M.monkey = [...leg(-0.05, 0.55, 0.15, 0.55, 0.07, "legA", "b", "b"), ...leg(-0.05, 0.55, -0.15, 0.55, 0.07, "legB", "b", "b"),
  P("sph", "b", 0.08, 0.85, 0, 0.32, 0.38, 0.28, 0, 0, -0.35), P("sph", "l", 0.18, 0.8, 0, 0.2, 0.28, 0.2, 0, 0, -0.35), P("sph", "b", 0.32, 1.32, 0, 0.24, 0.24, 0.24, 0, 0, 0, "head"), P("sph", 0xd8b08a, 0.48, 1.28, 0, 0.13, 0.15, 0.17, 0, 0, 0, "head"),
  ...[1, -1].map((s) => P("sph", 0xd8b08a, 0.3, 1.38, s * 0.24, 0.05, 0.08, 0.06, 0, 0, 0, "head")), ...eyes(0.55, 1.35, 0.08, 0.035).map((p) => ((p.anim = "head"), p)),
  P("cyl", "b", 0.22, 1.05, 0.33, 0.055, 0.38, 0.055, 0, 0, 0, "armA", "y"), P("cyl", "b", 0.22, 1.05, -0.33, 0.055, 0.38, 0.055, 0, 0, 0, "armB", "y"),
  P("cyl", "b", -0.2, 0.75, 0, 0.035, 0.6, 0.035, 0, 0, 2.4, "tail", "x")];
M.ape = [...leg(0, 0.65, 0.24, 0.65, 0.12, "legA", "d", "d"), ...leg(0, 0.65, -0.24, 0.65, 0.12, "legB", "d", "d"),
  P("sph", "b", 0.1, 1.2, 0, 0.5, 0.62, 0.52, 0, 0, -0.35), P("sph", "l", 0.25, 1.1, 0, 0.3, 0.42, 0.38, 0, 0, -0.35), P("sph", "d", 0.45, 1.78, 0, 0.3, 0.3, 0.3, 0, 0, 0, "head"), P("sph", 0xb08a6a, 0.66, 1.72, 0, 0.15, 0.15, 0.2, 0, 0, 0, "head"),
  P("box", "d", 0.62, 1.88, 0, 0.08, 0.04, 0.2, 0, 0, 0, "head"), ...eyes(0.7, 1.84, 0.1, 0.04).map((p) => ((p.anim = "head"), p)),
  ...leg(0.3, 1.55, 0.58, 1.3, 0.1, "armA", "d", "d", 0.5), ...leg(0.3, 1.55, -0.58, 1.3, 0.1, "armB", "d", "d", 0.5)];
M.human = [...leg(0, 1.02, 0.12, 1.02, 0.08, "legA", 0x3b3229, 0x2b241d, 0.5),
  ...leg(0, 1.02, -0.12, 1.02, 0.08, "legB", 0x3b3229, 0x2b241d, 0.5),
  P("tcyl", "c", 0, 1.38, 0, 0.24, 0.38, 0.16, 0, 0, PI), P("sph", "c", 0, 1.72, 0, 0.26, 0.1, 0.17), P("cyl", "s", 0, 1.85, 0, 0.05, 0.06, 0.05),
  P("sph", "s", 0.02, 2.02, 0, 0.15, 0.18, 0.14), P("sph", "h", -0.02, 2.1, 0, 0.16, 0.12, 0.155), ...eyes(0.14, 2.04, 0.06, 0.022),
  ...leg(0, 1.72, 0.32, 0.72, 0.06, "armA", "c", "s", 0.5), ...leg(0, 1.72, -0.32, 0.72, 0.06, "armB", "c", "s", 0.5)];

export const MODELS = M;

/** Body plans whose body bobs up and down while walking. */
export const BOB = new Set(["rodent", "rabbit", "boar", "deer", "horse", "bovid", "camel", "giraffe", "rhino", "elephant", "mammoth", "fox", "wolf", "bigcat", "bear", "hippo",
  "capybara", "ceratops", "stego", "sauropod", "theropod", "monkey", "ape", "human", "wader", "ratite", "penguin"]);

/** Part drawn when a creature is far away: its biggest body-sized ellipsoid. */
const FAR = {};
export function farPart(arch) {
  if (FAR[arch]) return FAR[arch];
  const parts = MODELS[arch] || MODELS.fish;
  let best = parts[0], v = 0;
  for (const p of parts) if (p.g === "sph" && !p.pat) { const vol = p.sx * p.sy * p.sz; if (vol > v) { v = vol; best = p; } }
  return (FAR[arch] = best);
}

/** Animation offsets (euler radians + position) for a part at phase ph. `bend` is the knee flex for lower legs. */
export function animate(name, ph, out) {
  out.x = 0; out.y = 0; out.z = 0; out.px = 0; out.py = 0; out.pz = 0; out.bend = 0;
  if (!name) return out;
  switch (name) {
    case "legA": out.z = Math.sin(ph) * 0.5; out.bend = Math.max(0, Math.cos(ph)) * 0.75; break;
    case "legB": out.z = -Math.sin(ph) * 0.5; out.bend = Math.max(0, -Math.cos(ph)) * 0.75; break;
    case "armA": out.z = -Math.sin(ph) * 0.5; out.bend = -0.3; break;
    case "armB": out.z = Math.sin(ph) * 0.5; out.bend = -0.3; break;
    case "tail": out.y = Math.sin(ph * 0.8) * 0.35; break;
    case "tailV": out.z = Math.sin(ph * 0.6) * 0.25; break;
    case "wingL": out.x = -Math.sin(ph * 2.5) * 0.45; break;
    case "wingR": out.x = Math.sin(ph * 2.5) * 0.45; break;
    case "flapL": out.x = -Math.sin(ph * 0.9) * 0.35; break;
    case "flapR": out.x = Math.sin(ph * 0.9) * 0.35; break;
    case "sway": out.x = Math.sin(ph * 0.7) * 0.2; out.z = Math.cos(ph * 0.6) * 0.15; break;
    case "trunk": out.z = Math.sin(ph * 0.4) * 0.18; break;
    case "head": out.z = Math.sin(ph * 2) * 0.04; out.py = Math.abs(Math.sin(ph)) * 0.02; break;
    default:
      if (name.startsWith("seg")) out.pz = Math.sin(ph * 1.5 - +name.slice(3) * 0.8) * 0.28;
  }
  return out;
}

/** How a body plan sits in the world: water dwellers swim under the surface, fliers stay aloft. */
export const PLACEMENT = {
  microbe: "sea", colony: "sea", jelly: "sea", worm: "floor", starfish: "floor", trilobite: "floor", crab: "floor", lobster: "floor", ammonite: "sea",
  squid: "sea", octopus: "floor", fish: "sea", reeffish: "sea", predfish: "sea", eel: "sea", ray: "sea", shark: "sea", dolphin: "surface", whale: "surface",
  frog: "ground", salamander: "ground", croc: "ground", turtle: "ground", seal: "ground", hippo: "ground", capybara: "ground", penguin: "ground",
  flyinsect: "air", bird: "air", parrot: "air", raptor: "air", bat: "air", pterosaur: "air",
};
