// Small live charts drawn on canvas. Colours: validated categorical slots for the food-web roles.
export const ROLE_COLORS = ["#199e70", "#c98500", "#9085e9"]; // herbivore, omnivore, carnivore
export const ROLE_NAMES = ["กินพืช", "กินทั้งพืชและสัตว์", "ผู้ล่า"];

function setup(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), r = canvas.getBoundingClientRect();
  const w = Math.max(10, r.width), h = Math.max(10, r.height);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function niceMax(v) {
  if (v <= 0) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** Stacked area of population by role. Returns the hovered sample index (or -1). */
export function drawPopulationChart(canvas, history, hoverX = null) {
  const { ctx, w, h } = setup(canvas);
  const pad = { l: 34, r: 8, t: 8, b: 16 };
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
  if (history.length < 2) { ctx.fillStyle = "#91a3bd"; ctx.font = "12px 'IBM Plex Sans Thai'"; ctx.fillText("กำลังเก็บข้อมูล…", pad.l, h / 2); return -1; }
  const max = niceMax(Math.max(...history.map((s) => s.n)) * 1.05);
  const X = (i) => pad.l + (i / (history.length - 1)) * pw, Y = (v) => pad.t + ph - (v / max) * ph;
  // grid
  ctx.strokeStyle = "rgba(145,163,189,.14)"; ctx.lineWidth = 1; ctx.fillStyle = "#91a3bd"; ctx.font = "10px 'Space Grotesk', sans-serif"; ctx.textAlign = "right";
  for (let k = 0; k <= 2; k++) { const v = (max * k) / 2, y = Y(v); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); ctx.fillText(v >= 1000 ? (v / 1000).toFixed(1) + "K" : v, pad.l - 5, y + 3); }
  // stacked areas with a thin surface gap between bands
  const base = new Array(history.length).fill(0);
  for (let r = 0; r < 3; r++) {
    const top = history.map((s, i) => base[i] + s.roles[r]);
    ctx.beginPath();
    history.forEach((s, i) => (i ? ctx.lineTo(X(i), Y(top[i])) : ctx.moveTo(X(i), Y(top[i]))));
    for (let i = history.length - 1; i >= 0; i--) ctx.lineTo(X(i), Y(base[i]));
    ctx.closePath(); ctx.fillStyle = ROLE_COLORS[r] + "cc"; ctx.fill();
    ctx.beginPath(); history.forEach((s, i) => (i ? ctx.lineTo(X(i), Y(top[i])) : ctx.moveTo(X(i), Y(top[i]))));
    ctx.strokeStyle = "#0d1626"; ctx.lineWidth = 1.5; ctx.stroke();
    for (let i = 0; i < base.length; i++) base[i] = top[i];
  }
  ctx.textAlign = "left"; ctx.fillStyle = "#91a3bd";
  const span = (history[history.length - 1].t - history[0].t) / 30 / 60;
  ctx.fillText(`${span.toFixed(span < 10 ? 1 : 0)} นาทีที่แล้ว`, pad.l, h - 3); ctx.textAlign = "right"; ctx.fillText("ตอนนี้", w - pad.r, h - 3);
  if (hoverX === null || hoverX < pad.l || hoverX > w - pad.r) return -1;
  const i = Math.round(((hoverX - pad.l) / pw) * (history.length - 1));
  ctx.strokeStyle = "rgba(234,241,255,.55)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(i), pad.t); ctx.lineTo(X(i), pad.t + ph); ctx.stroke();
  return i;
}

/** Single-series line (e.g. plant biomass or civilisation population). */
export function drawLineChart(canvas, values, color = "#3987e5") {
  const { ctx, w, h } = setup(canvas);
  if (values.length < 2) return;
  const pad = { l: 4, r: 4, t: 6, b: 4 };
  const max = Math.max(...values) * 1.1 || 1, min = Math.min(0, ...values);
  const X = (i) => pad.l + (i / (values.length - 1)) * (w - pad.l - pad.r), Y = (v) => pad.t + (h - pad.t - pad.b) * (1 - (v - min) / (max - min));
  ctx.beginPath(); values.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
  ctx.lineTo(X(values.length - 1), h); ctx.lineTo(X(0), h); ctx.closePath(); ctx.fillStyle = color + "22"; ctx.fill();
}

export function sparkSVG(values, color) {
  if (!values || values.length < 2) return "";
  const max = Math.max(1, ...values), w = 80, h = 22;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" class="spark" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
