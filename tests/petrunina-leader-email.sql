begin;
do $$declare u uuid:=gen_random_uuid();w uuid:=gen_random_uuid();begin
 perform set_config('test.petrunina',u::text,true);perform set_config('test.wrong_leader',w::text,true);
 perform set_config('test.group5_code',(select code from public.group_codes where tenant_id='group_5'and active limit 1),true);
 insert into auth.users(id,email,email_confirmed_at,aud,role)values(u,'petrunina.2002@list.ru',now(),'authenticated','authenticated'),(w,w||'@example.invalid',now(),'authenticated','authenticated');
end $$;
set local role authenticated;
do $$declare denied boolean:=false;result jsonb;begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.wrong_leader'),'role','authenticated')::text,true);
 begin perform public.register_student('group_5',current_setting('test.group5_code'),'g5_r12','1','');exception when others then denied:=true;end;assert denied,'Wrong email claimed leader';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.petrunina'),'role','authenticated')::text,true);
 result:=public.register_student('group_5',current_setting('test.group5_code'),'g5_r12','1','');
 assert result->>'role'='admin'and result->>'status'='approved'and result->>'tenant_id'='group_5','Leader email not activated';
 assert public.is_admin(),'Registered leader has no admin rights';
 assert public.leader_chat_state()->>'allowed'='true','New leader missing from council';
end $$;
reset role;
rollback;
