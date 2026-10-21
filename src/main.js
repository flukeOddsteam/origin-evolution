import { ERAS, RESOURCES, UPGRADES, TECHS, POWERS, GUIDE_GENES } from "./data.js";
import { Game, format, RES_TH, VERSION } from "./game.js";
import { TICKS_PER_SECOND as TPS, MODE_TH } from "./sim/sim.js";
import { GENES, GENE_KEYS, ROLE_TH, TIER_TH } from "./sim/genes.js";
import { SETTLEMENT_LEVELS } from "./sim/eras.js";
import { capsFor } from "./sim/eras.js";
import { Renderer } from "./render.js";
import { drawPopulationChart, drawLineChart, sparkSVG, ROLE_COLORS, ROLE_NAMES } from "./chart.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SETTINGS_KEY = "originSettings_v3";

// ------------------------------------------------------------ state
let settings = { compact: true, effects: true, bg: true, seenHelp: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}); } catch { /* storage unavailable */ }
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ } };

let { game, restored, savedAt } = Game.load();
let sim = game.sim;
const renderer = new Renderer($("world"), sim);
renderer.effects = settings.effects;
let speed = 1, tool = "inspect", seedSpecies = null, activeTab = "upgrades", catchingUp = false;
let selectedSettlement = null, chartHover = null;
const incomeLog = []; // [time, dna, energy, knowledge]
const fmt = (n) => format(n, settings.compact);
const simClock = (tick) => { const s = Math.floor(tick / TPS), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`; };
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
  for (const e of sim.drainEvents()) {
    game.log(e.text, e.type);
    if (e.type === "speciation") { if (performance.now() - (absorbEvents.lastSp || 0) < 5000) continue; absorbEvents.lastSp = performance.now(); }
    ticker(e.text, e.type);
  }
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
  renderer.draw(now);
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
    while (done < ticks && performance.now() - start < 40) { sim.step(); done++; }
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

// ------------------------------------------------------------ ticker & HUD
function ticker(text, type) {
  const box = $("ticker");
  const el = document.createElement("div");
  el.className = "tick-item " + type; el.textContent = text;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.remove(), 8200);
}

function updateFast() {
  const era = ERAS[sim.era];
  $("hudEraIcon").textContent = era.icon;
  $("hudEraNum").textContent = `ERA ${String(sim.era + 1).padStart(2, "0")}`;
  $("hudEraName").textContent = era.name;
  $("hudClock").textContent = simClock(sim.tick);
  $("liveDot").classList.toggle("paused", speed === 0);
  const real = tpsWindow.reduce((a, [, n]) => a + n, 0) / 1.5 / TPS;
  $("speedReal").textContent = speed > 1 && real < speed * 0.8 ? `≈${real.toFixed(1)}×` : "";

  // resources
  const r = rates();
  const pop = sim.creatures.length + sim.stats.civPop;
  $("resourceGrid").innerHTML = RESOURCES.map((res) => {
    const val = res.id === "population" ? pop : game.state.res[res.id];
    const sub = res.id === "population" ? `${fmt(sim.creatures.length)} ตัวในธรรมชาติ${sim.stats.civPop ? ` · ${fmt(sim.stats.civPop)} ในเมือง` : ""}` : `+${fmt(r[res.id])} / วินาที`;
    return `<article class="resource-card ${res.color}"><div class="resource-icon">${res.icon}</div><div class="resource-meta"><span>${res.name}</span><strong>${fmt(val)}</strong><small>${sub}</small></div></article>`;
  }).join("");

  // stats
  const st = sim.stats;
  const stats = [
    ["สิ่งมีชีวิต", fmt(st.n)], ["สายพันธุ์", fmt(st.alive)], ["อุณหภูมิ", tempC(sim.climate.offset)],
    ["เกิด / นาที", fmt(sim.ratePerMinute("births"))], ["ตาย / นาที", fmt(sim.ratePerMinute("deaths"))],
    sim.era >= 4 ? ["ถิ่นฐาน", fmt(sim.settlements.length)] : ["ถูกล่า", fmt(sim.totals.eaten)],
  ];
  $("statGrid").innerHTML = stats.map(([k, v]) => `<div class="stat"><small>${k}</small><strong>${v}</strong></div>`).join("");

  // chart
  const hi = drawPopulationChart($("popChart"), sim.history, chartHover);
  const tip = $("chartTip");
  if (hi >= 0) {
    const s = sim.history[hi], ago = (sim.tick - s.t) / TPS;
    tip.hidden = false;
    tip.innerHTML = `<div class="muted">${ago < 2 ? "ตอนนี้" : simClock(ago * TPS) + " ที่แล้ว"}</div>` + ROLE_NAMES.map((n, i) => `<div><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${ROLE_COLORS[i]}"></i> ${n} <b>${s.roles[i]}</b></div>`).join("") + `<div>รวม <b>${s.n}</b></div>`;
    tip.style.left = Math.min(chartHover + 10, $("popChart").clientWidth - 150) + "px";
  } else tip.hidden = true;
  $("popLegend").innerHTML = ROLE_NAMES.map((n, i) => `<span><i style="background:${ROLE_COLORS[i]}"></i>${n} <b>${st.roles[i]}</b></span>`).join("");
  renderer.drawMinimap($("minimap"));

  renderEra();
  renderTools();
  renderInspector();
}

