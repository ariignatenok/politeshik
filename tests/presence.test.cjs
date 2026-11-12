const {test} = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm');
function app() {
  const c = vm.createContext({
    console,
    Date: class extends Date {
      static now() {
        return Date.parse('2026-11-12T00:30:00Z');
      }
    },
    crypto: {randomUUID: () => '00000000-0000-0000-0000-000000000001'},
  });
  vm.runInContext(`const Cloud={uid:'me'},Social={allowed:()=>true},U={esc:x=>String(x)};`, c);
  vm.runInContext(fs.readFileSync('js/presence.js', 'utf8'), c);
  vm.runInContext('globalThis.api={Presence,Cloud};', c);
  return c.api;
}
test('presence expires instead of keeping an absent user online and does not invent unknown visit times', () => {
  const {Presence: p} = app();
  p.owner = 'me';
  assert.equal(p.info({uid: 'a', online: true, last_seen: '2026-11-12T00:29:50Z'}).label, 'В сети');
  assert.equal(p.info({uid: 'a', online: true, last_seen: '2026-11-12T00:25:00Z'}).online, false);
  assert.equal(p.info({uid: 'a'}).label, 'Нет данных о посещении');
  p.map.a = {uid: 'a', online: false, last_seen: '2026-11-12T00:20:00Z'};
  assert.equal(
    p.info({uid: 'a', online: true, last_seen: '2026-11-12T00:29:55Z'}).online,
    true,
    'Old heartbeat overwrote a newer fetched profile',
  );
});
test('last visit timestamps use Moscow calendar days and time', () => {
  const {Presence: p} = app();
  assert.equal(
    p.info({uid: 'a', online: false, last_seen: '2026-11-11T23:30:00Z'}).label,
    'Был(а) сегодня в 02:30',
  );
  assert.ok(
    p.info({uid: 'a', online: false, last_seen: '2026-11-10T20:00:00Z'}).label.includes('10.11.2026'),
  );
});
