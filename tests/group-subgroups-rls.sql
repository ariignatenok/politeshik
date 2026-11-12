begin;
select set_config('test.subgroup_owner',(select uid::text from politeshik_private.super_admins limit 1),true);
do $$declare group_num integer;t text;admin_uid uuid;student_uid uuid;gid text;begin
 for group_num in 2..6 loop
  t:='group_'||group_num;admin_uid:=gen_random_uuid();student_uid:=gen_random_uuid();perform set_config('test.subgroup_admin'||group_num,admin_uid::text,true);perform set_config('test.subgroup_student'||group_num,student_uid::text,true);
  select id into gid from public.groups where tenant_id=t limit 1;
  insert into auth.users(id,email,email_confirmed_at,aud,role) values(admin_uid,'subgroup-admin-'||admin_uid||'@example.invalid',now(),'authenticated','authenticated'),(student_uid,'subgroup-student-'||student_uid||'@example.invalid',now(),'authenticated','authenticated');
  insert into public.members(tenant_id,uid,role,status,requested_role,group_id) values(t,admin_uid,'admin','approved','student',gid),(t,student_uid,'student','approved','student',gid);
  insert into public.admins(tenant_id,uid) values(t,admin_uid);
  insert into public.docs(tenant_id,path,data) values(t,'profiles/'||student_uid,jsonb_build_object('name','Subgroup fixture','rid','g'||group_num||'_r1','subgroup','1'));
 end loop;
end $$;
set local role authenticated;
select set_config('request.headers','{}',true);
do $$declare group_num integer;denied boolean;begin
 for group_num in 2..6 loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.subgroup_admin'||group_num),'role','authenticated')::text,true);
  assert public.set_subgroup('g'||group_num||'_r1','2')=1,'Own student profile not updated';
  assert exists(select 1 from public.subgroup_list() where rid='g'||group_num||'_r1' and subgroup='2'),'Assignment not saved';
  assert public.set_subgroup('g'||group_num||'_r2','1')=0,'Unregistered roster row cannot be prepared';
  denied:=false;begin perform public.set_subgroup('r1','1');exception when insufficient_privilege then denied:=true;end;assert denied,'Leader changed foreign group';
  denied:=false;begin perform public.set_subgroup('g'||group_num||'_r1','3');exception when insufficient_privilege then denied:=true;end;assert denied,'Invalid subgroup accepted';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.subgroup_student'||group_num),'role','authenticated')::text,true);
  denied:=false;begin perform public.set_subgroup('g'||group_num||'_r1','1');exception when insufficient_privilege then denied:=true;end;assert denied,'Student can change subgroup';
 end loop;
end $$;
reset role;
do $$declare group_num integer;begin
 for group_num in 2..6 loop
  assert (select subgroup='2' from public.roster where tenant_id='group_'||group_num and rid='g'||group_num||'_r1'),'Registration roster was not updated';
  assert (select data->>'subgroup'='2' from public.docs where path='profiles/'||current_setting('test.subgroup_student'||group_num)),'Saved student profile was not updated';
 end loop;
end $$;
update public.members set role='developer' where uid=current_setting('test.subgroup_admin2')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.subgroup_admin2'),'role','authenticated')::text,true);
do $$declare denied boolean:=false;begin begin perform public.set_subgroup('g2_r1','1');exception when insufficient_privilege then denied:=true;end;assert denied,'Developer received subgroup editing';end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.subgroup_owner'),'role','authenticated')::text,true);
select public.select_group('group_6');
select public.set_subgroup('g6_r1','1');
reset role;
rollback;
