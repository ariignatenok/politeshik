-- Two groups are provisioned before their leaders' emails are known.
-- No Auth users or placeholder emails are created. Protected leaders stay unclaimable until staff_identities is configured.
-- Only group-specific copies and literal superadmin selector/registration branches are added.
DO $$begin
 assert not exists(select 1 from public.tenants where id in('group_5','group_6')),'Groups already exist';
 assert (select md5(prosrc) from pg_proc where oid='politeshik_private.register_student(text,text,text,text,text)'::regprocedure)='8b54d309dc44d6ecddeb39b695d791f6','Unexpected baseline: politeshik_private.register_student(text,text,text,text,text)';
 assert (select md5(prosrc) from pg_proc where oid='politeshik_private.active_tenant()'::regprocedure)='7ecb6ec33573ac88a6515f6901bad092','Unexpected baseline: politeshik_private.active_tenant()';
 assert (select md5(prosrc) from pg_proc where oid='politeshik_private.select_group(text)'::regprocedure)='8b79e0422a920b8e74ced7c537904485','Unexpected baseline: politeshik_private.select_group(text)';
 assert (select md5(prosrc) from pg_proc where oid='public.chat_guard()'::regprocedure)='3fd07cc468fd51c2abf4c818b544873e','Unexpected baseline: public.chat_guard()';
 assert (select md5(prosrc) from pg_proc where oid='public.welcome_recipients()'::regprocedure)='ad536b751dceda35fbc4daf698067c9a','Unexpected baseline: public.welcome_recipients()';
end $$;
insert into public.tenants(id,name) values('group_5','Группа 25290907/3111');
insert into public.groups(id,tenant_id,name) values('g_25290907_3111','group_5','Группа 25290907/3111');
insert into public.roster(rid,n,name,is_admin,subgroup,tenant_id) values
('g5_r1',1,'Белов Егор Максимович',false,'','group_5'),
('g5_r2',2,'Бобылев Вячеслав Сергеевич',false,'','group_5'),
('g5_r3',3,'Будник Маргарита Вячеславовна',false,'','group_5'),
('g5_r4',4,'Володина Мария Александровна',false,'','group_5'),
('g5_r5',5,'Гавриленко Фёдор Сергеевич',false,'','group_5'),
('g5_r6',6,'Драчев Иван Петрович',false,'','group_5'),
('g5_r7',7,'Егоров Арсений Сергеевич',false,'','group_5'),
('g5_r8',8,'Калинин Дмитрий Гелаевич',false,'','group_5'),
('g5_r9',9,'Мирейчик Кристина Антоновна',false,'','group_5'),
('g5_r10',10,'Ойнус Дмитрий Борисович',false,'','group_5'),
('g5_r11',11,'Петров Анатолий Алексеевич',false,'','group_5'),
('g5_r12',12,'Петрунина Анастасия Сергеевна',false,'','group_5'),
('g5_r13',13,'Ремизов Михаил Алексеевич',false,'','group_5'),
('g5_r14',14,'Сидорук Арсений Дмитриевич',false,'','group_5'),
('g5_r15',15,'Синягин Даниил Михайлович',false,'','group_5'),
('g5_r16',16,'Содиков Мехрубон Умиджонович',false,'','group_5'),
('g5_r17',17,'Трифонов Дмитрий Дмитриевич',false,'','group_5'),
('g5_r18',18,'Халецкий Денис Андреевич',false,'','group_5'),
('g5_r19',19,'Шефтнер Никита Константинович',false,'','group_5'),
('g5_r20',20,'Юдин Артём Вячеславович',false,'','group_5');
insert into public.settings(tenant_id,key,value) values('group_5','require_code','on'),('group_5','require_approval','on');
create table politeshik_private.group5_registration_welcomes(uid uuid primary key references auth.users(id) on delete cascade,tenant_id text not null references public.tenants(id) check(tenant_id='group_5'),message_id bigint not null unique,sender uuid not null references auth.users(id),body text not null,created_at timestamptz not null default now());
alter table politeshik_private.group5_registration_welcomes enable row level security;
revoke all on politeshik_private.group5_registration_welcomes from public,anon,authenticated;
create policy welcome_internal_only on politeshik_private.group5_registration_welcomes as restrictive for all to authenticated using(false) with check(false);
DO $clone$declare signature text;expected text;definition text;body text;begin
 for signature,expected in select * from(values
 ('politeshik_private.register_group3_student(text,text,text,text,text)','20c5cb2be167ffa6ae143e8ba35d9b57'),
 ('politeshik_private.guard_group3_document()','0859b85b0c2e0160896ced4d2d6d91ac'),
 ('politeshik_private.send_group3_student_welcome(uuid)','f4504fbdbe535c0b92f7b4d832d31f7b'),
 ('politeshik_private.welcome_group3_registered_student()','e839a9161b9702626f8cb00267e3fb1d'),
 ('politeshik_private.group3_welcome_recipients()','09c3b4887b3cec9f7ed3aea1c54ded11'))x(signature,expected) loop
  select prosrc,pg_get_functiondef(oid) into body,definition from pg_proc where oid=signature::regprocedure;
  assert md5(body)=expected,'Unexpected group-specific source: '||signature;
  definition:=replace(replace(replace(definition,'group3','group5'),'group_3','group_5'),'g3_r16','g5_r12');
  if signature='politeshik_private.register_group3_student(text,text,text,text,text)' then
   definition:=replace(definition,$old$if t='group_5' and p_rid='g5_r12' then$old$,$new$if t='group_5' and p_rid='g5_r12' then
    if not exists(select 1 from politeshik_private.staff_identities i where i.tenant_id=t and i.rid=p_rid and i.role='admin') then
     raise exception 'Место старосты зарезервировано. Админ Арина пока не привязала его почту';end if;$new$);
  end if;
  execute definition;
 end loop;
