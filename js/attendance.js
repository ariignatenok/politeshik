'use strict';

const Att = {
  /**
   * Проверяет, относится ли пара к подгруппе студента.
   * @param {Object} l Пара расписания.
   * @param {string} sub Подгруппа студента.
   * @returns {boolean} true, если условие выполнено.
   */
  subOk(l, sub) {
    const match = /подгр\.?\s*(\d)/i.exec(l.subgroup || '');
    return !match || !sub || match[1] === String(sub);
  },
  /**
   * Оставляет пары, которые видит текущий пользователь: студент — только своей подгруппы, староста и преподаватели — все.
   * @param {Array<Object>} list Пары расписания.
   * @returns {Array<Object>} Отфильтрованные пары.
   */
  mine(list) {
    if (Cloud.isAdmin || Cloud.isStaff) return list;
    return list.filter((l) => Att.subOk(l, Store.s.settings.subgroup));
  },
  /**
   * Строит пары дня с учётом отмен и замен.
   * @param {string} date Дата.
   * @param {string} sub Подгруппа.
   * @returns {Array<Object>} пары со статусом ok, cancel или replace.
   */
  dayView(date, sub) {
    const d = U.fromISO(date),
      ls = Weeks.on(date).filter((l) => Att.subOk(l, sub)),
      by = new Map();
    ls.forEach((l) => {
      if (!by.has(l.pair)) by.set(l.pair, []);
      by.get(l.pair).push(l);
    });
    const out = [...by].map((e) => ({
      pair: e[0],
      lessons: e[1],
      state: 'ok',
      change: null,
      orig: null,
    }));
    if (ScheduleSync.day(date)) {
      out.forEach((pr) => {
        const active = pr.lessons.filter((l) => l.sourceStatus !== 'cancellation');
        if (!active.length) pr.state = 'cancel';
        else {
          pr.orig = pr.lessons.filter((l) => l.sourceStatus === 'cancellation');
          pr.lessons = active;
          if (active.some((l) => l.sourceStatus === 'replacement')) pr.state = 'replace';
        }
        if (pr.state !== 'ok')
          pr.change = {
            reason: pr.lessons
              .map((l) => l.sourceNote)
              .filter(Boolean)
              .join(' · '),
          };
      });
    }
    Changes.items()
      .filter((c) => c.date === date)
      .forEach((c) => {
        const pr = out.find((x) => x.pair === c.pair);
        if (c.type === 'cancel') {
          if (pr) {
            pr.state = 'cancel';
            pr.change = c;
          }
          return;
        }
        const rl = {
          id: 'chg_' + c.id,
          day: U.dayIdx(d),
          pair: c.pair,
          week: 'both',
          subjectId: c.newSubjectId || (pr && pr.lessons[0].subjectId) || '',
          room: c.newRoom || '',
          subgroup: '',
          who: c.newTeacher || '',
          start: '',
          end: '',
        };
        if (pr) {
          pr.state = 'replace';
          pr.change = c;
          pr.orig = pr.lessons;
          pr.lessons = [rl];
        } else
          out.push({
            pair: c.pair,
            lessons: [rl],
            state: 'replace',
            change: c,
            orig: [],
          });
      });
    return out.sort((a, b) => a.pair - b.pair);
  },
  /**
   * Возвращает пары дня, на которых нужна отметка (без отменённых).
   * @param {string} date Дата.
   * @param {string} sub Подгруппа.
   * @returns {Array<Object>} Массив.
   */
  pairs(date, sub) {
    return Att.dayView(date, sub).filter((p) => p.state !== 'cancel');
  },
  /**
   * Проверяет, закрыт ли день справкой.
   * @param {Array<Object>} certs Справки.
   * @param {string} date Дата.
   * @returns {boolean} true, если условие выполнено.
   */
  covered: (certs, date) =>
    (certs || []).some(
      (c) => c.confirmed === true && c.from <= date && date <= c.to && !(c.pairs && c.pairs.length),
    ),
  /**
   * Проверяет, покрыта ли справкой или запиской конкретная пара.
   * @param {Array<Object>} certs Справки.
   * @param {string} date День ГГГГ-ММ-ДД.
   * @param {number} pair Номер пары.
   * @returns {boolean} true, если условие выполнено.
   */
  coveredPair: (certs, date, pair) =>
    (certs || []).some(
      (c) =>
        c.confirmed === true &&
        c.from <= date &&
        date <= c.to &&
        (!(c.pairs && c.pairs.length) || c.pairs.indexOf(pair) >= 0),
    ),
  /**
   * Вычисляет итоговый статус пары с учётом справки.
   * @param {Object} marks Отметки.
   * @param {Array<Object>} certs Справки.
   * @param {string} date Дата.
   * @param {number} pair Номер пары.
   * @returns {string} п, о, н, у или пустая строка.
   */
  eff(marks, certs, date, pair) {
    const m = marks[date + '|' + pair],
      cov = Att.coveredPair(certs, date, pair);
    if ((m === 'н' || !m) && cov) return 'уп';
    return m === 'у' ? 'уп' : m || '';
  },
  /**
   * Считает процент посещаемости.
   * @param {number} a Число посещённых пар.
   * @param {number} b Всего пар.
   * @returns {number|null} процент или null без данных.
   */
  pct: (a, b) => (b > 0 ? Math.round((a * 100) / b) : null),
  /**
   * Считает часы пропусков без уважительной причины за один календарный месяц.
   * Лимит выбранной группы действует в пределах месяца: 1-го числа счёт начинается заново.
   * @param {Object<string,string>} marks Отметки вида {"дата|пара": статус}.
   * @param {Array<Object>} certs Справки студента.
   * @param {string} sub Подгруппа.
   * @param {string} [ym] Месяц ГГГГ-ММ; по умолчанию текущий.
   * @returns {number} часы.
   */
  absHours: (marks, certs, sub, ym) => {
    const m = ym || U.iso(U.today()).slice(0, 7),
      from = m + '-01' < ATT_START ? ATT_START : m + '-01';
    return Att.stats(marks, certs, sub, from, monthEnd(m)).a * PAIR_HOURS;
  },
  /**
   * Возвращает месяц, за который показывается лимит: выбранный на экранах «Посещаемость» и «Журнал» или текущий.
   * @returns {string} Месяц ГГГГ-ММ.
   */
  limitMonth: () =>
    ui.attScope !== 'all' && ui.attMonth ? ui.attMonth : U.iso(U.today()).slice(0, 7),
  /**
   * Определяет зону лимита пропусков.
   * @param {number} h Часы пропусков.
   * @returns {Object} часы, остаток и зона: ok, warn или red.
   */
  zone(h) {
    const left = Math.max(0, ABS_LIMIT - h);
    return {
      h,
      left,
      cls: h >= ABS_LIMIT ? 'red' : left <= ABS_WARN_LEFT ? 'warn' : 'ok',
    };
  },
  /**
   * Считает статистику посещаемости за период.
   * @param {Object<string,string>} marks Отметки вида {"дата|пара": статус}.
   * @param {Array<Object>} certs Справки студента.
   * @param {string} sub Подгруппа студента: "1", "2" или пустая строка.
   * @param {string} from Начало периода, ГГГГ-ММ-ДД.
   * @param {string} to Конец периода, ГГГГ-ММ-ДД.
   * @returns {Object} счётчики и процент.
   */
  stats(marks, certs, sub, from, to) {
    const today = U.iso(U.today()),
      r = {
        total: 0,
        p: 0,
        l: 0,
        a: 0,
        x: 0,
        u: 0,
        bySubj: {},
        byDay: {},
      };
    const start = from < ATT_START ? ATT_START : from,
      end = to > today ? today : to;
    if (start > end) {
      r.pct = null;
      return r;
    }
    for (let d = U.fromISO(start), e = U.fromISO(end); d <= e; d = U.addDays(d, 1)) {
      const di = U.iso(d);
      Att.pairs(di, sub).forEach((pr) => {
        const st = Att.eff(marks, certs, di, pr.pair),
          sid = pr.lessons[0].subjectId;
        const b =
          r.bySubj[sid] ||
          (r.bySubj[sid] = {
            p: 0,
            l: 0,
            a: 0,
            x: 0,
            u: 0,
            total: 0,
          });
        r.total++;
        b.total++;
        if (st === 'п') {
          r.p++;
          b.p++;
        } else if (st === 'о') {
          r.l++;
          b.l++;
        } else if (st === 'н') {
          r.a++;
          b.a++;
        } else if (st === 'у' || st === 'уп') {
          r.x++;
          b.x++;
        } else if (di < today) {
          r.u++;
          b.u++;
        }
        (r.byDay[di] = r.byDay[di] || []).push(st);
      });
    }
    r.pct = Att.pct(r.p + r.l, r.p + r.l + r.a);
    Object.keys(r.bySubj).forEach((k) => {
      const b = r.bySubj[k];
      b.pct = Att.pct(b.p + b.l, b.p + b.l + b.a);
    });
    return r;
  },
  /**
   * Ставит или снимает отметку посещаемости по правилам студента или админа.
   * @param {string} uid Идентификатор студента или null для своей отметки.
   * @param {string} date Дата в формате ГГГГ-ММ-ДД.
   * @param {number} pair Номер пары.
   * @param {string} st Статус: п, о или н.
   */
  dayChanges(date, subgroup, marks, certs, status) {
    if (!['п', 'н'].includes(status)) return {};
    const changes = {};
    Att.pairs(date, subgroup).forEach((p) => {
      const key = date + '|' + p.pair;
      if (['у', 'уп'].includes(marks[key]) || Att.coveredPair(certs, date, p.pair)) return;
      changes[key] = status;
    });
    return changes;
  },
  canSelf(date, pair, now = Date.now()) {
    if(Cloud.isSuperAdmin && Cloud.tenantId!==Cloud.homeTenant)return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || pair < 1 || pair > 5) return false;
    const slot = (Store.s.settings.pairs || [])[pair - 1] || {},
      starts = ['09:00', '10:45', '12:50', '14:30', '16:10'],
      ends = ['10:30', '12:40', '14:20', '16:00', '17:40'];
    const start = Date.parse(date + 'T' + (slot.start || starts[pair - 1]) + ':00+03:00'),
      end = Date.parse(date + 'T' + (slot.end || ends[pair - 1]) + ':00+03:00');
    return now >= start && now <= end + 86400000;
  },
  async set(uid, date, pair, st) {
    if (st === 'у') st = 'уп';
    if (st === 'уп' && !Cloud.isAdmin)
      return toast('УП отмечают только староста и Админ Арина либо подтверждённая справка');
    const key = date + '|' + pair;
    if (!uid && Cloud.status === 'online') {
      if (!Att.canSelf(date, pair))
        return toast('Отметиться можно на паре и 24 часа после её окончания');
      if (Store.s.attendance.marks[key])
        return toast('Отметку уже поставили — исправить её может староста');
      if (Att.saving) return;
      Att.saving = true;
      try {
        const {data, error} = await supa.rpc('self_attendance', {
          p_date: date,
          p_pair: pair,
          p_status: st,
        });
        if (error) throw error;
        Store.s.attendance.marks = data.marks || {};
        Store.s.meta.pendingAtt = false;
        Store.save();
        App.render();
      } catch (error) {
        toast(error.message);
      } finally {
        Att.saving = false;
      }
      return;
    }
    if (!uid || uid === Cloud.uid || Cloud.status !== 'online') {
      const m = Store.s.attendance.marks;
      if (m[key] === st) delete m[key];
      else m[key] = st;
      Store.save();
      if (Cloud.status === 'online') Cloud.setMarkFor(Cloud.uid, key, st);
    } else Cloud.setMarkFor(uid, key, st);
    App.render();
  },
};
