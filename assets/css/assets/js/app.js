// === config ===
const API = {
  // swap to your Worker / backend domain when ready:
  base: "https://round-sunset-491a.ilanhzam.workers.dev", // temporary
  market: (range="2d") => `${API.base}?mode=${range}`,       // placeholder mapper
  recsLive:   "/recs/live",        // real backend: /recs/live
  recsHistory:"/recs/history",
  simulate:   (s,e)=>`/simulate?start=${s}&end=${e}`
};

// === tiny router ===
const pages = [...document.querySelectorAll(".page")];
const miniMissed = document.getElementById("mini-missed");
function show(route){
  pages.forEach(p => p.classList.toggle("hide", p.dataset.route !== route));
  // PRD: mini tracker on all except main & missed
  miniMissed.classList.toggle("hide", (route==="main" || route==="missed"));
}
window.addEventListener("hashchange", ()=>goto(location.hash));
function goto(hash){
  const route = (hash||"#/main").replace("#/","");
  show(route);
}
goto(location.hash);

// === Slot-Machine Numbers (SMN) ===
function spinTo(el, value, {decimals=2, dur=600}={}){
  const start = performance.now();
  const from = Number(el.dataset.val||0);
  const to = Number(value);
  function frame(t){
    const k = Math.min(1, (t-start)/dur);
    const eased = 1 - Math.pow(1-k, 3);
    const v = from + (to-from)*eased;
    el.textContent = v.toFixed(decimals);
    if(k<1) requestAnimationFrame(frame); else el.dataset.val = to;
  }
  requestAnimationFrame(frame);
}

// === Main page ===
const livePriceEl = document.getElementById("livePrice");
const change2dEl  = document.getElementById("change2d");
let mainChart;
async function loadMain(){
  // placeholder call; replace with real GET /market/vix?range=2d
  const r = await fetch(API.market("2d"), {cache:"no-store"}).then(x=>x.json()).catch(()=>null);
  // Use fake data if API not ready:
  const times = (r?.times) || Array.from({length:60}, (_,i)=>Date.now()-((59-i)*60e3));
  const prices= (r?.prices)|| times.map((_,i)=> 16 + Math.sin(i/9)*0.7 + Math.random()*0.15);
  const last  = (r?.last?.price) ?? prices[prices.length-1];
  const ch2d  = ((prices[prices.length-1]/prices[0]-1)*100);

  spinTo(livePriceEl, last);
  spinTo(change2dEl, ch2d, {decimals:2});
  document.body.classList.toggle("theme-bull", ch2d>=0);
  document.body.classList.toggle("theme-bear", ch2d<0);

  const ctx = document.getElementById("mainChart");
  mainChart?.destroy();
  mainChart = new Chart(ctx, {
    type:"line",
    data:{ labels: times.map(t=>new Date(t).toLocaleTimeString()),
      datasets:[{ data: prices, borderColor: ch2d>=0 ? getCss("--up") : getCss("--down"), tension:.25, pointRadius:0 }]},
    options:{ responsive:true, plugins:{legend:{display:false}}, scales:{x:{display:false}, y:{display:true}} }
  });
}

// === Live trades page ===
const $liveEmpty = document.getElementById("live-empty");
const $liveFound = document.getElementById("live-found");
const $trades    = document.getElementById("trades");
const $lfAsset   = document.getElementById("lf-asset");
const $lfPrice   = document.getElementById("lf-price");
const $lf1d      = document.getElementById("lf-1d");
const $lf2d      = document.getElementById("lf-2d");
let liveChart;

