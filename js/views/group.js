'use strict';

/**
 * Подписывает, как давно произошло событие.
 * @param {string} iso Момент события, ISO.
 * @returns {string} Строка.
 */
function fmtAgo(iso) {
  if (!iso) return '—';
  const d = new Date(iso),
    n = U.dayDiff(d, new Date());
  const tm = U.pad(d.getHours()) + ':' + U.pad(d.getMinutes());
  return n === 0 ? 'сегодня ' + tm : n === 1 ? 'вчера ' + tm : U.fmtShort(d);
}

/**
 * Собирает данные вошедших в приложение студентов.
 * @returns {Array<Object>} Массив.
 */
function enteredRows() {
  const P = Cloud.adm.profiles,
    rg = attRange();
  return Object.keys(P).map(id => {
    const p = P[id],
      marks = (Cloud.adm.att[id] || {}).marks || {},
      certs = (Cloud.adm.certs[id] || {}).items || [];
    return {id, p, r: ROSTER_BY_ID[p.rid] || null, certs, marks, st: Att.stats(marks, certs, p.subgroup, rg[0], rg[1])};
  });
}
/**
 * Возвращает вошедших студентов в порядке списка группы.
 * @returns {Array<Object>} Массив.
 */
function studentRows() {
  return enteredRows().sort(
    (a, b) => (a.r ? a.r.n : 999) - (b.r ? b.r.n : 999) || String(a.p.name).localeCompare(String(b.p.name), 'ru')
  );
}
/**
 * Возвращает весь список группы с данными вошедших.
 * @returns {Array<Object>} Массив.
 */
function rosterRows() {
  const ent = enteredRows(),
    by = {};
  ent.forEach(e => {
    if (e.r) (by[e.r.id] = by[e.r.id] || []).push(e);
  });
  const out = ROSTER.map(r => ({r, e: (by[r.id] || [])[0] || null, dup: (by[r.id] || []).length > 1}));
  ent
    .filter(e => !e.r)
    .forEach(e =>
      out.push({r: {id: null, n: '', name: e.p.name || 'Без имени', flag: '', extra: true}, e, dup: false})
    );
  return out;
}
/**
 * Строит ячейку имени студента с пометками.
 * @param {Object} x Строка списка группы.
 * @returns {string} HTML.
 */
const nameCell = x =>
  '<b>' +
  U.esc(x.r.name) +
  '</b>' +
  (x.r.flag ? ' <span class="tag">' + FLAG_LABEL[x.r.flag] + '</span>' : '') +
  (x.e && Cloud.adminUids.has(x.e.id) ? ' <span class="tag adm">админ-студент</span>' : '') +
  (x.r.extra ? ' <span class="tag">нет в списке</span>' : '') +
  (x.e && x.e.p.subgroup ? '<small> · подгр.' + U.esc(x.e.p.subgroup) + '</small>' : '') +
  (x.dup ? ' <span class="tag bad">дубль</span>' : '');
/**
 * Проверяет, отметился ли студент в день.
 * @param {Object} e Строка студента.
 * @param {string} date Дата в формате ГГГГ-ММ-ДД.
 * @returns {boolean} true, если условие выполнено.
 */
const markedOn = (e, date) => !!e && Object.keys(e.marks).some(k => k.indexOf(date + '|') === 0);

/**
 * Строит вкладку «Список группы».
 * @returns {string} HTML.
 */
