'use strict';

/**
 * Отрисовывает чат с Политешиком.
 * @returns {string} HTML.
 */
function viewBotChat() {
  const c = Chat.st();
  Chat.markRead();
  let last = '';
  const body = c.msgs
    .map(m => {
      const t = new Date(m.t),
        day = U.iso(t),
        me = m.from === 'me';
      let sep = '';
      if (day !== last) {
        last = day;
        sep = '<div class="day-sep">' + (day === U.iso(U.today()) ? 'Сегодня' : U.esc(U.fmtShort(t))) + '</div>';
      }
      return (
        sep +
        '<div class="msg ' +
        (me ? 'me' : 'bot') +
        '">' +
        (me ? '' : '<div class="msg-av">' + Mascot.svg(m.mood || 'happy', 38) + '</div>') +
        '<div class="bubble">' +
        U.esc(m.text).replace(/\n/g, '<br>') +
        (m.sticker ? Support.stickerHtml() : '') +
        (m.links
          ? '<div class="qr">' +
            m.links
              .map(
                (l, i) =>
                  '<button class="chipbtn" data-action="chat-go" data-mid="' +
                  m.id +
                  '" data-i="' +
                  i +
                  '">' +
                  U.esc(l.l) +
                  '</button>'
              )
              .join('') +
            '</div>'
          : '') +
        (m.ask && !m.done
          ? '<div class="qr"><button class="chipbtn yes" data-action="chat-ans" data-wk="' +
            U.esc(m.ask) +
            '" data-v="y">' +
            ICONS.check +
            ' Готов(а)</button><button class="chipbtn no" data-action="chat-ans" data-wk="' +
            U.esc(m.ask) +
            '" data-v="n">' +
            ICONS.grimace +
            ' Не готов(а)</button></div>'
          : '') +
        (m.req && !m.done
          ? '<div class="qr"><button class="chipbtn yes" data-action="req-admin" data-mid="' +
            m.id +
            '" data-date="' +
            m.req +
            '">Да, попросить админа</button><button class="chipbtn" data-action="req-skip" data-mid="' +
            m.id +
            '">Не надо</button></div>'
          : '') +
        '<small>' +
        U.pad(t.getHours()) +
        ':' +
        U.pad(t.getMinutes()) +
        '</small></div></div>'
      );
    })
    .join('');
  return (
    '<div class="chat-wrap"><div class="chat-head">' +
    (Cloud.status === 'online'
      ? '<button class="icon-btn" data-action="chat-back" aria-label="К списку чатов">←</button>'
      : '') +
    '<div class="chat-av">' +
    Mascot.svg(Mascot.current(), 46) +
    '</div><div><b>Политешик (Житель)</b><small>напоминает о работах и отвечает на вопросы</small></div></div>' +
    '<div class="chat-box" id="chat-box">' +
    (body || '<div class="empty">Пока тихо…</div>') +
    '</div>' +
    '<div class="faq-row" aria-label="Заготовленные вопросы">' +
    faqItems()
      .map((f, i) => '<button class="faq-b" data-action="faq-ask" data-i="' + i + '">' + U.esc(f.q) + '</button>')
      .join('') +
    '</div>' +
    '<div class="chat-quick">' +
    ['Что сегодня?', 'Что завтра?', 'Какие работы?', 'Помощь']
      .map(q => '<button class="fchip" data-action="chat-quick" data-q="' + q + '">' + q + '</button>')
      .join('') +
    '<button class="fchip hug-chip" data-action="hug">Мне нужна поддержка</button><button class="fchip hug-chip" data-action="relax-open">Психологическая помощь</button></div>' +
    '<div class="chat-in" data-form="chat"><input class="input" id="chatIn" name="t" placeholder="Напиши Политешику…" autocomplete="off"><button class="btn primary" data-action="save-form" aria-label="Отправить">➤</button></div></div>'
  );
}
/**
 * Форматирует время сообщения для списка чатов.
 * @param {string} iso Момент сообщения, ISO.
 * @returns {string} Строка.
 */
