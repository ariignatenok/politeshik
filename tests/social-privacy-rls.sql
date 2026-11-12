begin;
select set_config('test.super',(select uid::text from politeshik_private.super_admins limit 1),true);
do $$declare k text;u uuid;begin foreach k in array array['social2','social3','socialOther','socialParent','socialPending'] loop
 u:=gen_random_uuid();perform set_config('test.'||k,u::text,true);
 insert into auth.users(id,email,email_confirmed_at,aud,role) values(u,'social-'||u||'@example.invalid',now(),'authenticated','authenticated');end loop;end $$;
insert into public.members(tenant_id,uid,role,status,requested_role,full_name,group_id) values
('group_2',current_setting('test.social2')::uuid,'student','approved','student','Social Two','g_26290911_3111'),
('group_3',current_setting('test.social3')::uuid,'student','approved','student','Social Three','g_23290907_2092'),
('group_2',current_setting('test.socialOther')::uuid,'student','approved','student','Social Other','g_26290911_3111'),
('group_2',current_setting('test.socialParent')::uuid,'parent','approved','parent','Social Parent','g_26290911_3111'),
('group_2',current_setting('test.socialPending')::uuid,'student','pending','student','Social Pending','g_26290911_3111');
insert into public.docs(tenant_id,path,data) values
('group_2','profiles/'||current_setting('test.social2'),'{"rid":"g2_r1","name":"Social Two","about":"Public bio 2","email":"PRIVATE","stats":{"private":true}}'),
('group_3','profiles/'||current_setting('test.social3'),'{"rid":"g3_r1","name":"Social Three","about":"Public bio 3","phone":"PRIVATE","mascot":{"body":"pink"}}'),
('group_3','avatars/'||current_setting('test.social3'),'{"v":"m4","mascot":{"body":"pink"}}'),
('group_3','attendance/'||current_setting('test.social3'),'{"marks":{}}');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.social2'),'role','authenticated')::text,true),set_config('request.headers','{}',true);
do $$declare card jsonb;msg jsonb;denied boolean:=false;n uuid:=gen_random_uuid();begin
 card:=public.social_profile(current_setting('test.social3')::uuid);
 assert card->>'about'='Public bio 3' and card->>'avatar'='m4' and card->'mascot'->>'body'='pink','Public profile did not cross groups';
 assert not(card ? 'phone' or card ? 'email' or card ? 'stats' or card ? 'marks' or card ? 'tenant_id'),'Private education/profile data leaked';
 assert not exists(select 1 from public.docs where tenant_id='group_3'),'Social profiles broadened education RLS';
 assert public.social_profile(current_setting('test.socialParent')::uuid) is null,'Parent published as student';
 assert public.social_profile(current_setting('test.socialPending')::uuid) is null,'Unapproved student published';
 card:=public.social_like(current_setting('test.social3')::uuid,'mascot',true);
 assert card->>'mascot_likes'='1' and card->>'liked_mascot'='true','Mascot like not saved';
 card:=public.social_like(current_setting('test.social3')::uuid,'mascot',true);assert card->>'mascot_likes'='1','Duplicate mascot likes';
 card:=public.social_like(current_setting('test.social3')::uuid,'photo',true);assert card->>'photo_likes'='1','Photo like not independent';
 card:=public.social_like(current_setting('test.social3')::uuid,'mascot',false);assert card->>'mascot_likes'='0' and card->>'photo_likes'='1','Unlike erased photo likes';
 msg:=public.peer_send(current_setting('test.social3')::uuid,'hello',n);
 assert msg->>'sender'=auth.uid()::text and msg->>'recipient'=current_setting('test.social3'),'Wrong message parties';
 assert public.peer_send(current_setting('test.social3')::uuid,'hello',n)=msg,'Retry duplicated message';
 assert jsonb_array_length(public.peer_messages(current_setting('test.social3')::uuid))=1,'Sent message unavailable';
 assert jsonb_array_length(public.peer_inbox())=1,'Missing sender inbox';
 assert public.club_visit('state')->>'joined'='false','User joined club without opting in';
 assert public.club_visit('join')->>'joined'='true','Club entry failed';
 begin perform public.social_like(auth.uid(),'mascot',true);exception when others then denied:=true;end;assert denied,'Self likes accepted';
 denied:=false;begin perform public.peer_send(current_setting('test.socialParent')::uuid,'bad',gen_random_uuid());exception when insufficient_privilege then denied:=true;end;assert denied,'Parent targeted';
 denied:=false;begin perform count(*) from politeshik_private.peer_messages;exception when insufficient_privilege then denied:=true;end;assert denied,'Direct messages table exposed';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.social3'),'role','authenticated')::text,true);
do $$declare inbox jsonb;begin
 inbox:=public.peer_inbox();assert inbox->0->>'unread'='1','Unread recipient count wrong';
 assert jsonb_array_length(public.peer_messages(current_setting('test.social2')::uuid))=1,'Recipient cannot read cross-group peer';
 perform public.peer_read(current_setting('test.social2')::uuid);assert public.peer_inbox()->0->>'unread'='0','Read receipt failed';
 assert exists(select 1 from jsonb_array_elements(public.club_visit('join')->'visitors') x where x->>'uid'=current_setting('test.social2')),'Shared club not visible across groups';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.socialOther'),'role','authenticated')::text,true);
do $$begin assert jsonb_array_length(public.peer_inbox())=0,'Unrelated user sees inbox';assert jsonb_array_length(public.peer_messages(current_setting('test.social2')::uuid))=0,'Unrelated user reads another conversation';end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.super'),'role','authenticated')::text,true);
do $$begin assert not exists(select 1 from jsonb_array_elements(public.peer_messages(current_setting('test.social2')::uuid)) x where x->>'body'='hello'),'Superadmin can read private student conversation';end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.socialParent'),'role','authenticated')::text,true);
do $$declare denied boolean:=false;begin begin perform public.social_people();exception when insufficient_privilege then denied:=true;end;assert denied,'Parent entered student directory';end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.socialPending'),'role','authenticated')::text,true);
do $$declare denied boolean:=false;begin begin perform public.club_visit('join');exception when insufficient_privilege then denied:=true;end;assert denied,'Unapproved visitor joined';end $$;
rollback;
