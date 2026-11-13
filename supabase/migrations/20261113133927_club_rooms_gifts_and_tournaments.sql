-- Fictional club rooms. Access to both extra rooms is checked against the owner's home-group attendance.
alter table politeshik_private.club_visitors add column room text not null default 'main'check(room in('main','cinema','games'));
create index club_visitors_room on politeshik_private.club_visitors(room);
create function politeshik_private.club_attendance(p_uid uuid)returns numeric language sql stable security definer set search_path=''as $$
 select 100.0*count(*)filter(where value in('п','о'))/nullif(count(*),0)
 from public.members m join public.docs a on a.tenant_id=m.tenant_id and a.path='attendance/'||m.uid::text
 left join public.docs c on c.tenant_id=m.tenant_id and c.path='certs/'||m.uid::text
 cross join lateral jsonb_each_text(coalesce(a.data->'marks','{}'))mark
 where m.uid=p_uid and m.status='approved'and m.role in('student','admin','developer')and coalesce(m.requested_role,'student')<>'parent'
 and left(key,7)=to_char(now()at time zone'Europe/Moscow','YYYY-MM')and left(key,10)<=to_char(now()at time zone'Europe/Moscow','YYYY-MM-DD')and value in('п','о','н')
 and not(value='н'and exists(select 1 from jsonb_array_elements(coalesce(c.data->'items','[]'))cert where cert->>'confirmed'='true'and cert->>'from'<=left(key,10)and cert->>'to'>=left(key,10)and(coalesce(jsonb_array_length(cert->'pairs'),0)=0 or cert->'pairs'@>jsonb_build_array(split_part(key,'|',2)::integer))))
$$;
revoke all on function politeshik_private.club_attendance(uuid)from public,anon,authenticated;
create table politeshik_private.club_drink_gifts(id uuid primary key,sender uuid not null references auth.users(id)on delete cascade,recipient uuid not null references auth.users(id)on delete cascade,drink text not null,created_at timestamptz not null default now(),seen_at timestamptz,check(sender<>recipient));
create index club_drink_gifts_recipient on politeshik_private.club_drink_gifts(recipient,created_at);
alter table politeshik_private.club_drink_gifts enable row level security;
revoke all on politeshik_private.club_drink_gifts from public,anon,authenticated;
create policy club_gifts_rpc_only on politeshik_private.club_drink_gifts as restrictive for all to authenticated using(false)with check(false);
create or replace function politeshik_private.club_visit(p_action text default 'state',p_dancing boolean default true)returns jsonb language plpgsql security definer set search_path=''as $$
declare actor uuid:=politeshik_private.social_actor();visitors jsonb;room_id text;percentage numeric:=politeshik_private.club_attendance(actor);gifts jsonb;begin
 if p_action is null or p_action not in('state','join','beat','leave')then raise exception 'Неверное действие';end if;
 if p_action='join'then insert into politeshik_private.club_visitors(uid,dancing,dance)values(actor,coalesce(p_dancing,true),case when coalesce(p_dancing,true)then'bounce'else'still'end)on conflict(uid)do update set seen_at=now();
 elsif p_action='leave'then delete from politeshik_private.club_visitors where uid=actor;end if;
 update politeshik_private.club_visitors set room='main',x=50,y=70 where uid=actor and room<>'main'and coalesce(percentage,0)<75;
 update politeshik_private.club_visitors set seen_at=now()where uid=actor;
 select room into room_id from politeshik_private.club_visitors where uid=actor;room_id:=coalesce(room_id,'main');
 select coalesce(jsonb_agg(card||jsonb_build_object('dancing',v.dancing,'dance',v.dance,'drink',v.drink,'thought',v.thought,'x',v.x,'y',v.y,'jumped_at',v.jumped_at,'room',v.room)order by v.uid),'[]')into visitors
 from politeshik_private.club_visitors v cross join lateral(select politeshik_private.social_profile(v.uid)-'avatar'-'about'as card)p
 where card is not null and v.room=room_id and(v.room='main'or coalesce(politeshik_private.club_attendance(v.uid),0)>=75);
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'drink',g.drink,'sender',coalesce(p.data->'mascot'->>'nickname',m.full_name,'Политешик'))order by g.created_at),'[]')into gifts
 from politeshik_private.club_drink_gifts g left join public.members m on m.uid=g.sender left join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||g.sender::text
 where g.recipient=actor and g.seen_at is null and g.created_at>now()-interval'1 day';
 update politeshik_private.club_drink_gifts set seen_at=now()where recipient=actor and seen_at is null;
 return jsonb_build_object('visitors',visitors,'joined',exists(select 1 from politeshik_private.club_visitors where uid=actor),'room',room_id,'gate',jsonb_build_object('percent',round(percentage,2),'allowed',coalesce(percentage,0)>=75,'month',to_char(now()at time zone'Europe/Moscow','YYYY-MM')),'gifts',gifts,'server_time',now());
