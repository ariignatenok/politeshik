'use strict';

Object.assign(A, {
  /**
   * Задаёт Политешику готовый вопрос.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'faq-ask'(el) {
    Chat.faq(+el.dataset.i);
  },
  /**
   * Возвращает стандартные вопросы Политешика.
   */
  'faq-reset'() {
    Cloud.faq = null;
    Cloud.saveFaq();
    App.render();
    toast('Стандартные вопросы возвращены');
  },
  /**
   * Принимает ответ «готов» или «не готов» в чате с Политешиком.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'chat-ans'(el) {
    Chat.answer(el.dataset.wk, el.dataset.v === 'y');
  },
  /**
   * Отправляет Политешику быстрый вопрос.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'chat-quick'(el) {
    Chat.reply(el.dataset.q);
  },
  /**
   * Переходит по ссылке из сообщения Политешика.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'chat-go'(el) {
    const m = Chat.st().msgs.find(x => x.id === el.dataset.mid),
      l = m && m.links && m.links[+el.dataset.i];
    if (!l) return;
    ui.tab = 'subjects';
    ui.subjectId = l.sid;
    ui.subjTab = l.tab;
    ui.study = null;
    ui.noteQuery = '';
    ui.cardCat = 'all';
    ui.cardQuery = '';
    ui.cardUnknown = false;
    ui.fQuery = '';
    App.render(true);
    window.scrollTo(0, 0);
    if (l.nid) openNoteReader(l.nid);
    if (l.study) A['study-start']();
  },
  /**
   * Открывает выбранный чат.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'open-chat'(el) {
    UI.close();
    ui.tab = 'chat';
    ui.chatWith = el.dataset.with;
    App.render(true);
    window.scrollTo(0, 0);
  },
  /**
   * Возвращает к списку чатов.
   */
  'chat-back'() {
    ui.chatWith = null;
    App.render();
  },
  /**
   * Закрепляет или открепляет чат со студентом.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'dm-pin'(el) {
    Dm.togglePin(el.dataset.uid);
    App.render();
  },
  /**
   * Показывает список студентов для нового чата.
   */
  'dm-new'() {
    const rows = studentRows().filter(x => x.id !== Cloud.uid);
    UI.open(
      'Новый чат',
      rows.length
        ? '<div class="chat-list">' +
            rows
              .map(x =>
                chatRow({
                  id: x.id,
                  title: x.p.name || 'Студент',
                  subtitle: 'подгруппа ' + (x.p.subgroup || '—'),
                  avatar: avatarOf(x.p.avatar, 40)
                })
              )
              .join('') +
            '</div>'
        : '<div class="empty">Пока никто из студентов не вошёл в приложение.</div>'
    );
  },
  /**
   * Открывает форму новости.
   */
  'news-add'() {
    openNewsForm();
  },
  /**
   * Удаляет новость после подтверждения.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  async 'news-del'(el) {
    if (!(await UI.confirm('Удалить новость вместе с комментариями?', 'Удалить'))) return;
    News.remove(el.dataset.id);
  },
  /**
   * Удаляет комментарий.
   * @param {HTMLElement} el Элемент, по которому кликнули; параметры передаются через его data-атрибуты.
   */
  'comment-del'(el) {
    News.removeComment(el.dataset.id);
  }
});