function renderEra() {
  const era = ERAS[sim.era];
  $("eraNumber").textContent = `ERA ${String(sim.era + 1).padStart(2, "0")}`;
  $("eraType").textContent = era.type;
  $("eraTitle").textContent = era.name;
  $("eraDescription").textContent = era.description;
  const goals = game.goals();
  const cost = game.eraCost();
  let html = goals.map((g) => `<div class="goal ${g.done ? "done" : ""}"><div class="goal-label"><span>${g.done ? "✓ " : ""}${g.label}</span><strong>${fmt(Math.min(g.cur, g.need))} / ${fmt(g.need)}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, g.cur / g.need * 100)}%"></div></div></div>`).join("");
  if (cost) for (const [k, v] of Object.entries(cost)) {
    const have = game.state.res[k], ok = have >= v;
    html += `<div class="goal ${ok ? "done" : ""}"><div class="goal-label"><span>${ok ? "✓ " : ""}ใช้${RES_TH[k]}</span><strong>${fmt(Math.min(have, v))} / ${fmt(v)}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, have / v * 100)}%"></div></div></div>`;
  }
  setHTML($("goalList"), html);
  const can = game.canEvolve();
  $("evolveButton").disabled = !can;
  $("evolveButton").textContent = cost ? (can ? `🧬 วิวัฒนาการสู่ยุคถัดไป →` : "🧬 วิวัฒนาการขั้นต่อไป") : "✧ วิวัฒนาการถึงขีดสุดแล้ว";
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
  if (tool === "inspect") hint = "คลิกสิ่งมีชีวิตหรือถิ่นฐานเพื่อดูรายละเอียด · ลากเพื่อเลื่อน · เลื่อนล้อเพื่อซูม";
  $("toolHint").textContent = hint;
  $("world").classList.toggle("tool", tool !== "inspect");
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
    if (!s) { box.innerHTML = `<div class="insp-head"><h3>ถิ่นฐานถูกทิ้งร้างแล้ว</h3><button class="icon-button" data-insp="close">✕</button></div>`; return; }
    const sp = sim.species.get(s.sp);
    setHTML(box, `<div class="insp-head"><div><small>${SETTLEMENT_LEVELS[s.level].name}</small><h3>🏘️ ${esc(s.name)}</h3></div><button class="icon-button" data-insp="close">✕</button></div>
      <div class="insp-meta"><div>ประชากร<b>${fmt(s.pop)}</b></div><div>สูงสุด<b>${fmt(s.peak)}</b></div><div>ก่อตั้งเมื่อ<b>${simClock(s.born)}</b></div><div>ท่าอวกาศ<b>${s.port ? "มี" : "—"}</b></div></div>
      <p class="tiny muted">${sp ? `<span class="swatch" style="background:${spColor(sp)}"></span> ${esc(sp.name)}` : ""}<br>ถิ่นฐานหาอาหารจากพื้นที่รอบ ๆ ${sim.era >= 5 ? "เปลี่ยนป่าเป็นไร่นา " : ""}ล่าสัตว์ป่า สร้างความรู้ และส่งผู้อพยพไปสร้างเมืองใหม่</p>`);
    return;
  }
  if (!c) { box.hidden = true; return; }
  box.hidden = false;
  const sp = sim.species.get(c.sp);
  if (c.dead) {
    const causes = { eaten: "ถูกล่า", starved: "อดอาหาร", aged: "ตายตามอายุขัย", other: "ภัยธรรมชาติ" };
    setHTML(box, `<div class="insp-head"><div><small>#${c.id} · รุ่นที่ ${c.gen}</small><h3>${c.joined ? "เข้าร่วมถิ่นฐานแล้ว" : "สิ่งมีชีวิตตัวนี้ตายแล้ว"}</h3></div><button class="icon-button" data-insp="close">✕</button></div>
      <p class="tiny muted">${c.joined ? "ย้ายไปอาศัยในเมือง" : "สาเหตุ: " + (causes[c.cause] || "ไม่ทราบ")} · อายุ ${Math.round(c.age / TPS)} วินาที</p>
      <div class="insp-actions">${sp && sp.count > 0 ? `<button class="mini-btn" data-insp="another">ติดตามตัวอื่นในสายพันธุ์</button>` : ""}<button class="mini-btn" data-insp="close">ปิด</button></div>`);
    return;
  }
  const tierTh = TIER_TH[sp ? sp.tier : "cell"];
  setHTML(box, `<div class="insp-head"><div><small>#${c.id} · รุ่นที่ ${c.gen} · ${MODE_TH[c.mode]}</small><h3><span class="swatch" style="background:hsl(${c.g.hue | 0},62%,60%)"></span> ${esc(sp?.name || "?")}</h3><small>${esc(sp?.desc || tierTh)}</small></div><button class="icon-button" data-insp="close">✕</button></div>
    <div class="insp-meta"><div>พลังงาน<b>${Math.round(c.e / c.maxE * 100)}%</b></div><div>อายุ<b>${Math.round(c.age / c.maxAge * 100)}%</b></div><div>บทบาท<b>${ROLE_TH[c.g.diet >= 0.62 ? "carnivore" : c.g.diet >= 0.38 ? "omnivore" : "herbivore"]}</b></div><div>สายพันธุ์นี้<b>${fmt(sp?.count || 0)} ตัว</b></div></div>
    ${geneRows(c.g, sp?.avg, capsFor(sim.era))}
    <p class="tiny muted">แถบสีทอง = ค่าเฉลี่ยของสายพันธุ์</p>
    <div class="insp-actions"><button class="mini-btn ${renderer.follow ? "on" : ""}" data-insp="follow">${renderer.follow ? "กำลังติดตาม" : "🎥 ติดตาม"}</button><button class="mini-btn ${seedSpecies === c.sp ? "on" : ""}" data-insp="seed">🧬 เลือกปล่อย</button><button class="mini-btn" data-insp="species">ดูสายพันธุ์</button></div>`);
}

