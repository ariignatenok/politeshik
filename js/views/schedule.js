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
  const gm = /подгр\.?\s*(\d)/i.exec(l.subgroup || ''),
    rest = gm
      ? l.subgroup
          .replace(gm[0], '')
          .replace(/^[\s·]+|[\s·]+$/g, '')
      : l.subgroup,
    name = sb ? (wide ? sb.name : sb.short || sb.name) : 'Без предмета',
    title = (gm ? name.replace(/\s*\([^)]*\)\s*$/, '') : name) + (gm ? ' (подгр. ' + gm[1] + ')' : '');
  const sub = [l.room ? 'ауд. ' + l.room : '', rest, wide || gm ? l.who : surname(l.who)].filter(Boolean).join(' · ');
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
    U.esc((sb ? sb.name : '') + (gm ? ' (подгр. ' + gm[1] + ')' : '') + (l.who ? ' — ' + l.who : '')) +
    '">' +
    '<b>' +
    U.esc(title) +
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
  const ls = Att.mine(Weeks.on(date)).filter(l => l.pair === n),
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
    pairs = state.settings.pairs,
    todayIso = U.iso(U.today()),
    currentWs = Weeks.start(todayIso),
    todayIdx = U.dayIdx(new Date());
  if (!ui.schedWs) ui.schedWs = currentWs;
  const ws = ui.schedWs,
    isCur = ws === currentWs,
    monday = U.fromISO(ws),
    type = weekType(monday),
    explicit = Weeks.has(ws);
  if (ui.schedDay == null || ui.schedDayWs !== ws) {
    ui.schedDay = isCur ? todayIdx : 0;
    ui.schedDayWs = ws;
  }
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
          ls = Att.mine(Weeks.on(wdates[ui.schedDay])).filter(l => l.pair === n),
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
  const nav =
    '<div class="week-nav"><button class="icon-btn" data-action="sched-nav" data-step="-1" aria-label="Предыдущая неделя">←</button>' +
    '<div class="week-label"><b>' +
    Weeks.label(ws) +
    '</b><small>' +
    (isCur ? 'Текущая неделя · ' : '') +
    WEEK_NAME[type] +
    ' · ' +
    (explicit ? 'изменена' : 'по шаблону') +
    '</small></div>' +
    '<button class="icon-btn" data-action="sched-nav" data-step="1" aria-label="Следующая неделя">→</button>' +
    (isCur ? '' : '<button class="btn sm" data-action="sched-today">Сегодня</button>') +
    '</div>';
  const noTimes = !pairs.some(p => p.start && p.end),
    emptyWeek = !Weeks.lessons(ws).length;
  return (
    scheduleBanner() + QuickAtt.banner() +
    '<div class="page-head"><div><h1>Расписание</h1><p>Каждая неделя своя: правки сохраняются только для выбранной недели.</p></div>' +
    '<div class="head-actions"><button class="btn" data-action="sched-import">Заменить расписание</button><button class="btn" data-action="sched-copy-next">Копировать на след. неделю</button>' +
    (explicit ? '<button class="btn" data-action="sched-reset">Сбросить к шаблону</button>' : '') +
    '<button class="btn" data-action="times">' +
    ICONS.stopwatch +
    ' Время пар</button></div></div>' +
    nav +
    (emptyWeek ? '<div class="card empty-week">На эту неделю расписание ещё не добавлено.</div>' : '') +
    changesCard() +
    grid +
    list +
    (noTimes
      ? '<p class="hint">' +
        ICONS.stopwatch +
        ' Время звонков пока не задано — нажмите «Время пар» или на номер пары.</p>'
      : '') +
    '<p class="hint">Чтобы пара повторялась каждую неделю, отметьте в форме «Повторять каждую неделю».</p>'
  );
}
