'use strict';

/**
 * Строит плашку пары в расписании.
 * @param {Object} l Пара расписания.
 * @param {boolean} wide Широкая плашка.
 * @param {string} state Состояние пары.
 * @param {string} date Дата.
 * @returns {string} HTML.
 */
function lessonChip(l, wide, state, date) {
  const sb = subj(l.subjectId),
    c = sb ? sb.color : '#94a3b8';
  const sub = [l.room ? 'ауд. ' + l.room : '', l.subgroup, wide ? l.who : surname(l.who)].filter(Boolean).join(' · ');
  const t = l.start && l.end ? '<small>' + ICONS.alarmClock + ' ' + l.start + '–' + l.end + '</small>' : '';
  return (
    '<button class="lesson' +
    (state === 'cancel' ? ' cancelled' : state === 'replaced' ? ' was' : '') +
    '" style="--c:' +
    c +
    '" data-action="cell-edit" data-id="' +
    l.id +
    '"' +
    (date ? ' data-date="' + date + '"' : '') +
    ' title="' +
    U.esc((sb ? sb.name : '') + (l.who ? ' — ' + l.who : '')) +
    '">' +
    '<b>' +
    U.esc(sb ? (wide ? sb.name : sb.short || sb.name) : 'Без предмета') +
    '</b>' +
    (sub ? '<small>' + U.esc(sub) + '</small>' : '') +
    t +
    (state === 'cancel'
      ? '<span class="wk cancel-b">ОТМЕНЕНА</span>'
      : l.week !== 'both'
        ? '<span class="wk">' + (l.week === 'num' ? 'числ.' : 'знам.') + '</span>'
        : '') +
    '</button>'
  );
}
/**
 * Строит содержимое ячейки расписания с отменами и заменами.
 * @param {number} d Номер дня недели.
 * @param {number} n Номер пары.
 * @param {string} date Дата.
 * @param {boolean} wide Широкая плашка.
 * @returns {string} HTML.
 */
function cellChips(d, n, date, wide) {
  const ls = Store.s.schedule.filter(
      l => l.day === d && l.pair === n && (l.week === 'both' || l.week === ui.schedWeek)
    ),
    ch = Changes.at(date, n);
  let h = ls.map(l => lessonChip(l, wide, ch ? (ch.type === 'cancel' ? 'cancel' : 'replaced') : '', date)).join('');
  if (ch && ch.type === 'replace') {
    const sb = subj(ch.newSubjectId);
    h +=
      '<div class="lesson repl" style="--c:' +
      (sb ? sb.color : '#f59e0b') +
      '"><b>' +
      U.esc(sb ? (wide ? sb.name : sb.short || sb.name) : 'Замена') +
      '</b><small>' +
      U.esc([ch.newRoom ? 'ауд. ' + ch.newRoom : '', ch.newTeacher].filter(Boolean).join(' · ')) +
      '</small>' +
      (ch.reason ? '<small>' + U.esc(ch.reason) + '</small>' : '') +
      '<span class="wk repl-b">ЗАМЕНА</span></div>';
  }
  return h;
}
/**
 * Строит список ближайших изменений расписания.
 * @returns {string} HTML.
 */
function changesCard() {
  const today = U.iso(U.today()),
    list = Changes.items()
      .filter(c => c.date >= today)
      .sort((a, b) => (a.date + a.pair).localeCompare(b.date + b.pair));
  if (!list.length) return '';
  return (
    '<section class="card chg-card"><h2>Изменения в расписании</h2><div class="items">' +
    list
      .map(c => {
        const d = Changes.describe(c);
        return (
          '<div class="item ' +
          (c.type === 'cancel' ? 'u-red' : 'u-yellow') +
          '"><div class="item-main"><div class="item-title">' +
          (c.type === 'cancel' ? ICONS.crossMark + ' ' : ICONS.repeat + ' ') +
          U.esc(d.body) +
          '</div></div>' +
          (canEdit()
            ? '<div class="item-actions"><button class="icon-btn" data-action="chg-del" data-id="' +
              c.id +
              '" aria-label="Убрать изменение">' +
              ICONS.wastebasket +
              '</button></div>'
            : '') +
          '</div>'
        );
      })
      .join('') +
    '</div></section>'
  );
}
/**
 * Отрисовывает экран «Расписание».
 * @returns {string} HTML.
 */
