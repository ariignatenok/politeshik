begin;
select set_config('app.import','on',true);
do $$declare u uuid;i integer;tenant text;groupid text;begin
 for i in 1..12 loop
  u:=gen_random_uuid();perform set_config('test.dj_'||i,u::text,true);
  tenant:=case when i%2=0 then'group_4'else'group_2'end;
  groupid:=case when i%2=0 then'g_24290907_2092'else'g_26290911_3111'end;
  insert into auth.users(id,email,email_confirmed_at,aud,role)values(u,'dj-'||u||'@example.invalid',now(),'authenticated','authenticated');
  insert into public.members(tenant_id,uid,role,status,requested_role,group_id,full_name)values(tenant,u,'student','approved','student',groupid,'DJ tester '||i);
  insert into public.docs(tenant_id,path,data)values(tenant,'profiles/'||u::text,jsonb_build_object('rid',case when i%2=0 then'g4_r1'else'g2_r1'end,'mascot',jsonb_build_object('nickname','Гость '||i))),
  (tenant,'attendance/'||u::text,jsonb_build_object('marks',jsonb_build_object(to_char(now()at time zone'Europe/Moscow','YYYY-MM')||'-01|1','п')));
 end loop;
end $$;
select set_config('app.import','',true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.dj_1'),'role','authenticated')::text,true);
do $$declare r jsonb;bad boolean:=false;begin
 begin perform public.club_request_track(1,gen_random_uuid());exception when others then bad:=true;end;assert bad,'Nonvisitor ordered music';
 r:=public.club_visit('join');assert(r->'dj'->'current'->>'track')::integer between 1 and 20,'No automatic DJ track';
 bad:=false;begin perform public.club_request_track(1,gen_random_uuid());exception when others then bad:=true;end;assert bad,'Remote order without approaching DJ';
 perform public.club_move(35,23,false);
 bad:=false;begin perform public.club_request_track(21,gen_random_uuid());exception when others then bad:=true;end;assert bad,'Arbitrary track accepted';
 r:=public.club_request_track(1,'e1000000-0000-0000-0000-000000000001');
 assert jsonb_array_length(r->'dj'->'queue')=1,'Request not queued';
 assert r->'dj'->'queue'->0->>'track'='1','Wrong queued track';
 assert not((r->'dj')::text like'%example.invalid%')and not((r->'dj')::text like'%'||auth.uid()::text||'%'),'Private data leaked in DJ queue';
 r:=public.club_request_track(1,'e1000000-0000-0000-0000-000000000001');assert jsonb_array_length(r->'dj'->'queue')=1,'Retry added a duplicate';
 bad:=false;begin perform public.club_request_track(2,gen_random_uuid());exception when others then bad:=true;end;assert bad,'Guest queued more than one track';
 perform public.club_enter_room('cinema');
 r:=public.club_visit('state');assert r->'dj'='null'::jsonb,'DJ exposed as cinema soundtrack';
 bad:=false;begin perform public.club_request_track(2,gen_random_uuid());exception when others then bad:=true;end;assert bad,'Cinema guest ordered music';
 perform public.club_enter_room('main');
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.dj_2'),'role','authenticated')::text,true);
do $$declare r jsonb;bad boolean:=false;begin
 perform public.club_visit('join');perform public.club_move(35,23,false);
 begin perform public.club_request_track(1,'e1000000-0000-0000-0000-000000000001');exception when others then bad:=true;end;assert bad,'Another guest reused order id';
 r:=public.club_request_track(20,'e1000000-0000-0000-0000-000000000002');
 assert jsonb_array_length(r->'dj'->'queue')=2,'Requests are not shared across groups';
 assert(r->'dj'->'queue'->1->>'starts_at')::timestamptz>=(r->'dj'->'queue'->0->>'ends_at')::timestamptz,'Tracks overlap';
 bad:=false;begin perform 1 from politeshik_private.club_track_requests;exception when insufficient_privilege then bad:=true;end;assert bad,'Raw DJ log exposed';
end $$;
-- Eight more distinct guests fill the shared queue. The eleventh must wait.
do $$declare i integer;bad boolean:=false;begin
 for i in 3..11 loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.dj_'||i),'role','authenticated')::text,true);
  perform public.club_visit('join');perform public.club_move(35,23,false);
  if i<=10 then perform public.club_request_track(i,gen_random_uuid());
  else begin perform public.club_request_track(i,gen_random_uuid());exception when others then bad:=true;end;assert bad,'Unbounded queue';end if;
 end loop;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
do $$declare stamp timestamptz:=clock_timestamp();begin
 update politeshik_private.club_track_requests set starts_at=stamp-interval'1 second',ends_at=stamp+interval'31 seconds'where id='e1000000-0000-0000-0000-000000000001';
end $$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.dj_2'),'role','authenticated')::text,true);
do $$declare r jsonb:=public.club_visit('state');begin
 assert r->'dj'->'current'->>'key'='e1000000-0000-0000-0000-000000000001','Scheduled track did not become current';
 assert r->'dj'->'current'->>'requester'='Гость 1','Nickname missing';
end $$;
reset role;
do $$begin assert not has_function_privilege('anon','public.club_request_track(integer,uuid)','execute'),'Anonymous DJ access';end $$;
rollback;
