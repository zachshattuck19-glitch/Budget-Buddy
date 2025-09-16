
// Budget Buddy v1.3.3 (buttons hotfix + centered header)
const state = { incomes: [], expenses: [], debts: [], paychecks: [], settings: { wiggle: 5, spend: 5, strat: "Avalanche", paydays: [15,30], alertDays: 0, theme: "system" }, history: [], envelopes: { month: null, items: {} }, ui: { spMode: 'list' } };
const $ = s => document.querySelector(s); const $$ = s => Array.from(document.querySelectorAll(s));
const currency = v => `$${Number(v||0).toFixed(2)}`; const todayISO = () => new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const monthKey = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
function save(){ localStorage.setItem('bb_data', JSON.stringify(state)); }
function load(){ try{ const raw=localStorage.getItem('bb_data'); if(raw) Object.assign(state, JSON.parse(raw)); }catch(e){ console.error(e); } }
function applyTheme(t){ const root=document.documentElement; if(t==='light') root.setAttribute('data-theme','light'); else if(t==='dark') root.setAttribute('data-theme','dark'); else root.removeAttribute('data-theme'); }

function showPanel(id){ $$('.panel').forEach(p=> p.classList.toggle('active', p.id===id)); $$('.t').forEach(b=> b.classList.toggle('active', b.dataset.tab===id)); localStorage.setItem('bb_tab', id);
  if(id==='spending') renderSpending(); if(id==='calendar') renderCalendar(); if(id==='debts') renderDebts(); if(id==='budget') renderEnvelopes(); }
function initNav(){ document.querySelector('.tabbar').addEventListener('click', (e)=>{ const b=e.target.closest('.t'); if(!b) return; showPanel(b.dataset.tab); }); showPanel(localStorage.getItem('bb_tab')||'dashboard'); }

function getPaydaysFor(month, year){ const base=(state.settings.paydays||[15,30]).map(n=>parseInt(n,10)).filter(n=>n>=1&&n<=31).sort((a,b)=>a-b);
  const last=new Date(year, month, 0).getDate(); const set=new Set(base.map(d=> Math.min(d,last))); return Array.from(set).map(d=> new Date(year, month-1, d)); }
function billsBefore(dateISO){ const d=new Date(dateISO); const paydays=getPaydaysFor(d.getMonth()+1, d.getFullYear()); let next=null; for(const p of paydays){ if(p>d){ next=p; break; } }
  if(!next){ const nm=d.getMonth()+2, ny=d.getFullYear()+(nm>12?1:0); const pds=getPaydaysFor(((nm-1)%12)+1, ny); next=pds[0]; } const lastDay=new Date(next.getFullYear(), next.getMonth(), 0).getDate(); const dueLimit=next.getDate();
  return state.expenses.reduce((sum,e)=>{ const due=Math.min(Math.max(1, Number(e.due||1)), lastDay); return sum + (due<=dueLimit? Number(e.amount||0):0); },0); }
function monthlyTotals(){ const now=new Date(); const m=now.getMonth(), y=now.getFullYear();
  const inc=state.paychecks.filter(p=>{ const d=new Date(p.date); return d.getMonth()===m && d.getFullYear()===y; }).reduce((s,p)=>s+Number(p.amount||0),0);
  const exp=state.expenses.reduce((s,e)=>s+Number(e.amount||0),0); const mins=state.debts.reduce((s,d)=>s+Number(d.min||0),0);
  const wig=inc*(Number(state.settings.wiggle)/100); const spend=inc*(Number(state.settings.spend)/100); const leftover=inc-(exp+mins+wig+spend);
  return {inc,exp,mins,wig,spend,leftover}; }
function planForPaycheck(p){ const bills=billsBefore(p.date); const d=new Date(p.date); const m=d.getMonth(), y=d.getFullYear();
  const numChecksThisMonth=state.paychecks.filter(q=>{ const dq=new Date(q.date); return dq.getMonth()===m && dq.getFullYear()===y; }).length || 1; const mt=monthlyTotals();
  const wigPer=(mt.wig/Math.max(1,numChecksThisMonth)); const minsPer=(mt.mins/Math.max(1,numChecksThisMonth)); const spendable=Number(p.amount)-(bills+wigPer+minsPer); const extraDebt=Math.max(0,spendable); const shortfall=Math.max(0,-(spendable));
  return {bills,wigPer,minsPer,spendable,extraDebt,shortfall}; }
