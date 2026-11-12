-- Add vampire and menswear catalogue IDs; preserve ownership, approval and tenant authorization.
create or replace function politeshik_private.save_my_mascot(p_look jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare home text; k text; allowed jsonb:='{"body":["green","pink","blue","lilac","cream","peach","white","dark"],"outfit":["none","hoodie","cardigan","uniform","fur","pinkfur","leopard","leather","striped","vampirecape","detective","medicalcoat","firegear"],"hair":["none","bob","long","waves","twotails","bun","pixie","emo","mohawk","curls"],"hairColor":["black","brown","blonde","ginger","pink","blue","purple","white"],"glasses":["none","round","square","cat","heart","sun","stars","pinkheart"],"hand":["none","coffee","tea","bubbletea","book","phone","flower","medkit","radio"],"mood":["","cheer","thinking","sleepy","angry"],"top":["none","whitesweater","blacktee","polo","beigeknit"],"chain":["none","shortgold","chunkygold","doublegold"],"hat":["none","purplewitch","headphones","blackcap","medicalcap","firehelmet"],"shoes":["none","chunkysneakers"],"bag":["none","monogram"],"face":["normal","vampire"]}'; canonical jsonb:='{}';
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
