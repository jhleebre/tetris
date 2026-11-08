// localStorage wrapper that never throws (private mode, blocked storage, ...).
export const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
};

const SAVE_KEY = 'stardust-stack-v1';

/** Best result per mode id: score (rank 'score') or seconds (rank 'time'). */
export const save = LS.get(SAVE_KEY, { best: {} });
export function writeSave() { LS.set(SAVE_KEY, save); }

export const prefs = {
  get muted() { return LS.get(SAVE_KEY + '-mute', false); },
  set muted(v) { LS.set(SAVE_KEY + '-mute', v); },
  get music() { return LS.get(SAVE_KEY + '-music', true); },
  set music(v) { LS.set(SAVE_KEY + '-music', v); },
};
