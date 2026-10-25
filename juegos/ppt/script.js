(() => {
  const $ = id => document.getElementById(id);
  const ICON = ['✊', '✋', '✌️'];
  const NAME = ['piedra', 'papel', 'tijera'];
  const WIN = 5;
  const mine = $('mine'), theirs = $('theirs'), msg = $('msg');
  const btns = [...document.querySelectorAll('.opciones button')];
  let me = 0, cpu = 0, tie = 0, busy = false, over = false;

  function setBtns(disabled) { btns.forEach(b => b.disabled = disabled); }

  function play(o) {
    if (busy || over) return;
    busy = true;
    setBtns(true);
    mine.className = 'mano sacude'; theirs.className = 'mano sacude';
    mine.textContent = '✊'; theirs.textContent = '✊';
    msg.textContent = '…';
    setTimeout(() => {
      const c = Math.floor(Math.random() * 3);
      mine.textContent = ICON[o]; theirs.textContent = ICON[c];
      mine.className = 'mano'; theirs.className = 'mano';
      if (o === c) {
        tie++; msg.textContent = `Empate: los dos sacaron ${NAME[o]}.`;
      } else if ((o + 1) % 3 === c) {
        // la mano de la máquina vence (papel>piedra, tijera>papel, piedra>tijera)
        cpu++; msg.textContent = `Pierdes: ${NAME[c]} gana a ${NAME[o]}.`;
        mine.classList.add('pierde'); theirs.classList.add('gana');
      } else {
        me++; msg.textContent = `¡Ganas! ${NAME[o]} gana a ${NAME[c]}.`;
        mine.classList.add('gana'); theirs.classList.add('pierde');
      }
      $('me').textContent = me; $('cpu').textContent = cpu; $('tie').textContent = tie;
      if (me >= WIN || cpu >= WIN) {
        over = true;
        msg.textContent = me >= WIN ? '🎉 ¡Ganaste la partida!' : 'La máquina gana la partida.';
      } else {
        setBtns(false);
      }
      busy = false;
    }, 550);
  }

  btns.forEach(b => b.addEventListener('click', () => play(Number(b.dataset.o))));

  $('reset').addEventListener('click', () => {
    me = cpu = tie = 0; busy = false; over = false;
    $('me').textContent = 0; $('cpu').textContent = 0; $('tie').textContent = 0;
    mine.textContent = '❔'; theirs.textContent = '❔';
    mine.className = 'mano'; theirs.className = 'mano';
    msg.textContent = 'Gana el primero en llegar a 5. Elige:';
    setBtns(false);
  });
})();
