const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function notifier({permission='default',result='granted',ios=false,standalone=false,supported=true}={}) {
 const calls=[];
 const ctx=vm.createContext({navigator:{userAgent:ios?'iPhone':'Chrome',platform:'Linux',maxTouchPoints:0,standalone},window:{isSecureContext:true,matchMedia:()=>({matches:standalone})},
  Store:{s:{settings:{}},save(){calls.push('save')}},ICONS:{},U:{esc:x=>x},console});
 if(supported)ctx.Notification={permission,requestPermission(callback){calls.push('request');callback(result);return Promise.resolve(result)}};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/notifications.js'),'utf8'),ctx);
 return {api:vm.runInContext('Notifier',ctx),calls};
}
test('permission request occurs before saving, while click activation is available',async()=>{
 const {api,calls}=notifier();assert.equal(await api.ask(),'granted');assert.deepEqual(calls,['request','save']);
});
test('dismissed request stays default rather than reporting a browser block',async()=>{
 const {api}=notifier({result:'default'});assert.equal(await api.ask(),'default');assert.match(api.helpHtml('default'),/Запрос закрыт/);
});
test('blocked permissions show instructions without repeating a forbidden request',async()=>{
 const {api,calls}=notifier({permission:'denied'});assert.equal(await api.ask(),'denied');assert.deepEqual(calls,['save']);assert.match(api.helpHtml('denied'),/Разрешить/);
});
test('iPhone browser tab gives Home Screen instructions and never asks prematurely',async()=>{
 const {api,calls}=notifier({ios:true});assert.equal(await api.ask(),'install');assert.deepEqual(calls,['save']);assert.match(api.helpHtml('install'),/На экран Домой/);
});
test('installed iPhone app can request notification permission',async()=>{
 const {api}=notifier({ios:true,standalone:true});assert.equal(await api.ask(),'granted');
});
test('unsupported browsers are not mistaken for a permission refusal',async()=>{
 const {api}=notifier({supported:false});assert.equal(await api.ask(),'unsupported');
});
