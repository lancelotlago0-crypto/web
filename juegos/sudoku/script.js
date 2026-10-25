(() => {
  const $ = id => document.getElementById(id);
  const gridEl = $('grid'), padEl = $('pad'), msg = $('msg'), levelSel = $('level');
  const CLUES = { easy: 40, mid: 32, hard: 27 };
  const HELP = 'Toca una casilla y elige un número.';

  let sol, vals, given, sel = -1, els = [], done = false;

  const rowOf = i => Math.floor(i / 9), colOf = i => i % 9;

  function canPlace(g, i, v) {
    const r = rowOf(i), c = colOf(i);
    for (let k = 0; k < 9; k++) {
      if (r * 9 + k !== i && g[r * 9 + k] === v) return false;
      if (k * 9 + c !== i && g[k * 9 + c] === v) return false;
    }
    const br = r - r % 3, bc = c - c % 3;
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++) {
        const k = (br + a) * 9 + bc + b;
        if (k !== i && g[k] === v) return false;
      }
    return true;
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // casilla vacía con menos candidatos
  function pick(g) {
    let best = -1, bestC = null;
    for (let i = 0; i < 81; i++) {
      if (g[i] !== 0) continue;
      const c = [];
      for (let v = 1; v <= 9; v++) if (canPlace(g, i, v)) c.push(v);
      if (c.length === 0) return { i, c };
      if (!bestC || c.length < bestC.length) { best = i; bestC = c; if (c.length === 1) break; }
    }
    return { i: best, c: bestC };
  }

  function fill(g) {
    const { i, c } = pick(g);
    if (i < 0) return true;
    if (c.length === 0) return false;
    shuffle(c);
    for (const v of c) { g[i] = v; if (fill(g)) return true; }
    g[i] = 0;
    return false;
  }

  function count(g, limit) {
    const { i, c } = pick(g);
    if (i < 0) return 1;
    let n = 0;
    for (const v of c) {
      g[i] = v;
      n += count(g, limit - n);
      if (n >= limit) break;
    }
    g[i] = 0;
    return n;
  }

  function generate(level) {
    const s = Array(81).fill(0);
    fill(s);
    const p = s.slice();
    const target = 81 - CLUES[level];
    let removed = 0;
    for (const i of shuffle([...Array(81).keys()])) {
      if (removed >= target) break;
      const v = p[i];
      p[i] = 0;
      if (count(p.slice(), 2) === 1) removed++; else p[i] = v;
    }
    return { puzzle: p, solution: s };
  }

  function build() {
    gridEl.innerHTML = '';
    els = [];
    for (let i = 0; i < 81; i++) {
      const b = document.createElement('button');
      b.className = 'c';
      if (colOf(i) % 3 === 2 && colOf(i) < 8) b.classList.add('br');
      if (rowOf(i) % 3 === 2 && rowOf(i) < 8) b.classList.add('bb');
      b.addEventListener('click', () => { sel = i; render(); });
      gridEl.appendChild(b);
      els.push(b);
    }
  }

  function render() {
    const sv = sel >= 0 ? vals[sel] : 0;
    for (let i = 0; i < 81; i++) {
      const el = els[i], v = vals[i];
      const related = sel >= 0 && (rowOf(i) === rowOf(sel) || colOf(i) === colOf(sel) ||
        (Math.floor(rowOf(i) / 3) === Math.floor(rowOf(sel) / 3) && Math.floor(colOf(i) / 3) === Math.floor(colOf(sel) / 3)));
      el.classList.toggle('g', given[i]);
      el.classList.toggle('rel', related && i !== sel);
      el.classList.toggle('same', !!sv && v === sv && i !== sel);
      el.classList.toggle('s', i === sel);
      el.classList.toggle('err', !given[i] && !!v && !canPlace(vals, i, v));
      el.textContent = v || '';
      el.setAttribute('aria-label', `Fila ${rowOf(i) + 1}, columna ${colOf(i) + 1}${v ? ', ' + v : ', vacía'}`);
    }
  }

  function check() {
    if (vals.some(v => !v)) return;
    for (let i = 0; i < 81; i++) if (!canPlace(vals, i, vals[i])) return;
    done = true;
    msg.textContent = '¡Sudoku resuelto! 🎉';
  }

  function setValue(v) {
    if (done || sel < 0 || given[sel]) return;
    vals[sel] = v;
    msg.textContent = HELP;
    render();
    check();
  }

  function newGame() {
    msg.textContent = 'Generando…';
    setTimeout(() => {
      const { puzzle, solution } = generate(levelSel.value);
      sol = solution;
      vals = puzzle.slice();
      given = puzzle.map(v => v !== 0);
      sel = -1; done = false;
      build();
      render();
      msg.textContent = HELP;
    }, 20);
  }

  function hint() {
    if (done) return;
    let i = sel;
    if (i < 0 || given[i] || vals[i] === sol[i]) {
      const bad = [];
      for (let k = 0; k < 81; k++) if (!given[k] && vals[k] !== sol[k]) bad.push(k);
      if (!bad.length) return;
      i = bad[Math.floor(Math.random() * bad.length)];
    }
    sel = i;
    vals[i] = sol[i];
    render();
    check();
  }

  for (let n = 1; n <= 9; n++) {
    const b = document.createElement('button');
    b.textContent = n;
    b.addEventListener('click', () => setValue(n));
    padEl.appendChild(b);
  }
  const del = document.createElement('button');
  del.textContent = '⌫';
  del.setAttribute('aria-label', 'Borrar');
  del.addEventListener('click', () => setValue(0));
  padEl.appendChild(del);

  document.addEventListener('keydown', e => {
    if (e.key >= '1' && e.key <= '9') setValue(Number(e.key));
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') setValue(0);
    else if (e.key.startsWith('Arrow') && sel >= 0) {
      e.preventDefault();
      const r = rowOf(sel), c = colOf(sel);
      if (e.key === 'ArrowUp') sel = Math.max(0, r - 1) * 9 + c;
      if (e.key === 'ArrowDown') sel = Math.min(8, r + 1) * 9 + c;
      if (e.key === 'ArrowLeft') sel = r * 9 + Math.max(0, c - 1);
      if (e.key === 'ArrowRight') sel = r * 9 + Math.min(8, c + 1);
      render();
    }
  });

  $('new').addEventListener('click', newGame);
  $('hint').addEventListener('click', hint);
  levelSel.addEventListener('change', newGame);
  newGame();
})();
