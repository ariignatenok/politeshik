-- Notifications originate from Auth password-login records, not from browser claims.
-- Delivery stays disabled until SMTP has been configured and verified by the owner.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema politeshik_private to service_role;
create table politeshik_private.login_mail_settings(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into politeshik_private.login_mail_settings(singleton,enabled)values(true,false);
create table politeshik_private.login_mail_outbox(
 id uuid primary key default gen_random_uuid(),session_id uuid not null unique,
 uid uuid not null references auth.users(id)on delete cascade,occurred_at timestamptz not null,
 token_hash bytea,token_expires_at timestamptz,attempts integer not null default 0 check(attempts between 0 and 3),
 last_attempt_at timestamptz,lease_until timestamptz,sent_at timestamptz,last_error text,
 created_at timestamptz not null default clock_timestamp()
);
create index login_mail_pending on politeshik_private.login_mail_outbox(created_at)where sent_at is null;
alter table politeshik_private.login_mail_settings enable row level security;
alter table politeshik_private.login_mail_outbox enable row level security;
revoke all on politeshik_private.login_mail_settings,politeshik_private.login_mail_outbox from public,anon,authenticated;
create policy login_mail_settings_internal on politeshik_private.login_mail_settings as restrictive for all to authenticated using(false)with check(false);
create policy login_mail_outbox_internal on politeshik_private.login_mail_outbox as restrictive for all to authenticated using(false)with check(false);
revoke all on net.http_request_queue,net._http_response from public,anon,authenticated;
revoke all on schema net,cron from public,anon,authenticated;

create function politeshik_private.dispatch_login_notices(p_id uuid default null)returns integer language plpgsql security definer set search_path=''as $$
declare item record;secret text;total integer:=0;begin
 if not exists(select 1 from politeshik_private.login_mail_settings where enabled)then return 0;end if;
 for item in select id from politeshik_private.login_mail_outbox where sent_at is null and attempts<3
 and created_at>clock_timestamp()-interval'15 minutes'and(lease_until is null or lease_until<clock_timestamp())
 and(last_attempt_at is null or last_attempt_at<clock_timestamp()-interval'2 minutes')and(p_id is null or id=p_id)
 order by created_at limit 20 for update skip locked loop
  secret:=encode(extensions.gen_random_bytes(32),'hex');
  update politeshik_private.login_mail_outbox set token_hash=extensions.digest(secret,'sha256'),token_expires_at=clock_timestamp()+interval'90 seconds',
   attempts=attempts+1,last_attempt_at=clock_timestamp()where id=item.id;
  perform net.http_post(url:='https://mrxqzzaayyaiwyarwqsg.supabase.co/functions/v1/login-notice',
   body:=jsonb_build_object('event_id',item.id,'token',secret),headers:='{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds:=10000);
  total:=total+1;
 end loop;
 return total;
end $$;
revoke all on function politeshik_private.dispatch_login_notices(uuid)from public,anon,authenticated;
create function politeshik_private.queue_password_login_notice()returns trigger language plpgsql security definer set search_path=''as $$
declare event_id uuid;begin
 if new.authentication_method<>'password'or not exists(select 1 from politeshik_private.login_mail_settings where enabled)then return new;end if;
 insert into politeshik_private.login_mail_outbox(session_id,uid,occurred_at)
 select s.id,s.user_id,coalesce(new.created_at,s.created_at,clock_timestamp())from auth.sessions s where s.id=new.session_id
 on conflict(session_id)do nothing returning id into event_id;
 if event_id is not null then perform politeshik_private.dispatch_login_notices(event_id);end if;
 return new;
exception when others then
 -- A mail-service outage must not block authentication. Never log tokens or SMTP errors.
 raise log 'Politeshik login mail enqueue failed';return new;
end $$;
revoke all on function politeshik_private.queue_password_login_notice()from public,anon,authenticated;
create trigger politeshik_password_login_notice after insert on auth.mfa_amr_claims for each row execute function politeshik_private.queue_password_login_notice();

create function politeshik_private.claim_login_notice(p_id uuid,p_token text)returns jsonb language plpgsql security definer set search_path=''as $$
declare item politeshik_private.login_mail_outbox;recipient text;begin
 if length(coalesce(p_token,''))<>64 then return null;end if;
 if not exists(select 1 from politeshik_private.login_mail_settings where enabled)then return null;end if;
 select*into item from politeshik_private.login_mail_outbox where id=p_id for update;
 if not found or item.sent_at is not null or item.token_expires_at<clock_timestamp()or item.token_hash is distinct from extensions.digest(p_token,'sha256')
 or(item.lease_until is not null and item.lease_until>clock_timestamp())then return null;end if;
 select email into recipient from auth.users where id=item.uid and deleted_at is null;
 if recipient is null then return null;end if;
 update politeshik_private.login_mail_outbox set lease_until=clock_timestamp()+interval'90 seconds'where id=p_id;
 return jsonb_build_object('id',item.id,'email',recipient,'occurred_at',item.occurred_at);
end $$;
revoke all on function politeshik_private.claim_login_notice(uuid,text)from public,anon,authenticated;
grant execute on function politeshik_private.claim_login_notice(uuid,text)to service_role;
create function public.claim_login_notice(p_id uuid,p_token text)returns jsonb language sql security invoker set search_path=''as $$select politeshik_private.claim_login_notice(p_id,p_token)$$;
revoke all on function public.claim_login_notice(uuid,text)from public,anon,authenticated;
grant execute on function public.claim_login_notice(uuid,text)to service_role;
create function politeshik_private.finish_login_notice(p_id uuid,p_token text,p_success boolean)returns boolean language plpgsql security definer set search_path=''as $$
begin
 update politeshik_private.login_mail_outbox set sent_at=case when p_success then clock_timestamp()else null end,
  lease_until=null,last_error=case when p_success then null else'SMTP_DELIVERY_FAILED'end,
  token_hash=null,token_expires_at=null
 where id=p_id and sent_at is null and token_hash=extensions.digest(p_token,'sha256')and lease_until is not null;
 return found;
end $$;
revoke all on function politeshik_private.finish_login_notice(uuid,text,boolean)from public,anon,authenticated;
grant execute on function politeshik_private.finish_login_notice(uuid,text,boolean)to service_role;
create function public.finish_login_notice(p_id uuid,p_token text,p_success boolean)returns boolean language sql security invoker set search_path=''as $$select politeshik_private.finish_login_notice(p_id,p_token,p_success)$$;
revoke all on function public.finish_login_notice(uuid,text,boolean)from public,anon,authenticated;
grant execute on function public.finish_login_notice(uuid,text,boolean)to service_role;
select cron.schedule('politeshik-login-email-retry','*/2 * * * *','select politeshik_private.dispatch_login_notices();');
