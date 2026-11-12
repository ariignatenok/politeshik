'use strict';

const ST_INFO = {
  п: ['Присутствую', 'ok'],
  о: ['Опоздал(а)', 'late'],
  н: ['Нет', 'no'],
  уп: ['Уважительный пропуск', 'exc'],
};
/**
 * Строит кнопки статусов п, о, н для пары.
 * @param {string} date Дата в формате ГГГГ-ММ-ДД.
 * @param {number} pair Номер пары.
 * @param {string} cur Текущий статус.
 * @param {string} uid Идентификатор студента или null.
 * @param {boolean} locked Закрыта ли правка.
 * @returns {string} HTML.
 */
const statusBtns = (date, pair, cur, uid, locked) =>
  '<div class="att-btns">' +
  ['п', 'о', 'н']
    .map(
      (k) =>
        '<button class="att-b ' +
        ST_INFO[k][1] +
        (cur === k ? ' on' : '') +
        '" ' +
        (locked || (!uid && !Att.canSelf(date, pair)) ? 'disabled ' : '') +
        'data-action="att-mark" data-date="' +
        date +
        '" data-pair="' +
        pair +
        '" data-st="' +
        k +
        '"' +
        (uid ? ' data-uid="' + uid + '"' : '') +
        ' title="' +
        ST_INFO[k][0] +
        '">' +
        k +
        '</button>',
    )
    .join('') +
  '</div>';
/**
 * Строит список пар дня с кнопками отметок.
 * @param {string} date Дата в формате ГГГГ-ММ-ДД.
 * @param {Object<string,string>} marks Отметки вида {"дата|пара": статус}.
 * @param {Array<Object>} certs Справки студента.
 * @param {string} sub Подгруппа студента: "1", "2" или пустая строка.
 * @param {string} uid Идентификатор студента или null для своего дня.
 * @param {boolean} locked Закрыта ли правка.
 * @returns {string} HTML.
 */
function attDayHtml(date, marks, certs, sub, uid, locked) {
  const prs = Att.pairs(date, sub);
  if (!prs.length)
    return (
      '<div class="empty"><div class="mini-mascot">' +
      Mascot.svg('wink', 70) +
      '</div>В этот день пар нет</div>'
    );
  return (
    '<div class="items">' +
    prs
      .map((pr) => {
        const cur = Att.eff(marks, certs, date, pr.pair),
          raw = marks[date + '|' + pr.pair],
          tm = pairTime(pr.pair);
        return (
          '<div class="item att-row"><div class="att-num"><b>' +
          pr.pair +
          '</b><small>' +
          (tm || '') +
          '</small></div><div class="item-main">' +
          pr.lessons
            .map((l) => {
              const sb = subj(l.subjectId);
              return (
                '<div class="item-title">' +
                U.esc(sb ? sb.name : '—') +
                '</div><div class="item-meta">' +
                (sb
                  ? '<span class="chip" style="--c:' +
                    sb.color +
                    '">' +
                    U.esc(sb.short || sb.name) +
                    '</span>'
                  : '') +
                (l.room ? '<span class="tag">ауд. ' + U.esc(l.room) + '</span>' : '') +
                (l.subgroup ? '<span class="tag">' + U.esc(l.subgroup) + '</span>' : '') +
                (l.who ? '<span class="tag">' + U.esc(l.who) + '</span>' : '') +
                '</div>'
              );
            })
            .join('') +
          '</div>' +
          (['у', 'уп'].includes(cur)
            ? '<span class="tag exc">' + cur.toUpperCase() + ' — ' + ST_INFO[cur][0] + '</span>'
            : '<div class="att-cell">' +
              statusBtns(date, pr.pair, raw, uid, locked || lockedMark(raw, uid)) +
              (lockedMark(raw, uid)
                ? '<small class="lock">' + ICONS.locked + ' исправить может только админ</small>'
                : '') +
              '</div>') +
          '</div>'
        );
      })
      .join('') +
    '</div>'
  );
}
/**
 * Выбирает цвет процента посещаемости.
 * @param {number} p Процент посещаемости.
 * @returns {string} класс.
 */
const pctCls = (p) => (p == null ? '' : p >= 85 ? 'good' : p >= 70 ? 'mid' : 'bad');
/**
 * Строит карточки статистики посещаемости.
 * @param {Object} st Статистика посещаемости.
 * @returns {string} HTML.
 */
