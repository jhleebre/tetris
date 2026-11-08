// Game flow: modes (menu / play / pause / over / result), starting a mode,
// ending, records, and turning input into actions (with key repeat for
// sideways movement). Connects the simulation to rendering, sound and UI.
import { DAS, ARR } from './config.js';
import { MODES } from './data/modes.js';
import { createGame, move, rotate, hardDrop, holdPiece, tick } from './core/engine.js';
import { createPilot, pilotStep } from './core/bot.js';
import { save, writeSave } from './util/storage.js';
import { sound } from './audio/sound.js';
import { music } from './audio/music.js';
import { fx, clearEffects } from './render/effects.js';
import * as hud from './ui/hud.js';

export const G = {
  mode: 'menu',   // 'menu' | 'play' | 'pause' | 'over' | 'result'
  game: null,     // engine state (the demo game while in the menu)
  modeIdx: 0,     // mode being played
  sel: 0,         // highlighted menu entry
  held: { left: false, right: false, down: false },
  das: { dir: 0, t: 0, a: 0 },
  endT: 0,        // seconds since the game ended
  pilot: null,    // ?autoplay: bot playing the real game
  demo: null,     // bot playing behind the menu
};

// Simulation events -> sound, effects and banners. The menu demo stays silent.
function makeEvents(quiet) {
  const S = quiet ? null : sound;
  return {
    move: () => S && S.move(),
    rotate: () => S && S.rotate(),
    hold: () => S && S.hold(),
    hardDrop: (cells, d) => { fx.drop(cells, d); if (S) S.drop(); },
    lock: cells => { fx.lock(cells); if (S) S.lock(); },
    clear: info => { fx.clear(info); if (S) S.clear(info.n, info.combo); },
    level: lv => { if (!quiet) { hud.showBanner(`레벨 ${lv}`, '조금 더 빨라져요', 1400); sound.level(); music.setLevel(lv); } },
    over: () => { if (!quiet) gameEnded(); },
    win: () => { if (!quiet) gameEnded(); },
  };
}

function resetInput() {
  G.held.left = G.held.right = G.held.down = false;
  G.das.dir = 0;
}

export function startMode(i, { autoplay = false } = {}) {
  const m = MODES[i];
  G.modeIdx = G.sel = i;
  clearEffects();
  G.game = createGame(m, undefined, makeEvents(false));
  G.pilot = autoplay ? createPilot(0.06) : null;
  resetInput();
  hud.setModeChip(m);
  hud.hideOverlays();
  G.mode = 'play'; G.endT = 0;
  hud.showBanner(m.name, m.goal);
  sound.init();
  music.stop();
  music.setLevel(G.game.level);
  music.start(true);
}

/** Shows the menu with the bot playing a quiet game behind it. */
export function openMenu() {
  G.mode = 'menu'; G.pilot = null;
  music.stop();
  startDemo();
  hud.setModeChip(MODES[0]);
  hud.showMenu(MODES, save.best, G.sel, startMode);
}

function startDemo() {
  clearEffects();
  G.game = createGame(MODES[0], undefined, makeEvents(true));
  G.demo = createPilot(0.09);
}

function gameEnded() {
  const s = G.game;
  G.mode = 'over'; G.endT = 0;
  resetInput();
  music.stop();
  if (s.won) sound.win(); else sound.over();
  if (s.won) hud.showBanner(s.reason === 'time' ? '시간 끝!' : '완료!', '', 1200);
}

const END_TITLE = { goal: '목표 달성!', clean: '청소 완료!', time: '시간 끝!', top: '꼭대기에 닿았어요' };

function showResult() {
  const s = G.game, m = s.mode, record = !G.pilot; // autoplay runs don't count as records
  G.mode = 'result';
  const prev = save.best[m.id];
  let isBest = false;
  if (record) {
    if (m.rank === 'score') isBest = prev === undefined ? s.score > 0 : s.score > prev;
    else isBest = s.won && (prev === undefined || s.time < prev);
    if (isBest) { save.best[m.id] = m.rank === 'score' ? s.score : s.time; writeSave(); }
  }
  const best = save.best[m.id];
  const linesStat = m.garbage ? `<div>${m.garbage - s.garbageLeft}/${m.garbage}<small>지운 쓰레기 줄</small></div>` : `<div>${s.lines}<small>지운 줄</small></div>`;
  let stat;
  if (m.rank === 'time') {
    stat = `<div>${s.won ? hud.fmtTime(s.time) : '—'}<small>${isBest ? '새 최고 기록' : '이번 기록'}</small></div>${linesStat}<div>${hud.fmtTime(best)}<small>최고 기록</small></div>`;
  } else {
    stat = `<div>${hud.fmtScore(s.score)}<small>${isBest ? '새 최고 점수' : '점수'}</small></div>${linesStat}<div>${s.level}<small>레벨</small></div><div>${hud.fmtScore(best)}<small>최고 점수</small></div>`;
  }
  const sub = s.won ? `${m.name} · ${hud.fmtTime(s.time)}` : '어울리지 않는 블록은 보관(C)에 넣어 두었다가 꺼내 쓰세요.';
  hud.showResult({
    title: END_TITLE[s.reason], sub, stat,
    main: ['다시 하기', () => startMode(G.modeIdx, { autoplay: !!G.pilot })],
    alt: ['', null],
  });
}

