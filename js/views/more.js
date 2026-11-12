'use strict';

/**
 * Отрисовывает мобильный раздел «Ещё».
 * @returns {string} HTML.
 */
function viewMore() {
  const visible = bottomNav(),
    items = navItems()
      .filter((t) => !visible.includes(t.id))
      .map((t) => [t.id, t.ico, t.label]);
  return (
    '<div class="page-head"><div><h1>Ещё</h1><p>Разделы Политешика</p></div>' +
    MenuPrefs.button() +
    '</div>' +
    Groups.navigation(true) +
    '<div class="tiles">' +
    items
      .map(
        (t) =>
          '<button class="tile" data-action="nav" data-tab="' +
          t[0] +
          '">' + (MenuPrefs.iconsVisible()?'<span>'+t[1]+'</span>':'') +
          t[2] +
          (MenuPrefs.pinned(t[0]) ? ' 📌' : '') +
          '</button>',
      )
      .join('') +
    '</div>'
  );
}