end $clone$;
revoke all on function politeshik_private.register_group5_student(text,text,text,text,text),politeshik_private.guard_group5_document(),politeshik_private.send_group5_student_welcome(uuid),politeshik_private.welcome_group5_registered_student() from public,anon,authenticated;
revoke all on function politeshik_private.group5_welcome_recipients() from public,anon;grant execute on function politeshik_private.group5_welcome_recipients() to authenticated;
create trigger trg_group5_document_guard before insert or update on public.docs for each row when(new.tenant_id='group_5') execute function politeshik_private.guard_group5_document();
create trigger trg_welcome_group5_registered_student after insert on public.docs for each row when(new.tenant_id='group_5' and new.path like 'profiles/%') execute function politeshik_private.welcome_group5_registered_student();
create policy group5_protect_leader_claim on public.docs as restrictive for insert to authenticated with check(tenant_id<>'group_5' or path<>'claims/g5_r12' or (select public.is_admin()));
create policy group5_docs_insert on public.docs as restrictive for insert to authenticated with check(tenant_id<>'group_5' or split_part(path,'/',1)<>'attendance' or (select public.is_admin()));
create policy group5_docs_update on public.docs as restrictive for update to authenticated using(tenant_id<>'group_5' or split_part(path,'/',1)<>'attendance' or (select public.is_admin())) with check(tenant_id<>'group_5' or split_part(path,'/',1)<>'attendance' or (select public.is_admin()));
create policy group5_docs_delete on public.docs as restrictive for delete to authenticated using(tenant_id<>'group_5' or split_part(path,'/',1)<>'attendance' or (select public.is_admin()));
create policy group5_attendance_insert on public.attendance as restrictive for insert to authenticated with check(tenant_id<>'group_5' or (select public.is_admin()));
create policy group5_attendance_update on public.attendance as restrictive for update to authenticated using(tenant_id<>'group_5' or (select public.is_admin())) with check(tenant_id<>'group_5' or (select public.is_admin()));
create policy group5_attendance_delete on public.attendance as restrictive for delete to authenticated using(tenant_id<>'group_5' or (select public.is_admin()));
DO $welcome$declare definition text;branch text;begin
 select pg_get_functiondef('public.chat_guard()'::regprocedure) into definition;
 branch:=$branch$
begin
 if tg_op='INSERT' and new.tenant_id='group_5' and new.recipient_role='superadmin' and new.kind='text' and new.file_path is null and exists(
  select 1 from politeshik_private.group5_registration_welcomes w where w.uid=new.thread_uid and w.tenant_id=new.tenant_id and w.message_id=new.id and w.sender=new.sender and w.body=new.body) then
  new.sender_label:='Админ Арина';return new;
 end if;
$branch$;
 assert position(E'\nbegin\n' in definition)>0,'Unexpected chat guard';definition:=replace(definition,E'\nbegin\n',branch);execute definition;
end $welcome$;
DO $$declare actor uuid;alphabet text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';suffix text:='';i integer;begin
 select uid into actor from politeshik_private.super_admins order by uid limit 1;if actor is null then raise exception 'Не настроен аккаунт Админа Арины';end if;
 for i in 1..5 loop suffix:=suffix||substr(alphabet,1+floor(random()*length(alphabet))::integer,1);end loop;
 insert into public.group_codes(code,tenant_id,group_id,active,created_by) values('25290907-3111-'||suffix,'group_5','g_25290907_3111',true,actor);
