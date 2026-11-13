-- Shared seating and queued food/drink service; never changes academic or tournament permissions.
alter table politeshik_private.club_visitors
 add column seat integer check(seat between 1 and 12),
 add column snack text not null default'none'check(snack in('none','popcorn')),
 add constraint cinema_seat_room check(seat is null or room='cinema');
create unique index cinema_one_guest_per_seat on politeshik_private.club_visitors(seat)where seat is not null;
alter table politeshik_private.club_visitors drop constraint club_visitors_drink_check;
alter table politeshik_private.club_visitors add constraint club_visitors_drink_check check(drink in('none','coffee','tea','lemonade','orange','apple','cherry','mango','water','berry','citrus','tropical'));
create table politeshik_private.club_service_orders(
 id uuid primary key,uid uuid not null references auth.users(id)on delete cascade,room text not null check(room in('main','cinema','games')),
 item text not null check(item in('coffee','tea','lemonade','orange','apple','cherry','mango','water','berry','citrus','tropical','popcorn')),
 source text not null check(source in('bar','waiter')),created_at timestamptz not null default clock_timestamp(),ready_at timestamptz not null,
 finished_at timestamptz,delivered boolean not null default false
);
create unique index club_one_pending_service on politeshik_private.club_service_orders(uid)where finished_at is null;
create index club_service_ready on politeshik_private.club_service_orders(ready_at)where finished_at is null;
create index club_service_owner on politeshik_private.club_service_orders(uid,created_at desc);
alter table politeshik_private.club_service_orders enable row level security;
revoke all on politeshik_private.club_service_orders from public,anon,authenticated;
create policy club_service_rpc_only on politeshik_private.club_service_orders as restrictive for all to authenticated using(false)with check(false);
create function politeshik_private.club_scene_cleanup()returns trigger language plpgsql security definer set search_path=''as $$
begin
 if tg_op='DELETE'then update politeshik_private.club_service_orders set finished_at=clock_timestamp()where uid=old.uid and finished_at is null;return old;end if;
 if new.room is distinct from old.room then
  new.seat:=null;update politeshik_private.club_service_orders set finished_at=clock_timestamp()where uid=new.uid and finished_at is null;
 elsif(new.x,new.y)is distinct from(old.x,old.y)and new.seat is not distinct from old.seat then new.seat:=null;end if;
 return new;
end $$;
revoke all on function politeshik_private.club_scene_cleanup()from public,anon,authenticated;
create trigger club_scene_on_move before update on politeshik_private.club_visitors for each row execute function politeshik_private.club_scene_cleanup();
create trigger club_scene_on_leave before delete on politeshik_private.club_visitors for each row execute function politeshik_private.club_scene_cleanup();
create function politeshik_private.club_arrange_game()returns trigger language plpgsql security definer set search_path=''as $$
begin
 if new.status in('waiting','active')then
  perform 1 from politeshik_private.club_visitors where uid in(new.host,new.guest)and room='games'order by uid for update;
  update politeshik_private.club_visitors set x=case when uid=new.host then 18 else 82 end,y=case when new.game='poker'then 43 else 75 end,seat=null,dance='still',dancing=false where uid in(new.host,new.guest)and room='games';
 end if;return new;
end $$;
revoke all on function politeshik_private.club_arrange_game()from public,anon,authenticated;
create trigger club_game_arrange after insert or update of status,guest,state on politeshik_private.club_games for each row execute function politeshik_private.club_arrange_game();
create function politeshik_private.club_deliver_orders()returns void language plpgsql security definer set search_path=''as $$
declare item politeshik_private.club_service_orders;guest politeshik_private.club_visitors;locked_id uuid;begin
 for item in select*from politeshik_private.club_service_orders where finished_at is null and ready_at<=clock_timestamp()order by ready_at limit 20 loop
  select*into guest from politeshik_private.club_visitors where uid=item.uid for update skip locked;if not found then continue;end if;
  select id into locked_id from politeshik_private.club_service_orders where id=item.id and finished_at is null for update skip locked;if not found then continue;end if;
  if guest.room=item.room and exists(select 1 from public.members where uid=item.uid and status='approved')then
   if item.item='popcorn'then update politeshik_private.club_visitors set snack='popcorn'where uid=item.uid;
   else update politeshik_private.club_visitors set drink=item.item where uid=item.uid;end if;
   update politeshik_private.club_service_orders set finished_at=clock_timestamp(),delivered=true where id=item.id;
  else update politeshik_private.club_service_orders set finished_at=clock_timestamp()where id=item.id;end if;
 end loop;
end $$;
revoke all on function politeshik_private.club_deliver_orders()from public,anon,authenticated;
create function politeshik_private.club_scene_visitors(p_visitors jsonb)returns jsonb language sql stable security invoker set search_path=''as $$
 select coalesce(jsonb_agg(v||jsonb_build_object('seat',c.seat,'snack',c.snack,'pose',case when g.id is not null then g.game when c.seat is not null then'seated'else'standing'end,'game_id',g.id,
 'service',case when o.id is not null then jsonb_build_object('item',o.item,'source',o.source,'created_at',o.created_at,'ready_at',o.ready_at)else null end)
 ||case when g.id is not null then jsonb_build_object('x',case when g.host=c.uid then 18 else 82 end,'y',case when g.game='poker'then 43 else 75 end)else'{}'::jsonb end order by c.uid),'[]')
 from jsonb_array_elements(p_visitors)v join politeshik_private.club_visitors c on c.uid=(v->>'uid')::uuid
 left join lateral(select id,game,host from politeshik_private.club_games where c.room='games'and status in('waiting','active')and(c.uid=host or c.uid=guest)order by created_at desc limit 1)g on true
 left join politeshik_private.club_service_orders o on o.uid=c.uid and o.room=c.room and o.finished_at is null
