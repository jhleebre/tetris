// Piece shapes, their four rotation states and wall kicks. Pure data, no DOM.
import { COLS } from '../config.js';

export const TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
export const GARBAGE = 8;                       // cell value for garbage rows
export const typeId = t => TYPES.indexOf(t) + 1; // cell value 1..7 for a piece type

// Spawn orientation inside each piece's bounding box
const SHAPES = {
  I: ['....', 'XXXX', '....', '....'],
  J: ['X..', 'XXX', '...'],
  L: ['..X', 'XXX', '...'],
  O: ['XX', 'XX'],
  S: ['.XX', 'XX.', '...'],
  T: ['.X.', 'XXX', '...'],
  Z: ['XX.', '.XX', '...'],
};

const rotateCW = m => m.map((_, r) => m.map((__, c) => m[m.length - 1 - c][r]));
const toCells = m => m.flatMap((row, y) => row.flatMap((v, x) => (v ? [[x, y]] : [])));

/** ROTATIONS[type][rot] = [[dx, dy], ...] inside the box (y grows downward). */
export const ROTATIONS = {};
const BOX = {};
for (const t of TYPES) {
  let m = SHAPES[t].map(r => [...r].map(ch => ch === 'X'));
  BOX[t] = m.length;
  ROTATIONS[t] = [];
  for (let i = 0; i < 4; i++) { ROTATIONS[t].push(toCells(m)); m = rotateCW(m); }
}

export const cellsOf = (type, rot) => ROTATIONS[type][rot];
export const spawnX = type => Math.floor((COLS - BOX[type]) / 2);

// Offsets tried in order when a rotation is blocked, keyed "fromto".
// Written with y up (the usual notation) and flipped below.
const KICKS_JLSTZ = {
  '01': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '10': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '12': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '21': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '23': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '32': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '30': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '03': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const KICKS_I = {
  '01': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '10': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '12': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '21': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '23': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '32': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '30': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '03': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};
const flip = tbl => Object.fromEntries(Object.entries(tbl).map(([k, v]) => [k, v.map(([x, y]) => [x, -y])]));
const KICKS = { I: flip(KICKS_I), other: flip(KICKS_JLSTZ) };
const NO_KICK = [[0, 0]];

export function kicks(type, from, to) {
  if (type === 'O') return NO_KICK;
  return (type === 'I' ? KICKS.I : KICKS.other)[`${from}${to}`];
}
