-- Explicit management gateway. The platform developer is NOT an is_admin/is_super_admin member.
create table politeshik_private.platform_management_audit(id bigint generated always as identity primary key,actor uuid not null,tenant_id text,action text not null,target text,created_at timestamptz not null default now());
alter table politeshik_private.platform_management_audit enable row level security;
revoke all on politeshik_private.platform_management_audit from public,anon,authenticated;
create policy platform_management_private on politeshik_private.platform_management_audit for all to public using(false)with check(false);
create function politeshik_private.platform_manage(p_tenant text,p_action text,p_payload jsonb default '{}')returns jsonb language plpgsql security definer set search_path=''as $$
declare actor uuid:=auth.uid();target uuid;member public.members;result jsonb;extra jsonb;cfg jsonb;items jsonb;item jsonb;previous jsonb;collection text;item_id text;role_name text;status_name text;gid text;begin
 if not politeshik_private.platform_developer()then raise exception 'Нет прав разработчика платформы'using errcode='42501';end if;
 if p_action='profile' then return (select profile||jsonb_build_object('name',full_name,'role','developer')from politeshik_private.platform_developers where uid=actor);end if;
 if p_action='profile_save' then
  if pg_column_size(p_payload)>100000 or char_length(coalesce(p_payload->>'about',''))>500 or pg_column_size(p_payload->'mascot')>12000
  or (coalesce(p_payload->>'avatar','')<>'' and not(coalesce(p_payload->>'avatar','')~'^m[0-9]{1,2}$'or(p_payload->>'avatar'like'data:image/jpeg;base64,%'and char_length(p_payload->>'avatar')<60000)))then raise exception 'Некорректный профиль';end if;
  update politeshik_private.platform_developers set profile=jsonb_build_object('about',coalesce(p_payload->>'about',''),'avatar',coalesce(p_payload->>'avatar',''),'mascot',coalesce(p_payload->'mascot','{}'))where uid=actor;return jsonb_build_object('ok',true);
 end if;
 if not exists(select 1 from public.groups where tenant_id=p_tenant)then raise exception 'Неизвестная рабочая группа'using errcode='42501';end if;
 if p_action='users' then
  select coalesce(jsonb_agg(jsonb_build_object('uid',m.uid,'name',m.full_name,'email',u.email,'role',m.role,'status',m.status,'requested_role',m.requested_role,'child_uid',m.child_uid,'child_name',m.child_name,'note',m.note,'rid',p.data->>'rid','deputy',politeshik_private.is_deputy(m.uid),'protected',exists(select 1 from politeshik_private.super_admins where uid=m.uid))order by m.status='pending'desc,m.full_name),'[]')into result
  from public.members m join auth.users u on u.id=m.uid left join public.docs p on p.tenant_id=p_tenant and p.path='profiles/'||m.uid::text where m.tenant_id=p_tenant;return result;
 elsif p_action='group' then
  select data into cfg from public.docs where tenant_id=p_tenant and path='group/config';select data into extra from public.docs where tenant_id=p_tenant and path='group/extra';
  return jsonb_build_object('config',coalesce(cfg,'{}'),'extra',coalesce(extra,'{}'),'changes',coalesce((select data from public.docs where tenant_id=p_tenant and path='group/changes'),'{}'),
  'roster',coalesce((select jsonb_agg(jsonb_build_object('rid',r.rid,'name',r.name,'subgroup',r.subgroup,'uid',m.uid,'marks',coalesce(a.data->'marks','{}'),'certs',coalesce((select jsonb_agg(jsonb_build_object('from',c->>'from','to',c->>'to','pairs',c->'pairs','confirmed',true))from public.docs cert cross join lateral jsonb_array_elements(coalesce(cert.data->'items','[]'))c where cert.tenant_id=p_tenant and cert.path='certs/'||m.uid::text and c->>'confirmed'='true'),'[]'))order by r.n)
   from public.roster r left join public.docs p on p.tenant_id=p_tenant and p.path like'profiles/%'and p.data->>'rid'=r.rid
   left join public.members m on m.uid=split_part(p.path,'/',2)::uuid and m.tenant_id=p_tenant and m.status='approved'and coalesce(m.requested_role,'student')='student'
   left join public.docs a on a.tenant_id=p_tenant and a.path='attendance/'||m.uid::text where r.tenant_id=p_tenant),'[]'));
 elsif p_action='news' then return coalesce((select jsonb_agg(to_jsonb(n)order by n.news_date desc,n.created_at desc)from(select * from public.news where tenant_id=p_tenant order by news_date desc,created_at desc limit 100)n),'[]');
 elsif p_action in('status','role','deputy')then
  target:=(p_payload->>'uid')::uuid;select * into member from public.members where tenant_id=p_tenant and uid=target for update;
  if not found or exists(select 1 from politeshik_private.super_admins where uid=target)or exists(select 1 from politeshik_private.platform_developers where uid=target)then raise exception 'Этот аккаунт защищён'using errcode='42501';end if;
  if p_action='status'then
   status_name:=p_payload->>'status';if status_name not in('approved','rejected','banned','pending')or status_name is null then raise exception 'Некорректный статус';end if;
   update public.members set status=status_name,decided_at=now(),decided_by=actor where uid=target and tenant_id=p_tenant;
  elsif p_action='role'then
   role_name:=p_payload->>'role';if role_name is null or role_name not in('student','admin','developer','teacher','curator','department','parent')then raise exception 'Некорректная роль';end if;
   if role_name='parent'and member.child_uid is null then raise exception 'Сначала нужно связать родителя с ребёнком';end if;
   if role_name<>'teacher'and exists(select 1 from politeshik_private.faculty_claims where uid=target and status='approved')then raise exception 'Роль подтверждённого преподавателя закреплена за его карточкой';end if;
   update public.members set role=role_name,requested_role=case when role_name='parent'then'parent'when role_name in('teacher','curator','department')then'staff'else'student'end,status='approved',decided_at=now(),decided_by=actor where uid=target and tenant_id=p_tenant;
   if role_name='admin'then insert into public.admins(tenant_id,uid)values(p_tenant,target)on conflict do nothing;else delete from public.admins where tenant_id=p_tenant and uid=target;end if;
   if role_name='teacher'then insert into public.teachers(tenant_id,uid)values(p_tenant,target)on conflict do nothing;else delete from public.teachers where tenant_id=p_tenant and uid=target;end if;
  else
   if coalesce((p_payload->>'enabled')::boolean,false)then
    if member.status<>'approved'or member.role<>'student'or coalesce(member.requested_role,'student')<>'student'or not exists(select 1 from public.docs p join public.roster r on r.tenant_id=p_tenant and r.rid=p.data->>'rid'and r.flag=''where p.tenant_id=p_tenant and p.path='profiles/'||target::text)then raise exception 'Выберите зарегистрированного студента'using errcode='42501';end if;
    insert into politeshik_private.group_deputies(tenant_id,uid,assigned_by)values(p_tenant,target,actor)on conflict(tenant_id,uid)do update set assigned_by=excluded.assigned_by,assigned_at=now();
   else delete from politeshik_private.group_deputies where tenant_id=p_tenant and uid=target;end if;
  end if;
 elsif p_action='parent_child'then
  target:=(p_payload->>'uid')::uuid;
  if not exists(select 1 from public.members where tenant_id=p_tenant and uid=target and(role='parent'or requested_role='parent'))or not exists(select 1 from public.members where tenant_id=p_tenant and uid=(p_payload->>'child_uid')::uuid and status='approved'and role in('student','admin','developer')and coalesce(requested_role,'student')='student')then raise exception 'Выберите родителя и ребёнка из одной группы';end if;
  update public.members set child_uid=(p_payload->>'child_uid')::uuid,child_name=(select full_name from public.members where uid=(p_payload->>'child_uid')::uuid)where uid=target and tenant_id=p_tenant;
 elsif p_action='news_save'then
  if nullif(trim(p_payload->>'title'),'')is null or nullif(trim(p_payload->>'body'),'')is null then raise exception 'Заполните заголовок и текст';end if;
  if nullif(p_payload->>'id','')is null then insert into public.news(tenant_id,title,body,news_date,created_by)values(p_tenant,p_payload->>'title',p_payload->>'body',(p_payload->>'date')::date,actor);
  else update public.news set title=p_payload->>'title',body=p_payload->>'body',news_date=(p_payload->>'date')::date where tenant_id=p_tenant and id=(p_payload->>'id')::uuid and kind='post';if not found then raise exception 'Новость недоступна';end if;end if;
 elsif p_action='news_delete'then delete from public.news where tenant_id=p_tenant and id=(p_payload->>'id')::uuid;
 elsif p_action in('material_save','material_delete')then
  collection:=p_payload->>'collection';if collection is null or collection not in('notes','cards','homework')then raise exception 'Недопустимый тип материала'using errcode='42501';end if;
  select data into extra from public.docs where tenant_id=p_tenant and path='group/extra'for update;if extra is null then raise exception 'Материалы группы ещё не подготовлены';end if;
  items:=coalesce(extra->collection,'[]');item:=p_payload->'item';item_id:=coalesce(nullif(p_payload->>'id',''),nullif(item->>'id',''),gen_random_uuid()::text);
  select value into previous from jsonb_array_elements(items)where value->>'id'=item_id;
  if p_action='material_save'then
   if jsonb_typeof(item)is distinct from'object'or pg_column_size(item)>200000 then raise exception 'Некорректный материал';end if;
   if not exists(select 1 from public.docs d cross join lateral jsonb_array_elements(coalesce(d.data->'subjects','[]'))s where d.tenant_id=p_tenant and d.path in('group/config','group/extra')and s->>'id'=item->>'subjectId')then raise exception 'Выберите предмет группы';end if;
   -- Only material fields are accepted; unknown keys cannot become document paths or permissions.
   item:=jsonb_build_object('id',item_id,'subjectId',item->>'subjectId')||case collection
    when'notes'then jsonb_build_object('title',coalesce(item->>'title','Конспект'),'text',coalesce(item->>'text',''),'updated',now(),'files',coalesce(previous->'files','[]'))
    when'cards'then jsonb_build_object('q',item->>'q','a',item->>'a','cat',coalesce(item->>'cat',''),'link',coalesce(item->>'link',''))
    else jsonb_build_object('text',item->>'text','deadline',item->>'deadline')end;
   if collection='cards'and(nullif(trim(item->>'q'),'')is null or nullif(trim(item->>'a'),'')is null)then raise exception 'Заполните вопрос и ответ';end if;
  end if;
  items:=coalesce((select jsonb_agg(value)from jsonb_array_elements(items)where value->>'id'<>item_id),'[]');
  if p_action='material_save'then items:=items||jsonb_build_array(item);end if;
  update public.docs set data=jsonb_set(data,array[collection],items)where tenant_id=p_tenant and path='group/extra';
 else raise exception 'Действие недоступно разработчику: расписание и журнал доступны только для просмотра'using errcode='42501';end if;
 insert into politeshik_private.platform_management_audit(actor,tenant_id,action,target)values(actor,p_tenant,p_action,coalesce(target::text,p_payload->>'id'));
 return jsonb_build_object('ok',true);
