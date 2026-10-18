'use strict';

const News = {
  items: [],
  comments: [],
  likes: [],
  loaded: false,
  timer: null,
  sig: '',
  /**
   * Загружает новости и комментарии.
   */
  async refresh() {
    if (!supa || Cloud.status !== 'online' || !Cloud.hasCabinet()) return;
    const [n, c, l] = await Promise.all([
      supa
        .from('news')
        .select('*')
        .order('news_date', {
          ascending: false
        })
        .order('created_at', {
          ascending: false
        })
        .limit(100),
      supa
        .from('news_comments')
        .select('*')
        .order('created_at', {
          ascending: true
        })
        .limit(2000),
      supa.from('news_likes').select('news_id,uid').limit(5000)
    ]);
    if (n.error || c.error) return;
    const likeRows = l.error ? [] : l.data;
    const sig =
      n.data.map(x => x.id + x.title).join(',') +
      '|' +
      c.data.map(x => x.id).join(',') +
      '|' +
      likeRows.map(x => x.news_id + x.uid).join(',');
    const fresh = News.loaded && !Cloud.isAdmin && n.data.length > News.items.length ? n.data[0] : null;
    News.items = n.data;
    News.comments = c.data;
    News.likes = likeRows;
    if (sig === News.sig) {
      News.loaded = true;
      return;
    }
    News.sig = sig;
    News.loaded = true;
    if (fresh && document.hidden)
      Notifier.show('chat', 'Новость: ' + fresh.title, String(fresh.body).slice(0, 100), {
        tag: 'news'
      });
    App.renderSoft();
  },
  /**
   * Запускает периодическое обновление новостей.
   */
  start() {
    if (News.timer) return;
    News.refresh().then(() => Birthday.ensurePosts());
    News.timer = setInterval(() => {
      if (!document.hidden) News.refresh();
    }, 20000);
  },
  /**
   * Возвращает лайки новости.
   * @param {string} newsId Идентификатор новости.
   * @returns {Array<Object>} Массив.
   */
  likesOf(newsId) {
    return News.likes.filter(l => l.news_id === newsId);
  },
  /**
   * Ставит или снимает свой лайк новости.
   * @param {string} newsId Идентификатор новости.
   */
  async like(newsId) {
    const mine = News.likes.some(l => l.news_id === newsId && l.uid === Cloud.uid);
    if (mine) {
      News.likes = News.likes.filter(l => !(l.news_id === newsId && l.uid === Cloud.uid));
      await supa.from('news_likes').delete().eq('news_id', newsId).eq('uid', Cloud.uid);
    } else {
      News.likes = News.likes.concat([
        {
          news_id: newsId,
          uid: Cloud.uid
        }
      ]);
      const {error} = await supa.from('news_likes').insert({
        news_id: newsId
      });
      if (error) News.likes = News.likes.filter(l => !(l.news_id === newsId && l.uid === Cloud.uid));
    }
    await News.refresh();
  },
  /**
   * Возвращает комментарии новости.
   * @param {string} newsId Идентификатор новости.
   * @returns {Array<Object>} Массив.
   */
  commentsOf(newsId) {
    return News.comments.filter(c => c.news_id === newsId);
  },
  /**
   * Считает новости, которых студент ещё не видел.
   * @returns {number} Число.
   */
  unread() {
    const seen = Store.s.meta.newsSeen || '';
    return News.items.filter(n => n.created_at > seen).length;
  },
  /**
   * Запоминает, что новости просмотрены.
   */
  markSeen() {
    const last = News.items.reduce((m, n) => (n.created_at > m ? n.created_at : m), '');
    if (last && last > (Store.s.meta.newsSeen || '')) {
      Store.s.meta.newsSeen = last;
      Store.save();
    }
  },
  /**
   * Публикует новость.
   * @param {string} title Заголовок.
   * @param {string} body Текст.
   * @param {string} date Дата новости, ГГГГ-ММ-ДД.
   * @returns {Promise<boolean>} true, если условие выполнено.
   */
  async add(title, body, date) {
    const {error} = await supa.from('news').insert({
      title,
      body,
      news_date: date
    });
    if (error) {
      toast('Не удалось опубликовать: ' + error.message);
      return false;
    }
    await News.refresh();
    return true;
  },
  /**
   * Удаляет новость.
   * @param {string} id Идентификатор записи.
   */
  async remove(id) {
    const {error} = await supa.from('news').delete().eq('id', id);
    if (error) {
      toast('Не удалось удалить: ' + error.message);
      return;
    }
    await News.refresh();
  },
  /**
   * Добавляет комментарий.
   * @param {string} newsId Идентификатор новости.
   * @param {string} body Текст комментария.
   * @returns {Promise<boolean>} true, если условие выполнено.
   */
  async comment(newsId, body) {
    const text = String(body || '')
      .trim()
      .slice(0, 1000);
    if (!text) return false;
    const {error} = await supa.from('news_comments').insert({
      news_id: newsId,
      body: text
    });
    if (error) {
      toast('Не удалось отправить комментарий: ' + error.message);
      return false;
    }
    await News.refresh();
    Ach.check();
    return true;
  },
  /**
   * Удаляет комментарий.
   * @param {string} id Идентификатор записи.
   */
  async removeComment(id) {
    const {error} = await supa.from('news_comments').delete().eq('id', id);
    if (error) {
      toast('Не удалось удалить: ' + error.message);
      return;
    }
    await News.refresh();
  }
};
