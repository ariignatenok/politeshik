create schema if not exists politeshik_private;
revoke all on schema politeshik_private from public, anon;
grant usage on schema politeshik_private to authenticated;

create table if not exists politeshik_private.super_admins (
  uid uuid primary key references auth.users(id) on delete cascade
);
create table if not exists politeshik_private.group_selection (
  uid uuid primary key references auth.users(id) on delete cascade,
  tenant_id text not null references public.tenants(id)
);
create table if not exists politeshik_private.staff_credentials (
  tenant_id text not null references public.tenants(id),
  role text not null check (role in ('admin','developer')),
  rid text not null references public.roster(rid),
  secret_hash text not null,
  primary key(tenant_id,role)
);
alter table politeshik_private.super_admins enable row level security;
alter table politeshik_private.group_selection enable row level security;
alter table politeshik_private.staff_credentials enable row level security;
revoke all on all tables in schema politeshik_private from public,anon,authenticated;

insert into politeshik_private.super_admins(uid)
select a.uid from public.admins a join public.docs d on d.tenant_id=a.tenant_id and d.path='profiles/'||a.uid::text
where a.tenant_id='group_1' and d.data->>'rid'='r32'
on conflict do nothing;

insert into public.tenants(id,name) values ('group_2','Группа 26290911/3111') on conflict(id) do nothing;
insert into public.groups(id,tenant_id,name) values ('g_26290911_3111','group_2','Группа 26290911/3111') on conflict(id) do nothing;
alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check check(role in ('student','admin','developer','teacher','curator','department','parent'));
create unique index if not exists members_one_home_group_idx on public.members(uid);

create or replace function politeshik_private.is_super_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from politeshik_private.super_admins a where a.uid=auth.uid())
$$;
create or replace function politeshik_private.active_tenant() returns text
language sql stable security definer set search_path='' as $$
  select coalesce(
    (select nullif(current_setting('request.headers',true),'')::jsonb->>'x-politeshik-group'
      where politeshik_private.is_super_admin() and nullif(current_setting('request.headers',true),'')::jsonb->>'x-politeshik-group' in ('group_1','group_2')),
    (select s.tenant_id from politeshik_private.group_selection s where s.uid=auth.uid() and politeshik_private.is_super_admin()),
    (select m.tenant_id from public.members m where m.uid=auth.uid()),
    'group_1')
$$;
create or replace function public.current_tenant() returns text
language sql stable set search_path='' as $$ select politeshik_private.active_tenant() $$;
create or replace function politeshik_private.group_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (politeshik_private.is_super_admin() or exists(
    select 1 from public.admins a join public.members m on m.uid=a.uid and m.tenant_id=a.tenant_id
    where a.uid=auth.uid() and a.tenant_id=public.current_tenant() and m.status='approved' and m.role='admin'))
$$;
create or replace function public.is_admin() returns boolean
language sql stable set search_path='' as $$ select politeshik_private.group_admin() $$;
create or replace function politeshik_private.is_developer() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.members m
    where m.uid=auth.uid() and m.tenant_id=public.current_tenant() and m.role='developer' and m.status='approved')
$$;
create or replace function public.is_developer() returns boolean
language sql stable set search_path='' as $$ select politeshik_private.is_developer() $$;

create or replace function public.set_tenant() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' and new.tenant_id is distinct from old.tenant_id then raise exception 'Группу записи менять нельзя'; end if;
  if new.tenant_id is null then new.tenant_id:=public.current_tenant(); end if;
  return new;
end $$;

create or replace function politeshik_private.group_context() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare t text:=public.current_tenant(); u uuid:=auth.uid(); home text; profile jsonb; member jsonb;
begin
  if u is null then raise exception 'Нужно войти в аккаунт'; end if;
  select m.tenant_id into home from public.members m where m.uid=u;
  select d.data into profile from public.docs d where d.tenant_id=coalesce(home,'group_1') and d.path='profiles/'||u::text;
  select to_jsonb(m) into member from public.members m where m.tenant_id=t and m.uid=u;
  if politeshik_private.is_super_admin() then
    member:=coalesce(member,jsonb_build_object('uid',u,'tenant_id',t,'role','admin','status','approved','full_name','Админ Арина'));
  end if;
  return jsonb_build_object('uid',u,'tenant_id',t,'home_tenant',coalesce(home,'group_1'),
    'is_super_admin',politeshik_private.is_super_admin(),'is_admin',public.is_admin(),
    'is_developer',public.is_developer(),'member',member,'profile',profile);
