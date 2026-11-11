-- Narrow hardening of the new registration code check and the two changed trigger entrypoints.
create or replace function politeshik_private.check_group_code(p_code text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if (select count(*) from public.code_attempts where at>now()-interval '10 minutes')>100 then
    raise exception 'Слишком много попыток';
  end if;
  if exists(select 1 from public.group_codes c where c.active and c.code=upper(btrim(p_code))) then return true; end if;
  insert into public.code_attempts(tenant_id) values('group_1');
  return false;
end $$;
revoke execute on function politeshik_private.check_group_code(text) from public,anon,authenticated;
grant usage on schema politeshik_private to anon;
grant execute on function politeshik_private.check_group_code(text) to anon,authenticated;
create or replace function public.check_group_code(p_code text) returns boolean
language sql security invoker set search_path='' as $$ select politeshik_private.check_group_code(p_code) $$;
revoke execute on function public.check_group_code(text) from public;
grant execute on function public.check_group_code(text) to anon,authenticated;
revoke execute on function public.docs_guard(),public.chat_guard() from public,anon,authenticated;
create policy deny_direct_access on politeshik_private.super_admins for all using(false) with check(false);
create policy deny_direct_access on politeshik_private.group_selection for all using(false) with check(false);
create policy deny_direct_access on politeshik_private.staff_credentials for all using(false) with check(false);
