
// v1.3.8 — inline logo + pay schedule options
const state = { incomes: [], expenses: [], debts: [], paychecks: [], settings: { wiggle: 5, spend: 5, strat: "Avalanche", schedule: {type:'semi', days:[15,30], anchor: null}, theme: "system" }, history: [], envelopes: { month: null, items: {} }, ui: { spMode: 'list', calOffset: 0 } };
const $ = s => document.querySelector(s); const $$ = s => Array.from(document.querySelectorAll(s));
const currency = v => `$${Number(v||0).toFixed(2)}`; const todayISO = () => new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
function save(){ localStorage.setItem('bb_data', JSON.stringify(state)); }
function load(){ try{ const raw=localStorage.getItem('bb_data'); if(raw){ const data=JSON.parse(raw); Object.assign(state, data);
    if(!state.settings.schedule){ const days = (state.settings.paydays||[15,30]); state.settings.schedule = {type:'semi', days, anchor: null}; delete state.settings.paydays; }
  } }catch(e){ console.error(e); } }
function applyTheme(t){ const root=document.documentElement; if(t==='light') root.setAttribute('data-theme','light'); else if(t==='dark') root.setAttribute('data-theme','dark'); else root.removeAttribute('data-theme'); }

function showPanel(id){ $$('.panel').forEach(p=> p.classList.toggle('active', p.id===id)); $$('.t').forEach(b=> b.classList.toggle('active', b.dataset.tab===id)); localStorage.setItem('bb_tab', id);
  if(id==='spending') renderSpending(); if(id==='calendar') renderCalendar(); if(id==='debts') renderDebts(); if(id==='budget') renderEnvelopes(); }
function initNav(){ document.querySelector('.tabbar').addEventListener('click', (e)=>{ const b=e.target.closest('.t'); if(!b) return; showPanel(b.dataset.tab); }); showPanel(localStorage.getItem('bb_tab')||'dashboard'); }

// Pay schedule
function getPaydaysFor(month, year){
  const sched = state.settings.schedule || {type:'semi', days:[15,30]};
  const lastDay = new Date(year, month, 0).getDate();
  if(sched.type === 'semi'){
    const days = (sched.days||[15,30]).map(n=>Math.min(Math.max(1,parseInt(n,10)||1), lastDay));
    return Array.from(new Set(days)).sort((a,b)=>a-b).map(d=> new Date(year, month-1, d));
  }
  // bi-weekly from anchor
  const anchorISO = sched.anchor || todayISO();
  const a = new Date(anchorISO); a.setHours(0,0,0,0);
  const start = new Date(year, month-1, 1); start.setHours(0,0,0,0);
  const end = new Date(year, month, 0); end.setHours(23,59,59,999);
  const ONE=24*3600*1000; let cur=new Date(a);
  while(cur > start) cur = new Date(cur.getTime()-14*ONE);  # step back
  while(cur < start) cur = new Date(cur.getTime()+14*ONE);
  const res=[]; while(cur <= end){ res.push(new Date(cur)); cur = new Date(cur.getTime()+14*ONE); }
  return res;
}

function billsBefore(dateISO){ const d=new Date(dateISO); const pays=getPaydaysFor(d.getMonth()+1, d.getFullYear()); let next=null; for(const p of pays){ if(p>d){ next=p; break; } }
  if(!next){ const nm=d.getMonth()+2, ny=d.getFullYear()+(nm>12?1:0); const pds=getPaydaysFor(((nm-1)%12)+1, ny); next=pds[0]; }
  const lastDay=new Date(next.getFullYear(), next.getMonth()+1, 0).getDate(); const dueLimit=next.getDate();
  return state.expenses.reduce((sum,e)=>{ const due=Math.min(Math.max(1, Number(e.due||1)), lastDay); return sum + (due<=dueLimit? Number(e.amount||0):0); },0); }

function monthlyTotals(dref=new Date()){ const m=dref.getMonth(), y=dref.getFullYear();
  const inc=state.paychecks.filter(p=>{ const d=new Date(p.date); return d.getMonth()===m && d.getFullYear()===y; }).reduce((s,p)=>s+Number(p.amount||0),0);
  const exp=state.expenses.reduce((s,e)=>s+Number(e.amount||0),0); const mins=state.debts.reduce((s,d)=>s+Number(d.min||0),0);
  const wig=inc*(Number(state.settings.wiggle)/100); const spend=inc*(Number(state.settings.spend)/100); const leftover=inc-(exp+mins+wig+spend);
  return {inc,exp,mins,wig,spend,leftover}; }

