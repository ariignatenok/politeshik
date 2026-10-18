'use strict';

const NOTIF_DEFAULT = {
  pairs: true,
  works: true,
  changes: true,
  chat: true,
  ach: true,
  digest: true,
  quiet: true,
  lead: 15,
  mute: {}
};
const NOTIF_TYPES = [
  ['pairs', ICONS.bell + ' Пары — за несколько минут до начала'],
  ['works', ICONS.memo + ' Работы и ДЗ — за 24 ч и за 2 ч'],
  ['changes', ICONS.crossMark + ' Отмены и замены пар — сразу'],
  ['chat', ICONS.speech + ' Сообщения в чатах'],
  ['ach', ICONS.trophy + ' Достижения'],
  ['digest', ICONS.calendarDay + ' Дайджест недели (воскресенье, 19:00)']
];
const Notifier = {
  /**
   * Возвращает настройки уведомлений.
   * @returns {Object} Объект.
   */
  cfg() {
    return Object.assign({}, NOTIF_DEFAULT, Store.s.settings.notif || {});
  },
  /**
   * Проверяет, поддерживает ли браузер уведомления.
   * @returns {boolean} true, если условие выполнено.
   */
  supported: () => typeof Notification !== 'undefined',
  /**
   * Возвращает разрешение на уведомления.
   * @returns {string} Строка.
   */
  perm: () => (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'),
  /**
   * Запрашивает разрешение на уведомления.
   * @returns {Promise<string>} результат.
   */
  async ask() {
    Store.s.settings.notifAsked = true;
    Store.save();
    if (!Notifier.supported()) return 'unsupported';
    try {
      return await Notification.requestPermission();
    } catch (error) {
      return 'denied';
    }
  },
  /**
   * Проверяет, идут ли тихие часы (23:00-7:00).
   * @param {Date} d Момент времени (необязательно).
   * @returns {boolean} true, если условие выполнено.
   */
  quiet: d => {
    const h = (d || new Date()).getHours();
    return h >= 23 || h < 7;
  },
  /**
   * Показывает уведомление с учётом настроек и тихих часов.
   * @param {string} type Тип: pairs, works, changes, chat, ach или digest.
   * @param {string} title Заголовок.
   * @param {string} body Текст.
   * @param {Object} opts Параметры показа.
   * @returns {boolean} показано ли.
   */
  show(type, title, body, opts) {
    opts = opts || {};
    const c = Notifier.cfg();
    if (c[type] === false) return false;
    if (c.quiet && Notifier.quiet() && !opts.urgent) return false;
    let shown = false;
    if (Notifier.perm() === 'granted' && document.hidden) {
      try {
        if (navigator.serviceWorker && navigator.serviceWorker.controller && navigator.serviceWorker.ready)
          navigator.serviceWorker.ready.then(r =>
            r.showNotification(title, {
              body,
              tag: opts.tag || type,
              icon: 'assets/icon-192.png',
              badge: 'assets/icon-192.png'
            })
          );
        else
          new Notification(title, {
            body,
            tag: opts.tag || type
          });
        shown = true;
      } catch (error) {}
    }
    if (!shown) UI.toast(ICONS.bell + ' ' + title + (body ? ': ' + body : ''));
    Notifier.last = {
      type,
      title,
      body
    };
    (Notifier.log = Notifier.log || []).push(Notifier.last);
    return true;
  }
};
const Reminders = {
  lastTouch: 0,
  /**
   * Возвращает журнал отправленных напоминаний.
   * @returns {Object} Объект.
   */
  sent() {
    const m = Store.s.meta;
    m.sent = m.sent || {};
    return m.sent;
  },
  /**
   * Проверяет, не пора ли напомнить о паре, работе или итогах недели.
   */
  tick() {
    if (App.gateMode() || Cloud.isTeacher) return;
    const state = Store.s,
      c = Notifier.cfg(),
      now = new Date(),
      sent = Reminders.sent();
    let dirty = false;
    const today = U.iso(now);
    if (c.pairs) {
      Att.pairs(today, state.settings.subgroup).forEach(pr => {
        const p = state.settings.pairs[pr.pair - 1];
        if (!p || !p.start) return;
        const lesson = pr.lessons[0];
        if (c.mute[lesson.subjectId]) return;
        const hm = p.start.split(':').map(Number),
          st = new Date(now);
        st.setHours(hm[0], hm[1], 0, 0);
        const mins = Math.ceil((st - now) / 60000),
          key = today + '|' + pr.pair,
          sb = subj(lesson.subjectId);
        const text =
          'Через ' +
          Math.max(mins, 1) +
          ' мин — ' +
          (sb ? sb.short || sb.name : 'пара') +
          (lesson.room ? ', ауд. ' + lesson.room : '') +
          (lesson.who ? ', ' + lesson.who : '');
        if (mins <= c.lead && mins > 5 && !sent['p1|' + key]) {
          sent['p1|' + key] = now.getTime();
          dirty = true;
          Notifier.show('pairs', 'Скоро пара', text, {
            tag: 'pair' + key
          });
        } else if (mins <= 5 && mins > 0 && !sent['p2|' + key]) {
          const first = sent['p1|' + key];
          if (!first || Reminders.lastTouch < first) {
            sent['p2|' + key] = 1;
            if (!first) sent['p1|' + key] = now.getTime();
            dirty = true;
            Notifier.show('pairs', 'Пара через ' + mins + ' мин', text, {
              tag: 'pair2' + key
            });
          }
        }
      });
    }
    if (c.works) {
      dashItems()
        .filter(i => !i.done)
        .forEach(i => {
          const h = (dueDate(i.date, i.time) - now) / 36e5,
            k = i.kind + i.id + '@' + i.date;
          if (h <= 0) return;
          if (h <= 2 && !sent['w2|' + k]) {
            sent['w2|' + k] = 1;
            sent['w24|' + k] = 1;
            dirty = true;
            Notifier.show('works', 'Срок через 2 часа', '«' + i.title + '»', {
              tag: 'w2' + k
            });
          } else if (h <= 24 && !sent['w24|' + k]) {
            sent['w24|' + k] = 1;
            dirty = true;
            Notifier.show('works', 'Срок через 24 часа', '«' + i.title + '»', {
              tag: 'w24' + k
            });
          }
        });
    }
    if (c.digest && now.getDay() === 0 && now.getHours() === 19 && now.getMinutes() < 30) {
      const wk = 'dg|' + today;
      if (!sent[wk]) {
        sent[wk] = 1;
        dirty = true;
        const mon = U.iso(U.mondayOf(now)),
          st = Att.stats(state.attendance.marks, Cloud.my.certs, state.settings.subgroup, mon, today);
        const next = allWorks()
          .filter(w => !w.done)
          .sort(byDue)[0];
        Notifier.show(
          'digest',
          'Итоги недели',
          'Посещаемость ' +
            (st.pct == null ? '—' : st.pct + '%') +
            ' (п ' +
            st.p +
            ' · о ' +
            st.l +
            ' · н ' +
            st.a +
            ')' +
            (next ? '. Ближайшее: «' + next.title + '»' : ''),
          {
            tag: 'digest',
            urgent: false
          }
        );
      }
    }
    if (dirty) Store.save();
  }
};
const Notice = {
  /**
   * Сообщает студенту о новых отменах и заменах пар.
   */
  changes() {
    if (Cloud.isAdmin) return;
    const m = Store.s.meta;
    m.seenCh = m.seenCh || {};
    const first = !m.seenChInit;
    m.seenChInit = true;
    let dirty = first;
    Cloud.changes.forEach(c => {
      if (m.seenCh[c.id]) return;
      m.seenCh[c.id] = 1;
      dirty = true;
      if (first || c.date < U.iso(U.today())) return;
      const d = Changes.describe(c);
      Chat.push('bot', (c.type === 'cancel' ? ICONS.crossMark + ' ' : ICONS.repeat + ' ') + d.body, {
        mood: 'worried'
      });
      Chat.save();
      Notifier.show('changes', d.title, d.body, {
        urgent: c.date === U.iso(U.today()),
        tag: 'chg' + c.id
      });
    });
    if (dirty) Store.save();
  },
  /**
   * Сообщает победителю рейтинга о призе.
   */
  ratings() {
    const R = Cloud.ratings;
    if (!R || !Cloud.profile) return;
    const m = Store.s.meta;
    m.wonSeen = m.wonSeen || {};
    Rating.mine().forEach(r => {
      if (m.wonSeen[r.key]) return;
      m.wonSeen[r.key] = 1;
      Store.save();
      Chat.push('bot', ICONS.trophy + ' Ты занял 1 место! Приз: ' + r.prize + '. Обратись к админу.', {
        mood: 'cheer'
      });
      Chat.save();
      Notifier.show('ach', ICONS.trophy + ' Ты занял 1 место!', 'Приз: ' + r.prize + '. Обратись к админу.', {
        tag: 'won' + r.key
      });
      Mascot.celebrate('1 место! ' + ICONS.medalGold);
    });
    Ach.check();
  },
  /**
   * Сообщает админу о новых просьбах студентов.
   */
  requests() {
    if (!Cloud.isAdmin) return;
    const m = Store.s.meta;
    m.seenReq = m.seenReq || {};
    const fresh = pendingReqs().filter(r => !m.seenReq[r.uid + r.date]);
    if (!fresh.length) return;
    fresh.forEach(r => {
      m.seenReq[r.uid + r.date] = 1;
    });
    Store.save();
    Notifier.show(
      'chat',
      'Просьба отметить',
      fresh
        .map(r => r.name + ' — ' + U.fmtShort(U.fromISO(r.date)))
        .slice(0, 3)
        .join('; '),
      {
        tag: 'req'
      }
    );
  }
};
