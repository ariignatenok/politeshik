begin;
select set_config('app.import','on',true);
do $$declare u uuid;kind text;begin
 foreach kind in array array['admin','student']loop
  u:=gen_random_uuid();perform set_config('test.schedule_'||kind,u::text,true);
  insert into auth.users(id,email,aud,role)values(u,u::text||'@example.invalid','authenticated','authenticated');
  insert into public.members(tenant_id,uid,role,status,requested_role,full_name,group_id)values('group_4',u,kind,'approved','student','Integrity tester','g_24290907_2092');
  if kind='admin'then insert into public.admins(uid,tenant_id)values(u,'group_4');end if;
 end loop;
end $$;
select set_config('app.import','',true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.schedule_student'),'role','authenticated')::text,true);
do $$declare bad boolean:=false;begin
 begin perform public.set_secret('admin_pass','Not-a-real-password');exception when insufficient_privilege then bad:=true;end;assert bad,'Student can overwrite staff secret';
 bad:=false;begin insert into public.docs(tenant_id,path,data)values('group_4','group/config','{"subjects":[]}')on conflict(tenant_id,path)do update set data=excluded.data;exception when others then bad:=true;end;assert bad,'Student can publish group timetable';
 bad:=false;begin perform 1 from politeshik_private.schedule_write_audit;exception when insufficient_privilege then bad:=true;end;assert bad,'Private audit accessible';
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.schedule_admin'),'role','authenticated')::text,true);
do $$declare bad boolean:=false;begin
 insert into public.docs(tenant_id,path,data)values('group_4','group/config','{"subjects":[{"id":"s_test","name":"ОПБД"}],"schedule":[],"weeks":{}}')on conflict(tenant_id,path)do update set data=excluded.data;
 begin update public.docs set data='{"subjects":[{"id":"x","name":"МДК практическими пытками"}]}'where tenant_id='group_4'and path='group/config';exception when sqlstate'22023'then bad:=true;end;assert bad,'Unsafe academic text accepted';
 bad:=false;begin perform public.set_secret('admin_pass','Not-a-real-password');exception when insufficient_privilege then bad:=true;end;assert bad,'Group admin can overwrite super-admin secret';
 bad:=false;begin insert into public.docs(tenant_id,path,data)values('group_6','group/config','{"subjects":[]}')on conflict(tenant_id,path)do update set data=excluded.data;exception when others then bad:=true;end;assert bad,'Foreign group write accepted';
end $$;
reset role;
do $$begin
 assert exists(select 1 from politeshik_private.schedule_write_audit where actor=current_setting('test.schedule_admin')::uuid and tenant_id='group_4'and path='group/config'and after_data->'subjects'@>'[{"id":"s_test","name":"ОПБД"}]'),'No actor-traceable audit';
 assert not exists(select 1 from politeshik_private.schedule_write_audit where actor=current_setting('test.schedule_admin')::uuid and after_data::text like'%пытками%'),'Rejected change entered the accepted-change audit';
end $$;
rollback;
