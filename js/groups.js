'use strict';

const Groups = {
  current: 'group_1',
  selected: 'group_1',
  list: [
    {id: 'group_1', number: '25290909/3091', groupId: 'g_main', file: 'schedule.json'},
    {id: 'group_2', number: '26290911/3111', groupId: 'g_26290911_3111', file: 'schedule-26290911-3111.json', leader: 'Лебедев Петр Андреевич', initials: 'ЛП', supportRoles: ['admin','developer','superadmin']},
    {id: 'group_3', number: '23290907/2092', groupId: 'g_23290907_2092', file: 'schedule-23290907-2092.json', leader: 'Плотникова Дарья Александровна', initials: 'ПД', supportRoles: ['admin','superadmin']}
  ],
  rosters: {
    group_1: ROSTER.map(r => Object.assign({}, r)),
    group_2: ['Андрианов', 'Бойчук', 'Булов', 'Волков', 'Волкова', 'Вольский', 'Воронин', 'Горьковенко',
      'Данилова', 'Зинченко', 'Коршунов', 'Кузьменков Макар Сергеевич', 'Лебедев Петр Андреевич', 'Листопадов',
      'Малышев', 'Надеждина', 'Новиков', 'Орлов', 'Потапов', 'Руденко', 'Сапоговский', 'Соловьев', 'Тур',
      'Чистяков', 'Чубыкин', 'Ширяева'].map((name, i) => ({
        id: 'g2_r' + (i + 1), n: i + 1, name, flag: '', sub: '',
        accessRole: i === 11 ? 'developer' : i === 12 ? 'admin' : ''
      })),
    group_3: ["Абрамчук Леонид Константинович", "Афанасьев Сергей Павлович", "Гурьянова Анастасия Алексеевна", "Джусь Анастасия Сергеевна", "Долгополов Владислав Валерьевич", "Карасева Ольга Михайловна", "Ковалева Алёна Александровна", "Колотилин Андрей Валерьевич", "Кошель Милена Викторовна", "Кузнецов Александр Александрович", "Лапшина Виктория Алексеевна", "Некрасов Святослав Андреевич", "Николайчук Роман Алексеевич", "Павлов Владислав Денисович", "Пислегин Даниил Михайлович", "Плотникова Дарья Александровна", "Попова Алина Тулкиновна", "Поступинская Анна Денисовна", "Решетько Виктория Сергеевна", "Семенюк Кристина Сергеевна", "Стахаевич Вероника Геннадьевна", "Сытов Семен Ильич", "Тихонович Ярослав Степанович", "Ткачев Родион Дмитриевич", "Циглер Виктория Дмитриевна", "Шелепова Варвара Евгеньевна", "Шкарлет Иван Андреевич"].map((name, i) => ({id: 'g3_r' + (i + 1), n: i + 1, name, flag: '', sub: '', accessRole: i === 15 ? 'admin' : '', activation: i === 15 ? 'email' : ''}))
  },
  /**
   * Возвращает настройки группы по серверному идентификатору.
   * @param {string} id Идентификатор группы.
   * @returns {Object} Настройки.
   */
  get(id) { return Groups.list.find(g => g.id === id) || Groups.list[0]; },
  /**
   * Переключает список фамилий в форме; это не выдаёт доступ к данным группы.
   * @param {string} id Идентификатор группы.
   */
  selectRoster(id) {
    Groups.selected = Groups.get(id).id;
    ROSTER.splice(0, ROSTER.length, ...Groups.rosters[Groups.selected].map(r => Object.assign({}, r)));
    Object.keys(ROSTER_BY_ID).forEach(key => { delete ROSTER_BY_ID[key]; });
    ROSTER.forEach(r => { ROSTER_BY_ID[r.id] = r; });
  },
  /**
   * Строит выбор группы при регистрации или для супер-администратора.
   * @param {boolean} switcher Выбор рабочей группы вместо регистрации.
   * @returns {string} HTML.
   */
  selector(switcher) {
    return '<label class="field"><span>' + (switcher ? 'Рабочая группа' : 'Выберите группу') +
      '</span><select class="input" data-change="' + (switcher ? 'active-group' : 'registration-group') +
      '" name="group">' + Groups.list.map(g => '<option value="' + g.id + '"' +
        (g.id === (switcher ? Groups.current : Groups.selected) ? ' selected' : '') + '>' + g.number + '</option>').join('') +
      '</select></label>';
  },
  /**
   * Создаёт чистый контент новой группы без личных и учебных данных первой группы.
   * @returns {Object} Начальное состояние.
   */
  seed(tenant = Groups.current) {
    const seed = Seed.make();
    ['teachers', 'works', 'homework', 'cards', 'notes', 'schedule', 'changes'].forEach(k => { seed[k] = []; });
    seed.subjects = tenant === 'group_2' ? [{id: 's_opbd', name: 'Основы проектирования баз данных', short: 'ОПБД', color: COLORS[0], links: [], formulas: []}] : [];
    seed.attendance = {marks: {}};
    seed.chat = Chat.blank();
    seed.weeks = {}; seed.meta = {}; seed.ach = {}; seed.map = null;
    seed.settings = Object.assign(Seed.defaultSettings(), {seedVersion: 5, groupTenant: tenant});
    return seed;
  },
  /**
   * Применяет группу, которую сервер разрешил текущему аккаунту.
   * @param {Object} context Проверенный сервером контекст.
   */
  activate(context) {
    Groups.current = Groups.get(context.tenant_id).id;
    ScheduleSync.epoch++;
    ScheduleSync.snapshot = null;
    ScheduleSync.group = Groups.get(Groups.current).number;
    GROUP_NAME = Groups.get(Groups.current).number;
    GoogleSync.KEY = 'politeshik:gsync' + (Groups.current === 'group_1' ? '' : ':' + Groups.current);
    Groups.selectRoster(Groups.current === 'group_1' && !context.member && !context.is_admin && !context.is_super_admin ? Groups.selected : Groups.current);
    const key = context.uid + (Groups.current === 'group_1' ? '' : ':' + Groups.current);
    Store.bind(key);
    if (Groups.current !== 'group_1' && Store.s.settings.groupTenant !== Groups.current) Store.replace(Groups.seed());
    ScheduleSync.configure(Groups.get(Groups.current));
  },
  /**
   * Меняет рабочую группу только через проверенный серверный вызов.
   * @param {string} tenant Идентификатор группы.
   * @returns {Promise<void>} Перезагрузка изолированного контекста.
   */
  async switchTo(tenant, openList, tab = 'group') {
    if (!Cloud.isSuperAdmin || !Groups.list.some(g => g.id === tenant)) return;
    if (!['group','journal','chat','news','users','schedule'].includes(tab)) tab = 'group';
    if (tenant === Groups.current) {
      if (openList) { ui.tab = tab; ui.grpTab = 'students'; App.render(true); window.scrollTo(0, 0); }
      return;
    }
    try {
      const {error} = await supa.rpc('select_group', {p_tenant: tenant});
      if (error) return toast(error.message);
      if (openList) { window.sessionStorage.setItem('politeshik:open-group', tenant); window.sessionStorage.setItem('politeshik:open-group-tab', tab); }
      location.reload();
    } catch (error) { toast('Не удалось переключить группу: ' + error.message); }
  },
  /**
   * Строит быстрые переходы между группами только для Арины.
   * @param {boolean} mobile Карточки мобильного меню.
   * @returns {string} HTML.
   */
  navigation(mobile) { return ''; },

  /**
   * Регистрирует кабинет атомарно: код, фамилия, группа и роль проверяются сервером.
   * @param {string} rid Фамилия.
   * @param {string} subgroup Подгруппа.
   * @param {string} code Код группы.
   * @param {string} secret Дополнительный пароль сотрудника.
   * @returns {Promise<void>} Завершение регистрации.
   */
  async register(rid, subgroup, code, secret) {
    const {data, error} = await supa.rpc('register_student', {
      p_group: Groups.selected, p_code: code, p_rid: rid, p_subgroup: subgroup, p_secret: String(secret || '').trim()
    });
    if (error || !data || !data.ok) throw new Error(error ? error.message : data && data.error || 'Не удалось создать кабинет');
    location.reload();
  }
};

