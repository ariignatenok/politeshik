'use strict';

/**
 * Собирает работы и ДЗ со сроками в один список.
 * @returns {Array<Object>} Массив.
 */
function dashItems() {
  const state = Store.s,
    a = allWorks().map(w => ({
      kind: w.kind,
      id: w.id,
      title: w.title,
      type: w.type,
      subjectId: w.subjectId,
      date: w.date,
      time: w.time,
      done: w.done,
      g: w.g
    }));
  state.homework.forEach(h => {
    if (h.deadline)
      a.push({
        kind: 'hw',
        id: h.id,
        title: h.text,
        type: 'ДЗ',
        subjectId: h.subjectId,
        date: h.deadline,
        time: '',
        done: isPastDue(h.deadline, ''),
        g: false
      });
  });
  return a;
}
/**
 * Возвращает контрольные, зачёты и работы на паре.
 * @returns {Array<Object>} Массив.
 */
function workItems() {
  return allWorks().map(w => ({
    kind: w.kind,
    id: w.id,
    title: w.title,
    type: w.type,
    subjectId: w.subjectId,
    date: w.date,
    time: w.time,
    done: w.done,
    g: w.g
  }));
}
/**
 * Сравнивает элементы по сроку для сортировки.
 * @param {Object} a Первая запись.
 * @param {Object} b Вторая запись.
 * @returns {number} Число.
 */
const byDue = (a, b) => dueDate(a.date, a.time) - dueDate(b.date, b.time);
/**
 * Строит строку работы со сроком и статусом.
 * @param {Object} i Работа или ДЗ со сроком.
 * @returns {string} HTML.
 */
function itemRow(i) {
  const past = i.done,
    u = past ? 'none' : urgency(i.date, i.time),
    sb = subj(i.subjectId),
    editable = !i.g || Cloud.isAdmin;
  return (
    '<div class="item u-' +
    u +
    (past ? ' is-done' : '') +
    '">' +
    '<div class="item-main"><div class="item-title">' +
    U.esc(i.title) +
    '</div><div class="item-meta">' +
    (sb ? '<span class="chip" style="--c:' + sb.color + '">' + U.esc(sb.short || sb.name) + '</span>' : '') +
    '<span class="tag">' +
    U.esc(i.type) +
    '</span>' +
    (i.g ? '<span class="tag">группа</span>' : '') +
    (i.time ? '<span class="tag">' + U.esc(i.time) + '</span>' : '') +
    '<span class="tag status ' +
    (past ? 'past' : 'prep') +
    '">' +
    (past ? 'Срок прошёл' : 'Готовиться') +
    '</span></div></div>' +
    '<div class="item-when"><b>' +
    (past ? 'Прошло' : relLabel(i.date)) +
    '</b><small>Срок сдачи: ' +
    shortDate(i.date) +
    '</small></div>' +
    '<div class="item-actions">' +
    (past
      ? ''
      : '<button class="icon-btn" data-action="ics-item" data-id="' +
        i.id +
        '" title="Добавить в календарь" aria-label="Добавить в календарь">' +
        ICONS.calendarDay +
        '</button>') +
    (editable
      ? '<button class="icon-btn" data-action="' +
        (i.g ? 'gwork-edit' : 'edit-item') +
        '" data-kind="' +
        i.kind +
        '" data-id="' +
        i.id +
        '" title="Изменить" aria-label="Изменить">' +
        ICONS.pencil +
        '</button>' +
        '<button class="icon-btn" data-action="' +
        (i.g ? 'gwork-del' : 'del-item') +
        '" data-kind="' +
        i.kind +
        '" data-id="' +
        i.id +
        '" title="Удалить" aria-label="Удалить">' +
        ICONS.wastebasket +
        '</button>'
      : '') +
    '</div></div>'
  );
}
/**
 * Строит строку пары сегодняшнего дня.
 * @param {Object} pr Пара дня.
 * @returns {string} HTML.
 */
function dayRow(pr) {
  const l = pr.lessons[0],
    sb = subj(l.subjectId),
    t = lessonTime(l),
    cls = pr.state === 'cancel' ? ' u-red' : pr.state === 'replace' ? ' u-yellow' : '';
  const chg = pr.change
    ? '<span class="tag ' +
      (pr.state === 'cancel' ? 'bad' : 'warnb') +
      '">' +
      (pr.state === 'cancel' ? 'ОТМЕНЕНА' : 'ЗАМЕНА') +
      '</span>'
    : '';
  return (
    '<div class="item' +
    cls +
    '" style="padding-left:18px"><div class="item-main"><div class="item-title"' +
    (pr.state === 'cancel' ? ' style="text-decoration:line-through"' : '') +
    '>' +
    pr.pair +
    '. ' +
    U.esc(sb ? sb.short || sb.name : '—') +
    '</div><div class="item-meta">' +
    chg +
    (t ? '<span class="tag">' + ICONS.alarmClock + ' ' + t + '</span>' : '') +
    (l.room ? '<span class="tag">ауд. ' + U.esc(l.room) + '</span>' : '') +
    (l.subgroup ? '<span class="tag">' + U.esc(l.subgroup) + '</span>' : '') +
    (l.who ? '<span class="tag">' + U.esc(l.who) + '</span>' : '') +
    (pr.change && pr.change.reason ? '<span class="tag">' + U.esc(pr.change.reason) + '</span>' : '') +
    '</div></div></div>'
  );
}
/**
 * Находит ближайшую пару.
 * @returns {Object|null} Объект.
 */