function planForPaycheck(p){ const bills=billsBefore(p.date); const d=new Date(p.date); const m=d.getMonth(), y=d.getFullYear();
  const numChecksThisMonth=getPaydaysFor(m+1,y).length || 1; const mt=monthlyTotals(d);
  const wigPer=(mt.wig/Math.max(1,numChecksThisMonth)); const minsPer=(mt.mins/Math.max(1,numChecksThisMonth)); const spendable=Number(p.amount)-(bills+wigPer+minsPer);
  const extraDebt=Math.max(0,spendable); const shortfall=Math.max(0,-(spendable)); return {bills,wigPer,minsPer,spendable,extraDebt,shortfall}; }

function renderDashboard(){ const now=new Date(); const pays=getPaydaysFor(now.getMonth()+1, now.getFullYear()); const showPd=pays.some(d=> d.getDate()===now.getDate()); $('#paydayBanner').hidden=!showPd;
  $('#pcDate').value=todayISO(); const qp=$('#quickPaydays'); qp.innerHTML=""; pays.forEach(d=>{ const b=document.createElement('button'); b.type='button'; b.textContent=`Use ${d.toLocaleDateString()}`;
    b.addEventListener('click', ()=>{ $('#pcDate').value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); }); qp.appendChild(b); });
  const latest=state.paychecks.slice().sort((a,b)=> new Date(b.date)-new Date(a.date))[0] || {date: todayISO(), amount: 0, kind:'regular'}; const plan=planForPaycheck(latest);
  $('#spendable').textContent=currency(plan.spendable); const det=$('#pcDetails'); det.innerHTML="";
  [['Bills before next payday', plan.bills], ['Cushion (wiggle share)', plan.wigPer], ['Debt minimum share', plan.minsPer], ['Extra debt (if any)', plan.extraDebt]].forEach(([k,v])=>{ const row=document.createElement('div'); row.className='row'; row.innerHTML=`<div>${k}</div><div>${currency(v)}</div>`; det.appendChild(row); });
  if(plan.shortfall>0){ $('#shortfall').hidden=false; $('#shortfall').textContent=`Shortfall ${currency(plan.shortfall)} — reduce spending or add income to cover bills.`; } else $('#shortfall').hidden=true;
}

function monthFromOffset(offset){ const now=new Date(); return new Date(now.getFullYear(), now.getMonth()+Number(offset||0), 1); }
function renderCalendar(){ const base=monthFromOffset(state.ui.calOffset); const year=base.getFullYear(), month=base.getMonth();
  $('#calTitle').textContent = base.toLocaleString(undefined,{month:'long', year:'numeric'});
  const grid=$('#calendarGrid'); grid.innerHTML=""; const startDay=new Date(year, month, 1).getDay(); const daysInMonth=new Date(year, month+1, 0).getDate();
  for(let i=0;i<startDay;i++){ const pad=document.createElement('div'); pad.className='cell'; grid.appendChild(pad); }
  const paydays=getPaydaysFor(month+1, year).map(d=>d.getDate()); for(let day=1; day<=daysInMonth; day++){ const cell=document.createElement('div'); cell.className='cell'; const inner=document.createElement('div'); inner.className='inner';
    const dnum=document.createElement('div'); dnum.className='dnum'; dnum.textContent=day; inner.appendChild(dnum);
    if(paydays.includes(day)){ const bd=document.createElement('div'); bd.className='badge payday'; bd.innerHTML='$ Payday'; inner.appendChild(bd); }
    let dayTotal=0; state.expenses.filter(e=> Number(e.due)===day).forEach(e=>{ const b=document.createElement('div'); b.className='badge bill'; b.textContent=e.name; inner.appendChild(b); dayTotal+=Number(e.amount||0); });
    if(dayTotal>0){ const amt=document.createElement('div'); amt.className='amt'; amt.textContent=currency(dayTotal); inner.appendChild(amt); }
    cell.appendChild(inner); grid.appendChild(cell); }
}

