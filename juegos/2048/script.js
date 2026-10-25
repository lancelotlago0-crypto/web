(() => {
  const $ = id => document.getElementById(id);
  const gridEl = $('grid'), boardEl = $('board'), scoreEl = $('score'), bestEl = $('best');
  const overlay = $('overlay'), text = $('text'), keepBtn = $('keep');
  const DUR = 160;

  let tiles, score, nextId, won, keepGoing, over;
  const els = new Map();
  let best = 0;
  try { best = Number(localStorage.getItem('2048-best')) || 0; } catch (e) {}
  bestEl.textContent = best;

  const place = (el, r, c) => { el.style.transform = `translate(${c * 100}%, ${r * 100}%)`; };

  function setValue(inner, v) {
    inner.textContent = v;
    inner.dataset.v = v;
    inner.dataset.d = String(v).length;
    inner.classList.toggle('big', v > 2048);
  }

  function bump(inner, v) {
    setValue(inner, v);
    inner.classList.remove('bump');
    void inner.offsetWidth;
    inner.classList.add('bump');
  }

  // casillas de fondo
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      const s = document.createElement('div');
      s.className = 'tile slot';
      s.innerHTML = '<div class="in"></div>';
      place(s, r, c);
      gridEl.appendChild(s);
    }

  const live = () => tiles.filter(t => !t.remove);

  function newGame() {
    els.forEach(el => el.remove());
    els.clear();
    tiles = []; score = 0; nextId = 1; won = false; keepGoing = false; over = false;
    overlay.classList.add('hidden');
    addTile(); addTile();
    render();
    updateScore();
  }

  function addTile() {
    const used = new Set(live().map(t => t.r * 4 + t.c));
    const free = [];
    for (let i = 0; i < 16; i++) if (!used.has(i)) free.push(i);
    if (!free.length) return;
    const k = free[Math.floor(Math.random() * free.length)];
    tiles.push({ id: nextId++, v: Math.random() < 0.9 ? 2 : 4, r: Math.floor(k / 4), c: k % 4, isNew: true });
  }

  function render() {
    tiles.forEach(t => {
      let el = els.get(t.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'tile';
        const inner = document.createElement('div');
        inner.className = 'in';
        setValue(inner, t.v);
        if (t.isNew) inner.classList.add('pop');
        el.appendChild(inner);
        place(el, t.r, t.c);      // posición inicial antes de insertarlo: no "vuela" desde la esquina
        gridEl.appendChild(el);
        els.set(t.id, el);
      } else {
        place(el, t.r, t.c);
      }
      t.isNew = false;
    });
  }

  function dropTile(t) {
    setTimeout(() => {
      const el = els.get(t.id);
      if (el) el.remove();
      els.delete(t.id);
      tiles = tiles.filter(x => x !== t);
    }, DUR + 40);
  }

  function updateScore() {
    scoreEl.textContent = score;
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      try { localStorage.setItem('2048-best', best); } catch (e) {}
    }
  }

  function line(dir, i, k) {
    if (dir === 0) return { r: i, c: k };
    if (dir === 2) return { r: i, c: 3 - k };
    if (dir === 1) return { r: k, c: i };
    return { r: 3 - k, c: i };
  }

  function move(dir) {
    if (over || !overlay.classList.contains('hidden')) return;
    const grid = Array.from({ length: 4 }, () => Array(4).fill(null));
    live().forEach(t => { grid[t.r][t.c] = t; t.merged = false; });
    let moved = false;
    const merges = [];
    for (let i = 0; i < 4; i++) {
      let target = 0, prev = null;
      for (let k = 0; k < 4; k++) {
        const cell = line(dir, i, k), t = grid[cell.r][cell.c];
        if (!t) continue;
        if (prev && prev.v === t.v && !prev.merged) {
          t.r = prev.r; t.c = prev.c; t.remove = true;
          prev.v *= 2; prev.merged = true;
          score += prev.v; moved = true;
          merges.push({ tile: prev, v: prev.v });
          dropTile(t);
        } else {
          const d = line(dir, i, target);
          if (t.r !== d.r || t.c !== d.c) moved = true;
          t.r = d.r; t.c = d.c; prev = t; target++;
        }
      }
    }
    if (!moved) return;
    addTile();
    render();
    updateScore();
    // el número nuevo aparece cuando la ficha ya llegó
    merges.forEach(({ tile, v }) => setTimeout(() => {
      const el = els.get(tile.id);
      if (el) bump(el.firstChild, v);
    }, DUR - 50));
    setTimeout(checkEnd, DUR + 80);
  }

  function canMove() {
    const l = live();
    if (l.length < 16) return true;
    const g = Array.from({ length: 4 }, () => Array(4).fill(0));
    l.forEach(t => g[t.r][t.c] = t.v);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        if ((c < 3 && g[r][c] === g[r][c + 1]) || (r < 3 && g[r][c] === g[r + 1][c])) return true;
    return false;
  }

  function checkEnd() {
    if (!won && live().some(t => t.v >= 2048)) {
      won = true;
      text.textContent = '¡Llegaste a 2048!';
      keepBtn.classList.remove('hidden');
      overlay.classList.remove('hidden');
      return;
    }
    if (!canMove()) {
      over = true;
      text.textContent = `Sin movimientos. Puntos: ${score}`;
      keepBtn.classList.add('hidden');
      overlay.classList.remove('hidden');
    }
  }

  document.addEventListener('keydown', e => {
    const map = { ArrowLeft: 0, a: 0, A: 0, ArrowUp: 1, w: 1, W: 1, ArrowRight: 2, d: 2, D: 2, ArrowDown: 3, s: 3, S: 3 };
    if (e.key in map) { e.preventDefault(); move(map[e.key]); }
  });

  // Deslizar: el movimiento se dispara en cuanto el dedo recorre unos píxeles (sin esperar a soltar)
  let sx = null, sy = null;
  boardEl.addEventListener('pointerdown', e => {
    sx = e.clientX; sy = e.clientY;
    try { boardEl.setPointerCapture(e.pointerId); } catch (err) {}
  });
  boardEl.addEventListener('pointermove', e => {
    if (sx === null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    sx = null;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 0) : (dy > 0 ? 3 : 1));
  });
  ['pointerup', 'pointercancel'].forEach(ev => boardEl.addEventListener(ev, () => { sx = null; }));

  keepBtn.addEventListener('click', () => { keepGoing = true; overlay.classList.add('hidden'); });
  $('again').addEventListener('click', newGame);
  $('restart').addEventListener('click', newGame);
  newGame();
})();
