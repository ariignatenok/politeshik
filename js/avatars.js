'use strict';

const Avatars = {
  map: {},
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
    return avatarOf(Avatars.value(uid) || fallback || '', size);
  },
  /**
   * Рисует маленькую круглую аватарку для списков: фото или инициалы.
   * @param {string} uid Пользователь.
   * @param {string} name Имя для инициалов.
   * @param {number} size Размер в пикселях.
   * @returns {string} HTML.
   */
  small(uid, name, size) {
    const value = Avatars.value(uid),
      style = 'width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.42) + 'px';
    if (value) return '<span class="av-s" style="' + style + '">' + avatarOf(value, size) + '</span>';
    return '<span class="av-s av-ini" style="' + style + '">' + U.esc(U.initials(name || '')) + '</span>';
  },
  /**
   * Выкладывает свою аватарку в облако, чтобы её видели остальные.
   */
  async publish() {
    if (Cloud.status !== 'online' || !Cloud.uid || Cloud.isParent || !Cloud.hasCabinet()) return;
    const value = myAvatar(),
      had = Avatars.map[Cloud.uid] || '';
    if (value === had) return;
    Avatars.map[Cloud.uid] = value;
    if (value) await Cloud.saveAvatar(value);
    else await Cloud.deleteAvatar();
  },
  /**
   * Загружает аватарки всех пользователей из облака.
   * @returns {Promise<boolean>} true, если условие выполнено.
   */
  async load() {
    const ok = await Cloud.loadAvatars();
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
    }, 60000);
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
  }
};
