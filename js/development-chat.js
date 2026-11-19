'use strict';

// Private development team chat, authorized by its own server-side membership list.
const DevelopmentChat = {
  owner:'', state:null, rows:[], loaded:false, loading:false, loadingRows:false, at:0, error:'', more:false, sending:false, pending:null,
  identity(){return [Cloud.uid,Cloud.tenantId,Cloud.role,!!Cloud.isDeputy].join(':');},
  allowed(){return Cloud.status==='online' && (Cloud.platformContext?.active || Cloud.hasCabinet() && (Cloud.isSuperAdmin || Cloud.isDeveloper));},
  reset(){
    const owner=DevelopmentChat.identity();
    if(owner===DevelopmentChat.owner && DevelopmentChat.allowed())return;
    Object.assign(DevelopmentChat,{owner,state:null,rows:[],loaded:false,loading:false,loadingRows:false,at:0,error:'',more:false,sending:false,pending:null});
  },
  async call(name,args={}){const {data,error}=await supa.rpc(name,args);if(error)throw Error(error.message);return data;},
  async refresh(force=false){
    DevelopmentChat.reset();if(!DevelopmentChat.allowed() || DevelopmentChat.loading || !force && Date.now()-DevelopmentChat.at<10000)return;
    const owner=DevelopmentChat.owner;DevelopmentChat.loading=true;DevelopmentChat.at=Date.now();
    try{
      const state=await DevelopmentChat.call('development_chat_state');DevelopmentChat.reset();if(owner!==DevelopmentChat.owner || !DevelopmentChat.allowed())return;
      const changed=JSON.stringify(state)!==JSON.stringify(DevelopmentChat.state)||!!DevelopmentChat.error;
      DevelopmentChat.state=state;DevelopmentChat.loaded=true;DevelopmentChat.error='';
      if(!state?.allowed){DevelopmentChat.rows=[];DevelopmentChat.more=false;DevelopmentChat.pending=null;}
      if(changed)App.renderSoft();
    }catch(error){if(owner===DevelopmentChat.owner){DevelopmentChat.error=error.message;DevelopmentChat.state=null;DevelopmentChat.rows=[];App.renderSoft();}}
    finally{if(owner===DevelopmentChat.owner)DevelopmentChat.loading=false;}
  },
  async open(){
    DevelopmentChat.reset();if(!DevelopmentChat.allowed())return;
    UI.close();ui.tab='chat';ui.chatWith='development';App.render(true);
    await DevelopmentChat.refresh(true);if(DevelopmentChat.state?.allowed)await DevelopmentChat.load();window.scrollTo(0,0);
  },
  async load(older=false){
    DevelopmentChat.reset();if(!DevelopmentChat.allowed() || !DevelopmentChat.state?.allowed || DevelopmentChat.loadingRows)return;
    const owner=DevelopmentChat.owner,previous=DevelopmentChat.rows;DevelopmentChat.loadingRows=true;
    try{
      const rows=await DevelopmentChat.call('development_chat_messages',{p_before:older&&previous.length?previous[0].seq:null});
      DevelopmentChat.reset();if(owner!==DevelopmentChat.owner || !DevelopmentChat.allowed())return;
      if(older || !previous.length)DevelopmentChat.more=rows.length===100;
      const merged=[...new Map((older?rows.concat(previous):previous.concat(rows)).map(m=>[m.id,m])).values()].sort((a,b)=>Number(a.seq)-Number(b.seq));
      const changed=JSON.stringify(merged)!==JSON.stringify(previous);DevelopmentChat.rows=merged;DevelopmentChat.error='';
      if(changed)renderChatUpdates();await DevelopmentChat.refresh(true);
    }catch(error){if(owner===DevelopmentChat.owner){DevelopmentChat.rows=[];DevelopmentChat.state=null;DevelopmentChat.error=error.message;App.renderSoft();}}
    finally{if(owner===DevelopmentChat.owner)DevelopmentChat.loadingRows=false;}
  },
  async send(form){
    DevelopmentChat.reset();if(!DevelopmentChat.allowed() || !DevelopmentChat.state?.allowed || DevelopmentChat.sending)return;
    const raw=val(form,'t'),body=raw.trim(),owner=DevelopmentChat.owner;
    if(!body || body.length>4000)return toast('Сообщение: от 1 до 4000 символов');
    if(DevelopmentChat.pending?.body!==body)DevelopmentChat.pending={body,nonce:crypto.randomUUID()};
    const button=form.querySelector('[data-action="save-form"]');DevelopmentChat.sending=true;if(button)button.disabled=true;
    try{
      await DevelopmentChat.call('development_chat_send',{p_body:body,p_nonce:DevelopmentChat.pending.nonce});DevelopmentChat.reset();if(owner!==DevelopmentChat.owner || !DevelopmentChat.allowed())return;
      DevelopmentChat.pending=null;
      if(val(form,'t')===raw){form.querySelector('textarea').value='';if(ui.chatDrafts)delete ui.chatDrafts[chatDraftKey('development')];}
      await DevelopmentChat.load();App.render();
    }catch(error){if(owner===DevelopmentChat.owner)toast(error.message);}
    finally{if(owner===DevelopmentChat.owner)DevelopmentChat.sending=false;if(button?.isConnected)button.disabled=false;}
  },
  unread(){return DevelopmentChat.allowed()&&DevelopmentChat.owner===DevelopmentChat.identity()&&DevelopmentChat.state?.allowed?Number(DevelopmentChat.state.unread)||0:0;},
  contactsHtml(){
    DevelopmentChat.reset();if(!DevelopmentChat.allowed())return '';DevelopmentChat.refresh();
    if(DevelopmentChat.error)return '<p class="warn">'+U.esc(DevelopmentChat.error)+' <button class="btn sm" data-action="development-refresh">Обновить общий чат</button></p>';
    if(!DevelopmentChat.state?.allowed)return '';
    return '<section class="leader-council"><h2>Общий чат команды разработки</h2><div class="chat-list">'+chatRow({id:'development',title:'Разработка',subtitle:'Команда · '+DevelopmentChat.state.members_count+' участников',preview:DevelopmentChat.state.last||'Общий чат для общения и объявлений',time:DevelopmentChat.state.at?chatTime(DevelopmentChat.state.at):'',unread:DevelopmentChat.unread(),avatar:'<span class="ico">👥</span>'})+'</div></section>';
  },
  threadHtml(){
    DevelopmentChat.reset();if(!DevelopmentChat.allowed())return '<button class="btn" data-action="chat-back">← Чаты</button><p>Этот чат доступен только команде разработки.</p>';
    if(!DevelopmentChat.state?.allowed)return '<button class="btn" data-action="chat-back">← Чаты</button><p>'+U.esc(DevelopmentChat.error||'Обновите доступ к общему чату.')+'</p><button class="btn" data-action="development-refresh">Обновить</button>';
    const role={admin:'Староста',superadmin:'Супер-админ',deputy:'Зам старосты',developer:'Разработчик'};
    return '<div class="page-head work-chat-head"><button class="btn sm" data-action="chat-back">← Чаты</button><div><h2>Разработка</h2><p>Команда · '+DevelopmentChat.state.members_count+' участников</p></div>'+WorkChatTools.infoButton({kind:'development'})+'</div><div class="card peer-thread leader-thread"><div class="peer-scroll">'+
      (DevelopmentChat.more?'<button class="btn sm" data-action="development-older">Более ранние сообщения</button>':'')+
      (DevelopmentChat.rows.map(m=>'<div class="peer-message'+(m.sender===Cloud.uid?' mine':'')+'"><div class="room-author">'+avatarOf(m.avatar,30,m.sender,m.role)+Mascot.svg('happy',30,'',{look:Wardrobe.normalize(m.mascot),season:''})+'<div><b>'+U.esc(m.name)+'</b><small>'+U.esc(role[m.role]||'Участник')+' · '+U.esc(m.group_name)+'</small></div></div>'+WorkChatTools.media(m)+'<p>'+WorkChatTools.text(m.body)+'</p><small>'+U.esc(chatTime(m.created_at))+(m.sender===Cloud.uid?messageReceipt(Number(m.read_count)>0):'')+'</small></div>').join('') || '<p class="hint">Закрытый чат Арины, Дмитрия и Макара. Напишите первое сообщение 👋</p>')+
      '</div><div class="chat-in" data-form="development-chat">'+ChatMedia.controls()+chatComposer('leaderChatIn','development','Сообщение команде разработки…')+'<button class="btn primary" data-action="save-form" aria-label="Отправить сообщение">➤</button></div></div>';
  }
};
Object.assign(A,{
  'development-refresh':async()=>{await DevelopmentChat.refresh(true);if(ui.tab==='chat'&&ui.chatWith==='development'&&DevelopmentChat.state?.allowed)await DevelopmentChat.load();},
  'development-older':()=>DevelopmentChat.load(true)
});
Forms['development-chat']=form=>DevelopmentChat.send(form);
setInterval(()=>{DevelopmentChat.reset();if(!document.hidden&&DevelopmentChat.allowed()){DevelopmentChat.refresh();if(ui.tab==='chat'&&ui.chatWith==='development')DevelopmentChat.load();}},5000);
