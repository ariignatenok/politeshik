-- Manual У is staff-only; certificate-derived У remains computed as before.
create or replace function politeshik_private.guard_manual_excused_marks() returns trigger
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
    where (o.value in('у','уп') or n.value in('у','уп')) and (o.value is distinct from n.value or moved)) then
    raise exception 'Уважительную причину отмечают только староста и Админ Арина' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

-- A parent request must not retain the provisional student role.
create function politeshik_private.normalize_parent_member() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.requested_role='parent' and new.role='student' then new.role:='parent'; end if;
  return new;
end $$;
revoke all on function politeshik_private.normalize_parent_member() from public,anon,authenticated;
create trigger trg_normalize_parent_member before insert or update on public.members
 for each row execute function politeshik_private.normalize_parent_member();
update public.members set role='parent' where requested_role='parent' and role='student';

create function politeshik_private.guard_parent_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.members m where m.tenant_id=new.tenant_id and m.uid::text=split_part(new.path,'/',2)
    and (m.role='parent' or m.requested_role='parent')) then
    if coalesce(new.data->>'rid','')<>'' then
      raise exception 'Родитель не занимает фамилию студента' using errcode='42501'; end if;
    new.data:=new.data||jsonb_build_object('role','parent');
  end if;
  return new;
end $$;
revoke all on function politeshik_private.guard_parent_profile() from public,anon,authenticated;
create trigger trg_parent_profile_guard before insert or update on public.docs
 for each row when(new.path like 'profiles/%') execute function politeshik_private.guard_parent_profile();

create function politeshik_private.admin_set_parent_child(p_parent uuid,p_child uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare t text:=public.current_tenant(); parent_row public.members; selected_child_name text; parent_profile jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Только староста и Админ Арина' using errcode='42501'; end if;
  select * into parent_row from public.members where tenant_id=t and uid=p_parent for update;
  if not found or parent_row.role not in('student','parent') or parent_row.requested_role<>'parent' then
    raise exception 'Родитель не найден в выбранной группе'; end if;
  if p_parent=p_child then raise exception 'Родитель и ребёнок — разные аккаунты'; end if;
  select coalesce(nullif(d.data->>'name',''),m.full_name) into selected_child_name
    from public.members m join public.docs d on d.tenant_id=m.tenant_id and d.path='profiles/'||m.uid::text
    join public.roster r on r.tenant_id=m.tenant_id and r.rid=d.data->>'rid' and r.flag=''
    where m.uid=p_child and m.tenant_id=t and m.status='approved' and m.requested_role<>'parent'
      and m.role in('student','admin','developer');
  if selected_child_name is null then raise exception 'Выберите зарегистрированного студента своей группы'; end if;
  update public.members set child_uid=p_child,child_name=selected_child_name,role='parent'
    where tenant_id=t and uid=p_parent;
  select data into parent_profile from public.docs where tenant_id=t and path='profiles/'||p_parent::text;
  parent_profile:=(coalesce(parent_profile,'{}')-'rid'-'subgroup')||jsonb_build_object('role','parent','name',parent_row.full_name);
  insert into public.docs(tenant_id,path,data) values(t,'profiles/'||p_parent::text,parent_profile)
    on conflict(tenant_id,path) do update set data=excluded.data;
  delete from public.docs where tenant_id=t and path like 'claims/%' and data->>'uid'=p_parent::text;
  return true;
end $$;
revoke all on function politeshik_private.admin_set_parent_child(uuid,uuid) from public,anon;
grant execute on function politeshik_private.admin_set_parent_child(uuid,uuid) to authenticated;
create function public.admin_set_parent_child(p_parent uuid,p_child uuid) returns boolean
language sql security invoker set search_path='' as $$ select politeshik_private.admin_set_parent_child(p_parent,p_child) $$;
revoke all on function public.admin_set_parent_child(uuid,uuid) from public,anon;
grant execute on function public.admin_set_parent_child(uuid,uuid) to authenticated;
