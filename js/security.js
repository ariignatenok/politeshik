'use strict';

const Users = {
  statusNames: {
    approved: 'Активен',
    pending: 'На проверке',
    banned: 'Забанен',
    rejected: 'Отклонён',
    none: 'Без заявки'
  },
  statusClass: {
    approved: 'ok',
    pending: 'wait',
    banned: 'bad',
    rejected: 'bad',
    none: 'wait'
  },
  /**
   * Форматирует дату и время как ДД.ММ.ГГГГ ЧЧ:ММ.
   * @param {string} iso Время ISO.
   * @returns {string} Строка.
   */
  dt(iso) {
    const d = new Date(iso);
    return !iso || isNaN(d.getTime())
      ? ''
      : U.pad(d.getDate()) +
          '.' +
          U.pad(d.getMonth() + 1) +
          '.' +
          d.getFullYear() +
          ' ' +
          U.pad(d.getHours()) +
          ':' +
          U.pad(d.getMinutes());
  },
  /**
   * Приводит ФИО к виду для поиска дублей.
   * @param {Object} user Пользователь.
   * @returns {string} Строка.
   */
  nameKey(user) {
    return String(user.full_name || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  },
  /**
   * Считает, сколько аккаунтов занимает каждое ФИО.
   * @returns {Object} Объект.
   */
  duplicates() {
    const count = {};
    (Cloud.users || []).forEach(u => {
      if (u.rid) count[Users.nameKey(u)] = (count[Users.nameKey(u)] || 0) + 1;
    });
    return count;
  },
  /**
   * Отбирает пользователей по фильтру и поиску.
   * @returns {Array<Object>} Массив.
   */
  visible() {
    const filter = ui.userFilter || 'all',
      query = String(ui.userQuery || '')
        .toLowerCase()
        .trim(),
      dup = Users.duplicates();
    return (Cloud.users || []).filter(u => {
      if (filter === 'pending' && ['pending', 'none'].indexOf(u.status) < 0) return false;
      if (filter === 'banned' && u.status !== 'banned') return false;
      if (filter === 'dup' && !(u.rid && dup[Users.nameKey(u)] > 1)) return false;
      return !query || (u.email + ' ' + u.full_name + ' ' + u.rid).toLowerCase().indexOf(query) >= 0;
    });
  },
  /**
   * Выполняет действие администратора над пользователем и обновляет списки.
   * @param {string} name Имя серверной функции.
   * @param {Object} params Параметры.
   * @returns {Promise<Object>} Объект.
   */
  async act(name, params) {
    const {error} = await supa.rpc(name, params);
    if (error)
      return {
        ok: false,
        error: error.message
      };
    delete Cloud.adm.profiles[params.p_uid];
    await Promise.all([Cloud.loadUsers(true), Cloud.loadRequests(true)]);
    App.render();
    return {
      ok: true
    };
  }
};
/**
 * Строит вкладку «Пользователи»: таблица всех аккаунтов с действиями.
 * @returns {string} HTML.
 */
function viewUsers() {
  Cloud.loadUsers();
  const all = Cloud.users || [],
    list = Users.visible(),
    dup = Users.duplicates(),
    filter = ui.userFilter || 'all';
  /**
   * Строит кнопку-фильтр.
   * @param {string} id Значение фильтра.
   * @param {string} label Подпись кнопки.
   * @param {number} n Число.
   * @returns {string} HTML.
   */
  const chip = (id, label, n) =>
    '<button class="fchip' +
    (filter === id ? ' on' : '') +
    '" data-action="user-filter" data-id="' +
    id +
    '">' +
    label +
    (n != null ? ' · ' + n : '') +
    '</button>';
  /**
   * Строит строку таблицы пользователей.
   * @param {Object} u Пользователь.
   * @returns {string} HTML.
   */
  const row = u => {
    const mine = u.uid === Cloud.uid,
      isAdminRow = u.role === 'admin',
      isDup = u.rid && dup[Users.nameKey(u)] > 1;
    const who = u.full_name
      ? U.esc(u.full_name)
      : '<span class="muted">' +
        (u.requested_role
          ? 'роль: ' +
            U.esc(
              {
                student: 'студент',
                parent: 'родитель',
                staff: 'куратор / отделение'
              }[u.requested_role] || u.requested_role
            )
          : 'не указано') +
        '</span>';
    const actions =
      isAdminRow || mine
        ? '<span class="muted">—</span>'
        : (u.status === 'banned'
            ? '<button class="btn sm" data-action="user-unban" data-uid="' + u.uid + '">Разбанить</button>'
            : '<button class="btn sm" data-action="user-ban" data-uid="' + u.uid + '">Забанить</button>') +
          '<button class="btn sm danger" data-action="user-delete" data-uid="' +
          u.uid +
          '">Удалить</button>';
    return (
      '<tr' +
      (u.status === 'banned' ? ' class="u-banned"' : '') +
      '><td data-label="ФИО">' +
      who +
      (isDup ? ' <span class="tag bad">Дубль ФИО</span>' : '') +
      (u.rid ? '<small class="muted"> · код ' + U.esc(u.rid) + '</small>' : '') +
      '</td><td data-label="Email" class="mono">' +
      U.esc(u.email) +
      '</td>' +
      '<td data-label="Регистрация">' +
      U.esc(Users.dt(u.created_at) || '—') +
      '</td><td data-label="Последний вход">' +
      U.esc(Users.dt(u.last_sign_in_at) || 'не входил') +
      '</td>' +
      '<td data-label="Роль">' +
      U.esc(Roles.names[u.role] || u.role) +
      '</td><td data-label="Статус"><span class="tag status ' +
      Users.statusClass[u.status] +
      '">' +
      (Users.statusNames[u.status] || u.status) +
      '</span></td><td data-label="Действия" class="u-actions">' +
      actions +
      '</td></tr>'
    );
  };
  return (
    '<div class="page-head"><div><h1>Пользователи</h1><p>Все аккаунты: кто и с какой почты зарегистрировался. Забанить закрывает доступ сразу, удалить убирает аккаунт и все его данные.</p></div><div class="head-actions"><button class="btn" data-action="users-refresh">Обновить</button></div></div>' +
    '<div class="fchips">' +
    chip('all', 'Все', all.length) +
    chip('pending', 'На проверке', all.filter(u => ['pending', 'none'].indexOf(u.status) >= 0).length) +
    chip('banned', 'Забанены', all.filter(u => u.status === 'banned').length) +
    chip('dup', 'Дубли ФИО', all.filter(u => u.rid && dup[Users.nameKey(u)] > 1).length) +
    '</div>' +
    '<input class="input users-search" data-change="user-q" placeholder="Поиск по почте или ФИО" value="' +
    U.esc(ui.userQuery || '') +
    '">' +
    (Cloud.usersLoaded ? '' : '<p class="md-help">Загружаем список…</p>') +
    '<section class="card"><div class="table-scroll"><table class="grid-tbl users-tbl"><thead><tr><th>ФИО</th><th>Email</th><th>Регистрация</th><th>Последний вход</th><th>Роль</th><th>Статус</th><th>Действия</th></tr></thead><tbody>' +
    (list.map(row).join('') || '<tr><td colspan="7" class="empty">Никого не найдено</td></tr>') +
    '</tbody></table></div></section>'
  );
}
/**
 * Строит карточку «Код группы» для настроек старосты.
 * @returns {string} HTML.
 */
function groupCodeCard() {
  Cloud.loadGroupCodes();
  const active = (Cloud.groupCodes || []).find(c => c.active);
  return (
    '<section class="card code-card"><h2>Код группы</h2><p class="md-help">Без кода нельзя зарегистрироваться как студент или родитель. Сгенерируйте код и отправьте его в чат группы. Новый код отключает прежний.</p>' +
    (active
      ? '<div class="code-row"><b class="code-val">' +
        U.esc(active.code) +
        '</b><button class="btn sm" data-action="gcode-copy" data-code="' +
        U.esc(active.code) +
        '">Скопировать</button></div><p class="md-help">Группа: ' +
        U.esc(active.group_name || '') +
        '</p>'
      : '<p class="md-help">Сейчас нет действующего кода: регистрироваться по коду никто не сможет.</p>') +
    '<div class="head-actions"><button class="btn primary" data-action="gcode-new">' +
    (active ? 'Сгенерировать новый код' : 'Сгенерировать код') +
    '</button>' +
    (active ? '<button class="btn" data-action="gcode-off">Отключить код</button>' : '') +
    '</div>' +
    '<div class="set-row"><div><b>Требовать код при регистрации</b><p>Если выключить, зарегистрироваться сможет любой, у кого есть ссылка на сайт.</p></div><button class="btn" data-action="gcode-require">' +
    (Cloud.codeRequired === false ? 'Выключено' : 'Включено') +
    '</button></div></section>'
  );
}
