// Список покупок: экраны «Списки», список по отделам, добавление с подсказками, «Обычный набор», настройки.
import { DEPTS, UNITS, LIST_ICONS, guessDept, norm } from './data.js';
import * as S from './store.js';
import { mountLion, startLight, onLight } from './lion.js';

const $app = document.getElementById('app');
const $layer = document.getElementById('layer');
const $toast = document.getElementById('toast');
const ui = { screen: 'lists', listId: null, picked: {} };

const ACC = { amber: '#E8B04B', ice: '#8FD6FF', lime: '#C9F26B', white: '#F0EEE9' };
const ACC_NAMES = { amber: 'Золото', ice: 'Лёд', lime: 'Лайм', white: 'Без цвета' };

// ---------- мелочи ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (d, size = 20, w = 1.7, color = 'currentColor') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"></path></svg>`;
const I = {
  back: 'M15 6l-6 6 6 6', plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18', gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.9a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2L5.1 5.8l-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-.9a7 7 0 0 0 2 1.2L10 21h4l.5-2.5a7 7 0 0 0 2-1.2l2.4.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.2a6.5 6.5 0 0 1 3.5 5.8',
  set: 'M4 7.5l2 2 3.5-3.5M13 8h7M4 15.5l2 2 3.5-3.5M13 16h7', check: 'M5 12.5l4.5 4.5L19 7.5',
  miss: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 18.4L18.4 5.6', edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  move: 'M4 12h13M13 7l5 5-5 5M20 5v14', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3', undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  tilt: 'M7 3h10v18H7zM11 18h2', lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3'
};
const DISC = `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#F0EEE9"></circle><path d="M7.2 12.4l3.1 3.1 6.4-6.6" fill="none" stroke="#121214" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const MISS = `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="none" stroke="#F2705F" stroke-width="1.4" stroke-dasharray="2.6 2.4"></circle><path d="M8.5 15.5l7-7" stroke="#F2705F" stroke-width="1.6" stroke-linecap="round"></path></svg>`;
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };
const deptName = (id) => (DEPTS.find((d) => d.id === id) || DEPTS[DEPTS.length - 1]).name;
const list = () => S.listById(ui.listId);
const openItems = (l) => l.items.filter((i) => i.status === 'open');

let toastTimer;
function toast(text, action) {
  $toast.innerHTML = esc(text) + (action ? `<button type="button">${esc(action.label)}</button>` : '');
  $toast.classList.add('show');
  if (action) $toast.querySelector('button').onclick = () => { action.run(); $toast.classList.remove('show'); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('show'), action ? 4000 : 2200);
}

function applyAccent() {
  const c = ACC[S.state.accent] || ACC.amber;
  document.documentElement.style.setProperty('--accent', c);
  const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.55)`);
  return `rgba(${r},${g},${b},0.75)`;
}

function lionBg() {
  const box = $app.querySelector('.lion-bg');
  if (box) mountLion(box, 390, 520, 334, 176, 1.3, { eye: applyAccent() });
}

// ---------- экраны ----------
function go(screen, listId) {
  ui.screen = screen;
  if (listId) ui.listId = listId;
  if (screen === 'usual') ui.picked = {};
  render();
  window.scrollTo(0, 0);
}

function back() {
  if ($layer.classList.contains('open')) return closeLayer();
  if (ui.screen === 'list') go('lists');
  else if (ui.screen === 'usual' || ui.screen === 'invite') go('list');
}

function render() {
  const fn = { lists: viewLists, list: viewList, usual: viewUsual, invite: viewInvite }[ui.screen] || viewLists;
  if (ui.screen !== 'lists' && !list()) ui.screen = 'lists';
  $app.innerHTML = fn();
  lionBg();
}

function dateCaps() {
  const d = new Date();
  const wd = d.toLocaleDateString('ru-RU', { weekday: 'long' });
  const day = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  return `${wd} · ${day}`;
}

