-- Owner-managed reservation for a teacher re-registering after an account release.
-- This value stays private; approval remains exclusively with the superadmin.
alter table politeshik_private.faculty_directory add column registration_email text
 check(registration_email is null or registration_email=lower(btrim(registration_email)) and registration_email like '%@%');
create unique index faculty_reserved_registration_email on politeshik_private.faculty_directory(registration_email)where registration_email is not null;
DO $migration$declare definition text;begin
 select pg_get_functiondef('politeshik_private.faculty_request(text)'::regprocedure)into definition;
 if position($needle$if identity is null then raise exception 'Выберите полное ФИО из списка преподавателей';end if;$needle$ in definition)=0 then raise exception 'Unexpected faculty request';end if;
 execute replace(definition,$needle$if identity is null then raise exception 'Выберите полное ФИО из списка преподавателей';end if;$needle$,
 $replacement$if identity is null then raise exception 'Выберите полное ФИО из списка преподавателей';end if;
 if exists(select 1 from politeshik_private.faculty_directory d join auth.users u on u.id=actor
  where(d.id=identity and d.registration_email is not null and d.registration_email<>lower(u.email))
   or(d.registration_email=lower(u.email)and d.id<>identity))then
  raise exception 'ФИО и почта не соответствуют закреплённой учётной записи. Обратитесь к Админу Арине'using errcode='42501';end if;$replacement$);
 select pg_get_functiondef('politeshik_private.faculty_decide(uuid,boolean)'::regprocedure)into definition;
 if position($needle$if mail is null then raise exception 'У аккаунта нет подтверждённой почты';end if;$needle$ in definition)=0 then raise exception 'Unexpected faculty approval';end if;
 execute replace(definition,$needle$if mail is null then raise exception 'У аккаунта нет подтверждённой почты';end if;$needle$,
 $replacement$if mail is null then raise exception 'У аккаунта нет подтверждённой почты';end if;
 if exists(select 1 from politeshik_private.faculty_directory d
 where(d.id=identity.id and d.registration_email is not null and d.registration_email<>lower(mail))
 or(d.registration_email=lower(mail)and d.id<>identity.id))then raise exception 'Почта не соответствует закреплённому ФИО'using errcode='42501';end if;$replacement$);
end $migration$;
