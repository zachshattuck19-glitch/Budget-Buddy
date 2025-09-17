
const $=s=>document.querySelector(s);const $$=s=>Array.from(document.querySelectorAll(s));
const IDS=['calendar','debts','dashboard','spending','budget'];let cur=2;

/* Layout */
function measure(){
  const appbar=document.querySelector('.appbar').getBoundingClientRect().height;
  const tabbar=document.querySelector('.tabbar').getBoundingClientRect().height;
  const h=window.innerHeight - appbar - tabbar;
  $('#viewport').style.height = h+'px'; $$('.panel').forEach(p=> p.style.height = h+'px');
}
window.addEventListener('resize', measure);

/* Demo state */
const state={income:0,bills:0,wigglePct:5};
function refresh(){const can=(state.income-state.bills)*(1-state.wigglePct/100);
  const spendAmt=$('#spendAmt'); if(spendAmt) spendAmt.textContent='$'+Math.max(0,Math.round(can)).toLocaleString();
  const wiggle=$('#wiggleMeta'); if(wiggle) wiggle.textContent='Wiggle room: '+((state.income-state.bills)*(state.wigglePct/100)).toLocaleString(undefined,{style:'currency',currency:'USD'});
  const sI=$('#snapIncome'); const sB=$('#snapBills');
  if(sI) sI.textContent='$'+state.income.toLocaleString();
  if(sB) sB.textContent='$'+state.bills.toLocaleString();
}
const addBtn=$('#addPaycheck'); if(addBtn) addBtn.addEventListener('click',()=>{state.income+=Number($('#payAmount').value||0);refresh();});

/* Active pad helpers (grid-based) */
function padMetrics(){
  const tabsEl=document.querySelector('.tabs'); const bar=document.querySelector('.tabbar');
  const br=bar.getBoundingClientRect(); const tr=tabsEl.getBoundingClientRect();
  const cols=5; const colW=tr.width/cols; const baseX=(tr.left - br.left);
  return {colW, baseX};
}
function setPadAtIndex(i){
  const {colW, baseX} = padMetrics(); const pad=$('#activePad');
  const width = Math.max(40, Math.round(colW - 12));
  const x = Math.round(baseX + i*colW + (colW - width)/2) + 12;
  pad.style.width=width+'px'; pad.style.transform=`translate3d(${x}px,0,0)`;
}
function setPadBetween(i, frac){
  const {colW, baseX} = padMetrics(); const pad=$('#activePad');
  const width = Math.max(40, Math.round(colW - 12));
  const centerX = baseX + (i + frac) * colW + colW/2;
  const x = Math.round(centerX - width/2) + 12;
  pad.style.width=width+'px'; pad.style.transform=`translate3d(${x}px,0,0)`;
}

/* Activation */
function activate(i){
  cur=Math.max(0,Math.min(IDS.length-1,i)); const tr=$('#track');
  tr.style.transition='transform .32s cubic-bezier(.22,.85,.32,1)'; tr.style.transform=`translate3d(${-100*cur}vw,0,0)`;
  $$('.t').forEach((b,idx)=>b.classList.toggle('active', idx===cur)); setPadAtIndex(cur);
}
document.querySelector('.tabs').addEventListener('click',e=>{const b=e.target.closest('.t'); if(!b) return; activate(IDS.indexOf(b.dataset.tab));});

/* Swipe (axis-locked) + pad interpolation */
(()=>{
  const vp=$('#viewport'); const tr=$('#track'); let sx=0,sy=0,dx=0,dy=0,drag=false,axis=null;
  const INTENT=8; const THRESH=window.innerWidth*0.28;
  function start(e){const t=e.touches?e.touches[0]:e; sx=t.pageX; sy=t.pageY; dx=dy=0; drag=true; axis=null; tr.style.transition='none';}
  function move(e){
    if(!drag) return; const t=e.touches?e.touches[0]:e; dx=t.pageX-sx; dy=t.pageY-sy;
    if(!axis){ if(Math.abs(dx)>INTENT||Math.abs(dy)>INTENT){ axis = Math.abs(dx)>Math.abs(dy) ? 'x':'y'; } }
    if(axis==='x'){ e.preventDefault(); const base=-100*cur; const pct=dx/window.innerWidth; tr.style.transform=`translate3d(calc(${base}vw + ${pct*100}vw),0,0)`; const f=Math.max(-1,Math.min(1,pct)); if((cur>0&&f>0)||(cur<IDS.length-1&&f<0)){ setPadBetween(cur, f); } }
    else if(axis==='y'){ drag=false; tr.style.transition='transform .2s'; tr.style.transform=`translate3d(${-100*cur}vw,0,0)`; setPadAtIndex(cur); }
  }
  function end(){ if(!drag) return; drag=false; if(axis==='x'){ if(Math.abs(dx)>THRESH){ cur+=dx<0?1:-1; cur=Math.max(0,Math.min(IDS.length-1,cur)); } tr.style.transition='transform .36s cubic-bezier(.22,.85,.32,1)'; tr.style.transform=`translate3d(${-100*cur}vw,0,0)`; $$('.t').forEach((b,idx)=>b.classList.toggle('active', idx===cur)); setPadAtIndex(cur);} dx=dy=0; axis=null; }
  vp.addEventListener('touchstart',start,{passive:false}); vp.addEventListener('touchmove',move,{passive:false}); vp.addEventListener('touchend',end,{passive:false});
  let md=false; vp.addEventListener('mousedown',e=>{md=true; start(e)}); window.addEventListener('mousemove',e=>{ if(md) move(e) }); window.addEventListener('mouseup',()=>{ if(md){ md=false; end(); } });
})();

window.addEventListener('resize', ()=>{ measure(); setPadAtIndex(cur); });
document.addEventListener('DOMContentLoaded', ()=>{ measure(); activate(2); setPadAtIndex(cur); refresh(); if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js'); } });
