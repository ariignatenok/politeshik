-- Own initial marks are accepted during the pair and for 24 hours after its end.
-- Existing attendance, staff/tenant boundaries and confirmed certificates stay protected.
create function politeshik_private.attendance_window(p_tenant text,p_date date,p_pair integer) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare cfg jsonb; slot jsonb; starts text; ends text;begin
 if p_pair is null or p_pair not between 1 and 5 or p_date is null or p_date<'2026-10-01' then return false;end if;
 select data into cfg from public.docs where tenant_id=p_tenant and path='group/config';
 slot:=cfg->'pairs'->(p_pair-1);
 starts:=coalesce(nullif(slot->>'start',''),(array['09:00','10:45','12:50','14:30','16:10'])[p_pair]);
 ends:=coalesce(nullif(slot->>'end',''),(array['10:30','12:40','14:20','16:00','17:40'])[p_pair]);
 return now()>=(p_date+starts::time) at time zone 'Europe/Moscow'
    and now()<=((p_date+ends::time) at time zone 'Europe/Moscow')+interval '24 hours';
end $$;
revoke all on function politeshik_private.attendance_window(text,date,integer) from public,anon,authenticated;

create function politeshik_private.self_attendance(p_date date,p_pair integer,p_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor();home text; marks jsonb; k text; saved_import text;saved_self text;result jsonb;begin
 select tenant_id into home from public.members where uid=actor and status='approved' and coalesce(requested_role,'student')<>'parent';
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
end $$;
revoke all on function politeshik_private.self_attendance(date,integer,text) from public,anon;
grant execute on function politeshik_private.self_attendance(date,integer,text) to authenticated;
create function public.self_attendance(p_date date,p_pair integer,p_status text) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.self_attendance(p_date,p_pair,p_status)$$;
revoke all on function public.self_attendance(date,integer,text) from public,anon;grant execute on function public.self_attendance(date,integer,text) to authenticated;

create function politeshik_private.normalize_excused_status() returns trigger language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(new.data->'marks')='object' then
  new.data:=jsonb_set(new.data,'{marks}',coalesce((select jsonb_object_agg(key,case when value='"у"'::jsonb then '"уп"'::jsonb else value end) from jsonb_each(new.data->'marks')),'{}'));
 end if;return new;
end $$;
revoke all on function politeshik_private.normalize_excused_status() from public,anon,authenticated;
create trigger aaa_normalize_excused before insert or update on public.docs for each row when(new.path like 'attendance/%') execute function politeshik_private.normalize_excused_status();
-- Protect old group-1 clients as well: same deadline for direct initial marks.
DO $outer$ declare definition text;begin
 select pg_get_functiondef('public.docs_guard()'::regprocedure) into definition;
 definition:=replace(definition,$old$(left(k, 10) <> today or (v #>> '{}') not in ('п', 'о', 'н'))$old$,$new$(not politeshik_private.attendance_window(new.tenant_id,left(k,10)::date,split_part(k,'|',2)::integer) or (v #>> '{}') not in ('п', 'о', 'н'))$new$);
 definition:=replace(definition,'Отметиться можно только в день пары','Отметиться можно на паре и в течение 24 часов после её окончания');
 execute definition;
end $outer$;
-- Normalize existing legacy У without altering any other mark or certificate.
DO $$ declare saved text:=current_setting('app.import',true);begin
 perform set_config('app.import','on',true);
 update public.docs d set data=d.data where d.path like 'attendance/%' and jsonb_typeof(d.data->'marks')='object'
 and exists(select 1 from jsonb_each_text(d.data->'marks') m where m.value='у');
 perform set_config('app.import',coalesce(saved,''),true);
end $$;

-- Keep group 3's registration protection unchanged. Only this caller's own RPC write may pass its attendance branch.
DO $outer$ declare definition text;begin
 select pg_get_functiondef('politeshik_private.guard_group3_document()'::regprocedure) into definition;
 if position($find$if split_part(new.path,'/',1)='attendance' and not public.is_admin() then$find$ in definition)=0 then raise exception 'Unexpected group 3 attendance guard';end if;
 definition:=replace(definition,$find$if split_part(new.path,'/',1)='attendance' and not public.is_admin() then$find$,$replacement$if split_part(new.path,'/',1)='attendance' and not public.is_admin() and not coalesce(current_setting('app.self_attendance',true)=auth.uid()::text and new.path='attendance/'||auth.uid()::text,false) then$replacement$);
 execute definition;
end $outer$;
