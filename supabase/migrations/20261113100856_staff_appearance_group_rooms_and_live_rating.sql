-- Extend only cosmetic ownership. No staff social, attendance or grade privileges are granted.
DO $migration$declare definition text;begin
 select pg_get_functiondef('politeshik_private.save_my_mascot(jsonb)'::regprocedure) into definition;
 if position($old$m.role in('student','admin','developer')$old$ in definition)=0 then raise exception 'Unexpected mascot authorization';end if;
 definition:=replace(definition,$old$m.role in('student','admin','developer')$old$,$new$m.role in('student','admin','developer','teacher','curator')$new$);
 execute definition;
end $migration$;

create or replace function politeshik_private.group_mascots() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t text:=public.current_tenant();result jsonb;begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
 or not(politeshik_private.is_super_admin() or exists(select 1 from public.members where uid=auth.uid() and tenant_id=t and status='approved')) then raise exception 'Нет доступа к группе' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('uid',m.uid,'rid',case when m.role in('teacher','curator') or a.uid is not null and m.tenant_id<>t then null else p.data->>'rid' end,
 'name',case when a.uid is not null and m.tenant_id<>t then 'Админ Арина' else m.full_name end,'role',case when a.uid is not null then 'superadmin' else m.role end,
 'avatar',coalesce(v.data->>'v',p.data->>'avatar',''),'mascot',coalesce(v.data->'mascot',p.data->'mascot','{}'))),'[]') into result
 from public.members m join auth.users u on u.id=m.uid and u.email_confirmed_at is not null
 left join politeshik_private.super_admins a on a.uid=m.uid
 left join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||m.uid::text
 left join public.docs v on v.tenant_id=m.tenant_id and v.path='avatars/'||m.uid::text
 where m.status='approved' and coalesce(m.requested_role,'student')<>'parent' and(
 (m.role in('student','admin','developer') and(m.tenant_id=t or a.uid is not null))
 or(m.uid=auth.uid() and m.role in('teacher','curator') and m.tenant_id=t)
 or(m.role='curator' and exists(select 1 from politeshik_private.curator_accounts c join politeshik_private.curator_group_scopes s on s.curator_id=c.id where c.active and c.claimed_uid=m.uid and c.home_tenant=m.tenant_id and s.tenant_id=t))
 or(m.role='teacher' and exists(select 1 from politeshik_private.faculty_claims c join politeshik_private.faculty_scopes s on s.faculty_id=c.faculty_id where c.uid=m.uid and c.status='approved' and s.tenant_id=t)));
 return result;
end $$;

create table politeshik_private.group_room_messages(
 id uuid primary key,tenant_id text not null references public.tenants(id),sender uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 4000),created_at timestamptz not null default now()
);
create index group_room_messages_scope_idx on politeshik_private.group_room_messages(tenant_id,created_at desc,id);
create index group_room_messages_sender_idx on politeshik_private.group_room_messages(sender);
create table politeshik_private.group_room_reads(tenant_id text not null references public.tenants(id),uid uuid not null references auth.users(id) on delete cascade,read_at timestamptz not null default now(),primary key(tenant_id,uid));
create index group_room_reads_uid_idx on politeshik_private.group_room_reads(uid);
alter table politeshik_private.group_room_messages enable row level security;
alter table politeshik_private.group_room_reads enable row level security;
revoke all on politeshik_private.group_room_messages,politeshik_private.group_room_reads from public,anon,authenticated;
create policy group_room_messages_rpc_only on politeshik_private.group_room_messages as restrictive for all to authenticated using(false) with check(false);
create policy group_room_reads_rpc_only on politeshik_private.group_room_reads as restrictive for all to authenticated using(false) with check(false);

