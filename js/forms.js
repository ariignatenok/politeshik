'use strict';

const Forms = {
  /**
   * Сохраняет форму работы.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  work(r) {
    const title = val(r, 'title').trim(),
      date = val(r, 'date');
    if (!title || !date) {
      UI.shake($('.modal'));
      return toast('Укажите название и дату');
    }
    const rec = {
      title,
      type: val(r, 'type'),
      subjectId: val(r, 'subjectId'),
      date,
      time: val(r, 'time'),
      notes: val(r, 'notes')
    };
    if (r.dataset.id)
      Object.assign(
        Store.s.works.find(w => w.id === r.dataset.id),
        rec
      );
    else Store.s.works.push(Object.assign({id: U.uid('w'), done: false}, rec));
    UI.close();
    Store.commit();
    toast('Сохранено');
  },
  /**
   * Сохраняет форму ДЗ.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  hw(r) {
    const text = val(r, 'text').trim();
    if (!text) {
      UI.shake($('.modal'));
      return toast('Введите задание');
    }
    Object.assign(
      Store.s.homework.find(h => h.id === r.dataset.id),
      {text, deadline: val(r, 'deadline')}
    );
    UI.close();
    Store.commit();
  },
  /**
   * Сохраняет быстрое ДЗ в предмете.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  'hw-new'(r) {
    const text = val(r, 'text').trim();
    if (!text) {
      UI.shake(r);
      return toast('Введите задание');
    }
    Store.s.homework.push({
      id: U.uid('h'),
      subjectId: r.dataset.subject,
      text,
      deadline: val(r, 'deadline'),
      done: false
    });
    Store.commit();
  },
  /**
   * Сохраняет пару расписания.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  lesson(r) {
    const s = Store.s;
    let sid = val(r, 'subjectId');
    if (sid === '__new') {
      const nm = val(r, 'newName').trim();
      if (!nm) {
        UI.shake($('.modal'));
        return toast('Введите название предмета');
      }
      sid = U.uid('s');
      s.subjects.push({
        id: sid,
        name: nm,
        short: nm.length > 10 ? nm.slice(0, 9) + '…' : nm,
        color: COLORS[s.subjects.length % COLORS.length],
        links: []
      });
    }
    const rec = {
      subjectId: sid,
      day: +val(r, 'day'),
      pair: +val(r, 'pair'),
      week: radio(r, 'week') || 'both',
      room: val(r, 'room').trim(),
      subgroup: val(r, 'subgroup').trim(),
      who: val(r, 'who').trim(),
      start: val(r, 'start'),
      end: val(r, 'end')
    };
    if (r.dataset.id)
      Object.assign(
        s.schedule.find(l => l.id === r.dataset.id),
        rec
      );
    else s.schedule.push(Object.assign({id: U.uid('l')}, rec));
    ui.schedWeek = rec.week === 'both' ? ui.schedWeek : rec.week;
    UI.close();
    Store.commit();
    toast('Пара сохранена');
  },
  /**
   * Сохраняет время пар.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  times(r) {
    Store.s.settings.pairs = Store.s.settings.pairs.map((p, i) => ({start: val(r, 's' + i), end: val(r, 'e' + i)}));
    UI.close();
    Store.commit();
    toast('Время сохранено');
  },
  /**
   * Сохраняет предмет.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  subject(r) {
    const name = val(r, 'name').trim();
    if (!name) {
      UI.shake($('.modal'));
      return toast('Введите название');
    }
    const rec = {
      name,
      short: val(r, 'short').trim() || name.slice(0, 10),
      color: radio(r, 'color') || COLORS[0],
      hasFormulas: !!(r.querySelector('[name="hasFormulas"]') || {}).checked,
      noNotes: !!(r.querySelector('[name="noNotes"]') || {}).checked,
      linkNotesTo: 's_oap'
    };
    if (r.dataset.id) Object.assign(subj(r.dataset.id), rec);
    else {
      const x = Object.assign({id: U.uid('s'), links: [], formulas: []}, rec);
      Store.s.subjects.push(x);
      ui.subjectId = x.id;
      ui.subjTab = 'hw';
    }
    UI.close();
    Store.commit();
  },
  /**
   * Сохраняет конспект.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  note(r) {
    const title = val(r, 'title').trim(),
      text = val(r, 'text');
    if (!title && !text.trim()) {
      UI.shake($('.modal'));
      return toast('Конспект пустой');
    }
    const files = ui.noteFiles || [],
      fresh = files.filter(f => f.data),
      removed = ui.noteRemoved || [];
    if ((fresh.length || removed.length) && Cloud.status !== 'online')
      return toast('Файлы можно прикреплять после входа в аккаунт');
    const rec = {
      title: title || 'Без заголовка',
      text,
      updated: new Date().toISOString(),
      files: files.map(f => ({id: f.id, name: f.name, type: f.type, size: f.size}))
    };
    const save = () => {
      if (r.dataset.id)
        Object.assign(
          Store.s.notes.find(n => n.id === r.dataset.id),
          rec
        );
      else Store.s.notes.push(Object.assign({id: U.uid('n'), subjectId: r.dataset.sid}, rec));
      removed.forEach(id => Cloud.delNoteFile(id));
      ui.noteFiles = [];
      ui.noteRemoved = [];
      UI.close();
      Store.commit();
      toast('Конспект сохранён');
    };
    if (!fresh.length) return save();
    toast('Загружаю файлы…');
    Promise.all(fresh.map(f => Cloud.addNoteFile(f))).then(save, () =>
      toast('Не удалось загрузить файл: он слишком большой или нет доступа')
    );
  },
  /**
   * Сохраняет преподавателя.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  teacher(r) {
    const name = val(r, 'name').trim();
    if (!name) {
      UI.shake($('.modal'));
      return toast('Введите ФИО');
    }
    const rec = {
      name,
      subjectIds: Array.from(r.querySelectorAll('[name="subj"]:checked')).map(e => e.value),
      email: val(r, 'email').trim(),
      phone: val(r, 'phone').trim(),
      room: val(r, 'room').trim(),
      notes: val(r, 'notes')
    };
    if (r.dataset.id)
      Object.assign(
        Store.s.teachers.find(t => t.id === r.dataset.id),
        rec
      );
    else Store.s.teachers.push(Object.assign({id: U.uid('t')}, rec));
    UI.close();
    Store.commit();
  },
  /**
   * Сохраняет карточку.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  card(r) {
    const q = val(r, 'q').trim(),
      a = val(r, 'a').trim();
    if (!q || !a) {
      UI.shake($('.modal'));
      return toast('Заполните вопрос и ответ');
    }
    const rec = {q, a, cat: val(r, 'cat').trim(), subjectId: val(r, 'subjectId'), link: val(r, 'link').trim()};
    if (r.dataset.id)
      Object.assign(
        Store.s.cards.find(c => c.id === r.dataset.id),
        rec
      );
    else Store.s.cards.push(Object.assign({id: U.uid('c'), known: false}, rec));
    UI.close();
    Store.commit();
    toast('Карточка сохранена');
  },
  /**
   * Сохраняет формулу.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  formula(r) {
    const title = val(r, 'title').trim(),
      f = val(r, 'f').trim();
    if (!title || !f) {
      UI.shake($('.modal'));
      return toast('Укажите название и формулу');
    }
    const sb = subj(ui.subjectId),
      rec = {group: val(r, 'group').trim(), title, f, note: val(r, 'note').trim()};
    if (r.dataset.id)
      Object.assign(
        sb.formulas.find(x => x.id === r.dataset.id),
        rec
      );
    else sb.formulas.push(Object.assign({id: U.uid('f')}, rec));
    UI.close();
    Store.commit();
  },
  /**
   * Сохраняет замену пары на дату.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  change(r) {
    const date = val(r, 'date'),
      pair = +val(r, 'pair');
    if (!date) return toast('Выберите дату');
    Changes.upsert({
      type: 'replace',
      date,
      pair,
      subjectId: '',
      newSubjectId: val(r, 'newSubjectId'),
      newTeacher: val(r, 'newTeacher').trim(),
      newRoom: val(r, 'newRoom').trim(),
      reason: val(r, 'reason').trim()
    });
    UI.close();
    App.render();
    toast('Замена добавлена на ' + U.fmtShort(U.fromISO(date)));
  },
  /**
   * Сохраняет вопросы Политешика.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  faq(r) {
    const qs = [...r.querySelectorAll('[data-faq-q]')],
      as = [...r.querySelectorAll('[data-faq-a]')],
      items = [];
    qs.forEach((q, i) => {
      const t = q.value.trim(),
        a = (as[i].value || '').trim();
      if (t && a) items.push({q: t, a});
    });
    Cloud.faq = items.length ? items : null;
    Cloud.saveFaq();
    App.render();
    toast('Вопросы сохранены');
  },
  /**
   * Назначает приз за 1 место.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  prize(r) {
    const text = val(r, 'prize').trim();
    if (!text) return toast('Впишите приз');
    Rating.setPrize(Rating.periods()[ui.ratePeriod || 'month'].key, text);
    App.render();
    toast('Приз назначен: ' + text);
  },
  /**
   * Публикует новость.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  news(r) {
    const title = val(r, 'title').trim(),
      body = val(r, 'body').trim();
    if (!title || !body) {
      UI.shake($('.modal'));
      return toast('Заполните заголовок и текст');
    }
    News.add(title, body, val(r, 'date') || U.iso(U.today())).then(ok => {
      if (ok) {
        UI.close();
        toast('Новость опубликована');
        App.render();
      }
    });
  },
  /**
   * Отправляет комментарий под новостью.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  comment(r) {
    News.comment(r.dataset.id, val(r, 'body')).then(ok => {
      if (ok) App.render();
    });
  },
  /**
   * Отправляет личное сообщение.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  dm(r) {
    Dm.send(r.dataset.with, val(r, 't')).then(ok => {
      if (ok) {
        App.render();
        const i = $('#dmIn');
        if (i) i.focus();
      }
    });
  },
  /**
   * Сохраняет отметки студента за день.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  'att-edit'(r) {
    const changes = {};
    r.querySelectorAll('.ed-row').forEach(row => {
      const ch = row.querySelector('input:checked');
      changes[r.dataset.date + '|' + row.dataset.pair] = ch ? ch.value : '';
    });
    Cloud.saveMarksFor(r.dataset.uid, changes);
    UI.close();
    toast('Посещаемость сохранена');
    App.render();
  },
  /**
   * Сохраняет ДЗ из раздела «Домашка».
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  hwg(r) {
    const text = val(r, 'text').trim(),
      sid = val(r, 'subjectId');
    if (!text || !sid) {
      UI.shake($('.modal'));
      return toast('Выберите предмет и впишите задание');
    }
    Store.s.homework.push({id: U.uid('h'), subjectId: sid, text, deadline: val(r, 'deadline'), done: false});
    UI.close();
    Store.commit();
    toast('ДЗ добавлено');
  },
  /**
   * Создаёт кабинет: занимает фамилию и сохраняет профиль (для фамилии админа сначала нужен секретный пароль).
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  profile(r) {
    const first = !Cloud.hasCabinet(),
      sg = val(r, 'subgroup');
    const rid = first ? val(r, 'rid') : Cloud.profile.rid,
      ro = ROSTER_BY_ID[rid];
    if (!ro || ro.flag) {
      UI.shake($('.modal') || $('.gate-card'));
      return toast('Выберите свою фамилию из списка');
    }
    if (first && ro.id === ADMIN_RID && !Cloud.isAdmin) {
      ui.secret = {rid, sg};
      $('#gate').dataset.mode = '';
      App.render();
      return;
    }
    (async () => {
      if (first) {
        const c = await Cloud.claim(rid);
        if (!c.ok) {
          toast(
            c.why === 'taken'
              ? 'Эта фамилия уже занята другим аккаунтом. Если это ошибка — напишите админу'
              : c.why === 'busy'
                ? 'Кто-то выбирает эту фамилию прямо сейчас — попробуйте ещё раз'
                : 'Не удалось занять фамилию'
          );
          return false;
        }
      }
      await Cloud.saveProfile(rid, sg);
      return true;
    })().then(
      ok => {
        if (!ok) return;
        UI.locked = false;
        UI.close();
        Chat.tick();
        App.render(true);
        toast(first ? 'Добро пожаловать в Политешик!' : 'Сохранено');
      },
      () => toast('Не удалось создать кабинет — проверьте доступ')
    );
  },
  /**
   * Сохраняет справку.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  cert(r) {
    const from = val(r, 'from'),
      to = val(r, 'to');
    if (!from || !to || to < from) {
      UI.shake($('.modal'));
      return toast('Проверьте даты');
    }
    if (!ui.draft || !ui.draft.data) {
      UI.shake($('.modal'));
      return toast('Прикрепите фото справки');
    }
    if (Cloud.status !== 'online') return toast('Нужен вход через приглашение, чтобы справка дошла до админа');
    Cloud.addCert({kind: val(r, 'kind'), from, to, note: val(r, 'note').trim()}, ui.draft.data).then(
      () => {
        UI.close();
        App.render();
        toast('Справка прикреплена');
      },
      () => toast('Не удалось загрузить: файл слишком большой или нет доступа')
    );
  },
  /**
   * Сохраняет личный файл.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  file(r) {
    const title = val(r, 'title').trim();
    if (!title) {
      UI.shake($('.modal'));
      return toast('Введите название');
    }
    if (!ui.draft || !ui.draft.data) {
      UI.shake($('.modal'));
      return toast('Выберите файл');
    }
    if (Cloud.status !== 'online') return toast('Файлы хранятся в облаке — нужен вход через приглашение');
    Cloud.addFile(
      {
        title,
        subjectId: val(r, 'subjectId'),
        note: val(r, 'note').trim(),
        name: ui.draft.name,
        type: ui.draft.type,
        size: ui.draft.size
      },
      ui.draft.data
    ).then(
      () => {
        UI.close();
        App.render();
        toast('Работа прикреплена');
      },
      () => toast('Не удалось загрузить файл')
    );
  },
  /**
   * Сохраняет работу группы.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  gwork(r) {
    const title = val(r, 'title').trim(),
      date = val(r, 'date');
    if (!title || !date) {
      UI.shake($('.modal'));
      return toast('Укажите название и дату');
    }
    const rec = {
      title,
      type: val(r, 'type'),
      subjectId: val(r, 'subjectId'),
      date,
      time: val(r, 'time'),
      notes: val(r, 'notes')
    };
    if (r.dataset.id)
      Object.assign(
        Cloud.gworks.find(w => w.id === r.dataset.id),
        rec
      );
    else Cloud.gworks.push(Object.assign({id: U.uid('g')}, rec));
    Cloud.saveGworks();
    UI.close();
    App.render();
    toast('Сохранено — студенты увидят работу сразу');
  },
  /**
   * Отправляет вопрос Политешику.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  chat(r) {
    const t = val(r, 't').trim();
    if (!t) return;
    Chat.reply(t);
    setTimeout(() => {
      const i = $('#chatIn');
      if (i) i.focus();
    }, 30);
  },
  /**
   * Добавляет ссылку на материал предмета.
   * @param {HTMLElement} r Контейнер формы с атрибутом data-form.
   */
  'link-new'(r) {
    let url = val(r, 'url').trim();
    if (!url) {
      UI.shake(r);
      return toast('Вставьте ссылку');
    }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    subj(ui.subjectId).links.push({title: val(r, 'title').trim() || url, url});
    Store.commit();
  }
};