function chatTime(iso) {
  const d = new Date(iso);
  return U.iso(d) === U.iso(U.today()) ? U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) : shortDate(U.iso(d));
}
/**
 * Строит строку списка чатов.
 * @param {Object} o Id, title, preview, time, unread, pinned, avatar.
 * @returns {string} HTML.
 */
function chatRow(o) {
  return (
    '<button class="chat-row' +
    (o.pinned ? ' pinned' : '') +
    '" data-action="open-chat" data-with="' +
    o.id +
    '">' +
    '<span class="chat-row-av">' +
    o.avatar +
    '</span>' +
    '<span class="chat-row-main"><b>' +
    U.esc(o.title) +
    (o.pinned ? ' <span class="pin-mark">закреплён</span>' : '') +
    '</b><small>' +
    U.esc(o.preview || o.subtitle || '') +
    '</small></span>' +
    '<span class="chat-row-side">' +
    (o.time ? '<small>' + U.esc(o.time) + '</small>' : '') +
    (o.unread ? '<span class="badge">' + o.unread + '</span>' : '') +
    '</span></button>'
  );
}
/**
 * Отрисовывает список из двух чатов студента.
 * @returns {string} HTML.
 */
function viewChatListStudent() {
  const c = Chat.st(),
    lastBot = c.msgs[c.msgs.length - 1],
    dm = Dm.threadMsgs(Cloud.uid),
    lastDm = dm[dm.length - 1];
  return (
    '<div class="page-head"><div><h1>Чаты</h1><p>Политешик отвечает сразу, админ — когда зайдёт в приложение.</p></div></div><div class="chat-list">' +
    chatRow({
      id: 'bot',
      title: 'Политешик (Житель)',
      subtitle: 'Напоминает о работах и отвечает на вопросы',
      preview: lastBot ? lastBot.text : '',
      time: lastBot ? chatTime(lastBot.t) : '',
      unread: Chat.unread(),
      avatar: Mascot.svg(Mascot.current(), 44)
    }) +
    chatRow({
      id: 'admin',
      title: 'Игнатенок Арина (Админ)',
      subtitle: 'Личная переписка с админом группы',
      preview: lastDm ? (Dm.isMine(lastDm) ? 'Вы: ' : '') + lastDm.body : '',
      time: lastDm ? chatTime(lastDm.created_at) : '',
      unread: Dm.unreadIn(Cloud.uid),
      avatar: '<span class="adm-av">ИА</span>'
    }) +
    '</div>'
  );
}
/**
 * Отрисовывает список переписок админа.
 * @returns {string} HTML.
 */
function viewChatListAdmin() {
  const pins = (Cloud.profile && Cloud.profile.pins) || [],
    list = Dm.threads(),
    chat = Chat.st(),
    lastBot = chat.msgs[chat.msgs.length - 1];
  const botRow = chatRow({
    id: 'bot',
    title: 'Политешик (Житель)',
    subtitle: 'Отчёты, поддержка и напоминания',
    preview: lastBot ? lastBot.text : '',
    time: lastBot ? chatTime(lastBot.t) : '',
    unread: Chat.unread(),
    pinned: true,
    avatar: Mascot.svg(Mascot.current(), 44)
  });
  const rows = list
    .map(t =>
      chatRow({
        id: t.uid,
        title: Dm.nameOf(t.uid),
        preview: (Dm.isMine(t.last) ? 'Вы: ' : '') + t.last.body,
        time: chatTime(t.last.created_at),
        unread: t.unread,
        pinned: pins.includes(t.uid),
        avatar: avatarOf((Cloud.adm.profiles[t.uid] || {}).avatar, 44)
      })
    )
    .join('');
  return (
    '<div class="page-head"><div><h1>Чаты</h1><p>Политешик закреплён сверху, затем переписка со студентами: закреплённые, остальные по времени последнего сообщения.</p></div>' +
    '<div class="head-actions"><button class="btn primary" data-action="dm-new">Новый чат</button></div></div>' +
    '<div class="chat-list">' +
    botRow +
    rows +
    '</div>' +
    (list.length
      ? ''
      : Dm.loaded
        ? empty(ICONS.speech, 'Переписок со студентами пока нет. Нажмите «Новый чат», чтобы написать.')
        : Skeleton.card(2))
  );
}
/**
 * Отрисовывает личную переписку студента и админа.
 * @param {string} uid Идентификатор студента, чья переписка открыта.
 * @returns {string} HTML.
 */
