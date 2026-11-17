-- Independent two-player tables, with stable slots and an expanding room.
alter table politeshik_private.club_games add column table_slot integer check(table_slot between 1 and 100);
with slots as(select id,row_number()over(partition by game order by created_at,id)as slot from politeshik_private.club_games where status in('waiting','active'))
update politeshik_private.club_games g set table_slot=s.slot from slots s where s.id=g.id;
create unique index club_active_table_slot on politeshik_private.club_games(game,table_slot)where status in('waiting','active');
create function politeshik_private.allocate_club_table()returns trigger language plpgsql security definer set search_path=''as $$
declare highest integer;begin
 if new.status not in('waiting','active')then return new;end if;
 if tg_op='UPDATE'and old.table_slot is not null and new.table_slot=old.table_slot and old.status in('waiting','active')then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('club-table-slot:'||new.game,0));
 select coalesce(max(table_slot),0)into highest from politeshik_private.club_games where game=new.game and status in('waiting','active')and id<>new.id;
 if new.table_slot is null then
  select n into new.table_slot from generate_series(1,least(100,highest+1))n where not exists(select 1 from politeshik_private.club_games where game=new.game and status in('waiting','active')and table_slot=n and id<>new.id)order by n limit 1;
 end if;
 if new.table_slot is null or new.table_slot not between 1 and least(100,greatest(2,highest+1))then raise exception 'Выберите свободный стол в игровой';end if;
 if exists(select 1 from politeshik_private.club_games where game=new.game and status in('waiting','active')and table_slot=new.table_slot and id<>new.id)then raise exception 'Этот стол уже занят. Выберите соседний';end if;
 return new;
end $$;
revoke all on function politeshik_private.allocate_club_table()from public,anon,authenticated;
create trigger club_table_allocate before insert or update of status,table_slot on politeshik_private.club_games for each row execute function politeshik_private.allocate_club_table();
create function politeshik_private.club_table_layout()returns jsonb language sql stable security invoker set search_path=''as $$
 with slots as(select least(100,greatest(2,coalesce(max(table_slot)filter(where game='poker'),0)+1))as poker,
 least(100,greatest(2,coalesce(max(table_slot)filter(where game='pool'),0)+1))as pool
 from politeshik_private.club_games where status in('waiting','active'))
 select jsonb_build_object('poker',poker,'pool',pool,'poker_rows',(poker+1)/2,'height',greatest(1100,ceil((400+((poker+1)/2+(pool+1)/2)*280)/0.9)::integer))from slots
$$;
revoke all on function politeshik_private.club_table_layout()from public,anon,authenticated;
create function politeshik_private.club_table_spot(p_game text,p_slot integer,p_guest boolean,p_layout jsonb)returns jsonb language sql immutable security invoker set search_path=''as $$
 select jsonb_build_object('x',case when(p_slot-1)%2=0 then 25 else 75 end+case when p_guest then 13 else -13 end,
 'y',100.0*(310+((p_slot-1)/2+case when p_game='pool'then(p_layout->>'poker_rows')::integer else 0 end)*280)/(p_layout->>'height')::integer)
$$;
revoke all on function politeshik_private.club_table_spot(text,integer,boolean,jsonb)from public,anon,authenticated;
create or replace function politeshik_private.club_arrange_game()returns trigger language plpgsql security definer set search_path=''as $$
declare layout jsonb;spot jsonb;player uuid;begin
 if new.status in('waiting','active')then
  layout:=politeshik_private.club_table_layout();
  perform 1 from politeshik_private.club_visitors where uid in(new.host,new.guest)and room='games'order by uid for update;
  for player in select uid from politeshik_private.club_visitors where uid in(new.host,new.guest)and room='games'loop
   spot:=politeshik_private.club_table_spot(new.game,new.table_slot,player<>new.host,layout);
   update politeshik_private.club_visitors set x=(spot->>'x')::numeric,y=(spot->>'y')::numeric,seat=null,dance='still',dancing=false where uid=player;
  end loop;
 end if;return new;
end $$;
create or replace function politeshik_private.club_scene_visitors(p_visitors jsonb)returns jsonb language sql stable security invoker set search_path=''as $$
 with layout as materialized(select politeshik_private.club_table_layout()as data)
 select coalesce(jsonb_agg(v||jsonb_build_object('seat',c.seat,'snack',c.snack,'pose',case when g.id is not null then g.game when c.seat is not null then'seated'else'standing'end,'game_id',g.id,'table_slot',g.table_slot,
 'service',case when o.id is not null then jsonb_build_object('item',o.item,'source',o.source,'created_at',o.created_at,'ready_at',o.ready_at)else null end)
 ||case when g.id is not null then politeshik_private.club_table_spot(g.game,g.table_slot,g.host<>c.uid,layout.data)else'{}'::jsonb end order by c.uid),'[]')
 from jsonb_array_elements(p_visitors)v join politeshik_private.club_visitors c on c.uid=(v->>'uid')::uuid cross join layout
 left join lateral(select id,game,host,table_slot from politeshik_private.club_games where c.room='games'and status in('waiting','active')and(c.uid=host or c.uid=guest)order by created_at desc limit 1)g on true
 left join politeshik_private.club_service_orders o on o.uid=c.uid and o.room=c.room and o.finished_at is null
$$;
do $migration$declare definition text;begin
 select pg_get_functiondef('politeshik_private.club_game_card(uuid)'::regprocedure)into definition;
 if position('''id'',g.id,''game'',g.game'in definition)=0 then raise exception 'Unexpected game card';end if;
 execute replace(definition,'''id'',g.id,''game'',g.game','''id'',g.id,''table_slot'',g.table_slot,''game'',g.game');
 select pg_get_functiondef('politeshik_private.club_game(text,text,uuid,jsonb,uuid)'::regprocedure)into definition;
 if position('insert into politeshik_private.club_games(id,game,host)values(p_nonce,p_game,actor)'in definition)=0 then raise exception 'Unexpected game creation';end if;
 definition:=replace(definition,'insert into politeshik_private.club_games(id,game,host)values(p_nonce,p_game,actor)',
 'insert into politeshik_private.club_games(id,game,host,table_slot)values(p_nonce,p_game,actor,nullif(p_payload->>''slot'','''')::integer)');
 definition:=replace(definition,'limit 30)s','limit 100)s');execute definition;
 select pg_get_functiondef('politeshik_private.club_visit(text,boolean)'::regprocedure)into definition;
 if position('''room'',room_id'in definition)=0 then raise exception 'Unexpected room state';end if;
 execute replace(definition,'''room'',room_id','''table_layout'',case when room_id=''games''then politeshik_private.club_table_layout()else null end,''room'',room_id');
end $migration$;
