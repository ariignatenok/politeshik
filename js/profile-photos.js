'use strict';
const ProfilePhotos={
 busy:false,urls:new Map(),
 async upload(file){
  if(ProfilePhotos.busy)return;const owner=Cloud.uid;if(!owner||Cloud.status!=='online')throw Error('Войдите в аккаунт');
  if(file.size>25*1024*1024)throw Error('Выберите фото до 25 МБ');ProfilePhotos.busy=true;
  let prepared,published=false;
  try{
   const [thumbnail,large]=await Promise.all([compressAvatar(file),ProfilePhotos.compress(file)]);
   const blob=await(await fetch(large)).blob();prepared=await Social.call('profile_photo_prepare',{p_bytes:blob.size});
   if(owner!==Cloud.uid)throw Error('Аккаунт изменился');
   const {error}=await supa.storage.from('profile-portraits').upload(prepared.path,blob,{contentType:'image/jpeg',upsert:false});if(error)throw Error(error.message);
   if(owner!==Cloud.uid)throw Error('Аккаунт изменился');
   await Social.call('profile_photo_publish',{p_id:prepared.id,p_thumbnail:thumbnail});published=true;
   if(owner!==Cloud.uid)return;
   Profile.avatarEdited();Store.s.settings.avatar={k:'p',d:thumbnail};Avatars.map[owner]=thumbnail;Store.s.meta.avatarPending=false;Store.save();Profile.push();ProfilePhotos.urls.clear();
   UI.close();App.render();toast('Фото обновлено в высоком качестве');
  }finally{ProfilePhotos.busy=false;if(prepared&&!published&&owner===Cloud.uid)supa.storage.from('profile-portraits').remove([prepared.path]).catch(()=>{});}
 },
 async compress(file){
  const url=URL.createObjectURL(file);try{
   const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Не удалось прочитать фото'));i.src=url;});
   let side=1800,quality=.92;
   for(let i=0;i<6;i++){
    const scale=Math.min(1,side/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',quality);if(data.length*.75<=2800000)return data;quality-=.06;side=Math.round(side*.9);
   }throw Error('Не удалось подготовить фотографию');
  }finally{URL.revokeObjectURL(url);}
 },
 async url(uid,fallback=''){
  const owner=Cloud.uid,key=owner+':'+uid,cached=ProfilePhotos.urls.get(key);if(cached?.until>Date.now()&&cached.thumbnail===fallback)return cached.url;
  const item=await Social.call('profile_photo',{p_uid:uid});if(owner!==Cloud.uid)throw Error('Аккаунт изменился');if(!item)return fallback;
  const {data,error}=await supa.storage.from('profile-portraits').createSignedUrl(item.path,300);if(error)throw Error(error.message);if(owner!==Cloud.uid)throw Error('Аккаунт изменился');
  if(ProfilePhotos.urls.size>80)ProfilePhotos.urls.clear();ProfilePhotos.urls.set(key,{url:data.signedUrl,thumbnail:fallback,until:Date.now()+240000});return data.signedUrl;
 },
 async view(uid,fallback){
  UI.open('Фото профиля','<div class="img-box">Загружаем фото…</div>',{wide:true,noFocus:true});const box=document.querySelector('#modal-root .img-box'),owner=Cloud.uid;
  try{const url=await ProfilePhotos.url(uid,fallback);if(owner!==Cloud.uid||!box?.isConnected)return;box.innerHTML=/^(data:image\/(jpeg|png|webp);base64,|https:\/\/)/.test(url)?'<img class="portrait-full" src="'+U.esc(url)+'" alt="Фото профиля">':'Фото пока не загружено';}
  catch(e){if(box?.isConnected)box.textContent=e.message;}
 }
};
const FacultyProfiles={
 owner:null,rows:[],at:0,loading:false,error:'',
 load(force=false){
  if(Cloud.uid!==FacultyProfiles.owner){Object.assign(FacultyProfiles,{owner:Cloud.uid,rows:[],at:0,loading:false,flight:null,error:''});}
  if(FacultyProfiles.loading)return FacultyProfiles.flight;
  if(Cloud.status!=='online'||!Cloud.hasCabinet()||!force&&Date.now()-FacultyProfiles.at<60000)return Promise.resolve();
  FacultyProfiles.loading=true;FacultyProfiles.at=Date.now();const owner=Cloud.uid;
  FacultyProfiles.flight=(async()=>{
   try{const rows=await Social.call('faculty_public_profiles');if(owner!==Cloud.uid)return;FacultyProfiles.rows=rows||[];FacultyProfiles.error='';if(ui.tab==='teachers')App.renderSoft();}
   catch(e){if(owner===Cloud.uid)FacultyProfiles.error=e.message;}
   finally{if(owner===Cloud.uid){FacultyProfiles.loading=false;FacultyProfiles.flight=null;}}
  })();return FacultyProfiles.flight;
 },
 find(name){return FacultyProfiles.owner===Cloud.uid?FacultyProfiles.rows.find(r=>Faculty.key(r.name)===Faculty.key(name)):null;},
 async open(uid){
  await FacultyProfiles.load();const card=FacultyProfiles.rows.find(r=>r.uid===uid);if(!card)return toast('Преподаватель ещё не зарегистрирован или заявка не подтверждена');
  UI.open(card.name,'<section class="faculty-public-profile"><p class="hint">'+U.esc(Roles.names[card.role])+' · Зарегистрирован</p><div data-photo-owner="'+U.esc(uid)+'">'+avatarOf(card.avatar,128)+'</div><button class="btn" data-action="faculty-photo" data-uid="'+U.esc(uid)+'">Открыть фото</button><h3>Политешик преподавателя</h3>'+Mascot.svg('happy',150,'',{look:Wardrobe.normalize(card.mascot),season:''})+'<p>'+U.esc(Wardrobe.normalize(card.mascot).nickname||'Политешик')+'</p></section>',{wide:true});
 }
};
A['faculty-profile']=el=>FacultyProfiles.open(el.dataset.uid);
A['faculty-photo']=el=>{const card=FacultyProfiles.rows.find(r=>r.uid===el.dataset.uid);if(card)ProfilePhotos.view(card.uid,card.avatar);};
