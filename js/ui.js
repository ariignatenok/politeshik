'use strict';

const UI = {
  /**
   * Открывает модальное окно.
   * @param {string} title Заголовок окна.
   * @param {string} body HTML содержимого.
   * @param {Object} opts Параметры: wide, locked, noFocus.
   */
  open(title, body, opts) {
    opts = opts || {};
    UI.locked = !!opts.locked;
    $('#modal-root').innerHTML =
      '<div class="overlay"><div class="modal' +
      (opts.wide ? ' wide' : '') +
      '" role="dialog" aria-modal="true" aria-label="' +
      U.esc(title) +
      '">' +
      '<div class="modal-head"><h3>' +
      U.esc(title) +
      '</h3>' +
      (opts.locked ? '' : '<button class="icon-btn" data-action="modal-close" aria-label="Закрыть">✕</button>') +
      '</div>' +
      '<div class="modal-body">' +
      body +
      '</div></div></div>';
    document.body.classList.add('modal-open');
    const f = $('#modal-root input:not([type=hidden]):not([type=radio]):not([type=checkbox]),#modal-root textarea');
    if (f && !opts.noFocus)
      setTimeout(() => {
        try {
          f.focus();
        } catch (e) {}
      }, 60);
  },
  /**
   * Закрывает модальное окно.
   */
  close() {
    UI.locked = false;
    $('#modal-root').innerHTML = '';
    document.body.classList.remove('modal-open');
  },
  /**
   * Показывает окно подтверждения.
   * @param {string} msg Вопрос.
   * @param {string} okLabel Подпись кнопки подтверждения.
   * @returns {Promise<boolean>} Результат выполнения.
   */
  confirm(msg, okLabel) {
    return new Promise(res => {
      const root = $('#confirm-root');
      root.innerHTML =
        '<div class="overlay"><div class="modal" role="alertdialog"><div class="modal-body" style="padding-top:20px"><p style="margin:0 0 16px">' +
        U.esc(msg) +
        '</p><div class="modal-foot"><button class="btn" id="cf-no">Отмена</button><button class="btn danger" id="cf-yes">' +
        U.esc(okLabel || 'Удалить') +
        '</button></div></div></div></div>';
      const done = v => {
        root.innerHTML = '';
        res(v);
      };
      $('#cf-no').onclick = () => done(false);
      $('#cf-yes').onclick = () => done(true);
      root.firstChild.addEventListener('click', e => {
        if (e.target === root.firstChild) done(false);
      });
    });
  },
  /**
   * Показывает короткое сообщение.
   * @param {string} msg Текст сообщения.
   */
  toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    $('#toast').appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity .3s';
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 320);
    }, 2400);
  },
  /**
   * Встряхивает элемент, показывая ошибку ввода.
   * @param {HTMLElement} el Встряхиваемый элемент.
   */
  shake(el) {
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  },
  /**
   * Применяет сохранённую тему оформления.
   */
  applyTheme() {
    const t = THEME_IDS.indexOf(Store.s.settings.theme) >= 0 ? Store.s.settings.theme : 'dark',
      th = THEMES.find(x => x.id === t);
    document.documentElement.setAttribute('data-theme', t);
    try {
      window.localStorage.setItem('politeshik:theme', t);
    } catch (e) {}
    const a = $('#theme-btn-side'),
      b = $('#theme-btn-top');
    if (a) a.textContent = th.ico + ' Тема: ' + th.name;
    if (b) b.textContent = th.ico;
    const fx = $('#bgfx');
    if (fx && fx.dataset.t !== t) {
      fx.dataset.t = t;
      fx.innerHTML = Themes.layer(t);
    }
  }
};
const toast = UI.toast;
