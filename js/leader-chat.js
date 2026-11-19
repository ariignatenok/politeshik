'use strict';

// Cross-group council, distinct from all academic and curator-group rooms.
const LeaderChat = {
  owner:'', state:null, rows:[], loaded:false, loading:false, loadingRows:false, at:0, error:'', more:false, sending:false, pending:null,
  identity(){return [Cloud.uid,Cloud.tenantId,Cloud.role,!!Cloud.isDeputy].join(':');},
  allowed(){return Cloud.status==='online' && Cloud.hasCabinet() && (Cloud.isSuperAdmin || Cloud.isAdmin || Deputies.canMark());},
  reset(){
    const owner=LeaderChat.identity();
    if(owner===LeaderChat.owner && LeaderChat.allowed())return;
    Object.assign(LeaderChat,{owner,state:null,rows:[],loaded:false,loading:false,loadingRows:false,at:0,error:'',more:false,sending:false,pending:null});
  },
  async call(name,args={}){const {data,error}=await supa.rpc(name,args);if(error)throw Error(error.message);return data;},
  async refresh(force=false){
    LeaderChat.reset();if(!LeaderChat.allowed() || LeaderChat.loading || !force && Date.now()-LeaderChat.at<10000)return;
    const owner=LeaderChat.owner;LeaderChat.loading=true;LeaderChat.at=Date.now();
    try{
      const state=await LeaderChat.call('leader_chat_state');LeaderChat.reset();if(owner!==LeaderChat.owner || !LeaderChat.allowed())return;
      const changed=JSON.stringify(state)!==JSON.stringify(LeaderChat.state)||!!LeaderChat.error;
      LeaderChat.state=state;LeaderChat.loaded=true;LeaderChat.error='';
      if(!state?.allowed){LeaderChat.rows=[];LeaderChat.more=false;LeaderChat.pending=null;}
      if(changed)App.renderSoft();
    }catch(error){if(owner===LeaderChat.owner){LeaderChat.error=error.message;LeaderChat.state=null;LeaderChat.rows=[];App.renderSoft();}}
    finally{if(owner===LeaderChat.owner)LeaderChat.loading=false;}
  },
  async open(){
    LeaderChat.reset();if(!LeaderChat.allowed())return;
    UI.close();ui.tab='chat';ui.chatWith='leaders';App.render(true);
    await LeaderChat.refresh(true);if(LeaderChat.state?.allowed)await LeaderChat.load();window.scrollTo(0,0);
  },
  async load(older=false){
    LeaderChat.reset();if(!LeaderChat.allowed() || !LeaderChat.state?.allowed || LeaderChat.loadingRows)return;
    const owner=LeaderChat.owner,previous=LeaderChat.rows;LeaderChat.loadingRows=true;
    try{
      const rows=await LeaderChat.call('leader_chat_messages',{p_before:older&&previous.length?previous[0].seq:null});
      LeaderChat.reset();if(owner!==LeaderChat.owner || !LeaderChat.allowed())return;
      if(older || !previous.length)LeaderChat.more=rows.length===100;
      const merged=[...new Map((older?rows.concat(previous):previous.concat(rows)).map(m=>[m.id,m])).values()].sort((a,b)=>Number(a.seq)-Number(b.seq));
      const changed=JSON.stringify(merged)!==JSON.stringify(previous);LeaderChat.rows=merged;LeaderChat.error='';
      if(changed)renderChatUpdates();await LeaderChat.refresh(true);
    }catch(error){if(owner===LeaderChat.owner){LeaderChat.rows=[];LeaderChat.state=null;LeaderChat.error=error.message;App.renderSoft();}}
    finally{if(owner===LeaderChat.owner)LeaderChat.loadingRows=false;}
  },
  async send(form){
    LeaderChat.reset();if(!LeaderChat.allowed() || !LeaderChat.state?.allowed || LeaderChat.sending)return;
    const raw=val(form,'t'),body=raw.trim(),owner=LeaderChat.owner;
    if(!body || body.length>4000)return toast('Сообщение: от 1 до 4000 символов');
    if(LeaderChat.pending?.body!==body)LeaderChat.pending={body,nonce:crypto.randomUUID()};
    const button=form.querySelector('[data-action="save-form"]');LeaderChat.sending=true;if(button)button.disabled=true;
    try{
      await LeaderChat.call('leader_chat_send',{p_body:body,p_nonce:LeaderChat.pending.nonce});LeaderChat.reset();if(owner!==LeaderChat.owner || !LeaderChat.allowed())return;
      LeaderChat.pending=null;
      if(val(form,'t')===raw){form.querySelector('textarea').value='';if(ui.chatDrafts)delete ui.chatDrafts[chatDraftKey('leaders')];}
      await LeaderChat.load();App.render();
    }catch(error){if(owner===LeaderChat.owner)toast(error.message);}
    finally{if(owner===LeaderChat.owner)LeaderChat.sending=false;if(button?.isConnected)button.disabled=false;}
  },
  unread(){return LeaderChat.allowed()&&LeaderChat.owner===LeaderChat.identity()&&LeaderChat.state?.allowed?Number(LeaderChat.state.unread)||0:0;},
  contactsHtml(){
    LeaderChat.reset();if(!LeaderChat.allowed())return '';LeaderChat.refresh();
    if(LeaderChat.error)return '<p class="warn">'+U.esc(LeaderChat.error)+' <button class="btn sm" data-action="leaders-refresh">Обновить общий чат</button></p>';
    if(!LeaderChat.state?.allowed)return '';
    return '<section class="leader-council"><h2>Общий чат старост и замов</h2><div class="chat-list">'+chatRow({id:'leaders',title:'Старосты и замы',subtitle:'Все группы · '+LeaderChat.state.members_count+' участников',preview:LeaderChat.state.last||'Общий чат для общения и объявлений',time:LeaderChat.state.at?chatTime(LeaderChat.state.at):'',unread:LeaderChat.unread(),avatar:'<span class="ico">👥</span>'})+'</div></section>';
  },
  threadHtml(){
    LeaderChat.reset();if(!LeaderChat.allowed())return '<button class="btn" data-action="chat-back">← Чаты</button><p>Этот чат доступен только старостам и действующим замам.</p>';
    if(!LeaderChat.state?.allowed)return '<button class="btn" data-action="chat-back">← Чаты</button><p>'+U.esc(LeaderChat.error||'Обновите доступ к общему чату.')+'</p><button class="btn" data-action="leaders-refresh">Обновить</button>';
    const role={admin:'Староста',superadmin:'Супер-админ',deputy:'Зам старосты'};
    return '<div class="page-head work-chat-head"><button class="btn sm" data-action="chat-back">← Чаты</button><div><h2>Старосты и замы</h2><p>Все группы · '+LeaderChat.state.members_count+' участников</p></div>'+WorkChatTools.infoButton({kind:'leaders'})+'</div><div class="card peer-thread leader-thread"><div class="peer-scroll">'+
      (LeaderChat.more?'<button class="btn sm" data-action="leaders-older">Более ранние сообщения</button>':'')+
      (LeaderChat.rows.map(m=>'<div class="peer-message'+(m.sender===Cloud.uid?' mine':'')+'"><div class="room-author">'+avatarOf(m.avatar,30,m.sender,m.role)+Mascot.svg('happy',30,'',{look:Wardrobe.normalize(m.mascot),season:''})+'<div><b>'+U.esc(m.name)+'</b><small>'+U.esc(role[m.role]||'Участник')+' · '+U.esc(m.group_name)+'</small></div></div>'+WorkChatTools.media(m)+'<p>'+WorkChatTools.text(m.body)+'</p><small>'+U.esc(chatTime(m.created_at))+(m.sender===Cloud.uid?messageReceipt(Number(m.read_count)>0):'')+'</small></div>').join('') || '<p class="hint">Это общий чат старост и замов всех групп. Напишите первое сообщение 👋</p>')+
      '</div><div class="chat-in" data-form="leader-chat">'+ChatMedia.controls()+chatComposer('leaderChatIn','leaders','Сообщение старостам и замам…')+'<button class="btn primary" data-action="save-form" aria-label="Отправить сообщение">➤</button></div></div>';
  }
};
Object.assign(A,{
  'leaders-refresh':async()=>{await LeaderChat.refresh(true);if(ui.tab==='chat'&&ui.chatWith==='leaders'&&LeaderChat.state?.allowed)await LeaderChat.load();},
  'leaders-older':()=>LeaderChat.load(true)
});
Forms['leader-chat']=form=>LeaderChat.send(form);
setInterval(()=>{LeaderChat.reset();if(!document.hidden&&LeaderChat.allowed()){LeaderChat.refresh();if(ui.tab==='chat'&&ui.chatWith==='leaders')LeaderChat.load();}},5000);
