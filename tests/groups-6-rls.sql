-- Isolated fixtures; no real users or messages survive this test.
begin;
DO $$begin assert not exists(select 1 from politeshik_private.staff_identities where tenant_id='group_6'),'Unspecified staff email was invented';assert (select count(*)=26 from public.roster where tenant_id='group_6'),'Wrong roster size';end $$;
select set_config('test.vladimir',gen_random_uuid()::text,true),set_config('test.student6',gen_random_uuid()::text,true),
 set_config('test.wrong',gen_random_uuid()::text,true),set_config('test.other2',gen_random_uuid()::text,true),
 set_config('test.super',(select uid::text from politeshik_private.super_admins limit 1),true);
insert into auth.users(id,email,email_confirmed_at,aud,role)
select current_setting('test.'||k)::uuid,'new-group-6-'||k||'-'||gen_random_uuid()::text||'@example.invalid',now(),'authenticated','authenticated'
 from unnest(array['vladimir','student6','wrong','other2']) k;

insert into public.group_codes(code,tenant_id,group_id) values('25290907-1091-TESTGROUP6','group_6','g_25290907_1091');
insert into public.members(tenant_id,uid,role,status,requested_role,group_id)
 values('group_2',current_setting('test.other2')::uuid,'student','approved','student','g_26290911_3111');
insert into public.docs(tenant_id,path,data) values('group_2','attendance/'||current_setting('test.other2'),'{"marks":{}}');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wrong'),'role','authenticated')::text,true),set_config('request.headers','{}',true);
DO $$declare denied boolean:=false;msg text;begin
 begin perform public.register_student('group_6','25290907-1091-TESTGROUP6','g6_r10','1','');exception when others then get stacked diagnostics msg=message_text;denied:=position('почту' in msg)>0;end;
 assert denied,'Unbound staff registration did not fail closed with a clear message';
 assert not exists(select 1 from public.members where uid=auth.uid()),'Unbound leader placeholder occupied by a real user';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.student6'),'role','authenticated')::text,true);
DO $$declare result jsonb;begin result:=public.register_student('group_6','25290907-1091-TESTGROUP6','g6_r1','1','');assert result->>'status'='pending','Ordinary registration blocked while leader email is unknown';end $$;
-- Supplying a synthetic email only in this rolled-back test proves later activation works.
reset role;
insert into politeshik_private.staff_identities(tenant_id,rid,role,email)
 select 'group_6','g6_r10','admin',lower(email) from auth.users where id=current_setting('test.vladimir')::uuid
 on conflict(tenant_id,rid) do update set email=excluded.email;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wrong'),'role','authenticated')::text,true),set_config('request.headers','{}',true);
do $$ declare denied boolean:=false; begin
 begin perform public.register_student('group_6','25290907-1091-TESTGROUP6','g6_r10','1',''); exception when others then denied:=true; end;
 assert denied,'Wrong email took Vladimir role'; assert not public.is_admin(),'Failed registration granted admin';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.vladimir'),'role','authenticated')::text,true);
do $$ declare result jsonb; denied boolean:=false; begin
 begin perform public.register_student('group_6','wrong','g6_r10','1',''); exception when others then denied:=true; end;
 assert denied,'Wrong code accepted';
 result:=public.register_student('group_6','25290907-1091-TESTGROUP6','g6_r10','1','');
 assert result->>'ok'='true' and result->>'role'='admin' and result->>'status'='approved','Email-bound Vladimir activation failed';
 assert public.current_tenant()='group_6' and public.is_admin() and not public.is_developer() and not politeshik_private.is_super_admin(),'Wrong Vladimir privileges';
 assert not exists(select 1 from public.chat where thread_uid=auth.uid()),'Leader received student welcome';
 assert (select count(*)=0 from public.members where tenant_id<>'group_6'),'Vladimir sees another group';
 denied:=false; begin perform public.select_group('group_2'); exception when others then denied:=true; end; assert denied,'Vladimir can switch groups';
 denied:=false; begin perform public.set_member_role(current_setting('test.other2')::uuid,'admin',null); exception when others then denied:=true; end; assert denied,'Vladimir can use God mode';
 denied:=false; begin perform public.admin_set_status(current_setting('test.other2')::uuid,'banned'); exception when others then denied:=true; end; assert denied,'Vladimir can ban another group';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.student6'),'role','authenticated')::text,true);
do $$ declare result jsonb; denied boolean:=false; begin
 begin perform public.register_student('group_6','25290907-1091-TESTGROUP6','g2_r1','1',''); exception when others then denied:=true; end; assert denied,'Foreign roster accepted';
 result:=public.register_student('group_6','25290907-1091-TESTGROUP6','g6_r1','1','');
 assert result->>'status'='pending' and not public.is_member(),'Student did not await approval';
 assert (select count(*)=1 from public.chat where thread_uid=auth.uid() and tenant_id='group_6' and sender=current_setting('test.super')::uuid and recipient_role='superadmin' and sender_label='Админ Арина'),'Wrong new-group-6 welcome';
 denied:=false; begin perform public.welcome_recipients(); exception when insufficient_privilege then denied:=true; end; assert denied,'Student sees welcome report';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.vladimir'),'role','authenticated')::text,true);
