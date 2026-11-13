'use strict';
// Work chats have their own server-authorized contacts; no social/academic permissions are widened.
const GroupRooms={
 owner:'',contacts:[],threads:{},loaded:false,loading:false,at:0,error:'',sending:false,pending:null,loadingThreads:new Set(),historyMore:{},
 allowed(){return Cloud.status==='online'&&Cloud.hasCabinet()&&(['student','admin','developer'].includes(Cloud.role)||Cloud.isCurator&&Cloud.curatorContext?.active);},
 reset(){const key=[Cloud.uid,Cloud.tenantId,Cloud.role].join(':');if(key===GroupRooms.owner)return;Object.assign(GroupRooms,{owner:key,contacts:[],threads:{},loaded:false,loading:false,at:0,error:'',sending:false,pending:null,loadingThreads:new Set(),historyMore:{}});},
 key(row){return row.tenant_id;},
 contact(key){GroupRooms.reset();return GroupRooms.contacts.find(r=>GroupRooms.key(r)===key);},
 async call(name,args={}){const {data,error}=await supa.rpc(name,args);if(error)throw Error(error.message);return data;},
 async refresh(force=false){
  if(!GroupRooms.allowed())return;GroupRooms.reset();
  if(GroupRooms.loading||!force&&Date.now()-GroupRooms.at<(GroupRooms.loaded&&!GroupRooms.contacts.length?300000:30000))return;
  GroupRooms.loading=true;GroupRooms.at=Date.now();const owner=GroupRooms.owner;
  try{const rows=await GroupRooms.call('group_room_list');GroupRooms.reset();if(owner!==GroupRooms.owner)return;
   const changed=JSON.stringify(rows)!==JSON.stringify(GroupRooms.contacts)||!GroupRooms.loaded||GroupRooms.error;
   GroupRooms.contacts=rows||[];GroupRooms.loaded=true;GroupRooms.error='';
   Object.keys(GroupRooms.threads).forEach(k=>{if(!GroupRooms.contact(k))delete GroupRooms.threads[k];});
   if(changed)App.renderSoft();
  }catch(e){if(owner===GroupRooms.owner){GroupRooms.error=e.message;App.renderSoft();}}
  finally{if(owner===GroupRooms.owner)GroupRooms.loading=false;}
 },
 async open(key){if(!GroupRooms.allowed())return;GroupRooms.reset();if(!GroupRooms.contact(key))return;UI.close();ui.tab='chat';ui.chatWith='room:'+key;App.render(true);await GroupRooms.load(key);window.scrollTo(0,0);},
 async load(key,older=false){
  const contact=GroupRooms.contact(key);if(!GroupRooms.allowed()||!contact||GroupRooms.loadingThreads.has(key))return;
  GroupRooms.loadingThreads.add(key);const owner=GroupRooms.owner,previous=GroupRooms.threads[key]||[];
  try{const rows=await GroupRooms.call('group_room_messages',{p_tenant:contact.tenant_id,p_before:older&&previous.length?previous[0].created_at:null});GroupRooms.reset();if(owner!==GroupRooms.owner||!GroupRooms.contact(key))return;
   if(older||!previous.length)GroupRooms.historyMore[key]=rows.length===100;
   const merged=[...new Map((older?rows.concat(previous):previous.concat(rows)).map(m=>[m.id,m])).values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
   const changed=JSON.stringify(merged)!==JSON.stringify(previous);GroupRooms.threads[key]=merged;GroupRooms.error='';
   if(changed)renderChatUpdates();await GroupRooms.refresh(true);
  }catch(e){if(owner===GroupRooms.owner){delete GroupRooms.threads[key];GroupRooms.error=e.message;App.renderSoft();}}
  finally{if(owner===GroupRooms.owner)GroupRooms.loadingThreads.delete(key);}
 },
 async send(form){
  const key=form.dataset.thread,contact=GroupRooms.contact(key),raw=val(form,'t'),body=raw.trim();
  if(!GroupRooms.allowed()||!contact||GroupRooms.sending)return;
  if(!body||body.length>4000)return toast('Сообщение: от 1 до 4000 символов');
  const owner=GroupRooms.owner;GroupRooms.sending=true;
  if(GroupRooms.pending?.key!==key||GroupRooms.pending?.body!==body)GroupRooms.pending={key,body,nonce:crypto.randomUUID()};
  const button=form.querySelector('[data-action="save-form"]');button.disabled=true;
  try{await GroupRooms.call('group_room_send',{p_tenant:contact.tenant_id,p_body:body,p_nonce:GroupRooms.pending.nonce});GroupRooms.reset();if(owner!==GroupRooms.owner)return;
   GroupRooms.pending=null;if(val(form,'t')===raw){form.querySelector('textarea').value='';if(ui.chatDrafts)delete ui.chatDrafts[chatDraftKey('room:'+key)];}
   await GroupRooms.load(key);App.render();
  }catch(e){if(owner===GroupRooms.owner)toast(e.message);}
  finally{if(owner===GroupRooms.owner)GroupRooms.sending=false;button.disabled=false;}
 },
 unread(){return GroupRooms.allowed()&&GroupRooms.owner===[Cloud.uid,Cloud.tenantId,Cloud.role].join(':')?GroupRooms.contacts.reduce((n,r)=>n+(Number(r.unread)||0),0):0;},
 contactsHtml(){
  if(!GroupRooms.allowed())return '';GroupRooms.reset();GroupRooms.refresh();
  return (GroupRooms.error?'<p class="warn">'+U.esc(GroupRooms.error)+' <button class="btn sm" data-action="group-rooms-refresh">Повторить</button></p>':'')+
   (GroupRooms.contacts.length?'<section class="curator-chat-contacts"><h2>Групповые чаты с куратором</h2><div class="chat-list">'+GroupRooms.contacts.map(r=>chatRow({id:'room:'+r.tenant_id,title:r.name,subtitle:'Вся группа и куратор',preview:r.last||'Общий чат группы',time:r.at?chatTime(r.at):'',unread:r.unread,avatar:'<span class="ico">👥</span>'})).join('')+'</div></section>':'');
 },
 threadHtml(key){
  const row=GroupRooms.contact(key);if(!GroupRooms.allowed()||!row)return '<button class="btn" data-action="chat-back">← Чаты</button><p class="warn">Чат недоступен. Обновите список контактов.</p>';
  const rows=GroupRooms.threads[key],older=GroupRooms.historyMore[key];
  return '<div class="page-head"><button class="btn sm" data-action="chat-back">← Чаты</button><div><h2>'+U.esc(row.name)+'</h2><p>'+'Вся группа и куратор'+'</p></div></div><div class="card peer-thread"><div class="peer-scroll">'+
   (older?'<button class="btn sm" data-action="group-room-older" data-key="'+U.esc(key)+'">Более ранние сообщения</button>':'')+
   (rows?rows.map(m=>'<div class="peer-message'+(m.sender===Cloud.uid?' mine':'')+'"><div class="room-author">'+avatarOf(m.avatar,30,m.sender,m.role)+Mascot.svg('happy',30,'',{look:Wardrobe.normalize(m.mascot),season:''})+'<b>'+U.esc(m.name)+(m.role==='curator'?' · Куратор':'')+'</b></div><p>'+U.esc(m.body).replace(/\n/g,'<br>')+'</p><small>'+U.esc(chatTime(m.created_at))+(m.sender===Cloud.uid?messageReceipt(Number(m.read_count)>0):'')+'</small></div>').join('')||'<div class="empty">Начните переписку 👋</div>':'<p role="status">Загружаем сообщения…</p>')+
   '</div>'+(GroupRooms.error?'<p class="warn">'+U.esc(GroupRooms.error)+'</p>':'')+'<div class="chat-in" data-form="group-room" data-thread="'+U.esc(key)+'">'+chatComposer('groupRoomIn','room:'+key,'Написать сообщение…')+'<button class="btn primary" data-action="save-form" aria-label="Отправить сообщение">➤</button></div></div>';
 }
};
Object.assign(A,{'group-rooms-refresh':()=>GroupRooms.refresh(true),'group-room-older':el=>GroupRooms.load(el.dataset.key,true)});
Forms['group-room']=form=>GroupRooms.send(form);
setInterval(()=>{if(!document.hidden&&GroupRooms.allowed()){GroupRooms.refresh();if(ui.tab==='chat'&&(ui.chatWith||'').startsWith('room:'))GroupRooms.load(ui.chatWith.slice(5));}},5000);
