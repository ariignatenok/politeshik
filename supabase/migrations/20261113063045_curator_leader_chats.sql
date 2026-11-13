-- Separate work conversations: only an approved bound curator and approved admins of their scoped groups.
-- Does not broaden academic RLS, social_actor, peer messaging or tenant switching.
create table politeshik_private.curator_messages(
 id uuid primary key,tenant_id text not null references public.tenants(id),
 sender uuid not null references auth.users(id) on delete cascade,
 recipient uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 4000),
 created_at timestamptz not null default now(),read_at timestamptz,
 check(sender<>recipient)
);
create index curator_messages_sender_idx on politeshik_private.curator_messages(sender,tenant_id,recipient,created_at desc,id);
create index curator_messages_recipient_idx on politeshik_private.curator_messages(recipient,tenant_id,sender,created_at desc,id);
create index curator_messages_tenant_idx on politeshik_private.curator_messages(tenant_id);
alter table politeshik_private.curator_messages enable row level security;
revoke all on politeshik_private.curator_messages from public,anon,authenticated;
create policy curator_messages_rpc_only on politeshik_private.curator_messages as restrictive for all to authenticated using(false) with check(false);

create function politeshik_private.curator_chat_pairs()
 returns table(tenant_id text,group_name text,curator_uid uuid,leader_uid uuid,curator_name text,leader_name text)
 language sql stable security definer set search_path='' as $$
 select s.tenant_id,g.name,c.claimed_uid,l.uid,c.full_name,l.full_name
 from politeshik_private.curator_accounts c
 join politeshik_private.curator_group_scopes s on s.curator_id=c.id
 join public.groups g on g.tenant_id=s.tenant_id and g.id=s.group_id
 join public.members cm on cm.uid=c.claimed_uid and cm.tenant_id=c.home_tenant and cm.role='curator' and cm.status='approved' and cm.requested_role='staff'
 join auth.users cu on cu.id=cm.uid and cu.email_confirmed_at is not null
 left join (select m.tenant_id,m.group_id,m.uid,m.full_name from public.members m join auth.users u on u.id=m.uid and u.email_confirmed_at is not null where m.role='admin' and m.status='approved') l on l.tenant_id=s.tenant_id and l.group_id=s.group_id
 where c.active and auth.uid() is not null and (c.claimed_uid=auth.uid() or l.uid=auth.uid())
$$;
revoke all on function politeshik_private.curator_chat_pairs() from public,anon,authenticated;

create function politeshik_private.curator_chat_contacts() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();result jsonb;begin
 if actor is null then raise exception 'Войдите в аккаунт' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('tenant_id',p.tenant_id,'group_name',p.group_name,
 'peer_uid',case when actor=p.curator_uid then p.leader_uid else p.curator_uid end,
 'name',case when actor=p.curator_uid then p.leader_name else p.curator_name end,
 'role',case when actor=p.curator_uid then 'admin' else 'curator' end,
 'last',last_message.body,'at',last_message.created_at,
 'unread',(select count(*) from politeshik_private.curator_messages m where m.tenant_id=p.tenant_id and m.recipient=actor and m.sender=case when actor=p.curator_uid then p.leader_uid else p.curator_uid end and m.read_at is null)) order by p.tenant_id),'[]') into result
 from politeshik_private.curator_chat_pairs() p left join lateral (
 select m.body,m.created_at from politeshik_private.curator_messages m where m.tenant_id=p.tenant_id and ((m.sender=p.curator_uid and m.recipient=p.leader_uid) or(m.sender=p.leader_uid and m.recipient=p.curator_uid)) order by m.created_at desc,m.id desc limit 1
 )last_message on true;
 return result;
end $$;
revoke all on function politeshik_private.curator_chat_contacts() from public,anon;grant execute on function politeshik_private.curator_chat_contacts() to authenticated;
create function public.curator_chat_contacts() returns jsonb language sql stable security invoker set search_path='' as $$select politeshik_private.curator_chat_contacts()$$;
revoke all on function public.curator_chat_contacts() from public,anon;grant execute on function public.curator_chat_contacts() to authenticated;

create function politeshik_private.check_curator_chat(p_tenant text,p_peer uuid) returns uuid language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();begin
 if actor is null or p_peer is null or not exists(select 1 from politeshik_private.curator_chat_pairs() p where p.tenant_id=p_tenant and ((p.curator_uid=actor and p.leader_uid=p_peer) or(p.leader_uid=actor and p.curator_uid=p_peer))) then
 raise exception 'Этот чат недоступен: куратор и староста должны быть закреплены за одной группой' using errcode='42501';end if;
 return actor;
end $$;
revoke all on function politeshik_private.check_curator_chat(text,uuid) from public,anon,authenticated;

create function politeshik_private.curator_chat_messages(p_tenant text,p_peer uuid,p_before timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.check_curator_chat(p_tenant,p_peer);result jsonb;begin
 update politeshik_private.curator_messages set read_at=now() where tenant_id=p_tenant and sender=p_peer and recipient=actor and read_at is null;
 select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at,m.id),'[]') into result from
 (select * from politeshik_private.curator_messages where tenant_id=p_tenant and ((sender=actor and recipient=p_peer) or(sender=p_peer and recipient=actor)) and(p_before is null or created_at<p_before) order by created_at desc,id desc limit 100)m;
 return result;
end $$;
revoke all on function politeshik_private.curator_chat_messages(text,uuid,timestamptz) from public,anon;grant execute on function politeshik_private.curator_chat_messages(text,uuid,timestamptz) to authenticated;
create function public.curator_chat_messages(p_tenant text,p_peer uuid,p_before timestamptz default null) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.curator_chat_messages(p_tenant,p_peer,p_before)$$;
revoke all on function public.curator_chat_messages(text,uuid,timestamptz) from public,anon;grant execute on function public.curator_chat_messages(text,uuid,timestamptz) to authenticated;

create function politeshik_private.curator_chat_send(p_tenant text,p_peer uuid,p_body text,p_nonce uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.check_curator_chat(p_tenant,p_peer);message politeshik_private.curator_messages;begin
 if p_nonce is null or p_body is null or char_length(btrim(p_body)) not between 1 and 4000 then raise exception 'Сообщение: от 1 до 4000 символов';end if;
 insert into politeshik_private.curator_messages(id,tenant_id,sender,recipient,body) values(p_nonce,p_tenant,actor,p_peer,btrim(p_body)) on conflict(id) do nothing returning * into message;
 if message.id is null then select * into message from politeshik_private.curator_messages where id=p_nonce and tenant_id=p_tenant and sender=actor and recipient=p_peer and body=btrim(p_body);end if;
 if message.id is null then raise exception 'Неверный идентификатор сообщения';end if;return to_jsonb(message);
end $$;
revoke all on function politeshik_private.curator_chat_send(text,uuid,text,uuid) from public,anon;grant execute on function politeshik_private.curator_chat_send(text,uuid,text,uuid) to authenticated;
create function public.curator_chat_send(p_tenant text,p_peer uuid,p_body text,p_nonce uuid) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.curator_chat_send(p_tenant,p_peer,p_body,p_nonce)$$;
revoke all on function public.curator_chat_send(text,uuid,text,uuid) from public,anon;grant execute on function public.curator_chat_send(text,uuid,text,uuid) to authenticated;
