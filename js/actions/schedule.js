'use strict';

Object.assign(A, {
  /**
   * Переключает неделю расписания: числитель или знаменатель.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'sched-week'(el) {
    ui.schedWeek = el.dataset.week;
    App.render();
  },
  /**
   * Выбирает день недели в мобильном расписании.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'sched-day'(el) {
    ui.schedDay = +el.dataset.day;
    App.render();
  },
  /**
   * Открывает форму новой пары для выбранной ячейки.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'cell-add'(el) {
    if (lockSched()) return;
    openLessonForm(null, {
      day: +el.dataset.day,
      pair: +el.dataset.pair
    });
  },
  /**
   * Открывает правку пары.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'cell-edit'(el) {
    if (lockSched()) return;
    openLessonForm(el.dataset.id, null, el.dataset.date);
  },
  /**
   * Отменяет пару на выбранную дату.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'chg-cancel'(el) {
    const l = Store.s.schedule.find(x => x.id === el.dataset.id),
      date = ($('#chg-date') || {}).value,
      err = Changes.check(l, date);
    if (err) return toast(err);
    Changes.upsert({
      type: 'cancel',
      date,
      pair: l.pair,
      subjectId: l.subjectId,
      reason: ''
    });
    UI.close();
    App.render();
    toast('Пара отменена на ' + U.fmtShort(U.fromISO(date)) + '. Студенты увидят «ОТМЕНЕНА»');
  },
  /**
   * Открывает форму замены пары.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'chg-replace'(el) {
    const l = Store.s.schedule.find(x => x.id === el.dataset.id),
      date = ($('#chg-date') || {}).value,
      err = Changes.check(l, date);
    if (err) return toast(err);
    UI.close();
    openChangeForm({
      date,
      pair: l.pair,
      subjectId: l.subjectId
    });
  },
  /**
   * Убирает отмену или замену пары.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'chg-del'(el) {
    Changes.remove(el.dataset.id);
    App.render();
    toast('Изменение убрано');
  },
  /**
   * Удаляет пару из шаблона расписания.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'lesson-del'(el) {
    const id = el.closest('[data-form]').dataset.id;
    if (!(await UI.confirm('Удалить эту пару из расписания?'))) return;
    Store.s.schedule = Store.s.schedule.filter(l => l.id !== id);
    UI.close();
    Store.commit();
  },
  /**
   * Открывает форму времени пар.
   */
  times() {
    if (lockSched()) return;
    openTimesForm();
  },
  /**
   * Добавляет номер пары в расписание звонков.
   */
  'pair-add'() {
    const m = $('#modal-root [data-form="times"]');
    if (m) Forms.times(m);
    if (Store.s.settings.pairs.length >= 10) return toast('Максимум 10 пар');
    Store.s.settings.pairs.push({
      start: '',
      end: ''
    });
    Store.save();
    openTimesForm();
    App.render();
  },
  /**
   * Удаляет последний номер пары.
   */
  async 'pair-del'() {
    const n = Store.s.settings.pairs.length;
    if (!(await UI.confirm('Убрать ' + n + '-ю пару? Занятия в ней тоже удалятся.', 'Убрать'))) return;
    Store.s.settings.pairs.pop();
    Store.s.schedule = Store.s.schedule.filter(l => l.pair < n);
    Store.save();
    openTimesForm();
    App.render();
  },
  /**
   * Меняет местами числитель и знаменатель.
   */
  'swap-week'() {
    if (lockSched()) return;
    const a = U.fromISO(Store.s.settings.numeratorAnchor);
    Store.s.settings.numeratorAnchor = U.iso(U.addDays(a, 7));
    ui.schedWeek = null;
    Store.commit();
    toast('Числитель и знаменатель поменялись местами');
  }
});
