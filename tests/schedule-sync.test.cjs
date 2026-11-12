const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function app() {
  const ctx = vm.createContext({console, setTimeout, clearTimeout, AbortController,
    localStorage: {setItem() {}}, Date, fetch: async () => { throw new Error('offline'); }});
  for (const file of ['js/utils.js', 'js/roster.js', 'js/schedule-sync.js', 'js/weeks.js', 'js/attendance.js'])
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx);
  vm.runInContext(`
    const Store = {s: {subjects: [{id:'s_it',name:'ИТ в профессиональной деятельности'}, {id:'s_opbd',name:'Основы проектирования баз данных'}],
      settings: {numeratorAnchor:'2026-10-12'}, weeks: {}, schedule: []}};
    const ui = {}, Cloud = {isAdmin:false,isStaff:false}, Changes = {items:()=>[], at:()=>null};
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
  assert.equal(ScheduleSync.changes().filter(c => c.date === '2026-11-10').length, 1);
  assert.equal(ScheduleSync.changes().find(c => c.date === '2026-11-10').type, 'replace');
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

test('manual edits survive source refresh, cloud roundtrip and leave other pairs automatic', () => {
  const {Weeks, Store, ScheduleSync} = app(), ws = '2026-11-09';
  const original = Weeks.on('2026-11-10')[2];
  Weeks.saveLesson(ws, {...original, who:'Мой преподаватель', room:'999', subjectId:'s_it'}, original.id, false);
  const fresh = JSON.parse(JSON.stringify(ScheduleSync.snapshot));
  fresh.days['2026-11-10'].lessons[2].auditorium = '111';
  fresh.days['2026-11-10'].lessons[2].classroom = '111';
  fresh.days['2026-11-10'].lessons[3].teacher = 'Обновлён из ИСПО';
  ScheduleSync.snapshot = fresh;
  Store.s.weeks = JSON.parse(JSON.stringify(Store.s.weeks));
  const edited = Weeks.on('2026-11-10').find(l => l.pair === 3);
  assert.equal(edited.room, '999');
  assert.equal(edited.who, 'Мой преподаватель');
  assert.equal(edited.sourceSubject, undefined);
  assert.equal(Weeks.on('2026-11-10').find(l => l.pair === 4).who, 'Обновлён из ИСПО');
  Weeks.reset(ws);
  assert.equal(Weeks.on('2026-11-10').find(l => l.pair === 3).room, '111');
});

test('manual deletion, adding to empty day and moving a source lesson survive refresh', () => {
  const {Weeks, ScheduleSync} = app(), ws = '2026-11-09';
  const original = Weeks.on('2026-11-10')[2];
  Weeks.removeLesson(ws, original.id);
  assert.equal(Weeks.on('2026-11-10').some(l => l.pair === 3), false);
  Weeks.saveLesson(ws, {day:5,pair:1,subjectId:'s_it',room:'444'}, '', false);
  assert.equal(Weeks.on('2026-11-14')[0].room, '444');
  const moving = Weeks.on('2026-11-10').find(l => l.pair === 4);
  Weeks.saveLesson(ws, {...moving,day:2,pair:5}, moving.id, false);
  ScheduleSync.snapshot = JSON.parse(JSON.stringify(ScheduleSync.snapshot));
  assert.equal(Weeks.on('2026-11-10').some(l => l.pair === 4), false);
  assert.equal(Weeks.on('2026-11-11').some(l => l.pair === 5), true);
});

test('copying a week persists the copied schedule including free days', () => {
  const {Weeks} = app();
  Weeks.copy('2026-11-09', '2026-11-16');
  assert.equal(Weeks.on('2026-11-16').length, Weeks.on('2026-11-09').length);
  assert.equal(Weeks.on('2026-11-21').length, 0);
});

test('repeating an edited source lesson updates both current week and template', () => {
  const {Weeks} = app(), source = Weeks.on('2026-11-10')[2];
  Weeks.saveLesson('2026-11-09', {day:1,pair:3,subjectId:'s_it',room:'777'}, source.id, true);
  assert.equal(Weeks.on('2026-11-10').find(l => l.pair === 3).room, '777');
  assert.equal(Weeks.templateFor('2026-12-14')[0].room, '777');
});

test('manual excused absence is respected without a certificate and adds no unexcused hours',()=>{
  const {ScheduleSync,Att}=app();
  const date=Object.keys(ScheduleSync.snapshot.days).find(d=>Att.pairs(d,'1').length);
  const pairs=Att.pairs(date,'1');
  const marks=Object.fromEntries(pairs.map(p=>[date+'|'+p.pair,'п']));
  marks[date+'|'+pairs[0].pair]='у';
  assert.equal(Att.eff(marks,[],date,pairs[0].pair),'уп');
  const stats=Att.stats(marks,[],'1',date,date);
  assert.equal(stats.x,1);
  assert.equal(stats.a,0);
  assert.equal(Att.absHours(marks,[],'1',date.slice(0,7)),0);
});


test('individual schedule UP is excused and whole-day buttons preserve excuses and certificates',()=>{
  const {ScheduleSync,Att}=app();
  const date=Object.keys(ScheduleSync.snapshot.days).find(d=>Att.pairs(d,'1').length>=3);
  const pairs=Att.pairs(date,'1'), key=p=>date+'|'+p;
  const marks={[key(pairs[0].pair)]:'уп',[key(pairs[1].pair)]:'у'};
  const certs=[{confirmed:true,from:date,to:date,pairs:[pairs[2].pair]}];
  assert.equal(Att.eff(marks,certs,date,pairs[0].pair),'уп');
  assert.equal(Att.stats(marks,certs,'1',date,date).a,0);
  const changes=Att.dayChanges(date,'1',marks,certs,'н');
  for(const p of pairs.slice(0,3)) assert.equal(changes[key(p.pair)],undefined);
  for(const p of pairs.slice(3)) assert.equal(changes[key(p.pair)],'н');
});

test('self attendance stays open exactly 24 hours after the pair end in Moscow time',()=>{
  const {Att,Store}=app();
  const at=value=>Date.parse(value);
  assert.equal(Att.canSelf('2026-11-11',3,at('2026-11-12T14:20:00+03:00')),true);
  assert.equal(Att.canSelf('2026-11-11',3,at('2026-11-12T14:20:00.001+03:00')),false);
  assert.equal(Att.canSelf('2026-11-11',3,at('2026-11-11T12:49:59+03:00')),false);
  Store.s.settings.pairs=[{start:'08:00',end:'09:40'}];
  assert.equal(Att.canSelf('2026-11-11',1,at('2026-11-12T09:40:00+03:00')),true);
  assert.equal(Att.canSelf('2026-11-11',1,at('2026-11-12T09:40:01+03:00')),false);
});
test('only confirmed certificates turn an unexcused absence into UP',()=>{
  const {Att}=app(),marks={'2026-11-11|1':'н'},cert={from:'2026-11-11',to:'2026-11-11',pairs:[1]};
  assert.equal(Att.eff(marks,[{...cert,confirmed:false}],'2026-11-11',1),'н');
  assert.equal(Att.eff(marks,[{...cert,confirmed:true}],'2026-11-11',1),'уп');
});

test('an explicitly waiting source is distinguished from published free days and preserves manual lessons',()=>{
 const {ScheduleSync,Weeks,Store}=app();
 const waiting={schema:1,group:ScheduleSync.group,source:'https://polytech-schedule.ru',checked_at:'2026-11-12',status:'awaiting_source',days:{}};
 assert.equal(ScheduleSync.valid(waiting),true);assert.equal(ScheduleSync.valid({...waiting,group:'foreign'}),false);
 ScheduleSync.snapshot=waiting;Store.s.weeks['2026-11-09']=[{id:'manual',day:0,pair:1,subjectId:'s_opbd'}];
 assert.equal(ScheduleSync.day('2026-11-09'),null);assert.equal(Weeks.on('2026-11-09')[0].id,'manual');
});
