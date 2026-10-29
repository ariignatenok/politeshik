'use strict';

/**
 * Названия статусов посещаемости для CSV.
 * @type {Object<string,string>}
 */
const REPORT_WORDS = {
  п: 'Присутствовал',
  о: 'Опоздал',
  н: 'Не был',
  у: 'Справка'
};

/**
 * Определяет вид справки, которой закрыта пара.
 * @param {Array<Object>} certs Справки студента.
 * @param {string} date Дата.
 * @param {number} pair Номер пары.
 * @returns {string} Вид справки или пустая строка.
 */
function certKindFor(certs, date, pair) {
  const c = (certs || []).find(
    x =>
      x.confirmed === true &&
      x.from <= date &&
      date <= x.to &&
      (!x.pairs || !x.pairs.length || x.pairs.indexOf(pair) >= 0)
  );
  return c ? c.kind || 'Справка' : '';
}

const AttReport = {
  imports: [],
  loadedAt: 0,
  loading: null,

  /**
   * Загружает отметки, внесённые из журнала, в том числе студентам без аккаунта.
   * @param {boolean} force Загрузить заново, даже если данные свежие.
   * @returns {Promise<boolean>} true, если получилось.
   */
  async load(force) {
    if (!force && AttReport.loadedAt && Date.now() - AttReport.loadedAt < 30000) return true;
    if (AttReport.loading) return AttReport.loading;
    AttReport.loading = (async () => {
      const res = await QuickAtt.rpc('import_attendance_rows');
      if (res.ok) AttReport.imports = res.data || [];
      AttReport.loadedAt = Date.now();
      AttReport.loading = null;
      return res.ok;
    })();
    return AttReport.loading;
  },

  /**
   * Запускает загрузку данных, если они устарели, и перерисовывает экран по готовности.
   */
  ensure() {
    if (AttReport.loading || (AttReport.loadedAt && Date.now() - AttReport.loadedAt < 60000)) return;
    AttReport.load().then(() => App.renderSoft());
  },

  /**
   * Собирает отметки всей группы: у зарегистрированных берутся их данные, у остальных — внесённое из журнала.
   * @returns {Array<Object>} Студенты по порядку журнала: r, marks, certs.
   */
  people() {
    const out = {},
      withAccount = {};
    ROSTER.forEach(r => {
      if (!r.flag) out[r.id] = {r, marks: {}, certs: []};
    });
    studentRows().forEach(s => {
      const e = s.r && out[s.r.id];
      if (!e) return;
      withAccount[s.r.id] = true;
      e.marks = Object.assign({}, s.marks);
      e.certs = s.certs || [];
    });
    (AttReport.imports || []).forEach(x => {
      const e = out[x.rid];
      if (e && !withAccount[x.rid]) e.marks[x.key] = x.mark;
    });
    return Object.keys(out)
      .map(id => out[id])
      .sort((a, b) => a.r.n - b.r.n);
  },

  /**
   * Возвращает ФИО в виде «Фамилия Имя».
   * @param {Object} r Студент из списка группы.
   * @returns {string} Строка.
   */
  pretty(r) {
    const parts = r.name.split(' ');
    parts[0] = parts[0].charAt(0) + parts[0].slice(1).toLowerCase();
    return parts.join(' ');
  },

  /**
   * Возвращает запись об одной паре студента.
   * @param {Object} person Студент: r, marks, certs.
   * @param {string} date Дата.
   * @param {number} pair Номер пары.
   * @returns {Object|null} Запись или null, если такой пары у студента нет.
   */
  entry(person, date, pair) {
    const pr = Att.pairs(date, person.r.sub).find(x => x.pair === pair);
    if (!pr) return null;
    const st = Att.eff(person.marks, person.certs, date, pair),
      sb = subj(pr.lessons[0].subjectId);
    return {
      person,
      r: person.r,
      date,
      pair,
      st,
      subject: sb ? sb.short || sb.name : '',
      subjectFull: sb ? sb.name : '',
      teacher: pr.lessons[0].who || '',
      kind: st === 'у' ? certKindFor(person.certs, date, pair) : ''
    };
  },

  /**
   * Перечисляет все отмеченные пары группы за период.
   * @param {string} from Начало периода.
   * @param {string} to Конец периода.
   * @returns {Array<Object>} Записи по студентам, датам и парам.
   */
  items(from, to) {
    const today = U.iso(U.today()),
      start = from < ATT_START ? ATT_START : from,
      end = to > today ? today : to,
      out = [];
    if (start > end) return out;
    AttReport.people().forEach(person => {
      for (let d = U.fromISO(start), e = U.fromISO(end); d <= e; d = U.addDays(d, 1)) {
        const di = U.iso(d);
        Att.pairs(di, person.r.sub).forEach(pr => {
          const it = AttReport.entry(person, di, pr.pair);
          if (it && it.st) out.push(it);
        });
      }
    });
    return out;
  },

  /**
   * Считает сводку по группе за период.
   * @param {string} from Начало периода.
   * @param {string} to Конец периода.
   * @returns {Object} rows (по студентам) и totals (по группе).
   */
  summary(from, to) {
    const totals = {p: 0, l: 0, a: 0, x: 0, u: 0, total: 0},
      rows = AttReport.people().map(person => {
        const st = Att.stats(person.marks, person.certs, person.r.sub, from, to);
        ['p', 'l', 'a', 'x', 'u', 'total'].forEach(k => {
          totals[k] += st[k];
        });
        return {r: person.r, st};
      });
    totals.pct = Att.pct(totals.p + totals.l, totals.p + totals.l + totals.a);
    return {rows, totals};
  },

  /**
   * Собирает CSV-файл журнала: ФИО, Дата, Пара, Предмет, Статус.
   * @param {Array<Object>} items Записи из items().
   * @returns {string} Текст файла с BOM в начале, чтобы Excel не ломал русские буквы.
   */
  csv(items) {
    const q = v => '"' + String(v).replace(/"/g, '""') + '"',
      rows = [['ФИО', 'Дата', 'Пара', 'Предмет', 'Статус']].concat(
        items
          .slice()
          .sort((a, b) => a.r.n - b.r.n || a.date.localeCompare(b.date) || a.pair - b.pair)
          .map(it => [
            AttReport.pretty(it.r),
            it.date.split('-').reverse().join('.'),
            it.pair,
            it.subjectFull || it.subject,
            REPORT_WORDS[it.st] || it.st
          ])
      );
    return '\uFEFF' + rows.map(r => r.map(q).join(';')).join('\r\n') + '\r\n';
  },

  /**
   * Рисует круговую диаграмму общей посещаемости группы.
   * @param {Object} t Итоги: p, l, a, x.
   * @returns {string} HTML.
   */
  pie(t) {
    const parts = [
        {k: 'p', label: 'Присутствовал (П)', v: t.p, c: 'var(--ok, #22c55e)'},
        {k: 'l', label: 'Опоздал (О)', v: t.l, c: 'var(--warn, #f59e0b)'},
        {k: 'a', label: 'Не был (Н)', v: t.a, c: 'var(--bad, #ef4444)'},
        {k: 'x', label: 'Справки', v: t.x, c: 'var(--info, #38bdf8)'}
      ],
      sum = parts.reduce((s, x) => s + x.v, 0),
      R = 70,
      C = 2 * Math.PI * R;
    if (!sum) return '<div class="empty">За этот период отметок пока нет</div>';
    let acc = 0;
    const rings = parts
      .filter(x => x.v)
      .map(x => {
        const len = (x.v / sum) * C,
          ring =
            '<circle cx="90" cy="90" r="' +
            R +
            '" fill="none" stroke="' +
            x.c +
            '" stroke-width="30" stroke-dasharray="' +
            len.toFixed(2) +
            ' ' +
            (C - len).toFixed(2) +
            '" stroke-dashoffset="' +
            (-acc).toFixed(2) +
            '"><title>' +
            x.label +
            ': ' +
            x.v +
            '</title></circle>';
        acc += len;
        return ring;
      })
      .join('');
    const pct = Att.pct(t.p + t.l, t.p + t.l + t.a);
    return (
      '<div class="pie-wrap"><svg class="pie" viewBox="0 0 180 180" role="img" aria-label="Общая посещаемость группы"><g transform="rotate(-90 90 90)">' +
      rings +
      '</g><text x="90" y="88" text-anchor="middle" class="pie-n">' +
      (pct == null ? '—' : pct + '%') +
      '</text><text x="90" y="106" text-anchor="middle" class="pie-s">посещаемость</text></svg><ul class="pie-legend">' +
      parts
        .map(
          x =>
            '<li><i style="background:' +
            x.c +
            '"></i>' +
            x.label +
            ' <b>' +
            x.v +
            '</b> <small>' +
            Math.round((x.v * 100) / sum) +
            '%</small></li>'
        )
        .join('') +
      '</ul></div>'
    );
  },

  /**
   * Рисует столбчатую диаграмму по студентам: сколько посетил и пропустил.
   * @param {Array<Object>} rows Строки сводки.
   * @returns {string} HTML.
   */
  bars(rows) {
    const max = Math.max(1, ...rows.map(x => x.st.p + x.st.l + x.st.a + x.st.x));
    return (
      '<div class="sbars">' +
      rows
        .map(x => {
          const s = x.st,
            seg = (v, cls, label) =>
              v ? '<i class="' + cls + '" style="width:' + ((v * 100) / max).toFixed(2) + '%" title="' + label + ': ' + v + '"></i>' : '';
          return (
            '<div class="sr"><span class="sn"><b>' +
            x.r.n +
            '</b> ' +
            U.esc(AttReport.pretty(x.r)) +
            '</span><div class="sbar">' +
            seg(s.p, 'ok', 'Присутствовал') +
            seg(s.l, 'late', 'Опоздал') +
            seg(s.x, 'exc', 'Справка') +
            seg(s.a, 'no', 'Не был') +
            '</div><span class="sv">' +
            (s.p + s.l) +
            ' / ' +
            s.a +
            (s.x ? ' · спр. ' + s.x : '') +
            '</span></div>'
          );
        })
        .join('') +
      '</div>'
    );
  },

  /**
   * Строит экран «Статистика».
   * @returns {string} HTML.
   */
  view() {
    AttReport.ensure();
    const rg = attRange(),
      sm = AttReport.summary(rg[0], rg[1]),
      t = sm.totals,
      marked = t.p + t.l + t.a + t.x;
    return (
      '<div class="page-head"><div><h1>' +
      ICONS.barChart +
      ' Статистика</h1><p>Посещаемость всей группы: графики по отметкам из журнала и приложения</p></div><div class="head-actions"><button class="btn" data-action="grp-csv">' +
      ICONS.arrowDown +
      ' Скачать журнал</button></div></div>' +
      periodControls() +
      '<div class="grid-stats att-stats"><div class="stat"><b>' +
      (t.pct == null ? '—' : t.pct + '%') +
      '</b><small>средняя посещаемость</small></div><div class="stat"><b>' +
      marked +
      '</b><small>отмеченных пар</small></div><div class="stat"><b>' +
      t.a +
      '</b><small>пропусков (Н)</small></div><div class="stat"><b>' +
      t.x +
      '</b><small>по справкам</small></div></div>' +
      '<div class="stats-cols"><section class="card"><h2>Общая посещаемость</h2>' +
      AttReport.pie(t) +
      '</section><section class="card"><h2>По студентам</h2><p class="md-help">Зелёное — был, жёлтое — опоздал, голубое — справка, красное — не был. Справа: был / не был.</p>' +
      AttReport.bars(sm.rows) +
      '</section></div>'
    );
  }
};

/**
 * Отрисовывает экран «Статистика».
 * @returns {string} HTML.
 */
function viewStats() {
  return AttReport.view();
}
