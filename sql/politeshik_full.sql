-- =====================================================================================
--  ПОЛИТЕШИК: ПОЛНЫЙ скрипт базы данных. Работает на ПУСТОМ проекте Supabase и на уже настроенном (идемпотентный).
--  Supabase -> SQL Editor -> New query -> вставить ВСЁ -> Run (на окно «Potential issue» нажмите Run query).
--  Если на любом шаге будет ошибка, ничего не применится; исправьте и запустите снова.
--
--  ЧТО НУЖНО ВПИСАТЬ (одна строка ниже, два пароля):
--    ПРИДУМАЙТЕ_ПАРОЛЬ_ПРЕПОДАВАТЕЛЯ  -> пароль для преподавателей (минимум 8 символов)
--    ПРИДУМАЙТЕ_ПАРОЛЬ_АДМИНА         -> ваш секретный пароль админа (минимум 8 символов, не равен первому)
--  Это нужно при первом запуске. При повторном запуске можно оставить оба значения как есть:
--  уже сохранённые пароли не изменятся. Чтобы сменить пароль, впишите новый.
--  Пароли хранятся только в виде хеша (bcrypt с солью) в таблице settings, закрытой для сайта.
--
--  ЧТО СОЗДАЁТСЯ: таблицы (docs, admins, teachers, settings, admin_attempts, chat, news, news_comments,
--  news_likes, birthdays, tenants, analytics, groups, members, group_codes, code_attempts), функции ролей и паролей,
--  правила доступа (RLS), коды групп для регистрации, блокировка (banned) и удаление пользователей,
--  ввод посещаемости из бумажного журнала (attendance_import),
--  карта колледжа, готовое ДЗ, записки на пары, дни рождения, лайки, Realtime.
-- =====================================================================================
drop table if exists _inputs;
create temp table _inputs as select 'ПРИДУМАЙТЕ_ПАРОЛЬ_ПРЕПОДАВАТЕЛЯ'::text as teacher_pass, 'ПРИДУМАЙТЕ_ПАРОЛЬ_АДМИНА'::text as admin_pass_new;

-- Проверка паролей до любых изменений
do $$ declare
  t text := coalesce((select teacher_pass from _inputs), ''); a text := coalesce((select admin_pass_new from _inputs), '');
  have_t boolean := false; have_a boolean := false;
begin
  begin
    if to_regclass('public.settings') is not null then
      execute 'select exists (select 1 from public.settings where key = ''teacher_pass'' and value like ''$2%'')' into have_t;
      execute 'select exists (select 1 from public.settings where key = ''admin_pass'' and value like ''$2%'')' into have_a;
    end if;
    if to_regclass('public.admin_secret') is not null then have_a := true; end if;
  exception when others then have_t := false; have_a := false;
  end;
  if (t = '' or t like 'ПРИДУМАЙТЕ%') and not have_t then
    raise exception 'Пароль преподавателя не заменён: впишите его вместо ПРИДУМАЙТЕ_ПАРОЛЬ_ПРЕПОДАВАТЕЛЯ в первой строке скрипта и запустите снова';
  end if;
  if t <> '' and t not like 'ПРИДУМАЙТЕ%' and length(t) < 8 then raise exception 'Пароль преподавателя короче 8 символов'; end if;
  if (a = '' or a like 'ПРИДУМАЙТЕ%') and not have_a then
    raise exception 'Пароль админа ещё не задан: впишите его вместо ПРИДУМАЙТЕ_ПАРОЛЬ_АДМИНА в первой строке скрипта и запустите снова';
  end if;
  if a <> '' and a not like 'ПРИДУМАЙТЕ%' and length(a) < 8 then raise exception 'Пароль админа короче 8 символов'; end if;
end $$;

create extension if not exists pgcrypto;

-- Если в базе уже лежит таблица с тем же именем, но другого устройства (например, от прежней попытки или другого скрипта),
-- она переименовывается в <имя>_old_<дата> вместе с данными, а правильная создаётся заново. Ничего не удаляется.
-- Старая таблица закрывается от сайта (RLS без правил, права отозваны): читать её можно только из SQL Editor.
create or replace function pg_temp.quarantine(tbl text, need text[], idx text[]) returns void
language plpgsql as $$
declare missing text[]; stamp text := to_char(now(), 'YYMMDDHH24MISS'); i int;
begin
  if to_regclass('public.' || tbl) is null then return; end if;
  select array_agg(c) into missing from unnest(need) c
    where not exists (select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = tbl and k.column_name = c);
  if missing is null then return; end if;
  for i in 1 .. coalesce(array_length(idx, 1), 0) loop execute format('drop index if exists public.%I', idx[i]); end loop;
  execute format('alter table public.%I rename to %I', tbl, tbl || '_old_' || stamp);
  execute format('alter table public.%I enable row level security', tbl || '_old_' || stamp);
  execute format('revoke all on public.%I from anon, authenticated', tbl || '_old_' || stamp);
  raise notice 'Таблица public.% не подошла (нет колонок: %) и переименована в %_old_% вместе с данными', tbl, missing, tbl, stamp;
end $$;
select pg_temp.quarantine('tenants', array['id', 'name', 'created_at'], array[]::text[]);
select pg_temp.quarantine('docs', array['path', 'data', 'updated'], array[]::text[]);
select pg_temp.quarantine('admins', array['uid'], array[]::text[]);
select pg_temp.quarantine('teachers', array['uid'], array[]::text[]);
select pg_temp.quarantine('settings', array['key', 'value'], array[]::text[]);
select pg_temp.quarantine('admin_attempts', array['id', 'uid', 'at', 'ok'], array[]::text[]);
select pg_temp.quarantine('chat', array['id', 'thread_uid', 'sender', 'kind', 'body', 'file_path', 'file_name', 'file_size', 'meta', 'created_at', 'read_by_admin', 'read_by_student'], array['chat_tenant_thread_idx']);
select pg_temp.quarantine('news', array['id', 'title', 'body', 'news_date', 'created_by', 'created_at'], array['news_tenant_idx', 'news_birthday_once']);
select pg_temp.quarantine('news_comments', array['id', 'news_id', 'author', 'author_name', 'author_is_admin', 'body', 'created_at'], array['news_comments_idx']);
select pg_temp.quarantine('news_likes', array['news_id', 'uid', 'created_at'], array['news_likes_news_idx']);
select pg_temp.quarantine('birthdays', array['uid', 'display_name', 'month', 'day', 'is_public', 'updated'], array[]::text[]);
select pg_temp.quarantine('groups', array['id', 'name', 'curator_uid', 'created_at'], array[]::text[]);
select pg_temp.quarantine('members', array['uid', 'role', 'status', 'requested_role', 'full_name', 'child_name', 'child_uid', 'group_id', 'note', 'email', 'created_at', 'decided_at', 'decided_by'], array['members_status_idx', 'members_group_idx']);
select pg_temp.quarantine('group_codes', array['code', 'group_id', 'active', 'created_by', 'created_at'], array[]::text[]);
select pg_temp.quarantine('analytics', array['id', 'user_id', 'role', 'action', 'page', 'metadata', 'created_at'], array['analytics_tenant_time_idx', 'analytics_user_idx']);


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
  select c.conname into pk from pg_constraint c where c.conrelid = 'public.settings'::regclass and c.contype = 'p' and array_length(c.conkey, 1) <> 2;
  if pk is not null then execute format('alter table public.settings drop constraint %I', pk); end if;
  if not exists (select 1 from pg_constraint c where c.conrelid = 'public.settings'::regclass and c.contype = 'p') then
    alter table public.settings add primary key (tenant_id, key);
  end if;
