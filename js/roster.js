'use strict';

/**
 * Номера студентов 1 подгруппы (по списку группы): Богданова Валерия, Бохан, Войлокова, Гладков, Ибратуллоева,
 * Михальцевич, Траньков, Черных, Чурина, Шеина, Богданов Матвей, Васильев, Маркова. Все остальные студенты — 2 подгруппа.
 * Источник истины — таблица subgroup_assign в базе; этот список нужен, пока облако недоступно.
 */
const SUBGROUP1 = [2, 3, 5, 6, 7, 13, 15, 17, 18, 19, 23, 24, 29];
const ROSTER = [
  ['БАЛЬЖИНОВ Александр', 'expelled'],
  ['БОГДАНОВА Валерия'],
  ['БОХАН Данил'],
  ['БЫСТРОВ Кирилл'],
  ['ВОЙЛОКОВА Вероника'],
  ['ГЛАДКОВ Богдан'],
  ['ИБРАТУЛЛОЕВА Луиза'],
  ['ИЛЬЯНОК Савелий'],
  ['ИМАМБАЕВ Марк'],
  ['КАМЕНЧУК Александр'],
  ['КИРКИНА Кира'],
  ['КУЗНЕЦОВ Вячеслав'],
  ['МИХАЛЬЦЕВИЧ Даниил'],
  ['СТАДНИК Валерия'],
  ['ТРАНЬКОВ Константин'],
  ['ХРАМОВ Фёдор'],
  ['ЧЕРНЫХ Константин'],
  ['ЧУРИНА Милана'],
  ['ШЕИНА Эвелина'],
  ['АКУЛОВ Илья', 'expelled'],
  ['АСАДУЛЛИН Дамир'],
  ['БАЛАШОВ Иван', 'ghost'],
  ['БОГДАНОВ Матвей'],
  ['ВАСИЛЬЕВ Никита'],
  ['ГРИГОРЬЕВ Иван'],
  ['ГРИГОРЬЕВА Софья'],
  ['ИВАНОВ Арсений'],
  ['КАТАЕВА Анастасия'],
  ['МАРКОВА Марина'],
  ['НОВИКОВА Дарьяна', 'ghost'],
  ['ФИЛАТОВА Софья'],
  ['ИГНАТЕНОК Арина']
].map((x, i) => ({
  id: 'r' + (i + 1),
  n: i + 1,
  name: x[0],
  flag: x[1] === 'expelled' || x[1] === 'ghost' ? x[1] : '',
  admin: x[1] === 'admin',
  sub: SUBGROUP1.indexOf(i + 1) >= 0 ? '1' : '2'
}));
const ROSTER_BY_ID = {};
ROSTER.forEach(r => {
  ROSTER_BY_ID[r.id] = r;
});
/**
 * Применяет закреплённые в облаке подгруппы к списку группы.
 * @param {Array<Object>} rows Строки вида {rid, subgroup}.
 */
function applySubgroups(rows) {
  (rows || []).forEach(x => {
    const r = ROSTER_BY_ID[x.rid];
    if (r && (x.subgroup === '1' || x.subgroup === '2')) r.sub = x.subgroup;
  });
}
const ADMIN_RID = 'r32';
const FLAG_LABEL = {
  expelled: 'отчислен(а)',
  ghost: 'мёртвая душа'
};
const ABS_LIMIT = 24,
  ABS_WARN_LEFT = 4,
  PAIR_HOURS = 2;
const ATT_START = '2026-10-01';
/**
 * Создаёт глубокую копию данных.
 * @param {*} o Данные.
 * @returns {*} копия.
 */
const clone = o => JSON.parse(JSON.stringify(o));
/**
 * Возвращает последний день месяца.
 * @param {string} ym Месяц ГГГГ-ММ.
 * @returns {string} дата.
 */
const monthEnd = ym => {
  const p = ym.split('-').map(Number);
  return U.iso(new Date(p[0], p[1], 0));
};
/**
 * Возвращает название месяца и год.
 * @param {string} ym Месяц ГГГГ-ММ.
 * @returns {string} Строка.
 */
const monthName = ym => {
  const p = ym.split('-').map(Number);
  const n = new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric'
  }).format(new Date(p[0], p[1] - 1, 1));
  return n.charAt(0).toUpperCase() + n.slice(1);
};
