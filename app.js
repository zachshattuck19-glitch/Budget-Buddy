
const $=s=>document.querySelector(s);const $$=s=>Array.from(document.querySelectorAll(s));
const IDS=['calendar','debts','dashboard','spending','budget'];let cur=2;
/* Demo only */
const state={income:0,bills:0,wigglePct:5};
function refresh(){const can=(state.income-state.bills)*(1-state.wigglePct/100);$('#spendAmt').textContent='$'+Math.max(0,Math.round(can)).toLocaleString();$('#wiggleMeta').textContent='Wiggle room: '+((state.income-state.bills)*(state.wigglePct/100)).toLocaleString(undefined,{style:'currency',currency:'USD'});$('#snapIncome').textContent='$'+state.income.toLocaleString();$('#snapBills').textContent='$'+state.bills.toLocaleString();}
$('#quickAdd').addEventListener('click',()=>$('#payAmount').focus());$('#addPaycheck').addEventListener('click',()=>{state.income+=Number($('#payAmount').value||0);refresh();});

/* Tabs */
function activate(i){cur=Math.max(0,Math.min(IDS.length-1,i));const tr=$('#track');tr.style.transition='transform .32s cubic-bezier(.22,.85,.32,1)';tr.style.transform=`translate3d(${-100*cur}vw,0,0)`;$$('.t').forEach((b,idx)=>b.classList.toggle('active',idx===cur));movePad();}
function movePad(){const tabs=$$('.tabs .t');const pad=$('#activePad');const bar=document.querySelector('.tabbar');const r=tabs[cur].getBoundingClientRect();const br=bar.getBoundingClientRect();let w=Math.round(r.width*0.98);if(tabs[cur].classList.contains('home'))w=Math.round(r.width*1.10);pad.style.width=w+'px';const x=Math.round((r.left-br.left)+(r.width/2)-(w/2));pad.style.transform=`translateX(${x}px)`;pad.classList.toggle('bulge',tabs[cur].classList.contains('home'));}
document.querySelector('.tabs').addEventListener('click',e=>{const b=e.target.closest('.t');if(!b)return;activate(IDS.indexOf(b.dataset.tab));});

/* Axis-locked swipe: horizontal OR vertical, never both */
(()=>{const vp=$('#viewport');const tr=$('#track');let sx=0,sy=0,dx=0,dy=0,drag=false,axis=null;const INTENT=8;const THRESH=window.innerWidth*0.28;
function start(e){const t=e.touches?e.touches[0]:e;sx=t.pageX;sy=t.pageY;dx=0;dy=0;drag=true;axis=null;tr.style.transition='none';}
function move(e){if(!drag)return;const t=e.touches?e.touches[0]:e;dx=t.pageX-sx;dy=t.pageY-sy;if(!axis){if(Math.abs(dx)>INTENT||Math.abs(dy)>INTENT){axis=Math.abs(dx)>Math.abs(dy)?'x':'y';}}if(axis==='x'){e.preventDefault();const base=-100*cur;const pct=(dx/window.innerWidth)*100;tr.style.transform=`translate3d(calc(${base}vw + ${pct}vw),0,0)`;}else if(axis==='y'){/* let page scroll; cancel swipe */drag=false;tr.style.transition='transform .2s';tr.style.transform=`translate3d(${-100*cur}vw,0,0)`;}}
function end(){if(!drag)return;drag=false;if(axis==='x'){if(Math.abs(dx)>THRESH){cur+=dx<0?1:-1;cur=Math.max(0,Math.min(IDS.length-1,cur));}tr.style.transition='transform .36s cubic-bezier(.22,.85,.32,1)';tr.style.transform=`translate3d(${-100*cur}vw,0,0)`;$$('.t').forEach((b,idx)=>b.classList.toggle('active',idx===cur));movePad();}dx=dy=0;axis=null;}
vp.addEventListener('touchstart',start,{passive:false});vp.addEventListener('touchmove',move,{passive:false});vp.addEventListener('touchend',end,{passive:false});
let md=false;vp.addEventListener('mousedown',e=>{md=true;start(e)});window.addEventListener('mousemove',e=>{if(md)move(e)});window.addEventListener('mouseup',()=>{if(md){md=false;end()}});
})();

window.addEventListener('resize', movePad);document.addEventListener('DOMContentLoaded',()=>{activate(2);movePad();refresh();if('serviceWorker'in navigator){navigator.serviceWorker.register('sw.js');}});
