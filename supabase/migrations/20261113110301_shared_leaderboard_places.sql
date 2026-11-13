-- Competition ranking: equal displayed scores share a place (1, 1, 3).
-- Names/UIDs stabilize display order only, never the awarded place.
DO $migration$declare definition text;begin
 select pg_get_functiondef('politeshik_private.group_leaderboard()'::regprocedure)into definition;
 if position('row_number()over(order by score desc,full_name,uid)'in definition)=0 then raise exception 'Unexpected group leaderboard ranking';end if;
 definition:=replace(definition,'row_number()over(order by score desc,full_name,uid)','rank()over(order by score desc)');
 definition:=replace(definition,'order by r.place)','order by r.place,r.full_name,r.uid)');
 execute definition;
 select pg_get_functiondef('politeshik_private.profile_leaderboard()'::regprocedure)into definition;
 if position('row_number() over(order by score desc,uid)'in definition)=0 then raise exception 'Unexpected profile leaderboard ranking';end if;
 definition:=replace(definition,'row_number() over(order by score desc,uid)','rank() over(order by score desc)');
 definition:=replace(definition,'order by place)','order by place,uid)');
 execute definition;
end $migration$;
