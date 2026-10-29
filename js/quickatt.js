'use strict';

const EARLY_WEEKS = {
  '2026-09-28': [
    [0, 1, 's_mdk04', 'Энг 301', '', 'Рябова В.В.'],
    [0, 2, 's_mdk04', 'Энг 301', '', 'Рябова В.В.'],
    [0, 3, 's_evm', 'Энг 209', '', 'Кудрявцева Е.В.'],
    [0, 4, 's_bzhd', 'Энг 222', '', 'Симоненко С.И.'],
    [1, 1, 's_oap', 'Энг 428', '', 'Данилова О.С.'],
    [1, 2, 's_mdk0101', 'Энг 515', '', 'Васильев С.Ю.'],
    [1, 3, 's_mdk0101', 'Энг ВЦ 320', '', 'Васильев С.Ю.'],
    [1, 4, 's_eng', 'Энг 551', 'подгр.1', 'Гусарова М.Н.'],
    [2, 1, 's_eng', 'Энг 441', 'подгр.2', 'Кузнецова Л.И.'],
    [2, 2, 's_pe', 'Энг ск7', '', 'Мадаев Р.А.'],
    [2, 3, 's_dm', 'Энг 210', '', 'Муравьева Ю.А.'],
    [2, 4, 's_hist', 'Энг 549', '', 'Зубарев А.А.'],
    [3, 1, 's_it', 'Энг 325', '', 'Краснопёрова А.Д.'],
    [3, 2, 's_mdk0102', 'Энг 439', '', 'Васильев С.Ю.'],
    [3, 3, 's_mdk0102', 'Энг ВЦ 349', '', 'Васильев С.Ю.'],
    [4, 1, 's_evm', 'Энг 209', '', 'Кудрявцева Е.В.'],
    [4, 2, 's_bzhd', 'Энг 222', '', 'Симоненко С.И.'],
    [4, 3, 's_opbd', 'Энг 315', '', 'Андреев В.А.'],
    [4, 4, 's_net', 'Энг 113', '', 'Ольнев А.А.']
  ],
  '2026-10-05': [
    [0, 1, 's_bzhd', 'Энг 222', '', 'Симоненко С.И.'],
    [0, 2, 's_pe', 'Энг ск7', '', 'Мадаев Р.А.'],
    [0, 3, 's_oap', 'Энг 428', '', 'Данилова О.С.'],
    [0, 4, 's_hist', 'Энг 549', '', 'Зубарев А.А.'],
    [1, 1, 's_mdk0101', 'Энг 443', '', 'Васильев С.Ю.'],
    [1, 2, 's_mdk0101', 'Энг 443', '', 'Васильев С.Ю.'],
    [1, 3, 's_dm', 'Энг 210', '', 'Муравьева Ю.А.'],
    [1, 4, 's_evm', 'Энг 209', '', 'Кудрявцева Е.В.'],
    [2, 1, 's_eng', 'Энг 441', 'подгр.2', 'Кузнецова Л.И.'],
    [2, 2, 's_it', 'Энг 325', '', 'Краснопёрова А.Д.'],
    [2, 3, 's_bzhd', 'Энг 222', '', 'Симоненко С.И.'],
    [3, 2, 's_eng', 'Энг 551', 'подгр.1', 'Гусарова М.Н.'],
    [3, 3, 's_opbd', 'Энг 315', '', 'Андреев В.А.'],
    [3, 4, 's_oap', 'Энг 428', '', 'Данилова О.С.'],
    [4, 1, 's_mdk0102', 'Энг 504', '', 'Васильев С.Ю.'],
    [4, 2, 's_net', 'Энг 113', '', 'Ольнев А.А.'],
    [4, 3, 's_opbd', 'Энг 315', '', 'Андреев В.А.']
  ],
  '2026-10-12': [
    [0, 1, 's_eng', 'Энг 441', 'подгр.2', 'Кузнецова Л.И.'],
    [0, 2, 's_mdk0102', 'Энг 215', '', 'Васильев С.Ю.'],
    [0, 3, 's_mdk0102', 'Энг 215', '', 'Васильев С.Ю.'],
    [1, 1, 's_oap', 'Энг 428', '', 'Данилова О.С.'],
    [1, 2, 's_net', 'Энг 113', '', 'Ольнев А.А.'],
    [1, 3, 's_dm', 'Энг 210', '', 'Муравьева Ю.А.'],
    [1, 4, 's_bzhd', 'Энг 249', '', 'Симоненко С.И.'],
    [2, 1, 's_opbd', 'Энг 315', '', 'Андреев В.А.'],
    [2, 2, 's_evm', 'Энг 209', '', 'Кудрявцева Е.В.'],
    [2, 3, 's_mdk04', 'Энг 301', '', 'Рябова В.В.'],
    [2, 4, 's_mdk0101', 'Энг 247', '', 'Васильев С.Ю.'],
    [3, 1, 's_eng', 'Энг 551', 'подгр.1', 'Гусарова М.Н.'],
    [3, 2, 's_mdk0101', 'Энг 110', '', 'Васильев С.Ю.'],
    [3, 3, 's_evm', 'Энг 209', '', 'Кудрявцева Е.В.'],
    [3, 4, 's_it', 'Энг 325', 'подгр.1 · лр', 'Краснопёрова А.Д.'],
    [3, 4, 's_it', 'Энг 415', 'подгр.2 · лр', 'Данилова О.С.'],
    [4, 2, 's_bzhd', 'Энг 222', '', 'Симоненко С.И.'],
    [4, 3, 's_hist', 'Энг 547', '', 'Зубарев А.А.'],
    [4, 4, 's_pe', 'Энг ск7', '', 'Мадаев Р.А.']
  ]
};
const QuickAtt = {
  weekStarts: ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'],
  fixWeek: '2026-10-19',
  lastDay: '2026-10-14',
  /**
   * Готовит пары расписания начала октября для одной недели.
   * @param {string} start Понедельник недели.
   * @returns {Array} Массив.
   */
  lessons(start) {
    if (start === QuickAtt.fixWeek) return QuickAtt.fixedWeek();
    return EARLY_WEEKS[start].map((row, index) => ({
      id: 'ew26_' + start + '_' + (index + 1),
      day: row[0],
      pair: row[1],
      week: 'both',
      subjectId: row[2],
      room: row[3],
      subgroup: row[4],
      who: row[5],
      start: '',
      end: ''
    }));
  },
  /**
   * Строит неделю 19–24 октября: расписание как в шаблоне, но английский стоит только в свои дни —
   * в понедельник 19.10 для 2 подгруппы (Кузнецова) и в четверг 22.10 для 1 подгруппы (Гусарова). Пара английского идёт одна,
   * как на неделях 28.09, 05.10 и 12.10, поэтому другие занятия в эти пары не ставятся.
   * @returns {Array<Object>} Пары недели.
   */
  fixedWeek() {
    const start = QuickAtt.fixWeek,
      english = [
        [0, 1, 's_eng', 'Энг 441', 'подгр.2', 'Кузнецова Л.И.'],
        [3, 1, 's_eng', 'Энг 551', 'подгр.1', 'Гусарова М.Н.']
      ],
      keep = Weeks.lessons(start).filter(
        l => l.subjectId !== 's_eng' && !english.some(e => e[0] === l.day && e[1] === l.pair)
      );
    return keep
      .map(l => Object.assign({}, l))
      .concat(
        english.map(e => ({
          day: e[0],
          pair: e[1],
          week: 'both',
          subjectId: e[2],
          room: e[3],
          subgroup: e[4],
          who: e[5],
          start: '',
          end: ''
        }))
      )
      .map((l, index) =>
        Object.assign(l, {
          id: 'ew26_' + start + '_' + (index + 1),
          week: 'both'
        })
      );
  },
  /**
   * Проверяет, что расписание начала октября уже внесено.
   * @returns {boolean} true, если условие выполнено.
   */
  isLoaded() {
    const map = Store.s.weeks || {};
    return QuickAtt.weekStarts.every(
      start => Array.isArray(map[start]) && map[start].some(l => String(l.id).indexOf('ew26_') === 0)
    );
  },
  /**
   * Вносит расписание 28.09–24.10 в четыре недели.
   */
  applyWeeks() {
    QuickAtt.weekStarts.forEach(start => {
      Store.s.weeks[start] = QuickAtt.lessons(start);
    });
    Store.commit();
  },
  /**
   * Собирает подгруппы и занятия, которые идут на паре в этот день.
   * @param {string} date Дата.
   * @param {number} pair Номер пары.
   * @returns {Object} Объект.
   */
  pairInfo(date, pair) {
    const subs = [],
      lessons = [];
    ['1', '2'].forEach(sub => {
      const found = Att.pairs(date, sub).find(x => x.pair === pair);
      if (found) {
        subs.push(sub);
        found.lessons.forEach(l => {
          if (!lessons.some(x => x.id === l.id)) lessons.push(l);
        });
      }
    });
    return {
      subs,
      lessons
    };
  },
  /**
   * Возвращает номера пар дня для любой подгруппы.
   * @param {string} date Дата.
   * @returns {Array} Массив.
   */
  pairsOfDay(date) {
    const set = {};
    ['1', '2'].forEach(sub =>
      Att.pairs(date, sub).forEach(x => {
        set[x.pair] = true;
      })
    );
    return Object.keys(set)
      .map(Number)
      .sort((a, b) => a - b);
  },
  /**
   * Составляет подпись пары из названий предметов.
   * @param {Object} info Данные пары.
   * @returns {string} Строка.
   */
  title(info) {
    const names = [];
    info.lessons.forEach(l => {
      const subject = Store.s.subjects.find(s => s.id === l.subjectId),
        name = (subject && (subject.short || subject.name)) || '?';
      const text = name + (l.subgroup ? ' (' + l.subgroup.split(' ')[0] + ')' : '');
      if (names.indexOf(text) < 0) names.push(text);
    });
    return names.join(' / ');
  },
  /**
   * Строит плашку «внесите расписание» для страницы расписания старосты.
   * @returns {string} HTML или пустая строка.
   */
  banner() {
    if (!Cloud.isAdmin || QuickAtt.isLoaded()) return '';
    return '<div class="card sched-banner"><div><b>Расписание начала октября и английский</b><p>Внести расписание 28.09–24.10: английский ставится по журналу (19.10 — 2 подгруппа, Кузнецова; 22.10 — 1 подгруппа, Гусарова). Остальные недели не меняются.</p></div><div class="head-actions"><button class="btn primary" data-action="qa-weeks">Внести расписание</button></div></div>';
  },
  /**
   * Выбирает студентов, которые ходят на эту пару.
   * @param {Object} info Данные пары.
   * @returns {Array} Массив.
   */
  eligible(info) {
    return ROSTER.filter(r => !r.flag && info.subs.indexOf(r.sub) >= 0);
  },
  /**
   * Составляет список пар 1–14 октября для заполнения.
   * @returns {string} Строка.
   */
  template() {
    const lines = [],
      today = U.iso(U.today());
    for (
      let day = U.fromISO(ATT_START);
      U.iso(day) <= QuickAtt.lastDay && U.iso(day) <= today;
      day = U.addDays(day, 1)
    ) {
      const iso = U.iso(day);
      QuickAtt.pairsOfDay(iso).forEach(pair => {
        const parts = iso.split('-');
        lines.push(
          parts[2] +
            '.' +
            parts[1] +
            ' ' +
            pair +
            ' ' +
            QuickAtt.title(QuickAtt.pairInfo(iso, pair)).replace(/:/g, ' ') +
            ':'
        );
      });
    }
    return lines.join('\n');
  },
  /**
   * Разбирает введённый текст: даты, пары и номера отсутствующих.
   * @param {string} text Введённый текст.
   * @returns {Object} Объект.
   */
  parse(text) {
    const items = [],
      errors = [],
      today = U.iso(U.today());
    String(text || '')
      .split('\n')
      .forEach((raw, index) => {
        const line = raw.trim();
        if (!line) return;
        const where = 'Строка ' + (index + 1) + ': ';
        const match = line.match(/^(\d{1,2})\.(\d{1,2})\s+(\d)\b[^:]*:\s*(.*)$/);
        if (!match) {
          errors.push(where + 'не понял формат. Нужно: «01.10 1 предмет: 3 8 12»');
          return;
        }
        const rest = match[4].trim();
        if (!rest) return;
        const date = '2026-' + match[2].padStart(2, '0') + '-' + match[1].padStart(2, '0'),
          pair = Number(match[3]);
        if (date < ATT_START || date > today || isNaN(new Date(date).getTime())) {
          errors.push(
            where +
              'дата ' +
              match[1] +
              '.' +
              match[2] +
              ' вне периода учёта (с ' +
              ATT_START.split('-').reverse().join('.') +
              ' по сегодня)'
          );
          return;
        }
        const info = QuickAtt.pairInfo(date, pair);
        if (!info.subs.length) {
          errors.push(where + 'в этот день нет пары ' + pair + ' (проверьте расписание)');
          return;
        }
        const pool = QuickAtt.eligible(info),
          absent = [],
          ignored = [];
        let bad = '';
        rest
          .split(/[\s,;]+/)
          .filter(Boolean)
          .forEach(token => {
            if (/^(-|—|–|нет|0)$/i.test(token)) return;
            const n = Number(token);
            const student = ROSTER.find(r => r.n === n);
            if (!/^\d+$/.test(token) || !student) {
              bad = bad || 'непонятно «' + token + '»';
              return;
            }
            if (!pool.some(r => r.n === n)) {
              ignored.push('№' + n + ' ' + student.name.split(' ')[0] + ' (' + (student.flag ? FLAG_LABEL[student.flag] : 'другая подгруппа') + ')');
              return;
            }
            if (absent.indexOf(n) < 0) absent.push(n);
          });
        if (bad) {
          errors.push(where + bad);
          return;
        }
        items.push({
          key: date + '|' + pair,
          date,
          pair,
          title: QuickAtt.title(info),
          absent,
          ignored,
          present: pool.filter(r => absent.indexOf(r.n) < 0).map(r => r.n)
        });
      });
    return {
      items,
      errors
    };
  },
  /**
   * Вызывает функцию сервера и возвращает результат или ошибку.
   * @param {string} name Имя функции.
   * @param {Object} args Параметры.
   * @returns {Promise<Object>} Объект.
   */
  async rpc(name, args) {
    try {
      const {data, error} = await supa.rpc(name, args || {});
      return error
        ? {
            ok: false,
            error: error.message
          }
        : {
            ok: true,
            data
          };
    } catch (error) {
      return {
        ok: false,
        error: String((error && error.message) || error)
      };
    }
  },
  /**
   * Перечитывает отметки всех студентов из облака.
   */
  async reloadAtt() {
    try {
      const {data} = await supa
        .from('docs')
        .select('path,data')
        .like('path', 'attendance/%')
        .not('path', 'like', 'attendance/%/%');
      if (!data) return;
      const map = {};
      data.forEach(row => {
        map[row.path.slice(11)] = clone(row.data);
      });
      Cloud.adm.att = map;
      App.renderSoft();
    } catch (error) {}
  },
  /**
   * Строит окно ввода посещаемости из журнала.
   * @returns {string} HTML.
   */
  html() {
    const legend = ROSTER.map(
      r =>
        '<span class="qa-n">' +
        r.n +
        '</span> ' +
        U.esc(r.name) +
        (r.flag ? ' <small>(' + FLAG_LABEL[r.flag] + ')</small>' : '')
    ).join('<br>');
    const notice = QuickAtt.isLoaded()
      ? ''
      : '<div class="card qa-warn"><b>Сначала внесите расписание начала октября</b><p>Пары за 28.09–17.10 берутся с ваших скриншотов, а английский на неделе 19–24.10 ставится по журналу: 19.10 — 2 подгруппа (Кузнецова), 22.10 — 1 подгруппа (Гусарова). Без этого отметки попадут не к тем предметам.</p><button class="btn primary" data-action="qa-weeks">Внести расписание</button></div>';
    return (
      '<div class="qa">' +
      notice +
      '<p class="md-help">По каждой паре впишите номера отсутствующих («нб») из бумажного журнала: номер строки в списке. Знак «-» значит, что отсутствующих нет. Пустая строка пропускается. Остальным студентам этой пары ставится «П». Номера студентов из другой подгруппы пропускаются: им отметка не ставится. Оценки не нужны. Уже стоящие отметки не меняются.</p>' +
      '<div class="head-actions"><button class="btn sm" data-action="qa-fill">Заполнить список пар 1–14 октября</button></div>' +
      '<textarea class="input qa-text" id="qa-text" rows="12" spellcheck="false" placeholder="01.10 1 ИТ: 3 8 30&#10;02.10 2 БЖД: -"></textarea><div id="qa-msg" class="md-help"></div>' +
      '<button class="btn primary big" data-action="qa-apply">Проверить и внести</button>' +
      '<h3 style="margin:16px 0 6px">Уже внесено из журнала</h3><div id="qa-list" class="md-help">Загрузка…</div>' +
      '<details style="margin-top:12px"><summary>Номера студентов</summary><div class="qa-legend">' +
      legend +
      '</div></details></div>'
    );
  },
  /**
   * Обновляет список уже внесённых пар в окне.
   */
  async refreshList() {
    const box = document.getElementById('qa-list');
    if (!box) return;
    const result = await QuickAtt.rpc('import_attendance_summary');
    if (!result.ok) {
      box.textContent = 'Не удалось загрузить: ' + result.error;
      return;
    }
    const rows = result.data || [];
    box.innerHTML = rows.length
      ? rows
          .map(
            r =>
              '<div class="qa-row"><span><b>' +
              U.esc(r.key.split('|')[0].split('-').reverse().slice(0, 2).join('.')) +
              ' пара ' +
              U.esc(r.key.split('|')[1]) +
              '</b>: отсутствуют ' +
              r.absent +
              ', присутствуют ' +
              r.present +
              (r.queued ? ', ждут регистрации студентов: ' + r.queued : '') +
              '</span><button class="btn sm" data-action="qa-undo" data-key="' +
              U.esc(r.key) +
              '">Отменить</button></div>'
          )
          .join('')
      : 'Пока ничего.';
  },
  /**
   * Открывает окно ввода посещаемости из журнала.
   */
  open() {
    UI.open('Ввод посещаемости из журнала', QuickAtt.html(), {
      noFocus: true
    });
    QuickAtt.refreshList();
  }
};
