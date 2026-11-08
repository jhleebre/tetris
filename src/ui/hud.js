// DOM side of the game: HUD chips, banner, menu and result overlays.
// Elements are defined in index.html; this module only fills and toggles them.
const $ = id => document.getElementById(id);

/** Seconds -> "1:02.35" (undefined -> "—"). */
export const fmtTime = t => {
  if (t === undefined) return '—';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
};
export const fmtScore = n => (n === undefined ? '—' : n.toLocaleString('ko-KR'));
export const fmtBest = (mode, v) => (mode.rank === 'time' ? fmtTime(v) : fmtScore(v) + (v === undefined ? '' : '점'));

const els = {
  prog: $('prog'), score: $('scoreTxt'), lines: $('linesTxt'), linesLabel: $('linesLabel'),
  level: $('levelTxt'), time: $('timeTxt'), timeLabel: $('timeLabel'),
};
const last = {};
const set = (k, v) => { if (last[k] !== v) { last[k] = v; els[k].textContent = v; } };

/** v: {progress 0..1, score, linesLabel, lines, level, timeLabel, time (seconds)} */
export function updateHud(v) {
  els.prog.style.width = Math.min(100, v.progress * 100) + '%';
  set('score', fmtScore(v.score));
  set('linesLabel', v.linesLabel); set('lines', v.lines);
  set('level', String(v.level));
  set('timeLabel', v.timeLabel); set('time', fmtTime(v.time));
}

export function setModeChip(mode) {
  $('modeChip').textContent = mode.name;
  $('modeChip').style.setProperty('--accent', mode.color);
}
export function setMuteLabel(muted) { $('muteBtn').textContent = muted ? '소리 끔' : '소리 켬'; }
export function setMusicLabel(on) { $('musicBtn').textContent = on ? '음악 켬' : '음악 끔'; }

let bannerT = null;
export function showBanner(title, sub, ms = 1800) {
  $('bannerTitle').textContent = title; $('bannerSub').textContent = sub;
  const b = $('banner'); b.classList.add('show');
  clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), ms);
}

export function hideOverlays() { $('menu').classList.remove('show'); $('result').classList.remove('show'); }

// Result card: {title, sub, stat (html), main:[label, fn], alt:[label, fn]}
let res = null;
export function showResult(o) {
  $('resTitle').textContent = o.title; $('resSub').textContent = o.sub; $('resStat').innerHTML = o.stat || '';
  $('resMain').textContent = o.main[0]; $('resAlt').textContent = o.alt[0]; $('resHint').textContent = o.main[0];
  $('resAlt').style.display = o.alt[0] ? '' : 'none';
  res = o;
  $('result').classList.add('show');
}
export function hideResult() { $('result').classList.remove('show'); }
/** Runs the result card's main button (Space/Enter). */
export function resultMain() { if (res) res.main[1](); }
$('resMain').onclick = () => res && res.main[1]();
$('resAlt').onclick = () => res && res.alt[1] && res.alt[1]();

/** Mode select. modes: list, best: {id: value}, sel: highlighted index. */
export function showMenu(modes, best, sel, onPick) {
  renderModes(modes, best, sel, onPick);
  $('result').classList.remove('show');
  $('menu').classList.add('show');
}
export function renderModes(modes, best, sel, onPick) {
  const box = $('modes'); box.innerHTML = '';
  modes.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = 'md' + (i === sel ? ' sel' : '');
    b.style.setProperty('--c', m.color);
    const v = best[m.id];
    b.innerHTML = `${m.name}<small>${m.goal}</small><small class="best">${v === undefined ? '아직 기록 없음' : '최고 ' + fmtBest(m, v)}</small>`;
    b.onclick = () => onPick(i);
    box.appendChild(b);
  });
}

/** Wires the HUD buttons. */
export function bindHud({ onMenu, onMute, onMusic, onResultMenu }) {
  $('menuBtn').onclick = onMenu;
  $('muteBtn').onclick = onMute;
  $('musicBtn').onclick = onMusic;
  $('resMenu').onclick = onResultMenu;
}