function setHTML(el, html) { if (el._html !== html) { el.innerHTML = html; el._html = html; } }

// ------------------------------------------------------------ tab views (1 Hz)
function updateHeavy() {
  if (activeTab === "upgrades") renderUpgrades();
  else if (activeTab === "life") renderSpecies();
  else if (activeTab === "mutation") renderLab();
  else if (activeTab === "technology") renderTech();
  else if (activeTab === "world") renderWorld();
  else if (activeTab === "archive") renderArchive();
  else if (activeTab === "cycle") renderCycle();
  const gen = sim.creatures.reduce((m, c) => Math.max(m, c.gen), 0);
  $("hudGen").textContent = `รุ่นที่ ${fmt(gen)}`;
}
function refreshNow() { updateFast(); updateHeavy(); }

function pips(n, max) { return `<div class="level-pips">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</div>`; }

function renderUpgrades() {
  setHTML($("upgradeGrid"), UPGRADES.map((u) => {
    const n = game.state.upgrades[u.id] || 0, locked = sim.era < u.era, maxed = n >= u.max, cost = game.upgradeCost(u), can = !locked && !maxed && game.state.res[u.res] >= cost;
    return `<article class="card ${locked ? "locked" : ""}"><div class="card-top"><div class="item-icon">${u.icon}</div><div><h3>${u.name}</h3><span>${locked ? `🔒 ปลดล็อกใน ERA ${u.era + 1}` : `ระดับ ${n} / ${u.max}`}</span></div></div><p>${u.desc}</p>${pips(n, u.max)}<div class="card-bottom"><span class="cost">${maxed ? "สูงสุด" : `${fmt(cost)} ${RES_TH[u.res]}`}</span><button class="buy-button" data-upgrade="${u.id}" ${can ? "" : "disabled"}>${maxed ? "✓" : "พัฒนา ↗"}</button></div></article>`;
  }).join(""));
}

function traitChips(a) {
  const out = [];
  out.push(`ขนาด ${a.size.toFixed(1)}`); out.push(`เร็ว ${a.speed.toFixed(1)}`);
  if (a.habitat > 0.6) out.push("บก"); else if (a.habitat > 0.35) out.push("ครึ่งบกครึ่งน้ำ"); else out.push("น้ำ");
  out.push(`ปัญญา ${(a.intellect * 100).toFixed(0)}`);
  return out.map((t) => `<span class="chip">${t}</span>`).join("");
}

