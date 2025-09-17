
const $=s=>document.querySelector(s);const $$=s=>Array.from(document.querySelectorAll(s));
const IDS=['calendar','debts','dashboard','spending','budget'];let cur=2;

/* Layout: compute viewport/panel heights so each panel scrolls independently */
function measure(){
  const appbar=document.querySelector('.appbar').getBoundingClientRect().height;
  const tabbar=document.querySelector('.tabbar').getBoundingClientRect().height;
  const h=window.innerHeight - appbar - tabbar;
  $('#viewport').style.height = h+'px';
  $$('.panel').forEach(p=> p.style.height = h+'px');
}
window.addEventListener('resize', measure);

/* Demo state */
const state={income:0,bills:0,wigglePct:5};
function refresh(){
  const can=(state.income-state.bills)*(1-state.wigglePct/100);
  $('#spendAmt').textContent='$'+Math.max(0,Math.round(can)).toLocaleString();
  $('#wiggleMeta').textContent='Wiggle room: '+((state.income-state.bills)*(state.wigglePct/100)).toLocaleString(undefined,{style:'currency',currency:'USD'});
  $('#snapIncome').textContent='$'+state.income.toLocaleString();
  $('#snapBills').textContent='$'+state.bills.toLocaleString();
}
$('#quickAdd').addEventListener('click',()=>$('#payAmount').focus());
$('#addPaycheck').addEventListener('click',()=>{state.income+=Number($('#payAmount').value||0);refresh();});

/* Tabs + active pad */
function centersAndWidths(){
  const tabs=$$('.tabs .t'); const bar=document.querySelector('.tabbar'); const br=bar.getBoundingClientRect();
  return tabs.map(t=>{
    const r=t.getBoundingClientRect();
    return {center:(r.left-br.left)+(r.width/2), width:r.width};
  });
}
function setPadAtFraction(f){
  // f is index + fraction (e.g., 2.25 between 2 and 3)
  const arr=centersAndWidths(); const i=Math.floor(Math.max(0,Math.min(arr.length-1,f)));
  const frac = Math.max(-1, Math.min(1, f - i));
  const a = arr[i]; const b = arr[Math.min(arr.length-1,i+1)];
  const center = b? a.center + (b.center-a.center)*frac : a.center;
  const width  = b? a.width  + (b.width -a.width )*frac : a.width;
  const pad=$('#activePad'); const bar=document.querySelector('.tabbar'); const br=bar.getBoundingClientRect();
  const x = Math.round(center - width/2);
  pad.style.width = Math.round(width*0.98)+'px';
  pad.style.transform = `translateX(${x}px)`;
}
function activate(i){
  cur=Math.max(0,Math.min(IDS.length-1,i));
  const tr=$('#track'); tr.style.transition='transform .32s cubic-bezier(.22,.85,.32,1)';
  tr.style.transform=`translate3d(${-100*cur}vw,0,0)`;
  $$('.t').forEach((b,idx)=>b.classList.toggle('active', idx===cur));
  setPadAtFraction(cur);
}
document.querySelector('.tabs').addEventListener('click',e=>{
  const b=e.target.closest('.t'); if(!b) return; activate(IDS.indexOf(b.dataset.tab));
});

/* Axis-locked swipe with iOS-like peek: scale/opacity + interpolated pad */
(()=>{
  const vp=$('#viewport'); const tr=$('#track');
  let sx=0,sy=0,dx=0,dy=0,drag=false,axis=null; const INTENT=8; const THRESH=window.innerWidth*0.28;
  function setPeek(progress){ // progress from -1..1 relative to current
    const panels=$$('.panel');
    const curEl=panels[cur], nextEl=panels[Math.max(0,Math.min(panels.length-1, cur+(progress>0?1:-1)))];
    const p=Math.min(1,Math.abs(progress));
    // current slightly scales down; next fades/raises
    curEl.style.transform=`scale(${1 - 0.02*p})`;
    curEl.style.opacity=`${1 - 0.15*p}`;
    if(nextEl){ nextEl.style.transform=`scale(${0.98 + 0.02*p})`; nextEl.style.opacity=`${0.85 + 0.15*p}`; }
    // move pad between tab centers
    setPadAtFraction(cur + progress);
  }
  function clearPeek(){
    $$('.panel').forEach(el=>{ el.style.transform='scale(1)'; el.style.opacity='1'; });
    setPadAtFraction(cur);
  }
  function start(e){const t=e.touches?e.touches[0]:e; sx=t.pageX; sy=t.pageY; dx=dy=0; drag=true; axis=null; tr.style.transition='none';}
  function move(e){
    if(!drag) return;
    const t=e.touches?e.touches[0]:e; dx=t.pageX-sx; dy=t.pageY-sy;
    if(!axis){
      if(Math.abs(dx)>INTENT || Math.abs(dy)>INTENT){
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
    }
    if(axis==='x'){
      e.preventDefault();
      const base=-100*cur; const pct=(dx/window.innerWidth)*100;
      tr.style.transform=`translate3d(calc(${base}vw + ${pct}vw),0,0)`;
      setPeek(dx/window.innerWidth);
    } else if(axis==='y'){
      drag=false; tr.style.transition='transform .2s'; tr.style.transform=`translate3d(${-100*cur}vw,0,0)`; clearPeek();
    }
  }
  function end(){
    if(!drag) return; drag=false;
    if(axis==='x'){
      if(Math.abs(dx)>THRESH){ cur+=dx<0?1:-1; cur=Math.max(0,Math.min(IDS.length-1,cur)); }
      tr.style.transition='transform .36s cubic-bezier(.22,.85,.32,1)';
      tr.style.transform=`translate3d(${-100*cur}vw,0,0)`;
      $$('.t').forEach((b,idx)=>b.classList.toggle('active', idx===cur));
    }
    clearPeek(); dx=dy=0; axis=null;
  }
  vp.addEventListener('touchstart',start,{passive:false});
  vp.addEventListener('touchmove', move,{passive:false});
  vp.addEventListener('touchend',  end ,{passive:false});
  // desktop
  let md=false; vp.addEventListener('mousedown',e=>{md=true; start(e)});
  window.addEventListener('mousemove',e=>{ if(md) move(e) });
  window.addEventListener('mouseup',()=>{ if(md){ md=false; end(); } });
})();

window.addEventListener('resize', ()=>{ measure(); setPadAtFraction(cur); });
document.addEventListener('DOMContentLoaded', ()=>{ measure(); activate(2); setPadAtFraction(cur); refresh(); if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js'); } });
