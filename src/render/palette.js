// Cell colors by cell value (1..7 piece types in TYPES order, 8 garbage) and
// cached block sprites so each cell is a single drawImage.
import { TYPES } from '../core/pieces.js';

const BY_TYPE = { I: '#3fe4ff', J: '#5a7dff', L: '#ff9a3f', O: '#ffc23f', S: '#3ee0a1', T: '#b07bff', Z: '#ff5a6e' };
export const COLORS = [null, ...TYPES.map(t => BY_TYPE[t]), '#5b6091'];
export const colorOf = type => BY_TYPE[type];

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = s => { const c = (n >> s) & 255; return Math.round(f > 0 ? c + (255 - c) * f : c * (1 + f)); };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
export { roundRect };

const cache = new Map();
/** A rounded, lit block of `size` CSS pixels drawn at device scale `dpr`. */
export function blockSprite(color, size, dpr) {
  const k = `${color}|${size}|${dpr}`;
  let c = cache.get(k);
  if (c) return c;
  const px = Math.max(2, Math.round(size * dpr));
  c = document.createElement('canvas'); c.width = c.height = px;
  const g = c.getContext('2d');
  const inset = Math.max(1, px * .04), w = px - inset * 2, r = px * .2;
  const grad = g.createLinearGradient(0, 0, 0, px);
  grad.addColorStop(0, shade(color, .35)); grad.addColorStop(.5, color); grad.addColorStop(1, shade(color, -.3));
  roundRect(g, inset, inset, w, w, r); g.fillStyle = grad; g.fill();
  // Glossy top band
  g.save(); g.clip();
  g.fillStyle = 'rgba(255,255,255,.28)';
  roundRect(g, inset + w * .12, inset + w * .08, w * .76, w * .26, r * .6); g.fill();
  g.restore();
  g.strokeStyle = shade(color, -.45); g.lineWidth = Math.max(1, px * .05);
  roundRect(g, inset, inset, w, w, r); g.stroke();
  cache.set(k, c);
  return c;
}
export function clearSprites() { cache.clear(); }
