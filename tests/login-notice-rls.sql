begin;
do $$declare u uuid:=gen_random_uuid();s uuid:=gen_random_uuid();begin
 perform set_config('test.mail_uid',u::text,true);perform set_config('test.mail_session',s::text,true);
 insert into auth.users(id,email,email_confirmed_at,aud,role)values(u,'mail-test-'||u||'@example.invalid',now(),'authenticated','authenticated');
 insert into auth.sessions(id,user_id,created_at)values(s,u,now());
 insert into auth.mfa_amr_claims(session_id,authentication_method)values(s,'password');
 assert not exists(select 1 from politeshik_private.login_mail_outbox where session_id=s),'Mail sent before SMTP configuration';
 update politeshik_private.login_mail_settings set enabled=true;
 s:=gen_random_uuid();perform set_config('test.mail_session',s::text,true);insert into auth.sessions(id,user_id,created_at)values(s,u,now());
 insert into auth.mfa_amr_claims(session_id,authentication_method)values(s,'recovery');
 assert not exists(select 1 from politeshik_private.login_mail_outbox where session_id=s),'Recovery verification treated as password login';
 insert into auth.mfa_amr_claims(session_id,authentication_method)values(s,'password');
 assert(select count(*)from politeshik_private.login_mail_outbox where session_id=s)=1,'Password login not queued';
 perform set_config('test.mail_event',(select id::text from politeshik_private.login_mail_outbox where session_id=s),true);
 perform set_config('test.mail_token',(select (convert_from(extensions.decrypt_iv(decode(q.body->>'data','hex'),extensions.digest('enc:'||v.decrypted_secret,'sha256'),decode(q.body->>'iv','hex'),'aes-cbc/pad:pkcs'),'utf8')::jsonb)->>'token'from net.http_request_queue q join politeshik_private.login_mail_settings s on true join vault.decrypted_secrets v on v.id=s.dispatch_key_id where q.body->>'event_id'=current_setting('test.mail_event')order by q.id desc limit 1),true);
 assert not exists(select 1 from net.http_request_queue where body::text like'%'||current_setting('test.mail_token')||'%'),'Raw capability exposed in transport';
 assert(select token_hash=extensions.digest(current_setting('test.mail_token'),'sha256')from politeshik_private.login_mail_outbox where session_id=s),'Raw token or wrong token hash stored';
end $$;
set local role authenticated;
do $$declare denied boolean:=false;begin
 begin perform public.claim_login_notice(current_setting('test.mail_event')::uuid,current_setting('test.mail_token'));exception when insufficient_privilege then denied:=true;end;assert denied,'Browser role can claim email events';
 denied:=false;begin perform 1 from vault.decrypted_secrets;exception when insufficient_privilege then denied:=true;end;assert denied,'Browser can read transport encryption key';
 denied:=false;begin perform 1 from politeshik_private.login_mail_outbox;exception when insufficient_privilege then denied:=true;end;assert denied,'Browser can read other login metadata';
end $$;
reset role;
set local role service_role;
do $$declare item jsonb;begin
 assert public.claim_login_notice(current_setting('test.mail_event')::uuid,repeat('0',64))is null,'Invalid token accepted';
 item:=public.claim_login_notice(current_setting('test.mail_event')::uuid,current_setting('test.mail_token'));assert item->>'email'='mail-test-'||current_setting('test.mail_uid')||'@example.invalid','Caller influenced recipient';
 assert public.claim_login_notice(current_setting('test.mail_event')::uuid,current_setting('test.mail_token'))is null,'Concurrent delivery duplicated';
 assert public.finish_login_notice(current_setting('test.mail_event')::uuid,current_setting('test.mail_token'),true),'Delivery was not recorded';
 assert public.claim_login_notice(current_setting('test.mail_event')::uuid,current_setting('test.mail_token'))is null,'Consumed token replay';
end $$;
reset role;
do $$begin
 assert(select sent_at is not null and token_hash is null from politeshik_private.login_mail_outbox where id=current_setting('test.mail_event')::uuid),'Delivery token retained after consumption';
 assert not has_function_privilege('anon','public.claim_login_notice(uuid,text)','execute'),'Anonymous RPC grant';
end $$;
rollback;
