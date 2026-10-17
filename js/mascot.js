'use strict';

const Mascot = {
  cheerUntil: 0,
  lastWalk: 0,

  /**
   * Рисует Политешика с заданным настроением.
   * @param {string} mood Настроение Политешика.
   * @param {number} size Размер в пикселях (необязательно).
   * @param {string} extraCls Дополнительный CSS-класс.
   * @returns {string} SVG.
   */
  svg(mood, size, extraCls) {
    mood = mood || 'happy';
    size = size || 64;
    const ink = '#1f2d3a',
      es =
        'animation-duration:' +
        (3 + Math.random() * 2).toFixed(2) +
        's;animation-delay:' +
        (Math.random() * 3).toFixed(2) +
        's';
    const eyes = (dx, dy, ry) =>
      '<g class="m-eyes" style="' +
      es +
      '"><ellipse cx="' +
      (46 + dx) +
      '" cy="' +
      (75 + dy) +
      '" rx="5" ry="' +
      (ry || 6.2) +
      '" fill="' +
      ink +
      '"/><ellipse cx="' +
      (74 + dx) +
      '" cy="' +
      (75 + dy) +
      '" rx="5" ry="' +
      (ry || 6.2) +
      '" fill="' +
      ink +
      '"/>' +
      '<circle cx="' +
      (44.4 + dx) +
      '" cy="' +
      (72.6 + dy) +
      '" r="1.8" fill="#fff"/><circle cx="' +
      (72.4 + dx) +
      '" cy="' +
      (72.6 + dy) +
      '" r="1.8" fill="#fff"/></g>';
    const line = (d, w) =>
      '<path d="' + d + '" fill="none" stroke="' + ink + '" stroke-width="' + (w || 3) + '" stroke-linecap="round"/>';
    let eyeSvg = eyes(0, 0),
      mouth = line('M52 85 Q60 93 68 85'),
      extra = '',
      cheek = '#ff9db8';
    let arms =
      '<ellipse cx="21" cy="84" rx="7" ry="10" transform="rotate(18 21 84)" fill="#6fd08f" stroke="#2f8a58" stroke-width="2.5"/>' +
      '<ellipse cx="99" cy="84" rx="7" ry="10" transform="rotate(-18 99 84)" fill="#6fd08f" stroke="#2f8a58" stroke-width="2.5"/>';
    if (mood === 'cheer') {
      eyeSvg = line('M40 77 q6 -9 12 0') + line('M68 77 q6 -9 12 0');
      mouth =
        '<path d="M51 85 Q60 100 69 85 Z" fill="#d8506b" stroke="' +
        ink +
        '" stroke-width="2.5" stroke-linejoin="round"/>';
      arms =
        '<ellipse cx="19" cy="66" rx="7" ry="10" transform="rotate(-32 19 66)" fill="#6fd08f" stroke="#2f8a58" stroke-width="2.5"/><ellipse cx="101" cy="66" rx="7" ry="10" transform="rotate(32 101 66)" fill="#6fd08f" stroke="#2f8a58" stroke-width="2.5"/>';
      extra =
        '<path class="m-star" d="M12 40 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#ffd84d"/><path class="m-star s2" d="M106 34 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6z" fill="#ffd84d"/><path class="m-star s3" d="M60 6 l1.4 3.6 3.6 1.4 -3.6 1.4 -1.4 3.6 -1.4 -3.6 -3.6 -1.4 3.6 -1.4z" fill="#ff8fc8"/>';
    } else if (mood === 'worried') {
      eyeSvg = eyes(0, 1) + line('M38 64 l13 -3', 2.6) + line('M82 64 l-13 -3', 2.6);
      mouth = line('M52 92 Q60 85 68 92');
      extra = '<path d="M97 52 q6 9 0 14 q-6 -5 0 -14z" fill="#7cc7ff" stroke="#3b95d9" stroke-width="1.5"/>';
    } else if (mood === 'sad') {
      eyeSvg = eyes(0, 2, 3.4) + line('M38 66 l13 4', 2.6) + line('M82 66 l-13 4', 2.6);
      mouth = line('M51 94 Q60 84 69 94');
      extra =
        '<path class="m-tear" d="M40 86 q4 7 0 10 q-4 -3 0 -10z" fill="#7cc7ff" stroke="#3b95d9" stroke-width="1.2"/>';
    } else if (mood === 'angry') {
      cheek = '#ff6b6b';
      eyeSvg = eyes(0, 1, 4.6) + line('M37 63 l14 6', 3.2) + line('M83 63 l-14 6', 3.2);
      mouth = line('M53 91 h14', 3.2);
      extra =
        '<g class="m-anger" stroke="#e11d48" stroke-width="3" stroke-linecap="round" fill="none"><path d="M92 46 q4 -2 6 -7"/><path d="M98 50 q5 0 9 -3"/><path d="M92 40 q-2 -5 1 -9"/></g>';
    } else if (mood === 'thinking') {
      eyeSvg = eyes(-1.5, -3);
      mouth = line('M54 89 h11');
      extra =
        '<g class="m-think"><circle cx="94" cy="44" r="2.4" fill="#fff" stroke="#9fb3c8"/><circle cx="101" cy="34" r="3.6" fill="#fff" stroke="#9fb3c8"/><ellipse cx="108" cy="18" rx="14" ry="10" fill="#fff" stroke="#9fb3c8" stroke-width="1.5"/>' +
        '<circle class="d" cx="102" cy="18" r="1.9" fill="#64748b"/><circle class="d" cx="108" cy="18" r="1.9" fill="#64748b"/><circle class="d" cx="114" cy="18" r="1.9" fill="#64748b"/></g>';
    } else if (mood === 'sleepy') {
      eyeSvg = line('M40 77 q6 6 12 0') + line('M68 77 q6 6 12 0');
      mouth = '<ellipse cx="60" cy="88" rx="3" ry="2.2" fill="' + ink + '"/>';
      extra =
        '<g class="m-zzz" fill="#8aa0c6" font-family="system-ui,sans-serif" font-weight="800"><text x="88" y="46" font-size="14">Z</text><text x="98" y="32" font-size="11">z</text><text x="106" y="20" font-size="9">z</text></g>';
    } else if (mood === 'wink') {
      eyeSvg =
        '<ellipse cx="46" cy="75" rx="5" ry="6.2" fill="' +
        ink +
        '"/><circle cx="44.4" cy="72.6" r="1.8" fill="#fff"/>' +
        line('M68 76 q6 -7 12 0');
    }
    return (
      '<svg class="mascot m-' +
      mood +
      (extraCls ? ' ' + extraCls : '') +
      '" viewBox="0 0 120 120" width="' +
      size +
      '" height="' +
      size +
      '" role="img" aria-label="Политешик">' +
      '<ellipse cx="60" cy="114" rx="28" ry="4.5" fill="#000" opacity=".16"/>' +
      '<ellipse class="foot" cx="44" cy="109" rx="10" ry="5.5" fill="#5fc486" stroke="#2f8a58" stroke-width="2.5"/><ellipse class="foot" cx="76" cy="109" rx="10" ry="5.5" fill="#5fc486" stroke="#2f8a58" stroke-width="2.5"/>' +
      '<g class="m-body">' +
      arms +
      '<path d="M60 16C72 32 98 54 98 82C98 99 82 110 60 110C38 110 22 99 22 82C22 54 48 32 60 16Z" fill="#8be0a4" stroke="#2f8a58" stroke-width="3" stroke-linejoin="round"/>' +
      '<ellipse cx="60" cy="96" rx="22" ry="12" fill="#c8f4d4"/>' +
      '<circle cx="36" cy="84" r="6" fill="' +
      cheek +
      '" opacity=".7"/><circle cx="84" cy="84" r="6" fill="' +
      cheek +
      '" opacity=".7"/>' +
      eyeSvg +
      mouth +
      '<path d="M44 49 V60 Q60 68 76 60 V49" fill="#3f4fae" stroke="#222c6b" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M30 44 L60 30 L90 44 L60 58 Z" fill="#33408f" stroke="#222c6b" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M90 44 V60" stroke="#ffc83d" stroke-width="2.5"/><circle cx="90" cy="63" r="3.2" fill="#ffc83d"/>' +
      '<path d="M66 41 l-9 -6 v12z M66 41 l9 -6 v12z" fill="#ff6fa5" stroke="#d93a7d" stroke-width="1.2" stroke-linejoin="round"/><circle cx="66" cy="41" r="3" fill="#ff4f93"/></g>' +
      extra +
      '</svg>'
    );
  },

  /**
   * Определяет настроение по обстановке: время суток, сроки, пропуски.
   * @returns {string} настроение.
   */
  current() {
    if (Date.now() < Mascot.cheerUntil) return 'cheer';
    const now = new Date(),
      h = now.getHours();
    if (h >= 23 || h < 7) return 'sleepy';
    let soon = false,
      abs = 0;
    try {
      const pend = dashItems().filter(i => !i.done);
      soon = pend.some(i => {
        const hh = (dueDate(i.date, i.time) - now) / 36e5;
        return hh > 0 && hh < 24;
      });
      abs = Att.absHours(Store.s.attendance.marks, Cloud.my.certs, Store.s.settings.subgroup);
    } catch (e) {}
    if (abs >= ABS_LIMIT) return 'sad';
    const asks = Chat.st()
      .msgs.filter(m => m.ask)
      .slice(-3);
    if (asks.length === 3 && asks.every(m => !m.done)) return 'angry';
    if (soon || abs > 20) return 'worried';
    return 'happy';
  },

  /**
   * Показывает праздничное сообщение с прыгающим жителем.
   * @param {string} text Текст праздничного сообщения.
   */
  celebrate(text) {
    Mascot.cheerUntil = Date.now() + 3600;
    let t = document.getElementById('cheer-toast');
    if (t) t.remove();
    t = document.createElement('div');
    t.id = 'cheer-toast';
    t.innerHTML = Mascot.svg('cheer', 78) + '<div class="bubble-t">' + U.esc(text || 'Отлично!') + '</div>';
    document.body.appendChild(t);
    setTimeout(() => {
      t.remove();
      if (typeof App !== 'undefined') App.renderSoft();
    }, 3700);
    if (typeof App !== 'undefined') App.renderSoft();
  },

  /**
   * Пробегает жителем по нижнему краю экрана при переходе между разделами.
   */
  walk() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (Date.now() - Mascot.lastWalk < 5000) return;
    Mascot.lastWalk = Date.now();
    let w = document.getElementById('walker');
    if (w) w.remove();
    w = document.createElement('div');
    w.id = 'walker';
    w.innerHTML = Mascot.svg(Mascot.current(), 52, 'm-walking');
    document.body.appendChild(w);
    setTimeout(() => w.remove(), 2800);
  }
};