function viewSchedule() {
  const state = Store.s,
    cur = weekType(new Date()),
    pairs = state.settings.pairs,
    todayIdx = U.dayIdx(new Date());
  if (!ui.schedWeek) ui.schedWeek = cur;
  if (ui.schedDay == null) ui.schedDay = todayIdx;
  const w = ui.schedWeek,
    isCur = w === cur;
  const monday = (() => {
    const b = U.mondayOf(U.today());
    return weekType(b) === w ? b : U.addDays(b, 7);
  })();
  /**
   * Форматирует дату как ДД.ММ.
   * @param {string} iso Дата в формате ГГГГ-ММ-ДД.
   * @returns {string} Строка.
   */
  const wdates = DAYS.map((_, i) => U.iso(U.addDays(monday, i))),
    dm = iso => iso.slice(8) + '.' + iso.slice(5, 7);
  let grid =
    '<div class="sched-grid"><div></div>' +
    DAYS.map(
      (d, i) =>
        '<div class="g-day' +
        (isCur && i === todayIdx ? ' today' : '') +
        '">' +
        d +
        '<small>' +
        dm(wdates[i]) +
        '</small></div>'
    ).join('');
  pairs.forEach((p, pi) => {
    const n = pi + 1;
    grid +=
      '<button class="g-pair" data-action="times" title="Изменить время пар"><b>' +
      n +
      '</b><small>' +
      (pairTime(n) ? pairTime(n).replace('–', '<br>') : 'время?') +
      '</small></button>';
    for (let d = 0; d < 7; d++) {
      grid +=
        '<div class="g-cell' +
        (isCur && d === todayIdx ? ' today' : '') +
        '" data-action="cell-add" data-day="' +
        d +
        '" data-pair="' +
        n +
        '">' +
        cellChips(d, n, wdates[d], false) +
        '</div>';
    }
  });
  grid += '</div>';
  const dayTabs =
    '<div class="day-tabs">' +
    DAYS.map(
      (d, i) =>
        '<button class="day-tab' +
        (i === ui.schedDay ? ' on' : '') +
        (isCur && i === todayIdx ? ' is-today' : '') +
        '" data-action="sched-day" data-day="' +
        i +
        '">' +
        d +
        '</button>'
    ).join('') +
    '</div>';
  const list =
    '<div class="sched-list" data-swipe="sched">' +
    dayTabs +
    '<h3 style="margin-bottom:12px">' +
    DAYS_FULL[ui.schedDay] +
    ' · ' +
    dm(wdates[ui.schedDay]) +
    '</h3>' +
    pairs
      .map((p, pi) => {
        const n = pi + 1,
          ls = Store.s.schedule.filter(
            l => l.day === ui.schedDay && l.pair === n && (l.week === 'both' || l.week === w)
          ),
          chh = cellChips(ui.schedDay, n, wdates[ui.schedDay], true);
        return (
          '<div class="l-row"><div class="l-num"><b>' +
          n +
          '</b><small>' +
          (pairTime(n) || '') +
          '</small></div><div class="l-body">' +
          chh +
          (ls.length || chh
            ? '<button class="btn ghost sm" data-action="cell-add" data-day="' +
              ui.schedDay +
              '" data-pair="' +
              n +
              '">＋ ещё</button>'
            : '<button class="l-empty" data-action="cell-add" data-day="' +
              ui.schedDay +
              '" data-pair="' +
              n +
              '">＋ добавить пару</button>') +
          '</div></div>'
        );
      })
      .join('') +
    '</div>';
  const noTimes = !pairs.some(p => p.start && p.end);
  return (
    '<div class="page-head"><div><h1>Расписание</h1><p>Сейчас идёт ' +
    WEEK_NAME[cur] +
    '. Нажмите на ячейку, чтобы добавить или изменить пару.</p></div>' +
    '<div class="head-actions"><div class="seg" role="group" aria-label="Тип недели">' +
    '<button class="' +
    (w === 'num' ? 'on' : '') +
    '" data-action="sched-week" data-week="num">Числитель</button>' +
    '<button class="' +
    (w === 'den' ? 'on' : '') +
    '" data-action="sched-week" data-week="den">Знаменатель</button></div>' +
    '<button class="btn" data-action="times">' +
    ICONS.stopwatch +
    ' Время пар</button></div></div>' +
    changesCard() +
    grid +
    list +
    (noTimes
      ? '<p class="hint">' +
        ICONS.stopwatch +
        ' Время звонков пока не задано — нажмите «Время пар» или на номер пары.</p>'
      : '') +
    '<p class="hint">Для пар «через неделю» выберите в форме числитель или знаменатель.</p>'
  );
}
