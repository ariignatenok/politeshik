'use strict';

Object.assign(A, {
  /**
   * Открывает страницу предмета.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'subj-open'(el) {
    ui.subjectId = el.dataset.id;
    ui.subjTab = 'hw';
    ui.noteQuery = '';
    ui.cardCat = 'all';
    ui.cardQuery = '';
    ui.cardUnknown = false;
    ui.fQuery = '';
    ui.study = null;
    App.render(true);
    window.scrollTo(0, 0);
  },
  /**
   * Возвращает к списку предметов.
   */
  'subj-back'() {
    ui.subjectId = null;
    ui.study = null;
    App.render(true);
  },
  /**
   * Переключает вкладку предмета.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'subj-tab'(el) {
    ui.subjTab = el.dataset.tab;
    ui.study = null;
    App.render();
  },
  /**
   * Открывает форму нового предмета.
   */
  'subj-add'() {
    openSubjectForm();
  },
  /**
   * Открывает правку текущего предмета.
   */
  'subj-edit'() {
    openSubjectForm(ui.subjectId);
  },
  /**
   * Удаляет предмет вместе с его материалами.
   */
  async 'subj-del'() {
    const sb = subj(ui.subjectId);
    if (!(await UI.confirm('Удалить предмет «' + sb.name + '» вместе с домашкой, конспектами и парами в расписании?')))
      return;
    const s = Store.s,
      id = sb.id;
    s.subjects = s.subjects.filter(x => x.id !== id);
    s.homework = s.homework.filter(h => h.subjectId !== id);
    s.notes = s.notes.filter(n => n.subjectId !== id);
    s.cards = s.cards.filter(c => c.subjectId !== id);
    s.schedule = s.schedule.filter(l => l.subjectId !== id);
    s.works.forEach(w => {
      if (w.subjectId === id) w.subjectId = '';
    });
    s.teachers.forEach(t => {
      t.subjectIds = t.subjectIds.filter(x => x !== id);
    });
    ui.subjectId = null;
    Store.commit();
  },
  /**
   * Открывает редактор нового конспекта.
   */
  'note-add'() {
    openNoteEditor();
  },
  /**
   * Открывает конспект для чтения.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'note-open'(el) {
    openNoteReader(el.dataset.id);
  },
  /**
   * Открывает редактор конспекта.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'note-edit'(el) {
    openNoteEditor(el.dataset.id);
  },
  /**
   * Убирает файл из редактируемого конспекта.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'note-file-rm'(el) {
    const f = ui.noteFiles.find(x => x.id === el.dataset.id);
    if (!f) return;
    ui.noteFiles = ui.noteFiles.filter(x => x.id !== f.id);
    if (!f.data) ui.noteRemoved.push(f.id);
    const box = $('#note-files');
    if (box) box.innerHTML = noteFilesEditHtml();
  },
  /**
   * Скачивает файл, прикреплённый к конспекту.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'note-file-dl'(el) {
    if (Cloud.status !== 'online') return toast('Файл хранится в облаке: нужен вход в аккаунт');
    toast('Скачиваю файл…');
    try {
      const f = await Cloud.getNoteFile(el.dataset.id);
      if (!f || !f.data) return toast('Файл не найден');
      downloadBlob(await (await fetch(f.data)).blob(), f.name || el.dataset.name || 'file');
    } catch (e) {
      toast('Не удалось скачать файл');
    }
  },
  /**
   * Удаляет конспект.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'note-del'(el) {
    if (!(await UI.confirm('Удалить конспект?'))) return;
    ((Store.s.notes.find(n => n.id === el.dataset.id) || {}).files || []).forEach(f => Cloud.delNoteFile(f.id));
    Store.s.notes = Store.s.notes.filter(n => n.id !== el.dataset.id);
    UI.close();
    Store.commit();
  },
  /**
   * Переключает предпросмотр текста конспекта.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'preview-toggle'(el) {
    const m = $('#modal-root'),
      ta = m.querySelector('textarea'),
      pv = $('#note-preview'),
      on = pv.hidden;
    if (on) pv.innerHTML = Md.render(ta.value) || '<p class="md-help">Пока пусто</p>';
    pv.hidden = !on;
    ta.hidden = on;
    el.textContent = on ? ICONS.pencil + ' Редактор' : ICONS.eye + ' Предпросмотр';
  },
  /**
   * Удаляет ссылку на материал.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'link-del'(el) {
    subj(ui.subjectId).links.splice(+el.dataset.i, 1);
    Store.commit();
  },
  /**
   * Открывает карточку для чтения.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'card-open'(el) {
    openCardReader(el.dataset.id);
  },
  /**
   * Открывает форму новой карточки.
   */
  'card-add'() {
    openCardForm();
  },
  /**
   * Открывает правку карточки.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'card-edit'(el) {
    openCardForm(el.dataset.id);
  },
  /**
   * Удаляет карточку.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'card-del'(el) {
    if (!(await UI.confirm('Удалить карточку?'))) return;
    Store.s.cards = Store.s.cards.filter(c => c.id !== el.dataset.id);
    UI.close();
    Store.commit();
  },
  /**
   * Отмечает карточку выученной или нет.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'card-toggle'(el) {
    const c = Store.s.cards.find(x => x.id === el.dataset.id);
    if (c) {
      c.known = !c.known;
      UI.close();
      Store.commit();
      Profile.push();
      Ach.check();
    }
  },
  /**
   * Фильтрует карточки по теме.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'card-cat'(el) {
    ui.cardCat = el.dataset.cat;
    App.render();
  },
  /**
   * Показывает только невыученные карточки.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'card-unknown'(el) {
    ui.cardUnknown = el.dataset.v === '1';
    App.render();
  },
  /**
   * Запускает заучивание карточек.
   */
  'study-start'() {
    const sb = subj(ui.subjectId);
    let ids = filteredCards(sb).map(c => c.id);
    if (!ids.length) return toast('Нет карточек для заучивания');
    if (ui.cardShuffle) ids = U.shuffle(ids);
    ui.study = {sid: sb.id, ids, i: 0, flip: false, yes: 0, no: 0, missed: []};
    App.render(true);
  },
  /**
   * Запускает режим экзамена на 20 случайных карточек.
   */
  'study-exam'() {
    const sb = subj(ui.subjectId),
      ids = U.shuffle(deckCards(sb).map(c => c.id)).slice(0, 20);
    if (ids.length < 5) return toast('Для экзамена нужно хотя бы 5 карточек');
    ui.study = {sid: sb.id, ids, i: 0, flip: false, yes: 0, no: 0, missed: [], exam: true};
    App.render(true);
  },
  /**
   * Повторяет карточки, на которых были ошибки.
   */
  'study-missed'() {
    const st = ui.study;
    if (!st) return;
    ui.study = {sid: st.sid, ids: U.shuffle(st.missed.slice()), i: 0, flip: false, yes: 0, no: 0, missed: []};
    App.render();
  },
  /**
   * Переворачивает карточку.
   */
  'study-flip'() {
    if (ui.study && ui.study.i < ui.study.ids.length) {
      ui.study.flip = !ui.study.flip;
      App.render();
    }
  },
  /**
   * Засчитывает карточку как выученную.
   */
  'study-yes'() {
    studyAnswer(true);
  },
  /**
   * Откладывает карточку на повтор.
   */
  'study-no'() {
    studyAnswer(false);
  },
  /**
   * Выходит из режима заучивания.
   */
  'study-exit'() {
    ui.study = null;
    App.render();
  },
  /**
   * Открывает форму новой формулы.
   */
  'formula-add'() {
    openFormulaForm();
  },
  /**
   * Открывает правку формулы.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'formula-edit'(el) {
    openFormulaForm(el.dataset.id);
  },
  /**
   * Удаляет формулу.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'formula-del'(el) {
    if (!(await UI.confirm('Удалить формулу?'))) return;
    const sb = subj(ui.subjectId);
    sb.formulas = sb.formulas.filter(f => f.id !== el.dataset.id);
    Store.commit();
  },
  /**
   * Открывает конспект или файл, связанный с карточкой.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'card-linked'(el) {
    const c = Store.s.cards.find(x => x.id === el.dataset.id),
      sb = c && subj(c.subjectId);
    if (!c || !sb) return;
    if (c.link && /^https?:\/\//i.test(c.link)) {
      window.open(c.link, '_blank', 'noopener');
      return;
    }
    const t = linkTarget(sb);
    if (!t || !subj(t)) return;
    UI.close();
    ui.study = null;
    ui.tab = 'subjects';
    ui.subjectId = t;
    ui.subjTab = 'notes';
    ui.noteQuery = '';
    App.render(true);
    window.scrollTo(0, 0);
  }
});
