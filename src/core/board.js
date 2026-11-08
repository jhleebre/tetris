// The well: ROWS × COLS grid of cell values (0 empty, 1..7 piece, 8 garbage).
import { COLS, ROWS } from '../config.js';
import { cellsOf, typeId } from './pieces.js';

export const emptyRow = () => new Array(COLS).fill(0);
export const createBoard = () => Array.from({ length: ROWS }, emptyRow);

/** True when the piece would overlap a wall, the floor or a filled cell. */
export function collides(board, type, rot, x, y) {
  for (const [cx, cy] of cellsOf(type, rot)) {
    const bx = x + cx, by = y + cy;
    if (bx < 0 || bx >= COLS || by >= ROWS) return true;
    if (by >= 0 && board[by][bx]) return true;
  }
  return false;
}

/** Absolute [x, y] cells of a piece {type, rot, x, y}. */
export const pieceCells = p => cellsOf(p.type, p.rot).map(([cx, cy]) => [p.x + cx, p.y + cy]);

export function place(board, p) {
  const id = typeId(p.type);
  for (const [x, y] of pieceCells(p)) if (y >= 0) board[y][x] = id;
}

export const fullRows = board => board.flatMap((row, y) => (row.every(v => v) ? [y] : []));

/** Removes the given rows (ascending) and adds empty rows on top. */
export function removeRows(board, rows) {
  for (let i = rows.length - 1; i >= 0; i--) board.splice(rows[i], 1);
  for (let i = 0; i < rows.length; i++) board.unshift(emptyRow());
}
