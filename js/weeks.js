'use strict';

const Weeks = {
  keep: 40,
  renderCache: null,
  months: [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря'
  ],
  /**
   * Возвращает словарь недель с собственным расписанием (создаёт, если его нет).
   * @returns {Object} Объект.
   */
  map() {
    if (!Store.s.weeks || typeof Store.s.weeks !== 'object') Store.s.weeks = {};
    return Store.s.weeks;
  },
  /**
   * Возвращает дату понедельника недели, в которую попадает день.
   * @param {string|Date} value День или дата ГГГГ-ММ-ДД.
   * @returns {string} ГГГГ-ММ-ДД.
   */
  start(value) {
    const day = typeof value === 'string' ? U.fromISO(value) : value;
    return U.iso(U.mondayOf(day));
  },
  /**
   * Проверяет, есть ли у недели собственное расписание (а не шаблон).
   * @param {string} weekStart Понедельник недели, ГГГГ-ММ-ДД.
   * @returns {boolean} true, если условие выполнено.
   */
  has(weekStart) {
    return !!Weeks.map()[weekStart];
  },
  /**
   * Строит пары недели по шаблону с учётом числителя и знаменателя.
   * @param {string} weekStart Понедельник недели, ГГГГ-ММ-ДД.
   * @returns {Array<Object>} Массив.
   */
  templateFor(weekStart) {
    const type = weekType(U.fromISO(weekStart));
    return Store.s.schedule
      .filter(l => l.week === 'both' || l.week === type)
      .map(l =>
        Object.assign({}, l, {
          week: 'both'
        })
      );
  },
  /**
   * Возвращает пары недели: свои, если они есть, иначе по шаблону.
   * @param {string} weekStart Понедельник недели, ГГГГ-ММ-ДД.
   * @returns {Array<Object>} Массив.
   */
  lessons(weekStart) {
    if(Weeks.renderCache?.has(weekStart))return Weeks.renderCache.get(weekStart);
    const local = Weeks.has(weekStart) ? Weeks.map()[weekStart] : Weeks.templateFor(weekStart);
    const result=ScheduleSync.week(weekStart, local);
    if(Weeks.renderCache)Weeks.renderCache.set(weekStart,result);
    return result;
  },
  /**
   * Возвращает пары конкретного дня по расписанию его недели.
   * @param {string|Date} date День, ГГГГ-ММ-ДД.
   * @returns {Array<Object>} Массив.
   */
  on(date) {
    const iso = typeof date === 'string' ? date : U.iso(date),
      day = U.dayIdx(U.fromISO(iso));
    return Weeks.lessons(Weeks.start(iso))
      .filter(l => l.day === day)
      .sort((a, b) => a.pair - b.pair);
  },
  /**
   * Находит пару по идентификатору в расписании недели.
   * @param {string} id Идентификатор пары.
   * @param {string} weekStart Понедельник недели, ГГГГ-ММ-ДД.
   * @returns {Object|null} Объект.
   */
  find(id, weekStart) {
    return Weeks.lessons(weekStart).find(l => l.id === id) || null;
  },
  /**
   * Создаёт для недели собственное расписание как копию шаблона.
   * @param {string} weekStart Понедельник недели, ГГГГ-ММ-ДД.
   * @returns {Array<Object>} Массив.
   */
  materialize(weekStart) {
    const markers = (Weeks.map()[weekStart] || []).filter(l => l.deleted);
    Weeks.map()[weekStart] = Weeks.lessons(weekStart).map(l => Object.assign({}, l)).concat(markers);
    return Weeks.map()[weekStart];
  },
  /**
   * Закрепляет ручные правки выбранной пары, оставляя остальные пары на автозагрузке.
   * @param {string} weekStart Понедельник недели.
   * @param {number} day Номер дня недели.
   * @param {number} pair Номер пары.
   */
  markCell(weekStart, day, pair) {
    const list = Weeks.materialize(weekStart), cell = list.filter(l => l.day === day && l.pair === pair);
    cell.forEach(l => { l.manualCell = true; });
    if (!cell.some(l => l.deleted)) list.push({id: U.uid('manual'), day, pair, manualCell: true, deleted: true});
  },
  /**
   * Закрепляет целую неделю после ручного импорта или копирования.
   * @param {string} weekStart Понедельник недели.
   * @param {Array<Object>} lessons Пары недели.
   */
  setManualWeek(weekStart, lessons) {
    Weeks.map()[weekStart] = lessons.map(l => Object.assign({}, l, {manualWeek: true}));
    if (!lessons.length) Weeks.map()[weekStart].push({id: U.uid('manual'), manualWeek: true, deleted: true});
  },
  /**
   * Возвращает неделю к шаблону: убирает её собственные правки.
   * @param {string} weekStart Понедельник недели, ГГГГ-ММ-ДД.
   */
  reset(weekStart) {
    delete Weeks.map()[weekStart];
  },
  /**
   * Копирует расписание одной недели в другую.
   * @param {string} fromWeek Откуда, понедельник недели.
   * @param {string} toWeek Куда, понедельник недели.
   */
  copy(fromWeek, toWeek) {
    Weeks.setManualWeek(toWeek, Weeks.lessons(fromWeek));
  },
  /**
   * Удаляет самые старые недели сверх лимита, чтобы документ не разрастался.
   */
  prune() {
    const keys = Object.keys(Weeks.map()).sort();
    keys.slice(0, Math.max(0, keys.length - Weeks.keep)).forEach(key => {
      delete Weeks.map()[key];
    });
  },
  /**
   * Сдвигает неделю на заданное число недель.
   * @param {string} weekStart Понедельник недели, ГГГГ-ММ-ДД.
   * @param {number} weeks На сколько недель сдвинуть.
   * @returns {string} ГГГГ-ММ-ДД.
   */
  shift(weekStart, weeks) {
    return U.iso(U.addDays(U.fromISO(weekStart), weeks * 7));
  },
  /**
   * Подписывает неделю диапазоном дат.
   * @param {string} weekStart Понедельник недели, ГГГГ-ММ-ДД.
   * @returns {string} Строка.
   */
  label(weekStart) {
    const monday = U.fromISO(weekStart),
      sunday = U.addDays(monday, 6);
    if (monday.getMonth() === sunday.getMonth())
      return (
        monday.getDate() + '–' + sunday.getDate() + ' ' + Weeks.months[sunday.getMonth()] + ' ' + sunday.getFullYear()
      );
    return (
      monday.getDate() +
      ' ' +
      Weeks.months[monday.getMonth()] +
      ' – ' +
      sunday.getDate() +
      ' ' +
      Weeks.months[sunday.getMonth()] +
      ' ' +
      sunday.getFullYear()
    );
  },
  /**
   * Убирает пару только на выбранной неделе.
   * @param {string} weekStart Понедельник недели, ГГГГ-ММ-ДД.
   * @param {string} id Идентификатор пары.
   */
  removeLesson(weekStart, id) {
    const lesson = Weeks.find(id, weekStart);
    if (!lesson) return;
    Weeks.markCell(weekStart, lesson.day, lesson.pair);
    const list = Weeks.map()[weekStart],
      index = list.findIndex(l => l.id === id);
    if (index >= 0) list[index] = Object.assign({}, list[index], {deleted: true});
  },
  /**
   * Сохраняет пару: только для этой недели или для шаблона всех недель.
   * @param {string} weekStart Понедельник недели, ГГГГ-ММ-ДД.
   * @param {Object} record Поля пары.
   * @param {string} id Идентификатор пары (пусто для новой).
   * @param {boolean} everyWeek Сохранить в шаблон всех недель.
   */
  saveLesson(weekStart, record, id, everyWeek) {
    const store = Store.s, original = id ? Weeks.find(id, weekStart) : null;
    if (everyWeek) {
      const template = id ? store.schedule.find(l => l.id === id) : null;
      if (template) Object.assign(template, record);
      else
        store.schedule.push(
          Object.assign(
            {
              id: id || U.uid('l'), week: 'both'
            },
            record
          )
        );
    }
    if (original) Weeks.markCell(weekStart, original.day, original.pair);
    Weeks.markCell(weekStart, record.day, record.pair);
    const list = Weeks.map()[weekStart],
      found = id ? list.find(l => l.id === id) : null;
    const weekly = Object.assign({}, record, {
      week: 'both', manualCell: true
    });
    Object.keys(weekly).filter(k => k.startsWith('source') || k.startsWith('original')).forEach(k => { delete weekly[k]; });
    if (found) {
      Object.keys(found).filter(k => k.startsWith('source') || k.startsWith('original')).forEach(k => { delete found[k]; });
      Object.assign(found, weekly);
    }
    else
      list.push(
        Object.assign(
          {
            id: U.uid('l')
          },
          weekly
        )
      );
    Weeks.prune();
  }
};
