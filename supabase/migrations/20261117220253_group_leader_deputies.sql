-- Deputies remain students. No change to is_admin(), admin roles or general document policies.
create table politeshik_private.group_deputies(
 tenant_id text not null, uid uuid not null references public.members(uid) on delete cascade,
 assigned_by uuid not null references auth.users(id) on delete cascade, assigned_at timestamptz not null default now(),
 primary key(tenant_id,uid));
alter table politeshik_private.group_deputies enable row level security;
revoke all on politeshik_private.group_deputies from public,anon,authenticated;
create table politeshik_private.deputy_audit(
 id bigint generated always as identity primary key, tenant_id text not null, actor uuid not null,
 target uuid not null, action text not null, details jsonb not null default '{}', created_at timestamptz not null default now());
alter table politeshik_private.deputy_audit enable row level security;
revoke all on politeshik_private.deputy_audit from public,anon,authenticated;
create function politeshik_private.is_deputy(p_uid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select p_uid is not null and exists(
 select 1 from politeshik_private.group_deputies d join public.members m on m.uid=d.uid and m.tenant_id=d.tenant_id
 where d.uid=p_uid and m.status='approved' and m.role='student' and coalesce(m.requested_role,'student')='student'
 and (exists(select 1 from politeshik_private.super_admins s where s.uid=d.assigned_by)
 or exists(select 1 from public.admins a join public.members leader on leader.uid=a.uid and leader.tenant_id=a.tenant_id
 where a.uid=d.assigned_by and a.tenant_id=d.tenant_id and leader.status='approved' and leader.role='admin')))
$$;
revoke all on function politeshik_private.is_deputy(uuid) from public,anon,authenticated;
create function politeshik_private.deputy_context() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t text:=public.current_tenant(); actor uuid:=auth.uid(); manager boolean:=public.is_admin(); mine boolean; people jsonb; candidates jsonb:='[]'; journal jsonb:='[]';begin
 if actor is null or not public.is_member() then raise exception 'Нужно войти в группу' using errcode='42501';end if;
 mine:=politeshik_private.is_deputy(actor);
 select coalesce(jsonb_agg(jsonb_build_object('uid',d.uid,'name',m.full_name) order by m.full_name),'[]') into people
 from politeshik_private.group_deputies d join public.members m on m.uid=d.uid where d.tenant_id=t and politeshik_private.is_deputy(d.uid);
 if manager then
 select coalesce(jsonb_agg(jsonb_build_object('rid',r.rid,'name',r.name,'uid',m.uid,'eligible',coalesce(m.role='student' and m.status='approved' and coalesce(m.requested_role,'student')='student',false)) order by r.name),'[]') into candidates
 from public.roster r left join public.docs p on p.tenant_id=t and p.path like 'profiles/%' and p.data->>'rid'=r.rid
 left join public.members m on m.uid=split_part(p.path,'/',2)::uuid and m.tenant_id=t
 where r.tenant_id=t and coalesce(r.flag,'')='';
 end if;
 if mine then
 select coalesce(jsonb_agg(jsonb_build_object('uid',m.uid,'profile',jsonb_build_object('name',coalesce(nullif(m.full_name,''),p.data->>'name'),'rid',r.rid,'subgroup',r.subgroup),
 'attendance',jsonb_build_object('marks',coalesce(a.data->'marks','{}'),'updated',a.data->'updated'), 'certs',coalesce(c.items,'[]'))),'[]') into journal
 from public.members m join public.docs p on p.tenant_id=t and p.path='profiles/'||m.uid::text
 join public.roster r on r.tenant_id=t and r.rid=p.data->>'rid' and coalesce(r.flag,'')=''
 left join public.docs a on a.tenant_id=t and a.path='attendance/'||m.uid::text
 left join lateral(select jsonb_agg(jsonb_build_object('id',x->>'id','from',x->>'from','to',x->>'to','pairs',x->'pairs','confirmed',true)) items
 from public.docs cert cross join lateral jsonb_array_elements(coalesce(cert.data->'items','[]')) x where cert.tenant_id=t and cert.path='certs/'||m.uid::text and x->>'confirmed'='true')c on true
 where m.tenant_id=t and m.status='approved' and m.role in('student','admin','developer') and coalesce(m.requested_role,'student')='student';
 end if;
 return jsonb_build_object('is_deputy',mine,'deputies',people,'candidates',candidates,'journal',journal);
end $$;
create function public.deputy_context() returns jsonb language sql stable security invoker set search_path='' as $$select politeshik_private.deputy_context()$$;
create function politeshik_private.set_group_deputy(p_uid uuid,p_enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare t text:=public.current_tenant();begin
 if auth.uid() is null or not public.is_admin() or p_enabled is null then raise exception 'Назначать замов может только староста' using errcode='42501';end if;
 if p_enabled then
 perform 1 from public.members m join public.docs p on p.tenant_id=t and p.path='profiles/'||m.uid::text
 join public.roster r on r.tenant_id=t and r.rid=p.data->>'rid' and coalesce(r.flag,'')=''
 where m.uid=p_uid and m.tenant_id=t and m.role='student' and m.status='approved' and coalesce(m.requested_role,'student')='student'
 and not exists(select 1 from politeshik_private.super_admins s where s.uid=m.uid) for update of m;
 if not found then raise exception 'Выберите зарегистрированного студента своей группы' using errcode='42501';end if;
 insert into politeshik_private.group_deputies(tenant_id,uid,assigned_by) values(t,p_uid,auth.uid())
 on conflict(tenant_id,uid) do update set assigned_by=excluded.assigned_by,assigned_at=now();
 else delete from politeshik_private.group_deputies where tenant_id=t and uid=p_uid;end if;
 insert into politeshik_private.deputy_audit(tenant_id,actor,target,action) values(t,auth.uid(),p_uid,case when p_enabled then 'appoint' else 'revoke' end);
 return politeshik_private.deputy_context();
end $$;
create function public.set_group_deputy(p_uid uuid,p_enabled boolean) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.set_group_deputy(p_uid,p_enabled)$$;
create function politeshik_private.deputy_marks(p_uid uuid,p_changes jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();t text:=public.current_tenant();marks jsonb;before_marks jsonb;k text;v text;day date;pair integer;result jsonb;saved_import text;saved_write text;begin
 if not politeshik_private.is_deputy(actor) then raise exception 'Нет полномочий зама старосты' using errcode='42501';end if;
 if jsonb_typeof(p_changes) is distinct from 'object' or p_changes='{}' or pg_column_size(p_changes)>10000 then raise exception 'Неверные отметки' using errcode='42501';end if;
 perform 1 from public.members m join public.docs p on p.tenant_id=t and p.path='profiles/'||m.uid::text
 join public.roster r on r.tenant_id=t and r.rid=p.data->>'rid' and coalesce(r.flag,'')=''
 where m.uid=p_uid and m.tenant_id=t and m.status='approved' and m.role in('student','admin','developer') and coalesce(m.requested_role,'student')='student';
 if not found then raise exception 'Студент другой группы или недоступен' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_uid::text,0));
 select coalesce(data->'marks','{}') into marks from public.docs where tenant_id=t and path='attendance/'||p_uid::text for update;
 marks:=coalesce(marks,'{}');before_marks:=marks;
 for k,v in select key,value from jsonb_each_text(p_changes) loop
 if k !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}\|[1-5]$' then raise exception 'Неверная пара' using errcode='42501';end if;
 day:=left(k,10)::date;pair:=split_part(k,'|',2)::integer;
 if day<'2026-10-01' or day>(now()at time zone 'Europe/Moscow')::date then raise exception 'Нельзя отмечать будущий день' using errcode='42501';end if;
 if marks->>k is not distinct from v then continue;end if;
 if v is null or v not in('п','н') or marks->>k in('у','уп') then raise exception 'Зам может ставить только П и Н; УП меняет староста' using errcode='42501';end if;
 if exists(select 1 from public.docs d cross join lateral jsonb_array_elements(coalesce(d.data->'items','[]')) c
 where d.tenant_id=t and d.path='certs/'||p_uid::text and c->>'confirmed'='true' and c->>'from'<=day::text and c->>'to'>=day::text
 and (coalesce(jsonb_array_length(c->'pairs'),0)=0 or c->'pairs' @>jsonb_build_array(pair))) then raise exception 'Пара закрыта подтверждённой справкой' using errcode='42501';end if;
 marks:=marks||jsonb_build_object(k,v);
 end loop;
 saved_import:=current_setting('app.import',true);saved_write:=current_setting('app.deputy_path',true);
 perform set_config('app.import','on',true);perform set_config('app.deputy_path','attendance/'||p_uid::text,true);
 -- Seed an empty document, then UPDATE: BEFORE INSERT must not mistake existing UP for a new UP.
 insert into public.docs(tenant_id,path,data)values(t,'attendance/'||p_uid::text,'{"marks":{}}')on conflict(tenant_id,path)do nothing;
 update public.docs set data=data||jsonb_build_object('marks',marks,'updated',now())where tenant_id=t and path='attendance/'||p_uid::text returning data into result;
 perform set_config('app.import',coalesce(saved_import,''),true);perform set_config('app.deputy_path',coalesce(saved_write,''),true);
 insert into politeshik_private.deputy_audit(tenant_id,actor,target,action,details)values(t,actor,p_uid,'attendance',jsonb_build_object('changes',p_changes,'before',before_marks));
 return result;
