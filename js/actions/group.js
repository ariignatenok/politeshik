'use strict';

Object.assign(A, {
  /**
   * Открывает карточку студента.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'stud-open'(el) {
    openStudent(el.dataset.id, el.dataset.date);
  },
  /**
   * Освобождает фамилию студента после подтверждения.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'grp-release'(el) {
    const r = ROSTER_BY_ID[el.dataset.rid];
    if (
      !(await UI.confirm(
        'Освободить фамилию «' + (r ? r.name : '') + '»? Этот студент сможет войти заново и выбрать фамилию из списка.',
        'Освободить'
      ))
    )
      return;
    await Cloud.release(el.dataset.rid, el.dataset.uid);
    App.render();
    toast('Фамилия освобождена');
  },
  /**
   * Проставляет «н» за неотмеченные пары прошедшего дня.
   */
  async 'grp-closeday'() {
    const date = ui.grpDate || U.iso(U.today());
    if (date >= U.iso(U.today()) || date < ATT_START) return toast('Закрыть можно только прошедший учебный день');
    if (
      !(await UI.confirm(
        'Поставить «н» всем вошедшим студентам за пары, которые они не отметили (' +
          U.fmtShort(U.fromISO(date)) +
          ')? Дни по справке не затрагиваются. Исправить можно вручную.',
        'Проставить'
      ))
    )
      return;
    let n = 0;
    rosterRows()
      .filter(x => x.e && !x.r.flag && !x.r.admin)
      .forEach(x => {
        let cur = null;
        Att.pairs(date, x.e.p.subgroup).forEach(pr => {
          if (!x.e.marks[date + '|' + pr.pair] && !Att.covered(x.e.certs, date)) {
            if (!cur) cur = Object.assign({}, x.e.marks);
            cur[date + '|' + pr.pair] = 'н';
            n++;
          }
        });
        if (cur) {
          const id = x.e.id;
          Cloud.adm.att[id] = {marks: cur, updated: new Date().toISOString()};
          Cloud.put('attendance/' + id, () => Cloud.adm.att[id]);
        }
      });
    App.render();
    toast(n ? 'Проставлено «н»: ' + n : 'Неотмеченных пар нет');
  },
  /**
   * Переключает вкладку раздела «Группа».
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'grp-tab'(el) {
    ui.grpTab = el.dataset.tab;
    App.render();
  },
  /**
   * Листает день на вкладке «Сегодня».
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'grp-day'(el) {
    const d = U.fromISO(ui.grpDate || U.iso(U.today()));
    ui.grpDate = U.iso(U.addDays(d, +el.dataset.d));
    App.render();
  },
  /**
   * Открывает форму работы для всей группы.
   */
  'gwork-add'() {
    openGWorkForm();
  },
  /**
   * Открывает правку работы группы.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'gwork-edit'(el) {
    openGWorkForm(el.dataset.id);
  },
  /**
   * Удаляет работу группы.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'gwork-del'(el) {
    if (await UI.confirm('Удалить работу у всей группы?')) {
      Cloud.gworks = Cloud.gworks.filter(w => w.id !== el.dataset.id);
      Cloud.saveGworks();
      App.render();
    }
  },
  /**
   * Скачивает журнал посещаемости в формате CSV.
   */
  async 'grp-csv'() {
    const rows = [['Студент', 'Подгруппа', 'Дата', 'Пара', 'Предмет', 'Статус']],
      names = {п: 'присутствовал', о: 'опоздал', н: 'не был', у: 'по справке'};
    studentRows().forEach(r => {
      for (let d = U.fromISO(ATT_START), e = U.today(); d <= e; d = U.addDays(d, 1)) {
        const di = U.iso(d);
        Att.pairs(di, r.p.subgroup).forEach(pr => {
          const st = Att.eff(r.marks, r.certs, di, pr.pair);
          if (st) {
            const sb = subj(pr.lessons[0].subjectId);
            rows.push([r.p.name || '', r.p.subgroup || '', di, pr.pair, sb ? sb.name : '', names[st]]);
          }
        });
      }
    });
    const csv = '\ufeff' + rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\n');
    if (Cloud.dl) {
      try {
        await Cloud.dl.save({filename: 'politeshik-poseshchaemost-' + U.iso(new Date()) + '.csv', data: csv});
      } catch (e) {
        if (!e || e.code !== 'declined') toast('Не удалось сохранить файл');
      }
    } else toast('Скачивание недоступно в этом режиме');
  },
  /**
   * Открывает форму преподавателя.
   */
  't-add'() {
    openTeacherForm();
  },
  /**
   * Открывает правку преподавателя.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  't-edit'(el) {
    openTeacherForm(el.dataset.id);
  },
  /**
   * Удаляет преподавателя.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 't-del'(el) {
    if (!(await UI.confirm('Удалить карточку преподавателя?'))) return;
    Store.s.teachers = Store.s.teachers.filter(t => t.id !== el.dataset.id);
    Store.commit();
  }
});
