// Гранёный лев из глянцевого чёрного лака и общий свет экрана (мышь на компьютере, наклон на телефоне).
import { LION } from './lion-data.js';

const NS = 'http://www.w3.org/2000/svg';
const lions = new Set();
export const light = { x: 0.28, y: 0.22 };
const listeners = new Set();

export function onLight(fn) { listeners.add(fn); fn(light); }

// Чёрный лак: отражение «комнаты» (светлее сверху) + острый блик от источника
function fill(n, k, L, strength, soft, eye) {
  if (k === 3) return eye;
  if (k === 4) return '#0A0A0B';
  const [nx, ny, nz] = n;
  const rx = 2 * nz * nx, ry = 2 * nz * ny, rz = 2 * nz * nz - 1;
  const env = 9 + soft * (30 * Math.pow(Math.max(0, -ry), 1.4) + 5 * (1 - rz));
  const d = Math.max(0, rx * L[0] + ry * L[1] + rz * L[2]);
  let v = env + strength * (168 * Math.pow(d, 36) + 22 * Math.pow(d, 6));
  if (k === 1) v += 4;
  if (k === 2) v *= 0.6;
  v = Math.min(v, 226);
  return `rgb(${v | 0},${(v * 0.99) | 0},${(v * 0.965) | 0})`;
}

// Лев в svg: cx, cy — центр, s — масштаб. opts: strength, soft, eye (цвет глаз)
export function mountLion(svg, cx, cy, s, opts = {}) {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('transform', `translate(${cx} ${cy}) scale(${s})`);
  g.setAttribute('stroke', opts.seam || '#121214');
  g.setAttribute('stroke-width', (0.9 / s).toFixed(2));
  g.setAttribute('stroke-linejoin', 'round');
  const polys = LION.map((f) => {
    const p = document.createElementNS(NS, 'polygon');
    let pts = '';
    for (let i = 0; i < f.p.length; i += 2) pts += f.p[i] + ',' + f.p[i + 1] + ' ';
    p.setAttribute('points', pts);
    g.appendChild(p);
    return p;
  });
  svg.appendChild(g);
  const lion = { polys, opts: { strength: 0.55, soft: 0.75, eye: 'rgba(255,162,58,0.6)', ...opts }, svg };
  lions.add(lion);
  paint(lion);
  return lion;
}

function vec() {
  let x = (light.x - 0.5) * 2.2, y = (light.y - 0.5) * 2.2, z = 0.9;
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

function paint(lion) {
  const L = vec();
  const { strength, soft, eye } = lion.opts;
  for (let i = 0; i < LION.length; i++) lion.polys[i].setAttribute('fill', fill(LION[i].n, LION[i].k, L, strength, soft, eye));
}

let queued = false;
export function setLight(x, y) {
  light.x = Math.min(Math.max(x, 0), 1);
  light.y = Math.min(Math.max(y, 0), 1);
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    for (const lion of lions) {
      if (!lion.svg.isConnected) { lions.delete(lion); continue; }
      paint(lion);
    }
    listeners.forEach((fn) => fn(light));
  });
}

// Источники света: мышь и наклон телефона (на iPhone наклон нужно разрешить нажатием)
export function startLight() {
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') setLight(e.clientX / innerWidth, e.clientY / innerHeight);
  });
  const onTilt = (e) => {
    if (e.beta == null) return;
    // ровно в руке ~ 40° к себе: свет сверху-слева, наклоны двигают блик
    setLight(0.5 + (e.gamma || 0) / 60, 0.5 + ((e.beta || 0) - 40) / 60);
  };
  const need = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
  if (!need) { window.addEventListener('deviceorientation', onTilt); return { needsPermission: false }; }
  return {
    needsPermission: true,
    ask: async () => {
      try {
        if (await DeviceOrientationEvent.requestPermission() === 'granted') {
          window.addEventListener('deviceorientation', onTilt);
          return true;
        }
      } catch (e) { /* отказ — остаёмся на статичном свете */ }
      return false;
    }
  };
}