function renderSpecies() {
  const alive = [...sim.species.values()].filter((s) => s.extinct === null && s.count > 0).sort((a, b) => b.count - a.count);
  $("speciesCount").textContent = `มีชีวิต ${alive.length} · เคยเกิดขึ้น ${fmt(sim.totals.species)} · สูญพันธุ์ ${fmt(sim.totals.extinct)}`;
  setHTML($("speciesList"), alive.slice(0, 40).map((s) => `<article class="sp-card ${seedSpecies === s.id ? "selected" : ""}">
    <span class="sp-dot" style="background:${spColor(s)}"></span>
    <div class="sp-name">${esc(s.name)}${s.sapient ? "<em>ผู้มีปัญญา</em>" : ""}</div>
    <div class="sp-count">${fmt(s.count)}<small>ตัว</small></div>
    <div class="sp-desc">${esc(s.desc)} · เกิดเมื่อ ${simClock(s.born)}</div>
    <div class="sp-foot"><div class="sp-traits">${traitChips(s.avg)}</div>${sparkSVG(s.hist, spColor(s))}</div>
    <div class="sp-foot"><span class="tiny muted">${s.parent && sim.species.get(s.parent) ? "แตกแขนงจาก " + esc(sim.species.get(s.parent).name) : "บรรพบุรุษแรกเริ่ม"}</span><div class="sp-actions"><button class="mini-btn" data-sp-follow="${s.id}">🎥 ติดตาม</button><button class="mini-btn ${seedSpecies === s.id ? "on" : ""}" data-sp-seed="${s.id}">🧬 เลือกปล่อย</button></div></div>
  </article>`).join("") || `<p class="muted">ยังไม่มีสายพันธุ์ที่มีชีวิต</p>`);
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
  const walk = (n, depth) => { order.push(n); (kids.get(n.id) || []).sort((a, b) => a.born - b.born).forEach((k) => walk(k, depth + 1)); };
  roots.sort((a, b) => a.born - b.born).forEach((r) => walk(r, 0));
  const rows = order.slice(0, 220), rowH = 15, labelW = 210, W = 900, H = rows.length * rowH + 26;
  const t1 = sim.tick, X = (t) => labelW + (t / Math.max(1, t1)) * (W - labelW - 12);
  const idx = new Map(rows.map((n, i) => [n.id, i]));
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="ต้นไม้วิวัฒนาการ">`;
  for (const e of game.state.eraLog) { const x = X(e.tick); svg += `<line x1="${x}" y1="0" x2="${x}" y2="${H - 18}" stroke="#263650" stroke-dasharray="3 3"/><text x="${x + 3}" y="${H - 5}" style="fill:#91a3bd;font-size:10px">${ERAS[e.era].icon} ${e.era + 1}</text>`; }
  rows.forEach((n, i) => {
    const y = i * rowH + 9, x0 = X(n.born), x1 = X(n.extinct ?? t1), alive = n.extinct === null;
    const col = spColor(n, alive ? 62 : 40);
    if (n.parent && idx.has(n.parent)) { const py = idx.get(n.parent) * rowH + 9; svg += `<path d="M${x0} ${py} V${y}" stroke="${col}" stroke-opacity=".5" fill="none"/>`; }
    svg += `<line x1="${x0}" y1="${y}" x2="${Math.max(x1, x0 + 2)}" y2="${y}" stroke="${col}" stroke-width="${alive ? 4 : 2}" stroke-linecap="round"/>`;
    svg += `<text x="6" y="${y + 4}" style="${alive ? "" : "fill:#62728b"}">${n.sapient ? "🧠 " : ""}${esc(n.name)}${alive ? ` · ${n.count}` : " †"}</text>`;
  });
  return svg + "</svg>";
}

