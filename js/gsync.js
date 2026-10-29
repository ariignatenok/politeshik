'use strict';

/**
 * Буквы статусов, которые уходят в Google Таблицу.
 * @type {Object<string,string>}
 */
const GS_LETTER = {п: 'П', о: 'О', н: 'Н', у: 'У'};

const GoogleSync = {
  KEY: 'politeshik:gsync',
  timer: null,
  queue: [],

  /**
   * Возвращает сохранённые настройки синхронизации (хранятся только на этом устройстве).
   * @returns {Object} url, token, auto, last.
   */
  config() {
    const base = {url: '', token: '', auto: false, last: null};
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
    return {
      date: it.date,
      pair: it.pair,
      slot: QuickAtt.pairsOfDay(it.date).indexOf(it.pair) + 1,
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
   * @returns {Promise<Object>} ok, written, skipped, opaque.
   */
  async send(records, progress) {
    const cfg = GoogleSync.config();
    if (!GoogleSync.isUrl(cfg.url)) return {ok: false, error: 'Ссылка на скрипт не указана'};
    const out = {ok: true, written: 0, skipped: [], opaque: false, total: records.length};
    for (let i = 0; i < records.length; i += 120) {
      const part = records.slice(i, i + 120),
        res = await GoogleSync.post(cfg, {records: part});
      if (!res.ok) return Object.assign(out, {ok: false, error: res.error});
      if (res.opaque) out.opaque = true;
      out.written += (res.data && res.data.written) || 0;
      out.skipped = out.skipped.concat((res.data && res.data.skipped) || []);
      if (progress) progress(Math.min(records.length, i + 120), records.length);
    }
    GoogleSync.save({last: {at: new Date().toISOString(), total: out.total, written: out.written, skipped: out.skipped.length, opaque: out.opaque}});
    return out;
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
      const batch = GoogleSync.queue.splice(0);
      const res = await GoogleSync.send(batch);
      if (!res.ok) toast('Google: не удалось отправить отметки. Нажмите «Отправить в Google» позже');
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
        f('Что отправить', '<select class="input" id="gs-scope"><option value="all">Весь период с 01.10.2026</option><option value="month">Месяц, открытый в журнале</option></select>') +
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
   * Читает поля окна и сохраняет настройки.
   * @returns {Object} Сохранённые настройки.
   */
  readForm() {
    const val = id => (document.getElementById(id) || {}).value || '';
    return GoogleSync.save({
      url: val('gs-url').trim(),
      token: val('gs-token').trim(),
      auto: !!(document.getElementById('gs-auto') || {}).checked
    });
  }
};
