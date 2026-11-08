// Short-lived visual effects in board cell coordinates: line-clear flashes and
// sparks, hard-drop streaks, lock flashes, floating text and screen shake.
// view.js converts cell coordinates to pixels through the layout passed in.
import { HIDDEN } from '../config.js';
import { COLORS } from './palette.js';

const parts = [], flashes = [], streaks = [], locks = [], texts = [];
let shakeT = 0, shakeAmp = 0;

const CLEAR_NAMES = ['', '한 줄', '두 줄', '세 줄', '네 줄!'];

export const fx = {
  /** light: the 10-row ↓ drop (fainter, no shake). */
  drop(cells, d, light = false) {
    if (d < 1) return;
    const top = {};
    for (const [x, y] of cells) if (top[x] === undefined || y < top[x]) top[x] = y;
    for (const x in top) streaks.push({ x: +x, y0: top[x] - d, y1: top[x], t: 0, life: light ? .16 : .22, a: light ? .18 : .35 });
    if (light) return;
    for (const [x, y] of cells) for (let i = 0; i < 2; i++) {
      parts.push({ x: x + Math.random(), y: y + 1, vx: (Math.random() - .5) * 4, vy: -Math.random() * 3, t: 0, life: .35, c: '#ffffff', r: .07 });
    }
    shake(Math.min(4, 1 + d * .15), .12);
  },
  lock(cells) { locks.push({ cells, t: 0, life: .16 }); },
  clear(info) {
    for (const y of info.rows) flashes.push({ y, t: 0, life: .35 });
    for (const [x, y, v] of info.cells) for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 7;
      parts.push({ x: x + .5, y: y + .5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, t: 0, life: .6 + Math.random() * .4, c: COLORS[v] || '#fff', r: .1 + Math.random() * .08 });
    }
    const y = info.rows[0];
    const label = info.perfect ? '완벽 정리!' : info.b2b ? '연속 네 줄!' : CLEAR_NAMES[info.n];
    const sub = [info.combo > 0 ? `${info.combo} 콤보` : '', `+${info.points.toLocaleString('ko-KR')}`].filter(Boolean).join('  ');
    texts.push({ text: label, sub, y, t: 0, life: 1.1, big: info.n === 4 || info.perfect });
    if (info.n === 4 || info.perfect) shake(9, .35);
    else if (info.n >= 2) shake(3, .15);
  },
};

// A stronger shake replaces a weaker one that is still running
function shake(amp, dur) { if (shakeT <= 0 || amp >= shakeAmp) { shakeAmp = amp; shakeT = dur; } }

export function shakeOffset() {
  if (shakeT <= 0) return [0, 0];
  const a = shakeAmp * Math.min(1, shakeT * 6);
  return [(Math.random() - .5) * 2 * a, (Math.random() - .5) * 2 * a];
}

export function clearEffects() {
  parts.length = flashes.length = streaks.length = locks.length = texts.length = 0;
  shakeT = 0;
}

const age = (list, dt) => {
  for (let i = list.length - 1; i >= 0; i--) { list[i].t += dt; if (list[i].t >= list[i].life) list.splice(i, 1); }
};

export function updateEffects(dt) {
  shakeT = Math.max(0, shakeT - dt);
  for (const p of parts) { p.vy += 18 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  [parts, flashes, streaks, locks, texts].forEach(l => age(l, dt));
}

/** L: layout {bx, by, cs} (board origin and cell size in CSS px). */
export function drawEffects(g, L) {
  const X = x => L.bx + x * L.cs, Y = y => L.by + (y - HIDDEN) * L.cs, cs = L.cs;
  const W = cs * 10;

  for (const s of streaks) {
    const k = 1 - s.t / s.life, y0 = Math.max(HIDDEN, s.y0);
    const grad = g.createLinearGradient(0, Y(y0), 0, Y(s.y1));
    grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(1, `rgba(255,255,255,${s.a * k})`);
    g.fillStyle = grad;
    g.fillRect(X(s.x) + cs * .15, Y(y0), cs * .7, Y(s.y1) - Y(y0));
  }
  for (const l of locks) {
    g.fillStyle = `rgba(255,255,255,${.5 * (1 - l.t / l.life)})`;
    for (const [x, y] of l.cells) if (y >= HIDDEN) g.fillRect(X(x) + 1, Y(y) + 1, cs - 2, cs - 2);
  }
  for (const f of flashes) {
    const k = 1 - f.t / f.life, grow = (1 - k) * cs * .4;
    g.fillStyle = `rgba(255,255,255,${.85 * k})`;
    g.fillRect(L.bx, Y(f.y) - grow / 2, W, cs + grow);
  }
  for (const p of parts) {
    const k = 1 - p.t / p.life;
    g.globalAlpha = k; g.fillStyle = p.c;
    g.beginPath(); g.arc(X(p.x), Y(p.y), Math.max(1, p.r * cs * (.5 + k * .5)), 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const t of texts) {
    const k = t.t / t.life, a = k < .7 ? 1 : 1 - (k - .7) / .3;
    const y = Y(Math.max(t.y, HIDDEN + 1.5)) - k * cs * 1.6, x = L.bx + W / 2;
    const size = cs * (t.big ? 1.25 : .95) * (k < .1 ? .7 + k * 3 : 1);
    g.globalAlpha = a;
    g.font = `${size}px Jua, sans-serif`;
    g.lineWidth = Math.max(3, cs * .18); g.strokeStyle = '#05061a'; g.strokeText(t.text, x, y);
    g.fillStyle = t.big ? '#ffc23f' : '#ffffff'; g.fillText(t.text, x, y);
    if (t.sub) {
      g.font = `${cs * .6}px Jua, sans-serif`;
      g.strokeText(t.sub, x, y + size * .85); g.fillStyle = '#3fe4ff'; g.fillText(t.sub, x, y + size * .85);
    }
  }
  g.globalAlpha = 1;
}
