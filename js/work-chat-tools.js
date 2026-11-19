'use strict';

const WorkChatTools = {
  owner:null,scope:null,info:null,tab:'participants',rows:[],more:false,cursor:null,loading:false,error:'',token:0,
  roles:{superadmin:'Супер-админ',admin:'Староста',deputy:'Зам старосты',developer:'Разработчик',curator:'Куратор',teacher:'Преподаватель',student:'Студент'},
  context(form){
    const type=form?.dataset.form;
    if(type==='leader-chat')return {kind:'leaders'};
    if(type==='development-chat')return {kind:'development'};
    if(type==='group-room')return {kind:'group',tenant:form.dataset.thread};
    if(type==='curator-chat'){const [tenant,peer]=form.dataset.thread.split(':');return {kind:'curator',tenant,peer};}
    return null;
  },
  args(scope){return {p_kind:scope.kind,p_tenant:scope.tenant||null,p_peer:scope.peer||null};},
  infoButton(scope){return '<button class="btn sm work-info-button" data-action="work-chat-info" data-kind="'+U.esc(scope.kind)+'" data-tenant="'+U.esc(scope.tenant||'')+'" data-peer="'+U.esc(scope.peer||'')+'" aria-label="Участники, медиа и файлы чата">Участники и медиа ›</button>';},
  async refresh(scope){
    const owner=Cloud.uid;
    if(scope.kind==='leaders')await LeaderChat.load();
    if(scope.kind==='development')await DevelopmentChat.load();
    if(scope.kind==='group')await GroupRooms.load(scope.tenant);
    if(scope.kind==='curator')await CuratorChats.load(scope.tenant+':'+scope.peer);
    const key=scope.kind==='leaders'?'leaders':scope.kind==='development'?'development':scope.kind==='group'?'room:'+scope.tenant:'curator:'+scope.tenant+':'+scope.peer;
    requestAnimationFrame(()=>{if(Cloud.uid!==owner||ui.tab!=='chat'||ui.chatWith!==key)return;const pane=document.querySelector('.peer-scroll');if(pane)pane.scrollTop=pane.scrollHeight;});
  },
  links(body){
    return [...String(body||'').matchAll(/https?:\/\/[^\s<>"']+/gi)].slice(0,30).map(m=>{
      const value=m[0].replace(/[.,!?:;\])}]+$/,'');
      try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?{url:url.href,label:value,at:m.index,length:value.length}:null;}catch{return null;}
    }).filter(Boolean);
  },
  text(body){
    const raw=String(body||'');let at=0,html='';
    WorkChatTools.links(raw).forEach(link=>{html+=U.esc(raw.slice(at,link.at))+'<a href="'+U.esc(link.url)+'" target="_blank" rel="noopener noreferrer">'+U.esc(link.label)+'</a>';at=link.at+link.length;});
    return (html+U.esc(raw.slice(at))).replace(/\n/g,'<br>');
  },
  media(message){
    const a=ChatMedia.attachment(message);if(!a||!ChatMedia.validPath(a.path))return '';
    if(!['voice','video'].includes(a.kind))return ChatMedia.html(message);
    const tag=a.kind==='voice'?'audio':'video';
    return '<div class="message-attachment work-stream"><'+tag+' controls preload="none"'+(tag==='video'?' playsinline':'')+' data-work-stream="'+U.esc(a.path)+'"></'+tag+'><button class="btn sm" data-action="media-open" data-path="'+U.esc(a.path)+'" data-kind="'+a.kind+'" data-name="'+U.esc(a.name)+'">'+(a.kind==='voice'?'🎙 Голосовое':'▶ Видео')+' · '+Math.ceil(a.size/1024)+' КБ</button></div>';
  },
  async open(scope){
    const token=++WorkChatTools.token;WorkChatTools.owner=Cloud.uid;WorkChatTools.scope=scope;WorkChatTools.info=null;WorkChatTools.tab='participants';WorkChatTools.rows=[];WorkChatTools.more=false;WorkChatTools.cursor=null;WorkChatTools.error='';WorkChatTools.loading=true;WorkChatTools.render();
    try{
      const {data,error}=await supa.rpc('work_chat_info',WorkChatTools.args(scope));
      if(!WorkChatTools.current(token))return;if(error)throw error;WorkChatTools.info=data;
    }catch(error){if(WorkChatTools.current(token))WorkChatTools.error=error.message;}
    finally{if(WorkChatTools.current(token)){WorkChatTools.loading=false;WorkChatTools.render();}}
  },
  current(token){return token===WorkChatTools.token&&WorkChatTools.owner===Cloud.uid&&!!document.querySelector('[data-work-chat-panel]');},
  async select(tab,append=false){
    if(!['participants','media','voice','files','links'].includes(tab))return;
    if(!append){WorkChatTools.tab=tab;WorkChatTools.rows=[];WorkChatTools.more=false;WorkChatTools.cursor=null;}
    if(tab==='participants'){WorkChatTools.token++;WorkChatTools.error='';WorkChatTools.more=false;WorkChatTools.loading=false;WorkChatTools.render();return;}
    const token=++WorkChatTools.token,scope=WorkChatTools.scope,owner=Cloud.uid;WorkChatTools.loading=true;WorkChatTools.error='';WorkChatTools.render();
    try{
      const {data,error}=await supa.rpc('work_chat_gallery',{...WorkChatTools.args(scope),p_tab:tab,p_before:append?WorkChatTools.cursor:null});
      if(!WorkChatTools.current(token)||owner!==Cloud.uid)return;if(error)throw error;
      WorkChatTools.rows=append?[...new Map(WorkChatTools.rows.concat(data||[]).map(m=>[m.id,m])).values()]:data||[];
      WorkChatTools.more=(data||[]).length===50;const last=data?.at(-1);WorkChatTools.cursor=last?{at:last.created_at,id:last.id}:null;
    }catch(error){if(WorkChatTools.current(token)){WorkChatTools.error=error.message;WorkChatTools.rows=[];}}
    finally{if(WorkChatTools.current(token)){WorkChatTools.loading=false;WorkChatTools.render();}}
  },
  memberHtml(m){return '<button class="work-member" data-action="work-chat-member" data-uid="'+m.uid+'">'+avatarOf(m.avatar,42).replace(/ data-action="profile-photo"| role="button"| tabindex="0"/g,'')+Mascot.svg('happy',38,'',{look:Wardrobe.normalize(m.mascot),season:''})+'<span><b>'+U.esc(m.name)+'</b><small>'+U.esc(WorkChatTools.roles[m.role]||'Участник')+' · '+U.esc(m.group_name||'')+'</small></span></button>';},
  galleryHtml(m){
    if(WorkChatTools.tab==='links')return '<article class="work-link">'+WorkChatTools.links(m.body).map(link=>'<a href="'+U.esc(link.url)+'" target="_blank" rel="noopener noreferrer"><b>'+U.esc(new URL(link.url).hostname)+'</b><small>'+U.esc(link.label)+'</small></a>').join('')+'<small>'+U.esc(chatTime(m.created_at))+'</small></article>';
    return '<article class="work-gallery-item">'+WorkChatTools.media(m)+'<small>'+U.esc(chatTime(m.created_at))+'</small></article>';
  },
  render(){
    if(WorkChatTools.owner!==Cloud.uid)return;
    const info=WorkChatTools.info,tab=WorkChatTools.tab;
    const tabs=[['participants','Участники'],['media','Медиа'],['voice','Голосовые'],['files','Файлы'],['links','Ссылки']];
    let body=WorkChatTools.error?'<p class="warn">'+U.esc(WorkChatTools.error)+'</p><button class="btn" data-action="work-chat-retry">Повторить</button>':tab==='participants'?(info?.participants||[]).map(WorkChatTools.memberHtml).join(''):WorkChatTools.rows.map(WorkChatTools.galleryHtml).join('');
    if(!body&&!WorkChatTools.loading)body='<p class="empty">Здесь пока ничего нет</p>';
    const previous=document.querySelector('[data-work-chat-panel]'),scroll=previous?.dataset.workTab===tab?previous.closest('.modal-body')?.scrollTop||0:0;
    UI.open(info?.title||'Сведения о чате','<div data-work-chat-panel data-work-tab="'+tab+'"><p class="hint">'+(info?info.participants.length+' участников · Только участникам этого чата':'Загружаем сведения о чате…')+'</p><div class="work-info-tabs" role="tablist">'+tabs.map(([key,title])=>'<button role="tab" aria-selected="'+(tab===key)+'" class="'+(tab===key?'on':'')+'" data-action="work-chat-tab" data-tab="'+key+'">'+title+(info?' <small>'+(key==='participants'?info.participants.length:info.counts?.[key]||0)+'</small>':'')+'</button>').join('')+'</div><div class="work-info-content '+(tab==='media'?'work-media-grid':'')+'">'+body+'</div>'+(WorkChatTools.loading?'<p role="status">Загружаем…</p>':'')+(WorkChatTools.more&&!WorkChatTools.loading?'<button class="btn" data-action="work-chat-more">Показать ещё</button>':'')+'</div>',{wide:true});
    const pane=document.querySelector('[data-work-chat-panel]')?.closest('.modal-body');if(pane)pane.scrollTop=scroll;
    WorkChatTools.hydrate();
  },
  hydrate(){document.querySelectorAll('[data-work-stream]:not([data-work-observed])').forEach(el=>{el.dataset.workObserved='1';WorkChatTools.observer.observe(el);});},
  async stream(el){
    try{const owner=Cloud.uid,url=await ChatMedia.url(el.dataset.workStream);if(!el.isConnected||owner!==Cloud.uid)return;el.src=url;
      el.onerror=async()=>{if(el.dataset.workRetry)return;el.dataset.workRetry='1';ChatMedia.urls?.delete(el.dataset.workStream);try{const refreshed=await ChatMedia.url(el.dataset.workStream);if(el.isConnected&&owner===Cloud.uid)el.src=refreshed;}catch{el.title='Не удалось открыть файл. Попробуйте кнопку под сообщением.';}};
    }catch{el.title='Файл недоступен. Попробуйте кнопку под сообщением.';}
  }
};
WorkChatTools.observer=new IntersectionObserver(entries=>{entries.forEach(({target,isIntersecting})=>{if(isIntersecting){WorkChatTools.observer.unobserve(target);WorkChatTools.stream(target);}})},{rootMargin:'100px'});
new MutationObserver(()=>WorkChatTools.hydrate()).observe(document.body,{childList:true,subtree:true});
Object.assign(A,{
 'work-chat-info':el=>WorkChatTools.open({kind:el.dataset.kind,tenant:el.dataset.tenant||null,peer:el.dataset.peer||null}),
 'work-chat-tab':el=>WorkChatTools.select(el.dataset.tab),
 'work-chat-more':()=>WorkChatTools.select(WorkChatTools.tab,true),
 'work-chat-retry':()=>WorkChatTools.open(WorkChatTools.scope),
 'work-chat-member'(el){const m=WorkChatTools.info?.participants?.find(x=>x.uid===el.dataset.uid);if(!m)return;UI.open(m.name,'<div class="work-member-card">'+avatarOf(m.avatar,100)+Mascot.svg('happy',100,'',{look:Wardrobe.normalize(m.mascot),season:''})+'<p>'+U.esc(WorkChatTools.roles[m.role]||'Участник')+'</p><p>'+U.esc(m.group_name||'')+'</p></div><button class="btn" data-action="work-chat-info" data-kind="'+WorkChatTools.scope.kind+'" data-tenant="'+U.esc(WorkChatTools.scope.tenant||'')+'" data-peer="'+U.esc(WorkChatTools.scope.peer||'')+'">← Сведения о чате</button>');}
});