end $$;
create function public.deputy_marks(p_uid uuid,p_changes jsonb) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.deputy_marks(p_uid,p_changes)$$;
-- Only the checked deputy RPC may pass each group's additional attendance trigger.
do $outer$declare definition text;needle text:='and not public.is_admin() and not coalesce(';n integer;begin
 for n in 3..6 loop
 select pg_get_functiondef(('politeshik_private.guard_group'||n||'_document()')::regprocedure) into definition;
 if position(needle in definition)=0 then raise exception 'Unexpected group % guard',n;end if;
 definition:=replace(definition,needle,'and not public.is_admin() and not (coalesce(current_setting(''app.deputy_path'',true)=new.path,false) and politeshik_private.is_deputy(auth.uid())) and not coalesce(');
 execute definition;
 end loop;
end $outer$;
create function politeshik_private.deputy_publish_news(p_title text,p_body text,p_date date) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;begin
 if not politeshik_private.is_deputy(auth.uid()) then raise exception 'Нет полномочий зама старосты' using errcode='42501';end if;
 if nullif(trim(p_title),'') is null or char_length(p_title)>200 or char_length(coalesce(p_body,''))>10000 or p_date is null then raise exception 'Проверьте заголовок, текст и дату';end if;
 insert into public.news(tenant_id,title,body,news_date,created_by,kind)values(public.current_tenant(),trim(p_title),coalesce(p_body,''),p_date,auth.uid(),'post')returning id into result;
 return result;
