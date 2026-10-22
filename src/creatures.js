// Procedural top-down vector art for every body plan. Each drawer works in local space:
// the creature faces +x, `r` is its visual radius, `ph` an animation phase, `P` its palette.
const TAU = Math.PI * 2;

// [how much of the species hue to keep, saturation, lightness, natural hue it leans toward]
const TONE = {
  microbe: [1, 60, 62, 160], colony: [1, 55, 58, 140], jelly: [1, 70, 74, 280], worm: [0.6, 45, 55, 340],
  trilobite: [0.3, 30, 45, 35], crab: [0.45, 62, 50, 12], ammonite: [0.35, 35, 62, 35], squid: [0.6, 50, 58, 330],
  fish: [0.9, 58, 58, 200], predfish: [0.7, 45, 50, 120], shark: [0.15, 14, 56, 210], whale: [0.2, 18, 40, 215],
  frog: [0.55, 55, 45, 110], croc: [0.25, 30, 32, 85], turtle: [0.35, 35, 40, 70], insect: [0.85, 65, 42, 20],
  flyinsect: [1, 80, 60, 40], lizard: [0.55, 45, 45, 100], ceratops: [0.4, 30, 45, 40], sauropod: [0.4, 25, 48, 80],
  theropod: [0.45, 35, 40, 25], bird: [0.6, 55, 52, 30], raptor: [0.3, 40, 38, 30], rodent: [0.25, 25, 45, 30],
  deer: [0.25, 45, 45, 28], bovid: [0.2, 25, 30, 25], elephant: [0.1, 8, 48, 30], wolf: [0.15, 10, 50, 30],
  bigcat: [0.25, 65, 52, 34], bear: [0.2, 35, 28, 25], ape: [0.2, 30, 30, 25], human: [1, 45, 45, 0],
  starfish: [0.6, 65, 55, 20], lobster: [0.4, 60, 40, 5], octopus: [0.5, 50, 48, 15], reeffish: [1, 85, 58, 40], eel: [0.3, 35, 40, 80],
  ray: [0.2, 20, 42, 30], dolphin: [0.1, 12, 56, 210], salamander: [0.7, 70, 50, 20], seal: [0.1, 10, 42, 30], capybara: [0.1, 40, 40, 28], hippo: [0.1, 15, 45, 340],
  penguin: [0, 10, 18, 220], spider: [0.3, 25, 25, 30], scorpion: [0.3, 45, 45, 40], snail: [0.4, 40, 50, 35], snake: [0.6, 50, 40, 90],
  stego: [0.4, 35, 42, 70], pterosaur: [0.4, 30, 45, 20], parrot: [1, 85, 50, 120], wader: [0.3, 55, 72, 350], ratite: [0.1, 10, 28, 30],
  bat: [0.1, 15, 24, 20], rabbit: [0.15, 25, 55, 30], boar: [0.1, 25, 28, 20], horse: [0.25, 45, 36, 25], camel: [0.1, 45, 62, 35],
  giraffe: [0.1, 70, 58, 35], rhino: [0.05, 6, 48, 30], mammoth: [0.1, 40, 30, 22], fox: [0.15, 80, 50, 22], monkey: [0.2, 30, 38, 28],
};
// fur and feathers that turn pale in the cold (polar bear, arctic fox, snow leopard, snowy owl…)
const SNOW_COAT = new Set(["bear", "fox", "wolf", "rabbit", "bigcat", "raptor", "bird", "seal", "rodent", "bovid", "deer"]);
function mixHue(a, b, t) { const d = ((b - a + 540) % 360) - 180; return (a + d * t + 360) % 360; }
const hsl = (h, s, l, a = 1) => `hsla(${h | 0},${s | 0}%,${Math.max(0, Math.min(100, l)) | 0}%,${a})`;

export function paletteFor(sp, arch) {
  const snow = SNOW_COAT.has(arch) && sp.avg && sp.avg.thermal < 0.25;
  const key = arch + ((sp.hue / 6) | 0) + (snow ? "s" : "");
  if (sp._palKey === key) return sp._pal;
  let [keep, sat, light, toward] = TONE[arch] || TONE.fish;
  if (snow) { sat *= 0.25; light = Math.max(light, 84); }
  const h = mixHue(toward, sp.hue, keep);
  sp._pal = {
    h, base: hsl(h, sat, light), dark: hsl(h, sat, light - 16), deep: hsl(h, sat * 0.8, light - 28), light: hsl(h, sat * 0.8, light + 16),
    belly: hsl(h, sat * 0.5, light + 26), accent: hsl((h + 180) % 360, 70, 55), glow: hsl(h, 90, 70, 0.35),
  };
  sp._palKey = key;
  return sp._pal;
}

// ------------------------------------------------------------------ helpers
function ell(ctx, x, y, rx, ry, rot, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU); ctx.fill(); }
function line(ctx, x0, y0, x1, y1, w, col) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
function eye(ctx, x, y, r, white = true) {
  if (white) ell(ctx, x, y, r, r, 0, "#f6f3ea");
  ell(ctx, x + r * 0.2, y, r * 0.6, r * 0.6, 0, "#10131c");
  ell(ctx, x + r * 0.35, y - r * 0.25, r * 0.2, r * 0.2, 0, "rgba(255,255,255,.9)");
}
/** Spots / stripes / saddle markings on a body ellipse, clipped to it. */
function markings(ctx, pat, len, wid, col) {
  if (!pat) return;
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, len, wid, 0, 0, TAU); ctx.clip();
  ctx.fillStyle = col;
  if (pat === 1) for (let k = -3; k <= 3; k++) ctx.fillRect(k * len * 0.28 - len * 0.05, -wid, len * 0.1, wid * 2);
  else if (pat === 2) for (let k = 0; k < 7; k++) { const a = k * 2.4; ell(ctx, Math.cos(a) * len * 0.55, Math.sin(a * 1.7) * wid * 0.55, wid * 0.16, wid * 0.16, 0, col); }
  else ell(ctx, -len * 0.1, 0, len * 0.5, wid * 0.45, 0, col);
  ctx.restore();
}
/** Sprawling or upright legs seen from above. */
function legs4(ctx, len, wid, r, ph, col, w, reach = 1.5, splay = 0.6) {
  ctx.lineCap = "round";
  const s = Math.sin(ph);
  for (const [lx, side, p] of [[len * 0.45, 1, 1], [len * 0.45, -1, -1], [-len * 0.45, 1, -1], [-len * 0.45, -1, 1]]) {
    const sw = s * p * r * 0.5;
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
    ctx.moveTo(lx, side * wid * 0.5);
    ctx.quadraticCurveTo(lx + sw * 0.4, side * wid * (0.9 + splay), lx + sw, side * wid * reach);
    ctx.stroke();
  }
}
function tail(ctx, x0, len, w0, ph, amp, col) {
  ctx.fillStyle = col; ctx.beginPath();
  const tipX = x0 - len, tipY = Math.sin(ph) * amp;
  ctx.moveTo(x0, -w0); ctx.quadraticCurveTo(x0 - len * 0.55, Math.sin(ph - 0.6) * amp * 0.6 - w0 * 0.4, tipX, tipY);
  ctx.quadraticCurveTo(x0 - len * 0.55, Math.sin(ph - 0.6) * amp * 0.6 + w0 * 0.4, x0, w0); ctx.fill();
}

