-- Add only group_4. Reuse the rehearsed email-bound group_3 path with exact source assertions.
-- Existing groups, registration passwords, approval rules, staff roles and tenant boundaries stay unchanged.
DO $$begin
 assert not exists(select 1 from public.tenants where id='group_4'),'Fourth group already exists';
 assert (select md5(prosrc) from pg_proc where oid='politeshik_private.register_student(text,text,text,text,text)'::regprocedure)='980b16d5e17d04bddfbb420a968cff6a','Unexpected registration baseline';
 assert (select md5(prosrc) from pg_proc where oid='politeshik_private.active_tenant()'::regprocedure)='a393e235c639381d59f5a94355335b00','Unexpected tenant selector baseline';
 assert (select md5(prosrc) from pg_proc where oid='politeshik_private.select_group(text)'::regprocedure)='714543cb1d7451b7d9d226fa59172a49','Unexpected group selector baseline';
 assert (select md5(prosrc) from pg_proc where oid='public.chat_guard()'::regprocedure)='9b00b691a836bfe44ca2e4488f597f59','Unexpected chat guard baseline';
 assert (select md5(prosrc) from pg_proc where oid='public.welcome_recipients()'::regprocedure)='3c09a811ef1b624e7f0207d4c3d5bcaa','Unexpected welcome report baseline';
end $$;
insert into public.tenants(id,name) values('group_4','Группа 24290907/2092');
insert into public.groups(id,tenant_id,name) values('g_24290907_2092','group_4','Группа 24290907/2092');
insert into public.roster(rid,n,name,is_admin,subgroup,tenant_id) values
('g4_r1',1,'Анисимов Александр Валентинович',false,'','group_4'),
('g4_r2',2,'Белик Екатерина Владимировна',false,'','group_4'),
('g4_r3',3,'Демченко Анастасия Дмитриевна',false,'','group_4'),
('g4_r4',4,'Егиазарян Грач Романович',false,'','group_4'),
('g4_r5',5,'Закиров Арсений Рустамович',false,'','group_4'),
('g4_r6',6,'Зернова Екатерина Сергеевна',false,'','group_4'),
('g4_r7',7,'Картамаков Никита Евгеньевич',false,'','group_4'),
('g4_r8',8,'Качан Андрей Алексеевич',false,'','group_4'),
('g4_r9',9,'Кетросан Денис Иванович',false,'','group_4'),
('g4_r10',10,'Кошкин Евгений Владимирович',false,'','group_4'),
('g4_r11',11,'Крылов Арсений Андреевич',false,'','group_4'),
('g4_r12',12,'Куляшов Артём Александрович',false,'','group_4'),
('g4_r13',13,'Локтева Анна Андреевна',false,'','group_4'),
('g4_r14',14,'Лукашев Евгений Владимирович',false,'','group_4'),
('g4_r15',15,'Милованов Кирилл Александрович',false,'','group_4'),
('g4_r16',16,'Мухин Андрей Павлович',false,'','group_4'),
('g4_r17',17,'Назарова Валерия Олеговна',false,'','group_4'),
('g4_r18',18,'Нацибулин Андрей Александрович',false,'','group_4'),
('g4_r19',19,'Нестерович Алексей Андреевич',false,'','group_4'),
('g4_r20',20,'Петров Василий Васильевич',false,'','group_4'),
('g4_r21',21,'Попенко Арина Павловна',false,'','group_4'),
('g4_r22',22,'Решетникова Анна Юрьевна',false,'','group_4'),
('g4_r23',23,'Родоманова Амелия Андреевна',false,'','group_4'),
('g4_r24',24,'Седов Александр Павлович',false,'','group_4'),
('g4_r25',25,'Солодко Мартин Георгиевич',false,'','group_4'),
('g4_r26',26,'Сорокина Ксения Андреевна',false,'','group_4'),
('g4_r27',27,'Степкин Лев Николаевич',false,'','group_4'),
('g4_r28',28,'Сырцев Лев Александрович',false,'','group_4'),
('g4_r29',29,'Тиликова Ангелина Вячеславовна',false,'','group_4');
insert into public.settings(tenant_id,key,value) values('group_4','require_code','on'),('group_4','require_approval','on');
insert into politeshik_private.staff_identities(tenant_id,rid,role,email) values('group_4','g4_r29','admin','angelina.tilikova@yandex.ru');
create table politeshik_private.group4_registration_welcomes(
 uid uuid primary key references auth.users(id) on delete cascade,tenant_id text not null references public.tenants(id) check(tenant_id='group_4'),
 message_id bigint not null unique,sender uuid not null references auth.users(id),body text not null,created_at timestamptz not null default now());
alter table politeshik_private.group4_registration_welcomes enable row level security;
revoke all on politeshik_private.group4_registration_welcomes from public,anon,authenticated;
create policy deny_direct_access on politeshik_private.group4_registration_welcomes for all using(false) with check(false);

-- Exact, private group-specific copies, including the current own-mark RPC exception.
DO $clone$declare signature text;expected text;definition text;body text;begin
 for signature,expected in select * from(values
 ('politeshik_private.register_group3_student(text,text,text,text,text)','20c5cb2be167ffa6ae143e8ba35d9b57'),
 ('politeshik_private.guard_group3_document()','0859b85b0c2e0160896ced4d2d6d91ac'),
 ('politeshik_private.send_group3_student_welcome(uuid)','f4504fbdbe535c0b92f7b4d832d31f7b'),
 ('politeshik_private.welcome_group3_registered_student()','e839a9161b9702626f8cb00267e3fb1d'),
 ('politeshik_private.group3_welcome_recipients()','09c3b4887b3cec9f7ed3aea1c54ded11'))x(signature,expected) loop
  select prosrc,pg_get_functiondef(oid) into body,definition from pg_proc where oid=signature::regprocedure;
  assert md5(body)=expected,'Unexpected group-specific source: '||signature;
  definition:=replace(replace(replace(definition,'group3','group4'),'group_3','group_4'),'g3_r16','g4_r29');
  execute definition;
 end loop;