function grpStudents() {
  const rows = rosterRows();
  return (
    periodControls() +
    '<div class="tbl-wrap"><table class="grid-tbl stud"><thead><tr><th>№</th><th>Студент</th><th>Роль</th><th>Вход</th><th>Заходил(а)</th><th>п</th><th>о</th><th>н</th><th>справка</th><th>не отм.</th><th>%</th><th title="Пропуски без уважительной причины, лимит 24 ч">без ув., ч</th><th>' +
    ICONS.document +
    '</th><th></th></tr></thead><tbody>' +
    rows
      .map(x => {
        const e = x.e,
          dim = x.r.flag ? 'dimrow' : '';
        if (!e)
          return (
            '<tr class="' +
            dim +
            '"><td>' +
            (x.r.n || '') +
            '</td><td>' +
            nameCell(x) +
            '</td><td class="dim">—</td><td colspan="11" class="dim">' +
            (x.r.flag ? 'вход закрыт' : 'ещё не заходил(а)') +
            '</td></tr>'
          );
        return (
          '<tr class="clickrow ' +
          dim +
          '" data-action="stud-open" data-id="' +
          e.id +
          '"><td>' +
          (x.r.n || '') +
          '</td><td>' +
          nameCell(x) +
          '</td><td>' +
          (Cloud.adminUids.has(e.id) ? '<span class="tag adm">админ-студент</span>' : 'студент') +
          '</td><td><span class="pill good">вошёл(ла)</span></td><td>' +
          U.esc(fmtAgo(e.p.seen)) +
          '</td><td>' +
          e.st.p +
          '</td><td>' +
          e.st.l +
          '</td><td>' +
          e.st.a +
          '</td><td>' +
          e.st.x +
          '</td><td>' +
          e.st.u +
          '</td>' +
          '<td><span class="pill ' +
          pctCls(e.st.pct) +
          '">' +
          (e.st.pct == null ? '—' : e.st.pct + '%') +
          '</span></td>' +
          absCell(e) +
          '<td>' +
          (e.certs.length || '') +
          '</td><td><button class="btn sm" data-action="att-edit" data-id="' +
          e.id +
          '">Изменить</button>' +
          (Cloud.adminUids.has(e.id)
            ? ''
            : '<button class="icon-btn" data-action="grp-release" data-rid="' +
              (x.r.id || '') +
              '" data-uid="' +
              e.id +
              '" title="Освободить фамилию" aria-label="Освободить фамилию">' +
              ICONS.unlocked +
              '</button>') +
          '</td></tr>'
        );
      })
      .join('') +
    '</tbody></table></div><p class="hint">' +
    ICONS.unlocked +
    ' освобождает фамилию: студент сможет войти заново (если он выбрал не ту фамилию).</p>'
  );
}

/**
 * Строит вкладку «Сегодня».
 * @returns {string} HTML.
 */
function grpToday() {
  const date = ui.grpDate || U.iso(U.today()),
    all = rosterRows(),
    np = Store.s.settings.pairs.length;
  const active = all.filter(x => !x.r.flag),
    students = active.filter(x => !x.r.admin);
  const inn = students.filter(x => x.e),
    mk = inn.filter(x => markedOn(x.e, date));
  const head =
    '<div class="daynav"><button class="icon-btn" data-action="grp-day" data-d="-1" aria-label="Предыдущий день">' +
    ICONS.playLeft +
    '</button><div class="daynav-t"><b>' +
    U.esc(U.fmtLong(U.fromISO(date))) +
    '</b></div><button class="icon-btn" data-action="grp-day" data-d="1" aria-label="Следующий день">' +
    ICONS.playRight +
    '</button></div>' +
    '<div class="sum-row"><span class="pill good">Вошли в приложение: ' +
    inn.length +
    ' из ' +
    students.length +
    '</span><span class="pill ' +
    (mk.length ? 'good' : '') +
    '">Отметились в этот день: ' +
    mk.length +
    '</span><span class="pill bad">Не заходили: ' +
    (students.length - inn.length) +
    '</span></div>' +
    (date < U.iso(U.today()) && date >= ATT_START
      ? '<p><button class="btn sm" data-action="grp-closeday">Проставить «н» неотмеченным за этот день</button></p>'
      : '');
  /**
   * Строит строку таблицы «Сегодня».
   * @param {Object} x Строка списка группы.
   * @returns {string} HTML.
   */
  const row = x => {
    const e = x.e,
      has = e ? new Map(Att.pairs(date, e.p.subgroup).map(p => [p.pair, p])) : new Map();
    return (
      '<tr class="' +
      (x.r.flag ? 'dimrow' : '') +
      '"><td>' +
      (x.r.n || '') +
      '</td><td>' +
      nameCell(x) +
      '</td><td>' +
      (e
        ? '<span class="pill good">✓ ' + U.esc(fmtAgo(e.p.seen)) + '</span>'
        : '<span class="pill bad">не заходил(а)</span>') +
      '</td><td>' +
      (e
        ? markedOn(e, date)
          ? '<span class="pill good">отметился</span>'
          : '<span class="pill">нет отметок</span>'
        : '<span class="dim">—</span>') +
      '</td>' +
      Array.from({length: np}, (_, i) => {
        const n = i + 1;
        if (!e || !has.has(n)) return '<td class="dim">·</td>';
        const s = Att.eff(e.marks, e.certs, date, n);
        return '<td><span class="sym ' + (ST_INFO[s] ? ST_INFO[s][1] : 'none') + '">' + (s || '?') + '</span></td>';
      }).join('') +
      '<td>' +
      (e
        ? '<button class="btn sm" data-action="att-edit" data-id="' +
          e.id +
          '" data-date="' +
          date +
          '">Изменить</button>'
        : '') +
      '</td></tr>'
    );
  };
  return (
    head +
    '<div class="tbl-wrap"><table class="grid-tbl"><thead><tr><th>№</th><th>Студент</th><th>Вошёл</th><th>Отметки</th>' +
    Array.from({length: np}, (_, i) => '<th>' + (i + 1) + '</th>').join('') +
    '<th></th></tr></thead><tbody>' +
    active.map(row).join('') +
    all
      .filter(x => x.r.flag)
      .map(row)
      .join('') +
    '</tbody></table></div>'
  );
}