end $$;
create unique index if not exists admins_uid_unique on public.admins (uid);
create unique index if not exists teachers_uid_unique on public.teachers (uid);
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
  insert into public.members (tenant_id, uid, role, status, email, decided_at) values (public.current_tenant(), auth.uid(), 'admin', 'approved', coalesce((select a.email from auth.users a where a.id = auth.uid()), ''), now()) on conflict (tenant_id, uid) do update set role = 'admin', status = 'approved', email = excluded.email;
  return true;
end $$;
drop function if exists public.become_teacher(text);
create or replace function public.become_teacher(p_secret text, p_name text default '') returns boolean
language plpgsql security definer set search_path = public as $$
declare t text := public.current_tenant(); mail text;
begin
  if auth.uid() is null then raise exception 'Нужно войти в аккаунт'; end if;
  if public.is_teacher() then return true; end if;
  if public.is_admin() then raise exception 'Этот аккаунт уже админ'; end if;
  if not public.email_ok() then raise exception 'Подтвердите почту'; end if;
  if exists (select 1 from public.members m where m.uid = auth.uid() and m.tenant_id = t and m.status = 'banned') then raise exception 'Вы заблокированы администратором'; end if;
  if not public.check_secret('teacher_pass', p_secret) then return false; end if;
  select a.email into mail from auth.users a where a.id = auth.uid();
  insert into public.members (tenant_id, uid, role, status, requested_role, full_name, email)
    values (t, auth.uid(), 'teacher', 'pending', 'teacher', left(coalesce(p_name, ''), 120), coalesce(mail, ''))
    on conflict (tenant_id, uid) do update set requested_role = 'teacher',
      full_name = case when excluded.full_name <> '' then excluded.full_name else public.members.full_name end,
      email = excluded.email
      where public.members.status <> 'approved';
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
revoke all on function public.become_admin(text), public.become_teacher(text, text), public.admin_secret_is_set(), public.teacher_secret_is_set() from public, anon;
grant execute on function public.become_admin(text), public.become_teacher(text, text), public.admin_secret_is_set(), public.teacher_secret_is_set() to authenticated;

-- 4. Чей это документ: profiles/<uid>, attendance/<uid>, certs/<uid>[/...], chat/<uid>, data/users/<uid>/...
create or replace function public.doc_owner(p text) returns text
language sql immutable as $$
  select case
    when p like 'data/users/%' then split_part(p, '/', 3)
    when split_part(p, '/', 1) in ('profiles', 'attendance', 'certs', 'chat', 'map', 'solutions', 'avatars') then split_part(p, '/', 2)
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
    or (split_part(path, '/', 1) in ('map', 'solutions') and not public.is_teacher())
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
  if current_setting('app.import', true) = 'on' then return new; end if;
  if public.is_admin() then return new; end if;
  if split_part(new.path, '/', 1) = 'attendance' and array_length(string_to_array(new.path, '/'), 1) = 2 and public.curator_manages(split_part(new.path, '/', 2)) then return new; end if;
  select d.data into prev from public.docs d where d.tenant_id = new.tenant_id and d.path = new.path;
  if pg_column_size(new.data) > 900000 then raise exception 'Документ слишком большой'; end if;
  if split_part(new.path, '/', 1) = 'profiles' and array_length(string_to_array(new.path, '/'), 1) = 2 and coalesce(prev ->> 'rid', '') <> '' then
    if (new.data ->> 'rid') is distinct from (prev ->> 'rid') or (new.data ->> 'name') is distinct from (prev ->> 'name') then
      raise exception 'ФИО нельзя изменить после регистрации: обратитесь к старосте';
    end if;
  end if;
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
  if split_part(new.path, '/', 1) = 'avatars' then
    if array_length(string_to_array(new.path, '/'), 1) <> 2 then raise exception 'Неверный путь аватарки'; end if;
    if public.member_role() = 'parent' then raise exception 'Родителям фото профиля недоступно'; end if;
    if coalesce(new.data ->> 'v', '') <> '' and not (new.data ->> 'v' ~ '^m[0-9]{1,2}$' or (new.data ->> 'v' like 'data:image/jpeg;base64,%' and char_length(new.data ->> 'v') < 60000)) then
      raise exception 'Неверный формат фото';
    end if;
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
drop function if exists public.teacher_certs();
create function public.teacher_certs() returns table (uid text, date_from text, date_to text, confirmed boolean, pairs jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_teacher() or public.is_admin()) or public.is_blocked() then raise exception 'Только для преподавателя'; end if;
  return query
    select split_part(d.path, '/', 2), i.value ->> 'from', i.value ->> 'to', coalesce((i.value ->> 'confirmed')::boolean, false), i.value -> 'pairs'
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

-- 11. Пароли: хеши записываются в settings (значения-заготовки означают «оставить как есть»)
do $$ declare a text := coalesce((select admin_pass_new from _inputs), ''); t text := coalesce((select teacher_pass from _inputs), ''); begin
  if a <> '' and a not like 'ПРИДУМАЙТЕ%' then perform public.set_secret('admin_pass', a); end if;
  if t <> '' and t not like 'ПРИДУМАЙТЕ%' then perform public.set_secret('teacher_pass', t); end if;
  if not exists (select 1 from public.settings s where s.tenant_id = 'group_1' and s.key = 'admin_pass' and s.value like '$2%') then
    raise exception 'Пароль админа ещё не задан: впишите его вместо ПРИДУМАЙТЕ_ПАРОЛЬ_АДМИНА в первой строке скрипта';
  end if;
  if not exists (select 1 from public.settings s where s.tenant_id = 'group_1' and s.key = 'teacher_pass' and s.value like '$2%') then
    raise exception 'Пароль преподавателя не заменён: впишите его вместо ПРИДУМАЙТЕ_ПАРОЛЬ_ПРЕПОДАВАТЕЛЯ в первой строке скрипта';
  end if;
end $$;
drop table if exists public.admin_secret;

-- 12. ДНИ РОЖДЕНИЯ. Полная дата рождения лежит только в личном профиле (profiles/<uid> в docs, его видит сам студент).
--     В таблицу birthdays попадают только день и месяц (без года), имя и согласие показывать день рождения группе.
create table if not exists public.birthdays (
  tenant_id    text not null default 'group_1',
  uid          uuid not null references auth.users (id) on delete cascade,
  display_name text not null default '',
  month        int not null check (month between 1 and 12),
  day          int not null check (day between 1 and 31),
  is_public    boolean not null default true,
  updated      timestamptz not null default now(),
  primary key (tenant_id, uid)
);
alter table public.birthdays enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'birthdays' loop execute format('drop policy %I on public.birthdays', r.policyname); end loop;
end $$;
create policy birthdays_read on public.birthdays for select using (
  tenant_id = (select public.current_tenant()) and (is_public or uid = auth.uid() or public.is_admin()));
revoke all on public.birthdays from anon, authenticated;
grant select on public.birthdays to authenticated;

-- сохранить свой день рождения (клиент передаёт дату; в таблицу пишутся только день и месяц)
create or replace function public.set_birthday(p_date date, p_public boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare t text := public.current_tenant(); nm text;
begin
  if auth.uid() is null then raise exception 'Нужно войти в аккаунт'; end if;
  if public.is_teacher() then raise exception 'Для преподавателя дата рождения не сохраняется'; end if;
  if p_date is null or p_date > (now() at time zone 'Europe/Moscow')::date or extract(year from p_date) < 1940 then raise exception 'Проверьте дату рождения'; end if;
  select nullif(split_part(d.data ->> 'name', ' ', 2), '') into nm from public.docs d where d.tenant_id = t and d.path = 'profiles/' || auth.uid()::text;
  insert into public.birthdays (tenant_id, uid, display_name, month, day, is_public)
    values (t, auth.uid(), left(coalesce(nm, 'Студент'), 60), extract(month from p_date)::int, extract(day from p_date)::int, coalesce(p_public, true))
    on conflict (tenant_id, uid) do update set display_name = excluded.display_name, month = excluded.month, day = excluded.day, is_public = excluded.is_public, updated = now();
end $$;
create or replace function public.clear_birthday() returns void
language sql security definer set search_path = public as $$
  delete from public.birthdays where tenant_id = public.current_tenant() and uid = auth.uid()
$$;
revoke all on function public.set_birthday(date, boolean), public.clear_birthday() from public, anon;
grant execute on function public.set_birthday(date, boolean), public.clear_birthday() to authenticated;

-- 13. Новости-поздравления: пост «Сегодня день рождения у ...» создаёт сервер, один раз в день на именинника.
alter table public.news add column if not exists kind text not null default 'post';
alter table public.news add column if not exists subject_uid uuid references auth.users (id) on delete cascade;
alter table public.news add column if not exists subject_name text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'news_kind_check') then
    alter table public.news add constraint news_kind_check check (kind in ('post', 'birthday'));
  end if;