// ------------------------------------------------------------------ aquatic life
const D = {};
D.microbe = (ctx, r, g, P, ph, o) => {
  const wob = 1 + Math.sin(ph) * 0.07;
  ell(ctx, 0, 0, r * wob, r / wob, 0, P.glow);
  ell(ctx, 0, 0, r * 0.88 * wob, r * 0.88 / wob, 0, P.base);
  ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = r * 0.12; ctx.stroke();
  ell(ctx, r * 0.18, -r * 0.1, r * 0.34, r * 0.3, 0, P.deep);
  ell(ctx, -r * 0.35, r * 0.3, r * 0.12, r * 0.12, 0, P.light);
  ell(ctx, -r * 0.1, -r * 0.42, r * 0.09, r * 0.09, 0, P.light);
  if (g.diet >= 0.38) { ctx.strokeStyle = "rgba(255,150,150,.85)"; ctx.lineWidth = r * 0.1; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + ph * 0.15; line(ctx, Math.cos(a) * r, Math.sin(a) * r, Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3, r * 0.1, "rgba(255,150,150,.85)"); } }
  ctx.strokeStyle = P.light; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.moveTo(-r, 0);
  ctx.bezierCurveTo(-r * 1.5, Math.sin(ph * 2) * r * 0.7, -r * 1.9, -Math.sin(ph * 2) * r * 0.7, -r * 2.4, 0); ctx.stroke();
};
D.colony = (ctx, r, g, P, ph) => {
  ell(ctx, 0, 0, r * 1.1, r * 1.1, 0, P.glow);
  const n = 5 + Math.round(g.form * 10);
  for (let k = 0; k < n; k++) { const a = k / n * TAU + ph * 0.08, d = r * 0.62; ell(ctx, Math.cos(a) * d, Math.sin(a) * d, r * 0.32, r * 0.32, 0, k % 2 ? P.base : P.light); }
  ell(ctx, 0, 0, r * 0.35, r * 0.35, 0, P.deep);
  ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.arc(0, 0, r * 1.02, 0, TAU); ctx.stroke();
};
D.jelly = (ctx, r, g, P, ph) => {
  const pulse = 1 + Math.sin(ph * 1.4) * 0.12;
  ctx.strokeStyle = P.light; ctx.lineWidth = r * 0.07; ctx.globalAlpha = 0.7;
  for (let k = 0; k < 6; k++) {
    const y = (k / 5 - 0.5) * r * 1.2; ctx.beginPath(); ctx.moveTo(-r * 0.3, y);
    ctx.bezierCurveTo(-r * 1.2, y + Math.sin(ph + k) * r * 0.4, -r * 1.8, y - Math.sin(ph + k) * r * 0.4, -r * (2.4 + (k % 3) * 0.3), y + Math.sin(ph * 1.3 + k) * r * 0.3); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ell(ctx, 0, 0, r * pulse, r * pulse, 0, P.glow);
  ell(ctx, 0, 0, r * 0.85 * pulse, r * 0.85 * pulse, 0, hsl(P.h, 70, 72, 0.55));
  ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = r * 0.06;
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 0.8 * pulse, Math.sin(a) * r * 0.8 * pulse); ctx.stroke(); }
  ell(ctx, 0, 0, r * 0.25, r * 0.25, 0, P.light);
};
D.worm = (ctx, r, g, P, ph) => {
  const seg = 7;
  for (let k = seg - 1; k >= 0; k--) {
    const x = r * 0.9 - k * r * 0.5, y = Math.sin(ph * 1.5 - k * 0.8) * r * 0.35, s = r * (0.48 - k * 0.025);
    ell(ctx, x, y, s, s, 0, k % 2 ? P.base : P.dark);
    if (g.diet >= 0.38 || k % 2) { line(ctx, x, y - s, x - r * 0.1, y - s * 1.7, r * 0.06, P.light); line(ctx, x, y + s, x - r * 0.1, y + s * 1.7, r * 0.06, P.light); }
  }
  eye(ctx, r * 1.05, -r * 0.14, r * 0.1, false); eye(ctx, r * 1.05, r * 0.14, r * 0.1, false);
};
D.trilobite = (ctx, r, g, P, ph) => {
  const len = r * 1.25, wid = r * 0.95;
  for (let k = -3; k <= 3; k++) { const x = k * len * 0.22, sw = Math.sin(ph * 2 + k) * r * 0.08; line(ctx, x, -wid * 0.8, x + sw - r * 0.1, -wid * 1.15, r * 0.08, P.dark); line(ctx, x, wid * 0.8, x - sw - r * 0.1, wid * 1.15, r * 0.08, P.dark); }
  ell(ctx, 0, 0, len, wid, 0, P.base);
  ell(ctx, len * 0.55, 0, len * 0.45, wid * 0.95, 0, P.light);
  ell(ctx, 0, 0, len * 0.9, wid * 0.28, 0, P.dark);
  ctx.strokeStyle = P.deep; ctx.lineWidth = r * 0.05;
  for (let k = -4; k <= 2; k++) { const x = k * len * 0.17; ctx.beginPath(); ctx.moveTo(x, -wid * 0.95); ctx.quadraticCurveTo(x + len * 0.06, 0, x, wid * 0.95); ctx.stroke(); }
  eye(ctx, len * 0.6, -wid * 0.45, r * 0.13, false); eye(ctx, len * 0.6, wid * 0.45, r * 0.13, false);
  line(ctx, len * 0.95, -r * 0.2, len * 1.4, -r * 0.55, r * 0.05, P.dark); line(ctx, len * 0.95, r * 0.2, len * 1.4, r * 0.55, r * 0.05, P.dark);
};
D.crab = (ctx, r, g, P, ph) => {
  const w = r * 1.25, h = r * 0.85;
  ctx.lineCap = "round";
  for (let k = 0; k < 4; k++) {
    const x = -w * 0.45 + k * w * 0.28, sw = Math.sin(ph * 2.2 + k * 1.3) * r * 0.2;
    for (const side of [-1, 1]) { ctx.strokeStyle = P.dark; ctx.lineWidth = r * 0.14; ctx.beginPath(); ctx.moveTo(x, side * h * 0.6); ctx.lineTo(x - r * 0.15 + sw, side * h * 1.35); ctx.lineTo(x - r * 0.35 + sw, side * h * 1.7); ctx.stroke(); }
  }
  for (const side of [-1, 1]) {
    const open = Math.max(0, Math.sin(ph * 1.3)) * 0.4;
    line(ctx, w * 0.4, side * h * 0.5, w * 0.95, side * h * 1.05, r * 0.2, P.dark);
    ell(ctx, w * 1.2, side * h * 1.05, r * 0.42, r * 0.28, side * (0.3 + open), P.base);
    ell(ctx, w * 1.42, side * h * (1.05 - open * 0.4), r * 0.22, r * 0.1, side * (-0.4 - open), P.dark);
  }
  ell(ctx, 0, 0, w, h, 0, P.base);
  ell(ctx, -w * 0.1, -h * 0.25, w * 0.7, h * 0.4, 0, P.light);
  ell(ctx, 0, h * 0.35, w * 0.6, h * 0.2, 0, P.dark);
  line(ctx, w * 0.8, -h * 0.3, w * 1.05, -h * 0.45, r * 0.07, P.dark); line(ctx, w * 0.8, h * 0.3, w * 1.05, h * 0.45, r * 0.07, P.dark);
  eye(ctx, w * 1.07, -h * 0.47, r * 0.11, false); eye(ctx, w * 1.07, h * 0.47, r * 0.11, false);
};
D.ammonite = (ctx, r, g, P, ph) => {
  ctx.strokeStyle = P.light; ctx.lineWidth = r * 0.1;
  for (let k = 0; k < 6; k++) { const y = (k / 5 - 0.5) * r * 0.9; ctx.beginPath(); ctx.moveTo(r * 0.6, y * 0.6); ctx.quadraticCurveTo(r * 1.2, y + Math.sin(ph + k) * r * 0.3, r * 1.7, y * 1.3); ctx.stroke(); }
  ell(ctx, 0, 0, r, r, 0, P.base);
  ctx.strokeStyle = P.deep; ctx.lineWidth = r * 0.09; ctx.beginPath();
  for (let a = 0, rr = r * 0.9; a < TAU * 2.6; a += 0.2, rr *= 0.965) ctx.lineTo(Math.cos(a) * rr * 0.92 - r * 0.05, Math.sin(a) * rr * 0.92);
  ctx.stroke();
  ctx.strokeStyle = P.dark; ctx.lineWidth = r * 0.05;
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; line(ctx, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98, r * 0.05, P.dark); }
  ell(ctx, -r * 0.3, -r * 0.35, r * 0.3, r * 0.18, -0.6, "rgba(255,255,255,.25)");
};
D.squid = (ctx, r, g, P, ph) => {
  const len = r * 1.5, wid = r * 0.6;
  ctx.strokeStyle = P.base; ctx.lineCap = "round";
  for (let k = 0; k < 8; k++) {
    const y = (k / 7 - 0.5) * wid * 1.3; ctx.lineWidth = r * (k === 0 || k === 7 ? 0.08 : 0.14); ctx.beginPath(); ctx.moveTo(-len * 0.6, y * 0.5);
    ctx.bezierCurveTo(-len * 1.0, y + Math.sin(ph * 1.5 + k) * r * 0.3, -len * 1.3, y - Math.sin(ph + k) * r * 0.3, -len * (1.5 + (k === 0 || k === 7 ? 0.5 : 0)), y * 1.3); ctx.stroke();
  }
  ell(ctx, len * 0.1, 0, len * 0.8, wid, 0, P.base);
  ctx.fillStyle = P.dark; ctx.beginPath(); ctx.moveTo(len * 0.9, 0); ctx.lineTo(len * 0.55, -wid * 1.3); ctx.lineTo(len * 0.35, 0); ctx.lineTo(len * 0.55, wid * 1.3); ctx.fill();
  for (let k = 0; k < 6; k++) ell(ctx, len * (0.4 - k * 0.12), (k % 2 ? 1 : -1) * wid * 0.35, r * 0.08, r * 0.08, 0, P.accent);
  eye(ctx, -len * 0.45, -wid * 0.55, r * 0.17); eye(ctx, -len * 0.45, wid * 0.55, r * 0.17);
};
function fishBody(ctx, len, wid, P, ph, amp) {
  tail(ctx, -len * 0.75, len * 0.25, wid * 0.25, ph, wid * 0.5, P.dark);
  ctx.fillStyle = P.dark; ctx.beginPath();
  const tx = -len * 0.95, sw = Math.sin(ph) * amp;
  ctx.moveTo(tx, sw); ctx.lineTo(tx - len * 0.35, sw - wid * 0.9); ctx.quadraticCurveTo(tx - len * 0.18, sw, tx - len * 0.35, sw + wid * 0.9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.base; ctx.beginPath();
  ctx.moveTo(len, 0); ctx.bezierCurveTo(len * 0.7, -wid * 1.15, -len * 0.4, -wid * 1.0, -len * 0.9, Math.sin(ph) * amp * 0.5);
  ctx.bezierCurveTo(-len * 0.4, wid * 1.0, len * 0.7, wid * 1.15, len, 0); ctx.fill();
  ell(ctx, len * 0.05, 0, len * 0.65, wid * 0.32, 0, P.dark);
}
D.fish = (ctx, r, g, P, ph, o) => {
  const len = r * (1.35 + g.speed * 0.15), wid = r * 0.62, fin = Math.sin(ph * 1.5) * 0.3;
  ell(ctx, len * 0.25, -wid * 1.05, r * 0.45, r * 0.15, -0.7 - fin, P.light); ell(ctx, len * 0.25, wid * 1.05, r * 0.45, r * 0.15, 0.7 + fin, P.light);
  fishBody(ctx, len, wid, P, ph * (1.4 + g.speed), wid * 0.6);
  if (o.detail) markings(ctx, o.pat, len * 0.8, wid * 0.9, "rgba(255,255,255,.18)");
  ell(ctx, len * 0.35, -wid * 0.35, len * 0.35, wid * 0.18, 0, "rgba(255,255,255,.22)");
  eye(ctx, len * 0.68, -wid * 0.45, r * 0.16); eye(ctx, len * 0.68, wid * 0.45, r * 0.16);
};
D.predfish = (ctx, r, g, P, ph, o) => {
  const len = r * 1.8, wid = r * 0.5;
  ell(ctx, len * 0.15, -wid * 1.1, r * 0.5, r * 0.14, -0.5, P.dark); ell(ctx, len * 0.15, wid * 1.1, r * 0.5, r * 0.14, 0.5, P.dark);
  fishBody(ctx, len, wid, P, ph * 2, wid * 0.5);
  if (o.detail) markings(ctx, 1, len * 0.8, wid * 0.9, "rgba(0,0,0,.18)");
  ctx.strokeStyle = "#f4efe3"; ctx.lineWidth = r * 0.05;
  for (let k = 0; k < 4; k++) { const x = len * (0.82 + k * 0.04); line(ctx, x, -wid * 0.3, x + r * 0.05, -wid * 0.1, r * 0.05, "#f4efe3"); line(ctx, x, wid * 0.3, x + r * 0.05, wid * 0.1, r * 0.05, "#f4efe3"); }
  eye(ctx, len * 0.7, -wid * 0.5, r * 0.15); eye(ctx, len * 0.7, wid * 0.5, r * 0.15);
};
D.shark = (ctx, r, g, P, ph) => {
  const len = r * 2, wid = r * 0.55, s = Math.sin(ph * 1.2);
  ctx.fillStyle = P.dark;
  ctx.beginPath(); ctx.moveTo(len * 0.25, -wid * 0.6); ctx.lineTo(-len * 0.15, -wid * 2.3); ctx.lineTo(-len * 0.05, -wid * 0.6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(len * 0.25, wid * 0.6); ctx.lineTo(-len * 0.15, wid * 2.3); ctx.lineTo(-len * 0.05, wid * 0.6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-len * 0.9, s * wid * 0.6); ctx.lineTo(-len * 1.35, s * wid + -wid * 1.4); ctx.lineTo(-len * 1.2, s * wid); ctx.lineTo(-len * 1.3, s * wid + wid * 0.9); ctx.fill();
  ctx.fillStyle = P.base; ctx.beginPath(); ctx.moveTo(len * 1.05, 0);
  ctx.bezierCurveTo(len * 0.8, -wid * 1.2, -len * 0.5, -wid * 1.1, -len, s * wid * 0.6);
  ctx.bezierCurveTo(-len * 0.5, wid * 1.1, len * 0.8, wid * 1.2, len * 1.05, 0); ctx.fill();
  ell(ctx, 0, 0, len * 0.7, wid * 0.22, 0, P.dark);
  ctx.fillStyle = P.dark; ctx.beginPath(); ctx.moveTo(len * 0.1, -wid * 0.15); ctx.lineTo(-len * 0.3, 0); ctx.lineTo(len * 0.1, wid * 0.15); ctx.fill(); // dorsal fin from above
  for (let k = 0; k < 3; k++) line(ctx, len * (0.55 - k * 0.07), -wid * 0.8, len * (0.5 - k * 0.07), -wid * 0.55, r * 0.04, P.deep);
  eye(ctx, len * 0.78, -wid * 0.5, r * 0.11, false); eye(ctx, len * 0.78, wid * 0.5, r * 0.11, false);
};
D.whale = (ctx, r, g, P, ph, o) => {
  const len = r * 2, wid = r * 0.75, s = Math.sin(ph * 0.7);
  ell(ctx, len * 0.3, -wid * 1.2, r * 0.7, r * 0.2, -0.7 + s * 0.1, P.dark); ell(ctx, len * 0.3, wid * 1.2, r * 0.7, r * 0.2, 0.7 - s * 0.1, P.dark);
  ctx.fillStyle = P.dark; ctx.beginPath(); const tx = -len * 1.05;
  ctx.moveTo(tx + len * 0.2, s * wid * 0.3); ctx.quadraticCurveTo(tx - len * 0.05, s * wid * 0.3 - wid * 1.5, tx - len * 0.25, s * wid * 0.3 - wid * 1.3);
  ctx.quadraticCurveTo(tx - len * 0.1, s * wid * 0.3, tx - len * 0.25, s * wid * 0.3 + wid * 1.3); ctx.quadraticCurveTo(tx - len * 0.05, s * wid * 0.3 + wid * 1.5, tx + len * 0.2, s * wid * 0.3); ctx.fill();
  ctx.fillStyle = P.base; ctx.beginPath(); ctx.moveTo(len, 0);
  ctx.bezierCurveTo(len * 0.95, -wid * 1.25, -len * 0.5, -wid * 1.1, -len * 0.95, s * wid * 0.3);
  ctx.bezierCurveTo(-len * 0.5, wid * 1.1, len * 0.95, wid * 1.25, len, 0); ctx.fill();
  ell(ctx, len * 0.1, 0, len * 0.6, wid * 0.4, 0, P.dark);
  if (o.detail) for (let k = 0; k < 5; k++) ell(ctx, len * (0.4 - k * 0.15), (k % 2 ? 1 : -1) * wid * 0.5, r * 0.08, r * 0.06, 0, "rgba(255,255,255,.25)");
  ell(ctx, len * 0.55, 0, r * 0.1, r * 0.06, 0, P.deep); // blowhole
  if (Math.sin(ph * 0.21) > 0.93) { ctx.fillStyle = "rgba(235,245,255,.6)"; for (let k = 0; k < 5; k++) ell(ctx, len * 0.55 + Math.cos(k * 1.3) * r * 0.4, Math.sin(k * 1.3) * r * 0.4, r * 0.25, r * 0.25, 0, "rgba(235,245,255,.45)"); }
  eye(ctx, len * 0.72, -wid * 0.75, r * 0.08, false); eye(ctx, len * 0.72, wid * 0.75, r * 0.08, false);
};

// ------------------------------------------------------------------ amphibians & reptiles
D.frog = (ctx, r, g, P, ph, o) => {
  const hop = Math.max(0, Math.sin(ph * 1.2)), len = r * 1.0, wid = r * 0.85;
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    ctx.strokeStyle = P.dark; ctx.lineWidth = r * 0.28;
    ctx.beginPath(); ctx.moveTo(-len * 0.5, side * wid * 0.5); ctx.lineTo(-len * (0.2 + hop * 0.6), side * wid * (1.3 - hop * 0.3)); ctx.lineTo(-len * (0.9 + hop), side * wid * (1.1 - hop * 0.6)); ctx.stroke();
    ell(ctx, -len * (0.95 + hop), side * wid * (1.1 - hop * 0.6), r * 0.22, r * 0.14, 0, P.dark);
    ctx.lineWidth = r * 0.18; ctx.beginPath(); ctx.moveTo(len * 0.35, side * wid * 0.5); ctx.lineTo(len * 0.7, side * wid * 1.05); ctx.stroke();
  }
  ell(ctx, 0, 0, len, wid, 0, P.base);
  if (o.detail) markings(ctx, o.pat || 2, len, wid, P.deep);
  ell(ctx, len * 0.5, 0, len * 0.55, wid * 0.85, 0, P.base);
  line(ctx, len * 0.2, -wid * 0.55, -len * 0.6, -wid * 0.45, r * 0.06, P.light); line(ctx, len * 0.2, wid * 0.55, -len * 0.6, wid * 0.45, r * 0.06, P.light);
  ell(ctx, len * 0.65, -wid * 0.5, r * 0.26, r * 0.26, 0, P.base); ell(ctx, len * 0.65, wid * 0.5, r * 0.26, r * 0.26, 0, P.base);
  eye(ctx, len * 0.68, -wid * 0.52, r * 0.18); eye(ctx, len * 0.68, wid * 0.52, r * 0.18);
};
function reptile(ctx, r, P, ph, o, len, wid, tailLen, headLen, legW, opts = {}) {
  const s = ph;
  tail(ctx, -len * 0.85, tailLen, wid * 0.42, s * 0.9, r * 0.5, P.base);
  legs4(ctx, len, wid, r, s, P.dark, legW, opts.reach || 1.6, 0.4);
  ctx.fillStyle = P.base; ctx.beginPath(); ctx.ellipse(0, 0, len, wid, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = r * 0.05; ctx.stroke();
  if (o.detail) markings(ctx, o.pat, len, wid, "rgba(0,0,0,.2)");
  ctx.globalAlpha = 0.5; ell(ctx, -len * 0.05, 0, len * 0.8, wid * 0.3, 0, P.dark); ctx.globalAlpha = 1;
  if (opts.scutes) for (let k = -4; k <= 4; k++) { ell(ctx, k * len * 0.18, -wid * 0.18, r * 0.07, r * 0.07, 0, P.deep); ell(ctx, k * len * 0.18, wid * 0.18, r * 0.07, r * 0.07, 0, P.deep); }
  // head
  const hx = len * 0.85;
  ctx.fillStyle = P.base; ctx.beginPath(); ctx.moveTo(hx - headLen * 0.1, -wid * 0.55);
  ctx.quadraticCurveTo(hx + headLen * 0.7, -wid * (opts.snout ? 0.4 : 0.6), hx + headLen, 0); ctx.quadraticCurveTo(hx + headLen * 0.7, wid * (opts.snout ? 0.4 : 0.6), hx - headLen * 0.1, wid * 0.55); ctx.fill();
  if (opts.teeth) { ctx.fillStyle = "#f4efe3"; for (let k = 0; k < 5; k++) { const x = hx + headLen * (0.25 + k * 0.15); ell(ctx, x, -wid * 0.42 + k * wid * 0.04, r * 0.05, r * 0.05, 0, "#f4efe3"); ell(ctx, x, wid * 0.42 - k * wid * 0.04, r * 0.05, r * 0.05, 0, "#f4efe3"); } }
  eye(ctx, hx + headLen * 0.25, -wid * 0.38, r * 0.12); eye(ctx, hx + headLen * 0.25, wid * 0.38, r * 0.12);
}
D.lizard = (ctx, r, g, P, ph, o) => reptile(ctx, r, P, ph * (1.5 + g.speed * 0.4), o, r * 1.0, r * 0.42, r * 1.8, r * 0.6, r * 0.16);
D.croc = (ctx, r, g, P, ph, o) => reptile(ctx, r, P, ph * 0.8, o, r * 1.2, r * 0.5, r * 1.6, r * 1.1, r * 0.22, { scutes: true, snout: true, teeth: true, reach: 1.4 });
D.turtle = (ctx, r, g, P, ph, o) => {
  const s = Math.sin(ph * 0.8), rr = r * 1.05;
  for (const [x, y, p] of [[rr * 0.55, -rr * 0.7, 1], [rr * 0.55, rr * 0.7, -1], [-rr * 0.55, -rr * 0.7, -1], [-rr * 0.55, rr * 0.7, 1]]) ell(ctx, x + s * p * r * 0.12, y, r * 0.38, r * 0.2, Math.sign(y) * (0.6 + s * p * 0.3), P.dark);
  ell(ctx, rr * 1.0, 0, r * 0.38, r * 0.3, 0, P.dark); ell(ctx, -rr * 0.95, 0, r * 0.2, r * 0.1, 0, P.dark);
  eye(ctx, rr * 1.15, -r * 0.14, r * 0.08, false); eye(ctx, rr * 1.15, r * 0.14, r * 0.08, false);
  ell(ctx, 0, 0, rr * 0.95, rr * 0.82, 0, P.base);
  ctx.strokeStyle = P.deep; ctx.lineWidth = r * 0.06;
  ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; ctx.lineTo(Math.cos(a) * rr * 0.38, Math.sin(a) * rr * 0.38); } ctx.closePath(); ctx.stroke();
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; line(ctx, Math.cos(a) * rr * 0.38, Math.sin(a) * rr * 0.38, Math.cos(a) * rr * 0.9, Math.sin(a) * rr * 0.78, r * 0.06, P.deep); }
  ell(ctx, -rr * 0.2, -rr * 0.25, rr * 0.4, rr * 0.2, -0.4, "rgba(255,255,255,.14)");
};

