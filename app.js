// Budget Buddy PWA v0.6 – tab fix, green theme, logo
const state = {
  incomes: [],
  expenses: [],
  debts: [],
  settings: { wiggle: 5, spend: 5, strat: "Avalanche", paydays: [15,30], alertDays: 7, theme: "system" },
  history: [] // {month:'YYYY-MM', expenseTotal:number}
};

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const currency = v => `$${Number(v||0).toFixed(2)}`;

// Theme handling
function applyTheme(theme){
  const root = document.documentElement;
  if(theme === "light"){ root.setAttribute("data-theme","light"); }
  else if(theme === "dark"){ root.setAttribute("data-theme","dark"); }
  else { root.removeAttribute("data-theme"); } // system
}
function save(){ localStorage.setItem("bb_data", JSON.stringify(state)); }
function load(){
  try{
    const raw = localStorage.getItem("bb_data");
    if(raw){ Object.assign(state, JSON.parse(raw)); }
  }catch(e){ console.warn(e); }
  applyTheme(state.settings.theme || "system");
}

// Helpers
function thisMonthKey(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }

// UI Tables + Editing
function updateEmptyStates(){
  $("#incomeEmpty").hidden = state.incomes.length>0;
  $("#expEmpty").hidden = state.expenses.length>0;
  $("#debtEmpty").hidden = state.debts.length>0;
}
function rowHTML(cells){ return `<tr>${cells.join('')}</tr>`; }
function cell(text){ return `<td>${text}</td>`; }
function renderTables(){
  // income
  const it = $("#incomeTable tbody"); if(it){ it.innerHTML=""; }
  state.incomes.forEach((i,idx)=>{
    it.insertAdjacentHTML("beforeend", rowHTML([
      cell(`<span class="r" data-type="inc" data-i="${idx}" data-f="name">${i.name}</span>`),
      cell(`<span class="r" data-type="inc" data-i="${idx}" data-f="amount">${currency(i.amount)}</span>`),
      cell(`<span class="r" data-type="inc" data-i="${idx}" data-f="freq">${i.freq||"Monthly"}</span>`),
      cell(`<button data-x="inc" data-i="${idx}" type="button">Delete</button>`)
    ]));
  });

  // expenses
  const et = $("#expTable tbody"); if(et){ et.innerHTML=""; }
  state.expenses.forEach((e,idx)=>{
    et.insertAdjacentHTML("beforeend", rowHTML([
      cell(`<span class="r" data-type="exp" data-i="${idx}" data-f="name">${e.name}</span>`),
      cell(`<span class="r" data-type="exp" data-i="${idx}" data-f="amount">${currency(e.amount)}</span>`),
      cell(`<span class="r" data-type="exp" data-i="${idx}" data-f="due">${e.due}</span>`),
      cell(`<span class="r" data-type="exp" data-i="${idx}" data-f="cat">${e.cat||"General"}</span>`),
      cell(`<button data-x="exp" data-i="${idx}" type="button">Delete</button>`)
    ]));
  });

  // debts
  const dt = $("#debtTable tbody"); if(dt){ dt.innerHTML=""; }
  state.debts.forEach((d,idx)=>{
    dt.insertAdjacentHTML("beforeend", rowHTML([
      cell(`<span class="r" data-type="debt" data-i="${idx}" data-f="name">${d.name}</span>`),
      cell(`<span class="r" data-type="debt" data-i="${idx}" data-f="balance">${currency(d.balance)}</span>`),
      cell(`<span class="r" data-type="debt" data-i="${idx}" data-f="apr">${Number(d.apr).toFixed(2)}%</span>`),
      cell(`<span class="r" data-type="debt" data-i="${idx}" data-f="min">${currency(d.min)}</span>`),
      cell(`<button data-x="debt" data-i="${idx}" type="button">Delete</button>`)
    ]));
  });

  updateEmptyStates();
  attachInlineEditors();
}

