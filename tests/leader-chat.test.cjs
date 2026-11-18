'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function fixture(rpc){
 const Cloud={uid:'one',tenantId:'group_4',role:'student',status:'online',isDeputy:true,isAdmin:false,isSuperAdmin:false,hasCabinet:()=>true};
 const context=vm.createContext({Cloud,Deputies:{canMark:()=>Cloud.isDeputy&&Cloud.role==='student'},supa:{rpc},setInterval:()=>0,document:{hidden:false},ui:{},App:{renderSoft(){}},A:{},Forms:{},renderChatUpdates(){}});
 vm.runInContext(fs.readFileSync('js/leader-chat.js','utf8')+'\nglobalThis.subject=LeaderChat;',context);return {L:context.subject,Cloud};
}
test('ordinary students do not fetch private council state; deputy assignment discovers it',async()=>{
 let calls=0;const {L,Cloud}=fixture(async()=>{calls++;return {data:{allowed:true,unread:3}};});
 Cloud.isDeputy=false;await L.refresh(true);assert.equal(calls,0);assert.equal(L.unread(),0);
 Cloud.isDeputy=true;await L.refresh(true);assert.equal(calls,1);assert.equal(L.unread(),3);
});
test('revocation clears council history, unread count and pending sends',async()=>{
 const {L,Cloud}=fixture(async()=>({data:{allowed:true,unread:2}}));await L.refresh();L.rows=[{body:'private'}];L.pending={body:'draft',nonce:'old'};
 Cloud.isDeputy=false;L.reset();assert.equal(L.rows.length,0);assert.equal(L.pending,null);assert.equal(L.unread(),0);
});
test('delayed old-account council response is discarded',async()=>{
 let resolve;const {L,Cloud}=fixture(()=>new Promise(r=>{resolve=r;}));const pending=L.refresh(true);
 Cloud.uid='two';Cloud.isDeputy=false;L.reset();resolve({data:{allowed:true,unread:10}});await pending;
 assert.equal(L.state,null);assert.equal(L.unread(),0);
});
test('server-side revocation clears history before local role polling catches up',async()=>{
 const {L}=fixture(async()=>({data:{allowed:false}}));L.reset();L.rows=[{body:'private'}];await L.refresh(true);
 assert.equal(L.rows.length,0);assert.equal(L.state.allowed,false);assert.equal(L.unread(),0);
});
