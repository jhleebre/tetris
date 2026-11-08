// Entry point: wires input and UI to the game and runs the frame loop.
import { resize, draw } from './render/view.js';
import { updateEffects } from './render/effects.js';
import { sound } from './audio/sound.js';
import { music } from './audio/music.js';
import { bindInput } from './ui/input.js';
import { MODES } from './data/modes.js';
import * as hud from './ui/hud.js';
import * as game from './game.js';

const { G } = game;

bindInput({ onAction: game.onAction, onBlur: game.onBlur });
hud.bindHud({ onMenu: game.onMenuButton, onMute: game.onMuteButton, onMusic: game.onMusicButton, onResultMenu: game.openMenu });
hud.setMuteLabel(sound.muted);
hud.setMusicLabel(music.enabled);
window.addEventListener('resize', resize);
resize();
game.openMenu();
// The HUD can change height once the web font loads
if (document.fonts) document.fonts.ready.then(resize);

let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;

  if (G.mode !== 'pause') {
    game.update(dt);
    updateEffects(dt);
  }
  hud.updateHud(game.hudValues());
  draw(G.game, game.viewOptions(), now / 1000);
}
requestAnimationFrame(frame);

// ?autoplay[&mode=sprint]: the bot plays the real game, for QA
const params = new URLSearchParams(location.search);
if (params.has('autoplay')) {
  const i = Math.max(0, MODES.findIndex(m => m.id === params.get('mode')));
  game.startMode(i, { autoplay: true });
}
