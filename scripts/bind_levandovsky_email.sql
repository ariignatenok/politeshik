-- User-approved email for the reserved leader of 25290907/1091.
-- Auth signup remains self-service; verified email is checked by register_group6_student.
-- No existing membership, password, credential, or superadmin permission is modified.
begin;
do $$begin
 assert exists(select 1 from public.roster where tenant_id='group_6' and rid='g6_r10' and name='Левандовский Владимир Витальевич'),'Unexpected leader roster';
 insert into politeshik_private.staff_identities(tenant_id,rid,role,email)
 values('group_6','g6_r10','admin','levandovskiv0@gmail.com')
 on conflict(tenant_id,rid) do nothing;
 assert exists(select 1 from politeshik_private.staff_identities where tenant_id='group_6' and rid='g6_r10' and role='admin' and email='levandovskiv0@gmail.com'),'Conflicting leader binding';
end $$;
commit;
