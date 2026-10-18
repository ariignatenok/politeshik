'use strict';

Object.assign(A, {
  /**
   * Выбирает день на странице посещаемости.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'att-day'(el) {
    if (el.disabled) return;
    ui.attDate = el.dataset.date;
    ui.attMonth = el.dataset.date.slice(0, 7);
    App.render();
  },
  /**
   * Переключает период статистики: месяц или всё время.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'att-scope'(el) {
    ui.attScope = el.dataset.v;
    App.render();
  },
  /**
   * Листает месяцы в календаре посещаемости.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'att-month'(el) {
    const p = ui.attMonth.split('-').map(Number),
      d = new Date(p[0], p[1] - 1 + +el.dataset.d, 1),
      m = U.iso(d).slice(0, 7);
    if (m > U.iso(U.today()).slice(0, 7)) return;
    ui.attMonth = m;
    App.render();
  },
  /**
   * Ставит отметку посещаемости.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'att-mark'(el) {
    const date = el.dataset.date,
      uid = el.dataset.uid || null,
      today = U.iso(U.today());
    if (!uid && (date < ATT_START || date > today)) return toast('Отмечаться можно с 15.10.2026 и не в будущем');
    Att.set(uid, date, +el.dataset.pair, el.dataset.st);
    Ach.check();
    if (
      !uid &&
      el.dataset.st === 'п' &&
      date === today &&
      Store.s.attendance.marks[date + '|' + el.dataset.pair] === 'п'
    )
      Mascot.celebrate('Отметился вовремя ' + ICONS.check);
    if (uid) {
      const m = $('#stud-day');
      const r = studentRows().find(x => x.id === uid);
      if (m && r)
        m.innerHTML = attDayHtml(
          ui.stud.date,
          (Cloud.adm.att[uid] || {}).marks || {},
          r.certs,
          r.p.subgroup,
          uid,
          false
        );
    }
  },
  /**
   * Отправляет админу просьбу поставить отметку.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'req-admin'(el) {
    Chat.reqAdmin(el.dataset.mid, el.dataset.date);
  },
  /**
   * Отказывается от просьбы к админу.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'req-skip'(el) {
    const c = Chat.st();
    c.msgs.forEach(m => {
      if (m.id === el.dataset.mid) m.done = true;
    });
    Chat.save();
    App.render();
  },
  /**
   * Помечает просьбу студента выполненной.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'req-done'(el) {
    const uid = el.dataset.uid,
      doc = Cloud.adm.chat[uid];
    if (!doc) return;
    doc.reqs = (doc.reqs || []).map(r =>
      r.date === el.dataset.date
        ? Object.assign({}, r, {
            done: true
          })
        : r
    );
    Cloud.put('chat/' + uid, () => Cloud.adm.chat[uid]);
    App.render();
  },
  /**
   * Открывает редактор посещаемости студента.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'att-edit'(el) {
    openAttendanceEditor(el.dataset.id, el.dataset.date);
  }
});
