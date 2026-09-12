(() => {
  const layer = () => document.getElementById('effectLayer');
  const reduced = () => document.body.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;

  function petalRain(player, count = 22) {
    if (reduced()) return;
    const panel = document.getElementById(`player${player}Panel`);
    const rect = panel.getBoundingClientRect();
    const icons = ['🌸','✨','🌼','💫','⭐'];
    for (let i=0;i<count;i++) {
      const p = document.createElement('span');
      p.className = 'petal';
      p.textContent = icons[Math.floor(Math.random()*icons.length)];
      p.style.left = `${rect.left + Math.random()*rect.width}px`;
      p.style.top = `${Math.max(-30, rect.top - 30 - Math.random()*50)}px`;
      p.style.setProperty('--drift', `${-70 + Math.random()*140}px`);
      p.style.setProperty('--fall', `${.9 + Math.random()*.65}s`);
      layer().appendChild(p);
      setTimeout(()=>p.remove(), 1800);
    }
  }

  function laserAttack(sourcePlayer, targetPlayer) {
    const source = document.getElementById(`player${sourcePlayer}Animal`);
    const target = document.getElementById(`player${targetPlayer}Animal`);
    if (!source || !target) return;

    const sr = source.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    const x1 = sr.left + sr.width/2, y1 = sr.top + sr.height/2;
    const x2 = tr.left + tr.width/2, y2 = tr.top + tr.height/2;
    const dx = x2-x1, dy = y2-y1;
    const dist = Math.hypot(dx,dy);
    const angle = Math.atan2(dy,dx) * 180 / Math.PI;

    source.style.setProperty('--attack-dir', sourcePlayer === 1 ? '18px' : '-18px');
    source.classList.add('is-attacking');
    setTimeout(()=>source.classList.remove('is-attacking'), 470);

    if (!reduced()) {
      const laser = document.createElement('div');
      laser.className = 'laser';
      laser.style.left = `${x1}px`;
      laser.style.top = `${y1}px`;
      laser.style.width = `${dist}px`;
      laser.style.transform = `rotate(${angle}deg)`;
      layer().appendChild(laser);
      setTimeout(()=>laser.remove(), 500);
    }

    setTimeout(()=>impact(targetPlayer), reduced() ? 30 : 260);
  }

  function impact(player) {
    const target = document.getElementById(`player${player}Animal`);
    const panel = document.getElementById(`player${player}Panel`);
    if (!target || !panel) return;
    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width/2, y = rect.top + rect.height/2;

    target.classList.add('is-hit');
    panel.classList.add('is-hit');
    setTimeout(()=>{ target.classList.remove('is-hit'); panel.classList.remove('is-hit'); }, 700);

    if (!reduced()) {
      const ring = document.createElement('div');
      ring.className = 'impact-ring'; ring.style.left=`${x}px`; ring.style.top=`${y}px`;
      layer().appendChild(ring); setTimeout(()=>ring.remove(),650);
    }
    const label = document.createElement('div');
    label.className='hit-label'; label.textContent='HIT!'; label.style.left=`${x}px`; label.style.top=`${y}px`;
    layer().appendChild(label); setTimeout(()=>label.remove(),720);
  }

  function celebrate(player) {
    petalRain(player, 30);
    const animal = document.getElementById(`player${player}Animal`);
    if (!animal) return;
    if (!reduced()) {
      animal.animate([
        {transform:'translateY(0) scale(1)'},
        {transform:'translateY(-18px) scale(1.08)'},
        {transform:'translateY(0) scale(1)'},
        {transform:'translateY(-10px) scale(1.05)'},
        {transform:'translateY(0) scale(1)'}
      ], {duration:850, easing:'ease-out'});
    }
  }

  function breakHeart(player, indexFromZero) {
    const heart = document.querySelector(`#player${player}Hearts .heart[data-index="${indexFromZero}"]`);
    if (!heart) return;
    heart.classList.add('is-breaking');
    setTimeout(()=>heart.classList.remove('is-breaking'),520);
  }

  window.ElementBattleEffects = { petalRain, laserAttack, impact, celebrate, breakHeart };
})();
