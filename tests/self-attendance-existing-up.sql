-- Regression: adding an ordinary self mark must preserve existing manual UP in all six groups.
begin;
select set_config('app.import','on',true);
do $$declare n integer;t text;gid text;u uuid;begin
 for n in 1..6 loop
  t:='group_'||n;select id into gid from public.groups where tenant_id=t limit 1;u:=gen_random_uuid();perform set_config('test.up_student_'||n,u::text,true);
  insert into auth.users(id,email,email_confirmed_at,aud,role) values(u,'self-up-'||u||'@example.invalid',now(),'authenticated','authenticated');
  insert into public.members(tenant_id,uid,role,status,requested_role,group_id,full_name) values(t,u,'student','approved','student',gid,'Self mark regression');
  insert into public.docs(tenant_id,path,data)values(t,'attendance/'||u,jsonb_build_object('marks',jsonb_build_object('2026-10-02|1','уп'),'keep','metadata'));
 end loop;
end $$;
select set_config('app.import','',true);
set local role authenticated;
do $$declare n integer;u uuid;t text;day date;result jsonb;denied boolean;begin
 for n in 1..6 loop
  u:=current_setting('test.up_student_'||n)::uuid;t:='group_'||n;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);perform set_config('request.headers','{}',true);
  day:=(now() at time zone 'Europe/Moscow')::date;if extract(hour from now() at time zone 'Europe/Moscow')<9 then day:=day-1;end if;
  result:=public.self_attendance(day,1,'п');
  assert result->'marks'->>'2026-10-02|1'='уп','Existing UP lost in '||t;
  assert result->'marks'->>(day::text||'|1')='п','Ordinary self mark missing in '||t;
  assert result->>'keep'='metadata','Other attendance fields lost';
  denied:=false;begin perform public.self_attendance(day,2,'уп');exception when insufficient_privilege then denied:=true;end;assert denied,'Student may set UP';
  denied:=false;begin perform public.self_attendance(day,1,'н');exception when others then denied:=true;end;assert denied,'Existing mark may be overwritten';
 end loop;
end $$;
reset role;
rollback;
