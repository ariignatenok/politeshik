'use strict';

const Store = (() => {
  let KEY = 'studyPlanner';
  let s = null,
    persistent = true;

  /**
   * Читает данные из localStorage.
   * @returns {string|null} Строка.
   */
  const lsGet = () => {
    try {
      return window.localStorage.getItem(KEY);
    } catch (e) {
      persistent = false;
      return null;
    }
  };
  /**
   * Записывает данные в localStorage.
   * @param {string} v Значение.
   */
  const lsSet = v => {
    try {
      window.localStorage.setItem(KEY, v);
    } catch (e) {
      persistent = false;
    }
  };

  /**
   * Приводит сохранённые данные к актуальной структуре.
   * @param {Object} d Сохранённые данные.
   * @returns {Object} Объект.
   */
  function normalize(d) {
    /**
     * Возвращает массив поля данных.
     * @param {string} k Имя поля данных.
     * @returns {Array} Массив.
     */
    const arr = k => (Array.isArray(d[k]) ? d[k].filter(x => x && typeof x === 'object') : []);
    /**
     * Добавляет идентификатор записям, у которых его нет.
     * @param {Array<Object>} a Записи.
     * @param {string} p Префикс идентификатора.
     * @returns {Array<Object>} Массив.
     */
    const withId = (a, p) => a.map(x => Object.assign({id: U.uid(p)}, x));
    const st = Object.assign(Seed.defaultSettings(), d.settings && typeof d.settings === 'object' ? d.settings : {});
    if (!Array.isArray(st.pairs) || !st.pairs.length) st.pairs = Seed.defaultSettings().pairs;
    st.pairs = st.pairs.map(p => ({start: (p && p.start) || '', end: (p && p.end) || ''}));
    const att = (d.attendance && typeof d.attendance.marks === 'object' && d.attendance.marks) || {};
    const ch = Object.assign(
      {msgs: [], answers: {}, asked: {}, follow: {}, flags: {}, reqs: [], updated: '', readAt: ''},
      d.chat && typeof d.chat === 'object' ? d.chat : {}
    );
    if (!Array.isArray(ch.msgs)) ch.msgs = [];
    if (!Array.isArray(ch.reqs)) ch.reqs = [];
    ['answers', 'asked', 'follow', 'flags'].forEach(k => {
      if (!ch[k] || typeof ch[k] !== 'object') ch[k] = {};
    });
    return {
      version: 1,
      settings: st,
      attendance: {marks: att},
      chat: ch,
      ach: d.ach && typeof d.ach === 'object' ? d.ach : {},
      meta: d.meta && typeof d.meta === 'object' ? d.meta : {},
      changes: Array.isArray(d.changes) ? d.changes.filter(x => x && typeof x === 'object') : [],
      subjects: withId(arr('subjects'), 's').map(x =>
        Object.assign({name: 'Без названия', short: '', color: COLORS[0], links: [], hasFormulas: false}, x, {
          links: Array.isArray(x.links) ? x.links : [],
          formulas: (Array.isArray(x.formulas) ? x.formulas : [])
            .filter(f => f && typeof f === 'object')
            .map(f => Object.assign({id: U.uid('f'), group: '', title: '', f: '', note: ''}, f))
        })
      ),
      teachers: withId(arr('teachers'), 't').map(x =>
        Object.assign({name: '', subjectIds: [], email: '', phone: '', room: '', notes: ''}, x, {
          subjectIds: Array.isArray(x.subjectIds) ? x.subjectIds : []
        })
      ),
      works: withId(arr('works'), 'w').map(x =>
        Object.assign(
          {title: '', type: 'Работа', subjectId: '', date: U.iso(new Date()), time: '', notes: '', done: false},
          x
        )
      ),
      homework: withId(arr('homework'), 'h').map(x =>
        Object.assign({subjectId: '', text: '', deadline: '', done: false}, x)
      ),
      cards: withId(arr('cards'), 'c').map(x => Object.assign({subjectId: '', cat: '', q: '', a: '', known: false}, x)),
      notes: withId(arr('notes'), 'n').map(x =>
        Object.assign({subjectId: '', title: '', text: '', updated: new Date().toISOString()}, x)
      ),
      schedule: withId(arr('schedule'), 'l').map(x =>
        Object.assign(
          {day: 0, pair: 1, week: 'both', subjectId: '', room: '', subgroup: '', who: '', start: '', end: ''},
          x
        )
      )
    };
  }

  /**
   * Обновляет данные до текущей версии.
   */
  function ensureSeed() {
    const v = s.settings.seedVersion || 1;
    if (v < 2) Content.migrate(s);
    if (v < 3) Content.migrateSchedule(s);
    if (v < 4) Content.migrateEnglish(s);
    s.settings.seedVersion = 4;
  }
  /**
   * Загружает состояние приложения.
   */
  function load() {
    const raw = lsGet();
    if (raw) {
      let ok = false;
      try {
        s = normalize(JSON.parse(raw));
        ok = true;
      } catch (e) {}
      if (ok) {
        try {
          ensureSeed();
        } catch (e) {}
        save();
        return;
      }
    }
    s = Seed.make();
    save();
  }
  /**
   * Сохраняет состояние приложения.
   */
  function save() {
    lsSet(JSON.stringify(s));
  }

  /**
   * Привязывает хранилище к аккаунту пользователя.
   * @param {string} uid Идентификатор пользователя.
   */
  function bind(uid) {
    const base = 'studyPlanner',
      mk = base + ':owner',
      key = base + ':' + uid;
    let owner = null,
      raw = null;
    try {
      owner = window.localStorage.getItem(mk);
      raw = window.localStorage.getItem(key);
    } catch (e) {}
    if (raw) {
      try {
        s = normalize(JSON.parse(raw));
        try {
          ensureSeed();
        } catch (e) {}
        KEY = key;
        save();
        return;
      } catch (e) {}
    }
    if (!owner) {
      try {
        window.localStorage.setItem(mk, uid);
      } catch (e) {}
      KEY = key;
      save();
      return;
    }
    if (owner === uid) {
      KEY = key;
      save();
      return;
    }
    s = Seed.make();
    KEY = key;
    save();
  }
  return {
    get s() {
      return s;
    },
    get persistent() {
      return persistent;
    },
    bind,
    load,
    save,
    commit() {
      save();
      App.render();
      if (Cloud.isAdmin) {
        Cloud.pushConfig();
        Cloud.pushExtra();
      }
    },
    replace(data) {
      s = normalize(data);
      try {
        ensureSeed();
      } catch (e) {}
      save();
      App.render();
    },
    restoreContent() {
      const n = Content.apply(s);
      save();
      App.render();
      return n;
    },
    reset() {
      s = Seed.make();
      save();
      App.render();
    },
    clear() {
      s = normalize({
        settings: {
          theme: s.settings.theme,
          numeratorAnchor: s.settings.numeratorAnchor,
          pairs: s.settings.pairs,
          seedVersion: 4
        }
      });
      save();
      App.render();
    }
  };
})();
