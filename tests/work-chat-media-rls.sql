-- Storage service is represented by direct fixture objects; no files or real users are created.
begin;
do $$begin assert current_database()like'politeshik_%rehearsal','Rehearsal only';end $$;
alter table storage.objects enable row level security;
grant select,insert,delete on storage.objects to authenticated;
select set_config('app.import','on',true);
do $$declare k text;u uuid;t text;gid text;owner uuid;begin
 foreach k in array array['leader4','leader5','student4','student5','curator','stranger','makar','platform']loop
  u:=gen_random_uuid();perform set_config('test.wm_'||k,u::text,true);
  insert into auth.users(id,email,email_confirmed_at,aud,role)values(u,case k when'platform'then'dimakrfeedsonos@gmail.com'when'makar'then'colpaxe@gmail.com'else u||'@example.invalid'end,now(),'authenticated','authenticated');
  if k<>'platform'then
   t:=case when k in('leader5','student5')then'group_5'when k='stranger'then'group_3'when k='makar'then'group_2'else'group_4'end;
   select id into gid from public.groups where tenant_id=t limit 1;
   insert into public.members(tenant_id,uid,role,status,requested_role,group_id,full_name)values(t,u,case when k like'leader%'then'admin'when k='curator'then'curator'when k='makar'then'developer'else'student'end,'approved',case when k='curator'then'staff'else'student'end,gid,'Media fixture '||k);
   if k like'leader%'then insert into public.admins(tenant_id,uid)values(t,u);end if;
   insert into public.docs(tenant_id,path,data)values(t,'profiles/'||u,jsonb_build_object('name','Media fixture '||k,'rid',case when k='makar'then'g2_r12'when k='student4'then'g4_r1'else null end));
  end if;
 end loop;
 update politeshik_private.curator_accounts set claimed_uid=current_setting('test.wm_curator')::uuid where id='nazarov_da';
 select uid into owner from politeshik_private.super_admins limit 1;perform set_config('test.wm_owner',owner::text,true);
 insert into auth.users(id,email,email_confirmed_at,aud,role)values(owner,'arienaburlova@yandex.ru',now(),'authenticated','authenticated')on conflict(id)do nothing;
 insert into public.members(tenant_id,uid,role,status,requested_role,group_id,full_name)values('group_1',owner,'admin','approved','student','g_main','Админ Арина')on conflict do nothing;
