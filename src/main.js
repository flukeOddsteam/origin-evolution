import { ERAS, UPGRADES, TECHS, POWERS, GUIDE_GENES } from "./data.js";
import { Game, format, RES_TH, VERSION } from "./game.js";
import { TICKS_PER_SECOND as TPS, MODE_TH } from "./sim/sim.js";
import { GENES, GENE_KEYS, ROLE_TH, TIER_TH } from "./sim/genes.js";
import { SETTLEMENT_LEVELS, capsFor } from "./sim/eras.js";
import { Renderer, DAY_TICKS } from "./render.js";
import { Renderer3D, webglAvailable } from "./render3d.js";
import { ARCH, ARCH_KEYS } from "./sim/archetypes.js";
import { BIOMES } from "./sim/world.js";
import { drawPopulationChart, drawLineChart, sparkSVG, ROLE_COLORS, ROLE_NAMES } from "./chart.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SETTINGS_KEY = "originSettings_v3";

// ------------------------------------------------------------ state
let settings = { compact: true, effects: true, bg: true, weather: true, view: "planet", theme: "dark", seenHelp: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}); } catch { /* storage unavailable */ }
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ } };
function applyTheme() { document.documentElement.dataset.uiTheme = settings.theme; }
applyTheme();

let { game, restored, savedAt } = Game.load();
let sim = game.sim;
const map2d = new Renderer($("world"), sim);
let map3d = null, renderer = map2d;
map2d.effects = settings.effects; map2d.weather = settings.weather;
const has3D = webglAvailable();

