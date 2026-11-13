begin;
select set_config('app.import','on',true);
do $$declare k text;u uuid;i integer:=0;marks jsonb;begin
 foreach k in array array['a','b','low','none','foreign']loop
 i:=i+1;u:=gen_random_uuid();perform set_config('test.cg_'||k,u::text,true);
 insert into auth.users(id,email,email_confirmed_at,aud,role)values(u,'club-games-'||u||'@example.invalid',now(),'authenticated','authenticated');
 insert into public.members(tenant_id,uid,role,status,requested_role,group_id,full_name)values('group_2',u,'student','approved','student','g_26290911_3111','Player '||k);
 insert into public.docs(tenant_id,path,data)values('group_2','profiles/'||u::text,jsonb_build_object('rid','g2_r'||i));
 marks:=case when k='none'then'{}'::jsonb else jsonb_build_object(to_char(now()at time zone'Europe/Moscow','YYYY-MM')||'-01|1','п',to_char(now()at time zone'Europe/Moscow','YYYY-MM')||'-01|2','п',to_char(now()at time zone'Europe/Moscow','YYYY-MM')||'-01|3',case when k='low'then'н'else'п'end,to_char(now()at time zone'Europe/Moscow','YYYY-MM')||'-01|4','н')end;
 insert into public.docs(tenant_id,path,data)values('group_2','attendance/'||u::text,jsonb_build_object('marks',marks));
 end loop;