function nextLesson() {
  const state = Store.s,
    now = new Date();
  for (let i = 0; i < 8; i++) {
    const d = U.addDays(U.today(), i),
      di = U.iso(d);
    for (const pr of Att.dayView(di, state.settings.subgroup)) {
      if (pr.state === 'cancel') continue;
      const p = state.settings.pairs[pr.pair - 1];
      if (!p || !p.start) continue;
      const hm = p.start.split(':').map(Number),
        st = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hm[0], hm[1]);
      if (st > now)
        return {
          pr,
          l: pr.lessons[0],
          at: st
        };
    }
  }
  return null;
}
/**
 * Подписывает оставшееся время словами.
 * @param {number} ms Время в миллисекундах.
 * @returns {string} Строка.
 */
function untilText(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return m + ' мин';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' ч ' + (m % 60) + ' мин';
  return Math.floor(h / 24) + ' д ' + (h % 24) + ' ч';
}
/**
 * Строит виджет: ближайшая пара, работа и посещаемость.
 * @returns {string} HTML.
 */
function widgetHtml() {
  const state = Store.s,
    now = new Date(),
    nl = nextLesson(),
    dl = workItems()
      .filter(i => !i.done)
      .sort(byDue)[0];
  const ym = U.iso(now).slice(0, 7),
    st = Att.stats(state.attendance.marks, Cloud.my.certs, state.settings.subgroup, ym + '-01', monthEnd(ym));
  const sb = nl && subj(nl.l.subjectId);
  return (
    '<div class="widget" aria-label="Виджет">' +
    '<div class="wg"><small>Ближайшая пара</small>' +
    (nl
      ? '<b>' +
        U.esc(sb ? sb.short || sb.name : 'Пара') +
        (nl.l.room ? ' · ауд. ' + U.esc(nl.l.room) : '') +
        '</b><span>через ' +
        untilText(nl.at - now) +
        (nl.pr.state === 'replace' ? ' · ЗАМЕНА' : '') +
        '</span>'
      : '<b>—</b><span>задайте время пар</span>') +
    '</div>' +
    '<div class="wg"><small>Ближайшая работа</small>' +
    (dl
      ? '<b>' +
        U.esc(dl.title) +
        '</b><span>' +
        (dueDate(dl.date, dl.time) < now ? 'просрочено' : 'через ' + untilText(dueDate(dl.date, dl.time) - now)) +
        '</span>'
      : '<b>—</b><span>сроков нет</span>') +
    '</div>' +
    '<div class="wg"><small>Посещаемость за месяц</small><b>' +
    (st.pct == null ? '—' : st.pct + '%') +
    '</b><span>п ' +
    st.p +
    ' · о ' +
    st.l +
    ' · н ' +
    st.a +
    '</span></div></div>'
  );
}
/**
 * Строит предложение включить уведомления.
 * @returns {string} HTML.
 */
function notifBanner() {
  const state = Store.s;
  if (!Notifier.supported() || Notifier.perm() !== 'default' || state.settings.notifAsked) return '';
  return (
    '<div class="card notif-banner"><div><b>' +
    ICONS.bell +
    ' Включить уведомления?</b><p>Напомню о парах за несколько минут, о работах за сутки и сообщу, если пару отменят или заменят.</p></div><div class="head-actions"><button class="btn primary sm" data-action="notif-ask">Включить</button><button class="btn sm" data-action="notif-later">Позже</button></div></div>'
  );
}
/**
 * Отрисовывает экран «Главная».
 * @returns {string} HTML.
 */
