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
    const draft = Object.assign({}, ui.loginDraft || {});
    ['email', 'person_name', 'child_name', 'person_note', 'teacher_name', 'group_code', 'consent'].forEach(name => {
      const input = form.querySelector('[name=' + name + ']');
      if (input) draft[name] = input.type === 'checkbox' ? input.checked : input.value;
    });
    ui.loginDraft = draft;
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
    ui.tab = el.dataset.tab === 'access' ? 'access' : 'settings';
    ui.setTab = 'main';
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
    ui.tab = 'access';
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
  },
  /**
   * Прикрепляет новое расписание к неделям 26.10 и 02.11 после подтверждения.
   */
  async 'sched-two-weeks'() {
    if (
      !(await UI.confirm(
        'Прикрепить новое расписание к неделям 26–31 октября и 2–7 ноября? Остальные недели не изменятся. Копия прежнего скачается файлом.',
        'Прикрепить'
      ))
    )
      return;
    ScheduleImport.applyTwoWeeks();
    ui.schedWs = ScheduleImport.twoWeekStarts[0];
    ui.schedDayWs = ui.schedWs;
    App.render(true);
    toast('Расписание прикреплено к двум неделям: 26.10–31.10 и 02.11–07.11');
  },
  /**
   * Выбирает фильтр списка пользователей.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'user-filter'(el) {
    ui.userFilter = el.dataset.id;
    App.render();
  },
  /**
   * Обновляет список пользователей.
   */
  async 'users-refresh'() {
    await Cloud.loadUsers(true);
    App.render();
  },
  /**
   * Банит пользователя после подтверждения.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'user-ban'(el) {
    const user = Cloud.users.find(u => u.uid === el.dataset.uid);
    if (
      !user ||
      !(await UI.confirm(
        'Забанить ' +
          (user.full_name || user.email) +
          '? Доступ закроется сразу, при входе будет написано, что аккаунт заблокирован.',
        'Забанить'
      ))
    )
      return;
    const result = await Users.act('admin_set_status', {
      p_uid: user.uid,
      p_status: 'banned'
    });
    toast(result.ok ? 'Пользователь забанен' : 'Не удалось: ' + result.error);
  },
  /**
   * Снимает бан.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'user-unban'(el) {
    const result = await Users.act('admin_set_status', {
      p_uid: el.dataset.uid,
      p_status: 'approved'
    });
    toast(result.ok ? 'Бан снят' : 'Не удалось: ' + result.error);
  },
  /**
   * Удаляет аккаунт пользователя и его данные после подтверждения.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'user-delete'(el) {
    const user = Cloud.users.find(u => u.uid === el.dataset.uid);
    if (
      !user ||
      !(await UI.confirm(
        'Удалить аккаунт ' +
          user.email +
          ' и все его данные? Эту почту можно будет зарегистрировать заново, а ФИО освободится (занять его снова можно только с кодом группы).',
        'Удалить'
      ))
    )
      return;
    const result = await Users.act('admin_delete_user', {
      p_uid: user.uid
    });
    toast(result.ok ? 'Аккаунт удалён' : 'Не удалось: ' + result.error);
  },
  /**
   * Генерирует новый код группы.
   */
  async 'gcode-new'() {
    if (
      Cloud.groupCodes.some(c => c.active) &&
      !(await UI.confirm('Создать новый код? Прежний перестанет работать.', 'Создать'))
    )
      return;
    const result = await Cloud.groupCodeCall('create_group_code');
    if (!result.ok) return toast('Не удалось: ' + result.error);
    App.render();
    toast('Новый код: ' + result.data);
  },
  /**
   * Отключает код группы.
   */
  async 'gcode-off'() {
    const active = Cloud.groupCodes.find(c => c.active);
    if (
      !active ||
      !(await UI.confirm('Отключить код ' + active.code + '? Зарегистрироваться по нему будет нельзя.', 'Отключить'))
    )
      return;
    const result = await Cloud.groupCodeCall('disable_group_code', {
      p_code: active.code
    });
    toast(result.ok ? 'Код отключён' : 'Не удалось: ' + result.error);
    App.render();
  },
  /**
   * Включает или выключает обязательный код при регистрации.
   */
  async 'gcode-require'() {
    const result = await Cloud.groupCodeCall('set_require_code', {
      p_on: Cloud.codeRequired === false
    });
    toast(
      result.ok
        ? Cloud.codeRequired
          ? 'Код при регистрации включён'
          : 'Код при регистрации выключен'
        : 'Не удалось: ' + result.error
    );
    App.render();
  },
  /**
   * Копирует код группы.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'gcode-copy'(el) {
    try {
      await navigator.clipboard.writeText(el.dataset.code);
      toast('Код скопирован');
    } catch (error) {
      toast('Скопируйте код вручную: ' + el.dataset.code);
    }
  },
  /**
   * Отправляет заявку с кодом группы.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'code-send'(el) {
    const form = el.closest('[data-form="code"]'),
      code = ((form.querySelector('[name=group_code]') || {}).value || '').trim();
    if (!code) return toast('Введите код группы');
    const asParent = Cloud.profile && Cloud.profile.role === 'parent',
      result = await Cloud.requestAccess(
        asParent ? 'parent' : 'student',
        (Cloud.profile && Cloud.profile.name) || '',
        '',
        '',
        code
      );
    if (!result.ok) return toast(result.error);
    ui.groupCode = code;
    try {
      window.localStorage.setItem('politeshik:gc', code);
    } catch (error) {}
    App.render(true);
  },
  /**
   * Показывает пояснение к согласию на обработку данных.
   */
  'consent-info'() {
    UI.open('Согласие на обработку персональных данных', Signup.consentText(), {
      noFocus: true
    });
  },
  /**
   * Отправляет письмо с подтверждением почты ещё раз.
   */
  async 'confirm-resend'() {
    const email = (ui.confirmEmail || {}).email;
    if (!email) return;
    const result = await Cloud.resendConfirm(email);
    toast(
      result.ok
        ? 'Письмо отправлено ещё раз. Проверьте почту и папку «Спам»'
        : 'Не удалось отправить письмо: ' + result.error
    );
  },
  /**
   * Возвращает к входу после подтверждения почты.
   */
  'confirm-back'() {
    ui.confirmEmail = null;
    $('#gate').dataset.mode = '';
    App.render(true);
    toast('Теперь войдите с почтой и паролем');
  },
  /**
   * Отправляет заявку после подтверждения почты по ссылке.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'complete-send'(el) {
    const form = el.closest('[data-form="complete"]'),
      role = form.dataset.role,
      read = name => ((form.querySelector('[name=' + name + ']') || {}).value || '').trim();
    el.disabled = true;
    try {
      if (role === 'parent' && read('group_code')) {
        ui.groupCode = read('group_code');
        try {
          window.localStorage.setItem('politeshik:gc', ui.groupCode);
        } catch (error) {}
      }
      if (role === 'teacher') {
        const activation = await Teacher.activate(read('teacher_secret'), read('teacher_name'));
        if (!activation.ok) return toast(activation.msg);
      } else {
        const problem = Roles.checkExtra(role, form);
        if (problem) return toast(problem);
        const registration = await Roles.registerExtra(role, form);
        if (!registration.ok) return toast(registration.msg);
        await Cloud.init();
      }
    } finally {
      el.disabled = false;
      $('#gate').dataset.mode = '';
      App.render(true);
    }
  },
  /**
   * Открывает окно ввода посещаемости из журнала.
   */
  'qa-open'() {
    QuickAtt.open();
  },
  /**
   * Вносит расписание начала октября после подтверждения.
   */
  async 'qa-weeks'() {
    if (
      !(await UI.confirm(
        'Внести расписание за 28.09–17.10 со скриншотов? Правки этих трёх недель будут заменены, остальные недели не изменятся.',
        'Внести'
      ))
    )
      return;
    QuickAtt.applyWeeks();
    QuickAtt.open();
    toast('Расписание начала октября внесено');
  },
  /**
   * Заполняет поле списком пар 1–14 октября.
   */
  'qa-fill'() {
    if (!QuickAtt.isLoaded()) return toast('Сначала внесите расписание начала октября');
    const box = document.getElementById('qa-text');
    if (box) box.value = QuickAtt.template();
  },
  /**
   * Проверяет введённые строки и вносит отметки на сервере.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'qa-apply'(el) {
    const box = document.getElementById('qa-text'),
      msg = document.getElementById('qa-msg');
    const parsed = QuickAtt.parse(box ? box.value : '');
    if (parsed.errors.length) {
      msg.innerHTML = parsed.errors.map(error => '<div class="qa-bad">' + U.esc(error) + '</div>').join('');
      return;
    }
    if (!parsed.items.length) {
      msg.textContent = 'Нет заполненных строк: впишите номера после двоеточия или «-».';
      return;
    }
    const name = n => ROSTER.find(r => r.n === n).name.split(' ')[0];
    msg.innerHTML = parsed.items
      .map(
        i =>
          '<div><b>' +
          U.esc(i.date.split('-').reverse().join('.') + ' пара ' + i.pair) +
          '</b> ' +
          U.esc(i.title) +
          ': «Н» — ' +
          (i.absent.length ? U.esc(i.absent.map(n => n + ' ' + name(n)).join(', ')) : 'никого') +
          '; «П» — ' +
          i.present.length +
          (i.ignored.length
            ? ' <span class="qa-bad">пропущены (не из подгруппы пары): ' + U.esc(i.ignored.join(', ')) + '</span>'
            : '') +
          '</div>'
      )
      .join('');
    const nAbs = parsed.items.reduce((s, i) => s + i.absent.length, 0),
      nPres = parsed.items.reduce((s, i) => s + i.present.length, 0);
    if (
      !(await UI.confirm(
        'Внести пары: ' +
          parsed.items.length +
          ' (отметок «Н»: ' +
          nAbs +
          ', «П»: ' +
          nPres +
          ')? Уже стоящие отметки не изменятся. Проверьте список под полем ввода.',
        'Внести'
      ))
    )
      return;
    el.disabled = true;
    try {
      const result = await QuickAtt.rpc('import_attendance', {
        p_items: parsed.items.map(i => ({
          key: i.key,
          absent: i.absent.map(n => 'r' + n),
          present: i.present.map(n => 'r' + n)
        }))
      });
      if (!result.ok) {
        msg.innerHTML = '<div class="qa-bad">Не удалось внести: ' + U.esc(result.error) + '</div>';
        return;
      }
      box.value = '';
      msg.textContent = '';
      toast(
        'Внесено пар: ' +
          parsed.items.length +
          '. Отметки уже зарегистрированным: ' +
          result.data.applied +
          ', остальным: при регистрации'
      );
      await QuickAtt.reloadAtt();
      QuickAtt.refreshList();
    } finally {
      el.disabled = false;
    }
  },
  /**
   * Отменяет внесённые из журнала отметки одной пары.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'qa-undo'(el) {
    const key = el.dataset.key;
    if (
      !(await UI.confirm(
        'Отменить внесённое за ' +
          key.split('|')[0].split('-').reverse().slice(0, 2).join('.') +
          ' пара ' +
          key.split('|')[1] +
          '? Эти отметки удалятся у студентов (ручные не затрагиваются).',
        'Отменить'
      ))
    )
      return;
    const result = await QuickAtt.rpc('import_attendance_undo', {
      p_key: key
    });
    toast(result.ok ? 'Отменено, убрано отметок: ' + result.data : 'Не удалось: ' + result.error);
    await QuickAtt.reloadAtt();
    QuickAtt.refreshList();
  }
});