function statCards(st) {
  return (
    '<div class="grid-stats att-stats">' +
    '<div class="stat"><b>' +
    (st.pct == null ? '—' : st.pct + '%') +
    '</b><small>посещаемость</small></div>' +
    '<div class="stat ok"><b>' +
    st.p +
    '</b><small>п · присутствовал(а)</small></div>' +
    '<div class="stat late"><b>' +
    st.l +
    '</b><small>о · опоздал(а)</small></div>' +
    '<div class="stat red"><b>' +
    st.a +
    '</b><small>н · не был(а)</small></div>' +
    '<div class="stat exc"><b>' +
    st.x +
    '</b><small>УП · уважительные</small></div>' +
    '<div class="stat"><b>' +
    st.u +
    '</b><small>не отмечено</small></div></div>'
  );
}
/**
 * Строит таблицу посещаемости по предметам.
 * @param {Object} st Статистика по предметам.
 * @returns {string} HTML.
 */
function subjTable(st) {
  const ids = Object.keys(st.bySubj);
  if (!ids.length) return '<div class="empty">Пока нет данных за этот период</div>';
  return (
    '<div class="tbl-wrap"><table class="grid-tbl"><thead><tr><th>Предмет</th><th>п</th><th>о</th><th>н</th><th>УП</th><th>не отм.</th><th>%</th></tr></thead><tbody>' +
    ids
      .map((id) => {
        const sb = subj(id),
          b = st.bySubj[id];
        return (
          '<tr><td>' +
          (sb
            ? '<span class="chip" style="--c:' +
              sb.color +
              '">' +
              U.esc(sb.short || sb.name) +
              '</span>'
            : '—') +
          '</td><td>' +
          b.p +
          '</td><td>' +
          b.l +
          '</td><td>' +
          b.a +
          '</td><td>' +
          b.x +
          '</td><td>' +
          b.u +
          '</td>' +
          '<td><div class="pbar ' +
          pctCls(b.pct) +
          '"><i style="width:' +
          (b.pct == null ? 0 : b.pct) +
          '%"></i><span>' +
          (b.pct == null ? '—' : b.pct + '%') +
          '</span></div></td></tr>'
        );
      })
      .join('') +
    '</tbody></table></div>'
  );
}
/**
 * Строит календарь месяца с отметками дней.
 * @param {string} ym Месяц ГГГГ-ММ.
 * @param {Object} byDay Итоги по дням.
 * @param {string} selected Выбранный день.
 * @param {string} pickAction Действие кнопки дня.
 * @returns {string} HTML.
 */
function monthCal(ym, byDay, selected, pickAction) {
  const p = ym.split('-').map(Number),
    first = new Date(p[0], p[1] - 1, 1),
    offset = (first.getDay() + 6) % 7,
    days = new Date(p[0], p[1], 0).getDate(),
    today = U.iso(U.today());
  let h = '<div class="cal">' + DAYS.map((d) => '<div class="cal-h">' + d + '</div>').join('');
  for (let i = 0; i < offset; i++) h += '<div></div>';
  for (let d = 1; d <= days; d++) {
    const di = ym + '-' + U.pad(d),
      arr = byDay[di] || [];
    let cls = '';
    if (arr.length) {
      cls = arr.includes('н')
        ? 'no'
        : arr.includes('о')
          ? 'late'
          : arr.includes('у') || arr.includes('уп')
            ? 'exc'
            : arr.every((x) => x === 'п')
              ? 'ok'
              : '';
    }
    h +=
      '<button class="cal-d ' +
      cls +
      (di === selected ? ' sel' : '') +
      (di === today ? ' today' : '') +
      (arr.length ? '' : ' none') +
      '" data-action="' +
      pickAction +
      '" data-date="' +
      di +
      '"' +
      ((di < ATT_START || di > today) && pickAction === 'att-day' ? ' disabled' : '') +
      '>' +
      d +
      '</button>';
  }
  return (
    h +
    '</div><div class="cal-legend"><span class="dotl ok"></span>п <span class="dotl late"></span>о <span class="dotl no"></span>н <span class="dotl exc"></span>УП</div>'
  );
}
/**
 * Строит переключатели периода статистики.
 * @returns {string} HTML.
 */
function periodControls() {
  const today = U.iso(U.today());
  return (
    '<div class="period"><div class="seg"><button class="' +
    (ui.attScope !== 'all' ? 'on' : '') +
    '" data-action="att-scope" data-v="month">Месяц</button><button class="' +
    (ui.attScope === 'all' ? 'on' : '') +
    '" data-action="att-scope" data-v="all">С 01.10.2026</button></div>' +
    (ui.attScope !== 'all'
      ? '<div class="monthnav"><button class="icon-btn" data-action="att-month" data-d="-1" aria-label="Предыдущий месяц">' +
        ICONS.playLeft +
        '</button><b>' +
        monthName(ui.attMonth) +
        '</b><button class="icon-btn" data-action="att-month" data-d="1" aria-label="Следующий месяц"' +
        (ui.attMonth >= today.slice(0, 7) ? ' disabled' : '') +
        '>' +
        ICONS.playRight +
        '</button></div>'
      : '') +
    '</div>'
  );
}
/**
 * Возвращает границы выбранного периода.
 * @returns {Array<string>} начало и конец.
 */