create function politeshik_private.group_room_allowed(p_tenant text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
 and exists(select 1 from politeshik_private.curator_group_scopes s join politeshik_private.curator_accounts c on c.id=s.curator_id and c.active where s.tenant_id=p_tenant)
 and(politeshik_private.is_super_admin()
 or exists(select 1 from public.members where uid=auth.uid() and tenant_id=p_tenant and status='approved' and role in('student','admin','developer') and coalesce(requested_role,'student')<>'parent')
 or exists(select 1 from politeshik_private.curator_accounts c join politeshik_private.curator_group_scopes s on s.curator_id=c.id
 join public.members m on m.uid=c.claimed_uid and m.tenant_id=c.home_tenant and m.role='curator' and m.status='approved' and m.requested_role='staff'
 where c.claimed_uid=auth.uid() and c.active and s.tenant_id=p_tenant))
$$;
revoke all on function politeshik_private.group_room_allowed(text) from public,anon,authenticated;

create function politeshik_private.group_room_list() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();result jsonb;begin
 if actor is null then raise exception 'Войдите в аккаунт' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('tenant_id',g.tenant_id,'name',g.name,'last',left(last_message.body,120),'at',last_message.created_at,
 'unread',(select count(*) from politeshik_private.group_room_messages m where m.tenant_id=g.tenant_id and m.sender<>actor and m.created_at>coalesce(r.read_at,'-infinity'::timestamptz))) order by g.tenant_id),'[]') into result
 from public.groups g left join politeshik_private.group_room_reads r on r.tenant_id=g.tenant_id and r.uid=actor
 left join lateral(select body,created_at from politeshik_private.group_room_messages where tenant_id=g.tenant_id order by created_at desc,id desc limit 1)last_message on true
 where politeshik_private.group_room_allowed(g.tenant_id);return result;
end $$;
revoke all on function politeshik_private.group_room_list() from public,anon;grant execute on function politeshik_private.group_room_list() to authenticated;
create function public.group_room_list() returns jsonb language sql stable security invoker set search_path='' as $$select politeshik_private.group_room_list()$$;
revoke all on function public.group_room_list() from public,anon;grant execute on function public.group_room_list() to authenticated;

create function politeshik_private.group_room_messages(p_tenant text,p_before timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();result jsonb;begin
 if not politeshik_private.group_room_allowed(p_tenant) then raise exception 'Нет доступа к чату этой группы' using errcode='42501';end if;
 if p_before is null then insert into politeshik_private.group_room_reads(tenant_id,uid,read_at)values(p_tenant,actor,now()) on conflict(tenant_id,uid) do update set read_at=greatest(politeshik_private.group_room_reads.read_at,excluded.read_at);end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'sender',q.sender,'body',q.body,'created_at',q.created_at,
 'name',coalesce(nullif(m.full_name,''),'Участник'),'role',coalesce(m.role,'student'),'avatar',coalesce(v.data->>'v',''),'mascot',coalesce(v.data->'mascot','{}'),
 'read_count',(select count(*) from politeshik_private.group_room_reads r where r.tenant_id=p_tenant and r.uid<>q.sender and r.read_at>=q.created_at)) order by q.created_at,q.id),'[]') into result
 from(select * from politeshik_private.group_room_messages where tenant_id=p_tenant and(p_before is null or created_at<p_before) order by created_at desc,id desc limit 100)q
 left join public.members m on m.uid=q.sender and m.status='approved'
 left join public.docs v on v.tenant_id=m.tenant_id and v.path='avatars/'||q.sender::text;return result;
end $$;
revoke all on function politeshik_private.group_room_messages(text,timestamptz) from public,anon;grant execute on function politeshik_private.group_room_messages(text,timestamptz) to authenticated;
create function public.group_room_messages(p_tenant text,p_before timestamptz default null) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.group_room_messages(p_tenant,p_before)$$;
revoke all on function public.group_room_messages(text,timestamptz) from public,anon;grant execute on function public.group_room_messages(text,timestamptz) to authenticated;

