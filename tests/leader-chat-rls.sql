-- Rehearsal-only fixtures; all changes roll back.
begin;
select set_config('app.import','on',true);
do $$declare n int;t text;gid text;kind text;u uuid;rid text;begin
 for n in 1..6 loop
  t:='group_'||n;select id into gid from public.groups where tenant_id=t limit 1;
  foreach kind in array array['leader','deputy','student','outsider'] loop
   u:=gen_random_uuid();perform set_config('test.deputies_'||kind||n,u::text,true);
   insert into auth.users(id,email,email_confirmed_at,aud,role)values(u,u||'@example.invalid',now(),'authenticated','authenticated');
   insert into public.members(tenant_id,uid,role,status,requested_role,full_name,group_id)values(t,u,case when kind='leader' then 'admin' else 'student' end,'approved','student','Council test '||case kind when 'leader' then 'Я староста' when 'deputy' then 'Ю зам' else 'А студент' end||n,gid);
   if kind='leader' then insert into public.admins(tenant_id,uid)values(t,u);end if;
   rid:=case when n=1 then 'r' else 'g'||n||'_r' end||case kind when 'deputy' then '1' when 'student' then '2' else '3' end;
   if kind<>'outsider' then insert into public.docs(tenant_id,path,data)values(t,'profiles/'||u,jsonb_build_object('name','Council test '||case kind when 'leader' then 'Я староста' when 'deputy' then 'Ю зам' else 'А студент' end||n,'rid',rid,'subgroup','1'));end if;
   if kind='student' then
    insert into public.docs(tenant_id,path,data)values(t,'attendance/'||u,'{"marks":{"2026-10-02|1":"уп","2026-10-02|2":"о"},"keep":"original"}');
    insert into public.docs(tenant_id,path,data)values(t,'certs/'||u,'{"items":[{"id":"fixture","from":"2026-10-03","to":"2026-10-03","confirmed":true,"kind":"private diagnosis","file":"private-scan"}]}');
   end if;
  end loop;
 end loop;
end $$;
select set_config('app.import','',true);
-- Extra students ensure role ordering happens before pagination.
do $$declare i integer;u uuid;begin
 for i in 1..30 loop
 u:=gen_random_uuid();insert into auth.users(id,email,email_confirmed_at,aud,role)values(u,u||'@example.invalid',now(),'authenticated','authenticated');
 insert into public.members(tenant_id,uid,role,status,requested_role,full_name,group_id)values('group_4',u,'student','approved','student','Council test А extra '||lpad(i::text,2,'0'),'g_24290907_2092');
 end loop;