const attRange = () => {
  if (ui.attScope === 'all') return [ATT_START, '9999-12-31'];
  if (!ui.attMonth) ui.attMonth = U.iso(U.today()).slice(0, 7);
  return [ui.attMonth + '-01', monthEnd(ui.attMonth)];
};
/**
 * Строит карточку лимита пропусков за месяц.
 * @param {number} h Часы пропусков.
 * @param {string} [ym] Месяц ГГГГ-ММ; по умолчанию текущий.
 * @returns {string} HTML.
 */
function absCard(h, ym) {
  const nowM = U.iso(U.today()).slice(0, 7),
    m = ym || nowM,
    z = Att.zone(h),
    pct = Math.min(100, Math.round((h * 100) / ABS_LIMIT));
  const msg =
    z.cls === 'red'
      ? ICONS.circleRed + ' Красная зона: больше пропускать нельзя'
      : z.cls === 'warn'
        ? ICONS.circleOrange + ' Осталось ' + z.left + ' ч — ходи на пары и готовься'
        : ICONS.circleGreen + ' Осталось ' + z.left + ' ч';
  return (
    '<div class="abs abs-' +
    z.cls +
    '"><div class="abs-top"><div><b>Лимит пропусков за ' +
    monthWord(m) +
    ': ' +
    h +
    ' из ' +
    ABS_LIMIT +
    ' часов</b><small>Пропуски без уважительной причины · 1 пара = ' +
    PAIR_HOURS +
    ' ч · ' +
    (m === nowM ? '1-го числа лимит обнуляется и считается заново' : 'это прошедший месяц') +
    '</small></div><div class="abs-num">' +
    h +
    ' / ' +
    ABS_LIMIT +
    ' ч</div></div><div class="progress"><i style="width:' +
    pct +
    '%"></i></div><p>' +
    msg +
    '</p></div>'
  );
}
/**
 * Строит карточку лимита пропусков студента за месяц.
 * @param {Object<string,string>} marks Отметки.
 * @param {Array<Object>} certs Справки.
 * @param {string} sub Подгруппа.
 * @param {string} [ym] Месяц ГГГГ-ММ; по умолчанию текущий.
 * @returns {string} HTML.
 */
function absCardOf(marks, certs, sub, ym) {
  const m = ym || U.iso(U.today()).slice(0, 7);
  return absCard(Att.absHours(marks, certs, sub, m), m);
}
/**
 * Проверяет, закрыта ли отметка от правки студентом.
 * @param {string} raw Сохранённая отметка.
 * @param {string} uid Идентификатор студента или null.
 * @returns {boolean} true, если условие выполнено.
 */
const lockedMark = (raw, uid) => !uid && Cloud.status === 'online' && !!raw;
/**
 * Строит ячейку часов пропусков студента.
 * @param {Object} e Строка студента.
 * @returns {string} HTML.
 */
const absCell = (e) => {
  const h = Att.absHours(e.marks, e.certs, e.p.subgroup),
    z = Att.zone(h);
  return (
    '<td><span class="pill ' +
    (z.cls === 'red' ? 'bad' : z.cls === 'warn' ? 'mid' : 'good') +
    '">' +
    h +
    '</span></td>'
  );
};
/**
 * Отрисовывает экран «Посещаемость».
 * @returns {string} HTML.
 */