end $clone$;
revoke all on function politeshik_private.register_group4_student(text,text,text,text,text),politeshik_private.guard_group4_document(),politeshik_private.send_group4_student_welcome(uuid),politeshik_private.welcome_group4_registered_student() from public,anon,authenticated;
revoke all on function politeshik_private.group4_welcome_recipients() from public,anon;
grant execute on function politeshik_private.group4_welcome_recipients() to authenticated;

-- Append one literal tenant to the two superadmin-only selectors; preserve their authorization.
DO $selectors$declare signature text;definition text;begin
 foreach signature in array array['politeshik_private.active_tenant()','politeshik_private.select_group(text)'] loop
  select pg_get_functiondef(signature::regprocedure) into definition;
  assert position($old$'group_1','group_2','group_3'$old$ in definition)>0,'Unexpected selector list';
  definition:=replace(definition,$old$'group_1','group_2','group_3'$old$,$new$'group_1','group_2','group_3','group_4'$new$);
  execute definition;
 end loop;
end $selectors$;
DO $dispatch$declare definition text;begin
 select pg_get_functiondef('politeshik_private.register_student(text,text,text,text,text)'::regprocedure) into definition;
 assert position(E'\nbegin\n' in definition)>0,'Unexpected registration body';
 definition:=replace(definition,E'\nbegin\n',E'\nbegin\n  if p_group=''group_4'' then return politeshik_private.register_group4_student(p_group,p_code,p_rid,p_subgroup,p_secret); end if;\n');
 execute definition;
end $dispatch$;

create trigger trg_group4_document_guard before insert or update on public.docs for each row when(new.tenant_id='group_4') execute function politeshik_private.guard_group4_document();
create trigger trg_welcome_group4_registered_student after insert on public.docs for each row when(new.tenant_id='group_4' and new.path like 'profiles/%') execute function politeshik_private.welcome_group4_registered_student();
create policy group4_protect_leader_claim on public.docs as restrictive for insert to authenticated with check(tenant_id<>'group_4' or path<>'claims/g4_r29' or (select public.is_admin()));
create policy group4_docs_insert on public.docs as restrictive for insert to authenticated with check(tenant_id<>'group_4' or split_part(path,'/',1)<>'attendance' or (select public.is_admin()));
create policy group4_docs_update on public.docs as restrictive for update to authenticated using(tenant_id<>'group_4' or split_part(path,'/',1)<>'attendance' or (select public.is_admin())) with check(tenant_id<>'group_4' or split_part(path,'/',1)<>'attendance' or (select public.is_admin()));
create policy group4_docs_delete on public.docs as restrictive for delete to authenticated using(tenant_id<>'group_4' or split_part(path,'/',1)<>'attendance' or (select public.is_admin()));
create policy group4_attendance_insert on public.attendance as restrictive for insert to authenticated with check(tenant_id<>'group_4' or (select public.is_admin()));
create policy group4_attendance_update on public.attendance as restrictive for update to authenticated using(tenant_id<>'group_4' or (select public.is_admin())) with check(tenant_id<>'group_4' or (select public.is_admin()));
create policy group4_attendance_delete on public.attendance as restrictive for delete to authenticated using(tenant_id<>'group_4' or (select public.is_admin()));

-- Exact automation exception: only the privately recorded welcome for this recipient may use Arina's sender.
DO $welcome$declare definition text;branch text;begin
 select pg_get_functiondef('public.chat_guard()'::regprocedure) into definition;
 branch:=$branch$
begin
 if tg_op='INSERT' and new.tenant_id='group_4' and new.recipient_role='superadmin' and new.kind='text' and new.file_path is null and exists(
  select 1 from politeshik_private.group4_registration_welcomes w where w.uid=new.thread_uid and w.tenant_id=new.tenant_id and w.message_id=new.id and w.sender=new.sender and w.body=new.body) then
  new.sender_label:='Админ Арина';return new;
 end if;
$branch$;
 assert position(E'\nbegin\n' in definition)>0,'Unexpected chat guard';
 definition:=replace(definition,E'\nbegin\n',branch);execute definition;
end $welcome$;
create or replace function public.welcome_recipients() returns jsonb language sql security invoker set search_path='' as $$
 select case when public.current_tenant()='group_4' then politeshik_private.group4_welcome_recipients() when public.current_tenant()='group_3' then politeshik_private.group3_welcome_recipients() else politeshik_private.welcome_recipients() end
$$;

-- Generate a reviewable initial invitation. Its value is not embedded in the public source.
DO $$declare actor uuid;alphabet text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';suffix text:='';i integer;begin
 select uid into actor from politeshik_private.super_admins order by uid limit 1;
 if actor is null then raise exception 'Не настроен аккаунт Админа Арины';end if;
 for i in 1..5 loop suffix:=suffix||substr(alphabet,1+floor(random()*length(alphabet))::integer,1);end loop;
 insert into public.group_codes(code,tenant_id,group_id,active,created_by) values('24290907-2092-'||suffix,'group_4','g_24290907_2092',true,actor);
end $$;