let booting = true;
const VIEWS = ["planet", "3d", "2d"];
/** Switch between the round planet, the flat 3D landscape and the 2D map, carrying camera and selection across. */
function setView(mode) {
  if (mode === true) mode = "3d"; else if (mode === false) mode = "2d";
  if (!VIEWS.includes(mode)) mode = "planet";
  if (mode !== "2d" && !has3D) { toast("เบราว์เซอร์นี้ไม่รองรับ 3D (WebGL) จึงใช้แผนที่ 2D"); mode = "2d"; }
  if (mode !== "2d" && !map3d) {
    try { map3d = new Renderer3D($("world3d"), sim, map2d); }
    catch (err) { console.warn("3D init failed", err); toast("เปิดมุมมอง 3D ไม่สำเร็จ จึงใช้แผนที่ 2D"); mode = "2d"; }
  }
  const from = renderer, to = mode === "2d" ? map2d : map3d, wasGlobe = from === map3d && map3d.globe;
  if (to === map3d) map3d.setGlobe(mode === "planet");
  if (from !== to || wasGlobe !== (mode === "planet")) {
    to.selected = from.selected; to.follow = from.follow;
    to.effects = settings.effects; to.weather = settings.weather;
    $("world").hidden = mode !== "2d"; $("world3d").hidden = mode === "2d";
    renderer = to; to.resize();
    if (mode === "planet") { to.cam.x = from.cam.x; to.cam.y = from.cam.y; if (!from.selected) { to.fitWorld(); if (booting) to.faceSun(); } else to.focus(from.cam.x, from.cam.y, 4); }
    else to.focus(from.cam.x, from.cam.y, from === map2d ? Math.max(to.minZoom(), from.cam.zoom * 0.9) : to === map2d ? Math.max(map2d.fit, Math.min(6, from.cam.zoom)) : Math.max(to.minZoom(), Math.min(8, from.cam.zoom)));
  }
  for (const b of document.querySelectorAll("#viewGroup [data-view]")) b.classList.toggle("on", b.dataset.view === mode);
  $("rotGroup").hidden = mode === "2d";
  settings.view = mode; saveSettings();
}
const currentView = () => (renderer === map2d ? "2d" : map3d.globe ? "planet" : "3d");
let speed = 1, tool = "inspect", seedSpecies = null, activeTab = "map", catchingUp = false, logFilter = "all";
let selectedSettlement = null, chartHover = null;
const incomeLog = []; // [time, dna, energy, knowledge]
const fmt = (n) => format(n, settings.compact);
const simClock = (tick) => { const s = Math.floor(tick / TPS), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`; };
const calDate = (tick) => { const day = Math.floor(tick / DAY_TICKS); return { year: Math.floor(day / 100) + 1, day: (day % 100) + 1 }; };
const tempC = (off) => (15 + off * 40).toFixed(1) + "°C";
const spColor = (sp, l = 60) => `hsl(${sp.hue | 0},62%,${l}%)`;

/** In-page confirmation (native confirm() is unavailable in some embeds). */
function ask(title, text, okLabel = "ยืนยัน") {
  return new Promise((resolve) => {
    const d = $("confirmDialog");
    $("confirmTitle").textContent = title; $("confirmText").textContent = text; $("confirmOk").textContent = okLabel;
    d.returnValue = "";
    d.addEventListener("close", () => resolve(d.returnValue === "ok"), { once: true });
    d.showModal();
  });
}
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove("show"), 2400); }
function result(r, okMsg) { if (r === true) { if (okMsg) toast(okMsg); refreshNow(); return true; } toast(r); return false; }

// ------------------------------------------------------------ simulation loop
function absorbEvents() {
  let any = false;
  for (const e of sim.drainEvents()) {
    game.log(e.text, e.type); any = true;
    if (e.type === "speciation") { if (performance.now() - (absorbEvents.lastSp || 0) < 5000) continue; absorbEvents.lastSp = performance.now(); }
    ticker(e.text, e.type);
  }
  if (any) renderLog();
}
function collect() {
  const g = game.collect();
  incomeLog.push([performance.now(), g.dna, g.energy, g.knowledge]);
  while (incomeLog.length && performance.now() - incomeLog[0][0] > 5000) incomeLog.shift();
}
function rates() {
  if (incomeLog.length < 2) return { dna: 0, energy: 0, knowledge: 0 };
  const span = Math.max(0.5, (performance.now() - incomeLog[0][0]) / 1000);
  const r = { dna: 0, energy: 0, knowledge: 0 };
  for (const [, d, e, k] of incomeLog) { r.dna += d; r.energy += e; r.knowledge += k; }
  for (const k in r) r[k] /= span;
  return r;
}

let last = performance.now(), acc = 0, lastFast = 0, lastHeavy = 0, tpsWindow = [];
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (!catchingUp && speed > 0) {
    acc = Math.min(acc + dt * TPS * speed, TPS * speed * 0.35 + 2);
    const start = performance.now(); let n = 0;
    while (acc >= 1 && performance.now() - start < 13) { sim.step(); acc--; n++; }
    if (acc > 3) acc = 3; // could not keep up — drop backlog instead of spiralling
    tpsWindow.push([now, n]);
  }
  while (tpsWindow.length && now - tpsWindow[0][0] > 1500) tpsWindow.shift();
  if (!catchingUp) { collect(); absorbEvents(); }
  if (catchingUp) { requestAnimationFrame(frame); return; } // the overlay covers the map; give the CPU to the simulation
  if (activeTab !== "map") map2d.tickTexture(); // keep the minimap fresh without drawing the hidden world
  else if (renderer === map3d) { map2d.tickTexture(); map3d.draw(now); } else map2d.draw(now);
  if (now - lastFast > 250) { lastFast = now; updateFast(); }
  if (now - lastHeavy > 1000) { lastHeavy = now; updateHeavy(); }
  requestAnimationFrame(frame);
}

// keep the world alive when the tab is hidden (rAF pauses there)
setInterval(() => {
  if (!document.hidden || !settings.bg || speed === 0 || catchingUp) return;
  const want = TPS * speed, start = performance.now();
  for (let k = 0; k < want && performance.now() - start < 250; k++) sim.step();
  collect(); absorbEvents();
}, 1000);

// ------------------------------------------------------------ catch-up after being away
function catchUp(seconds) {
  const maxTicks = 18000; // 10 simulated minutes at most; the rest is paid out as resources
  const ticks = Math.min(maxTicks, Math.floor(seconds * TPS));
  if (ticks < TPS * 5) return;
  catchingUp = true;
  $("catchup").hidden = false;
  const before = { births: sim.totals.births, deaths: sim.totals.deaths, species: sim.totals.species, extinct: sim.totals.extinct, settl: sim.settlements.length, res: { ...game.state.res } };
  let done = 0;
  const chunk = () => {
    const start = performance.now();
    while (done < ticks && performance.now() - start < 80) { sim.step(); done++; }
    sim.drainEvents().slice(-30).forEach((e) => game.log(e.text, e.type));
    game.collect();
    $("catchupBar").style.width = (done / ticks * 100).toFixed(1) + "%";
    $("catchupText").textContent = `จำลองแล้ว ${simClock(done)} จาก ${simClock(ticks)}`;
    if (done < ticks) return setTimeout(chunk, 0);
    // pay out the time that was not simulated at a reduced rate
    const simulatedSec = ticks / TPS, rest = Math.min(8 * 3600, seconds) - simulatedSec;
    const bonus = {};
    if (rest > 0) for (const k of ["dna", "energy", "knowledge"]) { bonus[k] = ((game.state.res[k] - before.res[k]) / simulatedSec) * rest * 0.5; game.state.res[k] += bonus[k]; }
    catchingUp = false;
    $("catchup").hidden = true;
    const away = seconds >= 3600 ? `${(seconds / 3600).toFixed(1)} ชั่วโมง` : `${Math.round(seconds / 60)} นาที`;
    $("welcomeBody").innerHTML = `<p class="muted">คุณไม่อยู่ ${away} ระหว่างนั้นโลกยังคงวิวัฒนาการต่อ</p>
      <div class="welcome-grid">
        <div class="stat"><small>เกิดใหม่</small><strong>${fmt(sim.totals.births - before.births)}</strong></div>
        <div class="stat"><small>ตาย</small><strong>${fmt(sim.totals.deaths - before.deaths)}</strong></div>
        <div class="stat"><small>สายพันธุ์ใหม่</small><strong>${fmt(sim.totals.species - before.species)}</strong></div>
        <div class="stat"><small>สูญพันธุ์</small><strong>${fmt(sim.totals.extinct - before.extinct)}</strong></div>
      </div>
      <p class="tiny muted">ได้รับ ${["dna", "energy", "knowledge"].map((k) => `${RES_TH[k]} +${fmt(game.state.res[k] - before.res[k])}`).join(" · ")}</p>`;
    $("welcomeDialog").showModal();
    game.save();
  };
  chunk();
}


// ------------------------------------------------------------ message log (right column)
const LOG_STYLE = {
  speciation: ["has-info", "evo"], innovation: ["has-special", "evo"], discovery: ["has-special", "evo"], sapient: ["has-special", "evo"], era: ["has-warning", "evo"],
  extinction: ["has-danger", "death"], disease: ["has-danger", "death"], meteor: ["has-danger", "death"], ruin: ["has-danger", "civ"],
  climate: ["has-caution", "climate"], bloom: ["has-success", "climate"],
  settlement: ["has-warning", "civ"], space: ["has-warning", "civ"],
  upgrade: ["has-link", "you"], tech: ["has-link", "you"], guide: ["has-link", "you"], power: ["has-link", "you"], info: ["", "you"],
};
function renderLog() {
  const rows = game.state.log.filter((l) => logFilter === "all" || (LOG_STYLE[l.type] || ["", "you"])[1] === logFilter).slice(0, 120);
  setHTML($("msgLog"), rows.map((l) => `<p class="msg ${(LOG_STYLE[l.type] || [""])[0]}"><time>${simClock(l.t)}</time>${esc(l.text)}</p>`).join("") || `<p class="msg muted">ยังไม่มีเหตุการณ์ในหมวดนี้</p>`);
}
function ticker(text, type) { // phones only (the log column is below the fold there)
  const box = $("ticker");
  if (getComputedStyle(box).display === "none") return;
  const el = document.createElement("div");
  el.className = "tick-item"; el.textContent = text;
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), 6800);
}

// ------------------------------------------------------------ Evolve-style action buttons + tooltips
/** o = { attrs, name, cost?, count?, can, locked?, done?, on?, tip } — tip is a key resolved by tipHTML() on hover. */
function action(o) {
  const cls = ["action-btn", o.small ? "small" : "", o.locked ? "locked" : "", o.done ? "done" : "", !o.locked && !o.done && !o.can ? "cna" : "", o.on ? "on" : ""].join(" ");
  return `<button class="${cls}" ${o.attrs || ""} ${o.tip ? `data-tip="${esc(o.tip)}"` : ""} ${o.locked ? "aria-disabled=\"true\"" : ""}><span class="aname">${o.name}</span>${o.cost ? `<span class="acost">${o.cost}</span>` : ""}${o.count !== undefined ? `<span class="count">${o.count}</span>` : ""}</button>`;
}
const costLine = (amount, res) => { const have = game.state.res[res] >= amount; return `<div class="tt-row"><span>${RES_TH[res]}</span><span class="${have ? "" : "has-danger"}">${fmt(amount)}</span></div>`; };
function tipHTML(key) {
  const [kind, id, extra] = key.split(":");
  if (kind === "upgrade") {
    const u = UPGRADES.find((x) => x.id === id), n = game.state.upgrades[id] || 0;
    if (!u) return "";
    return `<div class="tt-title">${u.icon} ${u.name} <span class="muted">${n}/${u.max}</span></div><div class="tt-desc">${u.desc}</div>${sim.era < u.era ? `<div class="has-danger">ปลดล็อกใน ERA ${u.era + 1}</div>` : n >= u.max ? `<div class="has-success">ถึงระดับสูงสุดแล้ว</div>` : costLine(game.upgradeCost(u), u.res)}`;
  }
  if (kind === "tech") {
    const t = TECHS.find((x) => x.id === id);
    if (!t) return "";
    return `<div class="tt-title">${t.icon} ${t.name}</div><div class="tt-desc">${t.desc}</div><div class="tt-effect">${t.bonus}</div>${game.state.techs[id] ? `<div class="has-success">วิจัยแล้ว</div>` : sim.era < t.era ? `<div class="has-danger">ปลดล็อกใน ERA ${t.era + 1}</div>` : costLine(t.cost, "knowledge")}`;
  }
  if (kind === "mutation") return `<div class="tt-title">🧪 เพิ่มอัตราการกลายพันธุ์</div><div class="tt-desc">ลูกกลายพันธุ์บ่อยและแรงขึ้น ปรับตัวเร็วขึ้นและแตกสายพันธุ์บ่อยขึ้น แต่ลูกที่ด้อยกว่าก็มากขึ้น · DNA +6% ต่อระดับ</div>${game.state.mutation >= 10 ? `<div class="has-success">ถึงระดับสูงสุดแล้ว</div>` : costLine(game.mutationCost(), "dna")}`;
  if (kind === "mutagen") return `<div class="tt-title">☢️ รังสีเร่งการกลายพันธุ์</div><div class="tt-desc">45 วินาทีจำลองที่อัตรากลายพันธุ์สูงขึ้น 3 เท่า เหมาะเมื่อโลกเปลี่ยนเร็ว เช่น ยุคน้ำแข็ง</div>${costLine(game.mutagenCost(), "dna")}`;
  if (kind === "guide") { const g = GUIDE_GENES.find((x) => x.gene === id); return `<div class="tt-title">🎯 ${GENES[id].label} ${+extra > 0 ? "↑" : "↓"}</div><div class="tt-desc">${+extra > 0 ? g.up : g.down} — ผลักลูกที่เกิดใหม่ทั้งโลกไปทางนี้เป็นเวลา 90 วินาทีจำลอง</div>${costLine(game.guideCost(), "dna")}`; }
  if (kind === "climate") return `<div class="tt-title">${+id > 0 ? "🔥 ทำให้โลกอุ่นขึ้น" : "❄️ ทำให้โลกเย็นลง"}</div><div class="tt-desc">เปลี่ยนอุณหภูมิทั้งโลก ไบโอมจะเลื่อนตาม สิ่งมีชีวิตที่ทนไม่ได้ต้องปรับตัวหรือสูญพันธุ์</div>${costLine(game.climateCost(), "energy")}`;
  if (kind === "evolve") { const e = ERAS[sim.era]; return `<div class="tt-title">${e.icon} → ${ERAS[sim.era + 1]?.icon || "✧"} ${ERAS[sim.era + 1]?.name || ""}</div><div class="tt-desc">${e.unlock}</div>`; }
  if (kind === "prestige") return `<div class="tt-title">🌌 เริ่มวัฏจักรใหม่</div><div class="tt-desc">สร้างดาวดวงใหม่ รับเศษซากจักรวาล ${game.prestigeGain()} ชิ้นเป็นโบนัสถาวร</div>`;
  return "";
}
let tipEl = null;
function showTip(el) {
  const html = tipHTML(el.dataset.tip);
  const tt = $("tooltip");
  if (!html) { tt.hidden = true; return; }
  tt.innerHTML = html; tt.hidden = false; tipEl = el;
  const r = el.getBoundingClientRect(), w = tt.offsetWidth, h = tt.offsetHeight;
  let x = r.left + r.width / 2 - w / 2, y = r.top - h - 8;
  if (y < 4) y = r.bottom + 8;
  tt.style.left = Math.max(4, Math.min(window.innerWidth - w - 4, x)) + "px"; tt.style.top = y + "px";
}
document.addEventListener("pointerover", (e) => { const el = e.target.closest?.("[data-tip]"); if (el && e.pointerType === "mouse") showTip(el); else if (!el) { $("tooltip").hidden = true; tipEl = null; } });
document.addEventListener("focusin", (e) => { const el = e.target.closest?.("[data-tip]"); if (el) showTip(el); });
document.addEventListener("focusout", () => { $("tooltip").hidden = true; tipEl = null; });

// ------------------------------------------------------------ top bar, resources, era (4 Hz)
function updateFast() {
  const era = ERAS[sim.era];
  $("topEraIcon").textContent = era.icon; $("topEraName").textContent = era.name;
  const d = calDate(sim.tick);
  $("calYear").textContent = `ปีที่ ${d.year}`; $("calDay").textContent = `วันที่ ${d.day}`;
  $("calSky").textContent = `${renderer.night() > 0.5 ? "🌙" : "☀️"} ${renderer.dayLabel()}`;
  $("calTemp").textContent = tempC(sim.climate.offset);
  $("calTemp").className = sim.climate.offset < -0.08 ? "has-info" : sim.climate.offset > 0.08 ? "has-danger" : "has-warning";
  $("liveDot").classList.toggle("paused", speed === 0);
  const real = tpsWindow.reduce((a, [, n]) => a + n, 0) / 1.5 / TPS;
  $("speedReal").textContent = speed > 1 && real < speed * 0.8 ? `≈${real.toFixed(1)}×` : "";

  renderResources();
  renderEra();
  if (activeTab === "map") { renderTools(); renderInspector(); }
  if (activeTab === "stats") renderStatsLive();
  renderer.drawMinimap($("minimap"));
  if (tipEl && document.body.contains(tipEl)) showTip(tipEl);
}

function renderResources() {
  const r = rates(), st = sim.stats;
  const row = (name, val, rate, title = "") => `<div class="res-row" ${title ? `title="${esc(title)}"` : ""}><span class="rname">${name}</span><span class="rval">${val}</span><span class="rrate ${rate && rate.startsWith("-") ? "neg" : ""}">${rate || ""}</span></div>`;
  let html = `<div class="res-group">ทรัพยากร</div>`;
  html += row("🧬 DNA", fmt(game.state.res.dna), `+${fmt(r.dna)}/s`, "ได้จากการเกิดและสายพันธุ์ใหม่");
  html += row("⚡ พลังงาน", fmt(game.state.res.energy), `+${fmt(r.energy)}/s`, "ได้จากการกินและการสังเคราะห์แสง");
  if (sim.era >= 4 || game.state.res.knowledge > 0) html += row("🔬 ความรู้", fmt(game.state.res.knowledge), `+${fmt(r.knowledge)}/s`, "ได้จากถิ่นฐานของผู้มีปัญญา");
  html += `<div class="res-group">ชีวมณฑล</div>`;
  html += row("สิ่งมีชีวิต", fmt(st.n), "");
  html += row("สายพันธุ์", fmt(st.alive), "");
  html += row("กินพืช", fmt(st.roles[0]), ""); html += row("กินทั้งพืชและสัตว์", fmt(st.roles[1]), ""); html += row("ผู้ล่า", fmt(st.roles[2]), "");
  html += row("ชีวมวลพืช", fmt(st.plants), "");
  html += row("เกิด", fmt(sim.ratePerMinute("births")), "/นาที"); html += row("ตาย", fmt(sim.ratePerMinute("deaths")), "/นาที");
  if (sim.era >= 4) {
    html += `<div class="res-group">อารยธรรม</div>`;
    html += row("ประชากรเมือง", fmt(st.civPop), ""); html += row("ถิ่นฐาน", fmt(sim.settlements.length), "");
    if (sim.era >= 9) html += row("อาณานิคม", fmt(sim.colonies), "");
  }
  if (game.state.prestige) html += `<div class="res-group">ถาวร</div>` + row("🌌 เศษซากจักรวาล", fmt(game.state.prestige), "");
  setHTML($("resourceList"), html);
}

function renderEra() {
  const era = ERAS[sim.era];
  $("eraNumber").textContent = `ERA ${String(sim.era + 1).padStart(2, "0")}`;
  $("eraType").textContent = era.type;
  $("eraTitle").textContent = `${era.icon} ${era.name}`;
  $("eraDescription").textContent = era.description;
  const cost = game.eraCost();
  const rowsHTML = game.goals().map((g) => [g.label, g.cur, g.need, g.done]);
  if (cost) for (const [k, v] of Object.entries(cost)) rowsHTML.push([`ใช้${RES_TH[k]}`, game.state.res[k], v, game.state.res[k] >= v]);
  setHTML($("goalList"), rowsHTML.map(([label, cur, need, done]) => `<div class="goal ${done ? "done" : ""}"><span>${done ? "✓ " : ""}${label}</span><b>${fmt(Math.min(cur, need))} / ${fmt(need)}</b><div class="meter"><i style="width:${Math.min(100, cur / need * 100)}%"></i></div></div>`).join(""));
  const can = game.canEvolve();
  $("evolveButton").disabled = !can;
  $("evolveButton").textContent = cost ? (can ? `วิวัฒนาการสู่ ${ERAS[sim.era + 1].name}` : "วิวัฒนาการขั้นต่อไป") : "วิวัฒนาการถึงขีดสุดแล้ว";
  $("evolveButton").dataset.tip = cost ? "evolve" : "";
  $("evolveHint").textContent = cost ? `ปลดล็อก: ${era.unlock}` : "เริ่มวัฏจักรใหม่เพื่อสร้างจักรวาลที่ยิ่งใหญ่กว่าเดิม";
}

function renderTools() {
  const html = POWERS.map((p) => {
    const c = game.powerCost(p.id), can = !p.cost || game.state.res[p.res] >= c;
    return `<button class="tool ${tool === p.id ? "active" : ""} ${can ? "" : "cant"}" data-tool="${p.id}" title="${esc(p.hint)}">${p.icon} <span class="tname">${p.name}</span>${p.cost ? `<small>${fmt(c)} ${p.res === "dna" ? "DNA" : "⚡"}</small>` : ""}</button>`;
  }).join("") + `<span class="tool-sep"></span>` +
    `<button class="tool ${game.state.res.energy >= game.climateCost() ? "" : "cant"}" data-climate="-1" title="ทำให้โลกเย็นลง">❄️ <small>${fmt(game.climateCost())} ⚡</small></button>` +
    `<button class="tool ${game.state.res.energy >= game.climateCost() ? "" : "cant"}" data-climate="1" title="ทำให้โลกอุ่นขึ้น">🔥 <small>${fmt(game.climateCost())} ⚡</small></button>`;
  setHTML($("toolBar"), html);
  const p = POWERS.find((x) => x.id === tool);
  let hint = p.hint;
  if (tool === "seed") hint = seedSpecies && sim.species.get(seedSpecies) ? `ปล่อย ${sim.species.get(seedSpecies).name} — คลิกบนแผนที่` : "เลือกสายพันธุ์ก่อน: คลิกสิ่งมีชีวิตแล้วกด “เลือกปล่อย”";
  if (tool === "inspect") hint = renderer === map3d ? "คลิกเพื่อดูรายละเอียด · ลากเพื่อเลื่อน · คลิกขวาลากเพื่อหมุน · ล้อเมาส์ซูม" : "คลิกเพื่อดูรายละเอียด · ลากเพื่อเลื่อน · ล้อเมาส์ซูม";
  $("toolHint").textContent = hint;
  $("world").classList.toggle("tool", tool !== "inspect"); $("world3d").classList.toggle("tool", tool !== "inspect");
}

function geneRows(g, avg, caps) {
  return GENE_KEYS.map((k) => {
    const G = GENES[k], pct = (g[k] - G.min) / (G.max - G.min) * 100, apct = avg ? (avg[k] - G.min) / (G.max - G.min) * 100 : null;
    const val = k === "sense" ? Math.round(g[k]) : g[k].toFixed(2);
    return `<div class="gene-row" title="${G.label}${caps?.[k] !== undefined ? ` · ขีดจำกัดยุคนี้ ${caps[k]}` : ""}"><span>${G.label}</span><div class="gene-bar"><div style="width:${pct}%"></div>${apct !== null ? `<i style="left:${apct}%"></i>` : ""}</div><span>${val}</span></div>`;
  }).join("");
}

function renderInspector() {
  const box = $("inspector");
  const c = renderer.selected;
  if (selectedSettlement) {
    const s = sim.settlements.find((x) => x.id === selectedSettlement.id);
    if (!s) { setHTML(box, `<div class="insp-head"><h3>ถิ่นฐานถูกทิ้งร้างแล้ว</h3><button class="top-btn" data-insp="close">✕</button></div>`); return; }
    const sp = sim.species.get(s.sp);
    setHTML(box, `<div class="insp-head"><div><small>${SETTLEMENT_LEVELS[s.level].name}</small><h3>🏘️ ${esc(s.name)}</h3></div><button class="top-btn" data-insp="close">✕</button></div>
      <div class="insp-meta"><div>ประชากร<b>${fmt(s.pop)}</b></div><div>สูงสุด<b>${fmt(s.peak)}</b></div><div>ก่อตั้ง<b>${simClock(s.born)}</b></div><div>ท่าอวกาศ<b>${s.port ? "มี" : "—"}</b></div></div>
      <p class="muted small">${sp ? `${ARCH[sp.arch]?.icon || ""} ${esc(sp.name)}<br>` : ""}ถิ่นฐานหาอาหารจากพื้นที่รอบ ๆ ${sim.era >= 5 ? "เปลี่ยนป่าเป็นไร่นา " : ""}ล่าสัตว์ป่า สร้างความรู้ และส่งผู้อพยพไปสร้างเมืองใหม่</p>`);
    return;
  }
  if (!c) { box.hidden = true; return; }
  box.hidden = false;
  const sp = sim.species.get(c.sp);
  if (c.dead) {
    const causes = { eaten: "ถูกล่า", starved: "อดอาหาร", aged: "ตายตามอายุขัย", other: "ภัยธรรมชาติ" };
    setHTML(box, `<div class="insp-head"><div><small>#${c.id} · รุ่นที่ ${c.gen}</small><h3>${c.joined ? "เข้าร่วมถิ่นฐานแล้ว" : "สิ่งมีชีวิตตัวนี้ตายแล้ว"}</h3></div><button class="top-btn" data-insp="close">✕</button></div>
      <p class="muted small">${c.joined ? "ย้ายไปอาศัยในเมือง" : "สาเหตุ: " + (causes[c.cause] || "ไม่ทราบ")} · อายุ ${Math.round(c.age / TPS)} วินาที</p>
      <div class="insp-actions">${sp && sp.count > 0 ? action({ attrs: 'data-insp="another"', name: "ติดตามตัวอื่น", can: true, small: true }) : ""}${action({ attrs: 'data-insp="close"', name: "ปิด", can: true, small: true })}</div>`);
    return;
  }
  const arch = ARCH[sp?.arch] || ARCH.microbe, biome = BIOMES[sim.world.biome[sim.world.idx(c.x, c.y)]];
  setHTML(box, `<div class="insp-head"><div><small>#${c.id} · รุ่นที่ ${c.gen} · ${MODE_TH[c.mode]}</small><h3><span class="arch-icon">${arch.icon}</span> ${esc(sp?.name || "?")}</h3><small>${esc(sp?.desc || TIER_TH.cell)}</small><small class="insp-where">${biome.icon} อยู่ที่${biome.name}</small></div><button class="top-btn" data-insp="close">✕</button></div>
    <div class="insp-meta"><div>พลังงาน<b>${Math.round(c.e / c.maxE * 100)}%</b></div><div>อายุ<b>${Math.round(c.age / c.maxAge * 100)}%</b></div><div>บทบาท<b>${ROLE_TH[c.g.diet >= 0.62 ? "carnivore" : c.g.diet >= 0.38 ? "omnivore" : "herbivore"]}</b></div><div>ในสายพันธุ์<b>${fmt(sp?.count || 0)}</b></div></div>
    ${geneRows(c.g, sp?.avg, capsFor(sim.era))}
    <p class="muted small">ขีดสีเหลือง = ค่าเฉลี่ยของสายพันธุ์</p>
    <div class="insp-actions">${action({ attrs: 'data-insp="follow"', name: renderer.follow ? "กำลังติดตาม" : "🎥 ติดตาม", can: true, small: true, on: renderer.follow })}${action({ attrs: 'data-insp="seed"', name: "🧬 เลือกปล่อย", can: true, small: true, on: seedSpecies === c.sp })}${action({ attrs: 'data-insp="species"', name: "ดูสายพันธุ์", can: true, small: true })}</div>`);
}

// Live panels refresh every second; never replace the element the user is in the middle of clicking.
let pressTarget = null;
document.addEventListener("pointerdown", (e) => { pressTarget = e.target; }, true);
document.addEventListener("pointerup", () => setTimeout(() => { pressTarget = null; }, 0), true);
document.addEventListener("pointercancel", () => { pressTarget = null; }, true);
function setHTML(el, html) {
  if (el._html === html) return;
  if (pressTarget && el.contains(pressTarget)) return;
  el.innerHTML = html; el._html = html;
}

// ------------------------------------------------------------ tab views (1 Hz)
function updateHeavy() {
  if (activeTab === "upgrades") renderUpgrades();
  else if (activeTab === "life") renderSpecies();
  else if (activeTab === "mutation") renderLab();
  else if (activeTab === "technology") renderTech();
  else if (activeTab === "world") renderWorld();
  else if (activeTab === "stats") renderStatsLive();
  else if (activeTab === "archive") renderArchive();
  else if (activeTab === "cycle") renderCycle();
  const gen = sim.creatures.reduce((m, c) => Math.max(m, c.gen), 0);
  $("hudGen").textContent = `รุ่นที่ ${fmt(gen)}`;
}
function refreshNow() { updateFast(); updateHeavy(); }

function renderUpgrades() {
  setHTML($("upgradeGrid"), UPGRADES.map((u) => {
    const n = game.state.upgrades[u.id] || 0, locked = sim.era < u.era, maxed = n >= u.max, cost = game.upgradeCost(u);
    return action({ attrs: `data-upgrade="${u.id}"`, name: `${u.icon} ${u.name}`, cost: locked ? `🔒 ERA ${u.era + 1}` : maxed ? "สูงสุด" : `${fmt(cost)} ${RES_TH[u.res]}`, count: n, can: game.state.res[u.res] >= cost, locked, done: maxed, tip: `upgrade:${u.id}` });
  }).join(""));
}

function traitChips(a) {
  const out = [`ขนาด ${a.size.toFixed(1)}`, `เร็ว ${a.speed.toFixed(1)}`];
  if (a.wing >= 0.5) out.push("บินได้"); if (a.armor >= 0.5) out.push("เกราะ"); if (a.warm >= 0.5) out.push("เลือดอุ่น");
  out.push(a.habitat > 0.6 ? "บก" : a.habitat > 0.35 ? "ครึ่งบกครึ่งน้ำ" : "น้ำ");
  if (a.intellect > 0.2) out.push(`ปัญญา ${(a.intellect * 100).toFixed(0)}`);
  return out.map((t) => `<span class="chip">${t}</span>`).join("");
}

function renderSpecies() {
  const alive = [...sim.species.values()].filter((s) => s.extinct === null && s.count > 0).sort((a, b) => b.count - a.count);
  $("speciesCount").textContent = `มีชีวิต ${alive.length} สายพันธุ์ · เคยเกิดขึ้น ${fmt(sim.totals.species)} · สูญพันธุ์ ${fmt(sim.totals.extinct)} — สายพันธุ์เกิดจากการกลายพันธุ์และการคัดเลือกโดยธรรมชาติ ไม่มีการกำหนดไว้ล่วงหน้า`;
  setHTML($("speciesList"), `<thead><tr><th></th><th>สายพันธุ์</th><th>กลุ่ม</th><th class="num">จำนวน</th><th>แนวโน้ม</th><th>ลักษณะ</th><th></th></tr></thead><tbody>` +
    (alive.slice(0, 50).map((s) => `<tr class="${seedSpecies === s.id ? "sel" : ""}">
      <td class="sp-icon">${ARCH[s.arch]?.icon || ""}</td>
      <td class="sp-name"><span class="swatch" style="background:${spColor(s)}"></span> ${esc(s.name)}${s.sapient ? ` <span class="has-special small">ผู้มีปัญญา</span>` : ""}<div class="muted small">${s.parent && sim.species.get(s.parent) ? "จาก " + esc(sim.species.get(s.parent).name) : "บรรพบุรุษแรกเริ่ม"} · ${simClock(s.born)}</div></td>
      <td>${esc(ARCH[s.arch]?.th || "")}<div class="muted small">${ROLE_TH[s.role] || ""}</div></td>
      <td class="num">${fmt(s.count)}</td>
      <td>${sparkSVG(s.hist, spColor(s))}</td>
      <td>${traitChips(s.avg)}</td>
      <td style="white-space:nowrap">${action({ attrs: `data-sp-follow="${s.id}"`, name: "ติดตาม", can: true, small: true })} ${action({ attrs: `data-sp-seed="${s.id}"`, name: "เลือกปล่อย", can: true, small: true, on: seedSpecies === s.id })}</td></tr>`).join("") || `<tr><td colspan="7" class="muted">ยังไม่มีสายพันธุ์ที่มีชีวิต</td></tr>`) + "</tbody>");
  if (performance.now() - (renderSpecies.lastTree || 0) > 4000) { renderSpecies.lastTree = performance.now(); $("treeBox").innerHTML = buildTree(); }
}

/** Phylogeny of every living species plus its ancestors (and big extinct lineages). */
function buildTree() {
  const keep = new Set();
  for (const s of sim.species.values()) {
    if ((s.extinct === null && s.count > 0) || s.peak >= 40) { let p = s; while (p && !keep.has(p.id)) { keep.add(p.id); p = sim.species.get(p.parent); } }
  }
  const nodes = [...keep].map((id) => sim.species.get(id)).filter(Boolean);
  if (!nodes.length) return "";
  const kids = new Map(); const roots = [];
  for (const n of nodes) { if (n.parent && keep.has(n.parent)) { if (!kids.has(n.parent)) kids.set(n.parent, []); kids.get(n.parent).push(n); } else roots.push(n); }
  const order = [];
  const walk = (n) => { order.push(n); (kids.get(n.id) || []).sort((a, b) => a.born - b.born).forEach(walk); };
  roots.sort((a, b) => a.born - b.born).forEach(walk);
  const rows = order.slice(0, 220), rowH = 15, labelW = 230, W = 920, H = rows.length * rowH + 26;
  const t1 = sim.tick, X = (t) => labelW + (t / Math.max(1, t1)) * (W - labelW - 12);
  const idx = new Map(rows.map((n, i) => [n.id, i]));
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="ต้นไม้วิวัฒนาการ">`;
  for (const e of game.state.eraLog) { const x = X(e.tick); svg += `<line x1="${x}" y1="0" x2="${x}" y2="${H - 18}" stroke="currentColor" stroke-opacity=".2" stroke-dasharray="3 3"/><text x="${x + 3}" y="${H - 5}" style="font-size:10px">${ERAS[e.era].icon} ${e.era + 1}</text>`; }
  rows.forEach((n, i) => {
    const y = i * rowH + 9, x0 = X(n.born), x1 = X(n.extinct ?? t1), alive = n.extinct === null;
    const col = spColor(n, alive ? 58 : 40);
    if (n.parent && idx.has(n.parent)) { const py = idx.get(n.parent) * rowH + 9; svg += `<path d="M${x0} ${py} V${y}" stroke="${col}" stroke-opacity=".5" fill="none"/>`; }
    svg += `<line x1="${x0}" y1="${y}" x2="${Math.max(x1, x0 + 2)}" y2="${y}" stroke="${col}" stroke-width="${alive ? 4 : 2}" stroke-linecap="round"/>`;
    svg += `<text x="6" y="${y + 4}" style="${alive ? "" : "opacity:.5"}">${ARCH[n.arch]?.icon || ""} ${esc(n.name)}${alive ? ` · ${n.count}` : " †"}</text>`;
  });
  return svg + "</svg>";
}