end $$;
create unique index if not exists news_birthday_once on public.news (tenant_id, subject_uid, news_date) where kind = 'birthday';

create or replace function public.ensure_birthday_posts() returns int
language plpgsql security definer set search_path = public as $$
declare t text := public.current_tenant(); today date := (now() at time zone 'Europe/Moscow')::date; r record; made int := 0; got int;
        leap boolean := (extract(day from (date_trunc('year', today) + interval '2 month' - interval '1 day')) = 29);
begin
  if auth.uid() is null then raise exception 'Нужно войти в аккаунт'; end if;
  for r in select b.uid, b.display_name from public.birthdays b
           where b.tenant_id = t and b.is_public
             and ((b.month = extract(month from today) and b.day = extract(day from today))
               or (b.month = 2 and b.day = 29 and not leap and extract(month from today) = 2 and extract(day from today) = 28)) loop
    insert into public.news (tenant_id, title, body, news_date, kind, subject_uid, subject_name, created_by)
      values (t, 'День рождения: ' || r.display_name, 'Сегодня день рождения у ' || r.display_name || '! Давайте поздравим!', today, 'birthday', r.uid, r.display_name, null)
      on conflict (tenant_id, subject_uid, news_date) where kind = 'birthday' do nothing;
    get diagnostics got = row_count; made := made + got;
  end loop;
  return made;
end $$;
revoke all on function public.ensure_birthday_posts() from public, anon;
grant execute on function public.ensure_birthday_posts() to authenticated;

-- 14. Лайки к новостям: один лайк на человека; ставить и снимать можно только свой.
create table if not exists public.news_likes (
  tenant_id  text not null default 'group_1',
  news_id    uuid not null references public.news (id) on delete cascade,
  uid        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (news_id, uid)
);
alter table public.news_likes enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'news_likes' loop execute format('drop policy %I on public.news_likes', r.policyname); end loop;
end $$;
create policy likes_read on public.news_likes for select using (auth.uid() is not null and tenant_id = (select public.current_tenant()));
create policy likes_insert on public.news_likes for insert with check (uid = auth.uid() and tenant_id = (select public.current_tenant()));
create policy likes_delete on public.news_likes for delete using (uid = auth.uid() and tenant_id = (select public.current_tenant()));
drop trigger if exists trg_a_tenant_likes on public.news_likes;
create trigger trg_a_tenant_likes before insert or update on public.news_likes for each row execute function public.set_tenant();
revoke all on public.news_likes from anon;
grant select, insert, delete on public.news_likes to authenticated;
create index if not exists news_likes_news_idx on public.news_likes (news_id);

-- 15. Мгновенные обновления (Supabase Realtime) для новостей, комментариев, лайков и личных чатов. Таблица docs не добавляется: в ней фото и большие файлы.
do $$ declare tbl text; begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach tbl in array array['news', 'news_comments', 'news_likes', 'chat'] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', tbl);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;

-- 17. РОЛИ, ГРУППЫ И ЗАЯВКИ НА ДОСТУП
--     Роли: student (студент), admin (староста), curator (куратор), teacher (преподаватель), parent (родитель), department (отделение).
--     Новый пользователь получает заявку со статусом pending; староста одобряет или отклоняет её во вкладке «Заявки».
--     Пока заявка не одобрена, общие данные группы (расписание, новости, карта, чаты) пользователю не видны.
create table if not exists public.groups (
  id         text primary key,
  tenant_id  text not null default 'group_1',
  name       text not null,
  curator_uid uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
insert into public.groups (id, tenant_id, name) values ('g_main', 'group_1', 'Группа 25290909/3091') on conflict (id) do nothing;

create table if not exists public.members (
  tenant_id      text not null default 'group_1',
  uid            uuid not null references auth.users (id) on delete cascade,
  role           text not null default 'student' check (role in ('student', 'admin', 'teacher', 'curator', 'department', 'parent')),
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_role text,
  full_name      text not null default '',
  child_name     text not null default '',
  child_uid      uuid references auth.users (id) on delete set null,
  group_id       text references public.groups (id) on delete set null,
  note           text not null default '',
  email          text not null default '',
  created_at     timestamptz not null default now(),
  decided_at     timestamptz,
  decided_by     uuid,
  primary key (tenant_id, uid)
);
create index if not exists members_status_idx on public.members (tenant_id, status, created_at desc);
create index if not exists members_group_idx on public.members (tenant_id, group_id, role);
alter table public.groups enable row level security;
alter table public.members enable row level security;
drop trigger if exists trg_a_tenant_groups on public.groups;
create trigger trg_a_tenant_groups before insert or update on public.groups for each row execute function public.set_tenant();
drop trigger if exists trg_a_tenant_members on public.members;
create trigger trg_a_tenant_members before insert or update on public.members for each row execute function public.set_tenant();

-- нужно ли одобрение: строка настройки require_approval (on/off), иначе параметр базы app.require_approval, иначе «да»
create or replace function public.require_approval() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select s.value from public.settings s where s.tenant_id = public.current_tenant() and s.key = 'require_approval'),
                  nullif(current_setting('app.require_approval', true), ''), 'on') <> 'off'
$$;
create or replace function public.email_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select case when to_jsonb(u) ? 'email_confirmed_at' then (to_jsonb(u) ->> 'email_confirmed_at') is not null else true end from auth.users u where u.id = auth.uid()), false)
$$;
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_admin() or public.is_teacher()
    or (public.email_ok() and (
      exists (select 1 from public.members m where m.uid = auth.uid() and m.tenant_id = public.current_tenant() and m.status = 'approved')
      or (not public.require_approval() and not exists (select 1 from public.members m where m.uid = auth.uid() and m.tenant_id = public.current_tenant() and m.status in ('rejected', 'banned'))))))
$$;
create or replace function public.member_role() returns text
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then 'admin' when public.is_teacher() then 'teacher'
    else coalesce((select m.role from public.members m where m.uid = auth.uid() and m.tenant_id = public.current_tenant() and m.status = 'approved'),
                  case when public.is_member() then 'student' else 'pending' end) end
$$;
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then 'admin' when public.is_teacher() then 'teacher'
    else coalesce((select case m.status when 'approved' then m.role else m.status end from public.members m where m.uid = auth.uid() and m.tenant_id = public.current_tenant()),
                  case when public.is_member() then 'student' else 'pending' end) end
$$;

