(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const scoreEl = $('score'), livesEl = $('lives'), bestEl = $('best');
  const overlay = $('overlay'), text = $('text'), startBtn = $('start'), pauseBtn = $('pause');

  const W = 360, H = 560, COLS = 30, ROWS = 20, CELL = 12, OY = 14, BR = 4;
  const PW = 72, PH = 10, PY = H - 60;

  let bricks, left, score, lives, state = 'idle', before = 'ready';
  let px = W / 2, ball = { x: W / 2, y: PY - BR - 1, vx: 0, vy: 0 };
  let last = 0, raf, keyDir = 0, speed = 320;
  let best = 0;
  try { best = Number(localStorage.getItem('ladrillos-best')) || 0; } catch (e) {}
  bestEl.textContent = best;

  function hud() {
    scoreEl.textContent = score;
    livesEl.textContent = '♥'.repeat(Math.max(0, lives));
  }

  function newGame() {
    bricks = new Array(COLS * ROWS).fill(2);
    left = bricks.length; score = 0; lives = 3; speed = 320; px = W / 2;
    hud();
    overlay.classList.add('hidden');
    ready();
    run();
  }

  function ready() {
    state = 'ready';
    ball = { x: px, y: PY - BR - 1, vx: 0, vy: 0 };
  }

  function run() {
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function launch() {
    if (state !== 'ready') return;
    const a = Math.random() * 0.6 - 0.3;
    ball.vx = speed * Math.sin(a);
    ball.vy = -speed * Math.cos(a);
    state = 'play';
  }

  function finish(won) {
    state = 'over';
    if (score > best) {
      best = score; bestEl.textContent = best;
      try { localStorage.setItem('ladrillos-best', best); } catch (e) {}
    }
    text.textContent = won ? '¡Limpiaste todos los ladrillos! 🎉' : `Fin del juego. Ladrillos rotos: ${score}`;
    startBtn.textContent = 'Jugar otra vez';
    overlay.classList.remove('hidden');
  }

  function pause() {
    if (state === 'play' || state === 'ready') {
      before = state; state = 'paused';
      text.textContent = 'Pausa';
      startBtn.textContent = 'Seguir';
      overlay.classList.remove('hidden');
    } else if (state === 'paused') resume();
  }

  function resume() {
    state = before;
    overlay.classList.add('hidden');
    run();
  }

  // Si la bola toca un ladrillo, abre un cráter: rompe los de alrededor y deja dañados (grises) los del borde
  function blast(tc, tr) {
    for (let r = tr - 3; r <= tr + 3; r++)
      for (let c = tc - 3; c <= tc + 3; c++) {
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        const i = r * COLS + c;
        if (!bricks[i]) continue;
        const d = Math.hypot(c - tc, r - tr);
        if (d <= 2.1) { bricks[i] = 0; left--; score++; }
        else if (d <= 3.1) {
          if (bricks[i] === 2) bricks[i] = 1;
          else { bricks[i] = 0; left--; score++; }
        }
      }
  }

  function hit(x, y) {
    const c0 = Math.floor((x - BR) / CELL), c1 = Math.floor((x + BR) / CELL);
    const r0 = Math.floor((y - BR - OY) / CELL), r1 = Math.floor((y + BR - OY) / CELL);
    let tc = -1, tr = -1, bd = 1e9;
    for (let r = Math.max(0, r0); r <= Math.min(ROWS - 1, r1); r++)
      for (let c = Math.max(0, c0); c <= Math.min(COLS - 1, c1); c++) {
        if (bricks[r * COLS + c] <= 0) continue;
        const d = Math.hypot(c * CELL + CELL / 2 - x, OY + r * CELL + CELL / 2 - y);
        if (d < bd) { bd = d; tc = c; tr = r; }
      }
    if (tc < 0) return false;
    blast(tc, tr);
    hud();
    return true;
  }

  function bounce() {
    const off = Math.max(-1, Math.min(1, (ball.x - px) / (PW / 2)));
    speed = Math.min(520, speed + 4);
    const ang = off * 1.05 + (Math.random() - 0.5) * 0.35; // pequeño azar para que la bola no suba siempre por el mismo sitio
    ball.vx = speed * Math.sin(ang);
    ball.vy = -speed * Math.cos(ang);
    ball.y = PY - BR;
  }

  function update(dt) {
    px += keyDir * 420 * dt;
    px = Math.max(PW / 2, Math.min(W - PW / 2, px));
    if (state === 'ready') { ball.x = px; ball.y = PY - BR - 1; return; }

    const sp = Math.hypot(ball.vx, ball.vy);
    const n = Math.max(1, Math.ceil(sp * dt / 2));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      ball.x += ball.vx * h;
      if (ball.x < BR) { ball.x = BR; ball.vx = Math.abs(ball.vx); }
      if (ball.x > W - BR) { ball.x = W - BR; ball.vx = -Math.abs(ball.vx); }
      if (hit(ball.x, ball.y)) { ball.x -= ball.vx * h; ball.vx = -ball.vx; }

      ball.y += ball.vy * h;
      if (ball.y < BR) { ball.y = BR; ball.vy = Math.abs(ball.vy); }
      if (hit(ball.x, ball.y)) { ball.y -= ball.vy * h; ball.vy = -ball.vy; }

      if (ball.vy > 0 && ball.y + BR >= PY && ball.y + BR <= PY + PH + 6 && Math.abs(ball.x - px) <= PW / 2 + BR) bounce();

      if (left === 0) return finish(true);
      if (ball.y > H + BR) {
        lives--; hud();
        if (lives <= 0) return finish(false);
        speed = Math.max(320, speed - 40);
        return ready();
      }
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function draw() {
    ctx.fillStyle = '#0b1030';
    ctx.fillRect(0, 0, W, H);
    if (bricks) {
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          const b = bricks[r * COLS + c];
          if (!b) continue;
          ctx.fillStyle = b === 2 ? '#ff4a2e' : '#b9c0cc';
          ctx.fillRect(c * CELL + 1, OY + r * CELL + 1, CELL - 2, CELL - 2);
        }
    }
    ctx.fillStyle = '#8fa8ff';
    roundRect(px - PW / 2, PY, PW, PH, 5);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ball.x, ball.y, BR, 0, Math.PI * 2); ctx.fill();
  }

  function loop(t) {
    const dt = Math.min(0.033, (t - last) / 1000);
    last = t;
    if (state === 'play' || state === 'ready') update(dt);
    draw();
    if (state === 'play' || state === 'ready') raf = requestAnimationFrame(loop);
  }

  function setPx(e) {
    const rect = canvas.getBoundingClientRect();
    px = ((e.clientX - rect.left) / rect.width) * W;
    px = Math.max(PW / 2, Math.min(W - PW / 2, px));
  }
  canvas.addEventListener('pointerdown', e => { setPx(e); launch(); });
  canvas.addEventListener('pointermove', setPx);

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { keyDir = -1; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { keyDir = 1; e.preventDefault(); }
    else if (e.code === 'Space') {
      e.preventDefault();
      if (state === 'ready') launch();
      else if (state === 'idle' || state === 'over') newGame();
    } else if (e.key === 'p' || e.key === 'P') pause();
  });
  document.addEventListener('keyup', e => {
    if ((e.key === 'ArrowLeft' && keyDir < 0) || (e.key === 'ArrowRight' && keyDir > 0)) keyDir = 0;
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  startBtn.addEventListener('click', () => { if (state === 'paused') resume(); else newGame(); });
  pauseBtn.addEventListener('click', pause);

  draw();
})();
