// Turns keyboard and touch input into named actions. The game decides what an
// action means in its current mode.
//   held:    'left' 'right' 'down' (down/up both reported)
//   presses: 'up', 'rotCW', 'rotCCW', 'hold', 'primary' (Space / touch drop),
//            'confirm' (Enter), 'restart' (R), 'pause' (Esc / P), 'mute' (M), 'music' (N)
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'down', KeyS: 'down', ArrowUp: 'up', KeyW: 'up',
  KeyX: 'rotCW', KeyZ: 'rotCCW', ControlLeft: 'rotCCW', ControlRight: 'rotCCW',
  KeyC: 'hold', ShiftLeft: 'hold', ShiftRight: 'hold',
  Space: 'primary', Enter: 'confirm', KeyR: 'restart', Escape: 'pause', KeyP: 'pause', KeyM: 'mute', KeyN: 'music',
};

/**
 * onAction(name, down, repeat): every mapped key press/release.
 * onBlur(): window lost focus (release everything).
 */
export function bindInput({ onAction, onBlur }) {
  window.addEventListener('keydown', e => {
    const a = KEYMAP[e.code];
    if (!a || e.metaKey || e.altKey) return;
    if (a !== 'pause' && a !== 'mute' && a !== 'music') e.preventDefault();
    onAction(a, true, e.repeat);
  });
  window.addEventListener('keyup', e => {
    const a = KEYMAP[e.code];
    if (a) onAction(a, false, false);
  });
  window.addEventListener('blur', onBlur);

  // On-screen pad (shown on touch devices); data-k holds the action name
  document.querySelectorAll('.tb').forEach(b => {
    const a = b.dataset.k === 'drop' ? 'primary' : b.dataset.k;
    const down = e => {
      e.preventDefault();
      if (b.setPointerCapture) b.setPointerCapture(e.pointerId);
      b.classList.add('on');
      onAction(a, true, false);
    };
    const up = () => {
      if (!b.classList.contains('on')) return;
      b.classList.remove('on');
      onAction(a, false, false);
    };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
  });
}
