'use strict';
const AccountPassword={
 busy:false,
 card(){return Cloud.uid?'<section class="card set-sec"><h2>Вход в аккаунт</h2><div class="set-row"><div><b>Пароль аккаунта</b><p>Задайте новый пароль для входа на других устройствах. Ваш профиль и права сохранятся.</p></div><button class="btn" data-action="account-password-open">Сменить пароль</button></div></section>':'';},
 async open(){
  if(!supa||!Cloud.uid||AccountPassword.busy)return;
  const owner=Cloud.uid;
  try{
   const {data,error}=await supa.auth.getUser();if(error)throw error;
   if(owner!==Cloud.uid)return;if(data?.user?.id!==owner)throw Error('Войдите в свой аккаунт ещё раз');
   UI.open('Сменить пароль','<div data-form="account-password" data-owner="'+U.esc(owner)+'"><p>Почта для входа: <b>'+U.esc(data.user.email||'')+'</b></p><label class="field"><span>Новый пароль · от 8 символов</span><input class="input" name="new_password" type="password" minlength="8" autocomplete="new-password" autocapitalize="none" spellcheck="false"></label><label class="field"><span>Повторите новый пароль</span><input class="input" name="confirm_password" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false"></label><label class="field" data-password-code hidden><span>Код подтверждения из письма</span><input class="input" name="password_nonce" autocomplete="one-time-code" inputmode="numeric"></label><p class="hint" data-password-status role="status">Это пароль для входа по почте. Дополнительный пароль сотрудника остаётся прежним.</p><div class="head-actions"><button class="btn" data-action="modal-close">Отмена</button><button class="btn primary" data-action="account-password-save">Сохранить новый пароль</button></div></div>');
  }catch(e){if(owner===Cloud.uid)toast(friendlyAuthError(e));}
 },
 async save(el){
  const form=el.closest('[data-form="account-password"]');if(!form||AccountPassword.busy||form.dataset.owner!==Cloud.uid)return;
  const password=form.querySelector('[name="new_password"]'),confirm=form.querySelector('[name="confirm_password"]'),nonce=form.querySelector('[name="password_nonce"]'),status=form.querySelector('[data-password-status]');
  if(password.value.length<8)return toast('Придумайте пароль не короче 8 символов');
  if(password.value!==confirm.value)return toast('Пароли не совпадают');
  const owner=Cloud.uid;AccountPassword.busy=true;el.disabled=true;
  try{
   const attributes={password:password.value};if(nonce.value.trim())attributes.nonce=nonce.value.trim();
   const {data,error}=await supa.auth.updateUser(attributes);
   if(owner!==Cloud.uid)return;
   if(error){
    if(error.code==='reauthentication_needed'){
     const result=await supa.auth.reauthenticate();if(result.error)throw result.error;
     if(owner!==Cloud.uid||!form.isConnected)return;
     form.querySelector('[data-password-code]').hidden=false;status.textContent='На вашу почту отправлен код подтверждения. Введите его и снова нажмите «Сохранить новый пароль».';nonce.focus();return;
    }
    throw error;
   }
   if(data?.user?.id!==owner)throw Error('Не удалось подтвердить смену пароля. Попробуйте ещё раз');
   password.value='';confirm.value='';nonce.value='';
   if(form.isConnected)UI.open('Пароль изменён','<p>На телефоне откройте «Политешик» и войдите с почтой <b>'+U.esc(data.user.email||'')+'</b> и новым паролем.</p><p>Ваш профиль, права и данные сохранены.</p><button class="btn primary" data-action="modal-close">Понятно</button>');
   else toast('Пароль аккаунта изменён');
  }catch(e){if(owner===Cloud.uid&&form.isConnected)status.textContent=friendlyAuthError(e);}
  finally{AccountPassword.busy=false;if(el.isConnected)el.disabled=false;}
 }
};
A['account-password-open']=()=>AccountPassword.open();
A['account-password-save']=el=>AccountPassword.save(el);
