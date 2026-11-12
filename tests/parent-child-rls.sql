begin;
select set_config('test.super',(select uid::text from politeshik_private.super_admins limit 1),true);
do $$ declare k text; u uuid; begin
 foreach k in array array['admin3','parent3','parent1','child3a','child3b','child2','developer2'] loop
  u:=gen_random_uuid(); perform set_config('test.'||k,u::text,true);
  insert into auth.users(id,email,email_confirmed_at,aud,role) values(u,'tester-fixes-test-'||u||'@example.invalid',now(),'authenticated','authenticated');
 end loop;
end $$;
insert into public.members(tenant_id,uid,role,status,requested_role,full_name,group_id) values
('group_3',current_setting('test.admin3')::uuid,'admin','approved','student','Test leader','g_23290907_2092'),
('group_3',current_setting('test.parent3')::uuid,'student','approved','parent','Test parent','g_23290907_2092'),
('group_1',current_setting('test.parent1')::uuid,'parent','approved','parent','Home parent','g_main'),
('group_3',current_setting('test.child3a')::uuid,'student','approved','student','Child A','g_23290907_2092'),
('group_3',current_setting('test.child3b')::uuid,'student','approved','student','Child B','g_23290907_2092'),
('group_2',current_setting('test.child2')::uuid,'student','approved','student','Foreign child','g_26290911_3111'),
('group_2',current_setting('test.developer2')::uuid,'developer','approved','student','Developer','g_26290911_3111');
insert into public.admins(tenant_id,uid) values('group_3',current_setting('test.admin3')::uuid);
insert into public.docs(tenant_id,path,data) values
('group_3','profiles/'||current_setting('test.parent3'),'{"role":"parent","name":"Test parent"}'),
('group_3','profiles/'||current_setting('test.child3a'),'{"rid":"g3_r1","name":"Child A","subgroup":"1"}'),
('group_3','profiles/'||current_setting('test.child3b'),'{"rid":"g3_r2","name":"Child B","subgroup":"1"}'),
('group_2','profiles/'||current_setting('test.child2'),'{"rid":"g2_r1","name":"Foreign child","subgroup":"1"}');
do $$ begin
 assert (select role='parent' from public.members where uid=current_setting('test.parent3')::uuid),'Parent retained provisional student role';
end $$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.parent3'),'role','authenticated')::text,true),set_config('request.headers','{}',true);
do $$ declare denied boolean:=false; begin
 begin perform public.admin_set_parent_child(auth.uid(),current_setting('test.child3a')::uuid); exception when insufficient_privilege then denied:=true; end;
 assert denied,'Parent can bind a child without staff approval';
 denied:=false;
 begin update public.docs set data=data||'{"rid":"g3_r1"}'::jsonb where path='profiles/'||auth.uid()::text;
 exception when insufficient_privilege then denied:=true; end;
 assert denied,'Parent can occupy a student surname';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.admin3'),'role','authenticated')::text,true);
select public.admin_set_parent_child(current_setting('test.parent3')::uuid,current_setting('test.child3a')::uuid);
select public.admin_set_parent_child(current_setting('test.parent3')::uuid,current_setting('test.child3b')::uuid);
do $$ declare denied boolean:=false; begin
 assert (select child_uid=current_setting('test.child3b')::uuid and child_name='Child B' and role='parent' from public.members where uid=current_setting('test.parent3')::uuid),'Wrong child or role after correction';
 begin perform public.admin_set_parent_child(current_setting('test.parent3')::uuid,current_setting('test.child2')::uuid); exception when others then denied:=true; end;
 assert denied,'Foreign child accepted';
 denied:=false; begin perform public.admin_set_parent_child(current_setting('test.parent1')::uuid,current_setting('test.child3a')::uuid); exception when others then denied:=true; end;
 assert denied,'Leader modified a parent in another group';
 assert not exists(select 1 from public.teacher_students() where uid=current_setting('test.parent3')),'Parent appears in student journal';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.parent3'),'role','authenticated')::text,true);
do $$ begin
 assert exists(select 1 from public.parent_child() where uid=current_setting('test.child3b')),'Parent cannot see corrected child';
 assert not exists(select 1 from public.parent_child() where uid=current_setting('test.child3a')),'Old child remains linked';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.developer2'),'role','authenticated')::text,true);
do $$ declare denied boolean:=false; begin
 begin perform public.admin_set_parent_child(current_setting('test.parent3')::uuid,current_setting('test.child3a')::uuid); exception when insufficient_privilege then denied:=true; end;
 assert denied,'Developer can change child binding';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.super'),'role','authenticated')::text,true),set_config('request.headers','{"x-politeshik-group":"group_3"}',true);
select public.admin_set_parent_child(current_setting('test.parent3')::uuid,current_setting('test.child3a')::uuid);
reset role;
rollback;
select 'PASS: parents never occupy student profiles, staff can correct child, foreign groups and developer denied, Arina can correct selected group' as result;