function viewLists() {
  const lists = [...S.state.lists].sort((a, b) => b.updated - a.updated);
  const hero = lists.find((l) => openItems(l).length) || lists[0];
  const rows = lists.filter((l) => l !== hero);
  const heroLeft = openItems(hero).length, heroTotal = hero.items.length;
  const pct = heroTotal ? Math.round((heroTotal - heroLeft) / heroTotal * 100) : 0;
  const rowHtml = (l) => {
    const left = openItems(l).length;
    const done = l.items.length && !left;
    return `<button class="list-row" data-open="${l.id}" data-hold-list="${l.id}">
      <span class="tile">${icon(LIST_ICONS[l.icon] || LIST_ICONS.cart, 19, 1.6, '#F0EEE9')}</span>
      <span class="txt" style="display:flex;flex-direction:column;gap:3px;min-width:0">
        <span style="font-size:17px">${esc(l.name)}</span>
        <span class="sub" style="font-size:12px;color:var(--text3)">${l.items.length ? `${l.items.length} ${plural(l.items.length, 'пункт', 'пункта', 'пунктов')}` : 'пусто'}</span>
      </span>
      <span class="count"><b style="color:${done ? 'var(--accent)' : 'var(--text)'}">${done ? '✓' : left}</b><small>${done ? 'готово' : 'осталось'}</small></span>
    </button>`;
  };
  return `<section class="screen">
    <div class="lion-bg" aria-hidden="true"></div>
    <div class="bar"><button class="round" data-act="settings" aria-label="Настройки">${icon(I.gear, 19, 1.6)}</button></div>
    <div class="head"><div class="caps">${esc(dateCaps())}</div><h1 class="title">Списки</h1></div>
    <button class="hero" data-open="${hero.id}" data-hold-list="${hero.id}" aria-label="Открыть список ${esc(hero.name)}">
      <span class="caps">Сейчас</span>
      <span class="big"><b>${esc(hero.name)}</b>${heroTotal ? `<span><span class="num">${heroLeft}</span><span class="of">из ${heroTotal}</span></span>` : ''}</span>
      <span style="display:flex;flex-direction:column;gap:10px">
        <span class="bar-line" style="width:100%"><i style="width:${pct}%"></i></span>
        <span style="font-size:13px;color:var(--text2)">${heroTotal ? (heroLeft ? `осталось купить ${heroLeft} ${plural(heroLeft, 'пункт', 'пункта', 'пунктов')}` : 'всё куплено') : 'список пока пуст'}</span>
      </span>
    </button>
    ${rows.length ? `<div class="sec"><span class="caps">Все списки</span><span class="n">${rows.length}</span></div><div class="well">${rows.map(rowHtml).join('')}</div>` : ''}
    <div class="sign">Список покупок</div>
    <div class="dock"><button class="lac main gold" data-act="new-list">${icon(I.plus, 20, 2.4, '#1B1205')}Новый список</button></div>
  </section>`;
}

function itemRow(i) {
  const cls = i.status === 'open' ? '' : i.status;
  const right = i.status === 'missing' ? `<span class="miss-label">не было</span><span class="check">${MISS}</span>`
    : `<button class="check" data-toggle="${i.id}" aria-label="${i.status === 'done' ? 'Снять отметку' : 'Отметить купленным'}: ${esc(i.name)}">${i.status === 'done' ? DISC : '<span class="ring"></span>'}</button>`;
  const sub = S.subText(i);
  return `<div class="row ${cls}" data-hold="${i.id}">
    <button class="txt" data-edit="${i.id}"><span class="name"><span>${esc(i.name)}</span></span>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</button>
    ${right}
  </div>`;
}

function viewList() {
  const l = list();
  const open = openItems(l);
  const bought = l.items.filter((i) => i.status !== 'open');
  const total = l.items.length;
  const pct = total ? Math.round(bought.length / total * 100) : 0;
  const groups = DEPTS.map((d) => ({ d, items: open.filter((i) => i.dept === d.id) })).filter((g) => g.items.length);
  return `<section class="screen">
    <div class="lion-bg" aria-hidden="true"></div>
    <div class="bar">
      <button class="round" data-act="back" aria-label="Назад к спискам">${icon(I.back, 18, 1.8)}</button>
      <button class="round" data-act="invite" aria-label="Участники">${icon(I.people, 20, 1.6)}</button>
    </div>
    <div class="head">
      <div class="caps">${total ? `${total} ${plural(total, 'пункт', 'пункта', 'пунктов')}` : 'пусто'}</div>
      <h1 class="title" data-act="rename">${esc(l.name)}</h1>
      ${total ? `<div class="meta"><span>Осталось <b>${open.length}</b> из ${total}</span><span class="bar-line"><i style="width:${pct}%"></i></span></div>` : ''}
    </div>
    ${groups.map((g) => `<div class="sec"><span class="caps">${esc(g.d.name)}</span><span class="n">${g.items.length}</span></div><div class="well">${g.items.map(itemRow).join('')}</div>`).join('')}
    ${!open.length ? `<div class="well" style="margin-top:22px"><div class="empty">${total ? 'Всё куплено. Можно очистить купленное или добавить новое.' : 'Список пуст. Добавь продукт строкой внизу или открой «Набор» — там то, что вы берёте чаще всего.'}</div></div>` : ''}
    ${bought.length ? `<div class="sec"><span class="caps">Куплено · ${bought.length}</span><button data-act="clear">Очистить</button></div><div class="well">${bought.map(itemRow).join('')}</div>` : ''}
    <div class="dock">
      <button class="lac compose gold" data-act="add">${icon(I.plus, 20, 2.4, '#1B1205')}<span>Добавить продукт</span></button>
      <button class="lac icon gold" data-act="usual" aria-label="Обычный набор">${icon(I.set, 22, 2, '#1B1205')}</button>
    </div>
  </section>`;
}

