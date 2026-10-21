import {ERAS,RESOURCES,UPGRADES,ORGANISMS,TECHS} from "./data.js";
import {loadState,saveState,format,production,upgradeCost,tick,evolve,canEvolve,buyUpgrade,buyTech,mutate,prestige,offlineProgress} from "./engine.js";

let state=loadState(),compact=true,effects=true,sound=false,activeTab="evolution",lastRender=0,toastTimer;
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>format(n,compact);
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2200);}
function pushLog(msg){state.log.unshift(msg);state.log=state.log.slice(0,35);}
function renderResources(p){
 $("resourceGrid").innerHTML=RESOURCES.map(r=>`<article class="resource-card ${r.color}"><div class="resource-icon">${r.icon}</div><div class="resource-meta"><span>${r.name}</span><strong>${fmt(state.resources[r.id])}</strong><small>+${fmt(p[r.id])} / วินาที</small></div><div class="resource-spark">${sparkline((state.resources[r.id]||0)+p[r.id])}</div></article>`).join("");
}
function sparkline(n){return `<svg viewBox="0 0 70 28" aria-hidden="true"><polyline points="0,23 10,19 20,21 30,13 40,16 50,8 60,10 70,3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;}
function renderHero(){
 const e=ERAS[state.era],next=e.need,p=state.resources.dna,percent=Number.isFinite(next)?Math.min(100,p/next*100):100;
 $("eraNumber").textContent=`ERA ${String(state.era+1).padStart(2,"0")}`;$("eraType").textContent=e.type;
 $("eraTitle").textContent=e.name;$("eraDescription").textContent=e.description;
 $("eraProgressLabel").textContent=Number.isFinite(next)?`${fmt(p)} / ${fmt(next)} DNA`:"วิวัฒนาการสูงสุด";
 $("eraProgress").style.width=percent+"%";
 $("evolveButton").disabled=!canEvolve(state);$("evolveButton").innerHTML=state.era>=ERAS.length-1?"✧ วิวัฒนาการถึงขีดสุดแล้ว":`🧬 วิวัฒนาการขั้นต่อไป <span>→</span>`;
 $("evolveHint").textContent=state.era>=ERAS.length-1?"คุณเดินทางมาถึงขอบเขตปัจจุบันของจักรวาลแล้ว":canEvolve(state)?`พร้อมปลดล็อก: ${e.unlock}`:`ต้องการ DNA อีก ${fmt(Math.max(0,next-p))}`;
 const sec=Math.floor(state.totalSeconds),h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),ss=sec%60;
 $("elapsedLabel").textContent=h?`${h}h ${m}m`:`${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
}
function renderUpgrades(){
 const available=UPGRADES.filter(u=>state.era>=u.era).length;
 $("upgradeCount").textContent=`${available} / ${UPGRADES.length} unlocked`;
 $("upgradeGrid").innerHTML=UPGRADES.map(u=>{
  const count=state.upgrades[u.id]||0,cost=upgradeCost(u,state),locked=state.era<u.era,afford=state.resources[u.res]>=cost;
  return `<article class="upgrade-card ${locked?"locked":""}"><div class="upgrade-top"><div class="item-icon">${u.icon}</div><div class="upgrade-title"><h3>${u.name}</h3><span>ระดับ ${count}${locked?` · 🔒 ERA ${u.era+1}`:""}</span></div></div><p>${u.desc}</p><div class="effect-line">${Object.entries(u.effects).map(([k,v])=>`+${v} ${RESOURCES.find(r=>r.id===k)?.name||k}/s`).join(" · ")}</div><div class="upgrade-bottom"><span class="cost">${fmt(cost)} ${u.res==="dna"?"DNA":u.res==="energy"?"พลังงาน":"ความรู้"}</span><button class="buy-button" data-upgrade="${u.id}" ${locked||!afford?"disabled":""}>${locked?"ล็อก":"พัฒนา ↗"}</button></div></article>`;
 }).join("");
}
function renderOrganisms(){
 $("organismGrid").innerHTML=ORGANISMS.map(o=>{const found=!!state.discovered[o.id],active=state.era>=o.era;return `<article class="organism-card ${found?"discovered":"undiscovered"}"><div class="organism-emoji">${found?o.icon:"?"}</div><div class="organism-content"><div class="organism-title"><h3>${found?o.name:"สิ่งมีชีวิตที่ยังไม่ค้นพบ"}</h3><span class="tag">${active?"ERA "+(o.era+1):"LOCKED"}</span></div><p>${found?o.description:"ก้าวหน้าไปอีกยุคเพื่อค้นพบรูปแบบชีวิตใหม่นี้"}</p><div class="trait">✦ ${found?o.trait:"ข้อมูลยังไม่เพียงพอ"} · ${found?"โบนัส "+o.bonus:"???"}</div></div></article>`}).join("");
 $("mutationCost").textContent=fmt(Math.ceil(100*Math.pow(2.1,state.mutations)))+" DNA";
 $("mutationButton").disabled=state.resources.dna<Math.ceil(100*Math.pow(2.1,state.mutations));
}
function renderTech(){
 $("technologyGrid").innerHTML=TECHS.map(t=>{const owned=!!state.technologies[t.id],locked=state.era<t.era,afford=state.resources.knowledge>=t.cost;return `<article class="tech-card ${owned?"owned":""} ${locked?"locked":""}"><div class="tech-icon">${t.icon}</div><div class="tech-body"><div class="tech-title"><h3>${t.name}</h3><span>${owned?"✓ วิจัยแล้ว":locked?"ERA "+(t.era+1):fmt(t.cost)+" ความรู้"}</span></div><p>${t.desc}</p><small>${t.bonus}</small></div><button class="buy-button" data-tech="${t.id}" ${owned||locked||!afford?"disabled":""}>${owned?"สำเร็จ":"วิจัย"}</button></article>`}).join("");
}
function renderWorld(){
 const e=state.ecology;
 $("ecologyMeters").innerHTML=[["ความหลากหลายทางชีวภาพ",e.biodiversity,"🌿"],["เสถียรภาพภูมิอากาศ",e.climate,"🌤️"],["พื้นที่อยู่อาศัย",e.habitat,"🌍"]].map(([n,v,i])=>`<div class="meter-row"><div><span>${i} ${n}</span><strong>${Math.round(v)}%</strong></div><div class="meter-track"><div style="width:${v}%"></div></div></div>`).join("");
 $("eventLog").innerHTML=state.log.slice(0,12).map((l,i)=>`<div class="event-item"><span class="event-dot"></span><p>${esc(l)}</p></div>`).join("");
 $("prestigeButton").disabled=state.era<9;
}
function renderArchive(){
 const unlocked=ERAS.filter((e,i)=>i<=state.era);
 $("archiveContent").innerHTML=`<article class="archive-card wide"><div class="archive-symbol">📚</div><div><h3>บันทึกยุคที่ค้นพบ</h3><p>คุณค้นพบแล้ว ${unlocked.length} จาก ${ERAS.length} ยุค</p><div class="archive-progress"><div style="width:${unlocked.length/ERAS.length*100}%"></div></div></div></article>`+ERAS.map((e,i)=>`<article class="archive-card ${i<=state.era?"":"locked"}"><div class="archive-symbol">${i<=state.era?e.icon:"🔒"}</div><div><small>ERA ${String(i+1).padStart(2,"0")}</small><h3>${i<=state.era?e.name:"ยุคที่ยังไม่ค้นพบ"}</h3><p>${i<=state.era?e.description:"วิวัฒนาการต่อไปเพื่อเปิดเผยประวัติศาสตร์"}</p></div></article>`).join("");
}
function render(){
 const p=production(state);renderResources(p);renderHero();renderUpgrades();renderOrganisms();renderTech();renderWorld();renderArchive();
 $("prestigeButton").textContent=`🌌 เริ่มวัฏจักรใหม่ (+${Math.max(1,Math.floor(Math.sqrt(state.totalDNA/1e6)))} เศษซาก)`;
}
function switchTab(tab){
 activeTab=tab;document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
 document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${tab}`));
}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
$("evolveButton").addEventListener("click",()=>{if(evolve(state)){render();persist();toast(`วิวัฒนาการสำเร็จ: ${ERAS[state.era].name}`)}});
$("upgradeGrid").addEventListener("click",e=>{const b=e.target.closest("[data-upgrade]");if(!b)return;const result=buyUpgrade(state,b.dataset.upgrade);if(result.ok){render();persist()}else toast(result.reason)});
$("technologyGrid").addEventListener("click",e=>{const b=e.target.closest("[data-tech]");if(!b)return;if(buyTech(state,b.dataset.tech)){render();persist();toast("ค้นพบเทคโนโลยีใหม่")}else toast("ความรู้ไม่เพียงพอหรือยังไม่ปลดล็อก")});
$("mutationButton").addEventListener("click",()=>{if(mutate(state)){render();persist();toast("เกิดการกลายพันธุ์! ผลผลิตเพิ่มขึ้น")}else toast("DNA ไม่เพียงพอ")});
$("prestigeButton").addEventListener("click",()=>{if(state.era<9)return;const amount=Math.max(1,Math.floor(Math.sqrt(state.totalDNA/1e6)));if(confirm(`เริ่มจักรวาลใหม่เพื่อรับเศษซาก ${amount} ชิ้นหรือไม่? โบนัสนี้เพิ่มผลผลิตถาวร แต่จะรีเซ็ตความก้าวหน้ารอบนี้`)){prestige(state);render();persist();toast("จักรวาลใหม่ถือกำเนิดแล้ว")}});
function persist(){saveState(state);$("saveState").textContent="● บันทึกแล้ว";setTimeout(()=>$("saveState").textContent="● บันทึกอัตโนมัติ",1600)}
$("exportSave").addEventListener("click",()=>{persist();const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="origin-save.json";a.click();URL.revokeObjectURL(url);toast("ส่งออกเซฟแล้ว")});
$("importSave").addEventListener("click",()=>$("importFile").click());
$("importFile").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const parsed=JSON.parse(await file.text());if(parsed.version!==2||!parsed.resources)throw Error();state=parsed;persist();render();toast("นำเข้าเซฟสำเร็จ")}catch{toast("ไฟล์เซฟไม่ถูกต้อง")}e.target.value=""});
$("resetGame").addEventListener("click",()=>{if(confirm("เริ่มเกมใหม่? ความคืบหน้าปัจจุบันจะถูกลบ")){localStorage.removeItem("originEvolutionSave_v2");location.reload()}});
$("settingsButton").addEventListener("click",()=>$("settingsDialog").showModal());
$("compactNumbers").addEventListener("change",e=>{compact=e.target.checked;render()});
$("effectsToggle").addEventListener("change",e=>{effects=e.target.checked;document.body.classList.toggle("no-effects",!effects)});
$("soundToggle").addEventListener("click",()=>{sound=!sound;$("soundToggle").classList.toggle("selected",sound);toast(sound?"เสียงเปิดอยู่ (เสียงประกอบจะเพิ่มในเวอร์ชันถัดไป)":"ปิดเสียง")});
window.addEventListener("beforeunload",()=>saveState(state));
const offline=offlineProgress(state);if(offline>3)toast(`ยินดีต้อนรับกลับ! สะสมทรัพยากรออฟไลน์ ${Math.floor(offline/60)} นาที`);
render();persist();
setInterval(()=>{tick(state,1);if(Date.now()-lastRender>400){render();lastRender=Date.now()}},1000);
setInterval(persist,12000);
