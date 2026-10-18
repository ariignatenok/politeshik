'use strict';

const Ics = {
  /**
   * Экранирует текст для файла календаря.
   * @param {string} text Исходный текст.
   * @returns {string} Строка.
   */
  escape(text) {
    return String(text == null ? '' : text)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  },
  /**
   * Разбивает длинную строку календаря на части по 75 байт.
   * @param {string} line Строка календаря.
   * @returns {string} Строка.
   */
  fold(line) {
    const encoder = new TextEncoder();
    if (encoder.encode(line).length <= 75) return line;
    const parts = [];
    let current = '',
      bytes = 0;
    for (const ch of line) {
      const size = encoder.encode(ch).length;
      if (bytes + size > (parts.length ? 74 : 75)) {
        parts.push(current);
        current = '';
        bytes = 0;
      }
      current += ch;
      bytes += size;
    }
    parts.push(current);
    return parts.join('\r\n ');
  },
  /**
   * Форматирует момент времени в UTC для календаря.
   * @param {Date} date Момент времени.
   * @returns {string} Строка.
   */
  utcStamp(date) {
    return (
      date.getUTCFullYear() +
      U.pad(date.getUTCMonth() + 1) +
      U.pad(date.getUTCDate()) +
      'T' +
      U.pad(date.getUTCHours()) +
      U.pad(date.getUTCMinutes()) +
      U.pad(date.getUTCSeconds()) +
      'Z'
    );
  },
  /**
   * Форматирует местное время для календаря.
   * @param {Date} date Местное время.
   * @returns {string} Строка.
   */
  localStamp(date) {
    return (
      date.getFullYear() +
      U.pad(date.getMonth() + 1) +
      U.pad(date.getDate()) +
      'T' +
      U.pad(date.getHours()) +
      U.pad(date.getMinutes()) +
      '00'
    );
  },
  /**
   * Строит события календаря для одного дедлайна с напоминаниями.
   * @param {Object} item Дедлайн: id, title, type, subjectId, date, time.
   * @returns {Array<string>} строки файла.
   */
  event(item) {
    const subject = subj(item.subjectId),
      timed = /^(\d{1,2}):(\d{2})/.test(item.time || '');
    const lines = [
      'BEGIN:VEVENT',
      'UID:' + item.id + '-' + item.date + '@politeshik',
      'DTSTAMP:' + Ics.utcStamp(new Date())
    ];
    if (timed) {
      const [, h, m] = /^(\d{1,2}):(\d{2})/.exec(item.time),
        start = U.fromISO(item.date);
      start.setHours(+h, +m, 0, 0);
      const end = new Date(start.getTime() + 36e5);
      lines.push('DTSTART:' + Ics.localStamp(start), 'DTEND:' + Ics.localStamp(end));
    } else {
      lines.push(
        'DTSTART;VALUE=DATE:' + item.date.replace(/-/g, ''),
        'DTEND;VALUE=DATE:' + U.iso(U.addDays(U.fromISO(item.date), 1)).replace(/-/g, '')
      );
    }
    const title = (item.type ? item.type + ': ' : '') + item.title;
    lines.push(
      'SUMMARY:' + Ics.escape(title),
      'DESCRIPTION:' +
        Ics.escape(
          (subject ? 'Предмет: ' + subject.name + '. ' : '') +
            'Срок сдачи: ' +
            shortDate(item.date) +
            '. Создано в приложении Политешик.'
        ),
      'CATEGORIES:Политешик'
    );
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:' + Ics.escape(title),
      'TRIGGER:' + (timed ? '-P1D' : '-PT15H'),
      'END:VALARM'
    );
    if (timed)
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + Ics.escape(title), 'TRIGGER:-PT2H', 'END:VALARM');
    lines.push('END:VEVENT');
    return lines;
  },
  /**
   * Собирает файл календаря из дедлайнов.
   * @param {Array<Object>} items Дедлайны.
   * @returns {string} содержимое .ics.
   */
  build(items) {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Politeshik//Deadlines//RU',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Политешик: дедлайны'
    ];
    items.forEach(item => lines.push(...Ics.event(item)));
    lines.push('END:VCALENDAR');
    return lines.map(Ics.fold).join('\r\n') + '\r\n';
  },
  /**
   * Превращает название в безопасное имя файла.
   * @param {string} text Название.
   * @returns {string} Строка.
   */
  slug(text) {
    return (
      String(text || 'deadline')
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'deadline'
    );
  },
  /**
   * Скачивает файл календаря.
   * @param {Array<Object>} items Дедлайны.
   * @param {string} name Имя файла без расширения.
   */
  download(items, name) {
    downloadBlob(
      new Blob([Ics.build(items)], {
        type: 'text/calendar;charset=utf-8'
      }),
      name + '.ics'
    );
  }
};
