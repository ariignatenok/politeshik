begin;
select set_config('test.wa',gen_random_uuid()::text,true),set_config('test.wb',gen_random_uuid()::text,true),set_config('test.wp',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,aud,role) select current_setting('test.'||x)::uuid,'wall-login-'||current_setting('test.'||x)||'@example.invalid',now(),'authenticated','authenticated' from unnest(array['wa','wb','wp'])x;
insert into public.members(tenant_id,uid,role,status,requested_role,group_id,full_name) values
 ('group_2',current_setting('test.wa')::uuid,'student','approved','student','g_26290911_3111','Wall A'),
 ('group_3',current_setting('test.wb')::uuid,'student','approved','student','g_23290907_2092','Wall B'),
 ('group_3',current_setting('test.wp')::uuid,'parent','approved','parent','g_23290907_2092','Parent P');
insert into public.docs(tenant_id,path,data) values
 ('group_2','profiles/'||current_setting('test.wa'),'{"name":"Wall A","phone":"private legacy phone","email":"private@example.invalid","about":"Old bio"}'),
 ('group_3','profiles/'||current_setting('test.wb'),'{"name":"Wall B"}');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wa'),'role','authenticated')::text,true),set_config('request.headers','{}',true);
do $$declare c jsonb;r jsonb;bad boolean:=false;begin
 c:=public.social_profile(auth.uid());assert c->>'phone'='' and c->>'contact_email'='','Login/legacy contacts were published automatically';
 c:=public.wall_profile_save('{"tagline":"My thoughts","info":"Useful things","phone":"+7 900 123-45-67","contact_email":"public@example.invalid","show_phone":false,"show_email":true,"theme":"rose"}');
 assert c->>'about'='Old bio','Cover/page initialization discarded existing bio';
 assert c->>'contact_email'='public@example.invalid' and c->>'phone'='','Contact visibility flags ignored';
 assert public.wall_page(auth.uid())->'settings'->>'phone'='+7 900 123-45-67','Owner cannot edit hidden contact';
 c:=public.wall_profile_save('{"bio":""}');assert c->>'about'='','Clearing a bio restores obsolete legacy text';
 begin perform public.wall_profile_save(jsonb_build_object('uid',current_setting('test.wb')));exception when others then bad:=true;end;assert bad,'Profile owner can be reassigned';
 r:=public.wall_upload_prepare('wall.jpg','image/jpeg',4,'post');perform set_config('test.wimage',r->>'id',true);perform set_config('test.wpath',r->>'path',true);
 insert into storage.objects(bucket_id,name,metadata) values('profile-wall',r->>'path','{"size":4,"mimetype":"image/jpeg"}');
 r:=public.wall_upload_prepare('cover.jpg','image/jpeg',4,'cover');perform set_config('test.wcover',r->>'id',true);perform set_config('test.wcoverpath',r->>'path',true);
 insert into storage.objects(bucket_id,name,metadata) values('profile-wall',r->>'path','{"size":4,"mimetype":"image/jpeg"}');
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wb'),'role','authenticated')::text,true);
do $$begin
 assert not exists(select 1 from storage.objects where name in(current_setting('test.wpath'),current_setting('test.wcoverpath'))),'Unpublished photos leaked to other students';
 assert public.wall_page(current_setting('test.wa')::uuid)->'settings'='{}','Hidden page settings exposed';
 assert not exists(select 1 from public.docs where tenant_id='group_2'),'Social wall broadened education tenant access';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wa'),'role','authenticated')::text,true);
do $$declare id uuid:=gen_random_uuid();i integer;begin
 perform set_config('test.wpost',id::text,true);
 perform public.wall_post_save(id,'My first thought <script>not markup</script>',array[current_setting('test.wimage')::uuid]);
 perform public.wall_post_save(id,'My first thought <script>not markup</script>',array[current_setting('test.wimage')::uuid]);
 assert public.wall_page(auth.uid())->>'total'='1','Retry duplicated a post';
 perform public.wall_post_action(id,'pin');
 perform public.wall_profile_save(jsonb_build_object('cover_id',current_setting('test.wcover')));
 for i in 1..24 loop perform public.wall_post_save(gen_random_uuid(),'Entry '||i,'{}');end loop;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wb'),'role','authenticated')::text,true);
do $$declare c jsonb;first_page jsonb;next_page jsonb;cursor jsonb;bad boolean;begin
 c:=public.social_profile(current_setting('test.wa')::uuid);assert c->>'contact_email'='public@example.invalid' and c->>'phone'='','Wrong published contacts';assert not(c ? 'email' or c ? 'stats' or c ? 'marks'),'Private fields in profile card';
 assert exists(select 1 from storage.objects where name=current_setting('test.wpath')),'Published wall photo unavailable cross group';
 assert exists(select 1 from storage.objects where name=current_setting('test.wcoverpath')),'Published cover unavailable cross group';
 first_page:=public.wall_page(current_setting('test.wa')::uuid);assert jsonb_array_length(first_page->'posts')=21,'Wrong first page size';assert first_page->'posts'->0->>'pinned'='true','Pin not first';
 cursor:=first_page->'posts'->19;next_page:=public.wall_page(current_setting('test.wa')::uuid,(cursor->>'created_at')::timestamptz,(cursor->>'id')::uuid);
 assert jsonb_array_length(next_page->'posts')=5,'Pagination loses same-timestamp posts';
 assert not exists(select 1 from jsonb_array_elements(first_page->'posts') with ordinality a(post,n) join jsonb_array_elements(next_page->'posts') b(post) on a.post->>'id'=b.post->>'id' where a.n<=20),'Pagination duplicates posts';
 assert public.wall_post_like(current_setting('test.wpost')::uuid,true)->>'likes'='1','Post like not saved';assert public.wall_post_like(current_setting('test.wpost')::uuid,true)->>'likes'='1','Like duplicated';
 bad:=false;begin perform public.wall_post_action(current_setting('test.wpost')::uuid,'delete');exception when insufficient_privilege then bad:=true;end;assert bad,'Other student can delete post';
 bad:=false;begin perform public.wall_post_save(current_setting('test.wpost')::uuid,'hijacked','{}');exception when insufficient_privilege then bad:=true;end;assert bad,'Other student can edit post';
 bad:=false;begin perform public.wall_post_save(gen_random_uuid(),'stolen photo',array[current_setting('test.wimage')::uuid]);exception when others then bad:=true;end;assert bad,'Another author can attach draft/owned media';
 bad:=false;begin perform public.wall_profile_save(jsonb_build_object('cover_id',current_setting('test.wcover')));exception when others then bad:=true;end;assert bad,'Another author can assign a cover';
 bad:=false;begin perform count(*) from politeshik_private.profile_pages;exception when insufficient_privilege then bad:=true;end;assert bad,'Raw hidden settings table exposed';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wa'),'role','authenticated')::text,true);
select public.wall_post_action(current_setting('test.wpost')::uuid,'delete');
select public.wall_profile_save('{"cover_id":null}');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wb'),'role','authenticated')::text,true);
do $$begin assert not exists(select 1 from storage.objects where name in(current_setting('test.wpath'),current_setting('test.wcoverpath'))),'Removed publication still accessible through Storage RLS';end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wp'),'role','authenticated')::text,true);
do $$declare bad boolean:=false;begin begin perform public.wall_page(current_setting('test.wa')::uuid);exception when insufficient_privilege then bad:=true;end;assert bad,'Parent can access student social wall';end $$;
rollback;
