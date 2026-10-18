-- =====================================================================================
--  ПОЛИТЕШИК: доступ, пароли админа и преподавателя, несколько групп/колледжей (tenant_id).
--  ОДИН запуск: Supabase -> SQL Editor -> New query -> вставить ВСЁ -> Run
--  (на окно «Potential issue» нажмите Run query). Скрипт можно запускать повторно.
--  Если на любом шаге будет ошибка, ничего не применится.
--
--  ЧТО НУЖНО ВПИСАТЬ (одна строка ниже):
--    ПРИДУМАЙТЕ_ПАРОЛЬ_ПРЕПОДАВАТЕЛЯ  замените на пароль для преподавателей (минимум 8 символов).
--    Второе значение ('') оставьте пустым, если пароль админа менять не нужно: он уже сохранён.
--    Если хотите сменить пароль админа, впишите новый между кавычками. Пароли должны различаться.
--  Пароли хранятся только в виде хеша (bcrypt с солью) в таблице settings, закрытой для сайта.
-- =====================================================================================
drop table if exists _inputs;
create temp table _inputs as select 'ПРИДУМАЙТЕ_ПАРОЛЬ_ПРЕПОДАВАТЕЛЯ'::text as teacher_pass, ''::text as admin_pass_new;

do $$ begin
  if length(coalesce((select teacher_pass from _inputs), '')) < 8 or (select teacher_pass from _inputs) = 'ПРИДУМАЙТЕ_ПАРОЛЬ_ПРЕПОДАВАТЕЛЯ' then
    raise exception 'Пароль преподавателя не заменён или короче 8 символов: впишите его вместо ПРИДУМАЙТЕ_ПАРОЛЬ_ПРЕПОДАВАТЕЛЯ и запустите снова';
  end if;
end $$;

create extension if not exists pgcrypto;

-- 1. Арендаторы (группы, колледжи). Сейчас в системе один: group_1.
--    Номер арендатора берётся из app_metadata.tenant_id в токене; его выдаёт только сервер, пользователь изменить не может.
create or replace function public.current_tenant() returns text
language sql stable as $$
  select coalesce(nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', ''), 'group_1')
$$;
create table if not exists public.tenants (id text primary key, name text not null, created_at timestamptz not null default now());
insert into public.tenants (id, name) values ('group_1', 'Группа 25290909/3091') on conflict (id) do nothing;
alter table public.tenants enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'tenants' loop execute format('drop policy %I on public.tenants', r.policyname); end loop;
end $$;
create policy tenants_own on public.tenants for select using (id = (select public.current_tenant()));
revoke all on public.tenants from anon, authenticated;
grant select on public.tenants to authenticated;

-- 2. Таблицы. Везде есть tenant_id (для существующих данных это group_1).
create table if not exists public.docs (path text primary key, data jsonb not null default '{}'::jsonb, updated timestamptz default now());
alter table public.docs add column if not exists updated timestamptz default now();

create table if not exists public.admins (uid uuid primary key references auth.users (id) on delete cascade);
create table if not exists public.teachers (uid uuid primary key references auth.users (id) on delete cascade);
create table if not exists public.settings (key text not null, value text not null);
create table if not exists public.admin_attempts (id bigserial primary key, uid uuid, at timestamptz default now(), ok boolean);
alter table public.admin_attempts add column if not exists kind text not null default 'admin';

create table if not exists public.chat (
  id              bigserial primary key,
  thread_uid      uuid not null references auth.users (id) on delete cascade,
  sender          uuid references auth.users (id),
  kind            text not null default 'text',
  body            text not null default '' check (char_length(body) <= 4000),
  file_path       text,
  file_name       text,
  file_size       int check (file_size is null or file_size <= 20 * 1024 * 1024),
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  read_by_admin   boolean not null default false,
  read_by_student boolean not null default false
);
create table if not exists public.news (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) between 1 and 200),
  body       text not null check (char_length(body) between 1 and 10000),
  news_date  date not null default (now() at time zone 'Europe/Moscow')::date,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.news_comments (
  id              uuid primary key default gen_random_uuid(),
  news_id         uuid not null references public.news (id) on delete cascade,
  author          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name     text not null default '',
  author_is_admin boolean not null default false,
  body            text not null check (char_length(body) between 1 and 1000),
  created_at      timestamptz not null default now()
);

