create or replace function politeshik_private.register_student(p_group text,p_code text,p_rid text,p_subgroup text,p_secret text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); t text; gid text; ro public.roster; existing public.members; wanted text:='student';
  secret text; status text:='pending'; owner text; mail text; profile jsonb;
begin
  if u is null or not public.email_ok() then raise exception 'Войдите в аккаунт и подтвердите почту'; end if;
  select g.tenant_id,g.id into t,gid from public.groups g where g.tenant_id=p_group;
  if t is null then raise exception 'Выберите группу'; end if;
  perform pg_advisory_xact_lock(hashtextextended('registration:'||u::text,0));
  select * into existing from public.members m where m.uid=u;
  if found and existing.tenant_id<>t then raise exception 'Аккаунт уже закреплён за другой группой'; end if;
  if existing.status in ('banned','rejected') then raise exception 'Доступ закрыт администратором'; end if;
  if not politeshik_private.is_super_admin() and not exists(
    select 1 from public.group_codes c where c.tenant_id=t and c.group_id=gid and c.active and c.code=upper(btrim(p_code)))
    then raise exception 'Неверный код выбранной группы'; end if;
  select * into ro from public.roster r where r.tenant_id=t and r.rid=p_rid and r.flag='';
  if not found then raise exception 'Фамилия не относится к выбранной группе'; end if;
  if p_subgroup not in ('1','2') and ro.subgroup='' then raise exception 'Выберите подгруппу'; end if;
  perform pg_advisory_xact_lock(hashtextextended(t||':'||p_rid,0));
  select d.data->>'uid' into owner from public.docs d where d.tenant_id=t and d.path='claims/'||p_rid;
  if owner is not null and owner<>u::text then raise exception 'Эта фамилия уже занята'; end if;
  select d.data into profile from public.docs d where d.tenant_id=t and d.path='profiles/'||u::text;
  if coalesce(profile->>'rid','')<>'' and profile->>'rid'<>p_rid then raise exception 'Фамилию после регистрации менять нельзя'; end if;
  if t='group_2' and p_rid in ('g2_r12','g2_r13') then
    wanted:=case when p_rid='g2_r13' then 'admin' else 'developer' end;
    if not coalesce(existing.role=wanted and existing.status='approved',false) then
      if (select count(*) from public.admin_attempts a where a.uid=u and not a.ok and a.at>now()-interval '15 minutes')>=5 then
        raise exception 'Слишком много попыток: подождите 15 минут'; end if;
      select c.secret_hash into secret from politeshik_private.staff_credentials c where c.tenant_id=t and c.rid=p_rid and c.role=wanted;
      if secret is null or secret<>extensions.crypt(coalesce(p_secret,''),secret) then
        insert into public.admin_attempts(uid,ok,kind,tenant_id) values(u,false,wanted,t);
        return jsonb_build_object('ok',false,'error','Неверный дополнительный пароль');
      end if;
    end if;
    status:='approved';
  elsif ro.rid='r32' then
    if not politeshik_private.is_super_admin() then raise exception 'Аккаунт Админа Арины уже закреплён'; end if;
    wanted:='admin'; status:='approved';
  elsif existing.status='approved' then
    status:='approved'; wanted:=existing.role;
  end if;
  select email into mail from auth.users where id=u;
  insert into public.members(tenant_id,uid,role,status,requested_role,full_name,group_id,email,decided_at)
    values(t,u,wanted,status,'student',ro.name,gid,mail,case when status='approved' then now() end)
    on conflict(tenant_id,uid) do update set role=excluded.role,status=excluded.status,full_name=excluded.full_name,group_id=excluded.group_id;
  if wanted='admin' then insert into public.admins(uid,tenant_id) values(u,t) on conflict(uid) do nothing; end if;
  insert into public.docs(tenant_id,path,data) values(t,'claims/'||p_rid,jsonb_build_object('uid',u,'at',now()))
    on conflict(tenant_id,path) do update set data=excluded.data;
  profile:=coalesce(profile,'{}'::jsonb)||jsonb_build_object('rid',p_rid,'name',ro.name,'role',wanted,
    'group_id',gid,'subgroup',coalesce(nullif(ro.subgroup,''),p_subgroup),'joined',coalesce(profile->>'joined',now()::text));
  insert into public.docs(tenant_id,path,data) values(t,'profiles/'||u::text,profile)
    on conflict(tenant_id,path) do update set data=excluded.data;
  return jsonb_build_object('ok',true,'status',status,'role',wanted,'tenant_id',t);
end $$;
