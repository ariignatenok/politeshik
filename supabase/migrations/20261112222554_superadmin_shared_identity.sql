CREATE OR REPLACE FUNCTION politeshik_private.group_mascots()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t text:=public.current_tenant(); result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
    or not (politeshik_private.is_super_admin() or exists(select 1 from public.members where uid=auth.uid() and tenant_id=t and status='approved')) then
    raise exception 'Нет доступа к группе' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'uid',m.uid,'rid',case when a.uid is not null and m.tenant_id<>t then null else p.data->>'rid' end,'name',case when a.uid is not null and m.tenant_id<>t then 'Админ Арина' else m.full_name end,
    'role',case when a.uid is not null then 'superadmin' else m.role end,
    -- Arina explicitly shares her home photo and mascot in every group's conversations.
    'avatar',coalesce(v.data->>'v',p.data->>'avatar',''),
    'mascot',coalesce(v.data->'mascot',p.data->'mascot','{}'::jsonb))), '[]') into result
  from public.members m left join politeshik_private.super_admins a on a.uid=m.uid
    left join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||m.uid::text
    left join public.docs v on v.tenant_id=m.tenant_id and v.path='avatars/'||m.uid::text
  where m.status='approved' and coalesce(m.requested_role,'student')<>'parent' and m.role in('student','admin','developer') and (m.tenant_id=t or a.uid is not null);
  return result;
end $function$;

CREATE OR REPLACE FUNCTION politeshik_private.self_attendance(p_date date, p_pair integer, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=politeshik_private.social_actor();home text; marks jsonb; k text; saved_import text;saved_self text;result jsonb;begin
 select tenant_id into home from public.members where uid=actor and status='approved' and coalesce(requested_role,'student')<>'parent';
 if politeshik_private.is_super_admin() and public.current_tenant()<>home then raise exception 'Личная посещаемость доступна только в вашей основной группе' using errcode='42501';end if;
 if p_status is null or p_status not in('п','о','н') or not politeshik_private.attendance_window(home,p_date,p_pair) then
  raise exception 'Отметиться можно на паре и в течение 24 часов после её окончания' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 select coalesce(data->'marks','{}') into marks from public.docs where tenant_id=home and path='attendance/'||actor::text for update;
 marks:=coalesce(marks,'{}');k:=p_date::text||'|'||p_pair;
 if marks ? k then raise exception 'Отметка уже поставлена — исправить её может только староста';end if;
 if exists(select 1 from public.docs d cross join lateral jsonb_array_elements(coalesce(d.data->'items','[]')) c
  where d.tenant_id=home and d.path='certs/'||actor::text and c->>'confirmed'='true' and c->>'from'<=p_date::text and c->>'to'>=p_date::text
  and (coalesce(jsonb_array_length(c->'pairs'),0)=0 or c->'pairs' @> jsonb_build_array(p_pair))) then
  raise exception 'Пара закрыта подтверждённой справкой';end if;
 saved_import:=current_setting('app.import',true);saved_self:=current_setting('app.self_attendance',true);perform set_config('app.self_attendance',actor::text,true);perform set_config('app.import','on',true);
 insert into public.docs(tenant_id,path,data) values(home,'attendance/'||actor::text,jsonb_build_object('marks',marks||jsonb_build_object(k,p_status),'updated',now()))
 on conflict(tenant_id,path) do update set data=public.docs.data||excluded.data returning data into result;
 perform set_config('app.import',coalesce(saved_import,''),true);perform set_config('app.self_attendance',coalesce(saved_self,''),true);return result;
end $function$;
CREATE OR REPLACE FUNCTION politeshik_private.group_context()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t text:=public.current_tenant(); u uuid:=auth.uid(); home text; profile jsonb; member jsonb; appearance jsonb;
begin
  if u is null then raise exception 'Нужно войти в аккаунт'; end if;
  select m.tenant_id into home from public.members m where m.uid=u;
  select d.data into profile from public.docs d where d.tenant_id=coalesce(home,'group_1') and d.path='profiles/'||u::text;
  select to_jsonb(m) into member from public.members m where m.tenant_id=t and m.uid=u;
  if politeshik_private.is_super_admin() then
    select d.data into appearance from public.docs d where d.tenant_id=coalesce(home,'group_1') and d.path='avatars/'||u::text;
    profile:=coalesce(profile,'{}')||jsonb_build_object('avatar',coalesce(appearance->>'v',profile->>'avatar',''),'mascot',coalesce(appearance->'mascot',profile->'mascot','{}'));

    member:=coalesce(member,jsonb_build_object('uid',u,'tenant_id',t,'role','admin','status','approved','full_name','Админ Арина'));
  end if;
  return jsonb_build_object('uid',u,'tenant_id',t,'home_tenant',coalesce(home,'group_1'),
    'is_super_admin',politeshik_private.is_super_admin(),'is_admin',public.is_admin(),
    'is_developer',public.is_developer(),'member',member,'profile',profile);
end $function$
;