// Restore only the registration choice; server membership still controls data access.
try {
  const selected = window.localStorage.getItem('politeshik:registration-group');
  if (selected) Groups.selectRoster(selected);
} catch (error) {}

/**
 * Показывает техническую диагностику без прав изменения учебных данных.
 * @returns {string} HTML.
 */
function viewDiagnostics() {
  if (!Cloud.isSuperAdmin) return '';
  const info = {group: Groups.get(Groups.current).number, build: BUILD, role: Cloud.role,
    scheduleDate: ScheduleSync.snapshot && ScheduleSync.snapshot.checked_at,
    scheduleAvailable: !!ScheduleSync.snapshot, cloudStatus: Cloud.status, errors: Safe.errors.slice(-10)};
  return '<section class="card"><h1>Диагностика</h1><p>Просмотр состояния приложения. Изменение посещаемости и прав доступа недоступно.</p><pre style="white-space:pre-wrap">' +
    U.esc(JSON.stringify(info, null, 2)) + '</pre><button class="btn" data-action="sched-sync">Проверить расписание</button></section>';
}

/** Каталог групп доступен только Арине. */
function viewGroups() {
  if (!Cloud.isSuperAdmin) return '';
  return '<div class="page-head"><div><h1>Группы</h1><p>Выбери группу, чтобы открыть её студентов, журнал, чаты или новости.</p></div></div><div class="group-directory">' +
    Groups.list.map(g => '<section class="card"><h2>Группа ' + U.esc(g.number) + '</h2><p>' +
      Groups.rosters[g.id].length + ' студентов' + (g.id === Groups.current ? ' · Текущая группа' : '') +
      '</p><div class="head-actions">' + [['group','Студенты'],['journal','Журнал'],['chat','Чаты'],['news','Новости']].map(([tab,label]) =>
        '<button class="btn' + (tab === 'group' ? ' primary' : '') + '" data-action="group-open" data-group="' + g.id + '" data-tab="' + tab + '">' + label + '</button>').join('') + '</div></section>').join('') + '</div>';
}
