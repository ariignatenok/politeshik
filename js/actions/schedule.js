'use strict';

Object.assign(A, {
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
    openLessonForm(
      null,
      {
        day: +el.dataset.day,
        pair: +el.dataset.pair
      },
      ui.schedWs
    );
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
    const date = ($('#chg-date') || {}).value,
      l = Weeks.find(el.dataset.id, Weeks.start(date || U.today())),
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
    const date = ($('#chg-date') || {}).value,
      l = Weeks.find(el.dataset.id, Weeks.start(date || U.today())),
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
    const form = el.closest('[data-form]'),
      id = form.dataset.id,
      ws = form.dataset.ws || Weeks.start(U.today());
    if (!(await UI.confirm('Убрать эту пару на неделе ' + Weeks.label(ws) + '?', 'Убрать'))) return;
    Weeks.removeLesson(ws, id);
    UI.close();
    Store.commit();
    toast('Пара убрана на этой неделе');
  },
  /**
   * Удаляет пару из шаблона всех недель.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'lesson-del-all'(el) {
    const form = el.closest('[data-form]'),
      id = form.dataset.id,
      ws = form.dataset.ws || Weeks.start(U.today());
    if (
      !(await UI.confirm(
        'Удалить пару из шаблона? Недели без собственных правок потеряют её, недели с правками не изменятся.',
        'Удалить'
      ))
    )
      return;
    Store.s.schedule = Store.s.schedule.filter(l => l.id !== id);
    if (Weeks.has(ws)) Weeks.removeLesson(ws, id);
    UI.close();
    Store.commit();
    toast('Пара удалена из шаблона');
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
    Object.keys(Store.s.weeks).forEach(k => {
      Store.s.weeks[k] = Store.s.weeks[k].filter(l => l.pair < n);
    });
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
