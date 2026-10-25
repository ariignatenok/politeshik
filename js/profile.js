'use strict';

const GROUP_NAME = '25290909/3091';
const AVATARS = [
  ['m1', ICONS.faceCool, '#fde68a'],
  ['m2', ICONS.faceNerd, '#bfdbfe'],
  ['m3', ICONS.potato, '#fed7aa'],
  ['m4', ICONS.frog, '#bbf7d0'],
  ['m5', ICONS.duck, '#fef08a'],
  ['m6', ICONS.cat, '#fbcfe8'],
  ['m7', ICONS.pizza, '#fecaca'],
  ['m8', ICONS.ghost, '#e9d5ff'],
  ['m9', ICONS.robot, '#cbd5e1'],
  ['m10', ICONS.unicorn, '#f5d0fe'],
  ['m11', ICONS.octopus, '#c7d2fe'],
  ['m12', ICONS.cheese, '#fde68a']
];
/**
 * Строит аватар: мем-картинку, фото или жителя.
 * @param {string} v Идентификатор или data-URL аватара.
 * @param {number} size Размер в пикселях.
 * @returns {string} HTML.
 */
function avatarOf(v, size) {
  if (v && String(v).indexOf('data:image') === 0)
    return '<img class="av-img" src="' + U.esc(v) + '" width="' + size + '" height="' + size + '" alt="">';
  const a = v && AVATARS.find(x => x[0] === v);
  if (a)
    return (
      '<span class="av-em" style="width:' +
      size +
      'px;height:' +
      size +
      'px;font-size:' +
      Math.round(size * 0.55) +
      'px;background:' +
      a[2] +
      '">' +
      a[1] +
      '</span>'
    );
  return Mascot.svg(Mascot.current(), size);
}
/**
 * Возвращает идентификатор своего аватара.
 * @returns {string} Строка.
 */
const myAvatar = () => {
  const a = Store.s.settings.avatar;
  return a ? (a.k === 'p' ? a.d : a.id) : '';
};
const Profile = {
  /**
   * Копирует аватар, «О себе» и достижения в профиль в облаке.
   */
  push() {
    if (Cloud.status !== 'online' || !Cloud.profile || Cloud.isStaff) return;
    const state = Store.s;
    Cloud.profile.avatar = myAvatar();
    Cloud.profile.about = state.settings.about || '';
    Cloud.profile.ach = state.ach || {};
    Cloud.profile.stats = {
      cards: state.cards.filter(c => c.known).length
    };
    Cloud.pushProfile();
  },
  /**
   * Считает посещаемость за текущую неделю.
   * @returns {Object} Объект.
   */
  weekStats() {
    const t = U.today(),
      mon = U.iso(U.mondayOf(t));
    return Att.stats(Store.s.attendance.marks, Cloud.my.certs, Store.s.settings.subgroup, mon, U.iso(t));
  }
};
/**
 * Обрезает и сжимает фото до квадрата 160 на 160.
 * @param {File} file Фото.
 * @returns {Promise<string>} data-URL.
 */
async function compressAvatar(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('bad image'));
      i.src = url;
    });
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const side = Math.min(img.width, img.height);
    c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 160, 160);
    return c.toDataURL('image/jpeg', 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}
