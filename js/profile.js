'use strict';

let GROUP_NAME = '25290909/3091';
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
function avatarOf(v, size, uid, role) {
  if (v && String(v).indexOf('data:image') === 0)
    return '<img class="av-img"'+(uid?' data-photo-owner="'+U.esc(uid)+'"':'')+(role?' data-photo-role="'+U.esc(role)+'"':'')+' data-action="profile-photo" role="button" tabindex="0" aria-label="Открыть фото профиля" src="' + U.esc(v) + '" width="' + size + '" height="' + size + '" alt="Фото профиля">';
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
  return Mascot.svg('happy', size, '', {look: {}, season: ''});
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
  visiting() {return Cloud.isSuperAdmin===true&&Cloud.tenantId!==Cloud.homeTenant;},
  avatarSettings(value) {return value?value.startsWith('data:image')?{k:'p',d:value}:{k:'m',id:value}:null;},
  hydrateOwner(context) {
    if(!context.is_super_admin)return;
    const p=context.profile||{};
    if(context.tenant_id===context.home_tenant){if(!Store.s.meta.avatarPending)Store.s.settings.avatar=Profile.avatarSettings(p.avatar||'');if(!Store.s.meta.mascotPending)Store.s.settings.mascot=Wardrobe.normalize(p.mascot||{});return;}
    Store.s.settings.avatar=Profile.avatarSettings(p.avatar||'');
    Store.s.settings.mascot=Wardrobe.normalize(p.mascot||{});
    Store.s.settings.about=p.about||'';Store.s.settings.displayName=p.name||'Админ Арина';Store.s.settings.subgroup='';
    Store.s.meta.avatarPending=false;Store.s.meta.mascotPending=false;
  },
  avatarEdited() {Profile.avatarRevision=(Profile.avatarRevision||0)+1;Store.s.meta.avatarPending=true;},
  /**
   * Копирует аватар, «О себе» и достижения в профиль в облаке.
   */
  push() {
    if(Profile.visiting())return;
    Avatars.publish();
    if (Cloud.status !== 'online' || !Cloud.profile || Cloud.isStaff) return;
    const state = Store.s;
    Cloud.profile.avatar = myAvatar();
    Cloud.profile.about = state.settings.about || '';
    Cloud.profile.ach = state.ach || {};
    const ym = U.iso(U.today()).slice(0, 7),
      known = state.cards.filter(c => c.known).length;
    state.meta = state.meta || {};
    if (!state.meta.cardsBase || state.meta.cardsBase.ym !== ym)
      state.meta.cardsBase = {
        ym,
        n: known
      };
    Cloud.profile.stats = {
      cards: known,
      cardsMonth: Math.max(0, known - state.meta.cardsBase.n),
      month: ym
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
 * Создаёт чёткое квадратное превью, ограниченное размером RPC; большой портрет хранится отдельно.
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
    const side = Math.min(img.width, img.height);
    for(const dim of [384,320,256,192]){
      const c=document.createElement('canvas');c.width=c.height=Math.min(dim,side);
      c.getContext('2d').drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,c.width,c.height);
      for(const quality of [.9,.8,.7]){const data=c.toDataURL('image/jpeg',quality);if(data.length<59000)return data;}
    }
    throw Error('Не удалось подготовить превью');
  } finally {
    URL.revokeObjectURL(url);
  }
}
