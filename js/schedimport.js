'use strict';

const ScheduleImport = {
  days: {
    пн: 0,
    вт: 1,
    ср: 2,
    чт: 3,
    пт: 4,
    сб: 5,
    вс: 6,
    понедельник: 0,
    вторник: 1,
    среда: 2,
    четверг: 3,
    пятница: 4,
    суббота: 5,
    воскресенье: 6
  },
  /**
   * Определяет разделитель полей по первой строке.
   * @param {string} line Первая строка.
   * @returns {string} Строка.
   */
  delimiter(line) {
    if (line.indexOf('\t') >= 0) return '\t';
    if (line.indexOf(';') >= 0) return ';';
    if (line.indexOf('|') >= 0) return '|';
    return ',';
  },
  /**
   * Переводит день недели из текста в номер (0 — понедельник), -1 если не понял.
   * @param {string} text День недели.
   * @returns {number} Число.
   */
  dayIndex(text) {
    const key = String(text || '')
      .trim()
      .toLowerCase()
      .replace(/\.$/, '');
    if (key in ScheduleImport.days) return ScheduleImport.days[key];
    const n = parseInt(key, 10);
    return n >= 1 && n <= 7 && String(n) === key ? n - 1 : -1;
  },
  /**
   * Переводит подпись недели в числитель, знаменатель или обе; null если не понял.
   * @param {string} text Подпись недели.
   * @returns {string|null} Строка.
   */
  weekOf(text) {
    const key = String(text || '')
      .trim()
      .toLowerCase();
    if (!key || /^(обе|оба|both|кажд|все|вс[её])/.test(key)) return 'both';
    if (/^(числ|num|ч$)/.test(key)) return 'num';
    if (/^(знам|den|з$)/.test(key)) return 'den';
    return null;
  },
  /**
   * Приводит название к виду для сравнения.
   * @param {string} text Название.
   * @returns {string} Строка.
   */
  norm(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  },
  /**
   * Разбирает вставленное расписание: пары, новые предметы и ошибки по строкам.
   * @param {string} text Вставленное расписание.
   * @returns {Object} Объект.
   */
  parse(text) {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l && l.charAt(0) !== '#');
    const errors = [],
      lessons = [],
      created = [],
      pairsMax = Store.s.settings.pairs.length,
      seen = {};
    if (!lines.length)
      return {
        lessons,
        errors: ['Вставьте расписание: по одной паре в строке'],
        created,
        perDay: [0, 0, 0, 0, 0, 0, 0]
      };
    const sep = ScheduleImport.delimiter(lines[0]);
    const known = Store.s.subjects.slice();
    lines.forEach((line, index) => {
      const cells = line.split(sep).map(c => c.trim()),
        no = index + 1;
      if (/^(день|day)$/i.test(cells[0])) return;
      const day = ScheduleImport.dayIndex(cells[0]),
        pair = parseInt(cells[1], 10),
        name = cells[2] || '',
        week = ScheduleImport.weekOf(cells[5]);
      if (day < 0)
        return errors.push('Строка ' + no + ': не понял день «' + cells[0] + '» (Пн, Вт, Ср, Чт, Пт, Сб, Вс)');
      if (!(pair >= 1)) return errors.push('Строка ' + no + ': не понял номер пары «' + cells[1] + '»');
      if (pair > pairsMax)
        return errors.push(
          'Строка ' +
            no +
            ': пара ' +
            pair +
            ', а в «Время пар» всего ' +
            pairsMax +
            '. Сначала добавьте пары в звонках'
        );
      if (!name) return errors.push('Строка ' + no + ': не указан предмет');
      if (week === null)
        return errors.push('Строка ' + no + ': неделя «' + cells[5] + '» (нужно: числ., знам. или пусто)');
      let subject = known.find(
        s =>
          ScheduleImport.norm(s.name) === ScheduleImport.norm(name) ||
          ScheduleImport.norm(s.short) === ScheduleImport.norm(name)
      );
      if (!subject) {
        subject = {
          id: U.uid('s'),
          name,
          short: name.length > 10 ? name.slice(0, 9) + '…' : name,
          color: COLORS[known.length % COLORS.length],
          links: []
        };
        known.push(subject);
        created.push(subject);
      }
      const lesson = {
        id: U.uid('l'),
        day,
        pair,
        week,
        subjectId: subject.id,
        room: cells[4] || '',
        subgroup: cells[6] || '',
        who: cells[3] || '',
        start: '',
        end: ''
      };
      const key = [day, pair, week, lesson.subgroup, subject.id].join('|');
      if (seen[key]) return errors.push('Строка ' + no + ': такая пара уже есть выше');
      seen[key] = true;
      lessons.push(lesson);
    });
    const perDay = [0, 0, 0, 0, 0, 0, 0];
    lessons.forEach(l => {
      perDay[l.day]++;
    });
    return {
      lessons,
      errors,
      created,
      perDay
    };
  },
  /**
   * Показывает итог проверки расписания.
   * @param {Object} result Итог разбора.
   * @returns {string} HTML.
   */
  previewHtml(result) {
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const ok = result.lessons.length
      ? '<p><b>Распознано пар: ' +
        result.lessons.length +
        '</b> · ' +
        days.map((d, i) => d + ' ' + result.perDay[i]).join(' · ') +
        '</p>' +
        (result.created.length
          ? '<p class="md-help">Новые предметы: ' + result.created.map(s => U.esc(s.name)).join(', ') + '</p>'
          : '')
      : '';
    const bad = result.errors.length
      ? '<div class="warn">' +
        result.errors
          .slice(0, 12)
          .map(e => U.esc(e))
          .join('<br>') +
        (result.errors.length > 12 ? '<br>…и ещё ' + (result.errors.length - 12) : '') +
        '</div>'
      : '';
    return ok + bad;
  },
  /**
   * Скачивает копию текущего расписания перед заменой.
   */
  backup() {
    const state = Store.s;
    downloadBlob(
      new Blob(
        [
          JSON.stringify(
            {
              saved: new Date().toISOString(),
              schedule: state.schedule,
              weeks: state.weeks,
              subjects: state.subjects.map(x => ({
                id: x.id,
                name: x.name
              }))
            },
            null,
            2
          )
        ],
        {
          type: 'application/json'
        }
      ),
      'raspisanie-backup-' + U.iso(U.today()) + '.json'
    );
  },
  twoWeekStarts: ['2026-10-26', '2026-11-02'],
  /**
   * Готовит пары нового расписания для двух конкретных недель (26.10 и 02.11).
   * @returns {Object} Объект.
   */
  twoWeeks() {
    const weeks = {},
      kinds = {
        num: 0,
        den: 1
      };
    ScheduleImport.twoWeekStarts.forEach(start => {
      weeks[start] = [];
    });
    newScheduleLessons().forEach((l, index) => {
      const list = weeks[ScheduleImport.twoWeekStarts[kinds[l.week] === undefined ? 0 : kinds[l.week]]];
      list.push(
        Object.assign({}, l, {
          id: 'nw26_' + (index + 1),
          week: 'both'
        })
      );
    });
    return weeks;
  },
  /**
   * Проверяет, что новое расписание уже прикреплено к обеим неделям.
   * @returns {boolean} true, если условие выполнено.
   */
  isTwoWeeksLoaded() {
    const map = Store.s.weeks || {};
    return ScheduleImport.twoWeekStarts.every(
      start => Array.isArray(map[start]) && map[start].some(l => String(l.id).indexOf('nw26_') === 0)
    );
  },
  /**
   * Прикрепляет новое расписание к двум неделям, не трогая остальные, очищает отмены и замены этих недель и отправляет в облако.
   */
  applyTwoWeeks() {
    const state = Store.s,
      weeks = ScheduleImport.twoWeeks(),
      first = ScheduleImport.twoWeekStarts[0],
      last = U.iso(U.addDays(U.fromISO(ScheduleImport.twoWeekStarts[1]), 6));
    downloadBlob(
      new Blob(
        [
          JSON.stringify(
            {
              saved: new Date().toISOString(),
              weeks: ScheduleImport.twoWeekStarts.map(start => ({
                start,
                lessons: Weeks.lessons(start)
              })),
              changes: Changes.items().filter(c => c.date >= first && c.date <= last)
            },
            null,
            2
          )
        ],
        {
          type: 'application/json'
        }
      ),
      'raspisanie-2-nedeli-backup-' + U.iso(U.today()) + '.json'
    );
    Object.keys(weeks).forEach(start => {
      state.weeks[start] = weeks[start];
    });
    Changes.save(Changes.items().filter(c => !(c.date >= first && c.date <= last)));
    Store.commit();
  },
  /**
   * Готовит встроенное расписание (числитель с 26.10, знаменатель со 02.11) в виде результата разбора.
   * @returns {Object} Объект.
   */
  bundled() {
    const lessons = newScheduleLessons(),
      perDay = [0, 0, 0, 0, 0, 0, 0];
    lessons.forEach(l => {
      perDay[l.day]++;
    });
    return {
      lessons,
      errors: [],
      created: [],
      perDay
    };
  },
  /**
   * Проверяет, что в расписании уже стоит встроенное новое.
   * @returns {boolean} true, если условие выполнено.
   */
  isLoaded() {
    return Store.s.schedule.some(l => String(l.id).indexOf(NEW_SCHEDULE_ID) === 0);
  },
  /**
   * Заменяет расписание целиком, очищает недели и отмены пар и отправляет всё в облако.
   * @param {Object} result Итог разбора.
   */
  apply(result) {
    const state = Store.s;
    ScheduleImport.backup();
    result.created.forEach(sb => state.subjects.push(sb));
    state.schedule = result.lessons;
    state.weeks = {};
    Changes.save([]);
    Store.commit();
  }
};
/**
 * Строит плашку «Готово новое расписание» для старосты.
 * @returns {string} HTML.
 */
