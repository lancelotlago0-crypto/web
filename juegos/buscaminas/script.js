(() => {
  const LEVELS = { easy: { c: 9, r: 9, m: 10 }, mid: { c: 12, r: 12, m: 24 }, hard: { c: 14, r: 14, m: 40 } };
  const $ = id => document.getElementById(id);
  const boardEl = $('board'), minesEl = $('mines'), timeEl = $('time'), faceEl = $('face');
  const levelSel = $('level'), msg = $('msg'), flagBtn = $('flagmode');
  const HELP = 'Toca para destapar. Mantén pulsado (o clic derecho) para poner bandera.';

  let cfg, cells, els, started, over, opened, flags, timer, secs;
  let flagMode = false, longFired = false, pressTimer;

  const pad3 = n => String(Math.min(999, n)).padStart(3, '0');

  function neighbors(i) {
    const r = Math.floor(i / cfg.c), c = i % cfg.c, out = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < cfg.r && nc >= 0 && nc < cfg.c) out.push(nr * cfg.c + nc);
      }
    return out;
  }

  function newGame() {
    cfg = LEVELS[levelSel.value];
    cells = Array.from({ length: cfg.c * cfg.r }, () => ({ mine: false, open: false, flag: false, n: 0 }));
    started = false; over = false; opened = 0; flags = 0; secs = 0;
    clearInterval(timer);
    timeEl.textContent = '000';
    faceEl.textContent = '🙂';
    msg.textContent = HELP;
    boardEl.style.setProperty('--cols', cfg.c);
    boardEl.innerHTML = '';
    els = cells.map((_, i) => {
      const b = document.createElement('button');
      b.className = 'cell';
      b.setAttribute('aria-label', 'Casilla oculta');
      b.addEventListener('click', () => onClick(i));
      b.addEventListener('contextmenu', e => { e.preventDefault(); toggleFlag(i); });
      b.addEventListener('pointerdown', e => {
        longFired = false;
        if (e.pointerType === 'mouse') return;
        pressTimer = setTimeout(() => {
          longFired = true;
          toggleFlag(i);
          if (navigator.vibrate) navigator.vibrate(30);
        }, 450);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev =>
        b.addEventListener(ev, () => clearTimeout(pressTimer)));
      boardEl.appendChild(b);
      return b;
    });
    updateMines();
  }

  function updateMines() { minesEl.textContent = cfg.m - flags; }

  function start(first) {
    const banned = new Set([first, ...neighbors(first)]);
    let placed = 0;
    while (placed < cfg.m) {
      const k = Math.floor(Math.random() * cells.length);
      if (banned.has(k) || cells[k].mine) continue;
      cells[k].mine = true; placed++;
    }
    cells.forEach((c, i) => { c.n = neighbors(i).filter(j => cells[j].mine).length; });
    started = true;
    timer = setInterval(() => { secs++; timeEl.textContent = pad3(secs); }, 1000);
  }

  function render(i) {
    const c = cells[i], el = els[i];
    el.className = 'cell' + (c.open ? ' open' + (c.n ? ' n' + c.n : '') : '');
    el.textContent = c.open ? (c.n || '') : (c.flag ? '🚩' : '');
    el.setAttribute('aria-label', c.open ? 'Casilla abierta' : c.flag ? 'Bandera' : 'Casilla oculta');
  }

  function toggleFlag(i) {
    if (over || cells[i].open) return;
    cells[i].flag = !cells[i].flag;
    flags += cells[i].flag ? 1 : -1;
    render(i);
    updateMines();
  }

  function reveal(i) {
    const c = cells[i];
    if (over || c.open || c.flag) return;
    if (!started) start(i);
    if (c.mine) return lose(i);
    const stack = [i];
    while (stack.length) {
      const k = stack.pop(), ck = cells[k];
      if (ck.open || ck.flag) continue;
      ck.open = true; opened++;
      render(k);
      if (ck.n === 0) neighbors(k).forEach(j => { if (!cells[j].open) stack.push(j); });
    }
    if (opened === cells.length - cfg.m) win();
  }

  function chord(i) {
    const c = cells[i];
    if (over || !c.open || !c.n) return;
    const near = neighbors(i);
    if (near.filter(j => cells[j].flag).length === c.n) near.forEach(reveal);
  }

  function onClick(i) {
    if (longFired) { longFired = false; return; }
    if (cells[i].open) chord(i);
    else if (flagMode) toggleFlag(i);
    else reveal(i);
  }

  function lose(hit) {
    over = true;
    clearInterval(timer);
    faceEl.textContent = '😵';
    cells.forEach((c, i) => {
      const el = els[i];
      if (c.mine && !c.flag) { el.className = 'cell open' + (i === hit ? ' boom' : ''); el.textContent = '💣'; }
      else if (!c.mine && c.flag) { el.className = 'cell wrong'; el.textContent = '❌'; }
    });
    msg.textContent = '¡Boom! Pulsa la cara para intentarlo otra vez.';
  }

  function win() {
    over = true;
    clearInterval(timer);
    faceEl.textContent = '😎';
    cells.forEach((c, i) => { if (c.mine && !c.flag) { c.flag = true; render(i); } });
    flags = cfg.m; updateMines();
    const key = 'buscaminas-best-' + levelSel.value;
    let best = 0;
    try { best = Number(localStorage.getItem(key)) || 0; } catch (e) {}
    if (!best || secs < best) {
      best = secs;
      try { localStorage.setItem(key, best); } catch (e) {}
    }
    msg.textContent = `¡Ganaste en ${secs} s! Mejor tiempo: ${best} s.`;
  }

  flagBtn.addEventListener('click', () => {
    flagMode = !flagMode;
    flagBtn.classList.toggle('on', flagMode);
    flagBtn.textContent = '🚩 Modo bandera: ' + (flagMode ? 'sí' : 'no');
  });
  faceEl.addEventListener('click', newGame);
  levelSel.addEventListener('change', newGame);
  newGame();
})();