function renderLab() {
  const s = game.state, P = sim.params;
  const guide = P.guide && sim.tick < P.guide.until ? P.guide : null;
  const mut = sim.tick < P.mutagenUntil;
  const gc = game.guideCost();
  const avg = {}; for (const k of GENE_KEYS) avg[k] = 0;
  for (const c of sim.creatures) for (const k of GENE_KEYS) avg[k] += c.g[k];
  for (const k of GENE_KEYS) avg[k] /= Math.max(1, sim.creatures.length);
  setHTML($("labGrid"), `
    <div class="panel lab-card"><span class="eyebrow">MUTATION RATE</span><h3>🧪 อัตราการกลายพันธุ์ ระดับ ${s.mutation}</h3>
      <p>ลูกมีโอกาสกลายพันธุ์ ${(P.mutationRate * 100).toFixed(0)}% ต่อยีน · ความแรง ${(P.mutationStrength * 100).toFixed(1)}% ของช่วงยีน · DNA +${s.mutation * 6}%<br>กลายพันธุ์มาก = ปรับตัวเร็วขึ้นและแตกสายพันธุ์บ่อยขึ้น แต่ลูกที่ด้อยกว่าก็มากขึ้น</p>
      ${pips(s.mutation, 10)}<div class="card-bottom" style="margin-top:12px"><span class="cost">${s.mutation >= 10 ? "สูงสุด" : fmt(game.mutationCost()) + " DNA"}</span><button class="buy-button" data-lab="mutation" ${s.mutation < 10 && s.res.dna >= game.mutationCost() ? "" : "disabled"}>กลายพันธุ์ ↗</button></div></div>
    <div class="panel lab-card"><span class="eyebrow">DIRECTIONAL SELECTION</span><h3>🎯 กำหนดแรงคัดเลือก</h3>
      <p>ผลักลูกที่เกิดใหม่ทั้งโลกไปทางลักษณะที่เลือกเป็นเวลา 90 วินาทีจำลอง · ${fmt(gc)} DNA ต่อครั้ง</p>
      ${guide ? `<div class="active-guide">กำลังคัดเลือก: <b>${GENES[guide.gene].label} ${guide.dir > 0 ? "↑" : "↓"}</b> · เหลือ ${Math.ceil((guide.until - sim.tick) / TPS)} วินาที</div>` : ""}
      <div class="guide-grid">${GUIDE_GENES.map((g) => `<span>${GENES[g.gene].label}</span><button class="mini-btn" data-guide="${g.gene}" data-dir="1" title="${g.up}" ${s.res.dna >= gc ? "" : "disabled"}>↑ ${g.up}</button><button class="mini-btn" data-guide="${g.gene}" data-dir="-1" title="${g.down}" ${s.res.dna >= gc ? "" : "disabled"}>↓</button>`).join("")}</div></div>
    <div class="panel lab-card"><span class="eyebrow">MUTAGEN</span><h3>☢️ รังสีเร่งการกลายพันธุ์</h3>
      <p>45 วินาทีจำลองที่อัตรากลายพันธุ์สูงขึ้น 3 เท่า เหมาะเมื่อโลกเปลี่ยนแปลงเร็ว เช่น ยุคน้ำแข็ง</p>
      ${mut ? `<div class="active-guide">กำลังทำงาน · เหลือ ${Math.ceil((P.mutagenUntil - sim.tick) / TPS)} วินาที</div>` : ""}
      <div class="card-bottom"><span class="cost">${fmt(game.mutagenCost())} DNA</span><button class="buy-button" data-lab="mutagen" ${s.res.dna >= game.mutagenCost() ? "" : "disabled"}>ปล่อยรังสี</button></div></div>
    <div class="panel lab-card"><span class="eyebrow">GENE POOL</span><h3>🧬 ยีนเฉลี่ยของสิ่งมีชีวิตทั้งโลก</h3>
      <p>ดูว่าโลกกำลังวิวัฒนาการไปทางไหน แถบสีทองคือขีดจำกัดของยุคปัจจุบัน</p>
      ${GENE_KEYS.map((k) => { const G = GENES[k], cap = capsFor(sim.era)[k]; const pct = (avg[k] - G.min) / (G.max - G.min) * 100; return `<div class="gene-row"><span>${G.label}</span><div class="gene-bar"><div style="width:${pct}%"></div>${cap !== undefined && cap < G.max ? `<i style="left:${(cap - G.min) / (G.max - G.min) * 100}%"></i>` : ""}</div><span>${k === "sense" ? Math.round(avg[k]) : avg[k].toFixed(2)}</span></div>`; }).join("")}</div>`);
}

function renderTech() {
  setHTML($("technologyGrid"), TECHS.map((t) => {
    const owned = !!game.state.techs[t.id], locked = sim.era < t.era, can = !owned && !locked && game.state.res.knowledge >= t.cost;
    return `<article class="card ${owned ? "owned" : ""} ${locked ? "locked" : ""}"><div class="card-top"><div class="item-icon">${t.icon}</div><div><h3>${t.name}</h3><span>${owned ? "✓ วิจัยแล้ว" : locked ? `🔒 ERA ${t.era + 1}` : t.desc}</span></div></div><p>${t.bonus}</p><div class="card-bottom"><span class="cost">${owned ? "" : fmt(t.cost) + " ความรู้"}</span><button class="buy-button" data-tech="${t.id}" ${can ? "" : "disabled"}>${owned ? "สำเร็จ" : "วิจัย"}</button></div></article>`;
  }).join(""));
}

