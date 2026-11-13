'use strict';
// Work chats have their own server-authorized contacts; no social/academic permissions are widened.
const CuratorChats={
 owner:'',contacts:[],threads:{},loaded:false,loading:false,at:0,error:'',sending:false,pending:null,loadingThreads:new Set(),historyMore:{},
 allowed(){return Cloud.status==='online'&&Cloud.hasCabinet()&&(Cloud.isAdmin||Cloud.isCurator&&Cloud.curatorContext?.active);},
 reset(){const key=[Cloud.uid,Cloud.tenantId,Cloud.role].join(':');if(key===CuratorChats.owner)return;Object.assign(CuratorChats,{owner:key,contacts:[],threads:{},loaded:false,loading:false,at:0,error:'',sending:false,pending:null,loadingThreads:new Set(),historyMore:{}});},
 key(row){return row.tenant_id+':'+row.peer_uid;},
 contact(key){CuratorChats.reset();return CuratorChats.contacts.find(r=>r.peer_uid&&CuratorChats.key(r)===key);},
 async call(name,args={}){const {data,error}=await supa.rpc(name,args);if(error)throw Error(error.message);return data;},
 async refresh(force=false){
  if(!CuratorChats.allowed())return;CuratorChats.reset();
  if(CuratorChats.loading||!force&&Date.now()-CuratorChats.at<10000)return;
  CuratorChats.loading=true;CuratorChats.at=Date.now();const owner=CuratorChats.owner;
  try{const rows=await CuratorChats.call('curator_chat_contacts');if(owner!==CuratorChats.owner)return;
   const changed=JSON.stringify(rows)!==JSON.stringify(CuratorChats.contacts)||!CuratorChats.loaded||CuratorChats.error;
   CuratorChats.contacts=rows||[];CuratorChats.loaded=true;CuratorChats.error='';
   Object.keys(CuratorChats.threads).forEach(k=>{if(!CuratorChats.contact(k))delete CuratorChats.threads[k];});
   if(changed)App.renderSoft();
  }catch(e){if(owner===CuratorChats.owner){CuratorChats.error=e.message;App.renderSoft();}}
  finally{if(owner===CuratorChats.owner)CuratorChats.loading=false;}
 },
 async open(key){if(!CuratorChats.allowed())return;CuratorChats.reset();if(!CuratorChats.contact(key))return;UI.close();ui.tab='chat';ui.chatWith='curator:'+key;App.render(true);await CuratorChats.load(key);window.scrollTo(0,0);},
 async load(key,older=false){
  const contact=CuratorChats.contact(key);if(!CuratorChats.allowed()||!contact||CuratorChats.loadingThreads.has(key))return;
  CuratorChats.loadingThreads.add(key);const owner=CuratorChats.owner,previous=CuratorChats.threads[key]||[];
  try{const rows=await CuratorChats.call('curator_chat_messages',{p_tenant:contact.tenant_id,p_peer:contact.peer_uid,p_before:older&&previous.length?previous[0].created_at:null});if(owner!==CuratorChats.owner||!CuratorChats.contact(key))return;
   if(older||!previous.length)CuratorChats.historyMore[key]=rows.length===100;
   const merged=[...new Map((older?rows.concat(previous):previous.concat(rows)).map(m=>[m.id,m])).values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
   const changed=JSON.stringify(merged)!==JSON.stringify(previous);CuratorChats.threads[key]=merged;CuratorChats.error='';
   if(changed)renderChatUpdates();await CuratorChats.refresh(true);
  }catch(e){if(owner===CuratorChats.owner){delete CuratorChats.threads[key];CuratorChats.error=e.message;App.renderSoft();}}
  finally{if(owner===CuratorChats.owner)CuratorChats.loadingThreads.delete(key);}
 },
 async send(form){
  const key=form.dataset.thread,contact=CuratorChats.contact(key),raw=val(form,'t'),body=raw.trim();
  if(!CuratorChats.allowed()||!contact||CuratorChats.sending)return;
  if(!body||body.length>4000)return toast('Сообщение: от 1 до 4000 символов');
  const owner=CuratorChats.owner;CuratorChats.sending=true;
  if(CuratorChats.pending?.key!==key||CuratorChats.pending?.body!==body)CuratorChats.pending={key,body,nonce:crypto.randomUUID()};
  const button=form.querySelector('[data-action="save-form"]');button.disabled=true;
  try{await CuratorChats.call('curator_chat_send',{p_tenant:contact.tenant_id,p_peer:contact.peer_uid,p_body:body,p_nonce:CuratorChats.pending.nonce});if(owner!==CuratorChats.owner)return;
   CuratorChats.pending=null;if(val(form,'t')===raw){form.querySelector('textarea').value='';if(ui.chatDrafts)delete ui.chatDrafts[chatDraftKey('curator:'+key)];}
   await CuratorChats.load(key);App.render();
  }catch(e){if(owner===CuratorChats.owner)toast(e.message);}
  finally{if(owner===CuratorChats.owner)CuratorChats.sending=false;button.disabled=false;}
 },
 unread(){return CuratorChats.allowed()&&CuratorChats.owner===[Cloud.uid,Cloud.tenantId,Cloud.role].join(':')?CuratorChats.contacts.reduce((n,r)=>n+(Number(r.unread)||0),0):0;},
 contactsHtml(){
  if(!CuratorChats.allowed())return '';CuratorChats.reset();CuratorChats.refresh();
  const curator=Cloud.isCurator&&Cloud.curatorContext?.active;
  return (CuratorChats.error?'<p class="warn">'+U.esc(CuratorChats.error)+' <button class="btn sm" data-action="curator-chats-refresh">Повторить</button></p>':'')+
   (!CuratorChats.loaded&&curator?'<p role="status">Загружаем контакты старост…</p>':'')+
   (CuratorChats.contacts.length?'<section class="curator-chat-contacts"><h2>'+(curator?'Старосты ваших групп':'Куратор')+'</h2><div class="chat-list">'+CuratorChats.contacts.map(r=>{
    const name=r.name||Groups.get(r.tenant_id).leader||'Староста';
    return r.peer_uid?chatRow({id:'curator:'+CuratorChats.key(r),title:name,subtitle:r.group_name+' · '+(r.role==='curator'?'куратор':'староста'),preview:r.last||'Личная рабочая переписка',time:r.at?chatTime(r.at):'',unread:r.unread,avatar:Avatars.html(r.peer_uid,42)}):'<div class="card"><b>'+U.esc(name)+'</b><p class="hint">'+U.esc(r.group_name)+' · Староста ещё не зарегистрирован. Чат появится после регистрации.</p></div>';
   }).join('')+'</div></section>':'');
 },
 listHtml(){return '<div class="page-head"><div><h1>Чаты</h1><p>Личные переписки со старостами закреплённых групп.</p></div></div>'+GroupRooms.contactsHtml()+CuratorChats.contactsHtml()+'<div class="chat-list">'+chatRow({id:'contact:superadmin',title:'Админ Арина',subtitle:'Поддержка приложения',preview:'',avatar:Avatars.contact('superadmin',42)})+'</div>';},
 threadHtml(key){
  const row=CuratorChats.contact(key);if(!CuratorChats.allowed()||!row)return '<button class="btn" data-action="chat-back">← Чаты</button><p class="warn">Чат недоступен. Обновите список контактов.</p>';
  const rows=CuratorChats.threads[key],older=CuratorChats.historyMore[key];
  return '<div class="page-head"><button class="btn sm" data-action="chat-back">← Чаты</button><div><h2>'+U.esc(row.name||Groups.get(row.tenant_id).leader)+'</h2><p>'+U.esc(row.group_name)+'</p></div></div><div class="card peer-thread"><div class="peer-scroll">'+
   (older?'<button class="btn sm" data-action="curator-chat-older" data-key="'+U.esc(key)+'">Более ранние сообщения</button>':'')+
   (rows?rows.map(m=>'<div class="peer-message'+(m.sender===Cloud.uid?' mine':'')+'"><p>'+U.esc(m.body).replace(/\n/g,'<br>')+'</p><small>'+U.esc(chatTime(m.created_at))+(m.sender===Cloud.uid?messageReceipt(!!m.read_at):'')+'</small></div>').join('')||'<div class="empty">Начните переписку 👋</div>':'<p role="status">Загружаем сообщения…</p>')+
   '</div>'+(CuratorChats.error?'<p class="warn">'+U.esc(CuratorChats.error)+'</p>':'')+'<div class="chat-in" data-form="curator-chat" data-thread="'+U.esc(key)+'">'+chatComposer('curatorChatIn','curator:'+key,'Написать сообщение…')+'<button class="btn primary" data-action="save-form" aria-label="Отправить сообщение">➤</button></div></div>';
 }
};
Object.assign(A,{'curator-chats-refresh':()=>CuratorChats.refresh(true),'curator-chat-older':el=>CuratorChats.load(el.dataset.key,true)});
Forms['curator-chat']=form=>CuratorChats.send(form);
setInterval(()=>{if(!document.hidden&&CuratorChats.allowed()){CuratorChats.refresh();if(ui.tab==='chat'&&(ui.chatWith||'').startsWith('curator:'))CuratorChats.load(ui.chatWith.slice(8));}},10000);