function estimateDebtMonths(extra){ let months=0; const debts=state.debts.map(d=>({bal:+d.balance, apr:+d.apr/100/12, min:+d.min})).sort((a,b)=> (state.settings.strat==='Snowball'? a.bal-b.bal : b.apr-a.apr));
  while(debts.some(d=>d.bal>1) && months<600){ let pool=state.debts.reduce((s,d)=>s+Number(d.min||0),0) + Math.max(0,extra);
    for(const d of debts){ if(d.bal<=0) continue; const pay=Math.min(pool, d.bal*(1+d.apr)+d.min); d.bal=Math.max(0, d.bal*(1+d.apr)-pay); pool-=pay; } months++; }
  return months>=600? Infinity : months; }
function renderDashboard(){ const now=new Date(); const showPd=getPaydaysFor(now.getMonth()+1, now.getFullYear()).some(d=> d.getDate()===now.getDate()); $('#paydayBanner').hidden=!showPd;
  $('#pcDate').value=todayISO(); const qp=$('#quickPaydays'); qp.innerHTML=""; getPaydaysFor(now.getMonth()+1, now.getFullYear()).forEach(d=>{ const b=document.createElement('button'); b.type='button'; b.textContent=`Use ${d.toLocaleDateString()}`;
    b.addEventListener('click', ()=>{ $('#pcDate').value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); }); qp.appendChild(b); });
  const latest=state.paychecks.slice().sort((a,b)=> new Date(b.date)-new Date(a.date))[0] || {date: todayISO(), amount: 0, kind:'regular'}; const plan=planForPaycheck(latest);
  $('#spendable').textContent=currency(plan.spendable); const det=$('#pcDetails'); det.innerHTML="";
  [['Bills before next payday', plan.bills], ['Cushion (wiggle share)', plan.wigPer], ['Debt minimum share', plan.minsPer], ['Extra debt (if any)', plan.extraDebt]].forEach(([k,v])=>{ const row=document.createElement('div'); row.className='row'; row.innerHTML=`<div>${k}</div><div>${currency(v)}</div>`; det.appendChild(row); });
  if(plan.shortfall>0){ $('#shortfall').hidden=false; $('#shortfall').textContent=`Shortfall ${currency(plan.shortfall)} — reduce spending or add income to cover bills.`; } else $('#shortfall').hidden=true;
  const mt=monthlyTotals(); $('#dashInc').textContent=currency(mt.inc); $('#dashExp').textContent=currency(mt.exp); $('#dashMin').textContent=currency(mt.mins); $('#dashSW').textContent=currency(mt.spend+mt.wig); $('#dashLeft').textContent=currency(mt.leftover);
  const months=estimateDebtMonths(mt.leftover); $('#gDebt').style.width=months===Infinity?'0%':Math.min(100,100*(1/Math.max(1,months)))+'%'; $('#gDebtLabel').textContent=months===Infinity?'—':`${months} mo (~${(months/12).toFixed(1)} yrs)`; }
function renderCalendar(){ const grid=$('#calendarGrid'); grid.innerHTML=""; const now=new Date(); const year=now.getFullYear(), month=now.getMonth(); const first=new Date(year, month, 1), startDay=first.getDay(), daysInMonth=new Date(year, month+1, 0).getDate();
  for(let i=0;i<startDay;i++){ const d=document.createElement('div'); d.className='day'; grid.appendChild(d); } const paydays=getPaydaysFor(month+1, year).map(d=>d.getDate());
  for(let day=1;day<=daysInMonth;day++){ const cell=document.createElement('div'); cell.className='day'; cell.innerHTML=`<div class="dnum">${day}</div>`; if(paydays.includes(day)){ const b=document.createElement('div'); b.className='badge payday'; b.textContent='Payday'; cell.appendChild(b); }
    state.expenses.filter(e=> Number(e.due)===day).forEach(e=>{ const b=document.createElement('div'); b.className='badge bill'; b.textContent=e.name; cell.appendChild(b); }); grid.appendChild(cell); }
  const list=$('#upcomingList'); list.innerHTML=""; state.expenses.slice().sort((a,b)=> Number(a.due)-Number(b.due)).forEach(e=>{ const row=document.createElement('div'); row.className='row'; row.innerHTML=`<div>${e.due} — ${e.name}</div><div>${currency(e.amount)}</div>`; list.appendChild(row); }); }