end $$;
select set_config('app.import','',true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wm_platform'),'role','authenticated')::text,true);
select public.platform_context()->>'active';
do $$declare spec text;scope text;tenant text;peer uuid;actor uuid;media text;mime text;r jsonb;a jsonb;data jsonb;denied boolean;cursor jsonb;page1 jsonb;page2 jsonb;begin
 foreach spec in array array['leaders','development','group','curator']loop
  scope:=spec;tenant:=case scope when'group'then'group_4'when'curator'then'group_5'else null end;
  peer:=case when scope='curator'then current_setting('test.wm_curator')::uuid end;
  actor:=case scope when'development'then current_setting('test.wm_platform')::uuid when'group'then current_setting('test.wm_student4')::uuid when'curator'then current_setting('test.wm_leader5')::uuid else current_setting('test.wm_leader4')::uuid end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  data:=public.work_chat_info(scope,tenant,peer);assert jsonb_array_length(data->'participants')>=2,'Participants missing';
  if scope='development'then assert jsonb_array_length(data->'participants')=3,'Development team must stay private';end if;
  if scope='curator'then assert jsonb_array_length(data->'participants')=2,'Curator DM exposed other leaders';end if;
  foreach media in array array['photo','video','voice','file']loop
   mime:=case media when'photo'then'image/png'when'video'then'video/mp4'when'voice'then'audio/webm'else'application/pdf'end;
   r:=public.prepare_work_chat_upload(scope,tenant,peer,'fixture-'||media,mime,4,media);
   assert politeshik_private.work_chat_object_access(r->>'path',true),'Upload denied for participant';
   insert into storage.objects(bucket_id,name,metadata)values('private-messages',r->>'path',jsonb_build_object('size',4,'mimetype',mime));
   perform public.send_work_chat_upload((r->>'id')::uuid,'Attachment https://example.edu/'||scope||'/'||media);
   perform public.send_work_chat_upload((r->>'id')::uuid,'retry ignored after successful publication');
   assert politeshik_private.work_chat_object_access(r->>'path',false),'Participant cannot read sent file';
   assert not politeshik_private.work_chat_object_access(r->>'path',true),'Sent file still overwriteable';
   perform set_config('test.wm_path_'||scope,r->>'path',true);
  end loop;
  assert jsonb_array_length(public.work_chat_gallery(scope,tenant,peer,'media'))=2,'Media gallery missing photo/video';
  assert jsonb_array_length(public.work_chat_gallery(scope,tenant,peer,'voice'))=1,'Voice missing';
  assert jsonb_array_length(public.work_chat_gallery(scope,tenant,peer,'files'))=1,'File missing';
  assert jsonb_array_length(public.work_chat_gallery(scope,tenant,peer,'links'))=4,'Links missing or duplicated';
  data:=case scope when'leaders'then public.leader_chat_messages()when'development'then public.development_chat_messages()when'group'then public.group_room_messages(tenant)else public.curator_chat_messages(tenant,peer)end;
  assert(select count(*)=4 from jsonb_array_elements(data)x where x->'attachment'->>'path'like actor::text||'/%'),'Thread omitted attachments or retry duplicated';
  denied:=false;begin perform public.prepare_work_chat_upload(scope,tenant,peer,'bad','image/svg+xml',4,'photo');exception when others then denied:=true;end;assert denied,'Unsafe photo MIME accepted';
  denied:=false;begin perform public.prepare_work_chat_upload(scope,tenant,peer,'large','application/octet-stream',26214401,'file');exception when others then denied:=true;end;assert denied,'Size limit bypass';
  r:=public.prepare_work_chat_upload(scope,tenant,peer,'not-uploaded','application/pdf',4,'file');
  denied:=false;begin perform public.send_work_chat_upload((r->>'id')::uuid,'');exception when others then denied:=true;end;assert denied,'Unuploaded attachment published';
 end loop;
 -- The receiving curator sees only this leader's private attachment; another leader does not.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wm_curator'),'role','authenticated')::text,true);
 assert politeshik_private.work_chat_object_access(current_setting('test.wm_path_curator'),false),'Recipient curator cannot read DM file';
 assert exists(select 1 from storage.objects where bucket_id='private-messages'and name=current_setting('test.wm_path_curator')),'Storage RLS hides valid curator attachment';
 assert jsonb_array_length(public.work_chat_gallery('curator','group_5',current_setting('test.wm_leader5')::uuid,'files'))=1,'Receiving curator gallery missing';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wm_leader4'),'role','authenticated')::text,true);
 assert not politeshik_private.work_chat_object_access(current_setting('test.wm_path_curator'),false),'Another leader saw private curator DM file';
 assert not exists(select 1 from storage.objects where name=current_setting('test.wm_path_curator')),'Storage RLS leaked curator DM file';
 -- A deputy loses council media rights after revocation while retaining the normal group room.
 perform public.set_group_deputy(current_setting('test.wm_student4')::uuid,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wm_student4'),'role','authenticated')::text,true);
 assert politeshik_private.work_chat_object_access(current_setting('test.wm_path_leaders'),false),'Deputy cannot read council attachment';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wm_leader4'),'role','authenticated')::text,true);
 perform public.set_group_deputy(current_setting('test.wm_student4')::uuid,false);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wm_student4'),'role','authenticated')::text,true);
 assert not politeshik_private.work_chat_object_access(current_setting('test.wm_path_leaders'),false),'Revoked deputy retained council file';
 assert politeshik_private.work_chat_object_access(current_setting('test.wm_path_group'),false),'Revoked deputy lost ordinary own-group media';
 -- Global management rights do not grant access to academic group conversations.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wm_platform'),'role','authenticated')::text,true);
 denied:=false;begin perform public.work_chat_info('group','group_4',null);exception when insufficient_privilege then denied:=true;end;assert denied,'Platform developer joined group room';
 assert not politeshik_private.work_chat_object_access(current_setting('test.wm_path_group'),false),'Global developer saw group upload';
 -- A normal student may use only their own group room, not the council or the development team.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wm_student5'),'role','authenticated')::text,true);
 foreach scope in array array['leaders','development']loop
  denied:=false;begin perform public.work_chat_info(scope,null,null);exception when insufficient_privilege then denied:=true;end;assert denied,'Student listed private team';
  denied:=false;begin perform public.prepare_work_chat_upload(scope,null,null,'forged','application/pdf',4,'file');exception when insufficient_privilege then denied:=true;end;assert denied,'Student uploaded to private team';
 end loop;
 assert not politeshik_private.work_chat_object_access(current_setting('test.wm_path_group'),false),'Student read foreign-group file';
 denied:=false;begin perform public.work_chat_gallery('group','group_4',null,'files');exception when insufficient_privilege then denied:=true;end;assert denied,'Foreign gallery readable';
 denied:=false;begin insert into storage.objects(bucket_id,name,metadata)values('private-messages',current_setting('test.wm_student5')||'/'||gen_random_uuid(),'{}');exception when insufficient_privilege then denied:=true;end;assert denied,'Unreserved object upload permitted';
 -- Stable cursor at equal timestamps; no skipped or duplicated link messages.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wm_leader4'),'role','authenticated')::text,true);
 for i in 1..105 loop perform public.leader_chat_send('https://college.example/link/'||i,gen_random_uuid());end loop;
 page1:=public.work_chat_gallery('leaders',null,null,'links');assert jsonb_array_length(page1)=50;
 cursor:=jsonb_build_object('at',page1->49->>'created_at','id',page1->49->>'id');
 page2:=public.work_chat_gallery('leaders',null,null,'links',cursor);assert jsonb_array_length(page2)=50;
 assert not exists(select 1 from jsonb_array_elements(page1)first_message join jsonb_array_elements(page2)second_message on first_message->>'id'=second_message->>'id'),'Gallery cursor duplicates';
end $$;
reset role;
update public.members set status='banned'where uid=current_setting('test.wm_leader4')::uuid;
update politeshik_private.platform_developers set active=false where uid=current_setting('test.wm_platform')::uuid;
set local role authenticated;
do $$declare who text;scope text;denied boolean;begin
 foreach who in array array['leader4','platform']loop
  scope:=case who when'platform'then'development'else'leaders'end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wm_'||who),'role','authenticated')::text,true);
  assert not politeshik_private.work_chat_object_access(current_setting('test.wm_path_'||scope),false),'Revoked role retained file access';
  denied:=false;begin perform public.work_chat_gallery(scope,null,null,'media');exception when insufficient_privilege then denied:=true;end;assert denied,'Revoked role retained gallery';
  denied:=false;begin perform public.send_work_chat_upload(split_part(current_setting('test.wm_path_'||scope),'/',2)::uuid,'retry');exception when insufficient_privilege then denied:=true;end;assert denied,'Revoked role finalized upload';
 end loop;
end $$;
reset role;
do $$begin
 assert not(select public from storage.buckets where id='private-messages'),'Attachment bucket became public';
 assert not has_function_privilege('anon','public.work_chat_info(text,text,uuid)','execute'),'Anonymous room enumeration';
 assert not has_function_privilege('authenticated','politeshik_private.work_chat_projection(text,text,uuid)','execute'),'Unprotected projection exposed';
end $$;
rollback;