// Inline editor
function attachInlineEditors(){
  $$(".r").forEach(el=>{
    el.addEventListener("click", ()=>{
      const type=el.dataset.type, idx=parseInt(el.dataset.i,10), field=el.dataset.f;
      const raw = getRawValue(type, idx, field);
      const input = document.createElement("input");
      input.value = raw;
      input.style.width = "100%";
      input.addEventListener("blur", ()=>{ commitEdit(type, idx, field, input.value); });
      input.addEventListener("keydown", (e)=>{ if(e.key==="Enter") input.blur(); });
      el.replaceWith(input);
      input.focus();
    });
  });
}
function getRawValue(type, idx, field){
  const obj = type==="inc" ? state.incomes[idx] : type==="exp" ? state.expenses[idx] : state.debts[idx];
  return String(obj[field] ?? "");
}
function commitEdit(type, idx, field, val){
  const obj = type==="inc" ? state.incomes[idx] : type==="exp" ? state.expenses[idx] : state.debts[idx];
  if(field==="amount"||field==="balance"||field==="min"||field==="apr"){ obj[field]=parseFloat(val)||0; }
  else if(field==="due"){ obj[field]=parseInt(val,10)||1; }
  else { obj[field]=val.trim(); }
  save(); renderTables(); recalcSummary(); planMonth(); renderDashboard(); renderDataTab();
}

// Totals & summary
function totals(){
  const inc = state.incomes.reduce((s,i)=>s+Number(i.amount||0),0);
  const exp = state.expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  const mins = state.debts.reduce((s,d)=>s+Number(d.min||0),0);
  const wig = inc * (Number(state.settings.wiggle)/100);
  const spend = inc * (Number(state.settings.spend)/100);
  const leftover = inc - (exp + mins + wig + spend);
  return {inc, exp, mins, wig, spend, leftover};
}

// Debt payoff ETA (simplified)
function estimateDebtMonths(){
  const t = totals();
  let months=0;
  const debts = state.debts.map(d=>({bal:+d.balance, apr:+d.apr/100/12, min:+d.min})).sort((a,b)=> (state.settings.strat==="Snowball"? a.bal-b.bal : b.apr-a.apr));
  while(debts.some(d=>d.bal>1) && months<600){
    let pool = state.debts.reduce((s,d)=>s+Number(d.min||0),0) + Math.max(0, t.leftover);
    for(const d of debts){
      if(d.bal<=0) continue;
      const pay = Math.min(pool, d.bal + d.bal*d.apr + d.min); // crude
      d.bal = Math.max(0, d.bal*(1+d.apr) - pay);
      pool -= pay;
    }
    months++;
    if(pool<=0 && debts.every(d=>d.bal>1 && d.apr===0)) break;
  }
  return months>=600? Infinity : months;
}

// Dashboard
function renderDashboard(){
  const t = totals();
  $("#dashInc").textContent = currency(t.inc);
  $("#dashExp").textContent = currency(t.exp);
  $("#dashMin").textContent = currency(t.mins);
  $("#dashSW").textContent = currency(t.spend + t.wig);
  $("#dashLeft").textContent = currency(t.leftover);

  const savingsRate = t.inc>0 ? Math.max(0, (t.leftover)/t.inc)*100 : 0;
  $("#gSavings").style.width = Math.min(100, Math.max(0,savingsRate)).toFixed(1) + "%";
  $("#gSavingsLabel").textContent = `${savingsRate.toFixed(1)}%`;

  const months = estimateDebtMonths();
  let label = "—";
  let pct = 0;
  if(months===Infinity){ label = "Not enough to reduce principal"; pct = 0; }
  else { label = `${months} mo (~${(months/12).toFixed(1)} yrs)`; pct = Math.min(100, 100*(1/Math.max(1, months))); }
  $("#gDebt").style.width = pct + "%";
  $("#gDebtLabel").textContent = label;

  // Bills account recommendation
  const avg = computeAvgBills(3);
  $("#avgBills").textContent = currency(avg);
  const suggested = Math.round(avg/100)*100;
  $("#suggestDeposit").textContent = currency(suggested);
  const last = state.history[state.history.length-1];
  $("#snapshotInfo").textContent = last ? `Last snapshot: ${last.month} = ${currency(last.expenseTotal)}` : "No snapshots yet.";
}
function computeAvgBills(n){
  if(!state.history.length) return state.expenses.reduce((s,e)=>s+Number(e.amount||0),0); // fallback: current month sum
  const lastN = state.history.slice(-n);
  const avg = lastN.reduce((s,h)=>s + Number(h.expenseTotal||0), 0) / lastN.length;
  return avg || 0;
}

