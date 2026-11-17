begin;
select set_config('app.import','on',true);
do $$declare u uuid;i integer;begin
 for i in 1..8 loop
  u:=gen_random_uuid();perform set_config('test.table_user_'||i,u::text,true);
  insert into auth.users(id,email,email_confirmed_at,aud,role)values(u,u::text||'@example.invalid',now(),'authenticated','authenticated');
  insert into public.members(tenant_id,uid,role,status,requested_role,group_id,full_name)values('group_2',u,'student','approved','student','g_26290911_3111','Table guest '||i);
  insert into public.docs(tenant_id,path,data)values('group_2','profiles/'||u,jsonb_build_object('rid','g2_r'||i)),('group_2','attendance/'||u,jsonb_build_object('marks',jsonb_build_object(to_char(now()at time zone'Europe/Moscow','YYYY-MM')||'-01|1','п')));
 end loop;
end $$;
select set_config('app.import','',true);
set local role authenticated;
do $$declare i integer;g jsonb;kind text;slot integer;game_id uuid;result jsonb;begin
 for i in 1..8 loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.table_user_'||i),'role','authenticated')::text,true);
  perform public.club_visit('join');perform public.club_enter_room('games');
  kind:=case when i<=4 then'poker'else'pool'end;slot:=case when i%4 in(1,2)then 1 else 2 end;
  if i%2=1 then
   game_id:=gen_random_uuid();perform set_config('test.table_game_'||i,game_id::text,true);
   g:=public.club_game('create',kind,null,jsonb_build_object('slot',slot),game_id);
   assert g->>'table_slot'=slot::text,'Requested table not allocated';
  else
   g:=public.club_game('join',null,current_setting('test.table_game_'||(i-1))::uuid);
   assert g->>'status'='active','Second independent table did not start';
  end if;
 end loop;
 result:=public.club_visit('state');
 assert jsonb_array_length(result->'visitors')>=8,'More than two players are not present';
 assert(select count(distinct(v->>'game_id'))from jsonb_array_elements(result->'visitors')v where v->>'game_id'is not null)>=4,'Matches were merged';
 assert(select count(distinct(v->>'x',v->>'y'))from jsonb_array_elements(result->'visitors')v where v->>'game_id'is not null)>=8,'Different table players overlap';
 assert(result->'table_layout'->>'poker')::integer>=3,'No spare poker table';
 assert(result->'table_layout'->>'pool')::integer>=3,'No spare pool table';
 assert not exists(select 1 from jsonb_array_elements(result->'visitors')v where v?'hand'),'Hands leaked to the room';
end $$;
reset role;
create or replace function politeshik_private.club_table_layout()returns jsonb language sql stable security invoker set search_path=''as $$select '{"poker":100,"pool":100,"poker_rows":50,"height":31556}'::jsonb$$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.table_user_1'),'role','authenticated')::text,true);
do $$declare result jsonb;begin
 perform public.club_game('draw',null,current_setting('test.table_game_1')::uuid,'{"cards":[]}',gen_random_uuid());
 result:=public.club_visit('state');assert exists(select 1 from jsonb_array_elements(result->'visitors')v where v->>'uid'=auth.uid()::text and(v->>'y')::numeric<12),'Large room pose projection was clamped incorrectly';
end $$;
reset role;
do $$begin assert(select count(*)from politeshik_private.club_games where status='active'and(host in(select current_setting('test.table_user_'||i)::uuid from generate_series(1,8)i)))=4,'Four simultaneous games not persisted';end $$;
rollback;
