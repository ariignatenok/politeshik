'use strict';

Object.assign(A, {
  /**
   * Переключает вход между студентом и преподавателем.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'login-role'(el) {
    const form = $('#gate [data-form="login"]'),
      email = form ? form.querySelector('[name=email]') : null;
    ui.loginDraft = {
      email: email ? email.value : ''
    };
    ui.loginRole = el.dataset.role === 'teacher' ? 'teacher' : 'student';
    $('#gate').dataset.mode = '';
    App.render();
  },
  /**
   * Скачивает файл календаря для одного дедлайна.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'ics-item'(el) {
    const item = dashItems().find(i => i.id === el.dataset.id);
    if (!item) return;
    Ics.download([item], 'politeshik-' + Ics.slug(item.title));
    toast('Файл календаря сохранён. Откройте его, чтобы добавить событие.');
  },
  /**
   * Скачивает файл календаря со всеми ближайшими дедлайнами.
   */
  'ics-all'() {
    const items = dashItems().filter(i => !i.done);
    if (!items.length) return toast('Нет ближайших дедлайнов');
    Ics.download(items, 'politeshik-dedlajny');
    toast('Календарь сохранён: ' + items.length + ' ' + U.plural(items.length, 'событие', 'события', 'событий'));
  },
  /**
   * Открывает окно поиска.
   */
  'search-open'() {
    Search.open();
  },
  /**
   * Открывает меню быстрого добавления.
   */
  'fab-toggle'() {
    QuickAdd.toggle();
  },
  /**
   * Выполняет выбранное быстрое действие.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'fab-pick'(el) {
    QuickAdd.pick(el.dataset.pick);
  },
  /**
   * Открывает конспекты предмета из окна о пропущенных парах.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'sick-notes'(el) {
    UI.close();
    ui.tab = 'subjects';
    ui.subjectId = el.dataset.id;
    ui.subjTab = 'notes';
    App.render(true);
  },
  /**
   * Включает или выключает сезонный наряд Политешика.
   */
  'mascot-acc'() {
    Store.s.settings.mascotAccessories = !Mascot.enabled();
    Store.save();
    ['brand-mascot', 'top-mascot'].forEach(id => {
      const node = document.getElementById(id);
      if (node) node.dataset.m = '';
    });
    App.render(true);
    toast(Mascot.enabled() ? 'Наряд Политешика включён' : 'Наряд Политешика выключен');
  },
  /**
   * Сохраняет настроение дня.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  mood(el) {
    Support.setMood(el.dataset.v);
  },
  /**
   * Отправляет обнимашки в чате с Политешиком.
   */
  hug() {
    Support.hug();
  },
  /**
   * Запускает праздничное конфетти.
   */
  'bday-confetti'() {
    Confetti.burst({
      count: 110
    });
  },
  /**
   * Ставит или снимает лайк новости.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'news-like'(el) {
    await News.like(el.dataset.id);
    App.render();
  }
});
