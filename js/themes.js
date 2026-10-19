'use strict';

const THEMES = [
  {
    id: 'light',
    ico: ICONS.sun,
    name: 'Светлая',
    sw: '#6366f1'
  },
  {
    id: 'dark',
    ico: ICONS.moon,
    name: 'Тёмная',
    sw: '#1a1f31'
  },
  {
    id: 'barbie',
    ico: ICONS.heart,
    name: 'Барби',
    sw: '#ff2d95'
  },
  {
    id: 'ocean',
    ico: ICONS.wave,
    name: 'Океан',
    sw: '#14b8c4'
  },
  {
    id: 'space',
    ico: ICONS.galaxy,
    name: 'Космос',
    sw: '#8b7bff'
  },
  {
    id: 'garden',
    ico: ICONS.herb,
    name: 'Сад',
    sw: '#2f9e44'
  },
  {
    id: 'magic',
    ico: ICONS.sparkles,
    name: 'Магия',
    sw: '#a78bfa'
  },
  {
    id: 'cleangirl',
    ico: ICONS.meditating,
    name: 'Clean Girl',
    sw: '#a9b98a'
  }
];
const SEASONAL = [
  {
    id: 'autumn',
    ico: ICONS.fallenLeaf,
    name: 'Осень',
    sw: '#ff9f1c',
    from: [9, 1],
    to: [11, 30]
  },
  {
    id: 'winter',
    ico: ICONS.snowflake,
    name: 'Зима',
    sw: '#7cc4ff',
    from: [12, 1],
    to: [2, 29]
  },
  {
    id: 'valentine',
    ico: ICONS.heartArrow,
    name: '14 февраля',
    sw: '#ff4d8d',
    from: [2, 13],
    to: [2, 15]
  },
  {
    id: 'defender',
    ico: ICONS.militaryMedal,
    name: '23 февраля',
    sw: '#c9b458',
    from: [2, 22],
    to: [2, 24]
  },
  {
    id: 'womens',
    ico: ICONS.tulip,
    name: '8 Марта',
    sw: '#e0568f',
    from: [3, 7],
    to: [3, 9]
  }
];
THEMES.push(
  ...SEASONAL.map(t =>
    Object.assign(
      {
        season: true
      },
      t
    )
  )
);
const THEME_IDS = THEMES.map(t => t.id);
const Themes = {
  /**
   * Создаёт повторяемый генератор псевдослучайных чисел.
   * @param {number} seed Начальное значение.
   * @returns {Function} Функция.
   */
  rnd(seed) {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  },
  /**
   * Строит фоновый SVG-слой темы.
   * @param {string} id Идентификатор темы.
   * @returns {string} SVG.
   */
  layer(id) {
    const R = Themes.rnd(id.length * 977 + 13),
      W = 1200,
      H = 800,
      svg = b =>
        '<svg viewBox="0 0 ' +
        W +
        ' ' +
        H +
        '" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
        b +
        '</svg>';
    const star = (x, y, r, fill, d) => {
      x = +x;
      y = +y;
      r = +r;
      return (
        '<path class="fx-tw" style="animation-delay:' +
        d +
        's;animation-duration:' +
        (2 + R() * 3).toFixed(1) +
        's" fill="' +
        fill +
        '" d="M' +
        x +
        ' ' +
        (y - r) +
        ' L' +
        (x + r * 0.28) +
        ' ' +
        (y - r * 0.28) +
        ' L' +
        (x + r) +
        ' ' +
        y +
        ' L' +
        (x + r * 0.28) +
        ' ' +
        (y + r * 0.28) +
        ' L' +
        x +
        ' ' +
        (y + r) +
        ' L' +
        (x - r * 0.28) +
        ' ' +
        (y + r * 0.28) +
        ' L' +
        (x - r) +
        ' ' +
        y +
        ' L' +
        (x - r * 0.28) +
        ' ' +
        (y - r * 0.28) +
        ' Z"/>'
      );
    };
    if (id === 'space') {
      let b =
        '<defs><radialGradient id="pl1" cx="35%" cy="30%"><stop offset="0" stop-color="#ffd9a0"/><stop offset=".6" stop-color="#d98a4a"/><stop offset="1" stop-color="#6b3a1f"/></radialGradient>' +
        '<radialGradient id="pl2" cx="35%" cy="30%"><stop offset="0" stop-color="#bfe9ff"/><stop offset=".6" stop-color="#4c8fd6"/><stop offset="1" stop-color="#17306b"/></radialGradient>' +
        '<radialGradient id="bh" cx="50%" cy="50%"><stop offset="0" stop-color="#000"/><stop offset=".45" stop-color="#000"/><stop offset=".55" stop-color="#ffb04a" stop-opacity=".9"/><stop offset="1" stop-color="#ff6a00" stop-opacity="0"/></radialGradient></defs>';
      for (let i = 0; i < 90; i++)
        b +=
          '<circle class="fx-tw" style="animation-delay:' +
          (R() * 5).toFixed(1) +
          's;animation-duration:' +
          (2 + R() * 4).toFixed(1) +
          's" cx="' +
          (R() * W).toFixed(0) +
          '" cy="' +
          (R() * H).toFixed(0) +
          '" r="' +
          (0.6 + R() * 1.6).toFixed(1) +
          '" fill="#fff"/>';
      b +=
        '<g transform="translate(1030 150)"><ellipse rx="92" ry="22" fill="none" stroke="#e8c88f" stroke-opacity=".55" stroke-width="7" transform="rotate(-18)"/><circle r="52" fill="url(#pl1)"/><ellipse rx="92" ry="22" fill="none" stroke="#e8c88f" stroke-opacity=".8" stroke-width="5" transform="rotate(-18)" stroke-dasharray="150 500" stroke-dashoffset="-60"/></g>';
      b +=
        '<circle cx="140" cy="640" r="34" fill="url(#pl2)"/><circle cx="268" cy="560" r="12" fill="#b8b8c8" opacity=".8"/>';
      b +=
        '<g transform="translate(900 640)"><g class="fx-spin"><ellipse rx="120" ry="34" fill="url(#bh)" transform="rotate(-20)"/></g><circle r="30" fill="#000"/></g>';
      b +=
        '<g><rect x="-9" y="-4" width="18" height="8" rx="2" fill="#cbd5e1"/><rect x="-20" y="-2" width="9" height="4" fill="#60a5fa"/><rect x="11" y="-2" width="9" height="4" fill="#60a5fa"/>' +
        '<animateMotion dur="46s" repeatCount="indefinite" path="M-60 520 C 300 200, 700 160, 1260 420"/></g>';
      return svg(b);
    }
    if (id === 'ocean') {
      let b = '';
      for (let i = 0; i < 18; i++)
        b +=
          '<circle class="fx-bub" style="animation-delay:' +
          (R() * 14).toFixed(1) +
          's;animation-duration:' +
          (10 + R() * 10).toFixed(1) +
          's" cx="' +
          (R() * W).toFixed(0) +
          '" cy="' +
          (H + 20) +
          '" r="' +
          (3 + R() * 9).toFixed(1) +
          '" fill="none" stroke="#bdf0ff" stroke-opacity=".6" stroke-width="1.6"/>';
      const wave = (y, c, o, cls) =>
        '<g class="fx-wave ' +
        cls +
        '" opacity="' +
        o +
        '"><path fill="' +
        c +
        '" d="M0 ' +
        y +
        ' q150 -46 300 0 t300 0 t300 0 t300 0 t300 0 t300 0 t300 0 t300 0 V' +
        H +
        ' H0 Z"/></g>';
      b +=
        '<svg x="0" y="560" width="' +
        W * 2 +
        '" height="240" viewBox="0 0 2400 240" preserveAspectRatio="none">' +
        wave(60, '#0e7490', 0.45, '') +
        wave(110, '#0891b2', 0.4, 'w2') +
        '</svg>';
      return svg(b).replace('<svg viewBox', '<svg style="overflow:visible" viewBox');
    }
    if (id === 'garden') {
      let b = '';
      const leaf = (x, y, s, rot, fill, d) =>
        '<g transform="translate(' +
        x +
        ' ' +
        y +
        ') rotate(' +
        rot +
        ') scale(' +
        s +
        ')"><path class="fx-leaf" style="animation-delay:' +
        d +
        's" fill="' +
        fill +
        '" d="M0 0 C 30 -60, 100 -70, 130 -20 C 90 10, 40 20, 0 0 Z"/><path d="M4 -2 C 40 -30, 80 -38,118 -22" stroke="rgba(255,255,255,.45)" stroke-width="3" fill="none"/></g>';
      const cols = ['#7bc96f', '#52b44f', '#9bdc86', '#3f9a43'];
      for (let i = 0; i < 14; i++) {
        const left = i % 2 === 0;
        b += leaf(
          left ? R() * 240 : W - R() * 240,
          left ? H * (0.15 + R() * 0.8) : H * (0.1 + R() * 0.8),
          0.7 + R() * 0.9,
          left ? -30 + R() * 70 : 150 + R() * 60,
          cols[i % 4],
          (R() * 4).toFixed(1)
        );
      }
      b += leaf(520, H, 1.6, -70, '#6ec26a', '0.5') + leaf(760, H, 1.3, -110, '#59b455', '1.5');
      return svg('<g opacity=".55">' + b + '</g>');
    }
    if (id === 'cleangirl') {
      const beige = '#eadfca',
        edge = '#cdbf9f',
        olive = '#b8c79a',
        oliveEdge = '#8fa073',
        blush = '#f4cdd4',
        blushEdge = '#d79aa6',
        cream = '#fff7ea';
      const mat = (x, y, rot, fill, line) =>
        '<g transform="translate(' +
        x +
        ' ' +
        y +
        ') rotate(' +
        rot +
        ')"><rect width="170" height="38" rx="19" fill="' +
        fill +
        '" stroke="' +
        line +
        '" stroke-width="2.5"/><circle cx="19" cy="19" r="13" fill="none" stroke="' +
        line +
        '" stroke-width="2.5"/><circle cx="19" cy="19" r="6" fill="none" stroke="' +
        line +
        '" stroke-width="2.5"/><rect x="92" y="-4" width="12" height="46" rx="4" fill="' +
        cream +
        '" stroke="' +
        line +
        '" stroke-width="2"/></g>';
      const dumbbell = (x, y, rot, fill, line) =>
        '<g transform="translate(' +
        x +
        ' ' +
        y +
        ') rotate(' +
        rot +
        ')" fill="' +
        fill +
        '" stroke="' +
        line +
        '" stroke-width="2.5"><rect x="-52" y="-5" width="104" height="10" rx="5"/><rect x="-66" y="-26" width="15" height="52" rx="6"/><rect x="-82" y="-18" width="13" height="36" rx="5"/><rect x="51" y="-26" width="15" height="52" rx="6"/><rect x="69" y="-18" width="13" height="36" rx="5"/></g>';
      const ball = (x, y, r, fill, line) =>
        '<g transform="translate(' +
        x +
        ' ' +
        y +
        ')"><circle r="' +
        r +
        '" fill="' +
        fill +
        '" stroke="' +
        line +
        '" stroke-width="2.5"/><path d="M' +
        -r * 0.6 +
        ' ' +
        -r * 0.5 +
        'Q' +
        -r * 0.2 +
        ' ' +
        -r * 0.9 +
        ' ' +
        r * 0.3 +
        ' ' +
        -r * 0.8 +
        '" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/></g>';
      const matcha = (x, y, s) =>
        '<g transform="translate(' +
        x +
        ' ' +
        y +
        ') scale(' +
        s +
        ')"><path d="M-46 0H46Q42 52 0 52Q-42 52 -46 0Z" fill="' +
        cream +
        '" stroke="' +
        edge +
        '" stroke-width="3"/><ellipse cy="0" rx="46" ry="9" fill="#a9c27a" stroke="' +
        oliveEdge +
        '" stroke-width="3"/><path d="M-20 -4Q0 6 20 -4" fill="none" stroke="#f2f7e4" stroke-width="3" stroke-linecap="round"/></g>';
      const sprig = (x, y, rot, s) =>
        '<g transform="translate(' +
        x +
        ' ' +
        y +
        ') rotate(' +
        rot +
        ') scale(' +
        s +
        ')"><path d="M0 0C10 -50 8 -110 0 -160" fill="none" stroke="' +
        oliveEdge +
        '" stroke-width="3"/>' +
        [-130, -105, -80, -55, -30]
          .map(
            (yy, i) =>
              '<path d="M2 ' +
              yy +
              'C' +
              (i % 2 ? 34 : -34) +
              ' ' +
              (yy - 22) +
              ' ' +
              (i % 2 ? 40 : -40) +
              ' ' +
              (yy + 4) +
              ' 2 ' +
              yy +
              'Z" fill="' +
              olive +
              '" stroke="' +
              oliveEdge +
              '" stroke-width="2"/>'
          )
          .join('') +
        '</g>';
      return svg(
        '<g opacity=".6">' +
          mat(60, 640, -12, beige, edge) +
          mat(900, 120, 14, blush, blushEdge) +
          dumbbell(1050, 660, -20, olive, oliveEdge) +
          dumbbell(150, 140, 18, blush, blushEdge) +
          ball(1110, 330, 62, olive, oliveEdge) +
          ball(70, 420, 48, blush, blushEdge) +
          matcha(260, 700, 1) +
          matcha(980, 520, 0.8) +
          sprig(40, 330, 8, 1) +
          sprig(1160, 560, -10, 1) +
          '</g>'
      );
    }
    if (id === 'magic') {
      let b =
        '<defs><radialGradient id="mg" cx="50%" cy="50%"><stop offset="0" stop-color="#c084fc" stop-opacity=".35"/><stop offset="1" stop-color="#c084fc" stop-opacity="0"/></radialGradient></defs><circle cx="240" cy="180" r="260" fill="url(#mg)"/><circle cx="980" cy="640" r="300" fill="url(#mg)"/>';
      const cols = ['#fbbf24', '#f9a8d4', '#67e8f9', '#c4b5fd', '#fde68a', '#86efac', '#fff'];
      for (let i = 0; i < 70; i++)
        b += star(
          (R() * W).toFixed(0),
          (R() * H).toFixed(0),
          (3 + R() * 8).toFixed(1),
          cols[i % cols.length],
          (R() * 5).toFixed(1)
        );
      return svg(b);
    }
    if (id === 'barbie') {
      let b = '';
      const cols = ['#fff', '#ff8fc8', '#ffd1e8', '#ff5aae'];
      for (let i = 0; i < 34; i++)
        b += star(
          (R() * W).toFixed(0),
          (R() * H).toFixed(0),
          (4 + R() * 11).toFixed(1),
          cols[i % cols.length],
          (R() * 4).toFixed(1)
        );
      return svg(b);
    }
    return '';
  }
};
/**
 * Проверяет, попадает ли дата в период действия сезонной темы.
 * @param {Object} t Сезонная тема с границами from и to.
 * @param {Date} date Проверяемая дата.
 * @returns {boolean} true, если условие выполнено.
 */
Themes.inSeason = (t, date) => {
  const md = (date.getMonth() + 1) * 100 + date.getDate(),
    a = t.from[0] * 100 + t.from[1],
    b = t.to[0] * 100 + t.to[1];
  return a <= b ? md >= a && md <= b : md >= a || md <= b;
};
/**
 * Возвращает темы, доступные в указанный день: обычные всегда, сезонные только в свой период.
 * @param {Date} date День проверки (необязательно).
 * @returns {Array<Object>} Массив.
 */
Themes.available = date => THEMES.filter(t => !t.season || Themes.inSeason(t, date || new Date()));
/**
 * Один раз за сезон сообщает, что появилась новая тема.
 */
Themes.announce = () => {
  const meta = Store.s.meta,
    seen = meta.seenThemes || (meta.seenThemes = []),
    year = new Date().getFullYear();
  const fresh = Themes.available().filter(t => t.season && !seen.includes(t.id + ':' + year));
  if (!fresh.length) return;
  fresh.forEach(t => seen.push(t.id + ':' + year));
  Store.save();
  toast('Новая тема: ' + fresh.map(t => t.name).join(', ') + '. Включить её можно кнопкой темы.');
};
