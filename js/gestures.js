'use strict';

const Gestures = {
  startX: 0,
  startY: 0,
  startTime: 0,
  host: null,
  /**
   * Подключает отслеживание свайпов на сенсорном экране.
   */
  bind() {
    document.addEventListener(
      'touchstart',
      event => {
        const target = event.target && event.target.closest ? event.target : null;
        Gestures.host = target && !target.closest('.day-tabs') ? target.closest('[data-swipe]') : null;
        if (!Gestures.host) return;
        const touch = event.touches[0];
        Gestures.startX = touch.clientX;
        Gestures.startY = touch.clientY;
        Gestures.startTime = Date.now();
      },
      {
        passive: true
      }
    );
    document.addEventListener(
      'touchend',
      event => {
        const host = Gestures.host;
        Gestures.host = null;
        if (!host) return;
        const touch = event.changedTouches[0],
          dx = touch.clientX - Gestures.startX,
          dy = touch.clientY - Gestures.startY;
        if (Date.now() - Gestures.startTime > 700 || Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
        Gestures.swipe(host.dataset.swipe, dx < 0 ? 'left' : 'right');
      },
      {
        passive: true
      }
    );
  },
  /**
   * Выполняет действие по свайпу: листает дни расписания.
   * @param {string} kind Тип области свайпа.
   * @param {string} direction Направление: left или right.
   */
  swipe(kind, direction) {
    if (kind !== 'sched') return;
    const step = direction === 'left' ? 1 : -1;
    let next = ui.schedDay + step;
    if (next < 0 || next > 6) {
      ui.schedWs = Weeks.shift(ui.schedWs || Weeks.start(U.today()), step);
      next = next < 0 ? 6 : 0;
    }
    ui.schedDay = next;
    ui.schedDayWs = ui.schedWs || Weeks.start(U.today());
    App.render();
    const list = $('.sched-list');
    if (!list) return;
    list.classList.add('swipe-' + direction);
    setTimeout(() => list.classList.remove('swipe-' + direction), 340);
  }
};
Gestures.bind();
