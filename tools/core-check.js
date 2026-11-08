// Checks for the pure game logic: rotations, kicks, line clears, scoring,
// hold, the bag, and that the bot can finish every mode with ordinary inputs
// (so each mode is winnable). Run from Node (check-core.mjs) or the browser
// (check-core.html). Returns the number of failed checks.
import { COLS, ROWS } from '../src/config.js';
import { TYPES, ROTATIONS } from '../src/core/pieces.js';
import { createGame, move, rotate, hardDrop, holdPiece, tick } from '../src/core/engine.js';
import { createPilot, pilotStep } from '../src/core/bot.js';
import { MODES } from '../src/data/modes.js';

export function runChecks(log = console.log) {
  let failed = 0;
  const check = (name, ok, info = '') => {
    log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? '  ' + info : ''}`, ok);
    if (!ok) failed++;
  };
  const mode = id => MODES.find(m => m.id === id);
  const key = cells => cells.map(c => c.join(',')).sort().join(' ');

  // Shapes: 4 cells each, 4 rotations that come back to the start
  for (const t of TYPES) {
    const r = ROTATIONS[t];
    check(`${t} has 4 cells in every rotation`, r.every(c => c.length === 4));
  }
  check('T rotation R points right', key(ROTATIONS.T[1]) === key([[1, 0], [1, 1], [2, 1], [1, 2]]));

  // Bag: every group of 7 is a permutation
  {
    const s = createGame(mode('sprint'), 42);
    const seq = [s.cur.type, ...s.queue];
    for (let i = 0; i < 15; i++) { hardDrop(s); seq.push(s.queue[s.queue.length - 1]); }
    const okBag = [0, 7].every(i => new Set(seq.slice(i, i + 7)).size === 7);
    check('7-bag gives each piece once per bag', okBag, seq.slice(0, 14).join(''));
  }

  // Wall kick: vertical I against the right wall rotates back to flat
  {
    const s = createGame(mode('sprint'), 1);
    s.cur = { type: 'I', rot: 0, x: 3, y: 5 };
    rotate(s, 1);
    while (move(s, 1));
    const before = s.cur.x;
    const ok = rotate(s, 1);
    check('I kicks off the right wall', ok && s.cur.x < before, `x ${before} -> ${s.cur.x}`);
  }

  // Four lines at once with an I piece in the right column
  {
    const s = createGame(mode('marathon'), 7);
    for (let y = ROWS - 4; y < ROWS; y++) for (let x = 0; x < COLS - 1; x++) s.board[y][x] = 8;
    s.cur = { type: 'I', rot: 0, x: 3, y: 1 };
    rotate(s, 1);
    while (move(s, 1));
    let clear = null;
    s.ev.clear = c => { clear = c; };
    const before = s.score;
    hardDrop(s);
    check('I clears four lines', clear && clear.n === 4 && s.lines === 4);
    check('four lines on an emptied board score 800 + 2000 perfect bonus', clear && clear.perfect && clear.points === 2800, `+${clear && clear.points}`);
    check('hard drop adds 2 points per row', (s.score - before - 2800) % 2 === 0 && s.score - before > 2800);
    check('board is empty after the clear', s.board.every(r => r.every(v => !v)));
  }

  // Hold: once per piece
  {
    const s = createGame(mode('sprint'), 3);
    const first = s.cur.type, second = s.queue[0];
    check('hold takes the current piece', holdPiece(s) && s.hold === first && s.cur.type === second);
    check('second hold in a row is refused', !holdPiece(s));
    hardDrop(s);
    check('hold works again after locking', holdPiece(s) && s.cur.type === first);
  }

  // Lock delay: a grounded piece locks on its own
  {
    const s = createGame(mode('sprint'), 5);
    let t = 0;
    while (s.pieces === 0 && t < 30) { tick(s, 1 / 60); t += 1 / 60; }
    check('gravity + lock delay locks the first piece', s.pieces === 1, `${t.toFixed(2)}s`);
  }

  // Time limit
  {
    const s = createGame(mode('ultra'), 9);
    let reason = null;
    s.ev.win = r => { reason = r; };
    const p = createPilot(0.05);
    for (let i = 0; i < 125 * 60 && !s.over; i++) { pilotStep(p, s, 1 / 60); tick(s, 1 / 60); }
    check('2-minute mode ends on time', reason === 'time' && s.won, `score ${s.score}, lines ${s.lines}`);
  }

  // The bot finishes each goal mode at 60 fps with real gravity
  function botRun(id, seed, maxSec, delay = 0.03) {
    const s = createGame(mode(id), seed);
    const p = createPilot(delay);
    for (let i = 0; i < maxSec * 60 && !s.over; i++) { pilotStep(p, s, 1 / 60); tick(s, 1 / 60); }
    return s;
  }
  for (const seed of [1, 2, 3]) {
    const s = botRun('sprint', seed, 600);
    check(`bot finishes 40 lines (seed ${seed})`, s.won, `${s.time.toFixed(1)}s, ${s.pieces} pieces`);
    const d = botRun('dig', seed, 600);
    check(`bot clears the garbage (seed ${seed})`, d.won, `${d.time.toFixed(1)}s, ${d.pieces} pieces`);
  }
  {
    const s = botRun('marathon', 11, 3000, 0.015);
    check('bot gets far in marathon', s.lines >= 60, `${s.lines} lines, level ${s.level}, ${s.won ? 'won' : s.reason}`);
  }

  log(failed ? `${failed} check(s) failed` : 'all checks passed', !failed);
  return failed;
}