async function loadLive(range="2d"){
  // Placeholder: reuse market() output for header; generate 0–2 fake trades if none.
  const m = await fetch(API.market(range), {cache:"no-store"}).then(x=>x.json()).catch(()=>null);
  const last = (m?.last?.price) ?? 16.1;
  const change1d = (m?.change1d) ?? (Math.random()*2-1);
  const change2d = (m?.change2d) ?? (Math.random()*3-1.5);

  $lfAsset.textContent = "VIX";
  spinTo($lfPrice, last);
  spinTo($lf1d, change1d, {decimals:2});
  spinTo($lf2d, change2d, {decimals:2});

  // ranges bars (placeholder normalized)
  setBar("bar1d", change1d);
  setBar("bar2d", change2d);

  const times = (m?.times)||Array.from({length:80},(_,i)=>i);
  const prices=(m?.prices)||times.map((_,i)=> last + Math.sin(i/8)*0.5 + Math.random()*0.2);
  const ctx = document.getElementById("liveChart");
  liveChart?.destroy();
  liveChart = new Chart(ctx, {type:"line",
    data:{labels:times, datasets:[{data:prices, borderColor:getCss("--up"), pointRadius:0, tension:.25}]},
    options:{plugins:{legend:{display:false}}, scales:{x:{display:false}, y:{display:true}}}
  });

  // Live recs (placeholder list)
  const recs = await fakeRecs(); // replace with: fetch(API.recsLive).then(r=>r.json())
  if(!recs.length){
    $liveFound.classList.add("hide");
    $liveEmpty.classList.remove("hide");
  } else {
    $liveEmpty.classList.add("hide");
    $liveFound.classList.remove("hide");
    renderRecs(recs);
  }
}
function setBar(id, change){ // map change to 0..100%
  const el = document.getElementById(id);
  const pct = Math.max(0, Math.min(100, 50 + change*10));
  el.style.left = `${pct-10}%`;
  el.style.width= `20%`;
}
function renderRecs(recs){
  $trades.innerHTML = "";
  for(const r of recs){
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="pill">PUTs to buy</div>
      <div>Strike: <b>${r.strikePrice.toFixed(2)}</b></div>
      <div>Date: ${new Date(r.strikeDate).toLocaleDateString()}</div>
      <div>Premium: ${r.premium.toFixed(2)}</div>
      <div>Break-even: ${r.breakEven.toFixed(2)}</div>
      <div>Prob. revert: <b style="color:${r.probRevert>=0.5?getCss("--up"):getCss("--down")}">${(r.probRevert*100).toFixed(0)}%</b></div>
      <div>${r.asset}</div>
    `;
    $trades.appendChild(row);
  }
}
document.getElementById("tryAgain").onclick = ()=>loadLive();
document.querySelectorAll(".tab").forEach(b=>{
  b.onclick = ()=>{ document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    b.classList.add("active"); loadLive(b.dataset.range); };
});

// === Simulate page ===
const startPrice = document.getElementById("startPrice");
const endPrice   = document.getElementById("endPrice");
const startVal   = document.getElementById("startVal");
const endVal     = document.getElementById("endVal");
const hikePct    = document.getElementById("hikePct");
const simResults = document.getElementById("simResults");
const needle     = document.getElementById("gaugeNeedle");
let simChart;

function updateSim(){
  const s = Number(startPrice.value);
  const e = Math.max(s+0.25, Number(endPrice.value));
  endPrice.value = e;
  startVal.textContent = s.toFixed(2);
  endVal.textContent   = e.toFixed(2);
  const pct = (e/s-1)*100;
  hikePct.textContent  = pct.toFixed(2) + "%";
  drawSim(s, e);
}
function drawSim(s, e){
  const ctx = document.getElementById("simChart");
  const path = [s, (s*0.66 + e*0.34), (s*0.33 + e*0.67), e];
  simChart?.destroy();
  simChart = new Chart(ctx,{type:"line",
    data:{labels: [0,1,2,3], datasets:[{data:path, borderColor:getCss("--up"), tension:.3, pointRadius:0}]},
    options:{plugins:{legend:{display:false}}, scales:{x:{display:false}, y:{display:true}}}
  });
}
document.getElementById("calc").onclick = async ()=>{
  const s = Number(startPrice.value), e = Number(endPrice.value);
  // Replace with real API:
  const resp = await fakeSim(s,e); // fetch(API.simulate(s,e)).then(x=>x.json())
  simResults.classList.remove("hide");
  document.getElementById("likelihood").textContent = resp.likelihood || "—";
  // Move needle 0..100% across gauge:
  needle.style.left = `${Math.max(5, Math.min(95, resp.probRevert*100))}%`;
};
document.getElementById("reset").onclick = ()=>{
  startPrice.value = 16; endPrice.value = 18; updateSim(); simResults.classList.add("hide");
};
[startPrice, endPrice].forEach(i=>i.addEventListener("input", updateSim));

// === History page (missed trades) + mini tracker ===
async function loadHistory(){
  const list = document.getElementById("history");
  const data = await fakeHistory(); // replace with: fetch(API.recsHistory).then(r=>r.json())
  list.innerHTML = "";
  data.forEach(d=>{
    const row = document.createElement("div");
    row.className = "row " + (d.pnlPct>=0 ? "good" : "bad");
    row.innerHTML = `
      <div><a class="btn small" href="#/main">Go to main</a></div>
      <div>${d.asset}</div>
      <div>START: ${new Date(d.startDate).toLocaleDateString()}</div>
      <div>SALE: ${new Date(d.sellDate).toLocaleDateString()}</div>
      <div>DAYS: ${d.daysInTrade}</div>
      <div>BOUGHT: ${d.boughtAt.toFixed(2)}</div>
      <div>SOLD: ${d.soldAt.toFixed(2)}</div>
      <div><b>${(d.pnlPct*100).toFixed(1)}%</b></div>`;
    list.appendChild(row);
  });

  // mini tracker
  const mini = document.getElementById("mini-missed-list");
  mini.innerHTML = "";
  data.slice(0,5).forEach(d=>{
    const it = document.createElement("div");
    it.textContent = `${new Date(d.startDate).toLocaleDateString()} • ${(d.pnlPct*100).toFixed(0)}%`;
    mini.appendChild(it);
  });
}

// === helpers & boot ===
function getCss(varName){ return getComputedStyle(document.documentElement).getPropertyValue(varName).trim(); }
document.getElementById("scrollTop").onclick = () => scrollTo({top:0, behavior:"smooth"});
loadMain(); loadLive(); updateSim(); loadHistory();

// --- temporary fakers until the API is ready ---
async function fakeRecs(){
  if (Math.random() < 0.4) return []; // simulate "chilling"
  const now = Date.now();
  return Array.from({length:2+Math.floor(Math.random()*2)}, (_,i)=>({
    id:i+1, asset:"VIX",
    strikeDate: now + (12+i)*86400000,
    strikePrice: 15 + Math.random()*6,
    optionType:"PUT", premium: 0.8 + Math.random()*1.2,
    breakEven: 14 + Math.random()*4,
    probRevert: 0.45 + Math.random()*0.4
  }));
}
async function fakeSim(s,e){
  const hikePct = (e/s-1);
  const probRevert = Math.max(0.05, Math.min(0.95, 0.35 + hikePct*0.8 + (Math.random()-0.5)*0.1));
  return { hikePct, probRevert, likelihood: probRevert>0.6 ? "Likely" : probRevert>0.4 ? "Maybe" : "Unlikely" };
}
async function fakeHistory(){
  const now = Date.now();
  return Array.from({length:10}, (_,i)=>{
    const start = now-(i+15)*86400000, end = start + (7+Math.floor(Math.random()*14))*86400000;
    const bought = 1 + Math.random()*2; const sold = bought * (0.8 + Math.random()*0.7);
    return { id:i, asset:"VIX", startDate:start, sellDate:end, daysInTrade:Math.round((end-start)/86400000),
             boughtAt:bought, soldAt:sold, pnlPct:(sold/bought-1) };
  });
}