function viewDmThread(uid) {
  Dm.markRead(uid);
  const admin = Cloud.isAdmin,
    msgs = Dm.threadMsgs(uid),
    pinned = admin && ((Cloud.profile && Cloud.profile.pins) || []).includes(uid);
  let last = '';
  const body = msgs
    .map(m => {
      const t = new Date(m.created_at),
        day = U.iso(t),
        mine = Dm.isMine(m),
        fromAdmin = m.sender !== m.thread_uid;
      let sep = '';
      if (day !== last) {
        last = day;
        sep = '<div class="day-sep">' + (day === U.iso(U.today()) ? 'Сегодня' : U.esc(U.fmtShort(t))) + '</div>';
      }
      return (
        sep +
        '<div class="msg ' +
        (mine ? 'me' : 'bot') +
        (fromAdmin ? ' admin' : '') +
        '">' +
        (mine
          ? ''
          : '<div class="msg-av adm-av">' +
            (fromAdmin
              ? 'ИА'
              : U.esc(
                  Dm.nameOf(uid)
                    .split(' ')
                    .map(w => w[0])
                    .join('')
                    .slice(0, 2)
                )) +
            '</div>') +
        '<div class="bubble">' +
        (fromAdmin && !admin ? '<div class="msg-name">Игнатенок Арина · админ</div>' : '') +
        U.esc(m.body).replace(/\n/g, '<br>') +
        '<small>' +
        U.pad(t.getHours()) +
        ':' +
        U.pad(t.getMinutes()) +
        '</small></div></div>'
      );
    })
    .join('');
  return (
    '<div class="chat-wrap"><div class="chat-head">' +
    (Cloud.isTeacher ? '' : '<button class="icon-btn" data-action="chat-back" aria-label="К списку чатов">←</button>') +
    (admin ? avatarOf((Cloud.adm.profiles[uid] || {}).avatar, 46) : '<span class="adm-av big">ИА</span>') +
    '<div><b>' +
    U.esc(admin ? Dm.nameOf(uid) : 'Игнатенок Арина (Админ)') +
    '</b><small>' +
    (admin ? 'личная переписка' : 'личная переписка с админом группы') +
    '</small></div>' +
    (admin
      ? '<div class="chat-head-actions"><button class="btn sm" data-action="dm-pin" data-uid="' +
        uid +
        '">' +
        (pinned ? 'Открепить' : 'Закрепить') +
        '</button><button class="btn sm" data-action="stud-open" data-id="' +
        uid +
        '">Карточка</button></div>'
      : '') +
    '</div>' +
    '<div class="chat-box" id="chat-box">' +
    (body || '<div class="empty">Сообщений пока нет. Напишите первым.</div>') +
    '</div>' +
    '<div class="chat-in" data-form="dm" data-with="' +
    uid +
    '"><input class="input" id="dmIn" name="t" placeholder="' +
    (admin ? 'Сообщение студенту' : 'Сообщение админу') +
    '" autocomplete="off" maxlength="4000"><button class="btn primary" data-action="save-form" aria-label="Отправить">➤</button></div></div>'
  );
}
/**
 * Выбирает экран раздела «Чаты» по роли и открытому чату.
 * @returns {string} HTML.
 */
function viewChat() {
  if (Cloud.status !== 'online') return viewBotChat();
  if (Cloud.isTeacher) return viewDmThread(Cloud.uid);
  if (Cloud.isAdmin)
    return ui.chatWith === 'bot' ? viewBotChat() : ui.chatWith ? viewDmThread(ui.chatWith) : viewChatListAdmin();
  if (ui.chatWith === 'bot') return viewBotChat();
  if (ui.chatWith === 'admin') return viewDmThread(Cloud.uid);
  return viewChatListStudent();
}
