'use strict';

// Personal presentation preferences never participate in authorization.
const MenuPrefs = {
  cache: new Map(),
  iconsVisible() {
    return MenuPrefs.read().showIcons !== false;
  },
  toggleIcons() {
    MenuPrefs.save({...MenuPrefs.read(), showIcons: !MenuPrefs.iconsVisible()});
  },
  required: ['schedule', 'attendance', 'journal', 'chat', 'cabinet', 'settings'],
  hidden(id) {
    return MenuPrefs.read().hidden.includes(id);
  },
  visibility(id) {
    if (MenuPrefs.required.includes(id) || !navAvailable().some((t) => t.id === id)) return false;
    const prefs = MenuPrefs.read(),
      hidden = prefs.hidden.includes(id) ? prefs.hidden.filter((x) => x !== id) : prefs.hidden.concat(id);
    MenuPrefs.save({
      ...prefs,
      customized: true,
      hidden,
      pinned: prefs.pinned.filter((x) => !hidden.includes(x)),
    });
    if (ui.tab === id && hidden.includes(id)) ui.tab = (navItems()[0] || {}).id || Roles.home();
    return true;
  },
  key() {
    return 'politeshik:personal-menu:' + (Cloud.uid || 'guest');
  },
  normalize(value) {
    const source = value && typeof value === 'object' ? value : {};
    const ids = (values) =>
      Array.isArray(values) ? [...new Set(values.filter((id) => NAV_ALL.some((t) => t.id === id)))] : [];
    const hidden = ids(source.hidden).filter((id) => !MenuPrefs.required.includes(id));
    return {
      order: ids(source.order),
      pinned: ids(source.pinned).filter((id) => !hidden.includes(id)),
      hidden,
      customized: source.customized === true,
      showIcons: source.showIcons !== false,
      showWalker: source.showWalker !== false,
    };
  },
  read() {
    const key = MenuPrefs.key();
    if (!MenuPrefs.cache.has(key)) {
      let saved;
      try {
        saved = JSON.parse(window.localStorage.getItem(key) || 'null');
      } catch (error) {}
      MenuPrefs.cache.set(key, MenuPrefs.normalize(saved));
    }
    return MenuPrefs.cache.get(key);
  },
  save(prefs) {
    const normalized = MenuPrefs.normalize(prefs);
    MenuPrefs.cache.set(MenuPrefs.key(), normalized);
    try {
      window.localStorage.setItem(MenuPrefs.key(), JSON.stringify(normalized));
    } catch (error) {
      toast('Порядок изменён, но браузер не смог сохранить его для следующего входа.');
    }
  },
  pinned(id) {
    return MenuPrefs.read().pinned.includes(id);
  },
  arrange(items) {
    const prefs = MenuPrefs.read(),
      rank = new Map(prefs.order.map((id, index) => [id, index]));
    return items
      .map((item, index) => ({item, index}))
      .sort(
        (a, b) =>
          Number(prefs.pinned.includes(b.item.id)) - Number(prefs.pinned.includes(a.item.id)) ||
          (rank.has(a.item.id) ? rank.get(a.item.id) : prefs.order.length + a.index) -
            (rank.has(b.item.id) ? rank.get(b.item.id) : prefs.order.length + b.index),
      )
      .map((x) => x.item);
  },
  toggle(id) {
    const items = navAvailable();
    if (!items.some((t) => t.id === id) || MenuPrefs.hidden(id)) return;
    const prefs = MenuPrefs.read();
    MenuPrefs.save({
      ...prefs,
      customized: true,
      pinned: prefs.pinned.includes(id) ? prefs.pinned.filter((x) => x !== id) : prefs.pinned.concat(id),
    });
  },
  move(id, direction) {
    const items = MenuPrefs.arrange(navAvailable()),
      index = items.findIndex((t) => t.id === id),
      next = index + direction;
    if (
      ![-1, 1].includes(direction) ||
      index < 0 ||
      next < 0 ||
      next >= items.length ||
      MenuPrefs.pinned(id) !== MenuPrefs.pinned(items[next].id)
    )
      return false;
    [items[index], items[next]] = [items[next], items[index]];
    MenuPrefs.save({...MenuPrefs.read(), customized: true, order: items.map((t) => t.id)});
    return true;
  },
  drop(id, target) {
    const items = MenuPrefs.arrange(navAvailable()),
      from = items.findIndex((t) => t.id === id),
      to = items.findIndex((t) => t.id === target);
    if (from < 0 || to < 0 || from === to || MenuPrefs.pinned(id) !== MenuPrefs.pinned(target)) return false;
    const [item] = items.splice(from, 1);
    items.splice(to, 0, item);
    MenuPrefs.save({...MenuPrefs.read(), customized: true, order: items.map((t) => t.id)});
    return true;
  },
  reset() {
    MenuPrefs.save({order: [], pinned: [], customized: false, showIcons: MenuPrefs.iconsVisible()});
  },
  button() {
    return '<button class="btn ghost menu-customize" data-action="menu-customize">↕ Настроить меню</button>';
  },
  card() {
    return '<section class="card set-sec"><h2>Моё меню</h2><div class="set-row"><div><b>Видимость, порядок и закрепы</b><p>Скройте ненужные вкладки, поднимите важное наверх и закрепите любимые разделы.</p></div><button class="btn" data-action="menu-customize">Настроить</button></div></section>';
  },
  html() {
    const items = MenuPrefs.arrange(navAvailable()),
      pinned = items.filter((t) => MenuPrefs.pinned(t.id));
    const row = (t, index) => {
      const isPinned = MenuPrefs.pinned(t.id),
        hidden = MenuPrefs.hidden(t.id),
        required = MenuPrefs.required.includes(t.id);
      const visibility =
        '<button class="icon-btn menu-visibility" data-action="menu-visibility" data-id="' +
        t.id +
        '" role="switch" aria-checked="' +
        !hidden +
        '" aria-label="' +
        (required ? 'Обязательная вкладка: ' : hidden ? 'Показать вкладку: ' : 'Скрыть вкладку: ') +
        U.esc(t.label) +
        '"' +
        (required ? ' disabled' : '') +
        '>' +
        (required ? '🔒' : hidden ? '○' : '👁') +
        '</button>';
      const control = (dir, label, icon) =>
        '<button class="icon-btn menu-move" data-action="menu-move" data-id="' +
        t.id +
        '" data-dir="' +
        dir +
        '" aria-label="' +
        label +
        ': ' +
        U.esc(t.label) +
        '"' +
        (!items[index + dir] || MenuPrefs.pinned(items[index + dir].id) !== isPinned ? ' disabled' : '') +
        '>' +
        icon +
        '</button>';
      return (
        '<li class="menu-order-row' +
        (hidden ? ' is-hidden' : '') +
        '" data-menu-item="' +
        t.id +
        '"><span class="menu-drag" draggable="true" data-menu-drag="' +
        t.id +
        '" aria-hidden="true" title="Перетащите вверх или вниз">⠿</span>' +
        (MenuPrefs.iconsVisible() ? '<span class="menu-item-icon">' + t.ico + '</span>' : '') +
        '<span class="menu-item-name"><b>' +
        U.esc(t.label) +
        (required ? '<small>Обязательная</small>' : hidden ? '<small>Скрыта</small>' : '') +
        '</b></span><span class="menu-controls">' +
        control(-1, 'Поднять', '↑') +
        control(1, 'Опустить', '↓') +
        '<button class="icon-btn menu-pin' +
        (isPinned ? ' on' : '') +
        '" data-action="menu-pin" data-id="' +
        t.id +
        '" aria-pressed="' +
        isPinned +
        '" aria-label="' +
        (isPinned ? 'Открепить' : 'Закрепить') +
        ': ' +
        U.esc(t.label) +
        '"' +
        (hidden ? ' disabled' : '') +
        '>📌</button>' +
        visibility +
        '</span></li>'
      );
    };
    return (
      '<div class="personal-menu"><p class="md-help">Перетаскивайте за ⠿ или нажимайте ↑ и ↓. Кнопка 📌 закрепляет вкладку наверху. Закреплённые вкладки можно упорядочить между собой.</p><p class="md-help">Расписание, посещаемость, журнал, чаты и личный кабинет скрыть нельзя. Настройки всегда доступны, чтобы вернуть вкладки. Нажмите 👁, чтобы скрыть необязательный раздел, или ○, чтобы показать его снова.</p><p class="md-help">На телефоне первые 6 вкладок будут в нижней панели, остальные — в «Ещё». Ваш выбор сохраняется только для вашего аккаунта в этом браузере.</p>' +
      '<div class="menu-icons-setting"><div><b>Смайлики вкладок</b><p>Один переключатель для всего меню.</p></div><button class="menu-icons-toggle" data-action="menu-icons" role="switch" aria-label="Показывать смайлики вкладок" aria-checked="' +
      MenuPrefs.iconsVisible() +
      '"><span aria-hidden="true"></span></button></div>' +
      (pinned.length
        ? '<h4>Закреплённые</h4><ol class="menu-order">' +
          items.map((t, i) => (MenuPrefs.pinned(t.id) ? row(t, i) : '')).join('') +
          '</ol>'
        : '') +
      '<h4>Все разделы</h4><ol class="menu-order">' +
      items.map((t, i) => (!MenuPrefs.pinned(t.id) ? row(t, i) : '')).join('') +
      '</ol><p class="menu-save-status" role="status">Изменения сохраняются автоматически</p><div class="menu-editor-footer"><button class="btn ghost" data-action="menu-reset">Вернуть обычный порядок</button><button class="btn primary" data-action="modal-close">Готово</button></div></div>'
    );
  },
  open() {
    UI.open('Настроить моё меню', MenuPrefs.html(), {wide: true, noFocus: true});
  },
  refresh(id, action, direction) {
    App.render();
    const body = document.querySelector('#modal-root .modal-body'),
      scroll = body && body.scrollTop;
    if (!body || !body.querySelector('.personal-menu')) return;
    body.innerHTML = MenuPrefs.html();
    body.scrollTop = scroll;
    if (id && action) {
      const button = body.querySelector(
        '[data-action="' +
          action +
          '"][data-id="' +
          id +
          '"]' +
          (direction ? '[data-dir="' + direction + '"]' : ''),
      );
      if (button) button.focus({preventScroll: true});
    }
  },
};

