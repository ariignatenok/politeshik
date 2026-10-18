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
  const cs = News.commentsOf(n.id),
    birthday = n.kind === 'birthday',
    likes = News.likesOf(n.id),
    liked = likes.some(l => l.uid === Cloud.uid);
  const head = birthday
    ? '<header class="news-head"><div class="bday-head"><div>' +
      Mascot.svg('cheer', 64, '', {
        season: 'birthday'
      }) +
      '</div><div><h2>' +
      ICONS.partyPopper +
      ' Сегодня день рождения у ' +
      U.esc(n.subject_name || 'одногруппника') +
      '! Давайте поздравим! ' +
      ICONS.birthdayCake +
      '</h2><small>Политешик · ' +
      U.esc(U.fmtLong(U.fromISO(n.news_date))) +
      '</small></div></div>' +
      (Cloud.isAdmin
        ? '<button class="icon-btn" data-action="news-del" data-id="' +
          n.id +
          '" aria-label="Удалить новость">' +
          ICONS.wastebasket +
          '</button>'
        : '') +
      '</header>'
    : '<header class="news-head"><div><h2>' +
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
      '</header>';
  return (
    '<article class="card news-card' +
    (birthday ? ' birthday' : '') +
    '">' +
    head +
    (birthday ? '' : '<div class="news-body">' + U.esc(n.body).replace(/\n/g, '<br>') + '</div>') +
    '<div class="news-actions"><button class="like-btn' +
    (liked ? ' on' : '') +
    '" data-action="news-like" data-id="' +
    n.id +
    '" aria-pressed="' +
    liked +
    '" aria-label="Нравится">' +
    ICONS.redHeart +
    ' <b>' +
    likes.length +
    '</b></button></div>' +
    '<section class="news-comments"><h3>Комментарии (' +
    cs.length +
    ')</h3>' +
    cs.map(commentHtml).join('') +
    '<div class="comment-in" data-form="comment" data-id="' +
    n.id +
    '"><input class="input" name="body" placeholder="' +
    (birthday ? 'Написать поздравление' : 'Написать комментарий') +
    '" maxlength="1000" autocomplete="off"><button class="btn primary sm" data-action="save-form">Отправить</button></div></section></article>'
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
      ? News.items
          .slice()
          .sort(
            (a, b) =>
              (b.kind === 'birthday' && b.news_date === U.iso(U.today())) -
              (a.kind === 'birthday' && a.news_date === U.iso(U.today()))
          )
          .map(newsCard)
          .join('')
      : News.loaded
        ? empty(ICONS.newspaper, 'Новостей пока нет.')
        : Skeleton.news(3))
  );
}
