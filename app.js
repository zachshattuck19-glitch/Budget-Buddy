// Budget Buddy PWA v1.1 – Envelopes & Rollovers (Sinking Funds), bottom tabs
const state = {
  incomes: [],
  expenses: [],
  debts: [],
  settings: { wiggle: 5, spend: 5, strat: "Avalanche", paydays: [15,30], alertDays: 7, theme: "system" },
  history: [], // bills totals snapshots
  envelopes: { // persisted envelope data
    month: null, // last processed month "YYYY-MM"
    items: {}    // by category: {alloc: number, rollover: number, sinking: bool, goal: number}
  }
};

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const currency = v => `$${Number(v||0).toFixed(2)}`;
const monthKey = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

function applyTheme(theme){
  const root = document.documentElement;
  if(theme === "light"){ root.setAttribute("data-theme","light"); }
  else if(theme === "dark"){ root.setAttribute("data-theme","dark"); }
  else { root.removeAttribute("data-theme"); }
}
function save(){ localStorage.setItem("bb_data", JSON.stringify(state)); }
function load(){
  try{ const raw = localStorage.getItem("bb_data"); if(raw){ Object.assign(state, JSON.parse(raw)); } }catch(e){}
  applyTheme(state.settings.theme || "system");
  if(!state.envelopes) state.envelopes = {month: null, items:{}};
  ensureEnvelopeMonth();
}

// ---- Envelopes logic ----
function ensureEnvelopeMonth(){
  const current = monthKey();
  if(state.envelopes.month !== current){
    // If there was a previous month, roll it forward automatically based on expenses
    if(state.envelopes.month){
      doRollover(state.envelopes.month);
    }
    state.envelopes.month = current;
    save();
  }
}
function categories(){
  // Available categories derived from expense categories + any existing envelope rows
  const set = new Set(Object.keys(state.envelopes.items));
  state.expenses.forEach(e=> set.add(e.cat||"General"));
  return Array.from(set).sort();
}
function spentThisMonthByCategory(cat){
  // Since expenses are recurring monthly, treat their sum as monthly spent for that category
  return state.expenses.filter(e=> (e.cat||"General")===cat).reduce((s,e)=>s+Number(e.amount||0),0);
}
function doRollover(prevMonth){
  // For each category: new rollover = old rollover + allocation - spent(prevMonth)
  for(const cat of Object.keys(state.envelopes.items)){
    const it = state.envelopes.items[cat];
    const spent = spentThisMonthByCategory(cat); // approximation without transactions
    it.rollover = (Number(it.rollover)||0) + (Number(it.alloc)||0) - spent;
    // For sinking funds with goal, cap positive rollover at goal
    if(it.sinking && it.goal>0){
      it.rollover = Math.min(it.rollover, it.goal);
    }
  }
}

// ---- Rendering: Dashboard ----
function totals(){
  const inc = state.incomes.reduce((s,i)=>s+Number(i.amount||0),0);
  const exp = state.expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  const mins = state.debts.reduce((s,d)=>s+Number(d.min||0),0);
  const wig = inc * (Number(state.settings.wiggle)/100);
  const spend = inc * (Number(state.settings.spend)/100);
  const leftover = inc - (exp + mins + wig + spend);
  return {inc, exp, mins, wig, spend, leftover};
}
function estimateDebtMonths(){
  const t = totals();
  let months=0;
  const debts = state.debts.map(d=>({bal:+d.balance, apr:+d.apr/100/12, min:+d.min})).sort((a,b)=> (state.settings.strat==="Snowball"? a.bal-b.bal : b.apr-a.apr));
  while(debts.some(d=>d.bal>1) && months<600){
    let pool = state.debts.reduce((s,d)=>s+Number(d.min||0),0) + Math.max(0, t.leftover);
    for(const d of debts){
      if(d.bal<=0) continue;
      const pay = Math.min(pool, d.bal*(1+d.apr) + d.min);
      d.bal = Math.max(0, d.bal*(1+d.apr) - pay);
      pool -= pay;
    }
    months++;
  }
  return months>=600? Infinity : months;
}
function computeAvgBills(n){
  if(!state.history.length) return state.expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  const lastN = state.history.slice(-n);
  return (lastN.reduce((s,h)=>s + Number(h.expenseTotal||0), 0) / lastN.length) || 0;
}
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
  $("#gDebt").style.width = months===Infinity? "0%" : Math.min(100, 100*(1/Math.max(1, months))) + "%";
  $("#gDebtLabel").textContent = months===Infinity? "—" : `${months} mo (~${(months/12).toFixed(1)} yrs)`;
  const avg = computeAvgBills(3);
  $("#avgBills").textContent = currency(avg);
  $("#suggestDeposit").textContent = currency(Math.round(avg/100)*100);
  const last = state.history[state.history.length-1];
  $("#snapshotInfo").textContent = last ? `Last snapshot: ${last.month} = ${currency(last.expenseTotal)}` : "No snapshots yet.";
}

