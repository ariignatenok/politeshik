'use strict';

/**
 * Возвращает учебные дни месяца до сегодняшнего.
 * @param {string} ym Месяц ГГГГ-ММ.
 * @returns {Array<string>} Массив.
 */
function journalDays(ym) {
  const today = U.iso(U.today()),
    from = ym + '-01' < ATT_START ? ATT_START : ym + '-01',
    to = monthEnd(ym) > today ? today : monthEnd(ym),
    out = [];
  if (from > to) return out;
  for (let d = U.fromISO(from), e = U.fromISO(to); d <= e; d = U.addDays(d, 1)) {
    const di = U.iso(d);
    if (Att.pairs(di, '').length) out.push(di);
  }
  return out;
}
/**
 * Строит ячейку журнала админа.
 * @param {Object} e Строка студента.
 * @param {string} di Дата.
 * @returns {string} HTML.
 */
function jCell(e, di) {
  if (!e) return '<td class="jc dim">·</td>';
  const prs = Att.pairs(di, e.p.subgroup);
  if (!prs.length) return '<td class="jc dim">·</td>';
  const effs = prs.map(p => Att.eff(e.marks, e.certs, di, p.pair));
  const cls = effs.includes('н')
    ? 'no'
    : effs.includes('о')
      ? 'late'
      : effs.includes('у')
        ? 'exc'
        : effs.every(x => x === 'п')
          ? 'ok'
          : '';
  return (
    '<td class="jc ' +
    cls +
    '" data-action="att-edit" data-id="' +
    e.id +
    '" data-date="' +
    di +
    '" title="' +
    prs.map((p, i) => p.pair + '-я: ' + (effs[i] ? ST_INFO[effs[i]][0] : 'не отмечено')).join('; ') +
    '">' +
    effs.map(x => x || '?').join('') +
    '</td>'
  );
}
/**
 * Отрисовывает журнал студента (только его отметки).
 * @returns {string} HTML.
 */
function viewJournalSelf() {
  const state = Store.s,
    today = U.iso(U.today());
  if (!ui.attMonth) ui.attMonth = today.slice(0, 7);
  const marks = state.attendance.marks,
    certs = Cloud.my.certs,
    sub = state.settings.subgroup,
    days = journalDays(ui.attMonth);
  const st = Att.stats(marks, certs, sub, ui.attMonth + '-01', monthEnd(ui.attMonth));
  /**
   * Строит ячейку дня в журнале студента.
   * @param {string} di Дата.
   * @returns {string} HTML.
   */
  const cell = di => {
    const prs = Att.pairs(di, sub);
    if (!prs.length) return '<td class="jc dim">·</td>';
    const effs = prs.map(p => Att.eff(marks, certs, di, p.pair)),
      cls = effs.includes('н')
        ? 'no'
        : effs.includes('о')
          ? 'late'
          : effs.includes('у')
            ? 'exc'
            : effs.every(x => x === 'п')
              ? 'ok'
              : '';
    return (
      '<td class="jc ' +
      cls +
      '" title="' +
      prs.map((p, i) => p.pair + '-я: ' + (effs[i] ? ST_INFO[effs[i]][0] : 'не отмечено')).join('; ') +
      '">' +
      effs.map(x => x || '?').join('') +
      '</td>'
    );
  };
  const head = days
    .map(d => {
      const dt = U.fromISO(d);
      return '<th class="jh">' + dt.getDate() + '<small>' + DAYS[U.dayIdx(dt)] + '</small></th>';
    })
    .join('');
  return (
    '<div class="page-head"><div><h1>' +
    ICONS.folder +
    ' Журнал</h1><p>Твоя посещаемость по дням. Только просмотр: отметки ставятся на странице «Посещаемость».</p></div></div>' +
    '<div class="period"><div class="monthnav"><button class="icon-btn" data-action="att-month" data-d="-1" aria-label="Предыдущий месяц">' +
    ICONS.playLeft +
    '</button><b>' +
    monthName(ui.attMonth) +
    '</b><button class="icon-btn" data-action="att-month" data-d="1" aria-label="Следующий месяц"' +
    (ui.attMonth >= today.slice(0, 7) ? ' disabled' : '') +
    '>' +
    ICONS.playRight +
    '</button></div></div>' +
    statCards(st) +
    absCard(Att.absHours(marks, certs, sub)) +
    (days.length
      ? '<div class="jwrap"><table class="jt"><thead><tr><th class="c1">Я</th>' +
        head +
        '</tr></thead><tbody><tr><td class="c1"><b>' +
        U.esc((Cloud.profile || {}).name || 'Мои отметки') +
        '</b></td>' +
        days.map(cell).join('') +
        '</tr></tbody></table></div>' +
        '<div class="cal-legend"><span class="dotl ok"></span>все п <span class="dotl late"></span>есть о <span class="dotl no"></span>есть н <span class="dotl exc"></span>справка · «?» — не отмечено</div>'
      : '<div class="empty">В этом месяце ещё нет учебных дней с 15.10.2026</div>')
  );
}
/**
 * Отрисовывает журнал всей группы для админа.
 * @param {boolean} asTeacher Показывать ли журнал в режиме преподавателя: только чтение (необязательно).
 * @returns {string} HTML.
 */
