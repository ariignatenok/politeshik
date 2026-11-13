'use strict';
Object.assign(Club,{
 room:'main',gate:null,giftsSeen:new Set(),
 roomNames:{main:'Танцпол',cinema:'Кино и диваны',games:'Красная игровая'},
 async enterRoom(room){
  if(!Club.joined)return toast('Сначала зайдите в клуб');if(Club.walking||Club.moving||Club.saving)return;
  const owner=Cloud.uid,version=(Club.roomVersion||0)+1;Club.roomVersion=version;
  try{const data=await Social.call('club_enter_room',{p_room:room});if(owner!==Cloud.uid||version!==Club.roomVersion)return;
   ClubMusic.stop();ClubGames.close();UI.close();Club.apply(data);App.render(true);if(room==='games')ClubGames.loadLobby(true);
  }catch(e){UI.open('Фейсконтроль',Club.bouncerHtml()+'<p class="warn">'+U.esc(e.message)+'</p><p>Отмечайтесь на занятиях. Статус обновляется автоматически после сохранения отметок.</p>');}
 },
 bouncerHtml(){return '<div class="club-bouncer">'+Mascot.svg('angry',110,'',{look:{body:'dark',top:'blacktee',outfit:'leather',glasses:'sun',hat:'blackcap'},season:''})+'<div><b>Фейс Политешика</b><p>Обе комнаты — с посещаемостью от 75% за текущий месяц.</p><small>Ваша посещаемость: '+(Club.gate?.percent==null?'пока нет отметок':U.esc(Club.gate.percent)+'%')+'</small></div></div>';},
 tablesHtml(){return [
  [18,49,'Столик 1'],[82,53,'Столик 2'],[22,80,'Столик 3']
 ].map(([x,y,name],i)=>'<button class="club-table table-'+i+'" style="left:'+x+'%;top:'+y+'%" data-action="club-seat" data-x="'+x+'" data-y="'+(y+10)+'" aria-label="Подойти: '+name+'"><i>🕯</i><small>'+name+'</small></button>').join('');},
 guestMenu(uid){const card=Club.visitors.find(v=>v.uid===uid);if(!card)return;
  const nick=Wardrobe.normalize(card.mascot).nickname||'Политешик';
  UI.open(nick,'<div class="club-guest-menu">'+Club.mascot(card,120)+'<button class="btn" data-action="social-profile" data-uid="'+uid+'">Открыть профиль</button><button class="btn primary" data-action="club-give" data-uid="'+uid+'"'+(Club.drink==='none'||card.drink!=='none'?' disabled':'')+'>Передать свой напиток</button><p class="hint">Напиток перейдёт из вашей лапки в лапку гостя. Если у него уже есть напиток, сначала нужно освободить лапки.</p></div>',{wide:true});
 },
 async give(uid){
  if(Club.giving)return;Club.giving=true;const owner=Cloud.uid;
  if(Club.giftPending?.uid!==uid||Club.giftPending?.drink!==Club.drink)Club.giftPending={uid,drink:Club.drink,nonce:crypto.randomUUID()};
  try{const data=await Social.call('club_give_drink',{p_peer:uid,p_nonce:Club.giftPending.nonce});if(owner!==Cloud.uid)return;Club.giftPending=null;Club.apply(data);UI.close();App.render();toast('Напиток передан 🧃');}
  catch(e){if(owner===Cloud.uid)toast(e.message);}finally{Club.giving=false;}
 },
 movieHtml(){return '<div class="club-cinema"><div class="cinema-screen" role="img" aria-label="Мультфильм: Политешики в колледже">'+[ClubMovie.frames[ClubMovie.index()]].map((f)=>{const i=ClubMovie.index();return '<section class="cinema-frame frame-'+i+'" style="--scene:'+i+'"><h2>'+f[0]+'</h2><div class="cinema-set scene-'+i+'">'+f[1]+'</div><p>'+f[2]+'</p></section>';}).join('')+'</div><div class="cinema-sofas"><button data-action="club-seat" data-x="25" data-y="70">🛋️ <span>На диван</span></button><button data-action="club-seat" data-x="75" data-y="70">🛋️ <span>Рядом с друзьями</span></button></div><small>«Один день Политешиков» · мультфильм повторяется для всех гостей</small></div>';}
});
const ClubMovie={
 offset:0,lastScene:-1,index(){return Math.floor((Date.now()+ClubMovie.offset)/8000)%7;},
 pet(look={}){return Mascot.svg('cheer',82,'',{look,season:''});},
 get frames(){if(ClubMovie.cached)return ClubMovie.cached;const a=ClubMovie.pet({body:'pink',hair:'twotails',bag:'monogram'}),b=ClubMovie.pet({body:'blue',top:'polo'});return ClubMovie.cached=[
 ['Утро в колледже','<div class="movie-college">ПОЛИТЕХ<br>🏫</div><div class="movie-walk">'+a+b+'</div>','Новый день, новые пары и встреча с друзьями.'],
 ['На паре','<div class="movie-blackboard">SELECT знания FROM учёба;<br>📚 × 💡 = ✨</div><div class="movie-students">'+a+b+'</div>','Конспекты, базы данных и попытка всё запомнить.'],
 ['Перемена','<div class="movie-wc">WC <span class="movie-censor">▧ ЦЕНЗУРА ▧<br>ПИК-ПИК!</span></div><div class="movie-students">'+a+b+'</div>','Что случилось за этой дверью — осталось за кадром.'],
 ['Осторожно, лестница!','<div class="movie-stairs">▁▂▃▄▅</div><div class="movie-roll">'+b+'</div><b class="movie-bam">БДЫЩ! ✨</b>','Мягкая мультяшная посадка. Друг уже бежит помочь.'],
 ['Практика','<div class="movie-workbench">🔌 ▰ ▰</div><div class="movie-zap">'+a+'</div><b class="movie-bam">БЗЗ! ⚡</b><div class="movie-help">'+b+'</div>','Искры нарисованные, а следующую попытку доверили преподавателю.'],
 ['Дискотека до ночи','<div class="movie-mirrorball">🪩</div><div class="movie-dance">'+a+b+'</div>','Зачёт сдан — пора на танцпол!'],
 ['А завтра снова пары','<div class="movie-books">📚 🌙 📖</div><div class="movie-students">'+a+b+'</div>','Немного повторить предметы, выспаться — и снова в колледж.']
 ];}
};
const originalClubApply=Club.apply;
Club.apply=data=>{
 if(data.server_time)ClubMovie.offset=Date.parse(data.server_time)-Date.now();
 const stamp=JSON.stringify([data.visitors,data.joined,data.room,data.gate]);Club.renderChanged=stamp!==Club.viewState;Club.viewState=stamp;
 const oldRoom=Club.room;originalClubApply(data);Club.room=data.room||'main';Club.gate=data.gate||null;
 if(oldRoom!==Club.room){ClubMusic.stop();ClubGames.close();if(document.querySelector('.club-game-panel,#club-game-lobby'))UI.close();}
 for(const gift of data.gifts||[]){if(!Club.giftsSeen.has(gift.id)){Club.giftsSeen.add(gift.id);toast((gift.sender||'Гость')+' передал вам '+(Club.drinks.find(d=>d[0]===gift.drink)?.[1]||'напиток')+' 💛');}}
};
const originalSocialReset=Social.reset;
Social.reset=()=>{const changed=Social.owner!==Cloud.uid;originalSocialReset();if(changed){Club.room='main';Club.gate=null;Club.viewState=null;Club.renderChanged=true;Club.giftsSeen=new Set();Club.giftPending=null;ClubGames.reset();}};
const originalClubTap=Club.tap;
Club.tap=uid=>{if(uid!==Cloud.uid&&Date.now()>=(Club.ignoreTapUntil||0))return Club.guestMenu(uid);return originalClubTap(uid);};
Object.assign(A,{
 'club-room':el=>Club.enterRoom(el.dataset.room),
 'club-destinations':()=>{const places=Club.room==='main'?[[35,23,'К диджею'],[18,59,'Столик 1'],[82,63,'Столик 2'],[22,90,'Столик 3']]:Club.room==='cinema'?[[25,70,'Левый диван'],[75,70,'Правый диван']]:[[30,43,'К столу покера'],[70,43,'К бильярду']];UI.open('Куда подойти','<div class="my-chips">'+places.map(([x,y,label])=>'<button class="btn" data-action="'+(label==='К диджею'?'club-dj-join':'club-seat')+'" data-x="'+x+'" data-y="'+y+'">'+label+'</button>').join('')+'</div>');},
 'club-seat':el=>Club.walkTo({x:Number(el.dataset.x),y:Number(el.dataset.y)}),
 'club-give':el=>Club.give(el.dataset.uid),
 'club-dj-join':()=>Club.walkTo({x:35,y:23})
});

setInterval(()=>{if(!document.hidden&&ui.tab==='club'&&Club.room==='cinema'&&ClubMovie.lastScene!==ClubMovie.index()){ClubMovie.lastScene=ClubMovie.index();App.renderSoft();}},1000);