end $$;
set local role authenticated;
select set_config('request.headers','{}',true);
do $$declare n int;u uuid;nonce uuid:=gen_random_uuid();data jsonb;denied boolean;first_seq bigint;priority integer;last_priority integer:=-1;card jsonb;all_rows jsonb:='[]';before_count bigint;begin
 perform set_config('test.council_nonce',nonce::text,true);
 for n in 1..6 loop
  u:=current_setting('test.deputies_leader'||n)::uuid;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
  assert public.leader_chat_state()->>'allowed'='true','Leader has no chat';
  perform public.set_group_deputy(current_setting('test.deputies_deputy'||n)::uuid,true);
  data:=public.leader_chat_send('Сообщение группы '||n,case when n=1 then nonce else gen_random_uuid()end);
  if n=1 then first_seq:=(data->>'seq')::bigint;assert public.leader_chat_send('Сообщение группы 1',nonce)=data,'Retry duplicated message';end if;
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.deputies_deputy6'),'role','authenticated')::text,true);
 data:=public.leader_chat_state();assert data->>'allowed'='true' and (data->>'unread')::integer>=6,'Deputy not auto-enrolled';
 data:=public.leader_chat_messages();
 assert (select count(*)>=6 from jsonb_array_elements(data) x where x->>'body' like 'Сообщение группы %'),'Cross-group messages missing';
 assert exists(select 1 from jsonb_array_elements(data)x where x->>'group_name' like '%3091%'),'Group label missing';
 assert public.leader_chat_state()->>'unread'='0','Opening did not mark received messages read';
 denied:=false;begin perform public.leader_chat_send('nonce hijack',nonce);exception when others then denied:=true;end;assert denied,'Other sender reused nonce';
 perform public.leader_chat_send('От зама',gen_random_uuid());
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.deputies_leader1'),'role','authenticated')::text,true);
 data:=public.leader_chat_messages();assert exists(select 1 from jsonb_array_elements(data)x where x->>'id'=nonce::text and (x->>'read_count')::integer>0),'Read receipt missing';
 -- Same-timestamp messages must paginate without skips or duplicates.
 for n in 1..105 loop perform public.leader_chat_send('history '||n,gen_random_uuid());end loop;
 data:=public.leader_chat_messages();assert jsonb_array_length(data)=100,'Latest history page wrong';
 first_seq:=(data->0->>'seq')::bigint;all_rows:=data;
 data:=public.leader_chat_messages(first_seq);assert not exists(select 1 from jsonb_array_elements(data)x where (x->>'seq')::bigint>=first_seq),'History cursor overlaps';
 assert exists(select 1 from jsonb_array_elements(data)x where x->>'id'=nonce::text),'Old history not available';
 -- Server-side people order must survive page boundaries and search.
 all_rows:=public.social_people('Council test',0)||public.social_people('Council test',24)||public.social_people('Council test',48);
 for card in select value from jsonb_array_elements(all_rows)loop
  priority:=case when card->>'role' in('admin','superadmin')then 0 when card->>'is_deputy'='true'then 1 else 2 end;
  assert priority>=last_priority,'People order mixes leaders, deputies and students';last_priority:=priority;
 end loop;
 assert jsonb_array_length(all_rows)>=48,'Pagination fixture incomplete';
 -- A normal student cannot read messages, send, spoof membership or inspect storage.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.deputies_student4'),'role','authenticated')::text,true);
 assert public.leader_chat_state()='{"allowed":false}'::jsonb,'Student sees private chat state';
 denied:=false;begin perform public.leader_chat_messages();exception when insufficient_privilege then denied:=true;end;assert denied,'Student read council';
 denied:=false;begin perform public.leader_chat_send('Forbidden',gen_random_uuid());exception when insufficient_privilege then denied:=true;end;assert denied,'Student sent to council';
 denied:=false;begin perform 1 from politeshik_private.leader_chat_messages;exception when insufficient_privilege then denied:=true;end;assert denied,'Direct storage readable';
 -- Revocation closes the same session immediately, without updating JWTs.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.deputies_leader6'),'role','authenticated')::text,true);
 perform public.set_group_deputy(current_setting('test.deputies_deputy6')::uuid,false);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.deputies_deputy6'),'role','authenticated')::text,true);
 assert public.leader_chat_state()='{"allowed":false}'::jsonb,'Revoked deputy remains a member';
 denied:=false;begin perform public.leader_chat_messages();exception when insufficient_privilege then denied:=true;end;assert denied,'Revoked deputy read history';
 denied:=false;begin perform public.leader_chat_send('Forbidden after revoke',gen_random_uuid());exception when insufficient_privilege then denied:=true;end;assert denied,'Revoked deputy sent message';
end $$;
reset role;
-- An admin role without the actual admin grant is insufficient; banned leaders also lose access.
delete from public.admins where uid=current_setting('test.deputies_leader2')::uuid;
update public.members set status='banned' where uid=current_setting('test.deputies_leader3')::uuid;
set local role authenticated;
do $$declare n int;begin for n in 2..3 loop
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.deputies_leader'||n),'role','authenticated')::text,true);
 assert public.leader_chat_state()='{"allowed":false}'::jsonb,'Inactive leader has access';
 end loop;end $$;
reset role;
do $$begin
 assert not has_function_privilege('anon','public.leader_chat_messages(bigint)','execute'),'Anonymous history exposed';
 assert not has_function_privilege('authenticated','politeshik_private.leader_chat_members()','execute'),'Private membership helper exposed';
end $$;
rollback;
