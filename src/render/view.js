// Canvas drawing: space background, the well, locked cells, ghost and current
// piece, hold and next previews, then effects on top. Layout adapts to the
// screen: previews beside the well when there is room, above it on narrow screens.
import { COLS, HIDDEN, ROWS, VISIBLE, LOCK_DELAY } from '../config.js';
import { cellsOf } from '../core/pieces.js';
import { ghostY } from '../core/engine.js';
import { pieceCells } from '../core/board.js';
import { mulberry32 } from '../core/bag.js';
import { COLORS, colorOf, blockSprite, clearSprites, roundRect } from './palette.js';
import { drawEffects, shakeOffset } from './effects.js';

const cv = document.getElementById('cv'), g = cv.getContext('2d');
let W = 0, H = 0, dpr = 1, bg = null, twinkles = [];

/** Board origin (bx, by), cell size cs, preview boxes. All in CSS px. */
export const L = { cs: 24, bx: 0, by: 0, side: true, m: 16, hold: null, next: null, nextCount: 5 };

export function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  clearSprites();
  computeLayout();
  buildBackground();
}

function computeLayout() {
  const hud = document.getElementById('hud').getBoundingClientRect();
  const pad = document.getElementById('pad');
  const padH = getComputedStyle(pad).display === 'none' ? 0 : pad.getBoundingClientRect().height;
  const top = hud.bottom + 12, bottom = H - (padH ? padH + 6 : 16);
  const ah = Math.max(120, bottom - top), aw = Math.max(120, W - 32);
  const csSide = Math.floor(Math.min(ah / VISIBLE, aw / 21));
  const csTop = Math.floor(Math.min(ah / (VISIBLE + 3.4), aw / 10));
  L.side = csSide >= csTop;
  const cs = L.cs = Math.max(8, Math.min(40, L.side ? csSide : csTop));
  if (L.side) {
    const panelW = cs * 5, gap = cs * .5, total = cs * COLS + 2 * (panelW + gap);
    L.bx = Math.round((W - total) / 2 + panelW + gap);
    L.by = Math.round(top + (ah - VISIBLE * cs) / 2);
    L.m = cs * .7;
    L.nextCount = 5;
    L.hold = { x: L.bx - gap - panelW, y: L.by, w: panelW, h: cs * 4.2 };
    L.next = { x: L.bx + cs * COLS + gap, y: L.by, w: panelW, h: cs * (1.4 + 5 * 2.5) };
  } else {
    const strip = cs * 3.4, h = cs * 2.9;
    L.bx = Math.round((W - cs * COLS) / 2);
    L.by = Math.round(top + (ah - (VISIBLE * cs + strip)) / 2 + strip);
    L.m = cs * .5;
    L.nextCount = 3;
    L.hold = { x: L.bx, y: L.by - strip, w: cs * 2.6, h };
    L.next = { x: L.bx + cs * 2.9, y: L.by - strip, w: cs * 7.1, h };
  }
}

function buildBackground() {
  bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height;
  const b = bg.getContext('2d'); b.scale(dpr, dpr);
  const rnd = mulberry32(7);
  const grad = b.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0b0e33'); grad.addColorStop(1, '#05061a');
  b.fillStyle = grad; b.fillRect(0, 0, W, H);
  for (const c of ['#3fe4ff', '#9b7bff', '#ff5a6e', '#3ee0a1']) {
    const x = rnd() * W, y = rnd() * H, r = (.25 + rnd() * .35) * Math.max(W, H);
    const n = b.createRadialGradient(x, y, 0, x, y, r);
    n.addColorStop(0, c + '1c'); n.addColorStop(1, c + '00');
    b.fillStyle = n; b.fillRect(0, 0, W, H);
  }
  const count = Math.round(W * H / 5000);
  for (let i = 0; i < count; i++) {
    b.fillStyle = `rgba(255,255,255,${.15 + rnd() * .5})`;
    const s = rnd() < .9 ? 1 : 2;
    b.fillRect(rnd() * W, rnd() * H, s, s);
  }
  twinkles = Array.from({ length: Math.round(count / 6) }, () => ({ x: rnd() * W, y: rnd() * H, p: rnd() * 6.3, f: .6 + rnd() * 1.6, s: 1.5 + rnd() * 1.5 }));
}

const X = x => L.bx + x * L.cs;
const Y = y => L.by + (y - HIDDEN) * L.cs;

function cell(color, x, y, size = L.cs) {
  g.drawImage(blockSprite(color, size, dpr), x, y, size, size);
}

function drawWell(accent, danger, t) {
  const { bx, by, cs } = L, w = cs * COLS, h = cs * VISIBLE;
  g.save();
  g.shadowColor = accent; g.shadowBlur = cs * .9;
  roundRect(g, bx - 5, by - 5, w + 10, h + 10, 12);
  g.fillStyle = 'rgba(7,10,38,.92)'; g.fill();
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,.055)'; g.lineWidth = 1;
  g.beginPath();
  for (let x = 1; x < COLS; x++) { g.moveTo(bx + x * cs + .5, by); g.lineTo(bx + x * cs + .5, by + h); }
  for (let y = 1; y < VISIBLE; y++) { g.moveTo(bx, by + y * cs + .5); g.lineTo(bx + w, by + y * cs + .5); }
  g.stroke();
  g.strokeStyle = danger ? `rgba(255,90,90,${.55 + .35 * Math.sin(t * 9)})` : 'rgba(255,255,255,.2)';
  g.lineWidth = danger ? 3 : 2;
  roundRect(g, bx - 5, by - 5, w + 10, h + 10, 12); g.stroke();
}

