// Game simulation: spawning, moving, rotating, gravity, locking, line clears,
// scoring and the end conditions of each mode. No DOM; results are reported
// through the `events` callbacks so rendering and sound stay outside.
//
// events (all optional):
//   spawn(piece) move() rotate() hold() hardDrop(cells, rows) lock(cells, type)
//   clear({rows, n, cells, combo, b2b, perfect, points}) level(lv)
//   over(reason) win(reason)
import {
  ROWS, HIDDEN, NEXT_COUNT, LOCK_DELAY, MAX_LOCK_RESETS, SOFT_DROP_INTERVAL, MAX_LEVEL,
  LINE_SCORE, COMBO_SCORE, PERFECT_SCORE, COLS, gravityInterval,
} from '../config.js';
import { GARBAGE, kicks, spawnX } from './pieces.js';
import { createBoard, collides, pieceCells, place, fullRows, removeRows } from './board.js';
import { mulberry32, createBag } from './bag.js';

const emit = (s, name, ...args) => { const f = s.ev[name]; if (f) f(...args); };

/** mode: entry from data/modes.js. seed: fixes the piece order (tests, replays). */
export function createGame(mode, seed = (Math.random() * 2 ** 32) >>> 0, events = {}) {
  const rng = mulberry32(seed);
  const s = {
    mode, seed, ev: events,
    board: createBoard(), next: createBag(rng), queue: [],
    cur: null, hold: null, holdUsed: false,
    level: mode.startLevel || 1, lines: 0, score: 0, combo: -1, b2b: false,
    time: 0, pieces: 0,
    gAcc: 0, lockT: 0, resets: 0, lowest: 0,
    over: false, won: false, reason: null,
    garbageLeft: 0,
  };
  if (mode.garbage) addGarbage(s, mode.garbage, rng);
  while (s.queue.length < NEXT_COUNT) s.queue.push(s.next());
  spawnNext(s);
  return s;
}

// Bottom rows filled with garbage, one hole each (never in the same column twice in a row)
function addGarbage(s, n, rng) {
  let prev = -1;
  for (let i = 0; i < n; i++) {
    let hole;
    do hole = Math.floor(rng() * COLS); while (hole === prev);
    prev = hole;
    s.board[ROWS - 1 - i] = Array.from({ length: COLS }, (_, x) => (x === hole ? 0 : GARBAGE));
  }
  s.garbageLeft = n;
}

function end(s, won, reason) {
  if (s.over) return;
  s.over = true; s.won = won; s.reason = reason;
  emit(s, won ? 'win' : 'over', reason);
}

function spawn(s, type) {
  const p = { type, rot: 0, x: spawnX(type), y: 0 };
  s.cur = p; s.gAcc = 0; s.lockT = 0; s.resets = 0;
  if (collides(s.board, type, 0, p.x, p.y)) return end(s, false, 'top');
  if (!collides(s.board, type, 0, p.x, 1)) p.y = 1; // drop into view right away
  s.lowest = p.y;
  emit(s, 'spawn', p);
}

function spawnNext(s) {
  const t = s.queue.shift();
  s.queue.push(s.next());
  spawn(s, t);
}

export const canFall = s => !collides(s.board, s.cur.type, s.cur.rot, s.cur.x, s.cur.y + 1);

/** Row the current piece would land on. */
export function ghostY(s) {
  const c = s.cur;
  let y = c.y;
  while (!collides(s.board, c.type, c.rot, c.x, y + 1)) y++;
  return y;
}

// A successful move or rotation on the ground buys more time, up to a limit
function afterShift(s) {
  if (!canFall(s) && s.resets < MAX_LOCK_RESETS) { s.lockT = 0; s.resets++; }
}

function fall(s) {
  s.cur.y++;
  s.lockT = 0;
  if (s.cur.y > s.lowest) { s.lowest = s.cur.y; s.resets = 0; }
}

