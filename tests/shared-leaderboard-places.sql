begin;
select set_config('app.import','on',true);
do $$declare k text;u uuid;t text;rid text;n integer:=0;begin
 foreach k in array array['a','b','c','d']loop
 n:=n+1;u:=gen_random_uuid();perform set_config('test.rank_'||k,u::text,true);t:=case when k='d'then 'group_3'else 'group_2'end;rid:=case when k='d'then 'g3_r1'else 'g2_r'||n end;
 insert into auth.users(id,email,email_confirmed_at,aud,role)values(u,'rank-test-'||u||'@example.invalid',now(),'authenticated','authenticated');
 insert into public.members(tenant_id,uid,role,status,requested_role,group_id,full_name)values(t,u,'student','approved','student',case when k='d'then 'g_23290907_2092'else 'g_26290911_3111'end,case k when 'a'then 'Яковлев тест'when 'b'then 'Абрамов тест'else 'Ниже тест '||k end);
 insert into public.docs(tenant_id,path,data)values(t,'profiles/'||u::text,jsonb_build_object('rid',rid,'stats',jsonb_build_object('month',to_char(now()at time zone 'Europe/Moscow','YYYY-MM'),'cardsMonth',case when k='c'then 0 else 100 end))),(t,'attendance/'||u::text,jsonb_build_object('marks',jsonb_build_object(to_char(now()at time zone 'Europe/Moscow','YYYY-MM')||'-01|1','п',to_char(now()at time zone 'Europe/Moscow','YYYY-MM')||'-01|2',case when k='c'then 'н'else 'п'end)));
 end loop;
end $$;
select set_config('app.import','',true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.rank_a'),'role','authenticated')::text,true),set_config('request.headers','{}',true);
do $$declare rows jsonb;begin
 rows:=public.group_leaderboard()->'rows';
 assert exists(select 1 from jsonb_array_elements(rows)x where x->>'uid'=current_setting('test.rank_a')and x->>'place'='1'and(x->>'score')::numeric=100),'Alphabetically later name lost a shared first place';
 assert exists(select 1 from jsonb_array_elements(rows)x where x->>'uid'=current_setting('test.rank_b')and x->>'place'='1'),'Equal group score has a different place';
 assert exists(select 1 from jsonb_array_elements(rows)x where x->>'uid'=current_setting('test.rank_c')and x->>'place'='2'),'Next group place must immediately follow the shared place';
 assert not exists(select 1 from jsonb_array_elements(rows)x where x->>'uid'=current_setting('test.rank_d')),'Group leaderboard includes foreign group';
 rows:=public.profile_leaderboard()->'rows';
 assert(select count(*)from jsonb_array_elements(rows)x where x->>'uid'in(current_setting('test.rank_a'),current_setting('test.rank_b'),current_setting('test.rank_d'))and x->>'place'='1')=3,'Equal global scores across groups must share first place';
 assert exists(select 1 from jsonb_array_elements(rows)x where x->>'uid'=current_setting('test.rank_c')and x->>'place'='2'),'Global ranking must not skip places after a three-way tie';
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
select set_config('app.import','on',true);
update public.members set full_name='Ааа новое имя'where uid=current_setting('test.rank_a')::uuid;
update public.docs set data=jsonb_build_object('marks','{}'::jsonb)where path in('attendance/'||current_setting('test.rank_a'),'attendance/'||current_setting('test.rank_b'),'attendance/'||current_setting('test.rank_c'));
update public.docs set data=jsonb_set(data,'{stats,cardsMonth}','0')where path in('profiles/'||current_setting('test.rank_a'),'profiles/'||current_setting('test.rank_b'),'profiles/'||current_setting('test.rank_c'));
select set_config('app.import','',true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.rank_a'),'role','authenticated')::text,true);
do $$declare rows jsonb:=public.group_leaderboard()->'rows';begin assert(select count(*)from jsonb_array_elements(rows)x where x->>'uid'in(current_setting('test.rank_a'),current_setting('test.rank_b'),current_setting('test.rank_c'))and x->>'place'='1')=3,'Zero scores or renamed people are not tied';end $$;
reset role;
rollback;