// ------------------------------------------------------------------ insects
D.insect = (ctx, r, g, P, ph) => {
  ctx.lineCap = "round";
  for (let k = 0; k < 3; k++) for (const side of [-1, 1]) {
    const x = r * (0.35 - k * 0.4), sw = Math.sin(ph * 3 + k * 2 + side) * r * 0.25;
    ctx.strokeStyle = "#1b1712"; ctx.lineWidth = r * 0.1; ctx.beginPath(); ctx.moveTo(x, side * r * 0.3); ctx.lineTo(x + sw, side * r * 0.8); ctx.lineTo(x + sw - r * 0.2, side * r * 1.1); ctx.stroke();
  }
  line(ctx, r * 0.9, -r * 0.1, r * 1.4, -r * 0.5, r * 0.06, "#1b1712"); line(ctx, r * 0.9, r * 0.1, r * 1.4, r * 0.5, r * 0.06, "#1b1712");
  ell(ctx, r * 0.85, 0, r * 0.25, r * 0.22, 0, "#1b1712");
  ell(ctx, r * 0.45, 0, r * 0.28, r * 0.42, 0, P.deep);
  ell(ctx, -r * 0.3, 0, r * 0.75, r * 0.62, 0, P.base);
  line(ctx, r * 0.15, 0, -r * 1.0, 0, r * 0.05, P.deep);
  for (const [x, y] of [[-0.1, -0.3], [-0.1, 0.3], [-0.6, -0.25], [-0.6, 0.25]]) ell(ctx, x * r, y * r, r * 0.12, r * 0.12, 0, "#1b1712");
  ell(ctx, -r * 0.1, -r * 0.3, r * 0.35, r * 0.12, -0.3, "rgba(255,255,255,.3)");
};
D.flyinsect = (ctx, r, g, P, ph, o) => {
  const flap = Math.abs(Math.sin(ph * 6)), dragon = g.diet >= 0.38 || g.speed > 2;
  ctx.globalAlpha = 0.9;
  for (const side of [-1, 1]) {
    if (dragon) {
      ell(ctx, r * 0.15, side * r * (0.3 + flap * 0.7), r * 0.18, r * (0.75 + flap * 0.4), side * 0.15, "rgba(210,235,255,.55)");
      ell(ctx, -r * 0.25, side * r * (0.3 + flap * 0.65), r * 0.16, r * (0.7 + flap * 0.35), -side * 0.15, "rgba(210,235,255,.55)");
    } else {
      ell(ctx, r * 0.15, side * r * (0.15 + flap * 0.65), r * 0.5, r * (0.4 + flap * 0.45), side * 0.3, P.base);
      ell(ctx, -r * 0.35, side * r * (0.15 + flap * 0.5), r * 0.38, r * (0.3 + flap * 0.32), -side * 0.4, P.dark);
      ell(ctx, r * 0.2, side * r * (0.2 + flap * 0.75), r * 0.12, r * 0.12, 0, P.accent);
    }
  }
  ctx.globalAlpha = 1;
  ell(ctx, dragon ? -r * 0.5 : -r * 0.1, 0, dragon ? r * 0.9 : r * 0.5, r * 0.12, 0, dragon ? P.base : "#1b1712");
  ell(ctx, r * 0.35, 0, r * 0.16, r * 0.14, 0, "#1b1712");
  line(ctx, r * 0.45, -r * 0.05, r * 0.8, -r * 0.3, r * 0.04, "#1b1712"); line(ctx, r * 0.45, r * 0.05, r * 0.8, r * 0.3, r * 0.04, "#1b1712");
};