// Data tab renderers
function renderDataTab(){
  // Income totals
  const incTotal = state.incomes.reduce((s,i)=>s+Number(i.amount||0),0);
  $("#dataIncomeTotals").textContent = `Total monthly income: ${currency(incTotal)}`;
  const incList = $("#dataIncomeList"); if(incList) incList.innerHTML="";
  state.incomes.forEach(i=>{
    const row = document.createElement("div"); row.className="row";
    row.innerHTML = `<div>${i.name} (${i.freq||"Monthly"})</div><div>${currency(i.amount)}</div>`;
    incList.appendChild(row);
  });

  // Expenses by category
  const byCat = {};
  state.expenses.forEach(e=>{ const k=e.cat||"General"; byCat[k]=(byCat[k]||0)+Number(e.amount||0); });
  const expTotal = state.expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  $("#dataExpenseTotals").textContent = `Total monthly expenses: ${currency(expTotal)}`;
  const catList = $("#dataExpenseByCat"); if(catList) catList.innerHTML="";
  Object.entries(byCat).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>{
    const row = document.createElement("div"); row.className="row";
    row.innerHTML = `<div>${k}</div><div>${currency(v)}</div>`;
    catList.appendChild(row);
  });

  // Debts list
  const debtBal = state.debts.reduce((s,d)=>s+Number(d.balance||0),0);
  $("#dataDebtTotals").textContent = `Total debt balance: ${currency(debtBal)}`;
  const debtList = $("#dataDebtList"); if(debtList) debtList.innerHTML="";
  state.debts.forEach(d=>{
    const row = document.createElement("div"); row.className="row";
    row.innerHTML = `<div>${d.name} (${Number(d.apr).toFixed(2)}% APR)</div><div>Bal: ${currency(d.balance)} • Min: ${currency(d.min)}</div>`;
    debtList.appendChild(row);
  });
}

// Planner
function getPaydays(month, year){
  const days = (state.settings.paydays||[15,30]).map(x=>parseInt(x,10)).filter(n=>n>=1&&n<=31).sort((a,b)=>a-b);
  const last = new Date(year, month, 0).getDate();
  const set = new Set(days.map(d=> Math.min(d,last)));
  return Array.from(set).map(d=> new Date(year, month-1, d));
}
function assignExpensesToPaydays(month, year){
  const paydays = getPaydays(month, year);
  const buckets = new Map(paydays.map(p=>[p.toDateString(), []]));
  for(const e of state.expenses){
    const last = new Date(year, month, 0).getDate();
    const dueDay = Math.min(Math.max(1, Number(e.due||1)), last);
    const due = new Date(year, month-1, dueDay);
    let prior = paydays[0];
    for(const p of paydays) if(p <= due) prior = p;
    buckets.get(prior.toDateString()).push(e);
  }
  return { paydays, buckets };
}
function planMonth(){
  const now = new Date();
  const m = parseInt($("#planMonth").value|| (now.getMonth()+1),10);
  const y = parseInt($("#planYear").value|| now.getFullYear(),10);
  const { paydays, buckets } = assignExpensesToPaydays(m, y);
  const t = totals();
  const perInc = t.inc / Math.max(1, paydays.length);
  const perW = t.wig / Math.max(1, paydays.length);
  const perS = t.spend / Math.max(1, paydays.length);
  const lines = [`Paydays for ${new Date(y, m-1, 1).toLocaleString(undefined,{month:'long',year:'numeric'})}:`, ``];
  for(const p of paydays){
    const list = buckets.get(p.toDateString())||[];
    const sum = list.reduce((s,e)=>s+Number(e.amount||0),0);
    const left = perInc - (sum + perW + perS);
    lines.push(`== ${p.toLocaleDateString()} ==`);
    lines.push(`  Income (assumed): ${currency(perInc)}`);
    lines.push(`  Expenses: ${currency(sum)}`);
    list.sort((a,b)=> Number(a.due)-Number(b.due)).forEach(e=>{
      lines.push(`    [ ] ${e.name} (due ${e.due}) — ${currency(e.amount)} <${e.cat||"General"}>`);
    });
    lines.push(`  Wiggle: ${currency(perW)} | Spending: ${currency(perS)}`);
    lines.push(`  Leftover for debts: ${currency(left)}`);
    lines.push("");
  }
  $("#plannerOut").textContent = lines.join("\n");
}