function renderDebts(){ const tb=$('#debtTable tbody'); tb.innerHTML=""; state.debts.forEach((d,idx)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${d.name}</td><td>${currency(d.balance)}</td><td>${Number(d.apr).toFixed(2)}%</td><td>${currency(d.min)}</td><td><button data-x="debt" data-i="${idx}">Delete</button></td>`; tb.appendChild(tr); }); }
function spendingByCategory(){ const by={}; state.expenses.forEach(e=>{ const k=e.cat||'General'; by[k]=(by[k]||0)+Number(e.amount||0); }); return Object.entries(by).sort((a,b)=>b[1]-a[1]); }
function renderSpending(){ $$('#spView .seg').forEach(s=> s.classList.toggle('active', s.dataset.mode===state.ui.spMode)); const data=spendingByCategory(); const lst=$('#spList'); const svgb=$('#spBar'); const svgp=$('#spPie'); lst.innerHTML=""; svgb.setAttribute('hidden', true); svgp.setAttribute('hidden', true); lst.hidden=false;
  data.forEach(([k,v])=>{ const row=document.createElement('div'); row.className='row'; row.innerHTML=`<div>${k}</div><div>${currency(v)}</div>`; lst.appendChild(row); });
  if(state.ui.spMode==='bar'){ lst.hidden=true; svgb.removeAttribute('hidden'); } else if(state.ui.spMode==='pie'){ lst.hidden=true; svgp.removeAttribute('hidden'); } }

function renderEnvelopes(){{}}

function setupEvents(){
  const dlg = $('#settingsModal');
  $('#settingsBtn')?.addEventListener('click', ()=>{
    $('#setWiggle').value = state.settings.wiggle;
    $('#setSpend').value = state.settings.spend;
    const sched = state.settings.schedule || {type:'semi', days:[15,30], anchor:null};
    $('#paySemi').checked = sched.type === 'semi';
    $('#payBi').checked = sched.type === 'bi';
    $('#setDays').value = (sched.days||[15,30]).join(',');
    $('#setAnchor').value = sched.anchor || todayISO();
    $('#setTheme').value = state.settings.theme||'system';
    dlg.showModal();
  });
  dlg?.addEventListener('input', (e)=>{
    if(e.target.id==='setWiggle') state.settings.wiggle = Math.max(0, Math.min(30, Number(e.target.value||0)));
    if(e.target.id==='setSpend') state.settings.spend = Math.max(0, Math.min(30, Number(e.target.value||0)));
    if(e.target.id==='setDays'){ const ds = String(e.target.value||'15,30').split(',').map(s=>parseInt(s,10)).filter(n=>!isNaN(n)); state.settings.schedule.days = ds; }
    if(e.target.id==='setAnchor'){ state.settings.schedule.anchor = e.target.value || todayISO(); }
    if(e.target.id==='setTheme'){ state.settings.theme = e.target.value; applyTheme(state.settings.theme); }
    save(); renderDashboard(); renderCalendar();
  });
  dlg?.addEventListener('change',(e)=>{ if(e.target.name==='paytype'){ state.settings.schedule.type = e.target.value; save(); renderDashboard(); renderCalendar(); } });

  let kind='regular'; $$('.segmented.tiny .seg').forEach(seg=> seg.addEventListener('click', ()=>{ $$('.segmented.tiny .seg').forEach(s=> s.classList.toggle('active', s===seg)); kind=seg.dataset.kind; }));
  $('#pcAdd')?.addEventListener('click', ()=>{ const p={date: $('#pcDate').value||todayISO(), amount: parseFloat($('#pcAmount').value||0), note: $('#pcNote').value||"", kind, applied:false}; state.paychecks.push(p); save(); renderDashboard(); alert('Paycheck added.'); });
  $('#bannerAdd')?.addEventListener('click', ()=> $('#pcAdd').click()); $('#bannerPlan')?.addEventListener('click', ()=> showPanel('dashboard'));
  $('#applyCheck')?.addEventListener('click', ()=>{ const latest=state.paychecks.sort((a,b)=> new Date(b.date)-new Date(a.date))[0]; if(latest){ latest.applied=true; save(); alert('Marked applied.'); } });

  $('#calPrev')?.addEventListener('click', ()=>{ state.ui.calOffset = Number(state.ui.calOffset||0) - 1; save(); renderCalendar(); });
  $('#calNext')?.addEventListener('click', ()=>{ state.ui.calOffset = Number(state.ui.calOffset||0) + 1; save(); renderCalendar(); });

  $('#spView')?.addEventListener('click', (e)=>{ const b=e.target.closest('.seg'); if(!b) return; state.ui.spMode=b.dataset.mode; save(); renderSpending(); });
}

if('serviceWorker' in navigator){ window.addEventListener('load', ()=> navigator.serviceWorker.register('sw.js')); }
load(); applyTheme(state.settings.theme||'system');
document.addEventListener('DOMContentLoaded', ()=>{ try{ renderDashboard(); renderCalendar(); renderDebts(); renderSpending(); initNav(); setupEvents(); }catch(e){ alert('Budget Buddy init error. Try refreshing.'); console.error(e); }
  setTimeout(()=>{ const s=document.getElementById('splash'); if(s) s.style.display='none'; }, 800);
});
