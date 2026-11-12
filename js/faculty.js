'use strict';
// Public identity directory; access is granted only by the server after Arina's approval.
const Faculty = {
  data: null, loading: false, loadedAt: 0, admin: null, adminAt: 0, adminLoading: false,
  key(value) {
    const parts=String(value||'').trim().split(/\s+/);
    if(parts.length>=3 && parts.slice(1).every(p=>p.length>2)) value=parts[0]+' '+parts.slice(1).map(p=>p[0]+'.').join('');
    return String(value||'').toLowerCase().replace(/ё/g,'е').replace(/[\s.]/g,'');
  },
  nameIndex: null,
  fullName(value) {
    if(!Faculty.nameIndex){
      Faculty.nameIndex=new Map();
      for(const name of FACULTY_NAMES){const key=Faculty.key(name);Faculty.nameIndex.set(key,Faculty.nameIndex.has(key)?null:name);}
    }
    return Faculty.nameIndex.get(Faculty.key(value))||value;
  },
  fields(value='') {
    return '<label class="field"><span>Полное ФИО преподавателя</span><input class="input" name="teacher_name" list="faculty-names" autocomplete="name" value="'+U.esc(value)+'" placeholder="Начните вводить фамилию"><datalist id="faculty-names">'+FACULTY_NAMES.map(n=>'<option value="'+U.esc(n)+'"></option>').join('')+'</datalist></label><p class="hint">Выберите своё ФИО из списка. Доступ подтверждает Админ Арина.</p>';
  },
  async fetchJson(file) {
    if(file!=='faculty.json'&&!/^schedule-teacher-faculty-[a-f0-9]{12}\.json$/.test(file))throw Error('Неверный файл расписания');
    let last;
    for(const base of ['https://raw.githubusercontent.com/ariignatenok/politeshik/main/data/','data/']){
      try{const response=await fetch(base+file+'?t='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Не удалось загрузить расписание');return await response.json();}
      catch(error){last=error;}
    }
    throw last;
  },
  async load(force=false) {
    if(Faculty.loading||(!force&&Date.now()-Faculty.loadedAt<300000))return;
    Faculty.loading=true;
    try {
      const data=await Faculty.fetchJson('faculty.json');
      if(data.schema!==1||!Array.isArray(data.teachers)||data.teachers.length!==FACULTY_NAMES.length||data.teachers.some(t=>!FACULTY_NAMES.includes(t.name)))throw Error('Неверный справочник');
      Faculty.data=data;Faculty.loadedAt=Date.now();ScheduleSync.populateCatalog();App.renderSoft();
    } catch(error) { Faculty.loadedAt=Date.now()-240000; }
    finally {Faculty.loading=false;}
  },
  populate() {
    if(!Store.s)return;
    const rows=Store.s.teachers||[];
    rows.forEach(t=>{t.name=Faculty.fullName(t.name)});
    if(Faculty.data)for(const t of Faculty.data.teachers){
      const subjects=t.groups?.[Groups.get(Groups.current).number];if(!subjects?.length)continue;
      let row=rows.find(r=>Faculty.key(r.name)===Faculty.key(t.name));
      if(!row){row={id:t.id,name:t.name,subjectIds:[],email:'',phone:'',room:'',notes:''};rows.push(row);}
      for(const subject of subjects){const id=ScheduleSync.subject(subject);if(!row.subjectIds.includes(id))row.subjectIds.push(id);}
    }
    const unique=[];
    for(const row of rows){const old=unique.find(t=>Faculty.key(t.name)===Faculty.key(row.name));
      if(!old){unique.push(row);continue;}
      old.subjectIds=[...new Set([...old.subjectIds,...row.subjectIds])];for(const k of ['email','phone','room','notes'])if(!old[k]&&row[k])old[k]=row[k];
    }
    Store.s.teachers=unique;
  },
  subjectsHtml() {
    const context=Cloud.facultyContext;
    return '<div class="page-head"><h1>Мои предметы</h1></div>'+context.groups.map(g=>'<section class="card"><h2>'+U.esc(g.number)+'</h2>'+g.subjects.map(s=>'<p>'+U.esc(s)+' · '+U.esc(context.name)+'</p>').join('')+'</section>').join('');
  },
  async activate(name) {
    if(!FACULTY_NAMES.includes(name))return {ok:false,msg:'Выберите полное ФИО из списка преподавателей'};
    const {error}=await supa.rpc('faculty_request',{p_name:name});if(error)return {ok:false,msg:error.message};
    await Cloud.init();ui.justSubmitted=true;return {ok:true};
  },
  async loadAdmin(force=false) {
    if(!Cloud.isSuperAdmin||Faculty.adminLoading||(!force&&Date.now()-Faculty.adminAt<15000))return;
    Faculty.adminLoading=true;Faculty.adminAt=Date.now();const owner=Cloud.uid;
    try{const {data,error}=await supa.rpc('faculty_requests');if(error)throw error;if(owner===Cloud.uid&&Cloud.isSuperAdmin){Faculty.admin=data||[];App.renderSoft();}}
    catch(error){toast(error.message)}finally{Faculty.adminLoading=false;}
  },
  adminHtml() {
    if(!Cloud.isSuperAdmin)return '';Faculty.loadAdmin();
    const pending=(Faculty.admin||[]).filter(r=>r.status==='pending');
    return '<section class="card faculty-requests"><h2>Заявки преподавателей <button class="btn sm" data-action="faculty-requests-refresh">Обновить</button></h2><p class="hint">Доступ к преподавательскому кабинету выдаёте только вы. В справочнике подготовлено '+FACULTY_NAMES.length+' карточек.</p>'+(!Faculty.admin?'<p>Загружаем…</p>':pending.length?pending.map(r=>'<div class="item"><div class="item-main"><b>'+U.esc(r.name)+'</b><p>'+U.esc(r.email)+'</p></div><div class="head-actions"><button class="btn primary sm" data-action="faculty-decide" data-uid="'+r.uid+'" data-approve="true">Одобрить</button><button class="btn sm" data-action="faculty-decide" data-uid="'+r.uid+'" data-approve="false">Отклонить</button></div></div>').join(''):'<p class="hint">Новых заявок нет.</p>')+'</section>';
  },
  async directory() {
    await Faculty.load();
    const records=Faculty.data?.teachers||FACULTY_NAMES.map(name=>({name}));
    UI.open('Преподаватели колледжа','<p class="hint">Полные ФИО, предметы и группы сопоставлены по расписанию. Карточка становится учётной записью после регистрации и вашего подтверждения.</p><div class="items">'+records.map(t=>'<article class="item"><div class="item-main"><b>'+U.esc(t.name)+'</b>'+Object.entries(t.groups||{}).map(([g,s])=>'<p>'+U.esc(g)+' · '+U.esc(s.join(', '))+'</p>').join('')+(!Object.keys(t.groups||{}).length?'<p class="hint">В расписании добавленных групп занятий пока нет.</p>':'')+'</div><button class="btn sm" data-action="faculty-schedule" data-id="'+(t.id||'')+'">Расписание</button></article>').join('')+'</div>',{wide:true});
  },
  async timetable(id) {
    await Faculty.load();const row=Faculty.data?.teachers.find(t=>t.id===id);if(!row)return toast('Преподаватель не найден');
    if(!row.schedule_file)return UI.open(row.name,'<p>Сайт колледжа пока не предоставил расписание этого преподавателя. Проверяем автоматически.</p>');
    UI.open(row.name,'<p>Загружаем расписание…</p>');
    try{const data=await Faculty.fetchJson(row.schedule_file);
      if(data.kind!=='teacher'||Faculty.key(data.teacher)!==Faculty.key(row.teacher))throw Error('Расписание другого преподавателя');
      UI.open(row.name,'<p class="hint">Данные от '+U.esc(data.checked_at)+' · polytech-schedule.ru</p>'+Object.entries(data.days).filter(([date,d])=>date>=U.iso(U.mondayOf(U.today()))&&d.lessons.length).map(([date,d])=>'<section class="card"><h2>'+U.esc(U.fmtLong(U.fromISO(date)))+'</h2>'+d.lessons.map(l=>'<p><b>'+l.lesson_number+' пара · '+U.esc(l.subject)+'</b><br>'+l.group_list.map(U.esc).join(', ')+' · '+U.esc(l.classroom||l.auditorium||'Аудитория не указана')+'</p>').join('')+'</section>').join(''),{wide:true});
    }catch(error){toast(error.message)}
  }
};
Object.assign(A,{
  async 'faculty-check'(){await Cloud.init();$('#gate').dataset.mode='';App.render(true);},
  'faculty-directory':()=>Faculty.directory(),
  'faculty-schedule':el=>Faculty.timetable(el.dataset.id),
  'faculty-requests-refresh':()=>Faculty.loadAdmin(true),
  async 'faculty-decide'(el){el.disabled=true;try{const {error}=await supa.rpc('faculty_decide',{p_uid:el.dataset.uid,p_approve:el.dataset.approve==='true'});if(error)throw error;await Faculty.loadAdmin(true);App.render();toast(el.dataset.approve==='true'?'Доступ преподавателю открыт':'Заявка отклонена');}catch(error){toast(error.message)}finally{el.disabled=false}}
});

setInterval(async()=>{if(Cloud.status==='online'&&Cloud.facultyRequest?.status==='pending'&&!document.hidden){const {data,error}=await supa.rpc('faculty_context');if(!error&&data?.status!=='pending'){await Cloud.init();$('#gate').dataset.mode='';App.render(true);}}},15000);