function renderLab() {
  const s = game.state, P = sim.params;
  const guide = P.guide && sim.tick < P.guide.until ? P.guide : null;
  const mut = sim.tick < P.mutagenUntil;
  const gc = game.guideCost();
  setHTML($("labGrid"), `
    <section class="lab-section"><h2>อัตราการกลายพันธุ์</h2>
      <p>ตอนนี้ลูกมีโอกาสกลายพันธุ์ ${(P.mutationRate * 100).toFixed(0)}% ต่อยีน · ความแรง ${(P.mutationStrength * 100).toFixed(1)}% ของช่วงยีน</p>
      <div class="action-grid">${action({ attrs: 'data-lab="mutation"', name: "🧪 กลายพันธุ์", cost: s.mutation >= 10 ? "สูงสุด" : `${fmt(game.mutationCost())} DNA`, count: s.mutation, can: s.res.dna >= game.mutationCost(), done: s.mutation >= 10, tip: "mutation" })}
      ${action({ attrs: 'data-lab="mutagen"', name: "☢️ รังสีเร่งกลายพันธุ์", cost: mut ? "กำลังทำงาน" : `${fmt(game.mutagenCost())} DNA`, can: s.res.dna >= game.mutagenCost(), on: mut, tip: "mutagen" })}</div></section>
    <section class="lab-section"><h2>กำหนดแรงคัดเลือก</h2>
      <p>ผลักลูกที่เกิดใหม่ทั้งโลกไปทางลักษณะที่เลือกเป็นเวลา 90 วินาทีจำลอง · ${fmt(gc)} DNA ต่อครั้ง</p>
      ${guide ? `<div class="active-note">กำลังคัดเลือก: <b>${GENES[guide.gene].label} ${guide.dir > 0 ? "↑" : "↓"}</b> · เหลือ <span id="guideLeft"></span> วินาที</div>` : ""}
      <div class="guide-table">${GUIDE_GENES.map((g) => `<span>${GENES[g.gene].label}</span>${action({ attrs: `data-guide="${g.gene}" data-dir="1"`, name: `↑ ${g.up}`, can: s.res.dna >= gc, small: true, on: guide?.gene === g.gene && guide.dir > 0, tip: `guide:${g.gene}:1` })}${action({ attrs: `data-guide="${g.gene}" data-dir="-1"`, name: `↓ ${g.down}`, can: s.res.dna >= gc, small: true, on: guide?.gene === g.gene && guide.dir < 0, tip: `guide:${g.gene}:-1` })}`).join("")}</div></section>
    <section class="lab-section"><h2>ยีนเฉลี่ยของสิ่งมีชีวิตทั้งโลก</h2><p>ดูว่าโลกกำลังวิวัฒนาการไปทางไหน ขีดสีเหลืองคือขีดจำกัดของยุคปัจจุบัน</p><div id="genePool" style="max-width:34rem"></div></section>`);
  if ($("guideLeft") && guide) $("guideLeft").textContent = Math.ceil((guide.until - sim.tick) / TPS);
  const avg = {}; for (const k of GENE_KEYS) avg[k] = 0;
  for (const c of sim.creatures) for (const k of GENE_KEYS) avg[k] += c.g[k];
  for (const k of GENE_KEYS) avg[k] /= Math.max(1, sim.creatures.length);
  const pool = $("genePool");
  if (pool) { if (!pool.innerHTML) pool._html = ""; setHTML(pool, GENE_KEYS.map((k) => { const G = GENES[k], cap = capsFor(sim.era)[k]; const pct = (avg[k] - G.min) / (G.max - G.min) * 100; return `<div class="gene-row"><span>${G.label}</span><div class="gene-bar"><div style="width:${pct}%"></div>${cap !== undefined && cap < G.max ? `<i style="left:${(cap - G.min) / (G.max - G.min) * 100}%"></i>` : ""}</div><span>${k === "sense" ? Math.round(avg[k]) : avg[k].toFixed(2)}</span></div>`; }).join("")); }
}

