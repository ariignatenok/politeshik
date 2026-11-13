-- Students propose homework; only their group's approved admin (or Arina in that group) publishes it.
create table politeshik_private.homework_proposals(
 id uuid primary key,tenant_id text not null references public.tenants(id),author uuid not null references auth.users(id) on delete cascade,
 subject_id text not null check(char_length(subject_id) between 1 and 160),subject_name text not null check(char_length(subject_name) between 1 and 250),
 body text not null check(char_length(btrim(body)) between 1 and 4000),deadline date,
 status text not null default 'pending' check(status in('pending','approved','rejected')),
 created_at timestamptz not null default now(),decided_at timestamptz,decided_by uuid references auth.users(id) on delete set null
);
create index homework_proposals_scope_idx on politeshik_private.homework_proposals(tenant_id,status,created_at desc);
create index homework_proposals_author_idx on politeshik_private.homework_proposals(author,tenant_id,created_at desc);
create index homework_proposals_decider_idx on politeshik_private.homework_proposals(decided_by);
alter table politeshik_private.homework_proposals enable row level security;
revoke all on politeshik_private.homework_proposals from public,anon,authenticated;
create policy homework_proposals_rpc_only on politeshik_private.homework_proposals as restrictive for all to authenticated using(false) with check(false);

create function politeshik_private.homework_proposal_submit(p_id uuid,p_subject text,p_subject_name text,p_body text,p_deadline date default null) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();t text:=politeshik_private.active_tenant();existing politeshik_private.homework_proposals;begin
 if actor is null or not public.email_ok() or not exists(select 1 from public.members where uid=actor and tenant_id=t and role in('student','developer') and status='approved' and coalesce(requested_role,'student')<>'parent') then raise exception 'Предлагать ДЗ могут одобренные студенты своей группы' using errcode='42501';end if;
 if p_id is null or char_length(coalesce(btrim(p_subject),'')) not between 1 and 160 or char_length(coalesce(btrim(p_subject_name),'')) not between 1 and 250 or char_length(coalesce(btrim(p_body),'')) not between 1 and 4000 then raise exception 'Выберите предмет и напишите задание (до 4000 символов)';end if;
 perform pg_advisory_xact_lock(hashtextextended('homework:'||actor::text,0));
 select * into existing from politeshik_private.homework_proposals where id=p_id;
 if found then
  if existing.author=actor and existing.tenant_id=t and existing.subject_id=btrim(p_subject) and existing.body=btrim(p_body) and existing.deadline is not distinct from p_deadline then return existing.id;end if;
  raise exception 'Неверный идентификатор предложения';
 end if;
 if (select count(*) from politeshik_private.homework_proposals where author=actor and tenant_id=t and status='pending')>=10 then raise exception 'Дождитесь проверки предыдущих предложений (до 10 одновременно)';end if;
 insert into politeshik_private.homework_proposals(id,tenant_id,author,subject_id,subject_name,body,deadline) values(p_id,t,actor,btrim(p_subject),btrim(p_subject_name),btrim(p_body),p_deadline);return p_id;
end $$;
revoke all on function politeshik_private.homework_proposal_submit(uuid,text,text,text,date) from public,anon;grant execute on function politeshik_private.homework_proposal_submit(uuid,text,text,text,date) to authenticated;
create function public.homework_proposal_submit(p_id uuid,p_subject text,p_subject_name text,p_body text,p_deadline date default null) returns uuid language sql security invoker set search_path='' as $$select politeshik_private.homework_proposal_submit(p_id,p_subject,p_subject_name,p_body,p_deadline)$$;
revoke all on function public.homework_proposal_submit(uuid,text,text,text,date) from public,anon;grant execute on function public.homework_proposal_submit(uuid,text,text,text,date) to authenticated;

