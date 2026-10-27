'use strict';

/**
 * Возвращает все пары дня (с учётом недели и замен).
 * @param {string} date День ГГГГ-ММ-ДД.
 * @param {string} subgroup Подгруппа.
 * @returns {Array<Object>} Массив.
 */
function lessonsOn(date, subgroup) {
  return Att.pairs(date, subgroup || '').reduce((all, p) => all.concat(p.lessons || []), []);
}
/**
 * Возвращает имя для заголовка кабинета.
 * @returns {string} Строка.
 */
function staffGreeting() {
  return Cloud.profile && Cloud.profile.name ? U.esc(Cloud.profile.name) : Roles.names[Cloud.role] || '';
}
/**
 * Строит плитку со значением и подписью.
 * @param {string|number} value Значение.
 * @param {string} label Подпись.
 * @param {string} cls Дополнительный класс.
 * @returns {string} HTML.
 */
function statTile(value, label, cls) {
  return '<div class="stat ' + (cls || '') + '"><b>' + value + '</b><span>' + label + '</span></div>';
}
/**
 * Строит дашборд преподавателя или куратора.
 * @returns {string} HTML.
 */
function viewTDash() {
  const today = U.iso(U.today()),
    list = Roles.mine(lessonsOn(today, ''));
  const students = Roles.studentList(),
    stats = students.map(s =>
      Object.assign(
        {
          s
        },
        Roles.stats(s.uid)
      )
    ),
    weak = stats.filter(x => Roles.isWeak(x));
  const week = stats.reduce((sum, x) => sum + x.absent, 0);
  const loading = !Cloud.admReady ? '<p class="md-help">Данные группы загружаются…</p>' : '';
  return (
    '<div class="page-head"><div><h1>Дашборд</h1><p>' +
    staffGreeting() +
    ' · ' +
    U.esc(U.fmtLong(new Date())) +
    '</p></div></div>' +
    loading +
    '<div class="grid-stats">' +
    statTile(list.length, Cloud.isTeacher ? 'Сегодня ваших пар' : 'Сегодня пар у группы') +
    statTile(students.length, 'Студентов в списке') +
    statTile(weak.length, 'Проблемные (< ' + Roles.weakPercent + '%)', weak.length ? 'bad' : '') +
    '</div>' +
    '<section class="card"><h2>Пары сегодня</h2>' +
    (list.length
      ? list
          .map(
            l =>
              '<div class="item"><div class="item-main"><div class="item-title">' +
              l.pair +
              ' пара · ' +
              U.esc((subj(l.subjectId) || {}).name || 'Пара') +
              '</div><div class="item-meta"><span class="tag">' +
              U.esc(l.room ? 'ауд. ' + l.room : 'аудитория не указана') +
              '</span><span class="tag">' +
              U.esc(l.who || '') +
              '</span></div></div></div>'
          )
          .join('')
      : '<div class="empty">Сегодня пар нет</div>') +
    '</section>' +
    '<section class="card"><h2>Кому нужно внимание</h2>' +
    (weak.length
      ? weak
          .slice(0, 8)
          .map(
            x =>
              '<div class="item"><div class="item-main"><div class="item-title">' +
              U.esc(x.s.name) +
              '</div><div class="item-meta"><span class="tag">посещаемость ' +
              x.pct +
              '%</span><span class="tag">пропусков ' +
              x.absent +
              '</span></div></div></div>'
          )
          .join('')
      : '<div class="empty">Проблемных студентов нет</div>') +
    '<p class="md-help">Раздел «Работы на проверку» появится, когда студенты смогут сдавать работы в приложении. Сейчас показаны только данные, которые есть в системе. Пропусков за месяц: ' +
    week +
    '.</p></section>'
  );
}
/**
 * Строит список студентов с посещаемостью, фильтрами и заметками.
 * @returns {string} HTML.
 */