end $$;
insert into public.tenants(id,name) values('group_6','Группа 25290907/1091');
insert into public.groups(id,tenant_id,name) values('g_25290907_1091','group_6','Группа 25290907/1091');
insert into public.roster(rid,n,name,is_admin,subgroup,tenant_id) values
('g6_r1',1,'Александров Егор Павлович',false,'','group_6'),
('g6_r2',2,'Ан Игорь Сергеевич',false,'','group_6'),
('g6_r3',3,'Гусенкова Ольга Руслановна',false,'','group_6'),
('g6_r4',4,'Домбровский Владислав Алексеевич',false,'','group_6'),
('g6_r5',5,'Злобин Егор Алексеевич',false,'','group_6'),
('g6_r6',6,'Зотов Роман Евгеньевич',false,'','group_6'),
('g6_r7',7,'Иванова Екатерина Игоревна',false,'','group_6'),
('g6_r8',8,'Коханова Алина Никитична',false,'','group_6'),
('g6_r9',9,'Кузьмин Георгий Александрович',false,'','group_6'),
('g6_r10',10,'Левандовский Владимир Витальевич',false,'','group_6'),
('g6_r11',11,'Легконравова Вероника Сергеевна',false,'','group_6'),
('g6_r12',12,'Литвинова Аксинья Алексеевна',false,'','group_6'),
('g6_r13',13,'Малов Артём Александрович',false,'','group_6'),
('g6_r14',14,'Морозова Валерия Михайловна',false,'','group_6'),
('g6_r15',15,'Никифорова Алёна Дмитриевна',false,'','group_6'),
('g6_r16',16,'Павлов Владислав Витальевич',false,'','group_6'),
('g6_r17',17,'Петров Иван Николаевич',false,'','group_6'),
('g6_r18',18,'Попов Дмитрий Сергеевич',false,'','group_6'),
('g6_r19',19,'Сагитова Алина',false,'','group_6'),
('g6_r20',20,'Сакун Алиса Денисовна',false,'','group_6'),
('g6_r21',21,'Синякин Иван Михайлович',false,'','group_6'),
('g6_r22',22,'Соничев Илья Александрович',false,'','group_6'),
('g6_r23',23,'Христолюбова Виктория Ивановна',false,'','group_6'),
('g6_r24',24,'Хухка Денис Андреевич',false,'','group_6'),
('g6_r25',25,'Шайтанова Анна Игоревна',false,'','group_6'),
('g6_r26',26,'Шестакова Марина Павловна',false,'','group_6');
insert into public.settings(tenant_id,key,value) values('group_6','require_code','on'),('group_6','require_approval','on');
create table politeshik_private.group6_registration_welcomes(uid uuid primary key references auth.users(id) on delete cascade,tenant_id text not null references public.tenants(id) check(tenant_id='group_6'),message_id bigint not null unique,sender uuid not null references auth.users(id),body text not null,created_at timestamptz not null default now());
alter table politeshik_private.group6_registration_welcomes enable row level security;
revoke all on politeshik_private.group6_registration_welcomes from public,anon,authenticated;
create policy welcome_internal_only on politeshik_private.group6_registration_welcomes as restrictive for all to authenticated using(false) with check(false);
DO $clone$declare signature text;expected text;definition text;body text;begin
 for signature,expected in select * from(values
 ('politeshik_private.register_group3_student(text,text,text,text,text)','20c5cb2be167ffa6ae143e8ba35d9b57'),
 ('politeshik_private.guard_group3_document()','0859b85b0c2e0160896ced4d2d6d91ac'),
 ('politeshik_private.send_group3_student_welcome(uuid)','f4504fbdbe535c0b92f7b4d832d31f7b'),
 ('politeshik_private.welcome_group3_registered_student()','e839a9161b9702626f8cb00267e3fb1d'),
 ('politeshik_private.group3_welcome_recipients()','09c3b4887b3cec9f7ed3aea1c54ded11'))x(signature,expected) loop
  select prosrc,pg_get_functiondef(oid) into body,definition from pg_proc where oid=signature::regprocedure;
  assert md5(body)=expected,'Unexpected group-specific source: '||signature;
  definition:=replace(replace(replace(definition,'group3','group6'),'group_3','group_6'),'g3_r16','g6_r10');
  if signature='politeshik_private.register_group3_student(text,text,text,text,text)' then
   definition:=replace(definition,$old$if t='group_6' and p_rid='g6_r10' then$old$,$new$if t='group_6' and p_rid='g6_r10' then
    if not exists(select 1 from politeshik_private.staff_identities i where i.tenant_id=t and i.rid=p_rid and i.role='admin') then
     raise exception 'Место старосты зарезервировано. Админ Арина пока не привязала его почту';end if;$new$);
  end if;
  execute definition;
 end loop;
