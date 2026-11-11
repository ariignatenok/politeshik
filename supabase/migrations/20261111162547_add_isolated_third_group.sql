-- Group 23290907/2092: staff activation is bound to a confirmed Auth email.
insert into public.tenants(id,name) values('group_3','Группа 23290907/2092');
insert into public.groups(id,tenant_id,name) values('g_23290907_2092','group_3','Группа 23290907/2092');
insert into public.roster(rid,n,name,is_admin,subgroup,tenant_id) values
('g3_r1',1,'Абрамчук Леонид Константинович',false,'','group_3'),
('g3_r2',2,'Афанасьев Сергей Павлович',false,'','group_3'),
('g3_r3',3,'Гурьянова Анастасия Алексеевна',false,'','group_3'),
('g3_r4',4,'Джусь Анастасия Сергеевна',false,'','group_3'),
('g3_r5',5,'Долгополов Владислав Валерьевич',false,'','group_3'),
('g3_r6',6,'Карасева Ольга Михайловна',false,'','group_3'),
('g3_r7',7,'Ковалева Алёна Александровна',false,'','group_3'),
('g3_r8',8,'Колотилин Андрей Валерьевич',false,'','group_3'),
('g3_r9',9,'Кошель Милена Викторовна',false,'','group_3'),
('g3_r10',10,'Кузнецов Александр Александрович',false,'','group_3'),
('g3_r11',11,'Лапшина Виктория Алексеевна',false,'','group_3'),
('g3_r12',12,'Некрасов Святослав Андреевич',false,'','group_3'),
('g3_r13',13,'Николайчук Роман Алексеевич',false,'','group_3'),
('g3_r14',14,'Павлов Владислав Денисович',false,'','group_3'),
('g3_r15',15,'Пислегин Даниил Михайлович',false,'','group_3'),
('g3_r16',16,'Плотникова Дарья Александровна',false,'','group_3'),
('g3_r17',17,'Попова Алина Тулкиновна',false,'','group_3'),
('g3_r18',18,'Поступинская Анна Денисовна',false,'','group_3'),
('g3_r19',19,'Решетько Виктория Сергеевна',false,'','group_3'),
('g3_r20',20,'Семенюк Кристина Сергеевна',false,'','group_3'),
('g3_r21',21,'Стахаевич Вероника Геннадьевна',false,'','group_3'),
('g3_r22',22,'Сытов Семен Ильич',false,'','group_3'),
('g3_r23',23,'Тихонович Ярослав Степанович',false,'','group_3'),
('g3_r24',24,'Ткачев Родион Дмитриевич',false,'','group_3'),
('g3_r25',25,'Циглер Виктория Дмитриевна',false,'','group_3'),
('g3_r26',26,'Шелепова Варвара Евгеньевна',false,'','group_3'),
('g3_r27',27,'Шкарлет Иван Андреевич',false,'','group_3');
insert into public.settings(tenant_id,key,value) values('group_3','require_code','on'),('group_3','require_approval','on');
create table politeshik_private.staff_identities(
  tenant_id text not null references public.tenants(id),rid text not null references public.roster(rid),
  role text not null check(role='admin'),email text not null check(email=lower(email)),
  primary key(tenant_id,rid),unique(tenant_id,role)
);
alter table politeshik_private.staff_identities enable row level security;
revoke all on politeshik_private.staff_identities from public,anon,authenticated;
create policy deny_direct_access on politeshik_private.staff_identities for all using(false) with check(false);

create or replace function politeshik_private.active_tenant() returns text
language sql stable security definer set search_path='' as $$
  select coalesce(
    (select nullif(current_setting('request.headers',true),'')::jsonb->>'x-politeshik-group'
      where politeshik_private.is_super_admin() and nullif(current_setting('request.headers',true),'')::jsonb->>'x-politeshik-group' in ('group_1','group_2','group_3')),
    (select s.tenant_id from politeshik_private.group_selection s where s.uid=auth.uid() and politeshik_private.is_super_admin()),
    (select m.tenant_id from public.members m where m.uid=auth.uid()),
    'group_1')
$$;

