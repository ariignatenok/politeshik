'use strict';

Object.assign(A, {
  /**
   * Переключает вход между студентом и преподавателем.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'login-role'(el) {
    const form = $('#gate [data-form="login"]'),
      email = form ? form.querySelector('[name=email]') : null;
    ui.loginDraft = {
      email: email ? email.value : ''
    };
    ui.loginRole = el.dataset.role === 'teacher' ? 'teacher' : 'student';
    $('#gate').dataset.mode = '';
    App.render();
  },
  /**
   * Скачивает файл календаря для одного дедлайна.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'ics-item'(el) {
    const item = dashItems().find(i => i.id === el.dataset.id);
    if (!item) return;
    Ics.download([item], 'politeshik-' + Ics.slug(item.title));
    toast('Файл календаря сохранён. Откройте его, чтобы добавить событие.');
  },
  /**
   * Скачивает файл календаря со всеми ближайшими дедлайнами.
   */
  'ics-all'() {
    const items = dashItems().filter(i => !i.done);
    if (!items.length) return toast('Нет ближайших дедлайнов');
    Ics.download(items, 'politeshik-dedlajny');
    toast('Календарь сохранён: ' + items.length + ' ' + U.plural(items.length, 'событие', 'события', 'событий'));
  },
  /**
   * Открывает окно поиска.
   */
  'search-open'() {
    Search.open();
  },
  /**
   * Открывает меню быстрого добавления.
   */
  'fab-toggle'() {
    QuickAdd.toggle();
  },
  /**
   * Выполняет выбранное быстрое действие.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'fab-pick'(el) {
    QuickAdd.pick(el.dataset.pick);
  },
  /**
   * Открывает конспекты предмета из окна о пропущенных парах.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'sick-notes'(el) {
    UI.close();
    ui.tab = 'subjects';
    ui.subjectId = el.dataset.id;
    ui.subjTab = 'notes';
    App.render(true);
  },
  /**
   * Включает или выключает сезонный наряд Политешика.
   */
  'mascot-acc'() {
    Store.s.settings.mascotAccessories = !Mascot.enabled();
    Store.save();
    ['brand-mascot', 'top-mascot'].forEach(id => {
      const node = document.getElementById(id);
      if (node) node.dataset.m = '';
    });
    App.render(true);
    toast(Mascot.enabled() ? 'Наряд Политешика включён' : 'Наряд Политешика выключен');
  },
  /**
   * Сохраняет настроение дня.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  mood(el) {
    Support.setMood(el.dataset.v);
  },
  /**
   * Отправляет обнимашки в чате с Политешиком.
   */
  hug() {
    Support.hug();
  },
  /**
   * Запускает праздничное конфетти.
   */
  'bday-confetti'() {
    Confetti.burst({
      count: 110
    });
  },
  /**
   * Ставит или снимает лайк новости.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'news-like'(el) {
    await News.like(el.dataset.id);
    App.render();
  },
  /**
   * Листает расписание на неделю назад или вперёд.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'sched-nav'(el) {
    ui.schedWs = Weeks.shift(ui.schedWs || Weeks.start(U.today()), +el.dataset.step);
    ui.schedDayWs = ui.schedWs;
    App.render();
  },
  /**
   * Возвращает расписание к текущей неделе.
   */
  'sched-today'() {
    ui.schedWs = Weeks.start(U.today());
    ui.schedDay = U.dayIdx(new Date());
    ui.schedDayWs = ui.schedWs;
    App.render();
  },
  /**
   * Возвращает выбранную неделю к шаблону.
   */
  async 'sched-reset'() {
    const ws = ui.schedWs;
    if (!ws || !Weeks.has(ws)) return;
    if (
      !(await UI.confirm('Вернуть неделю ' + Weeks.label(ws) + ' к шаблону? Правки этой недели пропадут.', 'Вернуть'))
    )
      return;
    Weeks.reset(ws);
    Store.commit();
    toast('Неделя возвращена к шаблону');
  },
  /**
   * Копирует расписание этой недели на следующую.
   */
  async 'sched-copy-next'() {
    const ws = ui.schedWs,
      next = Weeks.shift(ws, 1);
    if (
      Weeks.has(next) &&
      !(await UI.confirm('На следующей неделе уже есть свои правки. Заменить их копией этой недели?', 'Заменить'))
    )
      return;
    Weeks.copy(ws, next);
    Weeks.prune();
    Store.commit();
    toast('Скопировано на неделю ' + Weeks.label(next));
  },
  /**
   * Открывает дыхательные упражнения.
   */
  'relax-open'() {
    Relax.open();
  },
  /**
   * Запускает выбранное упражнение.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'relax-start'(el) {
    Relax.start(el.dataset.id);
  },
  /**
   * Возвращает к списку упражнений.
   */
  'relax-menu'() {
    Relax.stop();
    const body = document.querySelector('#modal-root .modal-body');
    if (body) body.innerHTML = Relax.menuHtml();
  },
  /**
   * Перезагружает страницу.
   */
  'reload-app'() {
    window.location.reload();
  },
  /**
   * Включает или выключает аксессуар Политешика.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'my-acc'(el) {
    Mascot.setAccessory(el.dataset.id);
    App.render();
  },
  /**
   * Выбирает эмоцию дня Политешика.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'my-mood'(el) {
    Mascot.chooseMood(el.dataset.mood);
    App.render();
  },
  /**
   * Возвращает Политешика к обычному виду.
   */
  'my-mascot-reset'() {
    Mascot.resetLook();
    App.render();
    toast('Политешик снова обычный');
  },
  /**
   * Переключает этаж на карте.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'map-floor'(el) {
    ui.mapFloor = +el.dataset.floor;
    ui.mapPlacing = false;
    App.render();
  },
  /**
   * Включает режим постановки точки «Я здесь».
   */
  'map-here'() {
    ui.mapPlacing = !ui.mapPlacing;
    App.render();
  },
  /**
   * Убирает свою точку с карты.
   */
  async 'map-clear'() {
    await CampusMap.clear();
    toast('Точка убрана');
  },
  /**
   * Открывает форму готового ДЗ.
   */
  'sol-add'() {
    openSolutionForm();
  },
  /**
   * Удаляет готовое решение.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'sol-del'(el) {
    if (!(await UI.confirm('Удалить это решение?', 'Удалить'))) return;
    const result = await Solutions.remove(el.dataset.uid, el.dataset.id);
    if (!result.ok) return toast('Не удалось удалить: ' + result.error);
    App.render();
    toast('Решение удалено');
  },
  /**
   * Скачивает файл решения.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'sol-file-dl'(el) {
    toast('Скачиваю файл…');
    try {
      const file = await Cloud.getSolutionFile(el.dataset.uid, el.dataset.id);
      if (!file || !file.data) return toast('Файл не найден');
      downloadBlob(await (await fetch(file.data)).blob(), file.name || el.dataset.name || 'file');
    } catch (error) {
      toast('Не удалось скачать файл');
    }
  },
  /**
   * Убирает файл из формы решения.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'sol-file-rm'(el) {
    ui.solFiles.splice(+el.dataset.index, 1);
    const box = document.getElementById('sol-files');
    if (box) box.innerHTML = solutionFilesHtml();
  },
  /**
   * Открывает фокус-режим.
   */
  'focus-open'() {
    Focus.open();
  },
  /**
   * Запускает фокус-таймер.
   */
  'focus-start'() {
    Focus.start();
  },
  /**
   * Останавливает фокус-таймер.
   */
  'focus-stop'() {
    Focus.stop();
  },
  /**
   * Запускает фокус-таймер заново.
   */
  'focus-restart'() {
    Focus.restart();
  },
  /**
   * Переключает вход между студентом и преподавателем.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'login-role'(el) {
    const form = el.closest('.gate-card');
    ui.loginDraft = Object.assign({}, ui.loginDraft || {}, {
      email: (form.querySelector('[name=email]') || {}).value || '',
      person_name: (form.querySelector('[name=person_name]') || {}).value || '',
      child_name: (form.querySelector('[name=child_name]') || {}).value || '',
      person_note: (form.querySelector('[name=person_note]') || {}).value || '',
      teacher_name: (form.querySelector('[name=teacher_name]') || {}).value || ''
    });
    ui.loginRole = el.dataset.role;
    $('#gate').dataset.mode = '';
    App.render(true);
  },
  /**
   * Проверяет, одобрена ли заявка.
   */
  async 'pending-check'() {
    await Cloud.refreshMember();
    if (Cloud.role === 'pending') return toast('Заявка пока ждёт решения');
    await Cloud.init();
    App.render(true);
  },
  /**
   * Переключает вкладки в настройках.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'set-tab'(el) {
    ui.setTab = el.dataset.tab;
    App.render(true);
  },
  /**
   * Включает режим просмотра выбранной роли (только внешний вид).
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'view-as'(el) {
    if (!Roles.isOwner()) return;
    Store.s.settings.viewAs = el.dataset.role === 'admin' ? '' : el.dataset.role;
    Store.save();
    Cloud.applyRole();
    await Cloud.loadChild();
    ui.tab = 'settings';
    ui.setTab = 'access';
    App.render(true);
    toast('Режим просмотра: ' + Roles.names[Cloud.role]);
  },
  /**
   * Одобряет заявку с выбранной ролью и группой.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'req-approve'(el) {
    const card = el.closest('[data-form="req"]'),
      pick = name => (card.querySelector('[name=' + name + ']') || {}).value || '';
    const result = await Cloud.decide(card.dataset.uid, true, pick('role'), pick('group'), pick('child') || null);
    toast(result.ok ? 'Заявка одобрена' : 'Не удалось: ' + result.error);
  },
  /**
   * Отклоняет заявку.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'req-reject'(el) {
    if (!(await UI.confirm('Отклонить заявку?', 'Отклонить'))) return;
    const result = await Cloud.decide(el.closest('[data-form="req"]').dataset.uid, false);
    toast(result.ok ? 'Заявка отклонена' : 'Не удалось: ' + result.error);
  },
  /**
   * Обновляет список заявок.
   */
  async 'req-refresh'() {
    await Cloud.loadRequests(true);
    App.render();
  },
  /**
   * Включает или выключает обязательное одобрение.
   */
  async 'req-toggle'() {
    const result = await Cloud.setRequireApproval(Cloud.needApproval === false);
    toast(
      result.ok
        ? Cloud.needApproval
          ? 'Одобрение включено'
          : 'Новые студенты получают доступ сразу'
        : 'Не удалось: ' + result.error
    );
    App.render();
  },
  /**
   * Выбирает фильтр списка студентов.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  't-filter'(el) {
    ui.tFilter = el.dataset.id;
    App.render();
  },
  /**
   * Открывает личную заметку о студенте.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  't-note'(el) {
    openTeacherNote(el.dataset.uid);
  },
  /**
   * Открывает форму консультации.
   */
  'consult-add'() {
    openConsultForm();
  },
  /**
   * Удаляет консультацию.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'consult-del'(el) {
    const result = await Cloud.saveConsults((Cloud.consults || []).filter(c => c.id !== el.dataset.id));
    if (!result.ok) return toast('Не удалось удалить: ' + result.error);
    App.render();
  },
  /**
   * Скачивает список студентов в CSV.
   */
  'texport-students'() {
    const lines = [Roles.csvLine(['Студент', 'Подгруппа', 'Посещаемость за месяц, %', 'Пропусков', 'По справке'])];
    Roles.studentList().forEach(s => {
      const x = Roles.stats(s.uid);
      lines.push(Roles.csvLine([s.name, s.subgroup, x.pct == null ? '' : x.pct, x.absent, x.excused]));
    });
    Roles.download(lines, 'studenty-' + U.iso(U.today()) + '.csv');
  },
  /**
   * Загружает и скачивает отчёт отделения.
   */
  async 'dept-report'() {
    const result = await Cloud.loadDeptReport();
    if (!result.ok) return toast('Не удалось получить отчёт: ' + result.error);
    const lines = [Roles.csvLine(['Группа', 'Куратор', 'Студентов', 'Заявок'])];
    Cloud.deptReport.forEach(r => lines.push(Roles.csvLine([r.group_name, r.curator, r.students, r.pending])));
    Roles.download(lines, 'otchet-otdeleniya-' + U.iso(U.today()) + '.csv');
    App.render();
  },
  /**
   * Удаляет новость отделения.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'dept-news-del'(el) {
    if (!(await UI.confirm('Удалить новость?', 'Удалить'))) return;
    const {error} = await supa.from('news').delete().eq('id', el.dataset.id);
    if (error) return toast('Не удалось удалить: ' + error.message);
    await News.refresh();
    App.render();
  },
  /**
   * Открывает замену расписания.
   */
  'sched-import'() {
    openScheduleImport();
  },
  /**
   * Заменяет расписание встроенным новым после подтверждения.
   */
  async 'sched-import-bundled'() {
    const result = ScheduleImport.bundled();
    if (
      !(await UI.confirm(
        'Удалить ВСЕ текущие пары и загрузить новое расписание (' +
          result.lessons.length +
          ' пар: числитель с 26.10, знаменатель со 02.11)? Копия старого скачается файлом.',
        'Заменить'
      ))
    )
      return;
    ScheduleImport.apply(result);
    UI.close();
    App.render(true);
    toast('Новое расписание загружено: ' + result.lessons.length + ' пар');
  },
  /**
   * Проверяет вставленное расписание и показывает итог.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'sched-import-check'(el) {
    const form = el.closest('[data-form="sched-import"]'),
      result = ScheduleImport.parse((form.querySelector('[name=text]') || {}).value || '');
    ui.schedImport = result;
    $('#sched-import-preview').innerHTML = ScheduleImport.previewHtml(result);
  },
  /**
   * Заменяет расписание целиком после подтверждения.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'sched-import-apply'(el) {
    const form = el.closest('[data-form="sched-import"]'),
      result = ScheduleImport.parse((form.querySelector('[name=text]') || {}).value || '');
    $('#sched-import-preview').innerHTML = ScheduleImport.previewHtml(result);
    if (result.errors.length) return toast('Исправьте ошибки в расписании: ничего не заменено');
    if (!result.lessons.length) return toast('В расписании нет ни одной пары');
    if (
      !(await UI.confirm(
        'Удалить ВСЕ текущие пары и загрузить ' +
          result.lessons.length +
          ' новых? Копия старого расписания скачается файлом.',
        'Заменить'
      ))
    )
      return;
    ScheduleImport.apply(result);
    UI.close();
    App.render(true);
    toast('Расписание заменено: ' + result.lessons.length + ' пар');
  }
});
