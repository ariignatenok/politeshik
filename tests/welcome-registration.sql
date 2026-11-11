-- All test accounts, messages and code are rolled back.
begin;
select set_config('test.welcome_uid',gen_random_uuid()::text,true),
  set_config('test.other_uid',gen_random_uuid()::text,true),
  set_config('test.home_uid',gen_random_uuid()::text,true),
  set_config('test.arina_uid',(select uid::text from politeshik_private.super_admins limit 1),true),
  set_config('test.welcome_rid',(select r.rid from public.roster r where r.tenant_id='group_2' and r.flag='' and r.rid not in ('g2_r12','g2_r13') and not exists(select 1 from public.docs d where d.tenant_id=r.tenant_id and d.path='claims/'||r.rid) order by r.rid limit 1),true);
insert into auth.users(id,email,email_confirmed_at,aud,role)
select current_setting('test.'||k||'_uid')::uuid,'welcome-test-'||gen_random_uuid()::text||'@example.invalid',now(),'authenticated','authenticated'
from unnest(array['welcome','other','home']) k;
insert into public.group_codes(code,tenant_id,group_id) values('26290911-3111-WELCOMETEST','group_2','g_26290911_3111');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.welcome_uid'),'role','authenticated')::text,true),set_config('request.headers','{}',true);
do $$ declare result jsonb; begin
  result:=public.register_student('group_2','26290911-3111-WELCOMETEST',current_setting('test.welcome_rid'),'1','');
  assert result->>'ok'='true','Registration failed';
  assert result->>'status'='pending','Approval requirement changed';
  assert (select count(*)=1 from public.chat where thread_uid=auth.uid() and recipient_role='superadmin'
    and sender=current_setting('test.arina_uid')::uuid and sender_label='Админ Арина'
    and body like 'Привеет! Добро пожаловать%' and not read_by_student and read_by_admin),'Welcome is missing or incorrect';
  perform public.register_student('group_2','26290911-3111-WELCOMETEST',current_setting('test.welcome_rid'),'1','');
  assert (select count(*)=1 from public.chat where thread_uid=auth.uid()),'Repeated registration duplicated the welcome';
end $$;
reset role;
update public.members set status='approved' where uid=current_setting('test.welcome_uid')::uuid;
-- Recreating the same profile must not resend the welcome.
insert into public.docs(tenant_id,path,data)
select tenant_id,replace(path,'profiles/','test-profile/'),data from public.docs where tenant_id='group_2' and path='profiles/'||current_setting('test.welcome_uid');
delete from public.docs where tenant_id='group_2' and path='profiles/'||current_setting('test.welcome_uid');
insert into public.docs(tenant_id,path,data)
select tenant_id,replace(path,'test-profile/','profiles/'),data from public.docs where tenant_id='group_2' and path='test-profile/'||current_setting('test.welcome_uid');
insert into public.members(tenant_id,uid,role,status,requested_role,group_id)
values('group_2',current_setting('test.other_uid')::uuid,'student','approved','student','g_26290911_3111'),
('group_1',current_setting('test.home_uid')::uuid,'student','approved','student','g_main');
insert into public.docs(tenant_id,path,data) select 'group_1','profiles/'||current_setting('test.home_uid'),jsonb_build_object('rid',rid,'name','Welcome test home') from public.roster where tenant_id='group_1' and flag='' and rid<>'r32' limit 1;
do $$ begin
  assert (select count(*)=1 from public.chat where thread_uid=current_setting('test.welcome_uid')::uuid),'Recreated profile duplicated welcome';
  assert not exists(select 1 from public.chat where thread_uid=current_setting('test.home_uid')::uuid),'Home group received welcome';
  assert (select count(*)=1 from politeshik_private.registration_welcomes where uid=current_setting('test.welcome_uid')::uuid),'Delivery marker missing';
end $$;
set local role authenticated;
do $$ declare denied boolean:=false; begin
  begin insert into public.chat(tenant_id,thread_uid,sender,body,recipient_role)
    values('group_2',auth.uid(),current_setting('test.arina_uid')::uuid,'Spoofed Arina','superadmin');
  exception when insufficient_privilege then denied:=true; end;
  assert denied,'Student can impersonate Arina';
  begin update politeshik_private.registration_welcomes set body='spoof';
    raise exception 'Private markers writable';
  exception when insufficient_privilege then null; end;
  update public.chat set read_by_student=true where thread_uid=auth.uid();
  assert (select bool_and(read_by_student) from public.chat where thread_uid=auth.uid()),'Welcome cannot be marked read';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.other_uid'),'role','authenticated')::text,true);
do $$ begin assert not exists(select 1 from public.chat where thread_uid=current_setting('test.welcome_uid')::uuid),'Another student can read private welcome'; end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.arina_uid'),'role','authenticated')::text,true),set_config('request.headers','{"x-politeshik-group":"group_2"}',true);
do $$ begin assert (select count(*)=1 from public.chat where thread_uid=current_setting('test.welcome_uid')::uuid),'Arina cannot see the welcome in her chat'; end $$;
select 'PASS: group2 registration, pending approval, once only, no home-group delivery, correct sender, private chat and read receipts' as result;
rollback;
