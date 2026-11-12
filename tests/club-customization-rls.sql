begin;
do $$declare k text;u uuid;begin foreach k in array array['clubA','clubB'] loop
 u:=gen_random_uuid();perform set_config('test.'||k,u::text,true);
 insert into auth.users(id,email,email_confirmed_at,aud,role) values(u,'club-custom-'||u||'@example.invalid',now(),'authenticated','authenticated');
 insert into public.members(tenant_id,uid,role,status,requested_role,full_name,group_id) values('group_2',u,'student','approved','student',k,'g_26290911_3111');end loop;end $$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.clubA'),'role','authenticated')::text,true);
select public.club_visit('join');
select public.club_customize('shuffle','orange','Привет всем!');
reset role;
update politeshik_private.club_visitors set seen_at=now()-interval '7 days' where uid=current_setting('test.clubA')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.clubB'),'role','authenticated')::text,true);
do $$declare state jsonb;denied boolean:=false;begin
 state:=public.club_visit('state');
 assert exists(select 1 from jsonb_array_elements(state->'visitors') x where x->>'uid'=current_setting('test.clubA') and x->>'drink'='orange' and x->>'dance'='shuffle' and x->>'thought'='Привет всем!'),'Persistent membership or customization lost';
 begin perform public.club_customize('spin','cherry','Подмена');exception when others then denied:=true;end;assert denied,'Nonmember changed room state';
 perform public.club_visit('join');perform public.club_customize('sway','apple','Другая мысль');
 assert exists(select 1 from jsonb_array_elements(public.club_visit('state')->'visitors') x where x->>'uid'=current_setting('test.clubA') and x->>'thought'='Привет всем!'),'Another user changed the first user';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.clubA'),'role','authenticated')::text,true);
do $$declare state jsonb;denied boolean:=false;begin
 state:=public.club_visit('join',false);
 assert exists(select 1 from jsonb_array_elements(state->'visitors') x where x->>'uid'=auth.uid()::text and x->>'dance'='shuffle' and x->>'drink'='orange'),'Reentry reset persisted choices';
 perform public.club_customize(null,null,'');
 assert exists(select 1 from jsonb_array_elements(public.club_visit('state')->'visitors') x where x->>'uid'=auth.uid()::text and x->>'thought'='' and x->>'drink'='orange'),'Clearing thought erased other choices';
 begin perform public.club_customize('illegal',null,null);exception when others then denied:=true;end;assert denied,'Unknown move accepted';
 denied:=false;begin perform public.club_customize(null,'illegal',null);exception when others then denied:=true;end;assert denied,'Unknown drink accepted';
 denied:=false;begin perform public.club_customize(null,null,repeat('x',161));exception when others then denied:=true;end;assert denied,'Overlong thought accepted';
 state:=public.club_visit('leave');assert state->>'joined'='false','Explicit exit failed';
 assert not exists(select 1 from jsonb_array_elements(state->'visitors') x where x->>'uid'=auth.uid()::text),'Exited mascot remains visible';
 assert exists(select 1 from jsonb_array_elements(state->'visitors') x where x->>'uid'=current_setting('test.clubB')),'Exit removed someone else';
end $$;
rollback;
