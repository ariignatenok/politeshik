-- All fixtures and activation are rolled back; no real accounts or emails are created.
begin;
select set_config('test.curator',gen_random_uuid()::text,true),set_config('test.spoof',gen_random_uuid()::text,true);
insert into auth.users(id,email,aud,role,raw_user_meta_data) values(current_setting('test.curator')::uuid,'Nazarov_da@spbstu.ru','authenticated','authenticated','{"person_name":"Spoofed name"}');
insert into auth.users(id,email,email_confirmed_at,aud,role,raw_user_meta_data) values(current_setting('test.spoof')::uuid,'curator-spoof-'||gen_random_uuid()||'@example.invalid',now(),'authenticated','authenticated','{"email":"Nazarov_da@spbstu.ru","role":"curator"}');
select set_config('app.import','on',true);
do $$declare n integer;u uuid;t text;gid text;begin
 for n in 4..6 loop
  t:='group_'||n;gid:=case n when 4 then 'g_24290907_2092' when 5 then 'g_25290907_3111' else 'g_25290907_1091' end;u:=gen_random_uuid();perform set_config('test.curator_student'||n,u::text,true);
  insert into auth.users(id,email,email_confirmed_at,aud,role) values(u,'curator-student-'||u||'@example.invalid',now(),'authenticated','authenticated');
  insert into public.members(tenant_id,uid,role,status,requested_role,group_id,full_name) values(t,u,'student','approved','student',gid,'Curator student '||n);
  insert into public.docs(tenant_id,path,data) values(t,'profiles/'||u,jsonb_build_object('name','Curator student '||n,'rid','g'||n||'_r1','phone','private phone','email','private@example.invalid')),
   (t,'attendance/'||u,'{"marks":{"2026-10-11|1":"н","2026-11-11|1":"п","2026-11-12|1":"н"}}'),
   (t,'certs/'||u,'{"items":[{"from":"2026-11-12","to":"2026-11-12","confirmed":true,"pairs":[1],"photo":"private medical image","note":"private medical note"}]}');
  insert into public.docs(tenant_id,path,data) values(t,'group/config','{"schedule":[{"day":0,"pair":1,"subjectId":"test-subject","who":"Test teacher"}],"pairs":[],"weeks":{},"anchor":"2026-10-12","subjects":[],"private_script_url":"must-not-leak"}') on conflict(tenant_id,path) do update set data=excluded.data;
  insert into public.news(tenant_id,title,body,news_date,created_by) values(t,'Curator news '||n,'Group-only public announcement','2026-11-12',u);
 end loop;
end $$;
select set_config('app.import','',true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.spoof'),'role','authenticated')::text,true),set_config('request.headers','{}',true);
do $$declare denied boolean:=false;begin
 assert public.activate_bound_curator()->>'matched'='false','User metadata spoof granted curator role';
 begin perform public.curator_group_view('group_5','2026-11');exception when insufficient_privilege then denied:=true;end;assert denied,'Unbound user can read curator data';
 denied:=false;begin perform public.curator_group_schedule('group_4');exception when insufficient_privilege then denied:=true;end;assert denied,'Unbound user can read timetable';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.curator'),'role','authenticated')::text,true);
do $$begin assert public.activate_bound_curator()->>'matched'='false','Unconfirmed email activated curator';assert not exists(select 1 from public.members where uid=auth.uid()),'Unconfirmed curator received membership';end $$;
reset role;
update auth.users set email_confirmed_at=now() where id=current_setting('test.curator')::uuid;
set local role authenticated;
do $$declare metadata jsonb;bundle jsonb;n integer;denied boolean;begin
 metadata:=public.activate_bound_curator();assert metadata->>'active'='true','Confirmed email not activated';assert metadata->>'name'='Назаров Денис Александрович','Untrusted display name used';assert jsonb_array_length(metadata->'groups')=3,'Wrong assigned groups';
 assert public.member_role()='curator' and not public.is_admin(),'Curator got admin rights';assert not exists(select 1 from public.admins where uid=auth.uid()),'Curator added to admins';
 assert public.current_tenant()='group_4','Curator home tenant changed';
 assert public.activate_bound_curator()=metadata,'Repeated login changed assignment';
 for n in 4..6 loop
  bundle:=public.curator_group_schedule('group_'||n);assert bundle->>'read_only'='true' and bundle->>'tenant_id'='group_'||n,'Wrong timetable scope';assert bundle->'config'->'schedule'->0->>'who'='Test teacher','Group schedule missing';assert not (bundle->'config' ? 'private_script_url') and not (bundle ? 'students'),'Schedule leaked unrelated data';
  bundle:=public.curator_group_view('group_'||n,'2026-11');assert bundle->>'read_only'='true','Curator projection writable';
  assert exists(select 1 from jsonb_array_elements(bundle->'students') s where s->>'uid'=current_setting('test.curator_student'||n) and s->'marks'->>'2026-11-11|1'='п'),'Assigned group attendance missing';
  assert not exists(select 1 from jsonb_array_elements(bundle->'students') s where s ? 'email' or s ? 'phone' or s->'marks' ? '2026-10-11|1'),'Private fields or unrequested month exposed';
  assert not exists(select 1 from jsonb_array_elements(bundle->'students') s cross join jsonb_array_elements(s->'certs') c where c ? 'photo' or c ? 'note'),'Certificate images or notes exposed';
  assert exists(select 1 from jsonb_array_elements(bundle->'news') news where news->>'title'='Curator news '||n),'Assigned news unavailable';
 end loop;
 denied:=false;begin perform public.curator_group_view('group_1','2026-11');exception when insufficient_privilege then denied:=true;end;assert denied,'Unassigned group accessible';
 denied:=false;begin perform public.curator_group_schedule('group_2');exception when insufficient_privilege then denied:=true;end;assert denied,'Curator read an unassigned timetable';
 denied:=false;begin perform public.select_group('group_5');exception when others then denied:=true;end;assert denied,'Curator can switch global tenant context';
 assert public.current_tenant()='group_4','Global student tenant boundary changed';
 assert not exists(select 1 from public.docs where tenant_id='group_5'),'REST educational table boundary broadened';
 denied:=false;begin perform public.set_member_role(current_setting('test.curator_student4')::uuid,'admin',null);exception when others then denied:=true;end;assert denied,'Curator can use God mode';
 denied:=false;begin perform count(*) from politeshik_private.curator_accounts;exception when insufficient_privilege then denied:=true;end;assert denied,'Private identity registry exposed';
end $$;
-- An ordinary approved student cannot activate or query the workspace.
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.curator_student4'),'role','authenticated')::text,true);
do $$declare denied boolean:=false;begin assert public.activate_bound_curator()->>'matched'='false','Student activation altered role';begin perform public.curator_group_view('group_4','2026-11');exception when insufficient_privilege then denied:=true;end;assert denied,'Student accessed curator projection';end $$;
reset role;
update public.members set status='banned' where uid=current_setting('test.curator')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.curator'),'role','authenticated')::text,true);
do $$declare denied boolean:=false;begin assert public.activate_bound_curator()->>'matched'='false','Login restored revoked membership';begin perform public.curator_group_view('group_4','2026-11');exception when insufficient_privilege then denied:=true;end;assert denied,'Revoked curator kept access';end $$;
rollback;