function viewTStudents() {
  const filter = ui.tFilter || 'all',
    notes = Cloud.teacherNotes || {};
  const rows = Roles.studentList()
    .map(s =>
      Object.assign(
        {
          s
        },
        Roles.stats(s.uid)
      )
    )
    .filter(
      x => filter === 'all' || (filter === 'weak' && Roles.isWeak(x)) || (filter === 'red' && x.hours >= ABS_LIMIT)
    );
  /**
   * Строит кнопку-фильтр.
   * @param {string} id Значение фильтра.
   * @param {string} label Подпись кнопки.
   * @returns {string} HTML.
   */
  const chip = (id, label) =>
    '<button class="fchip' +
    (filter === id ? ' on' : '') +
    '" data-action="t-filter" data-id="' +
    id +
    '">' +
    label +
    '</button>';
  return (
    '<div class="page-head"><div><h1>Студенты</h1><p>Посещаемость за месяц. Заметки видите только вы.</p></div></div>' +
    '<div class="fchips">' +
    chip('all', 'Все') +
    chip('weak', 'Проблемные') +
    chip('red', 'Красная зона') +
    '</div>' +
    (!Cloud.admReady ? '<p class="md-help">Данные группы загружаются…</p>' : '') +
    '<section class="card">' +
    (rows.length
      ? rows
          .map(
            x =>
              '<div class="item' +
              (Roles.isWeak(x) ? ' u-red' : '') +
              '"><div class="item-main"><div class="item-title">' +
              U.esc(x.s.name) +
              '</div><div class="item-meta">' +
              (x.s.subgroup ? '<span class="tag">подгр. ' + U.esc(x.s.subgroup) + '</span>' : '') +
              '<span class="tag">' +
              (x.pct == null ? 'нет данных' : x.pct + '%') +
              '</span><span class="tag">пропусков ' +
              x.absent +
              '</span>' +
              (notes[x.s.uid] ? '<span class="tag">есть заметка</span>' : '') +
              '</div></div><div class="item-actions"><button class="btn sm" data-action="t-note" data-uid="' +
              x.s.uid +
              '">Заметка</button></div></div>'
          )
          .join('')
      : '<div class="empty">Никого не найдено</div>') +
    '</section>'
  );
}
/**
 * Строит список предметов с отметкой «ваш предмет».
 * @returns {string} HTML.
 */
function viewTSubjects() {
  const surname = Roles.surname().toLowerCase(),
    subjects = Store.s.subjects;
  /**
   * Проверяет, ведёт ли преподаватель этот предмет.
   * @param {string} id Предмет.
   * @returns {boolean} true, если условие выполнено.
   */
  const taught = id =>
    Store.s.schedule.some(
      l =>
        l.subjectId === id &&
        surname &&
        String(l.who || '')
          .toLowerCase()
          .indexOf(surname) >= 0
    );
  return (
    '<div class="page-head"><div><h1>Предметы</h1><p>Предметы группы. Ваши отмечены.</p></div></div><section class="card">' +
    subjects
      .map(
        sb =>
          '<div class="item"><div class="item-main"><div class="item-title"><span class="chip" style="--c:' +
          sb.color +
          '">' +
          U.esc(sb.short || sb.name) +
          '</span> ' +
          U.esc(sb.name) +
          '</div><div class="item-meta">' +
          (taught(sb.id) ? '<span class="tag status prep">Ваш предмет</span>' : '') +
          '<span class="tag">конспектов ' +
          Store.s.notes.filter(n => n.subjectId === sb.id).length +
          '</span><span class="tag">решений ' +
          Solutions.count(sb.id) +
          '</span></div></div></div>'
      )
      .join('') +
    '</section><p class="md-help">Загрузка материалов и домашних заданий преподавателем пока в разработке: сейчас их добавляет староста.</p>'
  );
}
/**
 * Строит список консультаций.
 * @returns {string} HTML.
 */
function viewConsult() {
  const items = (Cloud.consults || [])
    .slice()
    .sort((a, b) => a.day - b.day || String(a.time).localeCompare(String(b.time)));
  return (
    '<div class="page-head"><div><h1>Консультации</h1><p>День, время и кабинет.</p></div><div class="head-actions"><button class="btn primary" data-action="consult-add">＋ Добавить</button></div></div><section class="card">' +
    (items.length
      ? items
          .map(
            c =>
              '<div class="item"><div class="item-main"><div class="item-title">' +
              DAYS_FULL[c.day] +
              ' · ' +
              U.esc(c.time) +
              '</div><div class="item-meta"><span class="tag">ауд. ' +
              U.esc(c.room || '—') +
              '</span>' +
              (c.note ? '<span class="tag">' + U.esc(c.note) + '</span>' : '') +
              '</div></div><div class="item-actions"><button class="icon-btn" data-action="consult-del" data-id="' +
              U.esc(c.id) +
              '" aria-label="Удалить">' +
              ICONS.wastebasket +
              '</button></div></div>'
          )
          .join('')
      : '<div class="empty">Консультаций пока нет</div>') +
    '</section><p class="md-help">Пока консультации хранятся только у вас. Показ студентам в приложении будет добавлен следующим шагом.</p>'
  );
}
/**
 * Строит экран выгрузки данных в CSV.
 * @returns {string} HTML.
 */