// ---- Rendering: Envelopes ----
function renderEnvelopes(){
  ensureEnvelopeMonth();
  const tbody = $("#envTable tbody"); tbody.innerHTML="";
  const cats = categories();
  if(cats.length===0){
    const tr = document.createElement("tr"); tr.innerHTML = `<td colspan="7" class="muted">No categories yet. Add one or create expenses to seed categories.</td>`; tbody.appendChild(tr);
  }
  for(const cat of cats){
    const it = state.envelopes.items[cat] || (state.envelopes.items[cat]={alloc:0, rollover:0, sinking:false, goal:0});
    const spent = spentThisMonthByCategory(cat);
    const prog = it.sinking && it.goal>0 ? Math.min(100, Math.max(0,(it.rollover/it.goal)*100)).toFixed(0) : null;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${cat}</td>
      <td><input type="number" step="0.01" min="0" value="${it.alloc}" data-cat="${cat}" data-f="alloc"></td>
      <td>${currency(spent)}</td>
      <td>${currency(it.rollover)}</td>
      <td><input type="checkbox" ${it.sinking?'checked':''} data-cat="${cat}" data-f="sinking"></td>
      <td><input type="number" step="0.01" min="0" value="${it.goal||0}" ${it.sinking?'':'disabled'} data-cat="${cat}" data-f="goal"></td>
      <td>${prog!==null? `<small class="muted">${prog}%</small>`:''}</td>
    `;
    tbody.appendChild(row);
  }
  $("#envInfo").textContent = `Current month: ${state.envelopes.month || monthKey()}`;
}
function updateEnvelopeField(cat, field, value){
  const it = state.envelopes.items[cat] || (state.envelopes.items[cat]={alloc:0, rollover:0, sinking:false, goal:0});
  if(field==="alloc"||field==="goal"){ it[field]=parseFloat(value)||0; }
  else if(field==="sinking"){ it[field]=!!value; }
  save(); renderEnvelopes();
}

// ---- Planner ----
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

// ---- Expenses & Debts tables ----
function updateEmptyStates(){
  $("#expEmpty").hidden = state.expenses.length>0;
  $("#debtEmpty").hidden = state.debts.length>0;
}
function rowHTML(cells){ return `<tr>${cells.join('')}</tr>`; }
function cell(text){ return `<td>${text}</td>`; }
function renderExpenseTable(){
  const et = $("#expTable tbody"); if(!et) return; et.innerHTML="";
  state.expenses.forEach((e,idx)=>{
    et.insertAdjacentHTML("beforeend", rowHTML([
      cell(`<span class="r" data-type="exp" data-i="${idx}" data-f="name">${e.name}</span>`),
      cell(`<span class="r" data-type="exp" data-i="${idx}" data-f="amount">${currency(e.amount)}</span>`),
      cell(`<span class="r" data-type="exp" data-i="${idx}" data-f="due">${e.due}</span>`),
      cell(`<span class="r" data-type="exp" data-i="${idx}" data-f="cat">${e.cat||"General"}</span>`),
      cell(`<button data-x="exp" data-i="${idx}" type="button">Delete</button>`)
    ]));
  });
  updateEmptyStates();
  attachInlineEditors();
}
function renderDebtTable(){
  const dt = $("#debtTable tbody"); if(!dt) return; dt.innerHTML="";
  state.debts.forEach((d,idx)=>{
    dt.insertAdjacentHTML("beforeend", rowHTML([
      cell(`<span class="r" data-type="debt" data-i="${idx}" data-f="name">${d.name}</span>`),
      cell(`<span class="r" data-type="debt" data-i="${idx}" data-f="balance">${currency(d.balance)}</span>`),
      cell(`<span class="r" data-type="debt" data-i="${idx}" data-f="apr">${Number(d.apr).toFixed(2)}%</span>`),
      cell(`<span class="r" data-type="debt" data-i="${idx}" data-f="min">${currency(d.min)}</span>`),
      cell(`<button data-x="debt" data-i="${idx}" type="button">Delete</button>`)
    ]));
  });
  attachInlineEditors();
}
function attachInlineEditors(){
  $$(".r").forEach(el=>{
    el.addEventListener("click", ()=>{
      const type=el.dataset.type, idx=parseInt(el.dataset.i,10), field=el.dataset.f;
      const obj = type==="exp" ? state.expenses[idx] : state.debts[idx];
      const input = document.createElement("input");
      input.value = String(obj[field] ?? "");
      input.style.width = "100%";
      input.addEventListener("blur", ()=>{
        if(field==="amount"||field==="balance"||field==="min"||field==="apr"){ obj[field]=parseFloat(input.value)||0; }
        else if(field==="due"){ obj[field]=parseInt(input.value,10)||1; }
        else { obj[field]=input.value.trim(); }
        save(); renderExpenseTable(); renderDebtTable(); renderEnvelopes(); renderDashboard(); planMonth();
      });
      input.addEventListener("keydown", (e)=>{ if(e.key==="Enter") input.blur(); });
      el.replaceWith(input); input.focus();
    });
  });
}

// ---- Navigation ----
function showPanel(id){
  $$(".panel").forEach(p=> p.classList.toggle("active", p.id===id));
  $$(".t").forEach(b=> b.classList.toggle("active", b.dataset.tab===id));
  localStorage.setItem("bb_tab", id);
  if(id==="dashboard") renderDashboard();
  if(id==="budget") renderEnvelopes();
}
function initNav(){
  document.querySelector(".tabbar").addEventListener("click",(e)=>{
    const b=e.target.closest(".t"); if(!b) return; showPanel(b.dataset.tab);
  });
  const restored = localStorage.getItem("bb_tab") || "dashboard";
  showPanel(restored);
}

// ---- Events ----
function setupEvents(){
  // Add expenses
  $("#expForm")?.addEventListener("submit", (e)=>{
    e.preventDefault();
    state.expenses.push({ name: $("#expName").value.trim()||"Expense", amount: parseFloat($("#expAmount").value||0), due: parseInt($("#expDue").value||1,10), cat: $("#expCat").value });
    save(); renderExpenseTable(); renderEnvelopes(); renderDashboard(); planMonth(); e.target.reset();
  });
  // Add debts
  $("#debtForm")?.addEventListener("submit", (e)=>{
    e.preventDefault();
    state.debts.push({ name: $("#debtName").value.trim()||"Debt", balance: parseFloat($("#debtBal").value||0), apr: parseFloat($("#debtApr").value||0), min: parseFloat($("#debtMin").value||0) });
    save(); renderDebtTable(); renderDashboard(); e.target.reset();
  });

  // Delete handlers
  document.body.addEventListener("click",(e)=>{
    const btn=e.target.closest("button"); if(!btn||!btn.dataset.x) return;
    const idx=parseInt(btn.dataset.i,10);
    if(btn.dataset.x==="exp") state.expenses.splice(idx,1);
    if(btn.dataset.x==="debt") state.debts.splice(idx,1);
    save(); renderExpenseTable(); renderDebtTable(); renderEnvelopes(); renderDashboard(); planMonth();
  });

  // Envelopes table edits
  document.body.addEventListener("input", (e)=>{
    const inp = e.target;
    if(!inp.dataset || !inp.dataset.cat) return;
    const cat = inp.dataset.cat, f = inp.dataset.f;
    let val = inp.type==="checkbox" ? inp.checked : inp.value;
    updateEnvelopeField(cat, f, val);
  });
  document.body.addEventListener("change", (e)=>{
    const inp = e.target;
    if(!inp.dataset || !inp.dataset.cat) return;
    const cat = inp.dataset.cat, f = inp.dataset.f;
    if(f==="sinking"){
      // enable/disable goal field
      const row = inp.closest("tr");
      const goal = row.querySelector('input[data-f="goal"]');
      goal.disabled = !inp.checked;
    }
  });

  // Envelopes buttons
  $("#addEnv")?.addEventListener("click", ()=>{
    const name = prompt("New category name? (e.g., Car Maintenance)");
    if(!name) return;
    if(!state.envelopes.items[name]) state.envelopes.items[name] = {alloc:0, rollover:0, sinking:false, goal:0};
    save(); renderEnvelopes();
  });

  $("#closeMonth")?.addEventListener("click", ()=>{
    ensureEnvelopeMonth();
    const prev = state.envelopes.month;
    doRollover(prev);
    // advance month to next
    const d = new Date(prev + "-01T00:00:00");
    d.setMonth(d.getMonth()+1);
    state.envelopes.month = monthKey(d);
    save(); renderEnvelopes(); alert("Month closed. Rollovers applied.");
  });

  // Settings
  $$(".segmented .seg").forEach(seg=>{
    seg.addEventListener("click", ()=>{
      const group = seg.dataset.seg; const val = seg.dataset.val;
      $$(`.segmented .seg[data-seg="${group}"]`).forEach(s=> s.classList.toggle("active", s===seg));
      if(group==="strat"){ state.settings.strat = val; }
      if(group==="theme"){ state.settings.theme = val; applyTheme(val); }
      save(); renderDashboard();
    });
  });
  const wig=$("#wigglePct"), sp=$("#spendPct");
  const setLabels=()=>{ $("#wiggleVal").textContent=`${Number(wig.value).toFixed(1)}%`; $("#spendVal").textContent=`${Number(sp.value).toFixed(1)}%`; };
  [wig,sp].forEach(el=> el?.addEventListener("input", setLabels)); setLabels();
  $("#saveSettings")?.addEventListener("click", ()=>{
    state.settings.wiggle=parseFloat(wig.value||0);
    state.settings.spend=parseFloat(sp.value||0);
    state.settings.paydays=($("#paydays").value||"15,30").split(",").map(s=>parseInt(s.trim(),10)).filter(Boolean);
    state.settings.alertDays=parseInt($("#alerts").value||7,10);
    save(); renderDashboard(); planMonth(); alert("Settings saved.");
  });

  // Backup/restore/reset
  $("#backupBtn")?.addEventListener("click", ()=>{
    const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob); const a=document.createElement("a");
    a.href=url; a.download="budget_buddy_backup.json"; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $("#restoreBtn")?.addEventListener("click", async ()=>{
    const file=$("#restoreFile").files[0]; if(!file){ alert("Choose a backup file first."); return; }
    try{ const data = JSON.parse(await file.text());
      state.incomes=data.incomes||[]; state.expenses=data.expenses||[]; state.debts=data.debts||[];
      state.settings=Object.assign(state.settings, data.settings||{}); state.history=data.history||[];
      state.envelopes=data.envelopes||state.envelopes;
      applyTheme(state.settings.theme||"system"); save();
      renderExpenseTable(); renderDebtTable(); renderEnvelopes(); renderDashboard(); planMonth(); alert("Restore complete.");
    }catch(e){ alert("Invalid file."); }
  });
  $("#resetBtn")?.addEventListener("click", ()=>{
    if(confirm("Reset ALL data? This cannot be undone.")){
      state.incomes=[]; state.expenses=[]; state.debts=[]; state.history=[];
      state.settings={ wiggle:5, spend:5, strat:"Avalanche", paydays:[15,30], alertDays:7, theme:"system" };
      state.envelopes={month:null, items:{}};
      applyTheme(state.settings.theme); save();
      renderExpenseTable(); renderDebtTable(); renderEnvelopes(); renderDashboard(); planMonth();
    }
  });

  // Snapshot
  $("#snapshotNow")?.addEventListener("click", ()=>{
    const d=new Date(); const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const expenseTotal = state.expenses.reduce((s,e)=>s+Number(e.amount||0),0);
    state.history = state.history.filter(h=>h.month!==key);
    state.history.push({month:key, expenseTotal}); state.history.sort((a,b)=> a.month.localeCompare(b.month));
    save(); renderDashboard(); alert(`Recorded ${key} bills total: ${currency(expenseTotal)}`);
  });
}

// Service worker
if('serviceWorker' in navigator){ window.addEventListener("load", ()=> navigator.serviceWorker.register("sw.js")); }

load();
document.addEventListener("DOMContentLoaded", ()=>{
  renderExpenseTable(); renderDebtTable(); renderEnvelopes(); renderDashboard(); planMonth();
  initNav(); setupEvents();
});
