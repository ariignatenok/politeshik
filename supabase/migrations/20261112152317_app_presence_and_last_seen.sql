-- App activity is separate from persistent club membership. Each browser page owns its session.
-- The user already requested cross-group public social profiles and peer chats, and now requested activity in those profiles.
-- Preserve the existing social_profile authorization and all educational tenant policies.
-- The new heartbeat endpoint writes AND RETURNS ONLY auth.uid(); it does not list other members or their activity.
create table politeshik_private.presence_sessions(
 uid uuid not null references auth.users(id) on delete cascade,session_id uuid not null,
 seen_at timestamptz not null default now(),active boolean not null default true,primary key(uid,session_id));
alter table politeshik_private.presence_sessions enable row level security;
revoke all on politeshik_private.presence_sessions from public,anon,authenticated;
create policy presence_rpc_only on politeshik_private.presence_sessions as restrictive for all to authenticated using(false) with check(false);
create function politeshik_private.presence_status(p_uid uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('online',coalesce(bool_or(active and seen_at>now()-interval '60 seconds'),false),'last_seen',max(seen_at))
 from politeshik_private.presence_sessions where uid=p_uid
$$;
revoke all on function politeshik_private.presence_status(uuid) from public,anon,authenticated;
create or replace function politeshik_private.social_profile(p_uid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor(); result jsonb;
begin
 select jsonb_build_object('uid',m.uid,'name',case when sa.uid is not null then 'Админ Арина' else coalesce(nullif(m.full_name,''),nullif(p.data->>'name',''),'Студент') end,
  'group_name',coalesce(g.name,m.tenant_id),'role',case when sa.uid is not null then 'superadmin' else m.role end,
  'avatar',coalesce(a.data->>'v',''),'mascot',coalesce(a.data->'mascot',p.data->'mascot','{}'),
  'about',left(coalesce(p.data->>'about',''),500),
  'mascot_likes',(select count(*) from politeshik_private.profile_likes where target=m.uid and kind='mascot'),
  'photo_likes',(select count(*) from politeshik_private.profile_likes where target=m.uid and kind='photo'),
  'liked_mascot',exists(select 1 from politeshik_private.profile_likes where target=m.uid and sender=actor and kind='mascot'),
  'liked_photo',exists(select 1 from politeshik_private.profile_likes where target=m.uid and sender=actor and kind='photo')) into result
 from public.members m join auth.users u on u.id=m.uid
 left join public.groups g on g.tenant_id=m.tenant_id and g.id=m.group_id
 left join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||m.uid::text
 left join public.docs a on a.tenant_id=m.tenant_id and a.path='avatars/'||m.uid::text
 left join politeshik_private.super_admins sa on sa.uid=m.uid
 where m.uid=p_uid and m.status='approved' and m.role in('student','admin','developer') and coalesce(m.requested_role,'student')<>'parent' and u.email_confirmed_at is not null;
 return case when result is null then null else result||politeshik_private.presence_status(p_uid) end;
end $$;

create function politeshik_private.social_presence(p_session uuid,p_active boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor();
begin
 if p_session is null or p_active is null then raise exception 'Неверная сессия';end if;
 insert into politeshik_private.presence_sessions(uid,session_id,seen_at,active) values(actor,p_session,now(),p_active)
 on conflict(uid,session_id) do update set active=excluded.active,
  seen_at=case when excluded.active or politeshik_private.presence_sessions.active then now() else politeshik_private.presence_sessions.seen_at end;
 -- Bound the stored sessions for one account while preserving multiple active devices.
 delete from politeshik_private.presence_sessions s where s.uid=actor and s.session_id in(
  select session_id from politeshik_private.presence_sessions where uid=actor order by seen_at desc,session_id limit all offset 16);
 return jsonb_build_object('server_now',now(),'person',jsonb_build_object('uid',actor)||politeshik_private.presence_status(actor));
end $$;
revoke all on function politeshik_private.social_presence(uuid,boolean) from public,anon;
grant execute on function politeshik_private.social_presence(uuid,boolean) to authenticated;
create function public.social_presence(p_session uuid,p_active boolean default true) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.social_presence(p_session,p_active)$$;
revoke all on function public.social_presence(uuid,boolean) from public,anon;
grant execute on function public.social_presence(uuid,boolean) to authenticated;
