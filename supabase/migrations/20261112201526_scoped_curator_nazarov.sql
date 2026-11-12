-- Curator access is a separate, read-only projection of three explicit groups.
-- Existing tenant selection, student/leader registration, RLS policies, admin roles and private chats are unchanged.
create table politeshik_private.curator_accounts(
 id text primary key,email text not null unique check(email=lower(email)),full_name text not null,
 home_tenant text not null references public.tenants(id),teacher_key text not null,schedule_file text not null,
 claimed_uid uuid unique references auth.users(id) on delete set null,active boolean not null default true);
create table politeshik_private.curator_group_scopes(
 curator_id text not null references politeshik_private.curator_accounts(id) on delete cascade,
 tenant_id text not null references public.tenants(id),group_id text not null references public.groups(id),primary key(curator_id,tenant_id));
alter table politeshik_private.curator_accounts enable row level security;
alter table politeshik_private.curator_group_scopes enable row level security;
revoke all on politeshik_private.curator_accounts,politeshik_private.curator_group_scopes from public,anon,authenticated;
create policy curator_accounts_internal on politeshik_private.curator_accounts as restrictive for all to authenticated using(false) with check(false);
create policy curator_scopes_internal on politeshik_private.curator_group_scopes as restrictive for all to authenticated using(false) with check(false);
insert into politeshik_private.curator_accounts(id,email,full_name,home_tenant,teacher_key,schedule_file)
 values('nazarov_da','nazarov_da@spbstu.ru','Назаров Денис Александрович','group_4','Назаров Д.А.','schedule-teacher-nazarov-da.json');
insert into politeshik_private.curator_group_scopes(curator_id,tenant_id,group_id) values
 ('nazarov_da','group_4','g_24290907_2092'),('nazarov_da','group_5','g_25290907_3111'),('nazarov_da','group_6','g_25290907_1091');

create function politeshik_private.bound_curator() returns politeshik_private.curator_accounts
language plpgsql stable security definer set search_path='' as $$
declare account politeshik_private.curator_accounts;begin
 select a.* into account from politeshik_private.curator_accounts a join public.members m on m.uid=a.claimed_uid and m.tenant_id=a.home_tenant
 join auth.users u on u.id=m.uid where a.claimed_uid=auth.uid() and a.active and m.role='curator' and m.status='approved' and m.requested_role='staff' and u.email_confirmed_at is not null;
 if not found then raise exception 'Кабинет куратора недоступен' using errcode='42501';end if;return account;
end $$;
revoke all on function politeshik_private.bound_curator() from public,anon,authenticated;
create function politeshik_private.curator_metadata() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare account politeshik_private.curator_accounts:=politeshik_private.bound_curator();groups jsonb;begin
 select coalesce(jsonb_agg(jsonb_build_object('tenant_id',s.tenant_id,'group_id',s.group_id,'name',g.name,'number',substring(g.name from '[0-9]{8}/[0-9]{4}'),'students',(select count(*) from public.roster r where r.tenant_id=s.tenant_id and r.flag='')) order by s.tenant_id),'[]') into groups
 from politeshik_private.curator_group_scopes s join public.groups g on g.id=s.group_id and g.tenant_id=s.tenant_id where s.curator_id=account.id;
 return jsonb_build_object('matched',true,'active',true,'name',account.full_name,'teacher',account.teacher_key,'schedule_file',account.schedule_file,'groups',groups);
end $$;
revoke all on function politeshik_private.curator_metadata() from public,anon,authenticated;

create function politeshik_private.activate_bound_curator() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();mail text;account politeshik_private.curator_accounts;member_row public.members;gid text;existing_profile jsonb;begin
 if actor is null then raise exception 'Войдите в аккаунт' using errcode='42501';end if;
 select lower(email) into mail from auth.users where id=actor and email_confirmed_at is not null;
 if mail is null then return jsonb_build_object('matched',false);end if;
 select * into account from politeshik_private.curator_accounts where active and(claimed_uid=actor or email=mail) for update;
 if not found then return jsonb_build_object('matched',false);end if;
 if account.claimed_uid is not null and account.claimed_uid<>actor then raise exception 'Аккаунт куратора уже закреплён' using errcode='42501';end if;
 select * into member_row from public.members where uid=actor for update;
 -- Revoking an activated curator's membership must never be undone by signing in again.
 if account.claimed_uid=actor then
  if member_row.role='curator' and member_row.status='approved' and member_row.tenant_id=account.home_tenant and member_row.requested_role='staff' then return politeshik_private.curator_metadata();end if;
  return jsonb_build_object('matched',false);
 end if;
 if member_row.uid is not null and (member_row.tenant_id<>account.home_tenant or member_row.status in('banned','rejected') or member_row.role not in('student','curator') or(member_row.status='approved' and member_row.role<>'curator') or member_row.requested_role<>'staff') then
  raise exception 'Эта почта уже связана с другим кабинетом. Обратитесь к Админу Арине' using errcode='42501';end if;
 if exists(select 1 from public.docs where path='profiles/'||actor::text and coalesce(data->>'rid','')<>'') then raise exception 'Студенческий кабинет нельзя преобразовать в куратора' using errcode='42501';end if;
 if exists(select 1 from politeshik_private.curator_group_scopes s join public.groups g on g.id=s.group_id and g.tenant_id=s.tenant_id where s.curator_id=account.id and g.curator_uid is not null and g.curator_uid<>actor) then raise exception 'В одной из групп уже назначен другой куратор';end if;
 select group_id into gid from politeshik_private.curator_group_scopes where curator_id=account.id and tenant_id=account.home_tenant;
 if gid is null then raise exception 'Не настроена основная группа куратора';end if;
 insert into public.members(tenant_id,uid,role,status,requested_role,full_name,group_id,email,decided_at) values(account.home_tenant,actor,'curator','approved','staff',account.full_name,gid,mail,now())
 on conflict(tenant_id,uid) do update set role='curator',status='approved',requested_role='staff',full_name=excluded.full_name,group_id=excluded.group_id,decided_at=now();
 select data into existing_profile from public.docs where tenant_id=account.home_tenant and path='profiles/'||actor::text;
 insert into public.docs(tenant_id,path,data) values(account.home_tenant,'profiles/'||actor::text,(coalesce(existing_profile,'{}')-'rid'-'subgroup')||jsonb_build_object('role','curator','name',account.full_name,'joined',coalesce(existing_profile->>'joined',now()::text)))
 on conflict(tenant_id,path) do update set data=excluded.data;
 update politeshik_private.curator_accounts set claimed_uid=actor where id=account.id;
 update public.groups g set curator_uid=actor from politeshik_private.curator_group_scopes s where s.curator_id=account.id and s.group_id=g.id and s.tenant_id=g.tenant_id;
 return politeshik_private.curator_metadata();
