begin;
select set_config('test.a',gen_random_uuid()::text,true),set_config('test.b',gen_random_uuid()::text,true),set_config('test.c',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,aud,role)
 select current_setting('test.'||x)::uuid,'social-next-'||current_setting('test.'||x)||'@example.invalid',now(),'authenticated','authenticated' from unnest(array['a','b','c'])x;
insert into public.members(tenant_id,uid,role,status,requested_role,group_id,full_name) values
 ('group_2',current_setting('test.a')::uuid,'student','approved','student','g_26290911_3111','Test A'),
 ('group_3',current_setting('test.b')::uuid,'student','approved','student','g_23290907_2092','Test B'),
 ('group_1',current_setting('test.c')::uuid,'student','approved','student','g_main','Test C');
insert into public.docs(tenant_id,path,data) values
 ('group_2','profiles/'||current_setting('test.a'),'{"name":"Test A","stats":{"month":"bad","cardsMonth":"NaN"}}'),
 ('group_3','profiles/'||current_setting('test.b'),'{"name":"Test B"}'),
 ('group_1','profiles/'||current_setting('test.c'),'{"name":"Test C"}');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.a'),'role','authenticated')::text,true),set_config('request.headers','{}',true);
do $$declare day date:=(now() at time zone 'Europe/Moscow')::date;bad boolean;data jsonb;r jsonb;begin
 if extract(hour from now() at time zone 'Europe/Moscow')<9 then day:=day-1;end if;
 data:=public.self_attendance(day,1,'п');assert data->'marks'->>(day::text||'|1')='п','New group student cannot mark self';
 bad:=false;begin perform public.self_attendance(day,1,'н');exception when others then bad:=true;end;assert bad,'Existing mark overwritten';
 bad:=false;begin perform public.self_attendance(day-2,2,'п');exception when insufficient_privilege then bad:=true;end;assert bad,'Expired mark allowed';
 bad:=false;begin perform public.self_attendance(day+2,2,'п');exception when insufficient_privilege then bad:=true;end;assert bad,'Future mark allowed';
 bad:=false;begin perform public.self_attendance(day,2,'уп');exception when insufficient_privilege then bad:=true;end;assert bad,'Student can set UP';
 bad:=false;begin perform public.prepare_message_upload(null,current_setting('test.b')::uuid,'admin','bad.txt','text/plain',4,'file');exception when insufficient_privilege then bad:=true;end;assert bad,'Student can target another support thread';
 r:=public.prepare_message_upload(current_setting('test.b')::uuid,null,null,'hello.png','image/png',4,'photo');
 perform set_config('test.upload',r->>'id',true);perform set_config('test.path',r->>'path',true);
 insert into storage.objects(bucket_id,name,metadata) values('private-messages',r->>'path','{"size":4,"mimetype":"image/png"}');
 assert exists(select 1 from storage.objects where name=r->>'path'),'Owner cannot read pending own upload';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.b'),'role','authenticated')::text,true);
do $$declare day date:=(now() at time zone 'Europe/Moscow')::date;begin if extract(hour from now() at time zone 'Europe/Moscow')<9 then day:=day-1;end if;perform public.self_attendance(day,1,'п');assert not exists(select 1 from storage.objects where name=current_setting('test.path')),'Recipient sees unsubmitted draft';end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.a'),'role','authenticated')::text,true);
do $$declare bad boolean:=false;n integer;begin
 perform public.send_message_upload(current_setting('test.upload')::uuid,'Фото');
 perform public.send_message_upload(current_setting('test.upload')::uuid,'Фото');
 assert jsonb_array_length(public.peer_messages(current_setting('test.b')::uuid))=1,'Attachment retry duplicated message';
 begin delete from storage.objects where name=current_setting('test.path');get diagnostics n=row_count;bad:=n=0;exception when others then bad:=true;end;assert bad,'Sent file can be erased';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.b'),'role','authenticated')::text,true);
