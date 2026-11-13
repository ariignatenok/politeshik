'use strict';
function socialProfileHtml(card, full = false) {
  const self = card.uid === Cloud.uid,
    theme = Wall.themes[card.page_theme] ? card.page_theme : 'lilac';
  const like = (kind) =>
    '<button class="btn social-like' +
    (card['liked_' + kind] ? ' on' : '') +
    '" data-action="social-like" data-uid="' +
    card.uid +
    '" data-kind="' +
    kind +
    '" aria-pressed="' +
    !!card['liked_' + kind] +
    '"' +
    (self || (kind === 'photo' && !card.avatar) ? ' disabled' : '') +
    '>♡ ' +
    (kind === 'photo' ? 'Фото' : 'Маскот') +
    ' · ' +
    Number(card[kind + '_likes'] || 0) +
    '</button>';
  const phone = String(card.phone || ''),
    email = String(card.contact_email || '');
  return (
    '<div class="social-profile ' +
    (full ? 'is-full' : 'is-compact') +
    ' wall-theme-' +
    theme +
    '"><div class="social-cover wall-cover">' +
    (card.cover ? '<img data-wall-image="' + card.cover.path + '" alt="Обложка профиля">' : '') +
    '<span>ПОЛИТЕШИК / МОЯ СТРАНИЦА</span></div><div class="social-profile-head">' +
    Social.avatar(card, full ? 110 : 84) +
    '<div>' +
    Presence.html(card) +
    '<h2>' +
    U.esc(card.name) +
    '</h2><p>' +
    U.esc(card.group_name) +
    '</p>' +
    (['admin', 'superadmin'].includes(card.role)
      ? '<span class="leader-label">Староста' +
        (card.role === 'superadmin' ? ' · Супер-админ' : '') +
        '</span>'
      : '') +
    '</div></div>' +
    (card.tagline ? '<p class="wall-tagline">' + U.esc(card.tagline) + '</p>' : '') +
    '<div class="social-profile-actions">' +
    like('mascot') +
    like('photo') +
    (!self
      ? '<button class="btn primary" data-action="peer-open" data-uid="' +
        card.uid +
        '">Написать лично</button>'
      : '') +
    '</div>' +
    '<div class="wall-contacts">' +
    (phone
      ? '<a href="tel:' + U.esc(phone.replace(/[^+0-9]/g, '')) + '">☎ ' + U.esc(phone) + '</a>'
      : '') +
    (email
      ? '<a href="mailto:' + encodeURIComponent(email) + '">✉ ' + U.esc(email) + '</a>'
      : '') +
    (!phone && !email ? '<span class="hint">Контакты пока не опубликованы</span>' : '') +
    '</div>' +
    (card.about ? '<p class="wall-bio">' + U.esc(card.about) + '</p>' : '') +
    (!full
      ? '<button class="btn primary wall-open-full" data-action="wall-open" data-uid="' +
        card.uid +
        '">Открыть профиль полностью →</button>'
      : '') +
    '</div>'
  );
}
function socialInboxHtml() {
  if (!Social.allowed()) return '';
  return (
    '<section class="peer-inbox"><div class="section-head"><h2>Личные переписки</h2><button class="btn sm" data-action="social-people">Найти собеседника</button></div>' +
    (Social.inboxError
      ? '<p class="warn">Не удалось обновить переписки. <button class="btn sm" data-action="social-retry">Повторить</button></p>'
      : '') +
    '<div class="chat-list">' +
    (Social.inbox
      .map((card) =>
        chatRow({
          id: 'peer:' + card.uid,
          title: card.name,
          subtitle: card.group_name,
          status: Presence.html(card),
          preview: card.last,
          unread: Number(card.unread),
          time: chatTime(card.at),
          avatar: Social.avatar(card, 42),
        }),
      )
      .join('') || '<p class="hint">Откройте профиль в разделе «Люди», чтобы начать общение.</p>') +
    '</div></section>'
  );
}
function viewPeople() {
  if (!Social.allowed())
    return '<div class="card">Раздел доступен зарегистрированным студентам.</div>';
  if (!Social.loaded && !Social.loading && !Social.error) Social.loadPeople();
  return (
    '<div class="page-head"><div><h1>Люди</h1><p>Знакомьтесь со студентами своей и других групп.</p></div><button class="btn primary" data-action="club-open">✦ В клуб</button></div><div class="social-search" data-form="social-search"><input class="input" name="q" maxlength="100" value="' +
    U.esc(Social.query) +
    '" placeholder="Имя или группа" aria-label="Имя или группа"><button class="btn" data-action="save-form">Найти</button></div>' +
    (Social.error
      ? '<p class="warn">' +
        U.esc(Social.error) +
        ' <button class="btn sm" data-action="social-retry">Повторить</button></p>'
      : '') +
    '<div class="people-grid">' +
    Social.people
      .map(
        (card) =>
          '<button class="card person-card' +
          (['admin', 'superadmin'].includes(card.role) ? ' pinned-leader' : '') +
          '" data-action="social-profile" data-uid="' +
          card.uid +
          '">' +
          Social.avatar(Social.cards[card.uid] || card, 64) +
          (['admin', 'superadmin'].includes(card.role)
            ? '<span class="leader-label">📌 Староста' +
              (card.role === 'superadmin' ? ' · Админ Арина' : '') +
              '</span>'
            : '') +
          '<b>' +
          U.esc(card.name) +
          '</b><small>' +
          U.esc(card.group_name) +
          '</small>' +
          Presence.html(Social.cards[card.uid] || card) +
          '<span>Открыть профиль →</span></button>',
      )
      .join('') +
    '</div>' +
    (Social.loading
      ? '<p class="hint" role="status">Загружаем профили…</p>'
      : !Social.people.length && !Social.error
        ? '<p class="hint">По этому запросу никого не нашли.</p>'
        : '') +
    (Social.more ? '<button class="btn" data-action="social-more">Показать ещё</button>' : '')
  );
}
function viewPeerThread(uid) {
  const card = Social.cards[uid],
    rows = Social.threads[uid] || [];
  return (
    '<div class="page-head"><button class="btn sm" data-action="chat-back">← Чаты</button><button class="peer-title" data-action="social-profile" data-uid="' +
    uid +
    '">' +
    Social.avatar(card, 40) +
    '<span><b>' +
    U.esc((card && card.name) || 'Собеседник') +
    '</b><small>' +
    U.esc((card && card.group_name) || 'Личная переписка') +
    '</small>' +
    Presence.html(card) +
    '</span></button></div><div class="card peer-thread"><div class="peer-scroll">' +
    (Social.historyMore && rows.length
      ? '<button class="btn sm ghost" data-action="peer-older" data-uid="' +
        uid +
        '">Более ранние сообщения</button>'
      : '') +
    (rows
      .map(
        (m) =>
          '<div class="peer-message' +
          (m.sender === Cloud.uid ? ' mine' : '') +
          '"><p>' +
          U.esc(m.body).replace(/\n/g, '<br>') +
          '</p>' +
          ChatMedia.html(m) +
          '<small>' +
          U.esc(
            new Date(m.created_at).toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          ) +
          (m.sender === Cloud.uid ? messageReceipt(!!m.read_at) : '') +
          '</small></div>',
      )
      .join('') || '<div class="empty">Начните знакомство с приветствия 👋</div>') +
    '</div>' +
    (Social.threadError
      ? '<p class="warn">' +
        U.esc(Social.threadError) +
        ' <button class="btn sm" data-action="peer-retry" data-uid="' +
        uid +
        '">Повторить</button></p>'
      : '') +
    '<div class="chat-in" data-form="peer" data-peer="' +
    uid +
    '">' +
    ChatMedia.controls() +
    chatComposer('peerIn', 'peer:' + uid, 'Написать сообщение…') +
    '<button class="btn primary" data-action="save-form" aria-label="Отправить сообщение">➤</button></div></div>'
  );
}
function viewClub() {
  if (!Social.allowed())
    return '<div class="card">Клуб доступен зарегистрированным студентам.</div>';
  Club.ensurePolling();
  const dj = {
    body: 'lilac',
    top: 'blacktee',
    hat: 'headphones',
    glasses: 'sun',
    chain: 'shortgold',
  };
  return (
    '<div class="page-head"><div><h1>Клуб Политешика</h1><p>Общий танцпол, новые знакомства и ваши маскоты.</p></div><div class="head-actions"><button class="btn" data-action="social-people">Люди</button><button class="btn" data-action="club-map">← На карту</button></div></div><div class="club-scene' +
    (Club.calm ? ' calm' : '') +
    '"><div class="club-neon">POLITESHIK <span>CLUB</span></div><div class="club-beam beam-a"></div><div class="club-beam beam-b"></div><div class="club-stage"><div class="club-speaker">◉<br>◉</div><div class="club-dj">' +
    Mascot.svg('happy', 110, '', {look: dj, season: ''}) +
    '<div class="club-decks"><i>◉</i><span>DJ / ПОЛИТЕШИК</span><i>◉</i></div></div><div class="club-speaker">◉<br>◉</div></div><div class="club-floor"><button class="club-bar" data-action="club-bar"><span>BAR</span><b>☕ 🧃 🍹</b><small>Кофе · чай · соки · лимонад</small><small>Выбрать напиток →</small></button>' +
    Club.visitors
      .map(
        (card, i) =>
          '<button class="club-guest' +
          (card.uid === Cloud.uid ? ' me' : '') +
          ' move-' +
          (Club.moves.some((x) => x[0] === card.dance) ? card.dance : 'bounce') +
          '" data-action="club-guest" data-uid="' +
          card.uid +
          '" style="--beat-delay:-' +
          (i % 7) * 0.21 +
          's;--guest-turn:' +
          ((i % 3) - 1) * 5 +
          'deg;left:' +
          Club.position(card).x +
          '%;top:' +
          Club.position(card).y +
          '%">' +
          (card.thought ? '<span class="club-thought">' + U.esc(card.thought) + '</span>' : '') +
          '<span class="club-figure">' +
          Club.mascot(card, 88) +
          '</span>' +
          '<b class="club-mascot-nickname">' + U.esc(Wardrobe.normalize(card.uid===Cloud.uid?Mascot.chosen():card.mascot).nickname||'Политешик') + '</b>' +
          '</button>',
      )
      .join('') +
    '</div><div class="club-caption">' +
    (Club.visitors.length
      ? 'На танцполе: ' + Club.visitors.length
      : 'Танцпол свободен — заходите первым') +
    '</div></div><div class="club-controls">' +
    (Club.joined
      ? '<button class="btn" data-action="club-own">Мой маскот · Движения и мысли</button><button class="btn primary" data-action="club-dance">' +
        (Club.dancing ? 'Остановиться' : 'Танцевать') +
        '</button><button class="btn" data-action="club-leave">Выйти из клуба</button>'
      : '<button class="btn primary" data-action="club-join">Зайти на танцпол</button>') +
    ClubMusic.html() + '<button class="btn" data-action="club-calm" aria-pressed="' +
    Club.calm +
    '">' +
    (Club.calm ? 'Включить неон' : 'Спокойный свет') +
    '</button></div><p class="hint">Нажмите на своего маскота — он подпрыгнет. Перетаскивайте его по танцполу. Движения и мысли — в кнопке «Мой маскот»; чужой маскот открывает профиль. Ваш маскот остаётся здесь даже после закрытия страницы. Чтобы убрать его, нажмите «Выйти из клуба».</p>' +
    (Club.error
      ? '<p class="warn">' +
        U.esc(Club.error) +
        ' <button class="btn sm" data-action="club-retry">Повторить</button></p>'
      : '')
  );
}