function viewTExport() {
  return (
    '<div class="page-head"><div><h1>Экспорт</h1><p>Данные в CSV: открываются в Excel и Numbers.</p></div></div>' +
    '<section class="card"><h2>Журнал посещаемости</h2><p class="md-help">Все студенты и отметки за выбранный период журнала.</p><button class="btn primary" data-action="grp-csv">Скачать журнал (CSV)</button></section>' +
    '<section class="card"><h2>Список студентов</h2><p class="md-help">Имя, подгруппа, посещаемость за месяц и пропуски.</p><button class="btn primary" data-action="texport-students">Скачать список (CSV)</button></section>'
  );
}
/**
 * Строит экран отделения: отчёт и новость для всех групп.
 * @returns {string} HTML.
 */
function viewDept() {
  const report = Cloud.deptReport || [],
    news = (News.items || []).filter(n => n.created_by === Cloud.uid && n.kind === 'post');
  return (
    '<div class="page-head"><div><h1>Отделение</h1><p>Отчёт по группам и новости для всех групп.</p></div><div class="head-actions"><button class="btn primary" data-action="dept-report">Отчёт</button></div></div>' +
    '<section class="card"><h2>Группы</h2>' +
    (report.length
      ? '<table class="grid-tbl"><thead><tr><th>Группа</th><th>Куратор</th><th>Студентов</th><th>Заявок</th></tr></thead><tbody>' +
        report
          .map(
            r =>
              '<tr><td>' +
              U.esc(r.group_name) +
              '</td><td>' +
              U.esc(r.curator || '—') +
              '</td><td>' +
              r.students +
              '</td><td>' +
              r.pending +
              '</td></tr>'
          )
          .join('') +
        '</tbody></table>'
      : '<div class="empty">Нажмите «Отчёт», чтобы загрузить данные</div>') +
    '</section>' +
    '<section class="card"><h2>Новость во все группы</h2><div data-form="dept-news">' +
    field('Заголовок', '<input class="input" name="title" maxlength="200">') +
    field('Текст', '<textarea class="input" name="body" rows="4" maxlength="10000"></textarea>') +
    '<button class="btn primary" data-action="save-form">Опубликовать</button></div>' +
    (news.length
      ? '<h3>Ваши новости</h3>' +
        news
          .map(
            n =>
              '<div class="item"><div class="item-main"><div class="item-title">' +
              U.esc(n.title) +
              '</div></div><div class="item-actions"><button class="icon-btn" data-action="dept-news-del" data-id="' +
              n.id +
              '" aria-label="Удалить">' +
              ICONS.wastebasket +
              '</button></div></div>'
          )
          .join('')
      : '') +
    '</section>'
  );
}
/**
 * Строит экран «Успеваемость ребёнка» для родителя.
 * @returns {string} HTML.
 */
function viewChild() {
  const child = Cloud.child;
  if (!child)
    return (
      '<div class="page-head"><div><h1>Успеваемость ребёнка</h1></div></div><div class="card empty">' +
      (Cloud.childLoaded
        ? 'Староста ещё не связал вашу заявку с аккаунтом ребёнка. Напишите ей.'
        : 'Загружаем данные…') +
      '</div>'
    );
  const marks = child.marks || {},
    today = U.iso(U.today()),
    month = today.slice(0, 7) + '-01',
    stats = Att.stats(marks, [], child.subgroup || '', month < ATT_START ? ATT_START : month, today);
  const absences = Object.keys(marks)
    .filter(k => marks[k] === 'н')
    .sort()
    .reverse()
    .slice(0, 14)
    .map(k => {
      const date = k.slice(0, 10),
        pair = +k.split('|')[1],
        lesson = lessonsOn(date, child.subgroup).find(l => l.pair === pair),
        sb = lesson ? subj(lesson.subjectId) : null;
      return (
        '<div class="item u-red"><div class="item-main"><div class="item-title">' +
        U.esc(U.fmtShort(U.fromISO(date))) +
        ' · ' +
        pair +
        ' пара</div><div class="item-meta"><span class="tag">' +
        U.esc(sb ? sb.name : 'пара') +
        '</span></div></div></div>'
      );
    })
    .join('');
  return (
    '<div class="page-head"><div><h1>Успеваемость ребёнка</h1><p>' +
    U.esc(child.name || '') +
    '</p></div></div>' +
    '<div class="grid-stats">' +
    statTile(stats.pct == null ? '—' : stats.pct + '%', 'Посещаемость за месяц') +
    statTile(stats.a, 'Пропусков (н)') +
    statTile(stats.p + stats.l, 'Присутствовал(а)') +
    '</div>' +
    '<section class="card"><h2>Последние пропуски</h2>' +
    (absences || '<div class="empty">Пропусков нет</div>') +
    '</section>' +
    '<p class="md-help">Здесь только посещаемость. Справки и записки ребёнка не показываются.</p>'
  );
}
/**
 * Строит вкладку «Заявки» для старосты.
 * @returns {string} HTML.
 */
