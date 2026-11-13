'use strict';

const Roles = {
  names: {
    student: 'Студент',
    admin: 'Староста',
    developer: 'Разработчик',
    curator: 'Куратор',
    teacher: 'Преподаватель',
    parent: 'Родитель',
    department: 'Отделение'
  },
  tabsByRole: {
    developer: ['dashboard', 'schedule', 'journal', 'subjects', 'teachers', 'news', 'chat', 'people', 'rating', 'users', 'settings'],
    teacher: ['tdash', 'schedule', 'journal', 'tstudents', 'tsubjects', 'consult', 'texport', 'chat', 'cabinet', 'settings'],
    curator: ['tdash', 'schedule', 'groupSchedule', 'journal', 'tstudents', 'news', 'chat', 'cabinet', 'settings'],
    department: ['dept', 'news', 'settings'],
    parent: ['child', 'settings']
  },
  staffOnly: ['groupSchedule', 'tdash', 'tstudents', 'tsubjects', 'consult', 'texport', 'dept', 'child'],
  weakPercent: 70,
  /**
   * Возвращает список вкладок для текущей роли или null, если ограничений нет.
   * @returns {Array<string>|null} Массив.
   */
  tabs() {
    const list = Cloud.facultyContext?.active && Cloud.role==='teacher'?['tdash','schedule','journal','tstudents','tsubjects','chat','cabinet','settings']:Roles.tabsByRole[Cloud.role];
    if (!list) return null;
    const visible=list.filter(id=>id!=='groupSchedule'||Cloud.curatorContext?.active===true);
    return Roles.isOwner() ? visible.concat(['access']) : visible;
  },
  /**
   * Проверяет, доступна ли вкладка текущей роли.
   * @param {string} tab Идентификатор вкладки.
   * @returns {boolean} true, если условие выполнено.
   */
  allows(tab) {
    if (tab === 'diagnostics') return Roles.isOwner();
    const list = Roles.tabs();
    return !list || list.indexOf(tab) >= 0;
  },
  /**
   * Возвращает вкладку, с которой начинается работа текущей роли.
   * @returns {string} Строка.
   */
  home() {
    const list = Roles.tabs();
    return list ? list[0] : 'dashboard';
  },
  /**
   * Проверяет, что вошла Игнатенок Арина (староста): только ей видна вкладка «Доступы».
   * @returns {boolean} true, если условие выполнено.
   */
  isOwner() {
    return Cloud.isSuperAdmin === true;
  },
  /**
   * Строит переключатель «Настройки / Доступы» для владельца.
   * @returns {string} HTML.
   */
  settingsTabs() {
    if (Roles.isOwner())
      return (
        '<div class="tabs"><button class="tab' +
        (ui.tab === 'access' ? '' : ' on') +
        '" data-action="set-tab" data-tab="main">Настройки</button><button class="tab' +
        (ui.tab === 'access' ? ' on' : '') +
        '" data-action="set-tab" data-tab="access">Доступы</button></div>'
      );
    if (Cloud.realAdmin)
      return (
        '<p class="md-help">Вкладка «Доступы» открывается только для аккаунта Игнатенок Арина. Сейчас в профиле: «' +
        U.esc((Cloud.profile && Cloud.profile.name) || '—') +
        '», код ' +
        U.esc((Cloud.profile && Cloud.profile.rid) || '—') +
        '.</p>'
      );
    return '';
  },
  /**
   * Возвращает введённый при регистрации код группы.
   * @returns {string} Строка.
   */
  storedCode() {
    try {
      return ui.groupCode || window.localStorage.getItem('politeshik:gc') || '';
    } catch (error) {
      return ui.groupCode || '';
    }
  },
  /**
   * Проверяет, что аккаунт — студент группы (или староста) и подходит для списков.
   * @param {string} uid Идентификатор пользователя.
   * @returns {boolean} true, если условие выполнено.
   */
  countsAsStudent(uid) {
    const profile = (Cloud.adm.profiles || {})[uid];
    if (!profile || !profile.rid) return false;
    const member = (Cloud.memberMap || {})[uid];
    if (member) return member.requested_role !== 'parent' && member.status === 'approved' && ['student','admin','developer'].includes(member.role);
    return !['teacher','parent','curator','department','staff'].includes(profile.role);
  },

  /**
   * Собирает студентов, вошедших в приложение: один человек (одно ФИО) = одна запись, даже если у него два аккаунта.
   * Основным берётся аккаунт, который держит ФИО; отметки и справки лишних аккаунтов добавляются, основного приоритетнее.
   * @returns {Array<Object>} Объекты {id (основной аккаунт), ids (все аккаунты), rid, profile, marks, certs}.
   */
  people() {
    const P = Cloud.adm.profiles || {},
      byRid = {};
    Object.keys(P)
      .filter(id => Roles.countsAsStudent(id))
      .forEach(id => {
        (byRid[P[id].rid] = byRid[P[id].rid] || []).push(id);
      });
    const marksOf = id => ((Cloud.adm.att || {})[id] || {}).marks || {},
      certsOf = id => ((Cloud.adm.certs || {})[id] || {}).items || [];
    return Object.keys(byRid).map(rid => {
      const ids = byRid[rid],
        claim = (Cloud.claims || {})[rid],
        primary =
          ids.indexOf(claim) >= 0
            ? claim
            : ids.find(id => Cloud.adminUids && Cloud.adminUids.has(id)) ||
              ids.slice().sort((a, b) => Object.keys(marksOf(b)).length - Object.keys(marksOf(a)).length)[0],
        marks = {},
        seen = {},
        certs = [];
      ids
        .filter(id => id !== primary)
        .concat([primary])
        .forEach(id => Object.assign(marks, marksOf(id)));
      [primary].concat(ids.filter(id => id !== primary)).forEach(id =>
        certsOf(id).forEach(c => {
          const key = c.id || JSON.stringify(c);
          if (seen[key]) return;
          seen[key] = true;
          certs.push(c);
        })
      );
      return {id: primary, ids, rid, profile: P[primary], marks, certs};
    });
  },
  /**
   * Возвращает фамилию вошедшего (первое слово имени).
   * @returns {string} Строка.
   */
  surname() {
    const name = (Cloud.profile && Cloud.profile.name) || '';
    return name.split(/\s+/)[0] || '';
  },
  /**
   * Оставляет пары преподавателя по фамилии в поле «преподаватель».
   * @param {Array<Object>} lessons Пары дня.
   * @returns {Array<Object>} Массив.
   */
  mine(lessons) {
    const surname = Roles.surname().toLowerCase();
    if (!surname || !Cloud.isTeacher) return lessons;
    return lessons.filter(
      l =>
        String(l.who || '')
          .toLowerCase()
          .indexOf(surname) >= 0
    );
  },
  /**
   * Собирает список студентов группы из загруженных профилей.
   * @returns {Array<Object>} Массив.
   */
  studentList() {
    const profiles = Cloud.adm.profiles || {};
    return Object.keys(profiles)
      .filter(uid => Roles.countsAsStudent(uid))
      .map(uid => ({
        uid,
        name: profiles[uid].name || 'Студент',
        rid: profiles[uid].rid,
        subgroup: profiles[uid].subgroup || ''
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  },
  /**
   * Считает посещаемость и пропуски студента за текущий месяц.
   * @param {string} uid Идентификатор студента.
   * @returns {Object} Объект.
   */
  stats(uid) {
    const marks = ((Cloud.adm.att || {})[uid] || {}).marks || {},
      certs = ((Cloud.adm.certs || {})[uid] || {}).items || [],
      today = U.iso(U.today());
    const month = today.slice(0, 7) + '-01',
      profile = (Cloud.adm.profiles || {})[uid] || {};
    const stats = Att.stats(marks, certs, profile.subgroup || '', month < ATT_START ? ATT_START : month, today);
    return {
      pct: stats.pct,
      absent: stats.a,
      excused: stats.x,
      hours: Att.absHours(marks, certs, profile.subgroup || ''),
      marks
    };
  },
  /**
   * Проверяет, что посещаемость ниже порога внимания.
   * @param {Object} stat Результат Roles.stats.
   * @returns {boolean} true, если условие выполнено.
   */
  isWeak(stat) {
    return stat.pct != null && stat.pct < Roles.weakPercent;
  },
  /**
   * Собирает строку CSV с кавычками.
   * @param {Array} cells Значения строки.
   * @returns {string} Строка.
   */
  csvLine(cells) {
    return cells.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(';');
  },
  /**
   * Скачивает CSV-файл с отметкой порядка байтов для Excel.
   * @param {Array<string>} lines Строки CSV.
   * @param {string} name Имя файла.
   */
  download(lines, name) {
    downloadBlob(
      new Blob(['\ufeff' + lines.join('\r\n')], {
        type: 'text/csv;charset=utf-8'
      }),
      name
    );
  },
  /**
   * Проверяет поля регистрации родителя или куратора.
   * @param {string} kind Parent или staff.
   * @param {HTMLElement} form Форма входа.
   * @returns {string} текст ошибки или пустая строка.
   */
  checkExtra(kind, form) {
    const value = name => ((form.querySelector('[name=' + name + ']') || {}).value || '').trim();
    if (value('person_name').split(/\s+/).length < 2) return 'Введите ваше ФИО полностью';
    if (kind === 'parent' && value('child_name').split(/\s+/).length < 2)
      return 'Введите ФИО ребёнка: фамилию и имя, как в списке группы';
    return '';
  },
  /**
   * Выходит из аккаунта без перезагрузки страницы (после неудачной проверки пароля или заявки).
   */
  async dropSession() {
    try {
      await supa.auth.signOut();
    } catch (error) {
      Cloud.err = String((error && error.message) || error);
    }
    await Cloud.init();
  },
  /**
   * Отправляет заявку родителя или куратора и создаёт профиль.
   * @param {string} kind Parent или staff.
   * @param {HTMLElement} form Форма входа.
   * @returns {Promise<Object>} результат.
   */
  async registerExtra(kind, form) {
    if(Cloud.curatorContext?.active)return {ok:true};
    const name = ((form.querySelector('[name=person_name]') || {}).value || '').trim(),
      child = ((form.querySelector('[name=child_name]') || {}).value || '').trim(),
      note = ((form.querySelector('[name=person_note]') || {}).value || '').trim();
    if (name.split(/\s+/).length < 2)
      return {
        ok: false,
        msg: 'Введите ваше ФИО полностью'
      };
    if (kind === 'parent' && child.split(/\s+/).length < 2)
      return {
        ok: false,
        msg: 'Введите ФИО ребёнка: фамилию и имя, как в списке группы'
      };
    const result = await Cloud.requestAccess(kind, name, child, note, kind === 'parent' ? Roles.storedCode() : '');
    if (!result.ok)
      return {
        ok: false,
        msg: result.error
      };
    Cloud.profile = Object.assign({}, Cloud.profile || {}, {
      role: kind,
      name,
      joined: new Date().toISOString()
    });
    if (kind === 'parent') { delete Cloud.profile.rid; delete Cloud.profile.subgroup; }
    await Cloud.saveProfileNow().catch(() => {});
    Cloud.syncConsent();
    ui.justSubmitted = true;
    return {
      ok: true
    };
  }
};