function viewUsual() {
  const l = list();
  const set = S.usualSet(l);
  const picked = set.filter((h) => !h.inList && ui.picked[norm(h.name)] !== false);
  const cnt = picked.length;
  return `<section class="screen">
    <div class="lion-bg" aria-hidden="true"></div>
    <div class="bar"><button class="round" data-act="back" aria-label="Назад к списку">${icon(I.back, 18, 1.8)}</button></div>
    <div class="head">
      <div class="caps">В «${esc(l.name)}»</div>
      <h1 class="title" style="font-size:46px">Обычный набор</h1>
      ${set.length ? `<div class="meta"><span>Добавится <b>${cnt}</b>${set.some((h) => h.inList) ? ` · ${set.filter((h) => h.inList).length} уже в списке` : ''}</span></div>` : ''}
    </div>
    ${set.length ? `<div class="sec"><span class="caps">Берёте чаще всего</span><span class="n">${set.length}</span></div>
    <div class="well">${set.map((h) => {
      const key = norm(h.name);
      const on = !h.inList && ui.picked[key] !== false;
      return `<div class="row${h.inList ? ' done' : ''}"><span class="txt"><span class="name"><span style="text-decoration:none">${esc(h.name)}</span></span><span class="sub">${esc([S.qtyText(h), h.every].filter(Boolean).join(' · '))}</span></span>
        ${h.inList ? '<span class="sub" style="padding-right:10px">уже в списке</span>' : `<button class="check" data-pick="${esc(key)}" aria-pressed="${on}" aria-label="${on ? 'Не добавлять' : 'Добавить'}: ${esc(h.name)}">${on ? DISC : '<span class="ring"></span>'}</button>`}</div>`;
    }).join('')}</div>`
    : `<div class="well" style="margin-top:22px"><div class="empty">Набор соберётся сам: сюда попадёт всё, что вы купили хотя бы два раза. Отмечай покупки галочками — и через пару походов в магазин здесь будет ваш «костяк».</div></div>`}
    <div class="dock"><button class="lac main gold" data-act="add-usual" ${cnt ? '' : 'disabled'}>${icon(I.plus, 20, 2.4, '#1B1205')}${cnt ? `Добавить ${cnt} ${plural(cnt, 'пункт', 'пункта', 'пунктов')}` : 'Нечего добавлять'}</button></div>
  </section>`;
}

function viewInvite() {
  return `<section class="screen">
    <div class="lion-bg" aria-hidden="true"></div>
    <div class="bar"><button class="round" data-act="back" aria-label="Назад к списку">${icon(I.back, 18, 1.8)}</button></div>
    <div class="head"><div class="caps">${esc(list().name)}</div><h1 class="title" style="font-size:46px">Участники</h1></div>
    <div class="well" style="margin-top:16px"><div style="display:flex;gap:14px;padding:18px">
      ${icon(I.lock, 22, 1.7, 'var(--accent)')}
      <div style="font-size:14px;line-height:20px;color:var(--text2)"><span style="color:var(--text)">Пока список живёт только в этом телефоне.</span> Следующий шаг — общий список с семьёй: приглашение по ссылке, шифрование на телефонах и уведомления «поправила список», «в магазине», «всё куплено».</div>
    </div></div>
  </section>`;
}

// ---------- плашки ----------
let unfit = null;
function openLayer(html, after) {
  $layer.innerHTML = `<div class="scrim" data-act="close"></div>${html}`;
  $layer.classList.add('open');
  document.body.classList.add('sheet-open');
  if (after) after($layer);
}
function closeLayer() {
  $layer.classList.remove('open');
  $layer.innerHTML = '';
  document.body.classList.remove('sheet-open');
  if (unfit) { unfit(); unfit = null; }
}

