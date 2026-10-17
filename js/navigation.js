'use strict';

const ui = {
  tab: 'dashboard',
  chatWith: null,
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
  {id: 'dashboard', ico: ICONS.house, label: 'Главная', short: 'Главная'},
  {id: 'schedule', ico: ICONS.calendar, label: 'Расписание', short: 'Пары'},
  {id: 'attendance', ico: ICONS.check, label: 'Посещаемость', short: 'Отметки'},
  {id: 'hw', ico: ICONS.memo, label: 'Домашка (ДЗ)', short: 'ДЗ'},
  {id: 'subjects', ico: ICONS.books, label: 'Предметы', short: 'Предметы'},
  {id: 'news', ico: ICONS.newspaper, label: 'Новости', short: 'Новости'},
  {id: 'chat', ico: ICONS.speech, label: 'Чаты', short: 'Чаты'},
  {id: 'rating', ico: ICONS.trophy, label: 'Рейтинг группы', short: 'Рейтинг'},
  {id: 'teachers', ico: ICONS.teacher, label: 'Преподаватели', short: 'Препод.'},
  {id: 'cabinet', ico: ICONS.user, label: 'Личный кабинет', short: 'Кабинет'},
  {id: 'group', ico: ICONS.shield, label: 'Группа (админ)', short: 'Группа', admin: true},
  {id: 'journal', ico: ICONS.folder, label: 'Журнал', short: 'Журнал'},
  {id: 'settings', ico: ICONS.gear, label: 'Настройки', short: 'Настройки'}
];
const NAV_BOTTOM = ['dashboard', 'schedule', 'attendance', 'hw', 'subjects', 'chat', 'more'];
/**
 * Строит заглушку пустого списка.
 * @param {string} ico Значок.
 * @param {string} text Подпись.
 * @returns {string} HTML.
 */
const empty = (ico, text) => '<div class="empty"><b>' + ico + '</b>' + text + '</div>';
