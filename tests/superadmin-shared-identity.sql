begin;
select set_config('app.import','on',true);
select set_config('test.identity_owner',(select uid::text from politeshik_private.super_admins limit 1),true);
insert into public.docs(tenant_id,path,data) values('group_1','profiles/'||current_setting('test.identity_owner'),'{"rid":"r32","name":"Игнатенок Арина","avatar":"m1","mascot":{"body":"blue"}}') on conflict(tenant_id,path) do update set data=public.docs.data||jsonb_build_object('avatar','m1','mascot',jsonb_build_object('body','blue'));
insert into public.docs(tenant_id,path,data) values('group_1','avatars/'||current_setting('test.identity_owner'),'{"v":"m10","mascot":{"body":"pink","outfit":"leopard","nickname":"Арина"}}') on conflict(tenant_id,path) do update set data=excluded.data;
insert into public.docs(tenant_id,path,data) values('group_1','attendance/'||current_setting('test.identity_owner'),'{"marks":{}}') on conflict(tenant_id,path) do update set data=excluded.data;
do $$declare group_num integer;u uuid;t text;begin
 for group_num in 1..6 loop
  u:=gen_random_uuid();t:='group_'||group_num;perform set_config('test.identity_viewer'||group_num,u::text,true);
  insert into auth.users(id,email,email_confirmed_at,aud,role) values(u,'identity-'||u||'@example.invalid',now(),'authenticated','authenticated');
  insert into public.members(tenant_id,uid,role,status,requested_role,full_name,group_id) select t,u,'student','approved','student','Identity fixture',id from public.groups where tenant_id=t limit 1;
 end loop;
end $$;
select set_config('app.import','',true);
set local role authenticated;
select set_config('request.headers','{}',true);
do $$declare group_num integer;card jsonb;begin
 for group_num in 1..6 loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.identity_viewer'||group_num),'role','authenticated')::text,true);
  select value into card from jsonb_array_elements(public.group_mascots()) where value->>'uid'=current_setting('test.identity_owner');
  assert card->>'avatar'='m10','Owner photo varies between groups';
  assert card->'mascot'->>'body'='pink' and card->'mascot'->>'outfit'='leopard','Owner mascot varies between groups';
  assert card->>'role'='superadmin','Owner shown as ordinary student';
  if group_num=1 then assert card->>'rid'='r32';else assert card->>'rid' is null,'Owner has student roster ID outside home';assert card->>'name'='Админ Арина';end if;
  assert not exists(select 1 from jsonb_array_elements(public.group_mascots()) x where x->>'uid'=current_setting('test.identity_viewer'||case when group_num=2 then 3 else 2 end)),'Peer from another group leaked';
 end loop;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.identity_owner'),'role','authenticated')::text,true);
select public.select_group('group_2');
do $$declare c jsonb;denied boolean:=false;begin
 c:=public.group_context();assert c->>'home_tenant'='group_1';assert c->'profile'->>'avatar'='m10';assert c->'profile'->'mascot'->>'body'='pink','Owner context uses stale profile appearance';
 begin perform public.self_attendance((now() at time zone 'Europe/Moscow')::date,1,'п');exception when insufficient_privilege then denied:=true;end;
 assert denied,'Self attendance accepted while visiting another group';
end $$;
select public.select_group('group_1');
do $$declare day date:=(now() at time zone 'Europe/Moscow')::date;begin
 if extract(hour from now() at time zone 'Europe/Moscow')<9 then day:=day-1;end if;
 perform public.self_attendance(day,1,'п');
 assert exists(select 1 from public.docs where tenant_id='group_1' and path='attendance/'||auth.uid()::text and data->'marks'->>(day::text||'|1')='п'),'Home self attendance unavailable';
end $$;
reset role;
do $$begin
 assert (select count(*)=1 from public.members where uid=current_setting('test.identity_owner')::uuid),'Owner duplicated into foreign memberships';
 assert not exists(select 1 from public.docs where tenant_id<>'group_1' and path in('profiles/'||current_setting('test.identity_owner'),'attendance/'||current_setting('test.identity_owner'),'avatars/'||current_setting('test.identity_owner'))),'Foreign academic or appearance clones created';
end $$;
rollback;