end $$;
create function public.deputy_publish_news(p_title text,p_body text,p_date date) returns uuid language sql security invoker set search_path='' as $$select politeshik_private.deputy_publish_news(p_title,p_body,p_date)$$;
-- Preserve the social profile's existing authorization, adding just a public label.
do $outer$declare definition text;needle text:='result||politeshik_private.presence_status(p_uid)';begin
 select pg_get_functiondef('politeshik_private.social_profile(uuid)'::regprocedure)into definition;
 if position(needle in definition)=0 then raise exception 'Unexpected social profile';end if;
 definition:=replace(definition,needle,needle||'||jsonb_build_object(''is_deputy'',politeshik_private.is_deputy(p_uid))');execute definition;
end $outer$;
-- All new public functions are invoker wrappers around explicitly authorized private endpoints.
revoke all on function politeshik_private.deputy_context(),politeshik_private.set_group_deputy(uuid,boolean),politeshik_private.deputy_marks(uuid,jsonb),politeshik_private.deputy_publish_news(text,text,date),public.deputy_context(),public.set_group_deputy(uuid,boolean),public.deputy_marks(uuid,jsonb),public.deputy_publish_news(text,text,date) from public,anon;
grant execute on function politeshik_private.deputy_context(),politeshik_private.set_group_deputy(uuid,boolean),politeshik_private.deputy_marks(uuid,jsonb),politeshik_private.deputy_publish_news(text,text,date),public.deputy_context(),public.set_group_deputy(uuid,boolean),public.deputy_marks(uuid,jsonb),public.deputy_publish_news(text,text,date) to authenticated;
