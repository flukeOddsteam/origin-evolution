import { ERAS, UPGRADES, ORGANISMS, TECHS } from "./data.js";

export const SAVE_KEY = "originEvolutionSave_v2";
export const freshState = () => ({
 version:2, createdAt:Date.now(), lastTick:Date.now(), totalSeconds:0,
 resources:{dna:0,energy:40,population:1,knowledge:0},
 era:0, upgrades:{}, discovered:{}, technologies:{}, mutations:0,
 ecology:{biodiversity:18,climate:82,habitat:60}, prestige:0, totalDNA:0,
 achievements:[], log:["ชีวิตเริ่มต้นจากเงื่อนไขที่เหมาะสม","ระบบจำลองเริ่มทำงาน"]
});
export function loadState(){
 try { const s=JSON.parse(localStorage.getItem(SAVE_KEY)); if(s?.version===2)return {...freshState(),...s,resources:{...freshState().resources,...s.resources},ecology:{...freshState().ecology,...s.ecology}}; } catch {}
 return freshState();
}
export function saveState(s){s.lastTick=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(s));}
export function format(n,compact=true){
 if(!Number.isFinite(n))return "∞";
 if(compact){for(const [v,s] of [[1e15,"Qa"],[1e12,"T"],[1e9,"B"],[1e6,"M"],[1e3,"K"]])if(Math.abs(n)>=v)return (n/v).toFixed(n/v>=100?0:2)+s;}
 return n<100&&n%1!==0?n.toFixed(1):Math.floor(n).toLocaleString("en-US");
}
export function upgradeCost(u,s){return Math.ceil(u.cost*Math.pow(1.18,s.upgrades[u.id]||0));}
export function techEffect(s,key){
 let mult=1;
 for(const t of TECHS)if(s.technologies[t.id])mult+=t.effect[key]||t.effect.all||0;
 return mult*(1+s.prestige*.05)*(1+s.mutations*.08);
}
export function production(s){
 const r={dna:0,energy:0,population:0,knowledge:0};
 for(const u of UPGRADES){const n=s.upgrades[u.id]||0;for(const [k,v] of Object.entries(u.effects))r[k]+=v*n*Math.pow(1.035,s.era);}
 for(const o of ORGANISMS)if(s.discovered[o.id]){
   const mult=1+(s.mutations*.08);
   if(o.bonus==="DNA")r.dna+=o.base*mult;
   if(o.bonus==="พลังงาน")r.energy+=o.base*mult;
   if(o.bonus==="ประชากร")r.population+=o.base*mult;
   if(o.bonus==="ความรู้")r.knowledge+=o.base*mult;
 }
 for(const k of Object.keys(r))r[k]*=techEffect(s,k);
 r.population*=Math.max(.15,s.ecology.habitat/60);
 r.energy*=Math.max(.2,s.ecology.climate/80);
 return r;
}
export function tick(s,seconds=1){
 const dt=Math.max(0,Math.min(seconds,60));
 const p=production(s);
 for(const k of Object.keys(p))s.resources[k]+=p[k]*dt;
 s.totalSeconds+=dt;s.totalDNA+=p.dna*dt;
 // Lightweight planetary feedback, not a scientific climate simulation.
 s.ecology.biodiversity=Math.max(0,Math.min(100,s.ecology.biodiversity+(s.era<4?.006:-.002)*dt+(s.discovered.crop?.002:0)));
 s.ecology.climate=Math.max(25,Math.min(100,s.ecology.climate+(s.era>=7?-.004:.001)*dt));
 s.ecology.habitat=Math.max(10,Math.min(100,s.ecology.habitat+(s.resources.population>10000?-.003:.002)*dt));
 for(const o of ORGANISMS)if(s.era>=o.era)s.discovered[o.id]=true;
 return p;
}
export function canEvolve(s){const e=ERAS[s.era];return e&&Number.isFinite(e.need)&&s.resources.dna>=e.need;}
export function evolve(s){
 if(!canEvolve(s)||s.era>=ERAS.length-1)return false;
 const old=ERAS[s.era];s.resources.dna-=old.need;s.era++;
 s.log.unshift(`วิวัฒนาการสู่ ${ERAS[s.era].name} สำเร็จ`);
 s.log=s.log.slice(0,35);return true;
}
export function buyUpgrade(s,id){
 const u=UPGRADES.find(x=>x.id===id);if(!u||s.era<u.era)return {ok:false,reason:"ยังไม่ถึงยุคที่ปลดล็อก"};
 const cost=upgradeCost(u,s);if(s.resources[u.res]<cost)return {ok:false,reason:"ทรัพยากรไม่เพียงพอ"};
 s.resources[u.res]-=cost;s.upgrades[id]=(s.upgrades[id]||0)+1;
 s.log.unshift(`พัฒนา ${u.name} ระดับ ${s.upgrades[id]}`);return {ok:true};
}
export function buyTech(s,id){
 const t=TECHS.find(x=>x.id===id);if(!t||s.era<t.era||s.technologies[id])return false;
 if(s.resources.knowledge<t.cost)return false;
 s.resources.knowledge-=t.cost;s.technologies[id]=true;s.log.unshift(`ค้นพบเทคโนโลยี: ${t.name}`);return true;
}
export function mutate(s){
 const cost=Math.ceil(100*Math.pow(2.1,s.mutations));if(s.resources.dna<cost)return false;
 s.resources.dna-=cost;s.mutations++;s.log.unshift(`เกิดการกลายพันธุ์ที่มีประโยชน์ (ระดับ ${s.mutations})`);return true;
}
export function prestige(s){
 if(s.era<9)return false;
 const gained=Math.max(1,Math.floor(Math.sqrt(s.totalDNA/1e6)));
 const n=freshState();n.prestige=s.prestige+gained;n.log.unshift(`จักรวาลเริ่มวัฏจักรใหม่ ได้เศษซากจักรวาล ${gained}`);
 Object.assign(s,n);return true;
}
export function offlineProgress(s){
 const elapsed=Math.max(0,Math.min(8*60*60,(Date.now()-(s.lastTick||Date.now()))/1000));
 if(elapsed>3){tick(s,elapsed);s.log.unshift(`ระหว่างออฟไลน์ ${Math.floor(elapsed/60)} นาที โลกผลิตทรัพยากรต่อเนื่อง`);}
 return elapsed;
}
