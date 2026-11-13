-- Read-only educational timetable projection for explicitly scoped, approved bound curators.
create function politeshik_private.curator_group_schedule(p_tenant text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare account politeshik_private.curator_accounts:=politeshik_private.bound_curator();scope politeshik_private.curator_group_scopes;cfg jsonb;subjects jsonb;changes jsonb;begin
 select * into scope from politeshik_private.curator_group_scopes where curator_id=account.id and tenant_id=p_tenant;
 if not found then raise exception 'Группа не закреплена за вашим аккаунтом' using errcode='42501';end if;
 select data into cfg from public.docs where tenant_id=scope.tenant_id and path='group/config';
 select data->'subjects' into subjects from public.docs where tenant_id=scope.tenant_id and path='group/extra';
 select coalesce(jsonb_agg(jsonb_build_object('id',s->>'id','name',s->>'name','short',s->>'short')),'[]') into subjects from jsonb_array_elements(coalesce(subjects,cfg->'subjects','[]'))s;
 select data->'items' into changes from public.docs where tenant_id=scope.tenant_id and path='group/changes';
 return jsonb_build_object('tenant_id',scope.tenant_id,'group_id',scope.group_id,'read_only',true,
 'config',jsonb_build_object('schedule',coalesce(cfg->'schedule','[]'),'weeks',coalesce(cfg->'weeks','{}'),'pairs',coalesce(cfg->'pairs','[]'),'anchor',cfg->>'anchor','subjects',subjects),
 'changes',coalesce(changes,'[]'));
end $$;
revoke all on function politeshik_private.curator_group_schedule(text) from public,anon;grant execute on function politeshik_private.curator_group_schedule(text) to authenticated;
create function public.curator_group_schedule(p_tenant text) returns jsonb language sql stable security invoker set search_path='' as $$select politeshik_private.curator_group_schedule(p_tenant)$$;
revoke all on function public.curator_group_schedule(text) from public,anon;grant execute on function public.curator_group_schedule(text) to authenticated;