function togglePause() {
  if (G.mode === 'play') {
    G.mode = 'pause'; resetInput();
    music.stop();
    hud.showResult({
      title: '잠시 멈춤', sub: MODES[G.modeIdx].name,
      main: ['계속하기', resume], alt: ['다시 하기', () => startMode(G.modeIdx)],
    });
  } else if (G.mode === 'pause') resume();
}
function resume() { hud.hideResult(); G.mode = 'play'; music.start(); }

function moveSelection(d) {
  G.sel = Math.max(0, Math.min(MODES.length - 1, G.sel + d));
  hud.renderModes(MODES, save.best, G.sel, startMode);
}

// Sideways movement: one step on press, then repeat after DAS every ARR
function shift(dir) { return move(G.game, dir); }
function press(dir) { G.das.dir = dir; G.das.t = 0; G.das.a = 0; shift(dir); }
function updateDas(dt) {
  const d = G.das;
  if (!d.dir) return;
  const before = d.t;
  d.t += dt;
  if (d.t < DAS) return;
  if (before < DAS) { shift(d.dir); d.a = d.t - DAS; } else d.a += dt;
  while (d.a >= ARR) { d.a -= ARR; if (!shift(d.dir)) { d.a = 0; break; } }
}

const resultReady = () => G.mode === 'result' || G.mode === 'pause';

/** Input handler (see ui/input.js for action names). */
export function onAction(a, down, repeat) {
  if (down) sound.init();
  if (G.pilot && G.mode !== 'result') {
    // Autoplay owns the controls; Esc hands them back, M still mutes
    if (down && a === 'pause') openMenu();
    else if (down && a === 'mute') hud.setMuteLabel(sound.toggleMute());
    else if (down && a === 'music') toggleMusic();
    return;
  }
  const s = G.game, playing = G.mode === 'play';

  if (a === 'left' || a === 'right') {
    const dir = a === 'left' ? -1 : 1;
    if (G.mode === 'menu') { if (down) moveSelection(dir); return; }
    G.held[a] = down;
    if (!playing) return;
    if (down) { if (!repeat) press(dir); }
    else if (G.das.dir === dir) {
      const other = dir < 0 ? 'right' : 'left';
      if (G.held[other]) press(-dir); else G.das.dir = 0;
    }
    return;
  }
  if (a === 'down') {
    if (G.mode === 'menu') { if (down) moveSelection(2); return; }
    G.held.down = down;
    return;
  }
  if (!down || repeat) return;
  switch (a) {
    case 'up':
      if (G.mode === 'menu') moveSelection(-2);
      else if (playing) rotate(s, 1);
      break;
    case 'rotCW': if (playing) rotate(s, 1); break;
    case 'rotCCW': if (playing) rotate(s, -1); break;
    case 'hold': if (playing) holdPiece(s); break;
    case 'primary':
      if (G.mode === 'menu') startMode(G.sel);
      else if (playing) hardDrop(s);
      else if (resultReady()) hud.resultMain();
      break;
    case 'confirm':
      if (G.mode === 'menu') startMode(G.sel);
      else if (resultReady()) hud.resultMain();
      break;
    case 'restart':
      if (G.mode !== 'menu') startMode(G.modeIdx);
      break;
    case 'pause':
      if (playing || G.mode === 'pause') togglePause(); else openMenu();
      break;
    case 'mute':
      hud.setMuteLabel(sound.toggleMute());
      break;
    case 'music':
      toggleMusic();
      break;
  }
}

export function onBlur() {
  resetInput();
  if (G.mode === 'play' && !G.pilot) togglePause();
}

export function onMenuButton() { if (G.mode === 'play' && !G.pilot) togglePause(); else openMenu(); }
export function onMuteButton() { sound.init(); hud.setMuteLabel(sound.toggleMute()); }
export function onMusicButton() { sound.init(); toggleMusic(); }
function toggleMusic() { hud.setMusicLabel(music.toggle(G.mode === 'play')); }

export function update(dt) {
  const s = G.game;
  if (G.mode === 'play') {
    if (G.pilot) pilotStep(G.pilot, s, dt); else updateDas(dt);
    if (G.mode === 'play') tick(s, dt, !G.pilot && G.held.down);
  } else if (G.mode === 'menu') {
    pilotStep(G.demo, s, dt);
    tick(s, dt);
    if (s.over || s.lines >= 60) startDemo();
  } else if (G.mode === 'over') {
    G.endT += dt;
    if (G.endT >= (G.game.won ? 1.2 : 1.1)) showResult();
  }
  if (G.mode === 'result') G.endT += dt;
}

/** HUD values for the frame. */
export function hudValues() {
  const s = G.game, m = s.mode;
  let progress = 0, linesLabel = '줄', lines = String(s.lines);
  if (m.garbage) { linesLabel = '쓰레기'; lines = `${s.garbageLeft}줄 남음`; progress = 1 - s.garbageLeft / m.garbage; }
  else if (m.goalLines) { lines = `${Math.min(s.lines, m.goalLines)}/${m.goalLines}`; progress = s.lines / m.goalLines; }
  let timeLabel = '시간', time = s.time;
  if (m.timeLimit) { timeLabel = '남은 시간'; time = m.timeLimit - s.time; progress = s.time / m.timeLimit; }
  if (G.mode === 'menu') progress = 0;
  return { progress, score: s.score, linesLabel, lines, level: s.level, timeLabel, time };
}

/** What the view needs besides the game state. */
export function viewOptions() {
  const m = G.game.mode;
  return { accent: m.color, overT: G.game.over && G.mode !== 'menu' ? G.endT : -1, won: G.game.won };
}