$$;
revoke all on function politeshik_private.club_scene_visitors(jsonb)from public,anon,authenticated;
DO $migration$declare definition text;begin
 select pg_get_functiondef('politeshik_private.club_visit(text,boolean)'::regprocedure)into definition;
 if position(' return jsonb_build_object(''visitors'',visitors'in definition)=0 or position(' if p_action is null'in definition)=0 then raise exception 'Unexpected club state';end if;
 definition:=replace(definition,' if p_action is null',' perform politeshik_private.club_deliver_orders();'||E'\n'||' if p_action is null');
 definition:=replace(definition,' return jsonb_build_object(''visitors'',visitors',' visitors:=politeshik_private.club_scene_visitors(visitors);'||E'\n'||' return jsonb_build_object(''visitors'',visitors');execute definition;
 select pg_get_functiondef('politeshik_private.club_customize(text,text,text)'::regprocedure)into definition;
 if position('''mango'',''water'')'in definition)=0 then raise exception 'Unexpected drinks menu';end if;
 execute replace(definition,'''mango'',''water'')','''mango'',''water'',''berry'',''citrus'',''tropical'')');
end $migration$;
create function politeshik_private.club_service(p_action text,p_item text default null,p_seat integer default null,p_nonce uuid default null)returns jsonb language plpgsql security definer set search_path=''as $$
declare actor uuid:=politeshik_private.social_actor();guest politeshik_private.club_visitors;old_order politeshik_private.club_service_orders;sofa integer;seat_x integer;seat_y integer;begin
 perform politeshik_private.club_deliver_orders();
 select*into guest from politeshik_private.club_visitors where uid=actor for update;if not found then raise exception 'Сначала зайдите в клуб';end if;
 if guest.room<>'main'and coalesce(politeshik_private.club_attendance(actor),0)<75 then raise exception 'Для этой комнаты нужна посещаемость от 75%%'using errcode='42501';end if;
 if p_action='sit'then
  if guest.room<>'cinema'or p_seat is null or p_seat not between 1 and 12 then raise exception 'Выберите место на красном диване';end if;
  sofa:=(p_seat-1)/2;seat_x:=case when sofa%2=0 then 22 else 64 end+case when(p_seat-1)%2=0 then 0 else 14 end;seat_y:=58+(sofa/2)*15;
  begin update politeshik_private.club_visitors set seat=p_seat,x=seat_x,y=seat_y,dance='still',dancing=false where uid=actor;
  exception when unique_violation then raise exception 'Это место уже занято. Выберите соседнее';end;
 elsif p_action='stand'then update politeshik_private.club_visitors set seat=null,y=least(94,y+5)where uid=actor;
 elsif p_action='clear'then
  if p_item='snack'then update politeshik_private.club_visitors set snack='none'where uid=actor;
  elsif p_item='drink'then update politeshik_private.club_visitors set drink='none'where uid=actor;
  else raise exception 'Неверный предмет';end if;
 elsif p_action in('order_bar','order_waiter')then
  if p_item is null or p_item not in('coffee','tea','lemonade','orange','apple','cherry','mango','water','berry','citrus','tropical','popcorn')or p_nonce is null then raise exception 'Выберите напиток или попкорн';end if;
  if( p_action='order_waiter'or p_item='popcorn')and guest.room<>'cinema'then raise exception 'Официант с попкорном работает в кино';end if;
  select*into old_order from politeshik_private.club_service_orders where id=p_nonce;
  if found then if old_order.uid<>actor or old_order.item<>p_item then raise exception 'Неверный заказ';end if;return politeshik_private.club_visit('state');end if;
  if exists(select 1 from politeshik_private.club_service_orders where uid=actor and finished_at is null)then raise exception 'Ваш заказ уже готовится';end if;
  insert into politeshik_private.club_service_orders(id,uid,room,item,source,ready_at)values(p_nonce,actor,guest.room,p_item,case when p_action='order_bar'then'bar'else'waiter'end,clock_timestamp()+interval'4 seconds');
 else raise exception 'Неверное действие';end if;return politeshik_private.club_visit('state');
end $$;
revoke all on function politeshik_private.club_service(text,text,integer,uuid)from public,anon;grant execute on function politeshik_private.club_service(text,text,integer,uuid)to authenticated;
create function public.club_service(p_action text,p_item text default null,p_seat integer default null,p_nonce uuid default null)returns jsonb language sql security invoker set search_path=''as $$select politeshik_private.club_service(p_action,p_item,p_seat,p_nonce)$$;
revoke all on function public.club_service(text,text,integer,uuid)from public,anon;grant execute on function public.club_service(text,text,integer,uuid)to authenticated;
