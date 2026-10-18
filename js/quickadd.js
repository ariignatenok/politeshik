'use strict';

const QuickAdd = {
  isOpen: false,
  tabs: ['dashboard', 'schedule', 'hw', 'subjects', 'attendance', 'news'],
  /**
   * Возвращает пункты быстрого добавления для роли пользователя.
   * @returns {Array<Object>} Массив.
   */
  items() {
    if (Cloud.isTeacher || document.body.classList.contains('gated')) return [];
    if (canEdit()) {
      return [
        {
          id: 'hw',
          label: 'ДЗ',
          ico: ICONS.memo
        },
        {
          id: 'work',
          label: 'Работа или зачёт',
          ico: ICONS.alarmClock
        },
        {
          id: 'note',
          label: 'Заметка',
          ico: ICONS.notebook
        }
      ];
    }
    return [
      {
        id: 'note',
        label: 'Заметка',
        ico: ICONS.notebook
      }
    ];
  },
  /**
   * Показывает или прячет кнопку плюс и её меню.
   */
  sync() {
    const wrap = document.getElementById('fab-wrap'),
      menu = document.getElementById('fab-menu'),
      button = document.getElementById('fab');
    if (!wrap || !button) return;
    const items = QuickAdd.items();
    wrap.hidden = !items.length || QuickAdd.tabs.indexOf(ui.tab) < 0;
    if (wrap.hidden) QuickAdd.isOpen = false;
    menu.hidden = !(QuickAdd.isOpen && items.length > 1);
    button.setAttribute('aria-expanded', QuickAdd.isOpen ? 'true' : 'false');
    button.classList.toggle('open', QuickAdd.isOpen);
    menu.innerHTML =
      items.length > 1
        ? items
            .map(
              i =>
                '<button class="fab-item" data-action="fab-pick" data-pick="' +
                i.id +
                '"><span>' +
                i.label +
                '</span><b>' +
                i.ico +
                '</b></button>'
            )
            .join('')
        : '';
  },
  /**
   * Открывает меню быстрого добавления или сразу единственное действие.
   */
  toggle() {
    const items = QuickAdd.items();
    if (items.length === 1) {
      QuickAdd.pick(items[0].id);
      return;
    }
    QuickAdd.isOpen = !QuickAdd.isOpen;
    QuickAdd.sync();
  },
  /**
   * Закрывает меню быстрого добавления.
   */
  close() {
    if (!QuickAdd.isOpen) return;
    QuickAdd.isOpen = false;
    QuickAdd.sync();
  },
  /**
   * Запускает выбранное быстрое действие.
   * @param {string} id Действие: hw, work или note.
   */
  pick(id) {
    QuickAdd.isOpen = false;
    QuickAdd.sync();
    if (id === 'hw') A['hw-add']();
    else if (id === 'work') A['add-work']();
    else openNoteEditor(null, '');
  }
};
document.addEventListener('click', event => {
  if (QuickAdd.isOpen && !(event.target.closest && event.target.closest('#fab-wrap'))) QuickAdd.close();
});