function viewRequests() {
  Cloud.loadRequests();
  const rows = Cloud.requests || [],
    pending = rows.filter(r => r.status === 'pending'),
    groups = Cloud.groups || [
      {
        id: 'g_main',
        name: 'Группа'
      }
    ];
  const students = Roles.studentList();
  /**
   * Строит варианты выбора роли.
   * @param {string} sel Выбранная роль.
   * @returns {string} HTML.
   */
  const roleOpts = sel =>
    ['student', 'curator', 'department', 'parent', 'teacher']
      .map(r => '<option value="' + r + '"' + (r === sel ? ' selected' : '') + '>' + Roles.names[r] + '</option>')
      .join('');
  /**
   * Строит карточку заявки.
   * @param {Object} r Заявка.
   * @returns {string} HTML.
   */
  const card = r => {
    const def =
      r.requested_role === 'parent'
        ? 'parent'
        : r.requested_role === 'staff'
          ? 'curator'
          : r.requested_role === 'teacher'
            ? 'teacher'
            : 'student';
    return (
      '<article class="card req-card" data-form="req" data-uid="' +
      r.uid +
      '"><header><div><h3>' +
      U.esc(r.full_name || r.email) +
      '</h3><small>' +
      U.esc(r.email) +
      ' · ' +
      U.esc(U.fmtShort(new Date(r.created_at))) +
      '</small></div><span class="tag">' +
      ({
        student: 'студент',
        parent: 'родитель',
        staff: 'куратор / отделение',
        teacher: 'преподаватель'
      }[r.requested_role] || 'студент') +
      '</span></header>' +
      (r.child_name
        ? '<p>Ребёнок: <b>' +
          U.esc(r.child_name) +
          '</b> ' +
          (r.child_uid
            ? '<span class="tag status prep">найден в списке</span>'
            : '<span class="tag">не найден: выберите ниже</span>') +
          '</p>'
        : '') +
      (r.note ? '<p class="md-help">' + U.esc(r.note) + '</p>' : '') +
      '<div class="row2">' +
      field('Роль', '<select class="input" name="role">' + roleOpts(def) + '</select>') +
      field(
        'Группа',
        '<select class="input" name="group"><option value=""' +
          (r.college_group ? ' selected' : '') +
          '>' +
          (r.college_group ? 'По группе колледжа ' + U.esc(r.college_group) : 'Как указано в заявке') +
          '</option>' +
          groups
            .map(
              g =>
                '<option value="' +
                U.esc(g.id) +
                '"' +
                (!r.college_group && g.id === r.group_id ? ' selected' : '') +
                '>' +
                U.esc(g.name) +
                '</option>'
            )
            .join('') +
          '</select>'
      ) +
      '</div>' +
      (r.requested_role === 'parent' && !r.child_uid
        ? field(
            'Кто ребёнок',
            '<select class="input" name="child"><option value="">— выберите —</option>' +
              students.map(s => '<option value="' + s.uid + '">' + U.esc(s.name) + '</option>').join('') +
              '</select>'
          )
        : '') +
      '<div class="head-actions"><button class="btn primary" data-action="req-approve">Одобрить</button><button class="btn danger" data-action="req-reject">Отклонить</button></div></article>'
    );
  };
  return (
    '<div class="page-head"><div><h1>Заявки</h1><p>Новые пользователи ждут вашего решения.</p></div><div class="head-actions"><button class="btn" data-action="req-refresh">Обновить</button></div></div>' +
    '<section class="card"><div class="set-row"><div><b>Требовать одобрение</b><p>Если выключить, новые студенты получают доступ сразу.</p></div><button class="btn" data-action="req-toggle">' +
    (Cloud.needApproval === false ? 'Выключено' : 'Включено') +
    '</button></div></section>' +
    (pending.length ? pending.map(card).join('') : '<div class="card empty">Новых заявок нет</div>') +
    '<section class="card"><h2>Решённые</h2>' +
    (rows
      .filter(r => r.status !== 'pending')
      .slice(0, 20)
      .map(
        r =>
          '<div class="item"><div class="item-main"><div class="item-title">' +
          U.esc(r.full_name || r.email) +
          '</div><div class="item-meta"><span class="tag">' +
          (r.status === 'approved' ? Roles.names[r.role] || r.role : 'отклонена') +
          '</span></div></div></div>'
      )
      .join('') || '<div class="empty">Пока пусто</div>') +
    '</section>'
  );
}
/**
 * Строит вкладку «Доступы»: режим просмотра и роли участников.
 * @returns {string} HTML.
 */