end $$;
create function public.platform_manage(p_tenant text,p_action text,p_payload jsonb default '{}')returns jsonb language sql security invoker set search_path=''as $$select politeshik_private.platform_manage(p_tenant,p_action,p_payload)$$;
revoke all on function politeshik_private.platform_manage(text,text,jsonb),public.platform_manage(text,text,jsonb)from public,anon;
grant execute on function politeshik_private.platform_manage(text,text,jsonb),public.platform_manage(text,text,jsonb)to authenticated;

-- Allow only non-academic changes to extra material arrays; schedule projections must stay byte-for-byte equal.
do $outer$declare definition text;needle text:='if auth.uid()is not null and not public.is_admin()then';begin
 select pg_get_functiondef('politeshik_private.guard_schedule_document()'::regprocedure)into definition;
 if position(needle in definition)=0 then raise exception 'Unexpected academic guard';end if;
 execute replace(definition,needle,needle||E'\n if tg_op=''UPDATE''and new.path=''group/extra''and old.path=new.path and old.tenant_id=new.tenant_id and politeshik_private.platform_developer()and politeshik_private.schedule_projection(new.path,new.data)=politeshik_private.schedule_projection(old.path,old.data)then return new;end if;');
 select pg_get_functiondef('politeshik_private.is_deputy(uuid)'::regprocedure)into definition;
 needle:='or exists(select 1 from public.admins a';
 if position(needle in definition)=0 then raise exception 'Unexpected deputy issuer check';end if;
 execute replace(definition,needle,'or exists(select 1 from politeshik_private.platform_developers pd join auth.users pu on pu.id=pd.uid and lower(pu.email)=pd.email and pu.email_confirmed_at is not null where pd.active and pd.uid=d.assigned_by) '||needle);