document.addEventListener('dragstart', (event) => {
  const handle = event.target.closest && event.target.closest('[data-menu-drag]');
  if (!handle || !event.dataTransfer) return;
  MenuPrefs.dragged = {id: handle.dataset.menuDrag, key: MenuPrefs.key()};
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', handle.dataset.menuDrag);
});
document.addEventListener('dragover', (event) => {
  const row = event.target.closest && event.target.closest('[data-menu-item]'),
    drag = MenuPrefs.dragged;
  if (
    row &&
    drag &&
    drag.key === MenuPrefs.key() &&
    MenuPrefs.pinned(drag.id) === MenuPrefs.pinned(row.dataset.menuItem)
  ) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }
});
document.addEventListener('drop', (event) => {
  const row = event.target.closest && event.target.closest('[data-menu-item]'),
    drag = MenuPrefs.dragged;
  MenuPrefs.dragged = null;
  if (!row || !drag || drag.key !== MenuPrefs.key()) return;
  event.preventDefault();
  if (MenuPrefs.drop(drag.id, row.dataset.menuItem)) MenuPrefs.refresh(drag.id, 'menu-pin');
});
document.addEventListener('dragend', () => {
  MenuPrefs.dragged = null;
});
window.addEventListener('storage', (event) => {
  if (event.key === MenuPrefs.key()) {
    MenuPrefs.cache.delete(event.key);
    App.renderSoft();
  }
});
