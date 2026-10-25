// Данные приложения: списки, пункты и история покупок. Всё хранится в самом телефоне.
import { DICT, guessDept, norm } from './data.js';

const KEY = 'spisok.v1';
const DAY = 86400000;

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function seed() {
  return { v: 1, lists: [{ id: uid(), name: 'Продукты', icon: 'cart', items: [], updated: Date.now() }], history: {}, accent: 'amber' };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.lists)) return s;
  } catch (e) { /* испорченная запись — начинаем заново */ }
  return seed();
}

export const state = load();

// Если приложение открыто ещё где-то (вторая вкладка), берём его свежие данные, а не затираем их
export function onOutsideChange(fn) {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      const fresh = JSON.parse(e.newValue);
      for (const k of Object.keys(state)) delete state[k];
      Object.assign(state, fresh);
      fn();
    } catch (err) { /* чужая запись не прочиталась — оставляем свою */ }
  });
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* место кончилось — данные останутся до перезапуска */ }
}

// Просим браузер не стирать данные при нехватке места
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

export const listById = (id) => state.lists.find((l) => l.id === id);
const touch = (list) => { list.updated = Date.now(); save(); };

export function addList(name, icon) {
  const list = { id: uid(), name: name.trim() || 'Новый список', icon: icon || 'cart', items: [], updated: Date.now() };
  state.lists.push(list);
  save();
  return list;
}

export function renameList(list, name) { list.name = name.trim() || list.name; touch(list); }
export function removeList(list) { state.lists = state.lists.filter((l) => l !== list); if (!state.lists.length) state.lists.push(seed().lists[0]); save(); }

function remember(item, bought) {
  const key = norm(item.name);
  const h = state.history[key] || (state.history[key] = { name: item.name, buys: [] });
  Object.assign(h, { name: item.name, dept: item.dept, qty: item.qty, unit: item.unit, note: item.note });
  if (bought) h.buys = [...h.buys.slice(-19), Date.now()];
}

// Добавить пункт. Если такой уже есть в списке — не дублируем, а возвращаем его.
export function addItem(list, data) {
  const key = norm(data.name);
  if (!key) return null;
  const same = list.items.find((i) => norm(i.name) === key && i.status === 'open');
  if (same) return { item: same, dup: true };
  const item = {
    id: uid(), name: data.name.trim(), qty: data.qty || 0, unit: data.unit || '', note: (data.note || '').trim(),
    dept: data.dept || guessDept(data.name), status: 'open', added: Date.now()
  };
  list.items.push(item);
  remember(item, false);
  touch(list);
  return { item, dup: false };
}

export function updateItem(list, item, data) {
  Object.assign(item, { name: data.name.trim() || item.name, qty: data.qty || 0, unit: data.unit || '', note: (data.note || '').trim(), dept: data.dept || item.dept });
  remember(item, false);
  touch(list);
}

export function toggleItem(list, item) {
  if (item.status === 'open') { item.status = 'done'; item.doneAt = Date.now(); remember(item, true); }
  else { item.status = 'open'; delete item.doneAt; }
  touch(list);
}

export function markMissing(list, item) { item.status = 'missing'; item.doneAt = Date.now(); touch(list); }
export function removeItem(list, item) { list.items = list.items.filter((i) => i !== item); touch(list); }
export function moveItem(from, to, item) { from.items = from.items.filter((i) => i !== item); to.items.push({ ...item, status: 'open' }); touch(from); touch(to); }
export function clearBought(list) { list.items = list.items.filter((i) => i.status === 'open'); touch(list); }

export const qtyText = (i) => (i.qty ? `${String(i.qty).replace('.', ',')} ${i.unit || 'шт'}` : '');
export const subText = (i) => [qtyText(i), i.note].filter(Boolean).join(' · ');

const times = (n) => (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'раза' : 'раз');

// Подсказки: сначала своё из истории (по частоте), потом словарь. Прощаем одну опечатку.
function close(a, b) {
  const limit = b.length >= 6 ? 2 : 1;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, miss = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++miss > limit) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return miss + (a.length - i) + (b.length - j) <= limit;
}

function matches(name, q) {
  const words = norm(name).split(' ');
  const n = norm(name);
  if (n.startsWith(q) || words.some((w) => w.startsWith(q))) return true;
  return q.length >= 4 && words.some((w) => close(w.slice(0, q.length), q));
}

export function suggest(list, query, limit = 7) {
  const q = norm(query);
  if (!q) return [];
  const inList = new Set(list.items.filter((i) => i.status === 'open').map((i) => norm(i.name)));
  const mine = Object.values(state.history)
    .filter((h) => matches(h.name, q))
    .sort((a, b) => b.buys.length - a.buys.length)
    .map((h) => ({ ...h, mine: true, count: h.buys.length, inList: inList.has(norm(h.name)) }));
  const seen = new Set(mine.map((h) => norm(h.name)));
  const dict = DICT.filter((n) => !seen.has(norm(n)) && matches(n, q)).map((n) => ({ name: n, dept: guessDept(n), mine: false, inList: inList.has(norm(n)) }));
  return [...mine, ...dict].slice(0, limit).map((s) => ({
    ...s,
    sub: [s.qty ? qtyText(s) : '', s.note, s.count ? `брали ${s.count} ${times(s.count)}` : ''].filter(Boolean).join(' · ')
  }));
}

// «Обычный набор»: то, что покупали хотя бы дважды, по частоте
export function usualSet(list) {
  const inList = new Set(list.items.filter((i) => i.status === 'open').map((i) => norm(i.name)));
  return Object.values(state.history)
    .filter((h) => h.buys.length >= 2)
    .sort((a, b) => b.buys.length - a.buys.length)
    .slice(0, 14)
    .map((h) => {
      const gaps = h.buys.slice(1).map((t, i) => t - h.buys[i]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length / DAY;
      const every = avg < 1.5 ? 'почти каждый день' : avg < 6 ? `раз в ${Math.round(avg)} дн.` : avg < 10 ? 'раз в неделю' : avg < 20 ? 'раз в 2 недели' : 'раз в месяц';
      return { ...h, every, inList: inList.has(norm(h.name)) };
    });
}