// ------------------------------------------------------------------ dinosaurs
D.theropod = (ctx, r, g, P, ph, o) => {
  const len = r * 1.0, wid = r * 0.55, s = Math.sin(ph * 1.6);
  tail(ctx, -len * 0.7, r * 1.7, wid * 0.45, ph * 0.9, r * 0.35, P.base);
  ctx.lineCap = "round";
  for (const side of [-1, 1]) { const st = s * side * r * 0.45; line(ctx, -len * 0.1, side * wid * 0.6, -len * 0.1 + st, side * wid * 1.25, r * 0.3, P.dark); ell(ctx, -len * 0.1 + st + r * 0.12, side * wid * 1.25, r * 0.18, r * 0.1, 0, P.deep); }
  ell(ctx, 0, 0, len, wid, 0, P.base);
  if (o.detail) markings(ctx, o.pat || 1, len, wid, "rgba(0,0,0,.22)");
  ctx.globalAlpha = 0.5; ell(ctx, -len * 0.1, 0, len * 0.75, wid * 0.25, 0, P.dark); ctx.globalAlpha = 1;
  line(ctx, len * 0.5, -wid * 0.5, len * 0.75, -wid * 0.8, r * 0.1, P.dark); line(ctx, len * 0.5, wid * 0.5, len * 0.75, wid * 0.8, r * 0.1, P.dark);
  ell(ctx, len * 1.05, 0, r * 0.75, r * 0.42, 0, P.base);
  ctx.fillStyle = "#f4efe3"; for (let k = 0; k < 5; k++) { ell(ctx, len * (0.95 + k * 0.13), -r * 0.36, r * 0.05, r * 0.05, 0, "#f4efe3"); ell(ctx, len * (0.95 + k * 0.13), r * 0.36, r * 0.05, r * 0.05, 0, "#f4efe3"); }
  eye(ctx, len * 1.0, -r * 0.25, r * 0.11); eye(ctx, len * 1.0, r * 0.25, r * 0.11);
};
D.sauropod = (ctx, r, g, P, ph, o) => {
  const len = r * 1.0, wid = r * 0.7, s = Math.sin(ph * 0.7), nk = Math.sin(ph * 0.4) * r * 0.4;
  tail(ctx, -len * 0.8, r * 1.9, wid * 0.32, ph * 0.5, r * 0.45, P.base);
  for (const [x, y, p] of [[len * 0.5, -wid * 0.85, 1], [len * 0.5, wid * 0.85, -1], [-len * 0.5, -wid * 0.85, -1], [-len * 0.5, wid * 0.85, 1]]) ell(ctx, x + s * p * r * 0.15, y, r * 0.24, r * 0.22, 0, P.deep);
  ell(ctx, 0, 0, len, wid, 0, P.base);
  if (o.detail) markings(ctx, o.pat, len, wid, "rgba(0,0,0,.16)");
  ctx.globalAlpha = 0.45; ell(ctx, 0, 0, len * 0.75, wid * 0.32, 0, P.dark); ctx.globalAlpha = 1;
  ctx.strokeStyle = P.base; ctx.lineWidth = r * 0.36; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(len * 0.7, 0); ctx.quadraticCurveTo(len * 1.5, nk * 0.5, len * 2.1, nk); ctx.stroke();
  ell(ctx, len * 2.25, nk, r * 0.3, r * 0.2, 0, P.base);
  eye(ctx, len * 2.3, nk - r * 0.1, r * 0.06, false); eye(ctx, len * 2.3, nk + r * 0.1, r * 0.06, false);
};
D.ceratops = (ctx, r, g, P, ph, o) => {
  const len = r * 1.0, wid = r * 0.7, s = ph * 1.1;
  tail(ctx, -len * 0.85, r * 0.9, wid * 0.4, s, r * 0.2, P.dark);
  legs4(ctx, len, wid, r, s, P.deep, r * 0.3, 1.25, 0.2);
  ell(ctx, 0, 0, len, wid, 0, P.base);
  if (o.detail) markings(ctx, o.pat, len, wid, "rgba(0,0,0,.16)");
  ctx.globalAlpha = 0.45; ell(ctx, -len * 0.1, 0, len * 0.7, wid * 0.3, 0, P.dark); ctx.globalAlpha = 1;
  ctx.fillStyle = P.light; ctx.beginPath(); ctx.ellipse(len * 0.85, 0, r * 0.35, r * 0.85, 0, -Math.PI / 2, Math.PI / 2, true); ctx.fill();
  ctx.strokeStyle = P.deep; ctx.lineWidth = r * 0.06; ctx.stroke();
  ell(ctx, len * 1.1, 0, r * 0.45, r * 0.38, 0, P.base);
  ctx.fillStyle = "#efe6cf";
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(len * 1.1, side * r * 0.2); ctx.lineTo(len * 1.75, side * r * 0.35); ctx.lineTo(len * 1.15, side * r * 0.32); ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(len * 1.45, -r * 0.06); ctx.lineTo(len * 1.75, 0); ctx.lineTo(len * 1.45, r * 0.06); ctx.fill();
  eye(ctx, len * 1.12, -r * 0.24, r * 0.08); eye(ctx, len * 1.12, r * 0.24, r * 0.08);
};

