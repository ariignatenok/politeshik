-- Cosmetic nickname stays inside the authenticated owner's canonical appearance.
-- Add vampire and menswear catalogue IDs; preserve ownership, approval and tenant authorization.
create or replace function politeshik_private.save_my_mascot(p_look jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare home text; k text; allowed jsonb:='{"body":["green","pink","blue","lilac","cream","peach","white","dark"],"outfit":["none","hoodie","cardigan","uniform","fur","pinkfur","leopard","leather","striped","vampirecape","detective","medicalcoat","firegear"],"hair":["none","bob","long","waves","twotails","bun","pixie","emo","mohawk","curls"],"hairColor":["black","brown","blonde","ginger","pink","blue","purple","white"],"glasses":["none","round","square","cat","heart","sun","stars","pinkheart"],"hand":["none","coffee","tea","bubbletea","book","phone","flower","medkit","radio"],"mood":["","cheer","thinking","sleepy","angry"],"top":["none","whitesweater","blacktee","polo","beigeknit"],"chain":["none","shortgold","chunkygold","doublegold"],"hat":["none","purplewitch","headphones","blackcap","medicalcap","firehelmet"],"shoes":["none","chunkysneakers"],"bag":["none","monogram"],"face":["normal","vampire"]}'; canonical jsonb:='{}'; nick text;
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then
    raise exception 'Войдите в подтверждённый аккаунт' using errcode='42501'; end if;
  select m.tenant_id into home from public.members m where m.uid=auth.uid() and m.status='approved'
    and m.role in('student','admin','developer') and coalesce(m.requested_role,'student')<>'parent';
  if home is null then raise exception 'Внешность доступна после одобрения регистрации' using errcode='42501'; end if;
  if p_look is null or jsonb_typeof(p_look)<>'object' or pg_column_size(p_look)>4000 then raise exception 'Неверный образ'; end if;
  if exists(select 1 from jsonb_object_keys(p_look) x where not (allowed ? x or x='acc' or x='nickname')) then raise exception 'Неизвестная настройка'; end if;
  for k in select jsonb_object_keys(allowed) loop
    if p_look ? k then
      if jsonb_typeof(p_look->k)<>'string' or not (allowed->k ? (p_look->>k)) then raise exception 'Неверная настройка: %',k; end if;
      canonical:=canonical||jsonb_build_object(k,p_look->k);
    else canonical:=canonical||jsonb_build_object(k,allowed->k->0); end if;
  end loop;
  if p_look ? 'acc' and (jsonb_typeof(p_look->'acc')<>'array' or jsonb_array_length(p_look->'acc')>6) then raise exception 'Неверные украшения'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_look->'acc','[]')) x where jsonb_typeof(x)<>'string' or not ('["glasses","earrings","hat","bow","beret","lashes"]'::jsonb ? (x#>>'{}'))) then raise exception 'Неизвестное украшение'; end if;
  canonical:=canonical||jsonb_build_object('acc',coalesce(p_look->'acc','[]'));
  if p_look ? 'nickname' then
    if jsonb_typeof(p_look->'nickname')<>'string' then raise exception 'Ник должен быть текстом';end if;
    nick:=btrim(p_look->>'nickname');
    if char_length(nick)>24 or nick ~ '[[:cntrl:]]' then raise exception 'Ник: до 24 символов, без переносов строк';end if;
  else
    select left(regexp_replace(coalesce(data->'mascot'->>'nickname',''),'[[:cntrl:]]','','g'),24) into nick
    from public.docs where tenant_id=home and path='profiles/'||auth.uid()::text;
  end if;
  canonical:=canonical||jsonb_build_object('nickname',coalesce(nick,''));

  -- Only the authenticated owner's home profile can be changed, even with a superadmin group header.
  update public.docs set data=data||jsonb_build_object('mascot',canonical),updated=now()
    where tenant_id=home and path='profiles/'||auth.uid()::text;
  if not found then raise exception 'Сначала завершите регистрацию'; end if;
  insert into public.docs(tenant_id,path,data) values(home,'avatars/'||auth.uid()::text,jsonb_build_object('mascot',canonical))
    on conflict(tenant_id,path) do update set data=public.docs.data||excluded.data,updated=now();
  return canonical;
end $$;

alter table politeshik_private.club_visitors
 add column x double precision not null default (20+random()*60) check(x between 0 and 100),
 add column y double precision not null default (55+random()*30) check(y between 0 and 100),
 add column jumped_at timestamptz;
create or replace function politeshik_private.club_visit(p_action text default 'state',p_dancing boolean default true) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor(); visitors jsonb;
begin
 if p_action is null or p_action not in('state','join','beat','leave') then raise exception 'Неверное действие';end if;
 if p_action='join' then
  insert into politeshik_private.club_visitors(uid,dancing,dance) values(actor,coalesce(p_dancing,true),case when coalesce(p_dancing,true) then 'bounce' else 'still' end)
  on conflict(uid) do update set seen_at=now();
 elsif p_action='beat' then update politeshik_private.club_visitors set seen_at=now() where uid=actor;
 elsif p_action='leave' then delete from politeshik_private.club_visitors where uid=actor;end if;
 select coalesce(jsonb_agg(card||jsonb_build_object('dancing',v.dancing,'dance',v.dance,'drink',v.drink,'thought',v.thought,'x',v.x,'y',v.y,'jumped_at',v.jumped_at) order by v.uid),'[]') into visitors
 from politeshik_private.club_visitors v cross join lateral (select politeshik_private.social_profile(v.uid)-'avatar'-'about' as card) p
 where card is not null;
 return jsonb_build_object('visitors',visitors,'joined',exists(select 1 from politeshik_private.club_visitors where uid=actor));
end $$;

-- Room coordinates are fictional club positions, not physical location. Only the owner can move or jump.
create function politeshik_private.club_move(p_x double precision default null,p_y double precision default null,p_jump boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor();begin
 if (p_x is null)<>(p_y is null) or (p_x is not null and (not(p_x between 0 and 100) or not(p_y between 0 and 100))) or p_jump is null then raise exception 'Неверное место на танцполе';end if;
 update politeshik_private.club_visitors set x=coalesce(p_x,x),y=coalesce(p_y,y),jumped_at=case when p_jump then clock_timestamp() else jumped_at end where uid=actor;
 if not found then raise exception 'Сначала зайдите на танцпол';end if;
 return politeshik_private.club_visit('state',true);
end $$;
revoke all on function politeshik_private.club_move(double precision,double precision,boolean) from public,anon;
grant execute on function politeshik_private.club_move(double precision,double precision,boolean) to authenticated;
create function public.club_move(p_x double precision default null,p_y double precision default null,p_jump boolean default false) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.club_move(p_x,p_y,p_jump)$$;
revoke all on function public.club_move(double precision,double precision,boolean) from public,anon;
grant execute on function public.club_move(double precision,double precision,boolean) to authenticated;
