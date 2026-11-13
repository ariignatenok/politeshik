'use strict';

Object.assign(A, {
  'menu-icons'(){MenuPrefs.toggleIcons();MenuPrefs.refresh();},
  'menu-visibility'(el) { MenuPrefs.visibility(el.dataset.id); MenuPrefs.refresh(el.dataset.id,'menu-visibility'); },
  'menu-customize'() { MenuPrefs.open(); },
  'menu-pin'(el) { MenuPrefs.toggle(el.dataset.id); MenuPrefs.refresh(el.dataset.id,'menu-pin'); },
  'menu-move'(el) { MenuPrefs.move(el.dataset.id,Number(el.dataset.dir)); MenuPrefs.refresh(el.dataset.id,'menu-move',el.dataset.dir); },
  'menu-reset'() { MenuPrefs.reset(); MenuPrefs.refresh(); },
  /** Открывает список выбранной группы после серверной проверки доступа. */
  'group-open'(el) { return Groups.switchTo(el.dataset.group, true, el.dataset.tab || 'group'); },
  /**
   * Переключает раздел приложения.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  nav(el) {
    Mascot.walk();
    const t = el.dataset.tab;
    if (t !== 'map' && typeof MapRoutes !== 'undefined') { MapRoutes.pending=null; ui.mapPlacing=false; }
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
    pop.innerHTML = Themes.available()
      .map(
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
      )
      .join('');
    const r=el.getBoundingClientRect(),vp=window.visualViewport;
    const left=(vp?.offsetLeft||0)+12,top=(vp?.offsetTop||0)+12;
    const right=left+(vp?.width||window.innerWidth)-24;
    let bottom=top+(vp?.height||window.innerHeight)-24;
    const tabbar=$('#nav-bottom');
    if(tabbar?.getClientRects().length){const nav=tabbar.getBoundingClientRect();if(nav.top>r.bottom)bottom=Math.min(bottom,nav.top-8);}
    pop.style.minWidth=Math.min(210,Math.max(0,right-left))+'px';
    pop.style.maxWidth=Math.max(0,right-left)+'px';
    pop.style.maxHeight=Math.max(0,bottom-top)+'px';
    pop.hidden=false;
    const w=pop.offsetWidth,h=pop.offsetHeight;
    const below=Math.max(0,bottom-r.bottom-8),above=Math.max(0,r.top-8-top);
    const opensBelow=below>=h||below>=above,space=opensBelow?below:above;
    pop.style.maxHeight=space+'px';
    pop.style.left=Math.max(left,Math.min(right-w,r.left))+'px';
    pop.style.top=Math.max(top,opensBelow?r.bottom+8:r.top-pop.offsetHeight-8)+'px';
  },
  /**
   * Применяет выбранную тему оформления и сохраняет её в профиле.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'set-theme'(el) {
    const id = el.dataset.theme;
    if (!Themes.available().some(x => x.id === id)) return;
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
    if(ui.tab==='chat')App.renderSoft();
  },
  /**
   * Передаёт форму её обработчику из Forms.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'save-form'(el) {
    const f = el.closest('[data-form]');
    if (
      f &&
      !canEdit() &&
      !(Cloud.isCurator && f.dataset.form === 'att-edit') &&
      (RO_FORMS.has(f.dataset.form) || (f.dataset.form === 'note' && f.dataset.sid))
    )
      return toast('Это может делать только админ группы');
    if (f && Forms[f.dataset.form]) Forms[f.dataset.form](f);
  },
  /**
   * Запрашивает у браузера разрешение на уведомления.
   */
  async 'notif-ask'() {
    const result = await Notifier.ask();
    if (result === 'granted') toast('Уведомления включены');
    else UI.open('Как включить уведомления', Notifier.helpHtml(result));
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