// ------------------------------------------------------------------ birds
function bird(ctx, r, g, P, ph, o, raptor) {
  const flap = Math.sin(ph * (raptor ? 2 : 4)), span = r * (raptor ? 2.6 : 2) * (0.55 + 0.45 * Math.abs(flap)), sweep = raptor ? 0.15 : 0.3;
  for (const side of [-1, 1]) {
    ctx.fillStyle = P.base; ctx.beginPath(); ctx.moveTo(r * 0.3, side * r * 0.2);
    ctx.quadraticCurveTo(r * 0.2, side * span * 0.6, -r * sweep * 2, side * span);
    ctx.lineTo(-r * (0.6 + sweep), side * span * 0.85);
    ctx.quadraticCurveTo(-r * 0.4, side * span * 0.4, -r * 0.3, side * r * 0.2); ctx.fill();
    ctx.strokeStyle = P.deep; ctx.lineWidth = r * 0.07;
    for (let k = 0; k < (raptor ? 5 : 3); k++) { const t = 0.55 + k * 0.1; line(ctx, -r * sweep * 2 * t, side * span * t, -r * (sweep * 2 + 0.35) * t, side * span * (t + 0.08), r * 0.07, P.deep); }
    ell(ctx, -r * 0.05, side * span * 0.45, r * 0.25, span * 0.25, 0, P.light);
  }
  ctx.fillStyle = P.dark; ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(-r * 1.3, -r * 0.45); ctx.lineTo(-r * 1.15, 0); ctx.lineTo(-r * 1.3, r * 0.45); ctx.fill();
  ell(ctx, 0, 0, r * 0.75, r * 0.36, 0, P.base);
  ell(ctx, r * 0.7, 0, r * 0.3, r * 0.27, 0, raptor ? P.light : P.base);
  ctx.fillStyle = raptor ? "#e7b43a" : "#e8a33c"; ctx.beginPath(); ctx.moveTo(r * 0.95, -r * 0.09); ctx.lineTo(r * (raptor ? 1.2 : 1.3), 0); ctx.lineTo(r * 0.95, r * 0.09); ctx.fill();
  eye(ctx, r * 0.78, -r * 0.15, r * 0.07, false); eye(ctx, r * 0.78, r * 0.15, r * 0.07, false);
}
D.bird = (ctx, r, g, P, ph, o) => bird(ctx, r, g, P, ph, o, false);
D.raptor = (ctx, r, g, P, ph, o) => bird(ctx, r, g, P, ph, o, true);

