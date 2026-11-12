const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/app.js','utf8');
function method(name,end){return source.slice(source.indexOf('  '+name+'('),source.indexOf(end,source.indexOf('  '+name+'(')));}
test('render caches are fresh each frame and restored even after a failed or nested render',()=>{
 const c=vm.createContext({Weeks:{renderCache:null},ScheduleSync:{renderCache:null}});
 vm.runInContext('const App={'+method('renderView','  fingerprint(')+'};globalThis.App=App;',c);
 let first;c.App.renderView(()=>{first=c.Weeks.renderCache;first.set('week','old');c.App.renderView(()=>assert.equal(c.Weeks.renderCache.size,0));assert.equal(c.Weeks.renderCache,first);});
 assert.equal(c.Weeks.renderCache,null);assert.equal(c.ScheduleSync.renderCache,null);
 c.App.renderView(()=>assert.equal(c.Weeks.renderCache.size,0));
 assert.throws(()=>c.App.renderView(()=>{throw Error('failed')}));assert.equal(c.Weeks.renderCache,null);
});
test('background updates coalesce into one frame and respect typing and modal dialogs',()=>{
 let queued,rendered=0;const roots={firstChild:null},document={activeElement:null};
 const c=vm.createContext({document,ui:{tab:'journal'},$:()=>roots,requestAnimationFrame:fn=>{queued=fn;return 1}});
 vm.runInContext('const App={render(){rendered()},'+method('renderSoft','\n  /**')+'};globalThis.App=App;',Object.assign(c,{rendered:()=>rendered++}));
 for(let i=0;i<20;i++)c.App.renderSoft();queued();assert.equal(rendered,1);
 c.App.renderSoft();document.activeElement={tagName:'TEXTAREA'};queued();assert.equal(rendered,1);
 document.activeElement=null;c.App.renderSoft();roots.firstChild={};queued();assert.equal(rendered,1);
 roots.firstChild=null;c.App.renderSoft();queued();assert.equal(rendered,2);
});
test('polling avoids overlapping reads and unchanged renders, retries errors and ignores unsubscribed results',async()=>{
 for(const collection of [false,true]){
  const intervals=[],pending=[],document={hidden:false};let queries=0,calls=0,errors=0;
  const chain=new Proxy({}, {get:(_,key)=>key==='then'?(resolve=>{queries++;pending.push(resolve)}):()=>chain});
  const c=vm.createContext({console,document,supa:{from:()=>chain},setInterval:fn=>{intervals.push(fn);return 1},clearInterval(){}});
  vm.runInContext(fs.readFileSync('js/db.js','utf8')+';globalThis.api=Cloud;',c);
  const sub=(collection?c.api.db.collection('profiles'):c.api.db.doc('profiles/me')).onSnapshot(()=>calls++,()=>errors++);
  const flush=()=>new Promise(r=>setImmediate(r));await flush();intervals.at(-1)();assert.equal(queries,1);
  const data=collection?[{path:'profiles/me',data:{name:'A'}}]:{data:{name:'A'}};
  pending.shift()({data,error:null});await flush();assert.equal(calls,1);
  intervals.at(-1)();await flush();pending.shift()({data,error:null});await flush();assert.equal(calls,1);
  document.hidden=true;intervals.at(-1)();await flush();assert.equal(queries,2);document.hidden=false;
  intervals.at(-1)();await flush();pending.shift()({error:Error('offline')});await flush();assert.equal(errors,1);
  intervals.at(-1)();await flush();sub.unsubscribe();pending.shift()({data:collection?[]:null,error:null});await flush();assert.equal(calls,1);
 }
});
test('loading gate redraws when claims arrive without changing the requested screen',()=>{
 const gate={dataset:{},innerHTML:''},other={innerHTML:''},Cloud={status:'online',claimsLoaded:false,facultyRequest:{name:'Преподаватель',status:'pending'},hasCabinet:()=>false};
 const c=vm.createContext({Cloud,ui:{},document:{body:{classList:{add(){}}}},$:id=>id==='#gate'?gate:other,Mascot:{svg:()=>''},U:{esc:x=>x}});
 vm.runInContext('const App={'+method('renderGate','  render(animate)')+'};globalThis.App=App;',c);
 c.App.renderGate('faculty-wait');assert.match(gate.innerHTML,/Подключаемся/);
 Cloud.claimsLoaded=true;c.App.renderGate('faculty-wait');assert.match(gate.innerHTML,/faculty-check/);assert.doesNotMatch(gate.innerHTML,/Подключаемся/);
});
