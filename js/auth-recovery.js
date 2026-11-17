'use strict';
// Recovery tokens, codes and new passwords never enter app storage or academic data.
const AuthRecovery={
 active:false,phase:'email',email:'',verifiedUid:null,client:null,busy:false,error:'',sentAt:0,epoch:0,timer:null,
 makeClient(){return window.supabase.createClient(SUPA_URL,SUPA_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'politeshik-recovery-memory'}});},
 start(email=''){
  if(AuthRecovery.active)return;
  AuthRecovery.epoch++;Object.assign(AuthRecovery,{active:true,phase:'email',email:String(email||'').trim(),verifiedUid:null,client:AuthRecovery.makeClient(),busy:false,error:'',sentAt:0});
  $('#gate').dataset.mode='';App.render(true);
 },
 async boot(){
  if(typeof AUTH_RECOVERY_LINK==='undefined'||!AUTH_RECOVERY_LINK)return;
  const hash=new URLSearchParams(location.hash.slice(1)),access=hash.get('access_token'),refresh=hash.get('refresh_token');
  const clean=new URL(location.href);clean.hash='';clean.searchParams.delete('recovery');history.replaceState(null,'',clean.pathname+clean.search);
  AuthRecovery.start();
  if(!access||!refresh){AuthRecovery.error='Ссылка устарела или уже использована. Запросите новый код.';AuthRecovery.sync();return;}
  const epoch=AuthRecovery.epoch,client=AuthRecovery.client;AuthRecovery.phase='link';App.render(true);
  try{
   const {error}=await client.auth.setSession({access_token:access,refresh_token:refresh});if(error)throw error;
   const verified=await client.auth.getUser();if(verified.error)throw verified.error;
   if(epoch!==AuthRecovery.epoch){await client.auth.signOut({scope:'local'});return;}
   if(!verified.data?.user?.id)throw Error('Ссылка недействительна');
   AuthRecovery.verifiedUid=verified.data.user.id;AuthRecovery.email=verified.data.user.email||'';AuthRecovery.phase='password';App.render(true);
  }catch(e){if(epoch===AuthRecovery.epoch){AuthRecovery.phase='email';AuthRecovery.error='Ссылка устарела или уже использована. Запросите новый код.';App.render(true);}}
 },
 render(g){
  document.body.classList.add('gated');$('#view').innerHTML='';$('#nav-side').innerHTML='';$('#nav-bottom').innerHTML='';g.hidden=false;
  if(g.dataset.mode==='recovery'&&g.dataset.recoveryPhase===AuthRecovery.phase){AuthRecovery.sync();return '';}
  g.dataset.mode='recovery';g.dataset.recoveryPhase=AuthRecovery.phase;
  const phase=AuthRecovery.phase,field=(name,title,type,auto)=>'<label class="field"><span>'+title+'</span><input class="input" name="'+name+'" type="'+type+'" autocomplete="'+auto+'" autocapitalize="none" spellcheck="false"'+(name==='recovery_code'?' inputmode="numeric" maxlength="10"':'')+'></label>';
  let content='';
  if(phase==='email')content='<p>Укажите почту, с которой зарегистрированы в «Политешике».</p>'+field('recovery_email','Почта для входа','email','email')+'<button class="btn primary big" data-action="recovery-send">Отправить код</button>';
  if(phase==='code')content='<p>Если учётка с почтой <b>'+U.esc(AuthRecovery.email)+'</b> существует, на неё отправлено письмо для восстановления. Введите код из письма. Если вместо кода есть ссылка — откройте её.</p>'+field('recovery_code','Код из письма','text','one-time-code')+'<button class="btn primary big" data-action="recovery-verify">Проверить код</button><button class="btn big" data-action="recovery-resend" style="margin-top:8px">Отправить код ещё раз</button>';
  if(phase==='password')content='<p>Почта подтверждена: <b>'+U.esc(AuthRecovery.email)+'</b>. Задайте новый пароль.</p>'+field('recovery_password','Новый пароль · от 8 символов','password','new-password')+field('recovery_confirm','Повторите пароль','password','new-password')+'<button class="btn primary big" data-action="recovery-save">Сохранить пароль</button>';
  if(phase==='done')content='<p>Пароль изменён. Войдите с почтой <b>'+U.esc(AuthRecovery.email)+'</b> и новым паролем. Ваш профиль и права сохранены.</p><button class="btn primary big" data-action="recovery-cancel">Перейти ко входу</button>';
  if(phase==='link')content='<p role="status">Проверяем ссылку восстановления…</p>';
  g.innerHTML='<div class="gate-card"><h1>Политешик</h1><h2>'+(phase==='done'?'Пароль изменён':'Восстановление пароля')+'</h2><div data-form="password-recovery">'+content+'<p class="warn" data-recovery-error role="alert" hidden></p>'+(phase!=='done'?'<button class="btn big" style="margin-top:12px" data-action="recovery-cancel">Вернуться ко входу</button>':'')+'</div></div>';
  if(phase==='email')g.querySelector('[name="recovery_email"]').value=AuthRecovery.email;
  AuthRecovery.sync();return '';
 },
 sync(){
  const box=document.querySelector('[data-form="password-recovery"]');if(!box)return;
  const message=box.querySelector('[data-recovery-error]');message.textContent=AuthRecovery.error;message.hidden=!AuthRecovery.error;
  box.querySelectorAll('button').forEach(b=>b.disabled=AuthRecovery.busy);
  const resend=box.querySelector('[data-action="recovery-resend"]');if(resend){const seconds=Math.max(0,60-Math.floor((Date.now()-AuthRecovery.sentAt)/1000));resend.disabled=AuthRecovery.busy||seconds>0;resend.textContent=seconds?'Повторно через '+seconds+' с':'Отправить код ещё раз';}
 },
 input(name){return document.querySelector('[data-form="password-recovery"] [name="'+name+'"]');},
 async send(){
  if(!AuthRecovery.active||AuthRecovery.busy||!['email','code'].includes(AuthRecovery.phase))return;
  if(AuthRecovery.phase==='code'&&Date.now()-AuthRecovery.sentAt<60000)return;
  const email=(AuthRecovery.input('recovery_email')?.value||AuthRecovery.email).trim().toLowerCase();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||email.length>254){AuthRecovery.error='Введите почту, с которой зарегистрированы';AuthRecovery.sync();return;}
  const epoch=AuthRecovery.epoch;AuthRecovery.busy=true;AuthRecovery.error='';AuthRecovery.sync();
  try{
   const url=new URL(location.href);url.hash='';url.search='?recovery=1';
   const {error}=await AuthRecovery.client.auth.resetPasswordForEmail(email,{redirectTo:url.href});
   if(epoch!==AuthRecovery.epoch)return;
   if(error)throw error;
   AuthRecovery.email=email;AuthRecovery.sentAt=Date.now();AuthRecovery.phase='code';clearInterval(AuthRecovery.timer);AuthRecovery.timer=setInterval(()=>AuthRecovery.sync(),1000);App.render(true);
  }catch(e){if(epoch===AuthRecovery.epoch)AuthRecovery.error=/rate_limit|too many|rate limit/i.test((e.code||'')+' '+e.message)?'Слишком много запросов. Подождите минуту и повторите.':'Не удалось отправить письмо. Проверьте связь; если ошибка повторяется, сообщите Админу Арине.';}
  finally{if(epoch===AuthRecovery.epoch){AuthRecovery.busy=false;AuthRecovery.sync();}}
 },
 async verify(){
  if(!AuthRecovery.active||AuthRecovery.busy||AuthRecovery.phase!=='code')return;
  const field=AuthRecovery.input('recovery_code'),token=field.value.trim();
  if(!/^\d{6,10}$/.test(token)){AuthRecovery.error='Введите код из письма целиком';AuthRecovery.sync();return;}
  const epoch=AuthRecovery.epoch,client=AuthRecovery.client;AuthRecovery.busy=true;AuthRecovery.error='';AuthRecovery.sync();
  try{
   const {data,error}=await client.auth.verifyOtp({email:AuthRecovery.email,token,type:'recovery'});field.value='';
   if(epoch!==AuthRecovery.epoch){if(data?.session)await client.auth.signOut({scope:'local'});return;}
   if(error||!data?.user?.id||!data?.session)throw error||Error('Invalid recovery session');
   AuthRecovery.verifiedUid=data.user.id;AuthRecovery.phase='password';clearInterval(AuthRecovery.timer);App.render(true);
  }catch(e){if(epoch===AuthRecovery.epoch)AuthRecovery.error='Код не подошёл или истёк. Проверьте письмо либо запросите новый код.';}
  finally{if(epoch===AuthRecovery.epoch){AuthRecovery.busy=false;AuthRecovery.sync();}}
 },
 async save(){
  if(!AuthRecovery.active||AuthRecovery.busy||AuthRecovery.phase!=='password'||!AuthRecovery.verifiedUid)return;
  const password=AuthRecovery.input('recovery_password'),confirm=AuthRecovery.input('recovery_confirm');
  if(password.value.length<8||password.value!==confirm.value){AuthRecovery.error=password.value.length<8?'Пароль должен быть не короче 8 символов':'Пароли не совпадают';AuthRecovery.sync();return;}
  const epoch=AuthRecovery.epoch,owner=AuthRecovery.verifiedUid,client=AuthRecovery.client;AuthRecovery.busy=true;AuthRecovery.error='';AuthRecovery.sync();
  try{
   const {data,error}=await client.auth.updateUser({password:password.value});if(error)throw error;
   if(epoch!==AuthRecovery.epoch)return;if(data?.user?.id!==owner)throw Error('Account mismatch');
   password.value='';confirm.value='';await client.auth.signOut({scope:'local'});
   if(epoch!==AuthRecovery.epoch)return;AuthRecovery.phase='done';AuthRecovery.verifiedUid=null;App.render(true);
  }catch(e){if(epoch===AuthRecovery.epoch)AuthRecovery.error=e.code==='same_password'?'Придумайте пароль, который отличается от прежнего.':'Не удалось сохранить пароль. Повторите попытку; при истечении сессии запросите новый код.';}
  finally{if(epoch===AuthRecovery.epoch){AuthRecovery.busy=false;AuthRecovery.sync();}}
 },
 async cancel(){
  const client=AuthRecovery.client;AuthRecovery.epoch++;clearInterval(AuthRecovery.timer);Object.assign(AuthRecovery,{active:false,phase:'email',verifiedUid:null,client:null,busy:false,error:''});
  ui.loginDraft=Object.assign({},ui.loginDraft,{email:AuthRecovery.email});$('#gate').dataset.mode='';App.render(true);
  if(client)try{await client.auth.signOut({scope:'local'});}catch(e){}
 }
};
A['password-forgot']=()=>AuthRecovery.start(document.querySelector('[data-form="login"] [name="email"]')?.value||'');
A['recovery-send']=()=>AuthRecovery.send();A['recovery-resend']=()=>AuthRecovery.send();A['recovery-verify']=()=>AuthRecovery.verify();A['recovery-save']=()=>AuthRecovery.save();A['recovery-cancel']=()=>AuthRecovery.cancel();
