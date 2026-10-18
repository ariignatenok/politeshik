'use strict';

const Support = {
  phrases: [
    'Ты молодец, что зашёл.',
    'Даже если ты ничего не сделал, ты уже красавчик.',
    'Ошибки — это опыт.',
    'Маленький шаг сегодня лучше большого плана на потом.',
    'Ты справляешься лучше, чем думаешь.',
    'Отдых тоже часть учёбы.'
  ],
  motivation:
    'Слушай, я вижу, ты пропускаешь пары. Давай так: сходи на одну сегодня, и я дам тебе ачивку. Если тяжело, просто посиди 10 минут и уйди, никто не осудит.',
  comfort: 'Не переживай, все успеем. Здоровье важнее. Воды попей.',
  hugs: [
    'Иди сюда, обнимаю! Ты не один(а), я рядом. Давай по шагу: сначала глубокий вдох.',
    'Обнимашки! Всё трудное когда-нибудь заканчивается, а ты уже столько всего прошёл(а).',
    'Держу за лапку. Попей воды, выдохни, и начнём с самого маленького дела.',
    'Ты важен(на) не за оценки, а просто так. Обнимаю крепко!'
  ],
  moods: {
    good: 'Рад за тебя! Так держать.',
    ok: 'Бывает. Я рядом, справимся.',
    bad: 'Мне жаль, что тяжело. Нажми «Мне нужна поддержка» в чате со мной.'
  },
  /**
   * Выбирает фразу дня: одна и та же в течение суток.
   * @returns {string} Строка.
   */
  dailyPhrase() {
    const day = Math.floor(U.today().getTime() / 864e5);
    return Support.phrases[day % Support.phrases.length];
  },
  /**
   * Если посещаемость за месяц ниже 70%, раз в неделю пишет студенту поддержку и обещает ачивку.
   * @returns {boolean} отправлено ли сообщение.
   */
  checkAttendance() {
    if (Cloud.isAdmin || Cloud.isTeacher) return false;
    const meta = Store.s.meta,
      today = U.iso(U.today()),
      monthStart = today.slice(0, 7) + '-01';
    if (today < ATT_START || (meta.motivationAt && U.dayDiff(U.fromISO(meta.motivationAt), U.fromISO(today)) < 7))
      return false;
    const stats = Att.stats(
      Store.s.attendance.marks,
      Cloud.my.certs,
      Store.s.settings.subgroup,
      monthStart < ATT_START ? ATT_START : monthStart,
      today
    );
    if (stats.pct == null || stats.p + stats.l + stats.a < 4 || stats.pct >= 70) return false;
    meta.motivationAt = today;
    Store.save();
    Chat.push('bot', Support.motivation, {
      mood: 'worried'
    });
    return true;
  },
  /**
   * Раз в день пишет слова поддержки (после больничного или грустного настроения).
   * @returns {boolean} отправлено ли сообщение.
   */
  comfortOnce() {
    if (Cloud.isTeacher) return false;
    const meta = Store.s.meta,
      today = U.iso(U.today());
    if (meta.comfortAt === today) return false;
    meta.comfortAt = today;
    Store.save();
    Chat.push('bot', Support.comfort, {
      mood: 'happy'
    });
    return true;
  },
  /**
   * Отправляет в чат «Обнимашки»: стикер и тёплые слова.
   */
  hug() {
    Chat.push('me', 'Мне нужна поддержка');
    Chat.push('bot', Support.hugs[Math.floor(Math.random() * Support.hugs.length)], {
      mood: 'cheer',
      sticker: 'hug'
    });
    App.render();
  },
  /**
   * Возвращает сегодняшнее настроение студента.
   * @returns {string} good, ok, bad или пустая строка.
   */
  moodToday() {
    return (Store.s.meta.moods || {})[U.iso(U.today())] || '';
  },
  /**
   * Запоминает настроение на сегодня; при грусти Политешик поддерживает.
   * @param {string} value Настроение: good, ok или bad.
   */
  setMood(value) {
    if (!Support.moods[value]) return;
    const meta = Store.s.meta,
      today = U.iso(U.today());
    meta.moods = meta.moods || {};
    meta.moods[today] = value;
    Object.keys(meta.moods)
      .sort()
      .slice(0, -60)
      .forEach(k => {
        delete meta.moods[k];
      });
    Store.save();
    if (value === 'bad') Support.comfortOnce();
    App.render();
  },
  /**
   * Строит стикер-обнимашку с сердечками.
   * @returns {string} HTML.
   */
  stickerHtml() {
    return (
      '<div class="hug-sticker">' +
      Mascot.svg('cheer', 104, 'hug-m', {
        season: ''
      }) +
      '<span class="hug-heart h1">' +
      ICONS.redHeart +
      '</span><span class="hug-heart h2">' +
      ICONS.redHeart +
      '</span><span class="hug-heart h3">' +
      ICONS.redHeart +
      '</span></div>'
    );
  },
  /**
   * Строит карточку «Как ты?» с тремя смайликами и фразой дня.
   * @returns {string} HTML.
   */
  moodHtml() {
    if (Cloud.isTeacher) return '';
    const current = Support.moodToday(),
      btn = (value, icon, label) =>
        '<button class="mood-btn' +
        (current === value ? ' on' : '') +
        '" data-action="mood" data-v="' +
        value +
        '" aria-label="' +
        label +
        '" aria-pressed="' +
        (current === value) +
        '">' +
        icon +
        '</button>';
    return (
      '<section class="card mood-card"><div class="mood-main"><h2>Как ты?</h2><div class="mood-row">' +
      btn('good', ICONS.smilingFace, 'Хорошо') +
      btn('ok', ICONS.neutralFace, 'Нормально') +
      btn('bad', ICONS.pensiveFace, 'Грустно') +
      '</div></div>' +
      '<p class="mood-note">' +
      U.esc(current ? Support.moods[current] : Support.dailyPhrase()) +
      '</p>' +
      (current === 'bad' ? '<button class="btn sm" data-action="relax-open">Психологическая помощь</button>' : '') +
      '</section>'
    );
  }
};
