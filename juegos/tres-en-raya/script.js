(() => {
  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const boardEl = document.getElementById('board');
  const msg = document.getElementById('msg');
  const sxEl = document.getElementById('sx');
  const soEl = document.getElementById('so');
  let cells, turn, over, sx = 0, so = 0;

  const mode = () => document.querySelector('input[name=mode]:checked').value;

  function newGame() {
    cells = Array(9).fill('');
    turn = 'X';
    over = false;
    boardEl.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const b = document.createElement('button');
      b.className = 'cell';
      b.setAttribute('aria-label', `Casilla ${i + 1}`);
      b.addEventListener('click', () => play(i));
      boardEl.appendChild(b);
    }
    msg.textContent = 'Turno de X';
  }

  function winner(c) {
    for (const l of LINES) if (c[l[0]] && c[l[0]] === c[l[1]] && c[l[0]] === c[l[2]]) return l;
    return null;
  }

  function play(i) {
    if (over || cells[i]) return;
    if (mode() === 'cpu' && turn === 'O') return;
    move(i);
    if (!over && mode() === 'cpu' && turn === 'O') setTimeout(cpuMove, 400);
  }

  function move(i) {
    cells[i] = turn;
    const b = boardEl.children[i];
    b.textContent = turn;
    b.classList.add(turn.toLowerCase());
    b.disabled = true;
    const line = winner(cells);
    if (line) {
      over = true;
      line.forEach(k => boardEl.children[k].classList.add('win'));
      msg.textContent = `¡Gana ${turn}!`;
      if (turn === 'X') sxEl.textContent = ++sx; else soEl.textContent = ++so;
      return;
    }
    if (cells.every(Boolean)) { over = true; msg.textContent = 'Empate'; return; }
    turn = turn === 'X' ? 'O' : 'X';
    msg.textContent = `Turno de ${turn}`;
  }

  function findLine(player) {
    for (const l of LINES) {
      const vals = l.map(k => cells[k]);
      if (vals.filter(v => v === player).length === 2 && vals.includes('')) return l[vals.indexOf('')];
    }
    return -1;
  }

  function cpuMove() {
    if (over) return;
    let i = findLine('O');
    if (i < 0) i = findLine('X');
    if (i < 0 && !cells[4]) i = 4;
    if (i < 0) {
      const free = cells.map((v, k) => v ? -1 : k).filter(k => k >= 0);
      i = free[Math.floor(Math.random() * free.length)];
    }
    move(i);
  }

  document.getElementById('restart').addEventListener('click', newGame);
  document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', newGame));
  newGame();
})();
