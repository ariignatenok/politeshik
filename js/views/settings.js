'use strict';

/**
 * Строит настройки уведомлений.
 * @returns {string} HTML.
 */
function notifSettings() {
  const c = Notifier.cfg(),
    p = Notifier.perm(),
    state = Store.s;
  const permTxt =
    p === 'granted'
      ? ICONS.check + ' Разрешены в браузере'
      : p === 'denied'
        ? ICONS.noEntry + ' Запрещены в браузере (разрешите в настройках сайта)'
        : p === 'unsupported'
          ? 'Этот браузер не поддерживает системные уведомления — буду показывать всплывашки'
          : 'Пока не включены';
  return (
    '<div class="card set-sec"><h2>Уведомления</h2><div class="set-row"><div><b>' +
    permTxt +
    '</b><p>Системные уведомления работают, пока приложение открыто или установлено; в закрытом браузере они придут после подключения серверной части.</p></div>' +
    (p === 'default'
      ? '<button class="btn primary" data-action="notif-ask">' + ICONS.bell + ' Включить</button>'
      : '') +
    '</div>' +
    NOTIF_TYPES.map(
      t =>
        '<div class="set-row"><div><b>' +
        t[1] +
        '</b></div><label class="switch"><input type="checkbox" data-change="notif-toggle" data-k="' +
        t[0] +
        '"' +
        (c[t[0]] !== false ? ' checked' : '') +
        '><span></span></label></div>'
    ).join('') +
    '<div class="set-row"><div><b>' +
    ICONS.moon +
    ' Тихие часы 23:00–7:00</b><p>Кроме отмены пары в тот же день</p></div><label class="switch"><input type="checkbox" data-change="notif-toggle" data-k="quiet"' +
    (c.quiet !== false ? ' checked' : '') +
    '><span></span></label></div>' +
    '<div class="set-row"><div><b>За сколько минут напоминать о паре</b></div><div class="seg">' +
    [5, 10, 15, 30]
      .map(
        m =>
          '<button class="' +
          (c.lead === m ? 'on' : '') +
          '" data-action="notif-lead" data-m="' +
          m +
          '">' +
          m +
          '</button>'
      )
      .join('') +
    '</div></div>' +
    '<div class="set-row" style="align-items:flex-start"><div><b>Предметы без напоминаний</b><p>Отметьте предметы, о парах которых напоминать не нужно</p></div><div class="checks">' +
    state.subjects
      .map(
        x =>
          '<label><input type="checkbox" data-change="notif-mute" data-id="' +
          x.id +
          '"' +
          (c.mute[x.id] ? ' checked' : '') +
          '><span>' +
          U.esc(x.short || x.name) +
          '</span></label>'
      )
      .join('') +
    '</div></div></div>'
  );
}
/**
 * Отрисовывает экран «Настройки».
 * @returns {string} HTML.
 */
