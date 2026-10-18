'use strict';

const Changes = {
  /**
   * Возвращает отмены и замены пар.
   * @returns {Array<Object>} Массив.
   */
  items: () => (Cloud.status === 'online' ? Cloud.changes : Store.s.changes || []),
  /**
   * Сохраняет список отмен и замен.
   * @param {Array<Object>} arr Список изменений.
   */
  save(arr) {
    if (Cloud.status === 'online') {
      Cloud.changes = arr;
      Cloud.saveChanges();
    } else {
      Store.s.changes = arr;
      Store.save();
    }
  },
  /**
   * Находит изменение пары на дату.
   * @param {string} date Дата.
   * @param {number} pair Номер пары.
   * @returns {Object|null} Объект.
   */
  at: (date, pair) => Changes.items().find(c => c.date === date && c.pair === pair) || null,
  /**
   * Добавляет или заменяет изменение пары на дату.
   * @param {Object} ch Изменение пары.
   */
  upsert(ch) {
    const rest = Changes.items().filter(c => !(c.date === ch.date && c.pair === ch.pair));
    Changes.save(
      rest.concat([
        Object.assign(
          {
            id: U.uid('x'),
            createdBy: Cloud.uid || 'local',
            createdAt: new Date().toISOString()
          },
          ch
        )
      ])
    );
  },
  /**
   * Убирает изменение пары.
   * @param {string} id Идентификатор записи.
   */
  remove(id) {
    Changes.save(Changes.items().filter(c => c.id !== id));
  },
  /**
   * Описывает изменение для уведомления.
   * @param {Object} c Изменение пары.
   * @returns {Object} заголовок и текст.
   */
  describe(c) {
    const sb = subj(c.subjectId),
      nb = subj(c.newSubjectId),
      dt = U.fmtShort(U.fromISO(c.date));
    if (c.type === 'cancel')
      return {
        title: 'Пара отменена',
        body:
          (sb ? sb.short || sb.name : 'Пара') +
          ' ' +
          c.pair +
          '-я пара ' +
          dt +
          ' отменена' +
          (c.reason ? ' (' + c.reason + ')' : '')
      };
    return {
      title: 'Замена пары',
      body:
        'Замена: ' +
        c.pair +
        '-я пара ' +
        dt +
        ' — ' +
        (nb ? nb.name : sb ? sb.name : 'другой предмет') +
        (c.newRoom ? ', ауд. ' + c.newRoom : '') +
        (c.reason ? ' (' + c.reason + ')' : '')
    };
  },
  /**
   * Находит ближайшую дату, когда идёт пара.
   * @param {Object} l Пара расписания.
   * @returns {string} дата.
   */
  nextDate(l) {
    for (let i = 0; i < 28; i++) {
      const d = U.addDays(U.today(), i);
      if (U.dayIdx(d) === l.day && (l.week === 'both' || weekType(d) === l.week)) return U.iso(d);
    }
    return U.iso(U.today());
  },
  /**
   * Проверяет, что выбранная дата подходит паре.
   * @param {Object} l Пара расписания.
   * @param {string} date Дата в формате ГГГГ-ММ-ДД.
   * @returns {string} текст ошибки или пустая строка.
   */
  check(l, date) {
    if (!l) return 'Пара не найдена';
    if (!date) return 'Выберите дату';
    const d = U.fromISO(date);
    if (U.dayIdx(d) !== l.day)
      return 'Эта пара идёт в «' + DAYS_FULL[l.day] + '», а выбранная дата — «' + DAYS_FULL[U.dayIdx(d)] + '»';
    if (l.week !== 'both' && weekType(d) !== l.week)
      return 'В эту дату идёт другая неделя (нужен ' + WEEK_NAME[l.week] + ')';
    return '';
  }
};
