-- Roster membership replaces the original single-group rid pattern.
alter table public.subgroup_assign drop constraint subgroup_assign_rid_check;
alter table public.subgroup_assign add constraint subgroup_assign_roster_fk foreign key(rid) references public.roster(rid);
create or replace function public.set_subgroup(p_rid text,p_subgroup text) returns integer
language plpgsql security definer set search_path='' as $$
declare t text:=public.current_tenant();n integer;begin
 if not public.is_admin() then raise exception 'Подгруппы меняет только староста своей группы или Админ Арина' using errcode='42501';end if;
 if p_subgroup is null or p_subgroup not in('1','2') or not exists(select 1 from public.roster r where r.tenant_id=t and r.rid=p_rid and r.flag='') then raise exception 'Выберите студента своей группы и подгруппу 1 или 2' using errcode='42501';end if;
 insert into public.subgroup_assign(tenant_id,rid,subgroup) values(t,p_rid,p_subgroup) on conflict(tenant_id,rid) do update set subgroup=excluded.subgroup;
 update public.roster set subgroup=p_subgroup where tenant_id=t and rid=p_rid;
 update public.docs d set data=jsonb_set(d.data,'{subgroup}',to_jsonb(p_subgroup)) where d.tenant_id=t and d.path like 'profiles/%' and d.path not like 'profiles/%/%' and d.data->>'rid'=p_rid;
 get diagnostics n=row_count;return n;
end $$;
