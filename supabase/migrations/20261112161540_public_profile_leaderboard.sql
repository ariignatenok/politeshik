-- Global profiles publish one mixed score, never attendance records, certificate details or private chat content.
create table politeshik_private.profile_activity(uid uuid not null references auth.users(id) on delete cascade,day date not null,kind text not null check(kind in('messages','club','app')),points integer not null,last_at timestamptz not null default now(),primary key(uid,day,kind));
alter table politeshik_private.profile_activity enable row level security;
revoke all on politeshik_private.profile_activity from public,anon,authenticated;
create policy profile_activity_internal_only on politeshik_private.profile_activity as restrictive for all to authenticated using(false) with check(false);
create function politeshik_private.count_profile_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare person uuid;category text;lim integer;begin
 if tg_table_name in('peer_messages','chat') then person:=new.sender;category:='messages';lim:=10;
 elsif tg_table_name='club_visitors' then person:=new.uid;category:='club';lim:=5;
 else person:=new.uid;category:='app';lim:=12;if not new.active then return new;end if;end if;
 if auth.uid() is null or person<>auth.uid() then return new;end if;
 if not exists(select 1 from public.members m where m.uid=person and m.status='approved' and m.role in('student','admin','developer') and coalesce(m.requested_role,'student')<>'parent') then return new;end if;
 insert into politeshik_private.profile_activity(uid,day,kind,points) values(person,(now() at time zone 'Europe/Moscow')::date,category,1)
 on conflict(uid,day,kind) do update set points=least(lim,politeshik_private.profile_activity.points+1),last_at=now()
 where category<>'app' or politeshik_private.profile_activity.last_at<=now()-interval '5 minutes';
 return new;
end $$;
revoke all on function politeshik_private.count_profile_activity() from public,anon,authenticated;
create trigger profile_activity_peer after insert on politeshik_private.peer_messages for each row execute function politeshik_private.count_profile_activity();
create trigger profile_activity_support after insert on public.chat for each row execute function politeshik_private.count_profile_activity();
create trigger profile_activity_club_join after insert on politeshik_private.club_visitors for each row execute function politeshik_private.count_profile_activity();
create trigger profile_activity_club_move after update on politeshik_private.club_visitors for each row when(row(new.x,new.y,new.jumped_at,new.dance,new.drink,new.thought) is distinct from row(old.x,old.y,old.jumped_at,old.dance,old.drink,old.thought)) execute function politeshik_private.count_profile_activity();
create trigger profile_activity_presence after insert or update on politeshik_private.presence_sessions for each row execute function politeshik_private.count_profile_activity();

create function politeshik_private.profile_leaderboard() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor();month text:=to_char(now() at time zone 'Europe/Moscow','YYYY-MM');result jsonb;begin
 with candidates as (
  select m.uid,m.tenant_id,coalesce(p.data,'{}') as profile,coalesce(a.data->'marks','{}') as marks,coalesce(c.data->'items','[]') as certs
  from public.members m join auth.users u on u.id=m.uid
  left join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||m.uid::text
  left join public.docs a on a.tenant_id=m.tenant_id and a.path='attendance/'||m.uid::text
  left join public.docs c on c.tenant_id=m.tenant_id and c.path='certs/'||m.uid::text
  where m.status='approved' and m.role in('student','admin','developer') and coalesce(m.requested_role,'student')<>'parent' and u.email_confirmed_at is not null),
 scores as (
  select q.uid,round(coalesce((select 60.0*count(*) filter(where value in('п','о'))/nullif(count(*),0)
   from jsonb_each_text(q.marks) mark where left(key,7)=month and left(key,10)<=to_char(now() at time zone 'Europe/Moscow','YYYY-MM-DD') and value in('п','о','н')
   and not exists(select 1 from jsonb_array_elements(q.certs) cert where cert->>'confirmed'='true' and cert->>'from'<=left(key,10) and cert->>'to'>=left(key,10)
    and (coalesce(jsonb_array_length(cert->'pairs'),0)=0 or cert->'pairs' @> jsonb_build_array(split_part(key,'|',2)::integer)))),0)
   +case when q.profile->'stats'->>'month'=month then least(20,greatest(0,case when jsonb_typeof(q.profile->'stats'->'cardsMonth')='number' then (q.profile->'stats'->>'cardsMonth')::numeric else 0 end)*.2) else 0 end
   +least(20,coalesce((select sum(points)/5.0 from politeshik_private.profile_activity where uid=q.uid and to_char(day,'YYYY-MM')=month),0)),1) as score
  from candidates q), ranked as(select uid,score,row_number() over(order by score desc,uid) as place from scores)
 select jsonb_build_object('month',month,'rows',coalesce(jsonb_agg(politeshik_private.social_profile(uid)||jsonb_build_object('score',score,'place',place) order by place),'[]')) into result from ranked;
 return result;
end $$;
revoke all on function politeshik_private.profile_leaderboard() from public,anon;grant execute on function politeshik_private.profile_leaderboard() to authenticated;
create function public.profile_leaderboard() returns jsonb language sql stable security invoker set search_path='' as $$select politeshik_private.profile_leaderboard()$$;
revoke all on function public.profile_leaderboard() from public,anon;grant execute on function public.profile_leaderboard() to authenticated;
-- The existing approved social directory already exposes public role labels.
create or replace function politeshik_private.social_people(p_query text default '',p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor(); result jsonb;
begin
 if char_length(coalesce(p_query,''))>100 or p_offset<0 or p_offset>10000 then raise exception 'Неверный поиск';end if;
 select coalesce(jsonb_agg(politeshik_private.social_profile(uid) order by leader desc,full_name,uid),'[]') into result from (
  select m.uid,m.role='admin' as leader,coalesce(m.full_name,p.data->>'name','Студент') as full_name from public.members m join auth.users u on u.id=m.uid
  left join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||m.uid::text
  left join public.groups g on g.tenant_id=m.tenant_id and g.id=m.group_id
  where m.status='approved' and m.role in('student','admin','developer') and coalesce(m.requested_role,'student')<>'parent' and u.email_confirmed_at is not null
  and (coalesce(m.full_name,p.data->>'name','') ilike '%'||coalesce(p_query,'')||'%' or coalesce(g.name,'') ilike '%'||coalesce(p_query,'')||'%')
  order by leader desc,full_name,m.uid limit 24 offset p_offset) people;
 return result;
end $$;