/**
 * Строит вкладку «Работы группы».
 * @returns {string} HTML.
 */
function grpWorks() {
  const P = Cloud.adm.profiles,
    ids = Object.keys(P),
    ws = Cloud.gworks.slice().sort(byDue);
  const list = ws.length
    ? ws
        .map(w => {
          const wk = w.id + '@' + w.date,
            sb = subj(w.subjectId);
          let y = [],
            n = [],
            no = [];
          ids.forEach(id => {
            const a = ((Cloud.adm.chat[id] || {}).answers || {})[wk];
            const nm = P[id].name || 'Без имени';
            if (a && a.a === 'y') y.push(nm);
            else if (a && a.a === 'n') n.push(nm);
            else no.push(nm);
          });
          return (
            '<div class="item"><div class="item-main"><div class="item-title">' +
            U.esc(w.title) +
            '</div><div class="item-meta">' +
            (sb ? '<span class="chip" style="--c:' + sb.color + '">' + U.esc(sb.short || sb.name) + '</span>' : '') +
            '<span class="tag">' +
            U.esc(w.type || 'Работа') +
            '</span><span class="tag">' +
            U.esc(U.fmtShort(U.fromISO(w.date))) +
            (w.time ? ' ' + U.esc(w.time) : '') +
            '</span></div>' +
            '<div class="ready"><span class="pill good" title="' +
            U.esc(y.join(', ')) +
            '">готовы: ' +
            y.length +
            '</span><span class="pill bad" title="' +
            U.esc(n.join(', ')) +
            '">не готовы: ' +
            n.length +
            '</span><span class="pill" title="' +
            U.esc(no.join(', ')) +
            '">без ответа: ' +
            no.length +
            '</span></div>' +
            (n.length ? '<div class="hint">Не готовы: ' + U.esc(n.join(', ')) + '</div>' : '') +
            '</div>' +
            '<div class="item-actions"><button class="icon-btn" data-action="gwork-edit" data-id="' +
            w.id +
            '" aria-label="Изменить">' +
            ICONS.pencil +
            '</button><button class="icon-btn" data-action="gwork-del" data-id="' +
            w.id +
            '" aria-label="Удалить">' +
            ICONS.wastebasket +
            '</button></div></div>'
          );
        })
        .join('')
    : empty(ICONS.megaphone, 'Работ группы пока нет');
  return (
    '<div class="head-actions" style="margin-bottom:12px"><button class="btn primary" data-action="gwork-add">＋ Работа для всей группы</button></div><div class="items">' +
    list +
    '</div>' +
    '<p class="hint">Эти работы видят все студенты, а Политешик за сутки до срока спрашивает у каждого, готов ли он.</p>'
  );
}

/**
 * Собирает невыполненные просьбы студентов.
 * @returns {Array<Object>} Массив.
 */
function pendingReqs() {
  const out = [];
  Object.keys(Cloud.adm.chat).forEach(uid => {
    ((Cloud.adm.chat[uid] || {}).reqs || []).forEach(r => {
      if (!r.done) out.push({uid, date: r.date, at: r.at, name: (Cloud.adm.profiles[uid] || {}).name || 'Без имени'});
    });
  });
  return out.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}
