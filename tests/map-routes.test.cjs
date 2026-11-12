const {test} = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm');
function app() {
  const c = vm.createContext({console});
  vm.runInContext('const A={};', c);
  vm.runInContext(fs.readFileSync('js/map-routes.js', 'utf8'), c);
  vm.runInContext('globalThis.api=MapRoutes;', c);
  return c.api;
}
test('routes follow same-floor corridors, join identical hallway projections and connect all five floors', () => {
  const r = app();
  for (let a = 1; a <= 5; a++)
    for (let b = 1; b <= 5; b++) {
      const path = r.build({floor: a, x: 76, y: 45}, {floor: b, x: 70, y: 57});
      assert.equal(path[0].floor, a);
      assert.equal(path.at(-1).floor, b);
      for (let i = 1; i < path.length; i++)
        if (path[i].floor !== path[i - 1].floor) {
          assert.equal(path[i].name, path[i - 1].name);
          assert.ok(['A', 'B', 'C', 'D'].includes(path[i].name));
          assert.equal(Math.abs(path[i].floor - path[i - 1].floor), 1);
        }
    }
  const straight = r.build({floor: 1, x: 77, y: 38}, {floor: 1, x: 75, y: 45});
  assert.ok(straight.length <= 4, 'Projection route detours to end of hallway');
});
test('upper wings use stairs C/D and routes do not cross restricted administrative corridor or empty centre', () => {
  const r = app(),
    path = r.build({floor: 5, x: 20, y: 45}, {floor: 5, x: 50, y: 27});
  assert.ok(
    path.some((p) => p.floor !== 5),
    'Disconnected fifth-floor wings crossed the empty centre',
  );
  assert.ok(path.some((p) => ['C', 'D'].includes(p.name)));
  const restricted = r.build({floor: 2, x: 26, y: 65}, {floor: 2, x: 74, y: 65});
  assert.ok(
    restricted.some((p) => p.floor !== 2),
    'Restricted floor-2 corridor used',
  );
  assert.throws(() => r.build({floor: 8, x: 20, y: 20}, {floor: 1, x: 20, y: 20}));
  assert.throws(() => r.build({floor: 1, x: NaN, y: 20}, {floor: 1, x: 20, y: 20}));
});