end $outer$;
-- Existing faculty approval validation is preserved; only its authorized management audience is extended.
do $outer$declare definition text;name text;needle text:='if not politeshik_private.is_super_admin() then';begin
 foreach name in array array['faculty_requests()','faculty_decide(uuid,boolean)']loop
 select pg_get_functiondef(('politeshik_private.'||name)::regprocedure)into definition;
 if position(needle in definition)=0 then raise exception 'Unexpected faculty check';end if;
 execute replace(definition,needle,'if not politeshik_private.is_super_admin() and not politeshik_private.platform_developer() then');
 end loop;
end $outer$;

-- Reserved standalone identities cannot enroll into a group to obtain student/admin academic rights.
create function politeshik_private.guard_standalone_membership()returns trigger language plpgsql security definer set search_path=''as $$
begin
 if exists(select 1 from politeshik_private.platform_developers d join auth.users u on u.id=new.uid where d.active and(d.uid=new.uid or d.email=lower(u.email)))then raise exception 'Самостоятельный разработчик не прикрепляется к учебным группам'using errcode='42501';end if;
 return new;
end $$;
revoke all on function politeshik_private.guard_standalone_membership()from public,anon,authenticated;
create trigger platform_no_group_membership before insert or update on public.members for each row execute function politeshik_private.guard_standalone_membership();
-- Defense in depth for direct and legacy academic write routes, independent of RLS and client controls.
create function politeshik_private.guard_platform_academic_write()returns trigger language plpgsql security definer set search_path=''as $$
begin
 if not politeshik_private.platform_developer()then if tg_op='DELETE'then return old;else return new;end if;end if;
 if tg_table_name='docs'and tg_op<>'DELETE'then
  if tg_op='UPDATE'and new.path='group/extra'and old.path=new.path and old.tenant_id=new.tenant_id and politeshik_private.schedule_projection(new.path,new.data)=politeshik_private.schedule_projection(old.path,old.data)then return new;end if;
  -- Approved teacher/parent account operations may create a non-student profile for somebody else.
  -- Direct client writes still require their existing RLS ownership policy.
  if new.path like'profiles/%'and split_part(new.path,'/',2)<>auth.uid()::text and coalesce(new.data->>'rid','')=''then return new;end if;
 end if;
 raise exception 'Разработчику запрещено изменять расписание, журнал, справки и учебную привязку аккаунта'using errcode='42501';
end $$;
revoke all on function politeshik_private.guard_platform_academic_write()from public,anon,authenticated;
do $outer$declare table_name text;definition text;needle text:='  perform public.restore_rid_data(new.uid);';begin
 foreach table_name in array array['docs','attendance','attendance_import','certs','class_changes','group_docs']loop
 if to_regclass('public.'||table_name)is not null then execute format('create trigger platform_academic_read_only before insert or update or delete on public.%I for each row execute function politeshik_private.guard_platform_academic_write()',table_name);end if;
 end loop;
 -- Account approval never edits archived marks on the developer's behalf; students restore their own records on entry.
 select pg_get_functiondef('public.trg_members_restore()'::regprocedure)into definition;
 if position(needle in definition)=0 then raise exception 'Unexpected member restoration trigger';end if;
 execute replace(definition,needle,'  if politeshik_private.platform_developer()then return null;end if;'||E'\n'||needle);
end $outer$;
