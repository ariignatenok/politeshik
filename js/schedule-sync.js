'use strict';

const ScheduleSync = {
  group: '25290909/3091',
  key: 'politeshik:polytech-schedule:v1',
  url: 'https://raw.githubusercontent.com/ariignatenok/politeshik/main/data/schedule.json',
  snapshot: null,
  failed: false,
  busy: false,
  interval: 300000,
  epoch: 0,
  file: 'schedule.json',
  /**
   * Разделяет источник и офлайн-кэш по группе.
   * @param {Object} group Проверенная конфигурация группы.
   */
  configure(group) {
    ScheduleSync.epoch++;
    ScheduleSync.group = group.number;
    ScheduleSync.file = group.file;
    ScheduleSync.url = 'https://raw.githubusercontent.com/ariignatenok/politeshik/main/data/' + group.file;
    ScheduleSync.key = 'politeshik:polytech-schedule:v1:' + group.id;
    ScheduleSync.snapshot = null;
    ScheduleSync.busy = false;
    try {
      const cached = JSON.parse(localStorage.getItem(ScheduleSync.key));
      if (ScheduleSync.valid(cached)) ScheduleSync.snapshot = cached;
    } catch (error) {}
    ScheduleSync.populateCatalog();
    ScheduleSync.refresh();
  },
  /**
   * Добавляет предметы и преподавателей только из расписания выбранной группы.
   */
  populateCatalog() {
    if (!ScheduleSync.snapshot || !Store.s) return;
    Object.values(ScheduleSync.snapshot.days).forEach(day => day.lessons.forEach(lesson => {
      const subjectId = ScheduleSync.subject(lesson.subject);
      if (!lesson.teacher) return;
      const teacher = Store.s.teachers.find(t => t.name === lesson.teacher);
      if (teacher) {
        if (!teacher.subjectIds.includes(subjectId)) teacher.subjectIds.push(subjectId);
      } else Store.s.teachers.push({id: 'polytech_teacher_' + Array.from(lesson.teacher).map(c => c.codePointAt(0).toString(36)).join(''), name: lesson.teacher, subjectIds: [subjectId], email: '', phone: '', room: lesson.classroom || '', notes: ''});
    }));
  },
  /**
   * Проверяет весь снимок до замены последней рабочей копии.
   * @param {Object} data Снимок расписания.
   * @returns {boolean} Корректность снимка.
   */
  valid(data) {
    if (!data || data.schema !== 1 || data.group !== ScheduleSync.group || !data.days ||
        !/^\d{4}-\d{2}-\d{2}$/.test(data.checked_at || '') ||
        !/^\d{4}-\d{2}-\d{2}$/.test(data.from || '') ||
        !/^\d{4}-\d{2}-\d{2}$/.test(data.to || '')) return false;
    const dates = Object.keys(data.days).sort();
    if (!dates.length || dates.length > 400 || dates[0] !== data.from || dates[dates.length - 1] !== data.to) return false;
    return dates.every(date => /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      data.days[date] && Array.isArray(data.days[date].lessons) &&
      data.days[date].lessons.every(l => l && Number.isInteger(l.lesson_number) &&
        l.lesson_number >= 1 && l.lesson_number <= 10 && typeof l.subject === 'string' && !!l.subject.trim() &&
        ['ok', 'replacement', 'cancellation'].includes(l.status) && [0, 1, 2].includes(l.subgroup) &&
        Array.isArray(l.group_list) && l.group_list.includes(ScheduleSync.group)));
  },
  /**
   * Возвращает опубликованный день, включая день без занятий.
   * @param {string} date Дата ГГГГ-ММ-ДД.
   * @returns {Object|null} День или null вне полученного диапазона.
   */
  day(date) {
    return ScheduleSync.snapshot && ScheduleSync.snapshot.days[date] || null;
  },
  /**
   * Сопоставляет сокращения источника с существующими предметами и материалами.
   * @param {string} name Название источника.
   * @returns {string} Идентификатор предмета.
   */
  subject(name) {
    const norm = text => String(text || '').toLowerCase().replace(/ё/g, 'е').replace(/[_\s]+/g, ' ').trim();
    const key = norm(name),
      aliases = [
        [/^опбд$/, 's_opbd'], [/^ит в пд(?: лр)?$/, 's_it'], [/^дм с эмл$/, 's_dm'],
        [/^ин\. яз\. в пд$/, 's_eng'], [/^физ\. культура$/, 's_pe'], [/^оап(?: лр)?$/, 's_oap'],
        [/^мдк\.01\.01\b/, 's_mdk0101'], [/^мдк\.01\.02\b/, 's_mdk0102'], [/^мдк\.04\.01\b/, 's_mdk04']
      ],
      exact = Store.s.subjects.find(s => norm(s.name) === key || norm(s.short) === key),
      alias = aliases.find(([pattern]) => pattern.test(key)),
      found = exact || alias && Store.s.subjects.find(s => s.id === alias[1]);
    if (found) return found.id;
    let hash = 2166136261;
    for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
    const id = 'polytech_' + (hash >>> 0).toString(16);
    if (!Store.s.subjects.some(s => s.id === id))
      Store.s.subjects.push({id, name, short: name, color: '#94a3b8', links: [], formulas: []});
    return id;
  },
  /**
   * Преобразует пару источника в формат приложения, сохраняя подгруппу и статус.
   * @param {Object} lesson Пара источника.
   * @param {string} date Дата занятия.
   * @param {number} index Позиция в ответе.
   * @returns {Object} Пара приложения.
   */
  lesson(lesson, date, index) {
    return {
      id: 'polytech_' + date + '_' + lesson.lesson_number + '_' + lesson.subgroup + '_' + index,
      day: U.dayIdx(U.fromISO(date)), pair: lesson.lesson_number, week: 'both',
      subjectId: ScheduleSync.subject(lesson.subject),
      room: lesson.classroom || lesson.auditorium || '', who: lesson.teacher || '',
      subgroup: lesson.subgroup ? 'подгр.' + lesson.subgroup : '', start: '', end: '',
      sourceStatus: lesson.status, sourceSubject: lesson.subject, sourceNote: lesson.note || '',
      originalSubject: lesson.original_subject || '', originalTeacher: lesson.original_teacher || '',
      originalRoom: lesson.original_classroom || ''
    };
  },
  /**
   * Подставляет полученные дни недели, сохраняя прежнее расписание вне диапазона.
   * @param {string} start Понедельник недели.
   * @param {Array<Object>} fallback Локальные пары недели.
   * @returns {Array<Object>} Пары недели.
   */
  week(start, fallback) {
    if (!ScheduleSync.snapshot || fallback.some(l => l.manualWeek)) return fallback.filter(l => !l.deleted);
    const cells = new Set(fallback.filter(l => l.manualCell).map(l => l.day + '|' + l.pair));
    let result = fallback.filter(l => !l.manualCell && !l.deleted);
    for (let i = 0; i < 7; i++) {
      const date = U.iso(U.addDays(U.fromISO(start), i)), day = ScheduleSync.day(date);
      if (!day) continue;
      result = result.filter(l => l.day !== i);
      result.push(...day.lessons.map((l, index) => ScheduleSync.lesson(l, date, index)));
    }
    return result.filter(l => !cells.has(l.day + '|' + l.pair))
      .concat(fallback.filter(l => l.manualCell && !l.deleted));
  },
  /**
   * Готовит список замен и отмен отдельно для каждой подгруппы.
   * @returns {Array<Object>} Изменения источника.
   */
  changes() {
    if (!ScheduleSync.snapshot) return [];
    const result = [];
    Object.entries(ScheduleSync.snapshot.days).forEach(([date, day]) => {
      day.lessons.forEach((l, index) => {
        const local = Weeks.map()[Weeks.start(date)] || [];
        if (local.some(x => x.manualWeek || x.manualCell && x.day === U.dayIdx(U.fromISO(date)) && x.pair === l.lesson_number) || Changes.at(date, l.lesson_number)) return;
        if (l.status === 'ok') return;
        const lesson = ScheduleSync.lesson(l, date, index);
        if (!Att.mine([lesson]).length) return;
        result.push({
          id: lesson.id, date, pair: lesson.pair, source: true,
          type: l.status === 'cancellation' ? 'cancel' : 'replace',
          subjectId: ScheduleSync.subject(l.original_subject || l.subject), newSubjectId: lesson.subjectId,
          newRoom: lesson.room, newTeacher: lesson.who,
          reason: [lesson.subgroup, lesson.sourceNote].filter(Boolean).join(' · ')
        });
      });
    });
    return result;
  },
  /**
   * Загружает снимок с таймаутом и сохраняет рабочую копию для офлайн-режима.
   * @param {string} url Адрес опубликованного снимка.
   * @returns {Promise<boolean>} Успешная загрузка.
   */
  async fetchSnapshot(url) {
    const epoch = ScheduleSync.epoch;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {cache: 'no-store', signal: controller.signal});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (epoch !== ScheduleSync.epoch) return false;
      if (!ScheduleSync.valid(data)) throw new Error('Некорректный ответ расписания');
      if (ScheduleSync.snapshot && data.checked_at < ScheduleSync.snapshot.checked_at) return false;
      ScheduleSync.snapshot = data;
      ScheduleSync.populateCatalog();
      try { localStorage.setItem(ScheduleSync.key, JSON.stringify(data)); } catch (error) {}
      return true;
    } finally { clearTimeout(timer); }
  },
  /**
   * Проверяет обновления; последняя копия остаётся доступной при сбое сети.
   * @returns {Promise<void>} Результат проверки.
   */
  async refresh() {
    if (ScheduleSync.busy) return;
    ScheduleSync.busy = true;
    const epoch = ScheduleSync.epoch;
    try {
      const loaded = await ScheduleSync.fetchSnapshot(ScheduleSync.url + '?t=' + Date.now());
      if (epoch === ScheduleSync.epoch) ScheduleSync.failed = !loaded;
    } catch (error) {
      if (epoch !== ScheduleSync.epoch) return;
      ScheduleSync.failed = true;
      if (!ScheduleSync.snapshot) {
        try { await ScheduleSync.fetchSnapshot('data/' + ScheduleSync.file); } catch (ignored) {}
      }
    } finally {
      if (epoch === ScheduleSync.epoch) { ScheduleSync.busy = false; App.renderSoft(); }
    }
  },
  /**
   * Запускает проверку при открытии, возвращении на страницу и каждые пять минут.
   */
  init() {
    try {
      const cached = JSON.parse(localStorage.getItem(ScheduleSync.key));
      if (ScheduleSync.valid(cached)) ScheduleSync.snapshot = cached;
    } catch (error) {}
    ScheduleSync.refresh();
    setInterval(() => { if (!document.hidden) ScheduleSync.refresh(); }, ScheduleSync.interval);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) ScheduleSync.refresh(); });
    window.addEventListener('online', () => ScheduleSync.refresh());
  },
  /**
   * Показывает источник, дату снимка и состояние обновления расписания.
   * @returns {string} HTML плашки.
   */
  banner() {
    const data = ScheduleSync.snapshot, date = data && data.checked_at,
      stale = date && Date.now() - new Date(date + 'T00:00:00+03:00').getTime() > 36 * 3600000;
    const status = !data ? 'Расписание ещё не получено. Пока показана сохранённая версия.' :
      ScheduleSync.failed || stale ? 'Показана последняя копия от ' + date + '. Свежесть данных пока не подтверждена.' :
        'Расписание, замены и отмены обновляются автоматически. Данные от ' + date + '.';
    const selected = ui.schedWs || Weeks.start(U.today()),
      outside = data && !ScheduleSync.day(selected) ? '<p>На выбранную неделю источник ещё не опубликовал данные. Показано сохранённое расписание.</p>' : '';
    return '<section class="card"><b>Расписание группы ' + ScheduleSync.group + '</b><p>' + status +
      '</p>' + outside + '<p>Проверка источника — примерно каждые 15 минут; на открытой странице — каждые 5 минут.' +
      '</p><a href="https://polytech-schedule.ru" target="_blank" rel="noopener">Источник: Расписание ИСПО</a>' +
      ' <button class="btn sm" data-action="sched-sync"' + (ScheduleSync.busy ? ' disabled' : '') +
      '>Проверить обновления</button></section>';
  }
};
