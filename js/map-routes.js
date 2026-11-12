'use strict';

// Corridor centre-lines traced from the five floor plans. Floor 2's restricted
// administrative passage is intentionally not an edge. Upper wings on 3–5
// connect through stairs C/D, not through the empty centre of the drawing.
const MapRoutes = {
  route: null,
  pending: null,
  layouts: {
    1: {
      nodes: {L: [24, 27], LL: [33, 63], A: [36, 63], M: [50, 67], B: [63, 63], RR: [70, 64], R: [80, 27]},
      edges: [
        ['L', 'LL'],
        ['LL', 'A'],
        ['A', 'M'],
        ['M', 'B'],
        ['B', 'RR'],
        ['RR', 'R'],
      ],
    },
    2: {
      nodes: {
        C: [29, 29],
        LT: [18.5, 33],
        LB: [26, 70],
        A: [32, 67],
        D: [69, 29],
        RT: [82, 33],
        RB: [72, 70],
        B: [67, 67],
      },
      edges: [
        ['C', 'LT'],
        ['LT', 'LB'],
        ['LB', 'A'],
        ['D', 'RT'],
        ['RT', 'RB'],
        ['RB', 'B'],
      ],
    },
    3: {
      nodes: {
        C: [27, 28],
        U1: [36, 26.4],
        U2: [50, 25],
        U3: [63, 26.4],
        D: [72, 28],
        L: [18, 33],
        LL: [25, 68],
        A: [31, 68],
        M: [50, 69],
        B: [67, 68],
        RR: [73, 68],
        R: [81, 34],
      },
      edges: [
        ['C', 'U1'],
        ['U1', 'U2'],
        ['U2', 'U3'],
        ['U3', 'D'],
        ['L', 'LL'],
        ['LL', 'A'],
        ['A', 'M'],
        ['M', 'B'],
        ['B', 'RR'],
        ['RR', 'R'],
      ],
    },
    4: {
      nodes: {
        C: [29, 28],
        U1: [38, 26],
        U2: [52, 25],
        U3: [65, 26.5],
        D: [74, 29],
        A: [32, 66],
        M: [49, 69],
        B: [65, 66],
        RR: [73, 68],
        R: [82, 36],
      },
      edges: [
        ['C', 'U1'],
        ['U1', 'U2'],
        ['U2', 'U3'],
        ['U3', 'D'],
        ['A', 'M'],
        ['M', 'B'],
        ['B', 'RR'],
        ['RR', 'R'],
      ],
    },
    5: {
      nodes: {
        C: [29, 28],
        U1: [38, 26],
        U2: [52, 25],
        U3: [65, 26.5],
        D: [70, 28],
        A: [30, 64],
        M: [47, 68],
        B: [65, 64],
        RR: [71, 66],
        R: [81, 31],
      },
      edges: [
        ['C', 'U1'],
        ['U1', 'U2'],
        ['U2', 'U3'],
        ['U3', 'D'],
        ['A', 'M'],
        ['M', 'B'],
        ['B', 'RR'],
        ['RR', 'R'],
      ],
    },
  },
  build(start, end) {
    const nodes = {},
      adj = {},
      links = [];
    const edge = (a, b, weight) => {
      (adj[a] ||= []).push([b, weight]);
      (adj[b] ||= []).push([a, weight]);
    };
    Object.entries(MapRoutes.layouts).forEach(([floor, layout]) => {
      Object.entries(layout.nodes).forEach(
        ([name, [x, y]]) => (nodes[floor + name] = {floor: Number(floor), x, y, name}),
      );
      layout.edges.forEach(([a, b]) => {
        const aa = floor + a,
          bb = floor + b,
          A = nodes[aa],
          B = nodes[bb];
        edge(aa, bb, Math.hypot(A.x - B.x, A.y - B.y));
        links.push([aa, bb]);
      });
    });
    for (let floor = 1; floor < 5; floor++)
      for (const stair of ['A', 'B', 'C', 'D'])
        if (nodes[floor + stair] && nodes[floor + 1 + stair]) edge(floor + stair, floor + 1 + stair, 40);
    const attach = (point, id) => {
      if (
        !MapRoutes.layouts[point.floor] ||
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.x < 0 ||
        point.x > 100 ||
        point.y < 0 ||
        point.y > 100
      )
        throw Error('Сначала укажите корректную точку на карте');
      nodes[id] = {floor: point.floor, x: point.x, y: point.y, name: ''};
      if (point.floor >= 4 && point.x < 29 && point.y > 30) {
        const key = point.floor + 'A',
          n = nodes[key];
        edge(id, key, Math.hypot(point.x - n.x, point.y - n.y));
        return;
      }
      let best;
      links
        .filter(([a]) => nodes[a].floor === point.floor)
        .forEach(([a, b]) => {
          const A = nodes[a],
            B = nodes[b],
            dx = B.x - A.x,
            dy = B.y - A.y,
            t = Math.max(0, Math.min(1, ((point.x - A.x) * dx + (point.y - A.y) * dy) / (dx * dx + dy * dy))),
            x = A.x + dx * t,
            y = A.y + dy * t,
            d = Math.hypot(point.x - x, point.y - y);
          if (!best || d < best.d) best = {a, b, x, y, d};
        });
      const gate = id + 'Gate';
      nodes[gate] = {floor: point.floor, x: best.x, y: best.y, name: ''};
      edge(id, gate, best.d);
      for (const key of [best.a, best.b])
        edge(gate, key, Math.hypot(nodes[key].x - best.x, nodes[key].y - best.y));
      // Connecting two positions projected onto the same hallway avoids a detour to its end.
      nodes[gate].segment = best.a + '|' + best.b;
    };
    attach(start, 'start');
    attach(end, 'finish');
    if (nodes.startGate && nodes.finishGate && nodes.startGate.segment === nodes.finishGate.segment)
      edge(
        'startGate',
        'finishGate',
        Math.hypot(nodes.startGate.x - nodes.finishGate.x, nodes.startGate.y - nodes.finishGate.y),
      );
    const dist = {start: 0},
      prev = {},
      open = new Set(Object.keys(nodes));
    while (open.size) {
      let u;
      for (const key of open) if (u === undefined || (dist[key] ?? Infinity) < (dist[u] ?? Infinity)) u = key;
      if (!Number.isFinite(dist[u])) break;
      open.delete(u);
      if (u === 'finish') break;
      for (const [v, w] of adj[u] || [])
        if (dist[u] + w < (dist[v] ?? Infinity)) {
          dist[v] = dist[u] + w;
          prev[v] = u;
        }
    }
    if (!Number.isFinite(dist.finish)) throw Error('По этой схеме не удалось связать точки');
    const path = [];
    for (let key = 'finish'; key; key = prev[key]) path.unshift(nodes[key]);
    return path;
  },
  ask(uid) {
    const target = CampusMap.points().find((p) => p.uid === uid);
    if (!target) return toast('Эта отметка уже устарела');
    MapRoutes.targetUid = uid;
    MapRoutes.pending = null;
    UI.open(
      'Откуда проложить маршрут?',
      '<p>Укажите своё место на плане: GPS внутри здания не определяет этаж и кабинет.</p>' +
        (Store.s.map
          ? '<p class="hint">Ваша последняя отметка: ' +
            Store.s.map.floor +
            ' этаж, ' +
            CampusMap.minutesAgo(Store.s.map.at) +
            ' мин назад.</p><button class="btn primary" data-action="map-route-last">От моей отметки</button> '
          : '') +
        '<button class="btn" data-action="map-route-place">Указать место на плане</button>',
    );
  },
  finish() {
    const uid = MapRoutes.pending,
      target = CampusMap.points().find((p) => p.uid === uid),
      own = Store.s.map;
    if (!target || !own) return toast('Укажите обе точки заново');
    try {
      MapRoutes.route = {uid, name: target.name, path: MapRoutes.build(own, target), at: target.at};
      MapRoutes.pending = null;
      UI.close();
      ui.tab = 'map';
      ui.mapFloor = own.floor;
      App.render();
    } catch (error) {
      toast(error.message);
    }
  },
  sync() {
    const route = MapRoutes.route;
    if (!route) return;
    const target = CampusMap.points().find((p) => p.uid === route.uid),
      own = Store.s.map;
    if (!target || !own) {
      MapRoutes.route = null;
      return;
    }
    try {
      MapRoutes.route = {...route, path: MapRoutes.build(own, target), at: target.at, name: target.name};
    } catch (error) {
      MapRoutes.route = null;
    }
  },
  overlay(floor) {
    if (!MapRoutes.route) return '';
    const segments = [];
    let current = [];
    MapRoutes.route.path.forEach((p) => {
      if (p.floor === floor) current.push(p);
      else if (current.length) {
        segments.push(current);
        current = [];
      }
    });
    if (current.length) segments.push(current);
    return (
      '<svg class="map-route-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
      segments
        .filter((s) => s.length > 1)
        .map((s) => '<polyline points="' + s.map((p) => p.x + ',' + p.y).join(' ') + '"/>')
        .join('') +
      '</svg>'
    );
  },
  directions() {
    const route = MapRoutes.route;
    if (!route) return '';
    const path = route.path,
      steps = [];
    let i = 0;
    while (i < path.length - 1) {
      if (path[i].floor !== path[i + 1].floor) {
        const from = path[i].floor,
          stair = path[i].name;
        let to = path[++i].floor;
        while (
          i < path.length - 1 &&
          path[i].name === stair &&
          path[i + 1].name === stair &&
          path[i].floor !== path[i + 1].floor
        )
          to = path[++i].floor;
        steps.push(
          (to > from ? 'Поднимитесь' : 'Спуститесь') +
            ' по лестнице ' +
            stair +
            ' с ' +
            from +
            ' на ' +
            to +
            ' этаж.',
        );
      } else {
        const floor = path[i].floor;
        while (i < path.length - 1 && path[i + 1].floor === floor) i++;
        steps.push('На ' + floor + ' этаже идите по отмеченному на плане коридору.');
      }
    }
    return (
      '<section class="card map-directions"><div class="section-head"><h2>Как дойти: ' +
      U.esc(route.name || 'студент') +
      '</h2><button class="btn sm" data-action="map-route-clear">Убрать маршрут</button></div><p class="hint">Маршрут по схеме корпуса. Сначала выйдите из кабинета в коридор. Переходы между этажами обозначены буквами лестниц.</p><ol>' +
      steps.map((s) => '<li>' + U.esc(s) + '</li>').join('') +
      '</ol><div class="head-actions">' +
      [...new Set(path.map((p) => p.floor))]
        .map(
          (f) =>
            '<button class="btn sm" data-action="map-floor" data-floor="' + f + '">' + f + ' этаж</button>',
        )
        .join('') +
      '</div><p class="hint">Человек отметил место ' +
      CampusMap.minutesAgo(route.at) +
      ' мин назад. Его фактическое положение могло измениться.</p></section>'
    );
  },
};
Object.assign(A, {
  'map-person'(el) {
    const p = CampusMap.points().find((p) => p.uid === el.dataset.uid);
    if (!p) return;
    UI.open(
      p.name || 'Студент',
      '<div class="map-person-card">' +
        Avatars.html(p.uid, 85) +
        '<p>' +
        p.floor +
        ' этаж · ' +
        CampusMap.minutesAgo(p.at) +
        ' мин назад</p><div class="head-actions"><button class="btn primary" data-action="map-route" data-uid="' +
        p.uid +
        '">Как дойти</button><button class="btn" data-action="social-profile" data-uid="' +
        p.uid +
        '">Профиль</button></div></div>',
    );
  },
  'map-route'(el) {
    MapRoutes.ask(el.dataset.uid);
  },
  'map-route-last'() {
    MapRoutes.pending = MapRoutes.targetUid;
    MapRoutes.finish();
  },
  'map-route-place'() {
    MapRoutes.pending = MapRoutes.targetUid;
    UI.close();
    ui.tab = 'map';
    ui.mapPlacing = true;
    App.render();
    toast('Выберите свой этаж и нажмите на место, где вы сейчас.');
  },
  'map-route-clear'() {
    MapRoutes.route = null;
    MapRoutes.pending = null;
    App.render();
  },
});