// Высокая плашка всегда помещается над клавиатурой (iPhone не сжимает страницу, сжимается только «видимая» часть)
function fitAboveKeyboard($sheet) {
  const vv = window.visualViewport;
  if (!vv) return;
  const fit = () => {
    $layer.style.transform = `translateY(${vv.offsetTop}px)`;
    $sheet.style.height = Math.max(240, vv.height - $sheet.offsetTop - 6) + 'px';
  };
  vv.addEventListener('resize', fit);
  vv.addEventListener('scroll', fit);
  fit();
  unfit = () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); $layer.style.transform = ''; };
}

// Нажатия внутри плашки: срабатывают с первого касания и не закрывают клавиатуру
function onTap($root, act) {
  let start = null;
  $root.addEventListener('touchstart', (e) => { const t = e.touches[0]; start = { x: t.clientX, y: t.clientY }; }, { passive: true });
  $root.addEventListener('touchend', (e) => {
    const b = e.target.closest('button');
    if (!b || !start || b.disabled) return;
    const t = e.changedTouches[0];
    if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) return;   // это была прокрутка
    e.preventDefault();
    act(b);
  });
  $root.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && !b.disabled) { e.preventDefault(); act(b); } });
}

// Добавление и правка пункта: поле, сразу под ним количество и отдел, ниже подсказки и «Добавлено»
function itemSheet(item) {
  const l = list();
  const fresh = () => ({ name: '', qty: 0, unit: 'шт', note: '', dept: 'other', deptSet: false, more: false, touched: false, picking: false });
  const st = item ? { ...fresh(), name: item.name, qty: item.qty, unit: item.unit || 'шт', note: item.note, dept: item.dept, deptSet: true, touched: true } : fresh();
  const added = [];
  let sugMap = {};
  openLayer(`<div class="sheet tall" role="dialog" aria-label="${item ? 'Изменить пункт' : 'Новый пункт'}">
      <div class="grab"></div>
      <div class="sheet-head"><h2>${item ? 'Изменить' : 'Новый пункт'}</h2><button class="round" data-act="close" aria-label="Закрыть">${icon(I.x, 15, 2)}</button></div>
      <form class="field focus" data-form="1">
        <label style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)" for="f-name">Что купить</label>
        <input id="f-name" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" placeholder="Что купить" value="${esc(st.name)}">
        <button class="lac icon gold" type="button" data-act="submit" style="width:44px;height:44px" aria-label="${item ? 'Сохранить' : 'Добавить'}">${icon(item ? I.check : I.plus, 20, 2.4, '#1B1205')}</button>
      </form>
      <div data-more></div>
      <div data-sug></div>
      <div data-added></div>
      <div class="note" data-hint>${item ? '' : 'Пиши как в заметке — отдел определится сам. Нажми подсказку — пункт сразу добавится с прошлым количеством.'}</div>
    </div>`, ($l) => {
    const $sheet = $l.querySelector('.sheet');
    const $in = $l.querySelector('#f-name');
    const $more = $l.querySelector('[data-more]');
    const $sug = $l.querySelector('[data-sug]');
    const $added = $l.querySelector('[data-added]');
    const $hint = $l.querySelector('[data-hint]');
    const deptNow = () => (st.deptSet ? st.dept : guessDept(st.name));
    const drawMore = () => {
      const note = st.more || st.note;
      $more.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">
        <div class="opts one">
          <div class="step"><button type="button" data-q="-1" aria-label="Меньше">−</button><b>${st.qty ? String(st.qty).replace('.', ',') : '—'}</b><button type="button" data-q="1" aria-label="Больше">+</button></div>
          ${UNITS.map((u) => `<button type="button" class="chip${st.qty && st.unit === u ? ' on' : ''}" data-u="${u}">${u}</button>`).join('')}
        </div>
        <div class="opts one"><button type="button" class="chip on" data-act="dept">${icon(I.check, 14, 2.6, 'var(--accent)')}${esc(deptName(deptNow()))}</button>
          ${note ? '' : '<button type="button" class="chip" data-act="more">+ уточнение</button>'}</div>
        ${note ? `<div class="field"><input data-note placeholder="Уточнение: например, только 3,2 %" value="${esc(st.note)}"></div>` : ''}
        ${st.picking ? `<div class="well"><div class="caps" style="padding:14px 18px 6px">Отдел</div>${DEPTS.map((d) => `<button type="button" class="setting" data-d="${d.id}"><span>${esc(d.name)}</span>${d.id === deptNow() ? icon(I.check, 18, 2.4, 'var(--accent)') : ''}</button>`).join('')}</div>` : ''}
      </div>`;
      const $note = $more.querySelector('[data-note]');
      if ($note) $note.oninput = () => { st.note = $note.value; };
    };
    const drawSug = () => {
      if (item) { $sug.innerHTML = ''; return; }
      const sug = S.suggest(l, st.name);
      $hint.style.display = st.name || added.length ? 'none' : '';
      sugMap = Object.fromEntries(sug.map((s) => [s.name, s]));
      if (!sug.length) { $sug.innerHTML = ''; return; }
      const q = norm(st.name);
      const mark = (name) => {
        const n = norm(name);
        const at = n.startsWith(q) ? 0 : n.indexOf(' ' + q) + 1;
        return at >= 0 && n.slice(at, at + q.length) === q ? `${esc(name.slice(0, at))}<em>${esc(name.slice(at, at + q.length))}</em>${esc(name.slice(at + q.length))}` : esc(name);
      };
      const mine = sug.filter((s) => s.mine), dict = sug.filter((s) => !s.mine);
      const rowsHtml = (arr) => arr.map((s) => `<button type="button" class="sug" data-sug-name="${esc(s.name)}" ${s.inList ? 'disabled' : ''}><span class="txt"><span class="nm">${mark(s.name)}</span><span class="sub">${esc([s.sub, deptName(s.dept)].filter(Boolean).join(' · '))}</span></span>${s.inList ? '<small>уже в списке</small>' : icon(I.plus, 20, 2.2, 'var(--accent)')}</button>`).join('');
      $sug.innerHTML = `<div class="well">${mine.length ? `<div class="caps" style="padding:14px 18px 4px">Вы покупали</div>${rowsHtml(mine)}` : ''}${dict.length ? `<div class="caps" style="padding:14px 18px 4px;${mine.length ? 'border-top:1px solid var(--line)' : ''}">${mine.length ? 'Ещё не покупали' : 'Подсказки'}</div>${rowsHtml(dict)}` : ''}</div>`;
    };
    const drawAdded = () => {
      if (!added.length) { $added.innerHTML = ''; return; }
      $added.innerHTML = `<div class="sec" style="padding-top:6px"><span class="caps">Добавлено</span><span class="n">${added.length}</span></div>
        <div class="well added">${added.slice().reverse().map((it) => `<div class="row"><span class="ok">${icon(I.check, 13, 3, '#1B1205')}</span>
          <span class="txt"><span class="name"><span>${esc(it.name)}</span></span><span class="sub">${esc([S.subText(it), deptName(it.dept)].filter(Boolean).join(' · '))}</span></span>
          <button type="button" class="x" data-undo="${it.id}" aria-label="Убрать: ${esc(it.name)}">${icon(I.x, 16, 2)}</button></div>`).join('')}</div>`;
    };
    const drawAll = () => { drawMore(); drawSug(); drawAdded(); };
    const reset = () => { Object.assign(st, fresh()); $in.value = ''; drawAll(); };
    const commit = (data) => {
      if (item) { S.updateItem(l, item, data); closeLayer(); render(); return; }
      const r = S.addItem(l, data);
      if (!r) return;
      if (r.dup) toast(`«${r.item.name}» уже в списке`);
      else added.push(r.item);
      render();
      reset();
    };
    const typed = () => ({ name: st.name, qty: st.qty, unit: st.qty ? st.unit : '', note: st.note, dept: deptNow() });
    $in.oninput = () => { st.name = $in.value; drawMore(); drawSug(); };
    $l.querySelector('[data-form]').onsubmit = (e) => { e.preventDefault(); if (st.name.trim()) commit(typed()); };
    onTap($sheet, (b) => {
      if (b.dataset.act === 'close') return closeLayer();
      if (b.dataset.act === 'submit') { if (st.name.trim()) commit(typed()); else if (!item) closeLayer(); return; }
      if (b.dataset.q) {
        const step = st.unit === 'кг' || st.unit === 'л' ? 0.5 : st.unit === 'г' ? 100 : 1;
        st.qty = Math.max(0, Math.round((st.qty + step * Number(b.dataset.q)) * 10) / 10);
        st.touched = true; drawMore();
      } else if (b.dataset.u) { st.unit = b.dataset.u; if (!st.qty) st.qty = b.dataset.u === 'г' ? 100 : 1; st.touched = true; drawMore(); }
      else if (b.dataset.act === 'more') { st.more = true; drawMore(); $more.querySelector('[data-note]').focus(); }
      else if (b.dataset.act === 'dept') { st.picking = !st.picking; drawMore(); }
      else if (b.dataset.d) { st.dept = b.dataset.d; st.deptSet = true; st.picking = false; drawMore(); }
      else if (b.dataset.undo) {
        const it = added.find((x) => x.id === b.dataset.undo);
        if (it) { S.removeItem(l, it); added.splice(added.indexOf(it), 1); render(); drawSug(); drawAdded(); }
      } else if (b.dataset.sugName) {
        const sg = sugMap[b.dataset.sugName];
        if (!sg) return;
        // своё количество, если уже выставил руками; иначе — как в прошлый раз
        commit(st.touched ? { name: sg.name, qty: st.qty, unit: st.qty ? st.unit : '', note: st.note || sg.note || '', dept: st.deptSet ? st.dept : sg.dept || guessDept(sg.name) }
          : { name: sg.name, qty: sg.qty || 0, unit: sg.unit || '', note: sg.note || '', dept: sg.dept || guessDept(sg.name) });
      }
    });
    drawAll();
    fitAboveKeyboard($sheet);
    setTimeout(() => $in.focus(), 60);
  });
}

// Долгое нажатие на пункт: «Не было», изменить, перенести, удалить
function itemMenu(item, rowEl) {
  const l = list();
  const r = rowEl.getBoundingClientRect();
  const top = Math.min(Math.max(r.top, 80), innerHeight - 330);
  const others = S.state.lists.filter((x) => x !== l);
  openLayer(`<div class="lifted" style="top:${top}px"><span class="txt" style="flex-grow:1;display:flex;flex-direction:column;gap:3px"><span style="font-size:16px">${esc(item.name)}</span><span class="sub" style="font-size:12px;color:var(--text3)">${esc(S.subText(item) || deptName(item.dept))}</span></span></div>
    <div class="menu" role="menu" style="top:${top + 74}px">
      ${item.status === 'open' ? `<button class="red" data-m="miss" role="menuitem"><span>Не было в магазине</span>${icon(I.miss)}</button>` : `<button data-m="reopen" role="menuitem"><span>Вернуть в список</span>${icon(I.undo)}</button>`}
      <button data-m="edit" role="menuitem"><span>Изменить</span>${icon(I.edit)}</button>
      ${others.length ? `<button data-m="move" role="menuitem"><span>В другой список</span>${icon(I.move)}</button>` : ''}
      <button class="red" data-m="del" role="menuitem"><span>Удалить</span>${icon(I.trash)}</button>
    </div>`, ($l) => {
    $l.querySelector('.menu').onclick = (e) => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      const m = b.dataset.m;
      if (m === 'miss') { S.markMissing(l, item); closeLayer(); render(); }
      else if (m === 'reopen') { item.status = 'done'; S.toggleItem(l, item); closeLayer(); render(); }
      else if (m === 'edit') { closeLayer(); itemSheet(item); }
      else if (m === 'del') {
        const copy = { ...item };
        S.removeItem(l, item); closeLayer(); render();
        toast(`Удалено: ${copy.name}`, { label: 'Вернуть', run: () => { l.items.push(copy); S.save(); render(); } });
      } else if (m === 'move') {
        b.parentElement.innerHTML = `<div class="caps" style="padding:14px 20px 6px">Куда перенести</div>` + others.map((o) => `<button data-to="${o.id}" role="menuitem"><span>${esc(o.name)}</span>${icon(I.move)}</button>`).join('');
        $l.querySelector('.menu').onclick = (ev) => {
          const t = ev.target.closest('[data-to]');
          if (!t) return;
          const to = S.listById(t.dataset.to);
          S.moveItem(l, to, item); closeLayer(); render(); toast(`Перенесено в «${to.name}»`);
        };
      }
    };
  });
}

function listSheet(existing) {
  let ic = existing ? existing.icon : 'cart';
  openLayer(`<div class="sheet" role="dialog" aria-label="${existing ? 'Список' : 'Новый список'}">
    <div class="grab"></div>
    <div class="sheet-head"><h2>${existing ? 'Список' : 'Новый список'}</h2><button class="round" data-act="close" aria-label="Закрыть">${icon(I.x, 15, 2)}</button></div>
    <form class="field focus" data-form="1"><label style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)" for="l-name">Название</label>
      <input id="l-name" autocomplete="off" enterkeyhint="done" placeholder="Например, Хозтовары" value="${esc(existing ? existing.name : '')}"></form>
    <div class="opts" data-icons>${Object.entries(LIST_ICONS).map(([k, d]) => `<button type="button" class="chip${k === ic ? ' on' : ''}" data-ic="${k}" aria-label="Значок">${icon(d, 18, 1.6, '#F0EEE9')}</button>`).join('')}</div>
    <button class="lac main" data-act="save-list">${icon(existing ? I.check : I.plus, 20, 2.2, 'var(--accent)')}${existing ? 'Сохранить' : 'Создать список'}</button>
    ${existing ? `<button class="chip" data-act="del-list" style="align-self:center;color:var(--miss)">Удалить список</button>` : ''}
  </div>`, ($l) => {
    const $in = $l.querySelector('#l-name');
    const saveIt = () => {
      if (existing) { existing.icon = ic; S.renameList(existing, $in.value); closeLayer(); render(); return; }
      const nl = S.addList($in.value, ic); closeLayer(); go('list', nl.id);
    };
    $l.querySelector('[data-form]').onsubmit = (e) => { e.preventDefault(); saveIt(); };
    $l.querySelector('.sheet').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.ic) { ic = b.dataset.ic; $l.querySelectorAll('[data-ic]').forEach((x) => x.classList.toggle('on', x === b)); }
      else if (b.dataset.act === 'save-list') saveIt();
      else if (b.dataset.act === 'del-list') {
        if (b.dataset.sure) { S.removeList(existing); closeLayer(); go('lists'); }
        else { b.dataset.sure = '1'; b.textContent = 'Точно удалить? Нажми ещё раз'; }
      }
    });
    setTimeout(() => $in.focus(), 60);
  });
}

function settingsSheet() {
  openLayer(`<div class="sheet" role="dialog" aria-label="Настройки">
    <div class="grab"></div>
    <div class="sheet-head"><h2>Настройки</h2><button class="round" data-act="close" aria-label="Закрыть">${icon(I.x, 15, 2)}</button></div>
    <div class="caps" style="padding:0 4px">Акцент</div>
    <div class="swatches">${Object.entries(ACC).map(([k, c]) => `<button class="swatch${S.state.accent === k ? ' on' : ''}" data-acc="${k}" style="background:${c}" aria-label="${ACC_NAMES[k]}"></button>`).join('')}</div>
    <div class="well">
      ${tilt.needsPermission ? `<button class="setting" data-act="tilt">${icon(I.tilt, 20, 1.7, 'var(--accent)')}<span>Блики от наклона<small>грани льва и глянец кнопок двигаются за телефоном</small></span></button>` : ''}
      <div class="setting">${icon(I.lock, 20, 1.7, 'var(--accent)')}<span>Данные хранятся в этом телефоне<small>интернет не нужен; общий список с семьёй — следующий шаг</small></span></div>
    </div>
  </div>`, ($l) => {
    $l.querySelector('.sheet').addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.acc) { S.state.accent = b.dataset.acc; S.save(); closeLayer(); render(); settingsSheet(); }
      else if (b.dataset.act === 'tilt') { const ok = await tilt.ask(); toast(ok ? 'Блики включены — наклони телефон' : 'Без разрешения блики стоят на месте'); }
    });
  });
}

// ---------- события ----------
// Долгое нажатие: на телефоне — по касаниям (iPhone гасит pointer-события своим жестом), на компьютере — мышью
let hold = null;
let swallowUntil = 0;
function startHold(target, x, y) {
  const row = target.closest('[data-hold], [data-hold-list]');
  if (!row || target.closest('.check')) return;
  hold = { row, x, y, fired: false, t: setTimeout(() => {
    hold.fired = true;
    swallowUntil = Date.now() + 700;
    row.classList.add('pressed');
    if (row.dataset.hold) { const it = list().items.find((i) => i.id === row.dataset.hold); if (it) itemMenu(it, row); }
    else listSheet(S.listById(row.dataset.holdList));
    setTimeout(() => row.classList.remove('pressed'), 300);
  }, 450) };
}
const moveHold = (x, y) => { if (hold && !hold.fired && Math.hypot(x - hold.x, y - hold.y) > 10) endHold(); };
const endHold = () => { if (!hold) return; clearTimeout(hold.t); hold = null; };
$app.addEventListener('touchstart', (e) => { const t = e.touches[0]; startHold(e.target, t.clientX, t.clientY); }, { passive: true });
$app.addEventListener('touchmove', (e) => { const t = e.touches[0]; moveHold(t.clientX, t.clientY); }, { passive: true });
$app.addEventListener('touchend', (e) => { if (hold && hold.fired) e.preventDefault(); endHold(); });
$app.addEventListener('touchcancel', endHold);
$app.addEventListener('mousedown', (e) => startHold(e.target, e.clientX, e.clientY));
$app.addEventListener('mousemove', (e) => moveHold(e.clientX, e.clientY));
$app.addEventListener('mouseup', endHold);
$app.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-hold], [data-hold-list]')) e.preventDefault(); });

$app.addEventListener('click', (e) => {
  if (Date.now() < swallowUntil) { e.preventDefault(); return; }
  const b = e.target.closest('[data-act], [data-open], [data-toggle], [data-edit], [data-pick]');
  if (!b) return;
  const l = list();
  if (b.dataset.open) return go('list', b.dataset.open);
  if (b.dataset.toggle) {
    const it = l.items.find((i) => i.id === b.dataset.toggle);
    S.toggleItem(l, it); render();
    if (it.status === 'done' && !openItems(l).length) toast('Всё куплено');
    return;
  }
  if (b.dataset.edit) return itemSheet(l.items.find((i) => i.id === b.dataset.edit));
  if (b.dataset.pick) { ui.picked[b.dataset.pick] = ui.picked[b.dataset.pick] === false; return render(); }
  const act = b.dataset.act;
  if (act === 'back') back();
  else if (act === 'settings') settingsSheet();
  else if (act === 'new-list') listSheet(null);
  else if (act === 'rename') listSheet(l);
  else if (act === 'invite') go('invite');
  else if (act === 'usual') go('usual');
  else if (act === 'add') itemSheet(null);
  else if (act === 'clear') { const kept = l.items.slice(); S.clearBought(l); render(); toast('Купленное убрано', { label: 'Вернуть', run: () => { l.items = kept; S.save(); render(); } }); }
  else if (act === 'add-usual') {
    const set = S.usualSet(l).filter((h) => !h.inList && ui.picked[norm(h.name)] !== false);
    set.forEach((h) => S.addItem(l, h));
    go('list');
    toast(`Добавлено из набора: ${set.length}`);
  }
});

$layer.addEventListener('click', (e) => { if (e.target.closest('[data-act="close"]')) closeLayer(); });

// Назад — свайпом от левого края, как в iPhone
let edge = null;
document.addEventListener('touchstart', (e) => { const t = e.touches[0]; edge = t.clientX < 24 ? { x: t.clientX, y: t.clientY } : null; }, { passive: true });
document.addEventListener('touchend', (e) => {
  if (!edge) return;
  const t = e.changedTouches[0];
  if (t.clientX - edge.x > 80 && Math.abs(t.clientY - edge.y) < 60) back();
  edge = null;
});

const tilt = startLight();
// Блики глянцевых и золотых кнопок обновляем не чаще 20 раз в секунду — этого глазу хватает, а телефону легче
let lastVars = 0;
onLight((L) => {
  const now = performance.now();
  if (now - lastVars < 50) return;
  lastVars = now;
  document.documentElement.style.setProperty('--lx', L.x.toFixed(2));
  document.documentElement.style.setProperty('--ly', L.y.toFixed(2));
});
// На iPhone наклон разрешается касанием: спрашиваем один раз при первом нажатии
if (tilt.needsPermission && !localStorage.getItem('spisok.tiltAsked')) {
  document.addEventListener('click', function once() {
    document.removeEventListener('click', once);
    localStorage.setItem('spisok.tiltAsked', '1');
    tilt.ask();
  });
}

applyAccent();
// Открываем последний список сразу — в магазине не надо лишних нажатий
const lastOpen = [...S.state.lists].sort((a, b) => b.updated - a.updated)[0];
if (lastOpen && openItems(lastOpen).length) { ui.screen = 'list'; ui.listId = lastOpen.id; }
render();
S.onOutsideChange(() => render());

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