// ------------------------------------------------------------------ mammals
function quadruped(ctx, r, P, ph, o, len, wid, opts) {
  if (opts.tail) opts.tail();
  legs4(ctx, len, wid, r, ph, P.deep, opts.legW || r * 0.22, opts.reach || 1.15, 0.05);
  ell(ctx, 0, 0, len, wid, 0, P.base);
  ctx.strokeStyle = "rgba(0,0,0,.22)"; ctx.lineWidth = r * 0.05; ctx.stroke();
  if (o.detail && opts.pattern !== false) markings(ctx, opts.pattern ?? o.pat, len, wid, opts.markCol || "rgba(0,0,0,.2)");
  ctx.globalAlpha = 0.45; ell(ctx, -len * 0.05, 0, len * 0.8, wid * 0.35, 0, P.dark); ctx.globalAlpha = 1;
  ell(ctx, len * 0.1, -wid * 0.35, len * 0.6, wid * 0.22, 0, "rgba(255,255,255,.1)");
}
D.rodent = (ctx, r, g, P, ph, o) => {
  const len = r * 0.95, wid = r * 0.6;
  ctx.strokeStyle = P.light; ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.moveTo(-len, 0); ctx.quadraticCurveTo(-len * 1.6, Math.sin(ph) * r * 0.6, -len * 2.2, Math.sin(ph * 0.7) * r * 0.3); ctx.stroke();
  quadruped(ctx, r, P, ph * 2.5, o, len, wid, { legW: r * 0.14, pattern: false });
  ell(ctx, len * 0.95, 0, r * 0.42, r * 0.34, 0, P.base);
  ell(ctx, len * 0.75, -r * 0.35, r * 0.2, r * 0.2, 0, P.light); ell(ctx, len * 0.75, r * 0.35, r * 0.2, r * 0.2, 0, P.light);
  ell(ctx, len * 1.35, 0, r * 0.07, r * 0.07, 0, "#2a1a1a");
  eye(ctx, len * 1.05, -r * 0.18, r * 0.07, false); eye(ctx, len * 1.05, r * 0.18, r * 0.07, false);
};
D.deer = (ctx, r, g, P, ph, o) => {
  const len = r * 1.05, wid = r * 0.48;
  quadruped(ctx, r, P, ph * 2, o, len, wid, { legW: r * 0.13, reach: 1.25, pattern: o.pat === 2 ? 2 : false, markCol: "rgba(255,255,255,.4)" });
  ell(ctx, -len * 0.95, 0, r * 0.18, r * 0.15, 0, "#f3eadc");
  ctx.strokeStyle = P.base; ctx.lineWidth = r * 0.26; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(len * 0.7, 0); ctx.lineTo(len * 1.2, 0); ctx.stroke();
  ell(ctx, len * 1.35, 0, r * 0.32, r * 0.22, 0, P.base);
  ell(ctx, len * 1.2, -r * 0.27, r * 0.15, r * 0.07, -0.6, P.dark); ell(ctx, len * 1.2, r * 0.27, r * 0.15, r * 0.07, 0.6, P.dark);
  if (g.size > 1.6) { ctx.strokeStyle = "#d9c7a3"; ctx.lineWidth = r * 0.07; for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(len * 1.25, side * r * 0.12); ctx.lineTo(len * 1.0, side * r * 0.65); ctx.lineTo(len * 0.8, side * r * 0.9); ctx.moveTo(len * 1.08, side * r * 0.45); ctx.lineTo(len * 1.25, side * r * 0.75); ctx.moveTo(len * 0.92, side * r * 0.75); ctx.lineTo(len * 0.95, side * r * 1.05); ctx.stroke(); } }
  ell(ctx, len * 1.62, 0, r * 0.07, r * 0.07, 0, "#1d1410");
};
D.bovid = (ctx, r, g, P, ph, o) => {
  const len = r * 1.05, wid = r * 0.62;
  quadruped(ctx, r, P, ph * 1.4, o, len, wid, { legW: r * 0.2, tail: () => line(ctx, -len, 0, -len * 1.4, Math.sin(ph) * r * 0.2, r * 0.08, P.deep) });
  ell(ctx, len * 0.55, 0, r * 0.55, wid * 0.85, 0, P.dark); // shoulder hump
  ell(ctx, len * 1.1, 0, r * 0.4, r * 0.32, 0, P.base);
  ctx.strokeStyle = "#e3d6bb"; ctx.lineWidth = r * 0.09; ctx.lineCap = "round";
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(len * 1.0, side * r * 0.25); ctx.quadraticCurveTo(len * 0.9, side * r * 0.7, len * 1.2, side * r * 0.75); ctx.stroke(); }
  ell(ctx, len * 1.42, 0, r * 0.15, r * 0.18, 0, P.deep);
};
D.elephant = (ctx, r, g, P, ph, o) => {
  const len = r * 1.0, wid = r * 0.78, ear = Math.sin(ph * 0.9) * 0.15;
  quadruped(ctx, r, P, ph * 0.9, o, len, wid, { legW: r * 0.34, reach: 1.1, pattern: false, tail: () => line(ctx, -len, 0, -len * 1.3, Math.sin(ph) * r * 0.15, r * 0.06, P.deep) });
  for (const side of [-1, 1]) ell(ctx, len * 0.75, side * wid * 0.85, r * 0.45, r * 0.6, side * (0.4 + ear), P.dark);
  ell(ctx, len * 0.95, 0, r * 0.45, r * 0.42, 0, P.base);
  ctx.strokeStyle = "#f2ecdc"; ctx.lineWidth = r * 0.1; ctx.lineCap = "round";
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(len * 1.25, side * r * 0.18); ctx.quadraticCurveTo(len * 1.6, side * r * 0.35, len * 1.75, side * r * 0.18); ctx.stroke(); }
  ctx.strokeStyle = P.base; ctx.lineWidth = r * 0.18; ctx.beginPath(); ctx.moveTo(len * 1.3, 0); ctx.quadraticCurveTo(len * 1.8, Math.sin(ph * 0.6) * r * 0.5, len * 2.0, Math.sin(ph * 0.6 + 1) * r * 0.4); ctx.stroke();
  if (g.thermal < 0.35) { ctx.strokeStyle = "rgba(90,55,30,.45)"; ctx.lineWidth = r * 0.05; for (let k = -4; k <= 4; k++) line(ctx, k * len * 0.2, -wid * 0.9, k * len * 0.2 - r * 0.1, wid * 0.9, r * 0.05, "rgba(90,55,30,.35)"); } // mammoth fur
};
D.wolf = (ctx, r, g, P, ph, o) => {
  const len = r * 1.05, wid = r * 0.45;
  quadruped(ctx, r, P, ph * 2.2, o, len, wid, { legW: r * 0.15, reach: 1.3, pattern: 3, markCol: "rgba(20,20,25,.25)", tail: () => { ctx.fillStyle = P.dark; ctx.beginPath(); ctx.ellipse(-len * 1.3, Math.sin(ph) * r * 0.15, r * 0.6, r * 0.2, Math.sin(ph) * 0.2, 0, TAU); ctx.fill(); } });
  ell(ctx, len * 1.05, 0, r * 0.36, r * 0.3, 0, P.base);
  ctx.fillStyle = P.dark; for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(len * 0.9, side * r * 0.12); ctx.lineTo(len * 0.8, side * r * 0.42); ctx.lineTo(len * 1.05, side * r * 0.25); ctx.fill(); }
  ell(ctx, len * 1.42, 0, r * 0.22, r * 0.14, 0, P.light); ell(ctx, len * 1.6, 0, r * 0.07, r * 0.07, 0, "#151515");
  eye(ctx, len * 1.18, -r * 0.14, r * 0.06, false); eye(ctx, len * 1.18, r * 0.14, r * 0.06, false);
};
D.bigcat = (ctx, r, g, P, ph, o) => {
  const len = r * 1.1, wid = r * 0.5, pat = o.pat === 0 ? 3 : o.pat;
  ctx.strokeStyle = P.base; ctx.lineWidth = r * 0.13; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-len, 0); ctx.quadraticCurveTo(-len * 1.5, Math.sin(ph) * r * 0.6, -len * 1.95, Math.sin(ph * 0.8 + 1) * r * 0.4); ctx.stroke();
  quadruped(ctx, r, P, ph * 1.9, o, len, wid, { legW: r * 0.18, reach: 1.25, pattern: pat === 3 ? false : pat, markCol: pat === 1 ? "rgba(20,15,10,.55)" : "rgba(40,25,10,.45)" });
  if (pat === 3 && g.size > 2.6) ell(ctx, len * 0.95, 0, r * 0.62, r * 0.58, 0, P.deep); // mane
  ell(ctx, len * 1.0, 0, r * 0.42, r * 0.38, 0, P.base);
  ell(ctx, len * 0.85, -r * 0.33, r * 0.12, r * 0.12, 0, P.dark); ell(ctx, len * 0.85, r * 0.33, r * 0.12, r * 0.12, 0, P.dark);
  ell(ctx, len * 1.3, 0, r * 0.17, r * 0.18, 0, P.belly);
  eye(ctx, len * 1.12, -r * 0.16, r * 0.07, false); eye(ctx, len * 1.12, r * 0.16, r * 0.07, false);
};
D.bear = (ctx, r, g, P, ph, o) => {
  const len = r * 1.0, wid = r * 0.72;
  quadruped(ctx, r, P, ph * 1.2, o, len, wid, { legW: r * 0.28, reach: 1.05, pattern: false });
  ell(ctx, len * 0.95, 0, r * 0.48, r * 0.44, 0, P.base);
  ell(ctx, len * 0.8, -r * 0.4, r * 0.15, r * 0.15, 0, P.dark); ell(ctx, len * 0.8, r * 0.4, r * 0.15, r * 0.15, 0, P.dark);
  ell(ctx, len * 1.35, 0, r * 0.2, r * 0.17, 0, P.light); ell(ctx, len * 1.52, 0, r * 0.08, r * 0.08, 0, "#120d0a");
  eye(ctx, len * 1.1, -r * 0.18, r * 0.06, false); eye(ctx, len * 1.1, r * 0.18, r * 0.06, false);
};

