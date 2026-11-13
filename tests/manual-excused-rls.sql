begin;
select set_config('app.import','on',true);
select set_config('test.super',(select uid::text from politeshik_private.super_admins limit 1),true);
do $$ declare i int; a uuid; s uuid; begin
 for i in 1..3 loop
  a:=gen_random_uuid(); s:=gen_random_uuid();
  perform set_config('test.admin'||i,a::text,true); perform set_config('test.student'||i,s::text,true);
  insert into auth.users(id,email,email_confirmed_at,aud,role) values
   (a,'manual-u-test-'||a||'@example.invalid',now(),'authenticated','authenticated'),
   (s,'manual-u-test-'||s||'@example.invalid',now(),'authenticated','authenticated');
  insert into public.members(tenant_id,uid,role,status,requested_role,group_id) values
   ('group_'||i,a,'admin','approved','student',case i when 1 then 'g_main' when 2 then 'g_26290911_3111' else 'g_23290907_2092' end),
   ('group_'||i,s,'student','approved','student',case i when 1 then 'g_main' when 2 then 'g_26290911_3111' else 'g_23290907_2092' end);
  insert into public.admins(tenant_id,uid) values('group_'||i,a);
  insert into public.docs(tenant_id,path,data) values('group_'||i,'attendance/'||s,'{"marks":{"2026-11-12|1":"н"}}');
 end loop;
end $$;
select set_config('app.import','',true);
set local role authenticated;
do $$ declare i int; changed int; denied boolean; begin
 for i in 1..3 loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.admin'||i),'role','authenticated')::text,true);
  perform set_config('request.headers','{}',true);
  update public.docs set data='{"marks":{"2026-11-12|1":"у"}}' where tenant_id='group_'||i and path='attendance/'||current_setting('test.student'||i);
  get diagnostics changed=row_count; assert changed=1,'Leader cannot set У';
  assert exists(select 1 from public.docs where tenant_id='group_'||i and path='attendance/'||current_setting('test.student'||i) and data->'marks'->>'2026-11-12|1'='уп'),'Legacy У must normalize to УП';
  -- Removing and setting У are both permitted for the scoped leader.
  update public.docs set data='{"marks":{"2026-11-12|1":"п"}}' where tenant_id='group_'||i and path='attendance/'||current_setting('test.student'||i);
  update public.docs set data='{"marks":{"2026-11-12|1":"у"}}' where tenant_id='group_'||i and path='attendance/'||current_setting('test.student'||i);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.student'||i),'role','authenticated')::text,true);
  denied:=false;
  begin update public.docs set data='{"marks":{"2026-11-12|1":"п"}}' where path='attendance/'||auth.uid()::text;
   get diagnostics changed=row_count; denied:=changed=0;
  exception when others then denied:=true; end;
  assert denied,'Student can remove manual У';
  denied:=false;
  begin insert into public.docs(tenant_id,path,data) values('group_'||i,'attendance/'||auth.uid()::text||'/fake','{"marks":{"2026-11-12|2":"у"}}');
  exception when others then denied:=true; end;
  assert denied,'Student can insert manual У';
 end loop;
end $$;
-- A curator may otherwise manage the home group, but cannot set or remove manual У.
reset role;
select set_config('test.curator',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,aud,role) values(current_setting('test.curator')::uuid,'manual-u-test-'||current_setting('test.curator')||'@example.invalid',now(),'authenticated','authenticated');
insert into public.members(tenant_id,uid,role,status,requested_role,group_id) values('group_1',current_setting('test.curator')::uuid,'curator','approved','staff','g_main');
update public.groups set curator_uid=current_setting('test.curator')::uuid where id='g_main';
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.curator'),'role','authenticated')::text,true),set_config('request.headers','{}',true);
do $$ declare denied boolean:=false; changed int; begin
 assert public.curator_manages(current_setting('test.student1')),'Curator fixture is not scoped to student';
 begin update public.docs set data='{"marks":{"2026-11-12|1":"п"}}' where path='attendance/'||current_setting('test.student1');
  get diagnostics changed=row_count; denied:=changed=0;
 exception when insufficient_privilege then denied:=true; end;
 assert denied,'Curator can remove manual У';
 denied:=false;
 begin insert into public.docs(tenant_id,path,data) values('group_1','attendance/'||auth.uid()::text,'{"marks":{"2026-11-12|1":"у"}}');
 exception when others then denied:=true; end;
 assert denied,'Curator can set manual У';
end $$;
reset role;
update public.members set role='developer' where uid=current_setting('test.student2')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.student2'),'role','authenticated')::text,true),set_config('request.headers','{}',true);
do $$ declare denied boolean:=false; changed int; begin
 begin update public.docs set data='{"marks":{"2026-11-12|1":"п"}}' where path='attendance/'||auth.uid()::text;
  get diagnostics changed=row_count; denied:=changed=0;
 exception when others then denied:=true; end;
 assert denied,'Developer can change manual У';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.super'),'role','authenticated')::text,true),set_config('request.headers','{"x-politeshik-group":"group_3"}',true);
do $$ declare changed int; begin
 update public.docs set data='{"marks":{"2026-11-12|1":"у","2026-11-12|2":"у"}}' where tenant_id='group_3' and path='attendance/'||current_setting('test.student3');
 get diagnostics changed=row_count; assert changed=1,'Arina cannot set У in selected group';
end $$;
reset role;
rollback;
select 'PASS: manual У saved by leaders in all three groups; students and curator denied; Arina can edit selected group' as result;
