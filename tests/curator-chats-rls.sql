begin;
select set_config('app.import','on',true);
select set_config('test.cc_curator',gen_random_uuid()::text,true),set_config('test.cc_leader4',gen_random_uuid()::text,true),set_config('test.cc_leader6',gen_random_uuid()::text,true),set_config('test.cc_other',gen_random_uuid()::text,true),set_config('test.cc_student',gen_random_uuid()::text,true),set_config('test.cc_nonce',gen_random_uuid()::text,true);
do $$declare k text;u uuid;begin
 foreach k in array array['curator','leader4','leader6','other','student'] loop
 u:=current_setting('test.cc_'||k)::uuid;insert into auth.users(id,email,email_confirmed_at,aud,role) values(u,'curator-chat-'||u||'@example.invalid',now(),'authenticated','authenticated');
 end loop;
end $$;
insert into public.members(tenant_id,uid,role,status,requested_role,group_id,full_name) values
 ('group_4',current_setting('test.cc_curator')::uuid,'curator','approved','staff','g_24290907_2092','Test curator'),
 ('group_4',current_setting('test.cc_leader4')::uuid,'admin','approved','student','g_24290907_2092','Leader 4'),
 ('group_6',current_setting('test.cc_leader6')::uuid,'admin','approved','student','g_25290907_1091','Leader 6'),
 ('group_3',current_setting('test.cc_other')::uuid,'admin','approved','student','g_23290907_2092','Unrelated leader'),
 ('group_4',current_setting('test.cc_student')::uuid,'student','approved','student','g_24290907_2092','Ordinary student');
update politeshik_private.curator_accounts set claimed_uid=current_setting('test.cc_curator')::uuid where id='nazarov_da';
select set_config('app.import','',true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.cc_curator'),'role','authenticated')::text,true);
do $$declare contacts jsonb;message jsonb;denied boolean:=false;begin
 contacts:=public.curator_chat_contacts();assert jsonb_array_length(contacts)=3,'Curator must see exactly three scoped groups';
 assert exists(select 1 from jsonb_array_elements(contacts)c where c->>'tenant_id'='group_5' and c->>'peer_uid' is null),'Reserved leader should be waiting';
 message:=public.curator_chat_send('group_4',current_setting('test.cc_leader4')::uuid,'Hello <script>',current_setting('test.cc_nonce')::uuid);
 assert message->>'sender'=current_setting('test.cc_curator'),'Sender spoofed';assert message->>'read_at' is null,'New message already read';
 perform public.curator_chat_send('group_4',current_setting('test.cc_leader4')::uuid,'Hello <script>',current_setting('test.cc_nonce')::uuid);
 assert jsonb_array_length(public.curator_chat_messages('group_4',current_setting('test.cc_leader4')::uuid))=1,'Nonce retry duplicated message';
 begin perform public.curator_chat_send('group_3',current_setting('test.cc_other')::uuid,'forbidden',gen_random_uuid());exception when insufficient_privilege then denied:=true;end;assert denied,'Curator messaged unrelated group';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.cc_leader4'),'role','authenticated')::text,true);
do $$declare contacts jsonb;denied boolean:=false;begin
 contacts:=public.curator_chat_contacts();assert jsonb_array_length(contacts)=1,'Leader saw another group';assert contacts->0->>'unread'='1','Unread counter missing';
 assert jsonb_array_length(public.curator_chat_messages('group_4',current_setting('test.cc_curator')::uuid))=1,'Leader cannot read curator message';
 assert public.curator_chat_contacts()->0->>'unread'='0','Read state not persisted';
 perform public.curator_chat_send('group_4',current_setting('test.cc_curator')::uuid,'Reply',gen_random_uuid());
 begin perform public.curator_chat_messages('group_6',current_setting('test.cc_curator')::uuid);exception when insufficient_privilege then denied:=true;end;assert denied,'Leader read another group thread';
 denied:=false;begin perform 1 from politeshik_private.curator_messages;exception when insufficient_privilege then denied:=true;end;assert denied,'Direct table read allowed';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.cc_curator'),'role','authenticated')::text,true);
do $$declare rows jsonb;begin
 rows:=public.curator_chat_messages('group_4',current_setting('test.cc_leader4')::uuid);assert jsonb_array_length(rows)=2,'Reply missing';assert rows->0->>'read_at' is not null,'Sender cannot see read receipt';
 assert jsonb_array_length(public.curator_chat_messages('group_6',current_setting('test.cc_leader6')::uuid))=0,'Messages leaked across groups';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.cc_student'),'role','authenticated')::text,true);
do $$declare denied boolean:=false;begin
 assert public.curator_chat_contacts()='[]'::jsonb,'Student sees curator contacts';
 begin perform public.curator_chat_messages('group_4',current_setting('test.cc_curator')::uuid);exception when insufficient_privilege then denied:=true;end;assert denied,'Student read work chats';
end $$;
reset role;
update public.members set status='banned' where uid=current_setting('test.cc_curator')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.cc_leader4'),'role','authenticated')::text,true);
do $$declare denied boolean:=false;begin
 assert public.curator_chat_contacts()='[]'::jsonb,'Banned curator still listed';
 begin perform public.curator_chat_send('group_4',current_setting('test.cc_curator')::uuid,'forbidden',gen_random_uuid());exception when insufficient_privilege then denied:=true;end;assert denied,'Revocation did not close thread';
end $$;
reset role;
rollback;
