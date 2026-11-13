'use strict';

const Dm = {
  msgs: [],
  loaded: false,
  timer: null,
  sig: '',
  error: '',
  welcomeRecipients: [],
  welcomeLoaded: false,
  welcomeError: '',
  welcomeAt: 0,
  /** Загружает статусы приветствия только для Арины в группе Лебедева. */
  async loadWelcomeRecipients() {
    if (!Cloud.isSuperAdmin || Cloud.tenantId === 'group_1' || Date.now() - Dm.welcomeAt < 9000) return;
    Dm.welcomeAt = Date.now();
    const {data, error} = await supa.rpc('welcome_recipients');
    const before = JSON.stringify([Dm.welcomeRecipients, Dm.welcomeError, Dm.welcomeLoaded]);
    Dm.welcomeError = error ? error.message : '';
    if (!error) {
      Dm.welcomeRecipients = data || [];
      Dm.welcomeLoaded = true;
    }
    if (before !== JSON.stringify([Dm.welcomeRecipients, Dm.welcomeError, Dm.welcomeLoaded]))
      App.renderSoft();
  },
  /**
   * Проверяет доступ к рабочим перепискам поддержки своей группы.
   * @returns {boolean} Признак сотрудника поддержки.
   */
  support() {
    return Cloud.isAdmin || Cloud.isDeveloper;
  },
  /**
   * Возвращает собственную роль поддержки.
   * @returns {string} Роль.
   */
  supportRole() {
    return Cloud.isSuperAdmin ? 'superadmin' : Cloud.isAdmin ? 'admin' : Cloud.isDeveloper ? 'developer' : '';
  },
  /**
   * Возвращает выбранного получателя сообщений.
   * @returns {string} Роль получателя.
   */
  recipient() {
    return ui.dmRole || Dm.supportRole() || (Groups.get(Groups.current).supportRoles || ['superadmin'])[0];
  },
  /**
   * Возвращает подпись сотрудника в чате.
   * @param {string} role Роль получателя.
   * @returns {string} Имя.
   */
  contactName(role) {
    return (
      {
        admin: (Groups.get(Groups.current).leader || 'Лебедев Петр Андреевич') + ' · староста',
        developer: 'Кузьменков Макар Сергеевич · разработчик',
        superadmin: 'Админ Арина',
      }[role] || 'Поддержка'
    );
  },
  /**
   * Загружает сообщения личного чата с админом.
   */
  async refresh() {
    if (!supa || Cloud.status !== 'online' || !Cloud.hasCabinet()) return;
    let q = supa
      .from('chat')
      .select(
        'id,thread_uid,sender,body,created_at,read_by_admin,read_by_student,recipient_role,sender_label,file_path,file_name,file_size,meta',
      )
      .eq('tenant_id', Cloud.tenantId || 'group_1')
      .order('created_at', {
        ascending: false,
      })
      .limit(1500);
    if (!Dm.support()) q = q.eq('thread_uid', Cloud.uid);
    const {data, error} = await q;
    if (error) {
      Dm.error = error.message;
      return;
    }
    const list = data.slice().reverse(),
      sig = list.map((m) => [m.id, !!m.read_by_student, !!m.read_by_admin].join(':')).join(',');
    const incoming = list.filter(Dm.isIncoming),
      prevIncoming = Dm.msgs.filter(Dm.isIncoming);
    const fresh = Dm.loaded && incoming.length > prevIncoming.length ? incoming[incoming.length - 1] : null;
    Dm.msgs = list;
    Dm.error = '';
    Dm.loadWelcomeRecipients();
    if (sig === Dm.sig) {
      Dm.loaded = true;
      return;
    }
    Dm.sig = sig;
    Dm.loaded = true;
    if (fresh && document.hidden)
      Notifier.show(
        'chat',
        Dm.support() ? Dm.nameOf(fresh.thread_uid) : Dm.contactName(fresh.recipient_role),
        String(fresh.body).slice(0, 100),
        {
          tag: 'dm',
        },
      );
    renderChatUpdates();
  },
  /**
   * Запускает периодическое обновление личных сообщений.
   */
  start() {
    if (Dm.timer) return;
    Dm.refresh();
    Dm.timer = setInterval(() => {
      if (!document.hidden) Dm.refresh();
    }, 10000);
  },
  /**
   * Проверяет, пришло ли сообщение от собеседника.
   * @param {Object} m Сообщение.
   * @returns {boolean} true, если условие выполнено.
   */
  isIncoming(m) {
    return m.sender !== Cloud.uid;
  },
  /**
   * Проверяет, написано ли сообщение текущим пользователем.
   * @param {Object} m Сообщение.
   * @returns {boolean} true, если условие выполнено.
   */
  isMine(m) {
    return !Dm.isIncoming(m);
  },
  /**
   * Возвращает сообщения переписки со студентом.
   * @param {string} uid Идентификатор студента.
   * @returns {Array<Object>} Массив.
   */
  threadMsgs(uid, role) {
    return Dm.msgs.filter(
      (m) => m.thread_uid === uid && (m.recipient_role || 'superadmin') === (role || Dm.recipient()),
    );
  },
  /**
   * Считает непрочитанные сообщения в переписке.
   * @param {string} uid Идентификатор студента.
   * @returns {number} Число.
   */
  unreadIn(uid) {
    const flag = uid === Cloud.uid ? 'read_by_student' : 'read_by_admin';
    return Dm.threadMsgs(uid).filter((m) => Dm.isIncoming(m) && !m[flag]).length;
  },
  /**
   * Считает все непрочитанные личные сообщения.
   * @returns {number} Число.
   */
  unreadTotal() {
    return Dm.msgs.filter(
      (m) => Dm.isIncoming(m) && !m[m.thread_uid === Cloud.uid ? 'read_by_student' : 'read_by_admin'],
    ).length;
  },
  /**
   * Возвращает имя студента по идентификатору.
   * @param {string} uid Идентификатор студента.
   * @returns {string} Строка.
   */
  nameOf(uid) {
    return (Cloud.adm.profiles[uid] || {}).name || 'Студент';
  },
  /**
   * Строит список переписок админа: закреплённые сверху, затем по времени.
   * @returns {Array<Object>} Массив.
   */
  threads() {
    const by = {};
    Dm.msgs.forEach((m) => {
      if (m.thread_uid === Cloud.uid) return;
      const key = m.thread_uid + '|' + (m.recipient_role || 'superadmin');
      const t =
        by[key] ||
        (by[key] = {
          id: key,
          role: m.recipient_role || 'superadmin',
          uid: m.thread_uid,
          last: m,
          unread: 0,
        });
      t.last = m;
      if (Dm.isIncoming(m) && !m.read_by_admin) t.unread++;
    });
    const pins = (Cloud.profile && Cloud.profile.pins) || [];
    return Object.values(by).sort(
      (a, b) =>
        pins.includes(b.uid) - pins.includes(a.uid) ||
        String(b.last.created_at).localeCompare(String(a.last.created_at)),
    );
  },
  /**
   * Отправляет личное сообщение.
   * @param {string} uid Идентификатор студента (чья переписка).
   * @param {string} text Текст сообщения.
   * @returns {Promise<boolean>} удалось ли отправить.
   */
  async send(uid, text) {
    const body = String(text || '')
      .trim()
      .slice(0, 4000);
    if (!body) return false;
    const {error} = await supa.from('chat').insert({
      tenant_id: Cloud.tenantId || 'group_1',
      recipient_role: Dm.recipient(),
      thread_uid: uid,
      sender: Cloud.uid,
      kind: 'text',
      body,
    });
    if (error) {
      toast('Не удалось отправить: ' + error.message);
      return false;
    }
    await Dm.refresh();
    Ach.check();
    return true;
  },
  /**
   * Помечает входящие сообщения переписки прочитанными.
   * @param {string} uid Идентификатор студента.
   */
  async markRead(uid) {
    if (document.hidden || document.querySelector('#modal-root')?.firstChild) return;
    const flag = uid === Cloud.uid ? 'read_by_student' : 'read_by_admin',
      unread = Dm.threadMsgs(uid).filter((m) => Dm.isIncoming(m) && !m[flag]);
    if (!unread.length) return;
    unread.forEach((m) => {
      m[flag] = true;
    });
    let q = supa
      .from('chat')
      .update({
        [flag]: true,
      })
      .eq('thread_uid', uid)
      .eq('tenant_id', Cloud.tenantId || 'group_1')
      .eq('recipient_role', Dm.recipient())
      .eq(flag, false);
    q = q.neq('sender', Cloud.uid);
    await q;
  },
  /**
   * Закрепляет или открепляет переписку.
   * @param {string} uid Идентификатор студента.
   */
  togglePin(uid) {
    const pins = ((Cloud.profile && Cloud.profile.pins) || []).slice(),
      i = pins.indexOf(uid);
    if (i >= 0) pins.splice(i, 1);
    else pins.unshift(uid);
    Cloud.profile.pins = pins;
    Cloud.pushProfile();
  },
};
/**
 * Считает все непрочитанные сообщения для бейджа меню.
 * @returns {number} Число.
 */
