'use strict';
// Reactions use the same approved public profiles as People, never Auth contacts.
const PhotoReactions={
 token:0,owner:null,target:null,kind:null,rows:[],more:false,loading:false,error:'',
 active(token){return token===PhotoReactions.token&&PhotoReactions.owner===Cloud.uid&&!!document.querySelector('#like-people');},
 async open(uid,kind){
  if(!Social.allowed())return;
  const token=++PhotoReactions.token;Object.assign(PhotoReactions,{owner:Cloud.uid,target:uid,kind,rows:[],more:false,loading:false,error:''});
  UI.open(kind==='mascot'?'Кому понравился маскот':'Кому понравилось фото','<section id="like-people"><div role="status">Загружаем…</div></section>');
  await PhotoReactions.load(false,token);
 },
 async load(append=false,token=PhotoReactions.token){
  if(!PhotoReactions.active(token)||PhotoReactions.loading)return;PhotoReactions.loading=true;
  try{const rows=await Social.call('profile_like_people',{p_uid:PhotoReactions.target,p_kind:PhotoReactions.kind,p_after:append?PhotoReactions.rows.at(-1)?.uid:null});if(!PhotoReactions.active(token))return;
   PhotoReactions.more=rows.length>50;PhotoReactions.rows=append?PhotoReactions.rows.concat(rows.slice(0,50)):rows.slice(0,50);PhotoReactions.error='';
  }catch(e){if(PhotoReactions.active(token))PhotoReactions.error=e.message;}
  finally{if(PhotoReactions.active(token)){PhotoReactions.loading=false;PhotoReactions.render();}}
 },
 render(){const box=document.querySelector('#like-people');if(!box)return;
  box.innerHTML=PhotoReactions.rows.map(person=>'<button class="reaction-person" data-action="social-profile" data-uid="'+U.esc(person.uid)+'">'+Social.avatar(person,40)+'<span><b>'+U.esc(person.name)+'</b><small>'+U.esc(person.group_name)+'</small></span></button>').join('')+
   (PhotoReactions.error?'<p class="warn">'+U.esc(PhotoReactions.error)+'</p><button class="btn" data-action="like-people-refresh">Повторить</button>':!PhotoReactions.rows.length?'<p class="hint">Пока никто не поставил лайк. Будьте первыми 💛</p>':'')+
   (PhotoReactions.more?'<button class="btn" data-action="like-people-more">Показать ещё</button>':'');
 }
};
const PhotoComments={
 token:0,owner:null,kind:null,target:null,rows:[],cursor:null,more:false,loading:false,sending:false,pending:null,error:'',
 active(token){return token===PhotoComments.token&&PhotoComments.owner===Cloud.uid&&!!document.querySelector('#photo-discussion');},
 async open(kind,id){
  if(!Social.allowed())return;
  const token=++PhotoComments.token;Object.assign(PhotoComments,{owner:Cloud.uid,kind,target:id,rows:[],cursor:null,more:false,loading:false,sending:false,pending:null,error:''});
  UI.open('Фотография и комментарии','<section id="photo-discussion"><div class="img-box" role="status">Загружаем фото…</div><h3>Комментарии</h3><div class="photo-comment-list" aria-live="polite"></div><div class="photo-comment-status" role="status"></div><div class="head-actions"><button class="btn sm" data-action="photo-comments-refresh">Обновить</button><button class="btn sm" data-action="photo-comments-more" hidden>Ещё комментарии</button></div><div data-form="photo-comment" class="photo-comment-form"><label class="field">Ваш комментарий<textarea class="input" name="body" rows="2" maxlength="2000" placeholder="Напишите что-нибудь приятное…"></textarea></label><button class="btn primary" data-action="save-form">Отправить</button></div></section>',{wide:true,noFocus:true});
  try{
   let html;
   if(kind==='profile'){
    const card=await Social.call('social_profile',{p_uid:id});if(!PhotoComments.active(token))return;
    if(!card?.avatar)throw Error('Фото профиля пока нет');Social.keep(card);
    const url=await ProfilePhotos.url(id,card.avatar);if(!PhotoComments.active(token))return;
    html=/^(data:image\/|https:\/\/)/.test(url)?'<img class="portrait-full" src="'+U.esc(url)+'" alt="Фото профиля">':avatarOf(card.avatar,320);
   }else{
    const url=await Wall.imageUrl(id.path);if(!PhotoComments.active(token))return;
    html='<img class="wall-photo-full" alt="Фотография со страницы" src="'+U.esc(url)+'">';PhotoComments.target=id.id;
   }
   if(!PhotoComments.active(token))return;document.querySelector('#photo-discussion .img-box').innerHTML=html;
   await PhotoComments.load(false,token);
  }catch(e){if(PhotoComments.active(token)){PhotoComments.error=e.message;PhotoComments.render();}}
 },
 async load(append=false,token=PhotoComments.token){
  if(!PhotoComments.active(token)||PhotoComments.loading)return;PhotoComments.loading=true;
  const last=append?PhotoComments.cursor:null;
  try{const rows=await Social.call('photo_comment_list',{p_kind:PhotoComments.kind,p_id:PhotoComments.target,p_after:last?.created_at||null,p_after_id:last?.id||null});if(!PhotoComments.active(token))return;
   PhotoComments.more=rows.length>50;PhotoComments.cursor=rows.slice(0,50).at(-1)||PhotoComments.cursor;PhotoComments.rows=append?PhotoComments.rows.concat(rows.slice(0,50).filter(c=>!PhotoComments.rows.some(p=>p.id===c.id))):rows.slice(0,50);PhotoComments.rows.sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));PhotoComments.error='';
  }catch(e){if(PhotoComments.active(token))PhotoComments.error=e.message;}
  finally{if(PhotoComments.active(token)){PhotoComments.loading=false;PhotoComments.render();}}
 },
 render(){const box=document.querySelector('#photo-discussion');if(!box)return;
  box.querySelector('.photo-comment-list').innerHTML=PhotoComments.rows.map(c=>'<article class="photo-comment"><button class="reaction-person" data-action="social-profile" data-uid="'+U.esc(c.person.uid)+'">'+Social.avatar(c.person,32)+'<span><b>'+U.esc(c.person.name)+'</b><small>'+U.esc(new Date(c.created_at).toLocaleString('ru-RU'))+'</small></span></button><p>'+U.esc(c.body)+'</p>'+(c.can_delete?'<button class="btn sm ghost" data-action="photo-comment-delete" data-id="'+U.esc(c.id)+'">Удалить</button>':'')+'</article>').join('')||'<p class="hint">Комментариев пока нет. Напишите первый 💬</p>';
  box.querySelector('.photo-comment-status').textContent=PhotoComments.error;
  box.querySelector('[data-action="photo-comments-more"]').hidden=!PhotoComments.more;
 },
 async send(form){
  const token=PhotoComments.token,raw=val(form,'body'),body=raw.trim();if(!PhotoComments.active(token)||PhotoComments.sending)return;
  if(!body||body.length>2000)return toast('Комментарий: от 1 до 2000 символов');PhotoComments.sending=true;
  if(PhotoComments.pending?.body!==body)PhotoComments.pending={body,nonce:crypto.randomUUID()};
  const button=form.querySelector('[data-action="save-form"]');button.disabled=true;
  try{const item=await Social.call('photo_comment_send',{p_kind:PhotoComments.kind,p_id:PhotoComments.target,p_body:body,p_nonce:PhotoComments.pending.nonce});if(!PhotoComments.active(token))return;
   PhotoComments.pending=null;if(val(form,'body')===raw)form.querySelector('textarea').value='';
   if(!PhotoComments.rows.some(c=>c.id===item.id))PhotoComments.rows.push(item);
   PhotoComments.rows.sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));PhotoComments.error='';PhotoComments.render();const list=document.querySelector('#photo-discussion .photo-comment-list');if(list)list.scrollTop=list.scrollHeight;
  }catch(e){if(PhotoComments.active(token)){PhotoComments.error=e.message;PhotoComments.render();}}
  finally{if(PhotoComments.active(token))PhotoComments.sending=false;button.disabled=false;}
 },
 async remove(id){
  const token=PhotoComments.token;if(!PhotoComments.active(token)||!await UI.confirm('Удалить комментарий?','Удалить'))return;
  if(!PhotoComments.active(token))return;
  try{await Social.call('photo_comment_delete',{p_id:id});if(!PhotoComments.active(token))return;PhotoComments.rows=PhotoComments.rows.filter(c=>c.id!==id);PhotoComments.render();}
  catch(e){if(PhotoComments.active(token))toast(e.message);}
 }
};
Object.assign(A,{
 'like-people':el=>PhotoReactions.open(el.dataset.uid,el.dataset.kind),
 'like-people-more':()=>PhotoReactions.load(true),
 'like-people-refresh':()=>PhotoReactions.load(),
 'photo-comments':el=>PhotoComments.open('profile',el.dataset.uid),
 'photo-comments-more':()=>PhotoComments.load(true),
 'photo-comments-refresh':()=>PhotoComments.load(),
 'photo-comment-delete':el=>PhotoComments.remove(el.dataset.id)
});
Forms['photo-comment']=form=>PhotoComments.send(form);
