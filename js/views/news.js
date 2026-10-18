'use strict';

/**
 * Строит комментарий.
 * @param {Object} c Комментарий.
 * @returns {string} HTML.
 */
function commentHtml(c) {
  const removable = c.author === Cloud.uid || Cloud.isAdmin;
  return (
    '<div class="comment"><div class="comment-head"><b>' +
    U.esc(c.author_name || 'Студент') +
    (c.author_is_admin ? ' · админ' : '') +
    '</b><small>' +
    U.esc(fmtAgo(c.created_at)) +
    '</small>' +
    (removable
      ? '<button class="icon-btn sm" data-action="comment-del" data-id="' +
        c.id +
        '" aria-label="Удалить комментарий">✕</button>'
      : '') +
    '</div>' +
    '<div class="comment-text">' +
    U.esc(c.body).replace(/\n/g, '<br>') +
    '</div></div>'
  );
}
/**
 * Строит карточку новости с комментариями.
 * @param {Object} n Новость.
 * @returns {string} HTML.
 */
function newsCard(n) {
  const cs = News.commentsOf(n.id);
  return (
    '<article class="card news-card"><header class="news-head"><div><h2>' +
    U.esc(n.title) +
    '</h2><small>' +
    U.esc(U.fmtLong(U.fromISO(n.news_date))) +
    '</small></div>' +
    (Cloud.isAdmin
      ? '<button class="icon-btn" data-action="news-del" data-id="' +
        n.id +
        '" aria-label="Удалить новость">' +
        ICONS.wastebasket +
        '</button>'
      : '') +
    '</header>' +
    '<div class="news-body">' +
    U.esc(n.body).replace(/\n/g, '<br>') +
    '</div>' +
    '<section class="news-comments"><h3>Комментарии (' +
    cs.length +
    ')</h3>' +
    cs.map(commentHtml).join('') +
    '<div class="comment-in" data-form="comment" data-id="' +
    n.id +
    '"><input class="input" name="body" placeholder="Написать комментарий" maxlength="1000" autocomplete="off"><button class="btn primary sm" data-action="save-form">Отправить</button></div></section></article>'
  );
}
/**
 * Отрисовывает экран «Новости».
 * @returns {string} HTML.
 */
function viewNews() {
  const head =
    '<div class="page-head"><div><h1>Новости</h1><p>Объявления от админа группы. Под каждой новостью можно оставить комментарий.</p></div>' +
    (Cloud.isAdmin
      ? '<div class="head-actions"><button class="btn primary" data-action="news-add">＋ Добавить новость</button></div>'
      : '') +
    '</div>';
  if (Cloud.status !== 'online') return head + empty(ICONS.newspaper, 'Новости доступны после входа в аккаунт.');
  News.markSeen();
  return (
    head +
    (News.items.length
      ? News.items.map(newsCard).join('')
      : News.loaded
        ? empty(ICONS.newspaper, 'Новостей пока нет.')
        : Skeleton.card(3))
  );
}
