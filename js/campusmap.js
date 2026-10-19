'use strict';

const CampusMap = {
  floors: [1, 2, 3, 4, 5],
  maxAgeMinutes: 120,
  staleMinutes: 30,
  pollMs: 8000,
  timer: null,
  /**
   * Возвращает путь к плану этажа.
   * @param {number} floor Номер этажа.
   * @returns {string} Строка.
   */
  image(floor) {
    return 'assets/map-' + floor + '.jpg';
  },
  /**
   * Возвращает имя для подписи на карте: имя и первая буква фамилии.
   * @returns {string} Строка.
   */
  shortName() {
    const full = (Cloud.profile && Cloud.profile.name) || Store.s.settings.displayName || 'Студент',
      parts = full.split(/\s+/);
    return parts.length > 1 ? parts[1] + ' ' + parts[0].charAt(0).toUpperCase() + '.' : full;
  },
  /**
   * Считает, сколько минут назад поставлена точка.
   * @param {string} iso Время постановки точки.
   * @returns {number} Число.
   */
  minutesAgo(iso) {
    const time = new Date(iso).getTime();
    return isNaN(time) ? 9999 : Math.max(0, Math.round((Date.now() - time) / 60000));
  },
  /**
   * Собирает все актуальные точки группы, включая свою.
   * @returns {Array<Object>} Массив.
   */
  points() {
    const all = Object.assign({}, Cloud.mapPoints);
    if (Store.s.map && Cloud.uid)
      all[Cloud.uid] = Object.assign(
        {
          name: CampusMap.shortName()
        },
        Store.s.map
      );
    return Object.keys(all)
      .map(uid =>
        Object.assign(
          {
            uid
          },
          all[uid]
        )
      )
      .filter(
        p =>
          CampusMap.floors.indexOf(p.floor) >= 0 &&
          p.x >= 0 &&
          p.x <= 100 &&
          p.y >= 0 &&
          p.y <= 100 &&
          CampusMap.minutesAgo(p.at) <= CampusMap.maxAgeMinutes
      )
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  },
  /**
   * Ставит свою точку на карте, сохраняет у себя и передаёт группе.
   * @param {number} floor Этаж.
   * @param {number} x Координата X в процентах.
   * @param {number} y Координата Y в процентах.
   */
  async place(floor, x, y) {
    const point = {
      floor,
      x,
      y,
      at: new Date().toISOString()
    };
    Store.s.map = point;
    Store.save();
    App.render();
    if (Cloud.status !== 'online')
      return toast('Точка сохранена только у вас: чтобы её видели другие, нужен вход в аккаунт');
    const result = await Cloud.saveMapPoint(
      Object.assign(
        {
          name: CampusMap.shortName()
        },
        point
      )
    );
    if (result && result.ok === false) toast('Не удалось передать точку группе: ' + result.error);
    else toast('Готово: группа видит, что вы на ' + floor + ' этаже');
  },
  /**
   * Убирает свою точку с карты.
   */
  async clear() {
    Store.s.map = null;
    Store.save();
    delete Cloud.mapPoints[Cloud.uid];
    App.render();
    if (Cloud.status === 'online') await Cloud.clearMapPoint();
  },
  /**
   * Включает частое обновление точек, пока открыта карта.
   */
  ensurePolling() {
    if (CampusMap.timer || Cloud.status !== 'online') return;
    const refresh = async () => {
      if (ui.tab !== 'map') {
        CampusMap.stop();
        return;
      }
      if (await Cloud.refreshMap()) App.renderSoft();
    };
    CampusMap.timer = setInterval(refresh, CampusMap.pollMs);
    refresh();
  },
  /**
   * Выключает обновление точек.
   */
  stop() {
    clearInterval(CampusMap.timer);
    CampusMap.timer = null;
  },
  /**
   * Подключает клик по карте для постановки точки.
   */
  bind() {
    document.addEventListener('click', event => {
      const surface = event.target && event.target.closest ? event.target.closest('.map-surface') : null;
      if (!surface || !ui.mapPlacing) return;
      const box = surface.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const clamp = value => Math.min(100, Math.max(0, Math.round(value * 10) / 10));
      ui.mapPlacing = false;
      CampusMap.place(
        ui.mapFloor || 1,
        clamp(((event.clientX - box.left) / box.width) * 100),
        clamp(((event.clientY - box.top) / box.height) * 100)
      );
    });
  }
};
CampusMap.bind();
/**
 * Строит экран «Карта колледжа»: этажи, план, точки и список «Кто где».
 * @returns {string} HTML.
 */