create function politeshik_private.homework_proposal_list() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();t text:=politeshik_private.active_tenant();admin boolean:=public.is_admin();result jsonb;begin
 if actor is null or not public.email_ok() or(not admin and not exists(select 1 from public.members where uid=actor and tenant_id=t and role in('student','developer') and status='approved' and coalesce(requested_role,'student')<>'parent')) then raise exception 'Предложения ДЗ недоступны' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') into result from
 (select p.id,p.subject_id,p.subject_name,p.body,p.deadline,p.status,p.created_at,m.full_name as author_name from politeshik_private.homework_proposals p left join public.members m on m.uid=p.author and m.tenant_id=p.tenant_id where p.tenant_id=t and(case when admin then p.status='pending' else p.author=actor end) order by p.created_at desc limit 100)x;return result;
end $$;
revoke all on function politeshik_private.homework_proposal_list() from public,anon;grant execute on function politeshik_private.homework_proposal_list() to authenticated;
create function public.homework_proposal_list() returns jsonb language sql stable security invoker set search_path='' as $$select politeshik_private.homework_proposal_list()$$;
revoke all on function public.homework_proposal_list() from public,anon;grant execute on function public.homework_proposal_list() to authenticated;

create function politeshik_private.homework_proposal_decide(p_id uuid,p_approve boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();t text:=politeshik_private.active_tenant();proposal politeshik_private.homework_proposals;extra jsonb;subject jsonb;homework jsonb;begin
 if actor is null or not public.email_ok() or not public.is_admin() then raise exception 'Подтверждать ДЗ может только староста своей группы' using errcode='42501';end if;
 if p_approve is null then raise exception 'Выберите действие';end if;
 select * into proposal from politeshik_private.homework_proposals where id=p_id and tenant_id=t for update;
 if not found then raise exception 'Предложение не найдено' using errcode='42501';end if;
 if proposal.status<>'pending' then return jsonb_build_object('status',proposal.status);end if;
 if p_approve then
  insert into public.docs(tenant_id,path,data) values(t,'group/extra','{"subjects":[],"teachers":[],"homework":[],"notes":[],"cards":[]}') on conflict(tenant_id,path) do nothing;
  select data into extra from public.docs where tenant_id=t and path='group/extra' for update;
  if not exists(select 1 from jsonb_array_elements(coalesce(extra->'subjects','[]'))s where s->>'id'=proposal.subject_id) then
   select s into subject from public.docs d cross join lateral jsonb_array_elements(coalesce(d.data->'subjects','[]'))s where d.tenant_id=t and d.path='group/config' and s->>'id'=proposal.subject_id limit 1;
   subject:=coalesce(subject,jsonb_build_object('id',proposal.subject_id,'name',proposal.subject_name,'short',proposal.subject_name,'color','#6366f1','links','[]'::jsonb,'formulas','[]'::jsonb));
   extra:=jsonb_set(extra,'{subjects}',coalesce(extra->'subjects','[]')||jsonb_build_array(subject));
  end if;
  homework:=jsonb_build_object('id','hp_'||proposal.id::text,'subjectId',proposal.subject_id,'text',proposal.body,'deadline',coalesce(proposal.deadline::text,''));
  extra:=jsonb_set(extra,'{homework}',coalesce(extra->'homework','[]')||jsonb_build_array(homework))||jsonb_build_object('updated',now());
  if octet_length(extra::text)>230000 then raise exception 'В группе слишком много общих материалов. Освободите место перед публикацией';end if;
  update public.docs set data=extra where tenant_id=t and path='group/extra';
 end if;
 update politeshik_private.homework_proposals set status=case when p_approve then 'approved' else 'rejected' end,decided_at=now(),decided_by=actor where id=p_id;
 return jsonb_build_object('status',case when p_approve then 'approved' else 'rejected' end);
end $$;
revoke all on function politeshik_private.homework_proposal_decide(uuid,boolean) from public,anon;grant execute on function politeshik_private.homework_proposal_decide(uuid,boolean) to authenticated;
create function public.homework_proposal_decide(p_id uuid,p_approve boolean) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.homework_proposal_decide(p_id,p_approve)$$;
revoke all on function public.homework_proposal_decide(uuid,boolean) from public,anon;grant execute on function public.homework_proposal_decide(uuid,boolean) to authenticated;
