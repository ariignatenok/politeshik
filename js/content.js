'use strict';

const Fm = (() => {
  const SUB = /_\{([^{}]*)\}/g,
    SUP = /\^\{([^{}]*)\}/g,
    FR = /\{([^{}|]*)\|([^{}|]*)\}/g;
  /**
   * Преобразует запись формулы в HTML.
   * @param {string} src Исходный текст.
   * @returns {string} HTML.
   */
  function render(src) {
    let h = U.esc(src);
    for (let i = 0; i < 8; i++) {
      const p = h;
      h = h
        .replace(SUB, '<sub>$1</sub>')
        .replace(SUP, '<sup>$1</sup>')
        .replace(FR, '<span class="frac"><span>$1</span><span>$2</span></span>');
      if (h === p) break;
    }
    return h;
  }
  return {
    render
  };
})();
const Content = (() => {
  let cache = null;
  /**
   * Возвращает стартовый контент: карточки, конспекты и формулы.
   * @returns {Object} Объект.
   */
  const data = () => {
    if (!cache) {
      try {
        cache = {
          cards: SEED_CARDS,
          notes: SEED_NOTES,
          formulas: SEED_FORMULAS
        };
      } catch (error) {
        cache = {
          cards: [],
          notes: [],
          formulas: {}
        };
      }
    }
    return cache;
  };
  /**
   * Добавляет стартовый контент в данные один раз.
   * @param {Object} s Данные приложения.
   * @returns {number} сколько записей добавлено.
   */
  function apply(s) {
    const C = data(),
      now = new Date().toISOString();
    let added = 0;
    /**
     * Проверяет, есть ли в стартовом контенте запись.
     * @param {string} id Идентификатор записи.
     * @returns {boolean} true, если условие выполнено.
     */
    const has = id => s.subjects.some(x => x.id === id);
    const ids = new Set(s.cards.map(c => c.id).concat(s.notes.map(n => n.id)));
    (C.cards || []).forEach(c => {
      if (has(c.subjectId) && !ids.has(c.id)) {
        s.cards.push({
          id: c.id,
          subjectId: c.subjectId,
          cat: c.cat,
          q: c.q,
          a: c.a,
          known: false
        });
        added++;
      }
    });
    (C.notes || []).forEach(n => {
      if (has(n.subjectId) && !ids.has(n.id)) {
        s.notes.push({
          id: n.id,
          subjectId: n.subjectId,
          title: n.title,
          text: n.text,
          order: n.order,
          updated: now
        });
        added++;
      }
    });
    Object.keys(C.formulas || {}).forEach(sid => {
      const sb = s.subjects.find(x => x.id === sid);
      if (sb && !(sb.formulas && sb.formulas.length)) {
        sb.hasFormulas = true;
        sb.formulas = C.formulas[sid].map((f, i) => ({
          id: 'sd_f_' + sid + '_' + i,
          group: f.group,
          title: f.title,
          f: f.f,
          note: f.note || ''
        }));
        added += sb.formulas.length;
      }
    });
    return added;
  }
  /**
   * Обновляет данные версии 1 до версии 2.
   * @param {Object} s Данные приложения.
   */
  function migrate(s) {
    const legacy = Seed.legacyNotes();
    s.notes = s.notes.filter(n => !legacy.some(l => l.title === n.title && l.text === n.text));
    apply(s);
  }
  const NUM_FULL = [
    [0, 1, 's_eng', '441', 'подгр.1', 'Кузнецова Л.И.'],
    [0, 2, 's_mdk0102', '215', '', 'Васильев С.Ю.'],
    [1, 1, 's_oap', '428', '', 'Данилова О.С.'],
    [1, 2, 's_net', '113', '', 'Ольнев А.А.'],
    [2, 1, 's_opbd', '315', '', 'Андреев В.А.'],
    [2, 2, 's_evm', '209', '', 'Кудрявцева Е.В.'],
    [3, 1, 's_eng', '551', 'подгр.2', 'Гусарова М.Н.'],
    [3, 2, 's_mdk0101', '110', '', 'Васильев С.Ю.'],
    [4, 2, 's_bzhd', '222', '', 'Симоненко С.И.']
  ];
  /**
   * Добавляет в расписание недостающие пары числителя.
   * @param {Object} s Данные приложения.
   */
  function migrateSchedule(s) {
    NUM_FULL.forEach(x => {
      const dup = s.schedule.some(
        l =>
          l.day === x[0] && l.pair === x[1] && l.week === 'num' && l.subjectId === x[2] && (l.subgroup || '') === x[4]
      );
      if (!dup && s.subjects.some(y => y.id === x[2]))
        s.schedule.push({
          id: 'sdl_num_' + x[0] + '_' + x[1],
          day: x[0],
          pair: x[1],
          week: 'num',
          subjectId: x[2],
          room: x[3],
          subgroup: x[4],
          who: x[5],
          start: '',
          end: ''
        });
    });
  }
  /**
   * Исправляет подгруппы английского по преподавателям.
   * @param {Object} s Данные приложения.
   */
  function migrateEnglish(s) {
    s.schedule.forEach(l => {
      if (l.subjectId === 's_eng') {
        if (/Кузнецов/.test(l.who || '')) l.subgroup = 'подгр.1';
        else if (/Гусаров/.test(l.who || '')) l.subgroup = 'подгр.2';
      }
    });
    s.teachers.forEach(t => {
      if (t.id === 't_gusarova' && t.notes === 'Подгруппа 1 (английский).') t.notes = 'Подгруппа 2 (английский).';
    });
  }
  return {
    apply,
    migrate,
    migrateSchedule,
    migrateEnglish
  };
})();