export function move(s, dx) {
  if (s.over) return false;
  const c = s.cur;
  if (collides(s.board, c.type, c.rot, c.x + dx, c.y)) return false;
  c.x += dx;
  afterShift(s);
  emit(s, 'move');
  return true;
}

/** dir: 1 clockwise, -1 counter-clockwise. */
export function rotate(s, dir) {
  if (s.over) return false;
  const c = s.cur, to = (c.rot + dir + 4) % 4;
  for (const [kx, ky] of kicks(c.type, c.rot, to)) {
    if (!collides(s.board, c.type, to, c.x + kx, c.y + ky)) {
      c.x += kx; c.y += ky; c.rot = to;
      if (c.y > s.lowest) { s.lowest = c.y; s.resets = 0; }
      afterShift(s);
      emit(s, 'rotate');
      return true;
    }
  }
  return false;
}

export function hardDrop(s) {
  if (s.over) return;
  let d = 0;
  while (canFall(s)) { s.cur.y++; d++; }
  s.score += 2 * d;
  emit(s, 'hardDrop', pieceCells(s.cur), d);
  lock(s);
}

/** Swaps the current piece with the held one (once per piece). */
export function holdPiece(s) {
  if (s.over || s.holdUsed) return false;
  const t = s.cur.type, h = s.hold;
  s.hold = t;
  if (h) spawn(s, h); else spawnNext(s);
  s.holdUsed = true;
  emit(s, 'hold');
  return true;
}

/** Advances time: gravity, soft drop, lock delay, time limit. */
export function tick(s, dt, soft = false) {
  if (s.over) return;
  s.time += dt;
  if (s.mode.timeLimit && s.time >= s.mode.timeLimit) {
    s.time = s.mode.timeLimit;
    return end(s, true, 'time');
  }
  const g = gravityInterval(s.level);
  const interval = soft ? Math.min(g, SOFT_DROP_INTERVAL) : g;
  s.gAcc += dt;
  for (let n = 0; s.gAcc >= interval && n < ROWS; n++) {
    if (!canFall(s)) { s.gAcc = 0; break; }
    s.gAcc -= interval;
    fall(s);
    if (soft) s.score += 1;
  }
  if (!canFall(s)) {
    s.lockT += dt;
    if (s.lockT >= LOCK_DELAY) lock(s);
  }
}

function lock(s) {
  const p = s.cur, cells = pieceCells(p);
  place(s.board, p);
  if (cells.every(([, y]) => y < HIDDEN)) return end(s, false, 'top'); // locked entirely above the well
  s.pieces++;
  s.holdUsed = false;
  emit(s, 'lock', cells, p.type);

  const rows = fullRows(s.board), n = rows.length;
  if (n) {
    const cleared = rows.flatMap(y => s.board[y].map((v, x) => [x, y, v]));
    removeRows(s.board, rows);
    s.combo++;
    const four = n === 4, b2b = four && s.b2b;
    let pts = LINE_SCORE[n] * s.level;
    if (b2b) pts = Math.floor(pts * 1.5);
    if (s.combo > 0) pts += COMBO_SCORE * s.combo * s.level;
    const perfect = s.board.every(r => r.every(v => !v));
    if (perfect) pts += PERFECT_SCORE * s.level;
    s.b2b = four;
    s.score += pts;
    s.lines += n;
    emit(s, 'clear', { rows, n, cells: cleared, combo: s.combo, b2b, perfect, points: pts });

    if (s.mode.levelUp) {
      const lv = Math.min(MAX_LEVEL, (s.mode.startLevel || 1) + Math.floor(s.lines / 10));
      if (lv > s.level) { s.level = lv; emit(s, 'level', lv); }
    }
    if (s.mode.garbage) {
      s.garbageLeft = s.board.filter(r => r.includes(GARBAGE)).length;
      if (!s.garbageLeft) return end(s, true, 'clean');
    }
    if (s.mode.goalLines && s.lines >= s.mode.goalLines) return end(s, true, 'goal');
  } else s.combo = -1;

  spawnNext(s);
}
