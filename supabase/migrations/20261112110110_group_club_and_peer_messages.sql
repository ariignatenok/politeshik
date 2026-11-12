-- Social profiles and peer conversations are independent of educational tenants.
-- Only the explicitly public profile fields cross groups; education/support policies stay intact.
create table politeshik_private.club_visitors(
 uid uuid primary key references auth.users(id) on delete cascade,
 seen_at timestamptz not null default now(), dancing boolean not null default true);
create table politeshik_private.profile_likes(
 sender uuid not null references auth.users(id) on delete cascade,
 target uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in('mascot','photo')), created_at timestamptz not null default now(),
 primary key(sender,target,kind),check(sender<>target));
create index profile_likes_target_idx on politeshik_private.profile_likes(target,kind);
create table politeshik_private.peer_messages(
 id uuid primary key default gen_random_uuid(),sender uuid not null references auth.users(id) on delete cascade,
 recipient uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 4000),
 created_at timestamptz not null default now(),read_at timestamptz,check(sender<>recipient));
create index peer_messages_sender_idx on politeshik_private.peer_messages(sender,recipient,created_at desc);
create index peer_messages_recipient_idx on politeshik_private.peer_messages(recipient,sender,created_at desc);
alter table politeshik_private.club_visitors enable row level security;
alter table politeshik_private.profile_likes enable row level security;
alter table politeshik_private.peer_messages enable row level security;
revoke all on politeshik_private.club_visitors,politeshik_private.profile_likes,politeshik_private.peer_messages from public,anon,authenticated;

create function politeshik_private.social_actor() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.members m join auth.users u on u.id=m.uid
  where m.uid=auth.uid() and m.status='approved' and m.role in('student','admin','developer')
   and coalesce(m.requested_role,'student')<>'parent' and u.email_confirmed_at is not null) then
  raise exception 'Общение доступно после одобрения регистрации студента' using errcode='42501';end if;
 return auth.uid();
end $$;
revoke all on function politeshik_private.social_actor() from public,anon,authenticated;

