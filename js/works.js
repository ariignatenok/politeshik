'use strict';

/**
 * Собирает работы группы и личные работы.
 * @returns {Array<Object>} Массив.
 */
function allWorks() {
  const s = Store.s,
    out = [],
    seen = new Set();
  if (Cloud.status === 'online')
    Cloud.gworks.forEach(w => {
      out.push({
        kind: 'gwork',
        id: w.id,
        title: w.title,
        type: w.type || 'Работа',
        subjectId: w.subjectId,
        date: w.date,
        time: w.time || '',
        done: isPastDue(w.date, w.time || ''),
        g: true,
        notes: w.notes || ''
      });
      seen.add(w.title + '|' + w.date);
    });
  s.works.forEach(w => {
    if (!seen.has(w.title + '|' + w.date))
      out.push({
        kind: 'work',
        id: w.id,
        title: w.title,
        type: w.type || 'Работа',
        subjectId: w.subjectId,
        date: w.date,
        time: w.time || '',
        done: isPastDue(w.date, w.time || ''),
        g: false,
        notes: w.notes || ''
      });
  });
  return out;
}

/**
 * Проверяет, что срок ДЗ ещё не прошёл или не указан.
 * @param {Object} h ДЗ.
 * @returns {boolean} true, если условие выполнено.
 */
function hwUpcoming(h) {
  return !h.deadline || !isPastDue(h.deadline, '');
}
