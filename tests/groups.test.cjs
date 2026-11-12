const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function app() {
  const ctx = vm.createContext({console, Date, setTimeout, clearTimeout, AbortController,
    localStorage: {getItem:()=>null,setItem(){}}, fetch:async()=>{throw new Error('offline')}});
  for (const file of ['js/utils.js', 'js/roster.js', 'js/schedule-sync.js', 'js/groups.js', 'js/roles.js', 'js/dm.js'])
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
  vm.runInContext(`
    let GROUP_NAME = '25290909/3091';
    const GoogleSync={KEY:'politeshik:gsync'}, Chat={blank:()=>({msgs:[]})}, ui={}, Cloud={};
    const home={subjects:[{id:'home',name:'Home subject'}],teachers:[{id:'home',name:'Home teacher'}],works:[{title:'Home work'}],settings:{},meta:{}};
    const Seed={make:()=>JSON.parse(JSON.stringify(home)),defaultSettings:()=>({pairs:[]})};
    const states={user:home};
    const Store={s:home,bind(key){this.key=key;this.s=states[key]||JSON.parse(JSON.stringify(home));},replace(s){this.s=s;states[this.key]=s;ScheduleSync.week('2026-11-09',[]);}};
    ScheduleSync.refresh=()=>Promise.resolve();
    globalThis.api={Groups,ScheduleSync,ROSTER,ROSTER_BY_ID,Store,Cloud,Roles,Dm,ui,groupName:()=>GROUP_NAME,limit:()=>ABS_LIMIT};
  `,ctx);
  return ctx.api;
}

test('registration roster contains exactly 26 students of the selected group',()=>{
  const {Groups,ROSTER,ROSTER_BY_ID}=app();
  Groups.selectRoster('group_2');
  assert.equal(ROSTER.length,26);
  assert.equal(ROSTER[0].name,'Андрианов');
  assert.equal(ROSTER[25].name,'Ширяева');
  assert.equal(ROSTER_BY_ID.g2_r13.name,'Лебедев Петр Андреевич');
  assert.equal(ROSTER_BY_ID.g2_r12.accessRole,'developer');
  assert.equal(ROSTER_BY_ID.r32,undefined);
  Groups.selectRoster('group_1');
  assert.equal(ROSTER.length,32);
  assert.equal(ROSTER_BY_ID.g2_r13,undefined);
});

test('tenant activation isolates local data, schedule cache, Google config and subject catalog',()=>{
  const {Groups,Store,ScheduleSync,groupName}=app();
  ScheduleSync.snapshot=JSON.parse(fs.readFileSync(path.join(root,'data/schedule.json'),'utf8'));
  Groups.activate({uid:'user',tenant_id:'group_2'});
  assert.equal(Store.key,'user:group_2');
  assert.equal(Store.s.works.length,0);
  assert.equal(Store.s.teachers.length,0);
  assert.equal(Store.s.subjects.length,1);
  assert.equal(Store.s.subjects[0].id,'s_opbd');
  assert.equal(groupName(),'26290911/3111');
  assert.equal(ScheduleSync.group,'26290911/3111');
  assert.ok(ScheduleSync.key.endsWith(':group_2'));
  assert.ok(ScheduleSync.url.endsWith('schedule-26290911-3111.json'));
  ScheduleSync.snapshot=JSON.parse(fs.readFileSync(path.join(root,'data/schedule-26290911-3111.json'),'utf8'));
  ScheduleSync.populateCatalog();
  assert.ok(Store.s.teachers.length>0);
  assert.equal(Store.s.teachers.some(t=>t.id==='home'),false);
  const firstCount=Store.s.teachers.length;
  ScheduleSync.populateCatalog();
  assert.equal(Store.s.teachers.length,firstCount);
  assert.equal(ScheduleSync.valid(JSON.parse(fs.readFileSync(path.join(root,'data/schedule.json'),'utf8'))),false);
  Groups.activate({uid:'user',tenant_id:'group_1'});
  assert.equal(Store.key,'user');
  assert.equal(Store.s.works[0].title,'Home work');
});

test('God mode cannot be unlocked by an administrator flag, name or roster id',()=>{
  const {Cloud,Roles}=app();
  Cloud.realAdmin=true;Cloud.profile={rid:'r32',name:'ИГНАТЕНОК Арина'};Cloud.isSuperAdmin=false;
  assert.equal(Roles.isOwner(),false);
  Cloud.isSuperAdmin=true;
  assert.equal(Roles.isOwner(),true);
});

test('support conversations stay separate for leader, developer and Arina',()=>{
  const {Groups,Cloud,Dm,ui}=app();
  Groups.current='group_2';Cloud.uid='student';
  Dm.msgs=['admin','developer','superadmin'].map((recipient_role,id)=>({id,recipient_role,thread_uid:'student',sender:'support',read_by_student:false}));
  ui.dmRole='developer';
  assert.equal(Dm.threadMsgs('student').length,1);
  assert.equal(Dm.threadMsgs('student')[0].recipient_role,'developer');
  assert.equal(Dm.unreadTotal(),3);
  assert.equal(Dm.contactName('superadmin'),'Админ Арина');
  Cloud.isDeveloper=true;
  assert.equal(Dm.support(),true);
  assert.equal(Dm.supportRole(),'developer');
});

test('third group has its own 27-person roster and email-bound leader without a developer',()=>{
  const {Groups,ROSTER,ROSTER_BY_ID,Store,groupName}=app();
  Groups.selectRoster('group_3');
  assert.equal(ROSTER.length,27);
  assert.equal(ROSTER_BY_ID.g3_r16.name,'Плотникова Дарья Александровна');
  assert.equal(ROSTER_BY_ID.g3_r16.activation,'email');
  assert.equal(ROSTER.some(r=>r.accessRole==='developer'),false);
  assert.equal(ROSTER_BY_ID.g2_r13,undefined);
  Groups.activate({uid:'user',tenant_id:'group_3'});
  assert.equal(Store.key,'user:group_3');
  assert.equal(Store.s.settings.groupTenant,'group_3');
  assert.equal(Store.s.subjects.length,0);
  assert.equal(groupName(),'23290907/2092');
  assert.equal(Groups.get('group_3').supportRoles.join(','),'admin,superadmin');
});


test('monthly absence limit follows the selected group and keeps Arina home at 24 hours',()=>{
  const {Groups,limit}=app();
  Groups.activate({uid:'user',tenant_id:'group_2'}); assert.equal(limit(),12);
  Groups.activate({uid:'user',tenant_id:'group_3'}); assert.equal(limit(),12);
  Groups.activate({uid:'user',tenant_id:'group_1'}); assert.equal(limit(),24);
});


test('parent requests never count as students even when an old profile has a roster id',()=>{
  const {Cloud,Roles}=app();
  Cloud.adm={profiles:{parent:{rid:'r2',role:'student'}}};
  Cloud.memberMap={parent:{role:'student',requested_role:'parent',status:'approved'}};
  assert.equal(Roles.countsAsStudent('parent'),false);
  Cloud.memberMap.parent={role:'parent',requested_role:'parent',status:'approved'};
  assert.equal(Roles.countsAsStudent('parent'),false);
});
