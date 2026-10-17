'use strict';

Object.assign(A, {
  /**
   * Переключает раздел приложения.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  nav(el) {
    Mascot.walk();
    const t = el.dataset.tab;
    if (t === 'chat') ui.chatWith = null;
    if (t === 'subjects' && ui.tab === 'subjects') ui.subjectId = null;
    ui.tab = t;
    App.render(true);
    window.scrollTo(0, 0);
  },
  /**
   * Открывает меню выбора темы.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  theme(el) {
    const pop = $('#theme-pop');
    if (!pop.hidden) {
      pop.hidden = true;
      return;
    }
    pop.innerHTML = THEMES.map(
      t =>
        '<button class="' +
        (Store.s.settings.theme === t.id ? 'on' : '') +
        '" data-action="set-theme" data-theme="' +
        t.id +
        '"><span class="ti">' +
        t.ico +
        '</span>' +
        t.name +
        '</button>'
    ).join('');
    const r = el.getBoundingClientRect();
    pop.hidden = false;
    const w = pop.offsetWidth || 220,
      h = pop.offsetHeight || 320;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
    pop.style.top = (r.top - h - 8 > 8 ? r.top - h - 8 : Math.min(window.innerHeight - h - 8, r.bottom + 8)) + 'px';
  },
  /**
   * Применяет выбранную тему оформления и сохраняет её в профиле.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'set-theme'(el) {
    const id = el.dataset.theme;
    if (THEME_IDS.indexOf(id) < 0) return;
    Store.s.settings.theme = id;
    Store.save();
    UI.applyTheme();
    $('#theme-pop').hidden = true;
    if (Cloud.profile) {
      Cloud.profile.theme = id;
      Cloud.pushProfile();
    }
    App.render();
  },
  /**
   * Закрывает окно.
   */
  'modal-close'() {
    if (UI.locked) return;
    UI.close();
  },
  /**
   * Передаёт форму её обработчику из Forms.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'save-form'(el) {
    const f = el.closest('[data-form]');
    if (f && !canEdit() && (RO_FORMS.has(f.dataset.form) || (f.dataset.form === 'note' && f.dataset.sid)))
      return toast('Это может делать только админ группы');
    if (f && Forms[f.dataset.form]) Forms[f.dataset.form](f);
  },
  /**
   * Запрашивает у браузера разрешение на уведомления.
   */
  async 'notif-ask'() {
    const r = await Notifier.ask();
    toast(
      r === 'granted'
        ? 'Уведомления включены'
        : r === 'unsupported'
          ? 'Браузер не поддерживает уведомления — покажу всплывашки'
          : 'Уведомления не разрешены'
    );
    App.render();
  },
  /**
   * Откладывает вопрос об уведомлениях.
   */
  'notif-later'() {
    Store.s.settings.notifAsked = true;
    Store.save();
    App.render();
  },
  /**
   * Задаёт, за сколько минут напоминать о паре.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'notif-lead'(el) {
    const n = Object.assign({}, Store.s.settings.notif || {});
    n.lead = +el.dataset.m;
    Store.s.settings.notif = n;
    Store.save();
    App.render();
  },
  /**
   * Предлагает установить приложение на устройство.
   */
  install() {
    if (installEvt) {
      installEvt.prompt();
      installEvt = null;
    }
  },
  /**
   * Восстанавливает стартовые карточки и конспекты.
   */
  'restore-content'() {
    const n = Store.restoreContent();
    toast(n ? 'Добавлено: ' + n : 'Всё уже на месте');
  },
  /**
   * Скачивает резервную копию.
   */
  export() {
    Backup.download();
  },
  /**
   * Показывает резервную копию текстом.
   */
  'export-show'() {
    Backup.show();
  },
  /**
   * Открывает вставку копии из буфера.
   */
  'import-paste'() {
    Backup.pasteDialog();
  },
  /**
   * Загружает данные из вставленного текста.
   */
  'import-run'() {
    Backup.run(($('#import-text') || {}).value || '');
  },
  /**
   * Копирует резервную копию в буфер обмена.
   */
  'copy-json'() {
    Backup.copy();
  },
  /**
   * Возвращает стартовые данные после подтверждения.
   */
  async reset() {
    if (await UI.confirm('Вернуть стартовые данные? Всё, что вы добавили, пропадёт.', 'Сбросить')) {
      Store.reset();
      toast('Данные сброшены');
    }
  },
  /**
   * Удаляет все данные после подтверждения.
   */
  async clear() {
    if (await UI.confirm('Удалить ВСЕ данные планировщика? Это нельзя отменить.', 'Очистить')) {
      ui.subjectId = null;
      Store.clear();
      toast('Всё очищено');
    }
  }
});
