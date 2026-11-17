-- Managed pg_net tables can retain PUBLIC grants from their extension owner.
-- Confidential webhook capabilities are encrypted and authenticated independently.
alter table politeshik_private.login_mail_settings add column dispatch_key_id uuid;
do $$declare key_id uuid;begin
 select id into key_id from vault.decrypted_secrets where name='politeshik_login_dispatch_key'limit 1;
 if key_id is null then select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'politeshik_login_dispatch_key','Encrypted login-notice transport key')into key_id;end if;
 update politeshik_private.login_mail_settings set dispatch_key_id=key_id;
end $$;
create or replace function politeshik_private.dispatch_login_notices(p_id uuid default null)returns integer language plpgsql security definer set search_path=''as $$
declare item record;secret text;dispatch_key text;iv bytea;cipher bytea;mac bytea;message text;total integer:=0;begin
 select v.decrypted_secret into dispatch_key from politeshik_private.login_mail_settings s join vault.decrypted_secrets v on v.id=s.dispatch_key_id where s.enabled;
 if dispatch_key is null then return 0;end if;
 for item in select id from politeshik_private.login_mail_outbox where sent_at is null and attempts<3
 and created_at>clock_timestamp()-interval'15 minutes'and(lease_until is null or lease_until<clock_timestamp())
 and(last_attempt_at is null or last_attempt_at<clock_timestamp()-interval'2 minutes')and(p_id is null or id=p_id)
 order by created_at limit 20 for update skip locked loop
  secret:=encode(extensions.gen_random_bytes(32),'hex');iv:=extensions.gen_random_bytes(16);
  update politeshik_private.login_mail_outbox set token_hash=extensions.digest(secret,'sha256'),token_expires_at=clock_timestamp()+interval'90 seconds',attempts=attempts+1,last_attempt_at=clock_timestamp()where id=item.id;
  cipher:=extensions.encrypt_iv(convert_to(jsonb_build_object('event_id',item.id,'token',secret)::text,'utf8'),extensions.digest('enc:'||dispatch_key,'sha256'),iv,'aes-cbc/pad:pkcs');
  message:=item.id::text||E'\n'||encode(iv,'hex')||E'\n'||encode(cipher,'hex');
  mac:=extensions.hmac(convert_to(message,'utf8'),extensions.digest('mac:'||dispatch_key,'sha256'),'sha256');
  perform net.http_post(url:='https://mrxqzzaayyaiwyarwqsg.supabase.co/functions/v1/login-notice',
   body:=jsonb_build_object('event_id',item.id,'iv',encode(iv,'hex'),'data',encode(cipher,'hex'),'mac',encode(mac,'hex')),
   headers:='{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds:=10000);
  total:=total+1;
 end loop;return total;
end $$;