function renderWorld() {
  const st = sim.stats, w = sim.world;
  let farm = 0, iceCells = 0, greenLand = 0;
  for (let i = 0; i < w.farm.length; i++) { farm += w.farm[i]; if (w.temp[i] < 0.1) iceCells++; if (!w.isWater(i)) greenLand += w.green[i]; }
  const div = Math.min(100, st.biodiversity / Math.log(30) * 100);
  const meters = [
    ["🌿 ความหลากหลายทางชีวภาพ", div, `${div.toFixed(0)}% · ${st.alive} สายพันธุ์`],
    ["🌱 พืชปกคลุมผืนดิน", greenLand / w.landCells * 100, `${(greenLand / w.landCells * 100).toFixed(0)}%`],
    ["🧊 น้ำแข็ง", iceCells / w.bio.length * 100, `${(iceCells / w.bio.length * 100).toFixed(0)}%`],
    ["🌾 ไร่นา", farm / w.landCells * 100, `${farm} ไร่`],
    ["🏭 มลพิษ", sim.climate.pollution / 0.32 * 100, `+${(sim.climate.pollution * 40).toFixed(1)}°C`],
  ];
  const events = sim.activeEvents.map((e) => ({ ice: "❄️ ยุคน้ำแข็ง", warm: "🔥 โลกร้อน", dust: "🌫️ ฝุ่นอุกกาบาต" }[e.kind] + ` · เหลือ ${Math.ceil((e.until - sim.tick) / TPS)} วิ`));
  setHTML($("ecologyMeters"), `<div class="meter-row"><div><span>🌡️ อุณหภูมิเฉลี่ย</span><strong>${tempC(sim.climate.offset)}</strong></div><div class="meter-track"><div style="width:${Math.max(2, Math.min(100, 50 + sim.climate.offset * 120))}%"></div></div></div>` +
    meters.map(([n, v, t]) => `<div class="meter-row"><div><span>${n}</span><strong>${t}</strong></div><div class="meter-track"><div style="width:${Math.max(1, Math.min(100, v))}%"></div></div></div>`).join("") +
    (events.length ? `<p class="tiny">${events.join("<br>")}</p>` : `<p class="tiny muted">ไม่มีเหตุการณ์ภูมิอากาศพิเศษตอนนี้</p>`));
  setHTML($("climateRow"), `<button class="secondary-button" data-climate="-1">❄️ ทำให้เย็นลง · ${fmt(game.climateCost())} ⚡</button><button class="secondary-button" data-climate="1">🔥 ทำให้อุ่นขึ้น · ${fmt(game.climateCost())} ⚡</button>`);
  const fw = [["🌿 ชีวมวลพืช", st.plants, "#3fae6a"], ["กินพืช", st.roles[0], ROLE_COLORS[0]], ["กินทั้งพืชและสัตว์", st.roles[1], ROLE_COLORS[1]], ["ผู้ล่า", st.roles[2], ROLE_COLORS[2]]];
  if (sim.era >= 4) fw.push(["🏘️ อารยธรรม", st.civPop, "#81b8ff"]);
  const max = Math.max(...fw.map((f) => f[1]), 1);
  setHTML($("foodWeb"), fw.map(([n, v, c]) => `<div class="fw-row"><span>${n}</span><div class="fw-bar" style="width:${Math.max(1, v / max * 100)}%;background:${c}"></div><b>${fmt(v)}</b></div>`).join(""));
  drawLineChart($("plantChart"), sim.history.map((h) => h.plants), "#3fae6a");
  setHTML($("eventLog"), game.state.log.slice(0, 60).map((l) => `<div class="event-item"><time>${simClock(l.t)}</time><p style="margin:0">${esc(l.text)}</p></div>`).join(""));
}

