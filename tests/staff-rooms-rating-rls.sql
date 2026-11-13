begin;
select set_config('app.import','on',true);
do $$declare k text;u uuid;begin
 foreach k in array array['curator','teacher','student','foreign','parent','pending','leader'] loop
 u:=gen_random_uuid();perform set_config('test.sr_'||k,u::text,true);
 insert into auth.users(id,email,email_confirmed_at,aud,role) values(u,'staff-room-'||u||'@example.invalid',now(),'authenticated','authenticated');
 insert into public.members(tenant_id,uid,role,status,requested_role,group_id,full_name)values(case when k='foreign' then 'group_3' else 'group_4' end,u,case when k in('curator','teacher','parent')then k when k='leader' then 'admin' else 'student' end,case when k='pending'then 'pending' else 'approved'end,case when k in('curator','teacher')then 'staff' when k='parent'then 'parent' else 'student'end,case when k='foreign'then 'g_23290907_2092'else 'g_24290907_2092'end,'Test '||k);
 end loop;
end $$;
insert into public.docs(tenant_id,path,data) select tenant_id,'profiles/'||uid::text,jsonb_build_object('name',full_name,'role',role) from public.members where uid in(current_setting('test.sr_curator')::uuid,current_setting('test.sr_teacher')::uuid);
update politeshik_private.curator_accounts set claimed_uid=current_setting('test.sr_curator')::uuid where id='nazarov_da';
insert into public.docs(tenant_id,path,data)values
 ('group_4','profiles/'||current_setting('test.sr_student'),jsonb_build_object('rid','g4_r1','stats',jsonb_build_object('month',to_char(now(),'YYYY-MM'),'cardsMonth',50))),
 ('group_4','attendance/'||current_setting('test.sr_student'),jsonb_build_object('marks',jsonb_build_object(to_char(now(),'YYYY-MM')||'-01|1','п',to_char(now(),'YYYY-MM')||'-01|2','н')));
select set_config('app.import','',true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.sr_curator'),'role','authenticated')::text,true);
do $$declare r jsonb;denied boolean:=false;begin
 assert public.save_my_mascot('{"body":"pink","nickname":"Куратор"}')->>'body'='pink','Curator appearance unavailable';
 perform public.save_my_avatar('m4');
 assert jsonb_array_length(public.group_room_list())=3,'Curator needs exactly three rooms';
 perform public.group_room_send('group_4','Hello <script>', 'a1000000-0000-0000-0000-000000000001');
 perform public.group_room_send('group_4','Hello <script>', 'a1000000-0000-0000-0000-000000000001');
 assert jsonb_array_length(public.group_room_messages('group_4'))=1,'Retry duplicate';
 begin perform public.group_room_messages('group_3');exception when insufficient_privilege then denied:=true;end;assert denied,'Curator crossed scope';
 denied:=false;begin perform public.profile_leaderboard();exception when insufficient_privilege then denied:=true;end;assert denied,'Staff gained social privileges';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.sr_student'),'role','authenticated')::text,true);
do $$declare r jsonb;denied boolean:=false;begin
 assert jsonb_array_length(public.group_room_list())=1,'Student saw foreign room';
 r:=public.group_room_messages('group_4');assert r->0->>'name'='Test curator','Sender name missing';assert r->0->>'avatar'='m4','Curator home photo missing';assert r->0->'mascot'->>'body'='pink','Curator look missing';
 perform public.group_room_send('group_4','Student reply',gen_random_uuid());
 begin perform public.group_room_messages('group_6');exception when insufficient_privilege then denied:=true;end;assert denied,'Student read foreign group';
 denied:=false;begin perform 1 from politeshik_private.group_room_messages;exception when insufficient_privilege then denied:=true;end;assert denied,'Direct message read allowed';
 r:=public.group_mascots();assert exists(select 1 from jsonb_array_elements(r)x where x->>'uid'=current_setting('test.sr_curator') and x->>'avatar'='m4'),'Assigned curator look invisible';
 r:=public.group_leaderboard();assert exists(select 1 from jsonb_array_elements(r->'rows')x where x->>'uid'=auth.uid()::text and (x->>'score')::numeric=50),'Live attendance/card total incorrect';
 assert not exists(select 1 from jsonb_array_elements(r->'rows')x where x?'marks' or x?'certs'),'Private academic data leaked';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.sr_curator'),'role','authenticated')::text,true);
do $$declare r jsonb;begin r:=public.group_room_messages('group_4');assert jsonb_array_length(r)=2,'Student cannot reply';assert (r->0->>'read_count')::int>0,'Read receipt missing';end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.sr_teacher'),'role','authenticated')::text,true);
do $$declare denied boolean:=false;begin
 assert public.save_my_mascot('{"body":"blue"}')->>'body'='blue','Teacher mascot denied';perform public.save_my_avatar('m5');
 assert exists(select 1 from jsonb_array_elements(public.group_mascots())x where x->>'uid'=auth.uid()::text and x->>'avatar'='m5'),'Teacher own look cannot hydrate';
 assert public.group_room_list()='[]'::jsonb,'Teacher gained curator rooms';
 begin perform public.group_room_send('group_4','No',gen_random_uuid());exception when insufficient_privilege then denied:=true;end;assert denied,'Teacher joined curator room';
end $$;
reset role;
select set_config('app.import','on',true);
select set_config('request.jwt.claims','{}',true);
update public.docs set data=jsonb_set(data,'{marks}',jsonb_build_object(to_char(now(),'YYYY-MM')||'-01|1','п',to_char(now(),'YYYY-MM')||'-01|2','п')) where path='attendance/'||current_setting('test.sr_student');
select set_config('app.import','',true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.sr_student'),'role','authenticated')::text,true);
do $$begin assert exists(select 1 from jsonb_array_elements(public.group_leaderboard()->'rows')x where x->>'uid'=auth.uid()::text and (x->>'score')::numeric=90),'Rating not live after update';end $$;
reset role;
do $$declare k text;denied boolean;begin
 foreach k in array array['parent','pending','foreign'] loop
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.sr_'||k),'role','authenticated')::text,true);
 execute 'set local role authenticated';denied:=false;
 begin perform public.group_room_messages('group_4');exception when insufficient_privilege then denied:=true;end;assert denied,'Unauthorized room read: '||k;
 if k<>'foreign'then denied:=false;begin perform public.save_my_mascot('{}');exception when insufficient_privilege then denied:=true;end;assert denied,'Unauthorized cosmetic publish: '||k;end if;
 execute 'reset role';
 end loop;
end $$;
rollback;
