// Гранёный лев из глянцевого чёрного лака и общий свет экрана (мышь на компьютере, наклон на телефоне).
// Рисуется на холсте (canvas) — это в десятки раз легче для телефона, чем 244 отдельные svg-фигуры.
import { LION } from './lion-data.js';

const lions = new Set();
const target = { x: 0.28, y: 0.22 };
export const light = { x: 0.28, y: 0.22 };
const listeners = new Set();
const PATHS = LION.map((f) => {
  const p = new Path2D();
  p.moveTo(f.p[0], f.p[1]);
  for (let i = 2; i < f.p.length; i += 2) p.lineTo(f.p[i], f.p[i + 1]);
  p.closePath();
  return p;
});

// Рамки глаз — для объёмного градиента «стекляшки»
const EYES = LION.map((f, i) => {
  if (f.k !== 3) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let j = 0; j < f.p.length; j += 2) { x0 = Math.min(x0, f.p[j]); x1 = Math.max(x1, f.p[j]); y0 = Math.min(y0, f.p[j + 1]); y1 = Math.max(y1, f.p[j + 1]); }
  return { i, x0, y0, w: x1 - x0, h: y1 - y0 };
}).filter(Boolean);

// Глаз — гладкая янтарная стекляшка: светится изнутри, фокус блика и полоса отражения едут за светом
function paintEye(ctx, e, s) {
  const cx = e.x0 + e.w * 0.5, cy = e.y0 + e.h * 0.55;
  const fx = e.x0 + e.w * (0.5 + (light.x - 0.5) * 0.9), fy = e.y0 + e.h * (0.5 + (light.y - 0.5) * 0.9);
  const r = Math.max(e.w, e.h) * 0.78;
  const g = ctx.createRadialGradient(fx, fy, 0, cx, cy, r);
  g.addColorStop(0, '#FFF6DC');
  g.addColorStop(0.22, '#F7C863');
  g.addColorStop(0.62, '#C47B17');
  g.addColorStop(1, '#3E2304');
  ctx.fillStyle = g;
  ctx.fill(PATHS[e.i]);
  const bc = Math.min(Math.max(light.x, 0.05), 0.95);
  const a = 0.25 + 0.45 * (1 - Math.abs(light.y - 0.3));
  const band = ctx.createLinearGradient(e.x0, e.y0, e.x0 + e.w, e.y0 + e.w * 0.35);
  band.addColorStop(Math.max(0, bc - 0.16), 'rgba(255,255,255,0)');
  band.addColorStop(bc, `rgba(255,255,255,${a.toFixed(2)})`);
  band.addColorStop(Math.min(1, bc + 0.16), 'rgba(255,255,255,0)');
  ctx.fillStyle = band;
  ctx.fill(PATHS[e.i]);
  ctx.lineWidth = 0.6 / s;
  ctx.strokeStyle = '#0A0806';
  ctx.stroke(PATHS[e.i]);
}

export function onLight(fn) { listeners.add(fn); fn(light); }

// Чёрный лак: отражение «комнаты» (светлее сверху) + острый блик от источника
function fill(n, k, L, strength, soft, eye) {
  if (k === 3) return eye;
  if (k === 4) return '#0A0A0B';
  const nx = n[0], ny = n[1], nz = n[2];
  const rx = 2 * nz * nx, ry = 2 * nz * ny, rz = 2 * nz * nz - 1;
  const env = 9 + soft * (30 * Math.pow(Math.max(0, -ry), 1.4) + 5 * (1 - rz));
  const d = Math.max(0, rx * L[0] + ry * L[1] + rz * L[2]);
  let v = env + strength * (168 * Math.pow(d, 36) + 22 * Math.pow(d, 6));
  if (k === 1) v += 4;
  if (k === 2) v *= 0.6;
  v = Math.min(v, 226);
  return `rgb(${v | 0},${(v * 0.99) | 0},${(v * 0.965) | 0})`;
}

// Лев в контейнере w×h: cx, cy — центр, s — масштаб. opts: strength, soft, eye (цвет глаз)
export function mountLion(box, w, h, cx, cy, s, opts = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  box.appendChild(canvas);
  const lion = { canvas, ctx: canvas.getContext('2d'), dpr, cx, cy, s, opts: { strength: 0.55, soft: 0.75, eye: 'rgba(230,176,74,0.7)', ...opts } };
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
  const { ctx, dpr, cx, cy, s } = lion;
  const { strength, soft, eye } = lion.opts;
  const L = vec();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, lion.canvas.width, lion.canvas.height);
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * cx, dpr * cy);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 0.9 / s;
  ctx.strokeStyle = '#121214';
  for (let i = 0; i < LION.length; i++) {
    if (LION[i].k === 3) continue;
    ctx.fillStyle = fill(LION[i].n, LION[i].k, L, strength, soft, eye);
    ctx.fill(PATHS[i]);
    ctx.stroke(PATHS[i]);
  }
  for (const e of EYES) paintEye(ctx, e, s);
}

// Свет догоняет цель плавно: грани переливаются, а не прыгают; когда догнал — рисование останавливается
let running = false;
function tick() {
  const dx = target.x - light.x, dy = target.y - light.y;
  if (Math.abs(dx) < 0.002 && Math.abs(dy) < 0.002) { running = false; return; }
  light.x += dx * 0.18;
  light.y += dy * 0.18;
  for (const lion of lions) {
    if (!lion.canvas.isConnected) { lions.delete(lion); continue; }
    paint(lion);
  }
  listeners.forEach((fn) => fn(light));
  requestAnimationFrame(tick);
}

export function setLight(x, y) {
  target.x = Math.min(Math.max(x, 0), 1);
  target.y = Math.min(Math.max(y, 0), 1);
  if (!running) { running = true; requestAnimationFrame(tick); }
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
