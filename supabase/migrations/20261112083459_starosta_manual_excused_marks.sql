-- Manual У is staff-only; certificate-derived У remains computed as before.
create function politeshik_private.guard_manual_excused_marks() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_marks jsonb:='{}'; new_marks jsonb:='{}'; moved boolean:=false;
begin
  -- Maintenance writes still rely on database privileges; API writes rely on RLS.
  if auth.uid() is null or public.is_admin() then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_op<>'INSERT' then old_marks:=coalesce(old.data->'marks','{}'); end if;
  if tg_op<>'DELETE' then new_marks:=coalesce(new.data->'marks','{}'); end if;
  if tg_op='UPDATE' then moved:=new.path is distinct from old.path or new.tenant_id is distinct from old.tenant_id; end if;
  if exists(select 1 from jsonb_each_text(old_marks) o full join jsonb_each_text(new_marks) n on n.key=o.key
    where (o.value='у' or n.value='у') and (o.value is distinct from n.value or moved)) then
    raise exception 'Уважительную причину отмечают только староста и Админ Арина' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function politeshik_private.guard_manual_excused_marks() from public,anon,authenticated;
create trigger trg_manual_excused_insert before insert on public.docs for each row
 when(new.path like 'attendance/%') execute function politeshik_private.guard_manual_excused_marks();
create trigger trg_manual_excused_update before update on public.docs for each row
 when(old.path like 'attendance/%' or new.path like 'attendance/%') execute function politeshik_private.guard_manual_excused_marks();
create trigger trg_manual_excused_delete before delete on public.docs for each row
 when(old.path like 'attendance/%') execute function politeshik_private.guard_manual_excused_marks();
