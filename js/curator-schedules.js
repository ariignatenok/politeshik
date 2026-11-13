'use strict';
// Timetables use a separate projection and cache. Viewing a group never switches the curator's tenant or Store.
const CuratorSchedules={
 owner:'',tenant:null,week:null,cache:{},loading:false,error:'',token:0,at:0,
 allowed(){return Cloud.status==='online'&&Cloud.isCurator&&Cloud.member?.status==='approved'&&Cloud.curatorContext?.active===true;},
 groups(){return CuratorSchedules.allowed()?Cloud.curatorContext.groups||[]:[];},
 reset(){const key=[Cloud.uid,...CuratorSchedules.groups().map(g=>g.tenant_id)].join(':');if(key===CuratorSchedules.owner)return;Object.assign(CuratorSchedules,{owner:key,tenant:CuratorSchedules.groups()[0]?.tenant_id||null,week:U.iso(U.mondayOf(U.today())),cache:{},loading:false,error:'',at:0});CuratorSchedules.token++;},
 select(tenant){if(!CuratorSchedules.groups().some(g=>g.tenant_id===tenant))return;CuratorSchedules.token++;CuratorSchedules.loading=false;CuratorSchedules.tenant=tenant;CuratorSchedules.error='';CuratorSchedules.at=0;CuratorSchedules.load();App.render(true);},
 async snapshot(group,signal){let last;for(const base of ['https://raw.githubusercontent.com/ariignatenok/politeshik/main/data/','data/']){try{const r=await fetch(base+group.file+'?t='+Date.now(),{cache:'no-store',signal});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(!ScheduleSync.valid(data,group.number))throw Error('Получено расписание другой группы');return data;}catch(error){last=error;if(signal.aborted)throw error;}}throw last;},
 async load(force=false){if(!CuratorSchedules.allowed())return;CuratorSchedules.reset();const tenant=CuratorSchedules.tenant;if(!CuratorSchedules.groups().some(g=>g.tenant_id===tenant)||CuratorSchedules.loading||!force&&CuratorSchedules.cache[tenant]&&Date.now()-CuratorSchedules.at<300000)return;
  CuratorSchedules.loading=true;CuratorSchedules.error='';const owner=CuratorSchedules.owner,token=++CuratorSchedules.token,group=Groups.get(tenant),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const [meta,source]=await Promise.allSettled([supa.rpc('curator_group_schedule',{p_tenant:tenant}),CuratorSchedules.snapshot(group,controller.signal)]);if(owner!==CuratorSchedules.owner||token!==CuratorSchedules.token)return;
   if(meta.status==='rejected'||meta.value.error)throw Error(meta.reason?.message||meta.value.error.message);
   const bundle=meta.value.data;if(bundle?.tenant_id!==tenant||bundle.read_only!==true)throw Error('Не удалось проверить группу расписания');
   const old=CuratorSchedules.cache[tenant];CuratorSchedules.cache[tenant]={bundle,snapshot:source.status==='fulfilled'?source.value:old?.snapshot||null};CuratorSchedules.at=Date.now();if(source.status==='rejected')CuratorSchedules.error='Не удалось обновить расписание колледжа. '+(old?.snapshot?'Показана последняя копия.':'Доступны сохранённые старостой пары.');
  }catch(error){if(owner===CuratorSchedules.owner&&token===CuratorSchedules.token)CuratorSchedules.error=error.message;}
  finally{clearTimeout(timer);if(owner===CuratorSchedules.owner&&token===CuratorSchedules.token){CuratorSchedules.loading=false;App.renderSoft();}}
 },
 lessons(date,entry){
  const cfg=entry.bundle.config||{},subjects=cfg.subjects||[],lookup=id=>subjects.find(s=>s.id===id)?.name||id||'Предмет',start=U.iso(U.mondayOf(U.fromISO(date))),day=U.dayIdx(U.fromISO(date));
  const week=cfg.weeks?.[start],type=((Math.round(U.dayDiff(U.fromISO(cfg.anchor||'2026-10-12'),U.fromISO(start))/7)%2)+2)%2===0?'num':'den';
  const local=(week||cfg.schedule||[]).filter(l=>l.day===day&&(!l.week||l.week==='both'||l.week===type));
  const fromLocal=l=>({...l,subject:lookup(l.subjectId),teacher:l.who||'',classroom:l.room||'',status:'ok'}),published=entry.snapshot?.days?.[date];
  let rows=published&&!(week||[]).some(l=>l.manualWeek)?published.lessons.map(l=>({...l,pair:l.lesson_number})):local.filter(l=>!l.deleted).map(fromLocal);
  if(published&&!(week||[]).some(l=>l.manualWeek)){
   const cells=new Set(local.filter(l=>l.manualCell).map(l=>l.pair));rows=rows.filter(l=>!cells.has(l.pair)).concat(local.filter(l=>l.manualCell&&!l.deleted).map(fromLocal));
  }
  for(const change of entry.bundle.changes||[]){if(change.date!==date)continue;if(change.type==='cancel'){rows=rows.map(l=>l.pair===change.pair?{...l,status:'cancellation',note:change.reason}:l);}else{const old=rows.find(l=>l.pair===change.pair);rows=rows.filter(l=>l.pair!==change.pair);rows.push({pair:change.pair,subject:change.newSubjectId?lookup(change.newSubjectId):old?.subject||lookup(old?.subjectId),teacher:change.newTeacher||'',classroom:change.newRoom||'',status:'replacement',note:change.reason});}}
  return rows.sort((a,b)=>a.pair-b.pair||String(a.subgroup||'').localeCompare(String(b.subgroup||'')));
 },
 view(){if(!CuratorSchedules.allowed())return '<section class="card">Расписание групп доступно куратору после подтверждения доступа.</section>';CuratorSchedules.reset();CuratorSchedules.load();
  const selected=CuratorSchedules.groups().find(g=>g.tenant_id===CuratorSchedules.tenant),entry=CuratorSchedules.cache[CuratorSchedules.tenant],start=CuratorSchedules.week;
  let html='<div class="page-head"><div><h1>Расписание групп</h1><p>Занятия закреплённых за вами групп.</p></div></div><div class="curator-controls"><label>Группа<select class="input" data-curator-schedule="group">'+CuratorSchedules.groups().map(g=>'<option value="'+g.tenant_id+'"'+(g.tenant_id===CuratorSchedules.tenant?' selected':'')+'>'+U.esc(g.number)+'</option>').join('')+'</select></label><button class="btn" data-action="curator-schedule-refresh"'+(CuratorSchedules.loading?' disabled':'')+'>Обновить</button></div><div class="head-actions"><button class="btn" data-action="curator-schedule-week" data-d="-1">← Неделя</button><b>'+U.esc(start)+' — '+U.iso(U.addDays(U.fromISO(start),6))+'</b><button class="btn" data-action="curator-schedule-week" data-d="1">Неделя →</button></div>';
  if(CuratorSchedules.error)html+='<p class="warn">'+U.esc(CuratorSchedules.error)+'</p>';
  if(!entry)return html+'<section class="card">'+(CuratorSchedules.loading?'Загружаем расписание…':'Расписание пока недоступно.')+'</section>';
  html+='<p class="hint">'+U.esc(selected?.number||'')+' · Только просмотр'+(entry.snapshot?' · Источник: polytech-schedule.ru · '+U.esc(entry.snapshot.checked_at):'')+'</p>';
  if(entry.snapshot?.status==='awaiting_source')html+='<p class="hint">Колледж пока не опубликовал расписание этой группы. Ниже показаны сохранённые старостой пары, если они есть.</p>';
  for(let i=0;i<7;i++){const date=U.iso(U.addDays(U.fromISO(start),i)),rows=CuratorSchedules.lessons(date,entry);if(!rows.length&&i===6)continue;html+='<section class="card curator-schedule-day"><h2>'+U.esc(U.fmtLong(U.fromISO(date)))+'</h2>'+(rows.length?rows.map(l=>{const slot=entry.bundle.config?.pairs?.[l.pair-1]||{};return '<div class="item"><div class="item-main"><b>'+l.pair+' пара · '+U.esc(l.subject)+'</b><p>'+U.esc(Faculty.fullName(l.teacher||''))+'</p><div class="item-meta">'+(slot.start||slot.end?'<span class="tag">'+U.esc(slot.start||'')+' — '+U.esc(slot.end||'')+'</span>':'')+'<span class="tag">'+U.esc(l.classroom||'Аудитория не указана')+'</span>'+(l.subgroup?'<span class="tag">'+U.esc(String(l.subgroup).startsWith('подгр')?l.subgroup:'Подгруппа '+l.subgroup)+'</span>':'')+(l.status&&l.status!=='ok'?'<span class="tag">'+(l.status==='cancellation'?'Отмена':'Замена')+'</span>':'')+'</div>'+(l.note?'<p class="hint">'+U.esc(l.note)+'</p>':'')+'</div></div>'}).join(''):'<p class="hint">'+(entry.snapshot?.days?.[date]?'Занятий нет.':'На этот день данных пока нет.')+'</p>')+'</section>';}
  return html;
 }
};
Object.assign(A,{'curator-schedule-refresh':()=>CuratorSchedules.load(true),'curator-schedule-week':el=>{CuratorSchedules.week=U.iso(U.addDays(U.fromISO(CuratorSchedules.week),Number(el.dataset.d)*7));App.render();}});
document.addEventListener('change',e=>{if(e.target.dataset.curatorSchedule==='group')CuratorSchedules.select(e.target.value);});
setInterval(()=>{if(!document.hidden&&ui.tab==='groupSchedule'&&CuratorSchedules.allowed())CuratorSchedules.load();},60000);
