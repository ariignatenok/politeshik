'use strict';

const THEMES = [
  {id: 'light', ico: ICONS.sun, name: 'Светлая', sw: '#6366f1'},
  {id: 'dark', ico: ICONS.moon, name: 'Тёмная', sw: '#1a1f31'},
  {id: 'barbie', ico: ICONS.heart, name: 'Барби', sw: '#ff2d95'},
  {id: 'ocean', ico: ICONS.wave, name: 'Океан', sw: '#14b8c4'},
  {id: 'space', ico: ICONS.galaxy, name: 'Космос', sw: '#8b7bff'},
  {id: 'garden', ico: ICONS.herb, name: 'Сад', sw: '#2f9e44'},
  {id: 'magic', ico: ICONS.sparkles, name: 'Магия', sw: '#a78bfa'}
];
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
