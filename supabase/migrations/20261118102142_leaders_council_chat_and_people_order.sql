-- One cross-group council chat. Membership is computed from actual current leader/deputy grants.
-- Academic policies, admin checks and existing group/curator rooms are unchanged.
create table politeshik_private.leader_chat_messages(
 seq bigint generated always as identity primary key,id uuid not null unique,
 sender uuid not null references auth.users(id) on delete cascade,
 name text not null,group_name text not null,sender_role text not null check(sender_role in('admin','superadmin','deputy')),
 body text not null check(char_length(btrim(body)) between 1 and 4000),created_at timestamptz not null default now());
create index leader_chat_sender_idx on politeshik_private.leader_chat_messages(sender);
create table politeshik_private.leader_chat_reads(
 uid uuid primary key references auth.users(id) on delete cascade,read_seq bigint not null default 0);
alter table politeshik_private.leader_chat_messages enable row level security;
alter table politeshik_private.leader_chat_reads enable row level security;
revoke all on politeshik_private.leader_chat_messages,politeshik_private.leader_chat_reads from public,anon,authenticated;
create policy leader_chat_messages_private on politeshik_private.leader_chat_messages for all to public using(false) with check(false);
create policy leader_chat_reads_private on politeshik_private.leader_chat_reads for all to public using(false) with check(false);

create function politeshik_private.leader_chat_members() returns table(uid uuid,name text,group_name text,role text,tenant_id text)
language sql stable security definer set search_path='' as $$
 select m.uid,case when s.uid is not null then 'Админ Арина' else coalesce(nullif(m.full_name,''),p.data->>'name','Участник') end,
 coalesce(g.name,m.tenant_id),case when s.uid is not null then 'superadmin' when m.role='admin' then 'admin' else 'deputy' end,m.tenant_id
 from public.members m join auth.users u on u.id=m.uid and u.email_confirmed_at is not null
 left join public.groups g on g.tenant_id=m.tenant_id and g.id=m.group_id
 left join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||m.uid::text
 left join politeshik_private.super_admins s on s.uid=m.uid
 where m.status='approved' and coalesce(m.requested_role,'student')='student'
 and(s.uid is not null or(m.role='admin' and exists(select 1 from public.admins a where a.uid=m.uid and a.tenant_id=m.tenant_id)) or politeshik_private.is_deputy(m.uid))
$$;
revoke all on function politeshik_private.leader_chat_members() from public,anon,authenticated;
create function politeshik_private.leader_chat_actor() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from politeshik_private.leader_chat_members() m where m.uid=auth.uid()) then
 raise exception 'Этот чат доступен только старостам и действующим замам' using errcode='42501';end if;
 return auth.uid();
end $$;
revoke all on function politeshik_private.leader_chat_actor() from public,anon,authenticated;
create function politeshik_private.leader_chat_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();result jsonb;begin
 if actor is null then raise exception 'Войдите в аккаунт' using errcode='42501';end if;
 if not exists(select 1 from politeshik_private.leader_chat_members()m where m.uid=actor) then return jsonb_build_object('allowed',false);end if;
 select jsonb_build_object('allowed',true,'name','Старосты и замы','members_count',(select count(*) from politeshik_private.leader_chat_members()),
 'last',(select left(body,120)from politeshik_private.leader_chat_messages order by seq desc limit 1),
 'at',(select created_at from politeshik_private.leader_chat_messages order by seq desc limit 1),
 'unread',(select count(*)from politeshik_private.leader_chat_messages where sender<>actor and seq>coalesce((select read_seq from politeshik_private.leader_chat_reads where uid=actor),0)))into result;
 return result;
