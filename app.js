document.querySelector('.tabbar').addEventListener('click', e=>{
  const btn=e.target.closest('button'); if(!btn) return;
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active', p.id===btn.dataset.tab));
  document.querySelectorAll('.tabbar button').forEach(b=>b.classList.toggle('active', b===btn));
});