end $$;
revoke all on function politeshik_private.activate_bound_curator() from public,anon;grant execute on function politeshik_private.activate_bound_curator() to authenticated;
create function public.activate_bound_curator() returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.activate_bound_curator()$$;
revoke all on function public.activate_bound_curator() from public,anon;grant execute on function public.activate_bound_curator() to authenticated;

create function politeshik_private.curator_group_view(p_tenant text,p_month text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare account politeshik_private.curator_accounts:=politeshik_private.bound_curator();scope politeshik_private.curator_group_scopes;students jsonb;news jsonb;month_end text;begin
 if p_month is null or p_month !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'Выберите месяц';end if;
 select * into scope from politeshik_private.curator_group_scopes where curator_id=account.id and tenant_id=p_tenant;
 if not found then raise exception 'Группа не закреплена за вашим аккаунтом' using errcode='42501';end if;
 month_end:=to_char((p_month||'-01')::date+interval '1 month'-interval '1 day','YYYY-MM-DD');
 select coalesce(jsonb_agg(jsonb_build_object('rid',r.rid,'n',r.n,'name',r.name,'uid',s.uid,'registered',s.uid is not null,'role',s.role,'subgroup',coalesce(s.profile->>'subgroup',r.subgroup,''),
 'marks',coalesce((select jsonb_object_agg(key,value) from jsonb_each(coalesce(s.marks,'{}')) where left(key,7)=p_month),'{}'),
 'certs',coalesce((select jsonb_agg(jsonb_build_object('from',c->>'from','to',c->>'to','confirmed',c->>'confirmed'='true','pairs',coalesce(c->'pairs','[]')))
  from jsonb_array_elements(coalesce(s.certs,'[]')) c where c->>'from'<=month_end and c->>'to'>=p_month||'-01'),'[]')) order by r.n),'[]') into students
 from public.roster r left join lateral(
  select m.uid,m.role,d.data as profile,a.data->'marks' as marks,c.data->'items' as certs
  from public.members m join public.docs d on d.tenant_id=m.tenant_id and d.path='profiles/'||m.uid::text and d.data->>'rid'=r.rid
  left join public.docs a on a.tenant_id=m.tenant_id and a.path='attendance/'||m.uid::text
  left join public.docs c on c.tenant_id=m.tenant_id and c.path='certs/'||m.uid::text
  left join public.docs claim on claim.tenant_id=m.tenant_id and claim.path='claims/'||r.rid
  where m.tenant_id=r.tenant_id and m.status='approved' and m.role in('student','admin','developer') and coalesce(m.requested_role,'student')<>'parent'
  order by coalesce(claim.data->>'uid'=m.uid::text,false) desc,m.created_at,m.uid limit 1
 )s on true where r.tenant_id=scope.tenant_id and r.flag='';
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'title',n.title,'body',n.body,'date',n.news_date,'created_at',n.created_at) order by n.news_date desc,n.created_at desc),'[]') into news
 from(select id,title,body,news_date,created_at from public.news where tenant_id=scope.tenant_id order by news_date desc,created_at desc limit 30)n;
 return jsonb_build_object('tenant_id',scope.tenant_id,'group_id',scope.group_id,'name',(select name from public.groups where id=scope.group_id),'month',p_month,'students',students,'news',news,'read_only',true);
end $$;
revoke all on function politeshik_private.curator_group_view(text,text) from public,anon;grant execute on function politeshik_private.curator_group_view(text,text) to authenticated;
create function public.curator_group_view(p_tenant text,p_month text) returns jsonb language sql stable security invoker set search_path='' as $$select politeshik_private.curator_group_view(p_tenant,p_month)$$;
revoke all on function public.curator_group_view(text,text) from public,anon;grant execute on function public.curator_group_view(text,text) to authenticated;
