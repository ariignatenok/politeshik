'use strict';

const RATING_W = {
  att: 0.8,
  cards: 0.2
};
const Rating = {
  /**
   * Описывает период рейтинга: только текущий календарный месяц (1-го числа таблица начинается с нуля).
   * @returns {Object} Объект с ключом month.
   */
  periods() {
    const ym = U.iso(U.today()).slice(0, 7);
    return {
      month: {
        key: 'month:' + ym,
        label: monthName(ym),
        from: ym + '-01',
        to: monthEnd(ym)
      }
    };
  },
  /**
   * Считает баллы студентов за период (только админ).
   * @param {Object} p Период рейтинга.
   * @returns {Array<Object>} Массив.
   */
  rows(p) {
    const today = U.iso(U.today()),
      end = p.to > today ? today : p.to,
      out = [];
    Roles.people().forEach(x => {
      const uid = x.id,
        pr = x.profile,
        r = ROSTER_BY_ID[pr.rid];
      if (!r || r.flag || r.admin) return;
      const st = Att.stats(x.marks, x.certs, pr.subgroup, p.from, end),
        att = st.pct == null ? 0 : st.pct;
      const stt = pr.stats || {},
        cards = stt.month === p.from.slice(0, 7) ? Math.min(100, stt.cardsMonth || 0) : 0;
      const score = Math.round((RATING_W.att * att + RATING_W.cards * cards) * 10) / 10;
      out.push({
        uid,
        rid: pr.rid,
        name: r.name,
        avatar: pr.avatar || '',
        score,
        att,
        cards,
        suspicious: att === 100 && st.l === 0 && st.total >= 10
      });
    });
    out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ru'));
    out.forEach((x, i) => {
      const previous = out[i - 1];
      x.place = previous ? previous.place + (x.score === previous.score ? 0 : 1) : 1;
    });
    return out;
  },
  /**
   * Пересчитывает рейтинг и подводит итоги закончившихся периодов.
   * @param {boolean} force Выполнить принудительно.
   * @returns {boolean} пересчитан ли.
   */
  compute(force) {
    if (!Cloud.isAdmin || !Cloud.admReady || Cloud.status !== 'online') return false;
    const old = Cloud.ratings || {},
      now = new Date(),
      per = Rating.periods(),
      rolled = !(old.periods && old.periods.month && old.periods.month.key === per.month.key);
    if (!force && !rolled && old.updated && now - new Date(old.updated) < 36e5) return false;
    const doc = {
        updated: now.toISOString(),
        periods: {},
        prizes: Object.assign({}, old.prizes || {}),
        results: Object.assign({}, old.results || {})
      };
    Object.keys(per).forEach(k => {
      doc.periods[k] = {
        key: per[k].key,
        label: per[k].label,
        rows: Rating.rows(per[k]).map(x => ({
          uid: x.uid,
          rid: x.rid,
          name: x.name,
          avatar: x.avatar,
          score: x.score,
          place: x.place
        }))
      };
    });
    const today = U.iso(U.today());
    Object.keys(doc.prizes).forEach(key => {
      if (doc.results[key]) return;
      let p = null;
      if (key.indexOf('month:') === 0) {
        const ym = key.slice(6);
        p = {
          from: ym + '-01',
          to: monthEnd(ym)
        };
      } else if (key.indexOf('sem:') === 0) {
        const match = /sem:(\d+)-(\d)/.exec(key);
        if (match)
          p =
            match[2] === '1'
              ? {
                  from: match[1] + '-09-01',
                  to: match[1] + '-12-31'
                }
              : {
                  from: match[1] + '-01-01',
                  to: match[1] + '-06-30'
                };
      }
      if (p && p.to < today) {
        const winners = Rating.rows(p).filter(x => x.place === 1);
        if (winners.length)
          doc.results[key] = {
            rid: winners.length === 1 ? winners[0].rid : null,
            winners: winners.map(x => ({uid:x.uid,rid:x.rid,name:x.name})),
            name: winners.map(x => x.name).join(', '),
            prize: doc.prizes[key].text,
            at: now.toISOString(),
            label: key
          };
      }
    });
    Cloud.ratings = doc;
    Cloud.saveRatings(doc);
    return true;
  },
  /**
   * Назначает или убирает приз за 1 место.
   * @param {string} key Ключ периода.
   * @param {string} text Описание приза.
   */
  setPrize(key, text) {
    const old = Cloud.ratings || {
      periods: {},
      prizes: {},
      results: {}
    };
    const doc = Object.assign({}, old, {
      prizes: Object.assign({}, old.prizes || {}),
      results: old.results || {}
    });
    if (text)
      doc.prizes[key] = {
        text,
        at: new Date().toISOString()
      };
    else delete doc.prizes[key];
    Cloud.ratings = doc;
    Cloud.saveRatings(doc);
    Rating.compute(true);
  },
  /**
   * Возвращает победы текущего студента.
   * @returns {Array<Object>} Массив.
   */
  mine() {
    const R = Cloud.ratings,
      rid = Cloud.profile && Cloud.profile.rid;
    if (!R || !rid) return [];
    return Object.keys(R.results || {})
      .filter(k => R.results[k].rid === rid)
      .map(k =>
        Object.assign(
          {
            key: k
          },
          R.results[k]
        )
      );
  }
};