function viewMap() {
  if (!ui.mapFloor) ui.mapFloor = (Store.s.map && Store.s.map.floor) || 1;
  CampusMap.ensurePolling();
  const floor = ui.mapFloor,
    points = CampusMap.points(),
    here = points.filter(p => p.floor === floor);
  const tabs =
    '<div class="tabs map-floors">' +
    CampusMap.floors
      .map(n => {
        const count = points.filter(p => p.floor === n).length;
        return (
          '<button class="tab' +
          (n === floor ? ' on' : '') +
          '" data-action="map-floor" data-floor="' +
          n +
          '">' +
          n +
          ' этаж' +
          (count ? ' <span class="tag">' + count + '</span>' : '') +
          '</button>'
        );
      })
      .join('') +
    '</div>';
  const dots = here
    .map(p => {
      const mine = p.uid === Cloud.uid,
        stale = CampusMap.minutesAgo(p.at) > CampusMap.staleMinutes;
      return (
        '<span class="map-dot' +
        (mine ? ' me' : '') +
        (stale ? ' stale' : '') +
        '" style="left:' +
        p.x +
        '%;top:' +
        p.y +
        '%" title="' +
        U.esc(p.name || '') +
        '"><i></i><b>' +
        (mine ? 'Вы' : U.esc(p.name || 'Студент')) +
        '</b></span>'
      );
    })
    .join('');
  const own = Store.s.map,
    list = points
      .map(
        p =>
          '<button class="map-who" data-action="map-floor" data-floor="' +
          p.floor +
          '"><b>' +
          U.esc(p.uid === Cloud.uid ? 'Вы' : p.name || 'Студент') +
          '</b><small>' +
          p.floor +
          ' этаж · ' +
          (CampusMap.minutesAgo(p.at) < 1 ? 'только что' : CampusMap.minutesAgo(p.at) + ' мин назад') +
          '</small></button>'
      )
      .join('');
  return (
    '<div class="page-head"><div><h1>Карта колледжа</h1><p>Отметьте, где вы сейчас: одногруппники увидят вашу точку с именем. Точки пропадают через 2 часа.</p></div>' +
    '<div class="head-actions"><button class="btn primary' +
    (ui.mapPlacing ? ' on' : '') +
    '" data-action="map-here">' +
    (ui.mapPlacing ? 'Нажмите на карту…' : 'Я здесь') +
    '</button>' +
    (own ? '<button class="btn" data-action="map-clear">Убрать мою точку</button>' : '') +
    '</div></div>' +
    tabs +
    (ui.mapPlacing ? '<p class="map-hint">Нажмите на карте место, где вы находитесь (' + floor + ' этаж).</p>' : '') +
    (Cloud.status !== 'online' ? '<p class="md-help">Без входа в аккаунт точка видна только вам.</p>' : '') +
    '<div class="map-surface' +
    (ui.mapPlacing ? ' placing' : '') +
    '"><img src="' +
    CampusMap.image(floor) +
    '" alt="План ' +
    floor +
    ' этажа колледжа" draggable="false">' +
    dots +
    '</div>' +
    '<section class="card map-list"><h2>Кто где</h2>' +
    (list || '<div class="empty">Пока никто не отметился. Нажмите «Я здесь»</div>') +
    '</section>'
  );
}