end $$;
select set_config('app.import','',true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.cg_low'),'role','authenticated')::text,true);
do $$declare bad boolean:=false;begin
 perform public.club_visit('join');begin perform public.club_enter_room('cinema');exception when insufficient_privilege then bad:=true;end;assert bad,'50% admitted to cinema';bad:=false;
 begin perform public.club_enter_room('games');exception when insufficient_privilege then bad:=true;end;assert bad,'50% admitted to games';bad:=false;
 begin perform public.club_game('lobby');exception when insufficient_privilege then bad:=true;end;assert bad,'Direct game API bypassed gate';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.cg_none'),'role','authenticated')::text,true);
do $$declare bad boolean:=false;begin perform public.club_visit('join');begin perform public.club_enter_room('games');exception when insufficient_privilege then bad:=true;end;assert bad,'No marks admitted';end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.cg_a'),'role','authenticated')::text,true);
do $$declare state jsonb;begin
 perform public.club_visit('join');state:=public.club_enter_room('games');assert state->>'room'='games','Exactly 75% not admitted';assert state->'gate'->>'percent'='75.00','Wrong own attendance';
 assert not exists(select 1 from jsonb_array_elements(state->'visitors')v where v->>'uid'in(current_setting('test.cg_low'),current_setting('test.cg_none'))),'Other rooms leaked';
 perform public.club_customize(null,'orange',null);
 perform public.club_game('create','poker',null,'{}','c1000000-0000-0000-0000-000000000001');
 perform set_config('test.cg_match','c1000000-0000-0000-0000-000000000001',true);
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.cg_b'),'role','authenticated')::text,true);
do $$declare game jsonb;begin
 perform public.club_visit('join');perform public.club_enter_room('games');
 game:=public.club_game('join',null,current_setting('test.cg_match')::uuid);
 assert game->>'status'='active'and jsonb_array_length(game->'hand')=5,'Poker did not deal five cards';
 assert game->'other_hand'='[]'::jsonb and not(game?'deck'),'Opponent cards leaked';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.cg_a'),'role','authenticated')::text,true);
do $$declare game jsonb;bad boolean:=false;begin
 perform public.club_give_drink(current_setting('test.cg_b')::uuid,'c1000000-0000-0000-0000-000000000010');
 perform public.club_give_drink(current_setting('test.cg_b')::uuid,'c1000000-0000-0000-0000-000000000010');
 assert public.club_visit('state')->'visitors'@>jsonb_build_array(jsonb_build_object('uid',auth.uid(),'drink','none')),'Giver still holds drink';
 begin perform public.club_game('draw',null,current_setting('test.cg_match')::uuid,'{"cards":[0,1,2,3]}',gen_random_uuid());exception when others then bad:=true;end;assert bad,'Four-card exchange allowed';
 game:=public.club_game('draw',null,current_setting('test.cg_match')::uuid,'{"cards":[0,2]}','c1000000-0000-0000-0000-000000000020');
 assert game->>'host_ready'='true','Own draw not applied';
 perform public.club_game('draw',null,current_setting('test.cg_match')::uuid,'{"cards":[0,2]}','c1000000-0000-0000-0000-000000000020');
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.cg_b'),'role','authenticated')::text,true);
do $$declare state jsonb;game jsonb;begin
 state:=public.club_visit('state');assert jsonb_array_length(state->'gifts')=1,'Gift notification missing';assert public.club_visit('state')->'gifts'='[]'::jsonb,'Gift repeated every poll';
 game:=public.club_game('draw',null,current_setting('test.cg_match')::uuid,'{"cards":[]}',gen_random_uuid());assert game->>'status'='finished','Poker showdown not resolved';assert jsonb_array_length(game->'other_hand')=5,'Finished hands not shown';
 state:=public.club_game('lobby');assert jsonb_array_length(state->'poker')=2,'Poker tournament not recorded';
 perform public.club_game('create','pool',null,'{}','c1000000-0000-0000-0000-000000000030');
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.cg_a'),'role','authenticated')::text,true);
select public.club_game('join',null,'c1000000-0000-0000-0000-000000000030');
-- Exercise geometry deterministically, while only the server decides the winner.
reset role;
select set_config('request.jwt.claims','{}',true);
update politeshik_private.club_games set state=state||jsonb_build_object('turn',current_setting('test.cg_b'),'host_score',4,'cue',jsonb_build_object('x',.4,'y',.5),'object',jsonb_build_object('x',1.2,'y',.5))where id='c1000000-0000-0000-0000-000000000030';
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.cg_a'),'role','authenticated')::text,true);
do $$declare bad boolean:=false;begin begin perform public.club_game('shot',null,'c1000000-0000-0000-0000-000000000030','{"angle":0,"power":100}',gen_random_uuid());exception when others then bad:=true;end;assert bad,'Out-of-turn shot accepted';end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.cg_b'),'role','authenticated')::text,true);
do $$declare game jsonb;begin
 game:=public.club_game('shot',null,'c1000000-0000-0000-0000-000000000030','{"angle":0,"power":100}','c1000000-0000-0000-0000-000000000040');
 assert game->>'host_score'='4','Non-pocket shot awarded a point';assert game->>'status'='active','Client forced a win';
 perform public.club_game('shot',null,'c1000000-0000-0000-0000-000000000030','{"angle":0,"power":100}','c1000000-0000-0000-0000-000000000040');
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
update politeshik_private.club_games set state=state||jsonb_build_object('turn',current_setting('test.cg_b'),'host_score',4,'cue',jsonb_build_object('x',1.75,'y',.75),'object',jsonb_build_object('x',1.85,'y',.85))where id='c1000000-0000-0000-0000-000000000030';
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.cg_b'),'role','authenticated')::text,true);
do $$declare game jsonb;begin
 game:=public.club_game('shot',null,'c1000000-0000-0000-0000-000000000030','{"angle":45,"power":100}',gen_random_uuid());assert game->>'status'='finished'and game->>'winner'=auth.uid()::text,'Valid fifth pot did not win';
 assert jsonb_array_length(public.club_game('lobby')->'pool')=2,'Pool tournament not recorded';
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
select set_config('app.import','on',true);
update public.docs set data=jsonb_build_object('marks',jsonb_build_object(to_char(now()at time zone'Europe/Moscow','YYYY-MM')||'-01|1','н'))where path='attendance/'||current_setting('test.cg_b');
select set_config('app.import','',true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.cg_b'),'role','authenticated')::text,true);
do $$declare bad boolean:=false;begin
 assert public.club_visit('state')->>'room'='main','Expired eligibility did not return user to main';
 begin perform public.club_game('lobby');exception when insufficient_privilege then bad:=true;end;assert bad,'Revoked player still accesses games';
end $$;
reset role;
-- A new month excludes the previous month's results without destroying the history.
select set_config('request.jwt.claims','{}',true);
update politeshik_private.club_games set ended_at=date_trunc('month',now())-interval'1 day'where host in(current_setting('test.cg_a')::uuid,current_setting('test.cg_b')::uuid)and status='finished';
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.cg_a'),'role','authenticated')::text,true);
do $$declare lobby jsonb:=public.club_game('lobby');begin assert lobby->'poker'='[]'::jsonb and lobby->'pool'='[]'::jsonb,'Previous month remains in tournament tables';end $$;
reset role;
-- Verify canonical poker ordering, including ace-low straight.
do $$begin assert politeshik_private.poker_value(array[32,36,40,44,48])>politeshik_private.poker_value(array[48,49,50,51,0]),'Straight flush loses to quads';assert politeshik_private.poker_value(array[48,1,4,9,12])<politeshik_private.poker_value(array[0,5,8,13,16]),'Ace-low straight should lose to six-high';assert politeshik_private.poker_value(array[48,1,4,9,12])>politeshik_private.poker_value(array[0,1,2,8,12]),'Straight should beat trips';end $$;
rollback;
