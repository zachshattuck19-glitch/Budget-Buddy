
const $=s=>document.querySelector(s);const $$=s=>Array.from(document.querySelectorAll(s));
const IDS=['calendar','debts','dashboard','spending','budget'];let cur=2;

/* Layout */
function measure(){
  const appbar=document.querySelector('.appbar').getBoundingClientRect().height;
  const tabbar=document.querySelector('.tabbar').getBoundingClientRect().height;
  const h=window.innerHeight - appbar - tabbar;
  $('#viewport').style.height = h+'px';
  $$('.panel').forEach(p=> p.style.height = h+'px');
}
window.addEventListener('resize', measure);

/* Demo */
const state={income:0,bills:0,wigglePct:5};
function refresh(){const can=(state.income-state.bills)*(1-state.wigglePct/100);
  $('#spendAmt')?.textContent && ($('#spendAmt').textContent='$'+Math.max(0,Math.round(can)).toLocaleString());
  $('#wiggleMeta')?.textContent && ($('#wiggleMeta').textContent='Wiggle room: '+((state.income-state.bills)*(state.wigglePct/100)).toLocaleString(undefined,{style:'currency',currency:'USD'}));
  $('#snapIncome')?.textContent && ($('#snapIncome').textContent='$'+state.income.toLocaleString());
  $('#snapBills')?.textContent && ($('#snapBills').textContent='$'+state.bills.toLocaleString());
}
$('#quickAdd')?.addEventListener('click',()=>$('#payAmount').focus());
$('#addPaycheck')?.addEventListener('click',()=>{state.income+=Number($('#payAmount').value||0);refresh();});

function centersAndWidths(){
  const tabs=$$('.tabs .t'); const bar=document.querySelector('.tabbar'); const br=bar.getBoundingClientRect();
  return tabs.map(t=>{const r=t.getBoundingClientRect();return {center:(r.left-br.left)+r.width/2, width:r.width-8};});
}
function setPadAtIndex(i){
  const arr=centersAndWidths(); const a=arr[i]; if(!a)return;
  const pad=$('#activePad'); const x=Math.round(a.center - a.width/2);
  pad.style.width=Math.round(a.width)+'px'; pad.style.transform=`translateX(${x}px)`;
}
function setPadBetween(i, frac){
  const arr=centersAndWidths(); const a=arr[i]; const b=arr[Math.min(arr.length-1,i+1)]||a;
  const center=a.center+(b.center-a.center)*frac; const width=a.width+(b.width-a.width)*frac;
  const x=Math.round(center - width/2); const pad=$('#activePad');
  pad.style.width=Math.round(width)+'px'; pad.style.transform=`translateX(${x}px)`;
}

function activate(i){
  cur=Math.max(0,Math.min(IDS.length-1,i));
  const tr=$('#track'); tr.style.transition='transform .32s cubic-bezier(.22,.85,.32,1)';
  tr.style.transform=`translate3d(${-100*cur}vw,0,0)`;
  $$('.t').forEach((b,idx)=>b.classList.toggle('active', idx===cur));
  setPadAtIndex(cur);
}
document.querySelector('.tabs').addEventListener('click',e=>{const b=e.target.closest('.t'); if(!b)return; activate(IDS.indexOf(b.dataset.tab));});

/* Axis-locked swipe + interpolated pad */
(()=>{
  const vp=$('#viewport'); const tr=$('#track'); let sx=0,sy=0,dx=0,dy=0,drag=false,axis=null;
  const INTENT=8; const THRESH=window.innerWidth*0.28;
  function start(e){const t=e.touches?e.touches[0]:e; sx=t.pageX; sy=t.pageY; dx=dy=0; drag=true; axis=null; tr.style.transition='none';}
  function move(e){
    if(!drag)return; const t=e.touches?e.touches[0]:e; dx=t.pageX-sx; dy=t.pageY-sy;
    if(!axis){ if(Math.abs(dx)>INTENT||Math.abs(dy)>INTENT){ axis=Math.abs(dx)>Math.abs(dy)?'x':'y'; } }
    if(axis==='x'){ e.preventDefault(); const base=-100*cur; const pct=dx/window.innerWidth; tr.style.transform=`translate3d(calc(${base}vw + ${pct*100}vw),0,0)`; const dir=pct>0?-1:1; const frac=Math.min(1,Math.abs(pct)); if((cur>0 && pct>0)||(cur<IDS.length-1 && pct<0)){ setPadBetween(cur, Math.sign(pct)*frac); } }
    else if(axis==='y'){ drag=false; tr.style.transition='transform .2s'; tr.style.transform=`translate3d(${-100*cur}vw,0,0)`; setPadAtIndex(cur); }
  }
  function end(){
    if(!drag)return; drag=false; if(axis==='x'){ if(Math.abs(dx)>THRESH){ cur+=dx<0?1:-1; cur=Math.max(0,Math.min(IDS.length-1,cur)); }
      tr.style.transition='transform .36s cubic-bezier(.22,.85,.32,1)'; tr.style.transform=`translate3d(${-100*cur}vw,0,0)`;
      $$('.t').forEach((b,idx)=>b.classList.toggle('active', idx===cur)); setPadAtIndex(cur);
    }
    dx=dy=0; axis=null;
  }
  vp.addEventListener('touchstart',start,{passive:false}); vp.addEventListener('touchmove',move,{passive:false}); vp.addEventListener('touchend',end,{passive:false});
  let md=false; vp.addEventListener('mousedown',e=>{md=true; start(e)}); window.addEventListener('mousemove',e=>{ if(md) move(e) }); window.addEventListener('mouseup',()=>{ if(md){ md=false; end(); } });
})();

window.addEventListener('resize', ()=>{ measure(); setPadAtIndex(cur); });
document.addEventListener('DOMContentLoaded', ()=>{ measure(); activate(2); setPadAtIndex(cur); refresh(); if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js'); } });
