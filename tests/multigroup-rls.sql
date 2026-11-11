begin;
select set_config('test.super_uid',(select uid::text from politeshik_private.super_admins limit 1),true);
select set_config('test.admin_uid',gen_random_uuid()::text,true),set_config('test.dev_uid',gen_random_uuid()::text,true),
  set_config('test.student_uid',gen_random_uuid()::text,true),set_config('test.home_uid',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,aud,role)
select current_setting('test.'||kind||'_uid')::uuid,'test-'||kind||'-'||gen_random_uuid()::text||'@example.invalid',now(),'authenticated','authenticated'
from unnest(array['admin','dev','student','home']) as kind;
insert into public.group_codes(code,tenant_id,group_id) values('26290911-3111-TEST99','group_2','g_26290911_3111');
insert into politeshik_private.staff_credentials(tenant_id,role,rid,secret_hash) values
('group_2','admin','g2_r13',extensions.crypt('test-leader-password',extensions.gen_salt('bf'))),
('group_2','developer','g2_r12',extensions.crypt('test-developer-password',extensions.gen_salt('bf')))
on conflict(tenant_id,role) do update set secret_hash=excluded.secret_hash;
insert into public.members(tenant_id,uid,role,status,group_id,full_name)
values('group_1',current_setting('test.home_uid')::uuid,'student','approved','g_main','Test home user');

set local role anon;
do $$ begin
  assert public.check_group_code('26290911-3111-TEST99'),'Anonymous registration cannot validate the new group code';
end $$;

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.admin_uid'),'role','authenticated')::text,true),set_config('request.headers','{}',true);
do $$ declare result jsonb; denied boolean:=false; begin
  begin perform public.register_student('group_2','wrong-code','g2_r13','1','test-leader-password'); exception when others then denied:=true; end;
  assert denied,'Wrong group code was accepted';
  result:=public.register_student('group_2','26290911-3111-TEST99','g2_r13','1','wrong-secret');
  assert result->>'ok'='false','Wrong activation password was accepted';
  assert not public.is_admin(),'Failed activation granted administrator';
  result:=public.register_student('group_2','26290911-3111-TEST99','g2_r13','1','test-leader-password');
  assert result->>'ok'='true','Leader registration failed';
  assert public.current_tenant()='group_2','Leader bound to wrong tenant';
  assert public.is_admin(),'Leader lacks group administrator rights';
  assert not politeshik_private.is_super_admin(),'Leader gained super administrator';
  assert (select count(*)=0 from public.docs where tenant_id='group_1'),'Leader can read home documents';
  assert (select count(*)=0 from public.members where tenant_id='group_1'),'Leader can read home members';
  assert (select count(*)=0 from public.roster where tenant_id='group_1'),'Leader can read home roster';
  denied:=false;
  begin perform public.select_group('group_1'); exception when others then denied:=true; end;
  assert denied,'Leader can switch groups';
  denied:=false;
  begin perform public.set_member_role(current_setting('test.home_uid')::uuid,'student',null); exception when others then denied:=true; end;
  assert denied,'Leader can use God mode';
  denied:=false;
  begin perform public.admin_set_status(current_setting('test.home_uid')::uuid,'banned'); exception when others then denied:=true; end;
  assert denied,'Leader can ban a user of another group';
  assert not exists(select 1 from public.admin_users() where uid=current_setting('test.home_uid')::uuid),'Users RPC leaked another group';
end $$;

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.dev_uid'),'role','authenticated')::text,true);
do $$ declare result jsonb; begin
  result:=public.register_student('group_2','26290911-3111-TEST99','g2_r12','1','test-developer-password');
  assert result->>'ok'='true','Developer registration failed';
  assert public.is_developer() and not public.is_admin(),'Developer role is incorrect';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.student_uid'),'role','authenticated')::text,true);
do $$ declare result jsonb; denied boolean:=false; begin
  begin perform public.register_student('group_2','26290911-3111-TEST99','r2','1',''); exception when others then denied:=true; end;
  assert denied,'A surname from another group was accepted';
  result:=public.register_student('group_2','26290911-3111-TEST99','g2_r1','1','');
  assert result->>'ok'='true' and result->>'status'='pending','Student must await approval';
  assert not public.is_member(),'Pending student can access group data';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.admin_uid'),'role','authenticated')::text,true);
select public.decide_access(current_setting('test.student_uid')::uuid,true,'student','g_26290911_3111',null);
insert into public.docs(tenant_id,path,data) values('group_2','attendance/'||current_setting('test.student_uid'),'{"marks":{"2026-11-10|1":"п"}}');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.student_uid'),'role','authenticated','app_metadata',jsonb_build_object('tenant_id','group_1'))::text,true),
  set_config('request.headers','{"x-politeshik-group":"group_1"}',true);
