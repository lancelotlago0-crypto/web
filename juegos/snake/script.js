(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const msg = document.getElementById('msg');
  const startBtn = document.getElementById('start');

  const CELLS = 20;
  const SIZE = canvas.width / CELLS;
  const COLORS = { grid: '#223b4d', snake: '#7be0a4', head: '#c9ffe0', food: '#ff7a59' };

  let snake, dir, nextDir, food, score, timer, running;
  let best = 0;
  try { best = Number(localStorage.getItem('snake-best')) || 0; } catch (e) {}
  bestEl.textContent = best;

  function reset() {
    snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    dir = { x: 1, y: 0 };
    nextDir = dir;
    score = 0;
    scoreEl.textContent = 0;
    placeFood();
  }

  function placeFood() {
    do {
      food = { x: Math.floor(Math.random() * CELLS), y: Math.floor(Math.random() * CELLS) };
    } while (snake.some(s => s.x === food.x && s.y === food.y));
  }

  function start() {
    reset();
    overlay.classList.add('hidden');
    running = true;
    clearInterval(timer);
    timer = setInterval(tick, 120);
    draw();
  }

  function gameOver() {
    running = false;
    clearInterval(timer);
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      try { localStorage.setItem('snake-best', best); } catch (e) {}
    }
    msg.textContent = `Fin del juego. Puntos: ${score}`;
    startBtn.textContent = 'Jugar otra vez';
    overlay.classList.remove('hidden');
  }

  function tick() {
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    const hitWall = head.x < 0 || head.y < 0 || head.x >= CELLS || head.y >= CELLS;
    const hitSelf = snake.some(s => s.x === head.x && s.y === head.y);
    if (hitWall || hitSelf) return gameOver();

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score++;
      scoreEl.textContent = score;
      placeFood();
    } else {
      snake.pop();
    }
    draw();
  }

  function draw() {
    ctx.fillStyle = '#1b3040';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = COLORS.grid;
    for (let x = 0; x < CELLS; x++)
      for (let y = 0; y < CELLS; y++)
        if ((x + y) % 2 === 0) ctx.fillRect(x * SIZE, y * SIZE, SIZE, SIZE);

    ctx.fillStyle = COLORS.food;
    ctx.beginPath();
    ctx.arc(food.x * SIZE + SIZE / 2, food.y * SIZE + SIZE / 2, SIZE / 2 - 3, 0, Math.PI * 2);
    ctx.fill();

    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? COLORS.head : COLORS.snake;
      ctx.fillRect(s.x * SIZE + 1, s.y * SIZE + 1, SIZE - 2, SIZE - 2);
    });
  }

  function turn(name) {
    const dirs = {
      up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
      left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
    };
    const d = dirs[name];
    if (!d || !running) return;
    if (d.x === -dir.x && d.y === -dir.y) return; // no giro de 180°
    nextDir = d;
  }

  document.addEventListener('keydown', e => {
    const map = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right'
    };
    if (e.code === 'Space' && !running) { e.preventDefault(); start(); return; }
    const name = map[e.key];
    if (name) { e.preventDefault(); turn(name); }
  });

  document.querySelectorAll('.pad button').forEach(b =>
    b.addEventListener('click', () => turn(b.dataset.dir)));

  // Deslizar en pantalla táctil
  let touch = null;
  canvas.addEventListener('touchstart', e => {
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  canvas.addEventListener('touchend', e => {
    if (!touch) return;
    const dx = e.changedTouches[0].clientX - touch.x;
    const dy = e.changedTouches[0].clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 20) {
      turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    }
    touch = null;
  });

  startBtn.addEventListener('click', start);
  reset();
  draw();
})();
