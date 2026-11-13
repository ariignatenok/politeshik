'use strict';
const ClubGames={
 filter:null,owner:null,lobby:null,at:0,loading:false,id:null,data:null,busy:false,error:'',pending:null,selected:new Set(),angle:0,power:75,
 reset(){Object.assign(ClubGames,{owner:Cloud.uid,lobby:null,at:0,loading:false,id:null,data:null,busy:false,error:'',pending:null,selected:new Set(),angle:0,power:75});},
 close(){ClubGames.id=null;ClubGames.data=null;ClubGames.pending=null;ClubGames.selected.clear();},
 allowed(){return Social.allowed()&&Club.joined&&Club.room==='games';},
 async call(action,{game=null,id=ClubGames.id,payload={},nonce=null}={}){return Social.call('club_game',{p_action:action,p_game:game,p_id:id,p_payload:payload,p_nonce:nonce});},
 async loadLobby(force=false){
  if(ClubGames.owner!==Cloud.uid)ClubGames.reset();if(!ClubGames.allowed()||ClubGames.loading||!force&&Date.now()-ClubGames.at<15000)return;
  ClubGames.loading=true;ClubGames.at=Date.now();const owner=Cloud.uid;
  try{const data=await ClubGames.call('lobby');if(owner!==Cloud.uid)return;ClubGames.lobby=data;ClubGames.error='';if(ui.tab==='club')App.renderSoft();}
  catch(e){if(owner===Cloud.uid)ClubGames.error=e.message;}
  finally{if(owner===Cloud.uid)ClubGames.loading=false;}
 },
 roomHtml(){return '<div class="club-games-decor"><div class="games-neon">RED ROOM</div><button class="games-decor-table poker" data-action="club-games-open">♠ ♥<br><small>Пятикарточный покер</small></button><button class="games-decor-table pool" data-action="club-games-open">🎱<br><small>Бильярд на точность</small></button><button class="btn games-lobby-button" data-action="club-games-open">Играть · турнирные таблицы</button></div>';},
 openLobby(game=null){ClubGames.filter=['poker','pool'].includes(game)?game:null;if(!ClubGames.allowed())return toast('Сначала зайдите в игровую комнату');UI.open('Игры и турнирные таблицы','<div id="club-game-lobby">'+ClubGames.lobbyHtml()+'</div>',{wide:true,noFocus:true});ClubGames.loadLobby(true).then(()=>{const box=document.getElementById('club-game-lobby');if(box)box.innerHTML=ClubGames.lobbyHtml();});},
 lobbyHtml(){
  const lobby=ClubGames.lobby,filter=ClubGames.filter;
  return '<p>Играйте с гостями всех групп. Победа — 3 очка, ничья — 1. Турнирные таблицы начинаются с нуля первого числа каждого месяца.</p><div class="head-actions">'+['poker','pool'].filter(kind=>!filter||kind===filter).map(kind=>'<button class="btn primary" data-action="club-game-create" data-game="'+kind+'">Создать стол '+(kind==='poker'?'покера':'бильярда')+'</button>').join('')+' <button class="btn" data-action="club-games-refresh">Обновить</button></div>'+
  (ClubGames.error?'<p class="warn">'+U.esc(ClubGames.error)+'</p>':'')+'<h3>Столы</h3>'+
  (lobby?(lobby.matches||[]).filter(g=>!filter||g.game===filter).map(g=>'<div class="game-lobby-match"><div><b>'+U.esc(g.game==='poker'?'Покер':'Бильярд')+'</b><small>'+U.esc(g.host?.name||'Гость')+(g.guest?' и '+U.esc(g.guest.name):' · ждёт соперника')+'</small></div><button class="btn sm" data-action="club-game-open" data-id="'+g.id+'">'+(g.mine?'Моя партия':g.status==='waiting'?'Занять место':'Посмотреть')+'</button></div>').join('')||'<p class="hint">Пока нет столов. Создайте свой и позовите друга.</p>':'<p role="status">Загружаем столы…</p>')+
  '<div class="game-boards">'+['poker','pool'].map(kind=>'<section><h3>'+(kind==='poker'?'♠ Покер':'🎱 Бильярд')+'</h3><p class="hint">'+U.esc(lobby?.month||'Текущий месяц')+'</p>'+((lobby?.[kind]||[]).map(row=>'<button class="game-board-row" data-action="social-profile" data-uid="'+row.uid+'"><b>'+row.place+'</b>'+Social.avatar(row,28)+'<span>'+U.esc(row.name)+'<small>'+row.wins+' побед · '+row.games+' партий</small></span><b>'+row.points+' оч.</b></button>').join('')||'<p class="hint">Первые результаты появятся после завершённых партий.</p>')+'</section>').join('')+'</div>';
 },
 async create(game){
  if(ClubGames.busy)return;ClubGames.busy=true;const owner=Cloud.uid;
  if(ClubGames.pending?.action!=='create'||ClubGames.pending?.game!==game)ClubGames.pending={action:'create',game,nonce:crypto.randomUUID()};
  try{const data=await ClubGames.call('create',{game,id:null,nonce:ClubGames.pending.nonce});if(owner!==Cloud.uid)return;ClubGames.pending=null;ClubGames.openData(data);ClubGames.at=0;}
  catch(e){if(owner===Cloud.uid)toast(e.message);}finally{if(owner===Cloud.uid)ClubGames.busy=false;}
 },
 async open(id){
  const owner=Cloud.uid;try{const data=await ClubGames.call('state',{id});if(owner!==Cloud.uid)return;ClubGames.openData(data);}catch(e){toast(e.message);}
 },
 openData(data){
  if(ClubGames.id!==data.id){ClubGames.selected.clear();ClubGames.angle=0;ClubGames.power=75;}
  ClubGames.id=data.id;ClubGames.data=data;ClubGames.error='';
  UI.open(data.game==='poker'?'Пятикарточный покер':'Бильярд на точность','<div class="club-game-panel" data-game="'+data.game+'">'+ClubGames.html()+'</div>',{wide:true,noFocus:true});
 },
 async refresh(){
  if(!ClubGames.id||!ClubGames.allowed()||ClubGames.busy||!document.querySelector('.club-game-panel'))return;
  const owner=Cloud.uid,id=ClubGames.id;
  try{const data=await ClubGames.call('state');if(owner!==Cloud.uid||id!==ClubGames.id||!document.querySelector('.club-game-panel'))return;
   if(JSON.stringify(data)!==JSON.stringify(ClubGames.data)){ClubGames.data=data;ClubGames.render();}
  }catch(e){if(owner===Cloud.uid){ClubGames.error=e.message;ClubGames.render();}}
 },
 render(){const box=document.querySelector('.club-game-panel');if(box)box.innerHTML=ClubGames.html();},
 cardHtml(n,index,other=false){const rank=['2','3','4','5','6','7','8','9','10','В','Д','К','Т'][Math.floor(n/4)],suit=['♣','♦','♥','♠'][n%4];return '<button class="poker-card'+([1,2].includes(n%4)?' red':'')+(ClubGames.selected.has(index)&&!other?' selected':'')+'"'+(!other?' data-action="poker-select" data-index="'+index+'"':' disabled')+' aria-label="'+rank+' '+suit+'" aria-pressed="'+(!other&&ClubGames.selected.has(index))+'"><b>'+rank+'</b><span>'+suit+'</span></button>';},
 html(){
  const g=ClubGames.data;if(!g)return '<p>Загружаем игру…</p>';const own=g.mine,done=g.status==='finished',ready=own&&g[own+'_ready'];
  const character=person=>person?'<div class="game-character">'+Club.mascot({...person,pose:g.game,dance:'still',drink:'none'},78)+'<b>'+U.esc(person.name)+'</b></div>':'<div class="game-character empty-seat"><span>?</span><b>Ждём игрока</b></div>';
  const title='<div class="game-players with-mascots">'+character(g.host)+'<span>VS</span>'+character(g.guest)+'</div>';
  const end=done?'<div class="game-result"><b>'+(g.winner?(g.winner===Cloud.uid?'Вы победили! 🏆':'Победитель: '+U.esc(g.winner===g.host?.uid?g.host.name:g.guest?.name||'Соперник')):'Ничья 🤝')+'</b><p>Результат внесён в общую таблицу месяца.</p></div>':'';
  if(g.status==='waiting')return title+'<p>Стол создан. Второй игрок может занять место через «Игры и турнирные таблицы».</p><button class="btn primary" data-action="club-game-action" data-operation="'+(own?'cancel':'join')+'">'+(own?'Отменить стол':'Занять место')+'</button><button class="btn" data-action="club-games-open">← Все столы</button>';
  if(g.status==='cancelled')return title+'<p>Стол закрыт.</p><button class="btn" data-action="club-games-open">Все столы</button>';
  let body;
  if(g.game==='poker'){
   body='<p>Пять карт. Каждый игрок один раз меняет до трёх карт или оставляет все. После обмена раскрываются руки, сильнейшая комбинация побеждает.</p><h3>'+(!own?'Партия гостей':done?'Ваша рука':ready?'Вы готовы':'Ваши карты')+'</h3><div class="poker-hand">'+(g.hand||[]).map((n,i)=>ClubGames.cardHtml(n,i)).join('')+(!own?'<span class="poker-back">♠</span>'.repeat(5):'')+'</div>'+
   (own?'<p>'+U.esc(['Старшая карта','Пара','Две пары','Тройка','Стрит','Флеш','Фулл-хаус','Каре','Стрит-флеш'][g.combination]||'')+'</p>':'')+
   (done?'<h3>Рука соперника</h3><div class="poker-hand">'+(g.other_hand||[]).map((n,i)=>ClubGames.cardHtml(n,i,true)).join('')+'</div>':own&&!ready?'<button class="btn primary" data-action="club-game-action" data-operation="draw">'+(ClubGames.selected.size?'Заменить выбранные ('+ClubGames.selected.size+')':'Оставить все карты')+'</button>':'<p class="hint">Ожидаем ход соперника.</p>');
  }else body='<p>Забейте 5 шаров раньше соперника. Нажмите на стол, чтобы прицелиться; настройте силу удара. Забитый шар сохраняет ход. Биток в лузе — минус очко.</p><div class="pool-score">'+g.host_score+' : '+g.guest_score+'</div>'+ClubGames.poolHtml(g)+'<p>'+(!done?(g.turn===Cloud.uid?'Ваш ход':'Ход: '+U.esc(g.turn===g.host?.uid?g.host.name:g.guest?.name||'Соперник')):'Партия завершена')+'</p>'+
   (own&&!done&&g.turn===Cloud.uid?'<div class="pool-controls"><label>Угол <input type="range" min="0" max="360" step="1" value="'+ClubGames.angle+'" data-input="pool-angle"><b id="pool-angle-label">'+ClubGames.angle+'°</b></label><label>Сила <input type="range" min="10" max="100" step="1" value="'+ClubGames.power+'" data-input="pool-power"><b id="pool-power-label">'+ClubGames.power+'%</b></label><button class="btn primary" data-action="club-game-action" data-operation="shot">Ударить</button></div>':'')+
   (g.last_shot?'<p class="hint">'+(g.last_shot.potted?'Шар в лузе! 🎱':g.last_shot.scratch?'Биток упал в лузу':g.last_shot.hit?'Попадание по шару':'Промах')+'</p>':'');
  return title+end+body+(ClubGames.error?'<p class="warn">'+U.esc(ClubGames.error)+'</p>':'')+'<div class="head-actions">'+(own&&!done?'<button class="btn" data-action="club-game-action" data-operation="fold">Сдаться</button><button class="btn" data-action="club-game-action" data-operation="claim">Соперник ушёл / время вышло</button>':'')+'<button class="btn" data-action="club-games-open">Столы и таблицы</button></div><p class="hint">На ход — 2 минуты. После этого ожидающий игрок может завершить партию. Уход из комнаты также позволяет сопернику завершить игру.</p>';
 },
 poolHtml(g){const cue=g.cue||{x:.4,y:.5},object=g.object||{x:1.25,y:.35};return '<svg class="pool-playing-table" data-action="pool-aim" viewBox="0 0 1000 500" role="img" aria-label="Бильярдный стол: нажмите для прицеливания"><rect width="1000" height="500" rx="35" fill="#522528"/><rect x="24" y="24" width="952" height="452" rx="20" fill="#146552"/>'+[[28,28],[500,20],[972,28],[28,472],[500,480],[972,472]].map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="27" fill="#0c1114"/>').join('')+'<line id="pool-aim-line" x1="'+cue.x*500+'" y1="'+cue.y*500+'" x2="'+(cue.x*500+Math.cos(ClubGames.angle*Math.PI/180)*180)+'" y2="'+(cue.y*500+Math.sin(ClubGames.angle*Math.PI/180)*180)+'" stroke="#fff9" stroke-width="4" stroke-dasharray="12 9"/><circle class="pool-ball" cx="'+object.x*500+'" cy="'+object.y*500+'" r="18" fill="#e56d40" stroke="#fff" stroke-width="3"/><circle class="pool-ball" cx="'+cue.x*500+'" cy="'+cue.y*500+'" r="16" fill="#fff9e7"/></svg>';},
 select(index){const g=ClubGames.data;if(!g?.mine||g.status!=='active'||g[g.mine+'_ready'])return;
  if(ClubGames.selected.has(index))ClubGames.selected.delete(index);else{if(ClubGames.selected.size>=3)return toast('Можно заменить до трёх карт');ClubGames.selected.add(index);}ClubGames.render();
 },
 async action(action){
  if(ClubGames.busy||!ClubGames.id)return;const g=ClubGames.data,owner=Cloud.uid,id=g.id;
  if(action==='fold'&&!await UI.confirm('Завершить партию поражением?','Сдаться'))return;
  const payload=action==='draw'?{cards:[...ClubGames.selected].sort()}:action==='shot'?{angle:ClubGames.angle,power:ClubGames.power}:{};
  const key=JSON.stringify([id,action,payload]);if(ClubGames.pending?.key!==key)ClubGames.pending={key,nonce:crypto.randomUUID()};ClubGames.busy=true;
  document.querySelectorAll('.club-game-panel button').forEach(b=>b.disabled=true);
  try{const data=await ClubGames.call(action,{payload,nonce:ClubGames.pending.nonce});if(owner!==Cloud.uid||id!==ClubGames.id)return;ClubGames.pending=null;ClubGames.data=data;ClubGames.error='';ClubGames.render();ClubGames.at=0;}
  catch(e){if(owner===Cloud.uid&&id===ClubGames.id){ClubGames.error=e.message;ClubGames.render();}}
  finally{if(owner===Cloud.uid)ClubGames.busy=false;}
 },
 aim(value,kind){
  if(kind==='pool-angle')ClubGames.angle=Math.max(0,Math.min(360,Math.round(Number(value))));else ClubGames.power=Math.max(10,Math.min(100,Math.round(Number(value))));
  const g=ClubGames.data,cue=g?.cue;if(cue){const line=document.getElementById('pool-aim-line');if(line){line.setAttribute('x2',cue.x*500+Math.cos(ClubGames.angle*Math.PI/180)*180);line.setAttribute('y2',cue.y*500+Math.sin(ClubGames.angle*Math.PI/180)*180);}}
  const a=document.getElementById('pool-angle-label'),p=document.getElementById('pool-power-label');if(a)a.textContent=ClubGames.angle+'°';if(p)p.textContent=ClubGames.power+'%';
 }
};
Object.assign(A,{
 'club-games-open':el=>ClubGames.openLobby(el?.dataset.game||null),
 'club-games-refresh':()=>ClubGames.loadLobby(true).then(()=>{const box=document.getElementById('club-game-lobby');if(box)box.innerHTML=ClubGames.lobbyHtml();}),
 'club-game-create':el=>ClubGames.create(el.dataset.game),
 'club-game-open':el=>ClubGames.open(el.dataset.id),
 'club-game-action':el=>ClubGames.action(el.dataset.operation),
 'poker-select':el=>ClubGames.select(Number(el.dataset.index)),
 'pool-aim':(el,event)=>{const g=ClubGames.data;if(g?.turn!==Cloud.uid||g.status!=='active')return;const box=el.getBoundingClientRect(),x=(event.clientX-box.left)/box.width*2,y=(event.clientY-box.top)/box.height;ClubGames.aim((Math.atan2(y-g.cue.y,x-g.cue.x)*180/Math.PI+360)%360,'pool-angle');const range=document.querySelector('[data-input="pool-angle"]');if(range)range.value=ClubGames.angle;}
});
document.addEventListener('input',event=>{if(['pool-angle','pool-power'].includes(event.target.dataset.input))ClubGames.aim(event.target.value,event.target.dataset.input);});
setInterval(()=>{if(!document.hidden&&ui.tab==='club'&&ClubGames.allowed()){ClubGames.refresh();if(document.getElementById('club-game-lobby'))ClubGames.loadLobby().then(()=>{const box=document.getElementById('club-game-lobby');if(box)box.innerHTML=ClubGames.lobbyHtml();});}},3000);
