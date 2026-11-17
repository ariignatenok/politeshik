const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function app(){
 const fields=Object.fromEntries(['recovery_email','recovery_code','recovery_password','recovery_confirm'].map(k=>[k,{value:''}])),calls=[];
 const error={textContent:'',hidden:true},buttons=[],client={auth:{resetPasswordForEmail:async(...a)=>{calls.push(['send',...a]);return{};},verifyOtp:async a=>{calls.push(['verify',a]);return{data:{user:{id:'owner'},session:{}}};},updateUser:async a=>{calls.push(['update',a]);return{data:{user:{id:'owner'}}};},signOut:async a=>{calls.push(['signout',a]);return{};}}};
 const c=vm.createContext({A:{},SUPA_URL:'https://example.invalid',SUPA_KEY:'public',window:{supabase:{createClient:(...args)=>{calls.push(['client',...args]);return client;}}},document:{querySelector:s=>s==='[data-form="password-recovery"]'?{querySelector:()=>error,querySelectorAll:()=>buttons}:fields[s.match(/name="(.*?)"/)?.[1]]||null},$ :()=>({dataset:{}}),App:{render(){}},ui:{},location:{href:'https://example.invalid/politeshik/'},URL,Date,clearInterval(){},setInterval(){return 1;}});
 vm.runInContext(fs.readFileSync('js/auth-recovery.js','utf8')+';globalThis.api=AuthRecovery',c);return{c,api:c.api,fields,calls,client};
}
test('recovery client cannot persist a temporary session in the main account',()=>{
 const {api,calls}=app();api.start('student@example.invalid');const options=calls[0][3];assert.equal(options.auth.persistSession,false);assert.equal(options.auth.autoRefreshToken,false);assert.equal(options.auth.detectSessionInUrl,false);assert.equal(options.auth.storageKey,'politeshik-recovery-memory');
});
test('email is required and a new password cannot be set before successful OTP verification',async()=>{
 const {api,fields,calls}=app();api.start();fields.recovery_email.value='bad';await api.send();assert.equal(calls.filter(c=>c[0]==='send').length,0);await api.save();assert.equal(calls.filter(c=>c[0]==='update').length,0);
 fields.recovery_email.value='Student@example.invalid';await api.send();assert.equal(api.phase,'code');assert.equal(api.email,'student@example.invalid');assert.equal(calls.find(c=>c[0]==='send')[2].redirectTo,'https://example.invalid/politeshik/?recovery=1');
 fields.recovery_code.value='123456';await api.verify();assert.equal(api.phase,'password');assert.equal(fields.recovery_code.value,'');assert.equal(calls.find(c=>c[0]==='verify')[1].type,'recovery');
 fields.recovery_password.value='Demo-only-password';fields.recovery_confirm.value='mismatch';await api.save();assert.equal(calls.filter(c=>c[0]==='update').length,0);
 fields.recovery_confirm.value=fields.recovery_password.value;await api.save();assert.equal(api.phase,'done');assert.equal(fields.recovery_password.value,'');assert.equal(api.verifiedUid,null);assert.equal(calls.filter(c=>c[0]==='update').length,1);
});
test('invalid or expired code does not authorize a password update',async()=>{
 const {api,fields,calls,client}=app();api.start('student@example.invalid');await api.send();client.auth.verifyOtp=async()=>({error:{code:'otp_expired'}});fields.recovery_code.value='000000';await api.verify();assert.equal(api.phase,'code');assert.equal(api.verifiedUid,null);await api.save();assert.equal(calls.filter(c=>c[0]==='update').length,0);
});
test('failed SMTP request does not claim that email was sent',async()=>{
 const {api,client}=app();api.start('student@example.invalid');client.auth.resetPasswordForEmail=async()=>({error:{code:'unexpected_failure',message:'SMTP unavailable'}});await api.send();assert.equal(api.phase,'email');assert.match(api.error,/Не удалось отправить/);
});
test('cancelled request cannot reopen recovery or sign out the main client',async()=>{
 const {api,client,calls}=app();api.start('student@example.invalid');let resolve;client.auth.resetPasswordForEmail=()=>new Promise(r=>resolve=r);const pending=api.send();await api.cancel();resolve({});await pending;assert.equal(api.active,false);assert.equal(api.phase,'email');assert.equal(calls.filter(c=>c[0]==='signout').length,1);assert.equal(calls.find(c=>c[0]==='signout')[1].scope,'local');
});