do $$declare r jsonb;begin
 assert exists(select 1 from storage.objects where name=current_setting('test.path')),'Recipient cannot read sent attachment';
 r:=public.peer_messages(current_setting('test.a')::uuid);assert r->0->'attachment'->>'path'=current_setting('test.path'),'Attachment metadata missing';
 perform public.peer_read(current_setting('test.a')::uuid);
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.c'),'role','authenticated')::text,true);
do $$declare r jsonb;bad boolean:=false;begin
 assert not exists(select 1 from storage.objects where name=current_setting('test.path')),'Unrelated student can read private attachment';
 r:=public.profile_leaderboard();assert jsonb_array_length(r->'rows')>=3,'Global profiles not ranked';
 assert exists(select 1 from jsonb_array_elements(r->'rows') x where x->>'uid'=current_setting('test.a') and (x->>'score')::numeric>=60),'Attendance missing from global score';
 assert not exists(select 1 from jsonb_array_elements(r->'rows') x where x ? 'marks' or x ? 'certs' or x ? 'stats' or x ? 'email'),'Private fields exposed in ranking';
 begin perform count(*) from politeshik_private.profile_activity;exception when insufficient_privilege then bad:=true;end;assert bad,'Raw activity exposed';
end $$;
reset role;
-- Even the superadmin cannot fetch files from other people's private peer conversations.
select set_config('request.jwt.claims',jsonb_build_object('sub',(select uid::text from politeshik_private.super_admins limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $$begin assert not exists(select 1 from storage.objects where name=current_setting('test.path')),'Superadmin can read private peer attachment';end $$;
reset role;
select set_config('test.leader',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,aud,role) values(current_setting('test.leader')::uuid,'media-leader-'||current_setting('test.leader')||'@example.invalid',now(),'authenticated','authenticated');
insert into public.members(tenant_id,uid,role,status,requested_role,group_id) values('group_2',current_setting('test.leader')::uuid,'admin','approved','student','g_26290911_3111');
insert into public.admins(tenant_id,uid) values('group_2',current_setting('test.leader')::uuid);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.a'),'role','authenticated')::text,true);
do $$declare r jsonb;i integer;begin
 r:=public.prepare_message_upload(null,auth.uid(),'admin','support.txt','text/plain',4,'file');perform set_config('test.support_path',r->>'path',true);
 insert into storage.objects(bucket_id,name,metadata) values('private-messages',r->>'path','{"size":4,"mimetype":"text/plain"}');
 perform public.send_message_upload((r->>'id')::uuid,'Support file');
 for i in 1..20 loop perform public.peer_send(current_setting('test.b')::uuid,'Activity test',gen_random_uuid());end loop;
 perform public.club_visit('join');for i in 1..20 loop perform public.club_move(25+i,70,true);end loop;
 for i in 1..15 loop perform public.social_presence(gen_random_uuid(),true);end loop;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.leader'),'role','authenticated')::text,true);
do $$begin
 assert exists(select 1 from storage.objects where name=current_setting('test.support_path')),'Scoped leader cannot read their support attachment';
 assert not exists(select 1 from storage.objects where name=current_setting('test.path')),'Scoped leader can read another private conversation';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.b'),'role','authenticated')::text,true);
do $$begin assert not exists(select 1 from storage.objects where name=current_setting('test.support_path')),'Other group sees support attachment';end $$;
reset role;
do $$begin
 assert (select points=10 from politeshik_private.profile_activity where uid=current_setting('test.a')::uuid and kind='messages'),'Messages cap is not enforced';
 assert (select points=5 from politeshik_private.profile_activity where uid=current_setting('test.a')::uuid and kind='club'),'Club cap is not enforced';
 assert (select points=1 from politeshik_private.profile_activity where uid=current_setting('test.a')::uuid and kind='app'),'Multi-device heartbeats bypass app interval';
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
do $$declare day date:=(now() at time zone 'Europe/Moscow')::date;slot jsonb;begin
 slot:=jsonb_build_array(jsonb_build_object('start','00:00','end',to_char(now() at time zone 'Europe/Moscow','HH24:MI:SS.US')));
 insert into public.docs(tenant_id,path,data) values('group_2','group/config',jsonb_build_object('pairs',slot)) on conflict(tenant_id,path) do update set data=excluded.data;
 assert politeshik_private.attendance_window('group_2',day-1,1),'Exact 24-hour boundary excluded';
 slot:=jsonb_build_array(jsonb_build_object('start','00:00','end',to_char((now()-interval '1 microsecond') at time zone 'Europe/Moscow','HH24:MI:SS.US')));
 update public.docs set data=jsonb_build_object('pairs',slot) where tenant_id='group_2' and path='group/config';
 assert not politeshik_private.attendance_window('group_2',day-1,1),'Expired 24-hour boundary allowed';
end $$;
rollback;
