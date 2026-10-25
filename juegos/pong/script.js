(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const meEl = document.getElementById('me');
  const cpuEl = document.getElementById('cpu');
  const overlay = document.getElementById('overlay');
  const text = document.getElementById('text');
  const startBtn = document.getElementById('start');
  const W = 320, H = 480, PW = 72, PH = 10, R = 6, WIN = 7;
  const PY = H - 30, CY = 20;

  let me, cpu, px, cx, ball, pause, running = false, last = 0, raf, keyDir = 0;

  function serve(dirDown) {
    const a = (Math.random() * 0.8 - 0.4);
    const sp = 260;
    ball = { x: W / 2, y: H / 2, vx: sp * Math.sin(a), vy: (dirDown ? 1 : -1) * sp * Math.cos(a), sp };
    pause = 0.8;
  }

  function start() {
    me = 0; cpu = 0;
    meEl.textContent = 0; cpuEl.textContent = 0;
    px = W / 2; cx = W / 2;
    serve(Math.random() < 0.5);
    overlay.classList.add('hidden');
    running = true;
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function end() {
    running = false;
    text.textContent = me > cpu ? '¡Ganaste!' : 'Ganó la máquina';
    startBtn.textContent = 'Jugar otra vez';
    overlay.classList.remove('hidden');
  }

  function point(playerScored) {
    if (playerScored) { me++; meEl.textContent = me; } else { cpu++; cpuEl.textContent = cpu; }
    if (me >= WIN || cpu >= WIN) return end();
    serve(!playerScored);
  }

  function bounce(paddleX, dirDown) {
    const off = Math.max(-1, Math.min(1, (ball.x - paddleX) / (PW / 2)));
    ball.sp = Math.min(520, ball.sp + 14);
    const ang = off * 1.0;
    ball.vx = ball.sp * Math.sin(ang);
    ball.vy = (dirDown ? 1 : -1) * ball.sp * Math.cos(ang);
  }

  function update(dt) {
    px += keyDir * 380 * dt;
    px = Math.max(PW / 2, Math.min(W - PW / 2, px));

    const diff = ball.x - cx;
    const maxMove = 210 * dt;
    cx += Math.max(-maxMove, Math.min(maxMove, diff));
    cx = Math.max(PW / 2, Math.min(W - PW / 2, cx));

    if (pause > 0) { pause -= dt; return; }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x < R) { ball.x = R; ball.vx = Math.abs(ball.vx); }
    if (ball.x > W - R) { ball.x = W - R; ball.vx = -Math.abs(ball.vx); }

    if (ball.vy > 0 && ball.y + R >= PY && ball.y + R <= PY + PH + 8 && Math.abs(ball.x - px) <= PW / 2 + R) {
      ball.y = PY - R; bounce(px, false);
    }
    if (ball.vy < 0 && ball.y - R <= CY + PH && ball.y - R >= CY - 8 && Math.abs(ball.x - cx) <= PW / 2 + R) {
      ball.y = CY + PH + R; bounce(cx, true);
    }

    if (ball.y > H + R) point(false);
    else if (ball.y < -R) point(true);
  }

  function draw() {
    ctx.fillStyle = '#1b3040';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2f5069';
    for (let x = 0; x < W; x += 24) ctx.fillRect(x + 4, H / 2 - 1, 12, 2);
    ctx.fillStyle = '#ff7a59';
    ctx.fillRect(cx - PW / 2, CY, PW, PH);
    ctx.fillStyle = '#7be0a4';
    ctx.fillRect(px - PW / 2, PY, PW, PH);
    ctx.fillStyle = '#e8f1f5';
    ctx.beginPath(); ctx.arc(ball.x, ball.y, R, 0, Math.PI * 2); ctx.fill();
  }

  function loop(t) {
    const dt = Math.min(0.033, (t - last) / 1000);
    last = t;
    if (running) update(dt);
    draw();
    if (running) raf = requestAnimationFrame(loop);
  }

  function pointerX(e) {
    const rect = canvas.getBoundingClientRect();
    px = ((e.clientX - rect.left) / rect.width) * W;
    px = Math.max(PW / 2, Math.min(W - PW / 2, px));
  }
  canvas.addEventListener('pointerdown', pointerX);
  canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || e.buttons || true) pointerX(e); });

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { keyDir = -1; e.preventDefault(); }
    if (e.key === 'ArrowRight') { keyDir = 1; e.preventDefault(); }
    if (e.code === 'Space' && !running) { e.preventDefault(); start(); }
  });
  document.addEventListener('keyup', e => {
    if ((e.key === 'ArrowLeft' && keyDir < 0) || (e.key === 'ArrowRight' && keyDir > 0)) keyDir = 0;
  });
  startBtn.addEventListener('click', start);

  px = W / 2; cx = W / 2;
  ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, sp: 260 };
  draw();
})();