// Tabs + persistence (robust with delegation)
function activateTab(name){
  $$(".tab").forEach(b=>{
    const is = b.dataset.tab===name;
    b.classList.toggle("active", is);
    b.setAttribute("aria-selected", is ? "true" : "false");
  });
  $$(".panel").forEach(p=> p.classList.toggle("active", p.id===name));
  localStorage.setItem("bb_last_tab", name);
  if(name==="data") renderDataTab();
  if(name==="dashboard") renderDashboard();
}
function initTabs(){
  const nav = document.querySelector(".tabs");
  if(nav){
    nav.addEventListener("click", (e)=>{
      const btn = e.target.closest(".tab");
      if(!btn) return;
      const name = btn.dataset.tab;
      if(name) activateTab(name);
    });
  }
  const saved = localStorage.getItem("bb_last_tab");
  activateTab(saved && $("#"+saved) ? saved : "dashboard");
}

// Events
function setupEvents(){
  // Add forms
  $("#incomeForm")?.addEventListener("submit", (e)=>{
    e.preventDefault();
    state.incomes.push({ name: $("#incName").value.trim()||"Income", amount: parseFloat($("#incAmount").value||0), freq: $("#incFreq").value });
    save(); renderTables(); recalcSummary(); planMonth(); renderDashboard(); renderDataTab(); e.target.reset();
  });
  $("#expForm")?.addEventListener("submit", (e)=>{
    e.preventDefault();
    state.expenses.push({ name: $("#expName").value.trim()||"Expense", amount: parseFloat($("#expAmount").value||0), due: parseInt($("#expDue").value||1,10), cat: $("#expCat").value });
    save(); renderTables(); recalcSummary(); planMonth(); renderDashboard(); renderDataTab(); e.target.reset();
  });
  $("#debtForm")?.addEventListener("submit", (e)=>{
    e.preventDefault();
    state.debts.push({ name: $("#debtName").value.trim()||"Debt", balance: parseFloat($("#debtBal").value||0), apr: parseFloat($("#debtApr").value||0), min: parseFloat($("#debtMin").value||0) });
    save(); renderTables(); recalcSummary(); renderDashboard(); renderDataTab(); e.target.reset();
  });

  // Delete
  document.body.addEventListener("click", (e)=>{
    const btn = e.target.closest("button");
    if(!btn || !btn.dataset.x) return;
    const idx = parseInt(btn.dataset.i,10);
    if(btn.dataset.x==="inc") state.incomes.splice(idx,1);
    if(btn.dataset.x==="exp") state.expenses.splice(idx,1);
    if(btn.dataset.x==="debt") state.debts.splice(idx,1);
    save(); renderTables(); recalcSummary(); planMonth(); renderDashboard(); renderDataTab();
  });

  // Settings segmented controls
  $$(".segmented .seg").forEach(seg=>{
    seg.addEventListener("click", ()=>{
      const group = seg.dataset.seg;
      const val = seg.dataset.val;
      $$(`.segmented .seg[data-seg="${group}"]`).forEach(s=> s.classList.toggle("active", s===seg));
      if(group==="strat"){ state.settings.strat = val; }
      if(group==="theme"){ state.settings.theme = val; applyTheme(val); }
      save(); renderDashboard();
    });
  });

  // Range labels
  const wig = $("#wigglePct"), sp = $("#spendPct");
  const setLabels = ()=>{ $("#wiggleVal").textContent = `${Number(wig.value).toFixed(1)}%`; $("#spendVal").textContent = `${Number(sp.value).toFixed(1)}%`; };
  [wig, sp].forEach(el=> el?.addEventListener("input", setLabels));
  setLabels();

  // Save settings
  $("#saveSettings")?.addEventListener("click", ()=>{
    state.settings.wiggle = parseFloat($("#wigglePct").value||0);
    state.settings.spend = parseFloat($("#spendPct").value||0);
    state.settings.paydays = ($("#paydays").value||"15,30").split(",").map(s=>parseInt(s.trim(),10)).filter(Boolean);
    state.settings.alertDays = parseInt($("#alerts").value||7,10);
    save(); recalcSummary(); planMonth(); renderDashboard(); alert("Settings saved.");
  });

  // Data tab backup/restore/reset
  $("#backupBtn")?.addEventListener("click", ()=>{
    const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "budget_buddy_backup.json"; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  });
  $("#restoreBtn")?.addEventListener("click", async ()=>{
    const file = $("#restoreFile").files[0]; if(!file){ alert("Choose a backup file first."); return; }
    try{
      const data = JSON.parse(await file.text());
      state.incomes = data.incomes||[]; state.expenses = data.expenses||[]; state.debts = data.debts||[];
      state.settings = Object.assign(state.settings, data.settings||{});
      state.history = data.history||[];
      applyTheme(state.settings.theme||"system");
      save(); renderTables(); recalcSummary(); planMonth(); renderDashboard(); renderDataTab();
      alert("Restore complete.");
    }catch(e){ alert("Invalid file."); }
  });
  $("#resetBtn")?.addEventListener("click", ()=>{
    if(confirm("Reset ALL data? This cannot be undone.")){
      state.incomes=[]; state.expenses=[]; state.debts=[];
      state.settings={ wiggle:5, spend:5, strat:"Avalanche", paydays:[15,30], alertDays:7, theme:"system" };
      state.history=[];
      applyTheme(state.settings.theme); save(); renderTables(); recalcSummary(); planMonth(); renderDashboard(); renderDataTab();
    }
  });

  // Dashboard snapshot
  $("#snapshotNow")?.addEventListener("click", ()=>{
    const key = thisMonthKey();
    const expenseTotal = state.expenses.reduce((s,e)=>s+Number(e.amount||0),0);
    state.history = state.history.filter(h=>h.month!==key);
    state.history.push({month:key, expenseTotal});
    state.history.sort((a,b)=> a.month.localeCompare(b.month));
    save(); renderDashboard();
    alert(`Recorded ${key} bills total: ${currency(expenseTotal)}`);
  });

  // Planner
  $("#planBtn")?.addEventListener("click", ()=> planMonth() );

  // Install prompt (non-iOS)
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt=e; $("#installBtn").hidden=false; });
  $("#installBtn")?.addEventListener("click", async ()=>{
    if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; $("#installBtn").hidden=true;
  });
}

// SW
if('serviceWorker' in navigator){ window.addEventListener("load", ()=> navigator.serviceWorker.register("sw.js")); }

// Init
load();
document.addEventListener("DOMContentLoaded", ()=>{
  renderTables(); // tables safe even if not visible yet
  // ensure something renders before tabs init
  renderDashboard(); renderDataTab();
  initTabs(); setupEvents();
  // Recalc after everything is wired
  try{ recalcSummary(); planMonth(); }catch(e){ console.warn(e); }
});