select public.decide_access(current_setting('test.student6')::uuid,true,'student','g_25290907_1091',null);
insert into public.docs(tenant_id,path,data) values('group_6','attendance/'||current_setting('test.student6'),'{"marks":{"2026-11-11|1":"п"}}');
do $$ declare denied boolean:=false; code text; changed int; begin
 assert exists(select 1 from public.admin_users() where uid=current_setting('test.student6')::uuid),'Vladimir cannot see own students';
 assert not exists(select 1 from public.admin_users() where uid=current_setting('test.other2')::uuid),'Vladimir users list leaks group2';
 denied:=false;begin perform public.set_member_role(current_setting('test.student6')::uuid,'admin',null);exception when others then denied:=true;end;assert denied,'Vladimir can use God mode for her own group';
 assert not exists(select 1 from public.chat where thread_uid=current_setting('test.student6')::uuid),'Vladimir sees Arina private welcome';
 update public.docs set data='{"marks":{"2026-11-11|1":"н"}}' where tenant_id='group_6' and path='attendance/'||current_setting('test.student6');
 get diagnostics changed=row_count; assert changed=1,'Vladimir cannot edit own group attendance';
 update public.docs set data='{}' where tenant_id='group_2' and path='attendance/'||current_setting('test.other2');
 get diagnostics changed=row_count; assert changed=0,'Vladimir changed another group attendance';
 code:=public.create_group_code('g_25290907_1091'); assert code like '25290907-1091-%','Code generation has wrong group prefix';
 perform set_config('test.newcode',code,true);
 denied:=false; begin perform public.welcome_recipients(); exception when insufficient_privilege then denied:=true; end; assert denied,'Vladimir sees Arina report';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.student6'),'role','authenticated','app_metadata',jsonb_build_object('tenant_id','group_2'))::text,true),set_config('request.headers','{"x-politeshik-group":"group_2"}',true);
do $$ declare denied boolean:=false; changed int; mark_day date:=(now() at time zone 'Europe/Moscow')::date; result jsonb;begin
 if extract(hour from now() at time zone 'Europe/Moscow')<9 then mark_day:=mark_day-1;end if;
 result:=public.self_attendance(mark_day,1,'п');assert result->'marks'->>(mark_day::text||'|1')='п','New group student cannot mark within 24 hours';
 assert public.current_tenant()='group_6','Student spoofed tenant';
 update public.docs set data='{"marks":{}}' where path='attendance/'||auth.uid()::text;
 get diagnostics changed=row_count; assert changed=0,'Student edited attendance';
 delete from public.docs where path='attendance/'||auth.uid()::text;
 get diagnostics changed=row_count; assert changed=0,'Student deleted attendance';
 begin insert into public.docs(tenant_id,path,data) values('group_6','attendance/'||auth.uid()::text||'/fake','{}'); exception when others then denied:=true; end; assert denied,'Student inserted attendance';
 denied:=false; begin update public.docs set data=jsonb_set(data,'{rid}','"g6_r10"') where path='profiles/'||auth.uid()::text; exception when others then denied:=true; end; assert denied,'Student impersonated Vladimir';
 perform public.register_student('group_6',current_setting('test.newcode'),'g6_r1','1','');
 assert (select count(*)=1 from public.chat where thread_uid=auth.uid()),'Repeated registration duplicated welcome';
 insert into public.chat(tenant_id,thread_uid,sender,body,recipient_role) values('group_6',auth.uid(),auth.uid(),'Hello Vladimir','admin');
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.vladimir'),'role','authenticated')::text,true),set_config('request.headers','{}',true);
do $$ begin assert (select count(*)=1 from public.chat where body='Hello Vladimir'),'Vladimir cannot read her support conversation'; end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.super'),'role','authenticated')::text,true);
select public.select_group('group_6');
do $$ declare changed int; begin
 assert public.is_admin() and politeshik_private.is_super_admin(),'Arina lacks new-group-6 rights';
 assert exists(select 1 from jsonb_array_elements(public.welcome_recipients()) x where x->>'uid'=current_setting('test.student6')),'Third-group report missing recipient';
 assert not exists(select 1 from jsonb_array_elements(public.welcome_recipients()) x where x->>'uid'=current_setting('test.vladimir')),'Report includes leader';
 update public.docs set data='{"marks":{"2026-11-11|1":"п"}}' where path='attendance/'||current_setting('test.student6');
 get diagnostics changed=row_count; assert changed=1,'Arina cannot edit new-group-6 attendance';
end $$;
select public.select_group('group_2');
do $$ begin assert not exists(select 1 from jsonb_array_elements(public.welcome_recipients()) x where x->>'uid'=current_setting('test.student6')),'Third-group recipient leaked into group2 report'; end $$;
reset role;
rollback;
select 'PASS: email-bound leader, roster, codes, approval, no developer, attendance isolation, superadmin switching, private welcome and report' as result;
