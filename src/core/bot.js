// A simple placement bot: tries every rotation and column for the current
// piece, scores the resulting board, and plays the best one with ordinary
// move/rotate/drop calls. Drives the demo behind the menu, ?autoplay and tests.
import { COLS, ROWS } from '../config.js';
import { collides, place, fullRows, removeRows } from './board.js';
import { move, rotate, hardDrop } from './engine.js';

// Weights for height, cleared lines, holes and bumpiness (a well-known tuned set)
const W = { height: -0.510066, lines: 0.760666, holes: -0.35663, bump: -0.184483 };

function evaluate(b, lines) {
  let agg = 0, holes = 0, bump = 0, prev = -1;
  for (let x = 0; x < COLS; x++) {
    let y = 0;
    while (y < ROWS && !b[y][x]) y++;
    const h = ROWS - y;
    agg += h;
    for (let yy = y + 1; yy < ROWS; yy++) if (!b[yy][x]) holes++;
    if (prev >= 0) bump += Math.abs(h - prev);
    prev = h;
  }
  return W.height * agg + W.lines * lines + W.holes * holes + W.bump * bump;
}

/** Best {rot, x} for a piece type on this board, or null if nothing fits. */
export function bestPlacement(board, type) {
  let best = null;
  const rots = type === 'O' ? 1 : 4;
  for (let rot = 0; rot < rots; rot++) {
    for (let x = -2; x < COLS; x++) {
      if (collides(board, type, rot, x, 0)) continue;
      let y = 0;
      while (!collides(board, type, rot, x, y + 1)) y++;
      const b = board.map(r => r.slice());
      place(b, { type, rot, x, y });
      const rows = fullRows(b);
      removeRows(b, rows);
      const score = evaluate(b, rows.length);
      if (!best || score > best.score) best = { rot, x, score };
    }
  }
  return best;
}

/** delay: seconds between the bot's key presses. */
export const createPilot = delay => ({ delay, t: 0, plan: null, piece: -1 });

export function pilotStep(p, s, dt) {
  if (s.over) return;
  if (p.piece !== s.pieces || !p.plan) {
    p.plan = bestPlacement(s.board, s.cur.type) || { rot: s.cur.rot, x: s.cur.x };
    p.piece = s.pieces;
    p.t = 0;
  }
  p.t += dt;
  while (p.t >= p.delay && !s.over && p.piece === s.pieces) {
    p.t -= p.delay;
    act(p, s);
  }
}

function act(p, s) {
  const c = s.cur, plan = p.plan;
  if (c.rot !== plan.rot) {
    const diff = (plan.rot - c.rot + 4) % 4;
    if (rotate(s, diff === 3 ? -1 : 1)) return;
  } else if (c.x !== plan.x) {
    if (move(s, c.x < plan.x ? 1 : -1)) return;
  }
  hardDrop(s);
}
