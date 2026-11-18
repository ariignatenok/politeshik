'use strict';

// Standalone staff workspace: no student membership, tenant adoption or normal group writers.
const PlatformAdmin = {
  tab:'home', tenant:null, bundle:null, users:[], news:[], faculty:[], loading:false, error:'', token:0, timer:null,
  active(){return Cloud.status==='online'&&Cloud.platformContext?.active===true;},
  groups(){return Cloud.platformContext?.groups||[];},
  activate(){PlatformAdmin.token++;PlatformAdmin.bundle=null;PlatformAdmin.users=[];PlatformAdmin.news=[];PlatformAdmin.faculty=[];PlatformAdmin.error='';PlatformAdmin.tenant=PlatformAdmin.groups()[0]?.tenant_id||null;PlatformAdmin.tab='home';ui.tab='dashboard';ui.chatWith=null;},
  start(){
    DevelopmentChat.refresh(true);
    if(PlatformAdmin.timer)return;
    PlatformAdmin.timer=setInterval(async()=>{
      if(!PlatformAdmin.active()||document.hidden)return;
      const uid=Cloud.uid,{data,error}=await supa.rpc('platform_context');
      if(uid!==Cloud.uid)return;
      if(error||!data?.active){PlatformAdmin.bundle=null;PlatformAdmin.users=[];PlatformAdmin.news=[];Cloud.platformContext=null;Cloud.profile=null;Cloud.status='offline';Cloud.err='Доступ разработчика закрыт или не подтверждён';App.render(true);return;}
      Cloud.platformContext=data;
    },60000);
  },
  async call(action,payload={}){
    const {data,error}=await supa.rpc('platform_manage',{p_tenant:PlatformAdmin.tenant,p_action:action,p_payload:payload});if(error)throw Error(error.message);return data;
  },
  async load(){
    if(!PlatformAdmin.active())return;
    const token=++PlatformAdmin.token,uid=Cloud.uid;PlatformAdmin.loading=true;PlatformAdmin.error='';App.renderSoft();
    try{
      const [bundle,users,news,faculty]=await Promise.all([PlatformAdmin.call('group'),PlatformAdmin.call('users'),PlatformAdmin.call('news'),supa.rpc('faculty_requests')]);
      if(token!==PlatformAdmin.token||uid!==Cloud.uid||!PlatformAdmin.active())return;
      if(faculty.error)throw Error(faculty.error.message);
      PlatformAdmin.bundle=bundle;PlatformAdmin.users=users;PlatformAdmin.news=news;PlatformAdmin.faculty=faculty.data||[];
    }catch(error){if(token===PlatformAdmin.token)PlatformAdmin.error=error.message;}
    finally{if(token===PlatformAdmin.token){PlatformAdmin.loading=false;App.renderSoft();}}
  },
  async mutation(action,payload){
    const uid=Cloud.uid,tenant=PlatformAdmin.tenant;
    try{await PlatformAdmin.call(action,payload);if(uid!==Cloud.uid||tenant!==PlatformAdmin.tenant)return false;await PlatformAdmin.load();toast('Сохранено');return true;}
    catch(error){toast(error.message);return false;}
  },
  async open(tab){
    if(!PlatformAdmin.active())return;
    PlatformAdmin.tab=tab;ui.tab=tab==='chat'?'chat':'dashboard';ui.chatWith=tab==='chat'?'development':null;App.render(true);
    if(tab==='chat')return DevelopmentChat.open();
    if(!['home','profile'].includes(tab))await PlatformAdmin.load();
  },
  subject(id){const b=PlatformAdmin.bundle||{};return (b.extra?.subjects||[]).find(s=>s.id===id)||(b.config?.subjects||[]).find(s=>s.id===id);},
  subjectOptions(value){const b=PlatformAdmin.bundle||{},subjects=[...new Map([...(b.config?.subjects||[]),...(b.extra?.subjects||[])].map(s=>[s.id,s])).values()];return subjects.map(s=>'<option value="'+U.esc(s.id)+'"'+(s.id===value?' selected':'')+'>'+U.esc(s.name||s.short)+'</option>').join('');},
  usersHtml(){
    const roles={student:'Студент',admin:'Староста',developer:'Разработчик',teacher:'Преподаватель',curator:'Куратор',department:'Отделение',parent:'Родитель'};
    return '<div class="platform-users">'+PlatformAdmin.users.map(m=>'<article class="card"><h3>'+U.esc(m.name||'Без ФИО')+'</h3><p>'+U.esc(m.email||'')+'</p><p>'+U.esc(roles[m.role]||m.role)+' · '+U.esc({approved:'Одобрен',pending:'Ожидает одобрения',banned:'Заблокирован',rejected:'Отклонён'}[m.status]||m.status)+(m.deputy?' · Зам старосты':'')+'</p>'+(m.note?'<p>'+U.esc(m.note)+'</p>':'')+
      (m.protected?'<span class="tag">Защищённый аккаунт Супер-админа</span>':'<div class="head-actions">'+
       (m.status==='pending'?'<button class="btn primary sm" data-action="platform-status" data-uid="'+m.uid+'" data-status="approved">Одобрить</button><button class="btn sm" data-action="platform-status" data-uid="'+m.uid+'" data-status="rejected">Отклонить</button>':'')+
       '<button class="btn sm" data-action="platform-status" data-uid="'+m.uid+'" data-status="'+(m.status==='banned'?'approved':'banned')+'">'+(m.status==='banned'?'Разблокировать':'Заблокировать')+'</button><button class="btn sm" data-action="platform-role" data-uid="'+m.uid+'">Роль</button>'+
       ((m.role==='student'&&m.status==='approved'&&m.rid)||m.deputy?'<button class="btn sm" data-action="platform-deputy" data-uid="'+m.uid+'" data-enabled="'+(m.deputy?'0':'1')+'">'+(m.deputy?'Снять полномочия зама':'Назначить замом')+'</button>':'')+
       (m.role==='parent'||m.requested_role==='parent'?'<button class="btn sm" data-action="platform-parent" data-uid="'+m.uid+'">Выбрать ребёнка</button>':'')+'</div>')+'</article>').join('')+'</div>'+
      '<section class="card"><h2>Заявки преподавателей · все группы</h2>'+PlatformAdmin.faculty.filter(x=>x.status==='pending').map(m=>'<div class="deputy-row"><div><b>'+U.esc(m.name)+'</b><small>'+U.esc(m.email)+'</small></div><div class="head-actions"><button class="btn sm primary" data-action="platform-faculty" data-uid="'+m.uid+'" data-approve="true">Одобрить</button><button class="btn sm" data-action="platform-faculty" data-uid="'+m.uid+'" data-approve="false">Отклонить</button></div></div>').join('')+'</section>';
  },
  newsHtml(){return '<button class="btn primary" data-action="platform-news">Добавить новость</button>'+PlatformAdmin.news.map(n=>'<article class="card"><h3>'+U.esc(n.title)+'</h3><p>'+U.esc(n.body).replace(/\n/g,'<br>')+'</p><small>'+U.esc(n.news_date)+'</small><div class="head-actions">'+(n.kind==='post'?'<button class="btn sm" data-action="platform-news" data-id="'+n.id+'">Изменить</button>':'')+'<button class="btn sm" data-action="platform-news-delete" data-id="'+n.id+'">Удалить</button></div></article>').join('');},
  materialsHtml(){const extra=PlatformAdmin.bundle?.extra||{};return ['notes','cards','homework'].map(collection=>'<section class="card"><div class="section-head"><h2>'+({notes:'Конспекты',cards:'Карточки',homework:'Домашние задания'}[collection])+'</h2><button class="btn sm primary" data-action="platform-material" data-collection="'+collection+'">Добавить</button></div>'+(extra[collection]||[]).map(x=>'<div class="deputy-row"><div><b>'+U.esc(x.title||x.q||x.text||'Без названия')+'</b><small>'+U.esc(PlatformAdmin.subject(x.subjectId)?.name||'Предмет')+'</small></div><div class="head-actions"><button class="btn sm" data-action="platform-material" data-collection="'+collection+'" data-id="'+U.esc(x.id)+'">Изменить</button><button class="btn sm" data-action="platform-material-delete" data-collection="'+collection+'" data-id="'+U.esc(x.id)+'">Удалить</button></div></div>').join('')+'</section>').join('');},
  scheduleHtml(){
    const cfg=PlatformAdmin.bundle?.config||{},weeks=cfg.weeks||{},weekKeys=Object.keys(weeks).sort();
    const rows=Array.isArray(cfg.schedule)?cfg.schedule:[];
    const table=(list)=>'<div class="tbl-wrap"><table class="grid-tbl"><thead><tr><th>День</th><th>Пара</th><th>Предмет</th><th>Преподаватель / аудитория</th></tr></thead><tbody>'+(Array.isArray(list)?list:[]).map(l=>'<tr><td>'+U.esc(['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][Number(l.day)]||l.date||'')+'</td><td>'+U.esc(l.pair)+'</td><td>'+U.esc(PlatformAdmin.subject(l.subjectId)?.name||l.subjectId||'')+'</td><td>'+U.esc(l.who||'')+'<br>'+U.esc(l.room||'')+'</td></tr>').join('')+'</tbody></table></div>';
    return '<p class="hint">Только просмотр. Расписание и замены меняют старосты и Супер-админ.</p><section class="card"><h2>Базовое расписание</h2>'+table(rows)+'</section>'+weekKeys.map(week=>'<details class="card"><summary>Неделя '+U.esc(week)+'</summary>'+table(Array.isArray(weeks[week])?weeks[week]:weeks[week]?.lessons||weeks[week]?.schedule||[])+'</details>').join('');
  },
  journalHtml(){
    const date=PlatformAdmin.journalDate||U.iso(U.today());
    return '<p class="hint">Только просмотр. Отметки и уважительные причины менять нельзя.</p><label class="field"><span>День</span><input class="input" type="date" data-platform-date value="'+date+'"></label><div class="tbl-wrap"><table class="grid-tbl"><thead><tr><th>Студент</th>'+[1,2,3,4,5].map(n=>'<th>'+n+' пара</th>').join('')+'</tr></thead><tbody>'+(PlatformAdmin.bundle?.roster||[]).map(r=>'<tr><td>'+U.esc(r.name)+'</td>'+[1,2,3,4,5].map(n=>'<td>'+U.esc((Att.eff(r.marks||{},r.certs||[],date,n)||'—').toUpperCase())+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  },
  profileHtml(){const p=Cloud.profile||{};return '<section class="card"><h2>'+U.esc(p.name||Cloud.platformContext.name)+'</h2><p><span class="tag">Разработчик</span> · Самостоятельный аккаунт, без учебной группы</p>'+avatarOf(p.avatar,72).replace(/ data-action="profile-photo"| role="button"| tabindex="0"/g,'')+Mascot.svg('happy',90,'',{look:Wardrobe.normalize(p.mascot),season:''})+'<div data-form="platform-profile"><label class="field"><span>О себе</span><textarea class="input" name="about" maxlength="500">'+U.esc(p.about||'')+'</textarea></label><label class="field"><span>Фото профиля</span><input type="file" name="photo" accept="image/*" class="input"></label><label class="field"><span>Цвет Политешика</span><select class="input" name="body">'+['white','pink','blue'].map(x=>'<option value="'+x+'"'+(p.mascot?.body===x?' selected':'')+'>'+({white:'Белый',pink:'Розовый',blue:'Синий'}[x])+'</option>').join('')+'</select></label><button class="btn primary" data-action="save-form">Сохранить</button></div></section>';},
  render(){
    document.body.classList.remove('gated','ro');document.body.classList.add('platform-workspace');$('#gate').hidden=true;$('#gate').innerHTML='';
    let switcher=$('#group-switch');if(switcher)switcher.innerHTML='';
    const nav=[['home','Панель разработчика'],['profile','Личный кабинет'],['users','Аккаунты и заявки'],['news','Новости'],['materials','Учебные материалы'],['schedule','Расписание · просмотр'],['journal','Журнал · просмотр'],['chat','Разработка']];
    const buttons=nav.map(([key,title])=>'<button class="nav-btn'+(PlatformAdmin.tab===key?' on':'')+'" data-action="platform-tab" data-tab="'+key+'">'+title+(key==='chat'&&DevelopmentChat.unread()?' · '+DevelopmentChat.unread():'')+'</button>').join('');
    $('#nav-side').innerHTML=buttons+'<button class="nav-btn" data-action="logout">Выйти</button>';
    $('#nav-bottom').innerHTML=nav.map(([key,title])=>'<button data-action="platform-tab" data-tab="'+key+'">'+title+'</button>').join('');
    const group=PlatformAdmin.groups().find(g=>g.tenant_id===PlatformAdmin.tenant);
    const selector=['home','profile','chat'].includes(PlatformAdmin.tab)?'':'<label class="field"><span>Просматриваемая группа · не является вашей группой</span><select class="input" data-platform-group>'+PlatformAdmin.groups().map(g=>'<option value="'+g.tenant_id+'"'+(g.tenant_id===PlatformAdmin.tenant?' selected':'')+'>'+U.esc(g.name)+'</option>').join('')+'</select></label>';
    const head='<div class="page-head"><div><h1>'+U.esc(nav.find(x=>x[0]===PlatformAdmin.tab)?.[1]||'Разработчик')+'</h1><p>'+U.esc(Cloud.platformContext.name)+' · Разработчик · без учебной группы</p></div></div>';
    let body='';
    if(PlatformAdmin.tab==='home')body='<section class="card"><h2>Управление приложением</h2><p>Аккаунты, заявки, роли, заместители, новости и учебные материалы всех групп. Расписание и журнал доступны только для просмотра.</p><div class="head-actions">'+nav.filter(x=>!['home','profile'].includes(x[0])).map(([key,title])=>'<button class="btn" data-action="platform-tab" data-tab="'+key+'">'+title+'</button>').join('')+'</div></section>'+DevelopmentChat.contactsHtml();
    else if(PlatformAdmin.tab==='chat')body=ui.chatWith==='development'?DevelopmentChat.threadHtml():DevelopmentChat.contactsHtml();
    else if(PlatformAdmin.tab==='profile')body=PlatformAdmin.profileHtml();
    else if(PlatformAdmin.loading)body='<p role="status">Загружаем данные…</p>';
    else if(PlatformAdmin.error)body='<p class="warn">'+U.esc(PlatformAdmin.error)+'</p><button class="btn" data-action="platform-refresh">Повторить</button>';
    else body=({users:PlatformAdmin.usersHtml,news:PlatformAdmin.newsHtml,materials:PlatformAdmin.materialsHtml,schedule:PlatformAdmin.scheduleHtml,journal:PlatformAdmin.journalHtml}[PlatformAdmin.tab]||(()=>''))();
    const view=$('#view'),html=head+selector+body;
    if(view.innerHTML!==html){const snapshot=App.scrollSnapshot(view),focus=document.activeElement?.matches('textarea[data-chat-draft]')?{id:document.activeElement.id,start:document.activeElement.selectionStart,end:document.activeElement.selectionEnd}:null;view.innerHTML=html;view.querySelectorAll('textarea[data-chat-draft]').forEach(UI.resizeComposer);App.scrollRestore(view,snapshot);if(focus){const input=document.getElementById(focus.id);if(input){input.focus({preventScroll:true});input.setSelectionRange(focus.start,focus.end);}}}
    App.shown=ui.tab;
  }
};
if(new URLSearchParams(location.search).get('developer')==='1')ui.loginRole='developer';
Object.assign(A,{
 'platform-tab':el=>PlatformAdmin.open(el.dataset.tab),
 'platform-refresh':()=>PlatformAdmin.load(),
 async 'platform-status'(el){el.disabled=true;await PlatformAdmin.mutation('status',{uid:el.dataset.uid,status:el.dataset.status});if(el.isConnected)el.disabled=false;},
 'platform-role'(el){const m=PlatformAdmin.users.find(x=>x.uid===el.dataset.uid);if(!m)return;UI.open('Роль пользователя','<p>'+U.esc(m.name)+'</p><div data-form="platform-role" data-uid="'+m.uid+'"><select class="input" name="role">'+Object.entries({student:'Студент',admin:'Староста',developer:'Разработчик группы',teacher:'Преподаватель',curator:'Куратор',department:'Отделение',parent:'Родитель'}).map(([key,label])=>'<option value="'+key+'"'+(m.role===key?' selected':'')+'>'+label+'</option>').join('')+'</select><div class="modal-foot"><button class="btn primary" data-action="save-form">Сохранить</button></div></div>');},
 'platform-parent'(el){UI.open('Ребёнок родителя','<div data-form="platform-parent" data-uid="'+el.dataset.uid+'"><label class="field"><span>Студент этой группы</span><select class="input" name="child_uid">'+PlatformAdmin.users.filter(x=>x.status==='approved'&&['student','admin','developer'].includes(x.role)).map(x=>'<option value="'+x.uid+'">'+U.esc(x.name)+'</option>').join('')+'</select></label><button class="btn primary" data-action="save-form">Сохранить</button></div>');},
 'platform-deputy':el=>PlatformAdmin.mutation('deputy',{uid:el.dataset.uid,enabled:el.dataset.enabled==='1'}),
 async 'platform-faculty'(el){el.disabled=true;try{const {error}=await supa.rpc('faculty_decide',{p_uid:el.dataset.uid,p_approve:el.dataset.approve==='true'});if(error)throw error;await PlatformAdmin.load();toast('Заявка рассмотрена');}catch(e){toast(e.message)}finally{if(el.isConnected)el.disabled=false}},
 'platform-news'(el){const n=PlatformAdmin.news.find(x=>x.id===el.dataset.id)||{};UI.open('Новость группы','<div data-form="platform-news" data-id="'+(n.id||'')+'">'+field('Заголовок','<input class="input" name="title" maxlength="200" value="'+U.esc(n.title||'')+'">')+field('Текст','<textarea class="input" name="body" rows="6" maxlength="10000">'+U.esc(n.body||'')+'</textarea>')+field('Дата','<input class="input" type="date" name="date" value="'+(n.news_date||U.iso(U.today()))+'">')+foot(null,'Опубликовать')+'</div>');},
 async 'platform-news-delete'(el){if(await UI.confirm('Удалить новость?'))await PlatformAdmin.mutation('news_delete',{id:el.dataset.id});},
 'platform-material'(el){const c=el.dataset.collection,item=(PlatformAdmin.bundle?.extra?.[c]||[]).find(x=>x.id===el.dataset.id)||{};if(!['notes','cards','homework'].includes(c))return;const text=(name,label,rows=4)=>field(label,'<textarea class="input" name="'+name+'" rows="'+rows+'">'+U.esc(item[name]||'')+'</textarea>');UI.open('Учебный материал','<div data-form="platform-material" data-collection="'+c+'" data-id="'+U.esc(item.id||'')+'">'+field('Предмет','<select class="input" name="subjectId">'+PlatformAdmin.subjectOptions(item.subjectId)+'</select>')+(c==='notes'?field('Название','<input class="input" name="title" value="'+U.esc(item.title||'')+'">')+text('text','Конспект',8):c==='cards'?text('q','Вопрос')+text('a','Ответ'):text('text','Задание',6)+field('Срок','<input class="input" type="date" name="deadline" value="'+U.esc(item.deadline||'')+'">'))+foot(null,'Сохранить')+'</div>');},
 async 'platform-material-delete'(el){if(await UI.confirm('Удалить материал у группы?'))await PlatformAdmin.mutation('material_delete',{collection:el.dataset.collection,id:el.dataset.id});}
});
Forms['platform-role']=async form=>{if(await PlatformAdmin.mutation('role',{uid:form.dataset.uid,role:val(form,'role')}))UI.close();};
Forms['platform-parent']=async form=>{if(await PlatformAdmin.mutation('parent_child',{uid:form.dataset.uid,child_uid:val(form,'child_uid')}))UI.close();};
Forms['platform-news']=async form=>{if(await PlatformAdmin.mutation('news_save',{id:form.dataset.id,title:val(form,'title').trim(),body:val(form,'body').trim(),date:val(form,'date')}))UI.close();};
Forms['platform-material']=async form=>{const item={subjectId:val(form,'subjectId')};['title','text','q','a','deadline'].forEach(k=>{if(form.querySelector('[name="'+k+'"]'))item[k]=val(form,k)});if(await PlatformAdmin.mutation('material_save',{collection:form.dataset.collection,id:form.dataset.id,item}))UI.close();};
Forms['platform-profile']=async form=>{
 const button=form.querySelector('[data-action="save-form"]');button.disabled=true;
 try{
  let avatar=Cloud.profile?.avatar||'';const photo=form.querySelector('[name="photo"]').files[0];
  if(photo){const url=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(photo)});const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url});const canvas=document.createElement('canvas');const ratio=Math.min(1,400/Math.max(img.width,img.height));canvas.width=Math.round(img.width*ratio);canvas.height=Math.round(img.height*ratio);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);avatar=canvas.toDataURL('image/jpeg',.82);if(avatar.length>=60000)avatar=canvas.toDataURL('image/jpeg',.55);if(avatar.length>=60000)throw Error('Фото слишком большое, выберите другое');}
  const profile={about:val(form,'about'),avatar,mascot:{...(Cloud.profile?.mascot||{}),body:val(form,'body')}};
  await PlatformAdmin.call('profile_save',profile);Cloud.profile={...Cloud.profile,...profile};toast('Профиль сохранён');App.render();
 }catch(error){toast(error.message)}finally{if(button.isConnected)button.disabled=false;}
};
document.addEventListener('change',event=>{
 if(!PlatformAdmin.active())return;
 if(event.target.matches('[data-platform-group]')){PlatformAdmin.tenant=event.target.value;PlatformAdmin.bundle=null;PlatformAdmin.users=[];PlatformAdmin.news=[];PlatformAdmin.load();}
 if(event.target.matches('[data-platform-date]')){PlatformAdmin.journalDate=event.target.value;App.render();}
});
