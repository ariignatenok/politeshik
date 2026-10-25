'use strict';

const Roles = {
  names: {
    student: 'Студент',
    admin: 'Староста',
    curator: 'Куратор',
    teacher: 'Преподаватель',
    parent: 'Родитель',
    department: 'Отделение'
  },
  tabsByRole: {
    teacher: ['tdash', 'schedule', 'journal', 'tstudents', 'tsubjects', 'consult', 'texport', 'chat', 'settings'],
    curator: ['tdash', 'schedule', 'journal', 'tstudents', 'news', 'chat', 'settings'],
    department: ['dept', 'news', 'settings'],
    parent: ['child', 'settings']
  },
  staffOnly: ['tdash', 'tstudents', 'tsubjects', 'consult', 'texport', 'dept', 'child'],
  weakPercent: 70,
  /**
   * Возвращает список вкладок для текущей роли или null, если ограничений нет.
   * @returns {Array<string>|null} Массив.
   */
  tabs() {
    return Roles.tabsByRole[Cloud.role] || null;
  },
  /**
   * Проверяет, доступна ли вкладка текущей роли.
   * @param {string} tab Идентификатор вкладки.
   * @returns {boolean} true, если условие выполнено.
   */
  allows(tab) {
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
    return !!(Cloud.realAdmin && Cloud.profile && Cloud.profile.rid === ADMIN_RID);
  },
  /**
   * Строит переключатель «Настройки / Доступы» для владельца.
   * @returns {string} HTML.
   */
  settingsTabs() {
    if (!Roles.isOwner()) return '';
    const tab = ui.setTab || 'main';
    return (
      '<div class="tabs"><button class="tab' +
      (tab === 'main' ? ' on' : '') +
      '" data-action="set-tab" data-tab="main">Настройки</button><button class="tab' +
      (tab === 'access' ? ' on' : '') +
      '" data-action="set-tab" data-tab="access">Доступы</button></div>'
    );
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
    const result = await Cloud.requestAccess(kind, name, child, note);
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
    await Cloud.saveProfileNow().catch(() => {});
    return {
      ok: true
    };
  }
};
