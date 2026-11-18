-- Independent platform identity, never a roster/member of an academic group.
create table politeshik_private.platform_developers(
 email text primary key check(email=lower(email)),full_name text not null,
 uid uuid unique references auth.users(id) on delete set null,active boolean not null default true,
 profile jsonb not null default '{}',created_at timestamptz not null default now());
alter table politeshik_private.platform_developers enable row level security;
revoke all on politeshik_private.platform_developers from public,anon,authenticated;
create policy platform_developers_private on politeshik_private.platform_developers for all to public using(false) with check(false);
insert into politeshik_private.platform_developers(email,full_name)values('dimakrfeedsonos@gmail.com','Крылов Дмитрий Денисович');
create function politeshik_private.platform_developer()returns boolean language sql stable security definer set search_path=''as $$
 select auth.uid()is not null and exists(select 1 from politeshik_private.platform_developers d join auth.users u on u.id=auth.uid()
 where d.active and d.uid=u.id and d.email=lower(u.email)and u.email_confirmed_at is not null)
$$;
revoke all on function politeshik_private.platform_developer()from public,anon,authenticated;
create function politeshik_private.platform_context()returns jsonb language plpgsql security definer set search_path=''as $$
declare actor uuid:=auth.uid();account politeshik_private.platform_developers;mail text;confirmed boolean;begin
 if actor is null then raise exception 'Войдите в аккаунт'using errcode='42501';end if;
 select lower(email),email_confirmed_at is not null into mail,confirmed from auth.users where id=actor;
 select * into account from politeshik_private.platform_developers where email=mail and active for update;
 if account.email is null then return jsonb_build_object('matched',false);end if;
 if not confirmed then return jsonb_build_object('matched',true,'active',false,'needs_verification',true);end if;
 if account.uid is not null and account.uid<>actor then raise exception 'Профиль разработчика уже закреплён'using errcode='42501';end if;
 if exists(select 1 from public.members where uid=actor)then raise exception 'Для самостоятельного разработчика сначала нужно освободить привязку к группе'using errcode='42501';end if;
 update politeshik_private.platform_developers set uid=actor where email=mail and uid is distinct from actor;
 return jsonb_build_object('matched',true,'active',true,'name',account.full_name,'role','developer','tenant_id',null,'group_id',null,
 'profile',account.profile||jsonb_build_object('name',account.full_name,'role','developer'),
 'groups',(select coalesce(jsonb_agg(jsonb_build_object('tenant_id',tenant_id,'id',id,'name',name)order by tenant_id),'[]')from public.groups));
end $$;
create function public.platform_context()returns jsonb language sql security invoker set search_path=''as $$select politeshik_private.platform_context()$$;
revoke all on function politeshik_private.platform_context(),public.platform_context()from public,anon;
grant execute on function politeshik_private.platform_context(),public.platform_context()to authenticated;
create table politeshik_private.development_chat_messages(
 seq bigint generated always as identity primary key,id uuid not null unique,
 sender uuid not null references auth.users(id) on delete cascade,
 name text not null,group_name text not null,sender_role text not null check(sender_role in('superadmin','developer')),
 body text not null check(char_length(btrim(body)) between 1 and 4000),created_at timestamptz not null default now());
create index development_chat_sender_idx on politeshik_private.development_chat_messages(sender);
create table politeshik_private.development_chat_reads(
 uid uuid primary key references auth.users(id) on delete cascade,read_seq bigint not null default 0);
alter table politeshik_private.development_chat_messages enable row level security;
alter table politeshik_private.development_chat_reads enable row level security;
revoke all on politeshik_private.development_chat_messages,politeshik_private.development_chat_reads from public,anon,authenticated;
create policy development_chat_messages_private on politeshik_private.development_chat_messages for all to public using(false) with check(false);
create policy development_chat_reads_private on politeshik_private.development_chat_reads for all to public using(false) with check(false);

create function politeshik_private.development_chat_members() returns table(uid uuid,name text,group_name text,role text,tenant_id text)
language sql stable security definer set search_path=''as $$
 select u.id,'Админ Арина'::text,'Команда разработки'::text,'superadmin'::text,null::text
 from politeshik_private.super_admins s join auth.users u on u.id=s.uid and u.email_confirmed_at is not null
 union all
 select m.uid,'Кузьменков Макар Сергеевич'::text,'Команда разработки'::text,'developer'::text,m.tenant_id
 from public.members m join auth.users u on u.id=m.uid and lower(u.email)='colpaxe@gmail.com'and u.email_confirmed_at is not null
 join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||m.uid::text and p.data->>'rid'='g2_r12'
 where m.tenant_id='group_2'and m.role='developer'and m.status='approved'
 union all
 select d.uid,d.full_name,'Вне учебных групп'::text,'developer'::text,null::text
 from politeshik_private.platform_developers d join auth.users u on u.id=d.uid and lower(u.email)=d.email and u.email_confirmed_at is not null where d.active
