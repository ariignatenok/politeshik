'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function fixture(){
 const calls=[],status={textContent:''},ctx=vm.createContext({Cloud:{uid:'owner',tenantId:'group_4'},U:{esc},URL,console,window:{addEventListener(){}},clearInterval(){},IntersectionObserver:class{observe(){}unobserve(){}},MutationObserver:class{observe(){}},document:{body:{},addEventListener(){},querySelector(){return null;},querySelectorAll(){return[];},getElementById(id){return id==='media-caption'?{value:'Подпись'}:status;}},A:{},UI:{open(){},close(){}},supa:{rpc:async()=>({data:{}}),storage:{from:()=>({upload:async()=>({error:null}),remove:async()=>({})})}},Social:{call:async(name,args)=>{calls.push({name,args});return name.startsWith('prepare')?{id:'upload',path:'owner/upload'}:{sent:true};}},App:{render(){}},Dm:{recipient:()=> 'admin',refresh:async()=>{}},toast(){},Wardrobe:{normalize:x=>x},Mascot:{svg:()=>''},chatTime:x=>x});
 vm.runInContext(fs.readFileSync('js/chat-media.js','utf8')+'\nglobalThis.CM=ChatMedia;',ctx);
 vm.runInContext(fs.readFileSync('js/work-chat-tools.js','utf8')+'\nglobalThis.W=WorkChatTools;',ctx);
 ctx.W.refresh=async()=>{};return {ctx,W:ctx.W,CM:ctx.CM,calls};
}
test('safe link rendering preserves text and links only HTTP(S)',()=>{
 const {W}=fixture();const html=W.text('<script>alert(1)</script> https://college.example/path?a=1&b=2.\njavascript:alert(1)');
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('href="https://college.example/path?a=1&amp;b=2"'));assert.equal((html.match(/<a /g)||[]).length,1);assert.ok(html.includes('<br>'));assert.ok(html.includes('noopener noreferrer'));
});
test('work attachment context separates room tenant and peer from current user group',()=>{
 const {W}=fixture();const scope=W.context({dataset:{form:'curator-chat',thread:'group_5:peer-uid'}});
 assert.equal(scope.kind,'curator');assert.equal(scope.tenant,'group_5');assert.equal(scope.peer,'peer-uid');assert.equal(W.context({dataset:{form:'peer'}}),null);
 assert.equal(W.context({dataset:{form:'development-chat'}}).kind,'development');
});
test('work uploads use their dedicated endpoint and cannot fall into a support DM',async()=>{
 const {CM,calls}=fixture();CM.draft={file:{name:'file.pdf',type:'application/pdf',size:4},kind:'file',context:{owner:'owner',tenant:'group_4',work:{kind:'group',tenant:'group_5'}}};await CM.send();
 assert.equal(calls[0].name,'prepare_work_chat_upload');assert.equal(calls[0].args.p_tenant,'group_5');assert.equal(calls[0].args.p_media_kind,'file');assert.equal(calls[1].name,'send_work_chat_upload');assert.equal(CM.draft,null);
});
test('existing personal uploads retain their original endpoint and recipient',async()=>{
 const {CM,calls}=fixture();CM.draft={file:{name:'file.pdf',type:'application/pdf',size:4},kind:'file',context:{owner:'owner',tenant:'group_4',peer:null,thread:'student',role:'admin'}};await CM.send();
 assert.equal(calls[0].name,'prepare_message_upload');assert.equal(calls[0].args.p_thread,'student');assert.equal(calls[0].args.p_role,'admin');assert.equal(calls[1].name,'send_message_upload');
});

test('switching back to participants discards an in-flight gallery response',async()=>{
 const {ctx,W}=fixture();let resolve;ctx.supa.rpc=()=>new Promise(r=>{resolve=r});ctx.document.querySelector=()=>({});W.render=()=>{};W.owner='owner';W.scope={kind:'leaders'};
 const pending=W.select('media');await W.select('participants');resolve({data:[{id:'old-gallery-result'}]});await pending;
 assert.equal(W.tab,'participants');assert.equal(W.rows.length,0);assert.equal(W.more,false);
});