end $$;
create function public.leader_chat_state() returns jsonb language sql stable security invoker set search_path='' as $$select politeshik_private.leader_chat_state()$$;
create function politeshik_private.leader_chat_messages(p_before bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.leader_chat_actor();result jsonb;seen bigint;begin
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'seq',q.seq,'sender',q.sender,'body',q.body,'created_at',q.created_at,
 'name',q.name,'role',q.sender_role,'group_name',q.group_name,'avatar',coalesce(v.data->>'v',''),'mascot',coalesce(v.data->'mascot',p.data->'mascot','{}'),
 'read_count',(select count(*)from politeshik_private.leader_chat_reads r join politeshik_private.leader_chat_members()member on member.uid=r.uid where r.uid<>q.sender and r.read_seq>=q.seq))order by q.seq),'[]'),max(q.seq)into result,seen
 from(select * from politeshik_private.leader_chat_messages where p_before is null or seq<p_before order by seq desc limit 100)q
 left join public.members m on m.uid=q.sender
 left join public.docs v on v.tenant_id=m.tenant_id and v.path='avatars/'||q.sender::text
 left join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||q.sender::text;
 if seen is not null then insert into politeshik_private.leader_chat_reads(uid,read_seq)values(actor,seen)on conflict(uid)do update set read_seq=greatest(politeshik_private.leader_chat_reads.read_seq,excluded.read_seq);end if;
 return result;
end $$;
create function public.leader_chat_messages(p_before bigint default null) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.leader_chat_messages(p_before)$$;
create function politeshik_private.leader_chat_send(p_body text,p_nonce uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.leader_chat_actor();member record;message politeshik_private.leader_chat_messages;begin
 if p_nonce is null or p_body is null or char_length(btrim(p_body)) not between 1 and 4000 then raise exception 'Сообщение: от 1 до 4000 символов';end if;
 select * into member from politeshik_private.leader_chat_members()where uid=actor;
 insert into politeshik_private.leader_chat_messages(id,sender,name,group_name,sender_role,body)values(p_nonce,actor,member.name,member.group_name,member.role,btrim(p_body))on conflict(id)do nothing returning * into message;
 if message.id is null then select * into message from politeshik_private.leader_chat_messages where id=p_nonce and sender=actor and body=btrim(p_body);end if;
 if message.id is null then raise exception 'Неверный идентификатор сообщения';end if;
 return jsonb_build_object('id',message.id,'seq',message.seq);
end $$;
create function public.leader_chat_send(p_body text,p_nonce uuid) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.leader_chat_send(p_body,p_nonce)$$;
revoke all on function politeshik_private.leader_chat_state(),politeshik_private.leader_chat_messages(bigint),politeshik_private.leader_chat_send(text,uuid),public.leader_chat_state(),public.leader_chat_messages(bigint),public.leader_chat_send(text,uuid) from public,anon;
grant execute on function politeshik_private.leader_chat_state(),politeshik_private.leader_chat_messages(bigint),politeshik_private.leader_chat_send(text,uuid),public.leader_chat_state(),public.leader_chat_messages(bigint),public.leader_chat_send(text,uuid) to authenticated;

-- Sort before LIMIT/OFFSET so every page keeps leaders, then deputies, then other students.
create or replace function politeshik_private.social_people(p_query text default '',p_offset integer default 0)returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor();result jsonb;begin
 if char_length(coalesce(p_query,''))>100 or p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Неверный поиск';end if;
 select coalesce(jsonb_agg(politeshik_private.social_profile(uid)order by priority,full_name,uid),'[]')into result from(
 select m.uid,case when m.role='admin' or exists(select 1 from politeshik_private.super_admins s where s.uid=m.uid)then 0 when politeshik_private.is_deputy(m.uid)then 1 else 2 end as priority,
 coalesce(m.full_name,p.data->>'name','Студент')as full_name
 from public.members m join auth.users u on u.id=m.uid
 left join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||m.uid::text
 left join public.groups g on g.tenant_id=m.tenant_id and g.id=m.group_id
 where m.status='approved' and m.role in('student','admin','developer')and coalesce(m.requested_role,'student')<>'parent'and u.email_confirmed_at is not null
 and(coalesce(m.full_name,p.data->>'name','')ilike '%'||coalesce(p_query,'')||'%' or coalesce(g.name,'')ilike '%'||coalesce(p_query,'')||'%')
 order by priority,full_name,m.uid limit 24 offset p_offset)people;
 return result;
end $$;
