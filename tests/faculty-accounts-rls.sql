begin;
select set_config('test.faculty',gen_random_uuid()::text,true),set_config('test.duplicate',gen_random_uuid()::text,true),set_config('test.rejected',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,aud,role,raw_user_meta_data) select current_setting(k)::uuid,'faculty-'||current_setting(k)||'@example.invalid',now(),'authenticated','authenticated','{"role":"admin","teacher_name":"Назаров Сергей Юрьевич"}' from unnest(array['test.faculty','test.duplicate','test.rejected']) k;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.faculty'),'role','authenticated')::text,true),set_config('request.headers','{}',true);
do $$declare denied boolean:=false;ctx jsonb;begin
 assert public.faculty_request('Назаров Сергей Юрьевич');
 assert public.faculty_request('Назаров Сергей Юрьевич'),'Request is not idempotent';
 ctx:=public.faculty_context();assert ctx->>'status'='pending';assert not coalesce((ctx->>'active')::boolean,false),'Pending identity received access';
 assert not exists(select 1 from public.teachers where uid=auth.uid()),'Self-signup granted teacher role';
 begin perform public.faculty_decide(auth.uid(),true);exception when insufficient_privilege then denied:=true;end;assert denied,'Applicant approved own role';denied:=false;
 begin perform public.faculty_requests();exception when insufficient_privilege then denied:=true;end;assert denied,'Applicant saw other emails';denied:=false;
 begin perform public.faculty_group_view('group_6','2026-11');exception when insufficient_privilege then denied:=true;end;assert denied,'Pending teacher read students';denied:=false;
 begin perform * from politeshik_private.faculty_claims;exception when insufficient_privilege then denied:=true;end;assert denied,'Raw claims exposed';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.duplicate'),'role','authenticated')::text,true);
select public.faculty_request('Назаров Сергей Юрьевич');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.rejected'),'role','authenticated')::text,true);
select public.faculty_request('Назаров Денис Александрович');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000032","role":"authenticated"}',true);
select public.faculty_decide(current_setting('test.faculty')::uuid,true);
select public.faculty_decide(current_setting('test.rejected')::uuid,false);
do $$declare denied boolean:=false;begin
 begin perform public.faculty_decide(current_setting('test.duplicate')::uuid,true);exception when raise_exception then denied:=true;end;assert denied,'Duplicate identity approved';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.faculty'),'role','authenticated')::text,true);
do $$declare ctx jsonb;bundle jsonb;denied boolean:=false;begin
 ctx:=public.faculty_context();assert ctx->>'status'='approved' and ctx->>'active'='true';assert ctx->>'name'='Назаров Сергей Юрьевич';
 assert exists(select 1 from jsonb_array_elements(ctx->'groups') g where g->>'tenant_id'='group_6'),'Teaching scope missing';
 assert not exists(select 1 from jsonb_array_elements(ctx->'groups') g where g->>'tenant_id'='group_4'),'Namesakes were merged';
 bundle:=public.faculty_group_view('group_6','2026-11');assert jsonb_array_length(bundle->'students')=26;assert bundle->>'read_only'='true';
 begin perform public.faculty_group_view('group_4','2026-11');exception when insufficient_privilege then denied:=true;end;assert denied,'Foreign group readable';denied:=false;
 begin perform public.select_group('group_4');exception when insufficient_privilege or raise_exception then denied:=true;end;assert denied,'Teacher switched global tenant';
 begin perform public.teacher_students();exception when insufficient_privilege or raise_exception then denied:=true;end;assert denied,'Legacy student RPC bypasses scopes';denied:=false;
 begin perform public.teacher_certs();exception when insufficient_privilege or raise_exception then denied:=true;end;assert denied,'Legacy certificate RPC bypasses scopes';
 assert not public.is_admin(),'Teacher got admin rights';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.rejected'),'role','authenticated')::text,true);
do $$declare denied boolean:=false;begin
 begin perform public.faculty_request('Назаров Денис Александрович');exception when insufficient_privilege then denied:=true;end;assert denied,'Rejected user reactivated via signup';assert public.faculty_context()->>'status'='rejected';
end $$;
reset role;
update public.members set status='banned' where uid=current_setting('test.faculty')::uuid;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.faculty'),'role','authenticated')::text,true);
do $$declare denied boolean:=false;begin
 assert public.faculty_context()->>'status'='banned';
 begin perform public.faculty_group_view('group_6','2026-11');exception when insufficient_privilege then denied:=true;end;assert denied,'Banned teacher still reads projection';
end $$;
reset role;
rollback;
