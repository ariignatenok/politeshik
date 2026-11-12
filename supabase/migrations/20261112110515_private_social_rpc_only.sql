-- Private social data is reachable only through the authenticated RPCs.
-- Explicit deny policies document the intended default-deny behavior without granting table access.
create policy social_rpc_only on politeshik_private.club_visitors as restrictive for all to authenticated using(false) with check(false);
create policy social_rpc_only on politeshik_private.profile_likes as restrictive for all to authenticated using(false) with check(false);
create policy social_rpc_only on politeshik_private.peer_messages as restrictive for all to authenticated using(false) with check(false);
