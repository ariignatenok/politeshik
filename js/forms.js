'use strict';

const Forms = {
  /**
   * Сохраняет форму работы.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  work(form) {
    const title = val(form, 'title').trim(),
      date = val(form, 'date');
    if (!title || !date) {
      UI.shake($('.modal'));
      return toast('Укажите название и дату');
    }
    const rec = {
      title,
      type: val(form, 'type'),
      subjectId: val(form, 'subjectId'),
      date,
      time: val(form, 'time'),
      notes: val(form, 'notes')
    };
    if (form.dataset.id)
      Object.assign(
        Store.s.works.find(w => w.id === form.dataset.id),
        rec
      );
    else
      Store.s.works.push(
        Object.assign(
          {
            id: U.uid('w'),
            done: false
          },
          rec
        )
      );
    UI.close();
    Store.commit();
    toast('Сохранено');
  },
  /**
   * Сохраняет форму ДЗ.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  hw(form) {
    const text = val(form, 'text').trim();
    if (!text) {
      UI.shake($('.modal'));
      return toast('Введите задание');
    }
    Object.assign(
      Store.s.homework.find(h => h.id === form.dataset.id),
      {
        text,
        deadline: val(form, 'deadline')
      }
    );
    UI.close();
    Store.commit();
  },
  /**
   * Сохраняет быстрое ДЗ в предмете.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  'hw-new'(form) {
    const text = val(form, 'text').trim();
    if (!text) {
      UI.shake(form);
      return toast('Введите задание');
    }
    Store.s.homework.push({
      id: U.uid('h'),
      subjectId: form.dataset.subject,
      text,
      deadline: val(form, 'deadline'),
      done: false
    });
    Store.commit();
  },
  /**
   * Сохраняет пару расписания.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  lesson(form) {
    const state = Store.s;
    let sid = val(form, 'subjectId');
    if (sid === '__new') {
      const nm = val(form, 'newName').trim();
      if (!nm) {
        UI.shake($('.modal'));
        return toast('Введите название предмета');
      }
      sid = U.uid('s');
      state.subjects.push({
        id: sid,
        name: nm,
        short: nm.length > 10 ? nm.slice(0, 9) + '…' : nm,
        color: COLORS[state.subjects.length % COLORS.length],
        links: []
      });
    }
    const rec = {
      subjectId: sid,
      day: +val(form, 'day'),
      pair: +val(form, 'pair'),
      room: val(form, 'room').trim(),
      subgroup: val(form, 'subgroup').trim(),
      who: val(form, 'who').trim(),
      start: val(form, 'start'),
      end: val(form, 'end')
    };
    const everyWeek = !!(form.querySelector('[name=everyWeek]') || {}).checked,
      ws = form.dataset.ws || Weeks.start(U.today());
    if (everyWeek && !form.dataset.id) rec.week = 'both';
    Weeks.saveLesson(ws, rec, form.dataset.id || '', everyWeek);
    UI.close();
    Store.commit();
    toast(everyWeek ? 'Пара сохранена в шаблоне для всех недель' : 'Пара сохранена на этой неделе');
  },
  /**
   * Сохраняет время пар.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  times(form) {
    Store.s.settings.pairs = Store.s.settings.pairs.map((p, i) => ({
      start: val(form, 's' + i),
      end: val(form, 'e' + i)
    }));
    UI.close();
    Store.commit();
    toast('Время сохранено');
  },
  /**
   * Сохраняет предмет.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  subject(form) {
    const name = val(form, 'name').trim();
    if (!name) {
      UI.shake($('.modal'));
      return toast('Введите название');
    }
    const rec = {
      name,
      short: val(form, 'short').trim() || name.slice(0, 10),
      color: radio(form, 'color') || COLORS[0],
      hasFormulas: !!(form.querySelector('[name="hasFormulas"]') || {}).checked,
      noNotes: !!(form.querySelector('[name="noNotes"]') || {}).checked,
      linkNotesTo: 's_oap'
    };
    if (form.dataset.id) Object.assign(subj(form.dataset.id), rec);
    else {
      const x = Object.assign(
        {
          id: U.uid('s'),
          links: [],
          formulas: []
        },
        rec
      );
      Store.s.subjects.push(x);
      ui.subjectId = x.id;
      ui.subjTab = 'hw';
    }
    UI.close();
    Store.commit();
  },
  /**
   * Сохраняет конспект.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  note(form) {
    const title = val(form, 'title').trim(),
      text = val(form, 'text');
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
      files: files.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        size: f.size
      }))
    };
    const save = () => {
      if (form.dataset.id)
        Object.assign(
          Store.s.notes.find(n => n.id === form.dataset.id),
          rec
        );
      else
        Store.s.notes.push(
          Object.assign(
            {
              id: U.uid('n'),
              subjectId: form.dataset.sid
            },
            rec
          )
        );
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
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  teacher(form) {
    const name = val(form, 'name').trim();
    if (!name) {
      UI.shake($('.modal'));
      return toast('Введите ФИО');
    }
    const rec = {
      name,
      subjectIds: Array.from(form.querySelectorAll('[name="subj"]:checked')).map(e => e.value),
      email: val(form, 'email').trim(),
      phone: val(form, 'phone').trim(),
      room: val(form, 'room').trim(),
      notes: val(form, 'notes')
    };
    if (form.dataset.id)
      Object.assign(
        Store.s.teachers.find(t => t.id === form.dataset.id),
        rec
      );
    else
      Store.s.teachers.push(
        Object.assign(
          {
            id: U.uid('t')
          },
          rec
        )
      );
    UI.close();
    Store.commit();
  },
  /**
   * Сохраняет карточку.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  card(form) {
    const q = val(form, 'q').trim(),
      a = val(form, 'a').trim();
    if (!q || !a) {
      UI.shake($('.modal'));
      return toast('Заполните вопрос и ответ');
    }
    const rec = {
      q,
      a,
      cat: val(form, 'cat').trim(),
      subjectId: val(form, 'subjectId'),
      link: val(form, 'link').trim()
    };
    if (form.dataset.id)
      Object.assign(
        Store.s.cards.find(c => c.id === form.dataset.id),
        rec
      );
    else
      Store.s.cards.push(
        Object.assign(
          {
            id: U.uid('c'),
            known: false
          },
          rec
        )
      );
    UI.close();
    Store.commit();
    toast('Карточка сохранена');
  },
  /**
   * Сохраняет формулу.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  formula(form) {
    const title = val(form, 'title').trim(),
      f = val(form, 'f').trim();
    if (!title || !f) {
      UI.shake($('.modal'));
      return toast('Укажите название и формулу');
    }
    const sb = subj(ui.subjectId),
      rec = {
        group: val(form, 'group').trim(),
        title,
        f,
        note: val(form, 'note').trim()
      };
    if (form.dataset.id)
      Object.assign(
        sb.formulas.find(x => x.id === form.dataset.id),
        rec
      );
    else
      sb.formulas.push(
        Object.assign(
          {
            id: U.uid('f')
          },
          rec
        )
      );
    UI.close();
    Store.commit();
  },
  /**
   * Сохраняет замену пары на дату.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  change(form) {
    const date = val(form, 'date'),
      pair = +val(form, 'pair');
    if (!date) return toast('Выберите дату');
    Changes.upsert({
      type: 'replace',
      date,
      pair,
      subjectId: '',
      newSubjectId: val(form, 'newSubjectId'),
      newTeacher: val(form, 'newTeacher').trim(),
      newRoom: val(form, 'newRoom').trim(),
      reason: val(form, 'reason').trim()
    });
    UI.close();
    App.render();
    toast('Замена добавлена на ' + U.fmtShort(U.fromISO(date)));
  },
  /**
   * Сохраняет вопросы Политешика.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  faq(form) {
    const qs = [...form.querySelectorAll('[data-faq-q]')],
      as = [...form.querySelectorAll('[data-faq-a]')],
      items = [];
    qs.forEach((q, i) => {
      const t = q.value.trim(),
        a = (as[i].value || '').trim();
      if (t && a)
        items.push({
          q: t,
          a
        });
    });
    Cloud.faq = items.length ? items : null;
    Cloud.saveFaq();
    App.render();
    toast('Вопросы сохранены');
  },
  /**
   * Назначает приз за 1 место.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  prize(form) {
    const text = val(form, 'prize').trim();
    if (!text) return toast('Впишите приз');
    Rating.setPrize(Rating.periods()[ui.ratePeriod || 'month'].key, text);
    App.render();
    toast('Приз назначен: ' + text);
  },
  /**
   * Публикует новость.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  news(form) {
    const title = val(form, 'title').trim(),
      body = val(form, 'body').trim();
    if (!title || !body) {
      UI.shake($('.modal'));
      return toast('Заполните заголовок и текст');
    }
    News.add(title, body, val(form, 'date') || U.iso(U.today())).then(ok => {
      if (ok) {
        UI.close();
        toast('Новость опубликована');
        App.render();
      }
    });
  },
  /**
   * Отправляет комментарий под новостью.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  comment(form) {
    News.comment(form.dataset.id, val(form, 'body')).then(ok => {
      if (ok) App.render();
    });
  },
  /**
   * Отправляет личное сообщение.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  dm(form) {
    Dm.send(form.dataset.with, val(form, 't')).then(ok => {
      if (ok) {
        App.render();
        const i = $('#dmIn');
        if (i) i.focus();
      }
    });
  },
  /**
   * Сохраняет отметки студента за день.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  async 'att-edit'(form) {
    const changes = {};
    form.querySelectorAll('.ed-row').forEach(row => {
      const checked = row.querySelector('input:checked');
      changes[form.dataset.date + '|' + row.dataset.pair] = checked ? checked.value : '';
    });
    if (!Object.keys(changes).length) {
      UI.close();
      return toast('В этот день у студента нет пар, отмечать нечего');
    }
    const button = form.querySelector('[data-action="save-form"]');
    if (button) {
      button.disabled = true;
      button.textContent = 'Сохраняем…';
    }
    const result = await Cloud.saveMarksFor(form.dataset.uid, changes);
    if (!result.ok) {
      if (button) {
        button.disabled = false;
        button.textContent = 'Сохранить';
      }
      return toast('Не удалось сохранить посещаемость: ' + result.error);
    }
    UI.close();
    toast('Посещаемость сохранена');
    App.render();
  },
  /**
   * Сохраняет ДЗ из раздела «Домашка».
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  hwg(form) {
    const text = val(form, 'text').trim(),
      sid = val(form, 'subjectId');
    if (!text || !sid) {
      UI.shake($('.modal'));
      return toast('Выберите предмет и впишите задание');
    }
    Store.s.homework.push({
      id: U.uid('h'),
      subjectId: sid,
      text,
      deadline: val(form, 'deadline'),
      done: false
    });
    UI.close();
    Store.commit();
    toast('ДЗ добавлено');
  },
  /**
   * Создаёт кабинет: занимает фамилию и сохраняет профиль (для фамилии админа сначала нужен секретный пароль).
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  profile(form) {
    const first = !Cloud.hasCabinet(),
      sg = val(form, 'subgroup');
    const rid = first ? val(form, 'rid') : Cloud.profile.rid,
      ro = ROSTER_BY_ID[rid];
    if (!ro || ro.flag) {
      UI.shake($('.modal') || $('.gate-card'));
      return toast('Выберите свою фамилию из списка');
    }
    if (first && ro.id === ADMIN_RID && !Cloud.isAdmin) {
      ui.secret = {
        rid,
        sg
      };
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
      if (first) {
        const asked = await Cloud.requestAccess(
          'student',
          (Cloud.profile && Cloud.profile.name) || '',
          '',
          '',
          Roles.storedCode()
        );
        if (!asked.ok) toast(asked.error);
      }
      if (!first && !(await Birthday.saveFromForm(form))) return false;
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
      () =>
        toast(
          first ? 'Не удалось создать кабинет — проверьте доступ' : 'Не удалось сохранить профиль — проверьте связь'
        )
    );
  },
  /**
   * Сохраняет справку.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  cert(form) {
    const kind = val(form, 'kind'),
      isNote = kind === 'Записка';
    let from,
      to,
      pairs = [];
    if (isNote) {
      from = to = val(form, 'noteDate');
      pairs = [...form.querySelectorAll('[name=pair]:checked')].map(x => +x.value).sort((a, b) => a - b);
      if (!from || from < ATT_START) {
        UI.shake($('.modal'));
        return toast('Выберите дату записки');
      }
      if (!pairs.length) {
        UI.shake($('.modal'));
        return toast('Отметьте пары, на которые записка');
      }
    } else {
      from = val(form, 'from');
      to = val(form, 'to');
      if (!from || !to || to < from) {
        UI.shake($('.modal'));
        return toast('Проверьте даты');
      }
    }
    if (!ui.draft || !ui.draft.data) {
      UI.shake($('.modal'));
      return toast('Прикрепите фото');
    }
    if (Cloud.status !== 'online') return toast('Нужен вход через приглашение, чтобы документ дошёл до админа');
    const cert = {
      kind,
      from,
      to,
      note: val(form, 'note').trim()
    };
    if (isNote) cert.pairs = pairs;
    Cloud.addCert(cert, ui.draft.data).then(
      result => {
        if (result && result.ok === false) return toast('Не удалось сохранить: ' + result.error);
        UI.close();
        App.render();
        if (isNote)
          toast(
            'Записка прикреплена: ' +
              U.plural(pairs.length, 'пара', 'пары', 'пар') +
              ' ' +
              pairs.join(', ') +
              ' считаются «по справке»'
          );
        else {
          Support.comfortOnce();
          Sick.show(cert);
        }
      },
      error => toast('Не удалось прикрепить: ' + ((error && error.message) || 'файл слишком большой или нет доступа'))
    );
  },
  /**
   * Публикует готовое решение: загружает файлы и сохраняет запись. Асинхронно, окно не закрывается при ошибке.
   * @param {HTMLElement} form Форма решения.
   */
  async solution(form) {
    const title = val(form, 'title').trim(),
      text = val(form, 'text').trim(),
      files = ui.solFiles || [];
    if (!title && !text && !files.length) {
      UI.shake($('.modal'));
      return toast('Добавьте название, текст или файл');
    }
    if (!form.dataset.sid) return toast('Откройте предмет, чтобы добавить решение');
    const button = form.querySelector('[data-action="save-form"]');
    if (button) {
      button.disabled = true;
      button.textContent = 'Публикуем…';
    }
    const result = await Solutions.save(form.dataset.sid, title || 'Решение', text);
    if (!result.ok) {
      if (button) {
        button.disabled = false;
        button.textContent = 'Опубликовать';
      }
      return toast('Не удалось опубликовать: ' + result.error);
    }
    ui.solFiles = [];
    UI.close();
    App.render();
    toast('Решение опубликовано');
  },
  /**
   * Сохраняет личную заметку о студенте.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  async tnote(form) {
    const text = val(form, 'text').trim(),
      result = await Cloud.saveTeacherNote(form.dataset.uid, text);
    if (!result.ok) return toast('Не удалось сохранить: ' + result.error);
    UI.close();
    App.render();
    toast(text ? 'Заметка сохранена' : 'Заметка удалена');
  },
  /**
   * Сохраняет консультацию.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  async consult(form) {
    const time = val(form, 'time');
    if (!time) {
      UI.shake($('.modal'));
      return toast('Укажите время');
    }
    const items = (Cloud.consults || []).concat([
      {
        id: U.uid('c'),
        day: +val(form, 'day'),
        time,
        room: val(form, 'room').trim(),
        note: val(form, 'note').trim()
      }
    ]);
    const result = await Cloud.saveConsults(items);
    if (!result.ok) return toast('Не удалось сохранить: ' + result.error);
    UI.close();
    App.render();
    toast('Консультация добавлена');
  },
  /**
   * Публикует новость отделения во все группы.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  async 'dept-news'(form) {
    const title = val(form, 'title').trim(),
      body = val(form, 'body').trim();
    if (!title || !body) return toast('Заполните заголовок и текст');
    const {error} = await supa.from('news').insert({
      title,
      body
    });
    if (error) return toast('Не удалось опубликовать: ' + error.message);
    await News.refresh();
    App.render(true);
    toast('Новость опубликована во всех группах');
  },
  /**
   * Сохраняет личный файл.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  file(form) {
    const title = val(form, 'title').trim();
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
        subjectId: val(form, 'subjectId'),
        note: val(form, 'note').trim(),
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
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  gwork(form) {
    const title = val(form, 'title').trim(),
      date = val(form, 'date');
    if (!title || !date) {
      UI.shake($('.modal'));
      return toast('Укажите название и дату');
    }
    const rec = {
      title,
      type: val(form, 'type'),
      subjectId: val(form, 'subjectId'),
      date,
      time: val(form, 'time'),
      notes: val(form, 'notes')
    };
    if (form.dataset.id)
      Object.assign(
        Cloud.gworks.find(w => w.id === form.dataset.id),
        rec
      );
    else
      Cloud.gworks.push(
        Object.assign(
          {
            id: U.uid('g')
          },
          rec
        )
      );
    Cloud.saveGworks();
    UI.close();
    App.render();
    toast('Сохранено — студенты увидят работу сразу');
  },
  /**
   * Отправляет вопрос Политешику.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  chat(form) {
    const t = val(form, 't').trim();
    if (!t) return;
    Chat.reply(t);
    setTimeout(() => {
      const i = $('#chatIn');
      if (i) i.focus();
    }, 30);
  },
  /**
   * Добавляет ссылку на материал предмета.
   * @param {HTMLElement} form Контейнер формы с атрибутом data-form.
   */
  'link-new'(form) {
    let url = val(form, 'url').trim();
    if (!url) {
      UI.shake(form);
      return toast('Вставьте ссылку');
    }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    subj(ui.subjectId).links.push({
      title: val(form, 'title').trim() || url,
      url
    });
    Store.commit();
  }
};
