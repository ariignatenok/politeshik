-- Local rehearsal substitutes; never install these on Supabase.
do $$begin if current_database()not like'politeshik_%rehearsal'then raise exception 'Local rehearsal only';end if;end $$;
create schema if not exists net;
create schema if not exists cron;
create table if not exists net.http_request_queue(id bigint generated always as identity primary key,url text,body jsonb);
create table if not exists net._http_response(id bigint primary key);
create or replace function net.http_post(url text,body jsonb default'{}',params jsonb default'{}',headers jsonb default'{}',timeout_milliseconds integer default 5000)returns bigint language sql as $$insert into net.http_request_queue(url,body)values(url,body)returning id$$;
create or replace function cron.schedule(job_name text,schedule text,command text)returns bigint language sql as $$select 1::bigint$$;
create table if not exists auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id),created_at timestamptz default now());
create table if not exists auth.mfa_amr_claims(id uuid primary key default gen_random_uuid(),session_id uuid references auth.sessions(id),authentication_method text not null,created_at timestamptz default now(),updated_at timestamptz default now());

alter table auth.users add column if not exists deleted_at timestamptz;
create schema if not exists vault;
create table if not exists vault.decrypted_secrets(id uuid primary key default gen_random_uuid(),name text unique,decrypted_secret text not null);
create or replace function vault.create_secret(new_secret text,new_name text,new_description text)returns uuid language sql as $$insert into vault.decrypted_secrets(name,decrypted_secret)values(new_name,new_secret)returning id$$;
revoke all on schema vault from public,anon,authenticated;
revoke all on vault.decrypted_secrets from public,anon,authenticated;