/**
 * Строит вкладку «Просьбы».
 * @returns {string} HTML.
 */
function grpReqs() {
  const rs = pendingReqs();
  if (!rs.length) return empty(ICONS.check, 'Просьб нет. Студенты пишут их через Политешика («Напомнить админу?»).');
  return (
    '<div class="items">' +
    rs
      .map(
        r =>
          '<div class="item"><div class="item-main"><div class="item-title">' +
          U.esc(r.name) +
          '</div><div class="item-meta"><span class="tag">нужна отметка за ' +
          U.esc(U.fmtShort(U.fromISO(r.date))) +
          '</span><span class="tag">' +
          U.esc(fmtAgo(r.at)) +
          '</span></div></div>' +
          '<div class="item-actions"><button class="btn sm primary" data-action="stud-open" data-id="' +
          r.uid +
          '" data-date="' +
          r.date +
          '">Отметить</button><button class="btn sm" data-action="req-done" data-uid="' +
          r.uid +
          '" data-date="' +
          r.date +
          '">Готово</button></div></div>'
      )
      .join('') +
    '</div>'
  );
}
/**
 * Строит редактор вопросов Политешика.
 * @returns {string} HTML.
 */
function grpFaq() {
  const it = faqItems();
  return (
    '<p class="md-help" style="margin:0 0 12px">Эти вопросы студенты видят кнопками в чате с Политешиком. Ответ можно переписать; пусто — вопрос удаляется.</p>' +
    '<div data-form="faq">' +
    it
      .map(
        (f, i) =>
          '<div class="faq-ed"><input class="input" data-faq-q value="' +
          U.esc(f.q) +
          '" placeholder="Вопрос"><textarea class="input" data-faq-a rows="2" placeholder="Ответ Политешика">' +
          U.esc(f.a) +
          '</textarea></div>'
      )
      .join('') +
    '<div class="faq-ed"><input class="input" data-faq-q placeholder="Новый вопрос"><textarea class="input" data-faq-a rows="2" placeholder="Ответ"></textarea></div>' +
    '<div class="head-actions"><button class="btn primary" data-action="save-form">Сохранить вопросы</button><button class="btn" data-action="faq-reset">Вернуть стандартные</button></div></div>'
  );
}
/**
 * Отрисовывает раздел «Группа».
 * @returns {string} HTML.
 */
function viewGroup() {
  if (!Cloud.isAdmin)
    return (
      '<div class="empty"><div class="mini-mascot">' +
      Mascot.svg('worried', 80) +
      '</div>Этот раздел доступен только админу группы</div>'
    );
  if (!ui.attMonth) ui.attMonth = U.iso(U.today()).slice(0, 7);
  const nreq = pendingReqs().length,
    tabs = [
      ['today', ICONS.calendarDay + ' Сегодня'],
      ['students', ICONS.users + ' Список группы'],
      ['reqs', ICONS.bell + ' Просьбы' + (nreq ? ' (' + nreq + ')' : '')],
      ['works', ICONS.megaphone + ' Работы группы'],
      ['faq', ICONS.questionMark + ' Вопросы Политешика']
    ];
  const students = ROSTER.filter(r => !r.flag && !r.admin).length,
    n = rosterRows().filter(x => x.e && x.r.id && !x.r.flag && !x.r.admin).length;
  return (
    '<div class="page-head"><div><h1>Группа</h1><p>Вошло в приложение: <b>' +
    n +
    '</b> из ' +
    students +
    ' · данные обновляются сами</p></div><div class="head-actions"><button class="btn" data-action="nav" data-tab="journal">' +
    ICONS.folder +
    ' Журнал</button></div></div>' +
    '<div class="tabs">' +
    tabs
      .map(
        t =>
          '<button class="tab' +
          (ui.grpTab === t[0] ? ' on' : '') +
          '" data-action="grp-tab" data-tab="' +
          t[0] +
          '">' +
          t[1] +
          '</button>'
      )
      .join('') +
    '</div>' +
    (ui.grpTab === 'students'
      ? grpStudents()
      : ui.grpTab === 'works'
        ? grpWorks()
        : ui.grpTab === 'reqs'
          ? grpReqs()
          : ui.grpTab === 'faq'
            ? grpFaq()
            : grpToday())
  );
}
