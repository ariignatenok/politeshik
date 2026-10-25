'use strict';

const Relax = {
  timer: null,
  exercises: [
    {
      id: 'box',
      name: 'Квадратное дыхание',
      hint: 'Вдох 4 · пауза 4 · выдох 4 · пауза 4',
      phases: [
        ['Вдох', 4],
        ['Пауза', 4],
        ['Выдох', 4],
        ['Пауза', 4]
      ]
    },
    {
      id: '478',
      name: 'Дыхание 4-7-8',
      hint: 'Вдох 4 · пауза 7 · выдох 8',
      phases: [
        ['Вдох', 4],
        ['Пауза', 7],
        ['Выдох', 8]
      ]
    },
    {
      id: 'long',
      name: 'Долгий выдох',
      hint: 'Вдох 4 · выдох 6',
      phases: [
        ['Вдох', 4],
        ['Выдох', 6]
      ]
    }
  ],
  total: 60,
  /**
   * Строит список дыхательных упражнений.
   * @returns {string} HTML.
   */
  menuHtml() {
    return (
      '<div class="relax-intro"><div class="relax-mascot">' +
      Mascot.svg('sleepy', 84, '', {
        season: ''
      }) +
      '</div><p>Ты устал(а), и это нормально. Давай по минуте подышим вместе. Выбери упражнение:</p></div>' +
      '<div class="relax-list">' +
      Relax.exercises
        .map(
          e =>
            '<button class="relax-item" data-action="relax-start" data-id="' +
            e.id +
            '"><b>' +
            U.esc(e.name) +
            '</b><small>' +
            U.esc(e.hint) +
            ' · 1 минута</small></button>'
        )
        .join('') +
      '</div>'
    );
  },
  /**
   * Открывает окно «Я устал» с упражнениями.
   */
  open() {
    if (Cloud.isStaff) return;
    Relax.stop();
    UI.open('Я устал', Relax.menuHtml(), {
      noFocus: true
    });
  },
  /**
   * Останавливает таймер упражнения.
   */
  stop() {
    clearInterval(Relax.timer);
    Relax.timer = null;
  },
  /**
   * Определяет фазу дыхания в заданную секунду.
   * @param {Object} exercise Упражнение.
   * @param {number} second Секунда от начала.
   * @returns {Object} название, сколько осталось, длина.
   */
  phaseAt(exercise, second) {
    const cycle = exercise.phases.reduce((sum, p) => sum + p[1], 0);
    let rest = second % cycle;
    for (const phase of exercise.phases) {
      if (rest < phase[1])
        return {
          name: phase[0],
          left: phase[1] - rest,
          length: phase[1]
        };
      rest -= phase[1];
    }
    return {
      name: exercise.phases[0][0],
      left: 1,
      length: 1
    };
  },
  /**
   * Запускает минутное дыхательное упражнение.
   * @param {string} id Идентификатор упражнения.
   */
  start(id) {
    const exercise = Relax.exercises.find(e => e.id === id);
    if (!exercise) return;
    Relax.stop();
    let second = 0;
    const paint = () => {
      const box = document.getElementById('relax-live');
      if (!box) {
        Relax.stop();
        return;
      }
      const phase = Relax.phaseAt(exercise, second),
        grow =
          phase.name === 'Вдох' ||
          (phase.name === 'Пауза' && second > 0 && Relax.phaseAt(exercise, second - 1).name === 'Вдох');
      box.querySelector('.relax-circle').style.setProperty('--dur', phase.length + 's');
      box.querySelector('.relax-circle').classList.toggle('big', grow);
      box.querySelector('.relax-phase').textContent = phase.name + ' · ' + phase.left;
      box.querySelector('.relax-left').textContent = 'Осталось ' + (Relax.total - second) + ' с';
      box.querySelector('.relax-bar i').style.width = Math.round((second * 100) / Relax.total) + '%';
    };
    const body = document.querySelector('#modal-root .modal-body') || document.querySelector('#modal-root .modal');
    if (!body) return;
    body.innerHTML =
      '<div id="relax-live" class="relax-live"><h3>' +
      U.esc(exercise.name) +
      '</h3><div class="relax-stage"><div class="relax-circle"></div></div><div class="relax-phase"></div><div class="relax-bar"><i></i></div><small class="relax-left"></small></div>' +
      '<div class="modal-foot"><button class="btn" data-action="relax-menu">Другое упражнение</button><button class="btn primary" data-action="modal-close">Закончить</button></div>';
    paint();
    Relax.timer = setInterval(() => {
      second++;
      if (second >= Relax.total) {
        Relax.stop();
        Relax.finish();
        return;
      }
      paint();
    }, 1000);
  },
  /**
   * Показывает слова поддержки после упражнения.
   */
  finish() {
    const body = document.querySelector('#modal-root .modal-body') || document.querySelector('#modal-root .modal');
    if (!body) return;
    body.innerHTML =
      '<div class="relax-done"><div class="relax-mascot">' +
      Mascot.svg('happy', 96, '', {
        season: ''
      }) +
      '</div><h3>Умница!</h3><p>Минута для себя прошла. Всё идёт своим чередом, и ты справляешься.</p></div>' +
      '<div class="modal-foot"><button class="btn" data-action="relax-menu">Ещё раз</button><button class="btn primary" data-action="modal-close">Спасибо, Политешик!</button></div>';
  }
};