end $$;
create or replace function public.group_context() returns jsonb
language sql stable set search_path='' as $$ select politeshik_private.group_context() $$;
create or replace function politeshik_private.select_group(p_tenant text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if not politeshik_private.is_super_admin() then raise exception 'Переключение групп доступно только Админу Арине'; end if;
  if p_tenant not in ('group_1','group_2') then raise exception 'Неизвестная группа'; end if;
  insert into politeshik_private.group_selection(uid,tenant_id) values(auth.uid(),p_tenant)
    on conflict(uid) do update set tenant_id=excluded.tenant_id;
  return true;
end $$;
create or replace function public.select_group(p_tenant text) returns boolean
language sql set search_path='' as $$ select politeshik_private.select_group(p_tenant) $$;

create or replace function politeshik_private.register_student(p_group text,p_code text,p_rid text,p_subgroup text,p_secret text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); t text; gid text; ro public.roster; existing public.members; wanted text:='student';
  secret text; status text:='pending'; owner text; mail text; profile jsonb;
begin
  if u is null or not public.email_ok() then raise exception 'Войдите в аккаунт и подтвердите почту'; end if;
  select g.tenant_id,g.id into t,gid from public.groups g where g.tenant_id=p_group;
  if t is null then raise exception 'Выберите группу'; end if;
  perform pg_advisory_xact_lock(hashtextextended('registration:'||u::text,0));
  select * into existing from public.members m where m.uid=u;
  if found and existing.tenant_id<>t then raise exception 'Аккаунт уже закреплён за другой группой'; end if;
  if existing.status in ('banned','rejected') then raise exception 'Доступ закрыт администратором'; end if;
  if not politeshik_private.is_super_admin() and not exists(
    select 1 from public.group_codes c where c.tenant_id=t and c.group_id=gid and c.active and c.code=upper(btrim(p_code)))
    then raise exception 'Неверный код выбранной группы'; end if;
  select * into ro from public.roster r where r.tenant_id=t and r.rid=p_rid and r.flag='';
  if not found then raise exception 'Фамилия не относится к выбранной группе'; end if;
  if p_subgroup not in ('1','2') and ro.subgroup='' then raise exception 'Выберите подгруппу'; end if;
  perform pg_advisory_xact_lock(hashtextextended(t||':'||p_rid,0));
  select d.data->>'uid' into owner from public.docs d where d.tenant_id=t and d.path='claims/'||p_rid;
  if owner is not null and owner<>u::text then raise exception 'Эта фамилия уже занята'; end if;
  select d.data into profile from public.docs d where d.tenant_id=t and d.path='profiles/'||u::text;
  if coalesce(profile->>'rid','')<>'' and profile->>'rid'<>p_rid then raise exception 'Фамилию после регистрации менять нельзя'; end if;
  if t='group_2' and p_rid in ('g2_r12','g2_r13') then
    wanted:=case when p_rid='g2_r13' then 'admin' else 'developer' end;
    if not coalesce(existing.role=wanted and existing.status='approved',false) then
      if (select count(*) from public.admin_attempts a where a.uid=u and not a.ok and a.at>now()-interval '15 minutes')>=5 then
        raise exception 'Слишком много попыток: подождите 15 минут'; end if;
      select c.secret_hash into secret from politeshik_private.staff_credentials c where c.tenant_id=t and c.rid=p_rid and c.role=wanted;
      if secret is null or secret<>extensions.crypt(coalesce(p_secret,''),secret) then
        insert into public.admin_attempts(uid,ok,kind,tenant_id) values(u,false,wanted,t);
        return jsonb_build_object('ok',false,'error','Неверный дополнительный пароль');
      end if;
    end if;
    status:='approved';
  elsif ro.rid='r32' then
    if not politeshik_private.is_super_admin() then raise exception 'Аккаунт Админа Арины уже закреплён'; end if;
    wanted:='admin'; status:='approved';
  elsif existing.status='approved' then
    status:='approved'; wanted:=existing.role;
  end if;
  select email into mail from auth.users where id=u;
  insert into public.members(tenant_id,uid,role,status,requested_role,full_name,group_id,email,decided_at)
    values(t,u,wanted,status,'student',ro.name,gid,mail,case when status='approved' then now() end)
    on conflict(tenant_id,uid) do update set role=excluded.role,status=excluded.status,full_name=excluded.full_name,group_id=excluded.group_id;
  if wanted='admin' then insert into public.admins(uid,tenant_id) values(u,t) on conflict(uid) do nothing; end if;
  insert into public.docs(tenant_id,path,data) values(t,'claims/'||p_rid,jsonb_build_object('uid',u,'at',now()))
    on conflict(tenant_id,path) do update set data=excluded.data;
  profile:=coalesce(profile,'{}'::jsonb)||jsonb_build_object('rid',p_rid,'name',ro.name,'role',wanted,
    'group_id',gid,'subgroup',coalesce(nullif(ro.subgroup,''),p_subgroup),'joined',coalesce(profile->>'joined',now()::text));
  insert into public.docs(tenant_id,path,data) values(t,'profiles/'||u::text,profile)
    on conflict(tenant_id,path) do update set data=excluded.data;
  return jsonb_build_object('ok',true,'status',status,'role',wanted,'tenant_id',t);
end $$;
create or replace function public.register_student(p_group text,p_code text,p_rid text,p_subgroup text,p_secret text default '') returns jsonb
language sql set search_path='' as $$ select politeshik_private.register_student(p_group,p_code,p_rid,p_subgroup,p_secret) $$;

create or replace function public.check_group_code(p_code text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if (select count(*) from public.code_attempts where at>now()-interval '10 minutes')>100 then raise exception 'Слишком много попыток'; end if;
  if exists(select 1 from public.group_codes c where c.active and c.code=upper(btrim(p_code))) then return true; end if;
  insert into public.code_attempts(tenant_id) values('group_1');
  return false;
end $$;

create or replace function politeshik_private.assert_manage_user(p_uid uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_admin() or not exists(select 1 from public.members m where m.uid=p_uid and m.tenant_id=public.current_tenant())
    or exists(select 1 from politeshik_private.super_admins a where a.uid=p_uid) then raise exception 'Нет прав на этот аккаунт'; end if;
end $$;

create or replace function public.admin_users()
returns table(uid uuid,email text,created_at timestamptz,last_sign_in_at timestamptz,role text,status text,requested_role text,full_name text,rid text,group_id text,child_name text,note text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not (public.is_admin() or public.is_developer()) then raise exception 'Нет доступа'; end if;
  return query select a.id,a.email::text,a.created_at,a.last_sign_in_at,m.role,m.status,m.requested_role,
    coalesce(nullif(p.data->>'name',''),m.full_name,''),coalesce(p.data->>'rid',''),m.group_id,m.child_name,m.note
    from public.members m join auth.users a on a.id=m.uid
    left join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||m.uid::text
    where m.tenant_id=public.current_tenant() order by a.created_at desc;
end $$;

alter table public.chat add column if not exists recipient_role text not null default 'superadmin'
  check(recipient_role in ('admin','developer','superadmin'));
alter table public.chat add column if not exists sender_label text not null default '';
create index if not exists chat_tenant_recipient_thread_idx on public.chat(tenant_id,recipient_role,thread_uid,created_at);
create or replace function politeshik_private.support_role() returns text
language sql stable security definer set search_path='' as $$
  select case when politeshik_private.is_super_admin() then 'superadmin'
    when public.is_admin() then 'admin' when public.is_developer() then 'developer' else null end
$$;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='chat' loop
    execute format('drop policy %I on public.chat',p.policyname);
  end loop;
end $$;
create policy chat_participants_read on public.chat for select to authenticated using(
  tenant_id=(select public.current_tenant()) and (thread_uid=(select auth.uid()) or
    (select politeshik_private.is_super_admin()) or recipient_role=(select politeshik_private.support_role())));
create policy chat_participants_insert on public.chat for insert to authenticated with check(
  tenant_id=(select public.current_tenant()) and sender=(select auth.uid()) and kind='text' and (select public.is_member()) and
  (thread_uid=(select auth.uid()) or (select politeshik_private.is_super_admin()) or recipient_role=(select politeshik_private.support_role())));
create policy chat_participants_update on public.chat for update to authenticated using(
  tenant_id=(select public.current_tenant()) and (thread_uid=(select auth.uid()) or
    (select politeshik_private.is_super_admin()) or recipient_role=(select politeshik_private.support_role())))
  with check(tenant_id=(select public.current_tenant()) and (thread_uid=(select auth.uid()) or
    (select politeshik_private.is_super_admin()) or recipient_role=(select politeshik_private.support_role())));

create or replace function public.chat_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    new.sender_label:=case when politeshik_private.is_super_admin() then 'Админ Арина'
      else coalesce((select m.full_name from public.members m where m.uid=auth.uid() and m.tenant_id=new.tenant_id),'Поддержка') end;
    if not exists(select 1 from public.members m where m.uid=new.thread_uid and m.tenant_id=new.tenant_id and m.status='approved') then
      raise exception 'Собеседник не принадлежит группе'; end if;
  else
    if row(new.id,new.tenant_id,new.thread_uid,new.sender,new.kind,new.body,new.created_at,new.recipient_role,new.sender_label)
      is distinct from row(old.id,old.tenant_id,old.thread_uid,old.sender,old.kind,old.body,old.created_at,old.recipient_role,old.sender_label) then
      raise exception 'Содержимое сообщения менять нельзя'; end if;
    if auth.uid()=old.thread_uid then
      if new.read_by_admin<>old.read_by_admin then raise exception 'Нет прав на отметку прочтения'; end if;
    elsif new.read_by_student<>old.read_by_student then raise exception 'Нет прав на отметку прочтения'; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_chat_guard on public.chat;
create trigger trg_chat_guard before insert or update on public.chat for each row execute function public.chat_guard();

create or replace function politeshik_private.same_group_links() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.news n where n.id=new.news_id and n.tenant_id=new.tenant_id) then
    raise exception 'Новость не принадлежит группе'; end if;
  return new;
end $$;
create trigger trg_same_group_comment before insert or update on public.news_comments for each row execute function politeshik_private.same_group_links();
create trigger trg_same_group_like before insert or update on public.news_likes for each row execute function politeshik_private.same_group_links();

do $$ declare r record; begin
  for r in select distinct table_name from information_schema.columns where table_schema='public' and column_name='tenant_id' loop
    execute format('alter table public.%I enable row level security',r.table_name);
    execute format('create policy tenant_boundary on public.%I as restrictive for all to authenticated using (tenant_id=(select public.current_tenant())) with check (tenant_id=(select public.current_tenant()))',r.table_name);
  end loop;
end $$;
drop policy if exists docs_claim_insert on public.docs;
create policy docs_claim_insert on public.docs for insert to authenticated with check(
  tenant_id=(select public.current_tenant()) and data->>'uid'=(select auth.uid())::text and
  exists(select 1 from public.roster r where r.tenant_id=docs.tenant_id and docs.path='claims/'||r.rid and r.flag='' and not r.is_admin and r.rid not in ('g2_r12','g2_r13')));
create policy docs_developer_read on public.docs for select to authenticated using(
  tenant_id=(select public.current_tenant()) and (select public.is_developer()) and split_part(path,'/',1) in ('profiles','attendance','certs'));
create policy members_developer_read on public.members for select to authenticated using(
  tenant_id=(select public.current_tenant()) and (select public.is_developer()));
create policy group2_attendance_insert on public.docs as restrictive for insert to authenticated with check(
  tenant_id<>'group_2' or split_part(path,'/',1)<>'attendance' or (select public.is_admin()));
create policy group2_attendance_update on public.docs as restrictive for update to authenticated using(
  tenant_id<>'group_2' or split_part(path,'/',1)<>'attendance' or (select public.is_admin())) with check(
  tenant_id<>'group_2' or split_part(path,'/',1)<>'attendance' or (select public.is_admin()));
create policy group2_attendance_delete on public.docs as restrictive for delete to authenticated using(
  tenant_id<>'group_2' or split_part(path,'/',1)<>'attendance' or (select public.is_admin()));
create policy group2_legacy_attendance_insert on public.attendance as restrictive for insert to authenticated with check(tenant_id<>'group_2' or (select public.is_admin()));
create policy group2_legacy_attendance_update on public.attendance as restrictive for update to authenticated using(tenant_id<>'group_2' or (select public.is_admin())) with check(tenant_id<>'group_2' or (select public.is_admin()));
create policy group2_legacy_attendance_delete on public.attendance as restrictive for delete to authenticated using(tenant_id<>'group_2' or (select public.is_admin()));

revoke all on all functions in schema politeshik_private from public,anon,authenticated;
grant execute on all functions in schema politeshik_private to authenticated;
revoke execute on function public.group_context(),public.select_group(text),public.register_student(text,text,text,text,text),public.is_developer() from public,anon;
grant execute on function public.group_context(),public.select_group(text),public.register_student(text,text,text,text,text),public.is_developer() to authenticated;
grant execute on function public.check_group_code(text) to anon,authenticated;

insert into public.roster(rid,n,name,is_admin,subgroup,tenant_id) values
('g2_r1',1,'Андрианов',false,'','group_2'),
('g2_r2',2,'Бойчук',false,'','group_2'),
('g2_r3',3,'Булов',false,'','group_2'),
('g2_r4',4,'Волков',false,'','group_2'),
('g2_r5',5,'Волкова',false,'','group_2'),
('g2_r6',6,'Вольский',false,'','group_2'),
('g2_r7',7,'Воронин',false,'','group_2'),
('g2_r8',8,'Горьковенко',false,'','group_2'),
('g2_r9',9,'Данилова',false,'','group_2'),
('g2_r10',10,'Зинченко',false,'','group_2'),
('g2_r11',11,'Коршунов',false,'','group_2'),
('g2_r12',12,'Кузьменков Макар Сергеевич',false,'','group_2'),
('g2_r13',13,'Лебедев Петр Андреевич',false,'','group_2'),
('g2_r14',14,'Листопадов',false,'','group_2'),
('g2_r15',15,'Малышев',false,'','group_2'),
('g2_r16',16,'Надеждина',false,'','group_2'),
('g2_r17',17,'Новиков',false,'','group_2'),
('g2_r18',18,'Орлов',false,'','group_2'),
('g2_r19',19,'Потапов',false,'','group_2'),
('g2_r20',20,'Руденко',false,'','group_2'),
('g2_r21',21,'Сапоговский',false,'','group_2'),
('g2_r22',22,'Соловьев',false,'','group_2'),
('g2_r23',23,'Тур',false,'','group_2'),
('g2_r24',24,'Чистяков',false,'','group_2'),
('g2_r25',25,'Чубыкин',false,'','group_2'),
('g2_r26',26,'Ширяева',false,'','group_2')
on conflict(rid) do nothing;
insert into public.docs(tenant_id,path,data) values('group_2','group/config','{"schedule": [], "weeks": {}, "anchor": "2026-10-12", "pairs": [{"start": "", "end": ""}, {"start": "", "end": ""}, {"start": "", "end": ""}, {"start": "", "end": ""}, {"start": "", "end": ""}, {"start": "", "end": ""}], "subjects": [{"id": "s_opbd", "name": "Основы проектирования баз данных", "short": "ОПБД", "color": "#6366f1", "links": [], "formulas": []}]}'::jsonb) on conflict(tenant_id,path) do nothing;
insert into public.docs(tenant_id,path,data) values('group_2','group/extra','{"subjects": [{"id": "s_opbd", "name": "Основы проектирования баз данных", "short": "ОПБД", "color": "#6366f1", "links": [], "formulas": []}], "teachers": [], "homework": [], "cards": [], "notes": []}'::jsonb) on conflict(tenant_id,path) do nothing;
insert into public.docs(tenant_id,path,data) values('group_2','group/changes','{"items": []}'::jsonb) on conflict(tenant_id,path) do nothing;
insert into public.docs(tenant_id,path,data) values('group_2','group/works','{"items": []}'::jsonb) on conflict(tenant_id,path) do nothing;
insert into public.settings(tenant_id,key,value) values('group_2','require_code','on'),('group_2','require_approval','on') on conflict(tenant_id,key) do nothing;
CREATE OR REPLACE FUNCTION public.admin_set_status(p_uid uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t text := public.current_tenant();
begin
  perform politeshik_private.assert_manage_user(p_uid);
  if not public.is_admin() then raise exception 'Только староста'; end if;
  if p_status not in ('banned', 'approved') then raise exception 'Недопустимый статус'; end if;
  if p_uid = auth.uid() or exists (select 1 from public.admins x where x.uid = p_uid) then raise exception 'Старосту банить нельзя'; end if;
  insert into public.members (tenant_id, uid, role, status, decided_at, decided_by, email)
    values (t, p_uid, case when exists (select 1 from public.teachers x where x.uid = p_uid) then 'teacher' else 'student' end, p_status, now(), auth.uid(), coalesce((select a.email from auth.users a where a.id = p_uid), ''))
    on conflict (tenant_id, uid) do update set status = p_status, decided_at = now(), decided_by = auth.uid();
  if p_status = 'banned' then
    begin
      delete from auth.refresh_tokens where user_id::text = p_uid::text;
      delete from auth.sessions where user_id = p_uid;
    exception when others then null;
    end;
  end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_uid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform politeshik_private.assert_manage_user(p_uid);
  if not public.is_admin() then raise exception 'Только староста'; end if;
  if p_uid = auth.uid() or exists (select 1 from public.admins x where x.uid = p_uid) then raise exception 'Старосту удалить нельзя'; end if;
  perform public.purge_user_data(p_uid);
  delete from auth.users where id = p_uid;
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_reset_registration(p_uid uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t text := public.current_tenant(); v_rid text; st text;
begin
  perform politeshik_private.assert_manage_user(p_uid);
  if not public.is_admin() then raise exception 'Только староста'; end if;
  if p_uid = auth.uid() or exists (select 1 from public.admins x where x.uid = p_uid) then raise exception 'Старосту сбросить нельзя'; end if;
  if exists (select 1 from public.teachers x where x.uid = p_uid) then raise exception 'У преподавателя нет фамилии в списке группы'; end if;
  select d.data ->> 'rid' into v_rid from public.docs d where d.tenant_id = t and d.path = 'profiles/' || p_uid::text;
  perform public.detach_user_data(p_uid);
  perform set_config('app.import', 'on', true);
  delete from public.docs d
    where d.tenant_id = t
      and (d.path in ('profiles/' || p_uid::text, 'avatars/' || p_uid::text)
           or (d.path like 'claims/%' and d.data::text like '%' || p_uid::text || '%'));
  perform set_config('app.import', 'off', true);
  select m.status into st from public.members m where m.tenant_id = t and m.uid = p_uid;
  if st is not null and st <> 'banned' then
    delete from public.members m where m.tenant_id = t and m.uid = p_uid;
  end if;
  return coalesce(v_rid, '');
end $function$
;
CREATE OR REPLACE FUNCTION public.set_member_role(p_uid uuid, p_role text, p_group text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t text := public.current_tenant();
begin
  if not politeshik_private.is_super_admin() then raise exception 'Доступно только Админу Арине'; end if;
  if not public.is_admin() then raise exception 'Только староста может менять роли'; end if;
  if p_role not in ('student', 'curator', 'department', 'parent') then raise exception 'Недопустимая роль'; end if;
  update public.members set role = p_role, status = 'approved', group_id = coalesce(p_group, group_id), decided_at = now(), decided_by = auth.uid() where tenant_id = t and uid = p_uid;
  if not found then raise exception 'Пользователь не найден'; end if;
  if p_role = 'curator' then update public.groups set curator_uid = p_uid where tenant_id = t and id = coalesce(p_group, (select group_id from public.members where tenant_id = t and uid = p_uid)); end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_free_orphans()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not politeshik_private.is_super_admin() then raise exception 'Доступно только Админу Арине'; end if;
  if not public.is_admin() then raise exception 'Только староста'; end if;
  return public.free_orphan_data();
end $function$
;
CREATE OR REPLACE FUNCTION public.become_admin(p_secret text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not politeshik_private.is_super_admin() then raise exception 'Доступно только Админу Арине'; end if;
  if auth.uid() is null then raise exception 'Нужно войти в аккаунт'; end if;
  if public.is_admin() then return true; end if;
  if public.is_teacher() then raise exception 'Этот аккаунт зарегистрирован как преподаватель'; end if;
  if not public.check_secret('admin_pass', p_secret) then return false; end if;
  insert into public.admins (uid, tenant_id) values (auth.uid(), public.current_tenant()) on conflict (uid) do nothing;
  insert into public.members (tenant_id, uid, role, status, email, decided_at) values (public.current_tenant(), auth.uid(), 'admin', 'approved', coalesce((select a.email from auth.users a where a.id = auth.uid()), ''), now()) on conflict (tenant_id, uid) do update set role = 'admin', status = 'approved', email = excluded.email;
  return true;
end $function$
;
CREATE OR REPLACE FUNCTION public.decide_access(p_uid uuid, p_approve boolean, p_role text DEFAULT NULL::text, p_group text DEFAULT NULL::text, p_child uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t text := public.current_tenant(); m public.members; r text;
begin
  if not public.is_admin() then raise exception 'Только староста может решать заявки'; end if;
  select * into m from public.members x where x.tenant_id = t and x.uid = p_uid;
  if not found then raise exception 'Заявка не найдена'; end if;
  if not p_approve then
    update public.members set status = 'rejected', decided_at = now(), decided_by = auth.uid() where tenant_id = t and uid = p_uid;
    return;
  end if;
  if m.role in ('admin','developer') then raise exception 'Права сотрудника меняет только Админ Арина'; end if;
  if p_group is not null and not exists(select 1 from public.groups g where g.id=p_group and g.tenant_id=t) then raise exception 'Чужая группа'; end if;
  if p_child is not null and not exists(select 1 from public.members x where x.uid=p_child and x.tenant_id=t) then raise exception 'Чужой студент'; end if;
  r := coalesce(p_role, case m.requested_role when 'parent' then 'parent' when 'staff' then 'curator' when 'teacher' then 'teacher' else 'student' end);
  if r not in ('student', 'curator', 'department', 'parent', 'teacher') then raise exception 'Недопустимая роль'; end if;
  update public.members set status = 'approved', role = r, group_id = coalesce(p_group, group_id), child_uid = coalesce(p_child, child_uid), decided_at = now(), decided_by = auth.uid()
    where tenant_id = t and uid = p_uid;
  if r = 'teacher' then insert into public.teachers (uid, tenant_id) values (p_uid, t) on conflict (uid) do nothing;
  else delete from public.teachers where uid = p_uid and tenant_id = t; end if;
  if r = 'curator' then update public.groups set curator_uid = p_uid where tenant_id = t and id = coalesce(p_group, m.group_id); end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.docs_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare k text; v jsonb; om jsonb := '{}'::jsonb; nm jsonb; prev jsonb;
        today text := to_char((now() at time zone 'Europe/Moscow')::date, 'YYYY-MM-DD');
begin
  if auth.uid() is not null and new.tenant_id='group_2' and split_part(new.path,'/',1)='attendance' and not public.is_admin() and current_setting('app.import',true) is distinct from 'on' then
    raise exception 'Посещаемость этой группы меняют только староста и Админ Арина';
  end if;
  if auth.uid() is not null and split_part(new.path,'/',1)='profiles' and coalesce(new.data->>'rid','')<>'' then
    if not exists(select 1 from public.roster r where r.rid=new.data->>'rid' and r.tenant_id=new.tenant_id and r.flag='') then raise exception 'Фамилия из другой группы'; end if;
    if new.data->>'rid'='r32' and not politeshik_private.is_super_admin() then raise exception 'Фамилия Админа Арины защищена'; end if;
    if new.tenant_id='group_2' and new.data->>'rid' in ('g2_r12','g2_r13') and not exists(
      select 1 from public.members m where m.uid=split_part(new.path,'/',2)::uuid and m.tenant_id=new.tenant_id and m.status='approved'
        and m.role=case when new.data->>'rid'='g2_r13' then 'admin' else 'developer' end)
      then raise exception 'Нужен дополнительный пароль сотрудника'; end if;
  end if;
  if current_setting('app.import', true) = 'on' then return new; end if;
  if public.is_admin() then return new; end if;
  if split_part(new.path, '/', 1) = 'attendance' and array_length(string_to_array(new.path, '/'), 1) = 2 and public.curator_manages(split_part(new.path, '/', 2)) then return new; end if;
  select d.data into prev from public.docs d where d.tenant_id = new.tenant_id and d.path = new.path;
  if pg_column_size(new.data) > 900000 then raise exception 'Документ слишком большой'; end if;
  if split_part(new.path, '/', 1) = 'profiles' and array_length(string_to_array(new.path, '/'), 1) = 2 and coalesce(prev ->> 'rid', '') <> '' then
    if (new.data ->> 'rid') is distinct from (prev ->> 'rid') or (new.data ->> 'name') is distinct from (prev ->> 'name') then
      raise exception 'ФИО нельзя изменить после регистрации: обратитесь к старосте';
    end if;
  end if;
  if split_part(new.path, '/', 1) = 'attendance' then
    om := coalesce(prev -> 'marks', '{}'::jsonb);
    nm := coalesce(new.data -> 'marks', '{}'::jsonb);
    for k in select jsonb_object_keys(om) loop
      if nm -> k is distinct from om -> k then raise exception 'Отметку нельзя менять или удалять: это может только админ'; end if;
    end loop;
    for k, v in select key, value from jsonb_each(nm) loop
      if not (om ? k) and (left(k, 10) <> today or (v #>> '{}') not in ('п', 'о', 'н')) then
        raise exception 'Отметиться можно только в день пары';
      end if;
    end loop;
  end if;
  if split_part(new.path, '/', 1) = 'certs' and array_length(string_to_array(new.path, '/'), 1) = 2 then
    for v in select e.value from jsonb_array_elements(coalesce(new.data -> 'items', '[]'::jsonb)) e loop
      if coalesce((v ->> 'confirmed')::boolean, false) then
        if not exists (
          select 1 from jsonb_array_elements(coalesce(prev -> 'items', '[]'::jsonb)) o
          where o.value ->> 'id' = v ->> 'id' and coalesce((o.value ->> 'confirmed')::boolean, false)
        ) then
          raise exception 'Подтвердить справку может только админ';
        end if;
      end if;
    end loop;
  end if;
  if split_part(new.path, '/', 1) = 'avatars' then
    if array_length(string_to_array(new.path, '/'), 1) <> 2 then raise exception 'Неверный путь аватарки'; end if;
    if public.member_role() = 'parent' then raise exception 'Родителям фото профиля недоступно'; end if;
    if coalesce(new.data ->> 'v', '') <> '' and not (new.data ->> 'v' ~ '^m[0-9]{1,2}$' or (new.data ->> 'v' like 'data:image/jpeg;base64,%' and char_length(new.data ->> 'v') < 60000)) then
      raise exception 'Неверный формат фото';
    end if;
  end if;
  if split_part(new.path, '/', 1) = 'map' then
    if array_length(string_to_array(new.path, '/'), 1) <> 2
       or coalesce((new.data ->> 'floor')::int, 0) not between 1 and 5
       or coalesce((new.data ->> 'x')::numeric, -1) not between 0 and 100
       or coalesce((new.data ->> 'y')::numeric, -1) not between 0 and 100
       or char_length(coalesce(new.data ->> 'name', '')) > 40 then
      raise exception 'Неверная точка на карте';
    end if;
  end if;
  if split_part(new.path, '/', 1) = 'solutions' and array_length(string_to_array(new.path, '/'), 1) = 2 then
    if jsonb_typeof(new.data -> 'items') is distinct from 'array' or jsonb_array_length(new.data -> 'items') > 200 then
      raise exception 'Неверный список решений';
    end if;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.request_access(p_role text, p_name text, p_child text DEFAULT ''::text, p_note text DEFAULT ''::text, p_code text DEFAULT ''::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t text := public.current_tenant(); u uuid := auth.uid(); cur public.members; asked text; child uuid; hits int; want text; st text; gid text; mail text; role_now text; code_group text;
begin
  if u is null then raise exception 'Нужно войти в аккаунт'; end if;
  if not public.email_ok() then raise exception 'Подтвердите почту'; end if;
  if public.is_admin() or public.is_teacher() then return 'approved'; end if;
  asked := case when p_role in ('student', 'parent', 'staff') then p_role else 'student' end;
  select * into cur from public.members m where m.uid=u;
  if found then t:=cur.tenant_id; end if;
  if not found and btrim(coalesce(p_code,''))<>'' then
    select c.tenant_id,c.group_id into t,code_group from public.group_codes c where c.active and c.code=upper(btrim(p_code));
    if t is null then raise exception 'Неверный код группы'; end if;
  end if;
  select * into cur from public.members m where m.tenant_id=t and m.uid=u;
  if found and cur.status in ('approved', 'rejected', 'banned') then return cur.status; end if;
  if not found and asked in ('student', 'parent') and public.require_code() then
    select c.group_id into code_group from public.group_codes c where c.active and c.tenant_id=t and c.code=upper(btrim(p_code));
    if code_group is null then raise exception 'Неверный код группы: спросите его у старосты'; end if;
  end if;
  select a.email into mail from auth.users a where a.id = u;
  select g.id into gid from public.groups g where g.tenant_id = t order by g.created_at limit 1;
  gid := coalesce(code_group, gid);
  if asked = 'parent' and btrim(coalesce(p_child, '')) <> '' then
    want := lower(split_part(regexp_replace(btrim(p_child), '\s+', ' ', 'g'), ' ', 1) || ' ' || split_part(regexp_replace(btrim(p_child), '\s+', ' ', 'g'), ' ', 2));
    select count(*), (array_agg(a.id))[1] into hits, child
    from public.docs d join auth.users a on a.id::text = split_part(d.path, '/', 2)
    where d.tenant_id = t and d.path like 'profiles/%' and coalesce(d.data ->> 'rid', '') <> ''
      and lower(split_part(regexp_replace(btrim(coalesce(d.data ->> 'name', '')), '\s+', ' ', 'g'), ' ', 1) || ' ' || split_part(regexp_replace(btrim(coalesce(d.data ->> 'name', '')), '\s+', ' ', 'g'), ' ', 2)) = want;
    if hits <> 1 then child := null; end if;
  end if;
  st := case when asked = 'staff' or public.require_approval() then 'pending' else 'approved' end;
  role_now := case when asked = 'parent' then 'parent' else 'student' end;
  insert into public.members (tenant_id, uid, role, status, requested_role, full_name, child_name, child_uid, group_id, note, email)
    values (t, u, role_now, st, asked, left(coalesce(p_name, ''), 120), left(coalesce(p_child, ''), 120), child, gid, left(coalesce(p_note, ''), 300), coalesce(mail, ''))
    on conflict (tenant_id, uid) do update set requested_role = excluded.requested_role, full_name = excluded.full_name, child_name = excluded.child_name, child_uid = excluded.child_uid, note = excluded.note, email = excluded.email;
  return st;
end $function$
;

do $$ declare r record; begin
  for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('merge_duplicate_account','login_email','taken_rids','check_invite','create_invite','revoke_invite','redeem_invite','rotate_backups','request_password_reset','claim_session','session_heartbeat','release_session','sign_out_all') loop
    execute format('revoke execute on function %s from public,anon,authenticated',r.signature);
  end loop;
end $$;
revoke all on public.roster from anon;
