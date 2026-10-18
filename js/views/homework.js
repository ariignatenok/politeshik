'use strict';

/**
 * Строит строку ДЗ со сроком сдачи и статусом.
 * @param {Object} h ДЗ.
 * @returns {string} HTML.
 */
function hwRow(h) {
  const sb = subj(h.subjectId),
    past = !hwUpcoming(h),
    u = past || !h.deadline ? 'none' : urgency(h.deadline, '');
  return (
    '<div class="item u-' +
    u +
    (past ? ' is-done' : '') +
    '"><div class="item-main"><div class="item-title">' +
    U.esc(h.text) +
    '</div><div class="item-meta">' +
    (sb ? '<span class="chip" style="--c:' + sb.color + '">' + U.esc(sb.short || sb.name) + '</span>' : '') +
    '<span class="tag status ' +
    (past ? 'past' : 'prep') +
    '">' +
    (past ? 'Срок прошёл' : 'Готовиться') +
    '</span></div></div>' +
    '<div class="item-when">' +
    (h.deadline
      ? '<b>' +
        (past ? 'Прошло' : relLabel(h.deadline)) +
        '</b><small>Срок сдачи: ' +
        shortDate(h.deadline) +
        '</small>'
      : '<small>Срок не указан</small>') +
    '</div>' +
    '<div class="item-actions">' +
    (h.deadline && !past
      ? '<button class="icon-btn" data-action="ics-item" data-id="' +
        h.id +
        '" title="Добавить в календарь" aria-label="Добавить в календарь">' +
        ICONS.calendarDay +
        '</button>'
      : '') +
    (canEdit()
      ? '<button class="icon-btn" data-action="edit-item" data-kind="hw" data-id="' +
        h.id +
        '" aria-label="Изменить">' +
        ICONS.pencil +
        '</button><button class="icon-btn" data-action="del-item" data-kind="hw" data-id="' +
        h.id +
        '" aria-label="Удалить">' +
        ICONS.wastebasket +
        '</button>'
      : '') +
    '</div></div>'
  );
}
/**
 * Отрисовывает экран «Домашка».
 * @returns {string} HTML.
 */
function viewHw() {
  const state = Store.s,
    f = ui.hwSubject || 'all';
  const subs = state.subjects.filter(x => state.homework.some(h => h.subjectId === x.id));
  const hs = state.homework.filter(h => f === 'all' || h.subjectId === f);
  /**
   * Сравнивает ДЗ по сроку для сортировки.
   * @param {Object} a Первое ДЗ.
   * @param {Object} b Второе ДЗ.
   * @returns {number} Число.
   */
  const byDate = (a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999');
  const soon = hs.filter(h => h.deadline && hwUpcoming(h)).sort(byDate),
    nodate = hs.filter(h => !h.deadline),
    past = hs
      .filter(h => !hwUpcoming(h))
      .sort(byDate)
      .reverse();
  /**
   * Строит группу ДЗ с заголовком.
   * @param {string} t Заголовок группы.
   * @param {Array<Object>} a Записи группы.
   * @returns {string} HTML.
   */
  const sec = (t, a) =>
    a.length
      ? '<h3 class="fgroup">' +
        t +
        ' <span class="tag">' +
        a.length +
        '</span></h3><div class="items">' +
        a.map(hwRow).join('') +
        '</div>'
      : '';
  return (
    '<div class="page-head"><div><h1>Домашка</h1><p>Домашние задания со сроками сдачи. Контрольные и зачёты на паре — на «Главной».</p></div>' +
    '<div class="head-actions"><button class="btn" data-action="ics-all">' +
    ICONS.calendarDay +
    ' Все дедлайны в календарь</button>' +
    (canEdit() ? '<button class="btn primary" data-action="hw-add">＋ Добавить ДЗ</button>' : '') +
    '</div></div>' +
    '<div class="grid-stats"><div class="stat"><b>' +
    soon.length +
    '</b><small>со сроком впереди</small></div><div class="stat"><b>' +
    nodate.length +
    '</b><small>без срока</small></div><div class="stat"><b>' +
    past.length +
    '</b><small>срок прошёл</small></div></div>' +
    (subs.length > 1
      ? '<div class="chips"><button class="fchip' +
        (f === 'all' ? ' on' : '') +
        '" data-action="hw-filter" data-s="all">Все предметы</button>' +
        subs
          .map(
            x =>
              '<button class="fchip' +
              (f === x.id ? ' on' : '') +
              '" data-action="hw-filter" data-s="' +
              x.id +
              '">' +
              U.esc(x.short || x.name) +
              '</button>'
          )
          .join('') +
        '</div>'
      : '') +
    (hs.length
      ? sec('Ближайшие', soon) +
        sec('Без срока', nodate) +
        (past.length
          ? '<details class="done-box"><summary>Прошедшие (' +
            past.length +
            ')</summary><div class="items">' +
            past.map(hwRow).join('') +
            '</div></details>'
          : '')
      : emptyMascot('Ура, домашки нет!', 'happy'))
  );
}
/**
 * Открывает форму нового ДЗ.
 */
function openHwNewForm() {
  const state = Store.s;
  UI.open(
    'Новое домашнее задание',
    '<div data-form="hwg">' +
      field(
        'Предмет',
        '<select class="input" name="subjectId">' +
          subjectOptions(ui.hwSubject && ui.hwSubject !== 'all' ? ui.hwSubject : '') +
          '</select>'
      ) +
      field('Задание', '<textarea class="input" name="text" rows="3" placeholder="Что нужно сделать"></textarea>') +
      field('Срок сдачи (необязательно)', '<input class="input" type="date" name="deadline">') +
      foot(null, 'Добавить') +
      '</div>'
  );
}
