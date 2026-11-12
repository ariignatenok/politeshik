'use strict';

/**
 * Буквы статусов, которые уходят в Google Таблицу.
 * @type {Object<string,string>}
 */
const GS_LETTER = {п: 'П', о: 'О', н: 'Н', у: 'У', уп: 'УП'};

const GoogleSync = {
  KEY: 'politeshik:gsync',
  timer: null,
  queue: [],

  /**
   * Возвращает сохранённые настройки синхронизации (хранятся только на этом устройстве).
   * @returns {Object} url, token, auto, last.
   */
  config() {
    const base = {url: '', token: '', auto: false, last: null, ym: '', group: GROUP_NAME, groups: [GROUP_NAME]};
    try {
      return Object.assign(base, JSON.parse(window.localStorage.getItem(GoogleSync.KEY) || '{}'));
    } catch (error) {
      return base;
    }
  },

  /**
   * Сохраняет изменения настроек синхронизации.
   * @param {Object} patch Новые значения.
   * @returns {Object} Настройки после сохранения.
   */
  save(patch) {
    const cfg = Object.assign(GoogleSync.config(), patch);
    try {
      window.localStorage.setItem(GoogleSync.KEY, JSON.stringify(cfg));
    } catch (error) { }
    return cfg;
  },

  /**
   * Проверяет, что строка похожа на адрес веб-приложения Google Apps Script.
   * @param {string} url Адрес.
   * @returns {boolean} true, если адрес верный.
   */
  isUrl(url) {
    return /^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[\w-]+\/exec$/.test(String(url || '').trim());
  },

  /**
   * Превращает запись об отметке в данные для таблицы.
   * @param {Object} it Запись из AttReport.entry или items.
   * @returns {Object} Данные: дата, пара, предмет, студент, статус и подсказки для поиска колонки.
   */
  record(it) {
    const same = Att.pairs(it.date, it.r.sub)
      .filter(x => x.lessons[0].subjectId === it.subjectId)
      .map(x => x.pair)
      .sort((a, b) => a - b);
    return {
      date: it.date,
      pair: it.pair,
      slot: QuickAtt.pairsOfDay(it.date).indexOf(it.pair) + 1,
      nth: same.indexOf(it.pair) + 1,
      same: same.length,
      subject: it.subject,
      subjectFull: it.subjectFull,
      teacher: it.teacher,
      student: AttReport.pretty(it.r),
      n: it.r.n,
      rid: it.r.id,
      sub: it.r.sub,
      status: GS_LETTER[it.st] || '',
      kind: it.kind || ''
    };
  },

  /**
   * Отправляет одно сообщение на адрес скрипта.
   * @param {Object} cfg Настройки.
   * @param {Object} payload Данные.
   * @returns {Promise<Object>} {ok, data, opaque} или {ok:false, error}.
   */
  async post(cfg, payload) {
    const body = JSON.stringify(Object.assign({source: 'politeshik', token: cfg.token}, payload));
    try {
      const res = await fetch(cfg.url, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body, redirect: 'follow'});
      const data = await res.json();
      return data && data.ok ? {ok: true, data} : {ok: false, error: (data && data.error) || 'Скрипт не принял данные'};
    } catch (error) {
      try {
        await fetch(cfg.url, {method: 'POST', mode: 'no-cors', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body});
        return {ok: true, opaque: true, data: {}};
      } catch (error2) {
        return {ok: false, error: 'Нет связи со скриптом. Проверьте ссылку и интернет.'};
      }
    }
  },

  /**
   * Возвращает список месяцев для выбора: с октября 2026 до июня 2027 (и дальше, если уже позже).
   * @returns {Array<Object>} Объекты {ym, label}.
   */
  monthList() {
    const cur = U.iso(U.today()).slice(0, 7),
      last = cur > '2027-06' ? cur : '2027-06',
      out = [];
    for (let ym = ATT_START.slice(0, 7); ym <= last; ym = GoogleSync.nextMonth(ym)) out.push({ym, label: GoogleSync.monthTitle(ym)});
    return out;
  },

  /**
   * Возвращает название месяца с годом без «г.», например «Ноябрь 2026».
   * @param {string} ym Месяц ГГГГ-ММ.
   * @returns {string} Строка.
   */
  monthTitle(ym) {
    const w = monthWord(ym);
    return w.charAt(0).toUpperCase() + w.slice(1) + ' ' + ym.slice(0, 4);
  },

  /**
   * Возвращает следующий месяц.
   * @param {string} ym Месяц ГГГГ-ММ.
   * @returns {string} Месяц ГГГГ-ММ.
   */
  nextMonth(ym) {
    const p = ym.split('-').map(Number);
    return U.iso(new Date(p[0], p[1], 1)).slice(0, 7);
  },

  /**
   * Делает параметры месяца и группы для скрипта: {month: «Ноябрь», ym: «2026-11», group}.
   * @param {string} ym Месяц ГГГГ-ММ.
   * @param {string} group Номер группы.
   * @returns {Object} Параметры.
   */
  meta(ym, group) {
    const w = monthWord(ym);
    return {month: w.charAt(0).toUpperCase() + w.slice(1), ym, group: group || GROUP_NAME};
  },

  /**
   * Проверяет номер группы (например 25290909/3091, у заочных с буквой «з» впереди).
   * @param {string} g Номер.
   * @returns {boolean} true, если верный.
   */
  isGroup(g) {
    return /^з?\d{8}\/\d{4}$/.test(String(g || '').trim());
  },

  /**
   * Возвращает выбранные в окне месяц и группу (или сохранённые раньше).
   * @returns {Object} {ym, group}.
   */
  picked() {
    const cfg = GoogleSync.config(),
      val = id => (document.getElementById(id) || {}).value;
    return {
      ym: val('gs-month') || cfg.ym || U.iso(U.today()).slice(0, 7),
      group: (val('gs-group') || cfg.group || GROUP_NAME).trim()
    };
  },

  /**
   * Проверяет связь со скриптом.
   * @returns {Promise<Object>} Результат.
   */
  async ping() {
    const cfg = GoogleSync.config();
    if (!GoogleSync.isUrl(cfg.url)) return {ok: false, error: 'Вставьте ссылку Web App (оканчивается на /exec)'};
    return GoogleSync.post(cfg, {action: 'ping'});
  },

  /**
   * Отправляет записи пачками.
   * @param {Array<Object>} records Записи для таблицы.
   * @param {Function} progress Функция, получающая (отправлено, всего).
   * @param {Object} opts dry: true, чтобы только проверить, ничего не записывая.
   * @returns {Promise<Object>} ok, written, skipped, reasons, sample, version, opaque.
   */
  async send(records, progress, opts) {
    const cfg = GoogleSync.config(),
      dry = !!(opts && opts.dry),
      meta = (opts && opts.meta) || {};
    if (!GoogleSync.isUrl(cfg.url)) return {ok: false, error: 'Ссылка на скрипт не указана'};
    const out = {ok: true, dry, written: 0, skipped: [], skippedCount: 0, reasons: {}, sample: [], warnings: [], warningCount: 0, addedColumns: 0, diag: null, sheet: '', created: false, willCreate: false, version: '', opaque: false, total: records.length};
    for (let i = 0; i < records.length; i += 120) {
      const part = records.slice(i, i + 120),
        res = await GoogleSync.post(cfg, Object.assign({records: part, dry}, meta));
      if (!res.ok) return Object.assign(out, {ok: false, error: res.error});
      if (res.opaque) out.opaque = true;
      const d = res.data || {};
      out.version = d.version || out.version;
      out.sheet = d.sheet || out.sheet;
      out.created = out.created || !!d.created;
      out.willCreate = out.willCreate || !!d.willCreate;
      out.written += d.written || 0;
      out.addedColumns += d.addedColumns || 0;
      out.skipped = out.skipped.concat(d.skipped || []);
      out.skippedCount += d.skippedCount || (d.skipped || []).length;
      out.warningCount += d.warningCount || (d.warnings || []).length;
      if (!out.warnings.length) out.warnings = d.warnings || [];
      Object.keys(d.reasons || {}).forEach(k => {
        out.reasons[k] = (out.reasons[k] || 0) + d.reasons[k];
      });
      if (!out.sample.length) out.sample = d.sample || [];
      if (!out.diag && d.diag) out.diag = d.diag;
      if (progress) progress(Math.min(records.length, i + 120), records.length);
    }
    if (!dry) GoogleSync.save({last: {at: new Date().toISOString(), total: out.total, written: out.written, skipped: out.skippedCount, opaque: out.opaque}});
    return out;
  },

  /**
   * Собирает понятный отчёт о том, что скрипт сделал (или сделал бы).
   * @param {Object} res Результат send().
   * @returns {string} HTML.
   */
  summary(res) {
    if (res.opaque)
      return 'Отправлено: ' + res.total + '. Браузер не показывает ответ Google, откройте таблицу и проверьте ячейки.';
    const lines = [(res.dry ? 'Проверка, в таблицу ничего не записано: подойдёт ' : 'Записано в таблицу: ') + res.written + ' из ' + res.total];
    if (res.sheet)
      lines.push('Лист: «' + U.esc(res.sheet) + '»' + (res.created ? ' (создан автоматически)' : res.willCreate ? ' (будет создан при отправке)' : '') + (res.addedColumns ? ', добавлено колонок: ' + res.addedColumns : ''));
    if (res.version !== 'v4') lines.push('<b>Скрипт старой версии:</b> вставьте новый код в Apps Script и сделайте «Развернуть» → «Управление развертываниями» → карандаш → «Новая версия».');
    const why = Object.keys(res.reasons || {}).map(k => k + ' (' + res.reasons[k] + ')');
    if (res.diag && res.skippedCount && Object.keys(res.reasons || {}).some(k => /нет студента|нет даты/.test(k)))
      lines.push(
        'Скрипт видит в листе «' + U.esc(res.diag.sheet) + '»: студентов ' + res.diag.students + (res.diag.firstStudents.length ? ' (например: ' + U.esc(res.diag.firstStudents.slice(0, 3).join('; ')) + ')' : '') + '; даты в строке ' + res.diag.dateRow + ', предметы в строке ' + res.diag.subjectRow + ', ФИО в колонке ' + res.diag.nameColumn + '.'
      );
    if (res.skippedCount) lines.push('Не нашлось места: ' + res.skippedCount + '. Причины: ' + U.esc(why.slice(0, 4).join('; ')));
    if (res.warningCount) {
      lines.push('Предупреждений: ' + res.warningCount + ' (записано, но проверьте):');
      (res.warnings || []).slice(0, 3).forEach(x => lines.push(U.esc(x.student + ', ' + x.date.split('-').reverse().join('.') + ': ' + x.text)));
    }
    (res.sample || []).slice(0, 4).forEach(s => {
      lines.push(
        U.esc(s.student + ', ' + s.date.split('-').reverse().join('.') + ', пара ' + s.pair + ' «' + s.subject + '» → «' + s.value + '» в ячейку ' + s.cell + ' (колонка «' + s.column + '», день «' + s.day + '», строка «' + s.row + '»)')
      );
    });
    return lines.join('<br>');
  },

  /**
   * Собирает отметки за выбранный период и отправляет их (или только проверяет).
   * @param {HTMLElement} el Нажатая кнопка.
   * @param {boolean} dry true — проверка без записи.
   */
  async run(el, dry) {
    GoogleSync.readForm();
    const pk = GoogleSync.picked();
    if (!GoogleSync.isGroup(pk.group)) return GoogleSync.say('Номер группы должен быть вида 25290909/3091', true);
    const rg = [pk.ym < ATT_START.slice(0, 7) ? ATT_START : pk.ym + '-01', monthEnd(pk.ym)];
    el.disabled = true;
    try {
      GoogleSync.say('Собираю отметки за ' + U.esc(GoogleSync.monthTitle(pk.ym)) + '…');
      const records = await GoogleSync.collect(rg[0], rg[1]);
      if (!records.length) return GoogleSync.say('Нет отметок за ' + U.esc(GoogleSync.monthTitle(pk.ym)), true);
      const res = await GoogleSync.send(records, (done, all) => GoogleSync.say((dry ? 'Проверено ' : 'Отправлено ') + done + ' из ' + all + '…'), {dry, meta: GoogleSync.meta(pk.ym, pk.group)});
      if (!res.ok) return GoogleSync.say(U.esc(res.error), true);
      GoogleSync.say(GoogleSync.summary(res), res.written === 0 && !res.opaque);
      if (!dry) App.renderSoft();
    } finally {
      el.disabled = false;
    }
  },

  /**
   * Скачивает журнал выбранного месяца файлом Excel в виде матрицы (студенты × дни и пары).
   * @param {HTMLElement} el Кнопка.
   */
  async xls(el) {
    GoogleSync.readForm();
    const pk = GoogleSync.picked();
    el.disabled = true;
    try {
      await AttReport.load(true);
      const m = AttReport.matrix(pk.ym, pk.group);
      if (!m.columns) return GoogleSync.say('За ' + U.esc(GoogleSync.monthTitle(pk.ym)) + ' пар по расписанию ещё не было', true);
      await Cloud.dl.save({
        filename: 'politeshik-zhurnal-' + pk.group.replace(/[^0-9з]+/g, '-') + '-' + pk.ym + '.xlsx',
        data: Xlsx.build(m.spec)
      });
      GoogleSync.say('Файл за ' + U.esc(GoogleSync.monthTitle(pk.ym)) + ' сохранён: ' + m.students + ' студентов, ' + m.days + ' дней, ' + m.columns + ' колонок пар. Откройте его в Excel.');
    } catch (error) {
      GoogleSync.say('Не удалось сохранить файл', true);
    } finally {
      el.disabled = false;
    }
  },

  /**
   * Собирает записи всей группы за период.
   * @param {string} from Начало.
   * @param {string} to Конец.
   * @returns {Promise<Array<Object>>} Записи.
   */
  async collect(from, to) {
    await AttReport.load(true);
    return AttReport.items(from, to).map(GoogleSync.record);
  },

  /**
   * Ставит записи в очередь для автоматической отправки.
   * @param {Array<Object>} records Записи.
   */
  enqueue(records) {
    const cfg = GoogleSync.config();
    if (!cfg.auto || !GoogleSync.isUrl(cfg.url) || !records.length) return;
    GoogleSync.queue = GoogleSync.queue.concat(records);
    clearTimeout(GoogleSync.timer);
    GoogleSync.timer = setTimeout(async () => {
      const batch = GoogleSync.queue.splice(0),
        byMonth = {};
      batch.forEach(r => {
        (byMonth[r.date.slice(0, 7)] = byMonth[r.date.slice(0, 7)] || []).push(r);
      });
      for (const ym of Object.keys(byMonth).sort()) {
        const res = await GoogleSync.send(byMonth[ym], null, {meta: GoogleSync.meta(ym, GoogleSync.config().group)});
        if (!res.ok) return toast('Google: не удалось отправить отметки. Нажмите «Отправить в Google» позже');
      }
    }, 1500);
  },

  /**
   * Отправляет в Google отметки, которые староста только что изменил у одного студента.
   * @param {string} uid Аккаунт студента.
   * @param {Object<string,string>} changes Изменённые отметки вида {"дата|пара": статус}.
   */
  autoMarks(uid, changes) {
    if (!GoogleSync.config().auto) return;
    const prof = (Cloud.adm.profiles || {})[uid] || {},
      r = ROSTER_BY_ID[prof.rid];
    if (!r || r.flag) return;
    const person = {r, marks: Object.assign({}, ((Cloud.adm.att || {})[uid] || {}).marks), certs: ((Cloud.adm.certs || {})[uid] || {}).items || []};
    const records = Object.keys(changes)
      .map(key => AttReport.entry(person, key.split('|')[0], Number(key.split('|')[1])))
      .filter(Boolean)
      .map(GoogleSync.record);
    GoogleSync.enqueue(records);
  },

  /**
   * Отправляет в Google пары, которые только что внесены из журнала.
   * @param {Array<string>} keys Пары вида «дата|номер».
   */
  async autoKeys(keys) {
    if (!GoogleSync.config().auto) return;
    await AttReport.load(true);
    const set = {};
    keys.forEach(k => {
      set[k] = true;
    });
    const records = [];
    AttReport.people().forEach(person => {
      keys.forEach(key => {
        const it = AttReport.entry(person, key.split('|')[0], Number(key.split('|')[1]));
        if (it && it.st) records.push(GoogleSync.record(it));
      });
    });
    GoogleSync.enqueue(records);
  },

  /**
   * Строит карточку для экрана настроек админа.
   * @returns {string} HTML.
   */
  card() {
    const cfg = GoogleSync.config(),
      on = GoogleSync.isUrl(cfg.url);
    return (
      '<section class="card set-sec"><h2>Синхронизация с Google Таблицей</h2><div class="set-row"><div><b>Отправка посещаемости в таблицу</b><p>' +
      (on ? 'Подключено' + (cfg.auto ? ', отметки уходят сами' : '') : 'Не настроено') +
      (cfg.last ? '. Последняя отправка: ' + U.esc(fmtAgo(cfg.last.at)) : '') +
      '</p></div><button class="btn" data-action="gs-open">Настроить синхронизацию с Google</button></div></section>'
    );
  },

  /**
   * Открывает окно настройки и отправки.
   */
  open() {
    const cfg = GoogleSync.config(),
      pickedYm = cfg.ym || U.iso(U.today()).slice(0, 7),
      f = (label, html) => '<label class="field"><span>' + label + '</span>' + html + '</label>';
    UI.open(
      'Синхронизация с Google Таблицей',
      '<div class="gs">' +
        '<p class="md-help">Отметки из Политешика отправляются в вашу Google Таблицу (только в одну сторону). Сначала установите скрипт по инструкции, затем вставьте сюда его ссылку.</p>' +
        f('Ссылка на скрипт (Web App URL)', '<input class="input" id="gs-url" placeholder="https://script.google.com/macros/s/…/exec" value="' + U.esc(cfg.url) + '" autocomplete="off">') +
        f('Ключ (тот же, что в скрипте)', '<input class="input" id="gs-token" type="password" value="' + U.esc(cfg.token) + '" autocomplete="off">') +
        '<label class="check-row"><input type="checkbox" id="gs-auto"' +
        (cfg.auto ? ' checked' : '') +
        '> Отправлять автоматически, когда староста ставит отметку или вносит пары из журнала</label>' +
        '<div class="head-actions" style="margin:8px 0 14px"><button class="btn primary" data-action="gs-save">Сохранить</button><button class="btn" data-action="gs-test">Проверить связь</button></div>' +
        f('Выберите месяц', '<select class="input" id="gs-month">' + GoogleSync.monthList().map(m => '<option value="' + m.ym + '"' + (m.ym === pickedYm ? ' selected' : '') + '>' + U.esc(m.label) + '</option>').join('') + '</select>') +
        f('Выберите группу', '<input class="input" id="gs-group" list="gs-groups" value="' + U.esc(cfg.group || GROUP_NAME) + '" placeholder="25290909/3091" autocomplete="off"><datalist id="gs-groups">' + (cfg.groups || [GROUP_NAME]).map(x => '<option value="' + U.esc(x) + '"></option>').join('') + '</datalist>') +
        '<p class="md-help">В таблицу уйдут отметки только за выбранный месяц, в лист с его названием (если листа нет, он создастся сам). Номер группы передаётся в скрипт; данные берутся из вашей группы.</p>' +
        '<div class="head-actions" style="margin-bottom:6px"><button class="btn" data-action="gs-dry">Проверить без записи</button><button class="btn" data-action="gs-xls">' + ICONS.arrowDown + ' Скачать в Excel (таблица)</button></div>' +
        '<button class="btn primary big" data-action="gs-send">Отправить в Google</button>' +
        '<div id="gs-status" class="md-help" style="margin-top:10px"></div></div>',
      {noFocus: true}
    );
  },

  /**
   * Показывает сообщение в окне синхронизации.
   * @param {string} html Текст.
   * @param {boolean} bad Ошибка.
   */
  say(html, bad) {
    const box = document.getElementById('gs-status');
    if (box) box.innerHTML = '<span class="' + (bad ? 'qa-bad' : '') + '">' + html + '</span>';
  },

  /**
   * Возвращает список сохранённых групп с добавленной новой (если номер верный).
   * @param {string} g Номер группы.
   * @returns {Array<string>} Список.
   */
  groupsWith(g) {
    const list = (GoogleSync.config().groups || [GROUP_NAME]).slice();
    if (GoogleSync.isGroup(g) && list.indexOf(g) < 0) list.push(g);
    return list.slice(-20);
  },

  /**
   * Читает поля окна и сохраняет настройки.
   * @returns {Object} Сохранённые настройки.
   */
  readForm() {
    const val = id => (document.getElementById(id) || {}).value || '';
    return GoogleSync.save({
      url: val('gs-url').trim(),
      token: val('gs-token').trim(),
      auto: !!(document.getElementById('gs-auto') || {}).checked,
      ym: val('gs-month') || GoogleSync.config().ym,
      group: val('gs-group').trim() || GoogleSync.config().group,
      groups: GoogleSync.groupsWith(val('gs-group').trim())
    });
  }
};
