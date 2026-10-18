'use strict';

const ScrollLock = {
  locked: false,
  y: 0,
  /**
   * Проверяет, открыто ли окно, под которым страница не должна прокручиваться.
   * @returns {boolean} true, если условие выполнено.
   */
  want() {
    const modal = document.getElementById('modal-root'),
      confirmRoot = document.getElementById('confirm-root');
    return !!(
      (modal && modal.firstChild) ||
      (confirmRoot && confirmRoot.firstChild) ||
      document.getElementById('palette')
    );
  },
  /**
   * Блокирует или возвращает прокрутку страницы вместе с положением, где пользователь был.
   */
  sync() {
    const wanted = ScrollLock.want();
    if (wanted === ScrollLock.locked) return;
    ScrollLock.locked = wanted;
    if (wanted) {
      ScrollLock.y = window.scrollY || 0;
      document.body.style.top = '-' + ScrollLock.y + 'px';
      document.body.classList.add('scroll-locked');
    } else {
      document.body.classList.remove('scroll-locked');
      document.body.style.top = '';
      window.scrollTo(0, ScrollLock.y);
    }
  },
  /**
   * Следит за открытием и закрытием окон.
   */
  bind() {
    const watch = node => {
      if (node)
        new MutationObserver(ScrollLock.sync).observe(node, {
          childList: true
        });
    };
    watch(document.getElementById('modal-root'));
    watch(document.getElementById('confirm-root'));
    new MutationObserver(ScrollLock.sync).observe(document.body, {
      childList: true
    });
  }
};
ScrollLock.bind();
