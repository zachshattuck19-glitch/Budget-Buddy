
const $=s=>document.querySelector(s);const $$=s=>Array.from(document.querySelectorAll(s));
const ids=['calendar','debts','dashboard','spending','budget'];let current=2;
function activateTab(i){
  current=Math.max(0,Math.min(ids.length-1,i));
  const track=$('#track');
  track.style.transition='transform .32s cubic-bezier(.22,.85,.32,1)';
  track.style.transform=`translate3d(${-100*current}vw,0,0)`;
  $$('.t').forEach((b,idx)=> b.classList.toggle('active', idx===current));
  movePad();
}
function movePad(){
  const tabs=$$('.tabs .t'); const pad=$('#activePad'); const bar=document.querySelector('.tabbar');
  const r=tabs[current].getBoundingClientRect(); const br=bar.getBoundingClientRect();
  // Width matches tab, slight extra for dashboard
  let w=Math.round(r.width*0.98); if(tabs[current].classList.contains('home')) w=Math.round(r.width*1.10);
  pad.style.width=w+'px';
  const x=Math.round((r.left - br.left) + (r.width/2) - (w/2));
  pad.style.transform=`translateX(${x}px)`;
  // Bulge height on dashboard by adjusting top/bottom via class
  pad.classList.toggle('bulge', tabs[current].classList.contains('home'));
}
function initTabs(){
  document.querySelector('.tabs').addEventListener('click', (e)=>{
    const b=e.target.closest('.t'); if(!b) return;
    const i=ids.indexOf(b.dataset.tab); if(i>=0) activateTab(i);
  });
}
/* Swipe with live drag */
(function(){
  const viewport=$('#viewport'); const track=$('#track');
  let sx=0,sy=0,dx=0,drag=false; const thresh=window.innerWidth*0.30; const restr=80;
  function start(e){const t=e.touches?e.touches[0]:e; sx=t.pageX; sy=t.pageY; dx=0; drag=true; track.style.transition='none';}
  function move(e){ if(!drag) return; const t=e.touches?e.touches[0]:e; const dy=Math.abs(t.pageY-sy); if(dy>restr){drag=false; return;}
    dx=t.pageX-sx; const base=-100*current; const pct=(dx/window.innerWidth)*100; track.style.transform=`translate3d(calc(${base}vw + ${pct}vw),0,0)`; }
  function end(){ if(!drag) return; drag=false; if(Math.abs(dx)>thresh){ current += dx<0 ? 1 : -1; current=Math.max(0,Math.min(ids.length-1,current)); }
    track.style.transition='transform .36s cubic-bezier(.22,.85,.32,1)'; track.style.transform=`translate3d(${-100*current}vw,0,0)`; $$('.t').forEach((b,idx)=> b.classList.toggle('active', idx===current)); movePad(); dx=0; }
  viewport.addEventListener('touchstart', start, {passive:true});
  viewport.addEventListener('touchmove', move, {passive:true});
  viewport.addEventListener('touchend', end, {passive:true});
  // Desktop support
  let md=false; viewport.addEventListener('mousedown', (e)=>{md=true; start(e)}); window.addEventListener('mousemove',(e)=>{ if(md) move(e)}); window.addEventListener('mouseup',()=>{ if(md){md=false; end()}});
})();
window.addEventListener('resize', movePad);
document.addEventListener('DOMContentLoaded', ()=>{ activateTab(2); movePad(); });
if('serviceWorker' in navigator){ window.addEventListener('load', ()=> navigator.serviceWorker.register('sw.js')); }