function renderTech() {
  setHTML($("technologyGrid"), TECHS.map((t) => {
    const owned = !!game.state.techs[t.id], locked = sim.era < t.era;
    return action({ attrs: `data-tech="${t.id}"`, name: `${t.icon} ${t.name}`, cost: owned ? "วิจัยแล้ว" : locked ? `🔒 ERA ${t.era + 1}` : `${fmt(t.cost)} ความรู้`, can: game.state.res.knowledge >= t.cost, locked: locked && !owned, done: owned, tip: `tech:${t.id}` });
  }).join(""));
}

function renderWorld() {
  const st = sim.stats, w = sim.world;
  let farm = 0, iceCells = 0, greenLand = 0;
  const biomeCount = new Array(BIOMES.length).fill(0);
  for (let i = 0; i < w.farm.length; i++) { farm += w.farm[i]; if (w.temp[i] < 0.1) iceCells++; if (!w.isWater(i)) greenLand += w.green[i]; biomeCount[w.biome[i]]++; }
  const div = Math.min(100, st.biodiversity / Math.log(30) * 100);
  const meters = [
    ["🌿 ความหลากหลายทางชีวภาพ", div, `${div.toFixed(0)}% · ${st.alive} สายพันธุ์`],
    ["🌱 พืชปกคลุมผืนดิน", greenLand / w.landCells * 100, `${(greenLand / w.landCells * 100).toFixed(0)}%`],
    ["🧊 น้ำแข็ง", iceCells / w.bio.length * 100, `${(iceCells / w.bio.length * 100).toFixed(0)}%`],
    ["🌾 ไร่นา", farm / w.landCells * 100, `${farm} ไร่`],
    ["🏭 มลพิษ", sim.climate.pollution / 0.32 * 100, `+${(sim.climate.pollution * 40).toFixed(1)}°C`],
  ];
  const events = sim.activeEvents.map((e) => ({ ice: "❄️ ยุคน้ำแข็ง", warm: "🔥 โลกร้อน", dust: "🌫️ ฝุ่นอุกกาบาต" }[e.kind] + ` · เหลือ ${Math.ceil((e.until - sim.tick) / TPS)} วินาที`));
  setHTML($("ecologyMeters"), `<div class="meter-row"><div><span>🌡️ อุณหภูมิเฉลี่ย</span><span class="${sim.climate.offset < -0.08 ? "has-info" : sim.climate.offset > 0.08 ? "has-danger" : ""}">${tempC(sim.climate.offset)}</span></div></div>` +
    meters.map(([n, v, t]) => `<div class="meter-row"><div><span>${n}</span><span>${t}</span></div><div class="meter-track"><div style="width:${Math.max(1, Math.min(100, v))}%"></div></div></div>`).join("") +
    `<p class="small ${events.length ? "has-caution" : "muted"}">${events.length ? events.join("<br>") : "ไม่มีเหตุการณ์ภูมิอากาศพิเศษตอนนี้"}</p>` +
    `<h2 class="sub-head">ไบโอม</h2>` + biomeCount.map((n, b) => n ? `<div class="meter-row"><div><span>${BIOMES[b].icon} ${BIOMES[b].name}</span><span class="muted">${(n / w.bio.length * 100).toFixed(0)}%</span></div></div>` : "").join(""));
  setHTML($("climateRow"), action({ attrs: 'data-climate="-1"', name: "❄️ ทำให้เย็นลง", cost: `${fmt(game.climateCost())} พลังงาน`, can: game.state.res.energy >= game.climateCost(), tip: "climate:-1" }) + action({ attrs: 'data-climate="1"', name: "🔥 ทำให้อุ่นขึ้น", cost: `${fmt(game.climateCost())} พลังงาน`, can: game.state.res.energy >= game.climateCost(), tip: "climate:1" }));
  const fw = [["🌿 ชีวมวลพืช", st.plants, "#3fae6a"], ["กินพืช", st.roles[0], ROLE_COLORS[0]], ["กินทั้งพืชและสัตว์", st.roles[1], ROLE_COLORS[1]], ["ผู้ล่า", st.roles[2], ROLE_COLORS[2]]];
  if (sim.era >= 4) fw.push(["🏘️ อารยธรรม", st.civPop, "#3d9df5"]);
  const max = Math.max(...fw.map((f) => f[1]), 1);
  setHTML($("foodWeb"), fw.map(([n, v, c]) => `<div class="fw-row"><span>${n}</span><div class="fw-bar" style="width:${Math.max(1, v / max * 100)}%;background:${c}"></div><b>${fmt(v)}</b></div>`).join("") +
    `<h2 class="sub-head">กลุ่มสิ่งมีชีวิตตอนนี้</h2>` + Object.entries(st.arch || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="fw-row"><span>${ARCH[k]?.icon || ""} ${ARCH[k]?.th || k}</span><div class="fw-bar" style="width:${Math.max(1, v / Math.max(1, st.n) * 100)}%;background:var(--link)"></div><b>${fmt(v)}</b></div>`).join(""));
}

function renderStatsLive() {
  const st = sim.stats, T = sim.totals;
  const stats = [
    ["สิ่งมีชีวิต", fmt(st.n)], ["สายพันธุ์", fmt(st.alive)], ["อุณหภูมิ", tempC(sim.climate.offset)], ["เกิด / นาที", fmt(sim.ratePerMinute("births"))], ["ตาย / นาที", fmt(sim.ratePerMinute("deaths"))],
    ["ถูกล่า (รวม)", fmt(T.eaten)], ["อดตาย (รวม)", fmt(T.starved)], ["ตายตามอายุ (รวม)", fmt(T.aged)], ["ถิ่นฐาน", fmt(sim.settlements.length)], ["เวลาจำลอง", simClock(sim.tick)],
  ];
  setHTML($("statGrid"), stats.map(([k, v]) => `<div class="stat"><small>${k}</small><strong>${v}</strong></div>`).join(""));
  const hi = drawPopulationChart($("popChart"), sim.history, chartHover);
  const tip = $("chartTip");
  if (hi >= 0) {
    const s = sim.history[hi], ago = (sim.tick - s.t) / TPS;
    tip.hidden = false;
    tip.innerHTML = `<div class="muted">${ago < 2 ? "ตอนนี้" : simClock(ago * TPS) + " ที่แล้ว"}</div>` + ROLE_NAMES.map((n, i) => `<div><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${ROLE_COLORS[i]}"></i> ${n} <b>${s.roles[i]}</b></div>`).join("") + `<div>รวม <b>${s.n}</b></div>`;
    tip.style.left = Math.min(chartHover + 10, $("popChart").clientWidth - 150) + "px";
  } else tip.hidden = true;
  $("popLegend").innerHTML = ROLE_NAMES.map((n, i) => `<span><i style="background:${ROLE_COLORS[i]}"></i>${n} <b>${st.roles[i]}</b></span>`).join("");
  drawLineChart($("plantChart"), sim.history.map((h) => h.plants), "#3fae6a");
}

function renderArchive() {
  const s = game.state, T = sim.totals;
  const reached = new Map(s.eraLog.map((e) => [e.era, e]));
  const rec = [["เกิดทั้งหมด", T.births], ["ตายทั้งหมด", T.deaths], ["ถูกล่า", T.eaten], ["อดตาย", T.starved], ["สายพันธุ์ที่เคยมี", T.species], ["สูญพันธุ์", T.extinct], ["ประชากรสูงสุด", s.records.maxPop], ["สายพันธุ์พร้อมกันสูงสุด", s.records.maxSpecies], ["จรวดที่ปล่อย", sim.launches], ["อาณานิคม", sim.colonies]];
  const extinct = [...sim.species.values()].filter((x) => x.extinct !== null && x.peak >= 20).sort((a, b) => b.peak - a.peak).slice(0, 15);
  setHTML($("archiveContent"),
    `<div class="stat-grid">${rec.map(([k, v]) => `<div class="stat"><small>${k}</small><strong>${fmt(v)}</strong></div>`).join("")}</div>` +
    `<h2 class="sub-head">สารานุกรมสิ่งมีชีวิต <span class="muted small">ค้นพบ ${Object.keys(sim.discovered || {}).length} / ${ARCH_KEYS.length} กลุ่ม</span></h2>` +
    `<div class="ency-grid">${ARCH_KEYS.map((k) => { const found = sim.discovered?.[k] !== undefined, alive = sim.stats.arch?.[k] || 0; return `<div class="ency ${found ? "" : "locked"}" title="${found ? esc(ARCH[k].group) : "ยังไม่ค้นพบ"}"><span>${found ? ARCH[k].icon : "?"}</span>${found ? ARCH[k].th : "???"}<small class="${found && alive ? "has-success" : ""}">${found ? (alive ? fmt(alive) + " ตัว" : "สูญพันธุ์แล้ว") : "ERA " + (ARCH[k].era + 1) + "+"}</small></div>`; }).join("")}</div>` +
    `<h2 class="sub-head">ยุคสมัย</h2><ul class="era-list">` +
    ERAS.map((e, i) => { const r = reached.get(i); return `<li class="${r ? "" : "locked"}"><span>${r ? e.icon : "🔒"}</span><span class="muted">ERA ${String(i + 1).padStart(2, "0")}${r ? ` · ${simClock(r.tick)}` : ""}</span><span>${r ? `<b>${e.name}</b> — ${e.description}` : "ยุคที่ยังไม่ค้นพบ"}</span></li>`; }).join("") + `</ul>` +
    `<h2 class="sub-head">สายพันธุ์ที่สูญพันธุ์ไปแล้ว</h2>` +
    (extinct.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th></th><th>สายพันธุ์</th><th>ช่วงเวลา</th><th class="num">สูงสุด</th></tr></thead><tbody>${extinct.map((x) => `<tr><td>${ARCH[x.arch]?.icon || ""}</td><td><span class="swatch" style="background:${spColor(x, 40)}"></span> ${esc(x.name)}<div class="muted small">${esc(x.desc)}</div></td><td class="muted">${simClock(x.born)} – ${simClock(x.extinct)}</td><td class="num">${x.peak}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">ยังไม่มีสายพันธุ์ใหญ่ที่สูญพันธุ์</p>`));
}

function renderCycle() {
  const can = game.canPrestige(), s = game.state;
  setHTML($("cycleContent"), `<p class="view-intro">เมื่ออารยธรรมไปถึงอวกาศ คุณสามารถสร้างดาวดวงใหม่ โดยนำเศษซากจักรวาลติดตัวไปเป็นโบนัสถาวร</p>
    <div class="res-row" style="max-width:24rem"><span class="rname">🌌 เศษซากจักรวาล</span><span class="rval">${s.prestige}</span><span></span></div>
    <div class="res-row" style="max-width:24rem"><span class="rname">โบนัสทรัพยากร</span><span class="rval">+${s.prestige * 8}%</span><span></span></div>
    <div class="res-row" style="max-width:24rem"><span class="rname">พืชโตเร็วขึ้น</span><span class="rval">+${s.prestige * 4}%</span><span></span></div>
    <div class="res-row" style="max-width:24rem"><span class="rname">วัฏจักรที่</span><span class="rval">${s.cycles + 1}</span><span></span></div>
    <p class="small ${can ? "has-success" : "muted"}">${can ? `เริ่มใหม่ตอนนี้จะได้รับ ${game.prestigeGain()} เศษซาก (DNA สะสม ${fmt(s.totalDNA)} · อาณานิคม ${sim.colonies})` : `ปลดล็อกเมื่อถึง ERA 10 · ${ERAS[9].name} (ตอนนี้ ERA ${sim.era + 1})`}</p>
    <div class="action-grid">${action({ attrs: 'id="prestigeButton"', name: "🌌 เริ่มวัฏจักรใหม่", can, locked: !can, tip: "prestige" })}</div>`);
}

// ------------------------------------------------------------ input
const pointers = new Map(); let drag = null, pinch = null;
function attachInput(canvas) {
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), my: (a.y + b.y) / 2 }; drag = null; }
    else drag = { x: e.offsetX, y: e.offsetY, sx: e.offsetX, sy: e.offsetY, moved: false, rotate: renderer === map3d && (e.button === 2 || e.shiftKey) };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      renderer.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch.d); pinch.d = d;
      if (renderer === map3d) { // two-finger twist rotates, two-finger vertical drag tilts
        const ang = Math.atan2(b.y - a.y, b.x - a.x), my = (a.y + b.y) / 2;
        map3d.rotate(-(ang - pinch.ang), (my - pinch.my) * 0.005); pinch.ang = ang; pinch.my = my;
      }
      return;
    }
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.offsetX - drag.sx, e.offsetY - drag.sy) > 5) { drag.moved = true; canvas.classList.add("dragging"); }
    if (drag.moved) {
      if (drag.rotate) map3d.rotate(-(e.offsetX - drag.x) * 0.006, (e.offsetY - drag.y) * 0.004);
      else renderer.pan(e.offsetX - drag.x, e.offsetY - drag.y);
      drag.x = e.offsetX; drag.y = e.offsetY;
    }
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    canvas.classList.remove("dragging");
    if (drag && !drag.moved && e.type === "pointerup" && e.button !== 2) clickWorld(e.offsetX, e.offsetY);
    drag = null;
  };
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); renderer.zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
}
attachInput($("world")); attachInput($("world3d"));

