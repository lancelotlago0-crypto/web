(() => {
  const COLS = 10, ROWS = 20, S = 30;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('next');
  const nctx = nextCanvas.getContext('2d');
  const el = id => document.getElementById(id);
  const scoreEl = el('score'), linesEl = el('lines'), levelEl = el('level'), bestEl = el('best');
  const overlay = el('overlay'), text = el('text'), startBtn = el('start');

  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]]
  };
  const COLORS = { I: '#5fd7e8', O: '#f5d65c', T: '#b48cf0', S: '#7be0a4', Z: '#ff7a59', J: '#6fa4f2', L: '#f5a45c' };

  let board, piece, nextType, score, lines, level, running, paused, raf, last, acc;
  let best = 0;
  try { best = Number(localStorage.getItem('tetris-best')) || 0; } catch (e) {}
  bestEl.textContent = best;

  const emptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(''));
  const randType = () => Object.keys(SHAPES)[Math.floor(Math.random() * 7)];
  const interval = () => Math.max(90, 800 - (level - 1) * 70);

  function spawn() {
    const type = nextType || randType();
    nextType = randType();
    const m = SHAPES[type].map(r => r.slice());
    piece = { type, m, x: Math.floor((COLS - m[0].length) / 2), y: 0 };
    drawNext();
    if (collides(piece.m, piece.x, piece.y)) gameOver();
  }

  function collides(m, px, py) {
    for (let y = 0; y < m.length; y++)
      for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const bx = px + x, by = py + y;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && board[by][bx]) return true;
      }
    return false;
  }

  const rotateMatrix = m => m[0].map((_, i) => m.map(r => r[i]).reverse());

  function move(dx) {
    if (!collides(piece.m, piece.x + dx, piece.y)) piece.x += dx;
  }

  function rotate() {
    const r = rotateMatrix(piece.m);
    for (const k of [0, -1, 1, -2, 2]) {
      if (!collides(r, piece.x + k, piece.y)) { piece.m = r; piece.x += k; return; }
    }
  }

  function softDrop() {
    if (!collides(piece.m, piece.x, piece.y + 1)) { piece.y++; return true; }
    lock();
    return false;
  }

  function hardDrop() {
    let n = 0;
    while (!collides(piece.m, piece.x, piece.y + 1)) { piece.y++; n++; }
    score += n * 2;
    lock();
  }

  function lock() {
    piece.m.forEach((row, y) => row.forEach((v, x) => {
      if (v && piece.y + y >= 0) board[piece.y + y][piece.x + x] = piece.type;
    }));
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every(Boolean)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(''));
        cleared++; y++;
      }
    }
    if (cleared) {
      score += [0, 100, 300, 500, 800][cleared] * level;
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
    }
    updateHud();
    spawn();
  }

  function updateHud() {
    scoreEl.textContent = score;
    linesEl.textContent = lines;
    levelEl.textContent = level;
  }

  function cell(c, x, y, size, color) {
    c.fillStyle = color;
    c.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  }

  function draw() {
    ctx.fillStyle = '#1b3040';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#223b4d';
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if ((x + y) % 2 === 0) ctx.fillRect(x * S, y * S, S, S);
    board.forEach((row, y) => row.forEach((t, x) => t && cell(ctx, x, y, S, COLORS[t])));
    if (!piece) return;
    // sombra de dónde caerá
    let gy = piece.y;
    while (!collides(piece.m, piece.x, gy + 1)) gy++;
    ctx.globalAlpha = 0.25;
    piece.m.forEach((row, y) => row.forEach((v, x) => v && cell(ctx, piece.x + x, gy + y, S, COLORS[piece.type])));
    ctx.globalAlpha = 1;
    piece.m.forEach((row, y) => row.forEach((v, x) => v && cell(ctx, piece.x + x, piece.y + y, S, COLORS[piece.type])));
  }

  function drawNext() {
    nctx.clearRect(0, 0, 80, 80);
    const m = SHAPES[nextType];
    const off = (4 - m.length) / 2;
    m.forEach((row, y) => row.forEach((v, x) => v && cell(nctx, x + off, y + off, 20, COLORS[nextType])));
  }

  function loop(t) {
    if (!running) return;
    if (!paused) {
      acc += t - last;
      while (acc >= interval() && running) { acc -= interval(); softDrop(); }
      draw();
    }
    last = t;
    raf = requestAnimationFrame(loop);
  }

  function start() {
    board = emptyBoard();
    score = 0; lines = 0; level = 1; nextType = null; paused = false;
    updateHud();
    overlay.classList.add('hidden');
    running = true; acc = 0; last = performance.now();
    spawn();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function gameOver() {
    running = false;
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      try { localStorage.setItem('tetris-best', best); } catch (e) {}
    }
    text.textContent = `Fin del juego. Puntos: ${score}`;
    startBtn.textContent = 'Jugar otra vez';
    overlay.classList.remove('hidden');
    draw();
  }

  function act(a) {
    if (!running || paused) return;
    if (a === 'left') move(-1);
    else if (a === 'right') move(1);
    else if (a === 'rotate') rotate();
    else if (a === 'down') { if (softDrop()) score += 1; updateHud(); }
    else if (a === 'drop') { hardDrop(); }
    draw();
  }

  document.addEventListener('keydown', e => {
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', ArrowDown: 'down', ' ': 'drop' };
    if (e.code === 'Space' && !running) { e.preventDefault(); start(); return; }
    if ((e.key === 'p' || e.key === 'P') && running) { paused = !paused; last = performance.now(); return; }
    if (map[e.key]) { e.preventDefault(); act(map[e.key]); }
  });

  document.querySelectorAll('.pad button').forEach(b =>
    b.addEventListener('click', () => act(b.dataset.act)));

  startBtn.addEventListener('click', start);
  board = emptyBoard();
  nextType = randType();
  draw();
})();
