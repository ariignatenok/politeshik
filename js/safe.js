'use strict';

const Safe = {
  errors: [],
  reported: {},
  required: {
    Support: 'js/support.js',
    Birthday: 'js/birthday.js',
    Confetti: 'js/confetti.js',
    Teacher: 'js/teacher.js',
    Skeleton: 'js/skeleton.js',
    Sick: 'js/sick.js',
    Ics: 'js/ics.js',
    Search: 'js/search.js',
    QuickAdd: 'js/quickadd.js',
    Gestures: 'js/gestures.js',
    Weeks: 'js/weeks.js',
    Relax: 'js/relax.js',
    CampusMap: 'js/campusmap.js',
    Solutions: 'js/solutions.js',
    Focus: 'js/focus.js',
    ScrollLock: 'js/scrolllock.js',
    Mascot: 'js/mascot.js'
  },
  /**
   * Записывает ошибку в журнал и в консоль, не ломая страницу.
   * @param {string} label Где произошла ошибка.
   * @param {Error} error Ошибка.
   */
  report(label, error) {
    Safe.errors.push({
      label,
      message: String((error && error.message) || error),
      at: new Date().toISOString()
    });
    if (Safe.errors.length > 30) Safe.errors.shift();
    try {
      console.error('[Политешик] ' + label, error);
    } catch (ignored) {
      return;
    }
  },
  /**
   * Строит кусок страницы; при ошибке возвращает запасной вариант, а не роняет всё приложение.
   * @param {string} label Название блока.
   * @param {Function} build Функция, строящая HTML.
   * @param {string} fallback Что показать при ошибке (необязательно).
   * @returns {string} HTML.
   */
  html(label, build, fallback) {
    try {
      return build();
    } catch (error) {
      Safe.report(label, error);
      return fallback === undefined ? '' : fallback;
    }
  },
  /**
   * Выполняет действие; при ошибке записывает её и идёт дальше.
   * @param {string} label Название действия.
   * @param {Function} task Выполняемое действие.
   * @returns {*} результат или undefined.
   */
  run(label, task) {
    try {
      return task();
    } catch (error) {
      Safe.report(label, error);
      return undefined;
    }
  },
  /**
   * Строит карточку «Раздел не открылся».
   * @param {string} label Название раздела.
   * @returns {string} HTML.
   */
  card(label) {
    const last = Safe.errors.length ? Safe.errors[Safe.errors.length - 1].message : '';
    return (
      '<section class="card err-card"><h2>Раздел не открылся</h2><p>Что-то пошло не так в разделе «' +
      U.esc(label) +
      '». Остальное приложение работает.</p>' +
      '<p class="md-help">' +
      U.esc(last) +
      '</p><div class="head-actions"><button class="btn primary" data-action="reload-app">Обновить страницу</button><button class="btn" data-action="nav" data-tab="schedule">Открыть расписание</button></div></section>'
    );
  },
  /**
   * Находит модули, которые не загрузились (например, не залит файл).
   * @returns {Array<string>} Массив.
   */
  missing() {
    return Object.keys(Safe.required).filter(name => {
      try {
        return typeof window[name] === 'undefined' && typeof eval(name) === 'undefined';
      } catch (error) {
        return true;
      }
    });
  },
  /**
   * Показывает плашку с названиями незагрузившихся файлов.
   * @returns {Array<string>} Массив.
   */
  selfCheck() {
    const lost = Safe.missing();
    if (!lost.length) return [];
    let banner = document.getElementById('boot-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'boot-banner';
      document.body.insertBefore(banner, document.body.firstChild);
    }
    banner.innerHTML =
      '<b>Не загрузились файлы:</b> ' +
      lost.map(n => Safe.required[n]).join(', ') +
      '. Залейте на GitHub все файлы из архива и обновите страницу (Cmd+Shift+R).';
    return lost;
  },
  /**
   * Подключает перехват необработанных ошибок страницы.
   */
  bind() {
    window.addEventListener('error', event => {
      Safe.report('window', event.error || event.message);
    });
    window.addEventListener('unhandledrejection', event => {
      Safe.report('promise', event.reason);
    });
  }
};
Safe.bind();