function scheduleBanner() {
  if (!Cloud.isAdmin || ScheduleImport.isLoaded() || ScheduleImport.isTwoWeeksLoaded()) return '';
  return '<div class="card sched-banner"><div><b>Новое расписание готово</b><p>Прикрепить к двум неделям: 26–31 октября и 2–7 ноября. Остальные недели не изменятся, копия скачается файлом.</p></div><div class="head-actions"><button class="btn primary" data-action="sched-two-weeks">Прикрепить на 2 недели</button><button class="btn" data-action="sched-import-bundled">Заменить всё расписание</button></div></div>';
}
/**
 * Открывает окно замены расписания.
 */
function openScheduleImport() {
  UI.open(
    'Заменить расписание целиком',
    '<div data-form="sched-import"><p class="md-help">Старые пары (и недели со своими правками) будут удалены, перед этим скачается копия. Формат: по одной паре в строке, поля через точку с запятой, таб или |:</p>' +
      '<pre class="sol-text">день; пара; предмет; преподаватель; аудитория; неделя; подгруппа\nПн; 1; Основы проектирования баз данных; Андреев В.А.; 315\nВт; 2; Английский; Кузнецова Н.; 441; числ.; подгр.1</pre><p class="md-help">Неделя и подгруппа необязательны (неделя: числ., знам. или пусто = каждая).</p>' +
      '<textarea class="input" name="text" rows="10" placeholder="Вставьте расписание"></textarea><div id="sched-import-preview" class="md-help"></div>' +
      '<div class="head-actions" style="margin-top:12px"><button class="btn" data-action="sched-import-bundled">Загрузить расписание с 26.10</button><button class="btn" data-action="sched-import-check">Проверить</button><button class="btn primary" data-action="sched-import-apply">Заменить расписание</button></div></div>',
    {
      noFocus: true
    }
  );
}
