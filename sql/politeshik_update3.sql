-- =====================================================================================
--  ПОЛИТЕШИК: карта колледжа («Я здесь»), готовое ДЗ, записки на отдельные пары. Дополнение к уже выполненному скрипту.
--  Supabase -> SQL Editor -> New query -> вставить ВСЁ -> Run. Пароли вписывать не нужно. Можно запускать повторно.
--  (Тот же текст уже включён в основной файл politeshik.sql.)
-- =====================================================================================
-- Документы map/<uid> (точка на карте) и solutions/<uid> (готовое ДЗ) видит вся группа, пишет только владелец.
create or replace function public.doc_owner(p text) returns text
language sql immutable as $$
  select case
    when p like 'data/users/%' then split_part(p, '/', 3)
    when split_part(p, '/', 1) in ('profiles', 'attendance', 'certs', 'chat', 'map', 'solutions') then split_part(p, '/', 2)
    else null end
$$;

drop policy if exists docs_select on public.docs;
create policy docs_select on public.docs for select using (
  auth.uid() is not null and tenant_id = (select public.current_tenant()) and (
    split_part(path, '/', 1) in ('group', 'claims')
    or (split_part(path, '/', 1) in ('map', 'solutions') and not public.is_teacher())
    or public.doc_owner(path) = auth.uid()::text
    or public.is_admin()));

-- Проверка на сервере: точка на карте (этаж 1-5, координаты 0-100) и список решений.
create or replace function public.docs_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text; v jsonb; om jsonb := '{}'::jsonb; nm jsonb; prev jsonb;
        today text := to_char((now() at time zone 'Europe/Moscow')::date, 'YYYY-MM-DD');
begin
  if public.is_admin() then return new; end if;
  select d.data into prev from public.docs d where d.tenant_id = new.tenant_id and d.path = new.path;
  if pg_column_size(new.data) > 900000 then raise exception 'Документ слишком большой'; end if;
  if split_part(new.path, '/', 1) = 'attendance' then
    om := coalesce(prev -> 'marks', '{}'::jsonb);
    nm := coalesce(new.data -> 'marks', '{}'::jsonb);
    for k in select jsonb_object_keys(om) loop
      if nm -> k is distinct from om -> k then raise exception 'Отметку нельзя менять или удалять: это может только админ'; end if;
    end loop;
    for k, v in select key, value from jsonb_each(nm) loop
      if not (om ? k) and (left(k, 10) <> today or (v #>> '{}') not in ('п', 'о', 'н')) then
        raise exception 'Отметиться можно только в день пары';
      end if;
    end loop;
  end if;
  if split_part(new.path, '/', 1) = 'certs' and array_length(string_to_array(new.path, '/'), 1) = 2 then
    for v in select e.value from jsonb_array_elements(coalesce(new.data -> 'items', '[]'::jsonb)) e loop
      if coalesce((v ->> 'confirmed')::boolean, false) then
        if not exists (
          select 1 from jsonb_array_elements(coalesce(prev -> 'items', '[]'::jsonb)) o
          where o.value ->> 'id' = v ->> 'id' and coalesce((o.value ->> 'confirmed')::boolean, false)
        ) then
          raise exception 'Подтвердить справку может только админ';
        end if;
      end if;
    end loop;
  end if;
  if split_part(new.path, '/', 1) = 'map' then
    if array_length(string_to_array(new.path, '/'), 1) <> 2
       or coalesce((new.data ->> 'floor')::int, 0) not between 1 and 5
       or coalesce((new.data ->> 'x')::numeric, -1) not between 0 and 100
       or coalesce((new.data ->> 'y')::numeric, -1) not between 0 and 100
       or char_length(coalesce(new.data ->> 'name', '')) > 40 then
      raise exception 'Неверная точка на карте';
    end if;
  end if;
  if split_part(new.path, '/', 1) = 'solutions' and array_length(string_to_array(new.path, '/'), 1) = 2 then
    if jsonb_typeof(new.data -> 'items') is distinct from 'array' or jsonb_array_length(new.data -> 'items') > 200 then
      raise exception 'Неверный список решений';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_docs_guard on public.docs;
create trigger trg_docs_guard before insert or update on public.docs for each row execute function public.docs_guard();

-- Для журнала преподавателя: к справкам добавлены номера пар (записка на отдельные пары).
drop function if exists public.teacher_certs();
create function public.teacher_certs() returns table (uid text, date_from text, date_to text, confirmed boolean, pairs jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_teacher() or public.is_admin()) then raise exception 'Только для преподавателя'; end if;
  return query
    select split_part(d.path, '/', 2), i.value ->> 'from', i.value ->> 'to', coalesce((i.value ->> 'confirmed')::boolean, false), i.value -> 'pairs'
    from public.docs d, jsonb_array_elements(coalesce(d.data -> 'items', '[]'::jsonb)) i
    where d.tenant_id = public.current_tenant() and d.path ~ '^certs/[^/]+$';
end $$;
revoke all on function public.teacher_certs() from public, anon;
grant execute on function public.teacher_certs() to authenticated;

notify pgrst, 'reload schema';