function clickWorld(sx, sy) {
  const p = renderer.toWorld(sx, sy);
  if (tool === "inspect") {
    const c = sim.creatureAt(p.x, p.y, 10 / renderer.cam.zoom + 2);
    if (c) { renderer.selected = c; selectedSettlement = null; $("inspector").hidden = false; renderInspector(); return; }
    const s = sim.settlementAt(p.x, p.y);
    if (s) { selectedSettlement = s; renderer.selected = null; renderer.follow = false; $("inspector").hidden = false; renderInspector(); return; }
    closeInspector();
    return;
  }
  const r = game.usePower(tool, p.x, p.y, seedSpecies);
  if (r !== true) toast(r);
  absorbEvents(); updateFast();
}
function closeInspector() { renderer.selected = null; renderer.follow = false; selectedSettlement = null; $("inspector").hidden = true; $("inspector")._html = ""; }
function followSpecies(id) {
  const members = sim.creatures.filter((c) => c.sp === id);
  if (!members.length) return toast("สายพันธุ์นี้ไม่มีตัวที่มีชีวิตแล้ว");
  const c = members[(Math.random() * members.length) | 0];
  renderer.selected = c; renderer.follow = true; selectedSettlement = null;
  renderer.focus(c.x, c.y, Math.max(renderer.cam.zoom, 2.6));
  $("inspector").hidden = false; renderInspector();
}

