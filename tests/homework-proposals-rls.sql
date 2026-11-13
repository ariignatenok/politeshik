begin;
select set_config('app.import','on',true);
select set_config('test.hp_student',gen_random_uuid()::text,true),set_config('test.hp_other',gen_random_uuid()::text,true),set_config('test.hp_admin',gen_random_uuid()::text,true),set_config('test.hp_foreign',gen_random_uuid()::text,true),set_config('test.hp_proposal',gen_random_uuid()::text,true),set_config('test.hp_reject',gen_random_uuid()::text,true);
do $$declare k text;u uuid;begin foreach k in array array['student','other','admin','foreign']loop u:=current_setting('test.hp_'||k)::uuid;insert into auth.users(id,email,email_confirmed_at,aud,role)values(u,'homework-'||u||'@example.invalid',now(),'authenticated','authenticated');end loop;end $$;
insert into public.members(tenant_id,uid,role,status,requested_role,group_id,full_name) values
('group_2',current_setting('test.hp_student')::uuid,'student','approved','student','g_26290911_3111','Proposal author'),
('group_2',current_setting('test.hp_other')::uuid,'student','approved','student','g_26290911_3111','Another student'),
('group_2',current_setting('test.hp_admin')::uuid,'admin','approved','student','g_26290911_3111','Group leader'),
('group_3',current_setting('test.hp_foreign')::uuid,'admin','approved','student','g_23290907_2092','Foreign leader');
insert into public.admins(uid,tenant_id)values(current_setting('test.hp_admin')::uuid,'group_2'),(current_setting('test.hp_foreign')::uuid,'group_3');
insert into public.docs(tenant_id,path,data)values('group_2','group/extra','{"subjects":[{"id":"hp_subject","name":"Test subject"}],"teachers":[],"homework":[{"id":"existing","text":"Keep existing","subjectId":"hp_subject"}],"notes":[{"id":"keep-note"}],"cards":[]}')on conflict(tenant_id,path)do update set data=excluded.data;
select set_config('app.import','',true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.hp_student'),'role','authenticated')::text,true),set_config('request.headers','{}',true);
do $$declare id uuid;denied boolean:=false;begin
 id:=public.homework_proposal_submit(current_setting('test.hp_proposal')::uuid,'hp_subject','Test subject','Student homework',null);
 assert public.homework_proposal_submit(id,'hp_subject','Test subject','Student homework',null)=id,'Retry failed';
 assert jsonb_array_length(public.homework_proposal_list())=1,'Duplicate proposal on retry';
 assert public.homework_proposal_list()->0->>'status'='pending','Student proposal published without approval';
 begin perform public.homework_proposal_decide(id,true);exception when insufficient_privilege then denied:=true;end;assert denied,'Student approved own homework';
 perform public.homework_proposal_submit(current_setting('test.hp_reject')::uuid,'hp_subject','Test subject','Reject this',null);
end $$;
reset role;
do $$begin assert not exists(select 1 from public.docs d cross join lateral jsonb_array_elements(d.data->'homework')h where d.tenant_id='group_2' and d.path='group/extra' and h->>'text'='Student homework'),'Pending proposal is public';end $$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.hp_other'),'role','authenticated')::text,true);
do $$begin assert public.homework_proposal_list()='[]'::jsonb,'Student saw another student pending proposal';end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.hp_foreign'),'role','authenticated')::text,true);
do $$declare denied boolean:=false;begin assert public.homework_proposal_list()='[]'::jsonb,'Foreign leader saw proposals';begin perform public.homework_proposal_decide(current_setting('test.hp_proposal')::uuid,true);exception when insufficient_privilege then denied:=true;end;assert denied,'Foreign leader approved homework';end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.hp_admin'),'role','authenticated')::text,true);
do $$begin
 assert jsonb_array_length(public.homework_proposal_list())=2,'Leader missing proposals';
 assert public.homework_proposal_decide(current_setting('test.hp_proposal')::uuid,true)->>'status'='approved','Approve failed';
 assert public.homework_proposal_decide(current_setting('test.hp_proposal')::uuid,true)->>'status'='approved','Approval retry failed';
 assert public.homework_proposal_decide(current_setting('test.hp_reject')::uuid,false)->>'status'='rejected','Reject failed';
end $$;
reset role;
do $$declare extra jsonb;n integer;begin
 select data into extra from public.docs where tenant_id='group_2' and path='group/extra';
 assert jsonb_array_length(extra->'homework')=2,'Approval duplicated homework or erased old task';assert extra->'notes'->0->>'id'='keep-note','Approval erased notes';
 select count(*) into n from jsonb_array_elements(extra->'homework')h where h->>'text'='Reject this';assert n=0,'Rejected homework published';
end $$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.hp_student'),'role','authenticated')::text,true);
do $$declare denied boolean:=false;begin
 assert exists(select 1 from jsonb_array_elements(public.homework_proposal_list())p where p->>'status'='approved'),'Student cannot see decision';
 begin perform 1 from politeshik_private.homework_proposals;exception when insufficient_privilege then denied:=true;end;assert denied,'Direct pending table access allowed';
end $$;
reset role;
rollback;