function viewDashboard() {
  const state = Store.s,
    now = new Date(),
    cur = weekType(now);
  const all = workItems();
  const pend = all.filter(i => !i.done).sort(byDue);
  const done = all
    .filter(i => i.done)
    .sort((a, b) => byDue(b, a))
    .slice(0, 30);
  const types = [...new Set(pend.map(i => i.type))];
  if (ui.dashFilter !== 'all' && !types.includes(ui.dashFilter)) ui.dashFilter = 'all';
  const list = ui.dashFilter === 'all' ? pend : pend.filter(i => i.type === ui.dashFilter);
  const urgent = pend.filter(i => urgency(i.date, i.time) === 'red').length;
  const soon = pend.filter(i => {
    const n = U.dayDiff(U.today(), U.fromISO(i.date));
    return n >= 0 && n <= 7;
  }).length;
  const hwOpen = state.homework.filter(hwUpcoming).length;
  const dv = Att.dayView(U.iso(now), state.settings.subgroup);
  return (
    '<div class="page-head"><div><h1>Главная</h1><p>' +
    U.esc(U.fmtLong(now)) +
    ' · идёт ' +
    WEEK_NAME[cur] +
    '</p></div>' +
    '<div class="head-actions"><button class="btn primary" data-action="add-work">＋ Добавить работу</button></div></div>' +
    heroHtml() +
    Support.moodHtml() +
    Birthday.bannerHtml() +
    notifBanner() +
    widgetHtml() +
    '<div class="grid-stats">' +
    '<div class="stat red"><b>' +
    urgent +
    '</b><small>срочно (&lt; 24 ч)</small></div>' +
    '<div class="stat"><b>' +
    soon +
    '</b><small>на ближайшие 7 дней</small></div>' +
    '<div class="stat link" data-action="nav" data-tab="hw" title="Открыть домашку"><b>' +
    hwOpen +
    '</b><small>ДЗ впереди →</small></div></div>' +
    '<div class="dash-cols"><section class="card"><h2>Ближайшие работы <small class="sub-h">контрольные, зачёты и работы на паре</small></h2>' +
    '<div class="head-actions" style="margin:-6px 0 10px"><button class="btn ghost sm" data-action="ics-all">' +
    ICONS.calendarDay +
    ' Все дедлайны в календарь</button></div>' +
    (types.length > 1
      ? '<div class="chips"><button class="fchip' +
        (ui.dashFilter === 'all' ? ' on' : '') +
        '" data-action="dash-filter" data-f="all">Все</button>' +
        types
          .map(
            t =>
              '<button class="fchip' +
              (ui.dashFilter === t ? ' on' : '') +
              '" data-action="dash-filter" data-f="' +
              U.esc(t) +
              '">' +
              U.esc(t) +
              '</button>'
          )
          .join('') +
        '</div>'
      : '') +
    (list.length
      ? '<div class="items">' + list.map(itemRow).join('') + '</div>'
      : empty(ICONS.partyPopper, 'Ближайших контрольных и зачётов нет.')) +
    (done.length
      ? '<details class="done-box"><summary>Прошедшие (' +
        done.length +
        ')</summary><div class="items">' +
        done.map(itemRow).join('') +
        '</div></details>'
      : '') +
    '</section><section class="card"><h2>Сегодня по расписанию <button class="btn sm" data-action="nav" data-tab="attendance">' +
    ICONS.check +
    ' Отметиться</button></h2>' +
    (dv.length ? '<div class="items">' + dv.map(dayRow).join('') + '</div>' : empty(ICONS.coffee, 'Сегодня пар нет')) +
    '</section></div>'
  );
}
/**
 * Строит приветствие Политешика.
 * @returns {string} HTML.
 */
function heroHtml() {
  if (Birthday.mine()) return Birthday.heroHtml();
  const state = Store.s,
    now = new Date(),
    today = U.iso(U.today()),
    sub = state.settings.subgroup,
    ps = Att.pairs(today, sub);
  const pending = allWorks()
      .filter(w => !w.done)
      .sort(byDue)[0],
    name = ((Cloud.profile && Cloud.profile.name) || state.settings.displayName || '').split(/\s+/)[1] || '';
  let text,
    mood = Mascot.current(),
    btn = '';
  const needMark =
    today >= ATT_START &&
    ps.some(p => !state.attendance.marks[today + '|' + p.pair] && !Att.covered(Cloud.my.certs, today));
  if (pending && urgency(pending.date, pending.time) !== 'none') {
    text =
      ICONS.alarmClock +
      ' Скоро «' +
      pending.title +
      '» — ' +
      relLabel(pending.date).toLowerCase() +
      '. Как подготовка?';
    btn = '<button class="btn sm primary" data-action="open-chat" data-with="bot">Ответить Политешику</button>';
  } else if (needMark) {
    text =
      'Сегодня ' +
      ps.length +
      ' ' +
      U.plural(ps.length, 'пара', 'пары', 'пар') +
      '. Не забудь отметиться! ' +
      ICONS.check;
    btn = '<button class="btn sm primary" data-action="nav" data-tab="attendance">Отметиться</button>';
  } else text = 'Всё спокойно — можно заглянуть в карточки и повторить что-нибудь ' + ICONS.seedling;
  return (
    '<div class="hero card"><div class="hero-av">' +
    Mascot.svg(mood, 84) +
    '</div><div class="hero-t"><b>Привет' +
    (name ? ', ' + U.esc(name) : '') +
    '!</b><p>' +
    U.esc(text) +
    '</p>' +
    btn +
    '</div></div>'
  );
}