function viewSettings() {
  const state = Store.s,
    cur = weekType(new Date());
  if (Roles.isOwner() && ui.setTab === 'access') return viewAccess();
  if (Cloud.isStaff) return Teacher.settingsHtml();
  return (
    Roles.settingsTabs() +
    '<div class="page-head"><div><h1>Настройки</h1><p>Тема, чётность недели и резервная копия данных</p></div></div>' +
    (Store.persistent
      ? ''
      : '<div class="warn">' +
        ICONS.warning +
        ' Браузер не разрешает сохранять данные на этом устройстве — изменения пропадут после закрытия. Делайте экспорт в JSON.</div>') +
    '<div class="card set-sec"><h2>Внешний вид</h2><div class="set-row" style="align-items:flex-start"><div><b>Тема оформления</b><p>7 тем; выбор сохраняется в профиле</p></div><div class="theme-grid">' +
    Themes.available()
      .map(
        t =>
          '<button class="' +
          (state.settings.theme === t.id ? 'on' : '') +
          '" data-action="set-theme" data-theme="' +
          t.id +
          '"><span class="sw" style="background:' +
          t.sw +
          '"></span>' +
          t.ico +
          ' ' +
          t.name +
          '</button>'
      )
      .join('') +
    '</div></div>' +
    '<div class="set-row"><div><b>Наряд Политешика</b><p>Сезонные и праздничные аксессуары</p></div><button class="btn" data-action="mascot-acc">' +
    (Mascot.enabled() ? 'Включён' : 'Выключен') +
    '</button></div></div>' +
    notifSettings() +
    '<div class="card set-sec"><h2>Расписание</h2>' +
    '<div class="set-row"><div><b>Сейчас идёт: ' +
    WEEK_NAME[cur] +
    '</b><p>Если чередование перепутано — поменяйте местами числитель и знаменатель</p></div><button class="btn" data-action="swap-week">' +
    ICONS.repeat +
    ' Поменять местами</button></div>' +
    '<div class="set-row"><div><b>Время пар</b><p>Звонки: ' +
    (state.settings.pairs.some(p => p.start) ? 'заданы' : 'не заданы') +
    ' · пар в сетке: ' +
    state.settings.pairs.length +
    '</p></div><button class="btn" data-action="times">' +
    ICONS.stopwatch +
    ' Настроить</button></div></div>' +
    '<div class="card set-sec"><h2>Аккаунт и облако</h2><div class="set-row"><div><b>' +
    (Cloud.status === 'online'
      ? ICONS.cloud + ' Подключено' + (Cloud.isAdmin ? ' · админ группы' : '')
      : Cloud.status === 'pending'
        ? 'Подключение…'
        : 'Без облака') +
    '</b><p>' +
    (Cloud.status === 'online'
      ? 'Вы вошли в Политешик. Отметки, справки и чат синхронизируются с админом группы.'
      : 'Откройте приложение по приглашению админа и войдите в Claude — тогда заработают общая посещаемость, справки и общие работы.') +
    '</p></div>' +
    (Cloud.status === 'online'
      ? '<div class="head-actions"><button class="btn" data-action="profile-edit">' +
        ICONS.pencil +
        ' Профиль</button><button class="btn danger" data-action="logout">Выйти из аккаунта</button></div>'
      : '') +
    '</div>' +
    (Cloud.err ? '<div class="warn">Облако ответило ошибкой: ' + U.esc(Cloud.err) + '</div>' : '') +
    '</div>' +
    '<div class="card set-sec"><h2>Как приложение</h2>' +
    '<div class="set-row"><div><b>Установка</b><p>Компьютер: Safari — «Файл → Добавить в Dock», Chrome или Edge — меню → «Установить…». iPhone и iPad: «Поделиться» → «На экран Домой». Если такого пункта нет — добавьте страницу в закладки.</p></div>' +
    (installEvt
      ? '<button class="btn primary" data-action="install">' + ICONS.mobileArrow + ' Установить</button>'
      : '') +
    '</div>' +
    '<div class="set-row"><div><b>Обновления</b><p>Новые версии выходят по той же ссылке — достаточно обновить страницу. Ваши данные лежат в браузере и при обновлении сохраняются.</p></div></div></div>' +
    '<div class="card set-sec"><h2>Данные</h2>' +
    '<div class="set-row"><div><b>Экспорт в JSON</b><p>Сохраните файл или скопируйте текст — это резервная копия всего планировщика</p></div><div class="head-actions"><button class="btn primary" data-action="export">' +
    ICONS.arrowDown +
    ' Скачать</button><button class="btn" data-action="export-show">' +
    ICONS.clipboard +
    ' Показать текст</button></div></div>' +
    '<div class="set-row"><div><b>Импорт из JSON</b><p>Заменит текущие данные содержимым файла</p></div><div class="head-actions"><label class="btn" style="cursor:pointer">' +
    ICONS.openFolder +
    ' Выбрать файл<input type="file" accept=".json,application/json" data-change="import-file" hidden></label><button class="btn" data-action="import-paste">' +
    ICONS.inboxTray +
    ' Вставить текст</button></div></div>' +
    '<div class="set-row"><div><b>Стартовые конспекты и карточки</b><p>Вернёт удалённые стартовые материалы; ваши записи не затронет</p></div><button class="btn" data-action="restore-content">' +
    ICONS.books +
    ' Вернуть</button></div>' +
    '<div class="set-row"><div><b>Начальные данные</b><p>Вернуть расписание, преподавателей и работы, с которых всё начиналось</p></div><button class="btn danger" data-action="reset">' +
    ICONS.undo +
    ' Сбросить</button></div>' +
    '<div class="set-row"><div><b>Очистить всё</b><p>Удалит предметы, расписание, конспекты и всё остальное</p></div><button class="btn danger" data-action="clear">' +
    ICONS.wastebasket +
    ' Очистить</button></div></div>' +
    '<p class="hint">Данные хранятся только в этом браузере (localStorage, ключ studyPlanner).</p>'
  );
}
