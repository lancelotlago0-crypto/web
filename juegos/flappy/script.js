(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const scoreEl = $('score'), bestEl = $('best'), overlay = $('overlay');
  const text = $('text'), startBtn = $('start'), muteBtn = $('mute');

  const W = 320, H = 480, GROUND = 64, BX = 92, R = 11;
  const G = 1500, FLAP = -430, PW = 56, SPACING = 190, STEP = 1 / 120;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // pantalla nítida en móviles de alta densidad
  const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 3);
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ---------- paleta del cielo: día → atardecer → noche ----------
  const PAL = [
    { top: [110, 198, 255], bot: [214, 240, 255], hill: [154, 208, 168], bld: [112, 170, 150] },
    { top: [255, 138, 90],  bot: [255, 222, 160], hill: [196, 120, 110], bld: [150, 90, 100] },
    { top: [11, 16, 48],    bot: [39, 52, 107],   hill: [26, 42, 85],    bld: [16, 26, 60] }
  ];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  function palette() {
    const i = Math.floor(skyT), f = skyT - i;
    const A = PAL[i % 3], B = PAL[(i + 1) % 3];
    const k = i % 3;
    return {
      top: mix(A.top, B.top, f), bot: mix(A.bot, B.bot, f),
      hill: mix(A.hill, B.hill, f), bld: mix(A.bld, B.bld, f),
      night: k === 2 ? 1 - f : k === 1 ? f : 0
    };
  }

  // ---------- decorado ----------
  const stars = Array.from({ length: 45 }, () => ({ x: Math.random() * W, y: Math.random() * (H - GROUND - 120), r: Math.random() < 0.2 ? 2 : 1 }));
  const clouds = Array.from({ length: 5 }, (_, i) => ({ x: i * 80 + Math.random() * 40, y: 40 + Math.random() * 150, s: 0.7 + Math.random() * 0.8 }));
  const buildings = []; let tileW = 0;
  while (tileW < 640) {
    const w = 18 + Math.floor(Math.random() * 18), h = 28 + Math.floor(Math.random() * 62);
    buildings.push({ w, h, x: tileW }); tileW += w + 2;
  }

  // ---------- sonido (WebAudio, sin archivos) ----------
  let actx = null, muted = false;
  try { muted = localStorage.getItem('flappy-mute') === '1'; } catch (e) {}
  muteBtn.textContent = muted ? '🔇' : '🔊';
  function audio() {
    if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) actx = new AC(); }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(f1, f2, dur, type, vol) {
    if (muted) return;
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(f1, t0); o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(a.destination); o.start(); o.stop(t0 + dur);
  }
  const sfx = {
    flap: () => tone(380, 640, 0.11, 'triangle', 0.14),
    score: () => { tone(660, 990, 0.12, 'square', 0.05); },
    hit: () => tone(240, 50, 0.32, 'sawtooth', 0.16),
    thud: () => tone(120, 40, 0.15, 'sine', 0.2)
  };

  // ---------- estado ----------
  let state = 'idle';                 // idle | ready | play | dying | over
  let bird, pipes, parts, score, scrollX = 0, skyT = 0, t = 0, wingT = 0;
  let shake = 0, flash = 0, pop = 0, landed = false, deadTimer = 0, flapAnim = 0;
  let last = 0, acc = 0, raf, newBest = false;
  let best = 0;
  try { best = Number(localStorage.getItem('flappy-best')) || 0; } catch (e) {}
  bestEl.textContent = best;

  const curGap = () => Math.max(112, 140 - score * 1.2);
  const curSpeed = () => 140 + Math.min(70, score * 2.5);

  function reset() {
    bird = { y: H / 2 - 30, vy: 0 };
    pipes = []; parts = []; score = 0; skyT = 0;
    landed = false; deadTimer = 0; newBest = false;
    scoreEl.textContent = 0;
  }

  function begin() {
    reset();
    state = 'ready';
    overlay.classList.add('hidden');
  }

  function puff(x, y, n, color, spd, g) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * spd;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.35 + Math.random() * 0.4, size: 2 + Math.random() * 3.5, color, g });
    }
  }

  function flap() {
    if (state === 'ready') state = 'play';
    if (state !== 'play') return;
    bird.vy = FLAP; flapAnim = 0.18;
    puff(BX - 8, bird.y + 6, 4, '255,255,255', 40, 60);
    sfx.flap();
  }

  function die() {
    state = 'dying';
    sfx.hit();
    shake = 0.35; flash = 0.65;
    puff(BX, bird.y, 22, '255,214,90', 190, 280);
    puff(BX, bird.y, 10, '255,255,255', 140, 200);
    bird.vy = -220;
    if (score > best) {
      best = score; newBest = true; bestEl.textContent = best;
      try { localStorage.setItem('flappy-best', best); } catch (e) {}
    }
  }

  function gameOver() {
    state = 'over';
    const medal = score >= 30 ? ' 🥇' : score >= 20 ? ' 🥈' : score >= 10 ? ' 🥉' : '';
    text.textContent = `Fin del juego\nPuntos: ${score}${medal}\n${newBest ? '¡Nuevo récord! 🎉' : 'Récord: ' + best}`;
    startBtn.textContent = 'Jugar otra vez';
    overlay.classList.remove('hidden');
  }

  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
    return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r;
  }
  function hitsPipe(p) {
    const top = p.gy - p.gap / 2, bot = p.gy + p.gap / 2;
    return circleRect(BX, bird.y, R, p.x, 0, PW, top - 18) || circleRect(BX, bird.y, R, p.x - 4, top - 18, PW + 8, 18) ||
           circleRect(BX, bird.y, R, p.x - 4, bot, PW + 8, 18) || circleRect(BX, bird.y, R, p.x, bot + 18, PW, H);
  }

  function spawnPipe() {
    const gap = curGap(), minY = 70 + gap / 2, maxY = H - GROUND - 60 - gap / 2;
    const prev = pipes[pipes.length - 1];
    const gy = prev ? clamp(prev.gy + (Math.random() - 0.5) * 240, minY, maxY)
                    : (minY + maxY) / 2 + (Math.random() - 0.5) * 100;
    pipes.push({ x: W + 10, gy, gap, passed: false });
  }

  // ---------- lógica (paso fijo) ----------
  function update(dt) {
    t += dt;
    skyT += (score / 8 - skyT) * Math.min(1, dt * 0.7);
    const speed = (state === 'play' || state === 'ready') ? curSpeed() : 0;
    scrollX += speed * dt;
    clouds.forEach(c => { c.x -= (6 + speed * 0.05) * c.s * dt; if (c.x < -70) { c.x = W + 30; c.y = 40 + Math.random() * 150; } });
    flapAnim = Math.max(0, flapAnim - dt);
    shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 1.8); pop = Math.max(0, pop - dt * 4);

    if (state === 'ready' || state === 'idle') {
      bird.y = H / 2 - 30 + Math.sin(t * 5) * 6; bird.vy = 0; wingT += dt * 10;
    } else if (state === 'play' || state === 'dying') {
      bird.vy += G * dt; bird.y += bird.vy * dt;
      if (state === 'play') wingT += dt * (flapAnim > 0 ? 30 : 8);

      if (state === 'play') {
        if (!pipes.length || pipes[pipes.length - 1].x < W - SPACING) spawnPipe();
        for (const p of pipes) {
          p.x -= speed * dt;
          if (!p.passed && p.x + PW < BX - R) {
            p.passed = true; score++; scoreEl.textContent = score; pop = 1; sfx.score();
            puff(BX, bird.y - 14, 5, '255,240,140', 70, 0);
          }
        }
        pipes = pipes.filter(p => p.x + PW > -12);
        if (pipes.some(hitsPipe)) die();
        if (bird.y - R < 0) { bird.y = R; bird.vy = Math.max(0, bird.vy); }
      }

      if (bird.y + R >= H - GROUND) {
        bird.y = H - GROUND - R;
        if (state === 'play') die();
        if (!landed) { landed = true; sfx.thud(); puff(BX, H - GROUND, 8, '220,184,119', 90, 200); bird.vy = 0; }
      }
      if (state === 'dying' && landed) { deadTimer += dt; if (deadTimer > 0.6) gameOver(); }
    }

    for (const p of parts) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; }
    parts = parts.filter(p => p.life < p.max);
  }

  // ---------- dibujo ----------
  function drawCloud(c, alpha) {
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    const s = c.s;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 14 * s, 0, Math.PI * 2);
    ctx.arc(c.x + 16 * s, c.y - 7 * s, 17 * s, 0, Math.PI * 2);
    ctx.arc(c.x + 34 * s, c.y, 13 * s, 0, Math.PI * 2);
    ctx.rect(c.x, c.y, 34 * s, 13 * s);
    ctx.fill();
  }

  function drawPipe(p) {
    const top = p.gy - p.gap / 2, bot = p.gy + p.gap / 2;
    const g = ctx.createLinearGradient(p.x, 0, p.x + PW, 0);
    g.addColorStop(0, '#3f9a45'); g.addColorStop(0.28, '#8fe27c'); g.addColorStop(0.6, '#5dbb5a'); g.addColorStop(1, '#2f7a36');
    ctx.fillStyle = g; ctx.strokeStyle = '#25602b'; ctx.lineWidth = 2;
    const capG = ctx.createLinearGradient(p.x - 4, 0, p.x + PW + 4, 0);
    capG.addColorStop(0, '#46a84c'); capG.addColorStop(0.28, '#a2ee8f'); capG.addColorStop(0.6, '#62c45f'); capG.addColorStop(1, '#31823a');
    // tubos
    ctx.fillRect(p.x, 0, PW, top - 18); ctx.strokeRect(p.x, -2, PW, top - 16);
    ctx.fillRect(p.x, bot + 18, PW, H); ctx.strokeRect(p.x, bot + 18, PW, H);
    // bordes (tapas)
    ctx.fillStyle = capG;
    ctx.fillRect(p.x - 4, top - 18, PW + 8, 18); ctx.strokeRect(p.x - 4, top - 18, PW + 8, 18);
    ctx.fillRect(p.x - 4, bot, PW + 8, 18); ctx.strokeRect(p.x - 4, bot, PW + 8, 18);
    // brillo
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fillRect(p.x + 8, 0, 5, top - 20); ctx.fillRect(p.x + 8, bot + 20, 5, H);
  }

  function drawBird(rot) {
    ctx.save();
    ctx.translate(BX, bird.y); ctx.rotate(rot);
    // sombra suave
    ctx.fillStyle = 'rgba(0,0,0,.15)';
    ctx.beginPath(); ctx.ellipse(1, R + 3, R, 3, 0, 0, Math.PI * 2); ctx.fill();
    // cuerpo
    const g = ctx.createLinearGradient(0, -R, 0, R);
    g.addColorStop(0, '#ffe680'); g.addColorStop(1, '#f2a93b');
    ctx.fillStyle = g; ctx.strokeStyle = '#7a4a10'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, R + 4, R + 1, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // barriga
    ctx.fillStyle = '#fff4c8';
    ctx.beginPath(); ctx.ellipse(-1, 5, R - 2, 5, 0, 0, Math.PI * 2); ctx.fill();
    // ala
    ctx.save();
    ctx.translate(-5, 1); ctx.rotate(Math.sin(wingT) * 0.9 - 0.2);
    ctx.fillStyle = '#ffd14d'; ctx.strokeStyle = '#7a4a10'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(-3, 2, 8, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    // ojo
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(7, -4, 4.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7a4a10'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#12202b'; ctx.beginPath(); ctx.arc(8.4, -4, 2.2, 0, Math.PI * 2); ctx.fill();
    // pico
    ctx.fillStyle = '#ff7a3a'; ctx.strokeStyle = '#8a3a10'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(R + 2, -1); ctx.lineTo(R + 11, 2); ctx.lineTo(R + 2, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function outlined(str, x, y, size) {
    ctx.font = `bold ${size}px "Trebuchet MS", sans-serif`;
    ctx.lineWidth = Math.max(4, size / 7); ctx.strokeStyle = '#12202b'; ctx.lineJoin = 'round';
    ctx.strokeText(str, x, y); ctx.fillStyle = '#fff'; ctx.fillText(str, x, y);
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 18 * shake, (Math.random() - 0.5) * 18 * shake);
    const pal = palette();

    const sky = ctx.createLinearGradient(0, 0, 0, H - GROUND);
    sky.addColorStop(0, rgb(pal.top)); sky.addColorStop(1, rgb(pal.bot));
    ctx.fillStyle = sky; ctx.fillRect(-12, -12, W + 24, H + 24);

    if (pal.night > 0.05) {
      ctx.fillStyle = `rgba(255,255,255,${pal.night * 0.9})`;
      stars.forEach(s => ctx.fillRect(s.x, s.y, s.r, s.r));
    }
    ctx.fillStyle = pal.night > 0.5 ? 'rgba(240,244,255,.95)' : 'rgba(255,244,170,.95)';
    ctx.beginPath(); ctx.arc(250, 92, 22, 0, Math.PI * 2); ctx.fill();
    clouds.forEach(c => drawCloud(c, 0.9 - pal.night * 0.55));

    // colinas lejanas
    ctx.fillStyle = rgb(pal.hill);
    ctx.beginPath(); ctx.moveTo(0, H - GROUND);
    for (let x = 0; x <= W; x += 8) {
      const wx = x + scrollX * 0.15;
      ctx.lineTo(x, H - GROUND - 34 - Math.sin(wx * 2 * Math.PI * 3 / 640) * 14 - Math.sin(wx * 2 * Math.PI * 7 / 640 + 1) * 6);
    }
    ctx.lineTo(W, H - GROUND); ctx.closePath(); ctx.fill();

    // edificios cercanos
    const off = (scrollX * 0.4) % tileW;
    ctx.fillStyle = rgb(pal.bld);
    for (let k = 0; k < 2; k++)
      buildings.forEach((b, bi) => {
        const bx = b.x - off + k * tileW;
        if (bx > W || bx + b.w < 0) return;
        ctx.fillStyle = rgb(pal.bld);
        ctx.fillRect(bx, H - GROUND - b.h, b.w, b.h);
        if (pal.night > 0.3) {
          ctx.fillStyle = `rgba(255,224,130,${pal.night * 0.8})`;
          for (let wy = 6; wy < b.h - 4; wy += 9)
            for (let wx = 4; wx < b.w - 4; wx += 7)
              if (((bi * 7 + wy * 3 + wx) % 5) < 2) ctx.fillRect(bx + wx, H - GROUND - b.h + wy, 3, 4);
        }
      });

    pipes.forEach(drawPipe);

    // suelo
    ctx.fillStyle = '#dcb877'; ctx.fillRect(0, H - GROUND, W, GROUND);
    ctx.fillStyle = '#cba860';
    for (let x = -((scrollX) % 24) - 24; x < W; x += 24) {
      ctx.beginPath(); ctx.moveTo(x, H - GROUND + 12); ctx.lineTo(x + 12, H - GROUND + 12);
      ctx.lineTo(x + 2, H); ctx.lineTo(x - 10, H); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#7ed957'; ctx.fillRect(0, H - GROUND, W, 12);
    ctx.fillStyle = '#4fa23a'; ctx.fillRect(0, H - GROUND, W, 3);
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, H - GROUND + 12, W, 3);

    // partículas
    for (const p of parts) {
      ctx.fillStyle = `rgba(${p.color},${Math.max(0, 1 - p.life / p.max)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - p.life / p.max * 0.5), 0, Math.PI * 2); ctx.fill();
    }

    drawBird(state === 'ready' || state === 'idle' ? Math.sin(t * 5) * 0.12 : clamp(bird.vy / 500, -0.45, 1.3));

    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (state === 'play' || state === 'dying') {
      ctx.save(); ctx.translate(W / 2, 74); ctx.scale(1 + pop * 0.25, 1 + pop * 0.25);
      outlined(String(score), 0, 0, 46);
      ctx.restore();
    } else if (state === 'ready') {
      ctx.globalAlpha = 0.65 + Math.sin(t * 4) * 0.35;
      outlined('TOCA PARA ALETEAR', W / 2, 300, 20);
      ctx.globalAlpha = 1;
    }

    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(-12, -12, W + 24, H + 24); }
    ctx.restore();
  }

  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000);
    last = ts; acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    draw();
    raf = requestAnimationFrame(loop);
  }

  // ---------- entrada ----------
  canvas.addEventListener('pointerdown', flap);
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      if (state === 'idle' || state === 'over') begin(); else flap();
    }
  });
  startBtn.addEventListener('click', begin);
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.textContent = muted ? '🔇' : '🔊';
    try { localStorage.setItem('flappy-mute', muted ? '1' : '0'); } catch (e) {}
    if (!muted) sfx.flap();
  });

  reset();
  last = performance.now();
  raf = requestAnimationFrame(loop);
})();
