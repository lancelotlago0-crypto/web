(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const text = document.getElementById('text');
  const startBtn = document.getElementById('start');
  const W = canvas.width, H = canvas.height;
  const P = { w: 50, h: 18, speed: 6 };

  let px, blocks, frame, score, running, raf, left, right;
  let best = 0;
  try { best = Number(localStorage.getItem('esquivar-best')) || 0; } catch (e) {}
  bestEl.textContent = best;

  function start() {
    px = W / 2 - P.w / 2;
    blocks = []; frame = 0; score = 0; left = right = false;
    scoreEl.textContent = 0;
    overlay.classList.add('hidden');
    running = true;
    cancelAnimationFrame(raf);
    loop();
  }

  function end() {
    running = false;
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      try { localStorage.setItem('esquivar-best', best); } catch (e) {}
    }
    text.textContent = `Fin del juego. Puntos: ${score}`;
    startBtn.textContent = 'Jugar otra vez';
    overlay.classList.remove('hidden');
  }

  function loop() {
    if (!running) return;
    update();
    draw();
    raf = requestAnimationFrame(loop);
  }

  function update() {
    frame++;
    if (left) px -= P.speed;
    if (right) px += P.speed;
    px = Math.max(0, Math.min(W - P.w, px));

    const level = 1 + frame / 600;
    const spawnEvery = Math.max(14, Math.floor(40 / level));
    if (frame % spawnEvery === 0) {
      const w = 30 + Math.random() * 50;
      blocks.push({ x: Math.random() * (W - w), y: -20, w, h: 20, v: 2.5 + Math.random() * 1.5 + level });
    }

    const py = H - P.h - 10;
    for (const b of blocks) {
      b.y += b.v;
      if (b.x < px + P.w && b.x + b.w > px && b.y < py + P.h && b.y + b.h > py) return end();
    }
    blocks = blocks.filter(b => b.y < H);
    if (frame % 6 === 0) { score++; scoreEl.textContent = score; }
  }

  function draw() {
    ctx.fillStyle = '#1b3040';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff7a59';
    blocks.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
    ctx.fillStyle = '#7be0a4';
    ctx.fillRect(px, H - P.h - 10, P.w, P.h);
  }

  document.addEventListener('keydown', e => {
    if (['ArrowLeft', 'a'].includes(e.key)) { left = true; e.preventDefault(); }
    if (['ArrowRight', 'd'].includes(e.key)) { right = true; e.preventDefault(); }
    if (e.code === 'Space' && !running) { e.preventDefault(); start(); }
  });
  document.addEventListener('keyup', e => {
    if (['ArrowLeft', 'a'].includes(e.key)) left = false;
    if (['ArrowRight', 'd'].includes(e.key)) right = false;
  });

  const hold = (id, setter) => {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', () => setter(true));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, () => setter(false)));
  };
  hold('left', v => left = v);
  hold('right', v => right = v);

  // Arrastrar el dedo / ratón sobre el tablero
  canvas.addEventListener('pointermove', e => {
    if (!running || (e.pointerType === 'mouse' && e.buttons === 0)) return;
    const rect = canvas.getBoundingClientRect();
    px = ((e.clientX - rect.left) / rect.width) * W - P.w / 2;
  });

  startBtn.addEventListener('click', start);
  px = W / 2 - P.w / 2; blocks = [];
  draw();
})();
