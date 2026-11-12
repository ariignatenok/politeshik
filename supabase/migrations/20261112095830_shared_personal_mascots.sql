-- A public appearance is a bounded catalogue of IDs, scoped to approved peers.
-- No policy, role, attendance, or authentication function is replaced here.
create function politeshik_private.save_my_mascot(p_look jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare home text; k text; allowed jsonb:='{"body":["green","pink","blue","lilac","cream","peach","white","dark"],"outfit":["none","hoodie","cardigan","uniform","fur","pinkfur","leopard","leather","striped"],"hair":["none","bob","long","waves","twotails","bun","pixie","emo","mohawk","curls"],"hairColor":["black","brown","blonde","ginger","pink","blue","purple","white"],"glasses":["none","round","square","cat","heart","sun","stars"],"hand":["none","coffee","tea","bubbletea","book","phone","flower"],"mood":["","cheer","thinking","sleepy","angry"]}'; canonical jsonb:='{}';
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then
    raise exception 'Войдите в подтверждённый аккаунт' using errcode='42501'; end if;
  select m.tenant_id into home from public.members m where m.uid=auth.uid() and m.status='approved'
    and m.role in('student','admin','developer') and coalesce(m.requested_role,'student')<>'parent';
  if home is null then raise exception 'Внешность доступна после одобрения регистрации' using errcode='42501'; end if;
  if p_look is null or jsonb_typeof(p_look)<>'object' or pg_column_size(p_look)>4000 then raise exception 'Неверный образ'; end if;
  if exists(select 1 from jsonb_object_keys(p_look) x where not (allowed ? x or x='acc')) then raise exception 'Неизвестная настройка'; end if;
  for k in select jsonb_object_keys(allowed) loop
    if p_look ? k then
      if jsonb_typeof(p_look->k)<>'string' or not (allowed->k ? (p_look->>k)) then raise exception 'Неверная настройка: %',k; end if;
      canonical:=canonical||jsonb_build_object(k,p_look->k);
    else canonical:=canonical||jsonb_build_object(k,allowed->k->0); end if;
  end loop;
  if p_look ? 'acc' and (jsonb_typeof(p_look->'acc')<>'array' or jsonb_array_length(p_look->'acc')>6) then raise exception 'Неверные украшения'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_look->'acc','[]')) x where jsonb_typeof(x)<>'string' or not ('["glasses","earrings","hat","bow","beret","lashes"]'::jsonb ? (x#>>'{}'))) then raise exception 'Неизвестное украшение'; end if;
  canonical:=canonical||jsonb_build_object('acc',coalesce(p_look->'acc','[]'));
  -- Only the authenticated owner's home profile can be changed, even with a superadmin group header.
  update public.docs set data=data||jsonb_build_object('mascot',canonical),updated=now()
    where tenant_id=home and path='profiles/'||auth.uid()::text;
  if not found then raise exception 'Сначала завершите регистрацию'; end if;
  insert into public.docs(tenant_id,path,data) values(home,'avatars/'||auth.uid()::text,jsonb_build_object('mascot',canonical))
    on conflict(tenant_id,path) do update set data=public.docs.data||excluded.data,updated=now();
  return canonical;
end $$;
revoke all on function politeshik_private.save_my_mascot(jsonb) from public,anon,authenticated;
grant execute on function politeshik_private.save_my_mascot(jsonb) to authenticated;
create function public.save_my_mascot(p_look jsonb) returns jsonb language sql security invoker set search_path=''
 as $$select politeshik_private.save_my_mascot(p_look)$$;
revoke all on function public.save_my_mascot(jsonb) from public,anon;
grant execute on function public.save_my_mascot(jsonb) to authenticated;

create function politeshik_private.group_mascots() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare t text:=public.current_tenant(); result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
    or not (politeshik_private.is_super_admin() or exists(select 1 from public.members where uid=auth.uid() and tenant_id=t and status='approved')) then
    raise exception 'Нет доступа к группе' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'uid',m.uid,'rid',p.data->>'rid','name',case when a.uid is not null and m.tenant_id<>t then 'Админ Арина' else m.full_name end,
    'role',case when a.uid is not null then 'superadmin' else m.role end,
    -- A superadmin shares their mascot across groups; their home photo stays in its group.
    'avatar',case when m.tenant_id=t then coalesce(v.data->>'v','') else '' end,
    'mascot',coalesce(v.data->'mascot',p.data->'mascot','{}'::jsonb))), '[]') into result
  from public.members m left join politeshik_private.super_admins a on a.uid=m.uid
    left join public.docs p on p.tenant_id=m.tenant_id and p.path='profiles/'||m.uid::text
    left join public.docs v on v.tenant_id=m.tenant_id and v.path='avatars/'||m.uid::text
  where m.status='approved' and coalesce(m.requested_role,'student')<>'parent' and m.role in('student','admin','developer') and (m.tenant_id=t or a.uid is not null);
  return result;
end $$;
revoke all on function politeshik_private.group_mascots() from public,anon,authenticated;
grant execute on function politeshik_private.group_mascots() to authenticated;
create function public.group_mascots() returns jsonb language sql stable security invoker set search_path=''
 as $$select politeshik_private.group_mascots()$$;
revoke all on function public.group_mascots() from public,anon;
grant execute on function public.group_mascots() to authenticated;

-- Photo updates merge only the photo field, so clearing/replacing a photo cannot erase clothing.
create function politeshik_private.save_my_avatar(p_value text) returns boolean
language plpgsql security definer set search_path='' as $$
declare home text;
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then
    raise exception 'Нужен подтверждённый аккаунт' using errcode='42501'; end if;
  select tenant_id into home from public.members where uid=auth.uid() and status='approved' and role<>'parent' and coalesce(requested_role,'student')<>'parent';
  if home is null then raise exception 'Нет доступа к фото' using errcode='42501'; end if;
  if p_value is null or not (p_value='' or p_value ~ '^m[0-9]{1,2}$' or (p_value like 'data:image/jpeg;base64,%' and char_length(p_value)<60000)) then raise exception 'Неверное фото'; end if;
  insert into public.docs(tenant_id,path,data) values(home,'avatars/'||auth.uid()::text,jsonb_build_object('v',p_value))
    on conflict(tenant_id,path) do update set data=public.docs.data||excluded.data,updated=now();
  return true;
end $$;
revoke all on function politeshik_private.save_my_avatar(text) from public,anon,authenticated;
grant execute on function politeshik_private.save_my_avatar(text) to authenticated;
create function public.save_my_avatar(p_value text) returns boolean language sql security invoker set search_path=''
 as $$select politeshik_private.save_my_avatar(p_value)$$;
revoke all on function public.save_my_avatar(text) from public,anon;
grant execute on function public.save_my_avatar(text) to authenticated;