$("inspector").addEventListener("click", (e) => {
  const b = e.target.closest("[data-insp]"); if (!b) return;
  const a = b.dataset.insp, c = renderer.selected;
  if (a === "close") closeInspector();
  else if (a === "follow" && c) { renderer.follow = !renderer.follow; if (renderer.follow) renderer.focus(c.x, c.y, Math.max(renderer.cam.zoom, 2.6)); }
  else if (a === "seed" && c) { seedSpecies = c.sp; toast(`เลือก ${sim.species.get(c.sp).name} สำหรับเครื่องมือปล่อยสายพันธุ์`); }
  else if (a === "species") switchTab("life");
  else if (a === "another" && c) followSpecies(c.sp);
  $("inspector")._html = ""; renderInspector(); renderTools();
});

$("toolBar").addEventListener("click", (e) => {
  const t = e.target.closest("[data-tool]"), cl = e.target.closest("[data-climate]");
  if (t) { tool = t.dataset.tool; if (tool !== "inspect") closeInspector(); renderTools(); }
  if (cl) result(game.climate(+cl.dataset.climate));
});
document.querySelectorAll(".speed-btn[data-speed]").forEach((b) => b.addEventListener("click", () => setSpeed(+b.dataset.speed)));
function setSpeed(s) { speed = s; document.querySelectorAll(".speed-btn[data-speed]").forEach((b) => b.classList.toggle("active", +b.dataset.speed === s)); updateFast(); }
$("fitButton").addEventListener("click", () => renderer.fitWorld());
$("viewGroup").addEventListener("click", (e) => { const b = e.target.closest("[data-view]"); if (b) setView(b.dataset.view); });
$("rotGroup").addEventListener("click", (e) => { const r = e.target.closest("[data-rot]"), t = e.target.closest("[data-tilt]"); if (!map3d) return; if (r) map3d.rotate(+r.dataset.rot * 0.5, 0); if (t) map3d.rotate(0, +t.dataset.tilt * 0.2); });
$("minimap").addEventListener("click", (e) => { const r = e.target.getBoundingClientRect(); renderer.follow = false; renderer.focus((e.clientX - r.left) / r.width * 1920, (e.clientY - r.top) / r.height * 1080); });
$("popChart").addEventListener("pointermove", (e) => { chartHover = e.offsetX; });
$("popChart").addEventListener("pointerleave", () => { chartHover = null; });