end $$;
create function politeshik_private.club_enter_room(p_room text)returns jsonb language plpgsql security definer set search_path=''as $$
declare actor uuid:=politeshik_private.social_actor();begin
 if p_room is null or p_room not in('main','cinema','games')then raise exception 'Комната не найдена';end if;
 if p_room<>'main'and coalesce(politeshik_private.club_attendance(actor),0)<75 then raise exception 'Фейсконтроль: нужна посещаемость от 75%% за текущий месяц'using errcode='42501';end if;
 update politeshik_private.club_visitors set room=p_room,x=50,y=75,seen_at=now()where uid=actor;
 if not found then raise exception 'Сначала зайдите в клуб';end if;return politeshik_private.club_visit('state');
end $$;
revoke all on function politeshik_private.club_enter_room(text)from public,anon;grant execute on function politeshik_private.club_enter_room(text)to authenticated;
create function public.club_enter_room(p_room text)returns jsonb language sql security invoker set search_path=''as $$select politeshik_private.club_enter_room(p_room)$$;
revoke all on function public.club_enter_room(text)from public,anon;grant execute on function public.club_enter_room(text)to authenticated;
create function politeshik_private.club_give_drink(p_peer uuid,p_nonce uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare actor uuid:=politeshik_private.social_actor();giver politeshik_private.club_visitors;receiver politeshik_private.club_visitors;begin
 if p_peer is null or p_peer=actor or p_nonce is null then raise exception 'Выберите другого гостя';end if;
 if exists(select 1 from politeshik_private.club_drink_gifts where id=p_nonce and sender=actor and recipient=p_peer)then return politeshik_private.club_visit('state');end if;
 perform 1 from politeshik_private.club_visitors where uid in(actor,p_peer)order by uid for update;
 select *into giver from politeshik_private.club_visitors where uid=actor;select *into receiver from politeshik_private.club_visitors where uid=p_peer;
 if giver.uid is null or receiver.uid is null or giver.room<>receiver.room or politeshik_private.social_profile(p_peer)is null then raise exception 'Вы должны находиться в одной комнате';end if;
 if giver.room<>'main'and(coalesce(politeshik_private.club_attendance(actor),0)<75 or coalesce(politeshik_private.club_attendance(p_peer),0)<75)then raise exception 'Фейсконтроль: доступ в комнату закрыт'using errcode='42501';end if;
 if giver.drink='none'then raise exception 'Сначала возьмите напиток в баре';end if;
 if receiver.drink<>'none'then raise exception 'У гостя уже есть напиток в лапке';end if;
 insert into politeshik_private.club_drink_gifts(id,sender,recipient,drink)values(p_nonce,actor,p_peer,giver.drink);
 update politeshik_private.club_visitors set drink=case when uid=actor then'none'else giver.drink end where uid in(actor,p_peer);
 return politeshik_private.club_visit('state');
end $$;
revoke all on function politeshik_private.club_give_drink(uuid,uuid)from public,anon;grant execute on function politeshik_private.club_give_drink(uuid,uuid)to authenticated;
create function public.club_give_drink(p_peer uuid,p_nonce uuid)returns jsonb language sql security invoker set search_path=''as $$select politeshik_private.club_give_drink(p_peer,p_nonce)$$;
revoke all on function public.club_give_drink(uuid,uuid)from public,anon;grant execute on function public.club_give_drink(uuid,uuid)to authenticated;

-- Server-owned, two-player mini-games. Clients cannot submit winners, points or opponent cards.
create table politeshik_private.club_games(
 id uuid primary key,game text not null check(game in('poker','pool')),host uuid not null references auth.users(id)on delete cascade,guest uuid references auth.users(id)on delete cascade,
 status text not null default'waiting'check(status in('waiting','active','finished','cancelled')),winner uuid references auth.users(id)on delete set null,
 state jsonb not null default'{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),ended_at timestamptz,check(host<>guest)
);
create index club_games_lobby on politeshik_private.club_games(status,created_at desc);
create index club_games_host on politeshik_private.club_games(host,status);
create index club_games_guest on politeshik_private.club_games(guest,status);
create index club_games_month on politeshik_private.club_games(game,ended_at)where status='finished';
create table politeshik_private.club_game_moves(nonce uuid primary key,match_id uuid not null references politeshik_private.club_games(id)on delete cascade,actor uuid not null references auth.users(id)on delete cascade,action text not null,payload jsonb not null,created_at timestamptz not null default now());
create index club_game_moves_match on politeshik_private.club_game_moves(match_id);
DO $$declare t text;begin foreach t in array array['club_games','club_game_moves']loop
 execute format('alter table politeshik_private.%I enable row level security',t);execute format('revoke all on politeshik_private.%I from public,anon,authenticated',t);
 execute format('create policy club_game_rpc_only on politeshik_private.%I as restrictive for all to authenticated using(false)with check(false)',t);
end loop;end $$;
create function politeshik_private.club_game_actor()returns uuid language plpgsql stable security definer set search_path=''as $$
declare actor uuid:=politeshik_private.social_actor();begin
 if coalesce(politeshik_private.club_attendance(actor),0)<75 or not exists(select 1 from politeshik_private.club_visitors where uid=actor and room='games')then raise exception 'В игровую комнату пускают с посещаемостью от 75%%'using errcode='42501';end if;return actor;
end $$;
revoke all on function politeshik_private.club_game_actor()from public,anon,authenticated;
create function politeshik_private.poker_value(cards integer[])returns bigint language plpgsql immutable security invoker set search_path=''as $$
declare ranks integer[];counts integer[];suits integer;top integer;category integer:=0;value bigint:=0;i integer;begin
 if cardinality(cards)<>5 or(select count(distinct n)from unnest(cards)n)<>5 then raise exception 'Неверная рука';end if;
 select array_agg(r order by n desc,r desc),array_agg(n order by n desc,r desc)into ranks,counts from(select c/4+2 r,count(*)::integer n from unnest(cards)c group by c/4+2)s;
 select count(distinct c%4)into suits from unnest(cards)c;
 if cardinality(ranks)=5 then
  if ranks[1]-ranks[5]=4 then top:=ranks[1];elsif ranks=array[14,5,4,3,2]then top:=5;end if;
 end if;
 if suits=1 and top is not null then category:=8;ranks:=array[top];
 elsif counts[1]=4 then category:=7;
 elsif counts[1]=3 and counts[2]=2 then category:=6;
 elsif suits=1 then category:=5;
 elsif top is not null then category:=4;ranks:=array[top];
 elsif counts[1]=3 then category:=3;
 elsif counts[1]=2 and counts[2]=2 then category:=2;
 elsif counts[1]=2 then category:=1;end if;
 value:=category;for i in 1..5 loop value:=value*15+coalesce(ranks[i],0);end loop;return value;
end $$;
revoke all on function politeshik_private.poker_value(integer[])from public,anon,authenticated;
create function politeshik_private.club_game_card(p_id uuid)returns jsonb language plpgsql stable security invoker set search_path=''as $$
declare g politeshik_private.club_games;actor uuid:=auth.uid();mine text;other text;hand integer[];begin
 select *into g from politeshik_private.club_games where id=p_id;if not found then raise exception 'Партия не найдена';end if;
 mine:=case when actor=g.host then'host'when actor=g.guest then'guest'else null end;other:=case when mine='host'then'guest'else'host'end;
 if mine is not null then select array_agg(x::integer order by n)into hand from jsonb_array_elements_text(coalesce(g.state->('hand_'||mine),'[]'))with ordinality t(x,n);end if;
 return jsonb_build_object('id',g.id,'game',g.game,'status',g.status,'host',politeshik_private.reaction_person(g.host),'guest',case when g.guest is not null then politeshik_private.reaction_person(g.guest)else null end,
 'winner',g.winner,'mine',mine,'hand',coalesce(to_jsonb(hand),'[]'),'other_hand',case when g.status='finished'then coalesce(g.state->('hand_'||other),'[]')else'[]'::jsonb end,
 'combination',case when cardinality(hand)=5 then politeshik_private.poker_value(hand)/759375 else null end,
 'host_ready',coalesce(g.state->'host_ready','false'),'guest_ready',coalesce(g.state->'guest_ready','false'),
 'turn',g.state->'turn','host_score',coalesce(g.state->'host_score','0'),'guest_score',coalesce(g.state->'guest_score','0'),
 'cue',g.state->'cue','object',g.state->'object','last_shot',g.state->'last_shot','result',g.state->'result','updated_at',g.updated_at,'deadline',g.updated_at+interval'2 minutes');
end $$;
revoke all on function politeshik_private.club_game_card(uuid)from public,anon,authenticated;
create function politeshik_private.club_game_board(p_game text)returns jsonb language sql stable security invoker set search_path=''as $$
 with entries as(select p.uid,case when g.winner=p.uid then 3 when g.winner is null then 1 else 0 end points,(g.winner=p.uid)::integer win
 from politeshik_private.club_games g cross join lateral(values(g.host),(g.guest))p(uid)
 join public.members m on m.uid=p.uid and m.status='approved'and m.role in('student','admin','developer')and coalesce(m.requested_role,'student')<>'parent'
 join auth.users u on u.id=m.uid and u.email_confirmed_at is not null
 where g.game=p_game and g.status='finished'and g.ended_at>=date_trunc('month',now()at time zone'Europe/Moscow')at time zone'Europe/Moscow'and g.ended_at<(date_trunc('month',now()at time zone'Europe/Moscow')+interval'1 month')at time zone'Europe/Moscow'),
 totals as(select uid,sum(points)points,sum(coalesce(win,0))wins,count(*)games from entries group by uid),ranked as(select *,dense_rank()over(order by points desc)place from totals)
 select coalesce(jsonb_agg(politeshik_private.reaction_person(uid)||jsonb_build_object('points',points,'wins',wins,'games',games,'place',place)order by place,wins desc,uid),'[]')from(select *from ranked order by place,wins desc,uid limit 100)r
$$;
revoke all on function politeshik_private.club_game_board(text)from public,anon,authenticated;
create function politeshik_private.club_game(p_action text,p_game text default null,p_id uuid default null,p_payload jsonb default'{}',p_nonce uuid default null)returns jsonb language plpgsql security definer set search_path=''as $$
declare actor uuid:=politeshik_private.club_game_actor();g politeshik_private.club_games;previous politeshik_private.club_game_moves;deck integer[];hand integer[];indices integer[];idx integer;cursor_index integer;mine text;other text;own_ready boolean;other_ready boolean;own_value bigint;other_value bigint;rooms jsonb;
 angle double precision;power double precision;ux double precision;uy double precision;cx double precision;cy double precision;ox double precision;oy double precision;projection double precision;cross_distance double precision;contact double precision;hx double precision;hy double precision;dx double precision;dy double precision;px double precision;py double precision;distance double precision;travel double precision;pocket record;hit boolean:=false;potted boolean:=false;scratch boolean:=false;score integer;other_uid uuid;
begin
 if p_payload is null or jsonb_typeof(p_payload)<>'object'or pg_column_size(p_payload)>2000 then raise exception 'Неверный ход';end if;
 if p_action='lobby'then
  update politeshik_private.club_games set status='cancelled',updated_at=now()where status='waiting'and created_at<now()-interval'30 minutes';
  select coalesce(jsonb_agg(politeshik_private.club_game_card(id)order by created_at desc),'[]')into rooms from(select id,created_at from politeshik_private.club_games where status in('waiting','active')order by(host=actor or guest=actor)desc nulls last,created_at desc limit 30)s;
  return jsonb_build_object('matches',rooms,'poker',politeshik_private.club_game_board('poker'),'pool',politeshik_private.club_game_board('pool'),'month',to_char(now()at time zone'Europe/Moscow','YYYY-MM'));
 end if;
 if p_action='create'then
  if p_game is null or p_game not in('poker','pool')or p_nonce is null then raise exception 'Выберите игру';end if;
  perform pg_advisory_xact_lock(hashtextextended('club-game:'||actor::text,0));
  select *into g from politeshik_private.club_games where id=p_nonce;
  if found then if g.host=actor and g.game=p_game then return politeshik_private.club_game_card(g.id);else raise exception 'Неверная партия';end if;end if;
  if exists(select 1 from politeshik_private.club_games where status in('waiting','active')and(actor=host or actor=guest))then raise exception 'Сначала завершите текущую партию';end if;
  insert into politeshik_private.club_games(id,game,host)values(p_nonce,p_game,actor);return politeshik_private.club_game_card(p_nonce);
 end if;
 select *into g from politeshik_private.club_games where id=p_id for update;if not found then raise exception 'Партия не найдена';end if;
 if p_action='state'then return politeshik_private.club_game_card(g.id);end if;
 if p_action='join'then
  perform pg_advisory_xact_lock(hashtextextended('club-game:'||actor::text,0));
  if g.guest=actor then return politeshik_private.club_game_card(g.id);end if;
  if g.status<>'waiting'or g.host=actor then raise exception 'За столом нет свободного места';end if;
  if exists(select 1 from politeshik_private.club_games where status in('waiting','active')and(actor=host or actor=guest))then raise exception 'У вас уже есть партия';end if;
  if not exists(select 1 from politeshik_private.club_visitors where uid=g.host and room='games')or coalesce(politeshik_private.club_attendance(g.host),0)<75 or politeshik_private.social_profile(g.host)is null then raise exception 'Создатель стола вышел из игровой';end if;
  if g.game='poker'then
   select array_agg(card)into deck from(select card from generate_series(0,51)card order by random())s;
   g.state:=jsonb_build_object('hand_host',to_jsonb(deck[1:5]),'hand_guest',to_jsonb(deck[6:10]),'deck',to_jsonb(deck[11:52]),'host_ready',false,'guest_ready',false);
  else g.state:=jsonb_build_object('turn',g.host,'host_score',0,'guest_score',0,'cue',jsonb_build_object('x',.4,'y',.5),'object',jsonb_build_object('x',1.25,'y',.35));end if;
  update politeshik_private.club_games set guest=actor,status='active',state=g.state,updated_at=now()where id=g.id;return politeshik_private.club_game_card(g.id);
 end if;
 if actor<>g.host and(actor<>g.guest or g.guest is null)then raise exception 'Вы не участник партии'using errcode='42501';end if;
 if p_action='cancel'and g.status='waiting'and actor=g.host then update politeshik_private.club_games set status='cancelled',updated_at=now()where id=g.id;return politeshik_private.club_game_card(g.id);end if;
 if p_nonce is null then raise exception 'Нужен идентификатор хода';end if;
 select *into previous from politeshik_private.club_game_moves where nonce=p_nonce;
 if found then if previous.actor=actor and previous.match_id=g.id and previous.action=p_action and previous.payload=p_payload then return politeshik_private.club_game_card(g.id);else raise exception 'Неверный ход';end if;end if;
 if g.status<>'active'then raise exception 'Партия уже завершена';end if;
 mine:=case when actor=g.host then'host'else'guest'end;other:=case when mine='host'then'guest'else'host'end;other_uid:=case when mine='host'then g.guest else g.host end;
 if p_action='fold'then g.status:='finished';g.winner:=other_uid;g.state:=g.state||'{"result":"fold"}';
 elsif p_action='claim'then
  if exists(select 1 from politeshik_private.club_visitors where uid=other_uid and room='games')and coalesce(politeshik_private.club_attendance(other_uid),0)>=75 and politeshik_private.social_profile(other_uid)is not null then
   if g.updated_at>now()-interval'2 minutes'or(g.game='pool'and g.state->>'turn'=actor::text)or(g.game='poker'and(not coalesce((g.state->>(mine||'_ready'))::boolean,false)or coalesce((g.state->>(other||'_ready'))::boolean,false)))then raise exception 'Соперник ещё может сделать ход';end if;
  end if;
  g.status:='finished';g.winner:=actor;g.state:=g.state||'{"result":"forfeit"}';
 elsif p_action='draw'and g.game='poker'then
  if coalesce((g.state->>(mine||'_ready'))::boolean,false)then raise exception 'Вы уже сделали обмен';end if;
  if p_payload->'cards'is null or jsonb_typeof(p_payload->'cards')<>'array'or jsonb_array_length(p_payload->'cards')>3 then raise exception 'Можно заменить до трёх карт';end if;
  select coalesce(array_agg(x::integer),'{}')into indices from jsonb_array_elements_text(p_payload->'cards')x;
  if(select count(distinct x)from unnest(indices)x)<>cardinality(indices)or exists(select 1 from unnest(indices)x where x not between 0 and 4)then raise exception 'Неверные карты';end if;
  select array_agg(x::integer order by n)into hand from jsonb_array_elements_text(g.state->('hand_'||mine))with ordinality t(x,n);
  select array_agg(x::integer order by n)into deck from jsonb_array_elements_text(g.state->'deck')with ordinality t(x,n);
  cursor_index:=1;foreach idx in array indices loop hand[idx+1]:=deck[cursor_index];cursor_index:=cursor_index+1;end loop;
  g.state:=g.state||jsonb_build_object('hand_'||mine,to_jsonb(hand),'deck',coalesce(to_jsonb(deck[cursor_index:cardinality(deck)]),'[]'),mine||'_ready',true);
  if coalesce((g.state->>(other||'_ready'))::boolean,false)then
   own_value:=politeshik_private.poker_value(hand);select array_agg(x::integer order by n)into hand from jsonb_array_elements_text(g.state->('hand_'||other))with ordinality t(x,n);other_value:=politeshik_private.poker_value(hand);
   g.status:='finished';g.winner:=case when own_value>other_value then actor when own_value<other_value then other_uid else null end;g.state:=g.state||'{"result":"showdown"}';
  end if;
 elsif p_action='shot'and g.game='pool'then
  if g.state->>'turn'<>actor::text then raise exception 'Сейчас ход соперника';end if;
  angle:=(p_payload->>'angle')::double precision;power:=(p_payload->>'power')::double precision;
  if angle is null or power is null or not(angle between 0 and 360)or not(power between 10 and 100)then raise exception 'Выберите угол и силу удара';end if;
  ux:=cos(radians(angle));uy:=sin(radians(angle));cx:=(g.state->'cue'->>'x')::double precision;cy:=(g.state->'cue'->>'y')::double precision;ox:=(g.state->'object'->>'x')::double precision;oy:=(g.state->'object'->>'y')::double precision;
  projection:=(ox-cx)*ux+(oy-cy)*uy;cross_distance:=abs((ox-cx)*uy-(oy-cy)*ux);travel:=power/100*2.5;
  if projection>0 and cross_distance<.065 and travel>=projection then
   hit:=true;contact:=greatest(0,projection-sqrt(.065*.065-cross_distance*cross_distance));hx:=cx+ux*contact;hy:=cy+uy*contact;dx:=(ox-hx)/.065;dy:=(oy-hy)/.065;
   for pocket in select*from(values(0.0,0.0),(1.0,0.0),(2.0,0.0),(0.0,1.0),(1.0,1.0),(2.0,1.0))p(x,y)loop
    px:=pocket.x-ox;py:=pocket.y-oy;distance:=px*dx+py*dy;
    if distance>0 and abs(px*dy-py*dx)<.075 and travel>=distance then potted:=true;exit;end if;
   end loop;
   cx:=greatest(.08,least(1.92,hx-ux*.05));cy:=greatest(.08,least(.92,hy-uy*.05));
   if potted then ox:=.7+random()*.85;oy:=.2+random()*.6;else ox:=greatest(.08,least(1.92,ox+dx*power/100*.4));oy:=greatest(.08,least(.92,oy+dy*power/100*.4));end if;
  else
   for pocket in select*from(values(0.0,0.0),(1.0,0.0),(2.0,0.0),(0.0,1.0),(1.0,1.0),(2.0,1.0))p(x,y)loop
    px:=pocket.x-cx;py:=pocket.y-cy;distance:=px*ux+py*uy;if distance>0 and abs(px*uy-py*ux)<.055 and travel>=distance then scratch:=true;exit;end if;
   end loop;
   cx:=case when scratch then .4 else greatest(.08,least(1.92,cx+ux*power/100*.7))end;cy:=case when scratch then .5 else greatest(.08,least(.92,cy+uy*power/100*.7))end;
  end if;
  score:=greatest(0,(g.state->>(mine||'_score'))::integer+case when potted then 1 when scratch then -1 else 0 end);
  g.state:=g.state||jsonb_build_object('cue',jsonb_build_object('x',cx,'y',cy),'object',jsonb_build_object('x',ox,'y',oy),mine||'_score',score,'turn',case when potted then actor else other_uid end,'last_shot',jsonb_build_object('hit',hit,'potted',potted,'scratch',scratch,'angle',angle,'power',power));
  if score>=5 then g.status:='finished';g.winner:=actor;g.state:=g.state||'{"result":"pool"}';end if;
 else raise exception 'Неверное действие для этой игры';end if;
 insert into politeshik_private.club_game_moves(nonce,match_id,actor,action,payload)values(p_nonce,g.id,actor,p_action,p_payload);
 update politeshik_private.club_games set state=g.state,status=g.status,winner=g.winner,updated_at=now(),ended_at=case when g.status='finished'then now()else null end where id=g.id;
 return politeshik_private.club_game_card(g.id);
end $$;
revoke all on function politeshik_private.club_game(text,text,uuid,jsonb,uuid)from public,anon;grant execute on function politeshik_private.club_game(text,text,uuid,jsonb,uuid)to authenticated;
create function public.club_game(p_action text,p_game text default null,p_id uuid default null,p_payload jsonb default'{}',p_nonce uuid default null)returns jsonb language sql security invoker set search_path=''as $$select politeshik_private.club_game(p_action,p_game,p_id,p_payload,p_nonce)$$;
revoke all on function public.club_game(text,text,uuid,jsonb,uuid)from public,anon;grant execute on function public.club_game(text,text,uuid,jsonb,uuid)to authenticated;