-- перенос прежнего пароля админа из admin_secret в settings (если он там был)
do $$ begin
  if to_regclass('public.admin_secret') is not null then
    execute $q$ insert into public.settings (key, value) select 'admin_pass', hash from public.admin_secret where id = 1
                on conflict do nothing $q$;
  end if;
exception when others then null;
end $$;

-- tenant_id во все таблицы схемы public (значение по умолчанию group_1)
do $$ declare r record; begin
  for r in select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> 'tenants' loop
    execute format('alter table public.%I add column if not exists tenant_id text not null default %L', r.table_name, 'group_1');
  end loop;
end $$;

-- ключи: docs и settings уникальны в пределах арендатора
do $$ declare pk text; begin
  select c.conname into pk from pg_constraint c where c.conrelid = 'public.docs'::regclass and c.contype = 'p';
  if pk is not null and (select array_length(c.conkey, 1) from pg_constraint c where c.conname = pk and c.conrelid = 'public.docs'::regclass) = 1 then
    execute format('alter table public.docs drop constraint %I', pk);
    alter table public.docs add primary key (tenant_id, path);
  end if;
  select c.conname into pk from pg_constraint c where c.conrelid = 'public.settings'::regclass and c.contype = 'p';
  if pk is null then alter table public.settings add primary key (tenant_id, key); end if;
end $$;
create index if not exists chat_tenant_thread_idx on public.chat (tenant_id, thread_uid, created_at);
create index if not exists news_tenant_idx on public.news (tenant_id, news_date desc);
create index if not exists news_comments_idx on public.news_comments (news_id, created_at);

-- клиент не может выбрать чужой арендатор: сервер подставляет его сам
create or replace function public.set_tenant() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then new.tenant_id := old.tenant_id;
  elsif auth.uid() is not null then new.tenant_id := public.current_tenant();
  end if;
  return new;
end $$;
drop trigger if exists trg_a_tenant_docs on public.docs;
create trigger trg_a_tenant_docs before insert or update on public.docs for each row execute function public.set_tenant();
drop trigger if exists trg_a_tenant_chat on public.chat;
create trigger trg_a_tenant_chat before insert or update on public.chat for each row execute function public.set_tenant();
drop trigger if exists trg_a_tenant_news on public.news;
create trigger trg_a_tenant_news before insert or update on public.news for each row execute function public.set_tenant();
drop trigger if exists trg_a_tenant_comments on public.news_comments;
create trigger trg_a_tenant_comments before insert or update on public.news_comments for each row execute function public.set_tenant();

-- 3. Роли и пароли. В settings лежат только хеши; таблица закрыта для сайта полностью.
alter table public.admins enable row level security;
alter table public.teachers enable row level security;
alter table public.settings enable row level security;
alter table public.admin_attempts enable row level security;
do $$ declare r record; begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('admins', 'teachers', 'settings', 'admin_attempts') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;
create policy admins_self on public.admins for select using (uid = auth.uid());
create policy teachers_self on public.teachers for select using (uid = auth.uid());
revoke all on public.admins, public.teachers, public.settings, public.admin_attempts from anon, authenticated;
grant select on public.admins, public.teachers to authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.uid = auth.uid() and a.tenant_id = public.current_tenant())
$$;
create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teachers t where t.uid = auth.uid() and t.tenant_id = public.current_tenant())
$$;
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then 'admin' when public.is_teacher() then 'teacher' else 'student' end
$$;
revoke all on function public.is_admin(), public.is_teacher(), public.my_role() from public, anon;
grant execute on function public.is_admin(), public.is_teacher(), public.my_role() to authenticated;

