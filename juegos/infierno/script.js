(() => {
  const W = 320, H = 200, FOV = Math.PI / 3;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const hpEl = document.getElementById('hp');
  const leftEl = document.getElementById('left');
  const overlay = document.getElementById('overlay');
  const text = document.getElementById('text');
  const startBtn = document.getElementById('start');

  const MAP = [
    '1111111111111111',
    '1000000000000001',
    '1011101110111101',
    '1010000000100001',
    '1010111110101101',
    '1000100000001001',
    '1110101111101011',
    '1000100000100001',
    '1011111010111101',
    '1000000010000001',
    '1011101110101101',
    '1010000000100001',
    '1010111111101001',
    '1000000000001001',
    '1000000000000001',
    '1111111111111111'
  ];
  const MW = 16, MH = 16;
  const SPAWNS = [[7.5,1.5],[13.5,3.5],[5.5,5.5],[9.5,7.5],[13.5,9.5],[3.5,13.5],[11.5,14.5],[1.5,9.5]];

  const wallAt = (x, y) => {
    const mx = Math.floor(x), my = Math.floor(y);
    return mx < 0 || my < 0 || mx >= MW || my >= MH || MAP[my][mx] !== '0';
  };
  const norm = a => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;

  let p, enemies, state = 'idle', last = 0, fireCd = 0, flash = 0, hurt = 0, bob = 0, raf;
  const keys = {};
  const zbuf = new Float32Array(W);

  const floorGrad = ctx.createLinearGradient(0, H / 2, 0, H);
  floorGrad.addColorStop(0, '#1c1c1c');
  floorGrad.addColorStop(1, '#4a4038');

  function castRay(ox, oy, ang) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let mx = Math.floor(ox), my = Math.floor(oy);
    const ddx = Math.abs(1 / dx), ddy = Math.abs(1 / dy);
    let sx, sy, sdx, sdy;
    if (dx < 0) { sx = -1; sdx = (ox - mx) * ddx; } else { sx = 1; sdx = (mx + 1 - ox) * ddx; }
    if (dy < 0) { sy = -1; sdy = (oy - my) * ddy; } else { sy = 1; sdy = (my + 1 - oy) * ddy; }
    let side = 0, dist = 0;
    for (let i = 0; i < 64; i++) {
      if (sdx < sdy) { dist = sdx; sdx += ddx; mx += sx; side = 0; }
      else { dist = sdy; sdy += ddy; my += sy; side = 1; }
      if (mx < 0 || my < 0 || mx >= MW || my >= MH || MAP[my][mx] !== '0') break;
    }
    const wx = side === 0 ? oy + dist * dy : ox + dist * dx;
    return { dist, side, frac: wx - Math.floor(wx) };
  }

  function reset() {
    p = { x: 1.5, y: 1.5, a: 0, hp: 100 };
    enemies = SPAWNS.map(([x, y]) => ({ x, y, hp: 3, alive: true, alert: false, cd: 0.5, hurt: 0 }));
    fireCd = 0; flash = 0; hurt = 0;
    updateHud();
  }

  function updateHud() {
    hpEl.textContent = Math.max(0, Math.round(p.hp));
    leftEl.textContent = enemies.filter(e => e.alive).length;
  }

  function start() {
    reset();
    state = 'play';
    overlay.classList.add('hidden');
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function finish(win) {
    state = win ? 'won' : 'dead';
    text.textContent = win ? '¡Victoria! Has limpiado el laberinto.' : 'Los demonios te han atrapado.';
    startBtn.textContent = 'Jugar otra vez';
    overlay.classList.remove('hidden');
  }

  function fire() {
    if (state !== 'play' || fireCd > 0) return;
    fireCd = 0.4; flash = 0.08;
    const wall = castRay(p.x, p.y, p.a).dist;
    let best = null, bd = 1e9;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      const ang = norm(Math.atan2(dy, dx) - p.a);
      if (Math.abs(ang) < Math.atan(0.3 / d) && d < wall && d < bd) { best = e; bd = d; }
    }
    if (best) {
      best.hp -= 1 + Math.floor(Math.random() * 2);
      best.hurt = 0.15; best.alert = true;
      if (best.hp <= 0) best.alive = false;
      updateHud();
      if (!enemies.some(e => e.alive)) finish(true);
    }
  }

  function update(dt) {
    const turn = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    p.a += turn * 2.2 * dt;
    const mv = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
    if (mv) {
      const nx = p.x + Math.cos(p.a) * mv * 3 * dt;
      const ny = p.y + Math.sin(p.a) * mv * 3 * dt;
      const m = 0.2 * Math.sign(mv);
      if (!wallAt(nx + Math.cos(p.a) * m, p.y)) p.x = nx;
      if (!wallAt(p.x, ny + Math.sin(p.a) * m)) p.y = ny;
      bob += dt * 9;
    }
    if (keys.fire) fire();
    fireCd -= dt; flash -= dt; hurt = Math.max(0, hurt - dt);

    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
      e.hurt -= dt;
      if (!e.alert && d < 9 && castRay(e.x, e.y, Math.atan2(dy, dx)).dist > d) e.alert = true;
      if (!e.alert) continue;
      if (d > 0.8) {
        const nx = e.x + dx / d * 1.1 * dt, ny = e.y + dy / d * 1.1 * dt;
        if (!wallAt(nx, e.y)) e.x = nx;
        if (!wallAt(e.x, ny)) e.y = ny;
      }
      e.cd -= dt;
      if (d < 1.0 && e.cd <= 0) {
        e.cd = 1;
        p.hp -= 8 + Math.floor(Math.random() * 6);
        hurt = 0.5;
        updateHud();
        if (p.hp <= 0) finish(false);
      }
    }
  }

  function draw() {
    ctx.fillStyle = '#2b1717';
    ctx.fillRect(0, 0, W, H / 2);
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, H / 2, W, H / 2);

    for (let c = 0; c < W; c++) {
      const ang = p.a + (c / W - 0.5) * FOV;
      const r = castRay(p.x, p.y, ang);
      const perp = Math.max(0.05, r.dist * Math.cos(ang - p.a));
      zbuf[c] = perp;
      const h = Math.min(H * 3, H / perp);
      let shade = Math.max(0.15, 1 - perp / 10) * (r.side ? 0.72 : 1);
      if (r.frac % 0.25 < 0.03) shade *= 0.7;
      ctx.fillStyle = `rgb(${150 * shade | 0},${62 * shade | 0},${52 * shade | 0})`;
      ctx.fillRect(c, (H - h) / 2, 1, h);
    }

    const list = enemies.filter(e => e.alive)
      .map(e => ({ e, d: Math.hypot(e.x - p.x, e.y - p.y) }))
      .sort((a, b) => b.d - a.d);
    for (const { e, d } of list) {
      const ang = norm(Math.atan2(e.y - p.y, e.x - p.x) - p.a);
      if (Math.abs(ang) > FOV / 2 + 0.4) continue;
      const perp = d * Math.cos(ang);
      if (perp < 0.2) continue;
      const size = H / perp;
      const cx = (ang / FOV + 0.5) * W;
      const x0 = cx - size / 2;
      const top = H / 2 - size * 0.35, sh = size * 0.85;
      const f = Math.max(0.25, 1 - perp / 11);
      const body = e.hurt > 0 ? `rgb(255,230,230)` : `rgb(${190 * f | 0},${30 * f | 0},${30 * f | 0})`;
      const eyes = `rgb(${255 * f | 0},${220 * f | 0},0)`;
      for (let sx = Math.max(0, Math.floor(x0)); sx < Math.min(W, Math.ceil(x0 + size)); sx++) {
        if (perp >= zbuf[sx]) continue;
        const u = (sx - x0) / size;
        ctx.fillStyle = body;
        if (u > 0.2 && u < 0.8) ctx.fillRect(sx, top + sh * 0.3, 1, sh * 0.7);
        if (u > 0.3 && u < 0.7) ctx.fillRect(sx, top, 1, sh * 0.35);
        if ((u > 0.05 && u < 0.2) || (u > 0.8 && u < 0.95)) ctx.fillRect(sx, top + sh * 0.35, 1, sh * 0.4);
        if ((u > 0.38 && u < 0.47) || (u > 0.53 && u < 0.62)) {
          ctx.fillStyle = eyes;
          ctx.fillRect(sx, top + sh * 0.1, 1, sh * 0.08);
        }
      }
    }

    // arma
    const by = Math.sin(bob) * 2;
    ctx.fillStyle = '#555'; ctx.fillRect(W / 2 - 5, H - 58 + by, 10, 38);
    ctx.fillStyle = '#888'; ctx.fillRect(W / 2 - 3, H - 58 + by, 6, 30);
    ctx.fillStyle = '#c9a27a'; ctx.fillRect(W / 2 - 14, H - 24 + by, 28, 24);
    if (flash > 0) {
      ctx.fillStyle = '#ffe36b';
      ctx.fillRect(W / 2 - 8, H - 74 + by, 16, 16);
      ctx.fillStyle = '#fff';
      ctx.fillRect(W / 2 - 4, H - 70 + by, 8, 8);
    }
    // mira
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.fillRect(W / 2 - 4, H / 2, 3, 1); ctx.fillRect(W / 2 + 1, H / 2, 3, 1);
    ctx.fillRect(W / 2 - 1, H / 2 - 4, 1, 3); ctx.fillRect(W / 2 - 1, H / 2 + 2, 1, 3);

    if (hurt > 0) {
      ctx.fillStyle = `rgba(200,0,0,${hurt * 0.6})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function loop(t) {
    if (state !== 'play') { draw(); return; }
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    update(dt);
    draw();
    if (state === 'play') raf = requestAnimationFrame(loop);
    else draw();
  }

  const KEYMAP = {
    w: 'up', W: 'up', ArrowUp: 'up', s: 'down', S: 'down', ArrowDown: 'down',
    a: 'left', A: 'left', ArrowLeft: 'left', d: 'right', D: 'right', ArrowRight: 'right', ' ': 'fire'
  };
  document.addEventListener('keydown', e => {
    const k = KEYMAP[e.key];
    if (!k) return;
    e.preventDefault();
    if (k === 'fire' && state !== 'play') { start(); return; }
    keys[k] = true;
  });
  document.addEventListener('keyup', e => { const k = KEYMAP[e.key]; if (k) keys[k] = false; });

  document.querySelectorAll('.pad button').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = true; });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => keys[k] = false));
  });
  canvas.addEventListener('pointerdown', fire);
  startBtn.addEventListener('click', start);

  reset();
  draw();
})();
