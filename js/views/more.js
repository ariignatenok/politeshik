'use strict';

/**
 * Отрисовывает мобильный раздел «Ещё».
 * @returns {string} HTML.
 */
function viewMore() {
  const items = [
    ['news', ICONS.newspaper, 'Новости'],
    ['teachers', ICONS.teacher, 'Преподаватели'],
    ['cabinet', ICONS.user, 'Личный кабинет'],
    ['rating', ICONS.trophy, 'Рейтинг группы'],
    ['map', ICONS.worldMap, 'Карта']
  ]
    .concat([['journal', ICONS.folder, 'Журнал']])
    .concat(Cloud.isAdmin ? [['group', ICONS.shield, 'Группа (админ)']] : [])
    .concat([['settings', ICONS.gear, 'Настройки']]);
  return (
    '<div class="page-head"><div><h1>Ещё</h1><p>Разделы Политешика</p></div></div><div class="tiles">' +
    items
      .map(
        t =>
          '<button class="tile" data-action="nav" data-tab="' +
          t[0] +
          '"><span>' +
          t[1] +
          '</span>' +
          t[2] +
          '</button>'
      )
      .join('') +
    '</div>'
  );
}