$("evolveButton").addEventListener("click", () => { if (game.evolve()) { absorbEvents(); renderLog(); toast(`วิวัฒนาการสำเร็จ: ${ERAS[sim.era].name}`); game.save(); refreshNow(); } });
$("upgradeGrid").addEventListener("click", (e) => { const b = e.target.closest("[data-upgrade]"); if (b) result(game.buyUpgrade(b.dataset.upgrade)); });
$("technologyGrid").addEventListener("click", (e) => { const b = e.target.closest("[data-tech]"); if (b) result(game.buyTech(b.dataset.tech), "ค้นพบเทคโนโลยีใหม่"); });
$("labGrid").addEventListener("click", (e) => {
  const b = e.target.closest("[data-lab]"), g = e.target.closest("[data-guide]");
  if (b?.dataset.lab === "mutation") result(game.buyMutation(), "อัตราการกลายพันธุ์เพิ่มขึ้น");
  if (b?.dataset.lab === "mutagen") result(game.mutagen(), "รังสีคอสมิกกำลังเร่งการกลายพันธุ์");
  if (g) result(game.guide(g.dataset.guide, +g.dataset.dir), "กำหนดแรงคัดเลือกแล้ว — ดูผลในยีนเฉลี่ย");
});
$("speciesList").addEventListener("click", (e) => {
  const f = e.target.closest("[data-sp-follow]"), s = e.target.closest("[data-sp-seed]");
  if (f) { switchTab("map"); followSpecies(+f.dataset.spFollow); }
  if (s) { seedSpecies = +s.dataset.spSeed; tool = "seed"; toast(`เลือก ${sim.species.get(seedSpecies).name} — ไปที่แท็บโลกแล้วคลิกบนแผนที่เพื่อปล่อย`); renderSpecies(); renderTools(); }
});
$("climateRow").addEventListener("click", (e) => { const b = e.target.closest("[data-climate]"); if (b) result(game.climate(+b.dataset.climate)); });
$("cycleContent").addEventListener("click", (e) => {
  if (!e.target.closest("#prestigeButton") || !game.canPrestige()) return;
  ask("เริ่มวัฏจักรใหม่?", `รับเศษซากจักรวาล ${game.prestigeGain()} ชิ้น โลกปัจจุบันจะถูกแทนที่ด้วยดาวดวงใหม่`, "เริ่มจักรวาลใหม่").then((ok) => { if (ok) { setGame(game.prestige()); toast("จักรวาลใหม่ถือกำเนิดแล้ว"); } });
});

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${tab}`));
  $("tooltip").hidden = true; tipEl = null;
  if (tab === "map") { map2d.resize(); if (map3d) map3d.resize(); }
  refreshNow();
}
$("msgFilters").addEventListener("click", (e) => {
  const b = e.target.closest("[data-filter]"); if (!b) return;
  logFilter = b.dataset.filter;
  $("msgFilters").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
  renderLog();
});
document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

document.addEventListener("keydown", (e) => {
  if (e.target.closest("input,textarea,dialog[open]")) return;
  if (e.code === "Space") { e.preventDefault(); setSpeed(speed === 0 ? (setSpeed.prev || 1) : (setSpeed.prev = speed, 0)); }
  else if (["Digit1", "Digit2", "Digit3", "Digit4"].includes(e.code)) setSpeed([1, 3, 10, 30][+e.code.slice(-1) - 1]);
  else if (e.code === "KeyF") renderer.fitWorld();
  else if (e.code === "KeyV") setView(VIEWS[(VIEWS.indexOf(currentView()) + 1) % 3]);
  else if ((e.code === "KeyQ" || e.code === "KeyE") && renderer === map3d) map3d.rotate(e.code === "KeyQ" ? -0.3 : 0.3, 0);
  else if (e.code === "Escape") { closeInspector(); tool = "inspect"; renderTools(); }
});

// ------------------------------------------------------------ save / settings
function persist() { if (catchingUp) return; const ok = game.save(); $("saveState").textContent = ok ? "บันทึกแล้ว" : "บันทึกไม่ได้"; setTimeout(() => ($("saveState").textContent = "บันทึกอัตโนมัติ"), 1600); }
setInterval(persist, 20000);
window.addEventListener("beforeunload", () => game.save());
document.addEventListener("visibilitychange", () => { if (document.hidden) game.save(); });

function setGame(g) {
  game = g; sim = g.sim; map2d.setSim(sim); if (map3d) map3d.setSim(sim); closeInspector(); seedSpecies = null; acc = 0;
  incomeLog.length = 0; game.save(); focusLife(); refreshNow(); renderLog();
}
$("exportSave").addEventListener("click", () => {
  const blob = new Blob([game.exportJSON()], { type: "application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = `origin-save-era${sim.era + 1}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast("ส่งออกเซฟแล้ว");
});
$("importSave").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try { setGame(Game.importJSON(await file.text())); toast("นำเข้าเซฟสำเร็จ"); } catch { toast("ไฟล์เซฟไม่ถูกต้อง (รองรับเซฟ v0.3)"); }
  e.target.value = "";
});
$("resetGame").addEventListener("click", () => ask("เริ่มเกมใหม่?", "โลกและความคืบหน้าปัจจุบันจะถูกลบ เศษซากจักรวาลยังอยู่", "เริ่มใหม่").then((ok) => { if (ok) setGame(Game.newGame(game.state.prestige, game.state.cycles)); }));
$("settingsButton").addEventListener("click", () => $("settingsDialog").showModal());
$("helpButton").addEventListener("click", () => $("helpDialog").showModal());
$("themeSelect").value = settings.theme;
$("themeSelect").addEventListener("change", (e) => { settings.theme = e.target.value; applyTheme(); saveSettings(); refreshNow(); });
$("weatherToggle").checked = settings.weather;
$("weatherToggle").addEventListener("change", (e) => { settings.weather = e.target.checked; map2d.weather = settings.weather; if (map3d) map3d.weather = settings.weather; saveSettings(); });
$("compactNumbers").checked = settings.compact; $("effectsToggle").checked = settings.effects; $("bgToggle").checked = settings.bg;
$("compactNumbers").addEventListener("change", (e) => { settings.compact = e.target.checked; saveSettings(); refreshNow(); });
$("effectsToggle").addEventListener("change", (e) => { settings.effects = e.target.checked; map2d.effects = settings.effects; if (map3d) map3d.effects = settings.effects; document.body.classList.toggle("no-effects", !settings.effects); saveSettings(); });
$("bgToggle").addEventListener("change", (e) => { settings.bg = e.target.checked; saveSettings(); });
$("footerVersion").textContent = `ORIGIN v${VERSION} · Real-time evolution simulator · หน้าตาได้แรงบันดาลใจจาก Evolve`;
window.addEventListener("resize", () => renderer.resize());
new ResizeObserver(() => { map2d.resize(); if (map3d) map3d.resize(); }).observe($("worldWrap"));

