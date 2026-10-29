'use strict';

const ui = {
  tab: 'dashboard',
  loginRole: 'student',
  loginDraft: null,
  activating: false,
  chatWith: null,
  sickFilter: 'all',
  noteFiles: [],
  noteRemoved: [],
  dashFilter: 'all',
  schedWeek: null,
  schedDay: null,
  subjectId: null,
  subjTab: 'hw',
  noteQuery: '',
  teacherQuery: '',
  teacherSubject: 'all',
  subjQuery: '',
  attDate: null,
  attMonth: null,
  attScope: 'month',
  grpTab: 'today',
  grpDate: null,
  draft: null,
  stud: null,
  joinShown: false,
  hwSubject: 'all',
  cabTab: 'main',
  ratePeriod: 'month',
  localOk: false,
  cardCat: 'all',
  cardQuery: '',
  cardUnknown: false,
  cardShuffle: true,
  study: null,
  fQuery: ''
};
const NAV_ALL = [
  {
    id: 'dashboard',
    ico: ICONS.house,
    label: 'Главная',
    short: 'Главная'
  },
  {
    id: 'schedule',
    ico: ICONS.calendar,
    label: 'Расписание',
    short: 'Пары'
  },
  {
    id: 'attendance',
    ico: ICONS.check,
    label: 'Посещаемость',
    short: 'Отметки'
  },
  {
    id: 'hw',
    ico: ICONS.memo,
    label: 'Домашка (ДЗ)',
    short: 'ДЗ'
  },
  {
    id: 'subjects',
    ico: ICONS.books,
    label: 'Предметы',
    short: 'Предметы'
  },
  {
    id: 'news',
    ico: ICONS.newspaper,
    label: 'Новости',
    short: 'Новости'
  },
  {
    id: 'chat',
    ico: ICONS.speech,
    label: 'Чаты',
    short: 'Чаты'
  },
  {
    id: 'rating',
    ico: ICONS.trophy,
    label: 'Рейтинг группы',
    short: 'Рейтинг'
  },
  {
    id: 'map',
    ico: ICONS.worldMap,
    label: 'Карта',
    short: 'Карта'
  },
  {
    id: 'requests',
    ico: ICONS.incomingEnvelope,
    label: 'Заявки',
    short: 'Заявки',
    admin: true
  },
  {
    id: 'access',
    ico: ICONS.key,
    label: 'Доступы',
    short: 'Доступы',
    owner: true
  },
  {
    id: 'users',
    ico: ICONS.busts,
    label: 'Пользователи',
    short: 'Люди',
    admin: true
  },
  {
    id: 'stats',
    ico: ICONS.barChart,
    label: 'Статистика',
    short: 'Статистика',
    admin: true
  },
  {
    id: 'tdash',
    ico: ICONS.house,
    label: 'Дашборд',
    short: 'Дашборд',
    staff: true
  },
  {
    id: 'tstudents',
    ico: ICONS.graduationCap,
    label: 'Студенты',
    short: 'Студенты',
    staff: true
  },
  {
    id: 'tsubjects',
    ico: ICONS.books,
    label: 'Предметы',
    short: 'Предметы',
    staff: true
  },
  {
    id: 'consult',
    ico: ICONS.calendar,
    label: 'Консультации',
    short: 'Консульт.',
    staff: true
  },
  {
    id: 'texport',
    ico: ICONS.outboxTray,
    label: 'Экспорт',
    short: 'Экспорт',
    staff: true
  },
  {
    id: 'dept',
    ico: ICONS.classicalBuilding,
    label: 'Отделение',
    short: 'Отделение',
    staff: true
  },
  {
    id: 'child',
    ico: ICONS.chartIncreasing,
    label: 'Успеваемость ребёнка',
    short: 'Ребёнок',
    staff: true
  },
  {
    id: 'teachers',
    ico: ICONS.teacher,
    label: 'Преподаватели',
    short: 'Препод.'
  },
  {
    id: 'cabinet',
    ico: ICONS.user,
    label: 'Личный кабинет',
    short: 'Кабинет'
  },
  {
    id: 'group',
    ico: ICONS.shield,
    label: 'Группа (админ)',
    short: 'Группа',
    admin: true
  },
  {
    id: 'journal',
    ico: ICONS.folder,
    label: 'Журнал',
    short: 'Журнал'
  },
  {
    id: 'settings',
    ico: ICONS.gear,
    label: 'Настройки',
    short: 'Настройки'
  }
];
const NAV_BOTTOM = ['dashboard', 'schedule', 'attendance', 'hw', 'subjects', 'chat', 'more'];
/**
 * Строит заглушку пустого списка.
 * @param {string} ico Значок.
 * @param {string} text Подпись.
 * @returns {string} HTML.
 */
const empty = (ico, text) => '<div class="empty"><b>' + ico + '</b>' + text + '</div>';
/**
 * Строит пустое состояние с Политешиком и подписью.
 * @param {string} text Подпись под Политешиком.
 * @param {string} mood Настроение Политешика (необязательно).
 * @returns {string} HTML.
 */
const emptyMascot = (text, mood) =>
  '<div class="empty empty-mascot">' + Mascot.svg(mood || 'happy', 104, 'empty-av') + '<p>' + text + '</p></div>';
/**
 * Возвращает пункты бокового меню для роли пользователя.
 * @returns {Array<Object>} Массив.
 */
function navItems() {
  const tabs = Roles.tabs();
  if (tabs) return tabs.map(id => NAV_ALL.find(t => t.id === id)).filter(Boolean);
  return NAV_ALL.filter(t => (!t.admin || Cloud.isAdmin) && !t.staff && (!t.owner || Roles.isOwner()));
}
/**
 * Возвращает вкладки нижней панели для роли пользователя.
 * @returns {Array<string>} Массив.
 */
function bottomNav() {
  const tabs = Roles.tabs();
  if (!tabs) return NAV_BOTTOM;
  return tabs.length <= 5 ? tabs.slice() : tabs.slice(0, 4).concat(['more']);
}