function viewAccess() {
  Cloud.loadRequests();
  const rows = (Cloud.requests || []).filter(r => r.status === 'approved'),
    current = Store.s.settings.viewAs || 'admin',
    students = Roles.studentList();
  const roleButtons = [
    ['student', 'Студент'],
    ['admin', 'Староста'],
    ['curator', 'Куратор'],
    ['teacher', 'Преподаватель'],
    ['parent', 'Родитель'],
    ['department', 'Отделение']
  ]
    .map(
      r =>
        '<button class="my-chip' +
        (current === r[0] ? ' on' : '') +
        '" data-action="view-as" data-role="' +
        r[0] +
        '" aria-pressed="' +
        (current === r[0]) +
        '">' +
        r[1] +
        '</button>'
    )
    .join('');
  /**
   * Строит варианты выбора роли.
   * @param {string} sel Выбранная роль.
   * @returns {string} HTML.
   */
  const roleOpts = sel =>
    ['student', 'curator', 'department', 'parent']
      .map(r => '<option value="' + r + '"' + (r === sel ? ' selected' : '') + '>' + Roles.names[r] + '</option>')
      .join('');
  return (
    Roles.settingsTabs() +
    '<div class="page-head"><div><h1>Доступы</h1><p>Видна только вам.</p></div></div>' +
    '<section class="card"><h2>Режим просмотра</h2><p class="md-help">Показывает приложение так, как его видит выбранная роль. Права на сервере остаются вашими: это только внешний вид.</p><div class="my-chips">' +
    roleButtons +
    '</div>' +
    (current === 'parent'
      ? field(
          'Чей ребёнок',
          '<select class="input" data-change="view-child"><option value="">— выберите студента —</option>' +
            students
              .map(
                s =>
                  '<option value="' +
                  s.uid +
                  '"' +
                  (s.uid === Store.s.settings.viewChild ? ' selected' : '') +
                  '>' +
                  U.esc(s.name) +
                  '</option>'
              )
              .join('') +
            '</select>'
        )
      : '') +
    '</section>' +
    '<section class="card"><h2>Участники</h2>' +
    (rows.length
      ? rows
          .map(
            r =>
              '<div class="item" data-form="member" data-uid="' +
              r.uid +
              '"><div class="item-main"><div class="item-title">' +
              U.esc(r.full_name || r.email || Roles.names[r.role] || 'Участник') +
              '</div><div class="item-meta"><span class="tag">' +
              U.esc(r.email || Roles.names[r.role] || '') +
              '</span></div></div>' +
              (['admin', 'teacher'].indexOf(r.role) >= 0
                ? '<span class="tag">' + Roles.names[r.role] + '</span>'
                : '<select class="input" data-change="member-role" data-uid="' +
                  r.uid +
                  '">' +
                  roleOpts(r.role) +
                  '</select>') +
              '</div>'
          )
          .join('')
      : '<div class="empty">Нет данных</div>') +
    '</section>'
  );
}
/**
 * Открывает окно личной заметки о студенте.
 * @param {string} uid Студент.
 */
function openTeacherNote(uid) {
  const profile = (Cloud.adm.profiles || {})[uid] || {};
  UI.open(
    'Заметка: ' + (profile.name || 'студент'),
    '<div data-form="tnote" data-uid="' +
      uid +
      '"><p class="md-help">Заметку видите только вы.</p>' +
      field(
        'Текст',
        '<textarea class="input" name="text" rows="6" maxlength="2000">' +
          U.esc((Cloud.teacherNotes || {})[uid] || '') +
          '</textarea>'
      ) +
      foot(null, 'Сохранить') +
      '</div>'
  );
}
/**
 * Открывает форму новой консультации.
 */
function openConsultForm() {
  UI.open(
    'Консультация',
    '<div data-form="consult"><div class="row2">' +
      field(
        'День',
        '<select class="input" name="day">' +
          DAYS_FULL.map((d, i) => '<option value="' + i + '">' + d + '</option>').join('') +
          '</select>'
      ) +
      field('Время', '<input class="input" type="time" name="time" value="15:00">') +
      '</div>' +
      '<div class="row2">' +
      field('Кабинет', '<input class="input" name="room" maxlength="20">') +
      field('Комментарий', '<input class="input" name="note" maxlength="120">') +
      '</div>' +
      foot(null, 'Добавить') +
      '</div>'
  );
}
