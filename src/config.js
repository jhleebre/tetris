// Board size, timing and scoring constants. Pure values only (also used from Node).
export const COLS = 10;
export const ROWS = 22;        // 2 hidden rows above the visible 20
export const HIDDEN = 2;
export const VISIBLE = ROWS - HIDDEN;
export const NEXT_COUNT = 5;   // pieces shown in the "next" queue

// Input repeat (seconds): hold a direction for DAS, then repeat every ARR
export const DAS = 0.16;
export const ARR = 0.035;

// Locking: a grounded piece locks after LOCK_DELAY; moving/rotating resets it
// at most MAX_LOCK_RESETS times per row reached
export const LOCK_DELAY = 0.5;
export const MAX_LOCK_RESETS = 15;
export const SOFT_DROP_INTERVAL = 0.04; // seconds per row while soft dropping
export const MAX_LEVEL = 20;

// The usual speed curve, stretched by GRAVITY_EASE so it climbs more gently.
// Rows per second: level 1 → 1, 5 → 2.2, 10 → 8, 15 → 39 (1 would give 15.6 at 10).
export const GRAVITY_EASE = 0.8;
/** Seconds per row of gravity at a level. */
export const gravityInterval = level => {
  const l = 1 + (level - 1) * GRAVITY_EASE;
  return Math.pow(0.8 - (l - 1) * 0.007, l - 1);
};

// Points for 0..4 lines at once, multiplied by the level
export const LINE_SCORE = [0, 100, 300, 500, 800];
export const COMBO_SCORE = 50;    // × combo count × level
export const PERFECT_SCORE = 2000; // × level, when the board is empty after a clear
