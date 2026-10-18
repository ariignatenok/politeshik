'use strict';

const Skeleton = {
  /**
   * Строит заглушку заголовка страницы.
   * @returns {string} HTML.
   */
  head() {
    return '<div class="sk-head"><span class="sk sk-line lg sk-w40"></span><span class="sk sk-line sk-w60"></span></div>';
  },
  /**
   * Строит заглушки строк списка.
   * @param {number} count Сколько строк.
   * @returns {string} HTML.
   */
  rows(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html +=
        '<div class="sk-row"><span class="sk sk-circle"></span><div><span class="sk sk-line sk-w80"></span><span class="sk sk-line sm sk-w40"></span></div></div>';
    }
    return html;
  },
  /**
   * Строит заглушки трёх плиток статистики.
   * @returns {string} HTML.
   */
  stats() {
    return '<div class="sk-stats"><span class="sk sk-stat"></span><span class="sk sk-stat"></span><span class="sk sk-stat"></span></div>';
  },
  /**
   * Строит заглушки карточек новостей.
   * @param {number} count Сколько карточек.
   * @returns {string} HTML.
   */
  news(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html +=
        '<div class="sk-news"><span class="sk sk-line lg"></span><span class="sk sk-line sk-w80"></span><span class="sk sk-line sk-w60"></span><div class="sk-actions"><span class="sk"></span><span class="sk"></span></div></div>';
    }
    return html;
  },
  /**
   * Строит заглушку карточки со списком.
   * @param {number} rowCount Сколько строк в карточке.
   * @returns {string} HTML.
   */
  card(rowCount) {
    return '<div class="sk-card"><span class="sk sk-line sk-w30"></span>' + Skeleton.rows(rowCount) + '</div>';
  },
  /**
   * Строит заглушку экрана на время загрузки данных.
   * @param {string} tab Идентификатор раздела.
   * @returns {string} HTML.
   */
  forTab(tab) {
    const body =
      tab === 'dashboard'
        ? '<div class="sk-card sk-hero"><span class="sk sk-circle big"></span><div><span class="sk sk-line sk-w60"></span><span class="sk sk-line sm sk-w40"></span></div></div>' +
          Skeleton.stats() +
          Skeleton.card(3)
        : tab === 'schedule'
          ? Skeleton.card(5)
          : tab === 'news'
            ? Skeleton.news(3)
            : Skeleton.card(4);
    return '<div class="skeleton-view" aria-busy="true" aria-label="Загрузка">' + Skeleton.head() + body + '</div>';
  }
};
