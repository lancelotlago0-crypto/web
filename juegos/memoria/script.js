(() => {
  const EMOJIS = ['🍎', '🚀', '🐱', '🎈', '⚽', '🌵', '🎧', '🍕'];
  const grid = document.getElementById('grid');
  const movesEl = document.getElementById('moves');
  const bestEl = document.getElementById('best');
  const msg = document.getElementById('msg');
  let first = null, lock = false, moves = 0, found = 0;
  let best = null;
  try { best = Number(localStorage.getItem('memoria-best')) || null; } catch (e) {}
  bestEl.textContent = best ?? '-';

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function newGame() {
    grid.innerHTML = '';
    first = null; lock = false; moves = 0; found = 0;
    movesEl.textContent = 0;
    msg.textContent = 'Encuentra las 8 parejas.';
    shuffle([...EMOJIS, ...EMOJIS]).forEach(e => {
      const b = document.createElement('button');
      b.className = 'card';
      b.textContent = e;
      b.setAttribute('aria-label', 'Carta oculta');
      b.addEventListener('click', () => flip(b));
      grid.appendChild(b);
    });
  }

  function flip(card) {
    if (lock || card === first || card.classList.contains('done')) return;
    card.classList.add('open');
    if (!first) { first = card; return; }
    moves++;
    movesEl.textContent = moves;
    if (first.textContent === card.textContent) {
      first.classList.replace('open', 'done');
      card.classList.replace('open', 'done');
      first = null;
      if (++found === EMOJIS.length) win();
    } else {
      lock = true;
      setTimeout(() => {
        first.classList.remove('open');
        card.classList.remove('open');
        first = null; lock = false;
      }, 800);
    }
  }

  function win() {
    msg.textContent = `¡Lo lograste en ${moves} intentos!`;
    if (!best || moves < best) {
      best = moves;
      bestEl.textContent = best;
      try { localStorage.setItem('memoria-best', best); } catch (e) {}
    }
  }

  document.getElementById('restart').addEventListener('click', newGame);
  newGame();
})();
