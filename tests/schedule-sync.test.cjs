const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function app() {
  const ctx = vm.createContext({console, setTimeout, clearTimeout, AbortController,
    localStorage: {setItem() {}}, Date, fetch: async () => { throw new Error('offline'); }});
  for (const file of ['js/utils.js', 'js/schedule-sync.js', 'js/weeks.js', 'js/attendance.js'])
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx);
  vm.runInContext(`
    const Store = {s: {subjects: [{id:'s_it',name:'ИТ в профессиональной деятельности'}, {id:'s_opbd',name:'Основы проектирования баз данных'}],
      settings: {numeratorAnchor:'2026-10-12'}, weeks: {}, schedule: []}};
    const ui = {}, Cloud = {isAdmin:false,isStaff:false}, Changes = {items:()=>[]};
    globalThis.api = {ScheduleSync, Weeks, Att, Store, Cloud};
  `, ctx);
  ctx.api.Store.s.settings.subgroup = '1';
  ctx.api.ScheduleSync.snapshot = JSON.parse(fs.readFileSync(path.join(root, 'data/schedule.json'), 'utf8'));
  return ctx.api;
}

test('source overrides local/cloud weeks and preserves subject links', () => {
  const {Weeks, Store, ScheduleSync} = app();
  Store.s.weeks['2026-11-09'] = [{day: 1, pair: 9, subjectId: 'old'}];
  assert.equal(Weeks.on('2026-11-10').length, 4);
  assert.equal(Weeks.on('2026-11-10')[2].subjectId, 's_opbd');
  assert.equal(ScheduleSync.subject('ИТ в ПД лр'), 's_it');
  assert.equal(Weeks.on('2026-11-14').length, 0);
  Store.s.weeks['2026-11-30'] = [{day: 0, pair: 1, subjectId: 'old'}];
  assert.equal(Weeks.on('2026-11-30')[0].subjectId, 'old');
});

test('cancellation in one subgroup does not remove the other subgroup lesson', () => {
  const {ScheduleSync, Att, Store} = app();
  const base = {lesson_number:1,subject:'ОПБД',group_list:[ScheduleSync.group]};
  ScheduleSync.snapshot.days['2026-11-10'].lessons = [
    {...base, subgroup:1,status:'cancellation'}, {...base,subgroup:2,status:'replacement',teacher:'Новый преподаватель'}
  ];
  assert.equal(Att.pairs('2026-11-10', '1').length, 0);
  assert.equal(Att.pairs('2026-11-10', '2').length, 1);
  assert.equal(Att.dayView('2026-11-10', '2')[0].state, 'replace');
  assert.equal(Att.dayView('2026-11-10', '2')[0].lessons[0].who, 'Новый преподаватель');
  assert.equal(Att.dayView('2026-11-10', '')[0].lessons.length, 1);
  Store.s.settings.subgroup = '2';
  assert.equal(ScheduleSync.changes().length, 1);
  assert.equal(ScheduleSync.changes()[0].type, 'replace');
});

test('new snapshot removes disappeared lessons and reverts replacements', () => {
  const {ScheduleSync, Weeks, Att} = app();
  const data = ScheduleSync.snapshot.days['2026-11-10'];
  data.lessons[0].status = 'replacement';
  assert.equal(Att.dayView('2026-11-10', '')[0].state, 'replace');
  data.lessons[0].status = 'ok';
  assert.equal(Att.dayView('2026-11-10', '')[0].state, 'ok');
  data.lessons = [];
  assert.equal(Weeks.on('2026-11-10').length, 0);
});

test('offline and malformed data retain last valid snapshot', async () => {
  const {ScheduleSync} = app();
  const original = ScheduleSync.snapshot;
  await assert.rejects(ScheduleSync.fetchSnapshot('https://example.com'));
  assert.equal(ScheduleSync.snapshot, original);
  assert.equal(ScheduleSync.valid({...original,group:'wrong'}), false);
  const malformed = JSON.parse(JSON.stringify(original));
  malformed.days['2026-11-10'].lessons[0].status = 'unknown';
  assert.equal(ScheduleSync.valid(malformed), false);
});