-- заявка на доступ: p_role = student | parent | staff (куратор или отделение: роль назначит староста)
create or replace function public.request_access(p_role text, p_name text, p_child text default '', p_note text default '') returns text
language plpgsql security definer set search_path = public as $$
declare t text := public.current_tenant(); u uuid := auth.uid(); cur public.members; asked text; child uuid; hits int; want text; st text; gid text; mail text; role_now text;
begin
  if u is null then raise exception 'Нужно войти в аккаунт'; end if;
  if public.is_admin() or public.is_teacher() then return 'approved'; end if;
  asked := case when p_role in ('student', 'parent', 'staff') then p_role else 'student' end;
  select * into cur from public.members m where m.tenant_id = t and m.uid = u;
  if found and cur.status in ('approved', 'rejected') then return cur.status; end if;
  select a.email into mail from auth.users a where a.id = u;
  select g.id into gid from public.groups g where g.tenant_id = t order by g.created_at limit 1;
  if asked = 'parent' and btrim(coalesce(p_child, '')) <> '' then
    want := lower(split_part(regexp_replace(btrim(p_child), '\s+', ' ', 'g'), ' ', 1) || ' ' || split_part(regexp_replace(btrim(p_child), '\s+', ' ', 'g'), ' ', 2));
    select count(*), (array_agg(a.id))[1] into hits, child
    from public.docs d join auth.users a on a.id::text = split_part(d.path, '/', 2)
    where d.tenant_id = t and d.path like 'profiles/%' and coalesce(d.data ->> 'rid', '') <> ''
      and lower(split_part(regexp_replace(btrim(coalesce(d.data ->> 'name', '')), '\s+', ' ', 'g'), ' ', 1) || ' ' || split_part(regexp_replace(btrim(coalesce(d.data ->> 'name', '')), '\s+', ' ', 'g'), ' ', 2)) = want;
    if hits <> 1 then child := null; end if;
  end if;
  st := case when asked = 'staff' or public.require_approval() then 'pending' else 'approved' end;
  role_now := case when asked = 'parent' then 'parent' else 'student' end;
  insert into public.members (tenant_id, uid, role, status, requested_role, full_name, child_name, child_uid, group_id, note, email)
    values (t, u, role_now, st, asked, left(coalesce(p_name, ''), 120), left(coalesce(p_child, ''), 120), child, gid, left(coalesce(p_note, ''), 300), coalesce(mail, ''))
    on conflict (tenant_id, uid) do update set requested_role = excluded.requested_role, full_name = excluded.full_name, child_name = excluded.child_name, child_uid = excluded.child_uid, note = excluded.note, email = excluded.email;
  return st;
end $$;

