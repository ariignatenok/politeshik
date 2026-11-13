'use strict';
const ClubInterior={
 busy:false,pending:null,owner:null,
 seats(){return Array.from({length:12},(_,i)=>{const sofa=Math.floor(i/2);return{id:i+1,x:(sofa%2?64:22)+(i%2?14:0),y:58+Math.floor(sofa/2)*15};});},
 npc(kind,size=72){return Mascot.svg('happy',size,'',{look:{body:kind==='waiter'?'cream':'blue',top:'whitesweater',outfit:kind==='waiter'?'uniform':'leather',chain:kind==='waiter'?'none':'shortgold',hair:'waves',hairColor:'black'},season:''});},
 doors(){return ['cinema','games'].map((room,i)=>'<button class="floor-room-door door-'+room+'" data-action="club-floor-door" data-room="'+room+'"><span class="door-lamp"></span><b>'+U.esc(Club.roomNames[room])+'</b><i>🚪</i><small>Вход от 75%</small><span class="door-guard">'+Mascot.svg('angry',42,'',{look:{body:'dark',outfit:'leather',glasses:'sun'},season:''})+'</span></button>').join('');},
 gallery(){return '<div class="club-wall-gallery" aria-label="Картины на стенах">'+[
 '<svg viewBox="0 0 100 120" role="img" aria-label="Ночной колледж"><rect width="100" height="120" fill="#292b62"/><circle cx="76" cy="24" r="12" fill="#ffdfaa"/><path d="M8 110V48L50 29L92 48V110" fill="#d3a08d"/><path d="M20 58H30V70H20ZM43 58H54V70H43ZM66 58H78V70H66ZM20 82H30V94H20ZM66 82H78V94H66Z" fill="#ffe6a0"/><path d="M42 110V84H58V110" fill="#62455b"/></svg>',
 '<svg viewBox="0 0 100 120" role="img" aria-label="Диско-планета"><rect width="100" height="120" fill="#3c214e"/><circle cx="50" cy="55" r="27" fill="#df94c3"/><ellipse cx="50" cy="57" rx="43" ry="12" transform="rotate(-22 50 57)" fill="none" stroke="#ffe0a8" stroke-width="6"/><path d="M15 20L18 28L26 31L18 34L15 42L12 34L4 31L12 28ZM82 84L85 90L92 92L85 95L82 103L79 95L72 92L79 90Z" fill="#b9edee"/></svg>',
 '<svg viewBox="0 0 100 120" role="img" aria-label="Джазовый вечер"><rect width="100" height="120" fill="#692734"/><path d="M38 88V30L78 20V74" fill="none" stroke="#f6cf83" stroke-width="8"/><ellipse cx="26" cy="91" rx="17" ry="11" transform="rotate(-25 26 91)" fill="#f6cf83"/><ellipse cx="65" cy="78" rx="17" ry="11" transform="rotate(-25 65 78)" fill="#f6cf83"/></svg>'
 ].map((art,i)=>'<div class="club-wall-art art-'+i+'">'+art+'</div>').join('')+'</div>';},
 barPoint(){return{x:Club.room==='cinema'?50:80,y:94};},
 barHtml(){const preparing=Club.visitors.some(v=>v.service&&v.service.item!=='popcorn');return '<button class="club-bar staffed-bar'+(preparing?' is-mixing':'')+'" data-action="club-bar"><span class="bar-bottles">♢ ▰ ♢ ▰</span><span class="club-bartender">'+ClubInterior.npc('bartender',75)+'</span><span class="bar-counter"><b>BAR</b><small>'+(preparing?'Готовлю ваш заказ…':'Соки · кофе · коктейли')+'</small></span><span class="bar-shaker">🍹</span></button>';},
 waiterHtml(){if(Club.room!=='cinema')return '';const orders=Club.visitors.filter(v=>v.service?.source==='waiter');return '<button class="cinema-waiter" data-action="club-waiter"><span class="waiter-question">Попкорн? Напиток?<br>Что принести?</span>'+ClubInterior.npc('waiter',72)+'<span class="waiter-tray">🍿 🥤</span></button>'+orders.map(v=>{const point=Club.position(v),start=Date.parse(v.service.created_at),duration=Math.max(1,Date.parse(v.service.ready_at)-start),elapsed=Math.max(0,Math.min(duration,Date.now()+ClubMovie.offset-start));return '<div class="waiter-delivery" style="--delivery-x:'+point.x+'%;--delivery-y:'+point.y+'%;--delivery-duration:'+duration+'ms;--delivery-delay:-'+elapsed+'ms">'+ClubInterior.npc('waiter',60)+'<span>🍿 🥤</span><small>Несу заказ…</small></div>';}).join('');},
 sofasHtml(){return '<div class="red-cinema-sofas">'+Array.from({length:6},(_,i)=>{const seats=ClubInterior.seats().slice(i*2,i*2+2);return '<div class="red-cinema-sofa sofa-'+i+'" style="left:'+(i%2?71:29)+'%;top:'+(58+Math.floor(i/2)*15)+'%"><div class="sofa-back"></div><div class="sofa-cushions"><i></i><i></i></div><span class="sofa-arm arm-left"></span><span class="sofa-arm arm-right"></span>'+seats.map(s=>{const guest=Club.visitors.find(v=>v.seat===s.id),own=guest?.uid===Cloud.uid;return '<button class="sofa-seat seat-'+(s.id%2?'left':'right')+'" data-action="club-sit" data-seat="'+s.id+'" aria-label="'+(guest?'Место '+s.id+' занято':'Сесть на диван, место '+s.id)+'"'+(guest&&!own?' disabled':'')+'><small>'+(own?'Вы сидите здесь':guest?'Занято':'Сесть')+'</small></button>';}).join('')+'</div>';}).join('')+'</div>';},
 gameTable(kind){if(kind==='pool')return '<svg viewBox="0 0 600 300" role="img" aria-label="Бильярдный стол"><rect x="5" y="5" width="590" height="290" rx="28" fill="#673c32" stroke="#daae7e" stroke-width="5"/><rect x="24" y="24" width="552" height="252" rx="12" fill="#167354"/>'+[[27,27],[300,23],[573,27],[27,273],[300,277],[573,273]].map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="15" fill="#0d1618"/>').join('')+'<circle cx="165" cy="157" r="11" fill="#fff8e2"/><circle cx="376" cy="125" r="12" fill="#f9b449"/><circle cx="397" cy="138" r="12" fill="#b84d76"/><circle cx="397" cy="112" r="12" fill="#6c78de"/><path d="M65 238L247 174" stroke="#d4b183" stroke-width="6"/></svg>';
  return '<svg viewBox="0 0 600 300" role="img" aria-label="Стол покера"><rect x="8" y="12" width="584" height="276" rx="138" fill="#592d36" stroke="#d6a37b" stroke-width="6"/><rect x="31" y="34" width="538" height="232" rx="116" fill="#17624e" stroke="#2c9e75" stroke-width="3"/><path d="M142 69H458V231H142Z" fill="none" stroke="#c2c689" stroke-width="2" stroke-dasharray="6 7"/>'+[210,255,300,345,390].map((x,i)=>'<rect x="'+x+'" y="110" width="36" height="58" rx="4" fill="#fff5df"/><text x="'+(x+18)+'" y="145" text-anchor="middle" fill="'+(i%2?'#be3f58':'#292a36')+'" font-size="24">'+['♠','♥','♣','♦','♠'][i]+'</text>').join('')+'<circle cx="178" cy="182" r="13" fill="#da678b" stroke="#fff" stroke-dasharray="4 4"/><circle cx="416" cy="90" r="13" fill="#7297e0" stroke="#fff" stroke-dasharray="4 4"/></svg>';},
 gamesHtml(){return '<div class="room-game-windows">'+['poker','pool'].map(kind=>'<button class="room-game-window window-'+kind+'" data-action="club-games-open" data-game="'+kind+'"><span class="table-window-heading">'+(kind==='poker'?'♠ ПОКЕР':'🎱 БИЛЬЯРД')+'</span>'+ClubInterior.gameTable(kind)+'<small>Нажмите, чтобы занять место или открыть игру</small></button>').join('')+'</div>';},
 menu(source='bar'){
  if(!Club.joined)return toast('Сначала зайдите в клуб');const own=Club.own();
  UI.open(source==='waiter'?'Официант Политешика':'Бармен Политешика','<section class="club-service-menu"><div class="service-host">'+ClubInterior.npc(source==='waiter'?'waiter':'bartender',100)+'<div><h3>'+(source==='waiter'?'Что вам принести?':'Смешаем что-нибудь вкусное?')+'</h3><p>Напитки и коктейли готовятся несколько секунд.'+(source==='waiter'?' Принесу заказ прямо к вашему месту.':'')+'</p></div></div>'+(own.service?'<p class="service-pending">Ваш заказ готовится…</p>':'')+'<div class="service-items">'+(Club.room==='cinema'?'<button class="btn service-item" data-action="club-order" data-item="popcorn" data-source="'+source+'">🍿 Попкорн</button>':'')+Club.drinks.filter(d=>d[0]!=='none').map(([id,name,icon])=>'<button class="btn service-item" data-action="club-order" data-item="'+id+'" data-source="'+source+'"><span>'+icon+'</span>'+U.esc(name)+'</button>').join('')+'</div><div class="head-actions"><button class="btn" data-action="club-clear-item" data-item="drink">Освободить лапку с напитком</button>'+(own.snack==='popcorn'?'<button class="btn" data-action="club-clear-item" data-item="snack">Убрать попкорн</button>':'')+'</div></section>',{wide:true,noFocus:true});
 },
 async action(action,{item=null,seat=null}={}){
  if(ClubInterior.owner!==Cloud.uid){ClubInterior.owner=Cloud.uid;ClubInterior.busy=false;ClubInterior.pending=null;}
  if(ClubInterior.busy)return;const owner=Cloud.uid,room=Club.room;ClubInterior.busy=true;
  const key=JSON.stringify([owner,Club.room,action,item,seat]);if(ClubInterior.pending?.key!==key)ClubInterior.pending={key,nonce:crypto.randomUUID()};
  try{const data=await Social.call('club_service',{p_action:action,p_item:item,p_seat:seat,p_nonce:ClubInterior.pending.nonce});if(owner!==Cloud.uid||room!==Club.room)return;
   ClubInterior.pending=null;Club.apply(data);UI.close();App.render();if(action.startsWith('order'))toast('Заказ принят. Сейчас приготовим и принесём 💛');
  }catch(e){if(owner===Cloud.uid)toast(e.message);}finally{if(owner===Cloud.uid)ClubInterior.busy=false;}
 },
 prop(svg,pose,snack){
  let extra='';if(pose==='poker')extra+='<g data-club-prop="cards" transform="translate(20 76)rotate(-14)"><rect x="0" y="0" width="19" height="29" rx="3" fill="#f8edce" stroke="#b94968"/><rect x="8" y="-4" width="19" height="29" rx="3" fill="#a23c5d" stroke="#ffe3c1"/><path d="M12 1L23 17M23 1L12 17" stroke="#f2bfcc" stroke-width="2"/></g>';
  if(pose==='pool')extra+='<g data-club-prop="cue"><path d="M94 114L108 9" stroke="#9b653f" stroke-width="5" stroke-linecap="round"/><path d="M108 9L109 3" stroke="#75d9d9" stroke-width="4"/><ellipse cx="98" cy="84" rx="6" ry="7" fill="#a4d3b2" stroke="#4b8068" stroke-width="2"/></g>';
  if(snack==='popcorn')extra+='<g data-club-prop="popcorn"><path d="M12 84H38L35 110H16Z" fill="#f4c8a0" stroke="#aa3f55" stroke-width="2"/><path d="M18 87L20 107M27 87V107M34 87L32 107" stroke="#cf4960" stroke-width="4"/>'+[[16,83],[23,79],[30,82],[36,82],[20,86],[29,86]].map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="5" fill="#ffecc3" stroke="#d4b878"/>').join('')+'</g>';
  return svg.replace('</svg>',extra+'</svg>');
 }
};
Club.drinks.push(['berry','Ягодный коктейль','🍓'],['citrus','Цитрусовый коктейль','🍹'],['tropical','Тропический коктейль','🍍']);
const interiorMascot=Club.mascot;
Club.mascot=(card,size=88)=>ClubInterior.prop(interiorMascot(card,size),card.pose,card.snack);
const interiorMovie=Club.movieHtml;
Club.movieHtml=()=>interiorMovie().replace(/<div class="cinema-sofas">.*?<\/div>/s,'')+ClubInterior.sofasHtml();
ClubGames.roomHtml=()=>ClubInterior.gamesHtml();
Club.openBar=()=>ClubInterior.menu('bar');
Club.walkToBar=()=>Club.walkTo(ClubInterior.barPoint(),()=>Club.openBar());
const interiorDestinations=A['club-destinations'];
Object.assign(A,{
 'club-floor-door':el=>{const room=el.dataset.room;Club.walkTo({x:room==='cinema'?12:88,y:37},()=>Club.enterRoom(room));},
 'club-waiter':()=>ClubInterior.menu('waiter'),
 'club-order':el=>ClubInterior.action(el.dataset.source==='waiter'?'order_waiter':'order_bar',{item:el.dataset.item}),
 'club-clear-item':el=>ClubInterior.action('clear',{item:el.dataset.item}),
 'club-sit':el=>{const seat=ClubInterior.seats().find(s=>s.id===Number(el.dataset.seat));if(seat)return Club.walkTo(seat,()=>ClubInterior.action('sit',{seat:seat.id}));},
 'club-stand':()=>ClubInterior.action('stand'),
 'club-bar-toggle':()=>Club.walkToBar(),
 'club-destinations':el=>{
  if(Club.room!=='cinema')return interiorDestinations(el);
  UI.open('Красные диваны · выберите место','<div class="cinema-seat-menu">'+ClubInterior.seats().map(s=>{const occupied=Club.visitors.find(v=>v.seat===s.id);return '<button class="btn" data-action="club-sit" data-seat="'+s.id+'"'+(occupied&&occupied.uid!==Cloud.uid?' disabled':'')+'>Место '+s.id+(occupied?' · занято':'')+'</button>';}).join('')+'</div><button class="btn" data-action="club-stand">Встать с дивана</button>');
 }
});