function focusLife() {
  const cs = sim.creatures;
  if (!cs.length) return renderer.fitWorld();
  let x = 0, y = 0; for (const c of cs) { x += c.x; y += c.y; }
  const any = cs[(Math.random() * cs.length) | 0];
  renderer.focus((x / cs.length + any.x) / 2, (y / cs.length + any.y) / 2, Math.max(renderer.fit * 2.6, 1.4));
}

// ------------------------------------------------------------ boot
map2d.resize();
if (settings.view3d !== undefined && !settings.viewMigrated) { settings.view = "planet"; settings.viewMigrated = true; delete settings.view3d; }
setView(has3D ? settings.view : "2d");
if (!has3D) for (const b of document.querySelectorAll("#viewGroup [data-view]")) b.hidden = b.dataset.view !== "2d";
if (currentView() !== "planet") focusLife();
booting = false;
refreshNow(); renderLog();
if (!settings.seenHelp) { $("helpDialog").showModal(); settings.seenHelp = true; saveSettings(); }
if (restored && savedAt) catchUp((Date.now() - savedAt) / 1000);
requestAnimationFrame(frame);
window.__origin = { get game() { return game; }, get sim() { return sim; }, get renderer() { return renderer; }, map2d, get map3d() { return map3d; }, setView, setSpeed };
