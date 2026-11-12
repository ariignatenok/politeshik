begin;
do $$declare k text;u uuid;begin foreach k in array array['motionA','motionB'] loop
 u:=gen_random_uuid();perform set_config('test.'||k,u::text,true);
 insert into auth.users(id,email,email_confirmed_at,aud,role) values(u,'motion-'||u||'@example.invalid',now(),'authenticated','authenticated');end loop;end $$;
insert into public.members(tenant_id,uid,role,status,requested_role,full_name,group_id) values
('group_2',current_setting('test.motionA')::uuid,'student','approved','student','Fixture A','g_26290911_3111'),
('group_3',current_setting('test.motionB')::uuid,'student','approved','student','Fixture B','g_23290907_2092');
insert into public.docs(tenant_id,path,data) values
('group_2','profiles/'||current_setting('test.motionA'),'{"rid":"g2_r1","name":"Fixture A"}'),
('group_3','profiles/'||current_setting('test.motionB'),'{"rid":"g3_r1","name":"Fixture B"}');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.motionA'),'role','authenticated')::text,true);
do $$declare look jsonb;denied boolean:=false;state jsonb;begin
 look:=public.save_my_mascot('{"nickname":"Fluffy Плюш","body":"pink"}');assert look->>'nickname'='Fluffy Плюш','Nickname not saved';
 look:=public.save_my_mascot('{"body":"blue"}');assert look->>'nickname'='Fluffy Плюш','Old client erased nickname';
 assert (select data->>'name'='Fixture A' from public.docs where path='profiles/'||auth.uid()),'Nickname changed student identity';
 begin perform public.save_my_mascot(jsonb_build_object('nickname',repeat('x',25)));exception when others then denied:=true;end;assert denied,'Overlong nickname accepted';
 denied:=false;begin perform public.save_my_mascot(jsonb_build_object('nickname',E'line\nbreak'));exception when others then denied:=true;end;assert denied,'Multiline nickname accepted';
 perform public.club_visit('join');state:=public.club_move(25,75,true);
 assert exists(select 1 from jsonb_array_elements(state->'visitors') x where x->>'uid'=auth.uid()::text and x->>'x'='25' and x->>'y'='75' and x->>'jumped_at' is not null),'Position or jump not shared';
 denied:=false;begin perform public.club_move(-1,75,false);exception when others then denied:=true;end;assert denied,'Outside floor coordinate accepted';
 denied:=false;begin perform public.club_move('NaN'::double precision,75,false);exception when others then denied:=true;end;assert denied,'NaN coordinate accepted';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.motionB'),'role','authenticated')::text,true);
do $$declare state jsonb;begin
 assert public.social_profile(current_setting('test.motionA')::uuid)->'mascot'->>'nickname'='Fluffy Плюш','Nickname not visible in authorized public profile';
 perform public.club_visit('join');state:=public.club_move(82,65,false);
 assert exists(select 1 from jsonb_array_elements(state->'visitors') x where x->>'uid'=current_setting('test.motionA') and x->>'x'='25' and x->>'y'='75'),'Another user moved the first student';
 assert exists(select 1 from jsonb_array_elements(state->'visitors') x where x->>'uid'=auth.uid()::text and x->>'x'='82'),'Own bar position not persisted';
end $$;
rollback;