function chatUnread() {
  return (
    (Cloud.isStaff ? 0 : Chat.unread()) +
    Dm.unreadTotal() +
    (typeof GroupRooms !== 'undefined' ? GroupRooms.unread() : 0) +
    (typeof CuratorChats !== 'undefined' ? CuratorChats.unread() : 0) +
    (typeof Social !== 'undefined' ? Social.unread() : 0)
  );
}

/** A tick confirms server storage; two ticks reflect the recipient's persisted read flag. */
function messageReceipt(read, bot = false) {
  const label = read ? (bot ? 'Политешик ответил' : 'Прочитано') : 'Отправлено · пока не прочитано';
  return (
    '<span class="message-receipt' +
    (read ? ' is-read' : '') +
    '" role="img" aria-label="' +
    label +
    '" title="' +
    label +
    '"><span aria-hidden="true">' +
    (read ? '✓✓' : '✓') +
    '</span></span>'
  );
}

function renderChatUpdates() {
  const focused = document.activeElement;
  if (
    typeof ui !== 'undefined' &&
    ui.tab === 'chat' &&
    focused &&
    focused.matches &&
    focused.matches('textarea[data-chat-draft]') &&
    !document.querySelector('#modal-root')?.firstChild
  )
    App.render();
  else App.renderSoft();
}