function renderArchive() {
  const s = game.state, T = sim.totals;
  const reached = new Map(s.eraLog.map((e) => [e.era, e]));
  const rec = [["เกิดทั้งหมด", T.births], ["ตายทั้งหมด", T.deaths], ["ถูกล่า", T.eaten], ["อดตาย", T.starved], ["สายพันธุ์ที่เคยมี", T.species], ["สูญพันธุ์", T.extinct], ["ประชากรสูงสุด", s.records.maxPop], ["สายพันธุ์พร้อมกันสูงสุด", s.records.maxSpecies], ["จรวดที่ปล่อย", sim.launches], ["อาณานิคม", sim.colonies]];
  const extinct = [...sim.species.values()].filter((x) => x.extinct !== null && x.peak >= 20).sort((a, b) => b.peak - a.peak).slice(0, 12);
  setHTML($("archiveContent"),
    `<article class="archive-card wide"><div class="record-grid">${rec.map(([k, v]) => `<div class="stat"><small>${k}</small><strong>${fmt(v)}</strong></div>`).join("")}</div></article>` +
    `<h3 class="archive-title">ยุคสมัย</h3>` +
    ERAS.map((e, i) => { const r = reached.get(i); return `<article class="archive-card ${r ? "" : "locked"}"><div class="archive-symbol">${r ? e.icon : "🔒"}</div><div><small>ERA ${String(i + 1).padStart(2, "0")}${r ? ` · ${simClock(r.tick)}` : ""}</small><h3>${r ? e.name : "ยุคที่ยังไม่ค้นพบ"}</h3><p>${r ? e.description : "วิวัฒนาการต่อไปเพื่อเปิดเผยประวัติศาสตร์"}</p></div></article>`; }).join("") +
    `<h3 class="archive-title">สายพันธุ์ที่สูญพันธุ์ไปแล้ว</h3>` +
    (extinct.length ? extinct.map((x) => `<article class="archive-card"><span class="sp-dot" style="background:${spColor(x, 40)};width:22px;height:22px"></span><div><small>${simClock(x.born)} – ${simClock(x.extinct)}</small><h3>${esc(x.name)}</h3><p>${esc(x.desc)} · ประชากรสูงสุด ${x.peak}</p></div></article>`).join("") : `<p class="muted">ยังไม่มีสายพันธุ์ใหญ่ที่สูญพันธุ์</p>`));
}

function renderCycle() {
  const can = game.canPrestige(), s = game.state;
  setHTML($("cycleContent"), `<div class="panel cycle-panel"><div><h3>🌌 การเกิดใหม่ของจักรวาล${s.cycles ? ` · วัฏจักรที่ ${s.cycles + 1}` : ""}</h3>
    <p>เศษซากจักรวาลที่มี: <b>${s.prestige}</b> · โบนัสถาวร: ทรัพยากรทั้งหมด +${s.prestige * 8}% · พืชโตเร็วขึ้น +${s.prestige * 4}%</p>
    <p class="tiny" style="margin-top:8px">${can ? `เริ่มใหม่ตอนนี้จะได้รับ <b>${game.prestigeGain()}</b> เศษซาก (จาก DNA สะสม ${fmt(s.totalDNA)} และอาณานิคม ${sim.colonies})` : `ปลดล็อกเมื่อถึง ERA 10 · ${ERAS[9].name} (ตอนนี้ ERA ${sim.era + 1})`}</p></div>
    <button class="primary-button" style="width:auto" id="prestigeButton" ${can ? "" : "disabled"}>🌌 เริ่มวัฏจักรใหม่</button></div>`);
}

// ------------------------------------------------------------ input
const canvas = $("world");
const pointers = new Map(); let drag = null, pinch = null;
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; drag = null; }
  else drag = { x: e.offsetX, y: e.offsetY, sx: e.offsetX, sy: e.offsetY, moved: false };
});
canvas.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    renderer.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch.d); pinch.d = d; return;
  }
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.offsetX - drag.sx, e.offsetY - drag.sy) > 5) { drag.moved = true; canvas.classList.add("dragging"); }
  if (drag.moved) { renderer.pan(e.offsetX - drag.x, e.offsetY - drag.y); drag.x = e.offsetX; drag.y = e.offsetY; }
});
const endPointer = (e) => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  canvas.classList.remove("dragging");
  if (drag && !drag.moved && e.type === "pointerup") clickWorld(e.offsetX, e.offsetY);
  drag = null;
};
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("wheel", (e) => { e.preventDefault(); renderer.zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });

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
  else if (a === "species") switchTab("life", true);
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
$("minimap").addEventListener("click", (e) => { const r = e.target.getBoundingClientRect(); renderer.follow = false; renderer.focus((e.clientX - r.left) / r.width * 1920, (e.clientY - r.top) / r.height * 1080); });
$("popChart").addEventListener("pointermove", (e) => { chartHover = e.offsetX; });
$("popChart").addEventListener("pointerleave", () => { chartHover = null; });