create or replace function politeshik_private.select_group(p_tenant text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if not politeshik_private.is_super_admin() then raise exception 'Переключение групп доступно только Админу Арине'; end if;
  if p_tenant not in ('group_1','group_2','group_3') then raise exception 'Неизвестная группа'; end if;
  insert into politeshik_private.group_selection(uid,tenant_id) values(auth.uid(),p_tenant)
    on conflict(uid) do update set tenant_id=excluded.tenant_id;
  return true;
end $$;

create or replace function politeshik_private.register_group3_student(p_group text,p_code text,p_rid text,p_subgroup text,p_secret text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); t text; gid text; ro public.roster; existing public.members; wanted text:='student';
  secret text; status text:='pending'; owner text; mail text; profile jsonb;
begin
  if p_group<>'group_3' then raise exception 'Неверная группа'; end if;
  if u is null or not public.email_ok() then raise exception 'Войдите в аккаунт и подтвердите почту'; end if;
  select g.tenant_id,g.id into t,gid from public.groups g where g.tenant_id=p_group;
  if t is null then raise exception 'Выберите группу'; end if;
  perform pg_advisory_xact_lock(hashtextextended('registration:'||u::text,0));
  select email into mail from auth.users where id=u;
  select * into existing from public.members m where m.uid=u;
  if found and existing.tenant_id<>t then raise exception 'Аккаунт уже закреплён за другой группой'; end if;
  if existing.status in ('banned','rejected') then raise exception 'Доступ закрыт администратором'; end if;
  if not politeshik_private.is_super_admin() and (t in ('group_2','group_3') or public.require_code()) and not exists(
    select 1 from public.group_codes c where c.tenant_id=t and c.group_id=gid and c.active and c.code=upper(btrim(p_code)))
    then raise exception 'Неверный код выбранной группы'; end if;
  select * into ro from public.roster r where r.tenant_id=t and r.rid=p_rid and r.flag='';
  if not found then raise exception 'Фамилия не относится к выбранной группе'; end if;
  if coalesce(p_subgroup,'') not in ('1','2') and ro.subgroup='' then raise exception 'Выберите подгруппу'; end if;
  perform pg_advisory_xact_lock(hashtextextended(t||':'||p_rid,0));
  select d.data->>'uid' into owner from public.docs d where d.tenant_id=t and d.path='claims/'||p_rid;
  if owner is not null and owner<>u::text then raise exception 'Эта фамилия уже занята'; end if;
  select d.data into profile from public.docs d where d.tenant_id=t and d.path='profiles/'||u::text;
  if coalesce(profile->>'rid','')<>'' and profile->>'rid'<>p_rid then raise exception 'Фамилию после регистрации менять нельзя'; end if;
  if t='group_3' and p_rid='g3_r16' then
    if not exists(select 1 from politeshik_private.staff_identities i
      where i.tenant_id=t and i.rid=p_rid and i.role='admin' and i.email=lower(mail)) then
      raise exception 'Эта фамилия закреплена за подтверждённой почтой старосты'; end if;
    wanted:='admin'; status:='approved';
  elsif existing.status='approved' then
    status:='approved'; wanted:=existing.role;
  elsif t='group_1' and not public.require_approval() then
    status:='approved';
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
revoke all on function politeshik_private.register_group3_student(text,text,text,text,text) from public,anon,authenticated;

-- Add only a group_3 dispatch branch; preserve the existing registration body.
do $$ declare body text; begin
  select prosrc into body from pg_proc where oid='politeshik_private.register_student(text,text,text,text,text)'::regprocedure;
  assert position('return politeshik_private.register_group3_student' in body)=0,'Dispatch already exists';
  assert position(E'\nbegin\n' in body)>0,'Unexpected registration body';
  body:=overlay(body placing E'\nbegin\n  if p_group=''group_3'' then return politeshik_private.register_group3_student(p_group,p_code,p_rid,p_subgroup,p_secret); end if;\n' from position(E'\nbegin\n' in body) for length(E'\nbegin\n'));
  execute format('create or replace function politeshik_private.register_student(p_group text,p_code text,p_rid text,p_subgroup text,p_secret text default '''') returns jsonb language plpgsql security definer set search_path='''' as %L',body);
end $$;

create function politeshik_private.guard_group3_document() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null then
    if split_part(new.path,'/',1)='attendance' and not public.is_admin() then
      raise exception 'Посещаемость этой группы меняют только староста и Админ Арина'; end if;
    if (split_part(new.path,'/',1)='profiles' and new.data->>'rid'='g3_r16') or new.path='claims/g3_r16' then
      if not exists(select 1 from public.members m join auth.users u on u.id=m.uid
        join politeshik_private.staff_identities i on i.tenant_id=m.tenant_id and i.rid='g3_r16' and i.email=lower(u.email)
        where m.uid=case when new.path='claims/g3_r16' then (new.data->>'uid')::uuid else split_part(new.path,'/',2)::uuid end
          and m.tenant_id='group_3' and m.role='admin' and m.status='approved') then
        raise exception 'Аккаунт старосты защищён'; end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function politeshik_private.guard_group3_document() from public,anon,authenticated;
create trigger trg_group3_document_guard before insert or update on public.docs
 for each row when(new.tenant_id='group_3') execute function politeshik_private.guard_group3_document();
create policy group3_protect_leader_claim on public.docs as restrictive for insert to authenticated
 with check(tenant_id<>'group_3' or path<>'claims/g3_r16' or (select public.is_admin()));

create policy group3_docs_insert on public.docs as restrictive for insert to authenticated with check(tenant_id<>'group_3' or split_part(path,'/',1)<>'attendance' or (select public.is_admin()));
create policy group3_docs_update on public.docs as restrictive for update to authenticated using(tenant_id<>'group_3' or split_part(path,'/',1)<>'attendance' or (select public.is_admin())) with check(tenant_id<>'group_3' or split_part(path,'/',1)<>'attendance' or (select public.is_admin()));
create policy group3_docs_delete on public.docs as restrictive for delete to authenticated using(tenant_id<>'group_3' or split_part(path,'/',1)<>'attendance' or (select public.is_admin())) ;
create policy group3_attendance_insert on public.attendance as restrictive for insert to authenticated with check(tenant_id<>'group_3' or (select public.is_admin()));
create policy group3_attendance_update on public.attendance as restrictive for update to authenticated using(tenant_id<>'group_3' or (select public.is_admin())) with check(tenant_id<>'group_3' or (select public.is_admin()));
create policy group3_attendance_delete on public.attendance as restrictive for delete to authenticated using(tenant_id<>'group_3' or (select public.is_admin())) ;

create table politeshik_private.group3_registration_welcomes (
  uid uuid primary key references auth.users(id) on delete cascade,
  tenant_id text not null references public.tenants(id) check(tenant_id='group_3'),
  message_id bigint not null unique,
  sender uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);
alter table politeshik_private.group3_registration_welcomes enable row level security;
revoke all on politeshik_private.group3_registration_welcomes from public,anon,authenticated;
create policy deny_direct_access on politeshik_private.group3_registration_welcomes
  for all using(false) with check(false);

create or replace function politeshik_private.send_group3_student_welcome(p_uid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare arina_uid uuid; message_id bigint;
  welcome_body text:=$welcome$Привеет! Добро пожаловать в «Политешик» 🥑💚

Я Арина, создательница этого приложения. Надеюсь, оно сделает твою учебную жизнь чуточку проще ✨

Этот чат — связь со мной: задавай вопросы, рассказывай об ошибках и делись идеями. Не стесняйся писать, я помогу, как смогу 🫶$welcome$;
begin
  if not exists(select 1 from public.members m
    join public.docs d on d.tenant_id=m.tenant_id and d.path='profiles/'||m.uid::text
    join public.roster r on r.tenant_id=m.tenant_id and r.rid=d.data->>'rid' and r.flag=''
    where m.uid=p_uid and m.tenant_id='group_3' and m.role='student' and m.requested_role='student'
      and m.status in('pending','approved') and r.rid not in('g3_r16')) then return; end if;
  select uid into arina_uid from politeshik_private.super_admins order by uid limit 1;
  if arina_uid is null then raise exception 'Не настроен аккаунт Админа Арины'; end if;
  message_id:=nextval('public.chat_id_seq'::regclass);
  insert into politeshik_private.group3_registration_welcomes(uid,tenant_id,message_id,sender,body)
    values(p_uid,'group_3',message_id,arina_uid,welcome_body) on conflict(uid) do nothing;
  if not found then return; end if;
  insert into public.chat(id,tenant_id,thread_uid,sender,kind,body,recipient_role,sender_label,read_by_admin,read_by_student)
    values(message_id,'group_3',p_uid,arina_uid,'text',welcome_body,'superadmin','Админ Арина',true,false);
end $$;
revoke all on function politeshik_private.send_group3_student_welcome(uuid) from public,anon,authenticated;

-- Exact third-group automation exception; ordinary chat validation stays unchanged.
do $$ declare body text; branch text; begin
  select prosrc into body from pg_proc where oid='public.chat_guard()'::regprocedure;
  assert position('group3_registration_welcomes' in body)=0,'Welcome branch already exists';
  assert position(E'\nbegin\n' in body)>0,'Unexpected chat guard body';
  branch:=$branch$
begin
  if tg_op='INSERT' and new.tenant_id='group_3' and new.recipient_role='superadmin'
    and new.kind='text' and new.file_path is null and exists(
      select 1 from politeshik_private.group3_registration_welcomes w
      where w.uid=new.thread_uid and w.tenant_id=new.tenant_id and w.message_id=new.id
        and w.sender=new.sender and w.body=new.body) then
    new.sender_label:='Админ Арина'; return new;
  end if;
$branch$;
  body:=overlay(body placing branch from position(E'\nbegin\n' in body) for length(E'\nbegin\n'));
  execute format('create or replace function public.chat_guard() returns trigger language plpgsql security definer set search_path='''' as %L',body);
end $$;
create function politeshik_private.welcome_group3_registered_student() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  select uid into target from public.members where tenant_id='group_3' and uid::text=substr(new.path,10);
  if target is not null then perform politeshik_private.send_group3_student_welcome(target); end if;
  return new;
end $$;
revoke all on function politeshik_private.welcome_group3_registered_student() from public,anon,authenticated;
create trigger trg_welcome_group3_registered_student after insert on public.docs
 for each row when(new.tenant_id='group_3' and new.path like 'profiles/%') execute function politeshik_private.welcome_group3_registered_student();

create or replace function politeshik_private.group3_welcome_recipients() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not politeshik_private.is_super_admin() then
    raise exception 'Список рассылки доступен только Админу Арине' using errcode='42501'; end if;
  if public.current_tenant()<>'group_3' then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'uid',m.uid,'name',coalesce(nullif(d.data->>'name',''),m.full_name),'registered_at',m.created_at,
    'sent_at',w.created_at,'read_by_student',coalesce(c.read_by_student,false),
    'status',case when w.uid is null then 'not_sent' when c.read_by_student then 'read' else 'sent' end
  ) order by r.n,m.uid)
    from public.members m
    join public.docs d on d.tenant_id=m.tenant_id and d.path='profiles/'||m.uid::text
    join public.roster r on r.tenant_id=m.tenant_id and r.rid=d.data->>'rid' and r.flag=''
    left join politeshik_private.group3_registration_welcomes w on w.uid=m.uid and w.tenant_id=m.tenant_id
    left join public.chat c on c.id=w.message_id and c.tenant_id=m.tenant_id
    where m.tenant_id='group_3' and m.role='student' and m.requested_role='student'
      and m.status in('pending','approved') and r.rid not in('g3_r16')),'[]'::jsonb);
end $$;
revoke all on function politeshik_private.group3_welcome_recipients() from public,anon;
grant execute on function politeshik_private.group3_welcome_recipients() to authenticated;
create or replace function public.welcome_recipients() returns jsonb language sql security invoker set search_path=''
 as $$ select case when public.current_tenant()='group_3' then politeshik_private.group3_welcome_recipients() else politeshik_private.welcome_recipients() end $$;

CREATE OR REPLACE FUNCTION public.create_group_code(p_group text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t text := public.current_tenant(); gid text; label text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; suffix text := ''; new_code text; i int;
begin
  if not public.is_admin() then raise exception 'Только староста может создавать коды'; end if;
  gid := coalesce(p_group, (select g.id from public.groups g where g.tenant_id = t order by g.created_at limit 1));
  select coalesce(replace(substring(g.name from '[0-9]{8}/[0-9]{4}'), '/', '-'),regexp_replace(upper(g.id),'[^0-9A-Z]','','g'))
    into label from public.groups g where g.id = gid and g.tenant_id = t;
  if label is null then raise exception 'Группа не найдена'; end if;
  loop
    suffix := '';
    for i in 1 .. 5 loop suffix := suffix || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    new_code := label || '-' || suffix;
    exit when not exists (select 1 from public.group_codes c where c.code = new_code);
  end loop;
  update public.group_codes set active = false where tenant_id = t and group_id = gid and active;
  insert into public.group_codes (code, tenant_id, group_id, active, created_by) values (new_code, t, gid, true, auth.uid());
  return new_code;
end $function$
;
