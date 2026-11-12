-- Ordinary students can be approved by Arina while both leader emails remain unconfigured.
begin;
select set_config('test.super',(select uid::text from politeshik_private.super_admins limit 1),true);
do $$declare n integer;u uuid;begin
 for n in 5..6 loop
  assert not exists(select 1 from politeshik_private.staff_identities where tenant_id='group_'||n),'Leader already bound in fixture';
  u:=gen_random_uuid();perform set_config('test.student'||n,u::text,true);
  perform set_config('test.code'||n,(select code from public.group_codes where tenant_id='group_'||n and active limit 1),true);
  insert into auth.users(id,email,email_confirmed_at,aud,role) values(u,'unbound-group-'||u||'@example.invalid',now(),'authenticated','authenticated');
 end loop;
end $$;
set local role authenticated;
do $$declare n integer;t text;gid text;result jsonb;mark_day date:=(now() at time zone 'Europe/Moscow')::date;begin
 if extract(hour from now() at time zone 'Europe/Moscow')<9 then mark_day:=mark_day-1;end if;
 for n in 5..6 loop
  t:='group_'||n;gid:=case n when 5 then 'g_25290907_3111' else 'g_25290907_1091' end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.student'||n),'role','authenticated')::text,true);perform set_config('request.headers','{}',true);
  result:=public.register_student(t,current_setting('test.code'||n),'g'||n||'_r2','1','');assert result->>'status'='pending','Ordinary student bypassed approval';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.super'),'role','authenticated')::text,true);
  perform public.select_group(t);perform public.decide_access(current_setting('test.student'||n)::uuid,true,'student',gid,null);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.student'||n),'role','authenticated')::text,true);
  assert public.is_member() and not public.is_admin(),'Arina approval failed or granted excessive rights';
  assert public.current_tenant()=t,'Approval attached another tenant';
  result:=public.self_attendance(mark_day,1,'п');assert result->'marks'->>(mark_day::text||'|1')='п','Self mark unavailable after Arina approval';
  assert not exists(select 1 from public.docs where tenant_id<>t),'Education data from another group exposed';
 end loop;
end $$;
rollback;