function viewAttendance() {
  if(Profile.visiting())return '<div class="page-head"><h1>Посещаемость</h1></div><section class="card"><h2>Вы управляете этой группой как Супер-админ</h2><p>Вы студент только группы '+U.esc(Groups.get(Cloud.homeTenant).number)+'. В текущей группе личных отметок нет.</p><div class="head-actions"><button class="btn primary" data-action="nav" data-tab="journal">Журнал этой группы</button><button class="btn" data-action="owner-home" data-tab="attendance">Моя посещаемость</button></div></section>';
  const today = U.iso(U.today()),
    state = Store.s;
  if (!ui.attDate) ui.attDate = today;
  if (!ui.attMonth) ui.attMonth = today.slice(0, 7);
  const date = ui.attDate,
    marks = state.attendance.marks,
    certs = Cloud.my.certs,
    sub = state.settings.subgroup;
  const locked =
      date < ATT_START ||
      date > today ||
      (Cloud.status === 'online' && date < U.iso(U.addDays(U.fromISO(today), -1))),
    rg = attRange(),
    st = Att.stats(marks, certs, sub, rg[0], rg[1]);
  const prev = U.iso(U.addDays(U.fromISO(date), -1)),
    next = U.iso(U.addDays(U.fromISO(date), 1));
  return (
    '<div class="page-head attendance-head"><div><h1>Посещаемость</h1><p>Отмечайся на каждой паре: <b>п</b> — присутствую, <b>о</b> — опоздал(а), <b>н</b> — нет. Самоотметка доступна на паре и 24 часа после её окончания. Уже поставленную отметку меняет староста.</p></div><button class="btn" data-action="att-certificates">Справки и больничные</button></div>' +
    (Cloud.status === 'online'
      ? ''
      : '<div class="warn">' +
        ICONS.cloud +
        ' Отметки сохраняются только на этом устройстве. Чтобы они попадали к админу группы, откройте приложение по приглашению и войдите в Claude.</div>') +
    '<section class="card"><div class="daynav"><button class="icon-btn" data-action="att-day" data-date="' +
    prev +
    '" aria-label="Предыдущий день"' +
    (prev < ATT_START ? ' disabled' : '') +
    '>' +
    ICONS.playLeft +
    '</button>' +
    '<div class="daynav-t"><b>' +
    U.esc(U.fmtLong(U.fromISO(date))) +
    '</b><small>' +
    WEEK_NAME[weekType(U.fromISO(date))] +
    (date === today ? ' · сегодня' : '') +
    '</small></div>' +
    '<button class="icon-btn" data-action="att-day" data-date="' +
    next +
    '" aria-label="Следующий день"' +
    (next > today ? ' disabled' : '') +
    '>' +
    ICONS.playRight +
    '</button>' +
    (date !== today
      ? '<button class="btn sm" data-action="att-day" data-date="' + today + '">Сегодня</button>'
      : '') +
    '</div>' +
    (date < ATT_START
      ? '<p class="hint">Учёт посещаемости начинается с 1 октября 2026.</p>'
      : date > today
        ? '<p class="hint">Будущие дни отметить нельзя.</p>'
        : locked
          ? '<p class="hint">Отметиться можно на паре и ещё 24 часа после её окончания. Позже — через старосту.</p>'
          : '') +
    attDayHtml(date, marks, certs, sub, null, locked) +
    '</section>' +
    absCardOf(marks, certs, sub, Att.limitMonth()) +
    '<div class="sec-title"><h2>Моя статистика</h2>' +
    periodControls() +
    '</div>' +
    statCards(st) +
    '<div class="attendance-details"><div class="dash-cols"><section class="card"><h2>По предметам</h2>' +
    subjTable(st) +
    '</section>' +
    '<section class="card"><h2>Календарь</h2>' +
    monthCal(
      ui.attMonth,
      Att.stats(marks, certs, sub, ui.attMonth + '-01', monthEnd(ui.attMonth)).byDay,
      date,
      'att-day',
    ) +
    '</section></div>' +
    attendanceCertificatesHtml() +
    '</div>'
  );
}

function attendanceCertificatesHtml() {
  const certs = Cloud.my.certs.slice().sort((a, b) => b.from.localeCompare(a.from));
  return (
    '<section class="card" id="attendance-certificates"><h2>Справки и больничные <button class="btn sm primary" data-action="cert-add">＋ Добавить</button></h2>' +
    (certs.length
      ? '<div class="items">' +
        certs
          .map(
            (c) =>
              '<div class="item"><div class="item-main"><div class="item-title">' +
              (c.kind === 'Больничный'
                ? ICONS.hospital
                : c.kind === 'Записка'
                  ? ICONS.memo
                  : ICONS.document) +
              ' ' +
              U.esc(c.kind) +
              ' · ' +
              U.esc(certPeriod(c)) +
              '</div>' +
              '<div class="item-meta">' +
              (c.note ? '<span class="tag">' + U.esc(c.note) + '</span>' : '') +
              '<span class="tag status ' +
              (c.confirmed ? 'prep' : 'review') +
              '">' +
              (c.confirmed ? 'Подтверждена админом' : 'На проверке') +
              '</span></div>' +
              '</div><div class="item-actions"><button class="icon-btn" data-action="cert-view" data-uid="' +
              Cloud.uid +
              '" data-id="' +
              c.id +
              '" aria-label="Показать фото">' +
              ICONS.picture +
              '</button><button class="icon-btn" data-action="cert-del" data-id="' +
              c.id +
              '" aria-label="Удалить">' +
              ICONS.wastebasket +
              '</button></div></div>',
          )
          .join('') +
        '</div>'
      : empty(ICONS.stethoscope, 'Справок нет. Дни по справке не считаются пропусками.')) +
    '</section>'
  );
}
