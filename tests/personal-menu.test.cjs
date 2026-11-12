const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function app() {
  const storage = new Map();
  const ctx = vm.createContext({
    console,
    Map,
    window: {
      localStorage: {getItem: (k) => storage.get(k) || null, setItem: (k, v) => storage.set(k, v)},
      addEventListener() {},
    },
    document: {addEventListener() {}},
    toast() {},
  });
  vm.runInContext(
    `const ICONS=new Proxy({}, {get:(_,id)=>String(id)}); const Cloud={uid:'student-a',role:'student',isAdmin:false,isSuperAdmin:false}; const Mascot={};const U={esc:s=>String(s)};`,
    ctx,
  );
  for (const file of ['js/roles.js', 'js/navigation.js', 'js/personal-menu.js'])
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  vm.runInContext('globalThis.api={Cloud,MenuPrefs,navItems,bottomNav,navAvailable};', ctx);
  return ctx.api;
}
const ids = (app) => Array.from(app.navItems(), (x) => x.id);
test('pinning and moving affect personal order and phone shortcuts while More retains remaining tabs', () => {
  const a = app(),
    base = ids(a);
  assert.deepEqual(Array.from(a.bottomNav()), [
    'dashboard',
    'schedule',
    'attendance',
    'hw',
    'subjects',
    'chat',
    'more',
  ]);
  a.MenuPrefs.toggle('chat');
  a.MenuPrefs.toggle('rating');
  assert.deepEqual(ids(a).slice(0, 2), ['chat', 'rating']);
  assert.equal(a.MenuPrefs.move('rating', -1), true);
  assert.deepEqual(ids(a).slice(0, 2), ['rating', 'chat']);
  assert.equal(a.MenuPrefs.move('chat', 1), false);
  assert.equal(a.MenuPrefs.drop('rating', 'schedule'), false);
  a.MenuPrefs.toggle('rating');
  assert.equal(ids(a)[0], 'chat');
  assert.equal(a.MenuPrefs.drop('map', 'dashboard'), true);
  assert.ok(ids(a).indexOf('map') < ids(a).indexOf('dashboard'));
  assert.deepEqual(Array.from(a.bottomNav()).slice(0, 6), ids(a).slice(0, 6));
  assert.equal(a.bottomNav().at(-1), 'more');
  a.MenuPrefs.cache.clear();
  assert.equal(ids(a)[0], 'chat');
  assert.ok(ids(a).indexOf('map') < ids(a).indexOf('dashboard'));
  a.MenuPrefs.reset();
  assert.deepEqual(ids(a), base);
});
test('preferences belong to one account across groups and never grant owner or staff navigation', () => {
  const a = app();
  a.MenuPrefs.toggle('chat');
  a.Cloud.tenantId = 'group_3';
  assert.equal(ids(a)[0], 'chat');
  a.Cloud.uid = 'student-b';
  assert.equal(ids(a)[0], 'dashboard');
  a.MenuPrefs.toggle('map');
  assert.equal(ids(a)[0], 'map');
  a.Cloud.uid = 'student-a';
  assert.equal(ids(a)[0], 'chat');
  a.MenuPrefs.save({
    customized: true,
    order: ['access', 'groups', 'users', 'diagnostics', 'chat'],
    pinned: ['access', 'users', 'groups', 'diagnostics', 'chat'],
  });
  for (const id of ['access', 'groups', 'users', 'diagnostics']) assert.ok(!ids(a).includes(id));
  a.MenuPrefs.toggle('access');
  assert.ok(!ids(a).includes('access'));
  a.Cloud.role = 'developer';
  assert.ok(ids(a).includes('users'));
  assert.ok(!ids(a).includes('access'));
  assert.ok(!ids(a).includes('groups'));
  assert.ok(!ids(a).includes('diagnostics'));
  a.Cloud.role = 'parent';
  assert.deepEqual(ids(a), ['child', 'settings']);
  a.Cloud.role = 'admin';
  a.Cloud.isAdmin = true;
  a.Cloud.isSuperAdmin = true;
  assert.ok(ids(a).includes('access'));
  assert.ok(ids(a).includes('groups'));
  a.Cloud.isSuperAdmin = false;
  assert.ok(!ids(a).includes('access'));
  assert.ok(!ids(a).includes('groups'));
});
test('malformed preferences, invalid moves and missing tabs leave a usable authorized menu', () => {
  const a = app();
  assert.deepEqual(
    Array.from(a.MenuPrefs.normalize({order: ['chat', 'chat', 'evil', null], pinned: 'all'}).order),
    ['chat'],
  );
  assert.equal(a.MenuPrefs.move('dashboard', -1), false);
  assert.equal(a.MenuPrefs.move('missing', 1), false);
  assert.equal(a.MenuPrefs.drop('missing', 'chat'), false);
  assert.equal(a.MenuPrefs.drop('chat', 'chat'), false);
  a.MenuPrefs.save({order: null, pinned: ['unknown', 'settings'], customized: true});
  assert.equal(ids(a)[0], 'settings');
  assert.ok(a.MenuPrefs.html().includes('data-action="menu-pin"'));
});

