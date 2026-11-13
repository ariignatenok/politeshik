'use strict';
const HomeworkProposals={
 owner:'',rows:[],loaded:false,loading:false,at:0,error:'',pendingSend:null,busy:false,
 allowed(){return Cloud.status==='online'&&Cloud.hasCabinet()&&(Cloud.isAdmin||!Cloud.isStaff&&['student','developer'].includes(Cloud.role));},
 canSubmit(){return HomeworkProposals.allowed()&&!Cloud.isAdmin;},
 key(){return [Cloud.uid,Cloud.tenantId,Cloud.role,!!Cloud.isAdmin].join(':');},
 reset(){const owner=HomeworkProposals.key();if(owner!==HomeworkProposals.owner)Object.assign(HomeworkProposals,{owner,rows:[],loaded:false,loading:false,at:0,error:'',pendingSend:null,busy:false});},
 async call(name,args={}){const {data,error}=await supa.rpc(name,args);if(error)throw Error(error.message);return data;},
 async load(force=false){if(!HomeworkProposals.allowed())return;HomeworkProposals.reset();if(HomeworkProposals.loading||!force&&Date.now()-HomeworkProposals.at<15000)return;HomeworkProposals.loading=true;HomeworkProposals.at=Date.now();const owner=HomeworkProposals.owner;
  try{const rows=await HomeworkProposals.call('homework_proposal_list');if(owner!==HomeworkProposals.owner)return;const changed=JSON.stringify(rows)!==JSON.stringify(HomeworkProposals.rows)||!HomeworkProposals.loaded||HomeworkProposals.error;HomeworkProposals.rows=rows||[];HomeworkProposals.loaded=true;HomeworkProposals.error='';if(changed)App.renderSoft();}
  catch(error){if(owner===HomeworkProposals.owner){HomeworkProposals.error=error.message;App.renderSoft();}}
  finally{if(owner===HomeworkProposals.owner)HomeworkProposals.loading=false;}
 },
 pending(){return Cloud.isAdmin&&HomeworkProposals.owner===HomeworkProposals.key()?HomeworkProposals.rows.filter(r=>r.status==='pending').length:0;},
 button(subject=''){return HomeworkProposals.canSubmit()?'<button class="btn primary" data-action="hw-propose" data-subject="'+U.esc(subject)+'">＋ Предложить ДЗ</button>':'';},
 open(subject=''){if(!HomeworkProposals.canSubmit())return;HomeworkProposals.reset();if(!Store.s.subjects.length)return toast('Пока нет предметов. Дождитесь загрузки расписания или обратитесь к старосте.');
  UI.open('Предложить домашнее задание','<div data-form="hw-proposal"><p class="hint">Староста проверит предложение. После подтверждения ДЗ появится у всей группы.</p>'+field('Предмет','<select class="input" name="subjectId">'+subjectOptions(subject||ui.subjectId||'')+'</select>')+field('Задание','<textarea class="input" name="text" rows="5" maxlength="4000" placeholder="Что нужно сделать"></textarea>')+field('Срок сдачи (необязательно)','<input class="input" type="date" name="deadline">')+foot(null,'Отправить старосте')+'</div>',{wide:true});
 },
 async submit(form){if(!HomeworkProposals.canSubmit()||HomeworkProposals.busy)return;HomeworkProposals.reset();const subjectId=val(form,'subjectId'),subject=Store.s.subjects.find(s=>s.id===subjectId),body=val(form,'text').trim(),deadline=val(form,'deadline')||null;if(!subject||!body||body.length>4000)return toast('Выберите предмет и напишите задание (до 4000 символов)');
  const signature=JSON.stringify([subjectId,body,deadline]);if(HomeworkProposals.pendingSend?.signature!==signature)HomeworkProposals.pendingSend={signature,id:crypto.randomUUID()};
  const owner=HomeworkProposals.owner,button=form.querySelector('[data-action="save-form"]');button.disabled=true;HomeworkProposals.busy=true;
  try{await HomeworkProposals.call('homework_proposal_submit',{p_id:HomeworkProposals.pendingSend.id,p_subject:subjectId,p_subject_name:subject.name,p_body:body,p_deadline:deadline});if(owner!==HomeworkProposals.owner)return;HomeworkProposals.pendingSend=null;UI.close();await HomeworkProposals.load(true);App.render();toast('Предложение отправлено старосте');}
  catch(error){if(owner===HomeworkProposals.owner)toast(error.message);}
  finally{if(owner===HomeworkProposals.owner)HomeworkProposals.busy=false;button.disabled=false;}
 },
 async decide(el){if(!Cloud.isAdmin||HomeworkProposals.busy)return;HomeworkProposals.reset();const owner=HomeworkProposals.owner;el.disabled=true;HomeworkProposals.busy=true;
  try{const approved=el.dataset.approve==='true',result=await HomeworkProposals.call('homework_proposal_decide',{p_id:el.dataset.id,p_approve:approved});if(owner!==HomeworkProposals.owner)return;await HomeworkProposals.load(true);if(result.status==='approved')await Cloud.reloadExtra();App.render();toast(result.status==='approved'?'ДЗ опубликовано для группы':'Предложение отклонено');}
  catch(error){if(owner===HomeworkProposals.owner){toast(error.message);await HomeworkProposals.load(true);}}
  finally{if(owner===HomeworkProposals.owner)HomeworkProposals.busy=false;el.disabled=false;}
 },
 html(subject=''){
  if(!HomeworkProposals.allowed())return '';HomeworkProposals.reset();HomeworkProposals.load();const admin=Cloud.isAdmin,rows=HomeworkProposals.rows.filter(r=>!subject||r.subject_id===subject);
  if(!rows.length&&!HomeworkProposals.error)return '';
  return '<section class="card homework-proposals"><h2>'+(admin?'Предложения ДЗ · '+rows.length:'Мои предложения ДЗ')+'</h2><p class="hint">'+(admin?'Подтверждённые задания появятся у всей группы.':'Пока староста не подтвердит предложение, оно видно только вам и администрации вашей группы.')+'</p>'+(HomeworkProposals.error?'<p class="warn">'+U.esc(HomeworkProposals.error)+' <button class="btn sm" data-action="hw-proposals-refresh">Повторить</button></p>':'')+rows.map(r=>'<article class="homework-proposal"><b>'+U.esc(r.subject_name)+'</b>'+(admin?'<p class="hint">'+U.esc(r.author_name||'Студент группы')+'</p>':'')+'<p class="homework-proposal-text">'+U.esc(r.body)+'</p>'+(r.deadline?'<p class="hint">Срок: '+U.esc(r.deadline)+'</p>':'')+(admin?'<div class="head-actions"><button class="btn primary sm" data-action="hw-proposal-decide" data-id="'+r.id+'" data-approve="true">Подтвердить</button><button class="btn sm" data-action="hw-proposal-decide" data-id="'+r.id+'" data-approve="false">Отклонить</button></div>':'<span class="tag">'+({pending:'На проверке у старосты',approved:'Опубликовано',rejected:'Отклонено старостой'}[r.status]||r.status)+'</span>')+'</article>').join('')+'</section>';
 }
};
Object.assign(A,{'hw-propose':el=>HomeworkProposals.open(el?.dataset.subject),'hw-proposal-decide':el=>HomeworkProposals.decide(el),'hw-proposals-refresh':()=>HomeworkProposals.load(true)});
Forms['hw-proposal']=form=>HomeworkProposals.submit(form);
setInterval(()=>{if(!document.hidden&&HomeworkProposals.allowed())HomeworkProposals.load();},30000);