// ------------------------------------------------------------------ primates
D.ape = (ctx, r, g, P, ph, o) => {
  const s = Math.sin(ph * 1.6) * r * 0.35, sh = r * 0.62;
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    line(ctx, r * 0.2, side * sh * 0.8, r * 0.7 + s * side, side * sh * 1.5, r * 0.22, P.dark);
    line(ctx, -r * 0.4, side * sh * 0.5, -r * 0.6 - s * side, side * sh * 0.9, r * 0.24, P.dark);
  }
  ell(ctx, -r * 0.1, 0, r * 0.65, sh, 0, P.base);
  ell(ctx, -r * 0.15, 0, r * 0.4, sh * 0.5, 0, P.dark);
  ell(ctx, r * 0.55, 0, r * 0.36, r * 0.34, 0, P.dark);
  ell(ctx, r * 0.72, 0, r * 0.2, r * 0.22, 0, "#b08a6a");
};
D.human = (ctx, r, g, P, ph, o) => {
  const s = r * 0.95, walk = Math.sin(ph * 1.8) * (o.moving ? 1 : 0.2), sh = s * 0.5;
  const cloth = o.cloth || P.base, skin = o.skin || "#c99a74";
  ctx.lineCap = "round";
  // legs and arms swing along the facing axis
  line(ctx, -s * 0.05, -sh * 0.35, walk * s * 0.55, -sh * 0.4, s * 0.2, "#3b3229");
  line(ctx, -s * 0.05, sh * 0.35, -walk * s * 0.55, sh * 0.4, s * 0.2, "#3b3229");
  line(ctx, 0, -sh * 0.95, -walk * s * 0.45, -sh * 1.15, s * 0.16, skin);
  line(ctx, 0, sh * 0.95, walk * s * 0.45, sh * 1.15, s * 0.16, skin);
  if (o.tool) line(ctx, walk * s * 0.45, sh * 1.15, walk * s * 0.45 + s * 0.7, sh * 1.0, s * 0.08, "#7a5a36");
  ell(ctx, 0, 0, s * 0.32, sh, 0, cloth);
  ell(ctx, -s * 0.05, 0, s * 0.18, sh * 0.6, 0, "rgba(0,0,0,.15)");
  ell(ctx, s * 0.05, 0, s * 0.3, s * 0.3, 0, o.hair || "#2b1d14");
  ell(ctx, s * 0.16, 0, s * 0.17, s * 0.2, 0, skin);
};

// ------------------------------------------------------------------ added body plans
D.starfish = (ctx, r, g, P, ph) => {
  const arms = 5, rot = ph * 0.05;
  ctx.fillStyle = P.base; ctx.beginPath();
  for (let k = 0; k < arms * 2; k++) { const a = rot + (k / (arms * 2)) * TAU, rr = k % 2 ? r * 0.38 : r * 1.25; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
  for (let k = 0; k < arms; k++) { const a = rot + (k / arms) * TAU; for (let j = 1; j < 4; j++) ell(ctx, Math.cos(a) * r * 0.28 * j, Math.sin(a) * r * 0.28 * j, r * 0.07, r * 0.07, 0, P.light); }
  ell(ctx, 0, 0, r * 0.22, r * 0.22, 0, P.dark);
};
D.lobster = (ctx, r, g, P, ph, o) => {
  const len = r * 1.4, wid = r * 0.45;
  for (let k = 0; k < 5; k++) ell(ctx, -len * (0.25 + k * 0.17), 0, wid * (0.9 - k * 0.1), wid * (0.85 - k * 0.1), 0, k % 2 ? P.dark : P.base);
  ctx.fillStyle = P.dark; ctx.beginPath(); ctx.moveTo(-len * 1.05, 0); ctx.lineTo(-len * 1.35, -wid * 0.8); ctx.lineTo(-len * 1.25, 0); ctx.lineTo(-len * 1.35, wid * 0.8); ctx.fill();
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) line(ctx, len * (0.2 - k * 0.15), side * wid * 0.6, len * (0.1 - k * 0.15) + Math.sin(ph * 2 + k) * r * 0.08, side * wid * 1.5, r * 0.06, P.deep);
    line(ctx, len * 0.45, side * wid * 0.5, len * 0.85, side * wid * 1.4, r * 0.12, P.dark);
    ell(ctx, len * 1.05, side * wid * 1.5, r * 0.38, r * 0.2, side * 0.3, P.base);
    line(ctx, len * 0.6, side * wid * 0.2, len * 1.6, side * wid * (1.6 + Math.sin(ph) * 0.2), r * 0.03, P.dark);
  }
  ell(ctx, len * 0.2, 0, len * 0.5, wid, 0, P.base);
  eye(ctx, len * 0.62, -wid * 0.35, r * 0.07, false); eye(ctx, len * 0.62, wid * 0.35, r * 0.07, false);
};
D.octopus = (ctx, r, g, P, ph) => {
  ctx.lineCap = "round";
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + 0.2, w = Math.sin(ph * 1.2 + k) * 0.5;
    ctx.strokeStyle = k % 2 ? P.base : P.dark; ctx.lineWidth = r * 0.22; ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(Math.cos(a + w * 0.3) * r * 1.1, Math.sin(a + w * 0.3) * r * 1.1, Math.cos(a + w) * r * 1.8, Math.sin(a + w) * r * 1.8); ctx.stroke();
  }
  ell(ctx, -r * 0.25, 0, r * 0.85, r * 0.7, 0, P.base);
  ell(ctx, -r * 0.4, -r * 0.15, r * 0.35, r * 0.2, 0, "rgba(255,255,255,.15)");
  eye(ctx, r * 0.3, -r * 0.38, r * 0.15); eye(ctx, r * 0.3, r * 0.38, r * 0.15);
};
D.reeffish = (ctx, r, g, P, ph, o) => {
  const len = r * 1.1, wid = r * 0.85;
  fishBody(ctx, len, wid, P, ph * 2, wid * 0.3);
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, len, wid, 0, 0, TAU); ctx.clip();
  for (let k = -1; k <= 1; k++) ell(ctx, k * len * 0.55, 0, len * 0.09, wid, 0, "rgba(255,255,255,.85)");
  ctx.restore();
  eye(ctx, len * 0.62, -wid * 0.35, r * 0.15); eye(ctx, len * 0.62, wid * 0.35, r * 0.15);
};
D.eel = (ctx, r, g, P, ph) => {
  const n = 9;
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = P.base; ctx.lineWidth = r * 0.45; ctx.beginPath();
  for (let k = 0; k < n; k++) { const x = r * 1.2 - k * r * 0.42, y = Math.sin(ph * 1.6 - k * 0.7) * r * 0.45 * (k / n); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke(); ctx.strokeStyle = P.light; ctx.lineWidth = r * 0.1; ctx.stroke();
  ell(ctx, r * 1.3, 0, r * 0.35, r * 0.26, 0, P.base);
  eye(ctx, r * 1.38, -r * 0.14, r * 0.07, false); eye(ctx, r * 1.38, r * 0.14, r * 0.07, false);
};
D.ray = (ctx, r, g, P, ph, o) => {
  const s = Math.sin(ph * 0.9) * 0.18, span = r * 1.7;
  ctx.fillStyle = P.base; ctx.beginPath(); ctx.moveTo(r * 0.9, 0);
  ctx.quadraticCurveTo(r * 0.3, -span * (1 + s), -r * 0.4, -span * (0.95 + s)); ctx.quadraticCurveTo(-r * 0.3, -span * 0.3, -r * 0.8, 0);
  ctx.quadraticCurveTo(-r * 0.3, span * 0.3, -r * 0.4, span * (0.95 + s)); ctx.quadraticCurveTo(r * 0.3, span * (1 + s), r * 0.9, 0); ctx.fill();
  line(ctx, -r * 0.7, 0, -r * 2.4, Math.sin(ph) * r * 0.3, r * 0.07, P.dark);
  if (o.detail) markings(ctx, 2, r * 0.8, span * 0.8, "rgba(255,255,255,.22)");
  eye(ctx, r * 0.45, -r * 0.22, r * 0.07, false); eye(ctx, r * 0.45, r * 0.22, r * 0.07, false);
};
D.snake = (ctx, r, g, P, ph, o) => {
  const n = 12; ctx.lineCap = "round"; ctx.lineJoin = "round";
  const pts = []; for (let k = 0; k < n; k++) pts.push([r * 1.1 - k * r * 0.38, Math.sin(ph * 1.2 - k * 0.65) * r * 0.55]);
  ctx.strokeStyle = P.dark; ctx.lineWidth = r * 0.42; ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  ctx.strokeStyle = P.base; ctx.lineWidth = r * 0.32; ctx.stroke();
  if (o.detail) for (let k = 1; k < n - 1; k += 2) ell(ctx, pts[k][0], pts[k][1], r * 0.12, r * 0.1, 0, P.deep);
  ell(ctx, r * 1.25, pts[0][1], r * 0.32, r * 0.24, 0, P.base);
  if (Math.sin(ph * 0.7) > 0.6) line(ctx, r * 1.5, pts[0][1], r * 1.85, pts[0][1], r * 0.05, "#c8324b");
  eye(ctx, r * 1.35, pts[0][1] - r * 0.13, r * 0.06, false); eye(ctx, r * 1.35, pts[0][1] + r * 0.13, r * 0.06, false);
};
function arachnid(ctx, r, P, ph, sting) {
  ctx.lineCap = "round";
  for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
    const x = r * (0.35 - k * 0.22), sw = Math.sin(ph * 3 + k * 1.3 + (side > 0 ? 0 : 1.5)) * r * 0.15;
    ctx.strokeStyle = P.deep; ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.moveTo(x, side * r * 0.2);
    ctx.quadraticCurveTo(x + r * 0.1, side * r * 0.85, x + sw - r * 0.15 + (k - 1.5) * r * 0.15, side * r * 1.25); ctx.stroke();
  }
  if (sting) {
    for (let k = 0; k < 5; k++) ell(ctx, -r * (0.6 + k * 0.28), Math.sin(ph + k * 0.4) * r * 0.05 * k, r * (0.2 - k * 0.02), r * (0.18 - k * 0.02), 0, P.base);
    ell(ctx, -r * 1.85, 0, r * 0.12, r * 0.12, 0, P.deep);
    for (const side of [-1, 1]) { line(ctx, r * 0.4, side * r * 0.2, r * 0.85, side * r * 0.6, r * 0.09, P.dark); ell(ctx, r * 1.0, side * r * 0.62, r * 0.22, r * 0.12, side * 0.4, P.base); }
    ell(ctx, 0, 0, r * 0.55, r * 0.35, 0, P.base);
  } else {
    ell(ctx, -r * 0.45, 0, r * 0.6, r * 0.52, 0, P.base);
    ell(ctx, -r * 0.5, 0, r * 0.25, r * 0.12, 0, P.light);
    ell(ctx, r * 0.25, 0, r * 0.32, r * 0.28, 0, P.dark);
  }
  for (const side of [-1, 1]) ell(ctx, r * 0.45, side * r * 0.08, r * 0.05, r * 0.05, 0, "#e9e4d8");
}
D.spider = (ctx, r, g, P, ph) => arachnid(ctx, r, P, ph, false);
D.scorpion = (ctx, r, g, P, ph) => arachnid(ctx, r, P, ph, true);
D.snail = (ctx, r, g, P, ph) => {
  const s = Math.sin(ph * 0.5) * r * 0.05;
  ell(ctx, r * 0.1 + s, 0, r * 1.25, r * 0.35, 0, "#b9a58a");
  line(ctx, r * 1.2, -r * 0.12, r * 1.55, -r * 0.3, r * 0.06, "#8f7d64"); line(ctx, r * 1.2, r * 0.12, r * 1.55, r * 0.3, r * 0.06, "#8f7d64");
  ell(ctx, -r * 0.15, 0, r * 0.8, r * 0.75, 0, P.base);
  ctx.strokeStyle = P.deep; ctx.lineWidth = r * 0.1; ctx.beginPath();
  for (let k = 0; k < 40; k++) { const a = k * 0.32, rr = r * 0.72 * (1 - k / 44); ctx.lineTo(-r * 0.15 + Math.cos(a) * rr, Math.sin(a) * rr); } ctx.stroke();
};
D.giraffe = (ctx, r, g, P, ph, o) => {
  const len = r * 0.95, wid = r * 0.5;
  quadruped(ctx, r, P, ph * 1.5, o, len, wid, { legW: r * 0.12, reach: 1.2, pattern: 2, markCol: "rgba(95,45,15,.6)", tail: () => line(ctx, -len, 0, -len * 1.4, Math.sin(ph) * r * 0.15, r * 0.05, P.deep) });
  const hx = len * 1.9, hy = Math.sin(ph * 0.4) * r * 0.15;
  ctx.strokeStyle = P.base; ctx.lineWidth = r * 0.26; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(len * 0.6, 0); ctx.lineTo(hx, hy); ctx.stroke();
  for (let k = 1; k < 4; k++) ell(ctx, len * 0.6 + (hx - len * 0.6) * k / 4, hy * k / 4, r * 0.08, r * 0.08, 0, "rgba(95,45,15,.6)");
  ell(ctx, hx + r * 0.2, hy, r * 0.32, r * 0.17, 0, P.base);
  line(ctx, hx, hy - r * 0.1, hx - r * 0.12, hy - r * 0.25, r * 0.06, P.deep); line(ctx, hx, hy + r * 0.1, hx - r * 0.12, hy + r * 0.25, r * 0.06, P.deep);
};
D.penguin = (ctx, r, g, P, ph, o) => {
  const s = Math.sin(ph * 2) * 0.25;
  ell(ctx, 0, -r * 0.55, r * 0.45, r * 0.13, 0.4 + s, P.base); ell(ctx, 0, r * 0.55, r * 0.45, r * 0.13, -0.4 - s, P.base);
  ell(ctx, 0, 0, r * 0.8, r * 0.55, 0, P.base);
  ell(ctx, r * 0.05, 0, r * 0.55, r * 0.32, 0, "#f3f1ea");
  ell(ctx, r * 0.6, 0, r * 0.3, r * 0.28, 0, P.base);
  ell(ctx, r * 0.55, -r * 0.2, r * 0.1, r * 0.06, 0, "#f2b134"); ell(ctx, r * 0.55, r * 0.2, r * 0.1, r * 0.06, 0, "#f2b134");
  ctx.fillStyle = "#e89b2c"; ctx.beginPath(); ctx.moveTo(r * 0.85, -r * 0.06); ctx.lineTo(r * 1.1, 0); ctx.lineTo(r * 0.85, r * 0.06); ctx.fill();
};
D.seal = (ctx, r, g, P, ph, o) => {
  const s = Math.sin(ph * 1.3);
  ell(ctx, -r * 1.25, s * r * 0.15 - r * 0.2, r * 0.35, r * 0.12, 0.5, P.dark); ell(ctx, -r * 1.25, s * r * 0.15 + r * 0.2, r * 0.35, r * 0.12, -0.5, P.dark);
  ell(ctx, r * 0.35, -r * 0.5, r * 0.32, r * 0.12, -0.8, P.dark); ell(ctx, r * 0.35, r * 0.5, r * 0.32, r * 0.12, 0.8, P.dark);
  ctx.fillStyle = P.base; ctx.beginPath(); ctx.moveTo(r * 1.0, 0); ctx.bezierCurveTo(r * 0.9, -r * 0.65, -r * 0.6, -r * 0.6, -r * 1.15, s * r * 0.15); ctx.bezierCurveTo(-r * 0.6, r * 0.6, r * 0.9, r * 0.65, r * 1.0, 0); ctx.fill();
  if (o.detail) markings(ctx, 2, r * 0.9, r * 0.5, "rgba(0,0,0,.18)");
  ell(ctx, r * 1.0, 0, r * 0.34, r * 0.3, 0, P.base); ell(ctx, r * 1.3, 0, r * 0.07, r * 0.07, 0, "#151515");
  eye(ctx, r * 1.12, -r * 0.15, r * 0.07, false); eye(ctx, r * 1.12, r * 0.15, r * 0.07, false);
};
// close relatives drawn with the nearest existing art from above
D.salamander = D.lizard; D.stego = D.ceratops; D.pterosaur = D.raptor; D.bat = D.raptor; D.parrot = D.bird; D.wader = D.bird; D.ratite = D.bird;
D.rabbit = D.rodent; D.boar = D.bovid; D.horse = D.deer; D.camel = D.bovid; D.rhino = D.bovid; D.mammoth = D.elephant; D.fox = D.wolf;
D.monkey = D.ape; D.hippo = D.bovid; D.capybara = D.rodent; D.dolphin = D.shark;

