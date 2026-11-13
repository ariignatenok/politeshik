-- An UPSERT runs BEFORE INSERT guards before resolving its conflict. Resending all existing
-- marks through that path falsely treated a preserved UP as a new student-assigned UP.
-- Seed only an empty document, lock the stored marks, then UPDATE to add the new ordinary mark.
-- Manual UP guards, the 24-hour window, certificate checks and home-group isolation remain intact.
create or replace function politeshik_private.self_attendance(p_date date,p_pair integer,p_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=politeshik_private.social_actor();home text;marks jsonb;k text;saved_import text;saved_self text;result jsonb;begin
 select tenant_id into home from public.members where uid=actor and status='approved' and coalesce(requested_role,'student')<>'parent';
 if politeshik_private.is_super_admin() and public.current_tenant()<>home then raise exception 'Личная посещаемость доступна только в вашей основной группе' using errcode='42501';end if;
 if p_status is null or p_status not in('п','о','н') or not politeshik_private.attendance_window(home,p_date,p_pair) then
  raise exception 'Отметиться можно на паре и в течение 24 часов после её окончания' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 saved_import:=current_setting('app.import',true);saved_self:=current_setting('app.self_attendance',true);
 perform set_config('app.self_attendance',actor::text,true);perform set_config('app.import','on',true);
 insert into public.docs(tenant_id,path,data) values(home,'attendance/'||actor::text,'{"marks":{}}') on conflict(tenant_id,path) do nothing;
 select coalesce(data->'marks','{}') into marks from public.docs where tenant_id=home and path='attendance/'||actor::text for update;
 marks:=coalesce(marks,'{}');k:=p_date::text||'|'||p_pair;
 if marks ? k then raise exception 'Отметка уже поставлена — исправить её может только староста';end if;
 if exists(select 1 from public.docs d cross join lateral jsonb_array_elements(coalesce(d.data->'items','[]')) c
  where d.tenant_id=home and d.path='certs/'||actor::text and c->>'confirmed'='true' and c->>'from'<=p_date::text and c->>'to'>=p_date::text
  and (coalesce(jsonb_array_length(c->'pairs'),0)=0 or c->'pairs' @> jsonb_build_array(p_pair))) then
  raise exception 'Пара закрыта подтверждённой справкой';end if;
 update public.docs set data=data||jsonb_build_object('marks',marks||jsonb_build_object(k,p_status),'updated',now())
  where tenant_id=home and path='attendance/'||actor::text returning data into result;
 perform set_config('app.import',coalesce(saved_import,''),true);perform set_config('app.self_attendance',coalesce(saved_self,''),true);return result;
end $$;
