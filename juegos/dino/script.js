(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const text = document.getElementById('text');
  const startBtn = document.getElementById('start');
  const W = 600, H = 200, GROUND = 160, DX = 40;
  const FG = '#e8f1f5', DIM = '#8fa9b8';

  const BODY = [
    '........XXXXXX..', '.......XXXXXXXX.', '.......XX.XXXXXX', '.......XXXXXXXXX',
    '.......XXXXXXXXX', '.......XXXX.....', '.......XXXXXXX..', 'X.....XXXXXX....',
    'X....XXXXXXXX.X.', 'XX..XXXXXXXXXX..', 'XXXXXXXXXXXXXX..', '.XXXXXXXXXXXXX..',
    '..XXXXXXXXXXX...', '...XXXXXXXXX....'
  ];
  const LEGS_A = ['....XXX..XXX....', '....XX...XXX....', '....XXX.........'];
  const LEGS_B = ['....XXX..XXX....', '....XXX...XX....', '..........XXX...'];

  const pad5 = n => String(Math.floor(n)).padStart(5, '0');
  let dino, obstacles, clouds, speed, dist, state = 'idle', last = 0, nextGap, time, duck = false, raf;
  let best = 0;
  try { best = Number(localStorage.getItem('dino-best')) || 0; } catch (e) {}
  bestEl.textContent = pad5(best);

  function reset() {
    dino = { y: 0, vy: 0 };
    obstacles = [];
    clouds = [{ x: 150, y: 40 }, { x: 420, y: 70 }];
    speed = 300; dist = 0; time = 0; nextGap = 500;
    duck = false;
  }

  function start() {
    reset();
    state = 'play';
    overlay.classList.add('hidden');
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function die() {
    state = 'dead';
    const s = Math.floor(dist * 0.04);
    if (s > best) {
      best = s;
      bestEl.textContent = pad5(best);
      try { localStorage.setItem('dino-best', best); } catch (e) {}
    }
    text.textContent = `Fin del juego. Puntos: ${pad5(s)}`;
    startBtn.textContent = 'Jugar otra vez';
    overlay.classList.remove('hidden');
  }

  function jump() {
    if (state !== 'play') { start(); return; }
    if (dino.y === 0) dino.vy = 820;
  }

  const onGround = () => dino.y === 0;
  const dinoH = () => (duck && onGround() ? 31 : 51);

  function spawn() {
    const birdOk = dist * 0.04 > 150;
    if (birdOk && Math.random() < 0.25) {
      const high = Math.random() < 0.5;
      obstacles.push({ type: 'bird', x: W + 20, y: high ? 100 : 128, w: 36, h: 22 });
    } else {
      const big = Math.random() < 0.4;
      const n = Math.random() < 0.3 ? 2 : 1;
      const cw = big ? 24 : 18, ch = big ? 50 : 34;
      obstacles.push({ type: 'cactus', n, cw, x: W + 20, y: GROUND - ch, w: n * cw + (n - 1) * 4, h: ch });
    }
    nextGap = (320 + Math.random() * 380) * (speed / 380);
  }

  function hits(o) {
    const h = dinoH();
    const top = GROUND - h - dino.y;
    const ducked = duck && onGround();
    const a = { x: DX + (ducked ? 4 : 8), y: top + 5, w: ducked ? 48 : 32, h: h - 8 };
    const b = { x: o.x + 3, y: o.y + 3, w: o.w - 6, h: o.h - 6 };
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function update(dt) {
    time += dt;
    speed = Math.min(720, speed + 8 * dt);
    dist += speed * dt;
    const g = duck && !onGround() ? 6500 : 2600;
    dino.vy -= g * dt;
    dino.y += dino.vy * dt;
    if (dino.y <= 0) { dino.y = 0; dino.vy = 0; }

    obstacles.forEach(o => o.x -= speed * dt);
    obstacles = obstacles.filter(o => o.x + o.w > -10);
    clouds.forEach(c => { c.x -= 40 * dt; if (c.x < -60) { c.x = W + 20; c.y = 30 + Math.random() * 60; } });

    nextGap -= speed * dt;
    if (nextGap <= 0) spawn();
    if (obstacles.some(hits)) die();
    scoreEl.textContent = pad5(dist * 0.04);
  }

  function bitmap(rows, x, y, sx, sy) {
    ctx.fillStyle = FG;
    rows.forEach((r, j) => {
      for (let i = 0; i < r.length; i++)
        if (r[i] === 'X') ctx.fillRect(x + i * sx, y + j * sy, Math.ceil(sx), Math.ceil(sy));
    });
  }

  function drawDino() {
    const ducked = duck && onGround();
    const legs = (Math.floor(time * 10) % 2 === 0) ? LEGS_A : LEGS_B;
    const LEGS_AIR = ['....XXX..XXX....', '....XX...XX.....', '....XXX..XXX....'];
    const rows = BODY.concat(onGround() && state === 'play' ? legs : LEGS_AIR);
    if (ducked) bitmap(rows, DX - 2, GROUND - 31, 3.5, 1.8);
    else bitmap(rows, DX, GROUND - 51 - dino.y, 3, 3);
  }

  function drawCactus(o) {
    ctx.fillStyle = FG;
    for (let i = 0; i < o.n; i++) {
      const cx = o.x + i * (o.cw + 4), cw = o.cw, ch = o.h;
      ctx.fillRect(cx + cw * 0.35, o.y, cw * 0.3, ch);
      ctx.fillRect(cx, o.y + ch * 0.45, cw * 0.4, 5);
      ctx.fillRect(cx, o.y + ch * 0.28, 5, ch * 0.22);
      ctx.fillRect(cx + cw * 0.6, o.y + ch * 0.35, cw * 0.4, 5);
      ctx.fillRect(cx + cw - 5, o.y + ch * 0.18, 5, ch * 0.22);
    }
  }

  function drawBird(o) {
    ctx.fillStyle = FG;
    ctx.fillRect(o.x + 8, o.y + 8, 24, 8);
    ctx.fillRect(o.x, o.y + 10, 10, 4);
    ctx.fillRect(o.x + 28, o.y + 4, 8, 8);
    if (Math.floor(time * 8) % 2 === 0) ctx.fillRect(o.x + 14, o.y, 8, 10);
    else ctx.fillRect(o.x + 14, o.y + 14, 8, 8);
  }

  function draw() {
    ctx.fillStyle = '#1b3040';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#26465c';
    clouds.forEach(c => { ctx.fillRect(c.x, c.y, 44, 8); ctx.fillRect(c.x + 10, c.y - 6, 24, 8); });
    ctx.fillStyle = DIM;
    ctx.fillRect(0, GROUND + 1, W, 2);
    const off = (dist % 60);
    for (let x = -off; x < W; x += 60) { ctx.fillRect(x + 10, GROUND + 8, 10, 2); ctx.fillRect(x + 38, GROUND + 14, 5, 2); }
    obstacles.forEach(o => o.type === 'bird' ? drawBird(o) : drawCactus(o));
    drawDino();
  }

  function loop(t) {
    const dt = Math.min(0.04, (t - last) / 1000);
    last = t;
    if (state === 'play') update(dt);
    draw();
    if (state === 'play') raf = requestAnimationFrame(loop);
  }

  document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.key === 'ArrowUp') { e.preventDefault(); jump(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); duck = true; }
  });
  document.addEventListener('keyup', e => { if (e.key === 'ArrowDown') duck = false; });

  canvas.addEventListener('pointerdown', jump);
  document.getElementById('jump').addEventListener('pointerdown', e => { e.preventDefault(); jump(); });
  const d = document.getElementById('duck');
  d.addEventListener('pointerdown', e => { e.preventDefault(); duck = true; });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => d.addEventListener(ev, () => duck = false));
  startBtn.addEventListener('click', start);

  reset();
  draw();
})();
