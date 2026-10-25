'use strict';

const Focus = {
  minutes: 25,
  endsAt: 0,
  total: 0,
  timer: null,
  audio: null,
  finished: false,
  ring: 2 * Math.PI * 88,
  /**
   * Проверяет, идёт ли сейчас фокус-таймер.
   * @returns {boolean} true, если условие выполнено.
   */
  running() {
    return Focus.endsAt > Date.now();
  },
  /**
   * Возвращает, сколько миллисекунд осталось.
   * @returns {number} Число.
   */
  left() {
    return Math.max(0, Focus.endsAt - Date.now());
  },
  /**
   * Форматирует время как ММ:СС.
   * @param {number} ms Миллисекунды.
   * @returns {string} Строка.
   */
  clock(ms) {
    const seconds = Math.ceil(ms / 1000);
    return U.pad(Math.floor(seconds / 60)) + ':' + U.pad(seconds % 60);
  },
  /**
   * Возвращает подпись кнопки «Фокус» с остатком времени.
   * @returns {string} Строка.
   */
  buttonLabel() {
    return Focus.running() ? 'Фокус · ' + Focus.clock(Focus.left()) : 'Фокус';
  },
  /**
   * Проверяет, включён ли звук в конце.
   * @returns {boolean} true, если условие выполнено.
   */
  soundOn() {
    return Store.s.settings.focusSound !== false;
  },
  /**
   * Строит содержимое окна таймера.
   * @returns {string} HTML.
   */
  bodyHtml() {
    const running = Focus.running(),
      mood = running ? 'meditate' : Focus.finished ? 'cheer' : 'happy';
    const text = running
      ? 'Давай просто посидим с учёбой. Я рядом.'
      : Focus.finished
        ? 'Время отдохнуть!'
        : 'Давай просто посидим с учёбой ' + Focus.minutes + ' минут. Я рядом.';
    const buttons = running
      ? '<button class="btn danger" data-action="focus-stop">Стоп</button><button class="btn" data-action="focus-restart">Заново</button>'
      : Focus.finished
        ? '<button class="btn primary" data-action="focus-restart">Заново</button><button class="btn" data-action="modal-close">Закрыть</button>'
        : '<button class="btn primary" data-action="focus-start">Начать на ' + Focus.minutes + ' минут</button>';
    return (
      '<div class="focus-body"><div class="focus-stage"><svg class="focus-ring" viewBox="0 0 200 200" aria-hidden="true"><circle class="focus-track" cx="100" cy="100" r="88"/><circle id="focus-arc" class="focus-arc" cx="100" cy="100" r="88" stroke-dasharray="' +
      Focus.ring.toFixed(2) +
      '" stroke-dashoffset="' +
      Focus.ring.toFixed(2) +
      '" transform="rotate(-90 100 100)"/></svg>' +
      '<div class="focus-mascot">' +
      Mascot.svg(mood, 96, '', {
        season: ''
      }) +
      '</div></div><div id="focus-time" class="focus-time">' +
      Focus.clock(running ? Focus.left() : Focus.minutes * 60000) +
      '</div>' +
      '<p id="focus-msg" class="focus-msg">' +
      text +
      '</p><div class="focus-actions">' +
      buttons +
      '</div>' +
      '<label class="check-row focus-sound"><input type="checkbox" data-change="focus-sound"' +
      (Focus.soundOn() ? ' checked' : '') +
      '> Звук в конце</label></div>'
    );
  },
  /**
   * Открывает окно фокус-режима.
   */
  open() {
    if (Cloud.isStaff) return;
    UI.open('Фокус-режим', Focus.bodyHtml(), {
      noFocus: true
    });
    Focus.paint();
  },
  /**
   * Перерисовывает открытое окно таймера.
   */
  refreshModal() {
    const body = document.querySelector('#modal-root .modal-body');
    if (body && body.querySelector('.focus-body')) {
      body.innerHTML = Focus.bodyHtml();
      Focus.paint();
    }
  },
  /**
   * Обновляет кольцо, время и подпись кнопки.
   */
  paint() {
    const arc = document.getElementById('focus-arc'),
      time = document.getElementById('focus-time');
    if (arc && Focus.running()) {
      arc.style.strokeDashoffset = (Focus.ring * (1 - (Focus.total - Focus.left()) / Focus.total)).toFixed(2);
      if (time) time.textContent = Focus.clock(Focus.left());
    }
    document.querySelectorAll('[data-action="focus-open"]').forEach(node => {
      node.textContent = Focus.buttonLabel();
      node.classList.toggle('live', Focus.running());
    });
  },
  /**
   * Подготавливает звук по нажатию пользователя (иначе браузер его не разрешит).
   */
  unlockAudio() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    try {
      Focus.audio = Focus.audio || new Context();
      if (Focus.audio.state === 'suspended' && Focus.audio.resume) Focus.audio.resume();
    } catch (error) {
      Focus.audio = null;
    }
  },
  /**
   * Играет тихий звон Web Audio.
   * @returns {boolean} удалось ли.
   */
  chime() {
    if (!Focus.soundOn()) return false;
    Focus.unlockAudio();
    const context = Focus.audio;
    if (!context) return false;
    try {
      const now = context.currentTime;
      [
        [880, 0],
        [1318.5, 0.18]
      ].forEach(pair => {
        const oscillator = context.createOscillator(),
          gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = pair[0];
        gain.gain.setValueAtTime(0.0001, now + pair[1]);
        gain.gain.exponentialRampToValueAtTime(0.16, now + pair[1] + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + pair[1] + 1.6);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now + pair[1]);
        oscillator.stop(now + pair[1] + 1.7);
      });
      return true;
    } catch (error) {
      return false;
    }
  },
  /**
   * Один шаг таймера: обновляет вид или завершает отсчёт.
   */
  beat() {
    if (Focus.endsAt && !Focus.running()) {
      Focus.finish();
      return;
    }
    Focus.paint();
  },
  /**
   * Запускает отсчёт на заданное время.
   * @param {number} duration Длительность в миллисекундах.
   */
  begin(duration) {
    Focus.total = duration;
    Focus.endsAt = Date.now() + duration;
    Focus.finished = false;
    Store.s.meta.focusEnd = Focus.endsAt;
    Store.s.meta.focusTotal = duration;
    Store.save();
    clearInterval(Focus.timer);
    Focus.timer = setInterval(Focus.beat, 250);
  },
  /**
   * Запускает фокус на 25 минут.
   */
  start() {
    if (Cloud.isStaff) return;
    Focus.unlockAudio();
    Focus.begin(Focus.minutes * 60000);
    Focus.sync();
  },
  /**
   * Останавливает таймер и сбрасывает его.
   */
  stop() {
    clearInterval(Focus.timer);
    Focus.timer = null;
    Focus.endsAt = 0;
    Focus.finished = false;
    Store.s.meta.focusEnd = 0;
    Store.save();
    Focus.sync();
  },
  /**
   * Запускает отсчёт заново.
   */
  restart() {
    Focus.stop();
    Focus.start();
  },
  /**
   * Завершает отсчёт: звон, уведомление «Время отдохнуть!», конфетти.
   */
  finish() {
    clearInterval(Focus.timer);
    Focus.timer = null;
    Focus.endsAt = 0;
    Focus.finished = true;
    Store.s.meta.focusEnd = 0;
    Store.save();
    Focus.chime();
    Notifier.show('focus', 'Время отдохнуть!', Focus.minutes + ' минут сосредоточенной работы позади', {
      urgent: true,
      tag: 'focus'
    });
    Confetti.burst({
      count: 50
    });
    Focus.sync();
  },
  /**
   * Перерисовывает маскота и окно после смены состояния.
   */
  sync() {
    ['brand-mascot', 'top-mascot'].forEach(id => {
      const node = document.getElementById(id);
      if (node) node.dataset.m = '';
    });
    App.render();
    Focus.refreshModal();
    Focus.paint();
  },
  /**
   * Продолжает таймер после перезагрузки страницы.
   */
  restore() {
    const end = Store.s.meta.focusEnd;
    if (!end || end <= Date.now()) return;
    Focus.total = Store.s.meta.focusTotal || Focus.minutes * 60000;
    Focus.endsAt = end;
    clearInterval(Focus.timer);
    Focus.timer = setInterval(Focus.beat, 250);
  }
};
