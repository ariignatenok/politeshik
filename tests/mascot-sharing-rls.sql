begin;
select set_config('test.super',(select uid::text from politeshik_private.super_admins limit 1),true);
do $$declare k text; u uuid;begin
 foreach k in array array['mascot2','mascot3','mascotParent','mascotPending'] loop
 u:=gen_random_uuid();perform set_config('test.'||k,u::text,true);
 insert into auth.users(id,email,email_confirmed_at,aud,role) values(u,'mascot-'||u||'@example.invalid',now(),'authenticated','authenticated');
 end loop;
end $$;
insert into public.members(tenant_id,uid,role,status,requested_role,full_name,group_id) values
('group_2',current_setting('test.mascot2')::uuid,'student','approved','student','Mascot Two','g_26290911_3111'),
('group_3',current_setting('test.mascot3')::uuid,'student','approved','student','Mascot Three','g_23290907_2092'),
('group_2',current_setting('test.mascotParent')::uuid,'parent','approved','parent','Mascot Parent','g_26290911_3111'),
('group_2',current_setting('test.mascotPending')::uuid,'student','pending','student','Mascot Pending','g_26290911_3111');
insert into public.docs(tenant_id,path,data) values
('group_2','profiles/'||current_setting('test.mascot2'),'{"rid":"g2_r1","name":"Mascot Two","about":"PRIVATE","email":"private@example.invalid"}'),
('group_3','profiles/'||current_setting('test.mascot3'),'{"rid":"g3_r1","name":"Mascot Three","mascot":{"body":"blue"}}'),
('group_2','avatars/'||current_setting('test.mascot2'),'{"v":"m4"}');
update public.members set requested_role=null where uid=current_setting('test.super')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.mascot2'),'role','authenticated')::text,true),set_config('request.headers','{"x-politeshik-group":"group_3"}',true);
do $$declare result jsonb;denied boolean:=false;begin
 result:=public.save_my_mascot('{"body":"pink","outfit":"leopard","hand":"coffee"}');
 assert result->>'body'='pink','Look not saved';
 assert (select data->>'v'='m4' and data->'mascot'->>'body'='pink' from public.docs where path='avatars/'||auth.uid()::text),'Photo lost';
 perform public.save_my_avatar('');
 assert (select data->'mascot'->>'body'='pink' and data->>'v'='' from public.docs where path='avatars/'||auth.uid()::text),'Deleting photo erased mascot';
 perform public.save_my_avatar('m5');
 assert (select data->'mascot'->>'body'='pink' and data->>'v'='m5' from public.docs where path='avatars/'||auth.uid()::text),'Changing photo erased mascot';
 assert (select data->>'about'='PRIVATE' from public.docs where path='profiles/'||auth.uid()::text),'Private profile overwritten';
 result:=public.group_mascots();
 assert exists(select 1 from jsonb_array_elements(result) x where x->>'uid'=auth.uid()::text and x->'mascot'->>'body'='pink'),'Missing peer look';
 assert not exists(select 1 from jsonb_array_elements(result) x where x->>'uid'=current_setting('test.mascot3')),'Spoofed header exposes foreign group';
 assert not exists(select 1 from jsonb_array_elements(result) x where x ? 'email' or x ? 'about'),'Private profile leaked';
 assert exists(select 1 from jsonb_array_elements(result) x where x->>'uid'=current_setting('test.super') and x->>'role'='superadmin'),'Arina missing from support';
 begin perform public.save_my_mascot('{"body":"<svg onload=alert(1)>"}');exception when others then denied:=true;end;
 assert denied,'Invalid catalogue value accepted';
 denied:=false;begin perform public.save_my_mascot('{"uid":"another-user"}');exception when others then denied:=true;end;assert denied,'Target override accepted';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.mascot3'),'role','authenticated')::text,true),set_config('request.headers','{}',true);
do $$declare result jsonb;begin
 result:=public.group_mascots();assert not exists(select 1 from jsonb_array_elements(result) x where x->>'uid'=current_setting('test.mascot2')),'Foreign peer leaked';
 assert exists(select 1 from jsonb_array_elements(result) x where x->>'uid'=auth.uid()::text and x->'mascot'->>'body'='blue'),'Legacy look absent';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.mascotParent'),'role','authenticated')::text,true);
do $$declare denied boolean:=false;begin
 begin perform public.save_my_mascot('{}');exception when insufficient_privilege then denied:=true;end;assert denied,'Parent can publish student appearance';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.mascotPending'),'role','authenticated')::text,true);
do $$declare denied boolean:=false;begin
 begin perform public.group_mascots();exception when insufficient_privilege then denied:=true;end;assert denied,'Unapproved peer can read group appearances';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.super'),'role','authenticated')::text,true),set_config('request.headers','{"x-politeshik-group":"group_3"}',true);
select public.save_my_mascot('{"body":"pink","hair":"long","outfit":"pinkfur"}');
do $$declare result jsonb;begin
 result:=public.group_mascots();assert exists(select 1 from jsonb_array_elements(result) x where x->>'uid'=auth.uid()::text and x->'mascot'->>'body'='pink' and x->>'name'='Админ Арина'),'Super own home look not shared across groups';
 assert exists(select 1 from jsonb_array_elements(result) x where x->>'uid'=current_setting('test.mascot3')),'Super cannot see selected group';
 assert not exists(select 1 from jsonb_array_elements(result) x where x->>'uid'=current_setting('test.mascot2')),'Super selected group mixed with another group';
end $$;
rollback;
