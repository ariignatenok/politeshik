begin;
do $$declare k text;u uuid;begin
 foreach k in array array['a','b','c','parent','pending','teacher']loop
 u:=gen_random_uuid();perform set_config('test.ph_'||k,u::text,true);
 insert into auth.users(id,email,email_confirmed_at,aud,role)values(u,'photo-test-'||u||'@example.invalid',now(),'authenticated','authenticated');
 insert into public.members(tenant_id,uid,role,status,requested_role,group_id,full_name)values(case when k='a'then 'group_2'else 'group_3'end,u,case when k in('parent','teacher')then k else 'student'end,case when k='pending'then 'pending'else 'approved'end,case when k='parent'then 'parent'when k='teacher'then 'staff'else 'student'end,case when k='a'then 'g_26290911_3111'else 'g_23290907_2092'end,'Photo test '||k);
 insert into public.docs(tenant_id,path,data)values(case when k='a'then 'group_2'else 'group_3'end,'profiles/'||u::text,'{"name":"Public test","email":"private@example.invalid","about":"PRIVATE"}'),(case when k='a'then 'group_2'else 'group_3'end,'avatars/'||u::text,'{"v":"m4","mascot":{"body":"pink"}}');
 end loop;
end $$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.ph_a'),'role','authenticated')::text,true);
do $$declare r jsonb;begin
 r:=public.wall_upload_prepare('published.jpg','image/jpeg',4,'post');perform set_config('test.ph_media',r->>'id',true);
 insert into storage.objects(bucket_id,name,metadata)values('profile-wall',r->>'path','{"size":4,"mimetype":"image/jpeg"}');
 perform public.wall_post_save(gen_random_uuid(),'Photo',array[(r->>'id')::uuid]);
 r:=public.wall_upload_prepare('draft.jpg','image/jpeg',4,'post');perform set_config('test.ph_draft',r->>'id',true);
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.ph_b'),'role','authenticated')::text,true);
do $$declare r jsonb;denied boolean:=false;begin
 perform public.social_like(current_setting('test.ph_a')::uuid,'photo',true);perform public.social_like(current_setting('test.ph_a')::uuid,'mascot',true);
 r:=public.profile_like_people(current_setting('test.ph_a')::uuid,'photo');assert r->0->>'uid'=auth.uid()::text,'Like author missing';assert not(r->0?'email'or r->0?'phone'or r->0?'about'),'Private data in like list';
 r:=public.photo_comment_send('profile',current_setting('test.ph_a')::uuid,'Hello <script>', 'a2000000-0000-0000-0000-000000000001');assert r->'person'->>'uid'=auth.uid()::text,'Sender spoofed';
 perform public.photo_comment_send('profile',current_setting('test.ph_a')::uuid,'Hello <script>', 'a2000000-0000-0000-0000-000000000001');
 assert jsonb_array_length(public.photo_comment_list('profile',current_setting('test.ph_a')::uuid))=1,'Retry duplicates comments';
 perform public.photo_comment_send('wall',current_setting('test.ph_media')::uuid,'Wall comment','a2000000-0000-0000-0000-000000000002');
 assert public.photo_comment_list('wall',current_setting('test.ph_media')::uuid)->0->>'body'='Wall comment','Published photo comments unavailable';
 begin perform public.photo_comment_send('wall',current_setting('test.ph_draft')::uuid,'Draft leak',gen_random_uuid());exception when insufficient_privilege then denied:=true;end;assert denied,'Draft photo exposed';
 denied:=false;begin perform 1 from politeshik_private.photo_comments;exception when insufficient_privilege then denied:=true;end;assert denied,'Direct table exposed';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.ph_c'),'role','authenticated')::text,true);
do $$declare denied boolean:=false;r jsonb;begin
 r:=public.photo_comment_list('profile',current_setting('test.ph_a')::uuid);assert r->0->>'can_delete'='false','Unrelated user can moderate';
 begin perform public.photo_comment_delete('a2000000-0000-0000-0000-000000000001');exception when insufficient_privilege then denied:=true;end;assert denied,'Stranger deleted comment';
 denied:=false;begin perform public.photo_comment_send('profile',current_setting('test.ph_a')::uuid,'Hello <script>','a2000000-0000-0000-0000-000000000001');exception when others then denied:=true;end;assert denied,'Nonce impersonation accepted';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.ph_a'),'role','authenticated')::text,true);
do $$begin
 assert public.photo_comment_list('profile',auth.uid())->0->>'can_delete'='true','Photo owner cannot moderate';
 perform public.photo_comment_delete('a2000000-0000-0000-0000-000000000001');assert public.photo_comment_list('profile',auth.uid())='[]'::jsonb,'Deletion not applied';
 perform public.photo_comment_send('profile',auth.uid(),'Old picture discussion','a2000000-0000-0000-0000-000000000003');
 perform public.save_my_avatar('m5');assert public.photo_comment_list('profile',auth.uid())='[]'::jsonb,'Old photo discussion transferred to new photo';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.ph_b'),'role','authenticated')::text,true);
do $$begin perform public.photo_comment_delete('a2000000-0000-0000-0000-000000000002');assert public.photo_comment_list('wall',current_setting('test.ph_media')::uuid)='[]'::jsonb,'Author cannot delete own comment';end $$;
reset role;
do $$declare k text;denied boolean;begin
 foreach k in array array['parent','pending','teacher']loop
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.ph_'||k),'role','authenticated')::text,true);execute 'set local role authenticated';
 denied:=false;begin perform public.profile_like_people(current_setting('test.ph_a')::uuid,'photo');exception when insufficient_privilege then denied:=true;end;assert denied,'Unauthorized like list '||k;
 denied:=false;begin perform public.photo_comment_list('profile',current_setting('test.ph_a')::uuid);exception when insufficient_privilege then denied:=true;end;assert denied,'Unauthorized comments '||k;
 denied:=false;begin perform public.photo_comment_send('profile',current_setting('test.ph_a')::uuid,'No',gen_random_uuid());exception when insufficient_privilege then denied:=true;end;assert denied,'Unauthorized comment write '||k;
 execute 'reset role';end loop;
end $$;
select set_config('request.jwt.claims','{}',true);
insert into politeshik_private.photo_comments(id,kind,target,photo_version,owner_uid,sender,body,created_at)select ('b2000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'profile',current_setting('test.ph_a')::uuid,md5('m5'),current_setting('test.ph_a')::uuid,current_setting('test.ph_b')::uuid,'Page '||i,now()from generate_series(1,55)i;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.ph_a'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare r jsonb;s jsonb;begin r:=public.photo_comment_list('profile',auth.uid());assert jsonb_array_length(r)=51,'First comment page must include lookahead';s:=public.photo_comment_list('profile',auth.uid(),(r->49->>'created_at')::timestamptz,(r->49->>'id')::uuid);assert jsonb_array_length(s)=5,'Equal-time pagination loses comments';end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
update public.members set status='banned'where uid=current_setting('test.ph_b')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.ph_a'),'role','authenticated')::text,true);
do $$begin assert public.profile_like_people(auth.uid(),'photo')='[]'::jsonb,'Banned identity exposed';assert public.photo_comment_list('profile',auth.uid())='[]'::jsonb,'Banned comment identity exposed';end $$;
reset role;
set local role anon;
do $$declare denied boolean:=false;begin begin perform public.profile_like_people(current_setting('test.ph_a')::uuid,'photo');exception when insufficient_privilege then denied:=true;end;assert denied,'Anonymous likes available';end $$;
reset role;
rollback;