do $$ declare denied boolean:=false; changed int; begin
  assert public.current_tenant()='group_2','Student forged tenant through request header or JWT metadata';
  assert public.is_member(),'Approved student lacks access';
  begin update public.docs set data='{"marks":{}}' where path='attendance/'||auth.uid()::text; exception when others then denied:=true; end;
  assert (select data->'marks'->>'2026-11-10|1'='п' from public.docs where path='attendance/'||auth.uid()::text),'Student changed own attendance';
  delete from public.docs where path='attendance/'||auth.uid()::text;
  get diagnostics changed=row_count;
  assert changed=0,'Student deleted own attendance';
  denied:=false;
  begin insert into public.docs(tenant_id,path,data) values('group_1','attendance/'||auth.uid()::text,'{}'); exception when others then denied:=true; end;
  assert denied,'Student inserted data into another tenant';
  insert into public.chat(tenant_id,thread_uid,sender,body,recipient_role) values
    ('group_2',auth.uid(),auth.uid(),'student to leader','admin'),
    ('group_2',auth.uid(),auth.uid(),'student to developer','developer'),
    ('group_2',auth.uid(),auth.uid(),'student to Arina','superadmin');
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.dev_uid'),'role','authenticated')::text,true),set_config('request.headers','{}',true);
do $$ declare denied boolean:=false; changed int; begin
  assert (select count(*)=1 from public.chat where thread_uid=current_setting('test.student_uid')::uuid),'Developer saw private conversations of other recipients';
  assert (select count(*)=1 from public.docs where path='attendance/'||current_setting('test.student_uid')),'Developer cannot read attendance';
  update public.docs set data='{"marks":{}}' where path='attendance/'||current_setting('test.student_uid');
  get diagnostics changed=row_count;
  assert changed=0,'Developer edited attendance';
  begin perform public.decide_access(current_setting('test.student_uid')::uuid,false,null,null,null); exception when others then denied:=true; end;
  assert denied,'Developer approved or rejected applications';
  denied:=false;
  begin perform public.set_member_role(current_setting('test.dev_uid')::uuid,'admin',null); exception when others then denied:=true; end;
  assert denied,'Developer escalated own privileges';
  insert into public.chat(tenant_id,thread_uid,sender,body,recipient_role)
    values('group_2',current_setting('test.student_uid')::uuid,auth.uid(),'developer response','developer');
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.admin_uid'),'role','authenticated')::text,true);
do $$ declare denied boolean:=false; changed int; begin
  assert (select count(*)=1 from public.chat where thread_uid=current_setting('test.student_uid')::uuid),'Leader saw developer or Arina private conversations';
  assert exists(select 1 from public.teacher_students() where uid=current_setting('test.dev_uid')),'Developer disappeared from the student journal';
  update public.docs set data='{"marks":{"2026-11-10|1":"н"}}' where path='attendance/'||current_setting('test.student_uid');
  get diagnostics changed=row_count;
  assert changed=1,'Leader cannot edit own group attendance';
  begin insert into public.chat(tenant_id,thread_uid,sender,body,recipient_role)
    values('group_2',current_setting('test.home_uid')::uuid,auth.uid(),'forbidden','admin'); exception when others then denied:=true; end;
  assert denied,'Leader messaged a student of another tenant';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.super_uid'),'role','authenticated')::text,true),set_config('request.headers','{}',true);
select public.select_group('group_2');
do $$ declare changed int; begin
  assert politeshik_private.is_super_admin() and public.is_admin(),'Arina lacks super administrator privileges';
  assert public.current_tenant()='group_2','Arina cannot select second group';
  assert (select count(*)=4 from public.chat where thread_uid=current_setting('test.student_uid')::uuid),'Arina cannot see all support conversations';
  update public.docs set data='{"marks":{"2026-11-10|1":"п"}}' where path='attendance/'||current_setting('test.student_uid');
  get diagnostics changed=row_count;
  assert changed=1,'Arina cannot edit second group attendance';
  insert into public.chat(tenant_id,thread_uid,sender,body,recipient_role)
    values('group_2',current_setting('test.student_uid')::uuid,auth.uid(),'Arina response','superadmin');
  assert exists(select 1 from public.chat where sender=auth.uid() and body='Arina response' and sender_label='Админ Арина'),'Arina has wrong chat name';
end $$;
select set_config('request.headers','{"x-politeshik-group":"group_1"}',true);
do $$ begin
  assert public.current_tenant()='group_1','Independent group selection for Arina tabs failed';
  assert (select count(*)=0 from public.docs where tenant_id='group_2'),'Cross-group query leaked without selecting group';
end $$;
reset role;
rollback;
select 'PASS: registration, group codes, additional passwords, approval, RLS isolation, read-only developer, scoped leader, super-admin switching and chats; all test accounts rolled back' as result;