function drawPanel(r, label) {
  roundRect(g, r.x, r.y, r.w, r.h, Math.min(12, L.cs * .4));
  g.fillStyle = 'rgba(18,22,63,.82)'; g.fill();
  g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#a9b0e6'; g.textBaseline = 'middle';
  if (L.side) { g.textAlign = 'center'; g.font = `${L.cs * .6}px Jua, sans-serif`; g.fillText(label, r.x + r.w / 2, r.y + L.cs * .75); }
  else { g.textAlign = 'left'; g.font = `${L.cs * .45}px Jua, sans-serif`; g.fillText(label, r.x + L.cs * .25, r.y + L.cs * .42); }
}

/** A piece in its spawn orientation, centred on (cx, cy), cell size m. */
function drawMini(type, cx, cy, m, alpha = 1) {
  const cells = cellsOf(type, 0);
  const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
  const w = Math.max(...xs) - Math.min(...xs) + 1, h = Math.max(...ys) - Math.min(...ys) + 1;
  const ox = cx - w * m / 2 - Math.min(...xs) * m, oy = cy - h * m / 2 - Math.min(...ys) * m;
  g.globalAlpha = alpha;
  for (const [x, y] of cells) cell(colorOf(type), ox + x * m, oy + y * m, m);
  g.globalAlpha = 1;
}

function drawPreviews(s) {
  const { cs, hold, next } = L;
  drawPanel(hold, '보관');
  drawPanel(next, '다음');
  if (L.side) {
    if (s.hold) drawMini(s.hold, hold.x + hold.w / 2, hold.y + cs * 2.6, L.m, s.holdUsed ? .35 : 1);
    s.queue.slice(0, L.nextCount).forEach((t, i) => {
      const m = i === 0 ? L.m * 1.12 : L.m;
      drawMini(t, next.x + next.w / 2, next.y + cs * (1.4 + 1.25 + i * 2.5), m, i === 0 ? 1 : .85);
    });
  } else {
    if (s.hold) drawMini(s.hold, hold.x + hold.w / 2, hold.y + cs * 1.75, L.m, s.holdUsed ? .35 : 1);
    const slot = (next.w - cs * .3) / L.nextCount;
    s.queue.slice(0, L.nextCount).forEach((t, i) => drawMini(t, next.x + cs * .15 + slot * (i + .5), next.y + cs * 1.75, L.m));
  }
}

/**
 * s: game state. opt: {accent, overT (seconds since the game ended, or -1), won}.
 * t: seconds, for animation.
 */
export function draw(s, opt, t) {
  if (!W || !H) return; // hidden or not laid out yet
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.drawImage(bg, 0, 0, W, H);
  for (const st of twinkles) {
    g.fillStyle = `rgba(255,255,255,${.25 + .6 * Math.abs(Math.sin(t * st.f + st.p))})`;
    g.fillRect(st.x, st.y, st.s, st.s);
  }
  if (!s) return;

  const [sx, sy] = shakeOffset();
  g.translate(sx, sy);

  let danger = false;
  for (let y = HIDDEN; y < HIDDEN + 4 && !danger; y++) danger = s.board[y].some(v => v);
  drawWell(opt.accent, danger && !s.over, t);

  // Locked cells; on a top-out they turn grey from the bottom up
  const greyRows = opt.overT >= 0 && !opt.won ? opt.overT * 28 : -1;
  for (let y = HIDDEN; y < ROWS; y++) {
    const grey = ROWS - 1 - y < greyRows;
    for (let x = 0; x < COLS; x++) {
      const v = s.board[y][x];
      if (v) cell(grey ? '#3b3f6b' : COLORS[v], X(x), Y(y));
    }
  }

  if (!s.over && s.cur) {
    const c = s.cur, gy = ghostY(s);
    const color = colorOf(c.type);
    g.lineWidth = 2; g.strokeStyle = color + 'aa'; g.fillStyle = color + '1f';
    for (const [x, y] of pieceCells({ ...c, y: gy })) {
      if (y < HIDDEN) continue;
      roundRect(g, X(x) + 2, Y(y) + 2, L.cs - 4, L.cs - 4, L.cs * .18); g.fill(); g.stroke();
    }
    // Dims slightly while the lock delay runs out
    g.globalAlpha = s.lockT > 0 ? 1 - .35 * (s.lockT / LOCK_DELAY) : 1;
    for (const [x, y] of pieceCells(c)) if (y >= HIDDEN) cell(color, X(x), Y(y));
    g.globalAlpha = 1;
  }

  drawEffects(g, L);
  drawPreviews(s);
}
