'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function fixture(rpc) {
  const Cloud = {uid:'one',tenantId:'group_4',status:'online',role:'student',isAdmin:false,isDeputy:false,adm:{profiles:{},att:{},certs:{}},hasCabinet:()=>true};
  const context = vm.createContext({Cloud, supa:{rpc}, setInterval:()=>0, document:{hidden:false}, Store:{s:{attendance:{marks:{}}},save(){}}, U:{esc:x=>x}, ui:{}, App:{renderSoft(){}}, Groups:{}, UI:{}, toast(){}});
  vm.runInContext(fs.readFileSync('js/deputies.js','utf8')+'\nglobalThis.subject=Deputies;',context);
  return {D:context.subject,Cloud};
}
test('deputy marking remains a student capability, separate from admin and staff', () => {
  const {D,Cloud}=fixture();Cloud.isDeputy=true;
  assert.equal(D.canMark(),true);assert.equal(Cloud.isAdmin,false);assert.equal(D.manageButton(),'');
  for(const role of ['curator','teacher','banned','pending','developer']){Cloud.role=role;assert.equal(D.canMark(),false);}
  Cloud.role='student';Cloud.status='offline';assert.equal(D.canMark(),false);
});
test('revocation removes the cached group journal and hides attendance controls', async()=>{
  let active=true;
  const {D,Cloud}=fixture(async()=>({data:{is_deputy:active,journal:active?[{uid:'peer',profile:{rid:'r'},attendance:{marks:{day:'п'}},certs:[]}]:[]}}));
  await D.refresh();assert.equal(D.canMark(),true);assert.ok(Cloud.adm.att.peer);
  active=false;await D.refresh();assert.equal(D.canMark(),false);assert.equal(Object.keys(Cloud.adm.att).length,0);assert.equal(Object.keys(Cloud.adm.profiles).length,0);
});
test('a delayed old-account response cannot grant the next account deputy rights', async()=>{
  let resolve;
  const {D,Cloud}=fixture(()=>new Promise(r=>{resolve=r;}));
  const pending=D.refresh();Cloud.uid='two';resolve({data:{is_deputy:true,journal:[{uid:'secret',profile:{},attendance:{marks:{}}}]}});
  await pending;assert.equal(Cloud.isDeputy,false);assert.equal(Object.keys(Cloud.adm.att).length,0);
});
test('deputy saves only changed marks through its scoped RPC and handles rejection', async()=>{
  const calls=[];const {D,Cloud}=fixture(async(name,args)=>{calls.push({name,args});return {error:{message:'Нет полномочий'}};});
  Cloud.isDeputy=true;Cloud.adm.att.peer={marks:{'2026-11-13|1':'уп'}};
  const result=await D.saveMarks('peer',{'2026-11-13|1':'уп','2026-11-13|2':'п'});
  assert.equal(calls[0].name,'deputy_marks');assert.equal(Object.keys(calls[0].args.p_changes).length,1);assert.equal(calls[0].args.p_changes['2026-11-13|2'],'п');
  assert.equal(result.ok,false);assert.equal(Cloud.adm.att.peer.marks['2026-11-13|2'],undefined);
});