export const DRAW = D;

/** Low-detail silhouette for far zoom: body + head blob, cheap but recognisable by colour and shape. */
export function drawSimple(ctx, r, arch, P) {
  ctx.fillStyle = P.base;
  ctx.beginPath();
  if (arch === "shark" || arch === "whale" || arch === "dolphin" || arch === "eel" || arch === "snake" || arch === "fish" || arch === "predfish" || arch === "croc" || arch === "lizard" || arch === "squid") ctx.ellipse(0, 0, r * 1.5, r * 0.6, 0, 0, TAU);
  else if (arch === "bird" || arch === "raptor" || arch === "parrot" || arch === "bat" || arch === "pterosaur") { ctx.moveTo(r * 0.8, 0); ctx.lineTo(-r * 0.6, -r * 1.4); ctx.lineTo(-r * 0.2, 0); ctx.lineTo(-r * 0.6, r * 1.4); }
  else ctx.ellipse(0, 0, r * 1.1, r * 0.8, 0, 0, TAU);
  ctx.fill();
}

/** Things that are drawn with a ground shadow and the height (in r) they float above it. */
export const SHADOW = { capybara: 0.12, salamander: 0.12, seal: 0.12, hippo: 0.2, penguin: 0.15, spider: 0.08, scorpion: 0.08, snail: 0.08, snake: 0.06, stego: 0.22, pterosaur: 2.2, parrot: 1.8, wader: 0.25, ratite: 0.25, bat: 1.6, rabbit: 0.12, boar: 0.18, horse: 0.22, camel: 0.22, giraffe: 0.3, rhino: 0.2, mammoth: 0.25, fox: 0.18, monkey: 0.15, frog: 0.15, croc: 0.12, turtle: 0.12, insect: 0.1, flyinsect: 1.6, lizard: 0.12, ceratops: 0.2, sauropod: 0.25, theropod: 0.25, bird: 1.8, raptor: 2.2, rodent: 0.12, deer: 0.2, bovid: 0.2, elephant: 0.25, wolf: 0.2, bigcat: 0.2, bear: 0.2, ape: 0.15, human: 0.15 };
