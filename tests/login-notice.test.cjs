const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function app({configured=true,valid=true,fail=false}={}){
 const sent=[],calls=[],logs=[],settings={SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-only-test-key',...(configured?{SMTP_HOST:'smtp.example.invalid',SMTP_USER:'sender',SMTP_PASS:'private-test-password',SMTP_FROM:'sender@example.invalid',SMTP_PORT:'465',LOGIN_DISPATCH_KEY:'11'.repeat(32)}:{})};let handler;
 const c=vm.createContext({Deno:{env:{get:k=>settings[k]},serve:fn=>handler=fn},nodemailer:{createTransport:options=>({sendMail:async msg=>{sent.push({options,msg});if(fail)throw Error('private-test-password');return{accepted:[msg.to]};},close(){}})},fetch:async(url,init)=>{calls.push({url,body:JSON.parse(init.body),headers:init.headers});return new Response(JSON.stringify(url.endsWith('claim_login_notice')?(valid?{id:'event',email:'owner@example.invalid',occurred_at:'2026-11-17T09:00:00Z'}:null):true));},Response,AbortSignal,crypto:require('node:crypto').webcrypto,TextEncoder,TextDecoder,console:{error:m=>logs.push(m)},Date});
 vm.runInContext(fs.readFileSync('supabase/functions/login-notice/index.js','utf8').replace(/^import .*\n/,''),c);
 return{handler,sent,calls,logs};
}
async function request(){
 const crypto=require('node:crypto').webcrypto,enc=new TextEncoder(),key='11'.repeat(32),id='d1000000-0000-0000-0000-000000000001';
 const iv=crypto.getRandomValues(new Uint8Array(16)),hex=v=>Buffer.from(v).toString('hex');
 const cipherKey=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode('enc:'+key)),{name:'AES-CBC'},false,['encrypt']);
 const data=await crypto.subtle.encrypt({name:'AES-CBC',iv},cipherKey,enc.encode(JSON.stringify({event_id:id,token:'ab'.repeat(32)})));
 const macKey=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode('mac:'+key)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const mac=await crypto.subtle.sign('HMAC',macKey,enc.encode(id+'\n'+hex(iv)+'\n'+hex(data)));
 return new Request('https://example.invalid',{method:'POST',body:JSON.stringify({event_id:id,iv:hex(iv),data:hex(data),mac:hex(mac)})});
}
test('mail endpoint refuses malformed requests and stays disabled without SMTP',async()=>{
 const {handler,calls}=app({configured:false});assert.equal((await handler(new Request('https://example.invalid'))).status,405);assert.equal((await handler(new Request('https://example.invalid',{method:'POST',body:'{}'}))).status,400);assert.equal((await handler(await request())).status,503);assert.equal(calls.length,0);
});
test('unknown or already consumed capability cannot send an email',async()=>{const {handler,sent}=app({valid:false});assert.equal((await handler(await request())).status,403);assert.equal(sent.length,0);});
test('recipient comes only from the protected event and SMTP secrets never enter response',async()=>{
 const {handler,sent,calls}=app();const result=await handler(await request());assert.equal(result.status,200);assert.equal(sent[0].msg.to,'owner@example.invalid');assert.equal(sent[0].options.tls.rejectUnauthorized,true);assert.equal(sent[0].options.requireTLS,true);assert.equal(calls[1].body.p_success,true);const text=await result.text();assert.ok(!text.includes('private-test-password'));assert.ok(!text.includes('server-only-test-key'));
});
test('SMTP failure records a bounded retry without logging its secret-bearing error',async()=>{
 const {handler,calls,logs}=app({fail:true});assert.equal((await handler(await request())).status,503);assert.equal(calls[1].body.p_success,false);assert.equal(logs.join(''),'LOGIN_NOTICE_DELIVERY_FAILED');
});

test('PostgreSQL AES-CBC/HMAC envelope decrypts correctly with WebCrypto',async()=>{
 const {handler,sent}=app();const body=fs.readFileSync('tests/fixtures/login-notice-postgres-envelope.json','utf8');const result=await handler(new Request('https://example.invalid',{method:'POST',body}));assert.equal(result.status,200);assert.equal(sent.length,1);
});
test('modified encrypted envelope is rejected before any privileged RPC',async()=>{
 const {handler,sent,calls}=app();const body=await(await request()).json();body.data=(body.data[0]==='0'?'1':'0')+body.data.slice(1);const result=await handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify(body)}));assert.equal(result.status,403);assert.equal(sent.length,0);assert.equal(calls.length,0);
});
