// Budget Buddy PWA v0.4 – clearer Settings + Data tab + polish
const state = {
  incomes: [],
  expenses: [],
  debts: [],
  settings: { wiggle: 5, spend: 5, strat: "Avalanche", paydays: [15,30], alertDays: 7, theme: "system" }
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

// Tables & empty states
function updateEmptyStates(){
  $("#incomeEmpty").hidden = state.incomes.length>0;
  $("#expEmpty").hidden = state.expenses.length>0;
  $("#debtEmpty").hidden = state.debts.length>0;
}
function renderTables(){
  const it = $("#incomeTable tbody"); it.innerHTML = "";
  state.incomes.forEach((i,idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i.name}</td><td>${currency(i.amount)}</td><td>${i.freq||"Monthly"}</td>
      <td><button data-x="inc" data-i="${idx}">Delete</button></td>`;
    it.appendChild(tr);
  });
  const et = $("#expTable tbody"); et.innerHTML = "";
  state.expenses.forEach((e,idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${e.name}</td><td>${currency(e.amount)}</td><td>${e.due}</td><td>${e.cat||"General"}</td>
      <td><button data-x="exp" data-i="${idx}">Delete</button></td>`;
    et.appendChild(tr);
  });
  const dt = $("#debtTable tbody"); dt.innerHTML = "";
  state.debts.forEach((d,idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${d.name}</td><td>${currency(d.balance)}</td><td>${Number(d.apr).toFixed(2)}%</td><td>${currency(d.min)}</td>
      <td><button data-x="debt" data-i="${idx}">Delete</button></td>`;
    dt.appendChild(tr);
  });
  updateEmptyStates();
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
function orderedDebts(){
  const arr = [...state.debts];
  if((state.settings.strat||"Avalanche")==="Avalanche"){ arr.sort((a,b)=>Number(b.apr)-Number(a.apr)); }
  else { arr.sort((a,b)=>Number(a.balance)-Number(b.balance)); }
  return arr;
}
function calcSummary(){
  const t = totals();
  const allocation = {};
  state.debts.forEach(d=> allocation[d.name]=Number(d.min||0));
  let extra = Math.max(0, t.leftover);
  for(const d of orderedDebts()){
    if(extra<=0 || Number(d.balance)<=0) break;
    allocation[d.name] += extra;
    extra = 0;
  }
  return { ...t, allocation };
}
function recalcSummary(){
  const out = $("#summaryOut");
  const data = calcSummary();
  const lines = [
    `Income (monthly): ${currency(data.inc)}`,
    `Expenses (monthly): ${currency(data.exp)}`,
    `Debt minimums: ${currency(data.mins)}`,
    `Wiggle room: ${currency(data.wig)}`,
    `Spending money: ${currency(data.spend)}`,
    `--------------------------------------------------------`,
    `Leftover (before extra debt): ${currency(data.leftover)}`,
    ``,
    `Debt Strategy: ${state.settings.strat||"Avalanche"}`,
    `Monthly payments:`,
  ];
  Object.entries(data.allocation).forEach(([name,amt])=> lines.push(`  • ${name}: ${currency(amt)}`));
  out.textContent = lines.join("\n");
  const alertsBox = $("#alertsList");
  const alerts = upcomingAlerts();
  alertsBox.innerHTML = alerts.length? `<strong>Upcoming due alerts:</strong><ul>${alerts.map(a=>`<li>${a}</li>`).join("")}</ul>` : "";
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

// Alerts
function upcomingAlerts(){
  const daysAhead = Number(state.settings.alertDays||7);
  const today = new Date();
  const month = today.getMonth()+1, year = today.getFullYear();
  const last = new Date(year, month, 0).getDate();
  const alerts = [];
  for(const e of state.expenses){
    const dueDay = Math.min(Math.max(1, Number(e.due||1)), last);
    const due = new Date(year, month-1, dueDay);
    const delta = Math.round((due - today)/(1000*60*60*24));
    if(delta >= 0 && delta <= daysAhead) alerts.push(`${e.name} due on ${due.toLocaleDateString()} — ${currency(e.amount)}`);
  }
  return alerts;
}

// Data tab renderers
function renderDataTab(){
  // Income totals
  const incTotal = state.incomes.reduce((s,i)=>s+Number(i.amount||0),0);
  $("#dataIncomeTotals").textContent = `Total monthly income: ${currency(incTotal)}`;
  const incList = $("#dataIncomeList"); incList.innerHTML="";
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
  const catList = $("#dataExpenseByCat"); catList.innerHTML="";
  Object.entries(byCat).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>{
    const row = document.createElement("div"); row.className="row";
    row.innerHTML = `<div>${k}</div><div>${currency(v)}</div>`;
    catList.appendChild(row);
  });

  // Debts list
  const debtBal = state.debts.reduce((s,d)=>s+Number(d.balance||0),0);
  $("#dataDebtTotals").textContent = `Total debt balance: ${currency(debtBal)}`;
  const debtList = $("#dataDebtList"); debtList.innerHTML="";
  state.debts.forEach(d=>{
    const row = document.createElement("div"); row.className="row";
    row.innerHTML = `<div>${d.name} (${Number(d.apr).toFixed(2)}% APR)</div><div>Bal: ${currency(d.balance)} • Min: ${currency(d.min)}</div>`;
    debtList.appendChild(row);
  });
}

// Tabs + persistence
function activateTab(name){
  $$(".tab").forEach(b=>{
    const is = b.dataset.tab===name;
    b.classList.toggle("active", is);
    b.setAttribute("aria-selected", is ? "true" : "false");
  });
  $$(".panel").forEach(p=> p.classList.toggle("active", p.id===name));
  localStorage.setItem("bb_last_tab", name);
  if(name==="data"){ renderDataTab(); }
}
function initTabs(){
  $$(".tab").forEach(btn=> btn.addEventListener("click", ()=> activateTab(btn.dataset.tab)));
  const saved = localStorage.getItem("bb_last_tab");
  activateTab(saved && $("#"+saved) ? saved : "income");
}

// Events
function setupEvents(){
  // Forms
  $("#incomeForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    state.incomes.push({ name: $("#incName").value.trim()||"Income", amount: parseFloat($("#incAmount").value||0), freq: $("#incFreq").value });
    save(); renderTables(); recalcSummary(); planMonth(); renderDataTab(); e.target.reset();
  });
  $("#expForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    state.expenses.push({ name: $("#expName").value.trim()||"Expense", amount: parseFloat($("#expAmount").value||0), due: parseInt($("#expDue").value||1,10), cat: $("#expCat").value });
    save(); renderTables(); recalcSummary(); planMonth(); renderDataTab(); e.target.reset();
  });
  $("#debtForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    state.debts.push({ name: $("#debtName").value.trim()||"Debt", balance: parseFloat($("#debtBal").value||0), apr: parseFloat($("#debtApr").value||0), min: parseFloat($("#debtMin").value||0) });
    save(); renderTables(); recalcSummary(); renderDataTab(); e.target.reset();
  });

  // Delete actions
  document.body.addEventListener("click", (e)=>{
    const btn = e.target.closest("button");
    if(!btn || !btn.dataset.x) return;
    const idx = parseInt(btn.dataset.i,10);
    if(btn.dataset.x==="inc") state.incomes.splice(idx,1);
    if(btn.dataset.x==="exp") state.expenses.splice(idx,1);
    if(btn.dataset.x==="debt") state.debts.splice(idx,1);
    save(); renderTables(); recalcSummary(); planMonth(); renderDataTab();
  });

  // Settings segmented controls
  $$(".segmented .seg").forEach(seg=>{
    seg.addEventListener("click", ()=>{
      const group = seg.dataset.seg;
      const val = seg.dataset.val;
      // toggle visuals
      $$(`.segmented .seg[data-seg="${group}"]`).forEach(s=> s.classList.toggle("active", s===seg));
      if(group==="strat"){ state.settings.strat = val; }
      if(group==="theme"){ state.settings.theme = val; applyTheme(val); }
      save();
    });
  });

  // Range labels
  const wig = $("#wigglePct"), sp = $("#spendPct");
  const setLabels = ()=>{ $("#wiggleVal").textContent = `${Number(wig.value).toFixed(1)}%`; $("#spendVal").textContent = `${Number(sp.value).toFixed(1)}%`; };
  [wig, sp].forEach(el=> el.addEventListener("input", setLabels));
  setLabels();

  // Save settings
  $("#saveSettings").addEventListener("click", ()=>{
    state.settings.wiggle = parseFloat($("#wigglePct").value||0);
    state.settings.spend = parseFloat($("#spendPct").value||0);
    state.settings.paydays = ($("#paydays").value||"15,30").split(",").map(s=>parseInt(s.trim(),10)).filter(Boolean);
    state.settings.alertDays = parseInt($("#alerts").value||7,10);
    save(); recalcSummary(); planMonth(); alert("Settings saved.");
  });

  // Data tab backup/restore/reset
  $("#backupBtn").addEventListener("click", ()=>{
    const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "budget_buddy_backup.json"; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  });
  $("#restoreBtn").addEventListener("click", async ()=>{
    const file = $("#restoreFile").files[0]; if(!file){ alert("Choose a backup file first."); return; }
    try{
      const data = JSON.parse(await file.text());
      state.incomes = data.incomes||[]; state.expenses = data.expenses||[]; state.debts = data.debts||[];
      state.settings = Object.assign(state.settings, data.settings||{});
      applyTheme(state.settings.theme||"system");
      save(); renderTables(); recalcSummary(); planMonth(); renderDataTab();
      alert("Restore complete.");
    }catch(e){ alert("Invalid file."); }
  });
  $("#resetBtn").addEventListener("click", ()=>{
    if(confirm("Reset ALL data? This cannot be undone.")){
      state.incomes=[]; state.expenses=[]; state.debts=[];
      state.settings={ wiggle:5, spend:5, strat:"Avalanche", paydays:[15,30], alertDays:7, theme:"system" };
      applyTheme(state.settings.theme); save(); renderTables(); recalcSummary(); planMonth(); renderDataTab();
    }
  });

  // Export CSV link setup
  $("#downloadCSV").addEventListener("click", (e)=>{
    e.preventDefault();
    const rows = [
      ["kind","name","amount","frequency","due_day","category","balance","apr","minimum_payment"],
      ...state.incomes.map(i=>["income",i.name,i.amount,i.freq,"","","","", ""]),
      ...state.expenses.map(x=>["expense",x.name,x.amount,"",x.due,x.cat,"","",""]),
      ...state.debts.map(d=>["debt",d.name,"","","","",d.balance,d.apr,d.min])
    ];
    const csv = rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], {type:"text/csv"});
    const url = URL.createObjectURL(blob); const a=$("#downloadCSV"); a.href=url; setTimeout(()=>URL.revokeObjectURL(url),5000);
  });

  // Planner buttons
  $("#recalc").addEventListener("click", ()=> recalcSummary() );
  $("#planBtn").addEventListener("click", ()=> planMonth() );

  // Install prompt (non-iOS)
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt=e; $("#installBtn").hidden=false; });
  $("#installBtn").addEventListener("click", async ()=>{
    if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; $("#installBtn").hidden=true;
  });
}

// SW
if('serviceWorker' in navigator){ window.addEventListener("load", ()=> navigator.serviceWorker.register("sw.js")); }

// Init
load();
document.addEventListener("DOMContentLoaded", ()=>{
  renderTables(); recalcSummary();
  $("#planMonth").value = (new Date().getMonth()+1); $("#planYear").value = (new Date().getFullYear());
  planMonth(); initTabs(); setupEvents(); renderDataTab();
});