create function politeshik_private.group_room_send(p_tenant text,p_body text,p_nonce uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();message politeshik_private.group_room_messages;begin
 if not politeshik_private.group_room_allowed(p_tenant) then raise exception 'Нет доступа к чату этой группы' using errcode='42501';end if;
 if p_nonce is null or p_body is null or char_length(btrim(p_body)) not between 1 and 4000 then raise exception 'Сообщение: от 1 до 4000 символов';end if;
 insert into politeshik_private.group_room_messages(id,tenant_id,sender,body)values(p_nonce,p_tenant,actor,btrim(p_body)) on conflict(id) do nothing returning * into message;
 if message.id is null then select * into message from politeshik_private.group_room_messages where id=p_nonce and tenant_id=p_tenant and sender=actor and body=btrim(p_body);end if;
 if message.id is null then raise exception 'Неверный идентификатор сообщения';end if;return to_jsonb(message);
end $$;
revoke all on function politeshik_private.group_room_send(text,text,uuid) from public,anon;grant execute on function politeshik_private.group_room_send(text,text,uuid) to authenticated;
create function public.group_room_send(p_tenant text,p_body text,p_nonce uuid) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.group_room_send(p_tenant,p_body,p_nonce)$$;
revoke all on function public.group_room_send(text,text,uuid) from public,anon;grant execute on function public.group_room_send(text,text,uuid) to authenticated;
DO $migration$declare definition text;begin
 select pg_get_functiondef('politeshik_private.count_profile_activity()'::regprocedure) into definition;
 if position($old$tg_table_name in('peer_messages','chat')$old$ in definition)=0 then raise exception 'Unexpected activity counter';end if;
 execute replace(definition,$old$tg_table_name in('peer_messages','chat')$old$,$new$tg_table_name in('peer_messages','chat','group_room_messages')$new$);
end $migration$;
create trigger profile_activity_group_room after insert on politeshik_private.group_room_messages for each row execute function politeshik_private.count_profile_activity();

-- Live monthly group scores; no individual marks, certificates or component scores leave this function.
create function politeshik_private.group_leaderboard() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor();t text:=public.current_tenant();month text:=to_char(now() at time zone 'Europe/Moscow','YYYY-MM');result jsonb;begin
 if not politeshik_private.is_super_admin() and not exists(select 1 from public.members where uid=actor and tenant_id=t and status='approved') then raise exception 'Нет доступа к группе' using errcode='42501';end if;
 with candidates as(
 select m.uid,m.full_name,p.data->>'rid' as rid,coalesce(p.data,'{}') as profile,coalesce(a.data->'marks','{}') as marks,coalesce(c.data->'items','[]') as certs
 from public.members m join auth.users u on u.id=m.uid and u.email_confirmed_at is not null
 join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||m.uid::text
 join public.roster ro on ro.tenant_id=m.tenant_id and ro.rid=p.data->>'rid' and ro.flag=''
 left join public.docs a on a.tenant_id=m.tenant_id and a.path='attendance/'||m.uid::text
 left join public.docs c on c.tenant_id=m.tenant_id and c.path='certs/'||m.uid::text
 where m.tenant_id=t and m.status='approved' and m.role in('student','developer') and coalesce(m.requested_role,'student')<>'parent'),
 scores as(select q.uid,q.rid,q.full_name,round(coalesce((select .8*round(100.0*count(*) filter(where value in('п','о'))/nullif(count(*),0))
 from jsonb_each_text(q.marks)mark where left(key,7)=month and left(key,10)<=to_char(now() at time zone 'Europe/Moscow','YYYY-MM-DD') and value in('п','о','н')
 and not(value='н' and exists(select 1 from jsonb_array_elements(q.certs)cert where cert->>'confirmed'='true' and cert->>'from'<=left(key,10) and cert->>'to'>=left(key,10)
 and(coalesce(jsonb_array_length(cert->'pairs'),0)=0 or cert->'pairs' @> jsonb_build_array(split_part(key,'|',2)::integer))))),0)
 +case when q.profile->'stats'->>'month'=month then least(20,greatest(0,case when jsonb_typeof(q.profile->'stats'->'cardsMonth')='number' then (q.profile->'stats'->>'cardsMonth')::numeric else 0 end)*.2) else 0 end,1) as score from candidates q),
 ranked as(select *,row_number()over(order by score desc,full_name,uid)as place from scores)
 select jsonb_build_object('month',month,'tenant_id',t,'updated_at',now(),'rows',coalesce(jsonb_agg(jsonb_build_object('uid',r.uid,'rid',r.rid,'name',r.full_name,'score',r.score,'place',r.place,'avatar',coalesce(v.data->>'v',''),'mascot',coalesce(v.data->'mascot','{}'))order by r.place),'[]'))into result from ranked r left join public.docs v on v.tenant_id=t and v.path='avatars/'||r.uid::text;return result;
end $$;
revoke all on function politeshik_private.group_leaderboard() from public,anon;grant execute on function politeshik_private.group_leaderboard() to authenticated;
create function public.group_leaderboard() returns jsonb language sql stable security invoker set search_path='' as $$select politeshik_private.group_leaderboard()$$;
revoke all on function public.group_leaderboard() from public,anon;grant execute on function public.group_leaderboard() to authenticated;
