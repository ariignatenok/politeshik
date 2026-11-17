-- Rehearsal-only fixtures; all changes roll back.
begin;
select set_config('app.import','on',true);
do $$declare n int;t text;gid text;kind text;u uuid;rid text;begin
 for n in 1..6 loop
  t:='group_'||n;select id into gid from public.groups where tenant_id=t limit 1;
  foreach kind in array array['leader','deputy','student','outsider'] loop
   u:=gen_random_uuid();perform set_config('test.deputies_'||kind||n,u::text,true);
   insert into auth.users(id,email,email_confirmed_at,aud,role)values(u,u||'@example.invalid',now(),'authenticated','authenticated');
   insert into public.members(tenant_id,uid,role,status,requested_role,full_name,group_id)values(t,u,case when kind='leader' then 'admin' else 'student' end,'approved','student','Deputy fixture '||kind,gid);
   if kind='leader' then insert into public.admins(tenant_id,uid)values(t,u);end if;
   rid:=case when n=1 then 'r' else 'g'||n||'_r' end||case kind when 'deputy' then '1' when 'student' then '2' else '3' end;
   if kind<>'outsider' then insert into public.docs(tenant_id,path,data)values(t,'profiles/'||u,jsonb_build_object('name','Deputy fixture '||kind,'rid',rid,'subgroup','1'));end if;
   if kind='student' then
    insert into public.docs(tenant_id,path,data)values(t,'attendance/'||u,'{"marks":{"2026-10-02|1":"уп","2026-10-02|2":"о"},"keep":"original"}');
    insert into public.docs(tenant_id,path,data)values(t,'certs/'||u,'{"items":[{"id":"fixture","from":"2026-10-03","to":"2026-10-03","confirmed":true,"kind":"private diagnosis","file":"private-scan"}]}');
   end if;
  end loop;
 end loop;
end $$;
select set_config('app.import','',true);
set local role authenticated;
select set_config('request.headers','{}',true);
do $$declare n int;u uuid;s uuid;leader uuid;foreign_uid uuid;data jsonb;denied boolean;article uuid;begin
 for n in 1..6 loop
  u:=current_setting('test.deputies_deputy'||n)::uuid;s:=current_setting('test.deputies_student'||n)::uuid;leader:=current_setting('test.deputies_leader'||n)::uuid;
  foreign_uid:=current_setting('test.deputies_student'||case when n=6 then 1 else n+1 end)::uuid;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',leader,'role','authenticated')::text,true);
  data:=public.deputy_context();assert jsonb_array_length(data->'candidates')>0,'Leader roster empty';
  denied:=false;begin perform public.set_group_deputy(foreign_uid,true);exception when insufficient_privilege then denied:=true;end;assert denied,'Leader appointed foreign student';
  denied:=false;begin perform public.set_group_deputy(current_setting('test.deputies_outsider'||n)::uuid,true);exception when insufficient_privilege then denied:=true;end;assert denied,'Unregistered student appointed';
  data:=public.set_group_deputy(u,true);assert data->'deputies'@>jsonb_build_array(jsonb_build_object('uid',u)),'Appointment missing';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  assert not public.is_admin(),'Deputy became admin';
  data:=public.deputy_context();assert data->>'is_deputy'='true','Deputy not active';
  assert jsonb_array_length(data->'journal')>=2,'Deputy journal unavailable';
  assert data::text not like '%private diagnosis%' and data::text not like '%private-scan%','Medical detail leaked';
  assert jsonb_array_length(data->'candidates')=0,'Deputy received appointment roster';
  assert public.social_profile(u)->>'is_deputy'='true','Public label missing';
  data:=public.deputy_marks(s,'{"2026-10-02|2":"п","2026-10-02|3":"н"}');
  assert data->'marks'->>'2026-10-02|2'='п' and data->'marks'->>'2026-10-02|3'='н','Marks not saved';
  assert data->'marks'->>'2026-10-02|1'='уп' and data->>'keep'='original','Existing data lost';
  denied:=false;begin perform public.deputy_marks(s,'{"2026-10-02|1":"п"}');exception when insufficient_privilege then denied:=true;end;assert denied,'UP overwritten';
  denied:=false;begin perform public.deputy_marks(s,'{"2026-10-03|1":"п"}');exception when insufficient_privilege then denied:=true;end;assert denied,'Certificate overwritten';
  denied:=false;begin perform public.deputy_marks(s,'{"2026-10-02|3":"уп"}');exception when insufficient_privilege then denied:=true;end;assert denied,'Deputy can set UP';
  denied:=false;begin perform public.deputy_marks(s,'{"2026-10-02|3":""}');exception when insufficient_privilege then denied:=true;end;assert denied,'Deputy can clear attendance';
  denied:=false;begin perform public.deputy_marks(foreign_uid,'{"2026-10-02|3":"п"}');exception when insufficient_privilege then denied:=true;end;assert denied,'Foreign attendance writable';
  denied:=false;begin perform public.set_group_deputy(s,true);exception when insufficient_privilege then denied:=true;end;assert denied,'Deputy appointed deputy';
  denied:=false;begin perform public.set_subgroup(case when n=1 then 'r2' else 'g'||n||'_r2' end,'2');exception when insufficient_privilege then denied:=true;end;assert denied,'Deputy has subgroup management';
  denied:=false;begin insert into public.docs(tenant_id,path,data)values('group_'||n,'group/config','{"subjects":[]}')on conflict(tenant_id,path)do update set data=excluded.data;exception when insufficient_privilege then denied:=true;end;assert denied,'Deputy can write schedule';
  -- A checked RPC must not leave an import flag behind for a subsequent API call.
  assert current_setting('app.import',true) is distinct from 'on','Import bypass leaked';
  article:=public.deputy_publish_news('Новость зама','Текст объявления','2026-11-17');
  assert exists(select 1 from public.news where id=article and tenant_id='group_'||n and created_by=u),'News not visible to own group';
  delete from public.news where id=article;assert exists(select 1 from public.news where id=article),'Deputy gained moderation';
  update public.members set status='approved' where uid=current_setting('test.deputies_outsider'||n)::uuid;
  assert not found,'Deputy can approve users';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',leader,'role','authenticated')::text,true);
  perform public.set_group_deputy(u,false);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  assert public.deputy_context()->>'is_deputy'='false','Revocation not effective';
  denied:=false;begin perform public.deputy_marks(s,'{"2026-10-02|3":"п"}');exception when insufficient_privilege then denied:=true;end;assert denied,'Revoked deputy wrote marks';
  denied:=false;begin perform public.deputy_publish_news('No','No','2026-11-17');exception when insufficient_privilege then denied:=true;end;assert denied,'Revoked deputy published';
 end loop;
end $$;
reset role;
do $$begin
 assert (select count(*)>=18 from politeshik_private.deputy_audit),'Missing audit trail';
 assert not has_function_privilege('anon','public.deputy_marks(uuid,jsonb)','execute'),'Anonymous mark endpoint';
 assert not has_table_privilege('authenticated','politeshik_private.group_deputies','insert'),'Direct appointment table writable';
end $$;
rollback;
