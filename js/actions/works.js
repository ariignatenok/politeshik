'use strict';

Object.assign(A, {
  /**
   * Открывает форму новой работы.
   */
  'add-work'() {
    openWorkForm();
  },
  /**
   * Фильтрует работы на главной по типу.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'dash-filter'(el) {
    ui.dashFilter = el.dataset.f;
    App.render();
  },
  /**
   * Открывает правку работы или ДЗ.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'edit-item'(el) {
    el.dataset.kind === 'work' ? openWorkForm(el.dataset.id) : openHwForm(el.dataset.id);
  },
  /**
   * Удаляет работу или ДЗ после подтверждения.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'del-item'(el) {
    if (!(await UI.confirm('Удалить эту запись?'))) return;
    const s = Store.s;
    if (el.dataset.kind === 'work') s.works = s.works.filter(x => x.id !== el.dataset.id);
    else s.homework = s.homework.filter(x => x.id !== el.dataset.id);
    Store.commit();
  },
  /**
   * Открывает форму нового ДЗ.
   */
  'hw-add'() {
    openHwNewForm();
  },
  /**
   * Фильтрует ДЗ по предмету.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'hw-filter'(el) {
    ui.hwSubject = el.dataset.s;
    App.render();
  }
});