create or replace function public.decide_access(p_uid uuid, p_approve boolean, p_role text default null, p_group text default null, p_child uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare t text := public.current_tenant(); m public.members; r text;
begin
  if not public.is_admin() then raise exception 'Только староста может решать заявки'; end if;
  select * into m from public.members x where x.tenant_id = t and x.uid = p_uid;
  if not found then raise exception 'Заявка не найдена'; end if;
  if not p_approve then
    update public.members set status = 'rejected', decided_at = now(), decided_by = auth.uid() where tenant_id = t and uid = p_uid;
    return;
  end if;
  r := coalesce(p_role, case m.requested_role when 'parent' then 'parent' when 'staff' then 'curator' when 'teacher' then 'teacher' else 'student' end);
  if r not in ('student', 'curator', 'department', 'parent', 'teacher') then raise exception 'Недопустимая роль'; end if;
  update public.members set status = 'approved', role = r, group_id = coalesce(p_group, group_id), child_uid = coalesce(p_child, child_uid), decided_at = now(), decided_by = auth.uid()
    where tenant_id = t and uid = p_uid;
  if r = 'teacher' then insert into public.teachers (uid, tenant_id) values (p_uid, t) on conflict (uid) do nothing;
  else delete from public.teachers where uid = p_uid and tenant_id = t; end if;
  if r = 'curator' then update public.groups set curator_uid = p_uid where tenant_id = t and id = coalesce(p_group, m.group_id); end if;
end $$;

create or replace function public.set_member_role(p_uid uuid, p_role text, p_group text default null) returns void
language plpgsql security definer set search_path = public as $$
declare t text := public.current_tenant();
begin
  if not public.is_admin() then raise exception 'Только староста может менять роли'; end if;
  if p_role not in ('student', 'curator', 'department', 'parent') then raise exception 'Недопустимая роль'; end if;
  update public.members set role = p_role, status = 'approved', group_id = coalesce(p_group, group_id), decided_at = now(), decided_by = auth.uid() where tenant_id = t and uid = p_uid;
  if not found then raise exception 'Пользователь не найден'; end if;
  if p_role = 'curator' then update public.groups set curator_uid = p_uid where tenant_id = t and id = coalesce(p_group, (select group_id from public.members where tenant_id = t and uid = p_uid)); end if;
end $$;

create or replace function public.set_require_approval(p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Только староста'; end if;
  insert into public.settings (tenant_id, key, value) values (public.current_tenant(), 'require_approval', case when p_on then 'on' else 'off' end)
    on conflict (tenant_id, key) do update set value = excluded.value, updated = now();
end $$;

create or replace function public.list_access_requests() returns table (uid uuid, email text, role text, status text, requested_role text, full_name text, child_name text, child_uid uuid, group_id text, note text, created_at timestamptz, decided_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Только староста'; end if;
  return query select m.uid, m.email, m.role, m.status, m.requested_role, m.full_name, m.child_name, m.child_uid, m.group_id, m.note, m.created_at, m.decided_at
    from public.members m where m.tenant_id = public.current_tenant() order by (m.status = 'pending') desc, m.created_at desc;
end $$;

-- родитель видит только своего ребёнка
create or replace function public.parent_child() returns table (uid text, name text, rid text, subgroup text)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.member_role() <> 'parent' then raise exception 'Только для родителя'; end if;
  return query select m.child_uid::text, d.data ->> 'name', d.data ->> 'rid', d.data ->> 'subgroup'
    from public.members m join public.docs d on d.tenant_id = m.tenant_id and d.path = 'profiles/' || m.child_uid::text
    where m.uid = auth.uid() and m.tenant_id = public.current_tenant() and m.status = 'approved' and m.child_uid is not null;
end $$;

-- куратор управляет только студентами своей группы
create or replace function public.curator_manages(p_uid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members c join public.members s on s.tenant_id = c.tenant_id and s.group_id = c.group_id
    where c.uid = auth.uid() and c.tenant_id = public.current_tenant() and c.role = 'curator' and c.status = 'approved'
      and s.uid::text = p_uid and s.role = 'student' and s.status = 'approved')
$$;
create or replace function public.curator_students() returns table (uid text, name text, rid text, subgroup text)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.member_role() not in ('curator', 'admin') then raise exception 'Только для куратора'; end if;
  return query select s.uid::text, coalesce(d.data ->> 'name', s.full_name), d.data ->> 'rid', d.data ->> 'subgroup'
    from public.members c join public.members s on s.tenant_id = c.tenant_id and s.group_id = c.group_id and s.role = 'student' and s.status = 'approved'
    left join public.docs d on d.tenant_id = s.tenant_id and d.path = 'profiles/' || s.uid::text
    where c.uid = auth.uid() and c.tenant_id = public.current_tenant() and c.role = 'curator' and c.status = 'approved';
end $$;
create or replace function public.curator_certs() returns table (uid text, date_from text, date_to text, confirmed boolean, pairs jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.member_role() <> 'curator' then raise exception 'Только для куратора'; end if;
  return query select split_part(d.path, '/', 2), i.value ->> 'from', i.value ->> 'to', coalesce((i.value ->> 'confirmed')::boolean, false), i.value -> 'pairs'
    from public.docs d, jsonb_array_elements(coalesce(d.data -> 'items', '[]'::jsonb)) i
    where d.tenant_id = public.current_tenant() and d.path ~ '^certs/[^/]+$' and public.curator_manages(split_part(d.path, '/', 2));
end $$;

create or replace function public.department_report() returns table (group_id text, group_name text, curator text, students int, pending int)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.member_role() not in ('department', 'admin') then raise exception 'Только для отделения'; end if;
  return query select g.id, g.name, coalesce((select m.full_name from public.members m where m.uid = g.curator_uid and m.tenant_id = g.tenant_id), ''),
      (select count(*)::int from public.members s where s.tenant_id = g.tenant_id and s.group_id = g.id and s.role = 'student' and s.status = 'approved'),
      (select count(*)::int from public.members s where s.tenant_id = g.tenant_id and s.group_id = g.id and s.status = 'pending')
    from public.groups g where g.tenant_id = public.current_tenant() order by g.name;
end $$;

-- права на функции
revoke all on function public.require_approval(), public.is_member(), public.member_role(), public.my_role(), public.curator_manages(text) from public, anon;
grant execute on function public.require_approval(), public.is_member(), public.member_role(), public.my_role(), public.curator_manages(text) to authenticated;
revoke all on function public.request_access(text, text, text, text), public.decide_access(uuid, boolean, text, text, uuid), public.set_member_role(uuid, text, text), public.set_require_approval(boolean),
  public.list_access_requests(), public.parent_child(), public.curator_students(), public.curator_certs(), public.department_report() from public, anon;
grant execute on function public.request_access(text, text, text, text), public.decide_access(uuid, boolean, text, text, uuid), public.set_member_role(uuid, text, text), public.set_require_approval(boolean),
  public.list_access_requests(), public.parent_child(), public.curator_students(), public.curator_certs(), public.department_report() to authenticated;

-- таблицы: читать свою заявку и группы; менять только через функции
do $$ declare r record; begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('groups', 'members') loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;
create policy members_read on public.members for select using (tenant_id = (select public.current_tenant()) and (uid = auth.uid() or public.is_admin()));
create policy groups_read on public.groups for select using (tenant_id = (select public.current_tenant()) and public.is_member());
create policy groups_admin on public.groups for all using (tenant_id = (select public.current_tenant()) and public.is_admin()) with check (tenant_id = (select public.current_tenant()) and public.is_admin());
revoke all on public.groups, public.members from anon, authenticated;
grant select on public.groups, public.members to authenticated;
grant insert, update, delete on public.groups to authenticated;

-- перенос уже зарегистрированных: студенты с профилем, админы и преподаватели считаются одобренными
insert into public.members (tenant_id, uid, role, status, full_name, group_id, email, decided_at)
  select d.tenant_id, a.id, 'student', 'approved', coalesce(d.data ->> 'name', ''), (select g.id from public.groups g where g.tenant_id = d.tenant_id order by g.created_at limit 1), coalesce(a.email, ''), now()
  from public.docs d join auth.users a on a.id::text = split_part(d.path, '/', 2)
  where d.path like 'profiles/%' and coalesce(d.data ->> 'rid', '') <> ''
  on conflict (tenant_id, uid) do nothing;
insert into public.members (tenant_id, uid, role, status, full_name, group_id, email, decided_at)
  select x.tenant_id, x.uid, 'admin', 'approved', '', (select g.id from public.groups g where g.tenant_id = x.tenant_id order by g.created_at limit 1), coalesce(a.email, ''), now()
  from public.admins x join auth.users a on a.id = x.uid
  on conflict (tenant_id, uid) do update set role = 'admin', status = 'approved';
insert into public.members (tenant_id, uid, role, status, full_name, email, decided_at)
  select x.tenant_id, x.uid, 'teacher', 'approved', '', coalesce(a.email, ''), now()
  from public.teachers x join auth.users a on a.id = x.uid
  on conflict (tenant_id, uid) do update set role = 'teacher', status = 'approved';

-- правила доступа: общие данные только участникам
drop policy if exists docs_select on public.docs;
create policy docs_select on public.docs for select using (
  auth.uid() is not null and tenant_id = (select public.current_tenant()) and (
    split_part(path, '/', 1) = 'claims'
    or (split_part(path, '/', 1) = 'group' and public.is_member())
    or (split_part(path, '/', 1) in ('map', 'solutions') and not public.is_teacher() and public.is_member())
    or public.doc_owner(path) = auth.uid()::text
    or public.is_admin()));
drop policy if exists docs_own_insert on public.docs;
drop policy if exists docs_own_update on public.docs;
drop policy if exists docs_own_delete on public.docs;
create policy docs_own_insert on public.docs for insert with check (tenant_id = (select public.current_tenant()) and public.doc_owner(path) = auth.uid()::text and (split_part(path, '/', 1) = 'profiles' or public.is_member()));
create policy docs_own_update on public.docs for update
  using (tenant_id = (select public.current_tenant()) and public.doc_owner(path) = auth.uid()::text and (split_part(path, '/', 1) = 'profiles' or public.is_member()))
  with check (tenant_id = (select public.current_tenant()) and public.doc_owner(path) = auth.uid()::text and (split_part(path, '/', 1) = 'profiles' or public.is_member()));
create policy docs_own_delete on public.docs for delete using (tenant_id = (select public.current_tenant()) and public.doc_owner(path) = auth.uid()::text and (split_part(path, '/', 1) = 'profiles' or public.is_member()));
drop policy if exists docs_parent_read on public.docs;
create policy docs_parent_read on public.docs for select using (
  tenant_id = (select public.current_tenant()) and path ~ '^attendance/[^/]+$' and exists (
    select 1 from public.members m where m.uid = auth.uid() and m.tenant_id = (select public.current_tenant()) and m.role = 'parent' and m.status = 'approved' and m.child_uid is not null and 'attendance/' || m.child_uid::text = path));
drop policy if exists docs_curator_read on public.docs;
create policy docs_curator_read on public.docs for select using (
  tenant_id = (select public.current_tenant()) and path ~ '^attendance/[^/]+$' and public.curator_manages(split_part(path, '/', 2)));
drop policy if exists docs_curator_insert on public.docs;
drop policy if exists docs_curator_update on public.docs;
create policy docs_curator_insert on public.docs for insert with check (tenant_id = (select public.current_tenant()) and path ~ '^attendance/[^/]+$' and public.curator_manages(split_part(path, '/', 2)));
create policy docs_curator_update on public.docs for update
  using (tenant_id = (select public.current_tenant()) and path ~ '^attendance/[^/]+$' and public.curator_manages(split_part(path, '/', 2)))
  with check (tenant_id = (select public.current_tenant()) and path ~ '^attendance/[^/]+$' and public.curator_manages(split_part(path, '/', 2)));
drop policy if exists chat_insert_student on public.chat;
create policy chat_insert_student on public.chat for insert with check (tenant_id = (select public.current_tenant()) and thread_uid = auth.uid() and sender = auth.uid() and kind = 'text' and read_by_admin = false and public.is_member());
drop policy if exists news_read on public.news;
create policy news_read on public.news for select using (auth.uid() is not null and tenant_id = (select public.current_tenant()) and public.is_member());
drop policy if exists news_department_insert on public.news;
drop policy if exists news_department_delete on public.news;
create policy news_department_insert on public.news for insert with check (tenant_id = (select public.current_tenant()) and kind = 'post' and public.member_role() = 'department');
create policy news_department_delete on public.news for delete using (tenant_id = (select public.current_tenant()) and created_by = auth.uid() and public.member_role() = 'department');
drop policy if exists comments_read on public.news_comments;
drop policy if exists comments_insert on public.news_comments;
create policy comments_read on public.news_comments for select using (auth.uid() is not null and tenant_id = (select public.current_tenant()) and public.is_member());
create policy comments_insert on public.news_comments for insert with check (author = auth.uid() and tenant_id = (select public.current_tenant()) and public.is_member());
drop policy if exists likes_read on public.news_likes;
drop policy if exists likes_insert on public.news_likes;
create policy likes_read on public.news_likes for select using (auth.uid() is not null and tenant_id = (select public.current_tenant()) and public.is_member());
create policy likes_insert on public.news_likes for insert with check (uid = auth.uid() and tenant_id = (select public.current_tenant()) and public.is_member());
drop policy if exists birthdays_read on public.birthdays;
create policy birthdays_read on public.birthdays for select using (
  tenant_id = (select public.current_tenant()) and public.is_member() and (is_public or uid = auth.uid() or public.is_admin()));

-- 19. БЕЗОПАСНОСТЬ: код группы, блокировка (banned), защита ФИО, список пользователей, бан и удаление
alter table public.members drop constraint if exists members_status_check;
alter table public.members add constraint members_status_check check (status in ('pending', 'approved', 'rejected', 'banned'));

create table if not exists public.group_codes (
  code       text primary key check (code ~ '^[0-9A-Z-]{8,32}$'),
  tenant_id  text not null default 'group_1',
  group_id   text references public.groups (id) on delete cascade,
  active     boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.code_attempts (id bigserial primary key, at timestamptz not null default now());
alter table public.group_codes enable row level security;
alter table public.code_attempts enable row level security;
do $$ declare r record; begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('group_codes', 'code_attempts') loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;
drop trigger if exists trg_a_tenant_group_codes on public.group_codes;
create trigger trg_a_tenant_group_codes before insert or update on public.group_codes for each row execute function public.set_tenant();
create policy group_codes_admin on public.group_codes for all using (tenant_id = (select public.current_tenant()) and public.is_admin()) with check (tenant_id = (select public.current_tenant()) and public.is_admin());
revoke all on public.group_codes, public.code_attempts from anon, authenticated;
grant select on public.group_codes to authenticated;

create or replace function public.require_code() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select s.value from public.settings s where s.tenant_id = public.current_tenant() and s.key = 'require_code'),
                  nullif(current_setting('app.require_code', true), ''), 'on') <> 'off'
$$;
create or replace function public.valid_code(p_code text) returns text
language sql stable security definer set search_path = public as $$
  select g.group_id from public.group_codes g
  where g.tenant_id = public.current_tenant() and g.active and g.code = regexp_replace(upper(btrim(coalesce(p_code, ''))), '[^0-9A-Z-]', '', 'g')
$$;
create or replace function public.check_group_code(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.require_code() then return true; end if;
  -- пока староста не создала ни одного кода, создать аккаунт можно (чтобы староста смогла войти первой); доступ без кода всё равно не выдаётся
  if not exists (select 1 from public.group_codes c where c.tenant_id = public.current_tenant() and c.active) then return true; end if;
  delete from public.code_attempts where at < now() - interval '1 day';
  if (select count(*) from public.code_attempts where at > now() - interval '10 minutes') > 60 then raise exception 'Слишком много попыток: подождите несколько минут'; end if;
  if public.valid_code(p_code) is not null then return true; end if;
  insert into public.code_attempts default values;
  return false;
end $$;

create or replace function public.create_group_code(p_group text default null) returns text
language plpgsql security definer set search_path = public as $$
declare t text := public.current_tenant(); gid text; label text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; suffix text := ''; new_code text; i int;
begin
  if not public.is_admin() then raise exception 'Только староста может создавать коды'; end if;
  gid := coalesce(p_group, (select g.id from public.groups g where g.tenant_id = t order by g.created_at limit 1));
  select regexp_replace(coalesce((regexp_match(g.name, '([0-9]{8})\s*/\s*([0-9]{4})'))[1] || '-' || (regexp_match(g.name, '([0-9]{8})\s*/\s*([0-9]{4})'))[2], regexp_replace(upper(g.id), '[^0-9A-Z]', '', 'g')), '[^0-9A-Z-]', '', 'g')
    into label from public.groups g where g.id = gid and g.tenant_id = t;
  if label is null then raise exception 'Группа не найдена'; end if;
  loop
    suffix := '';
    for i in 1 .. 5 loop suffix := suffix || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    new_code := label || '-' || suffix;
    exit when not exists (select 1 from public.group_codes c where c.code = new_code);
  end loop;
  update public.group_codes set active = false where tenant_id = t and group_id = gid and active;
  insert into public.group_codes (code, tenant_id, group_id, active, created_by) values (new_code, t, gid, true, auth.uid());
  return new_code;
end $$;
create or replace function public.list_group_codes() returns table (code text, group_id text, group_name text, active boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Только староста'; end if;
  return query select c.code, c.group_id, coalesce(g.name, ''), c.active, c.created_at from public.group_codes c left join public.groups g on g.id = c.group_id
    where c.tenant_id = public.current_tenant() order by c.active desc, c.created_at desc;
end $$;
create or replace function public.disable_group_code(p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Только староста'; end if;
  update public.group_codes set active = false where tenant_id = public.current_tenant() and code = p_code;
end $$;
create or replace function public.set_require_code(p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Только староста'; end if;
  insert into public.settings (tenant_id, key, value) values (public.current_tenant(), 'require_code', case when p_on then 'on' else 'off' end)
    on conflict (tenant_id, key) do update set value = excluded.value, updated = now();
end $$;

-- заблокированные (banned, rejected) не видят ничего, даже своих данных
create or replace function public.is_blocked() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.uid = auth.uid() and m.tenant_id = public.current_tenant() and m.status in ('banned', 'rejected')) and not public.is_admin()
$$;
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and not public.is_blocked() and (
    public.is_admin() or public.is_teacher()
    or exists (select 1 from public.members m where m.uid = auth.uid() and m.tenant_id = public.current_tenant() and m.status = 'approved')
    or (not public.require_approval() and not exists (select 1 from public.members m where m.uid = auth.uid() and m.tenant_id = public.current_tenant())))
$$;
create or replace function public.member_role() returns text
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then 'admin' when public.is_blocked() then 'blocked' when public.is_teacher() then 'teacher'
    else coalesce((select m.role from public.members m where m.uid = auth.uid() and m.tenant_id = public.current_tenant() and m.status = 'approved'),
                  case when public.is_member() then 'student' else 'pending' end) end
$$;
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then 'admin'
    when public.is_blocked() then (select m.status from public.members m where m.uid = auth.uid() and m.tenant_id = public.current_tenant())
    when public.is_teacher() then 'teacher'
    else coalesce((select case m.status when 'approved' then m.role else m.status end from public.members m where m.uid = auth.uid() and m.tenant_id = public.current_tenant()),
                  case when public.is_member() then 'student' else 'pending' end) end
$$;
revoke all on function public.is_blocked(), public.require_code(), public.valid_code(text) from public, anon;
grant execute on function public.is_blocked(), public.require_code(), public.valid_code(text) to authenticated;
revoke all on function public.check_group_code(text) from public;
grant execute on function public.check_group_code(text) to anon, authenticated;
revoke all on function public.create_group_code(text), public.list_group_codes(), public.disable_group_code(text), public.set_require_code(boolean) from public, anon;
grant execute on function public.create_group_code(text), public.list_group_codes(), public.disable_group_code(text), public.set_require_code(boolean) to authenticated;

-- заявка: теперь студент и родитель обязаны ввести код группы
drop function if exists public.request_access(text, text, text, text);
create or replace function public.request_access(p_role text, p_name text, p_child text default '', p_note text default '', p_code text default '') returns text
language plpgsql security definer set search_path = public as $$
declare t text := public.current_tenant(); u uuid := auth.uid(); cur public.members; asked text; child uuid; hits int; want text; st text; gid text; mail text; role_now text; code_group text;
begin
  if u is null then raise exception 'Нужно войти в аккаунт'; end if;
  if not public.email_ok() then raise exception 'Подтвердите почту'; end if;
  if public.is_admin() or public.is_teacher() then return 'approved'; end if;
  asked := case when p_role in ('student', 'parent', 'staff') then p_role else 'student' end;
  select * into cur from public.members m where m.tenant_id = t and m.uid = u;
  if found and cur.status in ('approved', 'rejected', 'banned') then return cur.status; end if;
  if not found and asked in ('student', 'parent') and public.require_code() then
    code_group := public.valid_code(p_code);
    if code_group is null then raise exception 'Неверный код группы: спросите его у старосты'; end if;
  end if;
  select a.email into mail from auth.users a where a.id = u;
  select g.id into gid from public.groups g where g.tenant_id = t order by g.created_at limit 1;
  gid := coalesce(code_group, gid);
  if asked = 'parent' and btrim(coalesce(p_child, '')) <> '' then
    want := lower(split_part(regexp_replace(btrim(p_child), '\s+', ' ', 'g'), ' ', 1) || ' ' || split_part(regexp_replace(btrim(p_child), '\s+', ' ', 'g'), ' ', 2));
    select count(*), (array_agg(a.id))[1] into hits, child
    from public.docs d join auth.users a on a.id::text = split_part(d.path, '/', 2)
    where d.tenant_id = t and d.path like 'profiles/%' and coalesce(d.data ->> 'rid', '') <> ''
      and lower(split_part(regexp_replace(btrim(coalesce(d.data ->> 'name', '')), '\s+', ' ', 'g'), ' ', 1) || ' ' || split_part(regexp_replace(btrim(coalesce(d.data ->> 'name', '')), '\s+', ' ', 'g'), ' ', 2)) = want;
    if hits <> 1 then child := null; end if;
  end if;
  st := case when asked = 'staff' or public.require_approval() then 'pending' else 'approved' end;
  role_now := case when asked = 'parent' then 'parent' else 'student' end;
  insert into public.members (tenant_id, uid, role, status, requested_role, full_name, child_name, child_uid, group_id, note, email)
    values (t, u, role_now, st, asked, left(coalesce(p_name, ''), 120), left(coalesce(p_child, ''), 120), child, gid, left(coalesce(p_note, ''), 300), coalesce(mail, ''))
    on conflict (tenant_id, uid) do update set requested_role = excluded.requested_role, full_name = excluded.full_name, child_name = excluded.child_name, child_uid = excluded.child_uid, note = excluded.note, email = excluded.email;
  return st;
end $$;
revoke all on function public.request_access(text, text, text, text, text) from public, anon;
grant execute on function public.request_access(text, text, text, text, text) to authenticated;

-- правила доступа с учётом блокировки; профиль нельзя удалить (иначе его можно создать заново под другим ФИО)
drop policy if exists docs_select on public.docs;
create policy docs_select on public.docs for select using (
  auth.uid() is not null and tenant_id = (select public.current_tenant()) and (
    split_part(path, '/', 1) = 'claims'
    or (split_part(path, '/', 1) = 'group' and public.is_member())
    or (split_part(path, '/', 1) in ('map', 'solutions') and not public.is_teacher() and public.is_member())
    or (split_part(path, '/', 1) = 'avatars' and public.is_member() and public.member_role() <> 'parent')
    or (public.doc_owner(path) = auth.uid()::text and not public.is_blocked())
    or public.is_admin()));
drop policy if exists docs_own_insert on public.docs;
drop policy if exists docs_own_update on public.docs;
drop policy if exists docs_own_delete on public.docs;
create policy docs_own_insert on public.docs for insert with check (tenant_id = (select public.current_tenant()) and public.doc_owner(path) = auth.uid()::text and not public.is_blocked() and (split_part(path, '/', 1) = 'profiles' or public.is_member()));
create policy docs_own_update on public.docs for update
  using (tenant_id = (select public.current_tenant()) and public.doc_owner(path) = auth.uid()::text and not public.is_blocked() and (split_part(path, '/', 1) = 'profiles' or public.is_member()))
  with check (tenant_id = (select public.current_tenant()) and public.doc_owner(path) = auth.uid()::text and not public.is_blocked() and (split_part(path, '/', 1) = 'profiles' or public.is_member()));
create policy docs_own_delete on public.docs for delete using (tenant_id = (select public.current_tenant()) and public.doc_owner(path) = auth.uid()::text and public.is_member() and split_part(path, '/', 1) <> 'profiles');

-- в списках студентов только студенты (и староста)
create or replace function public.teacher_students() returns table (uid text, name text, rid text, subgroup text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_teacher() or public.is_admin()) or public.is_blocked() then raise exception 'Только для преподавателя'; end if;
  return query
    select split_part(d.path, '/', 2), d.data ->> 'name', d.data ->> 'rid', d.data ->> 'subgroup'
    from public.docs d join public.members m on m.uid::text = split_part(d.path, '/', 2) and m.tenant_id = d.tenant_id
    where d.tenant_id = public.current_tenant() and d.path ~ '^profiles/[^/]+$' and coalesce(d.data ->> 'rid', '') <> ''
      and m.status = 'approved' and m.role in ('student', 'admin');
end $$;

-- управление пользователями (только староста)
create or replace function public.admin_users() returns table (uid uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, role text, status text, requested_role text, full_name text, rid text, group_id text, child_name text, note text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Только староста'; end if;
  return query
    select a.id, a.email::text, a.created_at, a.last_sign_in_at,
      case when exists (select 1 from public.admins x where x.uid = a.id) then 'admin' when exists (select 1 from public.teachers x where x.uid = a.id) then 'teacher' else coalesce(m.role, 'student') end,
      coalesce(m.status, 'none'), m.requested_role,
      coalesce(nullif(p.data ->> 'name', ''), m.full_name, ''), coalesce(p.data ->> 'rid', ''), m.group_id, coalesce(m.child_name, ''), coalesce(m.note, '')
    from auth.users a
    left join public.members m on m.uid = a.id and m.tenant_id = public.current_tenant()
    left join public.docs p on p.tenant_id = public.current_tenant() and p.path = 'profiles/' || a.id::text
    order by (coalesce(m.status, 'none') in ('pending', 'none')) desc, a.created_at desc;
end $$;
create or replace function public.admin_set_status(p_uid uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare t text := public.current_tenant();
begin
  if not public.is_admin() then raise exception 'Только староста'; end if;
  if p_status not in ('banned', 'approved') then raise exception 'Недопустимый статус'; end if;
  if p_uid = auth.uid() or exists (select 1 from public.admins x where x.uid = p_uid) then raise exception 'Старосту банить нельзя'; end if;
  insert into public.members (tenant_id, uid, role, status, decided_at, decided_by, email)
    values (t, p_uid, case when exists (select 1 from public.teachers x where x.uid = p_uid) then 'teacher' else 'student' end, p_status, now(), auth.uid(), coalesce((select a.email from auth.users a where a.id = p_uid), ''))
    on conflict (tenant_id, uid) do update set status = p_status, decided_at = now(), decided_by = auth.uid();
  if p_status = 'banned' then
    begin
      delete from auth.refresh_tokens where user_id::text = p_uid::text;
      delete from auth.sessions where user_id = p_uid;
    exception when others then null;
    end;
  end if;
end $$;
create or replace function public.admin_delete_user(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t text := public.current_tenant();
begin
  if not public.is_admin() then raise exception 'Только староста'; end if;
  if p_uid = auth.uid() or exists (select 1 from public.admins x where x.uid = p_uid) then raise exception 'Старосту удалить нельзя'; end if;
  delete from public.docs d where d.tenant_id = t and (public.doc_owner(d.path) = p_uid::text or (d.path like 'claims/%' and d.data::text like '%' || p_uid::text || '%'));
  delete from public.chat where thread_uid = p_uid or sender = p_uid;
  delete from public.news_comments where author = p_uid;
  delete from public.news_likes where uid = p_uid;
  update public.news set created_by = null where created_by = p_uid;
  delete from auth.users where id = p_uid;
end $$;
revoke all on function public.admin_users(), public.admin_set_status(uuid, text), public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_users(), public.admin_set_status(uuid, text), public.admin_delete_user(uuid) to authenticated;

-- 16. Аналитика (читает только админ). Таблица готова; приложение начнёт её заполнять в одном из следующих шагов.
create table if not exists public.analytics (
  id         bigserial primary key,
  tenant_id  text not null default 'group_1',
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role       text not null default 'student' check (role in ('student', 'admin', 'teacher')),
  action     text not null check (char_length(action) between 1 and 60),
  page       text check (page is null or char_length(page) <= 60),
  metadata   jsonb not null default '{}'::jsonb check (pg_column_size(metadata) < 4000),
  created_at timestamptz not null default now()
);
create index if not exists analytics_tenant_time_idx on public.analytics (tenant_id, created_at desc);
create index if not exists analytics_user_idx on public.analytics (user_id, created_at desc);
alter table public.analytics enable row level security;
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'analytics' loop execute format('drop policy %I on public.analytics', r.policyname); end loop;
end $$;
create policy analytics_insert on public.analytics for insert with check (user_id = auth.uid() and tenant_id = (select public.current_tenant()));
create policy analytics_admin_read on public.analytics for select using (tenant_id = (select public.current_tenant()) and public.is_admin());
create or replace function public.analytics_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.role := case when public.is_admin() then 'admin' when public.is_teacher() then 'teacher' else 'student' end;
  return new;
end $$;
drop trigger if exists trg_a_tenant_analytics on public.analytics;
create trigger trg_a_tenant_analytics before insert or update on public.analytics for each row execute function public.set_tenant();
drop trigger if exists trg_b_analytics_fill on public.analytics;
create trigger trg_b_analytics_fill before insert on public.analytics for each row execute function public.analytics_fill();
revoke all on public.analytics from anon, authenticated;
grant select, insert on public.analytics to authenticated;
grant usage, select on sequence public.analytics_id_seq to authenticated;

-- ============================================================
-- 20. Ввод посещаемости из бумажного журнала (только староста)
-- ============================================================
create table if not exists public.attendance_import (
  tenant_id text not null,
  rid text not null,
  key text not null,
  mark text not null check (mark in ('п', 'н')),
  status text not null default 'queued' check (status in ('queued', 'applied', 'skipped')),
  was_applied boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (tenant_id, rid, key)
);
alter table public.attendance_import enable row level security;
revoke all on public.attendance_import from anon, authenticated;

create or replace function public.apply_import_for(p_tenant text, p_uid text, p_rid text) returns int
language plpgsql security definer set search_path = public as $$
declare cur jsonb; r record; n int := 0;
begin
  if not exists (select 1 from public.attendance_import i where i.tenant_id = p_tenant and i.rid = p_rid and i.status = 'queued') then return 0; end if;
  perform set_config('app.import', 'on', true);
  select coalesce(d.data -> 'marks', '{}'::jsonb) into cur from public.docs d where d.tenant_id = p_tenant and d.path = 'attendance/' || p_uid;
  cur := coalesce(cur, '{}'::jsonb);
  for r in select i.key, i.mark, i.was_applied from public.attendance_import i where i.tenant_id = p_tenant and i.rid = p_rid and i.status = 'queued' loop
    if (not (cur ? r.key)) or r.was_applied then
      cur := cur || jsonb_build_object(r.key, r.mark);
      update public.attendance_import set status = 'applied' where tenant_id = p_tenant and rid = p_rid and key = r.key;
      n := n + 1;
    else
      update public.attendance_import set status = 'skipped' where tenant_id = p_tenant and rid = p_rid and key = r.key;
    end if;
  end loop;
  if n > 0 then
    insert into public.docs (tenant_id, path, data)
    values (p_tenant, 'attendance/' || p_uid, jsonb_build_object('marks', cur, 'updated', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))
    on conflict (tenant_id, path) do update
      set data = jsonb_set(coalesce(public.docs.data, '{}'::jsonb), '{marks}', cur) || jsonb_build_object('updated', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  end if;
  return n;
end $$;

create or replace function public.trg_import_on_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.data ->> 'rid', '') <> '' then
    perform public.apply_import_for(new.tenant_id, split_part(new.path, '/', 2), new.data ->> 'rid');
  end if;
  return null;
end $$;
drop trigger if exists trg_docs_import on public.docs;
create trigger trg_docs_import after insert or update on public.docs
  for each row when (new.path like 'profiles/%' and new.path not like 'profiles/%/%')
  execute function public.trg_import_on_profile();

create or replace function public.import_attendance(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t text := public.current_tenant(); it jsonb; k text; v_rid text; applied int := 0; r record;
begin
  if not public.is_admin() then raise exception 'Только староста'; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    k := it ->> 'key';
    if k is null or k !~ '^\d{4}-\d{2}-\d{2}\|[1-9]$' then raise exception 'Неверная пара: %', coalesce(k, ''); end if;
    for v_rid in select jsonb_array_elements_text(coalesce(it -> 'absent', '[]'::jsonb)) loop
      if v_rid !~ '^r([1-9]|[12][0-9]|3[0-2])$' then raise exception 'Неверный номер: %', v_rid; end if;
      insert into public.attendance_import (tenant_id, rid, key, mark) values (t, v_rid, k, 'н')
        on conflict (tenant_id, rid, key) do update set mark = 'н', was_applied = (public.attendance_import.status = 'applied'), status = 'queued';
    end loop;
    for v_rid in select jsonb_array_elements_text(coalesce(it -> 'present', '[]'::jsonb)) loop
      if v_rid !~ '^r([1-9]|[12][0-9]|3[0-2])$' then raise exception 'Неверный номер: %', v_rid; end if;
      insert into public.attendance_import (tenant_id, rid, key, mark) values (t, v_rid, k, 'п')
        on conflict (tenant_id, rid, key) do update set mark = 'п', was_applied = (public.attendance_import.status = 'applied'), status = 'queued';
    end loop;
  end loop;
  for r in select split_part(d.path, '/', 2) as uid, d.data ->> 'rid' as rid from public.docs d
           where d.tenant_id = t and d.path like 'profiles/%' and d.path not like 'profiles/%/%' and coalesce(d.data ->> 'rid', '') <> '' loop
    applied := applied + public.apply_import_for(t, r.uid, r.rid);
  end loop;
  return jsonb_build_object('applied', applied, 'queued', (select count(*) from public.attendance_import i where i.tenant_id = t and i.status = 'queued'));
end $$;

create or replace function public.import_attendance_undo(p_key text) returns int
language plpgsql security definer set search_path = public as $$
declare t text := public.current_tenant(); r record; uid text; n int := 0;
begin
  if not public.is_admin() then raise exception 'Только староста'; end if;
  perform set_config('app.import', 'on', true);
  for r in select i.rid, i.mark from public.attendance_import i where i.tenant_id = t and i.key = p_key and i.status = 'applied' loop
    select split_part(d.path, '/', 2) into uid from public.docs d
      where d.tenant_id = t and d.path like 'profiles/%' and d.path not like 'profiles/%/%' and d.data ->> 'rid' = r.rid limit 1;
    if uid is not null then
      update public.docs set data = jsonb_set(data, '{marks}', (data -> 'marks') - p_key)
        where tenant_id = t and path = 'attendance/' || uid and data -> 'marks' ->> p_key = r.mark;
      if found then n := n + 1; end if;
    end if;
  end loop;
  delete from public.attendance_import where tenant_id = t and key = p_key;
  return n;
end $$;

create or replace function public.import_attendance_summary() returns table (key text, absent bigint, present bigint, applied bigint, queued bigint, skipped bigint)
language sql security definer set search_path = public as $$
  select i.key,
         count(*) filter (where i.mark = 'н'), count(*) filter (where i.mark = 'п'),
         count(*) filter (where i.status = 'applied'), count(*) filter (where i.status = 'queued'), count(*) filter (where i.status = 'skipped')
  from public.attendance_import i
  where i.tenant_id = public.current_tenant() and public.is_admin()
  group by i.key order by i.key
$$;

revoke all on function public.apply_import_for(text, text, text), public.trg_import_on_profile(), public.import_attendance(jsonb), public.import_attendance_undo(text), public.import_attendance_summary() from public, anon, authenticated;
grant execute on function public.import_attendance(jsonb), public.import_attendance_undo(text), public.import_attendance_summary() to authenticated;

notify pgrst, 'reload schema';
