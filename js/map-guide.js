'use strict';
// A camera companion with explicit manual progress; no visual positioning or GPS claims.
const MapGuide = {
  stream: null,
  index: 0,
  steps: [],
  token: 0,
  roomDialog() {
    ui.mapDestination=null;
    UI.open(
      'Маршрут в аудиторию',
      '<div data-form="map-room"><label class="field">Кабинет или место<input class="input" name="room" maxlength="60" placeholder="Например, 315 или библиотека" required></label><label class="field">Этаж<select class="input" name="floor">' +
        [1, 2, 3, 4, 5].map((f) => '<option value="' + f + '">' + f + ' этаж</option>').join('') +
        '</select></label><p class="hint">Затем нажмите нужный кабинет на плане. Присутствие другого студента не требуется.</p><button class="btn primary" data-action="save-form">Выбрать кабинет на плане</button></div>',
    );
  },
  selectPoint(floor, x, y) {
    MapRoutes.roomTarget = {floor, x, y, name: ui.mapDestination};
    ui.mapDestination = null;
    MapRoutes.targetUid = 'room';
    MapRoutes.pending = null;
    UI.open(
      'Откуда идём?',
      '<p>Куда: ' +
        U.esc(MapRoutes.roomTarget.name) +
        '. Выберите своё начальное место.</p>' +
        (Store.s.map
          ? '<button class="btn primary" data-action="map-route-last">От моей отметки</button> '
          : '') +
        '<button class="btn" data-action="map-route-place">Указать место на плане</button>',
    );
    App.render();
  },
  makeSteps(route) {
    const out = [];
    const path = route.path;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i],
        b = path[i + 1];
      if (a.floor !== b.floor) {
        out.push({
          floor: a.floor,
          text:
            (b.floor > a.floor ? 'Поднимитесь' : 'Спуститесь') +
            ' по лестнице ' +
            a.name +
            ' на ' +
            b.floor +
            ' этаж.',
        });
      } else if (!out.length || out.at(-1).floor !== a.floor || out.at(-1).stairs) {
        out.push({
          floor: a.floor,
          text:
            'Идите по выделенному коридору на ' +
            a.floor +
            ' этаже. Ориентируйтесь по плану под подсказкой.',
        });
      }
      if (a.floor !== b.floor) out.at(-1).stairs = true;
    }
    out.push({
      floor: path.at(-1).floor,
      text: 'Вы у цели: ' + route.name + '. Сверьте подпись кабинета на двери.',
    });
    return out;
  },
  async open() {
    if (!MapRoutes.route) return toast('Сначала постройте маршрут');
    MapGuide.close();
    const token = ++MapGuide.token;
    MapGuide.steps = MapGuide.makeSteps(MapRoutes.route);
    MapGuide.index = 0;
    const root = document.createElement('section');
    root.id = 'map-camera';
    root.className = 'map-camera';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Политешик ведёт по маршруту');
    root.innerHTML =
      '<video autoplay muted playsinline></video><button class="btn guide-close" data-action="map-guide-close">✕ Закрыть камеру</button><div class="guide-status" role="status">Разрешите камеру для прогулки с Политешиком</div><div class="guide-bottom"><div class="guide-mascot">' +
      Mascot.svg('happy', 90) +
      '</div><div class="guide-step"></div><div class="guide-plan"></div><p class="hint">Начальную точку и пройденные шаги указываете вы. Камера не определяет положение. Не смотрите в экран на лестнице.</p><div class="head-actions"><button class="btn" data-action="map-guide-back">← Назад</button><button class="btn primary" data-action="map-guide-next">Шаг пройден →</button></div></div>';
    document.body.append(root);
    MapGuide.render();
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw Error('Камера не поддерживается этим браузером');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {facingMode: {ideal: 'environment'}},
        audio: false,
      });
      if (token !== MapGuide.token || !root.isConnected) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      MapGuide.stream = stream;
      root.querySelector('video').srcObject = stream;
      root.querySelector('.guide-status').textContent =
        'Камера включена · изображение остаётся на устройстве';
    } catch (error) {
      if (root.isConnected)
        root.querySelector('.guide-status').textContent =
          'Камера недоступна. Можно продолжить по плану и подсказкам.';
    }
  },
  render() {
    const root = document.getElementById('map-camera');
    if (!root) return;
    const step = MapGuide.steps[MapGuide.index];
    root.querySelector('.guide-step').textContent =
      'Шаг ' + (MapGuide.index + 1) + ' из ' + MapGuide.steps.length + ': ' + step.text;
    root.querySelector('.guide-plan').innerHTML =
      '<img alt="План этажа ' +
      step.floor +
      '" src="' +
      CampusMap.image(step.floor) +
      '">' +
      MapRoutes.overlay(step.floor);
    root.querySelector('[data-action="map-guide-back"]').disabled = MapGuide.index === 0;
    root.querySelector('[data-action="map-guide-next"]').textContent =
      MapGuide.index === MapGuide.steps.length - 1 ? 'Пришли ✓' : 'Шаг пройден →';
  },
  close() {
    MapGuide.token++;
    MapGuide.stream?.getTracks().forEach((t) => t.stop());
    MapGuide.stream = null;
    document.getElementById('map-camera')?.remove();
  },
};
const finishPersonRoute = MapRoutes.finish.bind(MapRoutes),
  syncPersonRoute = MapRoutes.sync.bind(MapRoutes);
MapRoutes.finish = () => {
  if (MapRoutes.pending !== 'room') return finishPersonRoute();
  const target = MapRoutes.roomTarget,
    own = Store.s.map;
  if (!target || !own) return toast('Выберите кабинет и начальное место');
  try {
    MapRoutes.route = {
      kind: 'room',
      name: target.name,
      target,
      path: MapRoutes.build(own, target),
    };
    MapRoutes.pending = null;
    UI.close();
    ui.tab = 'map';
    ui.mapFloor = own.floor;
    App.render();
  } catch (error) {
    toast(error.message);
  }
};
MapRoutes.sync = () => {
  if (MapRoutes.route?.kind === 'room') {
    if (Store.s.map) MapRoutes.route.path = MapRoutes.build(Store.s.map, MapRoutes.route.target);
    return;
  }
  syncPersonRoute();
};
Object.assign(A, {
  'map-room': () => MapGuide.roomDialog(),
  'map-destination-cancel':()=>{ui.mapDestination=null;App.render();},
  'map-guide-open': () => MapGuide.open(),
  'map-guide-close': () => MapGuide.close(),
  'map-guide-next': () => {
    if (MapGuide.index >= MapGuide.steps.length - 1) return MapGuide.close();
    MapGuide.index++;
    MapGuide.render();
  },
  'map-guide-back': () => {
    MapGuide.index = Math.max(0, MapGuide.index - 1);
    MapGuide.render();
  },
});
Forms['map-room'] = (form) => {
  const room = val(form, 'room').trim();
  if (!room) return toast('Введите номер кабинета');
  ui.mapFloor = Number(val(form, 'floor'));
  ui.mapDestination = room;
  ui.mapPlacing = false;
  UI.close();
  ui.tab = 'map';
  App.render();
  toast('Нажмите кабинет ' + room + ' на плане');
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) MapGuide.close();
});
window.addEventListener('pagehide', () => MapGuide.close());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') MapGuide.close();
});
