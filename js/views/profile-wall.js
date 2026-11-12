'use strict';
function viewProfileWall() {
  if (!Social.allowed()) return '<div class="card">Страница доступна одобренным студентам.</div>';
  Wall.reset();
  const data = Wall.data,
    card = data?.card;
  const top =
    '<div class="page-head"><button class="btn" data-action="wall-back">← Назад</button><button class="btn" data-action="wall-refresh">Обновить</button></div>';
  if (!data)
    return (
      top +
      (Wall.error
        ? '<div class="warn">' + U.esc(Wall.error) + '</div>'
        : '<div class="card">Загружаем страницу…</div>')
    );
  return (
    top +
    '<div class="wall-page wall-theme-' +
    (Wall.themes[card.page_theme] ? card.page_theme : 'lilac') +
    '">' +
    socialProfileHtml(card, true) +
    (data.editable
      ? '<div class="head-actions wall-owner-tools"><button class="btn primary" data-action="wall-edit-profile">Оформить страницу · контакты</button><button class="btn" data-action="wall-cover">Изменить обложку</button>' +
        (card.cover
          ? '<button class="btn" data-action="wall-cover-remove">Убрать обложку</button>'
          : '') +
        '</div>'
      : '') +
    '<div class="wall-columns"><aside><section class="card wall-info"><h2>О себе и полезное</h2><p class="wall-text">' +
    U.esc(data.info || card.about || 'Здесь пока нет дополнительной информации.') +
    '</p></section><section class="card wall-mascot"><h2>Мой Политешик</h2>' +
    (Wardrobe.normalize(card.mascot).nickname
      ? '<b>' + U.esc(Wardrobe.normalize(card.mascot).nickname) + '</b>'
      : '') +
    Social.avatar({...card, avatar: ''}, 140, false) +
    '</section></aside><section class="wall-feed"><div class="section-head"><div><h2>Стена</h2><p class="hint">' +
    Number(data.total || 0) +
    ' записей</p></div>' +
    (data.editable
      ? '<button class="btn primary" data-action="wall-new-post">＋ Поделиться мыслью</button>'
      : '') +
    '</div>' +
    (Wall.error ? '<p class="warn">' + U.esc(Wall.error) + '</p>' : '') +
    (Wall.posts.map((p) => wallPostHtml(p, card, data.editable)).join('') ||
      '<section class="card wall-empty">' +
        Mascot.svg('thinking', 80) +
        '<h3>Здесь начинается ваша история</h3><p>' +
        (data.editable
          ? 'Поделитесь мыслью, фотографией или полезной находкой.'
          : 'Пока нет записей. Загляните позже!') +
        '</p>' +
        (data.editable
          ? '<button class="btn primary" data-action="wall-new-post">Создать первую запись</button>'
          : '') +
        '</section>') +
    (Wall.loading ? '<p class="hint" role="status">Загружаем…</p>' : '') +
    (Wall.more
      ? '<button class="btn wall-more" data-action="wall-more"' +
        (Wall.loading ? ' disabled' : '') +
        '>Ещё записи</button>'
      : '') +
    '</section></div></div>'
  );
}
function wallPostHtml(post, card, editable) {
  return (
    '<article class="card wall-post" data-post="' +
    post.id +
    '">' +
    (post.pinned ? '<div class="wall-pin">📌 Закреплённая запись</div>' : '') +
    '<header><button class="wall-author" data-action="social-profile" data-uid="' +
    card.uid +
    '">' +
    Social.avatar(card, 38) +
    '<span><b>' +
    U.esc(card.name) +
    '</b><small>' +
    U.esc(
      new Date(post.created_at).toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      }),
    ) +
    (post.updated_at !== post.created_at ? ' · изменено' : '') +
    '</small></span></button></header>' +
    (post.body ? '<p class="wall-text">' + U.esc(post.body) + '</p>' : '') +
    ((post.photos || []).length
      ? '<div class="wall-photo-grid photos-' +
        post.photos.length +
        '">' +
        post.photos
          .map(
            (p) =>
              '<button data-action="wall-image" data-path="' +
              p.path +
              '" aria-label="Открыть фотографию"><img data-wall-image="' +
              p.path +
              '" alt="Фотография записи" loading="lazy"></button>',
          )
          .join('') +
        '</div>'
      : '') +
    '<footer><button class="btn sm wall-post-like' +
    (post.liked ? ' on' : '') +
    '" data-action="wall-like-post" data-id="' +
    post.id +
    '" aria-pressed="' +
    !!post.liked +
    '">♡ ' +
    Number(post.likes || 0) +
    '</button>' +
    (editable
      ? '<div class="wall-post-tools"><button class="btn sm ghost" data-action="wall-post-action" data-id="' +
        post.id +
        '" data-operation="' +
        (post.pinned ? 'unpin' : 'pin') +
        '">' +
        (post.pinned ? 'Открепить' : 'Закрепить') +
        '</button><button class="btn sm ghost" data-action="wall-edit-post" data-id="' +
        post.id +
        '">Изменить</button><button class="btn sm ghost" data-action="wall-post-action" data-id="' +
        post.id +
        '" data-operation="delete">Удалить</button></div>'
      : '') +
    '</footer></article>'
  );
}