$("evolveButton").addEventListener("click", () => { if (game.evolve()) { absorbEvents(); toast(`วิวัฒนาการสำเร็จ: ${ERAS[sim.era].name}`); ticker(`${ERAS[sim.era].icon} เข้าสู่ ${ERAS[sim.era].name}`, "era"); game.save(); refreshNow(); } });
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
  if (f) { followSpecies(+f.dataset.spFollow); $("worldWrap").scrollIntoView({ behavior: "smooth", block: "center" }); }
  if (s) { seedSpecies = +s.dataset.spSeed; tool = "seed"; toast(`เลือก ${sim.species.get(seedSpecies).name} — คลิกบนแผนที่เพื่อปล่อย`); renderSpecies(); renderTools(); }
});
$("climateRow").addEventListener("click", (e) => { const b = e.target.closest("[data-climate]"); if (b) result(game.climate(+b.dataset.climate)); });
$("cycleContent").addEventListener("click", (e) => {
  if (!e.target.closest("#prestigeButton") || !game.canPrestige()) return;
  ask("เริ่มวัฏจักรใหม่?", `รับเศษซากจักรวาล ${game.prestigeGain()} ชิ้น โลกปัจจุบันจะถูกแทนที่ด้วยดาวดวงใหม่`, "เริ่มจักรวาลใหม่").then((ok) => { if (ok) { setGame(game.prestige()); toast("จักรวาลใหม่ถือกำเนิดแล้ว"); } });
});

function switchTab(tab, scroll = false) {
  activeTab = tab;
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${tab}`));
  updateHeavy();
  if (scroll) document.querySelector(".tabbar").scrollIntoView({ behavior: "smooth" });
}
document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

document.addEventListener("keydown", (e) => {
  if (e.target.closest("input,textarea,dialog[open]")) return;
  if (e.code === "Space") { e.preventDefault(); setSpeed(speed === 0 ? (setSpeed.prev || 1) : (setSpeed.prev = speed, 0)); }
  else if (["Digit1", "Digit2", "Digit3", "Digit4"].includes(e.code)) setSpeed([1, 3, 10, 30][+e.code.slice(-1) - 1]);
  else if (e.code === "KeyF") renderer.fitWorld();
  else if (e.code === "Escape") { closeInspector(); tool = "inspect"; renderTools(); }
});

// ------------------------------------------------------------ save / settings
function persist() { if (catchingUp) return; const ok = game.save(); $("saveState").textContent = ok ? "● บันทึกแล้ว" : "● บันทึกไม่ได้"; setTimeout(() => ($("saveState").textContent = "● บันทึกอัตโนมัติ"), 1600); }
setInterval(persist, 20000);
window.addEventListener("beforeunload", () => game.save());
document.addEventListener("visibilitychange", () => { if (document.hidden) game.save(); });

function setGame(g) {
  game = g; sim = g.sim; renderer.setSim(sim); closeInspector(); seedSpecies = null; acc = 0;
  incomeLog.length = 0; game.save(); focusLife(); refreshNow();
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
$("compactNumbers").checked = settings.compact; $("effectsToggle").checked = settings.effects; $("bgToggle").checked = settings.bg;
$("compactNumbers").addEventListener("change", (e) => { settings.compact = e.target.checked; saveSettings(); refreshNow(); });
$("effectsToggle").addEventListener("change", (e) => { settings.effects = e.target.checked; renderer.effects = settings.effects; document.body.classList.toggle("no-effects", !settings.effects); saveSettings(); });
$("bgToggle").addEventListener("change", (e) => { settings.bg = e.target.checked; saveSettings(); });
$("footerVersion").textContent = `ORIGIN v${VERSION} · Real-time evolution simulator`;
window.addEventListener("resize", () => renderer.resize());
new ResizeObserver(() => renderer.resize()).observe($("worldWrap"));

function focusLife() {
  const cs = sim.creatures;
  if (!cs.length) return renderer.fitWorld();
  let x = 0, y = 0; for (const c of cs) { x += c.x; y += c.y; }
  const any = cs[(Math.random() * cs.length) | 0];
  renderer.focus((x / cs.length + any.x) / 2, (y / cs.length + any.y) / 2, Math.max(renderer.fit * 2.6, 1.4));
}

// ------------------------------------------------------------ boot
renderer.resize();
focusLife();
refreshNow();
if (!settings.seenHelp) { $("helpDialog").showModal(); settings.seenHelp = true; saveSettings(); }
if (restored && savedAt) catchUp((Date.now() - savedAt) / 1000);
requestAnimationFrame(frame);
window.__origin = { get game() { return game; }, get sim() { return sim; }, renderer, setSpeed };
