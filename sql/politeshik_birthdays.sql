-- =====================================================================================
--  ПОЛИТЕШИК: дни рождения, поздравления в новостях, лайки. Дополнение к уже выполненному скрипту.
--  Supabase -> SQL Editor -> New query -> вставить ВСЁ -> Run. Пароли вписывать не нужно. Можно запускать повторно.
--  (Тот же текст уже включён в основной файл politeshik.sql.)
-- =====================================================================================
create extension if not exists pgcrypto;

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

notify pgrst, 'reload schema';
