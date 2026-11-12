-- Club membership lasts until an explicit exit; room choices are private to the authenticated owner to edit.
alter table politeshik_private.club_visitors
 add column dance text not null default 'bounce' check(dance in('still','bounce','sway','spin','shuffle','wave')),
 add column drink text not null default 'none' check(drink in('none','coffee','tea','lemonade','orange','apple','cherry','mango','water')),
 add column thought text not null default '' check(char_length(thought)<=160);
update politeshik_private.club_visitors set dance='still' where not dancing;
create or replace function politeshik_private.club_visit(p_action text default 'state',p_dancing boolean default true) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor(); visitors jsonb;
begin
 if p_action is null or p_action not in('state','join','beat','leave') then raise exception 'Неверное действие';end if;
 if p_action='join' then
  insert into politeshik_private.club_visitors(uid,dancing,dance) values(actor,coalesce(p_dancing,true),case when coalesce(p_dancing,true) then 'bounce' else 'still' end)
  on conflict(uid) do update set seen_at=now();
 elsif p_action='beat' then update politeshik_private.club_visitors set seen_at=now() where uid=actor;
 elsif p_action='leave' then delete from politeshik_private.club_visitors where uid=actor;end if;
 select coalesce(jsonb_agg(card||jsonb_build_object('dancing',v.dancing,'dance',v.dance,'drink',v.drink,'thought',v.thought) order by v.uid),'[]') into visitors
 from politeshik_private.club_visitors v cross join lateral (select politeshik_private.social_profile(v.uid)-'avatar'-'about' as card) p
 where card is not null;
 return jsonb_build_object('visitors',visitors,'joined',exists(select 1 from politeshik_private.club_visitors where uid=actor));
end $$;
create function politeshik_private.club_customize(p_dance text default null,p_drink text default null,p_thought text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor();begin
 if p_dance is not null and p_dance not in('still','bounce','sway','spin','shuffle','wave') then raise exception 'Неизвестное движение';end if;
 if p_drink is not null and p_drink not in('none','coffee','tea','lemonade','orange','apple','cherry','mango','water') then raise exception 'Неизвестный напиток';end if;
 if p_thought is not null and char_length(p_thought)>160 then raise exception 'Мысль: не больше 160 символов';end if;
 update politeshik_private.club_visitors set dance=coalesce(p_dance,dance),
  dancing=case when p_dance is null then dancing else p_dance<>'still' end,
  drink=coalesce(p_drink,drink),thought=coalesce(btrim(p_thought),thought),seen_at=now() where uid=actor;
 if not found then raise exception 'Сначала зайдите на танцпол';end if;
 return politeshik_private.club_visit('state',true);
end $$;
revoke all on function politeshik_private.club_customize(text,text,text) from public,anon;
grant execute on function politeshik_private.club_customize(text,text,text) to authenticated;
create function public.club_customize(p_dance text default null,p_drink text default null,p_thought text default null) returns jsonb
language sql security invoker set search_path='' as $$select politeshik_private.club_customize(p_dance,p_drink,p_thought)$$;
revoke all on function public.club_customize(text,text,text) from public,anon;
grant execute on function public.club_customize(text,text,text) to authenticated;