-- задать пароль (вызывается только отсюда, из SQL Editor; с сайта недоступно)
create or replace function public.set_secret(p_key text, p_secret text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare t text := public.current_tenant(); other text := case when p_key = 'admin_pass' then 'teacher_pass' else 'admin_pass' end; oh text;
begin
  if length(coalesce(p_secret, '')) < 8 or p_secret like 'ПРИДУМАЙТЕ%' then raise exception 'Пароль слишком короткий (минимум 8 символов)'; end if;
  select s.value into oh from public.settings s where s.tenant_id = t and s.key = other;
  if oh is not null and oh = crypt(p_secret, oh) then raise exception 'Пароли админа и преподавателя должны различаться'; end if;
  insert into public.settings (tenant_id, key, value) values (t, p_key, crypt(p_secret, gen_salt('bf', 10)))
    on conflict (tenant_id, key) do update set value = excluded.value, updated = now();
  delete from public.admin_attempts where tenant_id = t;
end $$;
alter table public.settings add column if not exists updated timestamptz not null default now();
create or replace function public.set_admin_secret(p_secret text) returns text
language plpgsql security definer set search_path = public as $$ begin perform public.set_secret('admin_pass', p_secret); return 'Пароль админа сохранён'; end $$;
create or replace function public.set_teacher_secret(p_secret text) returns text
language plpgsql security definer set search_path = public as $$ begin perform public.set_secret('teacher_pass', p_secret); return 'Пароль преподавателя сохранён'; end $$;
revoke all on function public.set_secret(text, text), public.set_admin_secret(text), public.set_teacher_secret(text) from public, anon, authenticated;

-- проверка пароля на сервере: 5 неверных попыток подряд, и пауза 15 минут
create or replace function public.check_secret(p_key text, p_secret text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare t text := public.current_tenant(); h text; f_user int; f_all int; k text := case when p_key = 'admin_pass' then 'admin' else 'teacher' end;
begin
  if auth.uid() is null then raise exception 'Нужно войти в аккаунт'; end if;
  select s.value into h from public.settings s where s.tenant_id = t and s.key = p_key;
  if h is null then raise exception '%', case when k = 'admin' then 'Секретный пароль ещё не задан' else 'Пароль преподавателя ещё не задан' end; end if;
  select count(*) into f_user from public.admin_attempts a where a.uid = auth.uid() and not a.ok and a.at > now() - interval '15 minutes';
  select count(*) into f_all from public.admin_attempts a where a.tenant_id = t and not a.ok and a.at > now() - interval '15 minutes';
  if f_user >= 5 or f_all >= 60 then raise exception 'Слишком много попыток. Подождите 15 минут'; end if;
  if h = crypt(coalesce(p_secret, ''), h) then
    insert into public.admin_attempts (uid, ok, kind, tenant_id) values (auth.uid(), true, k, t);
    return true;
  end if;
  insert into public.admin_attempts (uid, ok, kind, tenant_id) values (auth.uid(), false, k, t);
  return false;
end $$;
revoke all on function public.check_secret(text, text) from public, anon, authenticated;

create or replace function public.become_admin(p_secret text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Нужно войти в аккаунт'; end if;
  if public.is_admin() then return true; end if;
  if public.is_teacher() then raise exception 'Этот аккаунт зарегистрирован как преподаватель'; end if;
  if not public.check_secret('admin_pass', p_secret) then return false; end if;
  insert into public.admins (uid, tenant_id) values (auth.uid(), public.current_tenant()) on conflict (uid) do nothing;
  return true;
end $$;
create or replace function public.become_teacher(p_secret text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Нужно войти в аккаунт'; end if;
  if public.is_teacher() then return true; end if;
  if public.is_admin() then raise exception 'Этот аккаунт уже админ'; end if;
  if not public.check_secret('teacher_pass', p_secret) then return false; end if;
  insert into public.teachers (uid, tenant_id) values (auth.uid(), public.current_tenant()) on conflict (uid) do nothing;
  return true;
end $$;
create or replace function public.admin_secret_is_set() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.settings s where s.tenant_id = public.current_tenant() and s.key = 'admin_pass')
$$;
create or replace function public.teacher_secret_is_set() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.settings s where s.tenant_id = public.current_tenant() and s.key = 'teacher_pass')
$$;
revoke all on function public.become_admin(text), public.become_teacher(text), public.admin_secret_is_set(), public.teacher_secret_is_set() from public, anon;
grant execute on function public.become_admin(text), public.become_teacher(text), public.admin_secret_is_set(), public.teacher_secret_is_set() to authenticated;

-- 4. Чей это документ: profiles/<uid>, attendance/<uid>, certs/<uid>[/...], chat/<uid>, data/users/<uid>/...
create or replace function public.doc_owner(p text) returns text
language sql immutable as $$
  select case
    when p like 'data/users/%' then split_part(p, '/', 3)
    when split_part(p, '/', 1) in ('profiles', 'attendance', 'certs', 'chat') then split_part(p, '/', 2)
    else null end
$$;

-- 5. Правила доступа к docs (только свой арендатор)
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'docs' loop
    execute format('drop policy %I on public.docs', r.policyname);
  end loop;
end $$;
alter table public.docs enable row level security;
grant select, insert, update, delete on public.docs to authenticated;
revoke all on public.docs from anon;

create policy docs_select on public.docs for select using (
  auth.uid() is not null and tenant_id = (select public.current_tenant()) and (
    split_part(path, '/', 1) in ('group', 'claims')
    or public.doc_owner(path) = auth.uid()::text
    or public.is_admin()));
-- преподаватель читает только отметки посещаемости (для журнала); справки, чаты и профили ему не видны
create policy docs_teacher_read on public.docs for select using (
  tenant_id = (select public.current_tenant()) and public.is_teacher() and path ~ '^attendance/[^/]+$');
create policy docs_admin_all on public.docs for all
  using (tenant_id = (select public.current_tenant()) and public.is_admin())
  with check (tenant_id = (select public.current_tenant()) and public.is_admin());
create policy docs_own_insert on public.docs for insert with check (tenant_id = (select public.current_tenant()) and public.doc_owner(path) = auth.uid()::text);
create policy docs_own_update on public.docs for update
  using (tenant_id = (select public.current_tenant()) and public.doc_owner(path) = auth.uid()::text)
  with check (tenant_id = (select public.current_tenant()) and public.doc_owner(path) = auth.uid()::text);
create policy docs_own_delete on public.docs for delete using (tenant_id = (select public.current_tenant()) and public.doc_owner(path) = auth.uid()::text);
create policy docs_claim_insert on public.docs for insert with check (
  tenant_id = (select public.current_tenant()) and path ~ '^claims/r([1-9]|[12][0-9]|3[01])$' and (data ->> 'uid') = auth.uid()::text);

-- 6. Серверная проверка: отметки только за сегодня и без правок задним числом; справку подтверждает только админ
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
  return new;
end $$;
drop trigger if exists trg_docs_guard on public.docs;
create trigger trg_docs_guard before insert or update on public.docs for each row execute function public.docs_guard();

-- 7. Данные для журнала преподавателя: только нужные поля (без комментариев к справкам и без фото)
create or replace function public.teacher_students() returns table (uid text, name text, rid text, subgroup text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_teacher() or public.is_admin()) then raise exception 'Только для преподавателя'; end if;
  return query
    select split_part(d.path, '/', 2), d.data ->> 'name', d.data ->> 'rid', d.data ->> 'subgroup'
    from public.docs d
    where d.tenant_id = public.current_tenant() and d.path ~ '^profiles/[^/]+$' and coalesce(d.data ->> 'rid', '') <> ''
      and not exists (select 1 from public.teachers t where t.uid::text = split_part(d.path, '/', 2));
end $$;
create or replace function public.teacher_certs() returns table (uid text, date_from text, date_to text, confirmed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_teacher() or public.is_admin()) then raise exception 'Только для преподавателя'; end if;
  return query
    select split_part(d.path, '/', 2), i.value ->> 'from', i.value ->> 'to', coalesce((i.value ->> 'confirmed')::boolean, false)
    from public.docs d, jsonb_array_elements(coalesce(d.data -> 'items', '[]'::jsonb)) i
    where d.tenant_id = public.current_tenant() and d.path ~ '^certs/[^/]+$';
end $$;
revoke all on function public.teacher_students(), public.teacher_certs() from public, anon;
grant execute on function public.teacher_students(), public.teacher_certs() to authenticated;

-- 8. Чистка старого: записи фамилии r32 не админа
delete from public.docs where path = 'claims/r32' and (data ->> 'uid') not in (select uid::text from public.admins);
delete from public.docs where path like 'profiles/%' and data ->> 'rid' = 'r32' and split_part(path, '/', 2) not in (select uid::text from public.admins);

-- 9. Личный чат студента с админом (и преподавателя с админом): таблица chat
alter table public.chat drop constraint if exists chat_thread_uid_fkey;
alter table public.chat add constraint chat_thread_uid_fkey foreign key (thread_uid) references auth.users (id) on delete cascade;
alter table public.chat enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'chat' loop execute format('drop policy %I on public.chat', r.policyname); end loop;
end $$;
create policy chat_select on public.chat for select using (tenant_id = (select public.current_tenant()) and (thread_uid = auth.uid() or public.is_admin()));
create policy chat_insert_student on public.chat for insert with check (tenant_id = (select public.current_tenant()) and thread_uid = auth.uid() and sender = auth.uid() and kind = 'text' and read_by_admin = false);
create policy chat_admin_all on public.chat for all using (tenant_id = (select public.current_tenant()) and public.is_admin()) with check (tenant_id = (select public.current_tenant()) and public.is_admin());
create policy chat_student_read on public.chat for update using (tenant_id = (select public.current_tenant()) and thread_uid = auth.uid()) with check (thread_uid = auth.uid());
create or replace function public.chat_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if new.id <> old.id or new.thread_uid <> old.thread_uid or new.sender is distinct from old.sender or new.kind <> old.kind or new.body <> old.body
     or new.created_at <> old.created_at or new.read_by_admin <> old.read_by_admin or (old.read_by_student and not new.read_by_student) then
    raise exception 'Сообщение изменить нельзя';
  end if;
  return new;
end $$;
drop trigger if exists trg_chat_guard on public.chat;
create trigger trg_chat_guard before update on public.chat for each row execute function public.chat_guard();
revoke all on public.chat from anon;
grant select, insert, update, delete on public.chat to authenticated;
grant usage, select on sequence public.chat_id_seq to authenticated;

-- 10. Новости: пишет и удаляет админ, читают и комментируют все вошедшие своего арендатора
alter table public.news enable row level security;
alter table public.news_comments enable row level security;
do $$ declare r record; begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('news', 'news_comments') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;
create policy news_read on public.news for select using (auth.uid() is not null and tenant_id = (select public.current_tenant()));
create policy news_admin on public.news for all using (tenant_id = (select public.current_tenant()) and public.is_admin()) with check (tenant_id = (select public.current_tenant()) and public.is_admin());
create policy comments_read on public.news_comments for select using (auth.uid() is not null and tenant_id = (select public.current_tenant()));
create policy comments_insert on public.news_comments for insert with check (author = auth.uid() and tenant_id = (select public.current_tenant()));
create policy comments_delete on public.news_comments for delete using (tenant_id = (select public.current_tenant()) and (author = auth.uid() or public.is_admin()));
create or replace function public.news_comment_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.author := auth.uid();
  new.author_name := coalesce((select d.data ->> 'name' from public.docs d where d.tenant_id = new.tenant_id and d.path = 'profiles/' || auth.uid()::text), 'Студент');
  new.author_is_admin := exists (select 1 from public.admins a where a.uid = auth.uid() and a.tenant_id = new.tenant_id);
  return new;
end $$;
drop trigger if exists trg_news_comment_fill on public.news_comments;
create trigger trg_news_comment_fill before insert on public.news_comments for each row execute function public.news_comment_fill();
revoke all on public.news, public.news_comments from anon;
grant select, insert, update, delete on public.news, public.news_comments to authenticated;

-- 11. Пароли: хеши записываются в settings
do $$ declare a text := (select admin_pass_new from _inputs); t text := (select teacher_pass from _inputs); begin
  if coalesce(a, '') <> '' then perform public.set_secret('admin_pass', a); end if;
  if not exists (select 1 from public.settings s where s.tenant_id = 'group_1' and s.key = 'admin_pass') then
    raise exception 'Пароль админа ещё не задан: впишите его вместо пустых кавычек в первой строке скрипта';
  end if;
  perform public.set_secret('teacher_pass', t);
end $$;
drop table if exists public.admin_secret;

notify pgrst, 'reload schema';
