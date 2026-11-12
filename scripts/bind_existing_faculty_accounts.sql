-- Explicit user instruction: Sergey is Vasilyev; remove the unidentified Darya teacher role.
-- No Auth accounts, personal files or passwords are deleted or changed.
begin;
do $$declare vasilyev uuid;darya uuid;faculty text;hits integer;begin
 select count(*),(array_agg(t.uid))[1] into hits,vasilyev from public.teachers t join public.members m on m.uid=t.uid and m.tenant_id=t.tenant_id
 join public.docs d on d.tenant_id=t.tenant_id and d.path='profiles/'||t.uid::text
 where m.role='teacher' and m.status='approved' and d.data->>'name'='Sergey' and coalesce(d.data->>'rid','')='';
 if hits<>1 then raise exception 'Expected exactly one existing Sergey teacher account';end if;
 if not exists(select 1 from auth.users where id=vasilyev and email_confirmed_at is not null) then raise exception 'Sergey account has no verified Auth email';end if;
 select id into faculty from politeshik_private.faculty_directory where name='Васильев Сергей Юрьевич';
 if faculty is null then raise exception 'Faculty identity is missing';end if;
 if exists(select 1 from politeshik_private.faculty_claims where (faculty_id=faculty and uid<>vasilyev and status='approved') or (uid=vasilyev and faculty_id<>faculty)) then raise exception 'Faculty binding conflict';end if;
 select count(*),(array_agg(t.uid))[1] into hits,darya from public.teachers t join public.members m on m.uid=t.uid and m.tenant_id=t.tenant_id
 join public.docs d on d.tenant_id=t.tenant_id and d.path='profiles/'||t.uid::text
 where m.role='teacher' and m.status='approved' and d.data->>'name'='Дарья Александровна' and coalesce(d.data->>'rid','')='';
 if hits<>1 then raise exception 'Expected exactly one unidentified Darya teacher account';end if;
 update public.members set full_name='Васильев Сергей Юрьевич',requested_role='teacher' where uid=vasilyev;
 update public.docs set data=data||jsonb_build_object('name','Васильев Сергей Юрьевич','role','teacher') where path='profiles/'||vasilyev::text;
 insert into politeshik_private.faculty_claims(uid,faculty_id,status,decided_at) values(vasilyev,faculty,'approved',now())
 on conflict(uid) do update set status='approved',decided_at=now();
 delete from public.teachers where uid=darya;
 update public.members set role='student',status='pending',requested_role='student',decided_at=now() where uid=darya;
 update public.docs set data=data||jsonb_build_object('role','student') where path='profiles/'||darya::text;
end $$;
commit;