function viewJournal(asTeacher) {
  if (Cloud.isTeacher && !asTeacher) return Teacher.readOnly(viewJournal(true));
  if (!Cloud.isAdmin && !asTeacher) return viewJournalSelf();
  const today = U.iso(U.today());
  if (!ui.attMonth) ui.attMonth = today.slice(0, 7);
  const days = journalDays(ui.attMonth),
    rows = rosterRows(),
    mrange = [ui.attMonth + '-01', monthEnd(ui.attMonth)];
  /**
   * Считает статистику студента за месяц.
   * @param {Object} x Строка студента.
   * @returns {Object|null} Объект.
   */
  const calc = x => (x.e ? Att.stats(x.e.marks, x.e.certs, x.e.p.subgroup, mrange[0], mrange[1]) : null);
  const active = rows.filter(x => !x.r.flag && !x.r.admin),
    withSt = active
      .map(x => ({
        x,
        st: calc(x)
      }))
      .filter(y => y.st && y.st.pct != null);
  const avg = withSt.length ? Math.round(withSt.reduce((s, y) => s + y.st.pct, 0) / withSt.length) : null;
  const low = withSt.filter(y => y.st.pct < 70);
  const notIn = active.filter(x => !x.e),
    noMark = active.filter(x => x.e && !markedOn(x.e, today));
  const zl = active
    .filter(x => x.e)
    .map(x => ({
      x,
      h: Att.absHours(x.e.marks, x.e.certs, x.e.p.subgroup)
    }));
  const redL = zl.filter(y => Att.zone(y.h).cls === 'red'),
    warnL = zl.filter(y => Att.zone(y.h).cls === 'warn');
  /**
   * Перечисляет студентов с часами пропусков.
   * @param {Array<Object>} a Студенты.
   * @returns {string} Строка.
   */
  const zlist = a => (a.length ? a.map(y => U.esc(y.x.r.name) + ' (' + y.h + ' ч)').join(', ') : '—');
  /**
   * Перечисляет имена студентов.
   * @param {Array<Object>} arr Студенты.
   * @returns {string} Строка.
   */
  const list = arr => (arr.length ? arr.map(x => U.esc(x.r.name)).join(', ') : '—');
  const head =
    '<tr><th class="c1">№</th><th class="c2">Студент</th>' +
    days
      .map(d => {
        const dt = U.fromISO(d);
        return (
          '<th class="jh" title="' +
          U.esc(U.fmtShort(dt)) +
          '">' +
          dt.getDate() +
          '<small>' +
          DAYS[U.dayIdx(dt)] +
          '</small></th>'
        );
      })
      .join('') +
    '<th>п</th><th>о</th><th>н</th><th>спр.</th><th>%</th><th title="Пропуски без уважительной причины с 15.10.2026, лимит 24 ч">без ув., ч</th></tr>';
  const body = rows
    .map(x => {
      const e = x.e,
        st = calc(x),
        dim = x.r.flag ? 'dimrow' : '',
        hz = e ? Att.absHours(e.marks, e.certs, e.p.subgroup) : null,
        zz = hz == null ? null : Att.zone(hz);
      return (
        '<tr class="' +
        dim +
        '"><td class="c1">' +
        (x.r.n || '') +
        '</td><td class="c2">' +
        nameCell(x) +
        (!e && !x.r.flag ? ' <small class="dim">не заходил(а)</small>' : '') +
        '</td>' +
        days.map(d => (x.r.flag ? '<td class="jc dim">·</td>' : jCell(e, d))).join('') +
        (st
          ? '<td>' +
            st.p +
            '</td><td>' +
            st.l +
            '</td><td>' +
            st.a +
            '</td><td>' +
            st.x +
            '</td><td><span class="pill ' +
            pctCls(st.pct) +
            '">' +
            (st.pct == null ? '—' : st.pct + '%') +
            '</span></td>'
          : '<td class="dim" colspan="5">—</td>') +
        (hz == null
          ? '<td class="dim">—</td>'
          : '<td><span class="pill ' +
            (zz.cls === 'red' ? 'bad' : zz.cls === 'warn' ? 'mid' : 'good') +
            '">' +
            hz +
            ' / ' +
            ABS_LIMIT +
            '</span></td>') +
        '</tr>'
      );
    })
    .join('');
  return (
    '<div class="page-head"><div><h1>' +
    ICONS.folder +
    ' Журнал посещаемости</h1><p>Папка админа: посещаемость каждого студента по дням. В клетке — отметки по парам этого дня.</p></div><div class="head-actions"><button class="btn" data-action="grp-csv">' +
    ICONS.arrowDown +
    ' Скачать CSV</button></div></div>' +
    '<div class="period"><div class="monthnav"><button class="icon-btn" data-action="att-month" data-d="-1" aria-label="Предыдущий месяц">' +
    ICONS.playLeft +
    '</button><b>' +
    monthName(ui.attMonth) +
    '</b><button class="icon-btn" data-action="att-month" data-d="1" aria-label="Следующий месяц"' +
    (ui.attMonth >= today.slice(0, 7) ? ' disabled' : '') +
    '>' +
    ICONS.playRight +
    '</button></div></div>' +
    '<div class="grid-stats att-stats">' +
    '<div class="stat"><b>' +
    (active.length - notIn.length) +
    '/' +
    active.length +
    '</b><small>вошли в приложение</small></div>' +
    '<div class="stat"><b>' +
    (active.length - noMark.length - notIn.length) +
    '</b><small>отметились сегодня</small></div>' +
    '<div class="stat"><b>' +
    (avg == null ? '—' : avg + '%') +
    '</b><small>средняя посещаемость</small></div>' +
    '<div class="stat red"><b>' +
    low.length +
    '</b><small>ниже 70%</small></div>' +
    '<div class="stat"><b>' +
    notIn.length +
    '</b><small>не заходили</small></div>' +
    '<div class="stat red"><b>' +
    redL.length +
    '</b><small>в красной зоне (24 ч)</small></div></div>' +
    '<div class="card" style="margin-bottom:14px"><p class="md-help" style="margin:0 0 6px"><b>Не заходили:</b> ' +
    list(notIn) +
    '</p><p class="md-help" style="margin:0 0 6px"><b>Не отметились сегодня:</b> ' +
    list(noMark) +
    '</p><p class="md-help" style="margin:0 0 6px"><b>' +
    ICONS.circleRed +
    ' Красная зона (24 ч и больше пропусков без уважительной причины):</b> ' +
    zlist(redL) +
    '</p><p class="md-help" style="margin:0"><b>' +
    ICONS.circleOrange +
    ' Осталось 4 ч и меньше:</b> ' +
    zlist(warnL) +
    '</p></div>' +
    (days.length
      ? '<div class="jwrap"><table class="jt"><thead>' +
        head +
        '</thead><tbody>' +
        body +
        '</tbody></table></div><div class="cal-legend"><span class="dotl ok"></span>все п <span class="dotl late"></span>есть о <span class="dotl no"></span>есть н <span class="dotl exc"></span>справка · «?» — не отмечено</div>'
      : '<div class="empty">В этом месяце ещё нет учебных дней с 15.10.2026</div>')
  );
}
