-- Stored free-standing coordinates stay in their bounds; active game poses use the full room projection.
do $$declare definition text;begin
 select pg_get_functiondef('politeshik_private.club_arrange_game()'::regprocedure)into definition;
 if position('y=(spot->>''y'')::numeric'in definition)=0 then raise exception 'Unexpected table arrangement function';end if;
 execute replace(definition,'y=(spot->>''y'')::numeric','y=greatest(12,least(94,(spot->>''y'')::numeric))');
end $$;
