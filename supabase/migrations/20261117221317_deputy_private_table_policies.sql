-- Explicit default denial in addition to revoked table privileges.
-- All access continues through the narrow, checked private RPC implementations.
create policy deputy_assignments_private on politeshik_private.group_deputies for all to public using(false) with check(false);
create policy deputy_audit_private on politeshik_private.deputy_audit for all to public using(false) with check(false);