function renderDebts(){ const tb=$('#debtTable tbody'); tb.innerHTML=""; state.debts.forEach((d,idx)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${d.name}</td><td>${currency(d.balance)}</td><td>${Number(d.apr).toFixed(2)}%</td><td>${currency(d.min)}</td><td><button data-x="debt" data-i="${idx}">Delete</button></td>`; tb.appendChild(tr); });
  const mt=monthlyTotals(); const months=estimateDebtMonths(mt.leftover); $('#debtEta').textContent=months===Infinity?'—':`Estimated payoff: ${months} months (~${(months/12).toFixed(1)} yrs)`; }
function spendingByCategory(){ const by={}; state.expenses.forEach(e=>{ const k=e.cat||'General'; by[k]=(by[k]||0)+Number(e.amount||0); }); return Object.entries(by).sort((a,b)=>b[1]-a[1]); }
function renderSpending(){ $$('#spView .seg').forEach(s=> s.classList.toggle('active', s.dataset.mode===state.ui.spMode)); const data=spendingByCategory(); const lst=$('#spList'); const svgb=$('#spBar'); const svgp=$('#spPie'); lst.innerHTML=""; svgb.setAttribute('hidden', true); svgp.setAttribute('hidden', true); lst.hidden=false;
  data.forEach(([k,v])=>{ const row=document.createElement('div'); row.className='row'; row.innerHTML=`<div>${k}</div><div>${currency(v)}</div>`; lst.appendChild(row); });
  if(state.ui.spMode==='bar'){ lst.hidden=true; svgb.removeAttribute('hidden'); drawBarChart(svgb, data); } else if(state.ui.spMode==='pie'){ lst.hidden=true; svgp.removeAttribute('hidden'); drawPieChart(svgp, data); }}
function drawBarChart(svg,data){ const w=320,h=160,pad=20; svg.setAttribute('viewBox',`0 0 ${w} ${h}`); svg.innerHTML=""; const max=Math.max(1,...data.map(d=>d[1])); const bw=(w-pad*2)/Math.max(1,data.length);
  data.forEach(([k,v],i)=>{ const bh=(h-pad*2)*(v/max); const x=pad+i*bw+6, y=h-pad-bh; const r=document.createElementNS('http://www.w3.org/2000/svg','rect'); r.setAttribute('x',x); r.setAttribute('y',y); r.setAttribute('width',bw-12); r.setAttribute('height',bh); r.setAttribute('fill','var(--primary)'); svg.appendChild(r); }); }
function drawPieChart(svg,data){ const tot=data.reduce((s,d)=>s+d[1],0)||1; const cx=80,cy=80,r=70; let a0=0; svg.innerHTML=""; data.forEach(([k,v],i)=>{ const a1=a0+(v/tot)*Math.PI*2; const large=(a1-a0)>Math.PI?1:0; const x0=cx+r*Math.cos(a0), y0=cy+r*Math.sin(a0); const x1=cx+r*Math.cos(a1), y1=cy+r*Math.sin(a1);
    const path=document.createElementNS('http://www.w3.org/2000/svg','path'); const d=`M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`; path.setAttribute('d',d); path.setAttribute('fill','var(--primary)'); path.setAttribute('opacity',0.7+0.3*(i%2)); svg.appendChild(path); a0=a1; }); }
function renderEnvelopes(){ const tbody=$('#envTable tbody'); if(!tbody) return; tbody.innerHTML=""; const cats=Array.from(new Set([...Object.keys(state.envelopes.items), ...state.expenses.map(e=> e.cat||'General')])).sort();
  cats.forEach(cat=>{ const it=state.envelopes.items[cat]||(state.envelopes.items[cat]={alloc:0,rollover:0,sinking:false,goal:0}); const tr=document.createElement('tr'); tr.innerHTML=`<td>${cat}</td>
      <td><input type="number" step="0.01" min="0" value="${it.alloc}" data-cat="${cat}" data-f="alloc"></td>
      <td>${currency(it.rollover)}</td>
      <td><input type="checkbox" ${it.sinking?'checked':''} data-cat="${cat}" data-f="sinking"></td>
      <td><input type="number" step="0.01" min="0" value="${it.goal||0}" ${it.sinking?'':'disabled'} data-cat="${cat}" data-f="goal"></td>
      <td></td>`; tbody.appendChild(tr); }); $('#envInfo').textContent=`Current month: ${monthKey()}`; }
function setupEvents(){ $('#settingsBtn')?.addEventListener('click', ()=> alert('Settings drawer coming soon (wiggle %, spend %, paydays, theme).'));
  let kind='regular'; $$('.segmented.tiny .seg').forEach(seg=> seg.addEventListener('click', ()=>{ $$('.segmented.tiny .seg').forEach(s=> s.classList.toggle('active', s===seg)); kind=seg.dataset.kind; }));
  $('#pcAdd')?.addEventListener('click', ()=>{ const p={date: $('#pcDate').value||todayISO(), amount: parseFloat($('#pcAmount').value||0), note: $('#pcNote').value||"", kind, applied:false}; state.paychecks.push(p); save(); renderDashboard(); alert('Paycheck added.'); });
  $('#bannerAdd')?.addEventListener('click', ()=> $('#pcAdd').click()); $('#bannerPlan')?.addEventListener('click', ()=> showPanel('dashboard'));
  $('#applyCheck')?.addEventListener('click', ()=>{ const latest=state.paychecks.sort((a,b)=> new Date(b.date)-new Date(a.date))[0]; if(latest){ latest.applied=true; save(); alert('Marked applied.'); } });
  $('#debtForm')?.addEventListener('submit', (e)=>{ e.preventDefault(); state.debts.push({ name: $('#debtName').value.trim()||'Debt', balance: parseFloat($('#debtBal').value||0), apr: parseFloat($('#debtApr').value||0), min: parseFloat($('#debtMin').value||0) }); save(); renderDebts(); renderDashboard(); e.target.reset(); });
  document.body.addEventListener('click', (e)=>{ const btn=e.target.closest('button'); if(!btn||!btn.dataset.x) return; if(btn.dataset.x==='debt'){ const idx=parseInt(btn.dataset.i,10); state.debts.splice(idx,1); save(); renderDebts(); renderDashboard(); } });
  $('#showList')?.addEventListener('change', (e)=>{ $('#upcomingList').hidden=!e.target.checked; });
  $('#addBill')?.addEventListener('click', ()=>{ const name=prompt('Bill name?'); if(!name) return; const amt=parseFloat(prompt('Monthly amount?')||'0'); const due=parseInt(prompt('Due day (1-31)?')||'1',10); const cat=prompt('Category? (e.g., Housing, Utilities, Food)')||'General'; state.expenses.push({name, amount:amt, due:Math.min(Math.max(due,1),31), cat}); save(); renderCalendar(); renderSpending(); renderDashboard(); });
  $('#spView')?.addEventListener('click', (e)=>{ const b=e.target.closest('.seg'); if(!b) return; state.ui.spMode=b.dataset.mode; renderSpending(); });
  document.body.addEventListener('input', (e)=>{ const inp=e.target; if(!inp.dataset||!inp.dataset.cat) return; const it=state.envelopes.items[inp.dataset.cat]||(state.envelopes.items[inp.dataset.cat]={alloc:0,rollover:0,sinking:false,goal:0}); if(inp.dataset.f==='alloc'||inp.dataset.f==='goal') it[inp.dataset.f]=parseFloat(inp.value)||0; save(); });
  document.body.addEventListener('change', (e)=>{ const inp=e.target; if(!inp.dataset||!inp.dataset.cat) return; if(inp.dataset.f==='sinking'){ const it=state.envelopes.items[inp.dataset.cat]||(state.envelopes.items[inp.dataset.cat]={alloc:0,rollover:0,sinking:false,goal:0}); it.sinking=inp.checked; save(); renderEnvelopes(); } });
  $('#backupBtn')?.addEventListener('click', ()=>{ const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='budget_buddy_backup.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); });
  $('#restoreBtn')?.addEventListener('click', async ()=>{ const file=$('#restoreFile').files[0]; if(!file) return alert('Choose a backup file first.');
    try{ const data=JSON.parse(await file.text()); Object.assign(state, {...state, ...data}); save(); renderDashboard(); renderCalendar(); renderDebts(); renderSpending(); renderEnvelopes(); alert('Restore complete.'); }catch(e){ alert('Invalid file.'); } });
  $('#snapshotNow')?.addEventListener('click', ()=>{ const key=monthKey(); const expenseTotal=state.expenses.reduce((s,e)=>s+Number(e.amount||0),0); state.history=state.history.filter(h=>h.month!==key); state.history.push({month:key, expenseTotal}); state.history.sort((a,b)=> a.month.localeCompare(b.month)); save(); alert(`Recorded ${key} bills total.`); });
}

if('serviceWorker' in navigator){ window.addEventListener('load', ()=> navigator.serviceWorker.register('sw.js')); }
load(); applyTheme(state.settings.theme||'system');
document.addEventListener('DOMContentLoaded', ()=>{ try{ renderDashboard(); renderCalendar(); renderDebts(); renderSpending(); renderEnvelopes(); initNav(); setupEvents(); }catch(e){ alert('Budget Buddy init error. Try refreshing.'); console.error(e); }
  setTimeout(()=>{ const s=document.getElementById('splash'); if(s) s.style.display='none'; }, 1200);
});
