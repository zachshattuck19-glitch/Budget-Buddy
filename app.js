
const $=s=>document.querySelector(s);const $$=s=>Array.from(document.querySelectorAll(s));
const IDS=['calendar','debts','dashboard','spending','budget'];let cur=2;

/* Settings */
const dlg=$('#settingsPane');$('#openSettings').addEventListener('click',()=>dlg.showModal());

/* Demo state */
const state=JSON.parse(localStorage.getItem('bb261')||'{}');function save(){localStorage.setItem('bb261',JSON.stringify(state));}
function refresh(){
  const income=Number(state.income||0), bills=Number(state.bills||0), wigglePct=Number(state.wigglePct||5);
  const can=(Math.max(0,income-bills))*(1-wigglePct/100);
  $('#spendAmt').textContent='$'+Math.round(can).toLocaleString();
  $('#wiggleMeta').textContent='Wiggle room: '+((income-bills)*(wigglePct/100)).toLocaleString(undefined,{style:'currency',currency:'USD'});
  $('#snapIncome').textContent='$'+Number(income).toLocaleString();
  $('#snapBills').textContent='$'+Number(bills).toLocaleString();
}
$('#quickAdd').addEventListener('click',()=>$('#payAmount').focus());
$('#addPaycheck').addEventListener('click',()=>{const a=Number($('#payAmount').value||0);state.income=(Number(state.income||0)+a);save();refresh();});
$$('.chip[data-fill]').forEach(b=>b.addEventListener('click',()=>{const m=String(b.dataset.fill).padStart(2,'0');const now=new Date();const y=now.getFullYear();const mm=String(now.getMonth()+1).padStart(2,'0');$('#payDate').value=`${y}-${mm}-${m}`;}));
$$('.chip[data-extra]').forEach(b=>b.addEventListener('click',()=>$('#payAmount').placeholder='Extra amount'));

/* Tabs + pad */
function activate(i){cur=Math.max(0,Math.min(IDS.length-1,i));const track=$('#track');track.style.transition='transform .32s cubic-bezier(.22,.85,.32,1)';track.style.transform=`translate3d(${-100*cur}vw,0,0)`; $$('.t').forEach((b,idx)=>b.classList.toggle('active',idx===cur)); movePad();}
function movePad(){const tabs=$$('.tabs .t'); const pad=$('#activePad'); const bar=document.querySelector('.tabbar'); const r=tabs[cur].getBoundingClientRect(); const br=bar.getBoundingClientRect(); let w=Math.round(r.width*0.98); if(tabs[cur].classList.contains('home')) w=Math.round(r.width*1.10); pad.style.width=w+'px'; const x=Math.round((r.left-br.left)+(r.width/2)-(w/2)); pad.style.transform=`translateX(${x}px)`; pad.classList.toggle('bulge',tabs[cur].classList.contains('home'));}
document.querySelector('.tabs').addEventListener('click',e=>{const b=e.target.closest('.t'); if(!b)return; activate(IDS.indexOf(b.dataset.tab));});

/* Swipe with live drag */
(()=>{const viewport=$('#viewport'), track=$('#track'); let sx=0,sy=0,dx=0,drag=false; const THRESH=window.innerWidth*0.30,VSTOP=80;
function start(e){const t=e.touches?e.touches[0]:e;sx=t.pageX;sy=t.pageY;dx=0;drag=true;track.style.transition='none';}
function move(e){if(!drag)return;const t=e.touches?e.touches[0]:e;const dy=Math.abs(t.pageY-sy);if(dy>VSTOP){drag=false;return;} dx=t.pageX-sx; const base=-100*cur; const pct=(dx/window.innerWidth)*100; track.style.transform=`translate3d(calc(${base}vw + ${pct}vw),0,0)`;}
function end(){if(!drag)return;drag=false; if(Math.abs(dx)>THRESH){cur+=dx<0?1:-1;cur=Math.max(0,Math.min(IDS.length-1,cur));} track.style.transition='transform .36s cubic-bezier(.22,.85,.32,1)'; track.style.transform=`translate3d(${-100*cur}vw,0,0)`; $$('.t').forEach((b,idx)=>b.classList.toggle('active',idx===cur)); movePad(); dx=0;}
viewport.addEventListener('touchstart',start,{passive:true}); viewport.addEventListener('touchmove',move,{passive:true}); viewport.addEventListener('touchend',end,{passive:true});
let md=false; viewport.addEventListener('mousedown',e=>{md=True;start(e)}); window.addEventListener('mousemove',e=>{if(md)move(e)}); window.addEventListener('mouseup',()=>{if(md){md=False;end()}});
})();

/* Settings */
$('#setWiggle').addEventListener('change',e=>{state.wigglePct=Number(e.target.value||0);save();refresh();});
$('#setSpend').addEventListener('change',e=>{state.spendPct=Number(e.target.value||0);save();refresh();});
$('#setPaydays').addEventListener('change',e=>{state.paydays=e.target.value;save();});

window.addEventListener('resize', movePad);
document.addEventListener('DOMContentLoaded',()=>{activate(2);movePad();refresh(); if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js');}});