create function politeshik_private.social_profile(p_uid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
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
 return result;
end $$;
revoke all on function politeshik_private.social_profile(uuid) from public,anon;
grant execute on function politeshik_private.social_profile(uuid) to authenticated;
create function public.social_profile(p_uid uuid) returns jsonb language sql stable security invoker set search_path='' as $$select politeshik_private.social_profile(p_uid)$$;
revoke all on function public.social_profile(uuid) from public,anon;grant execute on function public.social_profile(uuid) to authenticated;

create function politeshik_private.social_people(p_query text default '',p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor(); result jsonb;
begin
 if char_length(coalesce(p_query,''))>100 or p_offset<0 or p_offset>10000 then raise exception 'Неверный поиск';end if;
 select coalesce(jsonb_agg(politeshik_private.social_profile(uid) order by full_name,uid),'[]') into result from (
  select m.uid,coalesce(m.full_name,p.data->>'name','Студент') as full_name from public.members m join auth.users u on u.id=m.uid
  left join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||m.uid::text
  left join public.groups g on g.tenant_id=m.tenant_id and g.id=m.group_id
  where m.status='approved' and m.role in('student','admin','developer') and coalesce(m.requested_role,'student')<>'parent' and u.email_confirmed_at is not null
  and (coalesce(m.full_name,p.data->>'name','') ilike '%'||coalesce(p_query,'')||'%' or coalesce(g.name,'') ilike '%'||coalesce(p_query,'')||'%')
  order by full_name,m.uid limit 24 offset p_offset) people;
 return result;
end $$;
revoke all on function politeshik_private.social_people(text,integer) from public,anon;grant execute on function politeshik_private.social_people(text,integer) to authenticated;
create function public.social_people(p_query text default '',p_offset integer default 0) returns jsonb language sql stable security invoker set search_path='' as $$select politeshik_private.social_people(p_query,p_offset)$$;
revoke all on function public.social_people(text,integer) from public,anon;grant execute on function public.social_people(text,integer) to authenticated;

create function politeshik_private.social_like(p_uid uuid,p_kind text,p_on boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor(); card jsonb;
begin
 if p_kind is null or p_kind not in('mascot','photo') or p_on is null or p_uid=actor then raise exception 'Неверный лайк';end if;
 card:=politeshik_private.social_profile(p_uid);if card is null then raise exception 'Профиль недоступен' using errcode='42501';end if;
 if p_kind='photo' and card->>'avatar'='' then raise exception 'У студента пока нет фото профиля';end if;
 if p_on then insert into politeshik_private.profile_likes(sender,target,kind) values(actor,p_uid,p_kind) on conflict do nothing;
 else delete from politeshik_private.profile_likes where sender=actor and target=p_uid and kind=p_kind;end if;
 return politeshik_private.social_profile(p_uid);
end $$;
revoke all on function politeshik_private.social_like(uuid,text,boolean) from public,anon;grant execute on function politeshik_private.social_like(uuid,text,boolean) to authenticated;
create function public.social_like(p_uid uuid,p_kind text,p_on boolean) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.social_like(p_uid,p_kind,p_on)$$;
revoke all on function public.social_like(uuid,text,boolean) from public,anon;grant execute on function public.social_like(uuid,text,boolean) to authenticated;

create function politeshik_private.club_visit(p_action text default 'state',p_dancing boolean default true) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor(); visitors jsonb;
begin
 if p_action is null or p_action not in('state','join','beat','leave') then raise exception 'Неверное действие';end if;
 if p_action='join' then insert into politeshik_private.club_visitors(uid,dancing) values(actor,coalesce(p_dancing,true)) on conflict(uid) do update set seen_at=now(),dancing=excluded.dancing;
 elsif p_action='beat' then update politeshik_private.club_visitors set seen_at=now(),dancing=coalesce(p_dancing,true) where uid=actor;
 elsif p_action='leave' then delete from politeshik_private.club_visitors where uid=actor;end if;
 select coalesce(jsonb_agg(card||jsonb_build_object('dancing',v.dancing) order by v.uid),'[]') into visitors
 from politeshik_private.club_visitors v cross join lateral (select politeshik_private.social_profile(v.uid)-'avatar'-'about' as card) p
 where v.seen_at>now()-interval '75 seconds' and card is not null;
 return jsonb_build_object('visitors',visitors,'joined',exists(select 1 from politeshik_private.club_visitors where uid=actor and seen_at>now()-interval '75 seconds'));
end $$;
revoke all on function politeshik_private.club_visit(text,boolean) from public,anon;grant execute on function politeshik_private.club_visit(text,boolean) to authenticated;
create function public.club_visit(p_action text default 'state',p_dancing boolean default true) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.club_visit(p_action,p_dancing)$$;
revoke all on function public.club_visit(text,boolean) from public,anon;grant execute on function public.club_visit(text,boolean) to authenticated;

create function politeshik_private.peer_send(p_peer uuid,p_body text,p_nonce uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor(); message politeshik_private.peer_messages;
begin
 if p_peer=actor or politeshik_private.social_profile(p_peer) is null then raise exception 'Собеседник недоступен' using errcode='42501';end if;
 if p_nonce is null or p_body is null or char_length(btrim(p_body)) not between 1 and 4000 then raise exception 'Сообщение: от 1 до 4000 символов';end if;
 insert into politeshik_private.peer_messages(id,sender,recipient,body) values(p_nonce,actor,p_peer,btrim(p_body)) on conflict(id) do nothing returning * into message;
 if message.id is null then select * into message from politeshik_private.peer_messages where id=p_nonce and sender=actor and recipient=p_peer and body=btrim(p_body);end if;
 if message.id is null then raise exception 'Неверный идентификатор сообщения';end if;
 return to_jsonb(message);
end $$;
revoke all on function politeshik_private.peer_send(uuid,text,uuid) from public,anon;grant execute on function politeshik_private.peer_send(uuid,text,uuid) to authenticated;
create function public.peer_send(p_peer uuid,p_body text,p_nonce uuid) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.peer_send(p_peer,p_body,p_nonce)$$;
revoke all on function public.peer_send(uuid,text,uuid) from public,anon;grant execute on function public.peer_send(uuid,text,uuid) to authenticated;

create function politeshik_private.peer_messages(p_peer uuid,p_before timestamptz default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor(); result jsonb;
begin
 if p_peer=actor or politeshik_private.social_profile(p_peer) is null then raise exception 'Собеседник недоступен' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at,m.id),'[]') into result from
 (select * from politeshik_private.peer_messages where ((sender=actor and recipient=p_peer) or (sender=p_peer and recipient=actor))
 and (p_before is null or created_at<p_before) order by created_at desc,id desc limit 80) m;
 return result;
end $$;
revoke all on function politeshik_private.peer_messages(uuid,timestamptz) from public,anon;grant execute on function politeshik_private.peer_messages(uuid,timestamptz) to authenticated;
create function public.peer_messages(p_peer uuid,p_before timestamptz default null) returns jsonb language sql stable security invoker set search_path='' as $$select politeshik_private.peer_messages(p_peer,p_before)$$;
revoke all on function public.peer_messages(uuid,timestamptz) from public,anon;grant execute on function public.peer_messages(uuid,timestamptz) to authenticated;

create function politeshik_private.peer_read(p_peer uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor();begin
 update politeshik_private.peer_messages set read_at=now() where sender=p_peer and recipient=actor and read_at is null;return true;
end $$;
revoke all on function politeshik_private.peer_read(uuid) from public,anon;grant execute on function politeshik_private.peer_read(uuid) to authenticated;
create function public.peer_read(p_peer uuid) returns boolean language sql security invoker set search_path='' as $$select politeshik_private.peer_read(p_peer)$$;
revoke all on function public.peer_read(uuid) from public,anon;grant execute on function public.peer_read(uuid) to authenticated;

create function politeshik_private.peer_inbox() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor(); result jsonb;
begin
 select coalesce(jsonb_agg(card||jsonb_build_object('last',body,'at',created_at,'unread',unread) order by created_at desc),'[]') into result from (
 select distinct on(peer) peer,body,created_at,
  (select count(*) from politeshik_private.peer_messages q where q.sender=z.peer and q.recipient=actor and q.read_at is null) as unread,
  politeshik_private.social_profile(peer) as card
 from (select case when sender=actor then recipient else sender end as peer,body,created_at,id from politeshik_private.peer_messages where sender=actor or recipient=actor) z
 order by peer,created_at desc,id desc) inbox where card is not null;
 return result;
end $$;
revoke all on function politeshik_private.peer_inbox() from public,anon;grant execute on function politeshik_private.peer_inbox() to authenticated;
create function public.peer_inbox() returns jsonb language sql stable security invoker set search_path='' as $$select politeshik_private.peer_inbox()$$;
revoke all on function public.peer_inbox() from public,anon;grant execute on function public.peer_inbox() to authenticated;