end $clone$;
revoke all on function politeshik_private.register_group6_student(text,text,text,text,text),politeshik_private.guard_group6_document(),politeshik_private.send_group6_student_welcome(uuid),politeshik_private.welcome_group6_registered_student() from public,anon,authenticated;
revoke all on function politeshik_private.group6_welcome_recipients() from public,anon;grant execute on function politeshik_private.group6_welcome_recipients() to authenticated;
create trigger trg_group6_document_guard before insert or update on public.docs for each row when(new.tenant_id='group_6') execute function politeshik_private.guard_group6_document();
create trigger trg_welcome_group6_registered_student after insert on public.docs for each row when(new.tenant_id='group_6' and new.path like 'profiles/%') execute function politeshik_private.welcome_group6_registered_student();
create policy group6_protect_leader_claim on public.docs as restrictive for insert to authenticated with check(tenant_id<>'group_6' or path<>'claims/g6_r10' or (select public.is_admin()));
create policy group6_docs_insert on public.docs as restrictive for insert to authenticated with check(tenant_id<>'group_6' or split_part(path,'/',1)<>'attendance' or (select public.is_admin()));
create policy group6_docs_update on public.docs as restrictive for update to authenticated using(tenant_id<>'group_6' or split_part(path,'/',1)<>'attendance' or (select public.is_admin())) with check(tenant_id<>'group_6' or split_part(path,'/',1)<>'attendance' or (select public.is_admin()));
create policy group6_docs_delete on public.docs as restrictive for delete to authenticated using(tenant_id<>'group_6' or split_part(path,'/',1)<>'attendance' or (select public.is_admin()));
create policy group6_attendance_insert on public.attendance as restrictive for insert to authenticated with check(tenant_id<>'group_6' or (select public.is_admin()));
create policy group6_attendance_update on public.attendance as restrictive for update to authenticated using(tenant_id<>'group_6' or (select public.is_admin())) with check(tenant_id<>'group_6' or (select public.is_admin()));
create policy group6_attendance_delete on public.attendance as restrictive for delete to authenticated using(tenant_id<>'group_6' or (select public.is_admin()));
DO $welcome$declare definition text;branch text;begin
 select pg_get_functiondef('public.chat_guard()'::regprocedure) into definition;
 branch:=$branch$
begin
 if tg_op='INSERT' and new.tenant_id='group_6' and new.recipient_role='superadmin' and new.kind='text' and new.file_path is null and exists(
  select 1 from politeshik_private.group6_registration_welcomes w where w.uid=new.thread_uid and w.tenant_id=new.tenant_id and w.message_id=new.id and w.sender=new.sender and w.body=new.body) then
  new.sender_label:='Админ Арина';return new;
 end if;
$branch$;
 assert position(E'\nbegin\n' in definition)>0,'Unexpected chat guard';definition:=replace(definition,E'\nbegin\n',branch);execute definition;
end $welcome$;
DO $$declare actor uuid;alphabet text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';suffix text:='';i integer;begin
 select uid into actor from politeshik_private.super_admins order by uid limit 1;if actor is null then raise exception 'Не настроен аккаунт Админа Арины';end if;
 for i in 1..5 loop suffix:=suffix||substr(alphabet,1+floor(random()*length(alphabet))::integer,1);end loop;
 insert into public.group_codes(code,tenant_id,group_id,active,created_by) values('25290907-1091-'||suffix,'group_6','g_25290907_1091',true,actor);
end $$;

DO $selectors$declare signature text;definition text;begin
 foreach signature in array array['politeshik_private.active_tenant()','politeshik_private.select_group(text)'] loop
  select pg_get_functiondef(signature::regprocedure) into definition;
  assert position($old$'group_1','group_2','group_3','group_4'$old$ in definition)>0,'Unexpected selector list';
  definition:=replace(definition,$old$'group_1','group_2','group_3','group_4'$old$,$new$'group_1','group_2','group_3','group_4','group_5','group_6'$new$);execute definition;
 end loop;
end $selectors$;
DO $dispatch$declare definition text;begin
 select pg_get_functiondef('politeshik_private.register_student(text,text,text,text,text)'::regprocedure) into definition;
 assert position(E'
begin
' in definition)>0,'Unexpected registration body';
 definition:=replace(definition,E'
begin
',E'
begin
  if p_group=''group_5'' then return politeshik_private.register_group5_student(p_group,p_code,p_rid,p_subgroup,p_secret); end if;
  if p_group=''group_6'' then return politeshik_private.register_group6_student(p_group,p_code,p_rid,p_subgroup,p_secret); end if;
');execute definition;
end $dispatch$;
create or replace function public.welcome_recipients() returns jsonb language sql security invoker set search_path='' as $$
 select case when public.current_tenant()='group_6' then politeshik_private.group6_welcome_recipients() when public.current_tenant()='group_5' then politeshik_private.group5_welcome_recipients() when public.current_tenant()='group_4' then politeshik_private.group4_welcome_recipients() when public.current_tenant()='group_3' then politeshik_private.group3_welcome_recipients() else politeshik_private.welcome_recipients() end
$$;
