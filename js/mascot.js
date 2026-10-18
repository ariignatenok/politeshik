'use strict';

const Mascot = {
  cheerUntil: 0,
  lastWalk: 0,
  seq: 0,
  seasonOverride: null,

  /**
   * Определяет по дате сезонный или праздничный наряд Политешика.
   * @param {Date} date Проверяемая дата (необязательно).
   * @returns {string} autumn, winter, valentine, defender, womens или пустая строка.
   */
  season(date) {
    const d = date || new Date(),
      md = (d.getMonth() + 1) * 100 + d.getDate();
    if (md >= 213 && md <= 215) return 'valentine';
    if (md >= 222 && md <= 224) return 'defender';
    if (md >= 307 && md <= 309) return 'womens';
    if (md >= 1201 || md <= 229) return 'winter';
    if (md >= 901 && md <= 1130) return 'autumn';
    return '';
  },

  /**
   * Проверяет, не отключены ли сезонные аксессуары в настройках.
   * @returns {boolean} true, если условие выполнено.
   */
  enabled() {
    try {
      return Store.s.settings.mascotAccessories !== false;
    } catch (e) {
      return true;
    }
  },

  /**
   * Возвращает наряд, который надет сегодня (с учётом отключения и пробной подмены).
   * @returns {string} Строка.
   */
  activeSeason() {
    if (!Mascot.enabled()) return '';
    return Mascot.seasonOverride !== null ? Mascot.seasonOverride : Mascot.season(new Date());
  },

  /**
   * Рисует SVG-слои сезонных аксессуаров: шапку, предмет в лапке, камуфляж и спутников.
   * @param {string} season Наряд: autumn, winter, valentine, defender или womens.
   * @param {string} mood Настроение Политешика.
   * @param {string} id Префикс для уникальных идентификаторов внутри SVG.
   * @returns {Object} defs, back, camo, hat, hold, front.
   */
  accessories(season, mood, id) {
    const none = {defs: '', back: '', camo: '', hat: '', hold: '', front: ''};
    if (!season) return none;
    const cheer = mood === 'cheer',
      rot = cheer ? 32 : -18,
      dx = cheer ? 2 : 0,
      dy = cheer ? -18 : 0;
    const arm =
      '<ellipse cx="99" cy="84" rx="7" ry="10" transform="rotate(' +
      rot +
      ' 99 84)" fill="#6fd08f" stroke="#2f8a58" stroke-width="2.5"/>';
    const hand =
      '<ellipse cx="99" cy="84" rx="6.2" ry="7.4" transform="rotate(' +
      rot +
      ' 99 84)" fill="#6fd08f" stroke="#2f8a58" stroke-width="2"/>';
    const hold = (name, item) =>
      '<g class="m-hold" data-acc="' +
      name +
      '"><g transform="translate(' +
      dx +
      ' ' +
      dy +
      ')">' +
      arm +
      item +
      hand +
      '</g></g>';
    const heart = (x, y, s, fill, cls) =>
      '<g transform="translate(' +
      x +
      ' ' +
      y +
      ') scale(' +
      s +
      ')"><path class="m-heart ' +
      cls +
      '" d="M0 6C-9 -1 -10 -10 -4 -12C-1.5 -13 0 -11 0 -9C0 -11 1.5 -13 4 -12C10 -10 9 -1 0 6Z" fill="' +
      fill +
      '"/></g>';
    const tulip = (x, y, fill, edge) =>
      '<path d="M' +
      (x - 5) +
      ' ' +
      y +
      'C' +
      (x - 5) +
      ' ' +
      (y - 9) +
      ' ' +
      (x - 2) +
      ' ' +
      (y - 11) +
      ' ' +
      x +
      ' ' +
      (y - 8) +
      'C' +
      (x + 2) +
      ' ' +
      (y - 11) +
      ' ' +
      (x + 5) +
      ' ' +
      (y - 9) +
      ' ' +
      (x + 5) +
      ' ' +
      y +
      'Z" fill="' +
      fill +
      '" stroke="' +
      edge +
      '" stroke-width="1.4" stroke-linejoin="round"/>';
    if (season === 'autumn') {
      return Object.assign({}, none, {
        hat: '<g class="m-hat" data-acc="beret" transform="rotate(-8 60 40)"><path d="M26 46C24 30 44 20 66 22C88 24 98 36 92 48C70 54 44 54 26 46Z" fill="#c2273d" stroke="#7d1422" stroke-width="2.5" stroke-linejoin="round"/><path d="M30 47C48 55 72 55 90 48" fill="none" stroke="#7d1422" stroke-width="3"/><path d="M62 22C62 17 66 15 69 18" fill="none" stroke="#7d1422" stroke-width="3" stroke-linecap="round"/><path d="M40 32C48 27 58 26 66 27" fill="none" stroke="#f0a0aa" stroke-width="2" stroke-linecap="round" opacity=".7"/></g>',
        hold: hold(
          'baguette',
          '<g transform="translate(99 84) rotate(12) scale(.9)"><path d="M-5.5 3C-7.5 -11 -6.5 -35 -3.5 -52C-1.5 -60 5.5 -60 6.5 -52C9.5 -35 8.5 -11 5.5 3Z" fill="#e0a85f" stroke="#9a6a35" stroke-width="2" stroke-linejoin="round"/><path d="M3 -50C5 -35 4 -14 3 0" fill="none" stroke="#b9803c" stroke-width="2" stroke-linecap="round" opacity=".7"/><path d="M-4 -16L4 -21M-4.6 -29L4.6 -34M-3.6 -42L3.6 -46" stroke="#fff3d6" stroke-width="2.2" stroke-linecap="round"/></g>'
        )
      });
    }
    if (season === 'winter') {
      return Object.assign({}, none, {
        back: '<g class="m-deer" data-acc="deer" transform="translate(2 94) scale(.75)"><path d="M6 24V31M11 24V31M19 24V31M24 24V31" fill="none" stroke="#7a4a20" stroke-width="2" stroke-linecap="round"/><ellipse cx="15" cy="21" rx="12" ry="7.5" fill="#b9814f" stroke="#7a4a20" stroke-width="2"/><path d="M3 18L-1 15L1 21Z" fill="#fff" stroke="#c9d3dd" stroke-width="1"/><g class="m-deer-head"><path d="M22 18L28 9" fill="none" stroke="#7a4a20" stroke-width="6" stroke-linecap="round"/><path d="M22 18L28 9" fill="none" stroke="#b9814f" stroke-width="3" stroke-linecap="round"/><ellipse cx="30" cy="8" rx="6.5" ry="5.5" fill="#b9814f" stroke="#7a4a20" stroke-width="2"/><circle cx="35" cy="9" r="2.3" fill="#e5484d"/><circle cx="29" cy="6.5" r="1.2" fill="#1f2d3a"/><path d="M27 3L25 -4M25 -4L22 -6M25 -4L27 -8M31 3L33 -4M33 -4L30 -7M33 -4L36 -7" fill="none" stroke="#7a4a20" stroke-width="1.8" stroke-linecap="round"/></g></g>',
        hat: '<g class="m-hat" data-acc="santa"><path d="M31 49C31 30 46 15 62 15C80 15 92 27 93 49Z" fill="#d6283b" stroke="#8f1424" stroke-width="2.5" stroke-linejoin="round"/><path d="M60 16C82 8 104 20 102 40C98 30 88 24 72 24Z" fill="#d6283b" stroke="#8f1424" stroke-width="2.5" stroke-linejoin="round"/><circle cx="102" cy="42" r="6.5" fill="#fff" stroke="#c9d3dd" stroke-width="1.5"/><rect x="27" y="46" width="68" height="12" rx="6" fill="#fff" stroke="#c9d3dd" stroke-width="1.5"/></g>'
      });
    }
    if (season === 'valentine') {
      return Object.assign({}, none, {
        hold: hold(
          'candy',
          '<g transform="translate(99 84) scale(1.18) translate(0 -2)"><path d="M0 8C-15 -3 -17 -19 -7 -24C-3 -26 0 -23 0 -20C0 -23 3 -26 7 -24C17 -19 15 -3 0 8Z" fill="#e8365d" stroke="#9c1c3a" stroke-width="2" stroke-linejoin="round"/><path d="M-10 -17C-7 -21 -4 -21 -2 -19" fill="none" stroke="#ff9db8" stroke-width="2" stroke-linecap="round"/><path d="M-6 -6H6M-9 -11H9" stroke="#fff" stroke-width="1.2" stroke-dasharray="2 2" opacity=".7"/><path d="M-1 -22L-9 -30L-4 -20ZM1 -22L9 -30L4 -20Z" fill="#ffd1e3" stroke="#d93a7d" stroke-width="1.2" stroke-linejoin="round"/><circle cx="0" cy="-21" r="2.6" fill="#ff6fa5"/></g>'
        ),
        front:
          heart(10, 52, 1.3, '#ff4d8d', 'h1') + heart(106, 24, 1, '#ff9cc0', 'h2') + heart(16, 22, 0.8, '#ffd1e3', 'h3')
      });
    }
    if (season === 'defender') {
      const dome = 'M27 52C27 28 44 18 60 18C78 18 93 28 93 52Z';
      return Object.assign({}, none, {
        defs:
          '<clipPath id="' +
          id +
          'b"><path d="M60 16C72 32 98 54 98 82C98 99 82 110 60 110C38 110 22 99 22 82C22 54 48 32 60 16Z"/></clipPath><clipPath id="' +
          id +
          'h"><path d="' +
          dome +
          '"/></clipPath>',
        camo:
          '<g data-acc="camo" clip-path="url(#' +
          id +
          'b)" opacity=".8"><path d="M18 64C26 58 36 62 34 72C32 82 20 86 16 78Z" fill="#556b2f"/><path d="M24 86C34 82 40 92 34 100C28 106 18 100 20 92Z" fill="#2d3320"/><path d="M102 62C94 56 84 62 86 72C88 80 100 84 104 76Z" fill="#556b2f"/><path d="M96 88C88 84 80 92 86 101C92 108 104 100 100 92Z" fill="#8a7b4c"/><path d="M34 100C46 94 56 104 50 112C42 116 30 112 34 100Z" fill="#8a7b4c"/><path d="M66 102C78 96 90 104 84 112C74 116 62 112 66 102Z" fill="#3b4a2a"/><path d="M20 50C28 46 34 52 30 58C24 60 18 56 20 50Z" fill="#3b4a2a"/><path d="M92 50C84 46 78 52 82 58C88 60 94 56 92 50Z" fill="#8a7b4c"/></g>',
        hat:
          '<g class="m-hat" data-acc="helmet"><path d="' +
          dome +
          '" fill="#6b7d43" stroke="#3a4524" stroke-width="2.5" stroke-linejoin="round"/><g clip-path="url(#' +
          id +
          'h)"><path d="M30 34C38 28 46 34 42 42C36 46 28 42 30 34Z" fill="#46562b"/><path d="M74 26C84 28 90 38 82 44C74 44 68 34 74 26Z" fill="#46562b"/><path d="M50 22C58 18 66 22 62 28C56 30 48 28 50 22Z" fill="#8a7b4c"/></g><path d="M22 52C40 59 80 59 98 52C96 47 90 46 86 46L34 46C30 46 24 47 22 52Z" fill="#55672f" stroke="#3a4524" stroke-width="2.5" stroke-linejoin="round"/><path d="M60 29L63 36L70.5 36.5L64.8 41.2L66.8 48.4L60 44.4L53.2 48.4L55.2 41.2L49.5 36.5L57 36Z" fill="#e5484d" stroke="#8f1424" stroke-width="1.2" stroke-linejoin="round" transform="translate(0 -2) scale(1)"/></g>'
      });
    }
    return Object.assign({}, none, {
      hold: hold(
        'bouquet',
        '<g transform="translate(99 84) scale(1.3)"><path d="M-10 -22L10 -22L3 4L-3 4Z" fill="#ffd1e3" stroke="#e0568f" stroke-width="2" stroke-linejoin="round"/><path d="M-5 -22L-4 -32M0 -22V-37M5 -22L4 -32" fill="none" stroke="#3a9d5d" stroke-width="2" stroke-linecap="round"/>' +
          tulip(-5, -31, '#ff5c8a', '#c2255c') +
          tulip(0, -37, '#ffd166', '#c98a00') +
          tulip(5, -31, '#ffffff', '#d98bb0') +
          '<path d="M-3 -22L-9 -26M3 -22L9 -26" fill="none" stroke="#3a9d5d" stroke-width="2" stroke-linecap="round"/></g>'
      )
    });
  },

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
    const season = Mascot.activeSeason(),
      acc = Mascot.accessories(season, mood, 'mc' + ++Mascot.seq);
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
    const armEl = (cx, cy, rot) =>
      '<ellipse cx="' +
      cx +
      '" cy="' +
      cy +
      '" rx="7" ry="10" transform="rotate(' +
      rot +
      ' ' +
      cx +
      ' ' +
      cy +
      ')" fill="#6fd08f" stroke="#2f8a58" stroke-width="2.5"/>';
    let eyeSvg = eyes(0, 0),
      mouth = line('M52 85 Q60 93 68 85'),
      extra = '',
      cheek = '#ff9db8';
    let armL = armEl(21, 84, 18),
      armR = armEl(99, 84, -18);
    if (mood === 'cheer') {
      eyeSvg = line('M40 77 q6 -9 12 0') + line('M68 77 q6 -9 12 0');
      mouth =
        '<path d="M51 85 Q60 100 69 85 Z" fill="#d8506b" stroke="' +
        ink +
        '" stroke-width="2.5" stroke-linejoin="round"/>';
      armL = armEl(19, 66, -32);
      armR = armEl(101, 66, 32);
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
        '<g class="m-think"><circle cx="94" cy="44" r="2.4" fill="#fff" stroke="#9fb3c8"/><circle cx="101" cy="34" r="3.6" fill="#fff" stroke="#9fb3c8"/><ellipse cx="108" cy="18" rx="14" ry="10" fill="#fff" stroke="#9fb3c8" stroke-width="1.5"/><circle class="d" cx="102" cy="18" r="1.9" fill="#64748b"/><circle class="d" cx="108" cy="18" r="1.9" fill="#64748b"/><circle class="d" cx="114" cy="18" r="1.9" fill="#64748b"/></g>';
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
    const body =
      '<path d="M60 16C72 32 98 54 98 82C98 99 82 110 60 110C38 110 22 99 22 82C22 54 48 32 60 16Z" fill="#8be0a4" stroke="#2f8a58" stroke-width="3" stroke-linejoin="round"/><ellipse cx="60" cy="96" rx="22" ry="12" fill="#c8f4d4"/>';
    const cap =
      '<path d="M44 49 V60 Q60 68 76 60 V49" fill="#3f4fae" stroke="#222c6b" stroke-width="2.5" stroke-linejoin="round"/><path d="M30 44 L60 30 L90 44 L60 58 Z" fill="#33408f" stroke="#222c6b" stroke-width="2.5" stroke-linejoin="round"/><path d="M90 44 V60" stroke="#ffc83d" stroke-width="2.5"/><circle cx="90" cy="63" r="3.2" fill="#ffc83d"/><path d="M66 41 l-9 -6 v12z M66 41 l9 -6 v12z" fill="#ff6fa5" stroke="#d93a7d" stroke-width="1.2" stroke-linejoin="round"/><circle cx="66" cy="41" r="3" fill="#ff4f93"/>';
    const cls =
      'mascot m-' +
      mood +
      (season ? ' m-season-' + season : '') +
      (acc.hat ? ' m-has-hat' : '') +
      (acc.hold ? ' m-has-hold' : '') +
      (extraCls ? ' ' + extraCls : '');
    return (
      '<svg class="' +
      cls +
      '" viewBox="0 0 120 120" width="' +
      size +
      '" height="' +
      size +
      '" role="img" aria-label="Политешик">' +
      (acc.defs ? '<defs>' + acc.defs + '</defs>' : '') +
      '<ellipse cx="60" cy="114" rx="28" ry="4.5" fill="#000" opacity=".16"/>' +
      acc.back +
      '<ellipse class="foot" cx="44" cy="109" rx="10" ry="5.5" fill="#5fc486" stroke="#2f8a58" stroke-width="2.5"/><ellipse class="foot" cx="76" cy="109" rx="10" ry="5.5" fill="#5fc486" stroke="#2f8a58" stroke-width="2.5"/>' +
      '<g class="m-body"><g class="m-arm l">' +
      armL +
      '</g><g class="m-arm r base">' +
      armR +
      '</g>' +
      body +
      acc.camo +
      '<circle cx="36" cy="84" r="6" fill="' +
      cheek +
      '" opacity=".7"/><circle cx="84" cy="84" r="6" fill="' +
      cheek +
      '" opacity=".7"/>' +
      eyeSvg +
      mouth +
      '<g class="m-cap">' +
      cap +
      '</g>' +
      acc.hat +
      acc.hold +
      '</g>' +
      acc.front +
      extra +
      '</svg>'
    );
  },

  /**
   * Запускает реакцию Политешика на клик: прыжок и взмах лапой.
   * @param {SVGElement} el SVG Политешика, по которому кликнули.
   */
  react(el) {
    if (!el || !el.classList) return;
    el.classList.remove('m-react');
    void el.getBoundingClientRect();
    el.classList.add('m-react');
    clearTimeout(el.reactTimer);
    el.reactTimer = setTimeout(() => el.classList.remove('m-react'), 950);
  },

  /**
   * Подключает реакцию на клик ко всем Политешикам на странице.
   */
  bindReactions() {
    document.addEventListener('click', e => {
      const m = e.target && e.target.closest ? e.target.closest('svg.mascot') : null;
      if (m) Mascot.react(m);
    });
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

Mascot.bindReactions();