$$;
revoke all on function politeshik_private.development_chat_members() from public,anon,authenticated;
create function politeshik_private.development_chat_actor() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from politeshik_private.development_chat_members() m where m.uid=auth.uid()) then
 raise exception 'Этот чат доступен только команде разработки' using errcode='42501';end if;
 return auth.uid();
end $$;
revoke all on function politeshik_private.development_chat_actor() from public,anon,authenticated;
create function politeshik_private.development_chat_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();result jsonb;begin
 if actor is null then raise exception 'Войдите в аккаунт' using errcode='42501';end if;
 if not exists(select 1 from politeshik_private.development_chat_members()m where m.uid=actor) then return jsonb_build_object('allowed',false);end if;
 select jsonb_build_object('allowed',true,'name','Разработка','members_count',(select count(*) from politeshik_private.development_chat_members()),
 'last',(select left(body,120)from politeshik_private.development_chat_messages order by seq desc limit 1),
 'at',(select created_at from politeshik_private.development_chat_messages order by seq desc limit 1),
 'unread',(select count(*)from politeshik_private.development_chat_messages where sender<>actor and seq>coalesce((select read_seq from politeshik_private.development_chat_reads where uid=actor),0)))into result;
 return result;
end $$;
create function public.development_chat_state() returns jsonb language sql stable security invoker set search_path='' as $$select politeshik_private.development_chat_state()$$;
create function politeshik_private.development_chat_messages(p_before bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.development_chat_actor();result jsonb;seen bigint;begin
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'seq',q.seq,'sender',q.sender,'body',q.body,'created_at',q.created_at,
 'name',q.name,'role',q.sender_role,'group_name',q.group_name,'avatar',coalesce(v.data->>'v',pd.profile->>'avatar',''),'mascot',coalesce(v.data->'mascot',p.data->'mascot',pd.profile->'mascot','{}'),
 'read_count',(select count(*)from politeshik_private.development_chat_reads r join politeshik_private.development_chat_members()member on member.uid=r.uid where r.uid<>q.sender and r.read_seq>=q.seq))order by q.seq),'[]'),max(q.seq)into result,seen
 from(select * from politeshik_private.development_chat_messages where p_before is null or seq<p_before order by seq desc limit 100)q
 left join public.members m on m.uid=q.sender
 left join politeshik_private.platform_developers pd on pd.uid=q.sender
 left join public.docs v on v.tenant_id=m.tenant_id and v.path='avatars/'||q.sender::text
 left join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||q.sender::text;
 if seen is not null then insert into politeshik_private.development_chat_reads(uid,read_seq)values(actor,seen)on conflict(uid)do update set read_seq=greatest(politeshik_private.development_chat_reads.read_seq,excluded.read_seq);end if;
 return result;
end $$;
create function public.development_chat_messages(p_before bigint default null) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.development_chat_messages(p_before)$$;
create function politeshik_private.development_chat_send(p_body text,p_nonce uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.development_chat_actor();member record;message politeshik_private.development_chat_messages;begin
 if p_nonce is null or p_body is null or char_length(btrim(p_body)) not between 1 and 4000 then raise exception 'Сообщение: от 1 до 4000 символов';end if;
 select * into member from politeshik_private.development_chat_members()where uid=actor;
 insert into politeshik_private.development_chat_messages(id,sender,name,group_name,sender_role,body)values(p_nonce,actor,member.name,member.group_name,member.role,btrim(p_body))on conflict(id)do nothing returning * into message;
 if message.id is null then select * into message from politeshik_private.development_chat_messages where id=p_nonce and sender=actor and body=btrim(p_body);end if;
 if message.id is null then raise exception 'Неверный идентификатор сообщения';end if;
 return jsonb_build_object('id',message.id,'seq',message.seq);
end $$;
create function public.development_chat_send(p_body text,p_nonce uuid) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.development_chat_send(p_body,p_nonce)$$;
revoke all on function politeshik_private.development_chat_state(),politeshik_private.development_chat_messages(bigint),politeshik_private.development_chat_send(text,uuid),public.development_chat_state(),public.development_chat_messages(bigint),public.development_chat_send(text,uuid) from public,anon;
grant execute on function politeshik_private.development_chat_state(),politeshik_private.development_chat_messages(bigint),politeshik_private.development_chat_send(text,uuid),public.development_chat_state(),public.development_chat_messages(bigint),public.development_chat_send(text,uuid) to authenticated;

