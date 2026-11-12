'use strict';

const Avatars = {
  map: {},
  looks: {},
  people: {},
  look(uid) {
    return Wardrobe.normalize(uid && uid === Cloud.uid ? Mascot.chosen() : Avatars.looks[uid]);
  },
  uidForRid(rid) {
    return Object.keys(Avatars.people).find((uid) => Avatars.people[uid].rid === rid);
  },
  contact(role, size) {
    return Avatars.html(
      Object.keys(Avatars.people).find((uid) => Avatars.people[uid].role === role),
      size,
    );
  },
  timer: null,
  /**
   * Возвращает аватарку пользователя из общей карты (картинка или фото).
   * @param {string} uid Пользователь.
   * @returns {string} Строка.
   */
  value(uid) {
    return Avatars.map[uid] || '';
  },
  /**
   * Рисует аватарку пользователя нужного размера; если её нет, берёт запасную.
   * @param {string} uid Пользователь.
   * @param {number} size Размер в пикселях.
   * @param {string} fallback Запасная аватарка.
   * @returns {string} HTML.
   */
  html(uid, size, fallback) {
    const look = Avatars.look(uid),
      value = Avatars.value(uid) || fallback || '';
    const mascot = Mascot.svg(
      look.mood || 'happy',
      value ? Math.max(28, Math.round(size * 0.8)) : size,
      '',
      {
        look,
        season: '',
      },
    );
    return (
      '<span class="av-personal"' +
      (uid
        ? ' data-action="social-profile" data-uid="' +
          uid +
          '" role="button" tabindex="0" aria-label="Открыть профиль"'
        : '') +
      '>' +
      (value ? avatarOf(value, size) : '') +
      mascot +
      '</span>'
    );
  },
  /**
   * Рисует маленькую круглую аватарку для списков: фото или инициалы.
   * @param {string} uid Пользователь.
   * @param {string} name Имя для инициалов.
   * @param {number} size Размер в пикселях.
   * @returns {string} HTML.
   */
  small(uid, name, size) {
    const look = Avatars.look(uid),
      value = Avatars.value(uid);
    const portrait = value
      ? avatarOf(value, size)
      : '<span class="av-s av-ini" style="width:' +
        size +
        'px;height:' +
        size +
        'px;font-size:' +
        Math.round(size * 0.42) +
        'px">' +
        U.esc(U.initials(name || '')) +
        '</span>';
    return (
      '<span class="av-personal"' +
      (uid
        ? ' data-action="social-profile" data-uid="' +
          uid +
          '" role="button" tabindex="0" aria-label="Открыть профиль"'
        : '') +
      '>' +
      portrait +
      Mascot.svg(look.mood || 'happy', Math.max(size, 30), '', {
        look,
        season: '',
      }) +
      '</span>'
    );
  },
  /**
   * Выкладывает свою аватарку в облако, чтобы её видели остальные.
   */
  async publish() {
    if (Cloud.isSuperAdmin && (Cloud.tenantId !== Cloud.homeTenant || !Store.s.meta.avatarPending)) return;
    if (Cloud.status !== 'online' || !Cloud.uid || Cloud.isParent || !Cloud.hasCabinet()) return;
    const uid=Cloud.uid,value = myAvatar(),
      had = Avatars.map[Cloud.uid] || '';
    if (value === had){if(Store.s.meta.avatarPending){Store.s.meta.avatarPending=false;Store.save();}return;}
    const result = value ? await Cloud.saveAvatar(value) : await Cloud.deleteAvatar();
    if (result && result.ok && Cloud.uid===uid){Avatars.map[uid] = value;if(myAvatar()===value){Store.s.meta.avatarPending=false;Store.save();if(typeof App!=='undefined')App.renderSoft();}}
  },
  /**
   * Загружает аватарки всех пользователей из облака.
   * @returns {Promise<boolean>} true, если условие выполнено.
   */
  async load() {
    const ok = await Cloud.loadAvatars();
    if (ok && Store.s.meta && Store.s.meta.mascotPending) Wardrobe.save();
    if (ok) App.renderSoft();
    return ok;
  },
  /**
   * Включает обновление аватарок раз в минуту.
   */
  start() {
    if (Avatars.timer) return;
    Avatars.timer = setInterval(() => {
      if (Cloud.status === 'online') Avatars.load();
    }, 30000);
  },
  /**
   * Строит карточку «Фото профиля» для настроек.
   * @returns {string} HTML.
   */
  card() {
    if (Cloud.isParent) return '';
    return (
      '<div class="card set-sec"><h2>Фото профиля</h2><div class="set-row"><div class="cab-av">' +
      avatarOf(myAvatar(), 64) +
      '</div><div><b>Ваше фото</b><p>Его увидят в журнале, чатах и списках. Фото сожмётся до маленького квадрата.</p></div><button class="btn" data-action="avatar-open">Изменить</button></div></div>'
    );
  },
};
