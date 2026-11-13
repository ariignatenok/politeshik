'use strict';
const StaffProfile={
 allowed(){return Cloud.status==='online'&&Cloud.member?.status==='approved'&&['teacher','curator'].includes(Cloud.role);},
 view(){if(!StaffProfile.allowed())return '<section class="card">Личный кабинет доступен после подтверждения регистрации.</section>';
  return '<div class="page-head"><div><h1>Личный кабинет</h1><p>'+U.esc(Cloud.profile?.name||Cloud.me?.name||'')+' · '+U.esc(Roles.names[Cloud.role])+'</p></div></div><section class="card about-card"><h2>Фото профиля</h2><div class="about-top">'+avatarOf(myAvatar()||Avatars.value(Cloud.uid),100)+'<div><p>Фото и маскот будут видны участникам ваших чатов.</p><button class="btn" data-action="avatar-open">Изменить фото</button></div></div></section>'+Mascot.cardHtml();
 }
};