test('optional tabs can be hidden and restored while mandatory sections and Settings always remain', () => {
  const a = app();
  a.MenuPrefs.toggle('map');
  assert.ok(a.MenuPrefs.pinned('map'));
  assert.equal(a.MenuPrefs.visibility('map'), true);
  assert.ok(!ids(a).includes('map'));
  assert.ok(!a.MenuPrefs.pinned('map'));
  assert.ok(a.MenuPrefs.html().includes('data-menu-item="map"'));
  assert.ok(a.MenuPrefs.html().includes('Показать вкладку: Карта'));
  a.MenuPrefs.cache.clear();
  assert.ok(!ids(a).includes('map'));
  for (const id of a.MenuPrefs.required) {
    assert.equal(a.MenuPrefs.visibility(id), false);
    assert.ok(ids(a).includes(id));
  }
  for (const item of a.navAvailable())
    if (!a.MenuPrefs.required.includes(item.id) && !a.MenuPrefs.hidden(item.id))
      a.MenuPrefs.visibility(item.id);
  assert.deepEqual(new Set(ids(a)), new Set(Array.from(a.MenuPrefs.required)));
  assert.equal(a.bottomNav().length, 6);
  a.MenuPrefs.visibility('map');
  assert.ok(ids(a).includes('map'));
  a.MenuPrefs.save({
    hidden: ['schedule', 'attendance', 'journal', 'chat', 'cabinet', 'settings', 'map'],
    customized: true,
  });
  for (const id of a.MenuPrefs.required) assert.ok(ids(a).includes(id));
  assert.ok(!ids(a).includes('map'));
  a.Cloud.uid = 'student-b';
  assert.ok(ids(a).includes('map'));
  a.Cloud.uid = 'student-a';
  assert.ok(!ids(a).includes('map'));
  a.MenuPrefs.reset();
  assert.ok(ids(a).includes('map'));
});

test('one icon switch is account-scoped and does not reorder or hide tabs', () => {
  const a = app(),
    order = ids(a),
    bottom = Array.from(a.bottomNav());
  assert.equal(a.MenuPrefs.iconsVisible(), true);
  a.MenuPrefs.toggleIcons();
  assert.equal(a.MenuPrefs.iconsVisible(), false);
  assert.deepEqual(ids(a), order);
  assert.deepEqual(Array.from(a.bottomNav()), bottom);
  a.MenuPrefs.cache.clear();
  assert.equal(a.MenuPrefs.iconsVisible(), false);
  a.Cloud.uid = 'second';
  assert.equal(a.MenuPrefs.iconsVisible(), true);
  a.Cloud.uid = 'student-a';
  assert.equal(a.MenuPrefs.iconsVisible(), false);
});
