-- Template consumed by copy_opbd_to_group2.cjs. No permissions or schedules change.
do $$
declare src jsonb; dst jsonb; original_dst jsonb; subject jsonb; merged jsonb; item jsonb;
  notes jsonb; cards jsonb; teachers jsonb; subjects jsonb:='[]'; links jsonb; formulas jsonb;
  seed jsonb:=current_setting('app.opbd_seed')::jsonb; attachment record; source_file jsonb;
begin
  select data into strict src from public.docs where tenant_id='group_1' and path='group/extra' for share;
  select data into strict dst from public.docs where tenant_id='group_2' and path='group/extra' for update;
  original_dst:=dst;
  select x into strict subject from jsonb_array_elements(src->'subjects') x where x->>'id'='s_opbd';
  notes:=coalesce(dst->'notes','[]'); cards:=coalesce(dst->'cards','[]'); teachers:=coalesce(dst->'teachers','[]');
  for item in select x from jsonb_array_elements(coalesce(src->'notes','[]')||(seed->'notes')) x where x->>'subjectId'='s_opbd' loop
    if not exists(select 1 from jsonb_array_elements(notes) n where n->>'id'=item->>'id') then
      notes:=notes||jsonb_build_array(item||jsonb_build_object('updated',coalesce(item->>'updated',now()::text)));
    end if;
  end loop;
  for item in select x from jsonb_array_elements(coalesce(src->'cards','[]')||(seed->'cards')) x where x->>'subjectId'='s_opbd' loop
    if not exists(select 1 from jsonb_array_elements(cards) c where c->>'id'=item->>'id') then
      cards:=cards||jsonb_build_array(item-'known');
    end if;
  end loop;
  -- Copy binary document payloads into the destination tenant, not cross-tenant links.
  for attachment in select distinct f->>'id' as id from jsonb_array_elements(notes) n
    cross join lateral jsonb_array_elements(coalesce(n->'files','[]')) f where n->>'subjectId'='s_opbd' loop
    select data into source_file from public.docs where tenant_id='group_1' and path='group/file/'||attachment.id;
    if source_file is null then
      if not exists(select 1 from public.docs where tenant_id='group_2' and path='group/file/'||attachment.id) then
        raise exception 'Missing OPBD attachment %',attachment.id;
      end if;
    else
      insert into public.docs(tenant_id,path,data) values('group_2','group/file/'||attachment.id,source_file)
        on conflict(tenant_id,path) do nothing;
      if not exists(select 1 from public.docs where tenant_id='group_2' and path='group/file/'||attachment.id and data=source_file) then
        raise exception 'Destination attachment differs: %',attachment.id;
      end if;
    end if;
  end loop;
  for item in select x from jsonb_array_elements(coalesce(src->'teachers','[]')) x where x->'subjectIds' ? 's_opbd' loop
    if not exists(select 1 from jsonb_array_elements(teachers) t where t->>'id'=item->>'id') then
      teachers:=teachers||jsonb_build_array(item||jsonb_build_object('subjectIds',jsonb_build_array('s_opbd')));
    end if;
  end loop;
  for item in select x from jsonb_array_elements(dst->'subjects') x loop
    if item->>'id'='s_opbd' then
      links:=coalesce(item->'links','[]'); formulas:=coalesce(item->'formulas','[]');
      for merged in select x from jsonb_array_elements(coalesce(subject->'links','[]')) x loop
        if not exists(select 1 from jsonb_array_elements(links) l where l->>'url'=merged->>'url') then links:=links||jsonb_build_array(merged); end if;
      end loop;
      for merged in select x from jsonb_array_elements(coalesce(subject->'formulas','[]')) x loop
        if not exists(select 1 from jsonb_array_elements(formulas) f where f->>'id'=merged->>'id') then formulas:=formulas||jsonb_build_array(merged); end if;
      end loop;
      item:=item||(subject-'links'-'formulas'-'hasFormulas')||jsonb_build_object('links',links,'formulas',formulas,
        'hasFormulas',coalesce((item->>'hasFormulas')::boolean,false) or coalesce((subject->>'hasFormulas')::boolean,false));
    end if;
    subjects:=subjects||jsonb_build_array(item);
  end loop;
  if not exists(select 1 from jsonb_array_elements(subjects) s where s->>'id'='s_opbd') then raise exception 'Destination OPBD subject missing'; end if;
  dst:=dst||jsonb_build_object('notes',notes,'cards',cards,'teachers',teachers,'subjects',subjects,'updated',now());
  assert dst->'homework'=original_dst->'homework','Destination homework changed';
  update public.docs set data=dst where tenant_id='group_2' and path='group/extra';
  assert (select data=src from public.docs where tenant_id='group_1' and path='group/extra'),'Source content changed';
end $$;
select jsonb_build_object(
  'notes',(select count(*) from jsonb_array_elements(data->'notes') n where n->>'subjectId'='s_opbd'),
  'cards',(select count(*) from jsonb_array_elements(data->'cards') c where c->>'subjectId'='s_opbd'),
  'materials',(select jsonb_array_length(s->'links') from jsonb_array_elements(data->'subjects') s where s->>'id'='s_opbd'),
  'full_teacher_present',exists(select 1 from jsonb_array_elements(data->'teachers') t where t->>'id'='t_andreev' and coalesce(t->>'notes','')<>'')
) as copied_content from public.docs where tenant_id='group_2' and path='group/extra';
