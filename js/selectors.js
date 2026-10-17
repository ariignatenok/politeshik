'use strict';

/**
 * Находит предмет по идентификатору.
 * @param {string} id Идентификатор предмета.
 * @returns {Object|undefined} Объект.
 */
const subj = id => Store.s.subjects.find(x => x.id === id);
/**
 * Находит преподавателей предмета.
 * @param {string} id Идентификатор предмета.
 * @returns {Array<Object>} Массив.
 */
const teachersOf = id => Store.s.teachers.filter(t => t.subjectIds.includes(id));
/**
 * Извлекает фамилию с инициалами из ФИО.
 * @param {string} n ФИО.
 * @returns {string} Строка.
 */
const surname = n => String(n || '').split(/\s+/)[0];
/**
 * Возвращает время начала и конца пары.
 * @param {number} n Номер пары.
 * @returns {Object|undefined} Объект.
 */
const pairTime = n => {
  const p = Store.s.settings.pairs[n - 1];
  return p && p.start && p.end ? p.start + '–' + p.end : '';
};
/**
 * Возвращает подпись времени пары.
 * @param {Object} l Пара расписания.
 * @returns {string} Строка.
 */
const lessonTime = l => (l.start && l.end ? l.start + '–' + l.end : pairTime(l.pair));
/**
 * Возвращает пары шаблона на день и тип недели.
 * @param {number} day Номер дня недели, понедельник равен 0.
 * @param {string} week Тип недели.
 * @returns {Array<Object>} Массив.
 */
const lessonsFor = (day, week) =>
  Store.s.schedule.filter(l => l.day === day && (l.week === 'both' || l.week === week)).sort((a, b) => a.pair - b.pair);
