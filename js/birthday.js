'use strict';

const Birthday = {
  /**
   * Разбирает дату рождения ГГГГ-ММ-ДД на год, месяц и день.
   * @param {string} iso Дата рождения ГГГГ-ММ-ДД.
   * @returns {Object|null} Объект.
   */
  parts(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return match
      ? {
          year: +match[1],
          month: +match[2],
          day: +match[3]
        }
      : null;
  },
  /**
   * Проверяет, совпадает ли день и месяц рождения с датой (29 февраля в невисокосный год отмечается 28-го).
   * @param {string} iso Дата рождения ГГГГ-ММ-ДД.
   * @param {Date} date Проверяемый день (по умолчанию сегодня).
   * @returns {boolean} true, если условие выполнено.
   */
  isOn(iso, date) {
    const parts = Birthday.parts(iso);
    if (!parts) return false;
    const today = date || new Date(),
      month = today.getMonth() + 1,
      day = today.getDate();
    if (parts.month === month && parts.day === day) return true;
    const leapYear = new Date(today.getFullYear(), 1, 29).getMonth() === 1;
    return parts.month === 2 && parts.day === 29 && !leapYear && month === 2 && day === 28;
  },
  /**
   * Проверяет, день рождения ли сегодня у текущего пользователя.
   * @returns {boolean} true, если условие выполнено.
   */
  mine() {
    const profile = Cloud.profile;
    return !!(profile && profile.birthday && Birthday.isOn(profile.birthday));
  },
  /**
   * Возвращает имя пользователя без фамилии.
   * @returns {string} Строка.
   */
  firstName() {
    const full = (Cloud.profile && Cloud.profile.name) || Store.s.settings.displayName || '';
    return full.split(/\s+/)[1] || '';
  },
  /**
   * Сохраняет дату рождения из формы профиля: полную в профиль, день и месяц для группы.
   * @param {HTMLElement} form Форма профиля.
   * @returns {Promise<boolean>} удалось ли сохранить.
   */
  async saveFromForm(form) {
    const field = form.querySelector('[name=birthday]'),
      box = form.querySelector('[name=birthdayPublic]');
    if (!field) return true;
    const iso = field.value || '',
      shared = box ? box.checked : true,
      today = U.iso(U.today());
    if (iso && (iso > today || iso < '1940-01-01')) {
      toast('Проверьте дату рождения');
      return false;
    }
    try {
      Cloud.profile.birthday = iso || null;
      Cloud.profile.birthdayPublic = shared;
      await Cloud.saveProfileNow();
    } catch (error) {
      Safe.report('birthday.save', error);
      toast('Не удалось сохранить дату рождения: проверьте связь');
      return true;
    }
    if (Cloud.status === 'online' && supa) {
      try {
        const answer = iso
          ? await supa.rpc('set_birthday', {
              p_date: iso,
              p_public: shared
            })
          : await supa.rpc('clear_birthday');
        if (answer.error) toast('Дата сохранена у вас, но группе её передать не получилось');
      } catch (error) {
        Safe.report('birthday.sync', error);
      }
    }
    Store.s.meta.bdayChecked = '';
    Birthday.ensurePosts();
    return true;
  },
  /**
   * Раз в день просит сервер создать новости-поздравления для именинников и обновляет новости.
   */
  async ensurePosts() {
    const today = U.iso(U.today());
    if (!supa || Cloud.status !== 'online' || !Cloud.hasCabinet() || Store.s.meta.bdayChecked === today) return;
    try {
      const {error} = await supa.rpc('ensure_birthday_posts');
      if (error) return;
      Store.s.meta.bdayChecked = today;
      Store.save();
      await News.refresh();
    } catch (error) {
      return;
    }
  },
  /**
   * Возвращает сегодняшние поздравления одногруппников (кроме своего).
   * @returns {Array<Object>} Массив.
   */
  todayPosts() {
    const today = U.iso(U.today());
    return News.items.filter(n => n.kind === 'birthday' && n.news_date === today && n.subject_uid !== Cloud.uid);
  },
  /**
   * Запускает конфетти в день рождения пользователя (один раз за день).
   */
  celebrate() {
    const today = U.iso(U.today());
    if (!Birthday.mine() || Store.s.meta.bdayShown === today) return;
    Store.s.meta.bdayShown = today;
    Store.save();
    Confetti.burst({
      count: 110
    });
  },
  /**
   * Строит праздничное приветствие Политешика на главной.
   * @returns {string} HTML.
   */
  heroHtml() {
    const name = Birthday.firstName();
    setTimeout(Birthday.celebrate, 500);
    return (
      '<div class="hero card birthday"><div class="hero-av">' +
      Mascot.svg('cheer', 96, '', {
        season: 'birthday'
      }) +
      '</div><div class="hero-t"><b>С днём рождения' +
      (name ? ', ' + U.esc(name) : '') +
      '! ' +
      ICONS.partyPopper +
      '</b>' +
      '<p>Сегодня главный день в группе. Пусть всё получается, пары будут лёгкими, а рядом будут добрые люди.</p><button class="btn sm primary" data-action="bday-confetti">Праздновать ' +
      ICONS.birthdayCake +
      '</button></div></div>'
    );
  },
  /**
   * Строит плашку «Сегодня день рождения у …».
   * @returns {string} HTML.
   */
  bannerHtml() {
    const posts = Birthday.todayPosts();
    if (!posts.length) return '';
    const names = posts.map(p => U.esc(p.subject_name || 'одногруппник')).join(', ');
    return (
      '<button class="bday-banner" data-action="nav" data-tab="news">' +
      ICONS.balloon +
      ' <span>Сегодня день рождения у ' +
      names +
      '. Поздравим?</span></button>'
    );
  }
};
