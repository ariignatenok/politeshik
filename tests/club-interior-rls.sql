begin;
select set_config('app.import','on',true);
do $$declare k text;u uuid;i integer:=0;begin
 foreach k in array array['a','b','low']loop i:=i+1;u:=gen_random_uuid();perform set_config('test.ci_'||k,u::text,true);
 insert into auth.users(id,email,email_confirmed_at,aud,role)values(u,'cinema-'||u||'@example.invalid',now(),'authenticated','authenticated');
 insert into public.members(tenant_id,uid,role,status,requested_role,group_id,full_name)values('group_2',u,'student','approved','student','g_26290911_3111','Interior '||k);
 insert into public.docs(tenant_id,path,data)values('group_2','profiles/'||u::text,jsonb_build_object('rid','g2_r'||i)),('group_2','attendance/'||u::text,jsonb_build_object('marks',jsonb_build_object(to_char(now()at time zone'Europe/Moscow','YYYY-MM')||'-01|1',case when k='low'then'н'else'п'end)));
 end loop;end $$;
select set_config('app.import','',true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.ci_a'),'role','authenticated')::text,true);
do $$declare result jsonb;begin
 perform public.club_visit('join');perform public.club_enter_room('cinema');result:=public.club_service('sit',null,1,null);
 assert exists(select 1 from jsonb_array_elements(result->'visitors')v where v->>'uid'=auth.uid()::text and v->>'seat'='1'and v->>'pose'='seated'and v->>'x'='22'),'Seating state not shared';
 perform public.club_service('order_waiter','popcorn',null,'d1000000-0000-0000-0000-000000000001');
 result:=public.club_service('order_waiter','popcorn',null,'d1000000-0000-0000-0000-000000000001');
 assert exists(select 1 from jsonb_array_elements(result->'visitors')v where v->>'uid'=auth.uid()::text and v->'service'->>'item'='popcorn'and v->>'snack'='none'),'Order should be pending first';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.ci_b'),'role','authenticated')::text,true);
do $$declare bad boolean:=false;begin
 perform public.club_visit('join');perform public.club_enter_room('cinema');
 begin perform public.club_service('sit',null,1,null);exception when others then bad:=true;end;assert bad,'Two people occupied one seat';
 perform public.club_service('sit',null,2,null);
 bad:=false;begin perform public.club_service('order_waiter','popcorn',null,'d1000000-0000-0000-0000-000000000001');exception when others then bad:=true;end;assert bad,'Another person reused the order identity';
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
update politeshik_private.club_service_orders set ready_at=clock_timestamp()-interval'1 second'where id='d1000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.ci_b'),'role','authenticated')::text,true);
do $$declare result jsonb:=public.club_visit('state');begin assert exists(select 1 from jsonb_array_elements(result->'visitors')v where v->>'uid'=current_setting('test.ci_a')and v->>'snack'='popcorn'and v->'service'='null'::jsonb),'Waiter did not deliver to another viewer';end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.ci_a'),'role','authenticated')::text,true);
do $$declare result jsonb;begin
 perform public.club_service('order_bar','berry',null,'d1000000-0000-0000-0000-000000000002');
 result:=public.club_enter_room('main');assert exists(select 1 from jsonb_array_elements(result->'visitors')v where v->>'uid'=auth.uid()::text and v->'seat'='null'::jsonb and v->'service'='null'::jsonb),'Room change retained seat or pending order';
 perform public.club_service('order_bar','citrus',null,'d1000000-0000-0000-0000-000000000003');
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
update politeshik_private.club_service_orders set ready_at=clock_timestamp()-interval'1 second'where id='d1000000-0000-0000-0000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.ci_b'),'role','authenticated')::text,true);
select public.club_enter_room('main');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.ci_a'),'role','authenticated')::text,true);
do $$declare result jsonb;begin
 result:=public.club_visit('state');assert exists(select 1 from jsonb_array_elements(result->'visitors')v where v->>'uid'=auth.uid()::text and v->>'drink'='citrus'),'Cocktail not delivered';
 perform public.club_give_drink(current_setting('test.ci_b')::uuid,gen_random_uuid());
 perform public.club_enter_room('games');perform public.club_game('create','poker',null,'{}','d1000000-0000-0000-0000-000000000004');
 result:=public.club_visit('state');assert exists(select 1 from jsonb_array_elements(result->'visitors')v where v->>'uid'=auth.uid()::text and v->>'pose'='poker'and v->>'x'='18'and not(v?'hand')),'Poker host not arranged safely at table';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.ci_b'),'role','authenticated')::text,true);
do $$declare result jsonb;begin
 perform public.club_enter_room('games');perform public.club_game('join',null,'d1000000-0000-0000-0000-000000000004');
 result:=public.club_visit('state');assert exists(select 1 from jsonb_array_elements(result->'visitors')v where v->>'uid'=auth.uid()::text and v->>'pose'='poker'and v->>'x'='82'),'Poker guest not arranged at table';
 perform public.club_game('fold',null,'d1000000-0000-0000-0000-000000000004','{}',gen_random_uuid());
 perform public.club_game('create','pool',null,'{}','d1000000-0000-0000-0000-000000000005');
 result:=public.club_visit('state');assert exists(select 1 from jsonb_array_elements(result->'visitors')v where v->>'uid'=auth.uid()::text and v->>'pose'='pool'and v->>'y'='75'),'Pool host not arranged at table';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.ci_low'),'role','authenticated')::text,true);
do $$declare bad boolean:=false;begin
 perform public.club_visit('join');begin perform public.club_service('order_waiter','popcorn',null,gen_random_uuid());exception when others then bad:=true;end;assert bad,'Waiter delivered popcorn outside cinema';
 bad:=false;begin perform 1 from politeshik_private.club_service_orders;exception when insufficient_privilege then bad:=true;end;assert bad,'Private service log exposed';
end $$;
reset role;
rollback;
