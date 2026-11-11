CREATE OR REPLACE FUNCTION public.teacher_students()
 RETURNS TABLE(uid text, name text, rid text, subgroup text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (public.is_teacher() or public.is_admin()) or public.is_blocked() then raise exception 'Только для преподавателя'; end if;
  return query
    select split_part(d.path, '/', 2), d.data ->> 'name', d.data ->> 'rid', d.data ->> 'subgroup'
    from public.docs d join public.members m on m.uid::text = split_part(d.path, '/', 2) and m.tenant_id = d.tenant_id
    where d.tenant_id = public.current_tenant() and d.path ~ '^profiles/[^/]+$' and coalesce(d.data ->> 'rid', '') <> ''
      and m.status = 'approved' and m.role in ('student', 'admin', 'developer');
end $function$
;
CREATE OR REPLACE FUNCTION public.curator_students()
 RETURNS TABLE(uid text, name text, rid text, subgroup text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.member_role() not in ('curator', 'admin') then raise exception 'Только для куратора'; end if;
  return query select s.uid::text, coalesce(d.data ->> 'name', s.full_name), d.data ->> 'rid', d.data ->> 'subgroup'
    from public.members c join public.members s on s.tenant_id = c.tenant_id and s.group_id = c.group_id and s.role in ('student', 'developer') and s.status = 'approved'
    left join public.docs d on d.tenant_id = s.tenant_id and d.path = 'profiles/' || s.uid::text
    where c.uid = auth.uid() and c.tenant_id = public.current_tenant() and c.role = 'curator' and c.status = 'approved';
end $function$
;
CREATE OR REPLACE FUNCTION public.curator_manages(p_uid text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.members c join public.members s on s.tenant_id = c.tenant_id and s.group_id = c.group_id
    where c.uid = auth.uid() and c.tenant_id = public.current_tenant() and c.role = 'curator' and c.status = 'approved'
      and s.uid::text = p_uid and s.role in ('student', 'developer') and s.status = 'approved')
$function$
;
CREATE OR REPLACE FUNCTION public.department_report()
 RETURNS TABLE(group_id text, group_name text, curator text, students integer, pending integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.member_role() not in ('department', 'admin') then raise exception 'Только для отделения'; end if;
  return query select g.id, g.name, coalesce((select m.full_name from public.members m where m.uid = g.curator_uid and m.tenant_id = g.tenant_id), ''),
      (select count(*)::int from public.members s where s.tenant_id = g.tenant_id and s.group_id = g.id and s.role in ('student', 'developer') and s.status = 'approved'),
      (select count(*)::int from public.members s where s.tenant_id = g.tenant_id and s.group_id = g.id and s.status = 'pending')
    from public.groups g where g.tenant_id = public.current_tenant() order by g.name;
end $function$
;
