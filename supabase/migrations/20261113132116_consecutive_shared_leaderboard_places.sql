-- Rank distinct scores consecutively: 1, 1, 1, 2, 3. Ties never consume the next place.
DO $migration$declare definition text;function_name text;begin
 foreach function_name in array array['group_leaderboard','profile_leaderboard']loop
 select pg_get_functiondef(to_regprocedure('politeshik_private.'||function_name||'()'))into definition;
 if definition is null or definition !~ 'rank\(\)\s*over\(order by score desc\)'or position('dense_rank()'in definition)>0 then raise exception 'Unexpected leaderboard ranking: %',function_name;end if;
 execute regexp_replace(definition,'rank\(\)(\s*over\(order by score desc\))','dense_rank()\1','g');
 end loop;
end $migration$;
