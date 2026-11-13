-- A shared DJ schedule for the main dance floor; audio remains opt-in per listener.
create table politeshik_private.club_track_requests(
 id uuid primary key,
 uid uuid not null references auth.users(id)on delete cascade,
 track smallint not null check(track between 1 and 20),
 nickname text not null check(char_length(nickname)between 1 and 40),
 created_at timestamptz not null default clock_timestamp(),
 starts_at timestamptz not null unique,
 ends_at timestamptz not null,
 check(ends_at=starts_at+interval'32 seconds')
);
create index club_track_requests_owner on politeshik_private.club_track_requests(uid,ends_at);
create index club_track_requests_end on politeshik_private.club_track_requests(ends_at);
alter table politeshik_private.club_track_requests enable row level security;
revoke all on politeshik_private.club_track_requests from public,anon,authenticated;
create policy club_tracks_rpc_only on politeshik_private.club_track_requests as restrictive for all to authenticated using(false)with check(false);

-- Called only from the already-authorized club state RPC. No user id or email is exposed.
create function politeshik_private.club_dj_state()returns jsonb language plpgsql security invoker set search_path=''as $$
declare stamp timestamptz:=clock_timestamp();slot bigint;current_track jsonb;queue jsonb;begin
 slot:=floor(extract(epoch from stamp)/32)::bigint;
 select jsonb_build_object('key',id::text,'track',track,'starts_at',starts_at,'ends_at',ends_at,'requester',nickname)
 into current_track from politeshik_private.club_track_requests where starts_at<=stamp and ends_at>stamp order by starts_at desc limit 1;
 if current_track is null then current_track:=jsonb_build_object('key','auto:'||slot::text,'track',(slot%20)+1,
  'starts_at',to_timestamp(slot*32),'ends_at',to_timestamp((slot+1)*32),'requester',null);end if;
 select coalesce(jsonb_agg(jsonb_build_object('key',id::text,'track',track,'starts_at',starts_at,'ends_at',ends_at,'requester',nickname)order by starts_at),'[]')
 into queue from(select*from politeshik_private.club_track_requests where starts_at>stamp order by starts_at limit 10)r;
 return jsonb_build_object('current',current_track,'queue',queue);
end $$;
revoke all on function politeshik_private.club_dj_state()from public,anon,authenticated;

DO $migration$declare definition text;begin
 select pg_get_functiondef('politeshik_private.club_visit(text,boolean)'::regprocedure)into definition;
 if position('''gifts'',gifts,''server_time'',now()'in definition)=0 then raise exception 'Unexpected club state definition';end if;
 execute replace(definition,'''gifts'',gifts,''server_time'',now()',
  '''gifts'',gifts,''dj'',case when room_id=''main''then politeshik_private.club_dj_state()else null end,''server_time'',clock_timestamp()');
end $migration$;

create function politeshik_private.club_request_track(p_track integer,p_nonce uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare actor uuid:=politeshik_private.social_actor();guest politeshik_private.club_visitors;prior politeshik_private.club_track_requests;
 stamp timestamptz;scheduled timestamptz;nick text;begin
 if p_track is null or p_track not between 1 and 20 or p_nonce is null then raise exception 'Выберите трек из списка диджея';end if;
 select*into guest from politeshik_private.club_visitors where uid=actor for update;
 if not found or guest.room<>'main'then raise exception 'Заказывать треки можно на танцполе';end if;
 -- One serialized append prevents simultaneous requests from sharing a slot.
 perform pg_advisory_xact_lock(754032091);
 select*into prior from politeshik_private.club_track_requests where id=p_nonce;
 if found then
  if prior.uid<>actor or prior.track<>p_track then raise exception 'Неверный заказ трека';end if;
  return politeshik_private.club_visit('state');
 end if;
 if guest.x not between 25 and 65 or guest.y not between 12 and 32 then raise exception 'Сначала подойдите к диджею';end if;
 stamp:=clock_timestamp();
 if exists(select 1 from politeshik_private.club_track_requests where uid=actor and ends_at>stamp)then raise exception 'Ваш трек уже играет или ждёт в очереди';end if;
 if(select count(*)from politeshik_private.club_track_requests where starts_at>stamp)>=10 then raise exception 'В очереди уже 10 треков. Подойдите чуть позже';end if;
 select greatest(to_timestamp((floor(extract(epoch from stamp)/32)+1)*32),coalesce(max(ends_at),stamp))into scheduled
 from politeshik_private.club_track_requests where ends_at>stamp;
 select left(coalesce(nullif(politeshik_private.social_profile(actor)->'mascot'->>'nickname',''),'Политешик'),40)into nick;
 insert into politeshik_private.club_track_requests(id,uid,track,nickname,starts_at,ends_at)values(p_nonce,actor,p_track,nick,scheduled,scheduled+interval'32 seconds');
 delete from politeshik_private.club_track_requests where ends_at<stamp-interval'7 days';
 return politeshik_private.club_visit('state');
end $$;
revoke all on function politeshik_private.club_request_track(integer,uuid)from public,anon;
grant execute on function politeshik_private.club_request_track(integer,uuid)to authenticated;
create function public.club_request_track(p_track integer,p_nonce uuid)returns jsonb language sql security invoker set search_path=''as $$select politeshik_private.club_request_track(p_track,p_nonce)$$;
revoke all on function public.club_request_track(integer,uuid)from public,anon;
grant execute on function public.club_request_track(integer,uuid)to authenticated;
