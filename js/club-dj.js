'use strict';
const ClubDJ={
 owner:null,data:null,busy:false,pending:null,
 track(id){return CLUB_TRACKS.find(t=>t.id===Number(id));},
 reset(){ClubDJ.owner=Cloud.uid;ClubDJ.data=null;ClubDJ.busy=false;ClubDJ.pending=null;},
 apply(data){
  if(ClubDJ.owner!==Cloud.uid)ClubDJ.reset();
  ClubDJ.data=data&&ClubDJ.track(data.current?.track)?data:null;
  ClubDJ.sync();
  if(typeof ClubMusic!=='undefined')ClubMusic.follow();
 },
 current(){return Club.room==='main'&&ClubDJ.owner===Cloud.uid?ClubDJ.data?.current:null;},
 nowText(){const current=ClubDJ.current(),track=ClubDJ.track(current?.track);return track?'Сейчас: '+track.title+(current.requester?' · заказал(а) '+current.requester:' · выбор DJ'):'DJ Политешик · 20 треков';},
 marquee(){return '<div class="club-dj-now" data-dj-now aria-live="polite">'+U.esc(ClubDJ.nowText())+'</div>';},
 queueHtml(){const queue=ClubDJ.data?.queue||[];return '<h3>Очередь диджея · '+queue.length+'/10</h3>'+(queue.length?'<ol>'+queue.map(item=>'<li><b>'+U.esc(ClubDJ.track(item.track)?.title||'Трек')+'</b><span>'+U.esc(item.requester||'Политешик')+'</span></li>').join('')+'</ol>':'<p class="hint">Заказов пока нет. Диджей играет свою подборку.</p>');},
 sync(){
  document.querySelectorAll('[data-dj-now]').forEach(el=>{const text=ClubDJ.nowText();if(el.textContent!==text)el.textContent=text;});
  document.querySelectorAll('[data-dj-queue]').forEach(el=>{const html=ClubDJ.queueHtml();if(el.innerHTML!==html)el.innerHTML=html;});
  document.querySelectorAll('[data-action="club-track-order"]').forEach(el=>el.disabled=ClubDJ.busy);
 },
 menu(){
  if(!Club.joined||Club.room!=='main')return toast('Подойдите к диджею на танцполе');
  UI.open('DJ Политешик · заказать трек','<section class="club-dj-menu">'+ClubDJ.marquee()+'<p>20 авторских треков с пищалками, пружинками и странными басами. Заказ попадёт в общую очередь и заиграет после текущего трека. Один заказ от гостя за раз.</p><div class="dj-listen-controls">'+ClubMusic.html()+'</div><div class="dj-queue" data-dj-queue>'+ClubDJ.queueHtml()+'</div><div class="dj-track-list">'+CLUB_TRACKS.map(t=>'<button class="dj-track" data-action="club-track-order" data-track="'+t.id+'"'+(ClubDJ.busy?' disabled':'')+'><span class="dj-track-number">'+String(t.id).padStart(2,'0')+'</span><span><b>'+U.esc(t.title)+'</b><small>'+U.esc(t.description)+'</small></span><span class="dj-track-add" aria-hidden="true">＋</span></button>').join('')+'</div></section>',{wide:true,noFocus:true});
 },
 walk(){if(Club.room!=='main')return toast('Диджей находится на танцполе');return Club.walkTo({x:35,y:23},()=>ClubDJ.menu());},
 async request(id){
  if(ClubDJ.owner!==Cloud.uid)ClubDJ.reset();
  const track=ClubDJ.track(id);if(!track||ClubDJ.busy||Club.room!=='main'||!Club.joined)return;
  const owner=Cloud.uid,roomVersion=Club.roomVersion;ClubDJ.busy=true;
  if(ClubDJ.pending?.track!==track.id)ClubDJ.pending={track:track.id,nonce:crypto.randomUUID()};
  ClubDJ.sync();
  try{
   const data=await Social.call('club_request_track',{p_track:track.id,p_nonce:ClubDJ.pending.nonce});
   if(owner!==Cloud.uid||roomVersion!==Club.roomVersion||Club.room!=='main')return;
   ClubDJ.pending=null;Club.apply(data);toast('Диджей принял заказ: '+track.title+' 🎧');
  }catch(e){if(owner===Cloud.uid)toast(e.message);}
  finally{if(owner===Cloud.uid){ClubDJ.busy=false;ClubDJ.sync();}}
 }
};
const djClubApply=Club.apply;
Club.apply=data=>{djClubApply(data);ClubDJ.apply(data.dj);};
const djSocialReset=Social.reset;
Social.reset=()=>{const changed=Social.owner!==Cloud.uid;djSocialReset();if(changed)ClubDJ.reset();};
A['club-dj-join']=()=>ClubDJ.walk();
A['club-track-order']=el=>ClubDJ.request(el.dataset.track);
