'use strict';

const Cloud = (() => {
  const C = {
    status: 'pending',
    loaded: false,
    claims: {},
    claimsLoaded: false,
    changes: [],
    changesLoaded: false,
    ratings: null,
    faq: null,
    extraSig: '',
    uid: null,
    me: null,
    isAdmin: false,
    db: null,
    dl: null,
    profile: null,
    cfg: null,
    cfgSig: '',
    gworks: [],
    chatLoaded: false,
    my: {certs: [], files: []},
    adm: {profiles: {}, att: {}, certs: {}, chat: {}},
    err: '',
    pending: 0,
    admReady: false,
    attLoaded: false,
    certsLoaded: false
  };
  /**
   * Создаёт глубокую копию данных.
   * @param {*} o Данные.
   * @returns {*} копия.
   */
  const clone = o => JSON.parse(JSON.stringify(o));

  /**
   * Создаёт доступ к одному документу таблицы docs.
   * @param {string} path Путь документа.
   * @returns {Object} методы get, set, delete, acquire.
   */
  function docAPI(path) {
    return {
      async get() {
        const {data, error} = await supa.from('docs').select('data').eq('path', path).maybeSingle();
        if (error) throw error;
        return {exists: !!data, data: () => (data ? data.data : null)};
      },
      async set(obj) {
        const {error} = await supa.from('docs').upsert({path, data: obj, updated: new Date().toISOString()});
        if (error) throw error;
      },
      async delete() {
        const {error} = await supa.from('docs').delete().eq('path', path);
        if (error) throw error;
      },
      collection(name) {
        return colAPI(path + '/' + name);
      },
      async acquire({holder}) {
        const {error} = await supa
          .from('docs')
          .insert({path, data: {uid: holder, at: new Date().toISOString()}, updated: new Date().toISOString()});
        if (error && error.code === '23505') {
          const {data} = await supa.from('docs').select('data').eq('path', path).maybeSingle();
          if (data && data.data && data.data.uid === holder) return {acquired: true};
          return {acquired: false};
        }
        if (error) return {acquired: false, error};
        return {acquired: true};
      },
      onSnapshot(cb, errCb) {
        const run = async () => {
          try {
            const {data, error} = await supa.from('docs').select('data').eq('path', path).maybeSingle();
            if (error) throw error;
            cb({exists: !!data, data: () => (data ? data.data : null)});
          } catch (e) {
            if (errCb) errCb(e);
          }
        };
        run();
        const id = setInterval(run, 20000);
        return {unsubscribe: () => clearInterval(id)};
      }
    };
  }
  /**
   * Создаёт доступ к группе документов по префиксу пути.
   * @param {string} prefix Префикс пути.
   * @returns {Object} метод onSnapshot.
   */
  function colAPI(prefix) {
    const p = prefix + '/';
    return {
      doc(id) {
        return docAPI(p + id);
      },
      onSnapshot(cb, errCb) {
        const run = async () => {
          try {
            const {data, error} = await supa
              .from('docs')
              .select('path,data')
              .like('path', p + '%')
              .not('path', 'like', p + '%/%');
            if (error) throw error;
            const direct = (data || []).filter(r => r.path.slice(p.length).indexOf('/') === -1);
            cb({docs: direct.map(r => ({id: r.path.slice(p.length), data: () => r.data}))});
          } catch (e) {
            if (errCb) errCb(e);
          }
        };
        run();
        const id = setInterval(run, 20000);
        return {unsubscribe: () => clearInterval(id)};
      }
    };
  }
  const DB = {
    /**  * Возвращает доступ к документу по пути.  * @param {string} p Путь документа.  * @returns {Object} Объект.  */ doc: p =>
      docAPI(p),
    /**  * Возвращает доступ к группе документов.  * @param {string} n Префикс пути.  * @returns {Object} Объект.  */ collection:
      n => colAPI(n)
  };
  C.db = DB;
  C.adminUids = new Set();

  C.dl = {
    async save({filename, data}) {
      const blob = new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  /**
   * Считает подпись расписания, которое сейчас лежит в этом устройстве.
   * @returns {string} Строка.
   */
  function localCfgSig() {
    const s = Store.s;
    return JSON.stringify([
      s.schedule,
      s.settings.pairs,
      s.settings.numeratorAnchor,
      s.subjects.map(x => ({id: x.id, name: x.name, short: x.short, color: x.color}))
    ]);
  }
  /**
   * Решает, что делать админу при расхождении данных устройства и облака.
   * @param {string} baseKey Ключ, где хранится подпись последней сверки.
   * @param {string} cloudSig Подпись данных в облаке.
   * @param {string} localSig Подпись данных на этом устройстве.
   * @param {string} cloudUpdated Время обновления данных в облаке, ISO.
   * @returns {string} same, take (взять облако) или keep (отправить своё).
   */
  function adminDecide(baseKey, cloudSig, localSig, cloudUpdated) {
    const meta = Store.s.meta,
      base = meta[baseKey];
    if (cloudSig === localSig) {
      meta[baseKey] = cloudSig;
      return 'same';
    }
    if (base === undefined) return meta.localEditAt && meta.localEditAt > (cloudUpdated || '') ? 'keep' : 'take';
    if (localSig === base) return 'take';
    if (cloudSig === base) return 'keep';
    return 'take';
  }
  /**
   * Сверяет общий контент админа (ДЗ, предметы, конспекты, карточки) с облаком.
   * @param {Object} x Общий контент из облака.
   * @param {string} cloudSig Подпись контента в облаке.
   */
  function syncAdminExtra(x, cloudSig) {
    const act = adminDecide('extraBase', cloudSig, C.extraSigOf(C.buildExtra()), x.updated);
    C.syncedExtra = true;
    if (act === 'take') {
      applyExtra(x);
      Store.s.meta.extraBase = cloudSig;
      Store.save();
      App.renderSoft();
    } else if (act === 'keep') C.pushExtra();
    else Store.save();
  }
  /**
   * Применяет к приложению общее расписание группы.
   * @param {Object} cfg Расписание группы.
   */
  function applyConfig(cfg) {
    const s = Store.s;
    if (C.isAdmin) {
      const cloudSig = JSON.stringify([cfg.schedule, cfg.pairs, cfg.anchor, cfg.subjects]),
        act = adminDecide('cfgBase', cloudSig, localCfgSig(), cfg.updated);
      C.syncedCfg = true;
      C.cfgSig = cloudSig;
      if (act === 'keep') {
        C.pushConfig();
      }
      if (act !== 'take') return;
      s.schedule = (cfg.schedule || []).map(l =>
        Object.assign({start: '', end: '', who: '', room: '', subgroup: ''}, l)
      );
      if (Array.isArray(cfg.pairs) && cfg.pairs.length)
        s.settings.pairs = cfg.pairs.map(p => ({start: p.start || '', end: p.end || ''}));
      if (cfg.anchor) s.settings.numeratorAnchor = cfg.anchor;
      (cfg.subjects || []).forEach(x => {
        const have = s.subjects.find(y => y.id === x.id);
        if (have) Object.assign(have, {name: x.name, short: x.short, color: x.color});
        else s.subjects.push(Object.assign({links: [], hasFormulas: false, formulas: []}, x));
      });
      s.meta.cfgBase = cloudSig;
      Store.save();
      App.renderSoft();
      return;
    }
    s.schedule = (cfg.schedule || []).map(l => Object.assign({start: '', end: '', who: '', room: '', subgroup: ''}, l));
    if (Array.isArray(cfg.pairs) && cfg.pairs.length)
      s.settings.pairs = cfg.pairs.map(p => ({start: p.start || '', end: p.end || ''}));
    if (cfg.anchor) s.settings.numeratorAnchor = cfg.anchor;
    (cfg.subjects || []).forEach(x => {
      if (!s.subjects.some(y => y.id === x.id))
        s.subjects.push(Object.assign({links: [], hasFormulas: false, formulas: []}, x));
    });
    Store.save();
  }
  /**
   * Применяет к студенту общий контент админа: ДЗ, предметы, конспекты, карточки.
   * @param {Object} x Общий контент админа.
   */
  function applyExtra(x) {
    const s = Store.s;
    if (Array.isArray(x.teachers)) s.teachers = x.teachers;
    if (Array.isArray(x.subjects))
      s.subjects = x.subjects.map(sb => Object.assign({links: [], hasFormulas: false, formulas: []}, sb));
    if (Array.isArray(x.homework)) s.homework = x.homework.map(h => Object.assign({}, h));
    if (Array.isArray(x.notes))
      s.notes = s.notes.filter(n => String(n.id).indexOf('sd_') === 0 || !n.subjectId).concat(x.notes);
    if (Array.isArray(x.cards)) {
      const known = {};
      s.cards.forEach(c => {
        if (c.known) known[c.id] = true;
      });
      s.cards = s.cards
        .filter(c => String(c.id).indexOf('sd_') === 0)
        .concat(x.cards.map(c => Object.assign({known: !!known[c.id]}, c, {known: !!known[c.id]})));
    }
    Store.save();
  }

  /**
   * Подписывается на свои данные студента.
   */
  function watchOwn() {
    DB.doc('attendance/' + C.uid).onSnapshot(snap => {
      if (snap.exists) {
        const cloud = clone(snap.data().marks || {}),
          local = Store.s.attendance.marks;
        if (Store.s.meta.pendingAtt) {
          const same = Object.keys(local).every(k => cloud[k] === local[k]);
          Store.s.attendance.marks = Object.assign({}, cloud, local);
          if (same) Store.s.meta.pendingAtt = false;
          else C.pushAtt();
        } else Store.s.attendance.marks = cloud;
        Store.save();
      } else if (Object.keys(Store.s.attendance.marks).length) C.pushAtt();
      C.attLoaded = true;
      App.renderSoft();
    });
    DB.doc('certs/' + C.uid).onSnapshot(snap => {
      C.my.certs = snap.exists ? clone(snap.data().items || []) : [];
      C.certsLoaded = true;
      App.renderSoft();
    });
    DB.doc('chat/' + C.uid).onSnapshot(snap => {
      if (snap.exists) {
        const c = clone(snap.data());
        Store.s.chat = Object.assign(Chat.blank(), c, {readAt: Store.s.chat.readAt || ''});
        Store.save();
      } else if (!snap.exists && Store.s.chat.msgs.length) C.pushChat();
      C.chatLoaded = true;
      App.renderSoft();
    });
    DB.doc('data/users/' + C.uid + '/cab').onSnapshot(snap => {
      C.my.files = snap.exists ? clone(snap.data().files || []) : [];
      App.renderSoft();
    });
  }
  /**
   * Подписывается на общие данные группы.
   */
  function watchGroup() {
    DB.doc('group/config').onSnapshot(snap => {
      C.cfg = snap.exists ? clone(snap.data()) : null;
      if (C.cfg) applyConfig(C.cfg);
      else if (C.isAdmin) {
        C.syncedCfg = true;
        C.pushConfig(true);
      }
    });
    DB.doc('group/works').onSnapshot(snap => {
      C.gworks = snap.exists ? clone(snap.data().items || []) : [];
      App.renderSoft();
    });
    DB.doc('group/extra').onSnapshot(snap => {
      if (snap.exists) {
        const x = clone(snap.data()),
          cloudSig = C.extraSigOf(x);
        C.extraSig = cloudSig;
        if (C.isAdmin) syncAdminExtra(x, cloudSig);
        else applyExtra(x);
      } else if (C.isAdmin) {
        C.syncedExtra = true;
        C.pushExtra(true);
      }
    });
    DB.doc('group/changes').onSnapshot(snap => {
      C.changes = snap.exists ? clone(snap.data().items || []) : [];
      if (window.Notice) Notice.changes();
      C.changesLoaded = true;
    });
    DB.doc('group/ratings').onSnapshot(snap => {
      C.ratings = snap.exists ? clone(snap.data()) : null;
      if (window.Notice) Notice.ratings();
    });
    DB.doc('group/faq').onSnapshot(snap => {
      C.faq = snap.exists ? clone(snap.data().items || null) : null;
    });
  }
  /**
   * Подписывается на данные всех студентов (только админ).
   */
  function watchAdmin() {
    const loaded = {};
    [
      ['profiles', 'profiles'],
      ['attendance', 'att'],
      ['certs', 'certs'],
      ['chat', 'chat']
    ].forEach(([col, key]) => {
      const done = () => {
        loaded[key] = true;
        C.admReady = Object.keys(loaded).length === 4;
      };
      DB.collection(col).onSnapshot(
        snap => {
          const m = {};
          snap.docs.forEach(x => {
            m[x.id] = clone(x.data());
          });
          C.adm[key] = m;
          if (key === 'chat' && window.Notice) Notice.requests();
          done();
          App.renderSoft();
        },
        () => {
          done();
        }
      );
    });
  }
  /**
   * Следит за занятыми фамилиями.
   */
  function watchClaims() {
    DB.collection('claims').onSnapshot(snap => {
      const m = {};
      snap.docs.forEach(x => {
        m[x.id] = (x.data() || {}).uid || '';
      });
      C.claims = m;
      C.claimsLoaded = true;
      App.renderSoft();
    });
  }

  /**
   * Подключается к облаку: проверяет сессию, права админа и запускает подписки.
   */
  C.init = async function () {
    try {
      if (!supa) {
        C.status = 'offline';
        C.err = 'no-supabase-lib';
        return;
      }
      const {
        data: {session}
      } = await supa.auth.getSession();
      if (!session) {
        C.status = 'offline';
        C.err = 'not-logged';
        return;
      }
      C.uid = session.user.id;
      C.me = {id: session.user.id, name: session.user.email || 'user', isOwner: false};
      try {
        const {data: ad} = await supa.from('admins').select('uid').eq('uid', C.uid).maybeSingle();
        if (ad) C.me.isOwner = true;
      } catch (e) {}
      C.isAdmin = !!C.me.isOwner;
      C.status = 'online';
      C.adminUids = new Set(C.isAdmin ? [C.uid] : []);
      Store.bind(C.uid);
      watchClaims();
      const ps = await DB.doc('profiles/' + C.uid).get();
      C.profile = ps.exists ? clone(ps.data()) : null;
      if (C.hasCabinet()) {
        if (C.profile.theme && THEME_IDS.indexOf(C.profile.theme) >= 0 && Store.s.settings.theme !== C.profile.theme) {
          Store.s.settings.theme = C.profile.theme;
        }
        Store.s.settings.subgroup = C.profile.subgroup || '';
        Store.s.settings.displayName = C.profile.name || '';
        C.profile.seen = new Date().toISOString();
        DB.doc('profiles/' + C.uid)
          .set(C.profile)
          .catch(() => {});
      }
      watchOwn();
      watchGroup();
      if (C.isAdmin) watchAdmin();
    } catch (e) {
      C.status = 'offline';
      C.err = String((e && e.message) || e);
    }
    C.loaded = true;
  };

  /**
   * Записывает документ в облако.
   * @param {string} path Путь документа.
   * @param {Function} build Функция, возвращающая данные документа.
   */
  C.put = (path, build) => {
    Promise.resolve()
      .then(() => build())
      .then(
        obj => writeDoc(path, obj),
        () => {}
      );
  };
  /**
   * Записывает документ в таблицу docs и запоминает ошибку.
   * @param {string} path Путь документа.
   * @param {Object} obj Данные документа.
   * @returns {Promise} Результат выполнения.
   */
  const writeDoc = (path, obj) =>
    DB.doc(path)
      .set(obj)
      .catch(e => {
        C.err = String((e && e.message) || e);
      });
  /**
   * Отправляет свои отметки в облако с учётом правок админа.
   */
  C.pushAtt = async () => {
    if (Store.s.meta.pendingAtt) {
      try {
        const sn = await DB.doc('attendance/' + C.uid).get(),
          cm = sn.exists ? sn.data().marks || {} : {};
        Store.s.attendance.marks = Object.assign({}, cm, Store.s.attendance.marks);
        Store.save();
      } catch (e) {}
    }
    writeDoc('attendance/' + C.uid, {marks: Store.s.attendance.marks, updated: new Date().toISOString()});
  };
  /**
   * Отправляет состояние чата с Политешиком в облако.
   */
  C.pushChat = () => {
    const c = Store.s.chat;
    writeDoc('chat/' + C.uid, {
      msgs: c.msgs,
      answers: c.answers,
      asked: c.asked,
      follow: c.follow,
      flags: c.flags || {},
      reqs: c.reqs || [],
      updated: c.updated || new Date().toISOString()
    });
  };
  /**
   * Отправляет расписание группы в облако (админ).
   * @param {boolean} force Отправить даже без изменений.
   */
  C.pushConfig = force => {
    if (!C.isAdmin || (!force && !C.syncedCfg)) return;
    const s = Store.s,
      cfg = {
        schedule: s.schedule,
        pairs: s.settings.pairs,
        anchor: s.settings.numeratorAnchor,
        subjects: s.subjects.map(x => ({id: x.id, name: x.name, short: x.short, color: x.color})),
        updated: new Date().toISOString()
      };
    const sig = JSON.stringify([cfg.schedule, cfg.pairs, cfg.anchor, cfg.subjects]);
    if (!force && sig === C.cfgSig) return;
    C.cfgSig = sig;
    Store.s.meta.cfgBase = sig;
    Store.save();
    writeDoc('group/config', cfg);
  };
  /**
   * Считает подпись общего контента, чтобы не отправлять его зря.
   * @param {Object} x Общий контент.
   * @returns {string} Строка.
   */
  C.extraSigOf = x => JSON.stringify([x.teachers, x.subjects, x.homework, x.notes, x.cards]);
  /**
   * Собирает общий контент админа из локальных данных.
   * @returns {Object} преподаватели, предметы, ДЗ, конспекты, карточки.
   */
  C.buildExtra = () => {
    const s = Store.s,
      isSeed = id => String(id).indexOf('sd_') === 0;
    return {
      teachers: s.teachers,
      subjects: s.subjects,
      homework: s.homework.map(h => ({id: h.id, subjectId: h.subjectId, text: h.text, deadline: h.deadline})),
      notes: s.notes.filter(n => n.subjectId && !isSeed(n.id)),
      cards: s.cards
        .filter(c => !isSeed(c.id))
        .map(c => ({id: c.id, subjectId: c.subjectId, cat: c.cat, q: c.q, a: c.a, link: c.link || ''}))
    };
  };
  /**
   * Отправляет общий контент админа в облако.
   * @param {boolean} force Отправить даже без изменений.
   */
  C.pushExtra = force => {
    if (!C.isAdmin || (!force && !C.syncedExtra)) return;
    const x = C.buildExtra();
    const sig = C.extraSigOf(x);
    if (!force && sig === C.extraSig) return;
    if (sig.length > 230000) {
      C.err = 'extra-too-big';
      return;
    }
    C.extraSig = sig;
    Store.s.meta.extraBase = sig;
    Store.save();
    writeDoc('group/extra', Object.assign({}, x, {updated: new Date().toISOString()}));
  };
  /**
   * Сохраняет отмены и замены пар.
   */
  C.saveChanges = () => writeDoc('group/changes', {items: C.changes, updated: new Date().toISOString()});
  /**
   * Сохраняет вопросы Политешика.
   */
  C.saveFaq = () => writeDoc('group/faq', {items: C.faq, updated: new Date().toISOString()});
  /**
   * Сохраняет рейтинг.
   * @param {Object} obj Рейтинг.
   */
  C.saveRatings = obj => writeDoc('group/ratings', obj);
  /**
   * Сохраняет работы группы.
   */
  C.saveGworks = () => writeDoc('group/works', {items: C.gworks, updated: new Date().toISOString()});
  /**
   * Проверяет, создан ли у пользователя личный кабинет.
   * @returns {boolean} true, если условие выполнено.
   */
  C.hasCabinet = () => {
    const p = C.profile,
      r = p && ROSTER_BY_ID[p.rid];
    if (!r || r.flag) return false;
    if (p.rid === ADMIN_RID && !C.isAdmin) return false;
    return true;
  };
  /**
   * Сохраняет профиль студента.
   * @param {string} rid Идентификатор фамилии.
   * @param {string} subgroup Подгруппа.
   */
  C.saveProfile = async (rid, subgroup) => {
    const r = ROSTER_BY_ID[rid];
    C.profile = Object.assign({joined: new Date().toISOString()}, C.profile || {}, {
      rid,
      name: r.name,
      subgroup,
      seen: new Date().toISOString()
    });
    Store.s.settings.subgroup = subgroup;
    Store.s.settings.displayName = r.name;
    Store.save();
    await DB.doc('profiles/' + C.uid).set(C.profile);
  };
  /**
   * Занимает фамилию за аккаунтом.
   * @param {string} rid Идентификатор фамилии.
   * @returns {Promise<Object>} результат: ok или причина отказа.
   */
  C.claim = async rid => {
    const ro = ROSTER_BY_ID[rid];
    if (!ro || ro.flag) return {ok: false, why: 'bad'};
    try {
      const ref = DB.doc('claims/' + rid);
      const lease = await ref.acquire({holder: C.uid});
      if (!lease.acquired) return {ok: false, why: 'taken'};
      const s = await ref.get(),
        d = s.exists ? s.data() : null;
      if (d && d.uid && d.uid !== C.uid) return {ok: false, why: 'taken'};
      if (!d || d.uid !== C.uid) await ref.set({uid: C.uid, at: new Date().toISOString()});
      return {ok: true};
    } catch (e) {
      return {ok: false, why: 'denied'};
    }
  };
  /**
   * Освобождает фамилию и удаляет профиль студента.
   * @param {string} rid Идентификатор фамилии.
   * @param {string} uid Идентификатор студента.
   */
  C.release = async (rid, uid) => {
    try {
      if (rid) await DB.doc('claims/' + rid).delete();
    } catch (e) {}
    try {
      if (uid) await DB.doc('profiles/' + uid).delete();
    } catch (e) {}
    if (uid) delete C.adm.profiles[uid];
    if (rid) delete C.claims[rid];
  };
  /**
   * Добавляет справку с фото.
   * @param {Object} meta Описание справки.
   * @param {string} dataUrl Фото справки в виде data-URL.
   */
  C.addCert = async (meta, dataUrl) => {
    const id = U.uid('c');
    await DB.doc('certs/' + C.uid + '/img/' + id).set({data: dataUrl});
    C.my.certs = C.my.certs.concat([Object.assign({id, at: new Date().toISOString()}, meta)]);
    writeDoc('certs/' + C.uid, {items: C.my.certs});
  };
  /**
   * Удаляет справку.
   * @param {string} id Идентификатор справки.
   */
  C.delCert = async id => {
    C.my.certs = C.my.certs.filter(c => c.id !== id);
    writeDoc('certs/' + C.uid, {items: C.my.certs});
    try {
      await DB.doc('certs/' + C.uid + '/img/' + id).delete();
    } catch (e) {}
  };
  /**
   * Загружает фото справки.
   * @param {string} uid Идентификатор студента.
   * @param {string} id Идентификатор справки.
   * @returns {Promise<string|null>} data-URL.
   */
  C.getCertImg = async (uid, id) => {
    const s = await DB.doc('certs/' + uid + '/img/' + id).get();
    return s.exists ? s.data().data : null;
  };
  /**
   * Добавляет личный файл.
   * @param {Object} meta Описание файла.
   * @param {string} dataUrl Файл в виде data-URL.
   */
  C.addFile = async (meta, dataUrl) => {
    const id = U.uid('f'),
      base = 'data/users/' + C.uid + '/cab';
    await DB.doc(base + '/blobs/' + id).set({data: dataUrl});
    C.my.files = C.my.files.concat([Object.assign({id, at: new Date().toISOString()}, meta)]);
    writeDoc(base, {files: C.my.files});
  };
  /**
   * Удаляет личный файл.
   * @param {string} id Идентификатор записи.
   */
  C.delFile = async id => {
    const base = 'data/users/' + C.uid + '/cab';
    C.my.files = C.my.files.filter(f => f.id !== id);
    writeDoc(base, {files: C.my.files});
    try {
      await DB.doc(base + '/blobs/' + id).delete();
    } catch (e) {}
  };
  /**
   * Загружает личный файл.
   * @param {string} id Идентификатор записи.
   * @returns {Promise<string|null>} data-URL.
   */
  C.getFile = async id => {
    const s = await DB.doc('data/users/' + C.uid + '/cab/blobs/' + id).get();
    return s.exists ? s.data().data : null;
  };
  /**
   * Ставит или снимает одну отметку студента (админ).
   * @param {string} uid Идентификатор студента.
   * @param {string} key Ключ вида "дата|пара".
   * @param {string} st Статус.
   */
  C.setMarkFor = (uid, key, st) => {
    const cur = Object.assign({}, (C.adm.att[uid] || {}).marks || {});
    if (cur[key] === st) delete cur[key];
    else cur[key] = st;
    C.adm.att[uid] = {marks: cur, updated: new Date().toISOString()};
    writeDoc('attendance/' + uid, C.adm.att[uid]);
  };
  /**
   * Загружает файл конспекта в облако.
   * @param {Object} f Файл конспекта: id, name, type, size, data.
   */
  C.addNoteFile = async f => {
    await DB.doc('group/file/' + f.id).set({data: f.data, name: f.name, type: f.type, size: f.size});
  };
  /**
   * Загружает файл конспекта.
   * @param {string} id Идентификатор файла.
   * @returns {Promise<Object|null>} имя, тип и содержимое в виде data-URL.
   */
  C.getNoteFile = async id => {
    const d = await DB.doc('group/file/' + id).get();
    return d.exists ? d.data() : null;
  };
  /**
   * Удаляет файл конспекта из облака.
   * @param {string} id Идентификатор файла.
   */
  C.delNoteFile = async id => {
    try {
      await DB.doc('group/file/' + id).delete();
    } catch (e) {}
  };
  /**
   * Подтверждает справку студента или снимает подтверждение (админ).
   * @param {string} uid Идентификатор студента.
   * @param {string} id Идентификатор справки.
   * @param {boolean} ok Подтверждена ли справка.
   */
  C.setCertStatus = (uid, id, ok) => {
    const items = ((C.adm.certs[uid] || {}).items || []).map(c =>
      c.id === id ? Object.assign({}, c, {confirmed: !!ok, confirmedAt: ok ? new Date().toISOString() : ''}) : c
    );
    C.adm.certs[uid] = {items};
    writeDoc('certs/' + uid, {items});
  };
  /**
   * Удаляет справку студента вместе с фото (админ).
   * @param {string} uid Идентификатор студента.
   * @param {string} id Идентификатор справки.
   */
  C.admDelCert = async (uid, id) => {
    const items = ((C.adm.certs[uid] || {}).items || []).filter(c => c.id !== id);
    C.adm.certs[uid] = {items};
    writeDoc('certs/' + uid, {items});
    try {
      await DB.doc('certs/' + uid + '/img/' + id).delete();
    } catch (e) {}
  };
  /**
   * Сохраняет несколько отметок студента за день (админ).
   * @param {string} uid Идентификатор студента.
   * @param {Object<string,string>} changes Отметки вида {"дата|пара": статус или пустая строка}.
   */
  C.saveMarksFor = (uid, changes) => {
    const cur = Object.assign({}, uid === C.uid ? Store.s.attendance.marks : (C.adm.att[uid] || {}).marks || {});
    Object.keys(changes).forEach(k => {
      if (changes[k]) cur[k] = changes[k];
      else delete cur[k];
    });
    if (uid === C.uid) {
      Store.s.attendance.marks = cur;
      Store.s.meta.pendingAtt = true;
      Store.save();
      C.pushAtt();
    } else {
      C.adm.att[uid] = {marks: cur, updated: new Date().toISOString()};
      writeDoc('attendance/' + uid, C.adm.att[uid]);
    }
  };
  /**
   * Отправляет профиль в облако.
   */
  C.pushProfile = () => {
    if (C.status === 'online' && C.profile) writeDoc('profiles/' + C.uid, C.profile);
  };
  /**
   * Проверяет, закрыто ли расписание для правки.
   * @returns {boolean} true, если условие выполнено.
   */
  C.locked = () => C.status === 'online' && !C.isAdmin && !!C.cfg;

  /**
   * Входит по email и паролю.
   * @param {string} email Адрес электронной почты.
   * @param {string} password Пароль.
   * @returns {Promise<Object>} ok и сообщение об ошибке.
   */
  C.login = async (email, password) => {
    if (!supa) return {ok: false, msg: 'Библиотека Supabase не загрузилась. Проверьте интернет и обновите страницу.'};
    const {error} = await supa.auth.signInWithPassword({email, password});
    if (error) return {ok: false, msg: friendlyAuthError(error)};
    await C.init();
    return {ok: true};
  };
  /**
   * Регистрирует аккаунт.
   * @param {string} email Адрес электронной почты.
   * @param {string} password Пароль.
   * @returns {Promise<Object>} ok и сообщение об ошибке.
   */
  C.signup = async (email, password) => {
    if (!supa) return {ok: false, msg: 'Библиотека Supabase не загрузилась.'};
    const {data, error} = await supa.auth.signUp({email, password});
    if (error) return {ok: false, msg: friendlyAuthError(error)};
    if (data.session) {
      await C.init();
      return {ok: true};
    }
    return {ok: false, msg: 'Проверьте почту и подтвердите регистрацию, потом войдите.'};
  };
  /**
   * Выходит из аккаунта и перезагружает страницу.
   */
  C.logout = async () => {
    if (supa) await supa.auth.signOut();
    location.reload();
  };

  return C;
})();
