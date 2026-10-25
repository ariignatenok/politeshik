'use strict';

const Dm = {
  msgs: [],
  loaded: false,
  timer: null,
  sig: '',
  error: '',
  /**
   * Загружает сообщения личного чата с админом.
   */
  async refresh() {
    if (!supa || Cloud.status !== 'online' || !Cloud.hasCabinet()) return;
    let q = supa
      .from('chat')
      .select('id,thread_uid,sender,body,created_at,read_by_admin,read_by_student')
      .order('created_at', {
        ascending: false
      })
      .limit(1500);
    if (!Cloud.isAdmin) q = q.eq('thread_uid', Cloud.uid);
    const {data, error} = await q;
    if (error) {
      Dm.error = error.message;
      return;
    }
    const list = data.slice().reverse(),
      sig = list.map(m => m.id + (Cloud.isAdmin ? m.read_by_admin : m.read_by_student)).join(',');
    const incoming = list.filter(Dm.isIncoming),
      prevIncoming = Dm.msgs.filter(Dm.isIncoming);
    const fresh = Dm.loaded && incoming.length > prevIncoming.length ? incoming[incoming.length - 1] : null;
    Dm.msgs = list;
    Dm.error = '';
    if (sig === Dm.sig) {
      Dm.loaded = true;
      return;
    }
    Dm.sig = sig;
    Dm.loaded = true;
    if (fresh && document.hidden)
      Notifier.show(
        'chat',
        Cloud.isAdmin ? Dm.nameOf(fresh.thread_uid) : 'Игнатенок Арина (Админ)',
        String(fresh.body).slice(0, 100),
        {
          tag: 'dm'
        }
      );
    App.renderSoft();
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
    return Cloud.isAdmin ? m.sender === m.thread_uid : m.sender !== m.thread_uid;
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
  threadMsgs(uid) {
    return Dm.msgs.filter(m => m.thread_uid === uid);
  },
  /**
   * Считает непрочитанные сообщения в переписке.
   * @param {string} uid Идентификатор студента.
   * @returns {number} Число.
   */
  unreadIn(uid) {
    const flag = Cloud.isAdmin ? 'read_by_admin' : 'read_by_student';
    return Dm.threadMsgs(uid).filter(m => Dm.isIncoming(m) && !m[flag]).length;
  },
  /**
   * Считает все непрочитанные личные сообщения.
   * @returns {number} Число.
   */
  unreadTotal() {
    if (!Cloud.isAdmin) return Dm.unreadIn(Cloud.uid);
    return Dm.msgs.filter(m => Dm.isIncoming(m) && !m.read_by_admin).length;
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
    Dm.msgs.forEach(m => {
      const t =
        by[m.thread_uid] ||
        (by[m.thread_uid] = {
          uid: m.thread_uid,
          last: m,
          unread: 0
        });
      t.last = m;
      if (Dm.isIncoming(m) && !m.read_by_admin) t.unread++;
    });
    const pins = (Cloud.profile && Cloud.profile.pins) || [];
    return Object.values(by).sort(
      (a, b) =>
        pins.includes(b.uid) - pins.includes(a.uid) ||
        String(b.last.created_at).localeCompare(String(a.last.created_at))
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
      thread_uid: uid,
      sender: Cloud.uid,
      kind: 'text',
      body
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
    const flag = Cloud.isAdmin ? 'read_by_admin' : 'read_by_student',
      unread = Dm.threadMsgs(uid).filter(m => Dm.isIncoming(m) && !m[flag]);
    if (!unread.length) return;
    unread.forEach(m => {
      m[flag] = true;
    });
    let q = supa
      .from('chat')
      .update({
        [flag]: true
      })
      .eq('thread_uid', uid)
      .eq(flag, false);
    q = Cloud.isAdmin ? q.eq('sender', uid) : q.neq('sender', Cloud.uid);
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
  }
};
/**
 * Считает все непрочитанные сообщения для бейджа меню.
 * @returns {number} Число.
 */
function chatUnread() {
  return (Cloud.isStaff ? 0 : Chat.unread()) + Dm.unreadTotal();
}
