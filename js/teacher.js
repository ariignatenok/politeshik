'use strict';

const Teacher = {
  tabs: ['schedule', 'journal', 'news', 'chat', 'settings'],
  /**
   * Проверяет, доступен ли преподавателю раздел.
   * @param {string} tab Идентификатор раздела.
   * @returns {boolean} true, если условие выполнено.
   */
  allows(tab) {
    return Teacher.tabs.indexOf(tab) >= 0;
  },
  /**
   * Проверяет на сервере пароль преподавателя и включает роль.
   * @param {string} secret Пароль преподавателя.
   * @param {string} name Имя преподавателя (необязательно).
   * @returns {Promise<Object>} ok и сообщение об ошибке.
   */
  async activate(secret, name) {
    const code = String(secret || '').trim();
    if (!code)
      return {
        ok: false,
        msg: 'Введите пароль преподавателя'
      };
    try {
      const {data, error} = await supa.rpc('become_teacher', {
        p_secret: code
      });
      if (error)
        return {
          ok: false,
          msg: /ещё не задан/.test(error.message || '')
            ? 'Пароль преподавателя ещё не задан администратором'
            : error.message
        };
      if (data !== true)
        return {
          ok: false,
          msg: 'Неверный пароль преподавателя'
        };
    } catch (error) {
      return {
        ok: false,
        msg: 'Не удалось проверить пароль: нет связи'
      };
    }
    await Cloud.init();
    if (!Cloud.isTeacher)
      return {
        ok: false,
        msg: 'Не удалось получить роль преподавателя'
      };
    await Cloud.saveTeacherName(name);
    return {
      ok: true
    };
  },
  /**
   * Убирает из журнала админа кнопки правки, оставляя только просмотр.
   * @param {string} html HTML журнала.
   * @returns {string} HTML.
   */
  readOnly(html) {
    return html
      .replace(/ data-action="(?:att-edit|stud-open|grp-release|grp-closeday)"/g, '')
      .replace('Папка админа: посещаемость', 'Только чтение: посещаемость');
  },
  /**
   * Строит упрощённый экран настроек преподавателя.
   * @returns {string} HTML.
   */
  settingsHtml() {
    const current = Store.s.settings.theme;
    const themes = Themes.available()
      .map(
        t =>
          '<button class="' +
          (current === t.id ? 'on' : '') +
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
      .join('');
    return (
      '<div class="page-head"><div><h1>Настройки</h1><p>Тема оформления и выход из аккаунта</p></div></div>' +
      '<div class="card set-sec"><h2>Внешний вид</h2><div class="set-row" style="align-items:flex-start"><div><b>Тема оформления</b><p>Выбор сохраняется в вашем профиле</p></div><div class="theme-grid">' +
      themes +
      '</div></div>' +
      '<div class="set-row"><div><b>Наряд Политешика</b><p>Сезонные и праздничные аксессуары</p></div><button class="btn" data-action="mascot-acc">' +
      (Mascot.enabled() ? 'Включён' : 'Выключен') +
      '</button></div></div>' +
      '<div class="card set-sec"><h2>Аккаунт</h2><div class="set-row"><div><b>' +
      ICONS.cloud +
      ' Подключено · преподаватель</b><p>' +
      U.esc((Cloud.profile && Cloud.profile.name) || 'Преподаватель') +
      ': расписание, журнал (только чтение), новости и чат с админом</p></div>' +
      '<button class="btn danger" data-action="logout">Выйти из аккаунта</button></div></div>'
    );
  }
};
